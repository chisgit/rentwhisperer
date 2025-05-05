import { useState } from "react";
import PaymentConfirmationModal from "../components/PaymentConfirmationModal";
import Button from "../components/Button";
import PaymentsTable from "../components/payments/PaymentsTable";
import PaymentFilters from "../components/payments/PaymentFilters";
import { usePayments } from "../hooks/usePayments";
import { Payment } from "../types/payment.types";
import "./Payments.css";

const Payments = () => {
  const {
    payments,
    filteredPayments,
    loading,
    error,
    handleConfirmPayment,
    setFilter,
    filter
  } = usePayments();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Handler for opening the payment confirmation modal
  const handleOpenPaymentModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsPaymentModalOpen(true);
  };

  if (loading) {
    return <div className="payments-loading">Loading payment data...</div>;
  }

  if (error) {
    return <div className="payments-error">{error}</div>;
  }

  return (
    <div className="payments-page">
      <header className="page-header">
        <h1>Rent Payments</h1>
        <Button>Record Payment</Button>
      </header>

      <div className="payments-container">
        <PaymentFilters
          filter={filter}
          setFilter={setFilter}
        />

        <PaymentsTable
          payments={filteredPayments}
          onMarkAsPaid={handleOpenPaymentModal}
        />
      </div>

      {isPaymentModalOpen && selectedPayment && (
        <PaymentConfirmationModal
          payment={selectedPayment}
          onClose={() => setIsPaymentModalOpen(false)}
          onConfirm={handleConfirmPayment}
        />
      )}
    </div>
  );
};

export default Payments;
