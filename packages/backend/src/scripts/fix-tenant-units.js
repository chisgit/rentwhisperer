/**
 * This script fixes tenant-unit relationships by ensuring rent_amount and rent_due_day 
 * values are correctly synchronized between the tenant object and the tenant_units table.
 * 
 * Usage: 
 * 1. Run with node src/scripts/fix-tenant-units.js
 * 2. Or import and use the fixTenantUnit function directly in your code
 */

const { supabase } = require('../config/database');

/**
 * Fixes the tenant-unit relationship for a specific tenant and unit
 */
async function fixTenantUnit(tenantId, unitId, rentAmount, rentDueDay) {
  console.log(`\nFixing tenant-unit relationship:`);
  console.log(`- Tenant ID: ${tenantId}`);
  console.log(`- Unit ID: ${unitId}`);
  console.log(`- Rent Amount: ${rentAmount}`);
  console.log(`- Rent Due Day: ${rentDueDay}`);

  try {
    // Normalize values
    const finalRentAmount = typeof rentAmount === 'number' ?
      rentAmount : (rentAmount ? Number(rentAmount) : 0);

    const finalRentDueDay = typeof rentDueDay === 'number' ?
      rentDueDay : (rentDueDay ? Number(rentDueDay) : 1);

    // Check if relationship exists
    const { data: existingRel, error: queryError } = await supabase
      .from('tenant_units')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('unit_id', unitId)
      .single();

    if (queryError && queryError.code !== 'PGRST116') { // Not found is OK
      console.error('Error checking existing relationship:', queryError);
      return { success: false, error: queryError };
    }

    if (existingRel) {
      console.log('Found existing relationship, updating...');

      // Update existing relationship
      const { data, error } = await supabase
        .from('tenant_units')
        .update({
          rent_amount: finalRentAmount,
          rent_due_day: finalRentDueDay,
          is_primary: true,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('unit_id', unitId);

      if (error) {
        console.error('Error updating relation:', error);
        return { success: false, error };
      }

      console.log('Successfully updated tenant-unit relationship');
      return { success: true, data };
    } else {
      console.log('Relationship does not exist, creating new one...');

      // Create new relationship
      const { data, error } = await supabase
        .from('tenant_units')
        .insert([{
          tenant_id: tenantId,
          unit_id: unitId,
          is_primary: true,
          rent_amount: finalRentAmount,
          rent_due_day: finalRentDueDay,
          lease_start_date: new Date().toISOString().split('T')[0]
        }]);

      if (error) {
        console.error('Error creating relation:', error);
        return { success: false, error };
      }

      console.log('Successfully created tenant-unit relationship');
      return { success: true, data };
    }
  } catch (err) {
    console.error('Exception fixing tenant-unit relationship:', err);
    return { success: false, error: err };
  }
}

/**
 * Finds all tenants with a specific unit ID and fixes their relationships
 */
async function fixAllTenantsForUnit(unitId, rentAmount, rentDueDay) {
  try {
    console.log(`\nFixing all tenant relationships for unit ${unitId}...`);

    // Get all tenants associated with this unit
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id, first_name, last_name')
      .eq('unit_id', unitId);

    if (error) {
      console.error('Error fetching tenants:', error);
      return { success: false, error };
    }

    console.log(`Found ${tenants?.length || 0} tenants for unit ${unitId}`);

    // Fix each tenant-unit relationship
    const results = [];
    for (const tenant of (tenants || [])) {
      console.log(`Fixing tenant ${tenant.first_name} ${tenant.last_name} (${tenant.id})`);
      const result = await fixTenantUnit(tenant.id, unitId, rentAmount, rentDueDay);
      results.push({
        tenant_id: tenant.id,
        tenant_name: `${tenant.first_name} ${tenant.last_name}`,
        result
      });
    }

    return { success: true, results };
  } catch (err) {
    console.error('Exception fixing tenants for unit:', err);
    return { success: false, error: err };
  }
}

/**
 * Run this script directly to display a list of tenant/unit data
 */
async function main() {
  console.log('Rent Whisperer - Tenant-Unit Relationship Fixer');
  console.log('==============================================\n');

  try {
    // Get all tenant units to display data
    const { data: tenantUnits, error: tuError } = await supabase
      .from('tenant_units')
      .select(`
        id, 
        rent_amount, 
        rent_due_day,
        is_primary,
        tenants:tenant_id (id, first_name, last_name),
        units:unit_id (id, unit_number)
      `)
      .order('created_at', { ascending: false });

    if (tuError) {
      console.error('Error fetching tenant-units:', tuError);
      return;
    }

    console.log(`Found ${tenantUnits?.length || 0} tenant-unit relationships:`);

    for (const tu of (tenantUnits || [])) {
      console.log(`- ${tu.tenants?.first_name} ${tu.tenants?.last_name} in unit ${tu.units?.unit_number}`);
      console.log(`  Rent: $${tu.rent_amount} due on day ${tu.rent_due_day} of month`);
      console.log(`  Is primary: ${tu.is_primary ? 'Yes' : 'No'}`);
      console.log(`  Tenant ID: ${tu.tenants?.id}`);
      console.log(`  Unit ID: ${tu.units?.id}`);
      console.log(`  Relationship ID: ${tu.id}\n`);
    }

    console.log('\nTo fix a tenant-unit relationship, call this script programmatically with:');
    console.log('  const { fixTenantUnit } = require("./fix-tenant-units");');
    console.log('  await fixTenantUnit(tenantId, unitId, rentAmount, rentDueDay);\n');

  } catch (err) {
    console.error('Error running tenant-unit fixer:', err);
  } finally {
    process.exit(0);
  }
}

// If this script is run directly, execute the main function
if (require.main === module) {
  main();
}

module.exports = {
  fixTenantUnit,
  fixAllTenantsForUnit
};
