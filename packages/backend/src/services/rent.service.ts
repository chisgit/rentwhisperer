import { supabase, RentPayment, Tenant, Unit } from "../config/database";
import { logger } from "../utils/logger";
import { paymentService } from "./payment.service";

export class RentService {
  /**
   * Create a new rent payment record
   */
  async createRentPayment(paymentData: Omit<RentPayment, "id" | "created_at" | "updated_at">): Promise<RentPayment> {
    const { data, error } = await supabase
      .from("rent_payments")
      .insert([paymentData])
      .select()
      .single();

    if (error) {
      logger.error(`Error creating rent payment: ${error.message}`);
      console.log(`Error creating rent payment: ${error.message}`);
      throw new Error(`Failed to create rent payment: ${error.message}`);
    }

    return data;
  }

  /**
   * Get rent payment by ID
   */
  async getRentPaymentById(id: string): Promise<RentPayment | null> {
    const { data, error } = await supabase
      .from("rent_payments")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      logger.error(`Error fetching rent payment ${id}: ${error.message}`);
      console.log(`Error fetching rent payment ${id}: ${error.message}`);
      throw new Error(`Failed to fetch rent payment: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all rent payments for a tenant
   */
  async getRentPaymentsByTenantId(tenantId: string): Promise<RentPayment[]> {
    const { data, error } = await supabase
      .from("rent_payments")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: false });

    if (error) {
      logger.error(`Error fetching rent payments for tenant ${tenantId}: ${error.message}`);
      console.log(`Error fetching rent payments for tenant ${tenantId}: ${error.message}`);
      throw new Error(`Failed to fetch rent payments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all pending rent payments
   */
  async getPendingRentPayments(): Promise<RentPayment[]> {
    const { data, error } = await supabase
      .from("rent_payments")
      .select("*")
      .in("status", ["pending", "late"]);

    if (error) {
      logger.error(`Error fetching pending rent payments: ${error.message}`);
      console.log(`Error fetching pending rent payments: ${error.message}`);
      throw new Error(`Failed to fetch pending rent payments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update rent payment status
   */
  async updateRentPaymentStatus(
    id: string,
    status: RentPayment["status"],
    paymentDate?: string | null
  ): Promise<RentPayment> {
    const updateData: Partial<RentPayment> = { status };

    if (paymentDate) {
      updateData.payment_date = paymentDate;
    }

    const { data, error } = await supabase
      .from("rent_payments")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error(`Error updating rent payment status ${id}: ${error.message}`);
      console.log(`Error updating rent payment status ${id}: ${error.message}`);
      throw new Error(`Failed to update rent payment status: ${error.message}`);
    }

    return data;
  }

  /**
   * Generate rent due for all tenants with rent due today
   */
  async generateRentDueToday(): Promise<RentPayment[]> {
    // Get current date
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Format the due date
    const dueDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(currentDay).padStart(2, "0")}`;

    // 1. Get all units with rent due on this day of month
    const { data: units, error: unitsError } = await supabase
      .from("units")
      .select(`
        *,
        tenants (*)
      `)
      .eq("rent_due_day", currentDay);

    if (unitsError) {
      logger.error(`Error fetching units with rent due: ${unitsError.message}`);
      console.log(`Error fetching units with rent due: ${unitsError.message}`);
      throw new Error(`Failed to fetch units with rent due: ${unitsError.message}`);
    }

    if (!units || units.length === 0) {
      return [];
    }

    // 2. For each unit, create a rent payment record if it doesn't already exist
    const createdPayments: RentPayment[] = [];

    for (const unit of units) {
      // Check if a payment already exists for this unit and date
      const { data: existingPayment, error: checkError } = await supabase
        .from("rent_payments")
        .select("*")
        .eq("unit_id", unit.id)
        .eq("due_date", dueDate)
        .maybeSingle();

      if (checkError) {
        logger.error(`Error checking existing payment for unit ${unit.id}: ${checkError.message}`);
        console.log(`Error checking existing payment for unit ${unit.id}: ${checkError.message}`);
        continue;
      }

      // Skip if payment already exists
      if (existingPayment) {
        continue;
      }

      // Get tenant for this unit
      const tenant = unit.tenants?.[0];

      if (!tenant) {
        logger.warn(`No tenant found for unit ${unit.id}`);
        console.log(`No tenant found for unit ${unit.id}`);
        continue;
      }

      // Create a new payment record
      const newPayment: Omit<RentPayment, "id" | "created_at" | "updated_at"> = {
        tenant_id: tenant.id,
        unit_id: unit.id,
        amount: unit.rent_amount,
        due_date: dueDate,
        payment_date: null,
        status: "pending",
        payment_method: null,
        interac_request_link: null
      };

      try {
        // Generate Interac request link
        const interacRequestLink = await paymentService.generateInteracRequestLink(
          tenant.email,
          tenant.first_name,
          unit.rent_amount,
          `Rent payment for unit ${unit.unit_number}`
        );

        newPayment.interac_request_link = interacRequestLink;

        // Create the payment record
        const payment = await this.createRentPayment(newPayment);
        createdPayments.push(payment);

        logger.info(`Created rent payment for tenant ${tenant.id}, unit ${unit.id}`);
        console.log(`Created rent payment for tenant ${tenant.id}, unit ${unit.id}`);
      } catch (error) {
        logger.error(`Error creating rent payment for tenant ${tenant.id}: ${error}`);
        console.log(`Error creating rent payment for tenant ${tenant.id}: ${error}`);
      }
    }

    return createdPayments;
  }

  /**
   * Update late rent payments
   * This checks for any pending payments that are past their due date and marks them as late
   */
  async updateLateRentPayments(): Promise<RentPayment[]> {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Find all pending payments with due date before today
    const { data, error } = await supabase
      .from("rent_payments")
      .select("*")
      .eq("status", "pending")
      .lt("due_date", todayStr);

    if (error) {
      logger.error(`Error fetching overdue rent payments: ${error.message}`);
      console.log(`Error fetching overdue rent payments: ${error.message}`);
      throw new Error(`Failed to fetch overdue rent payments: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    const updatedPayments: RentPayment[] = [];

    // Update each payment to late status
    for (const payment of data) {
      try {
        const updated = await this.updateRentPaymentStatus(payment.id, "late");
        updatedPayments.push(updated);

        logger.info(`Updated payment ${payment.id} status to late`);
        console.log(`Updated payment ${payment.id} status to late`);
      } catch (error) {
        logger.error(`Error updating payment ${payment.id} status: ${error}`);
        console.log(`Error updating payment ${payment.id} status: ${error}`);
      }
    }

    return updatedPayments;
  }
}

export const rentService = new RentService();
