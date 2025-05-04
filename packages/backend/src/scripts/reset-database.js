#!/usr/bin/env node

/**
 * Script to reset the RentWhisperer database
 * This will drop all tables and recreate the schema from scratch
 */
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// __dirname is packages/backend/src/scripts
const schemaPath = path.resolve(__dirname, '../../../../config/supabase_schema.sql');
const dropTablesQuery = `
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

console.log('Resetting database...');
console.log(`Using schema file: ${schemaPath}`);

// Check if schema file exists
if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found at ${schemaPath}`);
  process.exit(1);
}

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Either use the Supabase credentials or fallback to direct database URL
let dbUrl;

if (supabaseUrl && supabaseServiceKey) {
  console.log('Using Supabase credentials to construct database URL...');
  // Extract the hostname from the SUPABASE_URL
  const hostname = supabaseUrl.replace('https://', '');

  // Construct the database URL (Supabase format)
  dbUrl = `postgresql://postgres:${supabaseServiceKey}@db.${hostname}:5432/postgres`;
  console.log(`Database URL constructed from Supabase credentials`);
} else {
  // Fallback to direct database URL if Supabase credentials are not available
  dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    console.error('No database connection information found in environment variables.');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL as a fallback');
    process.exit(1);
  }
}

// Execute the drop tables query
console.log('Dropping all existing tables...');
const dropTablesCommand = `psql ${dbUrl} -c "${dropTablesQuery}"`;

exec(dropTablesCommand, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error dropping tables: ${error.message}`);
    return;
  }

  if (stderr) {
    console.log(`stderr: ${stderr}`);
  }

  console.log('Tables dropped successfully.');
  console.log('Applying schema...');

  // Apply the schema file
  const applySchemaCommand = `psql ${dbUrl} -f "${schemaPath}"`;

  exec(applySchemaCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error applying schema: ${error.message}`);
      return;
    }

    if (stderr) {
      console.log(`stderr: ${stderr}`);
    }

    console.log('Database reset and schema applied successfully!');
  });
});
