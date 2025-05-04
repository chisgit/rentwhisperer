// Test script to verify Supabase connection
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase connection with environment variables:');
console.log('SUPABASE_URL:', supabaseUrl ? '✓ Set' : '❌ Missing');
console.log('SUPABASE_ANON_KEY:', supabaseKey ? '✓ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓ Set' : '❌ Missing');

// Test anon key connection
console.log('\nTesting connection with anon key:');
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnonConnection() {
  try {
    const { data, error } = await supabase.from('tenants').select('*').limit(1);

    if (error) {
      console.error('❌ Anon key connection failed:', error);
    } else {
      console.log('✓ Anon key connection successful');
      console.log('Sample data:', data);
    }
  } catch (err) {
    console.error('❌ Exception during anon key test:', err.message);
  }
}

// Test service role key connection
console.log('\nTesting connection with service role key:');
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testServiceConnection() {
  try {
    const { data, error } = await supabaseAdmin.from('tenants').select('*').limit(1);

    if (error) {
      console.error('❌ Service role key connection failed:', error);
    } else {
      console.log('✓ Service role key connection successful');
      console.log('Sample data:', data);
    }
  } catch (err) {
    console.error('❌ Exception during service role test:', err.message);
  }
}

// Run both tests
async function runTests() {
  await testAnonConnection();
  await testServiceConnection();
}

runTests();
