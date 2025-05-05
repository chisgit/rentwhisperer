import { supabase } from "../config/database";
import { Tenant } from "../types/tenant.types"; // Adjust this if Tenant is defined elsewhere

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
  id: string; // Assuming Tenant base fields are needed
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
    rent_amount: string; // Supabase returns numeric as string
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


// Export the supabase and adminSupabase clients and types if needed elsewhere, or keep them internal
export { supabase, adminSupabase, TenantQueryResult, Tenant };

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
      )q("id", id)
    `){ data: TenantQueryResult | null; error: any
};
    .eq("id", id)
  .single() as { data: TenantQueryResult | null; error: any }; if (error) {
    or(`Error in fetchTenantByIdQuery for tenant ${id}: ${error.message}`, error);
    if (error) {
      logger.error(`Error in fetchTenantByIdQuery for tenant ${id}: ${error.message}`, error);
      console.log(`Error in fetchTenantByIdQuery for tenant ${id}:`, error); e.log(`fetchTenantByIdQuery successful for tenant ${id}.`);
    } else {
      console.log(`fetchTenantByIdQuery successful for tenant ${id}.`);
    } return { data, error };

    return { data, error };
  }/**
Interface for the data structure returned by the Supabase query in getAllUnitsQuery.
/**
 * Interface for the data structure returned by the Supabase query in getAllUnitsQuery.erface UnitQueryResult {
 */
interface UnitQueryResult {: string;
  id: string;
  unit_number: string;
  property_id: string;
  properties: {
    g;
    id: string; ng;
    name: string;
    address: string; ing;
    city: string; ng;
    province: string;
    postal_code: string;
  } | null;
}/**
Fetches all units with their associated property information.
/**operty data or an error.
 * Fetches all units with their associated property information.
 * @returns A promise that resolves to an array of units with property data or an error.ort async function getAllUnitsQuery(): Promise<{ data: UnitQueryResult[] | null; error: any }> {
 */
export async function getAllUnitsQuery(): Promise<{ data: UnitQueryResult[] | null; error: any }> {
  console.log("Executing getAllUnitsQuery...");
  const { data, error } = await supabase
    .from("units")
    .select(`operties:property_id (*)
      *,
      properties:property_id (*)
    `); if (error) {
    or(`Error in getAllUnitsQuery: ${error.message}`, error);
    if (error) {
      logger.error(`Error in getAllUnitsQuery: ${error.message}`, error);
      console.log(`Error in getAllUnitsQuery:`, error); e.log(`getAllUnitsQuery successful, fetched ${data?.length || 0} units.`);
    } else {
      console.log(`getAllUnitsQuery successful, fetched ${data?.length || 0} units.`);
    } return { data, error };
  }




} return { data, error };
