# Database Reset Solutions for RentWhisperer

Here's a summary of the solutions created to reset the RentWhisperer database:

## Solution 1: Using PostgreSQL Client (psql)

If the PostgreSQL client is installed locally:

1. **PowerShell Script**: `.\packages\backend\src\scripts\Reset-Database.ps1`
   - Connects directly to the Supabase PostgreSQL database
   - Uses the SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to construct the database URL

2. **Node.js Script**: `node packages/backend/src/scripts/reset-database.js`
   - Uses the same approach but via JavaScript
   - Executes psql commands through Node.js

## Solution 2: Using REST API (No PostgreSQL Client Required)

When PostgreSQL client isn't installed:

1. **Node.js REST API Script**: `node packages/backend/src/scripts/reset-db-rest-simple.js`
   - Uses fetch to make REST API calls to Supabase
   - Handles chunk splitting to avoid timeouts with large SQL files
   - Attempts to create and use execute_sql function as a fallback
   - **Note**: Currently hitting 404 errors on Supabase SQL endpoints (might require enabling SQL API on Supabase)

2. **PowerShell REST API Script**: `.\packages\backend\src\scripts\Reset-Database-REST.ps1`
   - Similar approach using PowerShell's Invoke-RestMethod
   - Also handles chunk splitting

## Solution 3: Smart Detection (Auto-selects Best Method)

1. **Smart Reset Script**: `.\packages\backend\src\scripts\Smart-Reset-Database.ps1`
   - Automatically detects if PostgreSQL client (psql) is installed
   - Selects the appropriate method based on what's available
   - Falls back to REST API approach if PostgreSQL client isn't available

## Environment Setup

All scripts have been updated to:
1. Check multiple locations for .env files
2. Prioritize Supabase credentials (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
3. Provide clear error messages when credentials are missing
4. Support both direct database connections and REST API approaches

## Next Steps for Troubleshooting

If you're still experiencing issues with the database reset:

1. **Check Supabase SQL API Access**:
   - Ensure SQL API is enabled on your Supabase project
   - Check if the execute_sql function can be created and called
   - Review Supabase permissions and settings

2. **Try Direct PostgreSQL Connection**:
   - Install PostgreSQL client tools locally if possible
   - Use the direct connection method which is more reliable

3. **Check Credentials**:
   - Verify that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct in your .env file
   - Ensure that the service role key has sufficient permissions

4. **Consider Chunk Size**:
   - If timeouts occur with large schema files, reduce the MAX_CHUNK_SIZE constant
   - Split large operations into smaller transactions
