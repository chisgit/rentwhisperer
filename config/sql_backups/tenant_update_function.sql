-- Function to directly update tenant fields when normal updates aren't working
CREATE OR REPLACE FUNCTION update_tenant_direct(tenant_id UUID, update_fields TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT, query_executed TEXT) AS $$
DECLARE
  query TEXT;
  rows_affected INTEGER;
BEGIN
  -- Verify the tenant exists first
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id) THEN
    RETURN QUERY SELECT FALSE, 'Tenant not found with ID: ' || tenant_id::TEXT, '';
    RETURN;
  END IF;

  -- Construct and execute dynamic SQL update 
  query := 'UPDATE public.tenants SET ' || update_fields || ', updated_at = NOW() WHERE id = ''' || tenant_id || '''';
  
  -- Log the query for debugging
  RAISE NOTICE 'Executing query: %', query;
  
  -- Execute the query
  EXECUTE query;
  
  -- Check if update was successful
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  -- Return true if at least one row was updated
  IF rows_affected > 0 THEN
    RETURN QUERY SELECT TRUE, 'Successfully updated ' || rows_affected || ' row(s)', query;
  ELSE
    RETURN QUERY SELECT FALSE, 'Update executed but no rows affected', query;
  END IF;
  
  RETURN;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, 'Update failed: ' || SQLERRM, query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_tenant_direct(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_tenant_direct(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION update_tenant_direct(UUID, TEXT) TO postgres;

-- Comment on the function to document its purpose
COMMENT ON FUNCTION update_tenant_direct(UUID, TEXT) IS 'Directly updates tenant records when ORM updates fail. Returns success status, message and the query executed.';
