import { useState, useEffect } from "react";
import "./Tenants.css";

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  unit_id: string;
  unit_number?: string;
  property_name?: string;
  rent_amount?: number;
  rent_due_day?: number;
}

const Tenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In a real app, we would fetch this data from the API
    // For now, we'll use mock data
    const fetchTenants = async () => {
      try {
        setLoading(true);

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock data
        setTenants([
          {
            id: "1",
            first_name: "John",
            last_name: "Smith",
            email: "john.smith@example.com",
            phone: "+14165551234",
            unit_id: "101",
            unit_number: "101",
            property_name: "Sunrise Apartments",
            rent_amount: 1500,
            rent_due_day: 1,
          },
          {
            id: "2",
            first_name: "Emma",
            last_name: "Johnson",
            email: "emma.johnson@example.com",
            phone: "+14165555678",
            unit_id: "102",
            unit_number: "202",
            property_name: "Sunrise Apartments",
            rent_amount: 1700,
            rent_due_day: 1,
          },
          {
            id: "3",
            first_name: "Michael",
            last_name: "Williams",
            email: "michael.williams@example.com",
            phone: "+14165559012",
            unit_id: "103",
            unit_number: "303",
            property_name: "Oakwood Residences",
            rent_amount: 2000,
            rent_due_day: 3,
          },
          {
            id: "4",
            first_name: "Olivia",
            last_name: "Brown",
            email: "olivia.brown@example.com",
            phone: "+14165553456",
            unit_id: "104",
            unit_number: "404",
            property_name: "Oakwood Residences",
            rent_amount: 1850,
            rent_due_day: 5,
          },
        ]);

        setLoading(false);
      } catch (err) {
        console.log("Error fetching tenants:", err);
        setError("Failed to fetch tenants. Please try again later.");
        setLoading(false);
      }
    };

    fetchTenants();
  }, []);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);
  };

  if (loading) {
    return <div className="tenants-loading">Loading tenant data...</div>;
  }

  if (error) {
    return <div className="tenants-error">{error}</div>;
  }

  return (
    <div className="tenants-page">
      <header className="page-header">
        <h1>Tenants</h1>
        <button className="btn btn-primary">Add Tenant</button>
      </header>

      <div className="tenants-container">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Unit</th>
                <th>Property</th>
                <th>Rent Amount</th>
                <th>Due Day</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>{tenant.first_name} {tenant.last_name}</td>
                  <td>{tenant.email}</td>
                  <td>{tenant.phone}</td>
                  <td>{tenant.unit_number}</td>
                  <td>{tenant.property_name}</td>
                  <td>{tenant.rent_amount ? formatCurrency(tenant.rent_amount) : "-"}</td>
                  <td>{tenant.rent_due_day ? `${tenant.rent_due_day}${getDayOrdinal(tenant.rent_due_day)}` : "-"}</td>
                  <td className="actions-cell">
                    <button className="btn-icon" title="Edit">✏️</button>
                    <button className="btn-icon" title="Send Notification">🔔</button>
                    <button className="btn-icon" title="View Payment History">💰</button>
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

// Utility function to get ordinal suffix for day numbers
function getDayOrdinal(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

export default Tenants;
