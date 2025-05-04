interface Tenant {
  id?: number | string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  unit_id: number | string;
  unit_number?: string;
  property_name?: string;
  rent_amount?: number;
  rent_due_day?: number;
  created_at?: string;
  updated_at?: string;
}

export default Tenant;
