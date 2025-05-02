import express from "express";
import { getAllTenants, getTenantById, createTenant, updateTenant } from "../services/tenant.service";
import { logger } from "../utils/logger";

const router = express.Router();

/**
 * Get all tenants
 */
router.get("/", async (req, res) => {
  try {
    logger.debug("GET /api/tenants - Getting all tenants");
    console.log("GET /api/tenants - Getting all tenants");
    
    const tenants = await getAllTenants();
    res.json(tenants);
  } catch (error) {
    logger.error("Error getting tenants", error);
    console.log("Error getting tenants", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Get tenant by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.debug(`GET /api/tenants/${id} - Getting tenant by ID`);
    console.log(`GET /api/tenants/${id} - Getting tenant by ID`);
    
    const tenant = await getTenantById(id);
    res.json(tenant);
  } catch (error) {
    logger.error("Error getting tenant by ID", error);
    console.log("Error getting tenant by ID", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Create new tenant
 */
router.post("/", async (req, res) => {
  try {
    const { first_name, last_name, email, phone, unit_id } = req.body;
    
    logger.debug("POST /api/tenants - Creating new tenant");
    console.log("POST /api/tenants - Creating new tenant:", first_name, last_name);
    
    // Basic validation
    if (!first_name || !last_name || !phone || !unit_id) {
      return res.status(400).json({
        error: "Missing required fields: first_name, last_name, phone, and unit_id are required"
      });
    }
    
    const tenant = await createTenant({
      first_name,
      last_name,
      email,
      phone,
      unit_id
    });
    
    res.status(201).json(tenant);
  } catch (error) {
    logger.error("Error creating tenant", error);
    console.log("Error creating tenant", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Update tenant
 */
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    logger.debug(`PATCH /api/tenants/${id} - Updating tenant`);
    console.log(`PATCH /api/tenants/${id} - Updating tenant`);
    
    // Remove fields that shouldn't be updated directly
    const { id: _, created_at, updated_at, ...validUpdates } = updates;
    
    const tenant = await updateTenant(id, validUpdates);
    res.json(tenant);
  } catch (error) {
    logger.error("Error updating tenant", error);
    console.log("Error updating tenant", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
