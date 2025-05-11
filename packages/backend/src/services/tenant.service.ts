import { logger } from "../utils/logger";
import { Tenant, TenantUnit, supabaseAdmin as dbAdminSupabase } from "../config/database"; // Import Tenant, TenantUnit from database.ts and supabaseAdmin (aliased to avoid conflict if any)
import { TenantQueryResult, UnitQueryResult, fetchAllTenantsQuery, fetchTenantByIdQuery, getAllUnitsQuery, createOrUpdateTenantUnitQuery, supabaseAdmin as queriesAdminSupabase } from "./tenant.queries"; // Import adminSupabase from tenant.queries
import { transformTenantQueryResult } from "./tenant.utils";
import { supabase } from "../config/database"; // Keep supabase for anon if needed elsewhere, though admin should be primary here

/**
 * Validates tenant basic fields (first name, last name, phone)
 */
function validateBasicTenantFields(tenantFields: Partial<Pick<Tenant, "first_name" | "last_name" | "phone">>, isCreate: boolean = false): void {
  if (isCreate || tenantFields.first_name !== undefined) {
    if (!tenantFields.first_name?.trim()) {
      throw new Error("First name is required");
    }
  }

  if (isCreate || tenantFields.last_name !== undefined) {
    if (!tenantFields.last_name?.trim()) {
      throw new Error("Last name is required");
    }
  }

  if (isCreate || tenantFields.phone !== undefined) {
    if (!tenantFields.phone?.trim()) {
      throw new Error("Phone number is required");
    }
  }
}

/**
 * Validates rent amount and due day values
 */
function validateRentDetails(rentAmount: any, rentDueDay: any, isRequired: boolean = false): { validatedRentAmount: number | undefined, validatedRentDueDay: number | undefined } {
  let validatedRentAmount = rentAmount;
  let validatedRentDueDay = rentDueDay;

  if (isRequired) {
    if (validatedRentAmount === undefined || validatedRentAmount === null || (typeof validatedRentAmount === 'number' && isNaN(validatedRentAmount))) {
      throw new Error("Rent amount is required");
    }

    if (validatedRentDueDay === undefined || validatedRentDueDay === null || (typeof validatedRentDueDay === 'number' && isNaN(validatedRentDueDay))) {
      throw new Error("Rent due day is required");
    }
  } else {
    // Handle default values for non-required fields
    if (validatedRentAmount === undefined || validatedRentAmount === null ||
      (typeof validatedRentAmount === 'number' && isNaN(validatedRentAmount))) {
      validatedRentAmount = 0;
      console.log(`Using default rent_amount: 0`);
    }

    if (validatedRentDueDay === undefined || validatedRentDueDay === null ||
      (typeof validatedRentDueDay === 'number' && isNaN(validatedRentDueDay))) {
      validatedRentDueDay = 1;
      console.log(`Using default rent_due_day: 1`);
    }
  }

  // Validate rent amount if defined
  if (validatedRentAmount !== undefined) {
    if (typeof validatedRentAmount === 'number' && validatedRentAmount < 0) {
      throw new Error("Rent amount cannot be negative");
    }
  }

  // Validate rent due day if defined
  if (validatedRentDueDay !== undefined) {
    if (typeof validatedRentDueDay === 'number' && (validatedRentDueDay < 1 || validatedRentDueDay > 31)) {
      throw new Error("Rent due day must be between 1 and 31");
    }
  }

  return { validatedRentAmount, validatedRentDueDay };
}

/**
 * Normalizes rent amount to a number
 */
function normalizeRentAmount(rentAmount: any): number {
  if (typeof rentAmount === 'number') {
    return rentAmount;
  } else if (typeof rentAmount === 'string') {
    return parseFloat(rentAmount) || 0;
  }
  return 0;
}

/**
 * Normalizes rent due day to a number
 */
function normalizeRentDueDay(rentDueDay: any): number {
  if (typeof rentDueDay === 'number') {
    return rentDueDay;
  } else if (typeof rentDueDay === 'string') {
    return parseInt(rentDueDay, 10) || 1;
  }
  return 1;
}

/**
 * Creates or updates tenant-unit relationship
 */
async function manageTenantUnitRelationship(
  tenantId: string,
  unitId: string | undefined,
  rentAmount: any | undefined,
  rentDueDay: any | undefined,
  isUpdate: boolean = false
): Promise<void> {
  if (!unitId) return;

  try {
    const finalRentAmount = normalizeRentAmount(rentAmount);
    const finalRentDueDay = normalizeRentDueDay(rentDueDay);

    console.log(`[manageTenantUnitRelationship] Final rent values: amount=${finalRentAmount}, due_day=${finalRentDueDay}`);

    // For update, check if relationship exists
    if (isUpdate) {
      const { data: existingRelation, error: fetchRelationError } = await queriesAdminSupabase // Use adminSupabase from tenant.queries
        .from("tenant_units")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_primary", true)
        .maybeSingle();

      if (fetchRelationError) {
        logger.error(`Error fetching tenant-unit relationship:`, fetchRelationError);
        console.log(`Error fetching tenant-unit relationship:`, fetchRelationError);
        return;
      }

      if (existingRelation) {
        // Update existing relationship
        const updateData: any = {};

        if (unitId !== undefined && unitId !== existingRelation.unit_id) {
          updateData.unit_id = unitId;
          console.log(`Changing unit_id from ${existingRelation.unit_id} to ${unitId}`);
        }

        if (rentAmount !== undefined) {
          updateData.rent_amount = finalRentAmount;
        }

        if (rentDueDay !== undefined) {
          updateData.rent_due_day = finalRentDueDay;
        }

        if (Object.keys(updateData).length > 0) {
          console.log(`Updating tenant_units with data:`, updateData);

          const { error: updateRelationError, data: updateResult } = await queriesAdminSupabase // Use adminSupabase from tenant.queries
            .from("tenant_units")
            .update(updateData)
            .eq("tenant_id", tenantId)
            .eq("unit_id", existingRelation.unit_id)
            .select();

          if (updateRelationError) {
            logger.error(`Error updating tenant-unit relationship:`, updateRelationError);
            console.log(`Error updating tenant-unit relationship:`, updateRelationError);
          } else {
            console.log(`Successfully updated tenant_units relationship:`, updateResult);
            await verifyTenantUnitRelationship(tenantId, updateData.unit_id || existingRelation.unit_id);
          }
        }
        return;
      }
    }

    // Create new relationship (for both new tenant and updating tenant with no existing relationship)
    const tenantUnitData = {
      tenant_id: tenantId,
      unit_id: unitId,
      is_primary: true,
      lease_start: new Date().toISOString(),
      rent_amount: finalRentAmount,
      rent_due_day: finalRentDueDay
    };

    console.log(`Creating tenant-unit relationship with data:`, JSON.stringify(tenantUnitData));

    const { data: relationshipResult, error: relationError } = await queriesAdminSupabase // Use adminSupabase from tenant.queries
      .from("tenant_units")
      .insert([tenantUnitData])
      .select();

    if (relationError) {
      logger.error(`Error creating tenant-unit relationship:`, relationError);
      console.log(`Error creating tenant-unit relationship:`, relationError);
    } else {
      console.log(`Successfully created tenant-unit relationship:`, relationshipResult);
      await verifyTenantUnitRelationship(tenantId, unitId);
    }
  } catch (err) {
    console.log(`Exception in manageTenantUnitRelationship:`, err);
    logger.error(`Exception in manageTenantUnitRelationship:`, err);
  }
}

/**
 * Verify tenant-unit relationship was properly created/updated
 */
async function verifyTenantUnitRelationship(tenantId: string, unitId: string): Promise<void> {
  const { data: verifyData, error: verifyError } = await queriesAdminSupabase // Use adminSupabase from tenant.queries
    .from("tenant_units")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("unit_id", unitId)
    .single();

  if (verifyError) {
    console.log(`Error verifying tenant-unit relationship:`, verifyError);
  } else {
    console.log(`Verified tenant-unit relationship - contains:`, verifyData);
  }
}

/**
 * Build final tenant data including unit and property details
 */
async function buildFinalTenantData(tenantData: any, tenantId: string): Promise<Tenant> {
  let finalTenantData: Tenant = {
    ...tenantData,
    unit_id: undefined,
    unit_number: undefined,
    property_name: undefined,
    rent_amount: undefined,
    rent_due_day: undefined
  };

  const { data: directTenantUnit, error: directError } = await queriesAdminSupabase // Use adminSupabase from tenant.queries
    .from("tenant_units")
    .select("*, units:unit_id(*, properties:property_id(*))")
    .eq("tenant_id", tenantId)
    .eq("is_primary", true)
    .maybeSingle();

  if (directError) {
    console.log(`Error getting direct tenant unit data:`, directError);
    return finalTenantData;
  }

  if (!directTenantUnit) {
    return finalTenantData;
  }

  console.log(`Direct tenant unit data:`, directTenantUnit);

  finalTenantData.unit_id = directTenantUnit.unit_id;
  finalTenantData.rent_amount = directTenantUnit.rent_amount ? parseFloat(directTenantUnit.rent_amount) : undefined;
  finalTenantData.rent_due_day = directTenantUnit.rent_due_day;

  if (directTenantUnit.units) {
    finalTenantData.unit_number = directTenantUnit.units.unit_number;

    if (directTenantUnit.units.properties) {
      const properties = directTenantUnit.units.properties;
      finalTenantData.property_name = properties.name;
    }
  }

  return finalTenantData;
}

/**
 * Extract rent amount from tenant data
 */
function extractRentAmount(data: any, directTenantUnits: any, primaryRelationship: any): number | undefined {
  let parsedRentAmount: number | undefined = undefined;

  if (directTenantUnits?.rent_amount !== undefined) {
    parsedRentAmount = parseFloat(directTenantUnits.rent_amount);
    if (parsedRentAmount === 0) {
      console.log("[getTenantById] Rent amount is exactly 0");
    }
  } else if (primaryRelationship?.rent_amount !== undefined) {
    parsedRentAmount = parseFloat(primaryRelationship.rent_amount);
    if (parsedRentAmount === 0) {
      console.log("[getTenantById] Rent amount from primaryRelationship is exactly 0");
    }
  }

  return parsedRentAmount;
}

/**
 * Get all tenants with unit and property information
 */
export async function getAllTenants(): Promise<Tenant[]> {
  try {
    logger.debug("Entering getAllTenants");
    console.log("Getting all tenants with unit and property info...");

    // Try the fixed query implementation first
    try {
      const { fetchAllTenantsQueryFixed } = require('./tenant.queries.fixed');
      console.log("Using fixed tenants query implementation...");
      const { data, error } = await fetchAllTenantsQueryFixed();

      if (error) {
        logger.error(`Error with fixed query: ${error.message}`, error);
        console.log(`Error with fixed query:`, error);
        throw new Error("Fixed query failed, falling back to original");
      }

      if (data) {
        logger.info(`Fixed query successful - fetched ${data?.length} tenants`);
        console.log(`Fixed query successful - fetched ${data?.length} tenants`);
        return data?.map(transformTenantQueryResult) || [];
      }
    } catch (fixedQueryError) {
      logger.error("Fixed query implementation failed, trying original query", fixedQueryError);
      console.log("Fixed query implementation failed, trying original query", fixedQueryError);
    }

    // Fall back to original query if fixed one fails
    const { data, error } = await fetchAllTenantsQuery();

    if (error) {
      logger.error(`Error fetching tenants: ${error.message}`, error);
      console.log(`Error fetching tenants:`, error);
      throw new Error(`Failed to fetch tenants: ${error.message}`);
    }

    logger.debug(`Fetched ${data?.length} tenants`);
    const transformedData: Tenant[] = data?.map(transformTenantQueryResult) || [];

    logger.debug(`Returning ${transformedData.length} transformed tenants`);
    return transformedData;
  } catch (err) {
    logger.error("Exception in getAllTenants:", err);
    console.log("Exception in getAllTenants:", err);
    throw err;
  }
}

/**
 * Get tenant by ID with unit and property information
 */
export async function getTenantById(id: string): Promise<Tenant | null> {
  try {
    logger.debug(`Entering getTenantById with id: ${id}`);
    console.log(`[getTenantById] Starting to fetch tenant ${id} after delay...`);
    await new Promise(resolve => setTimeout(resolve, 500));

    const cacheBuster = new Date().getTime();
    console.log(`[getTenantById] Using cache buster: ${cacheBuster}`);

    logger.debug(`Executing fetchTenantByIdQuery for id: ${id}`);
    const { data, error } = await fetchTenantByIdQuery(id);

    if (error) {
      logger.error(`Error fetching tenant ${id}: ${error.message}`, error);
      console.log(`Error fetching tenant ${id}:`, error);
      if (error.code === 'PGRST116') { // Resource not found
        logger.debug(`Tenant with id ${id} not found (PGRST116)`);
        return null;
      }
      throw new Error(`Failed to fetch tenant: ${error.message}`);
    }

    if (!data) return null;

    console.log(`[getTenantById] Raw data from database:`, JSON.stringify(data, null, 2));

    return await constructTenantResponse(data, id);
  } catch (err) {
    console.log("Exception in getTenantById:", err);
    throw err;
  }
}

/**
 * Constructs the tenant response object from database data
 */
async function constructTenantResponse(data: any, id: string): Promise<Tenant | null> {
  const primaryRelationship = data.tenant_units?.find((tu: any) => tu.is_primary) || data.tenant_units?.[0];
  console.log(`[getTenantById] Primary relationship for tenant ${id}:`, primaryRelationship);

  if (!primaryRelationship) {
    console.log(`[getTenantById] WARNING: No relationship found for tenant ${id}`);
  }

  const { data: directTenantUnits, error: directError } = await supabase
    .from("tenant_units")
    .select("*")
    .eq("tenant_id", id)
    .eq("is_primary", true)
    .maybeSingle();

  console.log(`[getTenantById] Direct tenant_units query result:`, directTenantUnits);
  console.log(`[getTenantById] Detailed tenant_units data:`, JSON.stringify(directTenantUnits, null, 2));

  if (directError) {
    console.log(`[getTenantById] Error in direct tenant_units query:`, directError);
  }

  const primaryUnit = primaryRelationship?.units;
  const properties = primaryUnit?.properties;

  const parsedRentAmount = extractRentAmount(data, directTenantUnits, primaryRelationship);

  const resultTenant: Tenant = {
    id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email ?? '',
    phone: data.phone,
    created_at: data.created_at,
    updated_at: data.updated_at,
    unit_id: primaryUnit?.id ?? undefined,
    unit_number: primaryUnit?.unit_number ?? undefined,
    property_name: properties?.name ?? undefined,
    rent_amount: parsedRentAmount,
    rent_due_day: directTenantUnits?.rent_due_day ?? primaryRelationship?.rent_due_day ?? undefined,
  };

  console.log(`[getTenantById] Mapped tenant data to return:`, {
    id: resultTenant.id,
    name: `${resultTenant.first_name} ${resultTenant.last_name}`,
    rent_amount: resultTenant.rent_amount,
    rent_due_day: resultTenant.rent_due_day
  });

  return resultTenant;
}

/**
 * Create a new tenant
 */
export async function createTenant(tenantData: Omit<Tenant, "id" | "created_at" | "updated_at">): Promise<Tenant> {
  try {
    console.log("Creating tenant with data:", tenantData);

    const { unit_id, rent_amount, rent_due_day, ...tenantFields } = tenantData;

    // Validate basic tenant fields
    validateBasicTenantFields(tenantFields, true);

    // Validate rent details if unit is provided
    let validatedRentAmount = rent_amount;
    let validatedRentDueDay = rent_due_day;

    if (unit_id) {
      const rentValidation = validateRentDetails(rent_amount, rent_due_day);
      validatedRentAmount = rentValidation.validatedRentAmount;
      validatedRentDueDay = rentValidation.validatedRentDueDay;

      console.log(`[createTenant] Validated rent values: amount=${validatedRentAmount} (${typeof validatedRentAmount}), due_day=${validatedRentDueDay} (${typeof validatedRentDueDay})`);
    }

    // Create tenant record
    const tenant = await createTenantRecord(tenantFields);

    // Create tenant-unit relationship if unit is provided
    if (unit_id) {
      await manageTenantUnitRelationship(tenant.id, unit_id, validatedRentAmount, validatedRentDueDay);
    }

    // Wait for database consistency
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get complete tenant data
    const createdTenant = await getTenantById(tenant.id);

    if (!createdTenant) {
      console.log(`[createTenant] Warning: Could not get complete tenant data, returning basic info`);
      return {
        ...tenant,
        unit_id,
        rent_amount: validatedRentAmount,
        rent_due_day: validatedRentDueDay
      };
    }

    console.log(`[createTenant] Returning complete tenant data:`, {
      id: createdTenant.id,
      name: `${createdTenant.first_name} ${createdTenant.last_name}`,
      unit_id: createdTenant.unit_id,
      rent_amount: createdTenant.rent_amount,
      rent_due_day: createdTenant.rent_due_day
    });

    return createdTenant;
  } catch (err) {
    console.log("Exception in createTenant:", err);
    throw err;
  }
}

/**
 * Creates a tenant record in the database
 */
async function createTenantRecord(tenantFields: Partial<Tenant>): Promise<any> {
  const { data: tenant, error: tenantError } = await queriesAdminSupabase // Use adminSupabase from tenant.queries
    .from("tenants")
    .insert([tenantFields])
    .select()
    .single();

  if (tenantError) {
    logger.error(`Error creating tenant:`, tenantError);
    console.log(`Error creating tenant:`, tenantError);
    throw new Error(`Failed to create tenant: ${JSON.stringify(tenantError)}`);
  }

  if (!tenant) {
    throw new Error("No data returned after creating tenant");
  }

  console.log(`[createTenant] Successfully created tenant:`, {
    id: tenant.id,
    name: `${tenant.first_name} ${tenant.last_name}`
  });

  return tenant;
}

/**
 * Update an existing tenant
 */
export async function updateTenant(id: string, tenantData: Partial<Tenant>): Promise<Tenant | null> {
  try {
    console.log(`[updateTenant] Updating tenant ${id} with data:`, tenantData);

    const { unit_id, unit_number, rent_amount, rent_due_day, ...tenantFields } = tenantData;

    // Validate tenant basic fields
    validateBasicTenantFields(tenantFields);

    const { property_name } = tenantData;

    // Validate rent details if unit is provided
    let validatedRentAmount = rent_amount;
    let validatedRentDueDay = rent_due_day;

    if (unit_id !== undefined) {
      const rentValidation = validateRentDetails(rent_amount, rent_due_day, true);
      validatedRentAmount = rentValidation.validatedRentAmount;
      validatedRentDueDay = rentValidation.validatedRentDueDay;
    } else {
      // Validate only if values are provided
      if (rent_amount !== undefined || rent_due_day !== undefined) {
        const rentValidation = validateRentDetails(rent_amount, rent_due_day);
        validatedRentAmount = rentValidation.validatedRentAmount;
        validatedRentDueDay = rentValidation.validatedRentDueDay;
      }
    }

    console.log(`[updateTenant] Validated rent values:`, {
      amount: validatedRentAmount,
      amount_type: typeof validatedRentAmount,
      due_day: validatedRentDueDay,
      due_day_type: typeof validatedRentDueDay
    });

    // Check if tenant exists
    const tenant = await checkTenantExists(id);
    if (!tenant) {
      return null;
    }

    // Update tenant basic info
    await updateTenantBasicInfo(id, tenantFields);

    // Update unit info
    if (unit_number) {
      await updateUnitInfo(unit_id ?? undefined, { unit_number }); // Handle null for unit_id
    }

    // Update tenant-unit relationship
    if (unit_id !== undefined || validatedRentAmount !== undefined || validatedRentDueDay !== undefined) {
      await manageTenantUnitRelationship(id, unit_id ?? undefined, validatedRentAmount, validatedRentDueDay, true); // Handle null for unit_id
    }

    // Wait for database consistency
    console.log(`[updateTenant] Waiting for database consistency...`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Fetch updated tenant with all information
    const updatedTenant = await getTenantInfo(id);

    console.log(`[updateTenant] Sending final tenant data back to client:`, {
      id: updatedTenant.id,
      name: `${updatedTenant.first_name} ${updatedTenant.last_name}`,
      unit_id: updatedTenant.unit_id,
      rent_amount: updatedTenant.rent_amount,
      rent_due_day: updatedTenant.rent_due_day
    });

    return updatedTenant;
  } catch (err) {
    console.log("Exception in updateTenant:", err);
    throw err;
  }
}

/**
 * Check if tenant exists in the database
 */
async function checkTenantExists(id: string): Promise<any | null> {
  const { data: existingTenant, error: selectError } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .single();

  if (selectError) {
    logger.error(`Error checking tenant existence:`, selectError);
    console.log(`Error checking tenant existence:`, selectError);
    throw new Error(`Failed to check tenant existence: ${JSON.stringify(selectError)}`);
  }

  if (!existingTenant) {
    console.log(`Tenant with id ${id} not found.`);
    return null;
  }

  return existingTenant;
}

/**
 * Update tenant basic information
 */
async function updateTenantBasicInfo(id: string, tenantFields: Partial<Tenant>): Promise<void> {
  if (Object.keys(tenantFields).length === 0) {
    return;
  }

  console.log(`[updateTenant] Updating tenant basic info:`, tenantFields);

  const { first_name, last_name, email, phone } = tenantFields;

  const { error: tenantError } = await queriesAdminSupabase // Use adminSupabase from tenant.queries
    .from("tenants")
    .update({ first_name, last_name, email, phone })
    .eq("id", id);

  if (tenantError) {
    logger.error(`Error updating tenant:`, tenantError);
    console.log(`Error updating tenant:`, tenantError);
    throw new Error(`Failed to update tenant: ${JSON.stringify(tenantError)}`);
  }

  console.log(`[updateTenant] Successfully updated tenant basic info`);
}

/**
 * Fetch complete tenant information including unit and property details
 */
async function getTenantInfo(id: string): Promise<Tenant> {
  const { data: updatedTenant, error: fetchError } = await queriesAdminSupabase // Use adminSupabase from tenant.queries
    .from("tenants")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError) {
    logger.error(`Error fetching updated tenant:`, fetchError);
    console.log(`Error fetching updated tenant:`, fetchError);
    throw new Error(`Failed to fetch updated tenant: ${JSON.stringify(fetchError)}`);
  }

  if (!updatedTenant) {
    throw new Error("No data returned after fetching updated tenant");
  }

  console.log(`[updateTenant] Updated tenant basic info:`, {
    first_name: updatedTenant?.first_name,
    last_name: updatedTenant?.last_name,
    email: updatedTenant?.email,
    phone: updatedTenant?.phone
  });

  return buildFinalTenantData(updatedTenant, id);
}

/**
 * Get all units with property information
 */
export async function getAllUnits() {
  try {
    console.log("Getting all units with property info...");
    const { data, error } = await getAllUnitsQuery();

    if (error) {
      logger.error(`Error fetching units: ${error.message}`, error);
      console.log(`Error fetching units:`, error);
      throw new Error(`Failed to fetch units: ${error.message}`);
    }

    return formatUnits(data);
  } catch (err) {
    console.log("Exception in getAllUnits:", err);
    throw err;
  }
}

/**
 * Format units data for client consumption
 */
function formatUnits(units: any[] | null): any[] {
  return units?.map(unit => ({
    id: unit.id,
    unit_number: unit.unit_number,
    property_name: unit.properties?.name || 'Unknown Property',
    value: unit.id,
    label: `${unit.unit_number} - ${unit.properties?.name || 'Unknown Property'}`
  })) || [];
}

export const tenantService = {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  getAllUnits,
  updateUnitInfo
};

async function updateUnitInfo(unitId: string | undefined, unitData: Partial<{ unit_number: string }>): Promise<void> {
  if (!unitId) return;

  console.log(`[updateUnitInfo] Updating unit ${unitId} with data:`, unitData);

  const { error: unitError } = await queriesAdminSupabase // Use adminSupabase from tenant.queries
    .from("units")
    .update(unitData)
    .eq("id", unitId);

  if (unitError) {
    logger.error(`Error updating unit:`, unitError);
    console.log(`Error updating unit:`, unitError);
    throw new Error(`Failed to update unit: ${JSON.stringify(unitError)}`);
  }

  console.log(`[updateUnitInfo] Successfully updated unit`);
}
