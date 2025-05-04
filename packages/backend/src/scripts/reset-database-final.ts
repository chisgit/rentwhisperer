// Final simplified database reset script
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables - try multiple locations
// First try the root project .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
// Then try the package root .env (will not override existing env vars)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

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
    console.log("Testing connection to Supabase with service role key...");
    const { data, error: connectionError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');

    if (connectionError) {
      console.error("Failed to connect to Supabase:", connectionError);
      process.exit(1);
    }
    console.log("Successfully connected to Supabase!");
    console.log("Tables found:", data?.map(t => t.tablename).join(', '));

    // Clear existing data from tables that likely exist
    console.log("Clearing existing data...");

    const tablesToClear = [
      'notifications',
      'incoming_messages',
      'rent_payments',
      'tenants',
      'units',
      'properties',
      'landlords'
    ];

    for (const table of tablesToClear) {
      try {
        console.log(`Clearing ${table} table...`);
        const { error } = await supabase.from(table).delete();
        if (error) {
          console.log(`Error clearing ${table}: ${error.message}`);
        } else {
          console.log(`Successfully cleared ${table} table`);
        }
      } catch (err) {
        console.log(`Error with ${table}, might not exist:`, err);
      }
    }

    // Insert test data if tables already exist
    console.log("\nInserting test data...");

    // Check if properties table exists
    const { data: propertiesExists } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .eq('tablename', 'properties')
      .limit(1);

    if (propertiesExists && propertiesExists.length > 0) {
      console.log("Properties table exists, inserting test property...");
      // Insert test property
      const { data: property, error: propError } = await supabase
        .from('properties')
        .insert([
          {
            name: 'Test Property',
            address: '123 Main St',
            city: 'Toronto',
            province: 'ON',
            postal_code: 'A1A1A1',
            landlord_id: 1
          }
        ])
        .select();

      if (propError) {
        console.log("Error inserting test property:", propError.message);
      } else {
        console.log("Successfully inserted test property:", property);

        // Check if units table exists
        const { data: unitsExists } = await supabase
          .from('pg_tables')
          .select('tablename')
          .eq('schemaname', 'public')
          .eq('tablename', 'units')
          .limit(1);

        if (unitsExists && unitsExists.length > 0) {
          console.log("Units table exists, inserting test unit...");
          // Insert test unit
          const { data: unit, error: unitError } = await supabase
            .from('units')
            .insert([
              {
                unit_number: '101',
                property_id: property ? property[0].id : 1,
                rent_amount: 1500,
                rent_due_day: 1,
                lease_start: '2025-05-01T00:00:00Z'
              }
            ])
            .select();

          if (unitError) {
            console.log("Error inserting test unit:", unitError.message);
          } else {
            console.log("Successfully inserted test unit:", unit);
          }
        } else {
          console.log("Units table does not exist, skipping unit insertion");
        }
      }
    } else {
      console.log("Properties table does not exist, skipping test data insertion");
      console.log("\nYou may need to run the setup_database.sql script in the Supabase SQL Editor first");
    }

    console.log("\nDatabase reset process completed!");

  } catch (error) {
    console.error("An error occurred during database reset:", error);
  }
}

// Run the reset
resetDatabase();
