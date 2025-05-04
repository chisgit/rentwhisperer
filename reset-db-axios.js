// reset-db-axios.js
// A script to reset the database using the Supabase REST API with Axios

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

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
const schemaPath = path.resolve(__dirname, './config/supabase_schema.sql');

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
const MAX_CHUNK_SIZE = 50000; // 50KB per chunk

// Split the SQL into manageable chunks
function splitSqlIntoChunks(sql, maxChunkSize) {
  const chunks = [];
  let currentChunk = '';
  const statements = sql.split(';');

  for (const stmt of statements) {
    if (stmt.trim() === '') continue;

    // If adding this statement would exceed chunk size, start a new chunk
    if (currentChunk.length + stmt.length + 1 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk + ';');
      currentChunk = '';
    }

    currentChunk += stmt + ';';
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

const schemaChunks = splitSqlIntoChunks(schemaContent, MAX_CHUNK_SIZE);

// Axios instance with pre-configured headers
const api = axios.create({
  baseURL: supabaseUrl,
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  }
});

async function resetDatabase() {
  console.log(`Starting database reset process...`);
  console.log(`Using Supabase URL: ${supabaseUrl}`);
  console.log(`Schema will be applied in ${schemaChunks.length} chunks`);

  try {
    // First check if we can create the execute_sql function to use
    console.log('Creating execute_sql function...');

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
      await api.post('/rest/v1/rpc/execute_sql', {
        sql_query: 'SELECT 1'
      });
      console.log('Execute SQL function already exists');
    } catch (error) {
      console.log('Creating execute_sql function...');
      try {
        // Try using the PostgreSQL format
        await api.post('/rest/v1/sql', {
          query: createFunctionSQL
        });
        console.log('Execute SQL function created via PostgreSQL format');
      } catch (error) {
        console.log('Could not create function via SQL endpoint, trying direct format');

        // Try using the pgSQL service
        try {
          await api.post('/pg/sql', createFunctionSQL);
          console.log('Execute SQL function created via pgSQL endpoint');
        } catch (fnError) {
          console.error('Failed to create execute_sql function, continuing anyway');
        }
      }
    }

    // Step 1: Drop all tables
    console.log('1. Dropping all tables...');

    try {
      await api.post('/rest/v1/rpc/execute_sql', {
        sql_query: dropTablesSQL
      });
      console.log('Tables dropped successfully using execute_sql function!');
    } catch (error) {
      console.log('Could not use execute_sql function, trying SQL endpoint directly');

      try {
        // Try using the PostgreSQL format
        await api.post('/rest/v1/sql', {
          query: dropTablesSQL
        });
        console.log('Tables dropped successfully using SQL endpoint with query format!');
      } catch (sqlError1) {
        try {
          // Try using the pgSQL service
          await api.post('/pg/sql', dropTablesSQL);
          console.log('Tables dropped successfully using pgSQL endpoint!');
        } catch (sqlError2) {
          console.error('Failed to drop tables:');
          if (sqlError2.response) {
            console.error(`Status: ${sqlError2.response.status}`);
            console.error('Response:', sqlError2.response.data);
          } else {
            console.error(sqlError2.message);
          }
          process.exit(1);
        }
      }
    }

    // Step 2: Apply schema in chunks
    console.log('2. Applying schema...');

    for (let i = 0; i < schemaChunks.length; i++) {
      const chunk = schemaChunks[i];
      console.log(`Applying schema chunk ${i + 1}/${schemaChunks.length} (${Math.round(chunk.length / 1024)}KB)...`);

      try {
        // First try using the execute_sql function
        await api.post('/rest/v1/rpc/execute_sql', {
          sql_query: chunk
        });
        console.log(`Schema chunk ${i + 1} applied successfully using execute_sql function`);
      } catch (error) {
        try {
          // Try using the PostgreSQL format
          await api.post('/rest/v1/sql', {
            query: chunk
          });
          console.log(`Schema chunk ${i + 1} applied successfully using SQL endpoint with query format`);
        } catch (sqlError1) {
          try {
            // Try using the pgSQL service
            await api.post('/pg/sql', chunk);
            console.log(`Schema chunk ${i + 1} applied successfully using pgSQL endpoint`);
          } catch (sqlError2) {
            console.error(`Error applying schema chunk ${i + 1}:`);
            if (sqlError2.response) {
              console.error(`Status: ${sqlError2.response.status}`);
              console.error('Response:', sqlError2.response.data);
            } else {
              console.error(sqlError2.message);
            }
            process.exit(1);
          }
        }
      }
    }

    console.log('Database reset complete! The database has been wiped and recreated.');

  } catch (error) {
    console.error('Unexpected error during database reset:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
      console.error(error.message);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

resetDatabase();
