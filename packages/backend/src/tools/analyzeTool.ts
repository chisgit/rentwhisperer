import { vectorTool } from "./vectorTool";
import { logger } from "../utils/logger";

/**
 * AnalyzeTool - A tool for analyzing code paths and planning modifications
 * 
 * This tool uses the VectorTool to:
 * 1. Analyze a given code path or feature
 * 2. Plan modifications
 * 3. Identify affected areas
 * 4. Validate changes against the system architecture
 */
export class AnalyzeTool {
  /**
   * Analyze a code path or feature and plan modifications
   * @param codePath The code path or feature to analyze
   * @param proposedChange The proposed change to make
   * @returns Analysis result with modification plan
   */
  public analyzeCodePath(codePath: string, proposedChange: string): any {
    try {
      logger.debug(`Analyzing code path: ${codePath}`);
      console.log(`Analyzing code path: ${codePath}`);

      // Determine if the code path is a module, entity, or function
      const moduleInfo = vectorTool.getModuleInfo(codePath);
      const entityInfo = vectorTool.getEntityInfo(codePath);
      const functionInfo = vectorTool.getFunctionInfo(codePath);

      let componentType = "unknown";
      let componentInfo = null;

      if (moduleInfo && moduleInfo.role !== "Unknown module") {
        componentType = "module";
        componentInfo = moduleInfo;
      } else if (entityInfo && !entityInfo.info.includes("not found")) {
        componentType = "entity";
        componentInfo = entityInfo;
      } else if (functionInfo && !functionInfo.info.includes("not found")) {
        componentType = "function";
        componentInfo = functionInfo;
      }

      if (componentType === "unknown") {
        return {
          success: false,
          error: `Could not identify code path: ${codePath}`,
          suggestions: [
            "Try specifying a module name (e.g., 'Tenant Service')",
            "Try specifying an entity name (e.g., 'Tenants')",
            "Try specifying a function name (e.g., 'generateRentDueToday')"
          ]
        };
      }

      // Get impacted components
      let impactInfo;
      if (componentType === "module") {
        impactInfo = vectorTool.findImpactedComponents(codePath);
      } else if (componentType === "entity") {
        impactInfo = vectorTool.findImpactedComponentsByEntity(codePath);
      } else if (componentType === "function") {
        impactInfo = vectorTool.findImpactedComponentsByFunction(codePath);
      }

      // Validate the proposed change
      const validationResult = vectorTool.validateChange(codePath, proposedChange);

      // Generate a modification plan
      const modificationPlan = this.generateModificationPlan(
        componentType,
        componentInfo,
        impactInfo,
        proposedChange,
        validationResult
      );

      return {
        success: true,
        componentType,
        componentInfo,
        impactInfo,
        validationResult,
        modificationPlan
      };
    } catch (error) {
      logger.error(`Error analyzing code path: ${error}`);
      console.log(`Error analyzing code path: ${error}`);
      return {
        success: false,
        error: `Failed to analyze code path: ${error}`
      };
    }
  }

  /**
   * Generate a modification plan based on the analysis
   * @param componentType The type of component being modified
   * @param componentInfo Information about the component
   * @param impactInfo Information about impacted components
   * @param proposedChange The proposed change
   * @param validationResult The validation result
   * @returns Modification plan
   */
  private generateModificationPlan(
    componentType: string,
    componentInfo: any,
    impactInfo: any,
    proposedChange: string,
    validationResult: any
  ): any {
    // Generate steps for the modification plan
    const steps = [];

    // Step 1: Understand the component and its role
    steps.push({
      step: "Understand the component",
      description: `Understand the role of the ${componentType} '${componentInfo.name}' in the system`,
      details: this.getComponentDetails(componentType, componentInfo)
    });

    // Step 2: Identify dependencies and relationships
    steps.push({
      step: "Identify dependencies",
      description: "Identify dependencies and relationships that might be affected",
      details: this.getDependencyDetails(componentType, componentInfo, impactInfo)
    });

    // Step 3: Plan the modification
    steps.push({
      step: "Plan the modification",
      description: `Plan the implementation of the proposed change: ${proposedChange}`,
      details: this.getPlanDetails(componentType, componentInfo, proposedChange)
    });

    // Step 4: Identify affected areas
    steps.push({
      step: "Identify affected areas",
      description: "Identify all areas that will be affected by the change",
      details: this.getAffectedAreasDetails(impactInfo)
    });

    // Step 5: Validate the change
    steps.push({
      step: "Validate the change",
      description: "Validate the change against the system architecture",
      details: this.getValidationDetails(validationResult)
    });

    // Step 6: Implementation strategy
    steps.push({
      step: "Implementation strategy",
      description: "Define the implementation strategy for the change",
      details: this.getImplementationStrategyDetails(componentType, componentInfo, proposedChange, impactInfo)
    });

    // Step 7: Testing strategy
    steps.push({
      step: "Testing strategy",
      description: "Define the testing strategy for the change",
      details: this.getTestingStrategyDetails(componentType, componentInfo, impactInfo)
    });

    return {
      summary: `Modification plan for ${componentType} '${componentInfo.name}': ${proposedChange}`,
      steps,
      warnings: validationResult.warnings || []
    };
  }

  /**
   * Get details about a component
   * @param componentType The type of component
   * @param componentInfo Information about the component
   * @returns Component details
   */
  private getComponentDetails(componentType: string, componentInfo: any): string {
    if (componentType === "module") {
      return `The module '${componentInfo.name}' is responsible for ${componentInfo.role}. It has ${componentInfo.dependencies.length} dependencies and is used by ${componentInfo.dependents.length} other modules.`;
    } else if (componentType === "entity") {
      return `The entity '${componentInfo.name}' is a database table that stores ${componentInfo.info.split("\n")[0].replace(/^#### [^\n]+\n- \*\*Purpose\*\*: /, "")}. It has relationships with ${componentInfo.relatedEntities.length} other entities.`;
    } else if (componentType === "function") {
      return `The function '${componentInfo.name}' is part of the module '${componentInfo.module}'. It ${componentInfo.info}. The module is responsible for ${componentInfo.moduleInfo.role}.`;
    }
    return "";
  }

  /**
   * Get details about dependencies and relationships
   * @param componentType The type of component
   * @param componentInfo Information about the component
   * @param impactInfo Information about impacted components
   * @returns Dependency details
   */
  private getDependencyDetails(componentType: string, componentInfo: any, impactInfo: any): string {
    if (componentType === "module") {
      return `The module '${componentInfo.name}' depends on: ${componentInfo.dependencies.join(", ")}. It is used by: ${componentInfo.dependents.join(", ") || "no other modules"}.`;
    } else if (componentType === "entity") {
      return `The entity '${componentInfo.name}' has the following relationships: ${componentInfo.relationships.join(", ")}. It is related to: ${componentInfo.relatedEntities.join(", ") || "no other entities"}.`;
    } else if (componentType === "function") {
      return `The function '${componentInfo.name}' is part of the module '${componentInfo.module}', which depends on: ${componentInfo.moduleInfo.dependencies.join(", ")}. Changes to this function may impact: ${impactInfo.impactedFunctions.join(", ") || "no other functions"}.`;
    }
    return "";
  }

  /**
   * Get details about the modification plan
   * @param componentType The type of component
   * @param componentInfo Information about the component
   * @param proposedChange The proposed change
   * @returns Plan details
   */
  private getPlanDetails(componentType: string, componentInfo: any, proposedChange: string): string {
    if (componentType === "module") {
      return `To implement the change '${proposedChange}' in the module '${componentInfo.name}', we need to modify the module's implementation while ensuring that all dependent modules continue to work correctly.`;
    } else if (componentType === "entity") {
      return `To implement the change '${proposedChange}' in the entity '${componentInfo.name}', we need to modify the database schema and ensure that all modules that use this entity are updated accordingly.`;
    } else if (componentType === "function") {
      return `To implement the change '${proposedChange}' in the function '${componentInfo.name}', we need to modify the function's implementation while ensuring that all calling code continues to work correctly.`;
    }
    return "";
  }

  /**
   * Get details about affected areas
   * @param impactInfo Information about impacted components
   * @returns Affected areas details
   */
  private getAffectedAreasDetails(impactInfo: any): string {
    const affectedAreas = [];

    if (impactInfo.impactedModules && impactInfo.impactedModules.length > 0) {
      affectedAreas.push(`Modules: ${impactInfo.impactedModules.join(", ")}`);
    }

    if (impactInfo.impactedEntities && impactInfo.impactedEntities.length > 0) {
      affectedAreas.push(`Entities: ${impactInfo.impactedEntities.join(", ")}`);
    }

    if (impactInfo.impactedFunctions && impactInfo.impactedFunctions.length > 0) {
      affectedAreas.push(`Functions: ${impactInfo.impactedFunctions.join(", ")}`);
    }

    if (impactInfo.impactedFlows && impactInfo.impactedFlows.length > 0) {
      affectedAreas.push(`Data flows: ${impactInfo.impactedFlows.join(", ")}`);
    }

    if (affectedAreas.length === 0) {
      return "No areas will be affected by this change.";
    }

    return `The following areas will be affected by this change:\n${affectedAreas.join("\n")}`;
  }

  /**
   * Get details about validation
   * @param validationResult The validation result
   * @returns Validation details
   */
  private getValidationDetails(validationResult: any): string {
    if (!validationResult.valid) {
      return `The change is not valid: ${validationResult.error}`;
    }

    if (validationResult.warnings && validationResult.warnings.length > 0) {
      return `The change is valid, but there are warnings:\n${validationResult.warnings.join("\n")}`;
    }

    return "The change is valid and does not have any warnings.";
  }

  /**
   * Get details about the implementation strategy
   * @param componentType The type of component
   * @param componentInfo Information about the component
   * @param proposedChange The proposed change
   * @param impactInfo Information about impacted components
   * @returns Implementation strategy details
   */
  private getImplementationStrategyDetails(
    componentType: string,
    componentInfo: any,
    proposedChange: string,
    impactInfo: any
  ): string {
    let strategy = `To implement the change '${proposedChange}' in the ${componentType} '${componentInfo.name}', we will follow these steps:\n`;

    if (componentType === "module") {
      strategy += "1. Update the module's implementation\n";
      strategy += "2. Update any dependent modules that rely on the changed functionality\n";
      strategy += "3. Update any tests that verify the module's behavior\n";
    } else if (componentType === "entity") {
      strategy += "1. Update the database schema\n";
      strategy += "2. Update any modules that use the entity\n";
      strategy += "3. Update any tests that verify the entity's behavior\n";
    } else if (componentType === "function") {
      strategy += "1. Update the function's implementation\n";
      strategy += "2. Update any functions that call this function\n";
      strategy += "3. Update any tests that verify the function's behavior\n";
    }

    // Add impacted areas to the strategy
    if (impactInfo) {
      if (impactInfo.impactedModules && impactInfo.impactedModules.length > 0) {
        strategy += `\nModules to update:\n${impactInfo.impactedModules.map((m: string) => `- ${m}`).join("\n")}`;
      }

      if (impactInfo.impactedFunctions && impactInfo.impactedFunctions.length > 0) {
        strategy += `\nFunctions to update:\n${impactInfo.impactedFunctions.map((f: string) => `- ${f}`).join("\n")}`;
      }
    }

    return strategy;
  }

  /**
   * Get details about the testing strategy
   * @param componentType The type of component
   * @param componentInfo Information about the component
   * @param impactInfo Information about impacted components
   * @returns Testing strategy details
   */
  private getTestingStrategyDetails(
    componentType: string,
    componentInfo: any,
    impactInfo: any
  ): string {
    let strategy = `To test the changes to the ${componentType} '${componentInfo.name}', we will follow these steps:\n`;

    if (componentType === "module") {
      strategy += "1. Write unit tests for the modified functionality\n";
      strategy += "2. Write integration tests for the module's interactions with other modules\n";
      strategy += "3. Verify that all dependent modules still work correctly\n";
    } else if (componentType === "entity") {
      strategy += "1. Write tests to verify the database schema changes\n";
      strategy += "2. Write tests to verify that all modules that use the entity still work correctly\n";
      strategy += "3. Verify that all relationships with other entities still work correctly\n";
    } else if (componentType === "function") {
      strategy += "1. Write unit tests for the modified function\n";
      strategy += "2. Write tests to verify that all functions that call this function still work correctly\n";
      strategy += "3. Verify that the module's behavior is still correct\n";
    }

    // Add impacted areas to the strategy
    if (impactInfo) {
      if (impactInfo.impactedModules && impactInfo.impactedModules.length > 0) {
        strategy += `\nModules to test:\n${impactInfo.impactedModules.map((m: string) => `- ${m}`).join("\n")}`;
      }

      if (impactInfo.impactedFunctions && impactInfo.impactedFunctions.length > 0) {
        strategy += `\nFunctions to test:\n${impactInfo.impactedFunctions.map((f: string) => `- ${f}`).join("\n")}`;
      }
    }

    return strategy;
  }

  /**
   * Validate a proposed change against the system architecture
   * @param component The component being changed
   * @param change The proposed change
   * @returns Validation result
   */
  public validateChange(component: string, change: string): any {
    try {
      logger.debug(`Validating change: ${change} for component: ${component}`);
      console.log(`Validating change: ${change} for component: ${component}`);

      return vectorTool.validateChange(component, change);
    } catch (error) {
      logger.error(`Error validating change: ${error}`);
      console.log(`Error validating change: ${error}`);
      return {
        success: false,
        error: `Failed to validate change: ${error}`
      };
    }
  }

  /**
   * Orchestrate an iterative workflow to plan and validate changes
   * @param codePath The code path or feature to analyze
   * @param proposedChange The proposed change to make
   * @returns Orchestration result
   */
  public orchestrateWorkflow(codePath: string, proposedChange: string): any {
    try {
      logger.debug(`Orchestrating workflow for code path: ${codePath}`);
      console.log(`Orchestrating workflow for code path: ${codePath}`);

      // Step 1: Analyze the code path
      const analysisResult = this.analyzeCodePath(codePath, proposedChange);
      if (!analysisResult.success) {
        return analysisResult;
      }

      // Step 2: Validate the proposed change
      const validationResult = this.validateChange(codePath, proposedChange);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Invalid change: ${validationResult.error}`,
          analysisResult,
          validationResult
        };
      }

      // Step 3: Generate a modification plan
      const modificationPlan = analysisResult.modificationPlan;

      // Step 4: Check for warnings
      const warnings = validationResult.warnings || [];
      const hasWarnings = warnings.length > 0;

      return {
        success: true,
        analysisResult,
        validationResult,
        modificationPlan,
        hasWarnings,
        warnings,
        message: hasWarnings
          ? "The workflow completed successfully, but there are warnings to consider."
          : "The workflow completed successfully with no warnings."
      };
    } catch (error) {
      logger.error(`Error orchestrating workflow: ${error}`);
      console.log(`Error orchestrating workflow: ${error}`);
      return {
        success: false,
        error: `Failed to orchestrate workflow: ${error}`
      };
    }
  }
}

// Export a singleton instance
export const analyzeTool = new AnalyzeTool();
