import express from "express";
import { tenantService } from "../services/tenant.service";
import { logger } from "../utils/logger";
import { fixTenantUnitRelationship } from "../utils/tenant-unit-fixer";

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
    const clientErrorMessage = error instanceof Error ? error.message : "An unexpected error occurred while fetching tenants.";
    // Log the full error for server-side diagnostics
    logger.error("Error getting tenants route handler:", {
      originalError: error, // Full error object
      messageForClient: clientErrorMessage, // Message being sent to client
      requestPath: req.path,
      requestMethod: req.method
    });
    console.error("Error getting tenants (raw):", error); // Keep console.error for raw error

    // Ensure a valid JSON response is sent
    res.status(500).json({ error: clientErrorMessage });
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
    const clientErrorMessage = error instanceof Error ? error.message : "An unexpected error occurred while fetching units.";
    logger.error("Error getting units route handler:", {
      originalError: error,
      messageForClient: clientErrorMessage,
      requestPath: req.path,
      requestMethod: req.method
    });
    console.error("Error getting units (raw):", error);
    res.status(500).json({ error: clientErrorMessage });
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
    const clientErrorMessage = error instanceof Error ? error.message : "An unexpected error occurred while fetching tenant by ID.";
    logger.error("Error getting tenant by ID route handler:", {
      originalError: error,
      messageForClient: clientErrorMessage,
      requestPath: req.path,
      requestMethod: req.method
    });
    console.error("Error getting tenant by ID (raw):", error);
    res.status(500).json({ error: clientErrorMessage });
  }
});

/**
 * Create new tenant
 */
router.post("/", async (req, res) => {
  try {
    const { first_name, last_name, email, phone, unit_id, rent_amount, rent_due_day } = req.body;
    const landlordId = "322128c3-eba9-40b7-a8e9-9a35e498197a"; // Hardcoded landlord ID

    logger.debug("POST /tenants - Creating new tenant");
    console.log("POST /tenants - Creating new tenant:", first_name, last_name);
    console.log("Received rent data:", { rent_amount, rent_due_day });

    // Basic validation
    if (!first_name || !last_name || !phone || !unit_id) {
      return res.status(400).json({
        error: "Missing required fields: first_name, last_name, phone, and unit_id are required"
      });
    }

    // Pass ALL the fields including rent_amount and rent_due_day
    const tenant = await tenantService.createTenant({
      first_name,
      last_name,
      email,
      phone,
      unit_id,
      rent_amount: rent_amount !== undefined ? Number(rent_amount) : undefined, // Ensure it's a number
      rent_due_day: rent_due_day !== undefined ? Number(rent_due_day) : undefined // Ensure it's a number
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
    logger.debug(`[DEBUG-FLOW] PATCH /api/tenants/${id} - Starting tenant update process`);
    console.log(`PATCH /api/tenants/${id} - Updating tenant with data:`, updates);
    console.log(`PATCH /api/tenants/${id} - Request body raw:`, JSON.stringify(req.body));

    // Remove fields that shouldn't be updated directly
    const { id: _, created_at, updated_at, tenant_units, ...validUpdates } = updates;

    console.log(`Cleaned update data for tenant ${id}:`, validUpdates);
    console.log(`[DEBUG-FLOW] Data cleaning complete. Processing with validUpdates:`, JSON.stringify(validUpdates));

    // Extract fields for tenant_units table
    const { rent_amount, rent_due_day, unit_id } = validUpdates;

    console.log(`[DEBUG-FLOW] Extracted fields: rent_amount=${rent_amount}, rent_due_day=${rent_due_day}, unit_id=${unit_id}`);
    console.log(`[DEBUG-FLOW] Types - rent_amount: ${typeof rent_amount}, rent_due_day: ${typeof rent_due_day}, unit_id: ${typeof unit_id}`);
    console.log(`[DEBUG-FLOW] Values present? rent_amount: ${rent_amount !== undefined}, rent_due_day: ${rent_due_day !== undefined}, unit_id: ${unit_id !== undefined}`);

    // First update the basic tenant information
    console.log(`[DEBUG-FLOW] Calling tenantService.updateTenant with id=${id}`);
    const startTime = Date.now();
    const tenant = await tenantService.updateTenant(id, validUpdates);
    console.log(`[DEBUG-FLOW] tenantService.updateTenant completed in ${Date.now() - startTime}ms`);
    console.log(`[DEBUG-FLOW] Tenant service returned:`, tenant ? `Tenant with id=${tenant.id}` : "null");

    if (tenant) {
      console.log(`[DEBUG-FLOW] Returned tenant values: rent_amount=${tenant.rent_amount}, rent_due_day=${tenant.rent_due_day}`);
    }

    // If we have rent_amount, rent_due_day, and unit_id, make sure the tenant_units relationship is updated
    if (unit_id && (rent_amount !== undefined || rent_due_day !== undefined)) {
      console.log(`[DEBUG-FLOW] Tenant-unit relationship update needed`);
      console.log(`Ensuring tenant-unit relationship between tenant ${id} and unit ${unit_id} with rent_amount=${rent_amount}, rent_due_day=${rent_due_day}`);

      // Use our utility to ensure the relationship is properly updated
      try {
        const fixStartTime = Date.now();
        const fixResult = await fixTenantUnitRelationship(
          id,
          unit_id,
          rent_amount !== undefined ? Number(rent_amount) : (tenant && tenant.rent_amount ? Number(tenant.rent_amount) : 0),
          rent_due_day !== undefined ? Number(rent_due_day) : (tenant && tenant.rent_due_day ? Number(tenant.rent_due_day) : 1)
        );
        console.log(`[DEBUG-FLOW] fixTenantUnitRelationship completed in ${Date.now() - fixStartTime}ms`);
        console.log(`Tenant-unit fix result:`, fixResult);

        if (!fixResult.success) {
          console.warn(`WARNING: Failed to update tenant-unit relationship: ${fixResult.message}`);
        } else {
          console.log(`[DEBUG-FLOW] Tenant-unit relationship successfully updated`);
        }
      } catch (fixError) {
        console.error(`[DEBUG-FLOW] Exception in fixTenantUnitRelationship:`, fixError);
      }
    } else {
      console.log(`[DEBUG-FLOW] No tenant-unit update required. unit_id=${unit_id}, rent_amount=${rent_amount}, rent_due_day=${rent_due_day}`);
    }

    // Refresh tenant data to get latest values after relationships are updated
    console.log(`[DEBUG-FLOW] Refreshing tenant data before sending to client`);
    let refreshedTenant = tenant;
    try {
      refreshedTenant = await tenantService.getTenantById(id);
      console.log(`[DEBUG-FLOW] Refreshed tenant data: rent_amount=${refreshedTenant?.rent_amount}, rent_due_day=${refreshedTenant?.rent_due_day}`);
    } catch (refreshError) {
      console.error(`[DEBUG-FLOW] Error refreshing tenant data:`, refreshError);
    }

    // Return the updated tenant (including fresh values from tenant_units)
    console.log(`Sending updated tenant back to client:`, refreshedTenant || tenant);
    res.json(refreshedTenant || tenant);
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
