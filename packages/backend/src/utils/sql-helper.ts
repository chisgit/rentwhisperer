import { supabase } from "../config/database";
import { logger } from "./logger";

/**
 * Executes a raw SQL query directly against the database
 * Use with caution as this bypasses ORM safety features
 */
export async function executeRawSql(sql: string): Promise<{ success: boolean; message: string }> {
  try {
    logger.info(`Executing raw SQL: ${sql}`);

    // Attempt 1: Using Supabase RPC if available
    if (typeof supabase.rpc === 'function') {
      try {
        const { data, error } = await supabase.rpc('execute_sql', { sql });
        if (!error) {
          return { success: true, message: 'SQL executed successfully via RPC' };
        }
        logger.warn(`RPC SQL execution failed: ${error.message}`);
      } catch (rpcErr) {
        logger.warn(`RPC method not available: ${rpcErr}`);
      }
    }

    // Attempt 2 (formerly Attempt 3): Direct REST API call
    try {
      const { SUPABASE_URL, SUPABASE_KEY } = process.env; // Note: SUPABASE_KEY here is likely the ANON key from .env

      if (SUPABASE_URL && SUPABASE_KEY) {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          },
          body: JSON.stringify({ sql })
        });

        if (response.ok) {
          return { success: true, message: 'SQL executed successfully via REST API' };
        }

        const errorText = await response.text();
        logger.warn(`REST API SQL execution failed: ${errorText}`);
      }
    } catch (restErr) {
      logger.warn(`REST API method failed: ${restErr}`);
    }

    return { success: false, message: 'All SQL execution methods failed' };
  } catch (err) {
    logger.error(`Exception in executeRawSql: ${err}`);
    return { success: false, message: `SQL execution error: ${err}` };
  }
}

/**
 * Helper to update a tenant directly using SQL
 */
export async function updateTenantDirectSql(id: string, fields: Record<string, any>): Promise<boolean> {
  try {
    // Format the fields for SQL update
    const sqlFields = Object.entries(fields)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          // Escape single quotes for SQL
          return `${key} = '${value.replace(/'/g, "''")}'`;
        } else if (value === null) {
          return `${key} = NULL`;
        } else {
          return `${key} = ${value}`;
        }
      })
      .join(', ');

    // Build the raw SQL query
    const updateSql = `
      UPDATE public.tenants 
      SET ${sqlFields}, updated_at = NOW() 
      WHERE id = '${id}'
    `;

    logger.info(`Executing direct tenant update SQL: ${updateSql}`);
    const result = await executeRawSql(updateSql);

    return result.success;
  } catch (err) {
    logger.error(`Exception in updateTenantDirectSql: ${err}`);
    return false;
  }
}
