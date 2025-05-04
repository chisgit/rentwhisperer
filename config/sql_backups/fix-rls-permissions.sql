-- File: fix-rls-permissions.sql
-- This SQL script disables Row Level Security (RLS) for the tables in our Supabase project
-- to allow us to insert, update and delete data without restrictions

-- Disable RLS for the tenants table
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- Disable RLS for the tenant_units table
ALTER TABLE tenant_units DISABLE ROW LEVEL SECURITY;

-- Disable RLS for the units table
ALTER TABLE units DISABLE ROW LEVEL SECURITY;

-- Disable RLS for the properties table
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;

-- Disable RLS for the landlords table
ALTER TABLE landlords DISABLE ROW LEVEL SECURITY;

-- Disable RLS for the rent_payments table if it exists
ALTER TABLE IF EXISTS rent_payments DISABLE ROW LEVEL SECURITY;

-- Grant all privileges to the service role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
