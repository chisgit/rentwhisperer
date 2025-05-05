import { useState, useEffect } from "react";
import PaymentConfirmationModal from "../components/PaymentConfirmationModal";
import Button from "../components/Button";
import api from "../services/api.service";
import "./Payments.css";

interface Payment {
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

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    // In a real app, we would fetch this data from the API
    // For now, we'll use mock data
    const fetchPayments = async () => {
      try {
        setLoading(true);

        setLoading(true);
        const paymentsData = (await api.payments.getPending()) as Payment[];
        setPayments(paymentsData);
        setFilteredPayments(paymentsData);
      } catch (err) {
        console.log("Error fetching payments:", err);
        setError("Failed to fetch payments. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  // Filter payments when the filter changes
  useEffect(() => {
    if (filter === "all") {
      setFilteredPayments(payments);
    } else {
      setFilteredPayments(payments.filter(payment => payment.status === filter));
    }
  }, [filter, payments]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);
  };
  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    // Use the date string directly without timezone conversion
    // This ensures the date is displayed as stored in the database
    const [year, month, day] = dateString.split('-');
    return `${year}-${month}-${day}`;
  };

  // Handler for opening the payment confirmation modal
  const handleOpenPaymentModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsPaymentModalOpen(true);
  };

  // Handler for confirming a payment
  const handleConfirmPayment = (paymentData: {
    id: string;
    status: string;
    payment_date: string;
    payment_method: string;
    notes?: string;
  }) => {
    console.log("Payment confirmed:", paymentData);
    // In a real app, we would send this data to the API
    // For now, we'll just update the payment in our local state
    setPayments((prevPayments) => {
      return prevPayments.map((payment) => {
        if (payment.id === paymentData.id) {
          return {
            ...payment,
            status: "paid" as "paid",
            payment_date: paymentData.payment_date,
            payment_method: paymentData.payment_method,
          };
        }
        return payment;
      });
    });
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
        <div className="filters">
          <button
            className={`filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === "pending" ? "active" : ""}`}
            onClick={() => setFilter("pending")}
          >
            Pending
          </button>
          <button
            className={`filter-btn ${filter === "paid" ? "active" : ""}`}
            onClick={() => setFilter("paid")}
          >
            Paid
          </button>
          <button
            className={`filter-btn ${filter === "late" ? "active" : ""}`}
            onClick={() => setFilter("late")}
          >
            Late
          </button>
        </div>

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
              {filteredPayments.map((payment) => (
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
                      <button className="btn-icon" title="Mark as Paid">✓</button>
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
      </div>
    </div>
  );
};

export default Payments;
