import { supabase, supabaseAdmin, Tenant } from "../config/database";
import { logger } from "../utils/logger";

// Define the structure based on the actual query result
interface EnhancedTenantQueryResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  created_at: string;
  updated_at: string;
  unit_id: string | null;
  rent_amount: number | null;
  rent_due_day: number | null;
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
  } | null;
}

/**
 * Enhanced fetch for all tenants that includes detailed debugging
 */
export async function fetchTenantsWithTenantUnits(): Promise<{ data: EnhancedTenantQueryResult[] | null; error: any }> {
  console.log("[DEBUG-ENHANCED] Executing fetchTenantsWithTenantUnits");
  try {
    // Direct SQL join to get tenants with their tenant_units and units in one query
    console.log("[DEBUG-ENHANCED] Fetching tenants with JOIN to tenant_units and units");
    const { data: enhancedTenants, error: joinError } = await supabaseAdmin
      .from("tenant_units")
      .select(`
        *,
        tenants:tenant_id (*),
        units:unit_id (
          *,
          properties:property_id (*)
        )
      `)
      .eq("is_primary", true);

    if (joinError) {
      logger.error(`Error in JOIN query: ${joinError.message}`, joinError);
      console.log("[DEBUG-ENHANCED] Falling back to separate queries approach");

      // Continue with the original approach as fallback
      return await fetchTenantsWithSeparateQueries();
    }

    console.log(`[DEBUG-ENHANCED] Successfully fetched ${enhancedTenants?.length || 0} tenants with JOIN query`);

    // Log sample of joined data for debugging
    if (enhancedTenants && enhancedTenants.length > 0) {
      console.log("[DEBUG-ENHANCED] Sample joined tenant data structure:",
        JSON.stringify(enhancedTenants[0], null, 2).substring(0, 500) + "...");
    }    // Transform the data to match our expected output format
    const result = enhancedTenants.map(tenantUnit => {
      const tenant = tenantUnit.tenants;
      const unit = tenantUnit.units;

      console.log(`[DEBUG-ENHANCED] Processing tenant ${tenant?.id} with unit ${unit?.id}, relation ID: ${tenantUnit.id}`);

      if (!tenant) {
        console.log(`[DEBUG-ENHANCED] Skipping tenant-unit relation ${tenantUnit.id} with missing tenant data`);
        return null;
      }

      return {
        ...tenant,
        // Use tenant_units data for rent values
        rent_amount: tenantUnit.rent_amount !== undefined ? Number(tenantUnit.rent_amount) : null,
        rent_due_day: tenantUnit.rent_due_day !== undefined ? Number(tenantUnit.rent_due_day) : null,
        unit_id: unit?.id || null,
        // Include unit data
        units: unit || null,
        // Remove nested properties to avoid duplication
        tenants: undefined
      };
    });

    console.log(`[DEBUG-ENHANCED] Successfully transformed ${result.length} tenants`);
    return { data: result, error: null };

  } catch (error) {
    logger.error(`Exception in fetchTenantsWithTenantUnits: ${(error as Error).message}`, error);
    console.error(`[DEBUG-ENHANCED] Exception in fetchTenantsWithTenantUnits:`, error);

    // Try fallback method if the main one fails
    console.log(`[DEBUG-ENHANCED] Trying fallback method after error`);
    return await fetchTenantsWithSeparateQueries();
  }
}

/**
 * Fallback function that fetches tenants using separate queries
 * This is used when the JOIN query fails
 */
async function fetchTenantsWithSeparateQueries(): Promise<{ data: EnhancedTenantQueryResult[] | null; error: any }> {
  console.log("[DEBUG-ENHANCED] Executing fallback fetchTenantsWithSeparateQueries");

  try {
    // 1. Fetch all tenants
    console.log("[DEBUG-ENHANCED] Fetching tenants");
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from("tenants")
      .select("*");

    if (tenantsError) {
      logger.error(`Error fetching tenants: ${tenantsError.message}`, tenantsError);
      return { data: null, error: tenantsError };
    }

    console.log(`[DEBUG-ENHANCED] Fetched ${tenants?.length || 0} tenants`);

    // 2. Fetch all primary tenant-unit relationships
    console.log("[DEBUG-ENHANCED] Fetching primary tenant-unit relationships");
    const { data: primaryTenantUnits, error: tuError } = await supabaseAdmin
      .from("tenant_units")
      .select("*")
      .eq("is_primary", true);

    if (tuError) {
      logger.error(`Error fetching tenant_units: ${tuError.message}`, tuError);
      console.log(`[DEBUG-ENHANCED] Will continue without tenant_units data`);
    } else {
      console.log(`[DEBUG-ENHANCED] Fetched ${primaryTenantUnits?.length || 0} primary tenant-unit relationships`);

      // Log a sample of tenant-unit data
      if (primaryTenantUnits && primaryTenantUnits.length > 0) {
        console.log(`[DEBUG-ENHANCED] Sample tenant_unit data:`, JSON.stringify(primaryTenantUnits[0], null, 2));
      }
    }

    // 3. Create a lookup map for tenant units
    const tenantToUnitMap: Record<string, any> = {};
    if (primaryTenantUnits && primaryTenantUnits.length > 0) {
      primaryTenantUnits.forEach(tu => {
        tenantToUnitMap[tu.tenant_id] = tu;
        console.log(`[DEBUG-ENHANCED] Mapped tenant ${tu.tenant_id} to unit ${tu.unit_id} with rent ${tu.rent_amount}`);
      });
    }

    // 4. Fetch all units with their properties
    console.log("[DEBUG-ENHANCED] Fetching units with properties");
    const { data: units, error: unitsError } = await supabaseAdmin
      .from("units")
      .select(`
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
          updated_at,
          landlord_id
        )
      `);

    if (unitsError) {
      logger.error(`Error fetching units: ${unitsError.message}`, unitsError);
      // Return tenants without unit info
      const basicResult = tenants.map(tenant => ({
        ...tenant,
        rent_amount: null,
        rent_due_day: null,
        units: null
      }));
      return { data: basicResult, error: null };
    }

    console.log(`[DEBUG-ENHANCED] Fetched ${units?.length || 0} units`);

    // 5. Create a lookup map for units
    const unitMap: Record<string, any> = {};
    if (units && units.length > 0) {
      units.forEach(unit => {
        unitMap[unit.id] = unit;
      });
    }

    // 6. Combine all data
    console.log("[DEBUG-ENHANCED] Combining tenant, tenant_unit, and unit data");
    const result = tenants.map(tenant => {
      // Get the tenant's primary tenant-unit relationship
      const tenantUnit = tenant.id ? tenantToUnitMap[tenant.id] : null;

      // Determine unitId to use (from tenant_units if available, fallback to tenant.unit_id)
      const unitId = tenantUnit?.unit_id || tenant.unit_id;

      // Get the unit info
      const unit = unitId ? unitMap[unitId] : null;

      // Log mapping for debugging
      if (tenantUnit) {
        console.log(`[DEBUG-ENHANCED] Tenant ${tenant.id}: Using rent_amount=${tenantUnit.rent_amount}, rent_due_day=${tenantUnit.rent_due_day} from tenant_units`);
      } else {
        console.log(`[DEBUG-ENHANCED] Tenant ${tenant.id}: No tenant_units data available`);
      }

      return {
        ...tenant,
        rent_amount: tenantUnit?.rent_amount !== undefined ? Number(tenantUnit.rent_amount) : null,
        rent_due_day: tenantUnit?.rent_due_day !== undefined ? Number(tenantUnit.rent_due_day) : null,
        unit_id: unitId,
        units: unit || null
      };
    });

    console.log(`[DEBUG-ENHANCED] Successfully combined data for ${result.length} tenants`);
    return { data: result, error: null };

  } catch (error) {
    logger.error(`Exception in fetchTenantsWithSeparateQueries: ${(error as Error).message}`, error);
    console.error(`[DEBUG-ENHANCED] Exception in fetchTenantsWithSeparateQueries:`, error);
    return { data: null, error };
  }
}

/**
 * Enhanced fetch for a specific tenant that includes tenant_units data
 * This version properly integrates rent_amount and rent_due_day from the tenant_units table
 * and includes unit and property information
 */
export async function fetchTenantByIdEnhanced(id: string): Promise<{ data: EnhancedTenantQueryResult | null; error: any }> {
  console.log(`[DEBUG-ENHANCED] Executing fetchTenantByIdEnhanced for tenant ID: ${id}`);

  try {
    // Direct SQL join to get tenant with tenant_unit and unit in one query
    console.log(`[DEBUG-ENHANCED] Fetching tenant ${id} with JOIN to tenant_units and units`);
    const { data: enhancedTenant, error: joinError } = await supabaseAdmin
      .from("tenants")
      .select(`
        *,
        tenant_units (
          *
        ),
        units (
          *,
          properties (
            *
          )
        )
      `)
      .eq("id", id)
      .eq("tenant_units.is_primary", true)
      .maybeSingle();

    if (joinError) {
      logger.error(`Error in JOIN query for tenant ${id}: ${joinError.message}`, joinError);
      console.log(`[DEBUG-ENHANCED] Falling back to separate queries approach for tenant ${id}`);

      // Continue with the original approach as fallback
      return await fetchTenantByIdWithSeparateQueries(id);
    }

    if (!enhancedTenant) {
      console.log(`[DEBUG-ENHANCED] No tenant found with ID: ${id} using JOIN query`);
      // Try the separate queries approach as well
      return await fetchTenantByIdWithSeparateQueries(id);
    }

    console.log(`[DEBUG-ENHANCED] Successfully fetched tenant ${id} with JOIN query`);

    // Log sample of joined data for debugging
    console.log(`[DEBUG-ENHANCED] Joined tenant data structure:`,
      JSON.stringify(enhancedTenant, null, 2).substring(0, 500) + "...");    // tenant_units will be an array - get the primary one
    const primaryTenantUnit = Array.isArray(enhancedTenant.tenant_units) && enhancedTenant.tenant_units.length > 0
      ? enhancedTenant.tenant_units.find((tu: any) => tu.is_primary === true) || enhancedTenant.tenant_units[0]
      : null;

    console.log(`[DEBUG-ENHANCED] Found primary tenant_unit for tenant ${id}:`, primaryTenantUnit?.id || 'None');

    // Transform the data to match our expected output format
    const result = {
      ...enhancedTenant,
      // Use tenant_units data for rent values (these are the primary values)
      rent_amount: primaryTenantUnit?.rent_amount !== undefined ? Number(primaryTenantUnit.rent_amount) : null,
      rent_due_day: primaryTenantUnit?.rent_due_day !== undefined ? Number(primaryTenantUnit.rent_due_day) : null,
      unit_id: primaryTenantUnit?.unit_id || enhancedTenant.unit_id,
      // Remove the nested tenant_units to avoid duplication
      tenant_units: undefined
    };

    console.log(`[DEBUG-ENHANCED] Successfully transformed tenant ${id} data`);
    return { data: result, error: null };

  } catch (error) {
    logger.error(`Exception in fetchTenantByIdEnhanced for tenant ${id}: ${(error as Error).message}`, error);
    console.error(`[DEBUG-ENHANCED] Exception in fetchTenantByIdEnhanced for tenant ${id}:`, error);

    // Try fallback method if the main one fails
    console.log(`[DEBUG-ENHANCED] Trying fallback method after error for tenant ${id}`);
    return await fetchTenantByIdWithSeparateQueries(id);
  }
}

/**
 * Fallback function that fetches a tenant by ID using separate queries
 * This is used when the JOIN query fails
 */
async function fetchTenantByIdWithSeparateQueries(id: string): Promise<{ data: EnhancedTenantQueryResult | null; error: any }> {
  console.log(`[DEBUG-ENHANCED] Executing fallback fetchTenantByIdWithSeparateQueries for tenant ID: ${id}`);

  try {
    // 1. Fetch the tenant
    console.log(`[DEBUG-ENHANCED] Fetching tenant with ID: ${id}`);
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (tenantError) {
      logger.error(`Error fetching tenant ${id}: ${tenantError.message}`, tenantError);
      return { data: null, error: tenantError };
    }

    if (!tenant) {
      console.log(`[DEBUG-ENHANCED] No tenant found with ID: ${id}`);
      return { data: null, error: null };
    }

    // 2. Fetch tenant's primary tenant-unit relationship
    console.log(`[DEBUG-ENHANCED] Fetching primary tenant-unit relationship for tenant: ${id}`);
    const { data: primaryTenantUnit, error: tuError } = await supabaseAdmin
      .from("tenant_units")
      .select("*")
      .eq("tenant_id", id)
      .eq("is_primary", true)
      .maybeSingle();

    if (tuError) {
      logger.error(`Error fetching tenant_units for tenant ${id}: ${tuError.message}`, tuError);
      console.log(`[DEBUG-ENHANCED] Will continue without tenant_units data for tenant ${id}`);
    } else if (primaryTenantUnit) {
      console.log(`[DEBUG-ENHANCED] Found primary tenant-unit relationship for tenant ${id}: unit_id=${primaryTenantUnit.unit_id}, rent_amount=${primaryTenantUnit.rent_amount}, rent_due_day=${primaryTenantUnit.rent_due_day}`);
    } else {
      console.log(`[DEBUG-ENHANCED] No primary tenant-unit relationship found for tenant ${id}`);
    }

    // 3. Determine which unit to fetch
    const unitId = primaryTenantUnit?.unit_id || tenant.unit_id;

    if (!unitId) {
      console.log(`[DEBUG-ENHANCED] No unit ID found for tenant ${id}`);
      // Return tenant without unit info
      return {
        data: {
          ...tenant,
          rent_amount: primaryTenantUnit?.rent_amount !== undefined ? Number(primaryTenantUnit.rent_amount) : null,
          rent_due_day: primaryTenantUnit?.rent_due_day !== undefined ? Number(primaryTenantUnit.rent_due_day) : null,
          unit_id: null,
          units: null
        },
        error: null
      };
    }

    // 4. Fetch the unit with its property
    console.log(`[DEBUG-ENHANCED] Fetching unit ${unitId} with property for tenant ${id}`);
    const { data: unit, error: unitError } = await supabaseAdmin
      .from("units")
      .select(`
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
          updated_at,
          landlord_id
        )
      `)
      .eq("id", unitId)
      .maybeSingle();

    if (unitError) {
      logger.error(`Error fetching unit ${unitId}: ${unitError.message}`, unitError);
      // Return tenant without unit info
      return {
        data: {
          ...tenant,
          rent_amount: primaryTenantUnit?.rent_amount !== undefined ? Number(primaryTenantUnit.rent_amount) : null,
          rent_due_day: primaryTenantUnit?.rent_due_day !== undefined ? Number(primaryTenantUnit.rent_due_day) : null,
          unit_id: unitId,
          units: null
        },
        error: null
      };
    }

    // 5. Combine the data
    console.log(`[DEBUG-ENHANCED] Combining tenant, tenant_unit, and unit data for tenant ${id}`);
    const result = {
      ...tenant,
      rent_amount: primaryTenantUnit?.rent_amount !== undefined ? Number(primaryTenantUnit.rent_amount) : null,
      rent_due_day: primaryTenantUnit?.rent_due_day !== undefined ? Number(primaryTenantUnit.rent_due_day) : null,
      unit_id: unitId,
      units: unit || null
    };

    console.log(`[DEBUG-ENHANCED] Successfully combined data for tenant ${id}`);
    return { data: result, error: null };

  } catch (error) {
    logger.error(`Exception in fetchTenantByIdWithSeparateQueries for tenant ${id}: ${(error as Error).message}`, error);
    console.error(`[DEBUG-ENHANCED] Exception in fetchTenantByIdWithSeparateQueries for tenant ${id}:`, error);
    return { data: null, error };
  }
}
