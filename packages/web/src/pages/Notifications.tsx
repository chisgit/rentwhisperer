import { useState, useEffect } from "react";
import "./Notifications.css";

interface Notification {
  id: string;
  tenant_id: string;
  tenant_name: string;
  payment_id: string | null;
  type: "rent_due" | "rent_late" | "receipt" | "form_n4" | "form_l1";
  channel: "whatsapp" | "email";
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  message_id: string | null;
  sent_at: string | null;
}

const NotificationTypeName: Record<string, string> = {
  rent_due: "Rent Due Reminder",
  rent_late: "Late Rent Notice",
  receipt: "Payment Receipt",
  form_n4: "Form N4 Notice",
  form_l1: "Form L1 Application",
};

const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In a real app, we would fetch this data from the API
    // For now, we'll use mock data
    const fetchNotifications = async () => {
      try {
        setLoading(true);

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock data
        const mockNotifications: Notification[] = [
          {
            id: "1",
            tenant_id: "1",
            tenant_name: "John Smith",
            payment_id: "1",
            type: "rent_due",
            channel: "whatsapp",
            status: "delivered",
            message_id: "wamid.abcdef123456",
            sent_at: "2025-04-28T09:00:00Z",
          },
          {
            id: "2",
            tenant_id: "2",
            tenant_name: "Emma Johnson",
            payment_id: "2",
            type: "rent_due",
            channel: "whatsapp",
            status: "sent",
            message_id: "wamid.ghijkl789012",
            sent_at: "2025-04-28T09:05:00Z",
          },
          {
            id: "3",
            tenant_id: "3",
            tenant_name: "Michael Williams",
            payment_id: "3",
            type: "rent_late",
            channel: "whatsapp",
            status: "read",
            message_id: "wamid.mnopqr345678",
            sent_at: "2025-04-20T10:00:00Z",
          },
          {
            id: "4",
            tenant_id: "3",
            tenant_name: "Michael Williams",
            payment_id: "3",
            type: "form_n4",
            channel: "whatsapp",
            status: "delivered",
            message_id: "wamid.stuvwx901234",
            sent_at: "2025-04-27T14:30:00Z",
          },
          {
            id: "5",
            tenant_id: "4",
            tenant_name: "Olivia Brown",
            payment_id: "4",
            type: "receipt",
            channel: "whatsapp",
            status: "delivered",
            message_id: "wamid.yzabcd567890",
            sent_at: "2025-04-06T11:15:00Z",
          },
        ];

        setNotifications(mockNotifications);
        setLoading(false);
      } catch (err) {
        console.log("Error fetching notifications:", err);
        setError("Failed to fetch notifications. Please try again later.");
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  // Format date
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-CA");
  };

  if (loading) {
    return <div className="notifications-loading">Loading notification data...</div>;
  }

  if (error) {
    return <div className="notifications-error">{error}</div>;
  }

  return (
    <div className="notifications-page">
      <header className="page-header">
        <h1>Notifications</h1>
        <button className="btn btn-primary">Send Notification</button>
      </header>

      <div className="notifications-container">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Type</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Sent At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((notification) => (
                <tr key={notification.id}>
                  <td>{notification.tenant_name}</td>
                  <td>{NotificationTypeName[notification.type]}</td>
                  <td>{notification.channel.charAt(0).toUpperCase() + notification.channel.slice(1)}</td>
                  <td>
                    <span className={`status-badge status-notification-${notification.status}`}>
                      {notification.status.charAt(0).toUpperCase() + notification.status.slice(1)}
                    </span>
                  </td>
                  <td>{formatDateTime(notification.sent_at)}</td>
                  <td className="actions-cell">
                    {notification.status === "failed" && (
                      <button className="btn-icon" title="Retry">🔄</button>
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

export default Notifications;
