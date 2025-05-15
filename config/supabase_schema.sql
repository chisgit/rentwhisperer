-- Schema for Rent Whisperer Supabase Database
-- Updated to match the provided schema diagram (direct tenant-to-unit relationship)

-- DATA ARCHITECTURE OVERVIEW (Updated):
-- 1. tenants table: Stores tenant personal information.
-- 2. units table: Stores general unit information.
-- 3. tenant_units table: Junction table linking tenants to units, storing lease-specific details like rent_amount, rent_due_day, lease_start, lease_end.
-- 4. properties table: Stores property information.
-- 5. rent_payments table: Stores payment records, linked to tenants and units (via tenant_units or directly if appropriate).
-- 6. All property information should be derived through relationships.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Enable Row Level Security
-- alter table if exists auth.users enable row level security; -- This can be problematic, Supabase manages RLS for auth.users

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
-- rent_amount, rent_due_day, lease_start, lease_end are moved to tenant_units
create table if not exists public.units (
  id uuid default uuid_generate_v4() primary key,
  unit_number text not null,
  property_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create tenants table
-- unit_id is removed, relationship managed by tenant_units
create table if not exists public.tenants (
  id uuid default uuid_generate_v4() primary key,
  first_name text not null,
  last_name text not null,
  email text,
  phone text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create tenant_units junction table (links tenants to units and stores lease details)
create table if not exists public.tenant_units (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid not null,
  unit_id uuid not null,
  rent_amount numeric not null,
  rent_due_day integer not null check (rent_due_day >= 1 and rent_due_day <= 31),
  lease_start_date date,
  lease_end_date date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint uq_tenant_unit unique (tenant_id, unit_id) -- A tenant can only be assigned to a specific unit once
);

-- Create rent_payments table
create table if not exists public.rent_payments (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid not null,
  unit_id uuid not null, -- Retained for direct reference, but could also link via tenant_units_id
  tenant_unit_id uuid, -- Optional: Foreign key to tenant_units for more precise linking
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

-- Foreign keys for tenant_units
DO $$
BEGIN
  RAISE NOTICE 'Attempting to add constraint tenant_units_tenant_id_fkey if it does not exist.';
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'tenant_units_tenant_id_fkey'
    AND    conrelid = 'public.tenant_units'::regclass
  ) THEN
    ALTER TABLE public.tenant_units
      ADD CONSTRAINT tenant_units_tenant_id_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.tenants(id);
    RAISE NOTICE 'Constraint tenant_units_tenant_id_fkey added.';
  ELSE
    RAISE NOTICE 'Constraint tenant_units_tenant_id_fkey already exists. Skipping.';
  END IF;
  RAISE NOTICE 'Finished processing constraint tenant_units_tenant_id_fkey.';
END;
$$;

DO $$
BEGIN
  RAISE NOTICE 'Attempting to add constraint tenant_units_unit_id_fkey if it does not exist.';
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'tenant_units_unit_id_fkey'
    AND    conrelid = 'public.tenant_units'::regclass
  ) THEN
    ALTER TABLE public.tenant_units
      ADD CONSTRAINT tenant_units_unit_id_fkey
      FOREIGN KEY (unit_id)
      REFERENCES public.units(id);
    RAISE NOTICE 'Constraint tenant_units_unit_id_fkey added.';
  ELSE
    RAISE NOTICE 'Constraint tenant_units_unit_id_fkey already exists. Skipping.';
  END IF;
  RAISE NOTICE 'Finished processing constraint tenant_units_unit_id_fkey.';
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

-- Optional: Add foreign key from rent_payments to tenant_units
DO $$
BEGIN
  RAISE NOTICE 'Attempting to add constraint rent_payments_tenant_unit_id_fkey if it does not exist.';
  -- Ensure referencing column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rent_payments' AND column_name = 'tenant_unit_id'
  ) THEN
    RAISE NOTICE 'Column tenant_unit_id does not exist in public.rent_payments. Skipping FK constraint.';
    RETURN;
  END IF;

  -- Ensure referenced table and column exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_units'
  ) THEN
    RAISE NOTICE 'Table public.tenant_units does not exist. Skipping FK constraint.';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_units' AND column_name = 'id'
  ) THEN
    RAISE NOTICE 'Column id does not exist in public.tenant_units. Skipping FK constraint.';
    RETURN;
  END IF;

  -- Add constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'rent_payments_tenant_unit_id_fkey'
    AND    conrelid = 'public.rent_payments'::regclass
  ) THEN
    ALTER TABLE public.rent_payments
      ADD CONSTRAINT rent_payments_tenant_unit_id_fkey
      FOREIGN KEY (tenant_unit_id)
      REFERENCES public.tenant_units(id)
      ON DELETE SET NULL; -- Or ON DELETE CASCADE
    RAISE NOTICE 'Constraint rent_payments_tenant_unit_id_fkey added.';
  ELSE
    RAISE NOTICE 'Constraint rent_payments_tenant_unit_id_fkey already exists. Skipping.';
  END IF;
  RAISE NOTICE 'Finished processing constraint rent_payments_tenant_unit_id_fkey.';
END;
$$;

-- Grant all privileges to the service role (early for index/trigger creation)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Create functions for automatic updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as
$$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Function to directly update tenant fields when normal updates aren't working
CREATE OR REPLACE FUNCTION update_tenant_direct(tenant_id UUID, update_fields TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT, query_executed TEXT) AS
$$
DECLARE
  update_query TEXT;
BEGIN
  -- Construct the dynamic update query
  update_query := 'UPDATE public.tenants SET ' || update_fields || ' WHERE id = ''' || tenant_id || '''';

  -- Log the query for debugging
  RAISE NOTICE 'Executing update_tenant_direct query: %', update_query;

  -- Execute the dynamic update query
  EXECUTE update_query;

  -- Check if any rows were affected
  IF FOUND THEN
    RETURN QUERY SELECT TRUE, 'Tenant updated successfully', update_query;
  ELSE
    RETURN QUERY SELECT FALSE, 'Tenant with ID ' || tenant_id || ' not found', update_query;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 'Error updating tenant: ' || SQLERRM, update_query;
END;
$$ LANGUAGE plpgsql;

-- Function to directly execute SQL statements
-- IMPORTANT: This is a security risk if exposed publicly, use only in secured environments
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS BOOLEAN AS
$$
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
$$ LANGUAGE plpgsql;

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
create index if not exists units_property_id_idx on public.units(property_id);
create index if not exists tenant_units_tenant_id_idx on public.tenant_units(tenant_id);
create index if not exists tenant_units_unit_id_idx on public.tenant_units(unit_id);
create index if not exists rent_payments_tenant_id_idx on public.rent_payments(tenant_id);
create index if not exists rent_payments_unit_id_idx on public.rent_payments(unit_id);
create index if not exists rent_payments_tenant_unit_id_idx on public.rent_payments(tenant_unit_id); -- Index for new FK
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

-- Grant SELECT access to the anon role for all tables in the public schema
-- This is necessary for the frontend to be able to read data via the API
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Note: GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role; was moved earlier

-- RLS for tenant_units
DO $$
BEGIN
  alter table public.tenant_units enable row level security;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'tenant_units'
    AND policyname = 'Enable read access for all users'
  ) THEN
    create policy "Enable read access for all users" on public.tenant_units for select using (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'tenant_units'
    AND policyname = 'Enable insert for authenticated users'
  ) THEN
    create policy "Enable insert for authenticated users" on public.tenant_units for insert with check (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'tenant_units'
    AND policyname = 'Enable update for authenticated users'
  ) THEN
    create policy "Enable update for authenticated users" on public.tenant_units for update using (auth.role() = 'authenticated');
  END IF;
END;
$$;

-- Trigger for tenant_units updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_tenant_units_updated_at'
  ) THEN
    create trigger update_tenant_units_updated_at
      before update on public.tenant_units
      for each row execute function public.update_updated_at_column();
  END IF;
END;
$$;
