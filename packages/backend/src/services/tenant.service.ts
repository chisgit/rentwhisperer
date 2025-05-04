import { supabase, Tenant } from "../config/database";
import { logger } from "../utils/logger";

/**
 * Get all tenants with unit and property information
 */
export async function getAllTenants(): Promise<Tenant[]> {
  try {
    console.log("getAllTenants called");
    console.log("Getting all tenants with unit and property info...");    // Join with tenant_units, units, and properties using the new schema structure
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
      `);

    if (error) {
      logger.error(`Error fetching tenants: ${error.message}`, error);
      console.log(`Error fetching tenants:`, error);
      // Check for specific error codes and return appropriate values
      if (error.code === 'PGRST116') {
        return []; // Or an empty array, or null, depending on your needs
      }
      throw new Error(`Failed to fetch tenants: ${error.message}`);
    }

    // Transform the data to match the expected format in the frontend
    const transformedData = data?.map((tenant: any) => {
      // Find primary unit relationship (if any)
      const primaryRelationship = tenant.tenant_units?.find((tu: any) => tu.is_primary) || tenant.tenant_units?.[0];
      const primaryUnit = primaryRelationship?.units;
      return {
        ...tenant,
        unit_id: primaryUnit?.id || null,
        unit_number: primaryUnit?.unit_number || null,
        property_name: primaryUnit?.properties?.name || null,
        property_address: primaryUnit?.properties?.address || null,
        property_city: primaryUnit?.properties?.city || null,
        property_province: primaryUnit?.properties?.province || null,
        property_postal_code: primaryUnit?.properties?.postal_code || null,
        rent_amount: primaryRelationship?.rent_amount || null,
        rent_due_day: primaryRelationship?.rent_due_day || null,
      };
    }) || [];

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
  try {    // Join with tenant_units, units and properties to get additional information
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
      .single();

    if (error) {
      logger.error(`Error fetching tenant ${id}: ${error.message}`, error);
      console.log(`Error fetching tenant ${id}:`, error);
      if (error.code === 'PGRST116') {
        // PGRST116 means no rows returned
        return null;
      }
      throw new Error(`Failed to fetch tenant: ${error.message}`);
    }

    if (!data) return null;

    // Find primary unit relationship (if any)
    const primaryRelationship = data.tenant_units?.find((tu: any) => tu.is_primary) || data.tenant_units?.[0];
    const primaryUnit = primaryRelationship?.units; return {
      ...data,
      unit_id: primaryUnit?.id || null,
      unit_number: primaryUnit?.unit_number || null,
      property_name: primaryUnit?.properties?.name || null,
      property_address: primaryUnit?.properties?.address || null,
      property_city: primaryUnit?.properties?.city || null,
      property_province: primaryUnit?.properties?.province || null,
      property_postal_code: primaryUnit?.properties?.postal_code || null,
      rent_amount: primaryRelationship?.rent_amount || null,
      rent_due_day: primaryRelationship?.rent_due_day || null,
    };
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

    // Extract unit_id from the tenant data
    const { unit_id, ...tenantFields } = tenantData;

    // First, insert the tenant record
    const { data: tenant, error: tenantError } = await supabase
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
    }    // If unit_id is provided, create the tenant-unit relationship
    if (unit_id) {
      // First get the unit's default rent values
      const { data: unitData, error: unitError } = await supabase
        .from("units")
        .select("rent_amount, rent_due_day")
        .eq("id", unit_id)
        .single();

      if (unitError) {
        logger.error(`Error fetching unit data:`, unitError);
        console.log(`Error fetching unit data:`, unitError);
        // Continue with default values
      }

      // Use tenant-specific rent data if provided, otherwise use unit defaults
      const tenantUnitData = {
        tenant_id: tenant.id,
        unit_id: unit_id,
        is_primary: true,
        rent_amount: tenantData.rent_amount || unitData?.rent_amount || 0,
        rent_due_day: tenantData.rent_due_day || unitData?.rent_due_day || 1,
        lease_start: new Date().toISOString()
      };

      const { error: relationError } = await supabase
        .from("tenant_units")
        .insert([tenantUnitData]);

      if (relationError) {
        logger.error(`Error creating tenant-unit relationship:`, relationError);
        console.log(`Error creating tenant-unit relationship:`, relationError);
        // Don't throw here, as the tenant was already created
      }
    }

    // Return the created tenant with the unit_id included
    return { ...tenant, unit_id };
  } catch (err) {
    console.log("Exception in createTenant:", err);
    throw err;
  }
}

/**
 * Update an existing tenant
 */
export async function updateTenant(id: string, tenantData: Partial<Tenant>): Promise<Tenant> {
  console.log("updateTenant called");
  try {
    console.log(`Updating tenant ${id} with data:`, tenantData);

    // First check if the tenant exists
    const { data: tenantExists, error: existsError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (existsError) {
      logger.error(`Error checking if tenant exists:`, existsError);
      console.log(`Error checking if tenant exists:`, existsError);
      throw new Error(`Failed to check if tenant exists: ${JSON.stringify(existsError)}`);
    }

    if (!tenantExists) {
      logger.error(`Tenant with id ${id} not found`);
      console.log(`Tenant with id ${id} not found`);
      throw new Error(`Tenant with id ${id} not found`);
    }

    // Extract only the fields that belong to the tenants table
    const {
      first_name,
      last_name,
      email,
      phone,
      unit_id,
      tenant_units,
      // Explicitly extract all fields that don't exist in tenants table to prevent them from being passed
      property_name,
      property_city,
      property_province,
      property_postal_code,
      property_address, // This is now a frontend-only field derived from the property
      rent_amount,
      rent_due_day,
      unit_number,
      ...restFields
    } = tenantData;

    // Only include fields that exist in the tenants table
    const validTenantFields: Record<string, any> = {};

    // Explicitly check each field and add it if it's defined
    if (first_name !== undefined) validTenantFields.first_name = first_name;
    if (last_name !== undefined) validTenantFields.last_name = last_name;
    if (email !== undefined) validTenantFields.email = email;
    if (phone !== undefined) validTenantFields.phone = phone;

    // Include any other valid tenant fields that might be in restFields
    // This ensures we don't lose any fields that should be updated
    Object.keys(restFields).forEach(key => {
      // Exclude any fields that shouldn't be in the tenants table
      const invalidFields = ['id', 'created_at', 'updated_at'];
      if (!invalidFields.includes(key)) {
        validTenantFields[key] = restFields[key];
      }
    });

    console.log(`Updating tenant with validated fields:`, validTenantFields);

    // Update the tenant record with only valid fields - Use RETURNING=REPRESENTATION to ensure data returns
    // This is a common issue with Supabase - by default it might not return updated rows
    const { data: updateResult, error: updateError } = await supabase
      .from("tenants")
      .update(validTenantFields)
      .eq("id", id)
      .select('*');

    if (updateError) {
      logger.error(`Error updating tenant:`, updateError);
      console.log(`Error updating tenant:`, updateError);
      throw new Error(`Failed to update tenant: ${JSON.stringify(updateError)}`);
    }

    console.log(`Tenant update result:`, updateResult);

    // If update result is empty but no error, something went wrong
    if (!updateResult || updateResult.length === 0) {
      logger.warn(`Update operation returned no data for tenant ${id}`);
      console.warn(`Update may not have been applied correctly`);

      // Let's try a direct SQL approach as fallback
      const fields = Object.keys(validTenantFields).map(key => {
        return `${key} = '${validTenantFields[key]}'`;
      }).join(', ');

      console.log(`Attempting direct update with SQL fields: ${fields}`);

      const { data: directResult, error: directError } = await supabase
        .rpc('update_tenant_direct', {
          tenant_id: id,
          update_fields: fields
        });

      if (directError) {
        logger.error(`Direct update error:`, directError);
      } else {
        logger.info(`Direct update result:`, directResult);
      }
    }

    // Get current tenant-unit relationship to preserve it if not being explicitly changed
    let currentUnitId = unit_id;
    let currentRentAmount = rent_amount;
    let currentRentDueDay = rent_due_day;

    // Only query the current relationship if we're not explicitly setting a new one
    if (unit_id === undefined && (!tenant_units || tenant_units.length === 0)) {
      const { data: currentRelation, error: relationFetchError } = await supabase
        .from("tenant_units")
        .select("unit_id, rent_amount, rent_due_day")
        .eq("tenant_id", id)
        .eq("is_primary", true)
        .maybeSingle();

      if (!relationFetchError && currentRelation) {
        // Preserve current values if not being explicitly changed
        currentUnitId = currentRelation.unit_id;
        currentRentAmount = currentRelation.rent_amount;
        currentRentDueDay = currentRelation.rent_due_day;
      }
    }

    // We'll immediately fetch the latest tenant data to verify our update worked
    const { data: updatedTenant, error: fetchError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      logger.error(`Error fetching updated tenant:`, fetchError);
      console.log(`Error fetching updated tenant:`, fetchError);
      throw new Error(`Failed to fetch updated tenant: ${JSON.stringify(fetchError)}`);
    }

    // Verify if the update was actually applied
    if (updatedTenant) {
      let updateSuccessful = true;
      for (const key in validTenantFields) {
        if (updatedTenant[key] !== validTenantFields[key]) {
          updateSuccessful = false;
          logger.error(`Update failed for field ${key}: expected="${validTenantFields[key]}" actual="${updatedTenant[key]}"`);
        }
      }

      if (!updateSuccessful) {
        logger.warn(`Some tenant fields were not updated correctly. Will make one more attempt.`);
        // Try one more direct update approach
        const { error: retryError } = await supabase
          .from("tenants")
          .upsert({
            id: id, // Include the ID to make sure we update the right record
            ...validTenantFields,
            updated_at: new Date().toISOString() // Force updated_at to change
          })
          .select();

        if (retryError) {
          logger.error(`Retry update failed:`, retryError);
        } else {
          // Refetch one more time
          const { data: refetchedTenant } = await supabase
            .from("tenants")
            .select("*")
            .eq("id", id)
            .single();

          if (refetchedTenant) {
            updatedTenant = refetchedTenant;
          }
        }
      }
    }

    if (!updatedTenant) {
      throw new Error("No data returned after fetching updated tenant");
    }

    // Handle unit relationship update - either with explicitly provided unit_id or from tenant_units
    // or keep the current one if none provided
    const effectiveUnitId = tenant_units && tenant_units.length > 0
      ? tenant_units[0].unit_id
      : (unit_id !== undefined ? unit_id : currentUnitId);

    // Only proceed with unit relationship update if we have a unit ID (either new or preserved)
    if (effectiveUnitId) {
      // Check if there is an existing relationship
      const { data: existingRelation, error: fetchError } = await supabase
        .from("tenant_units")
        .select()
        .eq("tenant_id", id)
        .eq("is_primary", true)
        .maybeSingle();

      // Determine the rent values to use (explicit values, or preserve current if not provided)
      const effectiveRentAmount = rent_amount !== undefined ? rent_amount : currentRentAmount;
      const effectiveRentDueDay = rent_due_day !== undefined ? rent_due_day : currentRentDueDay;

      if (fetchError) {
        logger.error(`Error fetching tenant-unit relationship:`, fetchError);
        console.log(`Error fetching tenant-unit relationship:`, fetchError);
        // Continue with assumed values
      } else if (existingRelation) {
        // Update existing relationship only if unit or rent values are changing
        if (existingRelation.unit_id !== effectiveUnitId ||
          (effectiveRentAmount !== undefined && existingRelation.rent_amount !== effectiveRentAmount) ||
          (effectiveRentDueDay !== undefined && existingRelation.rent_due_day !== effectiveRentDueDay)) {

          const updateData: Record<string, any> = {
            unit_id: effectiveUnitId
          };

          // Only include rent values if they're defined
          if (effectiveRentAmount !== undefined) updateData.rent_amount = effectiveRentAmount;
          if (effectiveRentDueDay !== undefined) updateData.rent_due_day = effectiveRentDueDay;

          console.log(`Updating tenant-unit relationship with data:`, updateData);

          const { error: updateRelationError } = await supabase
            .from("tenant_units")
            .update(updateData)
            .eq("tenant_id", id)
            .eq("is_primary", true);

          if (updateRelationError) {
            logger.error(`Error updating tenant-unit relationship:`, updateRelationError);
            console.log(`Error updating tenant-unit relationship:`, updateRelationError);
            // Don't throw here, as the tenant was already updated
          } else {
            console.log(`Tenant-unit relationship updated successfully`);
          }
        }
      } else {
        // Create new relationship if none exists
        // Get unit's default rent values if our effective values are undefined
        let finalRentAmount = effectiveRentAmount;
        let finalRentDueDay = effectiveRentDueDay;

        if (finalRentAmount === undefined || finalRentDueDay === undefined) {
          const { data: unitData, error: unitError } = await supabase
            .from("units")
            .select("rent_amount, rent_due_day")
            .eq("id", effectiveUnitId)
            .single();

          if (unitError) {
            logger.error(`Error fetching unit data:`, unitError);
            console.log(`Error fetching unit data:`, unitError);
            // Continue with default values
          } else {
            // Use unit defaults if tenant-specific values not provided
            if (finalRentAmount === undefined) finalRentAmount = unitData?.rent_amount;
            if (finalRentDueDay === undefined) finalRentDueDay = unitData?.rent_due_day;
          }
        }

        const tenantUnitData = {
          tenant_id: id,
          unit_id: effectiveUnitId,
          is_primary: true,
          rent_amount: finalRentAmount || 0, // Default to 0 if no value available
          rent_due_day: finalRentDueDay || 1, // Default to 1st of month if no value available
          lease_start: new Date().toISOString()
        };

        console.log(`Creating new tenant-unit relationship with data:`, tenantUnitData);

        const { error: insertRelationError } = await supabase
          .from("tenant_units")
          .insert([tenantUnitData]);

        if (insertRelationError) {
          logger.error(`Error creating tenant-unit relationship:`, insertRelationError);
          console.log(`Error creating tenant-unit relationship:`, insertRelationError);
          // Don't throw here, as the tenant was already updated
        } else {
          console.log(`New tenant-unit relationship created successfully`);
        }
      }
    }

    // Return the updated tenant with the additional fields included
    // Use the manually constructed result to ensure correct data is returned
    const result = {
      ...updatedTenant,
      // Override with the values we actually tried to set
      ...(first_name !== undefined && { first_name }),
      ...(last_name !== undefined && { last_name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      unit_id: unit_id || currentUnitId,
      rent_amount: rent_amount !== undefined ? rent_amount : currentRentAmount,
      rent_due_day: rent_due_day !== undefined ? rent_due_day : currentRentDueDay
    };

    console.log(`Returning updated tenant with final data:`, result);
    return result;

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
    // Get units with property information joined
    const { data, error } = await supabase
      .from("units")
      .select(`
        *,
        properties:property_id (*)
      `);

    if (error) {
      logger.error(`Error fetching units: ${error.message}`, error);
      console.log(`Error fetching units:`, error);
      throw new Error(`Failed to fetch units: ${error.message}`);
    }

    // Transform the data to include a display label for the dropdown
    const formattedUnits = data?.map(unit => ({
      id: unit.id,
      unit_number: unit.unit_number,
      rent_amount: unit.rent_amount,
      rent_due_day: unit.rent_due_day,
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

// Export everything as part of the service module
export const tenantService = {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  getAllUnits
};
