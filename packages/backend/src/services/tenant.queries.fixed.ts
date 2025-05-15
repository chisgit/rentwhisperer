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
  } | null; // Allow units to be null
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
  console.log("Executing fixed fetchAllTenantsQuery with tenant_units data...");

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

    // Fetch the tenant_units table data to get rent_amount and rent_due_day
    console.log("Fetching tenant_units data for rent information...");
    const { data: tenantUnits, error: tenantUnitsError } = await supabaseAdmin
      .from("tenant_units")
      .select("*")
      .eq("is_primary", true);

    if (tenantUnitsError) {
      logger.error(`Error fetching tenant_units: ${tenantUnitsError.message}`, tenantUnitsError);
      console.log(`Will continue without tenant_units data`);
    } else {
      console.log(`Successfully fetched ${tenantUnits?.length || 0} tenant_units records`);
    }

    // Create a map of tenant_id to tenant_unit for quick lookups
    const tenantUnitMap = {};
    if (tenantUnits && tenantUnits.length > 0) {
      tenantUnits.forEach(tu => {
        tenantUnitMap[tu.tenant_id] = tu;
      });
    }

    // Then fetch all units with their properties
    const { data: unitsData, error: unitsError } = await supabaseAdmin // Renamed to unitsData
      .from("units")
      .select(`
        id,
        unit_number,
        property_id,
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
          updated_at,
          landlord_id
        )
      `);

    if (unitsError) {
      logger.error(`Error fetching units: ${unitsError.message}`, unitsError);
      // Even if units fetch failed, return tenants without unit info
      const result = tenants.map((tenant: any) => ({
        ...tenant,
        units: null,
        unit_id: null // Ensure unit_id is also nulled
      })) as TenantQueryResult[];
      return { data: result, error: null }; // Return basic tenant data
    }

    // Get tenant-unit relationships
    const { data: tenantUnitRelations, error: relationError } = await supabaseAdmin // Renamed
      .from("tenant_units")
      .select("tenant_id, unit_id, rent_amount, rent_due_day, lease_start_date, lease_end_date, is_primary"); // Select necessary fields

    if (relationError) {
      logger.error(`Error fetching tenant-unit relations: ${relationError.message}`, relationError);
      // Return tenants without unit info
      const result = tenants.map((tenant: any) => ({
        ...tenant,
        units: null,
        unit_id: null
      })) as TenantQueryResult[];
      return { data: result, error: null }; // Return basic tenant data
    }

    // Create a map of unit_id to unit for quick lookups
    const unitsMap = unitsData.reduce((map: any, unit: any) => {
      map[unit.id] = unit;
      return map;
    }, {});

    // Map tenant_id to its primary tenant_units relation details
    const primaryTenantUnitDetailsMap = tenantUnitRelations.reduce((map: any, rel: any) => {
      if (rel.is_primary) { // Consider only the primary unit relationship
        map[rel.tenant_id] = {
          unit_id: rel.unit_id,
          rent_amount: rel.rent_amount,
          rent_due_day: rel.rent_due_day,
          lease_start: rel.lease_start_date, // map from lease_start_date
          lease_end: rel.lease_end_date,     // map from lease_end_date
        };
      }
      return map;
    }, {});

    // Combine the data    const result = tenants.map((tenant: any) => {
    // Find primary tenant-unit relationship from our map
    const primaryRelationDetails = primaryTenantUnitDetailsMap[tenant.id];

    // Also check our direct tenant_units mapping (from the new code we added)
    const tenantUnitInfo = tenantUnitMap && tenantUnitMap[tenant.id];

    let assembledUnitInfo: TenantQueryResult['units'] = null; // Initialize to null

    // Get rent information from either source (prioritize primaryRelationDetails if available)
    const rentAmount = primaryRelationDetails?.rent_amount !== undefined ? primaryRelationDetails.rent_amount :
      (tenantUnitInfo?.rent_amount !== undefined ? tenantUnitInfo.rent_amount : null);

    const rentDueDay = primaryRelationDetails?.rent_due_day !== undefined ? primaryRelationDetails.rent_due_day :
      (tenantUnitInfo?.rent_due_day !== undefined ? tenantUnitInfo.rent_due_day : null);

    const leaseStart = primaryRelationDetails?.lease_start !== undefined ? primaryRelationDetails.lease_start :
      (tenantUnitInfo?.lease_start_date !== undefined ? tenantUnitInfo.lease_start_date : null);

    const leaseEnd = primaryRelationDetails?.lease_end !== undefined ? primaryRelationDetails.lease_end :
      (tenantUnitInfo?.lease_end_date !== undefined ? tenantUnitInfo.lease_end_date : null);

    // Get unit ID from any available source
    const unitId = tenant.unit_id || (primaryRelationDetails?.unit_id || tenantUnitInfo?.unit_id);

    if (primaryRelationDetails) {
      const basicUnitInfo = unitsMap[primaryRelationDetails.unit_id];
      if (basicUnitInfo) {
        assembledUnitInfo = {
          ...basicUnitInfo, // Spread basic unit info (id, unit_number, property_id, properties, created_at, updated_at for unit)
          // Overwrite/add fields from tenant_units relation
          rent_amount: rentAmount !== null ? Number(rentAmount) : null,
          rent_due_day: rentDueDay !== null ? Number(rentDueDay) : null,
          lease_start: leaseStart,
          lease_end: leaseEnd,
        };
      }
    }

    return {
      ...tenant,
      unit_id: primaryRelationDetails ? primaryRelationDetails.unit_id : null, // This is the ID of the unit itself
      units: assembledUnitInfo, // This now contains rent details from tenant_units
    };
  }) as TenantQueryResult[];

  console.log(`Fixed query successful, constructed ${result.length} tenants with detailed unit info.`);
  return { data: result, error: null };
} catch (error) {
  logger.error(`Exception in fetchAllTenantsQueryFixed: ${(error as Error).message}`, error);
  console.log(`Error in fetchAllTenantsQueryFixed:`, error);
  return { data: null, error };
}
}
