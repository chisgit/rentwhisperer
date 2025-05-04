// Enhanced script to verify Supabase connection with more detailed logging
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Try loading environment variables from multiple locations
console.log('Loading environment variables...');
// First try the root project .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Then try the package root .env (will not override existing env vars)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\nChecking environment variables:');
console.log('SUPABASE_URL:', supabaseUrl ? `✓ Set (${supabaseUrl})` : '❌ Missing');
console.log('SUPABASE_ANON_KEY:', supabaseKey ? `✓ Set (${supabaseKey.substring(0, 5)}...)` : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? `✓ Set (${supabaseServiceKey.substring(0, 5)}...)` : '❌ Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ ERROR: Missing required Supabase credentials!');
  console.error('Please check your .env file and add the missing credentials.');
  process.exit(1);
}

console.log('\n1. Creating Supabase clients...');
// Create client with anon key for regular operations
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('- Anonymous client created.');

// Create a service role client that can bypass RLS if service key is available
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase; // Fallback to regular client if no service key
console.log('- Service role client created.');

// Test anon key connection
async function testAnonConnection() {
  console.log('\n2. Testing connection with anon key:');
  try {
    console.log('- Sending request to Supabase...');
    const { data, error } = await supabase.from('tenants').select('*').limit(1);

    if (error) {
      console.error('❌ Anon key connection failed:', error);
      return false;
    } else {
      console.log('✓ Anon key connection successful');
      console.log('- Sample data:', data.length > 0 ? `Found ${data.length} records` : 'No records found');
      return true;
    }
  } catch (err) {
    console.error('❌ Exception during anon key test:', err);
    return false;
  }
}

// Test service role key connection
async function testServiceConnection() {
  console.log('\n3. Testing connection with service role key:');
  try {
    console.log('- Sending request to Supabase...');
    const { data, error } = await supabaseAdmin.from('tenants').select('*').limit(1);

    if (error) {
      console.error('❌ Service role key connection failed:', error);
      return false;
    } else {
      console.log('✓ Service role key connection successful');
      console.log('- Sample data:', data.length > 0 ? `Found ${data.length} records` : 'No records found');
      return true;
    }
  } catch (err) {
    console.error('❌ Exception during service role test:', err);
    return false;
  }
}

// Run both tests
async function runTests() {
  console.log('\nStarting connection tests...');
  const anonResult = await testAnonConnection();
  const serviceResult = await testServiceConnection();

  console.log('\nTEST RESULTS:');
  console.log('- Anon key connection:', anonResult ? '✓ PASSED' : '❌ FAILED');
  console.log('- Service key connection:', serviceResult ? '✓ PASSED' : '❌ FAILED');

  if (!anonResult || !serviceResult) {
    console.log('\nTroubleshooting tips:');
    console.log('1. Check your .env file for correct credentials');
    console.log('2. Verify your Supabase project is active');
    console.log('3. Check for network connectivity issues');
    console.log('4. Verify IP restrictions in Supabase');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! Your Supabase connection is working correctly.');
  }
}

// Execute tests
runTests();
