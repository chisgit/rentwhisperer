#!/usr/bin/env node

// Script to apply database changes for the tenant rent amount schema update
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// __dirname is c:\Users\User\RentWhisperer\packages\backend\src\scripts
const scriptPath = path.resolve(__dirname, '../../../..', 'config/update_schema_for_tenant_rent.sql');

// Check if file exists
if (!fs.existsSync(scriptPath)) {
  console.error(`SQL script not found at ${scriptPath}`);
  process.exit(1);
}

console.log('Running database schema update for tenant rent amounts...');

// Get database connection from environment variables
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('No database connection URL found in environment variables.');
  console.error('Please set DATABASE_URL or SUPABASE_DB_URL');
  process.exit(1);
}

// Run the SQL script against the database
const command = `psql ${dbUrl} -f ${scriptPath}`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing SQL: ${error.message}`);
    process.exit(1);
  }

  if (stderr) {
    console.error(`SQL stderr: ${stderr}`);
  }

  console.log(stdout);
  console.log('Schema update completed successfully!');
});
