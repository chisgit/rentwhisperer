// Create seed data for the RentWhisperer database
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
  try {
    console.log("Starting database seeding...");

    // Create a landlord
    console.log("Creating landlord...");
    const { data: landlord, error: landlordError } = await supabase
      .from("landlords")
      .insert({
        name: "Sample Property Management",
        email: "admin@samplepm.com",
        phone: "+14165551234",
        user_id: null // Explicitly set user_id to null
      })
      .select()
      .single();

    if (landlordError) {
      console.error("Full landlordError object:", landlordError);
      throw new Error(`Error creating landlord: ${landlordError.message || 'Unknown error details'}`);
    }

    console.log("Landlord created:", landlord);

    // Create a property
    console.log("Creating property...");
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .insert({
        name: "Sunset Apartments",
        address: "123 Main Street",
        city: "Toronto",
        province: "ON",
        postal_code: "M5V 1A1",
        landlord_id: landlord.id
      })
      .select()
      .single();

    if (propertyError) {
      throw new Error(`Error creating property: ${propertyError.message}`);
    }

    console.log("Property created:", property);

    // Create units
    console.log("Creating units...");
    const unitsData = [
      {
        unit_number: "101",
        property_id: property.id,
        rent_amount: 1800,
        rent_due_day: 1,
        lease_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(), // Start of current month
        lease_end: new Date(new Date().getFullYear() + 1, new Date().getMonth(), 0).toISOString() // End of month, 1 year from now
      },
      {
        unit_number: "102",
        property_id: property.id,
        rent_amount: 1900,
        rent_due_day: 1,
        lease_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        lease_end: new Date(new Date().getFullYear() + 1, new Date().getMonth(), 0).toISOString()
      },
      {
        unit_number: "201",
        property_id: property.id,
        rent_amount: 2000,
        rent_due_day: 1,
        lease_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        lease_end: new Date(new Date().getFullYear() + 1, new Date().getMonth(), 0).toISOString()
      }
    ];

    const { data: units, error: unitsError } = await supabase
      .from("units")
      .insert(unitsData)
      .select();

    if (unitsError) {
      throw new Error(`Error creating units: ${unitsError.message}`);
    }

    // Ensure units are created before tenants so we can assign unit_id
    if (unitsError) {
      throw new Error(`Error creating units: ${(unitsError as any)?.message || 'Unknown error'}`);
    }
    if (!units || units.length < 3) {
      throw new Error('Not enough units created or units array is null/empty.');
    }
    console.log("Units created:", units);

    // Create tenants
    console.log("Creating tenants...");
    const tenantsData = [
      {
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com",
        phone: "+14165551111",
        unit_id: units[0].id // Assign to first unit
      },
      {
        first_name: "Jane",
        last_name: "Smith",
        email: "jane.smith@example.com",
        phone: "+14165552222",
        unit_id: units[1].id // Assign to second unit
      },
      {
        first_name: "Michael",
        last_name: "Brown",
        email: "michael.brown@example.com",
        phone: "+14165553333",
        unit_id: units[2].id // Assign to third unit
      },
      {
        first_name: "Mock",
        last_name: "Tenant", // This tenant won't be assigned a unit initially
        email: "mock.tenant@example.com",
        phone: "+15555555555",
        unit_id: null
      }
    ];

    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .insert(tenantsData)
      .select();

    if (tenantsError) {
      throw new Error(`Error creating tenants: ${tenantsError.message}`);
    }

    // Ensure tenants are created before proceeding
    if (tenantsError) {
      throw new Error(`Error creating tenants: ${(tenantsError as any)?.message || 'Unknown error'}`);
    }
    if (!tenants || tenants.length === 0) {
      throw new Error('No tenants created or tenants array is null/empty.');
    }
    console.log("Tenants created:", tenants);

    // tenant_units relationships are no longer created as tenants are directly linked to units.
    // The units table now holds rent_amount and rent_due_day.

    // Create rent_payments
    console.log("Creating rent payments...");

    // We'll use the rent_amount from the units table, accessed via the tenant's unit_id
    // This assumes tenants[0], tenants[1], tenants[2] have valid unit_ids from the created units.

    const rentPaymentsData = [];

    // Payment for John Doe (tenant 0, unit 0)
    if (tenants[0]?.unit_id && units.find(u => u.id === tenants[0].unit_id)) {
      const unitForTenant0 = units.find(u => u.id === tenants[0].unit_id);
      rentPaymentsData.push({
        tenant_id: tenants[0].id,
        unit_id: tenants[0].unit_id,
        amount: unitForTenant0.rent_amount,
        due_date: new Date(new Date().getFullYear(), new Date().getMonth(), unitForTenant0.rent_due_day).toISOString().split('T')[0],
        payment_date: new Date(new Date().getFullYear(), new Date().getMonth(), unitForTenant0.rent_due_day - 2).toISOString().split('T')[0], // Paid 2 days before due
        is_late: false,
        status: "paid",
        payment_method: "credit_card"
      });
      // Partial payment example for John Doe
      rentPaymentsData.push({
        tenant_id: tenants[0].id,
        unit_id: tenants[0].unit_id,
        amount: unitForTenant0.rent_amount / 2, // Partial amount
        due_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, unitForTenant0.rent_due_day).toISOString().split('T')[0], // Next month
        payment_date: null,
        is_late: false,
        status: "partial",
        payment_method: "credit_card"
      });
    }

    // Payment for Jane Smith (tenant 1, unit 1)
    if (tenants[1]?.unit_id && units.find(u => u.id === tenants[1].unit_id)) {
      const unitForTenant1 = units.find(u => u.id === tenants[1].unit_id);
      rentPaymentsData.push({
        tenant_id: tenants[1].id,
        unit_id: tenants[1].unit_id,
        amount: unitForTenant1.rent_amount,
        due_date: new Date(new Date().getFullYear(), new Date().getMonth(), unitForTenant1.rent_due_day).toISOString().split('T')[0],
        payment_date: new Date(new Date().getFullYear(), new Date().getMonth(), unitForTenant1.rent_due_day + 5).toISOString().split('T')[0], // Paid 5 days after due (late)
        is_late: true,
        status: "late",
        payment_method: "e_transfer"
      });
    }

    // Payment for Michael Brown (tenant 2, unit 2)
    if (tenants[2]?.unit_id && units.find(u => u.id === tenants[2].unit_id)) {
      const unitForTenant2 = units.find(u => u.id === tenants[2].unit_id);
      rentPaymentsData.push({
        tenant_id: tenants[2].id,
        unit_id: tenants[2].unit_id,
        amount: unitForTenant2.rent_amount,
        due_date: new Date(new Date().getFullYear(), new Date().getMonth(), unitForTenant2.rent_due_day).toISOString().split('T')[0],
        payment_date: null, // Not paid yet
        is_late: false,
        status: "pending",
        payment_method: null
      });
    }

    // Original rentPaymentsData structure for reference has been removed by previous step.
    // The new rentPaymentsData array is built above.

    if (rentPaymentsData.length > 0) {
      const { data: rentPayments, error: rentPaymentsError } = await supabase
        .from("rent_payments")
        .insert(rentPaymentsData)
        .select();

      if (rentPaymentsError) {
        throw new Error(`Error creating rent payments: ${rentPaymentsError.message}`);
      }
      console.log("Rent payments created:", rentPayments);
    } else {
      console.log("No rent payments to create (possibly no tenants with units).");
    }

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seedDatabase();
