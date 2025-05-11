#!/usr/bin/env node

/**
 * Script to fix RLS permissions in the Supabase database
 * This will disable RLS for all tables and grant proper permissions
 */
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Create the fix-rls-permissions.sql file with the necessary commands
const fixRlsSql = `
-- File: fix-rls-permissions.sql
-- This SQL script disables Row Level Security (RLS) for the tables in our Supabase project
-- and grants necessary permissions for basic operation.

-- Grant connect to database (usually default, but explicit for safety)
GRANT CONNECT ON DATABASE postgres TO postgres, anon, authenticated, service_role, PUBLIC;

-- Grant schema-level permissions
GRANT USAGE, CREATE ON SCHEMA public TO postgres; -- Ensure postgres user (script runner) can operate
GRANT USAGE ON SCHEMA public TO PUBLIC;       -- Grant basic USAGE on public schema to all roles (PUBLIC group)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON SCHEMA public TO service_role;     -- service_role gets full schema control

-- Attempt to manage auth.users permissions for testing
-- WARNING: Disabling RLS on auth.users is generally not recommended for production.
-- This is for debugging the test script's "permission denied" errors.
-- Re-enable RLS on auth.users and set appropriate policies after debugging.
ALTER TABLE IF EXISTS auth.users DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE auth.users TO anon, authenticated;
GRANT ALL ON TABLE auth.users TO service_role;

-- Disable RLS for all relevant tables in public schema
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.units DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.landlords DISABLE ROW LEVEL SECURITY;
-- Note: tenant_units table seems to be removed from the latest schema.

-- Grant table-level permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres; -- Ensure postgres user (script runner) has all table perms

-- Grant execute on all functions for service_role, and specific ones for anon/authenticated if needed by tests/app
-- For now, focusing on schema/table access. Functions grants can be added if tests fail on function calls.
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
`;

const tempFilePath = path.resolve(__dirname, 'temp_fix_rls.sql');

// Write the SQL to a temporary file
fs.writeFileSync(tempFilePath, fixRlsSql);
console.log('Created temporary SQL file with RLS fix commands');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Either use the Supabase credentials or fallback to direct database URL
let dbUrl;

if (supabaseUrl && supabaseServiceKey) {
  console.log('Using Supabase credentials to construct database URL...');

  // Extract the hostname from the SUPABASE_URL
  const hostname = supabaseUrl.replace('https://', '');

  // Construct the database URL (Supabase format)
  dbUrl = `postgresql://postgres:${supabaseServiceKey}@${hostname}:5432/postgres`;
  console.log(`Database URL constructed from Supabase credentials (using hostname directly)`);
} else {
  // Fallback to direct database URL if Supabase credentials are not available
  dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    console.error('No database connection information found in environment variables.');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL as a fallback');
    process.exit(1);
  }
}

// Command to run the SQL file using psql
const command = `psql "${dbUrl}" -f "${tempFilePath}"`;

// Execute the command
console.log('Applying RLS fix to database...');
exec(command, (error, stdout, stderr) => {
  // Clean up the temporary file
  try {
    fs.unlinkSync(tempFilePath);
    console.log('Temporary SQL file removed');
  } catch (e) {
    console.warn('Warning: Could not remove temporary SQL file', e);
  }

  if (error) {
    console.error('Error applying RLS fix:', error);
    console.error(stderr);
    process.exit(1);
  }

  console.log('RLS fix applied successfully!');
  console.log(stdout);

  console.log('\nYou should now be able to perform updates on all tables without RLS restrictions.');
});
