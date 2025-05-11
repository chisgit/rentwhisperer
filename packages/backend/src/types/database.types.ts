// This file defines types for the Supabase database schema

import { Tenant, TenantUnit, Property, Unit, RentPayment, Notification } from "../config/database";

export type Database = {
  tenants: Tenant[];
  tenant_units: TenantUnit[];
  properties: Property[];
  units: Unit[];
  rent_payments: RentPayment[];
  notifications: Notification[];
};
