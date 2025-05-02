import express, { Request, Response } from "express"; // Import Request, Response types
// Import the service instances
import { rentService } from "../services/rent.service";
import { tenantService } from "../services/tenant.service";
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

export default router;
