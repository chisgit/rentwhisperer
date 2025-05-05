export interface Payment {
  id: string;
  tenant_id: string;
  tenant_name: string;
  unit_id: string;
  unit_number: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: "pending" | "paid" | "late" | "partial";
  payment_method: string | null;
  interac_request_link: string | null;
}

export interface PaymentConfirmationData {
  id: string;
  status: string;
  payment_date: string;
  payment_method: string;
  notes?: string;
}
