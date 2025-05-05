/**
 * Test script for AI tools
 * 
 * This script tests the AI tools by:
 * 1. Getting information about a module
 * 2. Getting information about an entity
 * 3. Analyzing a code path
 * 4. Validating a proposed change
 * 5. Orchestrating a workflow
 */

const path = require('path');
const fs = require('fs');
const { vectorTool, analyzeTool, default: orchestrateWorkflow } = require('../tools');

// Ensure the VECTOR.md file exists
const vectorFilePath = path.resolve(process.cwd(), 'VECTOR.md');
if (!fs.existsSync(vectorFilePath)) {
  console.error('VECTOR.md file not found. Please create it first.');
  process.exit(1);
}

// Test vectorTool
console.log('\n=== Testing vectorTool ===');
console.log('\nGetting information about Tenant Service:');
const tenantServiceInfo = vectorTool.getModuleInfo('Tenant Service');
console.log(JSON.stringify(tenantServiceInfo, null, 2));

console.log('\nGetting information about Tenants entity:');
const tenantsEntityInfo = vectorTool.getEntityInfo('Tenants');
console.log(JSON.stringify(tenantsEntityInfo, null, 2));

console.log('\nGetting information about generateRentDueToday function:');
const functionInfo = vectorTool.getFunctionInfo('generateRentDueToday');
console.log(JSON.stringify(functionInfo, null, 2));

// Test analyzeTool
console.log('\n=== Testing analyzeTool ===');
console.log('\nAnalyzing Rent Service:');
const analysisResult = analyzeTool.analyzeCodePath('Rent Service', 'Add support for partial payments');
console.log(JSON.stringify(analysisResult.modificationPlan, null, 2));

// Test validation
console.log('\n=== Testing validation ===');
console.log('\nValidating change to Rent Service:');
const validationResult = vectorTool.validateChange('Rent Service', 'Add support for partial payments');
console.log(JSON.stringify(validationResult, null, 2));

// Test orchestration
console.log('\n=== Testing orchestration ===');
console.log('\nOrchestrating workflow for Rent Service:');
orchestrateWorkflow('Rent Service', 'Add support for partial payments')
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
    console.log('\nAll tests completed successfully!');
  })
  .catch(error => {
    console.error('Error in orchestration:', error);
  });
