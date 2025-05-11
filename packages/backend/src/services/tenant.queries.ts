import { supabase, supabaseAdmin, Tenant } from "../config/database"; // Import supabaseAdmin
import { logger } from "../utils/logger";
// import { createClient, SupabaseClient } from "@supabase/supabase-js"; // No longer needed here

// Remove local adminSupabase definition, use the one from config/database
// const adminSupabase: SupabaseClient = createClient(
//   process.env.SUPABASE_URL || '',
//   process.env.SUPABASE_SERVICE_ROLE_KEY || ''
// );

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
  unit_id: string | null; // Direct foreign key from tenants table
  units: { // Joined from units table via tenants.unit_id
    id: string;
    unit_number: string;
    property_id: string;
    rent_amount: number | null;
    rent_due_day: number | null;
    lease_start: string | null;
    lease_end: string | null;
    created_at: string;
    updated_at: string;
    properties: { // Joined from properties table via units.property_id
      id: string;
      name: string;
      address: string;
      city: string;
      province: string;
      postal_code: string;
      created_at: string;
      updated_at: string;
    } | null;
  } | null;
}

/**
 * Fetches all tenants with their associated unit and property information.
 * @returns A promise that resolves to an array of TenantQueryResult or an error.
 */
export async function fetchAllTenantsQuery(): Promise<{ data: TenantQueryResult[] | null; error: any }> {
  console.log("Executing fetchAllTenantsQuery using supabaseAdmin..."); // Log change
  const { data, error } = await supabaseAdmin // Use supabaseAdmin
    .from("tenants")
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      created_at,
      updated_at,
      unit_id,
      units (
        id,
        unit_number,
        property_id,
        rent_amount,
        rent_due_day,
        lease_start,
        lease_end,
        created_at,
        updated_at,
        properties (
          id,
          name,
          address,
          city,
          province,
          postal_code,
          created_at,
          updated_at
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
  console.log(`Executing fetchTenantByIdQuery for tenant ID: ${id} using supabaseAdmin...`); // Log change
  const { data, error } = await supabaseAdmin // Use supabaseAdmin
    .from("tenants")
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      created_at,
      updated_at,
      unit_id,
      units (
        id,
        unit_number,
        property_id,
        rent_amount,
        rent_due_day,
        lease_start,
        lease_end,
        created_at,
        updated_at,
        properties (
          id,
          name,
          address,
          city,
          province,
          postal_code,
          created_at,
          updated_at
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
  console.log("Executing getAllUnitsQuery using supabaseAdmin..."); // Log change
  const { data, error } = await supabaseAdmin // Use supabaseAdmin
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
  console.log("Executing createTenantQuery using supabaseAdmin..."); // Log change
  const { data, error } = await supabaseAdmin // Use supabaseAdmin
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
 * Creates or updates a tenant-unit relationship (OBSOLETE with new schema - tenant_units table removed)
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
  console.warn("createOrUpdateTenantUnitQuery is called but is based on the old tenant_units schema. This function needs to be updated or removed.");
  logger.warn("createOrUpdateTenantUnitQuery is called but is based on the old tenant_units schema.");
  // This function's logic needs to be completely rethought for the new schema.
  // Assigning a tenant to a unit now means updating tenants.unit_id.
  // Lease terms (rent_amount, rent_due_day, lease_start, lease_end) are now on the units table.
  // For now, returning an error or a no-op.
  return Promise.resolve({ data: null, error: { message: "Function createOrUpdateTenantUnitQuery is obsolete due to schema changes." } });

  // console.log(`Creating/updating tenant-unit relationship for tenant ${tenantId}, unit ${unitId}`);

  // // Check if relationship already exists
  // const { data: existing, error: checkError } = await adminSupabase
  //   .from('tenant_units') // This table is removed
  //   .select('*')
  //   .eq('tenant_id', tenantId)
  //   .eq('unit_id', unitId)
  //   .maybeSingle();

  // if (checkError) {
  //   logger.error(`Error checking tenant-unit relationship: ${checkError.message}`, checkError);
  //   return { data: null, error: checkError };
  // }

  // const tenantUnitData = {
  //   tenant_id: tenantId,
  //   unit_id: unitId,
  //   is_primary: isPrimary,
  //   lease_start: leaseStart || new Date().toISOString(),
  //   rent_amount: rentAmount,
  //   rent_due_day: rentDueDay
  // };

  // if (existing) {
  //   // Update existing relationship
  //   console.log(`Updating existing tenant-unit relationship ID: ${existing.id}`);
  //   return adminSupabase
  //     .from('tenant_units') // This table is removed
  //     .update(tenantUnitData)
  //     .eq('tenant_id', tenantId)
  //     .eq('unit_id', unitId)
  //     .select();
  // } else {
  //   // Create new relationship
  //   console.log(`Creating new tenant-unit relationship`);
  //   return adminSupabase
  //     .from('tenant_units') // This table is removed
  //     .insert([tenantUnitData])
  //     .select();
  // }
}

/**
 * Fetches direct tenant-unit data for a specific tenant (OBSOLETE with new schema - tenant_units table removed)
 * @param tenantId The ID of the tenant
 * @returns A promise that resolves to the tenant-unit data or error
 */
export async function fetchTenantUnitsByTenantId(
  tenantId: string
): Promise<{ data: any, error: any }> {
  console.warn("fetchTenantUnitsByTenantId is called but is based on the old tenant_units schema. This function should be removed or updated.");
  logger.warn("fetchTenantUnitsByTenantId is called but is based on the old tenant_units schema.");
  // This function is obsolete as tenant_units table is removed.
  // Tenant's unit information is now fetched directly with the tenant.
  return Promise.resolve({ data: null, error: { message: "Function fetchTenantUnitsByTenantId is obsolete due to schema changes." } });

  // console.log(`Fetching tenant-units for tenant ID: ${tenantId}`);
  // return adminSupabase
  //   .from('tenant_units') // This table is removed
  //   .select(`
  //     *,
  //     units:unit_id (
  //       *,
  //       properties:property_id (*)
  //     )
  //   `)
  //   .eq('tenant_id', tenantId)
  //   .order('is_primary', { ascending: false });
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
  console.log(`Updating tenant ${tenantId} with data using supabaseAdmin:`, tenantData); // Log change
  return supabaseAdmin // Use supabaseAdmin
    .from('tenants')
    .update(tenantData)
    .eq('id', tenantId)
    .select();
}

// Export the imported supabaseAdmin, and other types
export { TenantQueryResult, UnitQueryResult, supabaseAdmin };
