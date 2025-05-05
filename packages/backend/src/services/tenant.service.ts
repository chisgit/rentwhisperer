import { logger } from "../utils/logger";
import { Tenant } from "./routes/tenant";
import { TenantQueryResult, UnitQueryResult, supabase, adminSupabase, fetchAllTenantsQuery, fetchTenantByIdQuery, getAllUnitsQuery } from "./tenant.queries";
import { transformTenantQueryResult } from "./tenant.utils";

/**
 * Get all tenants with unit and property information
 */
export async function getAllTenants(): Promise<Tenant[]> {
  try {
    console.log("Getting all tenants with unit and property info...");
    const { data, error } = await fetchAllTenantsQuery();

    if (error) {
      logger.error(`Error fetching tenants: ${error.message}`, error);
      console.log(`Error fetching tenants:`, error);
      throw new Error(`Failed to fetch tenants: ${error.message}`);
    }

    const transformedData: Tenant[] = data?.map(transformTenantQueryResult) || [];

    return transformedData;
  } catch (err) {
    console.log("Exception in getAllTenants:", err);
    throw err;
  }
}

/**
 * Get tenant by ID with unit and property information
 */
export async function getTenantById(id: string): Promise<Tenant | null> {
  try {
    console.log(`[getTenantById] Starting to fetch tenant ${id} after delay...`);
    await new Promise(resolve => setTimeout(resolve, 500));

    const cacheBuster = new Date().getTime();
    console.log(`[getTenantById] Using cache buster: ${cacheBuster}`);

    const { data, error } = await fetchTenantByIdQuery(id);

    if (error) {
      logger.error(`Error fetching tenant ${id}: ${error.message}`, error);
      console.log(`Error fetching tenant ${id}:`, error);
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch tenant: ${error.message}`);
    }

    if (!data) return null;

    console.log(`[getTenantById] Raw data from database:`, JSON.stringify(data, null, 2));

    const primaryRelationship = data.tenant_units?.find((tu) => tu.is_primary) || data.tenant_units?.[0];
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
      rent_due_day: resultTenant.rent_due_day
    });

    return resultTenant;
  } catch (err) {
    console.log("Exception in getTenantById:", err);
    throw err;
  }
}

/**
 * Create a new tenant
 */
export async function createTenant(tenantData: Omit<Tenant, "id" | "created_at" | "updated_at">): Promise<Tenant> {
  try {
    console.log("Creating tenant with data:", tenantData);

    const { unit_id, rent_amount, rent_due_day, ...tenantFields } = tenantData;

    if (!tenantFields.first_name?.trim()) {
      throw new Error("First name is required");
    }

    if (!tenantFields.last_name?.trim()) {
      throw new Error("Last name is required");
    }

    if (!tenantFields.phone?.trim()) {
      throw new Error("Phone number is required");
    }

    let validatedRentAmount = rent_amount;
    let validatedRentDueDay = rent_due_day;

    if (unit_id) {
      if (validatedRentAmount === undefined || validatedRentAmount === null ||
        (typeof validatedRentAmount === 'number' && isNaN(validatedRentAmount))) {
        validatedRentAmount = 0;
        console.log(`[createTenant] Using default rent_amount: 0`);
      }

      if (validatedRentDueDay === undefined || validatedRentDueDay === null ||
        (typeof validatedRentDueDay === 'number' && isNaN(validatedRentDueDay))) {
        validatedRentDueDay = 1;
        console.log(`[createTenant] Using default rent_due_day: 1`);
      }

      if (typeof validatedRentAmount === 'number' && validatedRentAmount < 0) {
        throw new Error("Rent amount cannot be negative");
      }

      if (typeof validatedRentDueDay === 'number' && (validatedRentDueDay < 1 || validatedRentDueDay > 31)) {
        throw new Error("Rent due day must be between 1 and 31");
      }
    }

    console.log(`[createTenant] Validated rent values: amount=${validatedRentAmount} (${typeof validatedRentAmount}), due_day=${validatedRentDueDay} (${typeof validatedRentDueDay})`);

    const { data: tenant, error: tenantError } = await adminSupabase
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

    if (unit_id) {
      const finalRentAmount = typeof validatedRentAmount === 'number'
        ? validatedRentAmount
        : (typeof validatedRentAmount === 'string' ? parseFloat(validatedRentAmount) || 0 : 0);
      const finalRentDueDay = typeof validatedRentDueDay === 'number'
        ? validatedRentDueDay
        : (typeof validatedRentDueDay === 'string' ? parseInt(validatedRentDueDay, 10) || 1 : 1);

      console.log(`[createTenant] Final rent values: amount=${finalRentAmount}, due_day=${finalRentDueDay}`);

      const tenantUnitData = {
        tenant_id: tenant.id,
        unit_id: unit_id,
        is_primary: true,
        lease_start: new Date().toISOString(),
        rent_amount: finalRentAmount,
        rent_due_day: finalRentDueDay
      };

      console.log(`[createTenant] Creating tenant-unit relationship with data:`, JSON.stringify(tenantUnitData));
      console.log(`[createTenant] tenantUnitData.rent_amount (type ${typeof tenantUnitData.rent_amount}): `, tenantUnitData.rent_amount);
      console.log(`[createTenant] tenantUnitData.rent_due_day (type ${typeof tenantUnitData.rent_due_day}): `, tenantUnitData.rent_due_day);

      const { data: relationshipResult, error: relationError } = await adminSupabase
        .from("tenant_units")
        .insert([tenantUnitData])
        .select();

      if (relationError) {
        logger.error(`Error creating tenant-unit relationship:`, relationError);
        console.log(`[createTenant] Error creating tenant-unit relationship:`, relationError);
      } else {
        console.log(`[createTenant] Successfully created tenant-unit relationship:`, relationshipResult);

        const { data: verifyData, error: verifyError } = await adminSupabase
          .from("tenant_units")
          .select("*")
          .eq("tenant_id", tenant.id)
          .eq("unit_id", unit_id)
          .single();

        if (verifyError) {
          console.log(`[createTenant] Error verifying tenant-unit relationship:`, verifyError);
        } else {
          console.log(`[createTenant] Verified tenant-unit relationship - contains:`, verifyData);
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));

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
 * Update an existing tenant
 */
export async function updateTenant(id: string, tenantData: Partial<Tenant>): Promise<Tenant | null> {
  try {
    console.log(`[updateTenant] Updating tenant ${id} with data:`, tenantData);

    const { unit_id, unit_number, property_name, property_address, property_city, property_province, property_postal_code, rent_amount, rent_due_day, ...tenantFields } = tenantData;

    if (tenantFields.first_name !== undefined && !tenantFields.first_name?.trim()) {
      throw new Error("First name is required");
    }

    if (tenantFields.last_name !== undefined && !tenantFields.last_name?.trim()) {
      throw new Error("Last name is required");
    }

    if (tenantFields.phone !== undefined && !tenantFields.phone?.trim()) {
      throw new Error("Phone number is required");
    }

    if (unit_id !== undefined) {
      if (rent_amount === undefined || rent_amount === null || (typeof rent_amount === 'number' && isNaN(rent_amount))) {
        throw new Error("Rent amount is required");
      }

      if (rent_due_day === undefined || rent_due_day === null || (typeof rent_due_day === 'number' && isNaN(rent_due_day))) {
        throw new Error("Rent due day is required");
      }

      if (typeof rent_amount === 'number' && rent_amount < 0) {
        throw new Error("Rent amount cannot be negative");
      }

      if (typeof rent_due_day === 'number' && (rent_due_day < 1 || rent_due_day > 31)) {
        throw new Error("Rent due day must be between 1 and 31");
      }
    } else {
      if (rent_amount !== undefined && (typeof rent_amount !== 'number' || isNaN(rent_amount) || rent_amount < 0)) {
        throw new Error("Rent amount must be a non-negative number");
      }

      if (rent_due_day !== undefined && (typeof rent_due_day !== 'number' || isNaN(rent_due_day) || rent_due_day < 1 || rent_due_day > 31)) {
        throw new Error("Rent due day must be a number between 1 and 31");
      }
    }

    const validatedRentAmount = rent_amount;
    const validatedRentDueDay = rent_due_day;

    console.log(`[updateTenant] Validated rent values:`, {
      amount: validatedRentAmount,
      amount_type: typeof validatedRentAmount,
      due_day: validatedRentDueDay,
      due_day_type: typeof validatedRentDueDay
    });

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

    console.log(`[updateTenant] Updating tenant basic info:`, tenantFields);

    const { error: tenantError } = await adminSupabase
      .from("tenants")
      .update(tenantFields)
      .eq("id", id);

    if (tenantError) {
      logger.error(`Error updating tenant:`, tenantError);
      console.log(`Error updating tenant:`, tenantError);
      throw new Error(`Failed to update tenant: ${JSON.stringify(tenantError)}`);
    } else {
      console.log(`[updateTenant] Successfully updated tenant basic info`);
    }

    const { data: updatedTenant, error: fetchError } = await adminSupabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      logger.error(`Error fetching updated tenant:`, fetchError);
      console.log(`Error fetching updated tenant:`, fetchError);
      throw new Error(`Failed to fetch updated tenant: ${JSON.stringify(fetchError)}`);
    }

    console.log(`[updateTenant] Updated tenant basic info:`, {
      first_name: updatedTenant?.first_name,
      last_name: updatedTenant?.last_name,
      email: updatedTenant?.email,
      phone: updatedTenant?.phone
    });

    if (unit_id !== undefined || validatedRentAmount !== undefined || validatedRentDueDay !== undefined) {
      try {
        const { data: existingRelation, error: fetchRelationError } = await adminSupabase
          .from("tenant_units")
          .select("*")
          .eq("tenant_id", id)
          .eq("is_primary", true)
          .maybeSingle();

        if (fetchRelationError) {
          logger.error(`Error fetching tenant-unit relationship:`, fetchRelationError);
          console.log(`[updateTenant] Error fetching tenant-unit relationship:`, fetchRelationError);
        }

        if (existingRelation) {
          const updateData: any = {};

          if (unit_id !== undefined && unit_id !== existingRelation.unit_id) {
            updateData.unit_id = unit_id;
            console.log(`[updateTenant] Changing unit_id from ${existingRelation.unit_id} to ${unit_id}`);

            if (validatedRentAmount === undefined) {
              updateData.rent_amount = 0;
              console.log(`[updateTenant] Setting default rent_amount to 0 for unit change`);
            }

            if (validatedRentDueDay === undefined) {
              updateData.rent_due_day = 1;
              console.log(`[updateTenant] Setting default rent_due_day to 1 for unit change`);
            }
          }

          if (validatedRentAmount !== undefined) {
            const finalRentAmount = typeof validatedRentAmount === 'number'
              ? validatedRentAmount
              : typeof validatedRentAmount === 'string'
                ? parseFloat(validatedRentAmount) || 0
                : 0;

            updateData.rent_amount = finalRentAmount;
            console.log(`[updateTenant] Setting rent_amount to ${finalRentAmount} (original: ${validatedRentAmount})`);
          }

          if (validatedRentDueDay !== undefined) {
            const finalRentDueDay = typeof validatedRentDueDay === 'number'
              ? validatedRentDueDay
              : typeof validatedRentDueDay === 'string'
                ? parseInt(validatedRentDueDay, 10) || 1
                : 1;

            updateData.rent_due_day = finalRentDueDay;
            console.log(`[updateTenant] Setting rent_due_day to ${finalRentDueDay} (original: ${validatedRentDueDay})`);
          }

          if (Object.keys(updateData).length > 0) {
            console.log(`[updateTenant] Updating tenant_units with data:`, updateData);

            const { error: updateRelationError, data: updateResult } = await adminSupabase
              .from("tenant_units")
              .update(updateData)
              .eq("tenant_id", id)
              .eq("unit_id", existingRelation.unit_id)
              .select();

            console.log(`[updateTenant] Update result:`, updateResult);

            if (updateRelationError) {
              logger.error(`Error updating tenant-unit relationship:`, updateRelationError);
              console.log(`[updateTenant] Error updating tenant-unit relationship:`, updateRelationError);
            } else {
              console.log(`[updateTenant] Successfully updated tenant_units relationship`);

              const { data: verifyData, error: verifyError } = await adminSupabase
                .from("tenant_units")
                .select("*")
                .eq("tenant_id", id)
                .eq("unit_id", updateData.unit_id || existingRelation.unit_id)
                .single();

              if (verifyError) {
                console.log(`[updateTenant] Error verifying update:`, verifyError);
              } else {
                console.log(`[updateTenant] Verified update - tenant_units now contains:`, verifyData);
              }
            }
          }
        } else if (unit_id !== undefined) {
          console.log(`[updateTenant] No existing relation found, creating new tenant-unit relationship`);

          const finalRentAmount = typeof validatedRentAmount === 'number'
            ? validatedRentAmount
            : typeof validatedRentAmount === 'string'
              ? parseFloat(validatedRentAmount) || 0
              : 0;

          const finalRentDueDay = typeof validatedRentDueDay === 'number'
            ? validatedRentDueDay
            : typeof validatedRentDueDay === 'string'
              ? parseInt(validatedRentDueDay, 10) || 1
              : 1;

          const tenantUnitData = {
            tenant_id: id,
            unit_id: unit_id,
            is_primary: true,
            lease_start: new Date().toISOString(),
            rent_amount: finalRentAmount,
            rent_due_day: finalRentDueDay
          };

          console.log(`[updateTenant] Creating tenant-unit relationship with data:`, tenantUnitData);

          const { data: insertResult, error: insertRelationError } = await adminSupabase
            .from("tenant_units")
            .insert([tenantUnitData])
            .select();

          if (insertRelationError) {
            logger.error(`Error creating tenant-unit relationship:`, insertRelationError);
            console.log(`[updateTenant] Error creating tenant-unit relationship:`, insertRelationError);
          } else {
            console.log(`[updateTenant] Successfully created tenant-unit relationship:`, insertResult);
          }
        }
      } catch (relationError) {
        console.log(`[updateTenant] Exception in tenant-unit relationship handling:`, relationError);
        logger.error(`Exception in tenant-unit relationship handling:`, relationError);
      }
    }

    if (!updatedTenant) {
      throw new Error("No data returned after fetching updated tenant");
    }

    console.log(`[updateTenant] Waiting for database consistency...`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    let finalTenantData: Tenant = {
      ...updatedTenant,
      unit_id: undefined,
      unit_number: undefined,
      property_name: undefined,
      property_address: undefined,
      property_city: undefined,
      property_province: undefined,
      property_postal_code: undefined,
      rent_amount: undefined,
      rent_due_day: undefined
    };

    const { data: directTenantUnit, error: directError } = await adminSupabase
      .from("tenant_units")
      .select("*, units:unit_id(*, properties:property_id(*))")
      .eq("tenant_id", id)
      .eq("is_primary", true)
      .maybeSingle();

    if (directError) {
      console.log(`[updateTenant] Error getting direct tenant unit data:`, directError);
    } else if (directTenantUnit) {
      console.log(`[updateTenant] Direct tenant unit data:`, directTenantUnit);

      finalTenantData.unit_id = directTenantUnit.unit_id;
      finalTenantData.rent_amount = directTenantUnit.rent_amount ? parseFloat(directTenantUnit.rent_amount) : undefined;
      finalTenantData.rent_due_day = directTenantUnit.rent_due_day;

      if (directTenantUnit.units) {
        finalTenantData.unit_number = directTenantUnit.units.unit_number;

        if (directTenantUnit.units.properties) {
          const properties = directTenantUnit.units.properties;
          finalTenantData.property_name = properties.name;
          finalTenantData.property_address = properties.address;
          finalTenantData.property_city = properties.city;
          finalTenantData.property_province = properties.province;
          finalTenantData.property_postal_code = properties.postal_code;
        }
      }
    }

    console.log(`[updateTenant] Sending final tenant data back to client:`, {
      id: finalTenantData.id,
      name: `${finalTenantData.first_name} ${finalTenantData.last_name}`,
      unit_id: finalTenantData.unit_id,
      rent_amount: finalTenantData.rent_amount,
      rent_due_day: finalTenantData.rent_due_day
    });

    return finalTenantData;
  } catch (err) {
    console.log("Exception in updateTenant:", err);
    throw err;
  }
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

    const formattedUnits = data?.map(unit => ({
      id: unit.id,
      unit_number: unit.unit_number,
      property_name: unit.properties?.name || 'Unknown Property',
      value: unit.id,
      label: `${unit.unit_number} - ${unit.properties?.name || 'Unknown Property'}`
    })) || [];

    return formattedUnits;
  } catch (err) {
    console.log("Exception in getAllUnits:", err);
    throw err;
  }
}

export const tenantService = {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  getAllUnits
};
