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
   */  async getRentPaymentById(id: string): Promise<RentPayment | null> {
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
      .select(`
        *,
        tenants (first_name, last_name),
        units (unit_number)
      `)
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
      .select(`
        *,
        tenants (first_name, last_name),
        units (unit_number)
      `)
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

    // Format today's date for logging
    const todayFormatted = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(currentDay).padStart(2, "0")}`;
    console.log(`DEBUG: Today's date: ${todayFormatted}`);

    // 1. Get all tenant_units regardless of rent due day
    const { data: tenantUnits, error: tenantUnitsError } = await supabase
      .from("tenant_units")
      .select(`
      *,
      tenants (*),
      units(*)
      `);

    if (tenantUnitsError) {
      logger.error(`Error fetching tenant_units with rent due: ${tenantUnitsError.message}`);
      console.log(`Error fetching tenant_units with rent due: ${tenantUnitsError.message}`);
      throw new Error(`Failed to fetch tenant_units with rent due: ${tenantUnitsError.message}`);
    }

    if (!tenantUnits || tenantUnits.length === 0) {
      return [];
    }

    console.log(`DEBUG: Found ${tenantUnits.length} tenant units`);

    // 2. For each tenant_unit, create a rent payment record if it doesn't already exist
    const createdPayments: RentPayment[] = [];

    for (const tenantUnit of tenantUnits) {
      const tenant = tenantUnit.tenants;
      const unit = tenantUnit.units;

      if (!tenant || !unit) {
        logger.warn(`Missing tenant or unit data for tenant_unit record ${tenantUnit.id}`);
        console.log(`Missing tenant or unit data for tenant_unit record ${tenantUnit.id}`);
        continue;
      }

      // Calculate the due date based on tenant's rent_due_day
      const dueDayAsNumber = Number(tenantUnit.rent_due_day);
      // Create a date for the current month with the tenant's due day
      const dueDate = new Date(currentYear, currentMonth, dueDayAsNumber);
      // Format the due date as YYYY-MM-DD
      const dueDateFormatted = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dueDayAsNumber).padStart(2, "0")}`;

      console.log(`DEBUG: Tenant ${tenant.first_name} ${tenant.last_name} has rent due day ${dueDayAsNumber}, due date: ${dueDateFormatted}`);

      // Check if a payment already exists for this tenant, unit and date
      const { data: existingPayment, error: checkError } = await supabase
        .from("rent_payments")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("unit_id", unit.id)
        .eq("due_date", dueDateFormatted)
        .maybeSingle();

      if (checkError) {
        logger.error(`Error checking existing payment for tenant ${tenant.id}, unit ${unit.id}: ${checkError.message}`);
        console.log(`Error checking existing payment for tenant ${tenant.id}, unit ${unit.id}: ${checkError.message}`);
        continue;
      }

      // Skip if payment already exists
      if (existingPayment) {
        continue;
      }

      // Create a new payment record
      const newPayment: Omit<RentPayment, "id" | "created_at" | "updated_at"> = {
        tenant_id: tenant.id,
        unit_id: unit.id,
        amount: tenantUnit.rent_amount, // Use rent_amount from tenant_units
        due_date: dueDateFormatted,
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
          tenantUnit.rent_amount,
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
  /**
   * Generate rent due for all tenants regardless of rent due day
   */
  async generateRentPaymentsForAllTenants(): Promise<RentPayment[]> {
    // Get current date
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Format today's date for comparisons
    const currentMonthFormatted = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

    // Get all tenant_units with their tenant and unit information
    const { data: allTenantUnits, error: fetchError } = await supabase
      .from('tenant_units')
      .select(`
      *,
      tenants(*),
      units(*),
      properties(name)
      `)

    if (fetchError) {
      logger.error("Error fetching tenant_units with joins", fetchError);
      console.log("Error fetching tenant_units with joins", fetchError.message);
      throw new Error("Failed to fetch tenant_units with joins");
    }

    if (!allTenantUnits || allTenantUnits.length === 0) {
      console.log("DEBUG: No tenant_units found in database with joins");
      return [];
    }

    const createdPayments: RentPayment[] = [];

    // Process each tenant unit
    for (const tenantUnit of allTenantUnits) {
      try {
        const tenant = tenantUnit.tenants;
        const unit = tenantUnit.units;

        // Skip entries without tenant or unit info
        if (!tenant || !unit) {
          console.log(`DEBUG: Skipping tenant_unit ${tenantUnit.tenant_id || tenantUnit.id || 'unknown'} - missing tenant or unit info`);
          continue;
        }

        // Handle null or undefined rent_due_day
        if (tenantUnit.rent_due_day === null || tenantUnit.rent_due_day === undefined) {
          console.log(`DEBUG: Tenant unit ${tenantUnit.id} has null/undefined rent_due_day, skipping`);
          continue;
        }

        // Convert to number explicitly
        const dueDayAsNumber = Number(tenantUnit.rent_due_day);

        // Check if it's a valid number
        if (isNaN(dueDayAsNumber)) {
          console.log(`DEBUG: Tenant unit ${tenantUnit.id} has invalid rent_due_day: ${tenantUnit.rent_due_day}, skipping`);
          continue;
        }

        console.log(`DEBUG: Processing tenant_unit ID: ${tenantUnit.id}`);
        console.log(`DEBUG: Tenant: ${tenant.first_name} ${tenant.last_name} (ID: ${tenant.id})`);
        console.log(`DEBUG: Unit: ${unit.unit_number} (ID: ${unit.id})`);

        // Calculate the due date for this month
        const dueDate = new Date(currentYear, currentMonth, dueDayAsNumber);
        const dueDateFormatted = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dueDayAsNumber).padStart(2, "0")}`;

        // Check if we already have a payment record for this month
        const startOfMonth = `${currentMonthFormatted}-01`;
        const endOfMonth = `${currentMonthFormatted}-31`; // Will automatically handle shorter months

        console.log(`DEBUG: Checking for existing payments between ${startOfMonth} and ${endOfMonth}`);

        const { data: existingPayments, error: checkError } = await supabase
          .from("rent_payments")
          .select("*")
          .eq("tenant_id", tenant.id)
          .eq("unit_id", unit.id)
          .gte("due_date", startOfMonth)
          .lte("due_date", endOfMonth);

        if (checkError) {
          logger.error(`Error checking existing payments: ${checkError.message}`);
          console.log(`Error checking existing payments: ${checkError.message}`);
          continue;
        }

        console.log(`DEBUG: Found ${existingPayments?.length || 0} existing payments for this month`);

        // If payment already exists for this month, skip
        if (existingPayments && existingPayments.length > 0) {
          console.log(`DEBUG: Payment already exists for tenant ${tenant.id} this month. Skipping.`);
          continue;
        }

        // Calculate days past due
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
        console.log(`DEBUG: Days past due: ${daysPastDue}`);

        // Determine status based on days past due
        const status = daysPastDue > 0 ? "late" : "pending";

        // Define the payment data with the correct type
        const newPaymentData: {
          tenant_id: string;
          unit_id: string;
          amount: number;
          due_date: string;
          payment_date: string | null;
          status: "pending" | "late";
          payment_method: string | null;
          interac_request_link: string | null;
        } = {
          tenant_id: tenant.id,
          unit_id: unit.id,
          amount: tenantUnit.rent_amount,
          due_date: dueDateFormatted,
          payment_date: null,
          status: status as "pending" | "late",
          payment_method: null,
          interac_request_link: null
        };

        try {
          // Generate Interac request link
          const interacRequestLink = await paymentService.generateInteracRequestLink(
            tenant.email,
            tenant.first_name,
            tenantUnit.rent_amount,
            `Rent payment for unit ${unit.unit_number}`
          );

          // Set the interac_request_link
          newPaymentData.interac_request_link = interacRequestLink;
        } catch (error) {
          logger.error(`Error generating Interac request link: ${error}`);
          console.log(`Error generating Interac request link: ${error}`);
          // Continue without the link
        }

        const { data: newPayment, error: insertError } = await supabase
          .from("rent_payments")
          .insert([newPaymentData])
          .select()
          .single();

        if (insertError) {
          logger.error(`Error creating payment: ${insertError.message}`);
          console.log(`Error creating payment: ${insertError.message}`);
          continue;
        }

        console.log(`Successfully created payment record with ID: ${newPayment.id} and status: ${status}`);

        createdPayments.push(newPayment);
      } catch (error) {
        logger.error(`Error processing tenant_unit ${tenantUnit.id}`, error);
        console.log(`Error processing tenant_unit ${tenantUnit.id}`, error);
      }
    }

    return createdPayments;
  }
  /**
   * Get all tenants with overdue rent
   */
  async getTenantsWithOverdueRent(): Promise<{ tenantId: string; tenantName: string; unitId: string; unitNumber: string; propertyName?: string; rentAmount: number; dueDate: string; daysPastDue: number }[]> {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const currentMonthFormatted = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
    const { data: tenantUnits, error: fetchError } = await supabase
      .from('tenant_units')
      .select(`
      *,
      tenants(*),
      units(*),
      properties(name)
      `)
    if (fetchError) {
      logger.error("Error fetching tenant_units with joins", fetchError);
      console.log("Error fetching tenant_units with joins", fetchError.message);
      throw new Error("Failed to fetch tenant_units with joins");
    }
    if (!tenantUnits || tenantUnits.length === 0) {
      console.log("DEBUG: No tenant_units found in database with joins");
      return [];
    }
    const overdueTenants: { tenantId: string; tenantName: string; unitId: string; unitNumber: string; propertyName?: string; rentAmount: number; dueDate: string; daysPastDue: number }[] = [];
    for (const tenantUnit of tenantUnits) {
      const tenant = tenantUnit.tenants;
      const unit = tenantUnit.units;
      if (!tenant || !unit) {
        console.log(`DEBUG: Skipping tenant_unit ${tenantUnit.tenant_id || tenantUnit.id || 'unknown'} - missing tenant or unit info`);
        continue;
      }
      const dueDayAsNumber = Number(tenantUnit.rent_due_day);
      if (isNaN(dueDayAsNumber)) {
        console.log(`DEBUG: Tenant unit ${tenantUnit.id} has invalid rent_due_day: ${tenantUnit.rent_due_day}, skipping`);
        continue;
      }
      const dueDate = new Date(currentYear, currentMonth - 1, dueDayAsNumber);
      const dueDateFormatted = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(dueDayAsNumber).padStart(2, "0")}`;
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
      const { data: existingPayments, error: checkError } = await supabase
        .from("rent_payments")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("unit_id", unit.id)
        .gte("due_date", `${currentMonthFormatted}-01`)
        .lte("due_date", `${currentMonthFormatted}-31`);
      if (checkError) {
        logger.error(`Error checking existing payments: ${checkError.message}`);
        console.log(`Error checking existing payments: ${checkError.message}`);
        continue;
      } if (!existingPayments || existingPayments.length === 0) {
        overdueTenants.push({
          tenantId: tenant.id,
          tenantName: `${tenant.first_name} ${tenant.last_name}`,
          unitId: unit.id,
          unitNumber: unit.unit_number,
          propertyName: unit.properties?.name,
          rentAmount: tenantUnit.rent_amount,
          dueDate: dueDateFormatted,
          daysPastDue: daysPastDue
        });
      }
    }
    return overdueTenants;
  }

  /**
   * Check rent status for all tenants
   */
  async checkRentStatus(): Promise<{ notPaid: any[]; late: any[] }> {
    const overdueTenants = await this.getTenantsWithOverdueRent();
    const pendingRentPayments = await this.getPendingRentPayments();

    const notPaid = overdueTenants.map((tenant) => ({
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      unitId: tenant.unitId,
      unitNumber: tenant.unitNumber,
      rentAmount: tenant.rentAmount,
      dueDate: tenant.dueDate,
      daysPastDue: tenant.daysPastDue,
    }));

    const late = pendingRentPayments.filter((payment) => payment.status === "late").map((payment) => ({
      paymentId: payment.id,
      tenantId: payment.tenant_id,
      unitId: payment.unit_id,
      dueDate: payment.due_date,
      amount: payment.amount,
    }));

    return { notPaid, late };
  }
}

// Create and export instance for use in other files
export const rentService = new RentService();
