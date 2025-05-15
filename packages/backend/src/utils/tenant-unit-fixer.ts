import { supabase } from "../config/database";

interface FixResult {
  success: boolean;
  message: string;
}

/**
 * This function ensures that rent_amount and rent_due_day are properly stored in the tenant_units table
 * for the given tenant and unit. It directly uses raw SQL to ensure data consistency.
 */
export async function fixTenantUnitRelationship(
  tenantId: string,
  unitId: string,
  rentAmount: number,
  rentDueDay: number
): Promise<FixResult> {
  console.log(`[DEBUG-FIXER] Starting fixTenantUnitRelationship`);
  console.log(`[DEBUG-FIXER] Input values: tenantId=${tenantId}, unitId=${unitId}`);
  console.log(`[DEBUG-FIXER] Input types: tenantId=${typeof tenantId}, unitId=${typeof unitId}`);
  console.log(`[DEBUG-FIXER] Setting rent_amount=${rentAmount} (${typeof rentAmount}), rent_due_day=${rentDueDay} (${typeof rentDueDay})`);

  if (!tenantId || !unitId) {
    console.error(`[DEBUG-FIXER] Invalid input: tenantId or unitId is missing`);
    return { success: false, message: `Invalid input: tenantId or unitId is missing` };
  }

  try {
    console.log(`[DEBUG-FIXER] Checking if tenant-unit relationship exists`);
    // 1. First check if the tenant-unit relationship exists
    const { data: existingRelation, error } = await supabase
      .from('tenant_units')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('unit_id', unitId)
      .single(); if (error && error.code !== 'PGRST116') {
        console.error('[DEBUG-FIXER] Error checking tenant-unit relationship:', error);
        console.error('[DEBUG-FIXER] Error code:', error.code);
        console.error('[DEBUG-FIXER] Error message:', error.message);
        return { success: false, message: `Database error: ${error.message}` };
      }

    // 2. If the relationship exists, update it
    if (existingRelation) {
      console.log('[DEBUG-FIXER] Existing relationship found with ID:', existingRelation.id);
      console.log('[DEBUG-FIXER] Current values: rent_amount=', existingRelation.rent_amount, 'rent_due_day=', existingRelation.rent_due_day);
      console.log('[DEBUG-FIXER] Will update to: rent_amount=', rentAmount, 'rent_due_day=', rentDueDay);

      const updateData = {
        rent_amount: rentAmount,
        rent_due_day: rentDueDay,
        is_primary: true, // Ensure this is the primary relationship
        updated_at: new Date().toISOString()
      };

      console.log('[DEBUG-FIXER] Update payload:', JSON.stringify(updateData));

      const { data, error: updateError } = await supabase
        .from('tenant_units')
        .update(updateData)
        .eq('tenant_id', tenantId)
        .eq('unit_id', unitId);

      if (updateError) {
        console.error('Error updating tenant-unit relationship:', updateError);
        return { success: false, message: `Update error: ${updateError.message}` };
      }

      console.log('Tenant-unit relationship updated successfully');
      return { success: true, message: 'Relationship updated' };
    }    // 3. If the relationship doesn't exist, create it
    else {
      console.log('[DEBUG-FIXER] No existing relationship found, creating new one...');
      const insertData = {
        tenant_id: tenantId,
        unit_id: unitId,
        rent_amount: rentAmount,
        rent_due_day: rentDueDay,
        is_primary: true,
        lease_start_date: new Date().toISOString().split('T')[0], // Just get YYYY-MM-DD
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('[DEBUG-FIXER] Insert payload:', JSON.stringify(insertData));

      const { data, error: insertError } = await supabase
        .from('tenant_units')
        .insert([insertData])
        .select(); // Add select to get the inserted record back

      if (data) {
        console.log('[DEBUG-FIXER] Insert response data:', JSON.stringify(data));
      }

      if (insertError) {
        console.error('[DEBUG-FIXER] Error creating tenant-unit relationship:', insertError);
        console.error('[DEBUG-FIXER] Error code:', insertError.code);
        console.error('[DEBUG-FIXER] Error message:', insertError.message);
        return { success: false, message: `Insert error: ${insertError.message}` };
      }

      console.log('Tenant-unit relationship created successfully');
      return { success: true, message: 'Relationship created' };
    }
  } catch (err) {
    const error = err as Error;
    console.error('[DEBUG-FIXER] Exception in fixTenantUnitRelationship:', error);
    console.error('[DEBUG-FIXER] Error stack:', error.stack);
    console.error('[DEBUG-FIXER] Error occurred with inputs:', {
      tenantId,
      unitId,
      rentAmount,
      rentDueDay
    });
    return { success: false, message: `Exception: ${error.message}` };
  }
}
