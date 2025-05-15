/**
 * API Service for the Rent Whisperer application
 * This service handles all API calls to the backend
 */

// With Vite's proxy setup, we can use relative URLs for API calls
// The proxy in vite.config.ts will forward requests to the backend
const API_URL = '/api';

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
    headers,
    credentials: 'include' as RequestCredentials, // Include cookies in the request
    mode: 'cors' as RequestMode          // Enable CORS
  };

  try {
    console.log(`API Request to ${url}`, config);
    const response = await fetch(url, config);
    console.log(`API Response from ${url}`, { status: response.status, statusText: response.statusText });

    if (!response.ok) {
      // Try to get error message from response
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || `API Error: ${response.status}`);
      } catch (e) {
        // If parsing JSON fails, use status text
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
    }    // Check if response is empty
    const text = await response.text();
    const data = text ? JSON.parse(text) as T : {} as T;

    // Debug log successful responses
    console.log(`API Response for ${endpoint}:`, data);

    return data;
  } catch (error) {
    console.log(`API Error for ${endpoint}:`, error);
    throw error;
  }
}

// Tenant interface
export interface Tenant {
  id?: number | string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  // These fields are derived from relationships and not stored directly in the tenant table
  unit_id?: number | string | null | undefined; // From tenant_units junction table
  unit_number?: string | null; // From units table through tenant_units
  property_name?: string | null; // From properties table through tenant_units -> units
  property_address?: string | null; // From properties table through tenant_units -> units
  property_city?: string | null; // From properties table through tenant_units -> units
  property_province?: string | null; // From properties table through tenant_units -> units
  property_postal_code?: string | null; // From properties table through tenant_units -> units
  rent_amount?: number | null; // From tenant_units junction table
  rent_due_day?: number | null; // From tenant_units junction table
}

// Tenant API functions
export const tenantsApi = {
  getAll: () => {
    // Add a cache-busting query parameter
    const timestamp = new Date().getTime();
    return fetchApi<Tenant[]>(`/tenants?_t=${timestamp}`);
  },
  getById: (id: string) => {
    // Add a cache-busting query parameter
    const timestamp = new Date().getTime();
    return fetchApi<Tenant>(`/tenants/${id}?_t=${timestamp}`);
  },
  create: (data: Tenant) => {
    // Ensure numeric fields are proper numbers before sending to the API
    const normalizedData = {
      ...data,
      rent_amount: data.rent_amount !== undefined ? Number(data.rent_amount) : null,
      rent_due_day: data.rent_due_day !== undefined ? Number(data.rent_due_day) : null
    };

    console.log(`API Request to create tenant:`, normalizedData);

    return fetchApi<Tenant>("/tenants", {
      method: "POST",
      body: JSON.stringify(normalizedData)
    });
  },
  update: (id: string, data: Tenant) => {
    console.log(`API Request to update tenant ${id}:`, data);

    // Ensure numeric fields are proper numbers before sending to the API
    const normalizedData = {
      ...data,
      rent_amount: data.rent_amount !== undefined ? Number(data.rent_amount) : null,
      rent_due_day: data.rent_due_day !== undefined ? Number(data.rent_due_day) : null
    };

    console.log(`API Request normalized data:`, normalizedData);
    console.log(`API Request raw JSON:`, JSON.stringify(normalizedData));

    return fetchApi<Tenant>(`/tenants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(normalizedData)
    });
  },
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

// AI Tools API functions
export const aiToolsApi = {
  // Vector tool functions
  getModules: () => fetchApi<any[]>("/ai-tools/vector/modules"),
  getEntities: () => fetchApi<any[]>("/ai-tools/vector/entities"),
  getModule: (name: string) => fetchApi<any>(`/ai-tools/vector/module/${encodeURIComponent(name)}`),
  getEntity: (name: string) => fetchApi<any>(`/ai-tools/vector/entity/${encodeURIComponent(name)}`),
  getFunction: (name: string) => fetchApi<any>(`/ai-tools/vector/function/${encodeURIComponent(name)}`),

  // Analyze tool functions
  analyze: (codePath: string, proposedChange: string) => fetchApi<any>("/ai-tools/analyze", {
    method: "POST",
    body: JSON.stringify({ codePath, proposedChange })
  }),

  // Validation functions
  validate: (component: string, change: string) => fetchApi<any>("/ai-tools/validate", {
    method: "POST",
    body: JSON.stringify({ component, change })
  }),

  // Orchestration functions
  orchestrate: (codePath: string, proposedChange: string) => fetchApi<any>("/ai-tools/orchestrate", {
    method: "POST",
    body: JSON.stringify({ codePath, proposedChange })
  })
};

// Export the default API object with all the API functions
const api = {
  tenants: tenantsApi,
  payments: paymentsApi,
  notifications: notificationsApi,
  cron: cronApi,
  pdf: pdfApi,
  aiTools: aiToolsApi
};

export default api;
