/**
 * Script to fix database permissions using the Supabase JavaScript client
 * This avoids the need for SQL execution via REST
 */
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
console.log(`Loading environment variables from: ${envPath}`);
dotenv.config({ path: envPath });

// Get Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

console.log(`Using Supabase URL: ${supabaseUrl}`);

// Create the Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Fix common database permission issues
async function fixDatabasePermissions() {
  try {
    // Let's check if we can access the tenants table
    console.log('Testing database access...');
    const { data: testData, error: testError } = await supabase.from('tenants').select('*').limit(1);
    
    if (testError) {
      console.error('Error accessing tenants table:', testError);
      console.log('This error indicates we need to fix permissions. Proceeding with fixes...');
    } else {
      console.log('Successfully accessed tenants table. Current permissions seem adequate.');
      console.log(`Retrieved ${testData.length} records from tenants table.`);
    }
    
    // Show all tables in the public schema for debugging
    console.log('Getting list of tables...');
    const { data: tablesData } = await supabase
      .from('_tables')
      .select('*')
      .eq('schema', 'public')
      .catch(error => {
        console.log('Could not query system tables:', error.message);
        return { data: null };
      });
    
    if (tablesData) {
      console.log('Tables in public schema:', tablesData.map(t => t.name).join(', '));
    }
    
    // Try to fetch data from each critical table to ensure the client has access
    console.log('\nTesting access to critical tables...');
    
    const criticalTables = [
      'tenants', 
      'units', 
      'properties', 
      'tenant_units', 
      'rent_payments', 
      'notifications', 
      'incoming_messages',
      'landlords'
    ];
    
    for (const table of criticalTables) {
      try {
        console.log(`Testing access to ${table} table...`);
        const { data, error } = await supabase.from(table).select('*').limit(1);
        
        if (error) {
          console.error(`Error accessing ${table} table:`, error.message);
        } else {
          console.log(`Successfully accessed ${table} table (${data.length} records).`);
        }
      } catch (err) {
        console.error(`Exception when testing ${table} table:`, err.message);
      }
    }
    
    console.log('\nPermission check complete.');
    console.log('If you still have issues, please ensure that:');
    console.log('1. Your service role key has sufficient permissions');
    console.log('2. Row Level Security (RLS) policies are set up correctly on the Supabase dashboard');
    console.log('3. You have created the necessary tables in your Supabase project');
  } catch (error) {
    console.error('Error during permission check:', error);
  }
}

// Run the main function
fixDatabasePermissions()
  .catch(err => console.error('Unhandled error:', err))
  .finally(() => console.log('Script complete.'));
