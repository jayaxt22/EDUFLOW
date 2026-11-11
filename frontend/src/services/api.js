/**
 * Central API Client for EduFlow ERP.
 * Non-negotiable rules:
 * 1. All HTTP requests must go through src/services/*.
 * 2. credentials: 'include' for HttpOnly cookies.
 * 3. Automatically append X-Tenant-Slug header to all requests.
 * 4. Explicitly prepends API_BASE_URL (http://localhost:8000) to all requests.
 * 5. Zero tokens stored in localStorage.
 */

export const getApiBaseUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    // Local development: direct to Django port 8000
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:8000`;
    }
  }
  return 'https://eduflow-delta-tawny.vercel.app';
};

let currentTenantSlug = 'demo';

export const setTenantSlug = (slug) => {
  currentTenantSlug = slug || 'demo';
};

export const getTenantSlug = () => {
  return currentTenantSlug;
};

// In-memory token storage (held in RAM only, strictly zero localStorage)
let inMemoryAccessToken = null;
let inMemoryRefreshToken = null;

export const setAuthTokens = ({ accessToken, refreshToken } = {}) => {
  if (accessToken !== undefined) inMemoryAccessToken = accessToken;
  if (refreshToken !== undefined) inMemoryRefreshToken = refreshToken;
};

export const clearAuthTokens = () => {
  inMemoryAccessToken = null;
  inMemoryRefreshToken = null;
};

// In-flight refresh promise mutex to prevent concurrent refresh storms
let refreshPromise = null;

async function refreshSessionToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const refreshHeaders = {
          'Content-Type': 'application/json',
          'X-Tenant-Slug': currentTenantSlug,
        };
        const body = inMemoryRefreshToken ? JSON.stringify({ refresh: inMemoryRefreshToken }) : undefined;
        const res = await fetch(`${baseUrl}/api/v1/auth/refresh/`, {
          method: 'POST',
          credentials: 'include',
          headers: refreshHeaders,
          body,
        });
        if (!res.ok) {
          throw new Error('Session expired');
        }
        const refreshedToken = res.headers.get('x-access-token');
        if (refreshedToken) {
          setAuthTokens({ accessToken: refreshedToken });
        }
        return true;
      } catch (err) {
        clearAuthTokens();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('eduflow:session_expired'));
        }
        throw err;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function request(endpoint, options = {}, isRetry = false) {
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!path.startsWith('/api/v1')) {
    path = `/api/v1${path}`;
  }

  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${path}`;

  const isFormData = options.body instanceof FormData;

  const defaultHeaders = {
    'X-Tenant-Slug': currentTenantSlug,
  };

  if (inMemoryAccessToken) {
    defaultHeaders['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    credentials: 'include', // Guarantees HttpOnly cookies are attached
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  if (isFormData) {
    // Explicitly delete Content-Type so browser generates multipart boundary automatically
    delete config.headers['Content-Type'];
  } else if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);

  // Capture in-memory tokens from response headers if present (pure RAM, zero localStorage)
  const newAccessToken = response.headers.get('x-access-token');
  const newRefreshToken = response.headers.get('x-refresh-token');
  if (newAccessToken) {
    setAuthTokens({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken || undefined,
    });
  }

  // Automatic token refresh on 401 if refresh cookie exists
  if (
    response.status === 401 &&
    !isRetry &&
    !path.includes('/auth/login') &&
    !path.includes('/auth/refresh')
  ) {
    try {
      await refreshSessionToken();
      // Retry original request once with newly minted access token cookie
      return await request(endpoint, options, true);
    } catch {
      // Refresh failed, proceed to normal 401 error rejection
    }
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return { success: true };
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    let errorMsg = data?.error?.message;
    if (data?.error?.details && typeof data.error.details === 'object') {
      const detailsList = [];
      for (const [k, v] of Object.entries(data.error.details)) {
        if (Array.isArray(v)) {
          detailsList.push(`${k}: ${v.join(', ')}`);
        } else if (typeof v === 'string') {
          detailsList.push(`${k}: ${v}`);
        }
      }
      if (detailsList.length > 0 && (!errorMsg || errorMsg === 'Validation or processing error')) {
        errorMsg = detailsList.join('; ');
      }
    }
    errorMsg = errorMsg || data?.detail || `Request failed with status ${response.status}`;
    if (response.status === 401 && (errorMsg === 'Authentication credentials were not provided.' || !errorMsg)) {
      errorMsg = 'Your session has expired. Please log in again to continue.';
    }
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options = {}) => request(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
};
