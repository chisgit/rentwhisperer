/**
 * Script to directly fix RLS permissions using the pg module
 * Works when REST API calls fail due to missing execute_sql function
 */
const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '../../.env');
console.log(`Loading environment variables from: ${envPath}`);
dotenv.config({ path: envPath });

// Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check your .env file.');
  process.exit(1);
}

// Extract the hostname from the Supabase URL
const hostname = supabaseUrl.replace('https://', '');

// Construct the PostgreSQL connection string
const connectionString = `postgresql://postgres:${supabaseServiceKey}@${hostname}:5432/postgres`;

console.log(`Connecting to database at: ${hostname}`);

// SQL commands to fix permissions
const sqlCommands = [
  // Grant connect to database
  "GRANT CONNECT ON DATABASE postgres TO postgres, anon, authenticated, service_role, PUBLIC;",

  // Grant schema-level permissions
  "GRANT USAGE, CREATE ON SCHEMA public TO postgres;",
  "GRANT USAGE ON SCHEMA public TO PUBLIC;",
  "GRANT USAGE ON SCHEMA public TO anon, authenticated;",
  "GRANT ALL ON SCHEMA public TO service_role;",

  // Disable RLS for all relevant tables in public schema
  "ALTER TABLE IF EXISTS public.tenants DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.properties DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.units DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.tenant_units DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.rent_payments DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.incoming_messages DISABLE ROW LEVEL SECURITY;",
  "ALTER TABLE IF EXISTS public.landlords DISABLE ROW LEVEL SECURITY;",

  // Grant table-level permissions
  "GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;",
  "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;",
  "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;"
];

// Create a new PostgreSQL client
const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase connections
  },
});

// Connect and run the SQL commands
async function fixDatabasePermissions() {
  try {
    console.log('Connecting to the database...');
    await client.connect();
    console.log('Connected successfully!');

    // Run each SQL command
    for (const sql of sqlCommands) {
      try {
        console.log(`Executing: ${sql}`);
        await client.query(sql);
        console.log('Command executed successfully.');
      } catch (err) {
        console.error(`Error executing command: ${sql}`);
        console.error(`Error details: ${err.message}`);

        // Log more details about the error
        if (err.code) {
          console.error(`Error code: ${err.code}`);
        }

        // Continue with the next command even if one fails
      }
    }

    console.log('\nAll commands have been processed.');
    console.log('Database permissions should now be fixed.');

    // Test if we can access the tenants table now
    try {
      console.log('\nTesting access to tenants table...');
      const { rows } = await client.query('SELECT COUNT(*) FROM tenants');
      console.log(`Success! Found ${rows[0].count} tenants in the database.`);
    } catch (testErr) {
      console.error('Error testing tenants table:', testErr.message);
    }
  } catch (error) {
    console.error('Error connecting to the database:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('Could not resolve the database hostname. Check your Supabase URL.');
    }
  } finally {
    // Close the client connection
    await client.end();
    console.log('Database connection closed.');
  }
}

// Run the main function
fixDatabasePermissions().catch(err => {
  console.error('Unhandled error:', err);
  // Ensure the client connection is closed
  client.end().catch(() => { });
});
