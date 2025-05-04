// Reset Supabase database script
import { createClient } from "@supabase/supabase-js";
import * as fs from 'fs';
import * as path from 'path';
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

// Create Supabase client with service role key (admin privileges)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetDatabase() {
  try {
    console.log("Starting database reset...");

    // First, create the exec_sql function if it doesn't exist
    console.log("Creating exec_sql function...");
    const createFunctionSQL = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
`;

    // Use rpc to create the exec_sql function
    const { error: createFunctionError } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });
    if (createFunctionError) {
      console.log("Function may already exist or there was an error creating it:", createFunctionError.message);
      // Continue anyway as the function might already exist
    }

    // Drop all tables in reverse order (due to foreign key constraints)
    console.log("Dropping existing tables...");

    // Define drop statements in correct order (respecting foreign key dependencies)
    const dropStatements = [
      "DROP TABLE IF EXISTS public.notifications CASCADE;",
      "DROP TABLE IF EXISTS public.rent_payments CASCADE;",
      "DROP TABLE IF EXISTS public.tenants CASCADE;",
      "DROP TABLE IF EXISTS public.units CASCADE;",
      "DROP TABLE IF EXISTS public.properties CASCADE;"
    ];

    // Execute drop statements
    for (const statement of dropStatements) {
      console.log(`Executing: ${statement}`);
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error) {
        console.error(`Error dropping table: ${error.message}`);
      }
    }

    // Read the setup script
    console.log("Reading setup script...");
    const setupScript = fs.readFileSync(path.resolve(__dirname, "../../../../config/setup_database.sql"), 'utf8');

    // Split the script by semicolons to get individual statements
    const statements = setupScript
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0); // Remove empty statements

    // Execute each statement
    console.log("Recreating tables...");
    for (const statement of statements) {
      if (statement.length > 50) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
      } else {
        console.log(`Executing: ${statement}`);
      }

      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error) {
        console.error(`Error executing statement: ${error.message}`);
      }
    }

    console.log("Database reset complete!");

  } catch (error) {
    console.error("Error resetting database:", error);
    process.exit(1);
  }
}

// Execute the reset function
resetDatabase();
