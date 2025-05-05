const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("Starting RentWhisperer test suite...");

// Create array of test files
const TEST_FILES = [
  "src/pages/__tests__/Payments.test.tsx",
  "src/hooks/__tests__/usePayments.test.ts",
  "src/components/payments/__tests__/PaymentFilters.test.tsx",
  "src/components/payments/__tests__/PaymentsTable.test.tsx",
  "src/utils/__tests__/formatters.test.ts",
  "src/types/__tests__/payment.types.test.ts"
];

// Track test results
let passed = 0;
let failed = 0;
const failedTests = [];

// Run each test file individually
TEST_FILES.forEach(testFile => {
  console.log(`\nRunning test: ${testFile}`);

  if (fs.existsSync(path.resolve(testFile))) {
    try {
      execSync(`npx jest ${testFile} --verbose`, { stdio: 'inherit' });
      console.log(`Test passed: ${testFile}`);
      passed++;
    } catch (error) {
      console.log(`Test failed: ${testFile}`);
      failedTests.push(testFile);
      failed++;
    }
  } else {
    console.log(`Test file not found: ${testFile}`);
    failedTests.push(`${testFile} (not found)`);
    failed++;
  }
});

// Display summary
console.log(`\n========== Test Summary ==========`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failedTests.length > 0) {
  console.log(`\nFailed tests:`);
  failedTests.forEach(test => {
    console.log(`  - ${test}`);
  });
}

// Exit with appropriate code
if (failed > 0) {
  console.log(`Some tests failed. Please fix the issues and try again.`);
  process.exit(1);
} else {
  console.log(`All tests passed successfully!`);
  process.exit(0);
}
