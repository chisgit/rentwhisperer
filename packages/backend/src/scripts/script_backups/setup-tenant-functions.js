#!/usr/bin/env node

// Script to setup the tenant update function in the database
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Path to the SQL function file
const scriptPath = path.resolve(__dirname, '../../../../config/tenant_update_function.sql');

console.log(`Looking for SQL script at: ${scriptPath}`);

// Check if file exists
if (!fs.existsSync(scriptPath)) {
  console.error(`SQL script not found at ${scriptPath}`);
  process.exit(1);
}

console.log('Found SQL script. Running database setup...');

// Try to get database connection from environment variables
let dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

// If no environment variable is set, look for a .env file
if (!dbUrl) {
  try {
    // First, try to load from .env file
    const envPath = path.resolve(__dirname, '../../../../.env');
    if (fs.existsSync(envPath)) {
      console.log('Found .env file, checking for database URL...');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const matches = envContent.match(/(?:DATABASE_URL|SUPABASE_DB_URL)=["']?([^"'\r\n]+)["']?/);

      if (matches && matches[1]) {
        dbUrl = matches[1];
        console.log('Found database URL in .env file.');
      }
    }
  } catch (err) {
    console.error('Error reading .env file:', err.message);
  }
}

// If still no database URL, prompt the user for it
if (!dbUrl) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('No database connection URL found in environment variables.');
  console.log('Please enter your PostgreSQL database connection URL:');

  rl.question('> ', (inputUrl) => {
    if (!inputUrl) {
      console.error('No URL provided. Exiting.');
      rl.close();
      process.exit(1);
    }

    // Save the URL to .env for future use
    try {
      const envPath = path.resolve(__dirname, '../../../../.env');
      let envContent = '';

      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      // Check if DATABASE_URL already exists
      if (!/DATABASE_URL=/.test(envContent)) {
        envContent += `\nDATABASE_URL="${inputUrl}"\n`;
        fs.writeFileSync(envPath, envContent);
        console.log('Database URL saved to .env file for future use.');
      }
    } catch (err) {
      console.log('Could not save URL to .env file:', err.message);
    }

    // Run the SQL script against the database
    runScript(inputUrl);
    rl.close();
  });
} else {
  // We have a database URL, so run the script
  runScript(dbUrl);
}

function runScript(url) {
  console.log('Running SQL script against database...');

  const command = `psql "${url}" -f "${scriptPath}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing SQL: ${error.message}`);
      if (error.message.includes('psql: command not found')) {
        console.error('It appears that PostgreSQL client tools (psql) are not installed or not in your PATH.');
        console.error('Please install PostgreSQL client tools or make sure psql is in your PATH.');
      }
      process.exit(1);
    }

    if (stderr) {
      // PostgreSQL often outputs notices through stderr, so we'll just log them
      console.log(`SQL stderr: ${stderr}`);
    }

    console.log(stdout);
    console.log('Database function setup completed successfully!');
  });
}
