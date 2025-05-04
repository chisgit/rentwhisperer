-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS public.incoming_messages CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.rent_payments CASCADE;
DROP TABLE IF EXISTS public.tenant_units CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.units CASCADE;
DROP TABLE IF EXISTS public.properties CASCADE;
DROP TABLE IF EXISTS public.landlords CASCADE;

-- Also drop functions and triggers
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
