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
function validateRentDetails(rentAmount: any, rentDueDay: any, isRequired: boolean = false): { validatedRentAmount: number | null | undefined, validatedRentDueDay: number | null | undefined } {
  let validatedRentAmount = normalizeRentAmount(rentAmount);
  let validatedRentDueDay = normalizeRentDueDay(rentDueDay);

  if (isRequired) {
    if (validatedRentAmount === null || validatedRentAmount === undefined) {
      throw new Error("Rent amount is required");
    }

    if (validatedRentDueDay === null || validatedRentDueDay === undefined) {
      throw new Error("Rent due day is required");
    }
  } else {
    // If not required, null is acceptable. Only default if undefined.
    if (validatedRentAmount === undefined) {
      validatedRentAmount = 0; // Default to 0 if truly undefined, not if explicitly null
      console.log(`Using default rent_amount: 0 because it was undefined`);
    }

    if (validatedRentDueDay === undefined) {
      validatedRentDueDay = 1; // Default to 1 if truly undefined, not if explicitly null
      console.log(`Using default rent_due_day: 1 because it was undefined`);
    }
  }

  // Validate rent amount if not null or undefined
  if (validatedRentAmount !== null && validatedRentAmount !== undefined) {
    if (validatedRentAmount < 0) {
      throw new Error("Rent amount cannot be negative");
    }
  }

  // Validate rent due day if not null or undefined
  if (validatedRentDueDay !== null && validatedRentDueDay !== undefined) {
    if (validatedRentDueDay < 1 || validatedRentDueDay > 31) {
      throw new Error("Rent due day must be between 1 and 31");
    }
  }

  return { validatedRentAmount, validatedRentDueDay };
}

/**
 * Normalizes rent amount to a number or null
 */
function normalizeRentAmount(rentAmount: any): number | null {
  if (rentAmount === null || rentAmount === undefined) return null;
  if (typeof rentAmount === 'number') return isNaN(rentAmount) ? null : rentAmount;
  if (typeof rentAmount === 'string') {
    if (rentAmount.trim() === "") return null; // Empty string means NULL
    const num = parseFloat(rentAmount);
    return isNaN(num) ? null : num;
  }
  console.log(`[normalizeRentAmount] Unhandled type for rentAmount: ${typeof rentAmount}, value: ${rentAmount}. Returning null.`);
  return null;
}

/**
 * Normalizes rent due day to a number or null
 */
function normalizeRentDueDay(rentDueDay: any): number | null {
  if (rentDueDay === null || rentDueDay === undefined) return null;
  if (typeof rentDueDay === 'number') return isNaN(rentDueDay) ? null : rentDueDay;
  if (typeof rentDueDay === 'string') {
    if (rentDueDay.trim() === "") return null; // Empty string means NULL
    const num = parseInt(rentDueDay, 10);
    return isNaN(num) ? null : num;
  }
  console.log(`[normalizeRentDueDay] Unhandled type for rentDueDay: ${typeof rentDueDay}, value: ${rentDueDay}. Returning null.`);
  return null;
}

/**
 * Creates or updates tenant-unit relationship
 * Supporting multiple units per tenant with one primary unit
 */
async function manageTenantUnitRelationship(
  tenantId: string,
  unitId: string | undefined,
  rentAmount: any | undefined,
  rentDueDay: any | undefined,
  isUpdate: boolean = false
): Promise<void> {
  console.log(`[DEBUG-MANAGE] manageTenantUnitRelationship called with params:`, {
    tenantId,
    unitId,
    rentAmount,
    rentDueDay,
    rentAmountType: typeof rentAmount,
    rentDueDayType: typeof rentDueDay,
    isUpdate
  });

  if (!unitId) {
    console.log(`[DEBUG-MANAGE] No unitId provided, returning early`);
    return;
  }

  try {
    console.log(`[DEBUG-MANAGE] Before normalization: rentAmount=${rentAmount}, rentDueDay=${rentDueDay}`);
    const finalRentAmount = normalizeRentAmount(rentAmount);
    const finalRentDueDay = normalizeRentDueDay(rentDueDay);
    console.log(`[DEBUG-MANAGE] After normalization: finalRentAmount=${finalRentAmount}, finalRentDueDay=${finalRentDueDay}`);

    console.log(`[manageTenantUnitRelationship] Final rent values: amount=${finalRentAmount}, due_day=${finalRentDueDay}`);

    // For update, check if relationship exists
    if (isUpdate) {
      console.log(`[DEBUG-MANAGE] Fetching existing tenant-unit relationships for tenant ${tenantId}`);
      // Get all tenant-unit relationships for this tenant
      const { data: existingRelations, error: fetchRelationError } = await queriesAdminSupabase
        .from("tenant_units")
        .select("*")
        .eq("tenant_id", tenantId)
        .order('is_primary', { ascending: false }); // Get primary units first

      if (fetchRelationError) {
        logger.error(`Error fetching tenant-unit relationships:`, fetchRelationError);
        console.log(`[DEBUG-MANAGE] Error fetching tenant-unit relationships:`, fetchRelationError);
        return;
      }

      console.log(`[DEBUG-MANAGE] Found ${existingRelations?.length || 0} existing relationships for tenant ${tenantId}`);
      if (existingRelations?.length) {
        console.log(`[DEBUG-MANAGE] First relation: ID=${existingRelations[0].id}, unit_id=${existingRelations[0].unit_id}, is_primary=${existingRelations[0].is_primary}`);
        console.log(`[DEBUG-MANAGE] First relation rent: amount=${existingRelations[0].rent_amount}, due_day=${existingRelations[0].rent_due_day}`);
      }

      // Find primary relationship if exists
      const primaryRelation = existingRelations?.find(rel => rel.is_primary);
      console.log(`[DEBUG-MANAGE] Primary relation found: ${primaryRelation ? 'YES' : 'NO'}`);
      if (primaryRelation) {
        console.log(`[DEBUG-MANAGE] Primary relation details: ID=${primaryRelation.id}, unit_id=${primaryRelation.unit_id}`);
        console.log(`[DEBUG-MANAGE] Primary relation rent: amount=${primaryRelation.rent_amount}, due_day=${primaryRelation.rent_due_day}`);
      }

      // Find if the tenant already has a relation with the unitId we're trying to assign
      const existingUnitRelation = unitId ? existingRelations?.find(rel => rel.unit_id === unitId) : null;
      console.log(`[DEBUG-MANAGE] Relation with target unit ${unitId} found: ${existingUnitRelation ? 'YES' : 'NO'}`);
      if (existingUnitRelation) {
        console.log(`[DEBUG-MANAGE] Target unit relation details: ID=${existingUnitRelation.id}, is_primary=${existingUnitRelation.is_primary}`);
      }

      if (primaryRelation) {
        // Case 1: There's a primary relationship already

        if (existingUnitRelation && existingUnitRelation.id === primaryRelation.id) {
          // We're updating the existing primary unit's details
          const updateData: any = {};

          if (rentAmount !== undefined) {
            updateData.rent_amount = finalRentAmount;
          }

          if (rentDueDay !== undefined) {
            updateData.rent_due_day = finalRentDueDay;
          }

          if (Object.keys(updateData).length > 0) {
            console.log(`[manageTenantUnitRelationship] Updating existing primary unit relation: ${JSON.stringify(updateData)}`);

            const { error: updateError } = await queriesAdminSupabase
              .from("tenant_units")
              .update(updateData)
              .eq("tenant_id", tenantId)
              .eq("unit_id", primaryRelation.unit_id)
              .select();

            if (updateError) {
              logger.error(`Error updating primary tenant-unit relationship:`, updateError);
              console.log(`Error updating primary tenant-unit relationship:`, updateError);
            } else {
              console.log(`Successfully updated primary tenant-unit relationship`);
              if (unitId) {
                await verifyTenantUnitRelationship(tenantId, unitId);
              }
            }
          }
        }
        else if (existingUnitRelation && !existingUnitRelation.is_primary) {
          // We're promoting a non-primary to primary and demoting the current primary
          console.log(`Promoting unit ${unitId} to primary and demoting unit ${primaryRelation.unit_id}`);

          // Update the current primary to non-primary
          const { error: demoteError } = await queriesAdminSupabase
            .from("tenant_units")
            .update({ is_primary: false })
            .eq("tenant_id", tenantId)
            .eq("unit_id", primaryRelation.unit_id);

          if (demoteError) {
            logger.error(`Error demoting current primary tenant-unit:`, demoteError);
            console.log(`Error demoting current primary tenant-unit:`, demoteError);
            return;
          }

          // Promote new primary and update rent details
          const { error: promoteError } = await queriesAdminSupabase
            .from("tenant_units")
            .update({
              is_primary: true,
              rent_amount: finalRentAmount !== undefined ? finalRentAmount : existingUnitRelation.rent_amount,
              rent_due_day: finalRentDueDay !== undefined ? finalRentDueDay : existingUnitRelation.rent_due_day
            })
            .eq("tenant_id", tenantId)
            .eq("unit_id", existingUnitRelation.unit_id);

          if (promoteError) {
            logger.error(`Error promoting new primary tenant-unit:`, promoteError);
            console.log(`Error promoting new primary tenant-unit:`, promoteError);
          } else {
            console.log(`Successfully updated tenant-unit primary relationship`);
            if (unitId) {
              await verifyTenantUnitRelationship(tenantId, unitId);
            }
          }
        }
        else {
          // We need to add a new unit and make it primary, demoting the current primary
          console.log(`Adding new primary unit ${unitId} and demoting current primary unit ${primaryRelation.unit_id}`);

          // Demote current primary
          const { error: demoteError } = await queriesAdminSupabase
            .from("tenant_units")
            .update({ is_primary: false })
            .eq("tenant_id", tenantId)
            .eq("unit_id", primaryRelation.unit_id);

          if (demoteError) {
            logger.error(`Error demoting current primary tenant-unit:`, demoteError);
            console.log(`Error demoting current primary tenant-unit:`, demoteError);
            return;
          }

          // Create new primary unit relation
          const { error: insertError } = await queriesAdminSupabase
            .from("tenant_units")
            .insert([{
              tenant_id: tenantId,
              unit_id: unitId,
              is_primary: true,
              lease_start: new Date().toISOString(),
              rent_amount: finalRentAmount,
              rent_due_day: finalRentDueDay
            }]);

          if (insertError) {
            logger.error(`Error creating new primary tenant-unit:`, insertError);
            console.log(`Error creating new primary tenant-unit:`, insertError);
          } else {
            console.log(`Successfully created new primary tenant-unit relationship`);
            if (unitId) {
              await verifyTenantUnitRelationship(tenantId, unitId);
            }
          }
        }
      }
      else {
        // No primary relationship exists, create one
        await createNewPrimaryRelationship();
      }
    }
    else {
      // New tenant, create primary relationship
      await createNewPrimaryRelationship();
    }

    // Helper function to create a new primary relationship
    async function createNewPrimaryRelationship() {
      const tenantUnitData = {
        tenant_id: tenantId,
        unit_id: unitId,
        is_primary: true,
        lease_start: new Date().toISOString(),
        rent_amount: finalRentAmount,
        rent_due_day: finalRentDueDay
      };

      console.log(`Creating new primary tenant-unit relationship with data:`, JSON.stringify(tenantUnitData));

      const { data: relationshipResult, error: relationError } = await queriesAdminSupabase
        .from("tenant_units")
        .insert([tenantUnitData])
        .select();

      if (relationError) {
        logger.error(`Error creating tenant-unit relationship:`, relationError);
        console.log(`Error creating tenant-unit relationship:`, relationError);
      } else {
        console.log(`Successfully created tenant-unit relationship:`, relationshipResult);
        if (unitId) {
          await verifyTenantUnitRelationship(tenantId, unitId);
        }
      }
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
  try {
    console.log(`[DB-VERIFY] Checking if tenant-unit relationship exists for tenant ${tenantId} and unit ${unitId}`);

    const { data: verifyData, error: verifyError } = await queriesAdminSupabase
      .from("tenant_units")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("unit_id", unitId)
      .single();

    if (verifyError) {
      console.log(`[DB-VERIFY] ERROR - Could not verify tenant-unit relationship:`, verifyError);
      logger.error(`[DB-VERIFY] ERROR - Could not verify tenant-unit relationship:`, verifyError);
    } else if (verifyData) {
      console.log(`[DB-VERIFY] SUCCESS - Tenant-unit relationship verified in database:`, verifyData);
      logger.info(`[DB-VERIFY] Tenant-unit relationship verified for tenant ${tenantId} and unit ${unitId}`);
      console.log(`[DB-VERIFY] Rent Amount: ${verifyData.rent_amount}, Rent Due Day: ${verifyData.rent_due_day}`);
    } else {
      console.log(`[DB-VERIFY] WARNING - No tenant-unit relationship found for tenant ${tenantId} and unit ${unitId}`);
      logger.warn(`[DB-VERIFY] No tenant-unit relationship found for tenant ${tenantId} and unit ${unitId}`);
    }
  } catch (err) {
    console.log(`[DB-VERIFY] EXCEPTION in verifyTenantUnitRelationship:`, err);
    logger.error(`[DB-VERIFY] Exception in verifyTenantUnitRelationship:`, err);
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
    property_id: undefined,
    property_name: undefined,
    property_address: undefined,
    property_city: undefined,
    property_province: undefined,
    property_postal_code: undefined,
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
      finalTenantData.property_id = properties.id;
      finalTenantData.property_name = properties.name;
      finalTenantData.property_address = properties.address;
      finalTenantData.property_city = properties.city;
      finalTenantData.property_province = properties.province;
      finalTenantData.property_postal_code = properties.postal_code;
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

    try {
      const { fetchTenantsWithTenantUnits } = require('./tenant.queries.enhanced');
      console.log("Using enhanced tenants query implementation with tenant_units data...");
      const { data, error } = await fetchTenantsWithTenantUnits();


      if (error) {
        logger.error(`Error with enhanced query: ${error.message}`, error);
        console.log(`Error with enhanced query:`, error);
        throw new Error("Enhanced query failed, falling back to fixed query");
      }

      if (data) {
        logger.info(`Enhanced query successful - fetched ${data?.length} tenants with unit, property and rent information`);
        console.log(`Enhanced query successful - fetched ${data?.length} tenants with unit, property and rent information`);

        // Transform the data to include all property fields
        const transformedData = data.map((tenant: any) => {
          const properties = tenant.units?.properties;
          return {
            ...tenant,
            property_id: properties?.id,
            property_name: properties?.name,
            property_address: properties?.address,
            property_city: properties?.city,
            property_province: properties?.province,
            property_postal_code: properties?.postal_code
          };
        });

        return transformedData;
      }
    } catch (enhancedQueryError) {
      logger.error("Enhanced query implementation failed, trying fixed query", enhancedQueryError);
      console.log("Enhanced query implementation failed, trying fixed query", enhancedQueryError);
    }

    // Fall back to fixed query if enhanced one fails
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

    // Fall back to original query if enhanced and fixed ones fail
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

    // Try the enhanced query implementation first
    try {
      const { fetchTenantByIdEnhanced } = require('./tenant.queries.enhanced');
      console.log(`[getTenantById] Using enhanced query for tenant ${id}...`);
      const { data: enhancedData, error: enhancedError } = await fetchTenantByIdEnhanced(id);

      if (enhancedError) {
        logger.error(`Error with enhanced query for tenant ${id}: ${enhancedError.message}`, enhancedError);
        console.log(`[getTenantById] Error with enhanced query:`, enhancedError);
        throw new Error("Enhanced query failed, falling back to original");
      }

      if (enhancedData) {
        console.log(`[getTenantById] Enhanced query successful - fetched tenant with unit, property and rent information`);

        // Map the enhanced data to Tenant type with complete property information
        const properties = enhancedData.units?.properties;
        const resultTenant: Tenant = {
          id: enhancedData.id,
          first_name: enhancedData.first_name,
          last_name: enhancedData.last_name,
          email: enhancedData.email ?? '',
          phone: enhancedData.phone,
          created_at: enhancedData.created_at,
          updated_at: enhancedData.updated_at,
          unit_id: enhancedData.units?.id,
          unit_number: enhancedData.units?.unit_number,
          property_id: properties?.id,
          property_name: properties?.name,
          property_address: properties?.address,
          property_city: properties?.city,
          property_province: properties?.province,
          property_postal_code: properties?.postal_code,
          rent_amount: enhancedData.rent_amount,
          rent_due_day: enhancedData.rent_due_day,
        };

        console.log(`[getTenantById] Mapped enhanced tenant data to return:`, {
          id: resultTenant.id,
          name: `${resultTenant.first_name} ${resultTenant.last_name}`,
          rent_amount: resultTenant.rent_amount,
          rent_due_day: resultTenant.rent_due_day,
          unit: resultTenant.unit_number,
          property: resultTenant.property_name,
          property_address: resultTenant.property_address
        });

        return resultTenant;
      }
    } catch (enhancedQueryError) {
      logger.error("Enhanced query implementation failed, trying original query", enhancedQueryError);
      console.log("[getTenantById] Enhanced query implementation failed, trying original query", enhancedQueryError);
    }

    // Fall back to original query if enhanced one fails
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
    property_id: properties?.id ?? undefined,
    unit_number: primaryUnit?.unit_number ?? undefined,
    property_name: properties?.name ?? undefined,
    property_address: properties?.address ?? undefined,
    property_city: properties?.city ?? undefined,
    property_province: properties?.province ?? undefined,
    property_postal_code: properties?.postal_code ?? undefined,
    rent_amount: parsedRentAmount,
    rent_due_day: directTenantUnits?.rent_due_day ?? primaryRelationship?.rent_due_day ?? undefined,
  };

  console.log(`[getTenantById] Mapped tenant data to return:`, {
    id: resultTenant.id,
    name: `${resultTenant.first_name} ${resultTenant.last_name}`,
    rent_amount: resultTenant.rent_amount,
    rent_due_day: resultTenant.rent_due_day,
    unit_number: resultTenant.unit_number,
    property_name: resultTenant.property_name
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
 * This function handles both tenant basic info and tenant-unit relationship updates
 */
export async function updateTenant(id: string, tenantData: Partial<Tenant>): Promise<Tenant | null> {
  try {
    console.log(`[updateTenant] Updating tenant ${id} with data:`, JSON.stringify(tenantData, null, 2)); // DEBUG: Stringify for better readability

    // Separate tenant fields from unit-related fields
    const { unit_id, unit_number, rent_amount, rent_due_day, ...tenantFields } = tenantData;

    // Validate tenant basic fields
    validateBasicTenantFields(tenantFields);

    const { property_name } = tenantData;

    // Validate rent details if unit is provided
    let validatedRentAmount = rent_amount;
    let validatedRentDueDay = rent_due_day;

    if (unit_id !== undefined) {
      // If unit_id is provided, rent details are required
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
    console.log(`[updateTenant] DEBUG Values before calling manageTenantUnitRelationship - unit_id: ${unit_id}, validatedRentAmount: ${validatedRentAmount}, validatedRentDueDay: ${validatedRentDueDay}`); // DEBUG log

    // Check if tenant exists
    const tenant = await checkTenantExists(id);
    if (!tenant) {
      console.log(`[updateTenant] Tenant with ID ${id} not found`);
      return null;
    }

    // Update tenant basic info (name, email, phone, etc.)
    await updateTenantBasicInfo(id, tenantFields);    // Update unit info if unit_number is provided
    if (unit_number && unit_id) {
      const unitIdString = String(unit_id);
      await updateUnitInfo(unitIdString, { unit_number });
    }    // Update tenant-unit relationship (handle rent amount, due day, and unit assignment)
    // Update tenant-unit relationship (handle rent amount, due day, and unit assignment)

    // Determine the unit_id to be used for managing the relationship.
    // If unit_id is explicitly provided in the payload, use that.
    // Otherwise, if rent details are being updated, we need to find the current primary unit.
    let unitIdForMgmt: string | undefined = unit_id !== undefined && unit_id !== null ? String(unit_id) : undefined;

    const hasRentDetailsToUpdate = validatedRentAmount !== undefined || validatedRentDueDay !== undefined;

    if (unitIdForMgmt === undefined && hasRentDetailsToUpdate) {
      // unit_id not in payload, but rent details are. Find current primary unit.
      console.log(`[updateTenant] unit_id not provided in payload but rent details are. Fetching current primary unit_id for tenant ${id}.`);
      const { data: primaryTenantUnitRel, error: primaryUnitError } = await queriesAdminSupabase
        .from("tenant_units")
        .select("unit_id") // We only need the unit_id
        .eq("tenant_id", id)
        .eq("is_primary", true)
        .single(); // Assuming a tenant has at most one primary unit

      if (primaryUnitError && primaryUnitError.code !== 'PGRST116') { // PGRST116: 0 rows, meaning no primary unit found
        logger.error(`[updateTenant] Error fetching primary unit_id for tenant ${id} to update rent details:`, primaryUnitError);
        // Depending on desired behavior, could throw an error or simply proceed (rent details won't be updated in tenant_units)
      } else if (primaryTenantUnitRel) {
        unitIdForMgmt = primaryTenantUnitRel.unit_id;
        console.log(`[updateTenant] Found primary unit_id ${unitIdForMgmt} for tenant ${id}. Rent details will be applied to this unit.`);
      } else {
        // No primary unit found, and unit_id was not in payload.
        console.warn(`[updateTenant] No primary unit found for tenant ${id}, and unit_id was not in payload. Rent details cannot be applied to tenant_units.`);
      }
    }

    // Call manageTenantUnitRelationship if:
    // 1. A unit_id was explicitly provided in the payload (unit_id !== undefined). This covers assigning to a new unit, or re-affirming/changing details of an existing assigned unit.
    // 2. Rent details are being updated AND we successfully determined a unit_id for management (unitIdForMgmt is defined).
    //    This covers updating rent details for the current primary unit when unit_id is not in payload.
    if ((unit_id !== undefined) || (hasRentDetailsToUpdate && unitIdForMgmt !== undefined)) {
      // If unit_id was explicitly in the payload (even if null to signify disassociation, though manageTenantUnitRelationship needs a unitId to act),
      // unitIdForMgmt would have been set to String(unit_id) or undefined if unit_id was null.
      // If unit_id was NOT in payload but rent details were, unitIdForMgmt is the fetched primary unit_id (if found).
      // manageTenantUnitRelationship expects a unitId string or undefined. If undefined, it returns early.
      await manageTenantUnitRelationship(id, unitIdForMgmt, validatedRentAmount, validatedRentDueDay, true);
    } else if (hasRentDetailsToUpdate && unitIdForMgmt === undefined) {
      // This specific else-if handles the case where rent details were in the payload,
      // but no unit_id was provided, AND no primary unit could be found for the tenant.
      console.warn(`[updateTenant] Rent details were provided for tenant ${id}, but no unit context (unit_id not in payload, and no primary unit found). Rent details will NOT be updated in the tenant_units table.`);
    }

    // Wait for database consistency
    console.log(`[updateTenant] Waiting for database consistency...`);
    await new Promise(resolve => setTimeout(resolve, 1000));    // Fetch updated tenant with all information (including related unit and property info)
    const updatedTenant = await getTenantInfo(id);

    console.log(`[updateTenant] Sending final tenant data back to client:`, {
      id: updatedTenant.id,
      name: `${updatedTenant.first_name} ${updatedTenant.last_name}`,
      unit_id: updatedTenant.unit_id,
      rent_amount: updatedTenant.rent_amount,
      rent_due_day: updatedTenant.rent_due_day
    });

    // Additional verification to ensure data consistency
    if (unitIdForMgmt && hasRentDetailsToUpdate) {
      console.log(`[FINAL-VERIFY] Doing final verification of tenant-unit relationship...`);
      await verifyTenantUnitRelationship(id, unitIdForMgmt);

      // Double-check direct query to ensure rent details are persisted
      const { data: directCheck } = await queriesAdminSupabase
        .from("tenant_units")
        .select("rent_amount, rent_due_day")
        .eq("tenant_id", id)
        .eq("unit_id", unitIdForMgmt)
        .single();

      if (directCheck) {
        console.log(`[FINAL-VERIFY] Database values: rent_amount=${directCheck.rent_amount}, rent_due_day=${directCheck.rent_due_day}`);
        console.log(`[FINAL-VERIFY] Return values: rent_amount=${updatedTenant.rent_amount}, rent_due_day=${updatedTenant.rent_due_day}`);
      }
    }

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
