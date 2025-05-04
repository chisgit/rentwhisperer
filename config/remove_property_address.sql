-- Remove property_address column from tenants table as it's redundant
-- The property address is already available through the property associated with the unit

-- First check if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'tenants'
    AND column_name = 'property_address'
  ) THEN
    -- Remove the column if it exists
    ALTER TABLE public.tenants DROP COLUMN property_address;
    RAISE NOTICE 'property_address column dropped from tenants table';
  ELSE
    RAISE NOTICE 'property_address column does not exist in tenants table';
  END IF;
END $$;
