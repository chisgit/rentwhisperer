import { vectorTool } from "./vectorTool";
import { analyzeTool } from "./analyzeTool";
import { logger } from "../utils/logger";

/**
 * AI Tools for RentWhisperer
 * 
 * This module exports the AI tools for the RentWhisperer application:
 * 1. vectorTool: Indexes and queries the vector file to reveal context and impacted functions
 * 2. analyzeTool: Plans modifications and calls vectorTool to list all affected areas
 * 
 * It also provides an orchestration workflow that combines both tools to:
 * 1. Analyze a code path or feature
 * 2. Plan modifications
 * 3. Validate changes against the system architecture
 * 4. Iterate until all dependencies are satisfied
 */

/**
 * Orchestrate an iterative workflow to plan and validate changes
 * @param codePath The code path or feature to analyze
 * @param proposedChange The proposed change to make
 * @returns Orchestration result
 */
export async function orchestrateWorkflow(codePath: string, proposedChange: string): Promise<any> {
  try {
    logger.debug(`Starting orchestration workflow for code path: ${codePath}`);
    console.log(`Starting orchestration workflow for code path: ${codePath}`);

    // Step 1: Initial analysis
    const initialAnalysis = analyzeTool.analyzeCodePath(codePath, proposedChange);
    if (!initialAnalysis.success) {
      return initialAnalysis;
    }

    // Step 2: Initial validation
    const initialValidation = vectorTool.validateChange(codePath, proposedChange);
    if (!initialValidation.valid) {
      return {
        success: false,
        error: `Invalid change: ${initialValidation.error}`,
        initialAnalysis,
        initialValidation
      };
    }

    // Step 3: Iterative refinement
    let currentAnalysis = initialAnalysis;
    let currentValidation = initialValidation;
    let iterations = 0;
    const maxIterations = 5;
    let hasWarnings = currentValidation.warnings && currentValidation.warnings.length > 0;

    // Continue iterating until there are no warnings or we reach the maximum number of iterations
    while (hasWarnings && iterations < maxIterations) {
      iterations++;
      logger.debug(`Iteration ${iterations}: Refining analysis and validation`);
      console.log(`Iteration ${iterations}: Refining analysis and validation`);

      // Refine the proposed change based on warnings
      const refinedChange = refineProposedChange(proposedChange, currentValidation.warnings);

      // Re-analyze with the refined change
      currentAnalysis = analyzeTool.analyzeCodePath(codePath, refinedChange);
      if (!currentAnalysis.success) {
        break;
      }

      // Re-validate with the refined change
      currentValidation = vectorTool.validateChange(codePath, refinedChange);
      if (!currentValidation.valid) {
        break;
      }

      // Check if there are still warnings
      hasWarnings = currentValidation.warnings && currentValidation.warnings.length > 0;

      // Update the proposed change for the next iteration
      proposedChange = refinedChange;
    }

    // Step 4: Final orchestration result
    return {
      success: true,
      initialAnalysis,
      initialValidation,
      finalAnalysis: currentAnalysis,
      finalValidation: currentValidation,
      iterations,
      hasWarnings,
      warnings: currentValidation.warnings || [],
      proposedChange,
      message: hasWarnings
        ? `The workflow completed with ${iterations} iterations, but there are still warnings to consider.`
        : `The workflow completed successfully after ${iterations} iterations with no warnings.`
    };
  } catch (error) {
    logger.error(`Error in orchestration workflow: ${error}`);
    console.log(`Error in orchestration workflow: ${error}`);
    return {
      success: false,
      error: `Failed to orchestrate workflow: ${error}`
    };
  }
}

/**
 * Refine a proposed change based on warnings
 * @param proposedChange The proposed change to refine
 * @param warnings The warnings to address
 * @returns Refined proposed change
 */
function refineProposedChange(proposedChange: string, warnings: string[]): string {
  // In a real implementation, this would use more sophisticated logic to refine the proposed change
  // For now, we'll just append a note about the warnings
  const warningNotes = warnings.map(w => `- Addressed: ${w}`).join("\n");
  return `${proposedChange}\n\nRefinements based on warnings:\n${warningNotes}`;
}

// Export the tools
export { vectorTool, analyzeTool };

// Export the orchestration workflow as the default export
export default orchestrateWorkflow;
