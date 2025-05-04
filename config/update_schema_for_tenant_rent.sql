-- Update schema to move rent details to tenant_units table
-- This allows different tenants in the same unit to have different rent amounts

-- First add the columns to tenant_units table
ALTER TABLE public.tenant_units
ADD COLUMN IF NOT EXISTS rent_amount numeric,
ADD COLUMN IF NOT EXISTS rent_due_day integer;

-- Copy existing rent values from units to tenant_units for existing relationships
UPDATE public.tenant_units tu
SET 
  rent_amount = u.rent_amount,
  rent_due_day = u.rent_due_day
FROM public.units u
WHERE tu.unit_id = u.id;

-- After migrating all data, we can make the columns NOT NULL if desired
ALTER TABLE public.tenant_units
ALTER COLUMN rent_amount SET NOT NULL,
ALTER COLUMN rent_due_day SET NOT NULL;

-- Note: We're keeping the columns in the units table for now as default values
-- They can be removed later if desired
-- ALTER TABLE public.units
-- DROP COLUMN rent_amount,
-- DROP COLUMN rent_due_day;
