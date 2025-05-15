#!/usr/bin/env node

/**
 * Script to apply the master schema for RentWhisperer using the Supabase JS client
 * This will apply schema changes using the execute_sql function in Supabase
 * Modified to apply the main schema in chunks for debugging with improved splitting.
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Get paths
const schemaPath = path.resolve(__dirname, '../../../../config/supabase_schema.sql');

console.log('Applying master database schema using Supabase JS client (chunked, improved splitter)...');
console.log(`Using schema file: ${schemaPath}`);

// Check if file exists
if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found at ${schemaPath}`);
  process.exit(1);
}

// Read the schema file
const schemaFileContent = fs.readFileSync(schemaPath, 'utf8');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[DEBUG] SUPABASE_URL from env:', supabaseUrl ? 'Loaded' : 'NOT LOADED');
console.log('[DEBUG] SUPABASE_SERVICE_ROLE_KEY from env:', supabaseServiceKey ? 'Loaded' : 'NOT LOADED');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase credentials not found in environment variables.');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Create Supabase client with service role key (to bypass RLS)
console.log('[DEBUG] Initializing Supabase client...');
const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log('[DEBUG] Supabase client initialized.');

const rlsFixSql = `
ALTER TABLE IF EXISTS tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenant_units DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS units DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS landlords DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rent_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS incoming_messages DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;
`;

const grantPermissionsSql = `
DO $$
BEGIN
  IF current_user = 'postgres' THEN
    ALTER SCHEMA public OWNER TO postgres;
    GRANT ALL ON SCHEMA public TO postgres;
    RAISE NOTICE 'Ensured postgres user owns and has all privileges on public schema.';
  ELSE
    RAISE WARNING 'Current user is not postgres. Schema ownership and privileges might need manual adjustment for user: %', current_user;
  END IF;
END
$$;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
`;

// Function to split SQL script into executable statements/blocks
function splitSqlCommands(sqlScript) {
  const statements = [];
  let remainingScript = sqlScript.trim();

  while (remainingScript.length > 0) {
    remainingScript = remainingScript.trim();
    // Skip empty lines or comments
    if (remainingScript.startsWith('--')) {
      const nextNewline = remainingScript.indexOf('\n');
      if (nextNewline === -1) break;
      remainingScript = remainingScript.substring(nextNewline + 1);
      continue;
    }
    if (remainingScript.length === 0) break;

    let stmtEnd = -1;
    const upperScript = remainingScript.toUpperCase();

    if (upperScript.startsWith('DO $$')) {
      stmtEnd = remainingScript.indexOf('END; $$;'); // Note: this specific schema uses 'END; $$;'
      if (stmtEnd !== -1) {
        stmtEnd += 'END; $$;'.length;
      } else { // Fallback if slightly different formatting
        stmtEnd = remainingScript.indexOf('$$;');
        if (stmtEnd !== -1 && remainingScript.substring(0, stmtEnd).toUpperCase().includes('END')) {
          stmtEnd += '$$;'.length;
        } else {
          stmtEnd = -1; // Reset if not a clear block end
        }
      }
    } else if (upperScript.startsWith('CREATE OR REPLACE FUNCTION')) {
      let functionEndMarker = -1;
      const langPlpgsqlKeyword = 'LANGUAGE PLPGSQL';
      // Case-insensitive search for "LANGUAGE PLPGSQL"
      const langPlpgsqlIndex = upperScript.indexOf(langPlpgsqlKeyword);

      if (langPlpgsqlIndex !== -1) {
        // Found "LANGUAGE PLPGSQL". Now find the semicolon that terminates this clause or the whole statement.
        // This search should start *after* "LANGUAGE PLPGSQL" to find the true end semicolon.
        const searchFromIndex = langPlpgsqlIndex + langPlpgsqlKeyword.length;
        const semicolonAfterLang = remainingScript.indexOf(';', searchFromIndex);
        if (semicolonAfterLang !== -1) {
          functionEndMarker = semicolonAfterLang + 1; // Include the semicolon
        }
      } else {
        // Fallback for functions that might not use "LANGUAGE PLPGSQL" but use "END; $$;"
        // This is less common for CREATE FUNCTION but included for robustness if schema changes.
        const endDollarDollarSemicolonIndex = remainingScript.indexOf('END; $$;');
        if (endDollarDollarSemicolonIndex !== -1) {
          // Check if this 'END; $$;' is likely part of a function body (e.g., contains AS $$)
          const blockUpToMarker = remainingScript.substring(0, endDollarDollarSemicolonIndex).toUpperCase();
          if (blockUpToMarker.includes('AS $$') || (blockUpToMarker.includes('BEGIN') && blockUpToMarker.includes('END'))) {
            functionEndMarker = endDollarDollarSemicolonIndex + 'END; $$;'.length;
          }
        }
      }

      if (functionEndMarker !== -1) {
        stmtEnd = functionEndMarker;
      } else {
        // If no specific language marker or 'END; $$;' found, this indicates a
        // function structure not handled well by this simplified parser.
        console.warn("[splitSqlCommands] Could not reliably determine end for function (using generic semicolon search): " + remainingScript.substring(0, 150) + "...");
        // Fallback to a simple semicolon search if specific markers aren't found.
        let genericSemicolonEnd = remainingScript.indexOf(';');
        if (genericSemicolonEnd !== -1) {
          stmtEnd = genericSemicolonEnd + 1;
        }
      }
    }

    if (stmtEnd !== -1) {
      statements.push(remainingScript.substring(0, stmtEnd));
      remainingScript = remainingScript.substring(stmtEnd);
    } else {
      // Simple statement, find next semicolon
      stmtEnd = remainingScript.indexOf(';');
      if (stmtEnd !== -1) {
        statements.push(remainingScript.substring(0, stmtEnd + 1));
        remainingScript = remainingScript.substring(stmtEnd + 1);
      } else {
        if (remainingScript.trim().length > 0) statements.push(remainingScript);
        break;
      }
    }
  }
  return statements.map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
}


async function applySchemaInChunks() {
  try {
    console.log('Connecting to Supabase...');

    const dropTablesSql = `
DO $$
DECLARE
    r RECORD;
BEGIN
    EXECUTE 'SET session_replication_role = replica';
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    FOR r IN (SELECT routine_name FROM information_schema.routines WHERE specific_schema = 'public' AND routine_type = 'FUNCTION') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.routine_name) || ' CASCADE';
    END LOOP;
    EXECUTE 'SET session_replication_role = DEFAULT';
END $$;
`;
    try {
      console.log('[DEBUG] Attempting to drop tables and functions using existing execute_sql (if any)...');
      const { data: dropData, error: dropError } = await supabase.rpc('execute_sql', { sql: dropTablesSql });
      if (dropError) {
        console.warn(`[WARN] Error during initial drop tables/functions (execute_sql might not exist yet or failed): ${dropError.message}`);
      } else {
        console.log('Drop tables/functions attempt completed. Result:', dropData);
      }
    } catch (e) {
      console.warn(`[WARN] RPC call to execute_sql for dropping failed. This might be okay if execute_sql doesn't exist yet. Error: ${e.message}`);
    }

    console.log('[INFO] Applying main schema (config/supabase_schema.sql) in chunks...');
    const schemaStatements = splitSqlCommands(schemaFileContent);

    console.log(`[INFO] Split schema into ${schemaStatements.length} statements.`);

    for (let i = 0; i < schemaStatements.length; i++) {
      const stmt = schemaStatements[i];
      console.log(`[DEBUG] Applying schema statement ${i + 1}/${schemaStatements.length}:`);
      console.log(stmt.substring(0, 200) + (stmt.length > 200 ? '...' : ''));

      const { data: stmtData, error: stmtError } = await supabase.rpc('execute_sql', { sql: stmt });

      if (stmtError || stmtData === false) {
        console.error(`[ERROR] Failed to apply statement ${i + 1}:`);
        console.error("Statement content:", stmt);
        if (stmtError) {
          console.error('[DEBUG] Statement error object:', JSON.stringify(stmtError, null, 2));
          if (stmtError.message && stmtError.message.includes("function public.execute_sql(sql => text) does not exist")) {
            console.error("[FATAL] `execute_sql` function does not exist. It must be created by an earlier part of the schema or manually in Supabase Studio.");
            throw new Error("`execute_sql` function not found. Cannot proceed.");
          }
        } else {
          console.error('[INFO] execute_sql returned false, indicating an exception within the function for this statement.');
        }
        throw new Error(`Failed at statement ${i + 1}. Check server logs for SQLERRM from execute_sql. See statement and error above.`);
      } else {
        console.log(`[SUCCESS] Statement ${i + 1} applied. Result: ${stmtData}`);
      }
    }
    console.log('[INFO] All schema statements from config/supabase_schema.sql applied successfully chunk by chunk!');

    console.log('[DEBUG] Preparing to call execute_sql for RLS fix.');
    const { data: rlsData, error: rlsError } = await supabase.rpc('execute_sql', { sql: rlsFixSql });
    if (rlsError || rlsData === false) {
      console.error(`[ERROR] Error during RLS fix SQL execution: ${rlsError ? rlsError.message : 'execute_sql returned false'}`);
      if (rlsError) console.error('[DEBUG] RLS fix error object:', JSON.stringify(rlsError, null, 2));
      throw new Error("Failed during RLS fix.");
    } else {
      console.log('RLS fix SQL executed successfully. Result:', rlsData);
    }

    console.log('[DEBUG] Preparing to call execute_sql for permission grants.');
    const { data: permData, error: permError } = await supabase.rpc('execute_sql', { sql: grantPermissionsSql });
    if (permError || permData === false) {
      console.error(`[ERROR] Error during initial permission grant: ${permError ? permError.message : 'execute_sql returned false'}`);
      if (permError) console.error('[DEBUG] Permission grant error object:', JSON.stringify(permError, null, 2));
      throw new Error("Failed during permission grants.");
    } else {
      console.log('Initial permission grants SQL executed. Result:', permData);
    }

    console.log('Testing connection to Supabase after all changes...');
    const { error: testError } = await supabase.from('units').select('id').limit(1);
    if (testError) {
      console.error(`Connection test (select from units) failed: ${testError.message}. Schema might not be fully applied.`);
      throw new Error("Post-schema connection test failed.");
    } else {
      console.log('Connection test (select from units) successful.');
    }

    console.log('\n✅ Database reset and schema application (chunked) complete!');

  } catch (error) {
    console.error('Error in applySchemaInChunks:', error.message);
    process.exit(1);
  }
}

applySchemaInChunks();
