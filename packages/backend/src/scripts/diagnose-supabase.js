/**
 * Script to diagnose the Supabase connection and understand what's happening with permissions
 */
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
console.log(`Loading environment variables from: ${envPath}`);
dotenv.config({ path: envPath });

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Log credentials with partial masking for security
console.log('SUPABASE_URL:', supabaseUrl);
if (supabaseAnonKey) {
  console.log('SUPABASE_ANON_KEY:', supabaseAnonKey.substring(0, 10) + '...');
}
if (supabaseServiceKey) {
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey.substring(0, 10) + '...');
}

// If any credential is missing, exit
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('One or more Supabase credentials are missing from the .env file!');
  process.exit(1);
}

// Create both anon and service clients to test both
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Function to test access with a client
async function testAccess(client, clientType) {
  console.log(`\n=== Testing ${clientType} client ===`);

  try {
    // Test basic authentication
    console.log('Testing auth status...');
    const { data: authData, error: authError } = await client.auth.getUser();

    if (authError) {
      console.error(`Authentication error with ${clientType} client:`, authError.message);
    } else {
      console.log(`${clientType} client auth status:`, authData ? 'Authenticated' : 'Not authenticated');
    }

    // Test tenants table access
    console.log('Testing tenants table access...');
    const { data: tenants, error: tenantsError } = await client.from('tenants').select('*').limit(3);

    if (tenantsError) {
      console.error(`Error accessing tenants with ${clientType} client:`, tenantsError.message);
    } else {
      console.log(`Successfully accessed tenants table with ${clientType} client!`);
      console.log(`Found ${tenants.length} records. Sample:`, tenants.length ? tenants[0] : 'No records');
    }
  } catch (e) {
    console.error(`Exception testing ${clientType} client:`, e);
  }
}

// Run tests
async function runTests() {
  // Test both clients
  await testAccess(supabaseAnon, 'anon');
  await testAccess(supabaseAdmin, 'service role');

  // Additional test for feature we need - joining related tables
  console.log('\n=== Testing specific query that failed in the app ===');
  try {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        units (
          id,
          unit_number,
          properties (
            id,
            name,
            address
          )
        )
      `)
      .limit(3);

    if (error) {
      console.error('Error with the specific query:', error.message);
    } else {
      console.log('Specific query succeeded!');
      console.log(`Retrieved ${data.length} records with nested joins.`);
    }
  } catch (e) {
    console.error('Exception running specific query:', e);
  }

  console.log('\nDiagnostic tests complete. If errors persist, please check your Supabase project settings.');
}

runTests().catch(e => console.error('Unhandled error:', e));
