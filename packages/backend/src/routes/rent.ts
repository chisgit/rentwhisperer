import express, { Request, Response, NextFunction } from "express"; // Add Request, Response, NextFunction types
import { rentService } from "../services/rent.service";
import { logger } from "../utils/logger";
import { validateRequest } from "../middleware/validation.middleware"; // Import validation middleware
import { createRentPaymentSchema, updateRentPaymentSchema } from "../validators/rent.validator"; // Import rent schemas
import { supabase } from "../config/database"; // Import supabase client

const router = express.Router();

/**
 * Get all rent payments
 */
router.get("/", async (req, res) => {
  try {
    logger.debug("GET /api/rent - Getting all rent payments");
    console.log("GET /api/rent - Getting all rent payments");

    const { data, error } = await supabase
      .from("rent_payments")
      .select(`
        *,
        tenant:tenants(first_name, last_name),
        unit:units(unit_number, property_id)
      `);

    if (error) {
      logger.error("Error fetching rent payments", error);
      console.log("Error fetching rent payments", error);
      throw new Error("Failed to fetch rent payments");
    }

    res.json(data);
  } catch (error) {
    logger.error("Error getting rent payments", error);
    console.log("Error getting rent payments", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/rent/pending - Get all pending/late rent payments
router.get("/pending", async (req: Request, res: Response, next: NextFunction) => { // Add types
  try {
    logger.debug("Fetching pending rent payments");
    console.log("Fetching pending rent payments");
    const payments = await rentService.getPendingRentPayments();
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

// GET /api/rent/tenant/:tenantId - Get all rent payments for a specific tenant
router.get("/tenant/:tenantId", async (req: Request, res: Response, next: NextFunction) => { // Add types
  try {
    const { tenantId } = req.params;
    logger.debug(`Fetching rent payments for tenant ID: ${tenantId}`);
    console.log(`Fetching rent payments for tenant ID: ${tenantId}`);
    const payments = await rentService.getRentPaymentsByTenantId(tenantId);
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

/**
 * Get rent payment by ID
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => { // Add types
  try {
    const { id } = req.params;
    logger.debug(`Fetching rent payment with ID: ${id}`);
    console.log(`Fetching rent payment with ID: ${id}`);
    const payment = await rentService.getRentPaymentById(id);
    if (!payment) {
      return res.status(404).json({ error: true, message: "Rent payment not found" });
    }
    res.json(payment);
  } catch (error) {
    next(error);
  }
});

/**
 * Create new rent payment
 */
router.post(
  "/",
  validateRequest(createRentPaymentSchema), // Apply validation
  async (req: Request, res: Response, next: NextFunction) => { // Add types
    try {
      logger.debug("Creating a new rent payment manually");
      console.log("Creating a new rent payment manually with data:", req.body);
      const newPayment = await rentService.createRentPayment(req.body);
      res.status(201).json(newPayment);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update rent payment status
 */
router.put(
  "/:id",
  validateRequest(updateRentPaymentSchema), // Apply validation
  async (req: Request, res: Response, next: NextFunction) => { // Add types
    try {
      const { id } = req.params;
      logger.debug(`Updating rent payment with ID: ${id}`);
      console.log(`Updating rent payment with ID: ${id} with data:`, req.body);

      // Extract only the fields allowed by the schema for update
      const { status, payment_date } = req.body; // Removed payment_method as it's not used in the service call

      // Ensure status is provided if attempting an update
      if (!status) {
        return res.status(400).json({ error: true, message: "Missing required field: status" });
      }

      // Call the specific update status method
      const updatedPayment = await rentService.updateRentPaymentStatus(
        id,
        status, // Status is required by the service method
        payment_date // Optional payment date
      );

      if (!updatedPayment) {
        return res.status(404).json({ error: true, message: "Rent payment not found" });
      }
      res.json(updatedPayment);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
