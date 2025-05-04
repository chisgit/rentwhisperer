-- Schema for Rent Whisperer Supabase Database
-- Updated and consolidated master schema file

-- DATA ARCHITECTURE OVERVIEW:
-- 1. tenants table: Stores tenant personal information only (name, contact info)
-- 2. units table: Stores unit information and default rent settings (default_rent_amount, default_rent_due_day)
--    but NOT lease dates (those belong only in tenant_units)
-- 3. properties table: Stores property information (address, city, province, etc.)
-- 4. tenant_units table: Junction table that links tenants to units with:
--    - Tenant-specific rent_amount and rent_due_day (can override unit defaults)
--    - Lease periods (lease_start, lease_end) that apply to specific tenant-unit relationships
--    - Primary unit flag (is_primary) to indicate a tenant's main residence
-- 5. All property and unit information should be derived through relationships, not duplicated
--    in the tenants table

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
create table if not exists public.units (
  id uuid default uuid_generate_v4() primary key,
  unit_number text not null,
  property_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create tenants table (independent entity)
create table if not exists public.tenants (
  id uuid default uuid_generate_v4() primary key,
  first_name text not null,
  last_name text not null,
  email text,
  phone text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);


-- Create tenant_unit junction table for M:N relationship
-- This table stores the relationship between tenants and units, including:
-- - Tenant-specific rent amounts and due dates (which can differ from the unit's default)
-- - Lease start and end dates
-- - Which unit is the tenant's primary residence
create table if not exists public.tenant_units (
  tenant_id uuid not null references public.tenants(id),
  unit_id uuid not null references public.units(id),
  is_primary boolean not null default true,
  lease_start timestamp with time zone not null,
  lease_end timestamp with time zone,
  rent_amount numeric not null, -- Tenant-specific rent amount
  rent_due_day integer not null, -- Tenant-specific rent due day
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  primary key (tenant_id, unit_id)
);



-- Create rent_payments table
create table if not exists public.rent_payments (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid not null,
  unit_id uuid not null,
  amount numeric not null,
  due_date date not null,
  payment_date date,
  is_late boolean default false,
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
  message_id text,
  sent_at timestamp with time zone,
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
alter table public.properties
  add constraint properties_landlord_id_fkey
  foreign key (landlord_id)
  references public.landlords(id);

-- Units to properties
alter table public.units
  add constraint units_property_id_fkey
  foreign key (property_id)
  references public.properties(id);

-- Tenant_units junction table constraints
alter table public.tenant_units
  add constraint tenant_units_tenant_id_fkey
  foreign key (tenant_id)
  references public.tenants(id) ON DELETE CASCADE;

alter table public.tenant_units
  add constraint tenant_units_unit_id_fkey
  foreign key (unit_id)
  references public.units(id);

-- Rent payments constraints
alter table public.rent_payments
  add constraint rent_payments_tenant_id_fkey
  foreign key (tenant_id)
  references public.tenants(id);

alter table public.rent_payments
  add constraint rent_payments_unit_id_fkey
  foreign key (unit_id)
  references public.units(id);

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
create trigger update_tenants_updated_at
  before update on public.tenants
  for each row execute function public.update_updated_at_column();

create trigger update_properties_updated_at
  before update on public.properties
  for each row execute function public.update_updated_at_column();

create trigger update_units_updated_at
  before update on public.units
  for each row execute function public.update_updated_at_column();

create trigger update_tenant_units_updated_at
  before update on public.tenant_units
  for each row execute function public.update_updated_at_column();

create trigger update_rent_payments_updated_at
  before update on public.rent_payments
  for each row execute function public.update_updated_at_column();

create trigger update_notifications_updated_at
  before update on public.notifications
  for each row execute function public.update_updated_at_column();

create trigger update_incoming_messages_updated_at
  before update on public.incoming_messages
  for each row execute function public.update_updated_at_column();

create trigger update_landlords_updated_at
  before update on public.landlords
  for each row execute function public.update_updated_at_column();

-- Create indexes for performance
create index if not exists tenant_units_tenant_id_idx on public.tenant_units(tenant_id);
create index if not exists tenant_units_unit_id_idx on public.tenant_units(unit_id);
create index if not exists units_property_id_idx on public.units(property_id);
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
alter table public.tenants enable row level security;
create policy "Enable read access for all users" on public.tenants for select using (true);
create policy "Enable insert for authenticated users" on public.tenants for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.tenants for update using (auth.role() = 'authenticated');

-- Properties policies
alter table public.properties enable row level security;
create policy "Enable read access for all users" on public.properties for select using (true);
create policy "Enable insert for authenticated users" on public.properties for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.properties for update using (auth.role() = 'authenticated');

-- Units policies
alter table public.units enable row level security;
create policy "Enable read access for all users" on public.units for select using (true);
create policy "Enable insert for authenticated users" on public.units for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.units for update using (auth.role() = 'authenticated');

-- Rent payments policies
alter table public.rent_payments enable row level security;
create policy "Enable read access for all users" on public.rent_payments for select using (true);
create policy "Enable insert for authenticated users" on public.rent_payments for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.rent_payments for update using (auth.role() = 'authenticated');

-- Notifications policies
alter table public.notifications enable row level security;
create policy "Enable read access for all users" on public.notifications for select using (true);
create policy "Enable insert for authenticated users" on public.notifications for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.notifications for update using (auth.role() = 'authenticated');

-- Incoming messages policies
alter table public.incoming_messages enable row level security;
create policy "Enable read access for all users" on public.incoming_messages for select using (true);
create policy "Enable insert for all users" on public.incoming_messages for insert with check (true);
create policy "Enable update for authenticated users" on public.incoming_messages for update using (auth.role() = 'authenticated');

-- Tenant Units policies
alter table public.tenant_units enable row level security;
create policy "Enable read access for all users" on public.tenant_units for select using (true);
create policy "Enable insert for authenticated users" on public.tenant_units for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.tenant_units for update using (auth.role() = 'authenticated');

-- Landlords policies
alter table public.landlords enable row level security;
create policy "Enable read access for all users" on public.landlords for select using (true);
create policy "Enable insert for authenticated users" on public.landlords for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on public.landlords for update using (auth.role() = 'authenticated');

-- Grant permissions for custom functions
GRANT EXECUTE ON FUNCTION update_tenant_direct(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_tenant_direct(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION update_tenant_direct(UUID, TEXT) TO postgres;
COMMENT ON FUNCTION update_tenant_direct(UUID, TEXT) IS 'Directly updates tenant records when ORM updates fail. Returns success status, message and the query executed.';

GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO service_role;
COMMENT ON FUNCTION execute_sql(TEXT) IS 'Executes raw SQL. WARNING: Only use in secured environments.';

-- Drop default_rent_amount and default_rent_due_day columns from the units table
-- We're storing this information exclusively in the tenant_units table to avoid redundancy
DO $$
BEGIN
    -- Check if the columns exist before dropping them
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'units'
        AND column_name = 'default_rent_amount'
    ) THEN
        ALTER TABLE public.units DROP COLUMN IF EXISTS default_rent_amount;
        RAISE NOTICE 'Dropped default_rent_amount column from units table';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'units'
        AND column_name = 'default_rent_due_day'
    ) THEN
        ALTER TABLE public.units DROP COLUMN IF EXISTS default_rent_due_day;
        RAISE NOTICE 'Dropped default_rent_due_day column from units table';
    END IF;
END $$;

-- Grant all privileges to the service role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
