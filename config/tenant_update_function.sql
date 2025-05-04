-- Function to directly update tenant fields when normal updates aren't working
CREATE OR REPLACE FUNCTION update_tenant_direct(tenant_id UUID, update_fields TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  query TEXT;
  success BOOLEAN;
BEGIN
  -- Construct and execute dynamic SQL update 
  query := 'UPDATE public.tenants SET ' || update_fields || ', updated_at = NOW() WHERE id = ''' || tenant_id || '''';
  
  -- Log the query for debugging
  RAISE NOTICE 'Executing query: %', query;
  
  -- Execute the query
  EXECUTE query;
  
  -- Check if update was successful
  GET DIAGNOSTICS success = ROW_COUNT;
  
  -- Return true if at least one row was updated
  RETURN success > 0;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Update failed: %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
