import { useState, useEffect } from 'react';
import api from '../services/api.service';
import { Payment, PaymentConfirmationData } from '../types/payment.types';

export const usePayments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
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

  // Handler for confirming a payment
  const handleConfirmPayment = (paymentData: PaymentConfirmationData) => {
    console.log("Payment confirmed:", paymentData);
    // In a real app, we would send this data to the API
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

  return {
    payments,
    filteredPayments,
    loading,
    error,
    filter,
    setFilter,
    handleConfirmPayment
  };
};
