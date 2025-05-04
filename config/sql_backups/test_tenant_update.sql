-- Test script for the update_tenant_direct function

-- First, verify the function exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'update_tenant_direct'
    ) THEN
        RAISE EXCEPTION 'The update_tenant_direct function does not exist!';
    END IF;
END $$;

-- Test case 1: Attempt to update a tenant's last name
SELECT * FROM update_tenant_direct(
    '6f4d516c-1587-4388-97e2-84157dea7f5f', 
    'last_name = ''Browns'''
);

-- For debugging: Check the actual data in the tenants table
SELECT id, first_name, last_name, email, updated_at 
FROM tenants 
WHERE id = '6f4d516c-1587-4388-97e2-84157dea7f5f';

-- Alternative manual update for testing if the function doesn't work
-- Uncomment and run separately if needed
-- UPDATE public.tenants 
-- SET last_name = 'Browns', updated_at = NOW() 
-- WHERE id = '6f4d516c-1587-4388-97e2-84157dea7f5f';
