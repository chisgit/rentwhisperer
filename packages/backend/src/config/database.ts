import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { logger } from "../utils/logger"; // Note: logger itself might depend on .env
import { Database } from "../types/database.types";

// Define the path to the .env file relative to this config file (packages/backend/src/config/ -> packages/backend/.env)
const envPath = path.resolve(__dirname, "../../.env");
console.log(`[database.ts] Attempting to load .env from: ${envPath}`);

// Load environment variables
const dotenvResult = dotenv.config({ path: envPath });

if (dotenvResult.error) {
  console.error('[database.ts] Error loading .env file:', dotenvResult.error);
} else {
  console.log('[database.ts] .env file loaded. Parsed keys:', Object.keys(dotenvResult.parsed || {}));
  if (Object.keys(dotenvResult.parsed || {}).length === 0) {
    console.warn("[database.ts] .env file was found and loaded, but it's empty or all keys were already in process.env.");
  }
}

// Re-read from process.env after attempting to load .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Used for normal client operations
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Used to bypass RLS

// Log the values read from process.env
console.log(`[database.ts] Read SUPABASE_URL from process.env: ${supabaseUrl}`);
console.log(`[database.ts] Read SUPABASE_ANON_KEY from process.env: ${supabaseKey}`);

if (!supabaseUrl || !supabaseKey) {
  console.error("[database.ts] CRITICAL: Missing Supabase credentials (URL or Anon Key) after attempting to load .env.");
  console.log("[database.ts] Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in:", envPath);
  console.log("[database.ts] Exiting due to missing credentials.");
  process.exit(1); // Exit if essential credentials are not found
}

// This log will now only appear if credentials are found
logger.info(`[database.ts] Successfully loaded Supabase credentials. Attempting to connect to Supabase URL: ${supabaseUrl}`);

// Create client with anon key for regular operations
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Create a service role client that can bypass RLS if service key is available
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase; // Fallback to regular client if no service key

console.log(`[database.ts] Supabase client initialized with ANON key: ${supabaseKey?.slice(0, 8)}...`);
if (supabaseServiceKey) {
  console.log(`[database.ts] Supabase admin client initialized with SERVICE ROLE key: ${supabaseServiceKey?.slice(0, 8)}...`);
} else {
  console.log(`[database.ts] No service role key found, admin client is same as anon client.`);
}

// Define database types to match Supabase schema
export interface Tenant {
  id: string; // UUID in the database
  first_name: string;
  last_name: string;
  email: string;
  phone: string; // WhatsApp-enabled phone number
  created_at?: string;
  updated_at?: string;
  // The following fields are not stored in the tenants table but derived through relationships
  unit_id?: string | null; // Derived from tenant_units relationship
  property_name?: string; // Derived from units->properties relationship
  property_address?: string; // Derived from units->properties relationship
  property_city?: string; // Derived from units->properties relationship
  property_province?: string; // Derived from units->properties relationship
  property_postal_code?: string; // Derived from units->properties relationship
  unit_number?: string; // Derived from units relationship
  rent_amount?: number | null; // Derived from tenant_units relationship
  rent_due_day?: number | null; // Derived from tenant_units relationship
  tenant_units?: TenantUnit[]; // Related tenant-unit relationships
}

export interface TenantUnit {
  tenant_id: string; // UUID in the database
  unit_id: string; // UUID in the database
  is_primary: boolean;
  rent_amount: number; // Added field for per-tenant rent amount
  rent_due_day: number; // Added field for per-tenant rent due day
  lease_start: string;
  lease_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string; // UUID in the database
  name: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  landlord_id: string; // UUID in the database
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string; // UUID in the database
  unit_number: string;
  property_id: string; // UUID in the database
  rent_amount: number;
  rent_due_day: number; // Day of month rent is due
  lease_start: string;
  lease_end: string | null; // null for month-to-month
  created_at: string;
  updated_at: string;
}

export interface RentPayment {
  id: string;
  tenant_id: string;
  unit_id: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: "pending" | "paid" | "late" | "partial";
  payment_method: string | null;
  interac_request_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  payment_id: string | null;
  type: "rent_due" | "rent_late" | "receipt" | "form_n4" | "form_l1";
  channel: "whatsapp" | "email";
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  message_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type { Database };
