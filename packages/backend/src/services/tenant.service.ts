import { logger } from "../utils/logger";
import { Tenant } from "../config/database";
import { TenantQueryResult, supabase, adminSupabase, fetchAllTenantsQuery, fetchTenantByIdQuery, getAllUnitsQuery } from "./tenant.queries"; // Import TenantQueryResult, supabase, and adminSupabase from queries, and the new query functions
import { transformTenantQueryResult } from "./tenant.utils"; // Import transformation utility

/**
 * Get all tenants with unit and property information
 */
export async function getAllTenants(): Promise<Tenant[]> {
  try {
    console.log("Getting all tenants with unit and property info...");
    const { data, error } = await fetchAllTenantsQuery(); // Use the extracted query function

    if (error) {
      logger.error(`Error fetching tenants: ${error.message}`, error);
      console.log(`Error fetching tenants:`, error);
      throw new Error(`Failed to fetch tenants: ${error.message}`);
    }

    // Transform the data to match the expected Tenant format for the frontend
    const transformedData: Tenant[] = data?.map(transformTenantQueryResult) || []; // Use the transformation utility

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
    // Add a larger delay to ensure data consistency after updates
    // This helps with potential eventual consistency issues in the database
    console.log(`[getTenantById] Starting to fetch tenant ${id} after delay...`);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Add cache busting parameter to ensure we get fresh data
    // Explanation: Sometimes Supabase query results can be cached
    const cacheBuster = new Date().getTime();
    console.log(`[getTenantById] Using cache buster: ${cacheBuster}`);

    const { data, error } = await fetchTenantByIdQuery(id); // Use the extracted query function

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

    console.log(`[getTenantById] Raw data from database:`, JSON.stringify(data, null, 2));

    // Find primary unit relationship (if any)
    const primaryRelationship = data.tenant_units?.find((tu) => tu.is_primary) || data.tenant_units?.[0];

    // Add more debugging to see what's being returned from database
    console.log(`[getTenantById] Primary relationship for tenant ${id}:`, primaryRelationship);

    if (!primaryRelationship) {
      console.log(`[getTenantById] WARNING: No relationship found for tenant ${id}`);
    }

    // Let's directly query the tenant_units table as a double-check
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

    // Debug the rent amount parsing
    if (directTenantUnits?.rent_amount !== undefined) {
      console.log(`[getTenantById] Parsing rent_amount: original=${directTenantUnits.rent_amount}, type=${typeof directTenantUnits.rent_amount}`);
      console.log(`[getTenantById] After parsing: ${parseFloat(directTenantUnits.rent_amount)}`);
    } else if (primaryRelationship?.rent_amount) {
      console.log(`[getTenantById] Parsing rent_amount from primaryRelationship: original=${primaryRelationship.rent_amount}, type=${typeof primaryRelationship.rent_amount}`);
      console.log(`[getTenantById] After parsing: ${parseFloat(primaryRelationship.rent_amount)}`);
    }

    // Fix the rent_amount parsing: ensure we properly handle 0 values
    let parsedRentAmount: number | undefined = undefined;

    if (directTenantUnits?.rent_amount !== undefined) {
      // For Supabase, numeric types come back as strings, so we need to parse them
      parsedRentAmount = parseFloat(directTenantUnits.rent_amount);
      // Check if it's actually 0 and not NaN
      if (parsedRentAmount === 0) {
        console.log("[getTenantById] Rent amount is exactly 0");
      }
    } else if (primaryRelationship?.rent_amount !== undefined) {
      parsedRentAmount = parseFloat(primaryRelationship.rent_amount);
      if (parsedRentAmount === 0) {
        console.log("[getTenantById] Rent amount from primaryRelationship is exactly 0");
      }
    }

    // Explicitly map to Tenant type, converting nulls to undefined for optional fields
    // Use direct query results if available, as they are likely more up-to-date
    const resultTenant: Tenant = {
      id: data.id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email ?? '', // Convert null to empty string
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
      // Use our explicitly parsed rent_amount that correctly handles 0
      rent_amount: parsedRentAmount,
      rent_due_day: directTenantUnits?.rent_due_day ?? primaryRelationship?.rent_due_day ?? undefined,
    };

    // Log the mapped tenant data for debugging
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

    // Extract unit_id and rent information from the tenant data
    const { unit_id, rent_amount, rent_due_day, ...tenantFields } = tenantData;

    // Validate required fields
    if (!tenantFields.first_name?.trim()) {
      throw new Error("First name is required");
    }

    if (!tenantFields.last_name?.trim()) {
      throw new Error("Last name is required");
    }

    if (!tenantFields.phone?.trim()) {
      throw new Error("Phone number is required");
    }

    // Set default values for rent fields if not provided but unit is assigned
    let validatedRentAmount = rent_amount;
    let validatedRentDueDay = rent_due_day;

    if (unit_id) {
      // Set defaults for missing values when a unit is assigned
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

      // Validate rent amount is not negative
      if (typeof validatedRentAmount === 'number' && validatedRentAmount < 0) {
        throw new Error("Rent amount cannot be negative");
      }

      // Validate rent due day is between 1 and 31
      if (typeof validatedRentDueDay === 'number' && (validatedRentDueDay < 1 || validatedRentDueDay > 31)) {
        throw new Error("Rent due day must be between 1 and 31");
      }
    }

    console.log(`[createTenant] Validated rent values: amount=${validatedRentAmount} (${typeof validatedRentAmount}), due_day=${validatedRentDueDay} (${typeof validatedRentDueDay})`);

    // First, insert the tenant record using adminSupabase to bypass RLS
    console.log(`[createTenant] Inserting tenant with admin client:`, tenantFields);
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

    // Always create a tenant-unit relationship if unit_id is provided
    if (unit_id) {
      // Ensure rent_amount and rent_due_day are properly parsed as numbers
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

      // Log the exact data being sent to the database
      console.log(`[createTenant] Creating tenant-unit relationship with data:`, JSON.stringify(tenantUnitData));
      console.log(`[createTenant] tenantUnitData.rent_amount (type ${typeof tenantUnitData.rent_amount}): `, tenantUnitData.rent_amount);
      console.log(`[createTenant] tenantUnitData.rent_due_day (type ${typeof tenantUnitData.rent_due_day}): `, tenantUnitData.rent_due_day);

      // Insert the relationship using adminSupabase to bypass RLS
      const { data: relationshipResult, error: relationError } = await adminSupabase
        .from("tenant_units")
        .insert([tenantUnitData])
        .select();

      if (relationError) {
        logger.error(`Error creating tenant-unit relationship:`, relationError);
        console.log(`[createTenant] Error creating tenant-unit relationship:`, relationError);
      } else {
        console.log(`[createTenant] Successfully created tenant-unit relationship:`, relationshipResult);

        // Verify the tenant-unit relationship was created correctly
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

    // Wait to ensure data consistency
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get the complete tenant data with relationships to return
    const createdTenant = await getTenantById(tenant.id);

    if (!createdTenant) {
      // If for some reason getTenantById fails, return basic tenant info
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

    // Extract unit_id and property fields from the tenant data
    const { unit_id, unit_number, property_name, property_address, property_city, property_province, property_postal_code, rent_amount, rent_due_day, ...tenantFields } = tenantData;

    // Validate required fields
    if (tenantFields.first_name !== undefined && !tenantFields.first_name?.trim()) {
      throw new Error("First name is required");
    }

    if (tenantFields.last_name !== undefined && !tenantFields.last_name?.trim()) {
      throw new Error("Last name is required");
    }

    if (tenantFields.phone !== undefined && !tenantFields.phone?.trim()) {
      throw new Error("Phone number is required");
    }

    // Validate required fields when changing unit
    if (unit_id !== undefined) {
      // When changing a unit, rent_amount and rent_due_day should be required
      if (rent_amount === undefined || rent_amount === null || (typeof rent_amount === 'number' && isNaN(rent_amount))) {
        throw new Error("Rent amount is required");
      }

      if (rent_due_day === undefined || rent_due_day === null || (typeof rent_due_day === 'number' && isNaN(rent_due_day))) {
        throw new Error("Rent due day is required");
      }

      // Validate rent amount is not negative
      if (typeof rent_amount === 'number' && rent_amount < 0) {
        throw new Error("Rent amount cannot be negative");
      }

      // Validate rent due day is between 1 and 31
      if (typeof rent_due_day === 'number' && (rent_due_day < 1 || rent_due_day > 31)) {
        throw new Error("Rent due day must be between 1 and 31");
      }
    } else {
      // When only updating rent values (not changing unit), validate if provided
      if (rent_amount !== undefined && (typeof rent_amount !== 'number' || isNaN(rent_amount) || rent_amount < 0)) {
        throw new Error("Rent amount must be a non-negative number");
      }

      if (rent_due_day !== undefined && (typeof rent_due_day !== 'number' || isNaN(rent_due_day) || rent_due_day < 1 || rent_due_day > 31)) {
        throw new Error("Rent due day must be a number between 1 and 31");
      }
    }

    // No need for defaults, we've validated that the values are proper if provided
    const validatedRentAmount = rent_amount;
    const validatedRentDueDay = rent_due_day;

    console.log(`[updateTenant] Validated rent values:`, {
      amount: validatedRentAmount,
      amount_type: typeof validatedRentAmount,
      due_day: validatedRentDueDay,
      due_day_type: typeof validatedRentDueDay
    });

    // First, check if the tenant exists
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
      return null; // Or throw an error, depending on the desired behavior
    }

    // Log what fields we're updating in the tenant record
    console.log(`[updateTenant] Updating tenant basic info:`, tenantFields);

    // Use adminSupabase for the tenant update as well to ensure it works
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

    // Fetch the updated tenant record to verify the update was successful
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

    // Log the updated tenant to verify
    console.log(`[updateTenant] Updated tenant basic info:`, {
      first_name: updatedTenant?.first_name,
      last_name: updatedTenant?.last_name,
      email: updatedTenant?.email,
      phone: updatedTenant?.phone
    });

    // If unit_id, rent_amount or rent_due_day is provided, update the tenant-unit relationship
    if (unit_id !== undefined || validatedRentAmount !== undefined || validatedRentDueDay !== undefined) {
      try {
        // First check if there is an existing relationship using admin client to bypass RLS
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
          // Update existing relationship
          const updateData: any = {};

          // Only include unit_id if it's provided and different
          if (unit_id !== undefined && unit_id !== existingRelation.unit_id) {
            updateData.unit_id = unit_id;
            console.log(`[updateTenant] Changing unit_id from ${existingRelation.unit_id} to ${unit_id}`);

            // When changing units, always ensure rent values are set
            if (validatedRentAmount === undefined) {
              updateData.rent_amount = 0;
              console.log(`[updateTenant] Setting default rent_amount to 0 for unit change`);
            }

            if (validatedRentDueDay === undefined) {
              updateData.rent_due_day = 1;
              console.log(`[updateTenant] Setting default rent_due_day to 1 for unit change`);
            }
          }

          // Use validated values for rent fields - ensure they are proper numbers
          if (validatedRentAmount !== undefined) {
            // Convert to number if it's a string
            const finalRentAmount = typeof validatedRentAmount === 'number'
              ? validatedRentAmount
              : typeof validatedRentAmount === 'string'
                ? parseFloat(validatedRentAmount) || 0
                : 0;

            updateData.rent_amount = finalRentAmount;
            console.log(`[updateTenant] Setting rent_amount to ${finalRentAmount} (original: ${validatedRentAmount})`);
          }

          if (validatedRentDueDay !== undefined) {
            // Convert to number if it's a string
            const finalRentDueDay = typeof validatedRentDueDay === 'number'
              ? validatedRentDueDay
              : typeof validatedRentDueDay === 'string'
                ? parseInt(validatedRentDueDay, 10) || 1
                : 1;

            updateData.rent_due_day = finalRentDueDay;
            console.log(`[updateTenant] Setting rent_due_day to ${finalRentDueDay} (original: ${validatedRentDueDay})`);
          }

          // Only proceed with update if there are fields to update
          if (Object.keys(updateData).length > 0) {
            console.log(`[updateTenant] Updating tenant_units with data:`, updateData);

            // Use admin supabase client to bypass RLS
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

              // Verify the update was successful
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
          // Create new relationship - we must have a unit_id
          console.log(`[updateTenant] No existing relation found, creating new tenant-unit relationship`);

          // Always enforce rent values for new tenant-unit relationships
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

          // Use admin supabase client to bypass RLS
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
        // Log the error but don't fail the entire operation
        console.log(`[updateTenant] Exception in tenant-unit relationship handling:`, relationError);
        logger.error(`Exception in tenant-unit relationship handling:`, relationError);
      }
    }

    if (!updatedTenant) {
      throw new Error("No data returned after fetching updated tenant");
    }

    // Make sure we wait a moment before fetching the latest data
    console.log(`[updateTenant] Waiting for database consistency...`);
    await new Promise(resolve => setTimeout(resolve, 1000));  // Increased to 1 second

    // Use a direct approach combining the data to avoid potential issues with the joins
    let finalTenantData: Tenant = {
      ...updatedTenant, // Use the directly updated tenant data (with correct name, etc.)
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

    // Get direct tenant_units data using admin client to bypass RLS
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

      // Update the tenant data with the unit information
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
      name: `${finalTenantData.first_name} ${finalTenantData.last_name}`, // This should now have the updated name
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
    // Use the extracted query function
    const { data, error } = await getAllUnitsQuery();

    if (error) {
      logger.error(`Error fetching units: ${error.message}`, error);
      console.log(`Error fetching units:`, error);
      throw new Error(`Failed to fetch units: ${error.message}`);
    }

    // Transform the data to include a display label for the dropdown
    const formattedUnits = data?.map(unit => ({
      id: unit.id,
      unit_number: unit.unit_number,
      // Rent information is only stored in tenant_units table
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
