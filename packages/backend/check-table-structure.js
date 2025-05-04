const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing environment variables. Make sure SUPABASE_URL and SUPABASE_SERVICE_KEY are set.');
  console.log('Available environment variables:', Object.keys(process.env).filter(key => key.includes('SUPA')));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTables() {
  console.log('Checking units table structure...');
  try {
    const { data: unitsColumns, error: unitsError } = await supabase.rpc('execute_sql', {
      sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'units' AND table_schema = 'public' ORDER BY ordinal_position;"
    });

    if (unitsError) {
      console.error('Error fetching units columns:', unitsError.message);
    } else {
      console.log('Units table columns:', JSON.stringify(unitsColumns, null, 2));
    }
  } catch (err) {
    console.error('Exception checking units:', err);
  }

  console.log('\nChecking tenant_units table structure...');
  try {
    const { data: tenantUnitsColumns, error: tenantUnitsError } = await supabase.rpc('execute_sql', {
      sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tenant_units' AND table_schema = 'public' ORDER BY ordinal_position;"
    });

    if (tenantUnitsError) {
      console.error('Error fetching tenant_units columns:', tenantUnitsError.message);
    } else {
      console.log('Tenant_units table columns:', JSON.stringify(tenantUnitsColumns, null, 2));
    }
  } catch (err) {
    console.error('Exception checking tenant_units:', err);
  }
}

checkTables().catch(console.error);
