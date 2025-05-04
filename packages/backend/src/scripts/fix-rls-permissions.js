#!/usr/bin/env node

/**
 * Script to fix RLS permissions in the Supabase database
 * This will disable RLS for all tables and grant proper permissions
 */
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Create the fix-rls-permissions.sql file with the necessary commands
const fixRlsSql = `
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
  dbUrl = `postgresql://postgres:${supabaseServiceKey}@db.${hostname}:5432/postgres`;
  console.log(`Database URL constructed from Supabase credentials`);
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
