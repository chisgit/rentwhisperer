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

    // Drop all tables in reverse order (due to foreign key constraints)
    console.log("Dropping existing tables...");

    // Use direct SQL queries
    await supabase.from('notifications').delete().gt('id', 0);
    console.log("Cleared notifications table");

    await supabase.from('rent_payments').delete().gt('id', 0);
    console.log("Cleared rent_payments table");

    await supabase.from('tenants').delete().gt('id', 0);
    console.log("Cleared tenants table");

    await supabase.from('units').delete().gt('id', 0);
    console.log("Cleared units table");

    await supabase.from('properties').delete().gt('id', 0);
    console.log("Cleared properties table");

    // Read the setup script
    console.log("Reading setup script...");
    const setupScript = fs.readFileSync(path.resolve(__dirname, "../../../../config/setup_database.sql"), 'utf8');

    // Extract insert statements
    const insertRegex = /INSERT\s+INTO\s+[^;]+;/gi;
    const insertMatches = setupScript.match(insertRegex) || [];

    // Execute insert statements
    console.log("Inserting test data...");
    for (const insertStatement of insertMatches) {
      console.log(`Executing: ${insertStatement.substring(0, 50)}...`);

      // Extract table name and values
      const tableMatch = insertStatement.match(/INSERT\s+INTO\s+public\.(\w+)/i);
      const valuesMatch = insertStatement.match(/VALUES\s+\(([^)]+)\)/i);

      if (tableMatch && valuesMatch) {
        const tableName = tableMatch[1];
        const valuesStr = valuesMatch[1];

        // Parse values - this is simplified and may need adjustments based on your data
        const values = valuesStr.split(',').map(v => {
          v = v.trim();
          // Remove quotes for strings
          if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
            return v.slice(1, -1);
          }
          // Convert numeric values
          if (!isNaN(Number(v))) {
            return Number(v);
          }
          return v;
        });

        console.log(`Inserting into ${tableName}:`, values);

        // Create an object with column names and values
        // This requires knowing the schema in advance
        let data = {};

        if (tableName === 'properties') {
          data = {
            name: values[0],
            address: values[1],
            city: values[2],
            province: values[3],
            postal_code: values[4],
            landlord_id: values[5]
          };
        } else if (tableName === 'units') {
          data = {
            unit_number: values[0],
            property_id: values[1],
            rent_amount: values[2],
            rent_due_day: values[3],
            lease_start: values[4]
          };
        }

        const { error } = await supabase.from(tableName).insert(data);
        if (error) {
          console.error(`Error inserting into ${tableName}:`, error);
        } else {
          console.log(`Successfully inserted data into ${tableName}`);
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
