import { useState, useEffect } from "react";
import "./Dashboard.css";

// Define types for our data
interface DashboardStats {
  totalTenants: number;
  pendingPayments: number;
  totalNotifications: number;
  notificationsSent: number;
}

interface RentDue {
  id: string;
  tenantName: string;
  amount: number;
  dueDate: string;
  status: string;
  unitAddress: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalTenants: 0,
    pendingPayments: 0,
    totalNotifications: 0,
    notificationsSent: 0,
  });
  
  const [rentDue, setRentDue] = useState<RentDue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In a real app, we would fetch this data from the API
    // For now, we'll use mock data
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock data
        setStats({
          totalTenants: 12,
          pendingPayments: 3,
          totalNotifications: 45,
          notificationsSent: 42,
        });
        
        setRentDue([
          {
            id: "1",
            tenantName: "John Smith",
            amount: 1500,
            dueDate: "2025-05-01",
            status: "due",
            unitAddress: "123 Main St, Apt 101",
          },
          {
            id: "2",
            tenantName: "Emma Johnson",
            amount: 1700,
            dueDate: "2025-05-01",
            status: "due",
            unitAddress: "456 Elm St, Apt 202",
          },
          {
            id: "3",
            tenantName: "Michael Williams",
            amount: 2000,
            dueDate: "2025-05-03",
            status: "due",
            unitAddress: "789 Oak St, Suite 303",
          },
        ]);
        
        setLoading(false);
      } catch (err) {
        console.log("Error fetching dashboard data:", err);
        setError("Failed to fetch dashboard data. Please try again later.");
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="dashboard-error">{error}</div>;
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);
  };

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Dashboard</h1>
      
      <div className="stats-cards">
        <div className="stats-card">
          <h3>Total Tenants</h3>
          <p className="stats-value">{stats.totalTenants}</p>
        </div>
        
        <div className="stats-card">
          <h3>Pending Payments</h3>
          <p className="stats-value">{stats.pendingPayments}</p>
        </div>
        
        <div className="stats-card">
          <h3>Notifications</h3>
          <p className="stats-value">{stats.notificationsSent} / {stats.totalNotifications}</p>
        </div>
      </div>
      
      <div className="dashboard-section">
        <h2>Upcoming Rent Payments</h2>
        
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Unit</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rentDue.map((rent) => (
                <tr key={rent.id}>
                  <td>{rent.tenantName}</td>
                  <td>{rent.unitAddress}</td>
                  <td>{new Date(rent.dueDate).toLocaleDateString()}</td>
                  <td>{formatCurrency(rent.amount)}</td>
                  <td>
                    <span className={`status-badge status-${rent.status}`}>
                      {rent.status.charAt(0).toUpperCase() + rent.status.slice(1)}
                    </span>
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

export default Dashboard;
