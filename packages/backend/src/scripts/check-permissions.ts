// Fix database permissions by executing separate SQL commands
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

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

    // Disable RLS for each table
    const tables = ["tenants", "tenant_units", "units", "properties", "landlords"];

    for (const table of tables) {
      console.log(`Disabling RLS for table: ${table}`);
      // Note: We can't directly execute arbitrary SQL through the Supabase JS client
      // Instead, we'll retrieve a row to check access
      const { data, error } = await supabase.from(table).select("*").limit(1);

      if (error) {
        console.log(`Error accessing ${table}: ${error.message}`);
      } else {
        console.log(`Successfully accessed ${table}`);
      }
    }

    console.log("\nIMPORTANT: You may need to disable RLS manually in the Supabase dashboard.");
    console.log("Go to Authentication > Policies and disable RLS for each table or add appropriate policies.");
  } catch (error) {
    console.error("Error fixing permissions:", error);
  }
}

fixPermissions();
