const path = require("path");
const dotenv = require("dotenv");

// Load .env file from packages/backend/.env
const envPath = path.resolve(__dirname, "../../.env");
console.log(`[test-role-permissions.js] Attempting to load .env from: ${envPath}`);
const dotenvResult = dotenv.config({ path: envPath });

if (dotenvResult.error) {
  console.error('[test-role-permissions.js] Error loading .env file:', dotenvResult.error);
} else {
  console.log('[test-role-permissions.js] .env file loaded successfully.');
}

// Ensure this import is AFTER dotenv.config
const { supabase, supabaseAdmin } = require("../../dist/config/database"); // Adjusted path

async function testClientPermissions(clientName, clientInstance) {
  console.log(`\n--- Testing permissions for: ${clientName} ---`);
  try {
    // Attempt to select a single row from the 'tenants' table.
    // This is a common table and should exist if the schema was applied.
    const { data, error } = await clientInstance
      .from("tenants")
      .select("id")
      .limit(1);

    if (error) {
      console.error(`[${clientName}] Error during test query:`, error.message);
      console.error(`[${clientName}] Full error object:`, JSON.stringify(error, null, 2));
      return false;
    }

    console.log(`[${clientName}] Test query successful.`);
    console.log(`[${clientName}] Data (or null if table empty):`, data);
    return true;
  } catch (e) {
    console.error(`[${clientName}] Exception during test query:`, e.message);
    console.error(`[${clientName}] Full exception object:`, JSON.stringify(e, null, 2));
    return false;
  }
}

async function runTests() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error("[test-role-permissions.js] SUPABASE_URL or SUPABASE_ANON_KEY not found in process.env. Ensure .env is loaded correctly.");
    return;
  }
  console.log("[test-role-permissions.js] Supabase URL and Anon Key seem to be loaded.");
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("[test-role-permissions.js] Supabase Service Role Key also seems to be loaded.");
  } else {
    console.warn("[test-role-permissions.js] SUPABASE_SERVICE_ROLE_KEY NOT FOUND in process.env. The 'supabaseAdmin' client might be using the anon key.");
  }


  console.log("\nInitializing clients for testing (this will re-log client init messages from database.ts)...");
  // The clients are already initialized when database.ts is required,
  // but this log helps confirm the script is proceeding.

  const anonTestSuccess = await testClientPermissions("supabase (anon role)", supabase);
  const adminTestSuccess = await testClientPermissions("supabaseAdmin (service_role)", supabaseAdmin);

  console.log("\n--- Test Summary ---");
  console.log(`Anon Role Client Test: ${anonTestSuccess ? "PASSED" : "FAILED"}`);
  console.log(`Service Role Client Test: ${adminTestSuccess ? "PASSED" : "FAILED"}`);

  if (!adminTestSuccess && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("The service role client test failed, and the SUPABASE_SERVICE_ROLE_KEY was not loaded. This is expected if the key is missing.");
  }
}

runTests().catch(e => console.error("Unhandled error in runTests:", e));
