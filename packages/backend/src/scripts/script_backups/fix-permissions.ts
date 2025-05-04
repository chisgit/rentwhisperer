// Fix RLS permissions in the database
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPermissions() {
  try {
    console.log("Fixing RLS permissions...");

    // Read the SQL file
    const sqlPath = path.resolve(__dirname, "../../../config/fix-rls-permissions.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute the SQL query
    const { error } = await supabase.rpc("exec_sql", { query: sql });

    if (error) {
      throw new Error(`Error executing SQL: ${error.message}`);
    }

    console.log("RLS permissions fixed successfully!");
  } catch (error) {
    console.error("Error fixing permissions:", error);
  }
}

fixPermissions();
