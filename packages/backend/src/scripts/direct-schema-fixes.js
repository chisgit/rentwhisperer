#!/usr/bin/env node

/**
 * Script to directly apply specific schema changes to RentWhisperer database
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Try loading environment from multiple locations
const envPaths = [
  path.resolve(__dirname, '../../.env'),         // packages/backend/.env
  path.resolve(__dirname, '../../../.env'),      // packages/.env
  path.resolve(__dirname, '../../../../.env')    // root .env
];

// Load .env files in order of precedence
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from: ${envPath}`);
    dotenv.config({ path: envPath });
  }
}

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

async function executeSql(sql, description) {
  console.log(`\nExecuting: ${description}`);
  try {
    const { data, error } = await supabase.rpc('execute_sql', { sql });

    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return false;
    }

    console.log(`✅ Success: ${description}`);
    return true;
  } catch (err) {
    console.error(`❌ Exception: ${err.message}`);
    return false;
  }
}

async function fetchColumns(tableName) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
            ORDER BY column_name`
    });

    if (error) {
      console.error(`Error fetching columns for ${tableName}:`, error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error(`Exception fetching columns for ${tableName}:`, err.message);
    return [];
  }
}

async function applySchemaFixes() {
  try {
    console.log('🔄 Running direct schema update for RentWhisperer\n');

    // Test connection
    console.log('Testing connection to Supabase...');
    const { data, error } = await supabase.from('tenants').select('id').limit(1);

    if (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }

    console.log('✅ Connection successful\n');

    // Check units table columns
    console.log('Checking units table structure...');
    const unitsColumns = await fetchColumns('units');

    // 1. Check if rent_amount needs renaming
    if (unitsColumns.includes('rent_amount')) {
      await executeSql(
        'ALTER TABLE public.units RENAME COLUMN rent_amount TO default_rent_amount;',
        'Rename rent_amount to default_rent_amount in units table'
      );
    } else {
      console.log('✅ rent_amount column already renamed or doesn\'t exist');
    }

    // 2. Check if rent_due_day needs renaming
    if (unitsColumns.includes('rent_due_day')) {
      await executeSql(
        'ALTER TABLE public.units RENAME COLUMN rent_due_day TO default_rent_due_day;',
        'Rename rent_due_day to default_rent_due_day in units table'
      );
    } else {
      console.log('✅ rent_due_day column already renamed or doesn\'t exist');
    }

    // 3. Check if lease_start needs to be removed from units table
    if (unitsColumns.includes('lease_start')) {
      await executeSql(
        'ALTER TABLE public.units DROP COLUMN lease_start;',
        'Remove lease_start from units table (belongs in tenant_units)'
      );
    } else {
      console.log('✅ lease_start column already removed or doesn\'t exist in units table');
    }

    // 4. Check if lease_end needs to be removed from units table
    if (unitsColumns.includes('lease_end')) {
      await executeSql(
        'ALTER TABLE public.units DROP COLUMN lease_end;',
        'Remove lease_end from units table (belongs in tenant_units)'
      );
    } else {
      console.log('✅ lease_end column already removed or doesn\'t exist in units table');
    }

    // Check tenant_units table columns
    console.log('\nChecking tenant_units table structure...');
    const tenantUnitsColumns = await fetchColumns('tenant_units');

    // 5. Ensure rent_amount exists in tenant_units table
    if (!tenantUnitsColumns.includes('rent_amount')) {
      await executeSql(
        'ALTER TABLE public.tenant_units ADD COLUMN rent_amount numeric NOT NULL DEFAULT 0;',
        'Add rent_amount column to tenant_units table'
      );
    } else {
      console.log('✅ rent_amount column exists in tenant_units table');
    }

    // 6. Ensure rent_due_day exists in tenant_units table
    if (!tenantUnitsColumns.includes('rent_due_day')) {
      await executeSql(
        'ALTER TABLE public.tenant_units ADD COLUMN rent_due_day integer NOT NULL DEFAULT 1;',
        'Add rent_due_day column to tenant_units table'
      );
    } else {
      console.log('✅ rent_due_day column exists in tenant_units table');
    }

    // Check tenants table columns
    console.log('\nChecking tenants table structure...');
    const tenantsColumns = await fetchColumns('tenants');

    // 7. Remove unit_number if it exists in tenants table
    if (tenantsColumns.includes('unit_number')) {
      await executeSql(
        'ALTER TABLE public.tenants DROP COLUMN unit_number;',
        'Remove unit_number from tenants table (should be in units table)'
      );
    } else {
      console.log('✅ unit_number column already removed from tenants table');
    }

    // 8. Remove rent_amount if it exists in tenants table
    if (tenantsColumns.includes('rent_amount')) {
      await executeSql(
        'ALTER TABLE public.tenants DROP COLUMN rent_amount;',
        'Remove rent_amount from tenants table (should be in tenant_units table)'
      );
    } else {
      console.log('✅ rent_amount column already removed from tenants table');
    }

    // 9. Remove rent_due_day if it exists in tenants table
    if (tenantsColumns.includes('rent_due_day')) {
      await executeSql(
        'ALTER TABLE public.tenants DROP COLUMN rent_due_day;',
        'Remove rent_due_day from tenants table (should be in tenant_units table)'
      );
    } else {
      console.log('✅ rent_due_day column already removed from tenants table');
    }

    // 10. Remove full_address if it exists in tenants table
    if (tenantsColumns.includes('full_address')) {
      await executeSql(
        'ALTER TABLE public.tenants DROP COLUMN full_address;',
        'Remove full_address from tenants table (should be derived from properties table)'
      );
    } else {
      console.log('✅ full_address column already removed from tenants table');
    }

    // Done!
    console.log('\n✅ Schema update completed successfully!');
    console.log('\nCurrent table structures:');

    // Display final table structures
    const finalUnitsColumns = await fetchColumns('units');
    console.log('\nUnits table columns:', finalUnitsColumns);

    const finalTenantUnitsColumns = await fetchColumns('tenant_units');
    console.log('\nTenant_units table columns:', finalTenantUnitsColumns);

    const finalTenantsColumns = await fetchColumns('tenants');
    console.log('\nTenants table columns:', finalTenantsColumns);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

applySchemaFixes();
