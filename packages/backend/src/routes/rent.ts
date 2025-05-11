import express, { Request, Response, NextFunction } from "express"; // Add Request, Response, NextFunction types
import { rentService } from "../services/rent.service";
import { logger } from "../utils/logger";
import { validateRequest } from "../middleware/validation.middleware"; // Import validation middleware
import { createRentPaymentSchema, updateRentPaymentSchema } from "../validators/rent.validator"; // Import rent schemas
import { paymentService } from "../services/payment.service";

const router = express.Router();

/**
 * Get all rent payments
 */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug("GET /api/rent - Getting all rent payments");
    console.log("GET /api/rent - Getting all rent payments");
    logger.debug(`Request query: ${JSON.stringify(req.query)}`);

    const { tenantId, unitId } = req.query;
    logger.debug(`Calling paymentService.listPayments with tenantId: ${tenantId}, unitId: ${unitId}`);
    const payments = await paymentService.listPayments(tenantId as string, unitId as string);
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

// GET /api/rent/pending - Get all pending/late rent payments
router.get("/pending", async (req: Request, res: Response, next: NextFunction) => { // Add types
  try {
    logger.debug("GET /api/rent/pending - Fetching pending rent payments");
    console.log("Fetching pending rent payments");
    logger.debug("Calling rentService.getPendingRentPayments");
    const payments = await rentService.getPendingRentPayments();

    // Add debug logging to see if tenant_name and unit_number are included in the response
    if (payments && payments.length > 0) {
      // Temporarily remove tenant_name and unit_number from debug log to fix build
      // These fields are not directly on RentPayment type.
      // The service layer would need to join to get them.
      console.log(`DEBUG: First payment in response (basic):`, {
        id: payments[0].id,
        tenant_id: payments[0].tenant_id,
        // tenant_name: (payments[0] as any).tenant_name || 'Missing tenant_name', // Cast to any if you want to keep for debugging, but it's not type-safe
        unit_id: payments[0].unit_id,
        // unit_number: (payments[0] as any).unit_number || 'Missing unit_number', // Cast to any
        status: payments[0].status
      });
    } else {
      console.log('DEBUG: No pending payments found');
    }

    res.json(payments);
  } catch (error) {
    next(error);
  }
});

// GET /api/rent/tenant/:tenantId - Get all rent payments for a specific tenant
router.get("/tenant/:tenantId", async (req: Request, res: Response, next: NextFunction) => { // Add types
  try {
    const { tenantId } = req.params;
    logger.debug(`GET /api/rent/tenant/:tenantId - Fetching rent payments for tenant ID: ${tenantId}`);
    console.log(`Fetching rent payments for tenant ID: ${tenantId}`);
    logger.debug(`Calling rentService.getRentPaymentsByTenantId with tenantId: ${tenantId}`);
    const payments = await rentService.getRentPaymentsByTenantId(tenantId);
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

/**
 * Get rent payment by ID
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    logger.debug(`GET /api/rent/:id - Fetching rent payment with ID: ${id}`);
    console.log(`Fetching rent payment with ID: ${id}`);
    logger.debug(`Calling paymentService.getPayment with id: ${id}`);
    const payment = await paymentService.getPayment(id);
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.debug("POST /api/rent - Creating a new rent payment manually");
      console.log("Creating a new rent payment manually with data:", req.body);
      logger.debug(`Request body: ${JSON.stringify(req.body)}`);
      logger.debug("Calling paymentService.createPayment");
      const newPayment = await paymentService.createPayment(req.body);
      res.status(201).json(newPayment);
    } catch (error) {
      next(error);
    }
  }
);

/**

/**
 * Update rent payment
 */
router.put(
  "/:id",
  validateRequest(updateRentPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      logger.debug(`PUT /api/rent/:id - Updating rent payment with ID: ${id}`);
      console.log(`Updating rent payment with ID: ${id} with data:`, req.body);
      logger.debug(`Request params: ${JSON.stringify(req.params)}, Request body: ${JSON.stringify(req.body)}`);
      logger.debug(`Calling paymentService.updatePayment with id: ${id}`);
      const updatedPayment = await paymentService.updatePayment(id, req.body);
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
