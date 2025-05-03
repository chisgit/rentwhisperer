import express from "express";
import { tenantService } from "../services/tenant.service";
import { logger } from "../utils/logger";

const router = express.Router();

/**
 * Get all tenants
 */
router.get("/", async (req, res) => {
  try {
    logger.debug("GET /api/tenants - Getting all tenants");
    console.log("GET /api/tenants - Getting all tenants");

    const tenants = await tenantService.getAllTenants();
    res.json(tenants);
  } catch (error) {
    logger.error("Error getting tenants", error);
    console.log("Error getting tenants", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Get all units
 */
router.get("/units", async (req, res) => {
  try {
    logger.debug("GET /api/tenants/units - Getting all units");
    console.log("GET /api/tenants/units - Getting all units");

    const units = await tenantService.getAllUnits();
    res.json(units);
  } catch (error) {
    logger.error("Error getting units", error);
    console.log("Error getting units", error);
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

    const tenant = await tenantService.getTenantById(id);
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

    const tenant = await tenantService.createTenant({
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

    const tenant = await tenantService.updateTenant(id, validUpdates);
    res.json(tenant);
  } catch (error) {
    logger.error("Error updating tenant", error);
    console.log("Error updating tenant", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * Diagnostic route to test Supabase connection
 */
router.get("/diagnostic", async (req, res) => {
  try {
    console.log("Testing Supabase connection...");
    const { supabase } = require("../config/database");

    // First, check if tables exist
    const { data: tablesData, error: tablesError } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');

    if (tablesError) {
      return res.status(500).json({
        status: "error",
        message: "Failed to query tables",
        error: tablesError
      });
    }

    // Try to get Supabase URL and key from .env
    const supabaseUrl = process.env.SUPABASE_URL || "Not found";
    const hasKey = process.env.SUPABASE_KEY ? "Present (hidden)" : "Not found";

    // Return diagnostic info
    return res.json({
      status: "ok",
      supabase: {
        url: supabaseUrl,
        key_present: hasKey,
        connection: supabase ? "Initialized" : "Failed",
        tables: tablesData || []
      }
    });
  } catch (error) {
    console.error("Diagnostic error:", error);
    return res.status(500).json({
      status: "error",
      message: "Diagnostic failed",
      error: String(error)
    });
  }
});

// Removed duplicate route handler for /units

export default router;
