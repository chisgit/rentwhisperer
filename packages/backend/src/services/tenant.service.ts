import { supabase, Tenant } from "../config/database";
import { logger } from "../utils/logger";

export class TenantService {
  /**
   * Get all tenants
   */
  async getAllTenants(): Promise<Tenant[]> {
    const { data, error } = await supabase
      .from("tenants")
      .select("*");

    if (error) {
      logger.error(`Error fetching tenants: ${error.message}`);
      console.log(`Error fetching tenants: ${error.message}`);
      throw new Error(`Failed to fetch tenants: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(id: string): Promise<Tenant | null> {
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      logger.error(`Error fetching tenant ${id}: ${error.message}`);
      console.log(`Error fetching tenant ${id}: ${error.message}`);
      throw new Error(`Failed to fetch tenant: ${error.message}`);
    }

    return data;
  }

  /**
   * Get tenants with rent due today
   */
  async getTenantsWithRentDueToday(): Promise<Tenant[]> {
    // Get the current date
    const today = new Date();
    const currentDay = today.getDate(); // Get day of the month (1-31)

    const { data, error } = await supabase
      .from("tenants")
      .select(`
        *,
        units!inner (
          rent_due_day,
          rent_amount
        )
      `)
      .eq("units.rent_due_day", currentDay);

    if (error) {
      logger.error(`Error fetching tenants with rent due: ${error.message}`);
      console.log(`Error fetching tenants with rent due: ${error.message}`);
      throw new Error(`Failed to fetch tenants with rent due: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get tenants with late rent
   */
  async getTenantsWithLateRent(): Promise<Tenant[]> {
    const today = new Date();

    // Query for tenants with rent payments that are past due (due_date < today and status = 'pending')
    const { data, error } = await supabase
      .from("tenants")
      .select(`
        *,
        rent_payments!inner (
          due_date,
          status
        )
      `)
      .lt("rent_payments.due_date", today.toISOString().split("T")[0])
      .eq("rent_payments.status", "pending");

    if (error) {
      logger.error(`Error fetching tenants with late rent: ${error.message}`);
      console.log(`Error fetching tenants with late rent: ${error.message}`);
      throw new Error(`Failed to fetch tenants with late rent: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a new tenant
   */
  async createTenant(tenantData: Omit<Tenant, "id" | "created_at" | "updated_at">): Promise<Tenant> {
    const { data, error } = await supabase
      .from("tenants")
      .insert([tenantData])
      .select()
      .single();

    if (error) {
      logger.error(`Error creating tenant: ${error.message}`);
      console.log(`Error creating tenant: ${error.message}`);
      throw new Error(`Failed to create tenant: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an existing tenant
   */
  async updateTenant(id: string, tenantData: Partial<Tenant>): Promise<Tenant> {
    const { data, error } = await supabase
      .from("tenants")
      .update(tenantData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error(`Error updating tenant ${id}: ${error.message}`);
      console.log(`Error updating tenant ${id}: ${error.message}`);
      throw new Error(`Failed to update tenant: ${error.message}`);
    }

    return data;
  }
}

export const tenantService = new TenantService();
