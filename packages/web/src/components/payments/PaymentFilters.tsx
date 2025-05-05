import React from 'react';

interface PaymentFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
}

const PaymentFilters: React.FC<PaymentFiltersProps> = ({ filter, setFilter }) => {
  return (
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
  );
};

export default PaymentFilters;
