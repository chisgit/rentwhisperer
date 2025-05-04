// Script to apply specific schema changes using execute_sql RPC
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase credentials not found in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyChanges() {
  try {
    console.log('Applying specific schema changes...');

    // Drop columns from units table
    console.log('Attempting to drop default_rent_amount from units table...');
    let { data, error } = await supabase.rpc('execute_sql', {
      sql: `ALTER TABLE public.units DROP COLUMN IF EXISTS default_rent_amount;`
    });
    if (error) console.error('Error dropping default_rent_amount:', error.message);
    else console.log('Result:', data);

    console.log('Attempting to drop default_rent_due_day from units table...');
    ({ data, error } = await supabase.rpc('execute_sql', {
      sql: `ALTER TABLE public.units DROP COLUMN IF EXISTS default_rent_due_day;`
    }));
    if (error) console.error('Error dropping default_rent_due_day:', error.message);
    else console.log('Result:', data);

    // Add columns to tenant_units table (assuming table exists)
    console.log('Attempting to add rent_amount to tenant_units table...');
    ({ data, error } = await supabase.rpc('execute_sql', {
      sql: `ALTER TABLE public.tenant_units ADD COLUMN IF NOT EXISTS rent_amount numeric not null;`
    }));
    if (error) console.error('Error adding rent_amount:', error.message);
    else console.log('Result:', data);

    console.log('Attempting to add rent_due_day to tenant_units table...');
    ({ data, error } = await supabase.rpc('execute_sql', {
      sql: `ALTER TABLE public.tenant_units ADD COLUMN IF NOT EXISTS rent_due_day integer not null;`
    }));
    if (error) console.error('Error adding rent_due_day:', error.message);
    else console.log('Result:', data);

    console.log('Specific schema changes applied.');

  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

applyChanges();
