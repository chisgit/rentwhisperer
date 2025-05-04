// Script to check the current database schema structure
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableStructure() {
  console.log('Checking database table structure...');

  try {    // Check units table structure
    console.log('\n=== UNITS TABLE STRUCTURE ===');
    const { data: unitsResponse, error: unitsError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'units'
        ORDER BY ordinal_position;
      `
    });

    if (unitsError) {
      console.error('Error checking units table:', unitsError.message);
    } else {
      // Check if we have a valid result array
      const unitsData = Array.isArray(unitsResponse) && unitsResponse.length > 0 ?
        unitsResponse :
        (unitsResponse && typeof unitsResponse === 'object' && unitsResponse.result ?
          unitsResponse.result : []);

      console.log('Units table columns:');
      if (Array.isArray(unitsData)) {
        unitsData.forEach(col => {
          console.log(`- ${col.column_name}: ${col.data_type}`);
        });
      } else {
        console.log('Could not parse units table structure from response');
      }
    }

    // Check tenant_units table structure
    console.log('\n=== TENANT_UNITS TABLE STRUCTURE ===');
    const { data: tenantUnitsResponse, error: tenantUnitsError } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tenant_units'
        ORDER BY ordinal_position;
      `
    });

    if (tenantUnitsError) {
      console.error('Error checking tenant_units table:', tenantUnitsError.message);
    } else {
      // Check if we have a valid result array
      const tenantUnitsData = Array.isArray(tenantUnitsResponse) && tenantUnitsResponse.length > 0 ?
        tenantUnitsResponse :
        (tenantUnitsResponse && typeof tenantUnitsResponse === 'object' && tenantUnitsResponse.result ?
          tenantUnitsResponse.result : []);

      console.log('Tenant_units table columns:');
      if (Array.isArray(tenantUnitsData)) {
        tenantUnitsData.forEach(col => {
          console.log(`- ${col.column_name}: ${col.data_type}`);
        });
        // Check for rent fields in tenant_units
        const hasRentAmount = tenantUnitsData.some(col => col && col.column_name === 'rent_amount');
        const hasRentDueDay = tenantUnitsData.some(col => col && col.column_name === 'rent_due_day');

        console.log('\nRent fields in tenant_units table:');
        console.log('rent_amount:', hasRentAmount ? 'PRESENT' : 'NOT PRESENT');
        console.log('rent_due_day:', hasRentDueDay ? 'PRESENT' : 'NOT PRESENT');
      } else {
        console.log('Could not parse tenant_units table structure from response');
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkTableStructure();
