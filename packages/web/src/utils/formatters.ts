// Format currency
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
};

// Format date
export const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  // Use the date string directly without timezone conversion
  // This ensures the date is displayed as stored in the database
  const [year, month, day] = dateString.split('-');
  return `${year}-${month}-${day}`;
};
