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
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Updated to match .env file

if (!supabaseUrl || !supabaseKey) {
  logger.error("Missing Supabase credentials");
  console.log("Missing Supabase credentials in environment variables");
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Define database types to match Supabase schema
export interface Tenant {
  id: string; // UUID in the database
  first_name: string;
  last_name: string;
  email: string;
  phone: string; // WhatsApp-enabled phone number
  created_at: string;
  updated_at: string;
  unit_id: string | null;
}

export interface TenantUnit {
  tenant_id: string; // UUID in the database
  unit_id: string; // UUID in the database
  is_primary: boolean;
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
