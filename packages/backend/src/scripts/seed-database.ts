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
      { unit_number: "101", property_id: property.id },
      { unit_number: "102", property_id: property.id },
      { unit_number: "201", property_id: property.id },
    ];

    const { data: units, error: unitsError } = await supabase
      .from("units")
      .insert(unitsData)
      .select();

    if (unitsError) {
      console.error("Full unitsError object:", unitsError);
      throw new Error(`Error creating units: ${unitsError.message || 'Unknown error details'}`);
    }
    if (!units || units.length < 3) {
      throw new Error("Not enough units created or units array is null/empty.");
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
      },
      {
        first_name: "Jane",
        last_name: "Smith",
        email: "jane.smith@example.com",
        phone: "+14165552222",
      },
      {
        first_name: "Michael",
        last_name: "Brown",
        email: "michael.brown@example.com",
        phone: "+14165553333",
      },
      {
        first_name: "Mock",
        last_name: "Tenant",
        email: "mock.tenant@example.com",
        phone: "+15555555555",
      },
    ];

    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .insert(tenantsData)
      .select();

    if (tenantsError) {
      console.error("Full tenantsError object:", tenantsError);
      throw new Error(`Error creating tenants: ${tenantsError.message || 'Unknown error details'}`);
    }
    if (!tenants || tenants.length === 0) {
      throw new Error("No tenants created or tenants array is null/empty.");
    }
    console.log("Tenants created:", tenants);

    // Create tenant_units relationships
    console.log("Creating tenant_units relationships...");
    const tenantUnitsData = [
      {
        tenant_id: tenants[0].id,
        unit_id: units[0].id,
        rent_amount: Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500,
        rent_due_day: Math.floor(Math.random() * 28) + 1,
        lease_start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        lease_end_date: new Date(new Date().getFullYear() + 1, new Date().getMonth(), 0).toISOString().split('T')[0],
      },
      {
        tenant_id: tenants[1].id,
        unit_id: units[1].id,
        rent_amount: Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500,
        rent_due_day: Math.floor(Math.random() * 28) + 1,
        lease_start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        lease_end_date: new Date(new Date().getFullYear() + 1, new Date().getMonth(), 0).toISOString().split('T')[0],
      },
      {
        tenant_id: tenants[2].id,
        unit_id: units[2].id,
        rent_amount: Math.floor(Math.random() * (2500 - 1500 + 1)) + 1500,
        rent_due_day: Math.floor(Math.random() * 28) + 1,
        lease_start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        lease_end_date: new Date(new Date().getFullYear() + 1, new Date().getMonth(), 0).toISOString().split('T')[0],
      },
    ];

    const { data: tenantUnits, error: tenantUnitsError } = await supabase
      .from("tenant_units")
      .insert(tenantUnitsData)
      .select();

    if (tenantUnitsError) {
      console.error("Full tenantUnitsError object:", tenantUnitsError);
      throw new Error(`Error creating tenant_units: ${tenantUnitsError.message || 'Unknown error details'}`);
    }
    if (!tenantUnits || tenantUnits.length < 3) {
      throw new Error("Not enough tenant_units created or array is null/empty.");
    }
    console.log("Tenant_units created:", tenantUnits);


    // Create rent_payments
    console.log("Creating rent payments...");
    const rentPaymentsData = [];

    // Payment for John Doe (tenant 0, unit 0, tenant_unit 0)
    if (tenantUnits[0]) {
      rentPaymentsData.push({
        tenant_id: tenantUnits[0].tenant_id,
        unit_id: tenantUnits[0].unit_id,
        tenant_unit_id: tenantUnits[0].id,
        amount: tenantUnits[0].rent_amount,
        due_date: new Date(new Date().getFullYear(), new Date().getMonth(), tenantUnits[0].rent_due_day).toISOString().split('T')[0],
        payment_date: new Date(new Date().getFullYear(), new Date().getMonth(), tenantUnits[0].rent_due_day - 2).toISOString().split('T')[0], // Paid 2 days before due
        is_late: false,
        status: "paid",
        payment_method: "credit_card",
      });
      // Partial payment example for John Doe
      rentPaymentsData.push({
        tenant_id: tenantUnits[0].tenant_id,
        unit_id: tenantUnits[0].unit_id,
        tenant_unit_id: tenantUnits[0].id,
        amount: tenantUnits[0].rent_amount / 2, // Partial amount
        due_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, tenantUnits[0].rent_due_day).toISOString().split('T')[0], // Next month
        payment_date: null,
        is_late: false,
        status: "partial",
        payment_method: "credit_card",
      });
    }

    // Payment for Jane Smith (tenant 1, unit 1, tenant_unit 1)
    if (tenantUnits[1]) {
      rentPaymentsData.push({
        tenant_id: tenantUnits[1].tenant_id,
        unit_id: tenantUnits[1].unit_id,
        tenant_unit_id: tenantUnits[1].id,
        amount: tenantUnits[1].rent_amount,
        due_date: new Date(new Date().getFullYear(), new Date().getMonth(), tenantUnits[1].rent_due_day).toISOString().split('T')[0],
        payment_date: new Date(new Date().getFullYear(), new Date().getMonth(), tenantUnits[1].rent_due_day + 5).toISOString().split('T')[0], // Paid 5 days after due (late)
        is_late: true,
        status: "late",
        payment_method: "e_transfer",
      });
    }

    // Payment for Michael Brown (tenant 2, unit 2, tenant_unit 2)
    if (tenantUnits[2]) {
      rentPaymentsData.push({
        tenant_id: tenantUnits[2].tenant_id,
        unit_id: tenantUnits[2].unit_id,
        tenant_unit_id: tenantUnits[2].id,
        amount: tenantUnits[2].rent_amount,
        due_date: new Date(new Date().getFullYear(), new Date().getMonth(), tenantUnits[2].rent_due_day).toISOString().split('T')[0],
        payment_date: null, // Not paid yet
        is_late: false,
        status: "pending",
        payment_method: null,
      });
    }

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
