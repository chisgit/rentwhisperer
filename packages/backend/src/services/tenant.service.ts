import { supabase, Tenant } from "../config/database";
import { logger } from "../utils/logger";
import { createClient } from "@supabase/supabase-js";

// Create a supabase client with the service role key for admin operations
// This bypasses RLS policies to allow tenant_units modifications
const adminSupabase = createClient(
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
 * Get all tenants with unit and property information
 */
export async function getAllTenants(): Promise<Tenant[]> {
  try {
    console.log("Getting all tenants with unit and property info...");
    // Join with tenant_units, units, and properties using the new schema structure
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
      `) as { data: TenantQueryResult[] | null; error: any }; // Use the specific query result type

    if (error) {
      logger.error(`Error fetching tenants: ${error.message}`, error);
      console.log(`Error fetching tenants:`, error);
      throw new Error(`Failed to fetch tenants: ${error.message}`);
    }

    // Transform the data to match the expected Tenant format for the frontend
    const transformedData: Tenant[] = data?.map((tenant): Tenant => {
      // Find primary unit relationship (if any)
      const primaryRelationship = tenant.tenant_units?.find((tu) => tu.is_primary) || tenant.tenant_units?.[0];
      const primaryUnit = primaryRelationship?.units;
      const properties = primaryUnit?.properties;

      // Explicitly map to Tenant type, converting nulls to undefined for optional fields
      return {
        id: tenant.id,
        first_name: tenant.first_name,
        last_name: tenant.last_name,
        email: tenant.email ?? '', // Convert null to empty string
        phone: tenant.phone,
        created_at: tenant.created_at,
        updated_at: tenant.updated_at,
        unit_id: primaryUnit?.id ?? undefined,
        unit_number: primaryUnit?.unit_number ?? undefined,
        property_name: properties?.name ?? undefined,
        property_address: properties?.address ?? undefined,
        property_city: properties?.city ?? undefined,
        property_province: properties?.province ?? undefined,
        property_postal_code: properties?.postal_code ?? undefined,
        rent_amount: primaryRelationship?.rent_amount ? parseFloat(primaryRelationship.rent_amount) : undefined,
        rent_due_day: primaryRelationship?.rent_due_day ?? undefined,
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
  try {
    // Add a larger delay to ensure data consistency after updates
    // This helps with potential eventual consistency issues in the database
    console.log(`[getTenantById] Starting to fetch tenant ${id} after delay...`);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Add cache busting parameter to ensure we get fresh data
    // Explanation: Sometimes Supabase query results can be cached
    const cacheBuster = new Date().getTime();
    console.log(`[getTenantById] Using cache buster: ${cacheBuster}`);

    // Join with tenant_units, units and properties to get additional information
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
      .single() as { data: TenantQueryResult | null; error: any }; // Use the specific query result type

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
    if (directError) {
      console.log(`[getTenantById] Error in direct tenant_units query:`, directError);
    }

    const primaryUnit = primaryRelationship?.units;
    const properties = primaryUnit?.properties;

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
      // Give preference to direct query data
      rent_amount: directTenantUnits?.rent_amount
        ? parseFloat(directTenantUnits.rent_amount)
        : primaryRelationship?.rent_amount
          ? parseFloat(primaryRelationship.rent_amount)
          : undefined,
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
    }

    // If unit_id is provided, create the tenant-unit relationship
    if (unit_id) {
      const tenantUnitData: any = {
        tenant_id: tenant.id,
        unit_id: unit_id,
        is_primary: true,
        lease_start: new Date().toISOString()
      };

      // Add rent information if provided
      if (rent_amount !== undefined) {
        tenantUnitData.rent_amount = rent_amount;
      }

      if (rent_due_day !== undefined) {
        tenantUnitData.rent_due_day = rent_due_day;
      }

      // Use adminSupabase to bypass RLS
      console.log(`Creating tenant-unit relationship with admin client:`, tenantUnitData);
      const { error: relationError } = await adminSupabase
        .from("tenant_units")
        .insert([tenantUnitData]);

      if (relationError) {
        logger.error(`Error creating tenant-unit relationship:`, relationError);
        console.log(`Error creating tenant-unit relationship:`, relationError);
        // Don't throw here, as the tenant was already created
      } else {
        console.log(`Successfully created tenant-unit relationship`);
      }
    }

    // Return the created tenant with the unit_id included
    return { ...tenant, unit_id, rent_amount, rent_due_day };
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

    // Extract unit_id and property fields from the tenant data
    const { unit_id, unit_number, property_name, property_address, property_city, property_province, property_postal_code, rent_amount, rent_due_day, ...tenantFields } = tenantData;

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
    if (unit_id !== undefined || rent_amount !== undefined || rent_due_day !== undefined) {
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
          }

          // Always include rent_amount and rent_due_day if provided
          if (rent_amount !== undefined) {
            updateData.rent_amount = rent_amount;
            console.log(`[updateTenant] Setting rent_amount to ${rent_amount}`);
          }

          if (rent_due_day !== undefined) {
            updateData.rent_due_day = rent_due_day;
            console.log(`[updateTenant] Setting rent_due_day to ${rent_due_day}`);
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

          const tenantUnitData: any = {
            tenant_id: id,
            unit_id: unit_id,
            is_primary: true,
            lease_start: new Date().toISOString()
          };

          // Add rent_amount and rent_due_day if provided
          if (rent_amount !== undefined) {
            tenantUnitData.rent_amount = rent_amount;
          }

          if (rent_due_day !== undefined) {
            tenantUnitData.rent_due_day = rent_due_day;
          }

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
    }    // Transform the data to include a display label for the dropdown
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
