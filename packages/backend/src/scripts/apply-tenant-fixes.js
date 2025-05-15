/**
 * This script applies the fixes to existing tenant-unit relationships
 * It reads rent_amount and rent_due_day from tenant records and applies them
 * to the tenant_units junction table
 */

const { supabase } = require('../config/database');
const { fixTenantUnitRelationship } = require('../utils/tenant-unit-fixer');

async function syncAllTenantUnits() {
  console.log('Starting tenant-unit synchronization...');

  try {
    // Get all tenants with their primary unit information
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select(`
        id, 
        first_name, 
        last_name, 
        unit_id
      `);

    if (error) {
      console.error('Error fetching tenants:', error);
      return { success: false, error };
    }

    console.log(`Found ${tenants?.length || 0} tenants to process`);

    // Process each tenant
    const results = [];

    for (const tenant of (tenants || [])) {
      if (!tenant.unit_id) {
        console.log(`Tenant ${tenant.first_name} ${tenant.last_name} has no unit assigned, skipping`);
        continue;
      }

      console.log(`\nProcessing tenant ${tenant.first_name} ${tenant.last_name} (ID: ${tenant.id})`);
      console.log(`Unit ID: ${tenant.unit_id}`);

      // Get existing tenant-units record if any
      const { data: existingTU, error: tuError } = await supabase
        .from('tenant_units')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('unit_id', tenant.unit_id)
        .maybeSingle();

      if (tuError && tuError.code !== 'PGRST116') {
        console.error(`Error checking tenant-unit for ${tenant.id}:`, tuError);
        results.push({
          tenant_id: tenant.id,
          success: false,
          error: tuError.message
        });
        continue;
      }

      // Default values
      let rentAmount = 0;
      let rentDueDay = 1;

      if (existingTU) {
        console.log(`Found existing tenant-unit relationship:`);
        console.log(`- Rent Amount: ${existingTU.rent_amount || 0}`);
        console.log(`- Rent Due Day: ${existingTU.rent_due_day || 1}`);

        // Use existing values if available
        rentAmount = existingTU.rent_amount || 0;
        rentDueDay = existingTU.rent_due_day || 1;
      } else {
        console.log(`No existing tenant-unit relationship found, will create with defaults`);
      }
      // Fix the tenant-unit relationship
      const result = await fixTenantUnitRelationship(tenant.id, tenant.unit_id, rentAmount, rentDueDay);

      results.push({
        tenant_id: tenant.id,
        tenant_name: `${tenant.first_name} ${tenant.last_name}`,
        unit_id: tenant.unit_id,
        success: result.success,
        rent_amount: rentAmount,
        rent_due_day: rentDueDay,
        error: result.error ? result.error.message : null
      });
    }

    // Log summary
    console.log('\n=== Synchronization Summary ===');
    console.log(`Total tenants processed: ${results.length}`);
    console.log(`Successful updates: ${results.filter(r => r.success).length}`);
    console.log(`Failed updates: ${results.filter(r => !r.success).length}`);

    return { success: true, results };
  } catch (err) {
    console.error('Error synchronizing tenant-units:', err);
    return { success: false, error: err };
  }
}

// Call the function directly when running this script
if (require.main === module) {
  syncAllTenantUnits()
    .then(() => {
      console.log('\nSynchronization process completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error during synchronization:', err);
      process.exit(1);
    });
}

module.exports = { syncAllTenantUnits };
