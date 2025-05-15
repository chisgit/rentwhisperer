// This script helps diagnose and fix tenant-unit relationship issues
const { supabase } = require('../config/database');

/**
 * This function ensures that rent_amount and rent_due_day are properly stored in the tenant_units table
 * for the given tenant and unit. It directly uses raw SQL to ensure data consistency.
 */
async function fixTenantUnitRelationship(tenantId, unitId, rentAmount, rentDueDay) {
  console.log(`Fixing tenant-unit relationship for tenant ${tenantId} and unit ${unitId}`);
  console.log(`Setting rent_amount=${rentAmount}, rent_due_day=${rentDueDay}`);

  try {
    // 1. First check if the tenant-unit relationship exists
    const { data: existingRelation, error } = await supabase
      .from('tenant_units')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('unit_id', unitId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking tenant-unit relationship:', error);
      return { success: false, message: `Database error: ${error.message}` };
    }

    // 2. If the relationship exists, update it
    if (existingRelation) {
      console.log('Existing relationship found, updating...');
      const { data, error: updateError } = await supabase
        .from('tenant_units')
        .update({
          rent_amount: rentAmount,
          rent_due_day: rentDueDay,
          is_primary: true, // Ensure this is the primary relationship
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('unit_id', unitId);

      if (updateError) {
        console.error('Error updating tenant-unit relationship:', updateError);
        return { success: false, message: `Update error: ${updateError.message}` };
      }

      console.log('Tenant-unit relationship updated successfully');
      return { success: true, message: 'Relationship updated' };
    }
    // 3. If the relationship doesn't exist, create it
    else {
      console.log('No existing relationship found, creating new one...');
      const { data, error: insertError } = await supabase
        .from('tenant_units')
        .insert([{
          tenant_id: tenantId,
          unit_id: unitId,
          rent_amount: rentAmount,
          rent_due_day: rentDueDay,
          is_primary: true,
          lease_start_date: new Date().toISOString().split('T')[0], // Just get YYYY-MM-DD
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (insertError) {
        console.error('Error creating tenant-unit relationship:', insertError);
        return { success: false, message: `Insert error: ${insertError.message}` };
      }

      console.log('Tenant-unit relationship created successfully');
      return { success: true, message: 'Relationship created' };
    }
  } catch (err) {
    console.error('Exception in fixTenantUnitRelationship:', err);
    return { success: false, message: `Exception: ${err.message}` };
  }
}

/**
 * Directly updates a tenant-unit relationship using a raw SQL query to bypass any ORM issues
 * This is useful when the normal update methods aren't working properly
 */
async function directDbUpdate(tenantId, unitId, rentAmount, rentDueDay) {
  console.log(`Performing direct database update for tenant ${tenantId} and unit ${unitId}`);

  try {
    // First check if the relationship exists
    const checkQuery = `
      SELECT id FROM public.tenant_units 
      WHERE tenant_id = '${tenantId}' 
      AND unit_id = '${unitId}'
    `;

    const { data: checkResult, error: checkError } = await supabase.rpc('execute_sql', {
      sql: checkQuery
    });

    if (checkError) {
      console.error('Error checking tenant-unit existence:', checkError);
      return { success: false, error: checkError };
    }

    let sqlQuery;
    let actionType;

    if (checkResult && checkResult.length > 0) {
      // Update existing relationship
      actionType = 'update';
      sqlQuery = `
        UPDATE public.tenant_units 
        SET rent_amount = ${rentAmount}, 
            rent_due_day = ${rentDueDay}, 
            is_primary = true,
            updated_at = NOW()
        WHERE tenant_id = '${tenantId}' 
        AND unit_id = '${unitId}'
      `;
    } else {
      // Insert new relationship
      actionType = 'insert';
      sqlQuery = `
        INSERT INTO public.tenant_units 
        (tenant_id, unit_id, rent_amount, rent_due_day, is_primary, lease_start_date, created_at, updated_at)
        VALUES 
        ('${tenantId}', '${unitId}', ${rentAmount}, ${rentDueDay}, true, NOW(), NOW(), NOW())
      `;
    }

    console.log(`Executing ${actionType} SQL: ${sqlQuery}`);

    const { data, error } = await supabase.rpc('execute_sql', {
      sql: sqlQuery
    });

    if (error) {
      console.error(`Error in direct ${actionType}:`, error);
      return { success: false, error };
    }

    console.log(`Direct ${actionType} successful`);
    return { success: true, data };
  } catch (err) {
    console.error('Exception in directDbUpdate:', err);
    return { success: false, error: err };
  }
}

// Make this function available to other modules
module.exports = { fixTenantUnitRelationship, directDbUpdate };
