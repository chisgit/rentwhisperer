// Reset Supabase database script - simplified approach
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

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
    console.log("Testing connection to Supabase with service role key...");
    const { data, error: connectionError } = await supabase.from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .limit(1);

    if (connectionError) {
      console.error("Failed to connect to Supabase:", connectionError);
      process.exit(1);
    }
    console.log("Successfully connected to Supabase!");
    console.log("Found tables:", data);

    // Drop tables/records if they exist
    console.log("Clearing existing data...");

    try {
      console.log("Clearing notifications table...");
      const { error: notifError } = await supabase.from('notifications').delete();
      if (notifError) console.log("Error or table doesn't exist:", notifError.message);

      console.log("Clearing rent_payments table...");
      const { error: paymentsError } = await supabase.from('rent_payments').delete();
      if (paymentsError) console.log("Error or table doesn't exist:", paymentsError.message);

      console.log("Clearing incoming_messages table...");
      const { error: messagesError } = await supabase.from('incoming_messages').delete();
      if (messagesError) console.log("Error or table doesn't exist:", messagesError.message);

      console.log("Clearing tenants table...");
      const { error: tenantsError } = await supabase.from('tenants').delete();
      if (tenantsError) console.log("Error or table doesn't exist:", tenantsError.message);

      console.log("Clearing units table...");
      const { error: unitsError } = await supabase.from('units').delete();
      if (unitsError) console.log("Error or table doesn't exist:", unitsError.message);

      console.log("Clearing properties table...");
      const { error: propertiesError } = await supabase.from('properties').delete();
      if (propertiesError) console.log("Error or table doesn't exist:", propertiesError.message);

      console.log("Clearing landlords table...");
      const { error: landlordsError } = await supabase.from('landlords').delete();
      if (landlordsError) console.log("Error or table doesn't exist:", landlordsError.message);
    } catch (error) {
      console.log("Error during data clearing, continuing with setup:", error);
    }

    // Create tables manually
    console.log("Creating tables...");

    // Create properties table
    console.log("Creating properties table...");
    const { error: propTableError } = await supabase.rpc('create_table_if_not_exists', {
      p_table_name: 'properties',
      p_table_definition: `
        id serial primary key,
        name text not null,
        address text not null,
        city text not null,
        province text not null,
        postal_code text not null,
        landlord_id integer not null,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null
      `
    });

    if (propTableError) {
      console.log("Error creating properties table with RPC:", propTableError);
      console.log("Falling back to direct creation...");
      try {
        await createPropertiesTable();
      } catch (err) {
        console.log("Failed to create properties table:", err);
      }
    }

    // Create units table
    console.log("Creating units table...");
    const { error: unitsTableError } = await supabase.rpc('create_table_if_not_exists', {
      p_table_name: 'units',
      p_table_definition: `
        id serial primary key,
        unit_number text not null,
        property_id integer not null references public.properties(id),
        rent_amount numeric not null,
        rent_due_day integer not null,
        lease_start timestamp with time zone not null,
        lease_end timestamp with time zone,
        created_at timestamp with time zone default now() not null,
        updated_at timestamp with time zone default now() not null
      `
    });

    if (unitsTableError) {
      console.log("Error creating units table with RPC:", unitsTableError);
      console.log("Falling back to direct creation...");
      try {
        await createUnitsTable();
      } catch (err) {
        console.log("Failed to create units table:", err);
      }
    }

    // Insert test data
    console.log("Inserting test data...");

    // Insert test property
    console.log("Inserting test property...");
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

      // Insert test unit
      console.log("Inserting test unit...");
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
    }

    console.log("Database reset process completed!");

  } catch (error) {
    console.error("An error occurred during database reset:", error);
  }
}

// Helper function to create properties table
async function createPropertiesTable() {
  const { error } = await supabase
    .schema('public')
    .createTable('properties', [
      { name: 'id', type: 'serial', primaryKey: true },
      { name: 'name', type: 'text', notNull: true },
      { name: 'address', type: 'text', notNull: true },
      { name: 'city', type: 'text', notNull: true },
      { name: 'province', type: 'text', notNull: true },
      { name: 'postal_code', type: 'text', notNull: true },
      { name: 'landlord_id', type: 'integer', notNull: true },
      { name: 'created_at', type: 'timestamp with time zone', notNull: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', notNull: true, default: 'now()' }
    ]);

  if (error) {
    throw error;
  }
  return true;
}

// Helper function to create units table
async function createUnitsTable() {
  const { error } = await supabase
    .schema('public')
    .createTable('units', [
      { name: 'id', type: 'serial', primaryKey: true },
      { name: 'unit_number', type: 'text', notNull: true },
      { name: 'property_id', type: 'integer', notNull: true, references: 'properties.id' },
      { name: 'rent_amount', type: 'numeric', notNull: true },
      { name: 'rent_due_day', type: 'integer', notNull: true },
      { name: 'lease_start', type: 'timestamp with time zone', notNull: true },
      { name: 'lease_end', type: 'timestamp with time zone' },
      { name: 'created_at', type: 'timestamp with time zone', notNull: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', notNull: true, default: 'now()' }
    ]);

  if (error) {
    throw error;
  }
  return true;
}

// Run the reset
resetDatabase();
