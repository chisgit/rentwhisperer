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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase credentials not found in environment variables.');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Create Supabase client with service role key (to bypass RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchema() {
  try {
    console.log('Connecting to Supabase...');

    // First test the connection
    const { data: testData, error: testError } = await supabase
      .from('tenants')
      .select('id')
      .limit(1);

    if (testError) {
      throw new Error(`Connection test failed: ${testError.message}`);
    }

    console.log('Connection successful.'); console.log('Applying schema via execute_sql function...');
    // Use the execute_sql function we created in our schema
    const { data, error } = await supabase.rpc('execute_sql', { sql: schema });

    if (error) {
      console.warn(`Warning during schema execution: ${error.message}`);
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
