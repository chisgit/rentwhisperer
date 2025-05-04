// reset-db-simple.js
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials and schema
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schemaPath = path.resolve(__dirname, './config/supabase_schema.sql');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Drop tables SQL
const dropTablesSQL = `
DO $$ 
DECLARE
  r RECORD;
BEGIN
  -- Disable triggers
  EXECUTE 'SET session_replication_role = replica';
  
  -- Drop all tables
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
  
  -- Re-enable triggers
  EXECUTE 'SET session_replication_role = DEFAULT';
END $$;
`;

async function resetDatabase() {
  console.log('Resetting database...');

  try {
    // Create axios API instance
    const api = axios.create({
      baseURL: supabaseUrl,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Step 1: Drop all tables
    console.log('Dropping all tables...');
    const dropResult = await api.post('/rest/v1/sql', { query: dropTablesSQL });
    console.log('Tables dropped!');

    // Step 2: Apply schema
    console.log('Applying schema...');
    const schemaResult = await api.post('/rest/v1/sql', { query: schemaContent });
    console.log('Schema applied!');

    console.log('Database reset complete!');
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

resetDatabase();
