import express, { Request, Response } from "express";
import { vectorTool, analyzeTool, orchestrateWorkflow } from "../tools";
import { logger } from "../utils/logger";

const router = express.Router();

/**
 * @route GET /api/ai-tools/vector/modules
 * @description Get information about all modules
 * @access Public
 */
router.get("/vector/modules", async (req: Request, res: Response) => {
  try {
    // Get information about all modules
    const moduleNames = [
      "Tenant Service",
      "Rent Service",
      "Payment Service",
      "Notification Service",
      "WhatsApp Service",
      "Cron Routes",
      "API Service",
      "Payments Page"
    ];

    const modules = moduleNames.map(moduleName => vectorTool.getModuleInfo(moduleName));

    res.json({
      success: true,
      modules
    });
  } catch (error) {
    logger.error("Error getting modules", error);
    console.log("Error getting modules", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @route GET /api/ai-tools/vector/entities
 * @description Get information about all entities
 * @access Public
 */
router.get("/vector/entities", async (req: Request, res: Response) => {
  try {
    // Get information about all entities
    const entityNames = [
      "Tenants",
      "Units",
      "Properties",
      "TenantUnits",
      "Rent Payments",
      "Notifications"
    ];

    const entities = entityNames.map(entityName => vectorTool.getEntityInfo(entityName));

    res.json({
      success: true,
      entities
    });
  } catch (error) {
    logger.error("Error getting entities", error);
    console.log("Error getting entities", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @route GET /api/ai-tools/vector/module/:name
 * @description Get information about a specific module
 * @access Public
 */
router.get("/vector/module/:name", async (req: Request, res: Response) => {
  try {
    const moduleName = req.params.name;
    const moduleInfo = vectorTool.getModuleInfo(moduleName);

    res.json({
      success: true,
      module: moduleInfo
    });
  } catch (error) {
    logger.error(`Error getting module ${req.params.name}`, error);
    console.log(`Error getting module ${req.params.name}`, error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @route GET /api/ai-tools/vector/entity/:name
 * @description Get information about a specific entity
 * @access Public
 */
router.get("/vector/entity/:name", async (req: Request, res: Response) => {
  try {
    const entityName = req.params.name;
    const entityInfo = vectorTool.getEntityInfo(entityName);

    res.json({
      success: true,
      entity: entityInfo
    });
  } catch (error) {
    logger.error(`Error getting entity ${req.params.name}`, error);
    console.log(`Error getting entity ${req.params.name}`, error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @route GET /api/ai-tools/vector/function/:name
 * @description Get information about a specific function
 * @access Public
 */
router.get("/vector/function/:name", async (req: Request, res: Response) => {
  try {
    const functionName = req.params.name;
    const functionInfo = vectorTool.getFunctionInfo(functionName);

    res.json({
      success: true,
      function: functionInfo
    });
  } catch (error) {
    logger.error(`Error getting function ${req.params.name}`, error);
    console.log(`Error getting function ${req.params.name}`, error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @route POST /api/ai-tools/analyze
 * @description Analyze a code path and plan modifications
 * @access Public
 */
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { codePath, proposedChange } = req.body;

    if (!codePath || !proposedChange) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: codePath and proposedChange"
      });
    }

    const analysisResult = analyzeTool.analyzeCodePath(codePath, proposedChange);

    res.json({
      success: true,
      analysis: analysisResult
    });
  } catch (error) {
    logger.error("Error analyzing code path", error);
    console.log("Error analyzing code path", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @route POST /api/ai-tools/validate
 * @description Validate a proposed change against the system architecture
 * @access Public
 */
router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { component, change } = req.body;

    if (!component || !change) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: component and change"
      });
    }

    const validationResult = vectorTool.validateChange(component, change);

    res.json({
      success: true,
      validation: validationResult
    });
  } catch (error) {
    logger.error("Error validating change", error);
    console.log("Error validating change", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * @route POST /api/ai-tools/orchestrate
 * @description Orchestrate an iterative workflow to plan and validate changes
 * @access Public
 */
router.post("/orchestrate", async (req: Request, res: Response) => {
  try {
    const { codePath, proposedChange } = req.body;

    if (!codePath || !proposedChange) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: codePath and proposedChange"
      });
    }

    const orchestrationResult = await orchestrateWorkflow(codePath, proposedChange);

    res.json({
      success: true,
      orchestration: orchestrationResult
    });
  } catch (error) {
    logger.error("Error orchestrating workflow", error);
    console.log("Error orchestrating workflow", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
