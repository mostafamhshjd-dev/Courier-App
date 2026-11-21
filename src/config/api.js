// WebStack Courier API Configuration & Authenticated Request Helper

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || '/api/v1'
).replace(/\/+$/, '');

export const STORAGE_KEYS = {
  TOKEN: 'webstack_courier_token',
  COURIER: 'webstack_courier_user',
  DEMO_MODE: 'webstack_courier_demo',
  THEME: 'webstack_courier_theme',
  LANG: 'webstack_courier_lang',
  SHIFT_ACTIVE: 'webstack_courier_shift',
  SOUND_ENABLED: 'webstack_courier_sound',
};

let unauthorizedHandler = null;

/**
 * Register a global handler invoked whenever the API responds with HTTP 401.
 */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function getAuthToken() {
  try {
    return localStorage.getItem(STORAGE_KEYS.TOKEN) || '';
  } catch {
    return '';
  }
}

export function getStoredCourier() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COURIER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(token, courier, isDemo = false) {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    }
    if (courier) {
      localStorage.setItem(STORAGE_KEYS.COURIER, JSON.stringify(courier));
    }
    localStorage.setItem(STORAGE_KEYS.DEMO_MODE, isDemo ? 'true' : 'false');
  } catch {
    // Ignore storage quota errors in private contexts
  }
}

export function isDemoSession() {
  try {
    return localStorage.getItem(STORAGE_KEYS.DEMO_MODE) === 'true';
  } catch {
    return false;
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.COURIER);
    localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
  } catch {
    // Ignore
  }
}

/**
 * Authenticated HTTP helper for WebStack Courier API.
 * Automatically injects Authorization: Bearer <token> and handles HTTP 401
 * by clearing the local session and redirecting to the login screen.
 *
 * @param {string} endpoint - Endpoint path, e.g. '/courier/tasks.php'
 * @param {RequestInit & { skipAuth?: boolean, query?: Record<string, string | number | undefined> }} [options]
 */
export async function apiRequest(endpoint, options = {}) {
  const { skipAuth = false, query, headers: customHeaders = {}, body, ...rest } = options;

  let url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (query && typeof query === 'object') {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, String(val));
      }
    });
    const qs = params.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  const headers = {
    Accept: 'application/json',
    ...customHeaders,
  };

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    credentials: 'same-origin',
    ...rest,
    headers,
    body: isFormData
      ? body
      : body !== undefined && typeof body !== 'string'
        ? JSON.stringify(body)
        : body,
  });

  if (response.status === 401) {
    clearAuthSession();
    if (typeof unauthorizedHandler === 'function') {
      unauthorizedHandler();
    }
    const err = new Error('UNAUTHORIZED');
    err.status = 401;
    throw err;
  }

  const rawText = await response.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }
  }

  if (!response.ok) {
    const message =
      (data && (data.message || data.error || data.msg)) ||
      `HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const webstackApi = {
  login: (identifier, password) =>
    apiRequest('/auth/login.php', {
      method: 'POST',
      skipAuth: true,
      body: {
        phone: identifier,
        username: identifier,
        identifier,
        password,
        app_type: 'courier',
      },
    }),

  logout: () =>
    apiRequest('/auth/logout.php', {
      method: 'POST',
      body: { app_type: 'courier' },
    }),

  getTasks: (params) =>
    apiRequest('/courier/tasks.php', {
      method: 'GET',
      query: params,
    }),

  getShipmentDetails: (shipmentId, trackingNumber) =>
    apiRequest('/courier/shipment_details.php', {
      method: 'GET',
      query: {
        id: shipmentId,
        shipment_id: shipmentId,
        tracking_number: trackingNumber,
      },
    }),

  updateShipmentStatus: (payload) =>
    apiRequest('/courier/update_status.php', {
      method: 'POST',
      body: payload,
    }),

  getCustody: () =>
    apiRequest('/courier/custody.php', {
      method: 'GET',
    }),

  sendLocation: (coords) =>
    apiRequest('/courier/location.php', {
      method: 'POST',
      body: coords,
    }),
};
