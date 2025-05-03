import { supabase, Tenant } from "../config/database";
import { logger } from "../utils/logger";

/**
 * Get all tenants with unit and property information
 */
export async function getAllTenants(): Promise<Tenant[]> {
  try {
    console.log("Getting all tenants with unit and property info...");
    // Join with units and properties to get additional information
    const { data, error } = await supabase
      .from("tenants")
      .select(`
        *,
        units:unit_id (
          id,
          unit_number,
          rent_amount,
          rent_due_day,
          property_id,
          properties:property_id (
            id,
            name
          )
        )
      `);

    if (error) {
      logger.error(`Error fetching tenants: ${error.message}`, error);
      console.log(`Error fetching tenants:`, error);
      throw new Error(`Failed to fetch tenants: ${error.message}`);
    }

    // Transform the data to match the expected format in the frontend
    const transformedData = data?.map(tenant => ({
      ...tenant,
      unit_number: tenant.units?.unit_number,
      property_name: tenant.units?.properties?.name,
      rent_amount: tenant.units?.rent_amount,
      rent_due_day: tenant.units?.rent_due_day,
    })) || [];

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
    // Join with units and properties to get additional information
    const { data, error } = await supabase
      .from("tenants")
      .select(`
        *,
        units:unit_id (
          id,
          unit_number,
          rent_amount,
          rent_due_day,
          property_id,
          properties:property_id (
            id,
            name
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      logger.error(`Error fetching tenant ${id}: ${error.message}`, error);
      console.log(`Error fetching tenant ${id}:`, error);
      throw new Error(`Failed to fetch tenant: ${error.message}`);
    }

    if (!data) return null;

    // Transform the data to match the expected format in the frontend
    return {
      ...data,
      unit_number: data.units?.unit_number,
      property_name: data.units?.properties?.name,
      rent_amount: data.units?.rent_amount,
      rent_due_day: data.units?.rent_due_day,
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

    const { data, error } = await supabase
      .from("tenants")
      .insert([tenantData])
      .select()
      .single();

    if (error) {
      logger.error(`Error creating tenant:`, error);
      console.log(`Error creating tenant:`, error);
      throw new Error(`Failed to create tenant: ${JSON.stringify(error)}`);
    }

    if (!data) {
      throw new Error("No data returned after creating tenant");
    }

    return data;
  } catch (err) {
    console.log("Exception in createTenant:", err);
    throw err;
  }
}

/**
 * Update an existing tenant
 */
export async function updateTenant(id: string, tenantData: Partial<Tenant>): Promise<Tenant> {
  try {
    const { data, error } = await supabase
      .from("tenants")
      .update(tenantData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error(`Error updating tenant ${id}:`, error);
      console.log(`Error updating tenant ${id}:`, error);
      throw new Error(`Failed to update tenant: ${JSON.stringify(error)}`);
    }

    if (!data) {
      throw new Error(`No tenant found with id ${id}`);
    }

    return data;
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
      value: unit.id.toString(),
      label: `${unit.unit_number} - ${unit.properties?.name || 'Unknown Property'}`
    })) || [];

    return formattedUnits;
  } catch (err) {
    console.log("Exception in getAllUnits:", err);
    throw err;
  }
}

// Export everything needed
export const tenantService = {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  getAllUnits
};
