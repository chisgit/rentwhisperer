#!/usr/bin/env node

// Script to remove property_address column from tenants table
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Use absolute path to avoid path resolution issues
// Path needs to go up from __dirname (which is packages/backend/src/scripts)
// to the root directory where config folder is located
const scriptPath = path.resolve(__dirname, '../../../../config/remove_property_address.sql');

console.log(`Looking for SQL script at: ${scriptPath}`);

// Check if file exists
if (!fs.existsSync(scriptPath)) {
  console.error(`SQL script not found at ${scriptPath}`);
  process.exit(1);
}

console.log('Found SQL script. Running database update...');

// Get database connection from environment variables
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('No database connection URL found in environment variables.');
  console.error('Please set DATABASE_URL or SUPABASE_DB_URL');
  process.exit(1);
}

// Run the SQL script against the database
const command = `psql ${dbUrl} -f "${scriptPath}"`;

console.log(`Executing command: ${command}`);

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing SQL: ${error.message}`);
    process.exit(1);
  }

  if (stderr) {
    console.error(`SQL stderr: ${stderr}`);
  }

  console.log(stdout);
  console.log('Database update completed successfully!');
});
