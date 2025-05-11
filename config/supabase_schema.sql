-- Schema for Rent Whisperer Supabase Database
-- Updated to match the provided schema diagram (direct tenant-to-unit relationship)

-- DATA ARCHITECTURE OVERVIEW (Updated):
-- 1. tenants table: Stores tenant personal information and a direct link to their unit (unit_id)
-- 2. units table: Stores unit information including rent_amount, rent_due_day, lease_start, lease_end
-- 3. properties table: Stores property information
-- 4. rent_payments table: Stores payment records, linked to tenants and units.
-- 5. All property information should be derived through relationships.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enable Row Level Security
alter table if exists auth.users enable row level security;

-- Create landlords table first (no dependencies)
create table if not exists public.landlords (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id),
  name text not null,
  email text not null,
  phone text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create properties table (depends on landlords)
create table if not exists public.properties (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text not null,
  city text not null,
  province text not null,
  postal_code text not null,
  landlord_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create units table (depends on properties)
-- Includes rent_amount, rent_due_day, lease_start, lease_end as per the provided schema diagram
create table if not exists public.units (
  id uuid default uuid_generate_v4() primary key,
  unit_number text not null,
  property_id uuid not null,
  rent_amount numeric, -- As per image
  rent_due_day integer, -- As per image
  lease_start timestamp with time zone, -- As per image
  lease_end timestamp with time zone, -- As per image
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create tenants table (depends on units)
-- Includes a direct unit_id foreign key
create table if not exists public.tenants (
  id uuid default uuid_generate_v4() primary key,
  first_name text not null,
  last_name text not null,
  email text,
  phone text not null,
  unit_id uuid, -- Foreign key to units table
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create rent_payments table
create table if not exists public.rent_payments (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid not null,
  unit_id uuid not null, -- Kept as per image, might be redundant if tenant is tied to one unit
  amount numeric not null,
  due_date date not null,
  payment_date date,
  is_late boolean default false, -- Consider deriving this or ensuring consistency with status
  status text not null check (status in ('pending', 'paid', 'late', 'partial')),
  payment_method text,
  interac_request_link text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create notifications table
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid not null references public.tenants(id),
  payment_id uuid references public.rent_payments(id),
  type text not null check (type in ('rent_due', 'rent_late', 'receipt', 'form_n4', 'form_l1')),
  channel text not null check (channel in ('whatsapp', 'email')),
  status text not null check (status in ('pending', 'sent', 'delivered', 'read', 'failed')),
  message_id text, -- As per image (mess... truncated)
  sent_at timestamp with time zone, -- As per image
  -- delivered_at, read_at were in image but not original schema, adding them
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create incoming_messages table
create table if not exists public.incoming_messages (
  id uuid default uuid_generate_v4() primary key,
  phone_number text not null,
  message_id text,
  message_text text,
  received_at timestamp with time zone not null,
  processed boolean default false not null,
  payment_id uuid references public.rent_payments(id),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Add foreign key constraints after all tables are created

-- Property to landlord
DO $$
BEGIN
  RAISE NOTICE 'Attempting to add constraint properties_landlord_id_fkey if it does not exist.';
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'properties_landlord_id_fkey'
    AND    conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_landlord_id_fkey
      FOREIGN KEY (landlord_id)
      REFERENCES public.landlords(id);
    RAISE NOTICE 'Constraint properties_landlord_id_fkey added.';
  ELSE
    RAISE NOTICE 'Constraint properties_landlord_id_fkey already exists. Skipping.';
  END IF;
  RAISE NOTICE 'Finished processing constraint properties_landlord_id_fkey.';
END;
$$;

-- Units to properties
DO $$
BEGIN
  RAISE NOTICE 'Attempting to add constraint units_property_id_fkey if it does not exist.';
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'units_property_id_fkey'
    AND    conrelid = 'public.units'::regclass
  ) THEN
    ALTER TABLE public.units
      ADD CONSTRAINT units_property_id_fkey
      FOREIGN KEY (property_id)
      REFERENCES public.properties(id);
    RAISE NOTICE 'Constraint units_property_id_fkey added.';
  ELSE
    RAISE NOTICE 'Constraint units_property_id_fkey already exists. Skipping.';
  END IF;
  RAISE NOTICE 'Finished processing constraint units_property_id_fkey.';
END;
$$;

-- Ensure unit_id column exists in tenants table before adding foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
    AND    table_name = 'tenants'
    AND    column_name = 'unit_id'
  ) THEN
    RAISE NOTICE 'Column unit_id does not exist in public.tenants. Adding it.';
    ALTER TABLE public.tenants ADD COLUMN unit_id uuid;
    RAISE NOTICE 'Column unit_id added to public.tenants.';
  ELSE
    RAISE NOTICE 'Column unit_id already exists in public.tenants. Skipping add column.';
  END IF;
END;
$$;

-- Tenants to Units (New direct relationship)
DO $$
BEGIN
  RAISE NOTICE 'Attempting to add constraint tenants_unit_id_fkey if it does not exist.';
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'tenants_unit_id_fkey'
    AND    conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_unit_id_fkey
      FOREIGN KEY (unit_id)
      REFERENCES public.units(id);
    RAISE NOTICE 'Constraint tenants_unit_id_fkey added.';
  ELSE
    RAISE NOTICE 'Constraint tenants_unit_id_fkey already exists. Skipping.';
  END IF;
  RAISE NOTICE 'Finished processing constraint tenants_unit_id_fkey.';
END;
$$;

-- Rent payments constraints
DO $$
BEGIN
  RAISE NOTICE 'Attempting to add constraint rent_payments_tenant_id_fkey if it does not exist.';
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'rent_payments_tenant_id_fkey'
    AND    conrelid = 'public.rent_payments'::regclass
  ) THEN
    ALTER TABLE public.rent_payments
      ADD CONSTRAINT rent_payments_tenant_id_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.tenants(id);
    RAISE NOTICE 'Constraint rent_payments_tenant_id_fkey added.';
  ELSE
    RAISE NOTICE 'Constraint rent_payments_tenant_id_fkey already exists. Skipping.';
  END IF;
  RAISE NOTICE 'Finished processing constraint rent_payments_tenant_id_fkey.';
END;
$$;

DO $$
BEGIN
  RAISE NOTICE 'Attempting to add constraint rent_payments_unit_id_fkey if it does not exist.';
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'rent_payments_unit_id_fkey'
    AND    conrelid = 'public.rent_payments'::regclass
  ) THEN
    ALTER TABLE public.rent_payments
      ADD CONSTRAINT rent_payments_unit_id_fkey -- This FK still makes sense
      FOREIGN KEY (unit_id)
      REFERENCES public.units(id);
    RAISE NOTICE 'Constraint rent_payments_unit_id_fkey added.';
  ELSE
    RAISE NOTICE 'Constraint rent_payments_unit_id_fkey already exists. Skipping.';
  END IF;
  RAISE NOTICE 'Finished processing constraint rent_payments_unit_id_fkey.';
END;
$$;

-- Create functions for automatic updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Function to directly update tenant fields when normal updates aren't working
CREATE OR REPLACE FUNCTION update_tenant_direct(tenant_id UUID, update_fields TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT, query_executed TEXT) AS $$
DECLARE
  query TEXT;
  rows_affected INTEGER;
BEGIN
  -- Verify the tenant exists first
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id) THEN
    RETURN QUERY SELECT FALSE, 'Tenant not found with ID: ' || tenant_id::TEXT, '';
    RETURN;
  END IF;

  -- Construct and execute dynamic SQL update
  query := 'UPDATE public.tenants SET ' || update_fields || ', updated_at = NOW() WHERE id = ''' || tenant_id || '''';

  -- Log the query for debugging
  RAISE NOTICE 'Executing query: %', query;

  -- Execute the query
  EXECUTE query;

  -- Check if update was successful
  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  -- Return true if at least one row was updated
  IF rows_affected > 0 THEN
    RETURN QUERY SELECT TRUE, 'Successfully updated ' || rows_affected || ' row(s)', query;
  ELSE
    RETURN QUERY SELECT FALSE, 'Update executed but no rows affected', query;
  END IF;

  RETURN;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 'Update failed: ' || SQLERRM, query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to directly execute SQL statements
-- IMPORTANT: This is a security risk if exposed publicly, use only in secured environments
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Log the query for debugging
  RAISE NOTICE 'Executing SQL: %', sql;

  -- Execute the query
  EXECUTE sql;

  -- Return true to indicate success
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SQL execution failed: %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for updating updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_tenants_updated_at'
  ) THEN
    create trigger update_tenants_updated_at
      before update on public.tenants
      for each row execute function public.update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_properties_updated_at'
  ) THEN
    create trigger update_properties_updated_at
      before update on public.properties
      for each row execute function public.update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_units_updated_at'
  ) THEN
    create trigger update_units_updated_at
      before update on public.units
      for each row execute function public.update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_rent_payments_updated_at'
  ) THEN
    create trigger update_rent_payments_updated_at
      before update on public.rent_payments
      for each row execute function public.update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_notifications_updated_at'
  ) THEN
    create trigger update_notifications_updated_at
      before update on public.notifications
      for each row execute function public.update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_incoming_messages_updated_at'
  ) THEN
    create trigger update_incoming_messages_updated_at
      before update on public.incoming_messages
      for each row execute function public.update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_landlords_updated_at'
  ) THEN
    create trigger update_landlords_updated_at
      before update on public.landlords
      for each row execute function public.update_updated_at_column();
  END IF;
END;
$$;

-- Create indexes for performance
-- Removed indexes for tenant_units
create index if not exists units_property_id_idx on public.units(property_id);
create index if not exists tenants_unit_id_idx on public.tenants(unit_id); -- New index
create index if not exists rent_payments_tenant_id_idx on public.rent_payments(tenant_id);
create index if not exists rent_payments_unit_id_idx on public.rent_payments(unit_id);
create index if not exists rent_payments_due_date_idx on public.rent_payments(due_date);
create index if not exists rent_payments_status_idx on public.rent_payments(status);
create index if not exists notifications_tenant_id_idx on public.notifications(tenant_id);
create index if not exists notifications_payment_id_idx on public.notifications(payment_id);
create index if not exists notifications_status_idx on public.notifications(status);
create index if not exists incoming_messages_phone_number_idx on public.incoming_messages(phone_number);
create index if not exists incoming_messages_processed_idx on public.incoming_messages(processed);

-- Create RLS policies
-- Note: These would typically be more restrictive in a production environment

-- Tenants policies
DO $$
BEGIN
  alter table public.tenants enable row level security;
  
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'tenants'
    AND policyname = 'Enable read access for all users'
  ) THEN
    create policy "Enable read access for all users" on public.tenants for select using (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'tenants'
    AND policyname = 'Enable insert for authenticated users'
  ) THEN
    create policy "Enable insert for authenticated users" on public.tenants for insert with check (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'tenants'
    AND policyname = 'Enable update for authenticated users'
  ) THEN
    create policy "Enable update for authenticated users" on public.tenants for update using (auth.role() = 'authenticated');
  END IF;
END;
$$;

-- Properties policies
DO $$
BEGIN
  alter table public.properties enable row level security;
  
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'properties'
    AND policyname = 'Enable read access for all users'
  ) THEN
    create policy "Enable read access for all users" on public.properties for select using (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'properties'
    AND policyname = 'Enable insert for authenticated users'
  ) THEN
    create policy "Enable insert for authenticated users" on public.properties for insert with check (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'properties'
    AND policyname = 'Enable update for authenticated users'
  ) THEN
    create policy "Enable update for authenticated users" on public.properties for update using (auth.role() = 'authenticated');
  END IF;
END;
$$;

-- Units policies
DO $$
BEGIN
  alter table public.units enable row level security;
  
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'units'
    AND policyname = 'Enable read access for all users'
  ) THEN
    create policy "Enable read access for all users" on public.units for select using (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'units'
    AND policyname = 'Enable insert for authenticated users'
  ) THEN
    create policy "Enable insert for authenticated users" on public.units for insert with check (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'units'
    AND policyname = 'Enable update for authenticated users'
  ) THEN
    create policy "Enable update for authenticated users" on public.units for update using (auth.role() = 'authenticated');
  END IF;
END;
$$;

-- Rent payments policies
DO $$
BEGIN
  alter table public.rent_payments enable row level security;
  
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'rent_payments'
    AND policyname = 'Enable read access for all users'
  ) THEN
    create policy "Enable read access for all users" on public.rent_payments for select using (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'rent_payments'
    AND policyname = 'Enable insert for authenticated users'
  ) THEN
    create policy "Enable insert for authenticated users" on public.rent_payments for insert with check (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'rent_payments'
    AND policyname = 'Enable update for authenticated users'
  ) THEN
    create policy "Enable update for authenticated users" on public.rent_payments for update using (auth.role() = 'authenticated');
  END IF;
END;
$$;

-- Notifications policies
DO $$
BEGIN
  alter table public.notifications enable row level security;
  
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'notifications'
    AND policyname = 'Enable read access for all users'
  ) THEN
    create policy "Enable read access for all users" on public.notifications for select using (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'notifications'
    AND policyname = 'Enable insert for authenticated users'
  ) THEN
    create policy "Enable insert for authenticated users" on public.notifications for insert with check (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'notifications'
    AND policyname = 'Enable update for authenticated users'
  ) THEN
    create policy "Enable update for authenticated users" on public.notifications for update using (auth.role() = 'authenticated');
  END IF;
END;
$$;

-- Incoming messages policies
DO $$
BEGIN
  alter table public.incoming_messages enable row level security;
  
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'incoming_messages'
    AND policyname = 'Enable read access for all users'
  ) THEN
    create policy "Enable read access for all users" on public.incoming_messages for select using (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'incoming_messages'
    AND policyname = 'Enable insert for all users'
  ) THEN
    create policy "Enable insert for all users" on public.incoming_messages for insert with check (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'incoming_messages'
    AND policyname = 'Enable update for authenticated users'
  ) THEN
    create policy "Enable update for authenticated users" on public.incoming_messages for update using (auth.role() = 'authenticated');
  END IF;
END;
$$;

-- Landlords policies
DO $$
BEGIN
  alter table public.landlords enable row level security;
  
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'landlords'
    AND policyname = 'Enable read access for all users'
  ) THEN
    create policy "Enable read access for all users" on public.landlords for select using (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'landlords'
    AND policyname = 'Enable insert for authenticated users'
  ) THEN
    create policy "Enable insert for authenticated users" on public.landlords for insert with check (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'landlords'
    AND policyname = 'Enable update for authenticated users'
  ) THEN
    create policy "Enable update for authenticated users" on public.landlords for update using (auth.role() = 'authenticated');
  END IF;
END;
$$;

-- Grant permissions for custom functions
GRANT EXECUTE ON FUNCTION update_tenant_direct(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_tenant_direct(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION update_tenant_direct(UUID, TEXT) TO postgres;
COMMENT ON FUNCTION update_tenant_direct(UUID, TEXT) IS 'Directly updates tenant records when ORM updates fail. Returns success status, message and the query executed.';

GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO service_role;
COMMENT ON FUNCTION execute_sql(TEXT) IS 'Executes raw SQL. WARNING: Only use in secured environments.';

-- Removed the DO block that dropped columns from units, as these columns are now part of the units table definition.

-- Grant all privileges to the service role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant SELECT access to the anon role for all tables in the public schema
-- This is necessary for the frontend to be able to read data via the API
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
