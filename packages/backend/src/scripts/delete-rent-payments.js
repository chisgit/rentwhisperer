// Script to delete all rent payments from the database
require('dotenv').config({ path: '../../.env' });

const { createClient } = require('@supabase/supabase-js');

// Create a Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAllRentPayments() {
  console.log('Deleting all rent payments...');

  try {
    // Delete all records from the rent_payments table
    const { data, error } = await supabase
      .from('rent_payments')
      .delete();

    if (error) {
      console.error('Error deleting rent payments:', error.message);
      return;
    }

    console.log('Successfully deleted all rent payments');
  } catch (error) {
    console.error('Exception when deleting rent payments:', error);
  }
}

// Execute the function
deleteAllRentPayments();
