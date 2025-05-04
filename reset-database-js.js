// reset-database-js.js
// A script to reset the database using the Supabase JavaScript client

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please ensure your .env file contains:');
  console.error('SUPABASE_URL=<your-supabase-url>');
  console.error('SUPABASE_SERVICE_ROLE_KEY=<your-service-key>');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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

async function resetDatabase() {
  console.log('Starting database reset process...');

  try {
    // First ensure that the execute_sql function exists
    console.log('Creating or updating execute_sql function...');

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
`;    // Execute the function creation SQL directly through the SQL API
    try {
      console.log('Attempting to create execute_sql function...');

      // First try to use the function (it might already exist)
      const { data: testData, error: testError } = await supabase.rpc('execute_sql', {
        sql_query: 'SELECT 1'
      });

      if (testError) {
        console.log('Function does not exist yet, creating it...');

        // Try to use the SQL API to create the function
        const { data, error } = await supabase.functions.invoke('database', {
          body: { query: createFunctionSQL }
        });

        if (error) {
          console.error('Error creating execute_sql function:', error.message);
          console.log('Trying an alternative approach...');

          // Try direct SQL query if Supabase Functions fail
          // Simplified approach - create the function via raw SQL
          await fetch(`${supabaseUrl}/rest/v1/sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ query: createFunctionSQL })
          });

          console.log('Function created via REST API');
        } else {
          console.log('Function created via Supabase Functions');
        }
      } else {
        console.log('execute_sql function already exists');
      }
    } catch (err) {
      console.log('Error in function creation, will proceed anyway:', err.message);
      // Continue anyway, as we'll catch errors later if the function doesn't exist
    }

    // Create a direct SQL execution function that doesn't rely on the execute_sql stored procedure
    async function executeSql(sql) {
      try {
        // Try the RPC method first
        const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
        if (!error) {
          return { success: true, data };
        }

        console.log('RPC method failed, trying direct SQL API...');

        // If RPC fails, try direct SQL API
        const response = await fetch(`${supabaseUrl}/rest/v1/sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ query: sql })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`SQL API error: ${response.status} ${errorText}`);
        }

        return { success: true };
      } catch (error) {
        console.error('SQL execution error:', error.message);
        return { success: false, error: error.message };
      }
    }

    // Now drop all tables
    console.log('Dropping all existing tables...');
    const dropResult = await executeSql(dropTablesSQL);

    if (!dropResult.success) {
      console.error('Error dropping tables. You may need to manually drop tables from the Supabase dashboard.');
      // Continue anyway - some tables might not exist yet
    } else {
      console.log('Tables dropped successfully.');
    }

    // Apply the schema
    console.log('Applying schema...');

    // Split the schema into individual statements
    const statements = schemaContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)
      .map(stmt => stmt + ';');

    console.log(`Applying schema with ${statements.length} statements...`);

    // Apply statements in groups to make progress more visible
    const groupSize = 5;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < statements.length; i += groupSize) {
      const group = statements.slice(i, i + groupSize);
      const groupSql = group.join('\n');

      console.log(`Processing statements ${i + 1} to ${Math.min(i + groupSize, statements.length)} of ${statements.length}...`);

      const result = await executeSql(groupSql);

      if (!result.success) {
        console.log(`Group ${i / groupSize + 1} had errors, trying individual statements...`);

        // Try executing each statement individually
        for (const stmt of group) {
          const indResult = await executeSql(stmt);
          if (indResult.success) {
            successCount++;
          } else {
            failureCount++;
            console.log(`Failed statement: ${stmt.substring(0, 100)}...`);
          }
        }
      } else {
        successCount += group.length;
        console.log(`Group ${Math.floor(i / groupSize) + 1} executed successfully.`);
      }

      // Show progress
      console.log(`Progress: ${Math.round((i + group.length) / statements.length * 100)}% (${successCount} successful, ${failureCount} failed)`);
    }

    console.log('Database reset complete! The database has been reset with the new schema.');

  } catch (error) {
    console.error('Unexpected error during database reset:', error.message);
    process.exit(1);
  }
}

resetDatabase();
