import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { logger } from "../utils/logger";

// Try loading environment variables from multiple locations
// First try the root project .env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
// Then try the package root .env (will not override existing env vars)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Used for normal client operations
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Used to bypass RLS

if (!supabaseUrl || !supabaseKey) {
  logger.error("Missing Supabase credentials");
  console.log("Missing Supabase credentials in environment variables");
  process.exit(1);
}

// Create client with anon key for regular operations
export const supabase = createClient(supabaseUrl, supabaseKey);

// Create a service role client that can bypass RLS if service key is available
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase; // Fallback to regular client if no service key

// Define database types to match Supabase schema
export interface Tenant {
  id: string; // UUID in the database
  first_name: string;
  last_name: string;
  email: string;
  phone: string; // WhatsApp-enabled phone number
  created_at: string;
  updated_at: string;
  // The following fields are not stored in the tenants table but derived through relationships
  unit_id?: string | null; // Derived from tenant_units relationship
  property_name?: string; // Derived from units->properties relationship
  property_address?: string; // Derived from units->properties relationship
  property_city?: string; // Derived from units->properties relationship
  property_province?: string; // Derived from units->properties relationship
  property_postal_code?: string; // Derived from units->properties relationship
  unit_number?: string; // Derived from units relationship
  rent_amount?: number; // Derived from tenant_units relationship
  rent_due_day?: number; // Derived from tenant_units relationship
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
