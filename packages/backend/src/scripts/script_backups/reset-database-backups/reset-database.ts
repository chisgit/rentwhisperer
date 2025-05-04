// Script to drop and recreate Supabase tables
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

// First, ensure the exec_sql function exists
const createExecSqlFunction = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
`;

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
        console.error(`Error dropping tables: ${error.message}`);
        console.log("Trying alternative approach...");

        // Alternative approach: direct SQL execution using stored procedure
        const { error: rpcError } = await supabase.rpc('exec_sql', {
          sql: statement
        });

        if (rpcError) {
          console.error(`Failed alternative approach: ${rpcError.message}`);        // Last resort: try raw REST API call
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey || '',
              'Authorization': `Bearer ${supabaseServiceKey || ''}`
            } as HeadersInit,
            body: JSON.stringify({ sql: statement })
          });

          if (!response.ok) {
            console.error(`Failed to execute SQL via REST API: ${await response.text()}`);
          } else {
            console.log(`Successfully executed via REST API`);
          }
        }
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
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement + ';'
      });

      if (error) {
        console.error(`Error executing statement: ${error.message}`);
        // Try alternative approach
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ sql: statement + ';' })
        });

        if (!response.ok) {
          console.error(`Failed to execute SQL via REST API: ${await response.text()}`);
        } else {
          console.log(`Successfully executed via REST API`);
        }
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
