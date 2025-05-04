#!/usr/bin/env node

/**
 * Script to apply the master schema for RentWhisperer
 * This will apply all schema changes to the database
 */
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
// Try loading environment variables from multiple locations
const envPaths = [
  path.resolve(__dirname, '../../.env'),         // packages/backend/.env
  path.resolve(__dirname, '../../../.env'),      // packages/.env
  path.resolve(__dirname, '../../../../.env')    // root .env
];

// Load .env files in order of precedence
envPaths.forEach(envPath => {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from: ${envPath}`);
    require('dotenv').config({ path: envPath });
  }
});

// __dirname is packages/backend/src/scripts
const schemaPath = path.resolve(__dirname, '../../../../config/supabase_schema.sql');

console.log('Applying master database schema...');
console.log(`Using schema file: ${schemaPath}`);

// Check if file exists
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

// Run the SQL script against the database
console.log('Applying schema to the database...');
console.log('NOTE: psql is no longer used. Please use apply-schema-js.js instead.');
console.log('This script is kept for backward compatibility but will redirect to the JavaScript approach.');

// Require and execute the apply-schema-js script which doesn't depend on psql
try {
  console.log('Redirecting to JavaScript-based schema update...');
  require('./apply-schema-js');
} catch (err) {
  console.error(`Error requiring apply-schema-js.js: ${err.message}`);
  process.exit(1);
}
