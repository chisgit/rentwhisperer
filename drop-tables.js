// drop-tables.js
// A script to just drop all tables from the database without applying the schema

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please ensure your .env file contains:');
  console.error('SUPABASE_URL=<your-supabase-url>');
  console.error('SUPABASE_SERVICE_ROLE_KEY=<your-service-key>');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// SQL to drop all tables
const dropTablesSQL = `
DO $$ 
DECLARE
  r RECORD;
BEGIN
  -- Disable all triggers
  EXECUTE 'SET session_replication_role = replica';
  
  -- Drop all tables in public schema
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
  
  -- Re-enable triggers
  EXECUTE 'SET session_replication_role = DEFAULT';
END $$;
`;

async function dropAllTables() {
  console.log('Starting table drop process...');

  try {
    // Try to execute SQL directly via POST request
    console.log('Attempting to drop all tables...');

    const response = await fetch(`${supabaseUrl}/rest/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: dropTablesSQL })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error dropping tables: ${response.status} ${errorText}`);
      process.exit(1);
    }

    console.log('Tables dropped successfully!');
    console.log('Now you can apply the schema using:');
    console.log('   npm run apply-schema');

  } catch (error) {
    console.error('Unexpected error during table drop:', error.message);
    process.exit(1);
  }
}

dropAllTables();
