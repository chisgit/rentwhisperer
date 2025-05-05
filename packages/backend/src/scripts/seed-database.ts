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
        phone: "+14165551234"
      })
      .select()
      .single();

    if (landlordError) {
      throw new Error(`Error creating landlord: ${landlordError.message}`);
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
        lease_start: new Date().toISOString()
      },
      {
        unit_number: "102",
        property_id: property.id,
        lease_start: new Date().toISOString()
      },
      {
        unit_number: "201",
        property_id: property.id,
        lease_start: new Date().toISOString()
      }
    ];

    const { data: units, error: unitsError } = await supabase
      .from("units")
      .insert(unitsData)
      .select();

    if (unitsError) {
      throw new Error(`Error creating units: ${unitsError.message}`);
    }

    console.log("Units created:", units);

    // Create tenants
    console.log("Creating tenants...");
    const tenantsData = [
      {
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com",
        phone: "+14165551111"
      },
      {
        first_name: "Jane",
        last_name: "Smith",
        email: "jane.smith@example.com",
        phone: "+14165552222"
      },
      {
        first_name: "Michael",
        last_name: "Brown",
        email: "michael.brown@example.com",
        phone: "+14165553333"
      },
      {
        first_name: "Mock",
        last_name: "Tenant",
        email: "mock.tenant@example.com",
        phone: "+15555555555"
      }
    ];

    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .insert(tenantsData)
      .select();

    if (tenantsError) {
      throw new Error(`Error creating tenants: ${tenantsError.message}`);
    }

    console.log("Tenants created:", tenants);

    // Create tenant_units relationships
    console.log("Creating tenant-unit relationships...");
    const tenantUnitsData = [
      {
        tenant_id: tenants[0].id,
        unit_id: units[0].id,
        is_primary: true,
        lease_start: new Date().toISOString(),
        rent_amount: 1800,
        rent_due_day: 1
      },
      {
        tenant_id: tenants[1].id,
        unit_id: units[1].id,
        is_primary: true,
        lease_start: new Date().toISOString(),
        rent_amount: 1900,
        rent_due_day: 1
      },
      {
        tenant_id: tenants[2].id,
        unit_id: units[2].id,
        is_primary: true,
        lease_start: new Date().toISOString(),
        rent_amount: 2000,
        rent_due_day: 1
      }
    ];

    const { data: tenantUnits, error: tenantUnitsError } = await supabase
      .from("tenant_units")
      .insert(tenantUnitsData)
      .select();

    if (tenantUnitsError) {
      throw new Error(`Error creating tenant-unit relationships: ${tenantUnitsError.message}`);
    }

    console.log("Tenant-unit relationships created:", tenantUnits);

    // Create rent_payments
    console.log("Creating rent payments...");

    // Fetch tenant_units data to get rent_amount and rent_due_day
    const { data: tenantUnitsDataForPayments, error: tenantUnitsErrorForPayments } = await supabase
      .from("tenant_units")
      .select("tenant_id, unit_id, rent_amount, rent_due_day");

    if (tenantUnitsErrorForPayments) {
      throw new Error(`Error fetching tenant_units data: ${tenantUnitsErrorForPayments.message}`);
    }

    const rentPaymentsData = [
      {
        tenant_id: tenants[0].id,
        unit_id: units[0].id,
        amount: tenantUnitsDataForPayments.find(tu => tu.tenant_id === tenants[0].id && tu.unit_id === units[0].id)?.rent_amount,
        due_date: new Date(new Date().setDate(15)).toISOString().split('T')[0], // Due on the 15th of this month
        payment_date: new Date(new Date().setDate(10)).toISOString().split('T')[0], // Paid on the 10th of this month
        is_late: false,
        status: "paid",
        payment_method: "credit_card"
      },
      {
        tenant_id: tenants[1].id,
        unit_id: units[1].id,
        amount: tenantUnitsDataForPayments.find(tu => tu.tenant_id === tenants[1].id && tu.unit_id === units[1].id)?.rent_amount,
        due_date: new Date(new Date().setDate(5)).toISOString().split('T')[0], // Due on the 5th of this month
        payment_date: new Date(new Date().setDate(10)).toISOString().split('T')[0], // Paid on the 10th of this month (late)
        is_late: true,
        status: "late",
        payment_method: "e_transfer"
      },
      {
        tenant_id: tenants[2].id,
        unit_id: units[2].id,
        amount: tenantUnitsDataForPayments.find(tu => tu.tenant_id === tenants[2].id && tu.unit_id === units[2].id)?.rent_amount,
        due_date: new Date(new Date().setDate(25)).toISOString().split('T')[0], // Due on the 25th of this month
        payment_date: null, // Not paid yet
        is_late: false,
        status: "pending",
        payment_method: null
      },
      {
        tenant_id: tenants[0].id,
        unit_id: units[0].id,
        amount: tenantUnitsDataForPayments.find(tu => tu.tenant_id === tenants[0].id && tu.unit_id === units[0].id)?.rent_amount,
        due_date: new Date(new Date().setDate(15)).toISOString().split('T')[0], // Due on the 15th of this month
        payment_date: new Date(new Date().setDate(10)).toISOString().split('T')[0], // Paid on the 10th of this month
        is_late: false,
        status: "partial",
        payment_method: "credit_card"
      }
    ];

    const { data: rentPayments, error: rentPaymentsError } = await supabase
      .from("rent_payments")
      .insert(rentPaymentsData)
      .select();

    if (rentPaymentsError) {
      throw new Error(`Error creating rent payments: ${rentPaymentsError.message}`);
    }

    console.log("Rent payments created:", rentPayments);

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seedDatabase();
