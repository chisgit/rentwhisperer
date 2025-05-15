interface Tenant {
  id?: number | string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  // Fields derived from relationships
  unit_id: number | string | null | undefined;
  unit_number?: string;

  // Property fields
  property_id?: number | string | null;
  property_name?: string;
  property_address?: string;
  property_city?: string;
  property_province?: string;
  property_postal_code?: string;

  // Rent info comes from tenant_units table
  rent_amount?: number | null;
  rent_due_day?: number | null;
  created_at?: string;
  updated_at?: string;
}

export default Tenant;
