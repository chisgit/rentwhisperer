# Database Scripts for RentWhisperer

This directory contains scripts for managing the RentWhisperer database.

## Main Scripts

### Schema Application Scripts

- `apply-master-schema.js` - Node.js script to apply the master schema using psql command-line
- `Apply-MasterSchema.ps1` - PowerShell script to apply the master schema using psql command-line
- `execute-schema.js` - Alternative script to apply schema using Supabase REST API (useful when psql is not available)

### Database Reset Scripts

- `reset-database.js` - Node.js script to drop all tables and reapply the master schema
- `Reset-Database.ps1` - PowerShell script to drop all tables and reapply the master schema

### Other Scripts

- `check-permissions.ts` - Script to check database permissions
- `seed-database.ts` - Script to seed the database with test data
- `set-db-url.ps1` - PowerShell script to configure DATABASE_URL from Supabase credentials

## Usage

These scripts can be run directly or through npm scripts defined in package.json:

```bash
# Apply schema without dropping tables
npm run apply-schema

# Reset database (drop all tables and apply schema)
npm run reset-database
```

### Setting up Database URL

If you're having issues with the DATABASE_URL environment variable:

```powershell
# Set up the DATABASE_URL from your Supabase credentials
.\packages\backend\src\scripts\set-db-url.ps1

# Or use the convenience batch file from the root directory
.\reset-db.bat
```

## Backup Scripts

Legacy and backup scripts are stored in the `script_backups` directory for reference.
