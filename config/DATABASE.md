# Database Schema Management

This document explains how to manage the database schema for the RentWhisperer application.

## Overview

The database schema is defined in a single SQL file:

```
/config/supabase_schema.sql
```

This file contains all tables, functions, triggers, policies, and other database objects needed for the application. It has been consolidated from multiple separate SQL files to simplify management and deployment.

## Resetting the Database

We've implemented multiple ways to reset the database to suit different environments and requirements. The smart reset script will automatically choose the best method based on your environment.

### Smart Reset (Recommended)

This automatically selects whether to use PostgreSQL client or REST API based on what's available:

```powershell
# From packages/backend directory
.\src\scripts\Smart-Reset-Database.ps1
```

### Option 1: Using NPM Scripts

Run the following command from the project root:

```bash
npm run reset-database
```

This will drop all tables and recreate the schema using the database configuration from the backend `.env` file.

### Option 2: Using the JavaScript Script Directly (With PostgreSQL Client)

```bash
node packages/backend/src/scripts/reset-database.js
```

### Option 3: Using REST API (No PostgreSQL Client Required)

This option works even if you don't have the PostgreSQL client installed:

```bash
# Using the REST API JavaScript approach
node packages/backend/src/scripts/reset-db-rest-simple.js

# Or using the PowerShell REST API approach
.\packages\backend\src\scripts\Reset-Database-REST.ps1
```

### Option 4: Using PowerShell (Requires PostgreSQL Client)

```powershell
# Standard PowerShell script (uses psql)
.\packages\backend\src\scripts\Reset-Database.ps1
```

```powershell
.\ResetDatabase.ps1
```

This all-in-one script will:
1. Load environment variables from your .env file
2. Construct a DATABASE_URL from your Supabase credentials
3. Drop all tables in the public schema
4. Apply the master schema

You can run this script from either the root directory or the backend directory.

### Option 5: Using the Simple REST API Script (RECOMMENDED)

```bash
npm run reset-db-simple
```

This simplified script uses the Supabase REST API with Axios, making it the most reliable option when you don't have PostgreSQL tools installed. It:
1. Connects to Supabase using the REST API
2. Drops all tables in the public schema
3. Applies the schema in one go
4. Provides clear progress information

This is the RECOMMENDED approach if you don't have PostgreSQL tools installed or are experiencing issues with other methods.

### Option 6: Using the Two-Step JavaScript Approach

For a two-step approach using separate JavaScript scripts:

```bash
# Step 1: Drop all tables
npm run drop-tables

# Step 2: Apply the schema
npm run apply-schema
```

This approach separates the process into two distinct steps:
1. First, drop all tables using the Supabase REST API
2. Then, apply the schema using your existing apply-schema script

**Warning**: This will delete all data in the database. Use with caution, especially in production environments.

### Database Connection Issues

If you encounter errors related to missing DATABASE_URL environment variables, use the `set-db-url.ps1` script to configure it from your Supabase credentials:

```powershell
.\packages\backend\src\scripts\set-db-url.ps1
```

This script will:
1. Read your Supabase credentials from the .env file
2. Construct a proper DATABASE_URL from these credentials
3. Set it as an environment variable for the current session

## Applying the Schema

There are multiple ways to apply the schema without dropping existing tables:

### Option 1: Using NPM Scripts

Run the following command from the project root:

```bash
npm run apply-schema
```

This will apply the schema using the database configuration from the backend `.env` file.

### Option 2: Using the JavaScript Script Directly

```bash
node packages/backend/src/scripts/apply-master-schema.js
```

### Option 3: Using PowerShell (Windows)

```powershell
.\packages\backend\src\scripts\Apply-MasterSchema.ps1
```

### Option 4: Direct Database Access

If you have direct access to the Supabase SQL editor:

1. Open the SQL editor in the Supabase dashboard
2. Copy the contents of `config/supabase_schema.sql`
3. Paste into the editor and execute

## Schema Structure

The schema includes:

1. **Tables**:
   - landlords
   - properties
   - units
   - tenants
   - tenant_units (junction table for many-to-many relationship)
   - rent_payments
   - notifications
   - incoming_messages

2. **Functions**:
   - update_updated_at_column(): Automatically updates timestamps
   - update_tenant_direct(): Directly updates tenant records when ORM updates fail
   - execute_sql(): Utility to execute raw SQL (use with caution)

3. **Indexes**: Various indexes for performance optimization

4. **Row Level Security (RLS)**: Security policies for all tables

5. **Triggers**: Automatic timestamp updates

## Making Schema Changes

When making changes to the database schema:

1. Always update the master schema file (`config/supabase_schema.sql`) directly
2. Run the apply-schema script to apply the changes
3. Update the application code as needed to work with the schema changes

---

All previous individual SQL files have been consolidated into the master schema file and are no longer needed. Similarly, multiple variations of database reset scripts have been consolidated into two main files: `reset-database.js` (Node.js) and `Reset-Database.ps1` (PowerShell).
