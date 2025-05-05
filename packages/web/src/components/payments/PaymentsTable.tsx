import React from 'react';
import { Payment } from '../../types/payment.types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface PaymentsTableProps {
  payments: Payment[];
  onMarkAsPaid: (payment: Payment) => void;
}

const PaymentsTable: React.FC<PaymentsTableProps> = ({ payments, onMarkAsPaid }) => {
  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Unit</th>
            <th>Amount</th>
            <th>Due Date</th>
            <th>Payment Date</th>
            <th>Status</th>
            <th>Payment Method</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.tenant_name}</td>
              <td>{payment.unit_number}</td>
              <td>{formatCurrency(payment.amount)}</td>
              <td>{formatDate(payment.due_date)}</td>
              <td>{formatDate(payment.payment_date)}</td>
              <td>
                <span className={`status-badge status-${payment.status}`}>
                  {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                </span>
              </td>
              <td>{payment.payment_method || "—"}</td>
              <td className="actions-cell">
                {payment.status !== "paid" && (
                  <button
                    className="btn-icon"
                    title="Mark as Paid"
                    onClick={() => onMarkAsPaid(payment)}
                  >
                    ✓
                  </button>
                )}
                {payment.interac_request_link && (
                  <button className="btn-icon" title="Copy Interac Link">🔗</button>
                )}
                <button className="btn-icon" title="View Details">👁️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PaymentsTable;
