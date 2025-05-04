/**
 * API Service for the Rent Whisperer application
 * This service handles all API calls to the backend
 */

// In Vite, use import.meta.env instead of process.env
const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api`;

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      // Try to get error message from response
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || `API Error: ${response.status}`);
      } catch (e) {
        // If parsing JSON fails, use status text
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
    }

    // Check if response is empty
    const text = await response.text();
    return text ? JSON.parse(text) as T : {} as T;
  } catch (error) {
    console.log(`API Error for ${endpoint}:`, error);
    throw error;
  }
}

// Tenant interface
export interface Tenant {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  unit_id?: string | null;
  unit_number?: string | null;
  property_name?: string | null;
  property_address?: string | null;
  full_address?: string;
  rent_amount?: number | null;
  rent_due_day?: number | null;
}

// Tenant API functions
export const tenantsApi = {
  getAll: () => fetchApi<Tenant[]>("/tenants"),
  getById: (id: string) => fetchApi<Tenant>(`/tenants/${id}`),
  create: (data: Tenant) => fetchApi<Tenant>("/tenants", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  update: (id: string, data: Tenant) => fetchApi<Tenant>(`/tenants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data)
  }),
  getAllUnits: () => fetchApi<any[]>("/tenants/units") // Add method to get all units
};

// Rent Payments API functions
export const paymentsApi = {
  getPending: () => fetchApi<any[]>("/rent/pending"),
  getByTenantId: (tenantId: string) => fetchApi<any[]>(`/rent/tenant/${tenantId}`),
  getById: (id: string) => fetchApi<any>(`/rent/${id}`),
  create: (data: any) => fetchApi<any>("/rent", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  updateStatus: (id: string, data: any) => fetchApi<any>(`/rent/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  })
};

// Notifications API functions
export const notificationsApi = {
  getAll: () => fetchApi<any[]>("/notifications"),
  getByTenantId: (tenantId: string) => fetchApi<any[]>(`/notifications/tenant/${tenantId}`),
  send: (data: any) => fetchApi<any>("/notifications/send", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  resend: (id: string) => fetchApi<any>(`/notifications/resend/${id}`, {
    method: "POST"
  })
};

// Cron API functions - for triggering automated processes
export const cronApi = {
  triggerRentDue: () => fetchApi<any>("/cron/due-rent"),
  triggerLateRent: () => fetchApi<any>("/cron/late-rent"),
  triggerFormN4: () => fetchApi<any>("/cron/form-n4"),
  triggerFormL1: () => fetchApi<any>("/cron/form-l1")
};

// PDF API functions
export const pdfApi = {
  generateN4: (data: any) => fetchApi("/pdf/generate-n4", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  generateL1: (data: any) => fetchApi("/pdf/generate-l1", {
    method: "POST",
    body: JSON.stringify(data)
  })
};

// Export the default API object with all the API functions
const api = {
  tenants: tenantsApi,
  payments: paymentsApi,
  notifications: notificationsApi,
  cron: cronApi,
  pdf: pdfApi
};

export default api;
