/**
 * API Service for the Rent Whisperer application
 * This service handles all API calls to the backend
 */

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000/api";

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
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.log(`API Error for ${endpoint}:`, error);
    throw error;
  }
}

// Tenant API functions
export const tenantsApi = {
  getAll: () => fetchApi("/tenants"),
  getById: (id: string) => fetchApi(`/tenants/${id}`),
  create: (data: any) => fetchApi("/tenants", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  update: (id: string, data: any) => fetchApi(`/tenants/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  })
};

// Rent Payments API functions
export const paymentsApi = {
  getPending: () => fetchApi("/rent/pending"),
  getByTenantId: (tenantId: string) => fetchApi(`/rent/tenant/${tenantId}`),
  getById: (id: string) => fetchApi(`/rent/${id}`),
  create: (data: any) => fetchApi("/rent", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  updateStatus: (id: string, data: any) => fetchApi(`/rent/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  })
};

// Notifications API functions
export const notificationsApi = {
  getAll: () => fetchApi("/notifications"),
  getByTenantId: (tenantId: string) => fetchApi(`/notifications/tenant/${tenantId}`),
  send: (data: any) => fetchApi("/notifications/send", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  resend: (id: string) => fetchApi(`/notifications/resend/${id}`, {
    method: "POST"
  })
};

// Cron API functions - for triggering automated processes
export const cronApi = {
  triggerRentDue: () => fetchApi("/cron/due-rent"),
  triggerLateRent: () => fetchApi("/cron/late-rent"),
  triggerFormN4: () => fetchApi("/cron/form-n4"),
  triggerFormL1: () => fetchApi("/cron/form-l1")
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
