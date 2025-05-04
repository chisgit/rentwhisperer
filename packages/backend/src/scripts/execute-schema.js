// Execute SQL script for Supabase
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Read the SQL file
const sqlFile = path.resolve(__dirname, '../../config/supabase_schema.sql');
const sqlContent = fs.readFileSync(sqlFile, 'utf8');

async function executeSql() {
  try {
    console.log('Executing SQL schema...');

    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': `${supabaseKey}`,
        'X-Client-Info': 'supabase-js/1.0.0',
      },
      body: JSON.stringify({
        query: sqlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('SQL execution failed:', errorData);
      process.exit(1);
    }

    const result = await response.json();
    console.log('SQL executed successfully:', result);

    console.log('Database schema setup complete!');
  } catch (error) {
    console.error('Error executing SQL:', error);
    process.exit(1);
  }
}

executeSql();
