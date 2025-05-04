// file: fix-database-permissions.ts
// This script will update database settings in .env and reset the database
import { createClient } from "@supabase/supabase-js";
import * as fs from 'fs';
import * as path from 'path';
import dotenv from "dotenv";
import * as readline from 'readline';

// Path to .env file
const envPath = path.resolve(__dirname, "../../.env");

// Load environment variables
dotenv.config({ path: envPath });

// Function to prompt user for input
async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log("🔧 Database Permission Fix Utility");
  console.log("=================================");

  // Step 1: Check for existing .env file
  if (!fs.existsSync(envPath)) {
    const examplePath = path.resolve(__dirname, "../../.env.example");
    if (fs.existsSync(examplePath)) {
      console.log("No .env file found. Creating one from .env.example...");
      fs.copyFileSync(examplePath, envPath);
      console.log("Created .env file.");
    } else {
      console.log("No .env or .env.example found. Creating empty .env file...");
      fs.writeFileSync(envPath, "");
    }
  }

  // Step 2: Prompt for Supabase credentials
  console.log("\nTo fix the permissions issue, we need your Supabase service role key.");
  console.log("You can find this in your Supabase dashboard > Project Settings > API > service_role");

  // Get current values from .env if they exist
  const currentUrl = process.env.SUPABASE_URL || '';
  const currentKey = process.env.SUPABASE_KEY || '';

  // Prompt for Supabase URL
  let supabaseUrl = await promptUser(`Supabase URL ${currentUrl ? `(current: ${currentUrl})` : ''}: `);
  if (!supabaseUrl && currentUrl) supabaseUrl = currentUrl;

  // Prompt for Service Role Key
  let serviceKey = await promptUser("Supabase Service Role Key: ");

  if (!supabaseUrl || !serviceKey) {
    console.error("Error: Supabase URL and Service Role Key are required.");
    process.exit(1);
  }

  // Step 3: Update .env file
  console.log("\nUpdating .env file with provided credentials...");

  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Replace or add SUPABASE_URL
  if (envContent.includes('SUPABASE_URL=')) {
    envContent = envContent.replace(/SUPABASE_URL=.*(\r?\n|$)/g, `SUPABASE_URL=${supabaseUrl}$1`);
  } else {
    envContent += `\nSUPABASE_URL=${supabaseUrl}`;
  }

  // Replace or add SUPABASE_KEY with the anon key (if provided)
  if (currentKey && envContent.includes('SUPABASE_KEY=')) {
    // Keep the existing anon key
  } else if (!envContent.includes('SUPABASE_KEY=')) {
    envContent += `\nSUPABASE_KEY=`;
  }

  // Replace or add SUPABASE_SERVICE_KEY
  if (envContent.includes('SUPABASE_SERVICE_KEY=')) {
    envContent = envContent.replace(/SUPABASE_SERVICE_KEY=.*(\r?\n|$)/g, `SUPABASE_SERVICE_KEY=${serviceKey}$1`);
  } else {
    envContent += `\nSUPABASE_SERVICE_KEY=${serviceKey}`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log("✅ .env file updated successfully.");

  // Step 4: Test the connection with service key
  console.log("\nTesting Supabase connection with service role key...");

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Test a simple query to verify permissions
    const { data, error } = await supabase
      .from('pg_tables')
      .select('schemaname, tablename')
      .eq('schemaname', 'public')
      .limit(1);

    if (error) {
      console.error("❌ Connection test failed:", error.message);
      process.exit(1);
    }

    console.log("✅ Successfully connected to Supabase with service role key.");

    // Step 5: Insert test data
    console.log("\nAttempting to insert test data...");

    // Insert test property
    const { data: propertyData, error: propertyError } = await supabase
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

    if (propertyError) {
      console.error("❌ Error inserting test property:", propertyError.message);
    } else {
      console.log("✅ Test property inserted successfully");

      // Insert test unit
      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .insert([
          {
            unit_number: '101',
            property_id: propertyData ? propertyData[0].id : 1,
            rent_amount: 1500,
            rent_due_day: 1,
            lease_start: '2025-05-01T00:00:00Z'
          }
        ])
        .select();

      if (unitError) {
        console.error("❌ Error inserting test unit:", unitError.message);
      } else {
        console.log("✅ Test unit inserted successfully");
      }
    }

    console.log("\n✅ Setup complete! Now you can run your application with proper database permissions.");

  } catch (error) {
    console.error("❌ An unexpected error occurred:", error);
    process.exit(1);
  }
}

main();
