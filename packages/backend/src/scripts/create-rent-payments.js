// Script to create rent payments for all tenant_units for the current month
require('dotenv').config({ path: '../../.env' });

const { createClient } = require('@supabase/supabase-js');

// Create a Supabase client with the service role key for admin operations
// This bypasses RLS policies to allow direct database modifications
const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createRentPayments() {
  console.log('Creating rent payments for all tenant_units...');

  try {
    // Get current date
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Format today's date for logging
    const todayFormatted = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
    console.log(`Today's date: ${todayFormatted}`);

    // Get all tenant_units with tenant and unit information
    const { data: tenantUnits, error: fetchError } = await adminSupabase
      .from('tenant_units')
      .select(`
        *,
        tenants (*),
        units (*)
      `);

    if (fetchError) {
      console.error('Error fetching tenant_units:', fetchError.message);
      return;
    }

    if (!tenantUnits || tenantUnits.length === 0) {
      console.log('No tenant_units found in database');
      return;
    }

    console.log(`Found ${tenantUnits.length} tenant units`);

    // Process each tenant unit
    const results = [];
    for (const tenantUnit of tenantUnits) {
      try {
        const tenant = tenantUnit.tenants;
        const unit = tenantUnit.units;

        if (!tenant || !unit) {
          console.log(`Skipping tenant_unit ${tenantUnit.id} - missing tenant or unit info`);
          continue;
        }

        // Handle null or undefined rent_due_day
        if (tenantUnit.rent_due_day === null || tenantUnit.rent_due_day === undefined) {
          console.log(`Tenant unit ${tenantUnit.id} has null/undefined rent_due_day, skipping`);
          continue;
        }

        // Convert to number explicitly
        const dueDayAsNumber = Number(tenantUnit.rent_due_day);

        // Check if it's a valid number
        if (isNaN(dueDayAsNumber)) {
          console.log(`Tenant unit ${tenantUnit.id} has invalid rent_due_day: ${tenantUnit.rent_due_day}, skipping`);
          continue;
        }

        console.log(`Processing tenant: ${tenant.first_name} ${tenant.last_name}, rent_due_day: ${dueDayAsNumber}`);

        // Calculate the due date for this month
        const dueDate = new Date(currentYear, currentMonth, dueDayAsNumber);
        const dueDateFormatted = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dueDayAsNumber).padStart(2, '0')}`;

        // Check if we already have a payment record for this month
        const startOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const endOfMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-31`; // Will automatically handle shorter months

        console.log(`Checking for existing payments between ${startOfMonth} and ${endOfMonth}`);

        const { data: existingPayments, error: checkError } = await adminSupabase
          .from('rent_payments')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('unit_id', unit.id)
          .gte('due_date', startOfMonth)
          .lte('due_date', endOfMonth);

        if (checkError) {
          console.error(`Error checking existing payments: ${checkError.message}`);
          continue;
        }

        console.log(`Found ${existingPayments?.length || 0} existing payments for this month`);

        // If payment already exists for this month, skip
        if (existingPayments && existingPayments.length > 0) {
          console.log(`Payment already exists for tenant ${tenant.id} this month. Skipping.`);
          continue;
        }

        // Create a new payment record
        console.log(`Creating new payment record for tenant ${tenant.first_name} ${tenant.last_name}`);

        // Calculate days past due
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
        console.log(`Days past due: ${daysPastDue}`);

        // Determine status based on days past due
        const status = daysPastDue > 0 ? 'late' : 'pending';

        // Define the payment data
        const newPaymentData = {
          tenant_id: tenant.id,
          unit_id: unit.id,
          amount: tenantUnit.rent_amount,
          due_date: dueDateFormatted,
          payment_date: null,
          status: status,
          payment_method: null,
          interac_request_link: null
        };

        // Insert the new payment
        const { data: newPayment, error: insertError } = await adminSupabase
          .from('rent_payments')
          .insert([newPaymentData])
          .select()
          .single();

        if (insertError) {
          console.error(`Error creating payment: ${insertError.message}`);
          continue;
        }

        console.log(`Successfully created payment record with ID: ${newPayment.id} and status: ${status}`);

        results.push({
          tenant: `${tenant.first_name} ${tenant.last_name}`,
          unit: unit.unit_number,
          amount: tenantUnit.rent_amount,
          due_date: dueDateFormatted,
          status: status,
          payment_id: newPayment.id
        });
      } catch (error) {
        console.error(`Error processing tenant_unit ${tenantUnit.id}:`, error);
      }
    }

    console.log(`Created ${results.length} payment records`);
    console.log('Results:', results);
  } catch (error) {
    console.error('Exception when creating rent payments:', error);
  }
}

// Execute the function
createRentPayments();
