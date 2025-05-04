// Reset Supabase database script with correct environment variable names
import { createClient } from "@supabase/supabase-js";
import * as fs from 'fs';
import * as path from 'path';
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Match the env var name in your .env file

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  console.error(`SUPABASE_URL: ${supabaseUrl ? 'Found' : 'Missing'}`);
  console.error(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? 'Found' : 'Missing'}`);
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

    // Test connection first
    console.log("Testing connection to Supabase...");
    const { error: connectionError } = await supabase.from('pg_tables').select('tablename').limit(1);
    if (connectionError) {
      console.error("Failed to connect to Supabase:", connectionError.message);
      process.exit(1);
    }
    console.log("Successfully connected to Supabase!");

    // Drop tables if they exist
    console.log("Dropping existing tables...");

    try {
      // Try to delete records first (less destructive)
      await supabase.from('notifications').delete().gt('id', 0);
      await supabase.from('rent_payments').delete().gt('id', 0);
      await supabase.from('incoming_messages').delete().gt('id', 0);
      await supabase.from('tenants').delete().gt('id', 0);
      await supabase.from('units').delete().gt('id', 0);
      await supabase.from('properties').delete().gt('id', 0);
      await supabase.from('landlords').delete().gt('id', 0);
      console.log("Cleared all tables");
    } catch (error) {
      console.log("Error clearing tables, will proceed with setup:", error);
    }

    // Load schema from setup_database.sql
    console.log("Running setup script...");

    // Read the setup script
    const setupScript = fs.readFileSync(path.resolve(__dirname, "../../../../config/setup_database.sql"), 'utf8');

    // Split script into individual statements
    const statements = setupScript.split(';').filter(stmt => stmt.trim().length > 0);

    // Execute each statement
    for (const statement of statements) {
      try {
        console.log(`Executing: ${statement.trim().substring(0, 60)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (error) {
          console.log("Error executing statement:", error);
        }
      } catch (error) {
        console.log("Failed to execute statement:", error);
        // Try direct SQL execution as alternative
        try {
          await supabase.sql(statement);
        } catch (innerError) {
          console.log("Alternative execution also failed:", innerError);
        }
      }
    }

    // Insert test data
    console.log("Inserting test data...");

    // Insert test property
    const propertyValues = ['Test Property', '123 Main St', 'Toronto', 'ON', 'A1A1A1', 1];
    console.log("Inserting into properties:", propertyValues);

    try {
      const { data: property, error } = await supabase
        .from('properties')
        .insert({
          name: 'Test Property',
          address: '123 Main St',
          city: 'Toronto',
          province: 'ON',
          postal_code: 'A1A1A1',
          landlord_id: 1
        })
        .select();

      if (error) {
        console.log("Error inserting into properties:", error);
      } else {
        console.log("Successfully inserted property:", property);

        // Insert test unit
        const unitValues = ['101', property ? property[0].id : 1, 1500, 1, '2025-05-01T00:00:00Z'];
        console.log("Inserting into units:", unitValues);

        const { data: unit, error: unitError } = await supabase
          .from('units')
          .insert({
            unit_number: '101',
            property_id: property ? property[0].id : 1,
            rent_amount: 1500,
            rent_due_day: 1,
            lease_start: '2025-05-01T00:00:00Z'
          })
          .select();

        if (unitError) {
          console.log("Error inserting into units:", unitError);
        } else {
          console.log("Successfully inserted unit:", unit);
        }
      }
    } catch (error) {
      console.error("Error inserting test data:", error);
    }

    console.log("Database reset complete!");

  } catch (error) {
    console.error("An error occurred during database reset:", error);
    process.exit(1);
  }
}

// Run the reset
resetDatabase();
