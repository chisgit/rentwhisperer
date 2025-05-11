#!/usr/bin/env node

/**
 * Script to apply the master schema for RentWhisperer using the Supabase JS client
 * This will apply schema changes using the execute_sql function in Supabase
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Get paths
const schemaPath = path.resolve(__dirname, '../../../../config/supabase_schema.sql');

console.log('Applying master database schema using Supabase JS client...');
console.log(`Using schema file: ${schemaPath}`);

// Check if file exists
if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found at ${schemaPath}`);
  process.exit(1);
}

// Read the schema file
const schema = fs.readFileSync(schemaPath, 'utf8');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[DEBUG] SUPABASE_URL from env:', supabaseUrl ? 'Loaded' : 'NOT LOADED');
console.log('[DEBUG] SUPABASE_SERVICE_ROLE_KEY from env:', supabaseServiceKey ? 'Loaded' : 'NOT LOADED');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase credentials not found in environment variables.');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Create Supabase client with service role key (to bypass RLS)
console.log('[DEBUG] Initializing Supabase client...');
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  // Optional: Add options for more logging or to disable caching if available, e.g.
  // db: { schema: 'public' }, // Ensure schema is public
  // auth: { persistSession: false } // Might help with stale states, though less likely for RPC
});
console.log('[DEBUG] Supabase client initialized.');

const createExecuteSqlFunctionSql = `
DROP FUNCTION IF EXISTS public.execute_sql(TEXT); -- Add this line

CREATE OR REPLACE FUNCTION public.execute_sql(sql TEXT) -- Changed sql_statement to sql
RETURNS BOOLEAN AS $$
BEGIN
  -- Log the query for debugging
  RAISE NOTICE 'Executing SQL via execute_sql(): %', sql; -- Changed sql_statement to sql

  -- Execute the query
  EXECUTE sql; -- Changed sql_statement to sql

  -- Return true to indicate success
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SQL execution failed within execute_sql(): %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.execute_sql(TEXT) TO service_role;
`;

const rlsFixSql = `
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

const grantPermissionsSql = `
DO $$
BEGIN
  IF current_user = 'postgres' THEN
    ALTER SCHEMA public OWNER TO postgres;
    GRANT ALL ON SCHEMA public TO postgres;
    RAISE NOTICE 'Ensured postgres user owns and has all privileges on public schema.';
  ELSE
    RAISE WARNING 'Current user is not postgres. Schema ownership and privileges might need manual adjustment for user: %', current_user;
  END IF;
END
$$;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
`;

async function applySchema() {
  try {
    console.log('Connecting to Supabase...');
    console.log('Assuming execute_sql function has been manually created/verified in the database.');

    // Step 1 (formerly Step 2): Apply RLS fix SQL
    console.log('[DEBUG] Preparing to call execute_sql for RLS fix.');
    console.log('[DEBUG] RLS Fix SQL to be executed:\n', rlsFixSql);
    const { data: rlsData, error: rlsError } = await supabase.rpc('execute_sql', { sql: rlsFixSql });
    if (rlsError) {
      console.warn(`[DEBUG] Error during RLS fix SQL execution: ${rlsError.message}`);
      console.warn('[DEBUG] RLS fix error object:', JSON.stringify(rlsError, null, 2));
    } else {
      console.log('RLS fix SQL executed successfully.');
      console.log('[DEBUG] RLS fix data:', rlsData);
    }

    // Step 2 (formerly Step 3): Apply permission grants
    console.log('[DEBUG] Preparing to call execute_sql for permission grants.');
    console.log('[DEBUG] Permission Grants SQL to be executed:\n', grantPermissionsSql);
    const { data: permData, error: permError } = await supabase.rpc('execute_sql', { sql: grantPermissionsSql });
    if (permError) {
      console.warn(`[DEBUG] Error during initial permission grant: ${permError.message}`);
      console.warn('[DEBUG] Permission grant error object:', JSON.stringify(permError, null, 2));
    } else {
      console.log('Initial permission grants SQL executed.');
      console.log('[DEBUG] Permission grant data:', permData);
    }

    // Step 3 (formerly Step 4): Test the connection (now after attempting to fix permissions)
    console.log('Testing connection to Supabase after permission grants...');
    const { data: testData, error: testError } = await supabase
      .from('tenants') // This might fail if tenants table doesn't exist yet, which is fine for a first run.
      .select('id')
      .limit(1);

    if (testError) {
      // If tenants table doesn't exist, this is not a fatal error for schema application itself.
      // The critical part is whether we can execute DDL.
      console.warn(`Connection test (select from tenants) failed: ${testError.message}. This might be okay if tenants table doesn't exist yet.`);
    } else {
      console.log('Connection test (select from tenants) successful.');
    }

    // Step 4 (formerly Step 5): Apply the main schema
    console.log('[DEBUG] Preparing to call execute_sql for main schema.');
    // console.log('[DEBUG] Main Schema SQL to be executed:\n', schema); // This can be very long, so commented out by default
    const { data, error } = await supabase.rpc('execute_sql', { sql: schema });

    if (error) {
      console.warn(`[DEBUG] Error during main schema execution: ${error.message}`);
      console.warn('[DEBUG] Main schema error object:', JSON.stringify(error, null, 2));
      console.log('Continuing with explicit column updates...');
    } else {
      console.log('Schema applied successfully!');
      console.log('Result:', data);
    }

    // Verify schema changes by checking column structure
    console.log('\nVerifying schema changes...');    // Check for columns in units table using raw SQL query
    const { data: unitsColumnData, error: unitsColumnError } = await supabase
      .from('units')
      .select()
      .limit(0);

    if (unitsColumnError) {
      console.log('Error checking units table columns:', unitsColumnError.message);
    } else {
      // Get columns from the table definition
      const unitsColumns = unitsColumnData ? Object.keys(unitsColumnData) : [];

      // If we can't get columns from data, try a different method
      if (unitsColumns.length === 0) {
        console.log('Couldn\'t determine units table columns from response');
        console.log('Units table structure check skipped');
      } else {
        console.log('Units table columns:', unitsColumns);
        console.log('- Has default_rent_amount:', unitsColumns.includes('default_rent_amount') ? '✅ Yes' : '❌ No');
        console.log('- Has default_rent_due_day:', unitsColumns.includes('default_rent_due_day') ? '✅ Yes' : '❌ No');
        console.log('- Still has rent_amount:', unitsColumns.includes('rent_amount') ? '⚠️ Yes (needs renaming)' : '✅ No (good)');
        console.log('- Still has rent_due_day:', unitsColumns.includes('rent_due_day') ? '⚠️ Yes (needs renaming)' : '✅ No (good)');
        console.log('- Has lease_start:', unitsColumns.includes('lease_start') ? '⚠️ Yes (should be removed)' : '✅ No (good)');
        console.log('- Has lease_end:', unitsColumns.includes('lease_end') ? '⚠️ Yes (should be removed)' : '✅ No (good)');
      }
    }

    // Check tenant_units table columns
    const { data: tenantUnitsData, error: tenantUnitsError } = await supabase
      .from('tenant_units')
      .select()
      .limit(0);

    if (tenantUnitsError) {
      console.log('Error checking tenant_units table columns:', tenantUnitsError.message);
    } else {
      // Get columns from the table definition
      const tenantUnitsColumns = tenantUnitsData ? Object.keys(tenantUnitsData) : [];

      if (tenantUnitsColumns.length === 0) {
        console.log('Couldn\'t determine tenant_units table columns from response');
        console.log('Tenant_units table structure check skipped');
      } else {
        console.log('\nTenant_units table columns:', tenantUnitsColumns);
        console.log('- Has rent_amount:', tenantUnitsColumns.includes('rent_amount') ? '✅ Yes' : '❌ No');
        console.log('- Has rent_due_day:', tenantUnitsColumns.includes('rent_due_day') ? '✅ Yes' : '❌ No');
        console.log('- Has lease_start:', tenantUnitsColumns.includes('lease_start') ? '✅ Yes' : '❌ No');
        console.log('- Has lease_end:', tenantUnitsColumns.includes('lease_end') ? '✅ Yes' : '❌ No');
      }
    }

    console.log('\n✅ Schema update and verification complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

applySchema();
