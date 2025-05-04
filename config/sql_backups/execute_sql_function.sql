-- Function to directly execute SQL statements
-- IMPORTANT: This is a security risk if exposed publicly, use only in secured environments
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Log the query for debugging
  RAISE NOTICE 'Executing SQL: %', sql;
  
  -- Execute the query
  EXECUTE sql;
  
  -- Return true to indicate success
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SQL execution failed: %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO service_role;

-- Comment on the function to document its purpose and security implications
COMMENT ON FUNCTION execute_sql(TEXT) IS 'Executes raw SQL. WARNING: Only use in secured environments.';
