import React, { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { Input } from "./FormElements";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentInfo: {
    id: string;
    tenant_name: string;
    amount: number;
    due_date: string;
  };
  onConfirm: (paymentData: {
    id: string;
    status: string;
    payment_date: string;
    payment_method: string;
    notes?: string;
  }) => void;
}

const PaymentConfirmationModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  paymentInfo,
  onConfirm,
}) => {
  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "e-transfer",
    notes: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      id: paymentInfo.id,
      status: "paid",
      payment_date: formData.payment_date,
      payment_method: formData.payment_method,
      notes: formData.notes,
    });
    onClose();
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Payment"
      footer={
        <div className="flex justify-end space-x-3">
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Confirm Payment</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Tenant</p>
              <p className="font-medium">{paymentInfo.tenant_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <p className="font-medium">{formatCurrency(paymentInfo.amount)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Due Date</p>
              <p className="font-medium">
                {new Date(paymentInfo.due_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <form id="payment-confirmation-form" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label="Payment Date"
              id="payment_date"
              name="payment_date"
              type="date"
              value={formData.payment_date}
              onChange={handleChange}
              fullWidth
              required
            />

            <div>
              <label
                htmlFor="payment_method"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Payment Method
              </label>
              <select
                id="payment_method"
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                className="rounded-md border-gray-300 focus:border-primary focus:ring focus:ring-primary/20 focus:ring-opacity-50 w-full"
                required
              >
                <option value="e-transfer">Interac e-Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="direct_deposit">Direct Deposit</option>
                <option value="other">Other</option>
              </select>
            </div>

            <Input
              label="Notes (Optional)"
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add any notes about this payment"
              fullWidth
            />
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default PaymentConfirmationModal;
