// reset-db-rest.js
// A script to reset the database using the Supabase REST API

require('dotenv').config();
const fs = require('fs');
const path = require('path');
// For Node.js >=18, use the native fetch
// For older Node.js versions, import fetch properly from node-fetch v3
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

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

// Read the schema file - we'll apply in smaller chunks to avoid timeouts
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

async function resetDatabase() {
  console.log(`Starting database reset process...`);
  console.log(`Schema will be applied in ${schemaChunks.length} chunks`);
  try {
    // Step 1: Drop all tables
    console.log('1. Dropping all tables...');
    console.log(`Connecting to Supabase URL: ${supabaseUrl}`);

    const requestUrl = `${supabaseUrl}/rest/v1/sql`;
    console.log(`Making request to: ${requestUrl}`); const dropResponse = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ query: dropTablesSQL })
    });

    if (!dropResponse.ok) {
      const errorText = await dropResponse.text();
      console.error(`Error dropping tables: ${dropResponse.status} ${errorText}`);
      process.exit(1);
    }

    console.log('Tables dropped successfully!');

    // Step 2: Apply schema in chunks
    console.log('2. Applying schema...');

    for (let i = 0; i < schemaChunks.length; i++) {
      const chunk = schemaChunks[i];
      console.log(`Applying schema chunk ${i + 1}/${schemaChunks.length} (${Math.round(chunk.length / 1024)}KB)...`); const schemaResponse = await fetch(`${supabaseUrl}/rest/v1/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Prefer': 'params=single-object',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ query: chunk })
      });

      if (!schemaResponse.ok) {
        const errorText = await schemaResponse.text();
        console.error(`Error applying schema chunk ${i + 1}: ${schemaResponse.status} ${errorText}`);
        console.error(`Failed on chunk starting with: ${chunk.substring(0, 100)}...`);
        process.exit(1);
      }

      console.log(`Schema chunk ${i + 1} applied successfully`);
    }

    console.log('Database reset complete! The database has been wiped and recreated.');
  } catch (error) {
    console.error('Unexpected error during database reset:');
    console.error(error);

    if (error.code === 'ENOTFOUND') {
      console.error(`\nCould not connect to ${supabaseUrl}. Please check your SUPABASE_URL.`);
    }
    else if (error.code === 'ERR_INVALID_URL') {
      console.error(`\nInvalid URL: ${supabaseUrl}. Please check your SUPABASE_URL format.`);
    }

    process.exit(1);
  }
}

resetDatabase();
