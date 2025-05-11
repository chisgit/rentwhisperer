/**
 * Script to fix RLS permissions in the Supabase database using the Supabase API directly
 * This avoids the need for psql to be installed locally.
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
console.log("Loading environment variables...");
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

console.log(`Using Supabase URL: ${supabaseUrl}`);

// Create a Supabase client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Define the SQL statements to fix RLS permissions
const statements = [
  // Grant connect to database
  "GRANT CONNECT ON DATABASE postgres TO postgres, anon, authenticated, service_role, PUBLIC",

  // Grant schema-level permissions
  "GRANT USAGE, CREATE ON SCHEMA public TO postgres",
  "GRANT USAGE ON SCHEMA public TO PUBLIC",
  "GRANT USAGE ON SCHEMA public TO anon, authenticated",
  "GRANT ALL ON SCHEMA public TO service_role",

  // Disable RLS for auth.users (only for debugging)
  "ALTER TABLE IF EXISTS auth.users DISABLE ROW LEVEL SECURITY",
  "GRANT SELECT ON TABLE auth.users TO anon, authenticated",
  "GRANT ALL ON TABLE auth.users TO service_role",

  // Disable RLS for all relevant tables in public schema
  "ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.units DISABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.tenant_units DISABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.rent_payments DISABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.incoming_messages DISABLE ROW LEVEL SECURITY",
  "ALTER TABLE public.landlords DISABLE ROW LEVEL SECURITY",

  // Grant table-level permissions
  "GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated",
  "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role",
  "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres"
];

// Execute each SQL statement one by one
async function executeStatements() {
  console.log("Starting RLS permissions fix...");

  for (const sql of statements) {
    try {
      console.log(`Executing: ${sql}`);
      const { error } = await supabaseAdmin.rpc('execute_sql', { sql_query: sql });

      if (error) {
        console.error(`Error executing statement: ${sql}`);
        console.error(error);
      } else {
        console.log('Statement executed successfully');
      }
    } catch (err) {
      console.error(`Exception executing statement: ${sql}`);
      console.error(err);
    }
  }

  console.log("RLS permissions fix completed.");
}

// Check if the execute_sql function exists, and execute statements if it does
async function checkAndExecute() {
  console.log("Checking if execute_sql RPC function exists in Supabase...");

  try {
    // Try to call the execute_sql function with a simple test query
    const { data, error } = await supabaseAdmin.rpc('execute_sql', {
      sql_query: 'SELECT 1 as test'
    });

    if (error) {
      // If function doesn't exist, we need to create it first
      console.error("execute_sql function not found or error calling it:", error.message);
      console.log("Creating execute_sql function...");

      // SQL to create the execute_sql function
      const createFunctionSql = `
        CREATE OR REPLACE FUNCTION execute_sql(sql_query text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql_query;
        END;
        $$;
        
        -- Grant execute permission on the function
        GRANT EXECUTE ON FUNCTION execute_sql(text) TO service_role;
      `;

      // Create the function using a direct query
      const { error: createError } = await supabaseAdmin.rpc('execute_sql', {
        sql_query: createFunctionSql
      }).catch(() => {
        // If this fails, it's likely because the function doesn't exist yet to create itself
        // We need to use a direct SQL query instead
        return { error: { message: "Could not create function via RPC" } };
      });

      if (createError) {
        console.error("Failed to create execute_sql function via RPC:", createError.message);
        console.error("Please run the following SQL in the SQL Editor in the Supabase dashboard:");
        console.log(createFunctionSql);
        console.log("\nThen run this script again.");
        process.exit(1);
      } else {
        console.log("execute_sql function created successfully.");
        // Now execute the statements
        await executeStatements();
      }
    } else {
      // Function exists, execute statements
      console.log("execute_sql function exists, proceeding with RLS fixes...");
      await executeStatements();
    }
  } catch (err) {
    console.error("Error checking execute_sql function:", err);
    process.exit(1);
  }
}

// Run the main function
checkAndExecute().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
