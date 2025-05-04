// Script to apply schema updates and verify the connection is working properly
const { exec } = require('child_process');
const path = require('path');

console.log('🔄 Starting RentWhisperer Database Schema Update and Connection Test\n');

// Define paths to scripts
const schemaScriptPath = path.resolve(__dirname, 'apply-schema-js.js'); // Use JS-only schema update script (no psql)
const connectionTestPath = path.resolve(__dirname, 'enhanced-connection-test.js');

// Function to execute scripts sequentially
async function runScript(scriptPath, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 ${description}...\n`);

    const process = exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`\n❌ Error executing ${description}:`);
        console.error(stderr || stdout);
        reject(error);
        return;
      }

      console.log(stdout);
      console.log(`\n✅ ${description} completed successfully.`);
      resolve();
    });

    // Forward output in real-time
    process.stdout.on('data', (data) => {
      console.log(data.toString().trim());
    });

    process.stderr.on('data', (data) => {
      console.error(data.toString().trim());
    });
  });
}

// Main function to run everything
async function main() {
  try {
    // Step 1: Apply the database schema updates
    await runScript(schemaScriptPath, 'Applying database schema updates');

    // Step 2: Verify the connection is working
    await runScript(connectionTestPath, 'Testing Supabase connection');

    console.log('\n🎉 All done! The database schema has been updated and the connection is working properly.');
    console.log('   The "TypeError: fetch failed" error should now be resolved.');
  } catch (error) {
    console.error('\n❌ An error occurred during the process.');
    console.error('   Please check the error messages above for more details.');
    process.exit(1);
  }
}

// Run the main function
main();
