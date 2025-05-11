/**
 * Script to fix Supabase database permissions directly using the JavaScript client
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
console.log(`Loading environment variables from: ${envPath}`);
dotenv.config({ path: envPath });

// Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check your .env file.');
  process.exit(1);
}

console.log(`Using Supabase URL: ${supabaseUrl}`);
console.log(`Service key found: ${supabaseServiceKey ? 'Yes' : 'No'}`);
console.log(`Anon key found: ${supabaseAnonKey ? 'Yes' : 'No'}`);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to insert test data to verify database is working
async function insertTestData() {
  try {
    console.log('Attempting to insert test data...');

    // Try to insert a test tenant
    const testTenant = {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone: '555-123-4567'
    };

    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .insert(testTenant)
      .select()
      .single();

    if (tenantError) {
      console.error('Error inserting test tenant:', tenantError.message);
    } else {
      console.log('Successfully inserted test tenant:', tenantData);

      // If tenant creation worked, try to insert a property
      const testProperty = {
        name: 'Test Property',
        address: '123 Test St',
        city: 'Toronto',
        province: 'ON',
        postal_code: 'M5V 2K4',
        landlord_id: 'test-landlord-id' // Need a real landlord ID for FK constraint
      };

      try {
        const { data: propertyData, error: propertyError } = await supabase
          .from('properties')
          .insert(testProperty)
          .select()
          .single();

        if (propertyError) {
          console.log('Error inserting test property (likely due to FK constraint):', propertyError.message);
        } else {
          console.log('Successfully inserted test property:', propertyData);
        }
      } catch (propError) {
        console.error('Exception inserting property:', propError.message);
      }
    }
  } catch (error) {
    console.error('Error during test data insertion:', error.message);
  }
}

// Main function
async function main() {
  try {
    // First, check if we can access the database
    console.log('Testing database access...');

    // Try to select from tenants table
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .limit(5);

    if (error) {
      console.error('Error accessing tenants table:', error.message);

      if (error.code === '42501') { // Permission denied error
        console.log('\nThis is a permissions error. Let\'s try to diagnose and fix it:');
        console.log('1. The service role key might not be working correctly.');
        console.log('2. There might be RLS policies blocking your access.');
        console.log('3. The table might not exist or have a different name.');

        // Try to get a list of tables in the public schema
        console.log('\nTrying to list tables from information_schema...');
        const { data: tables, error: tablesError } = await supabase
          .rpc('get_tables');

        if (tablesError) {
          console.error('Error listing tables:', tablesError.message);

          // If RPC fails, create it first
          try {
            console.log('Creating get_tables function...');
            const createFn = await supabase.rpc('execute_sql', {
              sql_query: `
                CREATE OR REPLACE FUNCTION get_tables()
                RETURNS SETOF information_schema.tables
                LANGUAGE sql
                SECURITY DEFINER
                AS $$
                  SELECT * FROM information_schema.tables WHERE table_schema = 'public';
                $$;
              `
            });

            if (createFn.error) {
              console.error('Error creating get_tables function:', createFn.error.message);
            } else {
              console.log('Created get_tables function successfully!');
            }
          } catch (e) {
            console.error('Exception creating function:', e.message);
          }
        } else {
          if (tables && tables.length > 0) {
            console.log('Tables found in the public schema:');
            tables.forEach(table => console.log(`- ${table.table_name}`));
          } else {
            console.log('No tables found in the public schema.');
          }
        }

        // Insert test data to verify write access
        await insertTestData();
      }
    } else {
      console.log(`Successfully accessed tenants table. Found ${data.length} records.`);

      if (data.length > 0) {
        console.log('Sample tenant:', data[0]);
      } else {
        console.log('No tenant records found. Let\'s insert a test record to verify write access:');
        await insertTestData();
      }
    }

    console.log('\nDatabase access check complete.');
  } catch (error) {
    console.error('Unhandled error during database check:', error.message);
  }
}

// Run the main function
main().catch(e => console.error('Fatal error:', e));
