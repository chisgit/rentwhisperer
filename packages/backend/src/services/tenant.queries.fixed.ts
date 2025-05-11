import { supabase, supabaseAdmin, Tenant } from "../config/database";
import { logger } from "../utils/logger";

// Define the structure based on the actual query result
interface TenantQueryResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  created_at: string;
  updated_at: string;
  unit_id: string | null;
  units: {
    id: string;
    unit_number: string;
    property_id: string;
    rent_amount: number | null;
    rent_due_day: number | null;
    lease_start: string | null;
    lease_end: string | null;
    created_at: string;
    updated_at: string;
    properties: {
      id: string;
      name: string;
      address: string;
      city: string;
      province: string;
      postal_code: string;
      created_at: string;
      updated_at: string;
      landlord_id: string;
    };
  };
}

// Interface for fetched units
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
  };
}

/**
 * Fetches all tenants with their associated unit and property information.
 * This version works around permission issues by using basic fetch mechanism
 */
export async function fetchAllTenantsQueryFixed(): Promise<{ data: TenantQueryResult[] | null; error: any }> {
  console.log("Executing fixed fetchAllTenantsQuery using simplified approach...");

  try {
    // First fetch all tenants
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from("tenants")
      .select("*");

    if (tenantsError) {
      logger.error(`Error fetching basic tenants: ${tenantsError.message}`, tenantsError);
      return { data: null, error: tenantsError };
    }

    // If no tenants, return empty array
    if (!tenants || tenants.length === 0) {
      return { data: [], error: null };
    }

    // Then fetch all units with their properties
    const { data: units, error: unitsError } = await supabaseAdmin
      .from("units")
      .select(`
        id,
        unit_number,
        property_id,
        properties (
          id,
          name,
          address,
          city,
          province,
          postal_code,
          created_at,
          updated_at,
          landlord_id
        )
      `);

    if (unitsError) {
      logger.error(`Error fetching units: ${unitsError.message}`, unitsError);
      // Even if units fetch failed, return tenants without unit info
      const result = tenants.map((tenant: any) => ({
        ...tenant,
        units: null
      })) as TenantQueryResult[];
      return { data: result, error: null };
    }

    // Get tenant-unit relationships
    const { data: tenantUnits, error: relationError } = await supabaseAdmin
      .from("tenant_units")
      .select("*");

    if (relationError) {
      logger.error(`Error fetching tenant-unit relations: ${relationError.message}`, relationError);
      // Return tenants without unit info
      const result = tenants.map((tenant: any) => ({
        ...tenant,
        units: null
      })) as TenantQueryResult[];
      return { data: result, error: null };
    }

    // Create a map of unit_id to unit for quick lookups
    const unitsMap = units.reduce((map: any, unit: any) => {
      map[unit.id] = unit;
      return map;
    }, {});

    // Create a map of tenant_id to their unit_ids
    const tenantUnitMap = tenantUnits.reduce((map: any, rel: any) => {
      if (!map[rel.tenant_id]) {
        map[rel.tenant_id] = [];
      }
      map[rel.tenant_id].push(rel.unit_id);
      return map;
    }, {});

    // Combine the data
    const result = tenants.map((tenant: any) => {
      // Find the unit IDs for this tenant
      const unitIds = tenantUnitMap[tenant.id] || [];

      // Get the first unit (assuming one tenant-one unit for MVP)
      let tenantUnit = null;
      if (unitIds.length > 0) {
        tenantUnit = unitsMap[unitIds[0]];
      }

      return {
        ...tenant,
        unit_id: unitIds.length > 0 ? unitIds[0] : null,
        units: tenantUnit
      };
    }) as TenantQueryResult[];

    console.log(`Fixed query successful, fetched ${result.length} tenants.`);
    return { data: result, error: null };
  } catch (error) {
    logger.error(`Exception in fetchAllTenantsQueryFixed: ${(error as Error).message}`, error);
    console.log(`Error in fetchAllTenantsQueryFixed:`, error);
    return { data: null, error };
  }
}
