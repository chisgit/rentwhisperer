import { supabase, Tenant } from "../config/database";
import { logger } from "../utils/logger";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Create a supabase client with the service role key for admin operations
// This bypasses RLS policies to allow tenant_units modifications
const adminSupabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Interface for the data structure returned by the Supabase query in getAllTenants and getTenantById.
 * This is needed because the nested select with aliasing is not fully inferred by the Supabase client types.
 */
// Define the structure based on the actual query result, not extending Tenant
interface TenantQueryResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  created_at: string;
  updated_at: string;
  tenant_units: {
    unit_id: string;
    is_primary: boolean;
    lease_start: string;
    lease_end: string | null;
    rent_amount: string;
    rent_due_day: number;
    units: {
      id: string;
      unit_number: string;
      property_id: string;
      properties: {
        id: string;
        name: string;
        address: string;
        city: string;
        province: string;
        postal_code: string;
      } | null;
    } | null;
  }[];
}

/**
 * Fetches all tenants with their associated unit and property information.
 * @returns A promise that resolves to an array of TenantQueryResult or an error.
 */
export async function fetchAllTenantsQuery(): Promise<{ data: TenantQueryResult[] | null; error: any }> {
  console.log("Executing fetchAllTenantsQuery...");
  const { data, error } = await supabase
    .from("tenants")
    .select(`
      *,
      tenant_units!tenant_units_tenant_id_fkey (
        unit_id,
        is_primary,
        lease_start,
        lease_end,
        rent_amount,
        rent_due_day,
        units:unit_id (
          id,
          unit_number,
          property_id,
          properties:property_id (
            id,
            name,
            address,
            city,
            province,
            postal_code
          )
        )
      )
    `) as { data: TenantQueryResult[] | null; error: any };

  if (error) {
    logger.error(`Error in fetchAllTenantsQuery: ${error.message}`, error);
    console.log(`Error in fetchAllTenantsQuery:`, error);
  } else {
    console.log(`fetchAllTenantsQuery successful, fetched ${data?.length || 0} tenants.`);
  }

  return { data, error };
}

/**
 * Fetches a single tenant by ID with their associated unit and property information.
 * @param id The ID of the tenant to fetch.
 * @returns A promise that resolves to a single TenantQueryResult or null, or an error.
 */
export async function fetchTenantByIdQuery(id: string): Promise<{ data: TenantQueryResult | null; error: any }> {
  console.log(`Executing fetchTenantByIdQuery for tenant ID: ${id}`);
  const { data, error } = await supabase
    .from("tenants")
    .select(`
      *,
      tenant_units!tenant_units_tenant_id_fkey (
        unit_id,
        is_primary,
        lease_start,
        lease_end,
        rent_amount,
        rent_due_day,
        units:unit_id (
          id,
          unit_number,
          property_id,
          properties:property_id (
            id,
            name,
            address,
            city,
            province,
            postal_code
          )
        )
      )
    `)
    .eq("id", id)
    .single() as { data: TenantQueryResult | null; error: any };

  if (error) {
    logger.error(`Error in fetchTenantByIdQuery for tenant ${id}: ${error.message}`, error);
    console.log(`Error in fetchTenantByIdQuery for tenant ${id}:`, error);
  } else {
    console.log(`fetchTenantByIdQuery successful for tenant ${id}.`);
  }

  return { data, error };
}

/**
 * Interface for the data structure returned by the Supabase query in getAllUnitsQuery.
 */
interface UnitQueryResult {
  id: string;
  unit_number: string;
  property_id: string;
  properties: {
    id: string;
    name: string;
    address: string;
    city: string;
    province: string;
    postal_code: string;
  } | null;
}

/**
 * Fetches all units with their associated property information.
 * @returns A promise that resolves to an array of units with property data or an error.
 */
export async function getAllUnitsQuery(): Promise<{ data: UnitQueryResult[] | null; error: any }> {
  console.log("Executing getAllUnitsQuery...");
  const { data, error } = await supabase
    .from("units")
    .select(`
      *,
      properties:property_id (*)
    `);

  if (error) {
    logger.error(`Error in getAllUnitsQuery: ${error.message}`, error);
    console.log(`Error in getAllUnitsQuery:`, error);
  } else {
    console.log(`getAllUnitsQuery successful, fetched ${data?.length || 0} units.`);
  }

  return { data, error };
}

/**
 * Creates a new tenant in the database
 * @param tenant The tenant data to create
 * @returns A promise that resolves to the created tenant data or an error
 */
export async function createTenantQuery(tenant: Omit<Tenant, 'id'>): Promise<{ data: Tenant | null; error: any }> {
  console.log("Executing createTenantQuery...");
  const { data, error } = await supabase
    .from("tenants")
    .insert(tenant)
    .select();

  if (error) {
    logger.error(`Error in createTenantQuery: ${error.message}`, error);
    console.log(`Error in createTenantQuery:`, error);
    return { data: null, error };
  }

  return { data: data[0] || null, error };
}

/**
 * Creates or updates a tenant-unit relationship
 * @param tenantId ID of the tenant
 * @param unitId ID of the unit
 * @param isPrimary Whether this is the primary unit for this tenant
 * @param rentAmount Rent amount for this unit
 * @param rentDueDay Day of the month rent is due
 * @returns A promise that resolves to the created or updated relationship
 */
export async function createOrUpdateTenantUnitQuery(
  tenantId: string,
  unitId: string,
  isPrimary: boolean = true,
  rentAmount: number = 0,
  rentDueDay: number = 1,
  leaseStart?: string
): Promise<{ data: any, error: any }> {
  console.log(`Creating/updating tenant-unit relationship for tenant ${tenantId}, unit ${unitId}`);

  // Check if relationship already exists
  const { data: existing, error: checkError } = await adminSupabase
    .from('tenant_units')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('unit_id', unitId)
    .maybeSingle();

  if (checkError) {
    logger.error(`Error checking tenant-unit relationship: ${checkError.message}`, checkError);
    return { data: null, error: checkError };
  }

  const tenantUnitData = {
    tenant_id: tenantId,
    unit_id: unitId,
    is_primary: isPrimary,
    lease_start: leaseStart || new Date().toISOString(),
    rent_amount: rentAmount,
    rent_due_day: rentDueDay
  };

  if (existing) {
    // Update existing relationship
    console.log(`Updating existing tenant-unit relationship ID: ${existing.id}`);
    return adminSupabase
      .from('tenant_units')
      .update(tenantUnitData)
      .eq('tenant_id', tenantId)
      .eq('unit_id', unitId)
      .select();
  } else {
    // Create new relationship
    console.log(`Creating new tenant-unit relationship`);
    return adminSupabase
      .from('tenant_units')
      .insert([tenantUnitData])
      .select();
  }
}

/**
 * Fetches direct tenant-unit data for a specific tenant
 * @param tenantId The ID of the tenant
 * @returns A promise that resolves to the tenant-unit data or error
 */
export async function fetchTenantUnitsByTenantId(
  tenantId: string
): Promise<{ data: any, error: any }> {
  console.log(`Fetching tenant-units for tenant ID: ${tenantId}`);
  return adminSupabase
    .from('tenant_units')
    .select(`
      *,
      units:unit_id (
        *,
        properties:property_id (*)
      )
    `)
    .eq('tenant_id', tenantId)
    .order('is_primary', { ascending: false });
}

/**
 * Updates tenant information
 * @param tenantId The ID of the tenant to update
 * @param tenantData The data to update
 * @returns A promise that resolves to the updated tenant data or error
 */
export async function updateTenantQuery(
  tenantId: string,
  tenantData: Partial<Tenant>
): Promise<{ data: any, error: any }> {
  console.log(`Updating tenant ${tenantId} with data:`, tenantData);
  return adminSupabase
    .from('tenants')
    .update(tenantData)
    .eq('id', tenantId)
    .select();
}

// Removed redundant exports
export { TenantQueryResult, UnitQueryResult };
