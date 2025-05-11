interface Tenant {
  id?: number | string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  // Fields derived from relationships
  unit_id: number | string | null | undefined;
  unit_number?: string;
  property_name?: string;
  // Rent info comes from tenant_units table
  rent_amount?: number;
  rent_due_day?: number;
  created_at?: string;
  updated_at?: string;
}

export default Tenant;
