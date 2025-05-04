/**
 * reset-db-rest-simple.js
 * A simplified script to reset the database using Supabase REST API
 * This approach works without needing PostgreSQL client tools installed
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// For Node.js 18+, use native fetch
// For older Node.js versions, you need to install node-fetch
// Use dynamic import to handle both cases
let fetchFunc;
async function getFetch() {
  if (globalThis.fetch) {
    return globalThis.fetch;
  } else {
    try {
      const nodeFetch = await import('node-fetch');
      return nodeFetch.default;
    } catch (e) {
      console.error("Error loading fetch:", e);
      console.error("Please install node-fetch: npm install node-fetch");
      process.exit(1);
    }
  }
}

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please ensure your .env file contains:');
  console.error('SUPABASE_URL=<your-supabase-url>');
  console.error('SUPABASE_SERVICE_ROLE_KEY=<your-service-key>');
  process.exit(1);
}

// Path to the schema file
const schemaPath = path.resolve(__dirname, '../../../../config/supabase_schema.sql');

// Check if schema file exists
if (!fs.existsSync(schemaPath)) {
  console.error(`Schema file not found at ${schemaPath}`);
  process.exit(1);
}

// SQL to drop all tables
const dropTablesSQL = `
DO $$ 
DECLARE
  r RECORD;
BEGIN
  -- Disable all triggers
  EXECUTE 'SET session_replication_role = replica';
  
  -- Drop all tables in public schema
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
  
  -- Re-enable triggers
  EXECUTE 'SET session_replication_role = DEFAULT';
END $$;
`;

// Read the schema file
const schemaContent = fs.readFileSync(schemaPath, 'utf8');
console.log(`Schema file loaded: ${schemaContent.length} characters`);

// Split the SQL into manageable chunks to avoid timeouts
const MAX_CHUNK_SIZE = 50000; // 50KB per chunk

// Split the SQL into manageable chunks
function splitSqlIntoChunks(sql, maxChunkSize) {
  const chunks = [];
  let currentChunk = '';
  const statements = sql.split(';');

  for (const stmt of statements) {
    const trimmedStmt = stmt.trim();
    if (trimmedStmt === '') continue;

    // If adding this statement would exceed chunk size, start a new chunk
    if (currentChunk.length + trimmedStmt.length + 1 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk + ';');
      currentChunk = '';
    }

    currentChunk += trimmedStmt + ';';
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

const schemaChunks = splitSqlIntoChunks(schemaContent, MAX_CHUNK_SIZE);

// Execute SQL using the Supabase REST API
async function executeSql(sql) {
  const fetch = await getFetch();

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error executing SQL:', error.message);

    // Try the alternative approach with execute_sql function
    try {
      console.log('Trying alternative approach with execute_sql function...');
      await createExecuteSqlFunction();

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ sql_query: sql })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (innerError) {
      console.error('Alternative approach failed:', innerError.message);
      throw innerError;
    }
  }
}

// Create the execute_sql function in Supabase
async function createExecuteSqlFunction() {
  const fetch = await getFetch();

  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION execute_sql(sql_query text) 
    RETURNS text 
    LANGUAGE plpgsql 
    SECURITY DEFINER
    AS $$
    BEGIN
        EXECUTE sql_query;
        RETURN 'SQL executed successfully';
    EXCEPTION
        WHEN OTHERS THEN
            RETURN 'Error: ' || SQLERRM;
    END;
    $$;
  `;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ query: createFunctionSQL })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error creating execute_sql function: ${response.status} ${errorText}`);
    }

    console.log('execute_sql function created successfully');
    return true;
  } catch (error) {
    console.error('Error creating execute_sql function:', error.message);
    return false;
  }
}

// Main function to reset the database
async function resetDatabase() {
  try {
    console.log(`Starting database reset process...`);
    console.log(`Schema will be applied in ${schemaChunks.length} chunks`);

    // Step 1: Drop all tables
    console.log('1. Dropping all tables...');
    await executeSql(dropTablesSQL);
    console.log('Tables dropped successfully!');

    // Step 2: Apply schema in chunks
    console.log('2. Applying schema...');
    for (let i = 0; i < schemaChunks.length; i++) {
      const chunk = schemaChunks[i];
      console.log(`Applying schema chunk ${i + 1}/${schemaChunks.length} (${Math.round(chunk.length / 1024)}KB)...`);
      await executeSql(chunk);
    }

    console.log('Database reset completed successfully!');
  } catch (error) {
    console.error('Database reset failed:', error.message);
    process.exit(1);
  }
}

resetDatabase();
