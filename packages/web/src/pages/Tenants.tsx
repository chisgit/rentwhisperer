import { useState, useEffect } from "react";
import TenantForm from "../components/TenantForm";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { tenantsApi } from "../services/api.service";
import "./Tenants.css";
import Tenant from "../types/tenant";

const Tenants = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [apiLoading, setApiLoading] = useState<boolean>(false);  // Fetch tenants from the backend API
  const fetchTenants = async () => {
    setLoading(true);
    try {
      console.log("[Tenants] Fetching fresh tenant data from server...");
      // The API service adds its own cache-busting parameter
      const data = await tenantsApi.getAll() as Tenant[];
      // Explicitly convert rent_amount and rent_due_day to numbers
      const transformedData = data.map(tenant => ({
        ...tenant,
        rent_amount: tenant.rent_amount ? parseFloat(tenant.rent_amount as any) : undefined,
        rent_due_day: tenant.rent_due_day ? parseInt(tenant.rent_due_day as any, 10) : undefined,
      }));
      setTenants(transformedData);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching tenants:", err);
      setError(err.message || "Failed to fetch tenants. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  // Open edit modal for a tenant
  const handleEditTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setIsModalOpen(true);
  };

  // Close the edit modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTenant(null);
  };  // Save tenant (create or update)
  const handleSaveTenant = async (formData: Tenant) => {
    setApiLoading(true);
    try {
      if (formData.id) {
        console.log("[Tenants] Updating tenant with ID:", formData.id);
        console.log("[Tenants] Update payload:", JSON.stringify(formData, null, 2));

        // Ensure rent fields are properly formatted
        const validatedFormData = {
          ...formData,
          rent_amount: formData.rent_amount !== undefined ? Number(formData.rent_amount) : undefined,
          rent_due_day: formData.rent_due_day !== undefined ? Number(formData.rent_due_day) : undefined,
          unit_id: formData.unit_id || null // Ensure null if empty string
        };

        // Update existing tenant
        const updatedTenant = await tenantsApi.update(formData.id.toString(), validatedFormData) as Tenant;
        console.log("[Tenants] Tenant updated successfully:", updatedTenant);
      } else {
        console.log("[Tenants] Creating tenant with data:", JSON.stringify(formData, null, 2));

        // Ensure rent fields are properly formatted
        const validatedFormData = {
          ...formData,
          rent_amount: formData.rent_amount !== undefined ? Number(formData.rent_amount) : undefined,
          rent_due_day: formData.rent_due_day !== undefined ? Number(formData.rent_due_day) : undefined,
          unit_id: formData.unit_id || null // Ensure null if empty string
        };

        // Create new tenant
        const newTenant = await tenantsApi.create(validatedFormData) as Tenant;
        console.log("[Tenants] Tenant created successfully:", newTenant);
      }      // Always refetch data from the server after any tenant operation
      console.log("[Tenants] Refreshing tenant data from server...");

      // Use a sequence of refresh attempts to ensure we get the updated data
      const performRefresh = async (attempt = 1) => {
        try {
          console.log(`[Tenants] Executing data refresh attempt ${attempt}...`);
          await fetchTenants();
          console.log(`[Tenants] Data refresh attempt ${attempt} completed`);

          // Close the modal only after the data refresh succeeds
          handleCloseModal();
        } catch (refreshErr) {
          console.error(`[Tenants] Error during data refresh attempt ${attempt}:`, refreshErr);
          if (attempt < 3) {
            // Try again after a delay
            console.log(`[Tenants] Will retry refresh in ${attempt * 1000}ms...`);
            setTimeout(() => performRefresh(attempt + 1), attempt * 1000);
          } else {
            handleCloseModal(); // Close modal even if refresh fails after all attempts
          }
        }
      };

      // First attempt after a delay
      setTimeout(() => performRefresh(), 1500);
    } catch (err: any) {
      console.error("Error saving tenant:", err);
      setError(err.message || "Failed to save tenant. Please try again.");
    } finally {
      setApiLoading(false);
    }
  };

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
    <div className="tenants-page">      <header className="page-header">
      <h1>Tenants</h1>
      <div className="button-group">
        <Button
          onClick={() => {
            setSelectedTenant(null); // Clear any selected tenant
            setIsModalOpen(true); // Open modal for adding new tenant
          }}
        >
          Add Tenant
        </Button>
        <Button
          onClick={async () => {
            console.log("[Tenants] Manual refresh requested");
            await fetchTenants();
            console.log("[Tenants] Manual refresh completed");
          }}
        >
          Refresh Data
        </Button>
      </div>
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
                  <td>{typeof tenant.rent_amount === 'number' ? formatCurrency(tenant.rent_amount) : "-"}</td>
                  <td>{tenant.rent_due_day ? `${tenant.rent_due_day}${getDayOrdinal(tenant.rent_due_day)}` : "-"}</td>
                  <td className="actions-cell">
                    <button
                      className="btn-icon"
                      title="Edit"
                      onClick={() => handleEditTenant(tenant)}
                    >✏️</button>
                    <button className="btn-icon" title="Send Notification">🔔</button>
                    <button className="btn-icon" title="View Payment History">💰</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tenants.length === 0 && !loading && (
          <div className="no-tenants">
            No tenants have been added yet. Click "Add Tenant" to get started.
          </div>
        )}
      </div>

      {/* Edit/Add Tenant Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={selectedTenant ? "Edit Tenant" : "Add New Tenant"}
          size="lg"
        >
          <TenantForm
            tenant={selectedTenant || undefined}
            onSave={handleSaveTenant}
            onCancel={handleCloseModal}
            loading={apiLoading}
          />
        </Modal>
      )}
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
