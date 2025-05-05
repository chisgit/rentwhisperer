import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

/**
 * VectorTool - A tool for indexing and querying the vector file to reveal context and impacted functions
 * 
 * This tool parses the VECTOR.md file and provides methods to:
 * 1. Get information about modules and their roles
 * 2. Find dependencies between modules
 * 3. Identify impacted functions when changes are proposed
 * 4. Provide context about the system architecture
 */
export class VectorTool {
  private vectorContent: string = "";
  private sections: Map<string, string> = new Map();
  private moduleRoles: Map<string, string> = new Map();
  private dependencies: Map<string, string[]> = new Map();
  private schemaRelationships: Map<string, string[]> = new Map();
  private dataFlows: Map<string, string[]> = new Map();
  private functionModuleMap: Map<string, string> = new Map();

  constructor() {
    this.loadVectorFile();
    this.parseVectorContent();
  }
  /**
   * Load the VECTOR.md file
   */
  private loadVectorFile(): void {
    try {
      // First try to load from current directory
      let vectorFilePath = path.resolve(process.cwd(), "VECTOR.md");

      // If file doesn't exist in current directory, try to load from project root
      if (!fs.existsSync(vectorFilePath)) {
        // Navigate up from packages/backend to project root
        const projectRootPath = path.resolve(process.cwd(), "../../");
        vectorFilePath = path.resolve(projectRootPath, "VECTOR.md");
        console.log(`VECTOR.md not found in current directory, trying project root: ${vectorFilePath}`);
      }

      if (!fs.existsSync(vectorFilePath)) {
        throw new Error(`VECTOR.md file not found at ${vectorFilePath}`);
      }

      this.vectorContent = fs.readFileSync(vectorFilePath, "utf8");
      logger.debug(`Vector file loaded successfully from ${vectorFilePath}`);
      console.log(`Vector file loaded successfully from ${vectorFilePath}`);
    } catch (error) {
      logger.error("Error loading vector file:", error);
      console.log("Error loading vector file:", error);
      throw new Error("Failed to load vector file");
    }
  }

  /**
   * Parse the vector content into structured data
   */
  private parseVectorContent(): void {
    try {
      // Split content into sections based on markdown headers
      const sectionRegex = /## ([^\n]+)\n([\s\S]*?)(?=## |$)/g;
      let match;

      while ((match = sectionRegex.exec(this.vectorContent)) !== null) {
        const sectionName = match[1].trim();
        const sectionContent = match[2].trim();
        this.sections.set(sectionName, sectionContent);
      }

      // Parse module roles
      this.parseModuleRoles();

      // Parse dependencies
      this.parseDependencies();

      // Parse schema relationships
      this.parseSchemaRelationships();

      // Parse data flows
      this.parseDataFlows();

      // Map functions to modules
      this.mapFunctionsToModules();

      logger.debug("Vector content parsed successfully");
      console.log("Vector content parsed successfully");
    } catch (error) {
      logger.error("Error parsing vector content:", error);
      console.log("Error parsing vector content:", error);
      throw new Error("Failed to parse vector content");
    }
  }

  /**
   * Parse module roles from the vector content
   */
  private parseModuleRoles(): void {
    const backendServices = this.sections.get("Backend Services") || "";
    const frontendComponents = this.sections.get("Frontend Components") || "";
    const cronJobs = this.sections.get("Cron Jobs and Automation") || "";

    // Parse backend services
    const serviceRegex = /### ([^\n]+)\n- \*\*Purpose\*\*: ([^\n]+)/g;
    let match;

    while ((match = serviceRegex.exec(backendServices)) !== null) {
      const serviceName = match[1].trim();
      const purpose = match[2].trim();
      this.moduleRoles.set(serviceName, purpose);
    }

    // Parse frontend components
    const componentRegex = /### ([^\n]+)\n- \*\*Purpose\*\*: ([^\n]+)/g;

    while ((match = componentRegex.exec(frontendComponents)) !== null) {
      const componentName = match[1].trim();
      const purpose = match[2].trim();
      this.moduleRoles.set(componentName, purpose);
    }

    // Parse cron jobs
    const cronRegex = /### ([^\n]+)\n- \*\*Purpose\*\*: ([^\n]+)/g;

    while ((match = cronRegex.exec(cronJobs)) !== null) {
      const cronName = match[1].trim();
      const purpose = match[2].trim();
      this.moduleRoles.set(cronName, purpose);
    }
  }

  /**
   * Parse dependencies from the vector content
   */
  private parseDependencies(): void {
    const backendServices = this.sections.get("Backend Services") || "";
    const frontendComponents = this.sections.get("Frontend Components") || "";
    const cronJobs = this.sections.get("Cron Jobs and Automation") || "";

    // Parse backend service dependencies
    const dependencyRegex = /### ([^\n]+)[\s\S]*?- \*\*Dependencies\*\*:([\s\S]*?)(?=- \*\*Called By|$)/g;
    let match;

    while ((match = dependencyRegex.exec(backendServices)) !== null) {
      const serviceName = match[1].trim();
      const dependenciesText = match[2].trim();
      const dependencies = dependenciesText
        .split("\n")
        .map(dep => dep.replace(/^  - /, "").trim())
        .filter(dep => dep !== "");

      this.dependencies.set(serviceName, dependencies);
    }

    // Parse frontend component dependencies
    while ((match = dependencyRegex.exec(frontendComponents)) !== null) {
      const componentName = match[1].trim();
      const dependenciesText = match[2].trim();
      const dependencies = dependenciesText
        .split("\n")
        .map(dep => dep.replace(/^  - /, "").trim())
        .filter(dep => dep !== "");

      this.dependencies.set(componentName, dependencies);
    }

    // Parse cron job dependencies
    while ((match = dependencyRegex.exec(cronJobs)) !== null) {
      const cronName = match[1].trim();
      const dependenciesText = match[2].trim();
      const dependencies = dependenciesText
        .split("\n")
        .map(dep => dep.replace(/^  - /, "").trim())
        .filter(dep => dep !== "");

      this.dependencies.set(cronName, dependencies);
    }
  }

  /**
   * Parse schema relationships from the vector content
   */
  private parseSchemaRelationships(): void {
    const databaseSchema = this.sections.get("Database Schema") || "";

    // Parse entity relationships
    const entityRegex = /#### ([^\n]+)[\s\S]*?- \*\*Relationships\*\*:([\s\S]*?)(?=- \*\*|$)/g;
    let match;

    while ((match = entityRegex.exec(databaseSchema)) !== null) {
      const entityName = match[1].trim();
      const relationshipsText = match[2].trim();
      const relationships = relationshipsText
        .split("\n")
        .map(rel => rel.replace(/^  - /, "").trim())
        .filter(rel => rel !== "");

      this.schemaRelationships.set(entityName, relationships);
    }
  }

  /**
   * Parse data flows from the vector content
   */
  private parseDataFlows(): void {
    const dataFlows = this.sections.get("Data Flow Paths") || "";

    // Parse data flow paths
    const flowRegex = /### ([^\n]+)([\s\S]*?)(?=### |$)/g;
    let match;

    while ((match = flowRegex.exec(dataFlows)) !== null) {
      const flowName = match[1].trim();
      const flowSteps = match[2].trim();
      const steps = flowSteps
        .split("\n")
        .map(step => step.replace(/^\d+\. /, "").trim())
        .filter(step => step !== "");

      this.dataFlows.set(flowName, steps);
    }
  }

  /**
   * Map functions to their respective modules
   */
  private mapFunctionsToModules(): void {
    const backendServices = this.sections.get("Backend Services") || "";

    // Parse functions from backend services
    const functionRegex = /### ([^\n]+)[\s\S]*?- \*\*Key Functions\*\*:([\s\S]*?)(?=- \*\*Dependencies|$)/g;
    let match;

    while ((match = functionRegex.exec(backendServices)) !== null) {
      const serviceName = match[1].trim();
      const functionsText = match[2].trim();
      const functions = functionsText
        .split("\n")
        .map(func => {
          const funcMatch = func.match(/^  - `([^`]+)`/);
          return funcMatch ? funcMatch[1].trim() : null;
        })
        .filter(func => func !== null) as string[];

      for (const func of functions) {
        this.functionModuleMap.set(func, serviceName);
      }
    }
  }

  /**
   * Get information about a module
   * @param moduleName The name of the module
   * @returns Information about the module
   */
  public getModuleInfo(moduleName: string): any {
    const role = this.moduleRoles.get(moduleName) || "Unknown module";
    const dependencies = this.dependencies.get(moduleName) || [];

    // Find modules that depend on this module
    const dependents: string[] = [];
    for (const [module, deps] of this.dependencies.entries()) {
      if (deps.some(dep => dep.includes(moduleName))) {
        dependents.push(module);
      }
    }

    return {
      name: moduleName,
      role,
      dependencies,
      dependents
    };
  }

  /**
   * Get information about a database entity
   * @param entityName The name of the entity
   * @returns Information about the entity
   */
  public getEntityInfo(entityName: string): any {
    const databaseSchema = this.sections.get("Database Schema") || "";
    const entityRegex = new RegExp(`#### ${entityName}[\\s\\S]*?(?=#### |$)`, "g");
    const match = entityRegex.exec(databaseSchema);

    if (!match) {
      return {
        name: entityName,
        info: "Entity not found in vector file"
      };
    }

    const entityInfo = match[0].trim();
    const relationships = this.schemaRelationships.get(entityName) || [];

    // Find entities that have relationships with this entity
    const relatedEntities: string[] = [];
    for (const [entity, rels] of this.schemaRelationships.entries()) {
      if (entity !== entityName && rels.some(rel => rel.includes(entityName))) {
        relatedEntities.push(entity);
      }
    }

    return {
      name: entityName,
      info: entityInfo,
      relationships,
      relatedEntities
    };
  }

  /**
   * Get information about a function
   * @param functionName The name of the function
   * @returns Information about the function
   */
  public getFunctionInfo(functionName: string): any {
    const moduleName = this.functionModuleMap.get(functionName);

    if (!moduleName) {
      return {
        name: functionName,
        info: "Function not found in vector file"
      };
    }

    const backendServices = this.sections.get("Backend Services") || "";
    const functionRegex = new RegExp(`### ${moduleName}[\\s\\S]*?- \\*\\*Key Functions\\*\\*:[\\s\\S]*?\`${functionName}\`([^\\n]*)(\\n[^\\n]*?)?`, "g");
    const match = functionRegex.exec(backendServices);

    if (!match) {
      return {
        name: functionName,
        module: moduleName,
        info: "Function details not found"
      };
    }

    const functionInfo = match[1].trim();

    return {
      name: functionName,
      module: moduleName,
      info: functionInfo,
      moduleInfo: this.getModuleInfo(moduleName)
    };
  }

  /**
   * Get information about a data flow
   * @param flowName The name of the data flow
   * @returns Information about the data flow
   */
  public getDataFlowInfo(flowName: string): any {
    const dataFlows = this.sections.get("Data Flow Paths") || "";
    const flowRegex = new RegExp(`### ${flowName}[\\s\\S]*?(?=### |$)`, "g");
    const match = flowRegex.exec(dataFlows);

    if (!match) {
      return {
        name: flowName,
        info: "Data flow not found in vector file"
      };
    }

    const flowInfo = match[0].trim();
    const steps = this.dataFlows.get(flowName) || [];

    return {
      name: flowName,
      info: flowInfo,
      steps
    };
  }

  /**
   * Find all modules, entities, and functions that would be impacted by changes to a specific module
   * @param moduleName The name of the module
   * @returns List of impacted components
   */
  public findImpactedComponents(moduleName: string): any {
    const impactedModules: string[] = [];
    const impactedEntities: string[] = [];
    const impactedFunctions: string[] = [];

    // Find modules that depend on this module
    for (const [module, deps] of this.dependencies.entries()) {
      if (deps.some(dep => dep.includes(moduleName))) {
        impactedModules.push(module);
      }
    }

    // Find entities that are used by this module
    const moduleInfo = this.getModuleInfo(moduleName);
    if (moduleInfo && moduleInfo.dependencies) {
      for (const dep of moduleInfo.dependencies) {
        if (dep.includes("Database schema:")) {
          const entities = dep.replace("Database schema:", "").split(",").map((e: string) => e.trim().replace(/`/g, ""));
          impactedEntities.push(...entities);
        }
      }
    }

    // Find functions that belong to this module
    for (const [func, module] of this.functionModuleMap.entries()) {
      if (module === moduleName) {
        impactedFunctions.push(func);
      }
    }

    // Find functions that belong to impacted modules
    for (const impactedModule of impactedModules) {
      for (const [func, module] of this.functionModuleMap.entries()) {
        if (module === impactedModule) {
          impactedFunctions.push(func);
        }
      }
    }

    return {
      module: moduleName,
      impactedModules,
      impactedEntities,
      impactedFunctions
    };
  }

  /**
   * Find all components that would be impacted by changes to a specific entity
   * @param entityName The name of the entity
   * @returns List of impacted components
   */
  public findImpactedComponentsByEntity(entityName: string): any {
    const impactedModules: string[] = [];
    const impactedEntities: string[] = [];
    const impactedFunctions: string[] = [];

    // Find modules that use this entity
    for (const [module, deps] of this.dependencies.entries()) {
      if (deps.some(dep => dep.includes(entityName))) {
        impactedModules.push(module);
      }
    }

    // Find entities that have relationships with this entity
    for (const [entity, rels] of this.schemaRelationships.entries()) {
      if (entity !== entityName && rels.some(rel => rel.includes(entityName))) {
        impactedEntities.push(entity);
      }
    }

    // Find functions that belong to impacted modules
    for (const impactedModule of impactedModules) {
      for (const [func, module] of this.functionModuleMap.entries()) {
        if (module === impactedModule) {
          impactedFunctions.push(func);
        }
      }
    }

    return {
      entity: entityName,
      impactedModules,
      impactedEntities,
      impactedFunctions
    };
  }

  /**
   * Find all components that would be impacted by changes to a specific function
   * @param functionName The name of the function
   * @returns List of impacted components
   */
  public findImpactedComponentsByFunction(functionName: string): any {
    const moduleName = this.functionModuleMap.get(functionName);

    if (!moduleName) {
      return {
        function: functionName,
        info: "Function not found in vector file"
      };
    }

    const impactedModules: string[] = [];
    const impactedFunctions: string[] = [];

    // Find modules that depend on the module containing this function
    for (const [module, deps] of this.dependencies.entries()) {
      if (deps.some(dep => dep.includes(moduleName))) {
        impactedModules.push(module);
      }
    }

    // Find data flows that include this function
    const impactedFlows: string[] = [];
    for (const [flow, steps] of this.dataFlows.entries()) {
      if (steps.some(step => step.includes(functionName))) {
        impactedFlows.push(flow);
      }
    }

    // Find functions that might be affected
    for (const impactedModule of impactedModules) {
      for (const [func, module] of this.functionModuleMap.entries()) {
        if (module === impactedModule) {
          impactedFunctions.push(func);
        }
      }
    }

    return {
      function: functionName,
      module: moduleName,
      impactedModules,
      impactedFunctions,
      impactedFlows
    };
  }

  /**
   * Validate a proposed change against the system architecture
   * @param component The component being changed
   * @param change The proposed change
   * @returns Validation result
   */
  public validateChange(component: string, change: string): any {
    // Check if component is a module
    if (this.moduleRoles.has(component)) {
      const impactInfo = this.findImpactedComponents(component);
      return {
        component,
        type: "module",
        change,
        valid: true, // Assuming the change is valid by default
        impactInfo,
        warnings: this.generateWarnings(impactInfo)
      };
    }

    // Check if component is an entity
    if (this.schemaRelationships.has(component)) {
      const impactInfo = this.findImpactedComponentsByEntity(component);
      return {
        component,
        type: "entity",
        change,
        valid: true, // Assuming the change is valid by default
        impactInfo,
        warnings: this.generateWarnings(impactInfo)
      };
    }

    // Check if component is a function
    if (this.functionModuleMap.has(component)) {
      const impactInfo = this.findImpactedComponentsByFunction(component);
      return {
        component,
        type: "function",
        change,
        valid: true, // Assuming the change is valid by default
        impactInfo,
        warnings: this.generateWarnings(impactInfo)
      };
    }

    return {
      component,
      change,
      valid: false,
      error: "Component not found in vector file"
    };
  }

  /**
   * Generate warnings based on impact information
   * @param impactInfo Impact information
   * @returns List of warnings
   */
  private generateWarnings(impactInfo: any): string[] {
    const warnings: string[] = [];

    if (impactInfo.impactedModules && impactInfo.impactedModules.length > 0) {
      warnings.push(`This change will impact ${impactInfo.impactedModules.length} modules: ${impactInfo.impactedModules.join(", ")}`);
    }

    if (impactInfo.impactedEntities && impactInfo.impactedEntities.length > 0) {
      warnings.push(`This change will impact ${impactInfo.impactedEntities.length} database entities: ${impactInfo.impactedEntities.join(", ")}`);
    }

    if (impactInfo.impactedFunctions && impactInfo.impactedFunctions.length > 0) {
      warnings.push(`This change will impact ${impactInfo.impactedFunctions.length} functions: ${impactInfo.impactedFunctions.join(", ")}`);
    }

    if (impactInfo.impactedFlows && impactInfo.impactedFlows.length > 0) {
      warnings.push(`This change will impact ${impactInfo.impactedFlows.length} data flows: ${impactInfo.impactedFlows.join(", ")}`);
    }

    return warnings;
  }
}

// Export a singleton instance
export const vectorTool = new VectorTool();
