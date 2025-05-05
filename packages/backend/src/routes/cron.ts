import express, { Request, Response } from "express"; // Import Request, Response types
// Import the service instances
import { rentService } from "../services/rent.service";
import { tenantService } from "../services/tenant.service";
import { paymentService } from "../services/payment.service";
import { sendRentDueNotification, sendRentLateNotification } from "../services/notification.service";
import { supabase, Tenant, Unit, RentPayment, Property } from "../config/database"; // Import types
import { logger } from "../utils/logger";

const router = express.Router();

/**
 * Endpoint to generate rent due records and send notifications
 * This would be triggered by a daily cron job
 */
router.get("/due-rent", async (req: Request, res: Response) => { // Add types
  try {
    logger.debug("Processing rent due generation and notifications");
    console.log("Processing rent due generation and notifications");

    // 1. Generate rent payment records for tenants due today
    const createdPayments = await rentService.generateRentDueToday();
    logger.info(`Generated ${createdPayments.length} rent payment records.`);
    console.log(`Generated ${createdPayments.length} rent payment records.`);

    const results = [];

    // 2. Process each newly created payment for notification
    for (const payment of createdPayments) {
      try {
        // Fetch related data needed for notification
        // Correctly handle the return type of getTenantById (Tenant | null)
        const tenant = await tenantService.getTenantById(payment.tenant_id);
        if (!tenant) {
          const errorMessage = `Tenant ${payment.tenant_id} not found for payment ${payment.id}`;
          logger.error(errorMessage);
          console.log(errorMessage);
          continue;
        }

        const { data: unit, error: unitError } = await supabase
          .from("units")
          .select("*, properties(*)") // Fetch unit and related property
          .eq("id", payment.unit_id)
          .single();

        if (unitError || !unit || !unit.properties) {
          logger.error(`Error fetching unit/property for payment ${payment.id}: ${unitError?.message || "Unit/Property not found"}`);
          console.log(`Error fetching unit/property for payment ${payment.id}: ${unitError?.message || "Unit/Property not found"}`);
          continue;
        }
        const property = unit.properties as Property; // Type assertion

        // Format address
        const propertyAddress = `${property.address}, ${property.city}, ${property.province} ${property.postal_code}`;

        // Send notification
        const notification = await sendRentDueNotification(
          tenant,
          payment,
          unit,
          propertyAddress
        );

        results.push({
          tenant: `${tenant.first_name} ${tenant.last_name}`,
          unit: unit.unit_number,
          amount: payment.amount,
          status: "payment_created_and_notification_sent",
          payment_id: payment.id,
          notification_id: notification.id
        });
      } catch (error) {
        logger.error(`Error processing payment ${payment.id} for notification`, error);
        console.log(`Error processing payment ${payment.id} for notification`, error);

        results.push({
          payment_id: payment.id,
          status: "failed",
          error: (error as Error).message
        });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (error) {
    logger.error("Error in due-rent endpoint", error);
    console.log("Error in due-rent endpoint", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Endpoint to update late statuses and send late rent notifications
 * This would be triggered by a daily cron job
 */
router.get("/late-rent", async (req: Request, res: Response) => { // Add types
  try {
    logger.debug("Processing late rent status updates and notifications");
    console.log("Processing late rent status updates and notifications");

    // 1. Update status of overdue 'pending' payments to 'late'
    const newlyLatePayments = await rentService.updateLateRentPayments();
    logger.info(`Updated ${newlyLatePayments.length} payments to 'late' status.`);
    console.log(`Updated ${newlyLatePayments.length} payments to 'late' status.`);

    // 2. Get all payments currently marked as 'late' (including newly updated ones)
    const { data: allLatePayments, error: fetchLateError } = await supabase
      .from("rent_payments")
      .select(`
        *,
        tenants (*),
        units (*, properties(*))
      `)
      .eq("status", "late");

    if (fetchLateError) {
      logger.error("Error fetching all late payments", fetchLateError);
      console.log("Error fetching all late payments", fetchLateError);
      throw new Error("Failed to fetch late payments");
    }

    const results = [];
    const today = new Date();

    // 3. Process each late payment for notification
    for (const payment of allLatePayments as (RentPayment & { tenants: Tenant; units: Unit & { properties: Property } })[]) {
      try {
        const tenant = payment.tenants;
        const unit = payment.units;
        const property = unit.properties;

        if (!tenant || !unit || !property) {
          logger.warn(`Missing related data for late payment ${payment.id}`);
          console.log(`Missing related data for late payment ${payment.id}`);
          continue;
        }

        // Calculate days late
        const dueDate = new Date(payment.due_date);
        const timeDiff = today.getTime() - dueDate.getTime();
        const daysLate = Math.max(0, Math.floor(timeDiff / (1000 * 3600 * 24))); // Ensure non-negative

        // Skip payments that are 14+ days late (handled by N4/L1 logic)
        // Also skip if daysLate is 0 (e.g., updated today but due today)
        if (daysLate === 0 || daysLate >= 14) {
          continue;
        }

        // Format address
        const propertyAddress = `${property.address}, ${property.city}, ${property.province} ${property.postal_code}`;

        // Send late notification
        // TODO: Add logic to prevent sending multiple 'late' notifications for the same payment?
        // Maybe check the 'notifications' table for an existing 'rent_late' for this payment_id.
        const notification = await sendRentLateNotification(
          tenant,
          payment,
          unit,
          propertyAddress,
          daysLate
        );

        results.push({
          tenant: `${tenant.first_name} ${tenant.last_name}`,
          unit: unit.unit_number,
          amount: payment.amount,
          days_late: daysLate,
          status: "notification_sent",
          payment_id: payment.id,
          notification_id: notification.id
        });
      } catch (error) {
        logger.error(`Error processing late payment ${payment.id} for notification`, error);
        console.log(`Error processing late payment ${payment.id} for notification`, error);

        results.push({
          payment_id: payment.id,
          status: "failed",
          error: (error as Error).message
        });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (error) {
    logger.error("Error in late-rent endpoint", error);
    console.log("Error in late-rent endpoint", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Endpoint to identify tenants eligible for N4 forms (rent 14+ days late)
 * This would be triggered by a daily cron job
 */
router.get("/form-n4", async (req: Request, res: Response) => { // Add types
  try {
    logger.debug("Identifying tenants eligible for N4 form generation");
    console.log("Identifying tenants eligible for N4 form generation");

    // Get all late rent payments
    const { data: latePayments, error: fetchLateError } = await supabase
      .from("rent_payments")
      .select(`
        *,
        tenants (*),
        units (*)
      `)
      .eq("status", "late");

    if (fetchLateError) {
      logger.error("Error fetching late payments for N4 check", fetchLateError);
      console.log("Error fetching late payments for N4 check", fetchLateError);
      throw new Error("Failed to fetch late payments for N4 check");
    }

    const results = [];
    const today = new Date();

    // Filter payments that are 14+ days late
    for (const payment of latePayments as (RentPayment & { tenants: Tenant; units: Unit })[]) {
      const tenant = payment.tenants;
      const unit = payment.units;

      if (!tenant || !unit) {
        logger.warn(`Missing related data for N4 check on payment ${payment.id}`);
        console.log(`Missing related data for N4 check on payment ${payment.id}`);
        continue;
      }

      const dueDate = new Date(payment.due_date);
      const timeDiff = today.getTime() - dueDate.getTime();
      const daysLate = Math.max(0, Math.floor(timeDiff / (1000 * 3600 * 24)));

      if (daysLate >= 14) {
        // TODO: Check if an N4 notification/PDF generation request already exists for this payment?
        // In MVP, we just identify them. Actual PDF generation is triggered via /api/pdf routes.
        results.push({
          tenant: `${tenant.first_name} ${tenant.last_name}`,
          unit: unit.unit_number,
          amount: payment.amount,
          days_late: daysLate,
          payment_id: payment.id,
          status: "n4_eligible", // Mark as eligible, actual generation is separate
        });
      }
    }

    res.json({
      success: true,
      eligible_count: results.length,
      results
    });
  } catch (error) {
    logger.error("Error in form-n4 endpoint", error);
    console.log("Error in form-n4 endpoint", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Endpoint to identify tenants eligible for L1 forms (rent 15+ days late)
 * This would be triggered by a daily cron job
 */
router.get("/form-l1", async (req: Request, res: Response) => { // Add types
  try {
    logger.debug("Identifying tenants eligible for L1 form generation");
    console.log("Identifying tenants eligible for L1 form generation");

    // Get all late rent payments
    const { data: latePayments, error: fetchLateError } = await supabase
      .from("rent_payments")
      .select(`
        *,
        tenants (*),
        units (*)
      `)
      .eq("status", "late");

    if (fetchLateError) {
      logger.error("Error fetching late payments for L1 check", fetchLateError);
      console.log("Error fetching late payments for L1 check", fetchLateError);
      throw new Error("Failed to fetch late payments for L1 check");
    }

    const results = [];
    const today = new Date();

    // Filter payments that are 15+ days late
    for (const payment of latePayments as (RentPayment & { tenants: Tenant; units: Unit })[]) {
      const tenant = payment.tenants;
      const unit = payment.units;

      if (!tenant || !unit) {
        logger.warn(`Missing related data for L1 check on payment ${payment.id}`);
        console.log(`Missing related data for L1 check on payment ${payment.id}`);
        continue;
      }

      const dueDate = new Date(payment.due_date);
      const timeDiff = today.getTime() - dueDate.getTime();
      const daysLate = Math.max(0, Math.floor(timeDiff / (1000 * 3600 * 24)));

      if (daysLate >= 15) {
        // TODO: Check if an L1 notification/PDF generation request already exists?
        // In MVP, we just identify them. Actual PDF generation is triggered via /api/pdf routes.
        results.push({
          tenant: `${tenant.first_name} ${tenant.last_name}`,
          unit: unit.unit_number,
          amount: payment.amount,
          days_late: daysLate,
          payment_id: payment.id,
          status: "l1_eligible", // Mark as eligible, actual generation is separate
        });
      }
    }

    res.json({
      success: true,
      eligible_count: results.length,
      results
    });
  } catch (error) {
    logger.error("Error in form-l1 endpoint", error);
    console.log("Error in form-l1 endpoint", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Endpoint to identify tenants who have passed their rent due day
 * by comparing today's day with the rent_due_day in the tenant_units table
 * and create a payment if one doesn't already exist for this month
 * 
 * Query params:
 * - day: Optional override for current day (useful for testing)
 */
router.get("/past-due-day", async (req: Request, res: Response) => {
  try {
    logger.debug("Checking for tenants who need payments created for this month");
    console.log("Checking for tenants who need payments created for this month");

    // Get current day of month (or use the day parameter if provided)
    const today = new Date();

    // Check if a specific day was provided for testing
    const testDayParam = req.query.day as string | undefined;
    let currentDay = today.getDate();

    // If test day parameter provided, use that instead
    if (testDayParam && !isNaN(parseInt(testDayParam))) {
      currentDay = parseInt(testDayParam);
      console.log(`DEBUG: Using test day parameter: ${currentDay} instead of actual day: ${today.getDate()}`);
    }

    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    console.log(`DEBUG: Current date: ${today.toISOString()}, day: ${currentDay}, month: ${currentMonth + 1}`);

    // Format today's date for comparisons
    const currentMonthFormatted = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

    // Get all tenant_units with their tenant and unit information
    const { data: allTenantUnits, error: fetchError } = await supabase
      .from("tenant_units")
      .select(`
        *,
        tenants (*),
        units (*)
      `);

    console.log(`DEBUG: Fetched ${allTenantUnits ? allTenantUnits.length : 0} tenant_units with joins`);

    if (fetchError) {
      logger.error("Error fetching tenant_units with joins", fetchError);
      console.log("Error fetching tenant_units with joins", fetchError.message);
      return res.status(500).json({
        success: false,
        error: fetchError.message
      });
    }

    if (!allTenantUnits || allTenantUnits.length === 0) {
      console.log("DEBUG: No tenant_units found in database with joins");
      return res.json({
        success: true,
        created_payments: 0,
        message: "No tenant_units found",
        results: []
      });
    }

    // Find tenants whose rent due day has passed
    const tenantUnitsWithDueDayPassed = allTenantUnits.filter(tu => {
      // Skip entries without tenant or unit info
      if (!tu.tenants || !tu.units) {
        console.log(`DEBUG: Skipping tenant_unit ${tu.tenant_id || tu.id || 'unknown'} - missing tenant or unit info`);
        return false;
      }

      // Handle null or undefined rent_due_day
      if (tu.rent_due_day === null || tu.rent_due_day === undefined) {
        console.log(`DEBUG: Tenant unit ${tu.id} has null/undefined rent_due_day, skipping`);
        return false;
      }

      // Convert to number explicitly
      const dueDayAsNumber = Number(tu.rent_due_day);

      // Check if it's a valid number
      if (isNaN(dueDayAsNumber)) {
        console.log(`DEBUG: Tenant unit ${tu.id} has invalid rent_due_day: ${tu.rent_due_day}, skipping`);
        return false;
      }

      // Compare with current day
      const isDueDayPassed = dueDayAsNumber < currentDay;
      console.log(`DEBUG: Tenant: ${tu.tenants.first_name} ${tu.tenants.last_name}, Current day: ${currentDay}, rent_due_day: ${dueDayAsNumber}, is due day passed: ${isDueDayPassed}`);

      return isDueDayPassed;
    });

    console.log(`DEBUG: Found ${tenantUnitsWithDueDayPassed.length} tenant_units with rent_due_day < ${currentDay}`);

    const results = [];

    // Process each tenant unit with due day passed
    for (const tenantUnit of tenantUnitsWithDueDayPassed) {
      try {
        const tenant = tenantUnit.tenants;
        const unit = tenantUnit.units;

        console.log(`DEBUG: Processing tenant_unit ID: ${tenantUnit.id}`);
        console.log(`DEBUG: Tenant: ${tenant.first_name} ${tenant.last_name} (ID: ${tenant.id})`);
        console.log(`DEBUG: Unit: ${unit.unit_number} (ID: ${unit.id})`);

        // Calculate the due date for this month
        const dueDayAsNumber = Number(tenantUnit.rent_due_day);
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

        // Create a new payment record
        console.log(`Creating new payment record for tenant ${tenant.first_name} ${tenant.last_name}`);

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
          payment_date: null;
          status: "pending" | "late";
          payment_method: null;
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

        results.push({
          tenant: `${tenant.first_name} ${tenant.last_name}`,
          unit: unit.unit_number,
          amount: tenantUnit.rent_amount,
          due_date: dueDateFormatted,
          status: `${status}_payment_created`,
          payment_id: newPayment.id
        });
      } catch (error) {
        logger.error(`Error processing tenant_unit ${tenantUnit.id}`, error);
        console.log(`Error processing tenant_unit ${tenantUnit.id}`, error);
      }
    }

    console.log(`Created ${results.length} payment records`);

    res.json({
      success: true,
      created_payments: results.length,
      results
    });
  } catch (error) {
    logger.error("Error in past-due-day endpoint", error);
    console.log("Error in past-due-day endpoint", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
