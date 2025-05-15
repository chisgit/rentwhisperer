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
    }    // 3. Create a lookup map for tenant units
    const tenantToUnitMap: Record<string, any> = {};
    if (primaryTenantUnits && primaryTenantUnits.length > 0) {
      primaryTenantUnits.forEach(tu => {
        tenantToUnitMap[tu.tenant_id] = tu;
      });
    }

    // 4. Fetch all units with their properties
    console.log("[DEBUG] Fetching units with properties");
    const { data: units, error: unitsError } = await supabaseAdmin
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
      // Return tenants without unit info
      const basicResult = tenants.map(tenant => ({
        ...tenant,
        rent_amount: null,
        rent_due_day: null,
        units: null
      }));
      return { data: basicResult, error: null };
    }

    console.log(`[DEBUG] Fetched ${units?.length || 0} units`);

    // 5. Create a lookup map for units
    const unitMap: Record<string, any> = {};
    if (units && units.length > 0) {
      units.forEach(unit => {
        unitMap[unit.id] = unit;
      });
    }

    // 6. Combine all data
    console.log("[DEBUG] Combining tenant, tenant_unit, and unit data");
    const result = tenants.map(tenant => {
      // Get the tenant's primary tenant-unit relationship
      const tenantUnit = tenantToUnitMap[tenant.id];

      // Determine unitId to use (from tenant_units if available, fallback to tenant.unit_id)
      const unitId = tenantUnit?.unit_id || tenant.unit_id;

      // Get the unit info
      const unit = unitId ? unitMap[unitId] : null;

      return {
        ...tenant,
        rent_amount: tenantUnit?.rent_amount !== undefined ? Number(tenantUnit.rent_amount) : null,
        rent_due_day: tenantUnit?.rent_due_day !== undefined ? Number(tenantUnit.rent_due_day) : null,
        unit_id: unitId,
        units: unit || null
      };
    });

    console.log(`[DEBUG] Successfully combined data for ${result.length} tenants`);
    return { data: result, error: null };

  } catch (error) {
    logger.error(`Exception in fetchTenantsWithTenantUnits: ${(error as Error).message}`, error);
    console.error(`[DEBUG] Exception in fetchTenantsWithTenantUnits:`, error);
    return { data: null, error };
  }
}

/**
 * Enhanced fetch for a specific tenant that includes tenant_units data
 * This version properly integrates rent_amount and rent_due_day from the tenant_units table
 * and includes unit and property information
 */
export async function fetchTenantByIdEnhanced(id: string): Promise<{ data: EnhancedTenantQueryResult | null; error: any }> {
  console.log(`[DEBUG] Executing fetchTenantByIdEnhanced for tenant ID: ${id}`);

  try {
    // 1. Fetch the tenant
    console.log(`[DEBUG] Fetching tenant with ID: ${id}`);
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
      console.log(`[DEBUG] No tenant found with ID: ${id}`);
      return { data: null, error: null };
    }

    // 2. Fetch tenant's primary tenant-unit relationship
    console.log(`[DEBUG] Fetching primary tenant-unit relationship for tenant: ${id}`);
    const { data: primaryTenantUnit, error: tuError } = await supabaseAdmin
      .from("tenant_units")
      .select("*")
      .eq("tenant_id", id)
      .eq("is_primary", true)
      .maybeSingle();

    if (tuError) {
      logger.error(`Error fetching tenant_units for tenant ${id}: ${tuError.message}`, tuError);
      console.log(`[DEBUG] Will continue without tenant_units data for tenant ${id}`);
    } else if (primaryTenantUnit) {
      console.log(`[DEBUG] Found primary tenant-unit relationship for tenant ${id}: unit_id=${primaryTenantUnit.unit_id}`);
    } else {
      console.log(`[DEBUG] No primary tenant-unit relationship found for tenant ${id}`);
    }

    // 3. Determine which unit to fetch
    const unitId = primaryTenantUnit?.unit_id || tenant.unit_id;

    if (!unitId) {
      console.log(`[DEBUG] No unit ID found for tenant ${id}`);
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
    console.log(`[DEBUG] Fetching unit ${unitId} with property for tenant ${id}`);
    const { data: unit, error: unitError } = await supabaseAdmin
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
    console.log(`[DEBUG] Combining tenant, tenant_unit, and unit data for tenant ${id}`);
    const result = {
      ...tenant,
      rent_amount: primaryTenantUnit?.rent_amount !== undefined ? Number(primaryTenantUnit.rent_amount) : null,
      rent_due_day: primaryTenantUnit?.rent_due_day !== undefined ? Number(primaryTenantUnit.rent_due_day) : null,
      unit_id: unitId,
      units: unit || null
    };

    console.log(`[DEBUG] Successfully combined data for tenant ${id}`);
    return { data: result, error: null };

  } catch (error) {
    logger.error(`Exception in fetchTenantByIdEnhanced for tenant ${id}: ${(error as Error).message}`, error);
    console.error(`[DEBUG] Exception in fetchTenantByIdEnhanced for tenant ${id}:`, error);
    return { data: null, error };
  }
}
