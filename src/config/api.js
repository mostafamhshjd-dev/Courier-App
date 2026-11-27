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

  const params = new URLSearchParams();
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, String(val));
      }
    });
  }
  params.set('_t', String(Date.now()));
  const qs = params.toString();
  if (qs) {
    url += (url.includes('?') ? '&' : '?') + qs;
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
    const rawToken = getAuthToken();
    const cleanToken = rawToken ? rawToken.replace(/^Bearer\s+/i, '').trim() : '';
    if (cleanToken) {
      headers.Authorization = `Bearer ${cleanToken}`;
      headers['X-Auth-Token'] = cleanToken;
    }
  }

  let response;
  try {
    response = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      ...rest,
      headers,
      body: isFormData
        ? body
        : body !== undefined && typeof body !== 'string'
          ? JSON.stringify(body)
          : body,
    });
  } catch (networkErr) {
    const err = new Error(
      networkErr instanceof Error && networkErr.message
        ? networkErr.message
        : 'Network request failed'
    );
    err.status = 0;
    err.rawText = err.message;
    err.url = url;
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

  if (response.status === 401) {
    if (!skipAuth) {
      clearAuthSession();
      if (typeof unauthorizedHandler === 'function') {
        unauthorizedHandler();
      }
    }
    const message =
      (data && (data.message || data.error || data.msg)) || 'UNAUTHORIZED';
    const err = new Error(message);
    err.status = 401;
    err.data = data;
    err.rawText = rawText;
    err.url = url;
    throw err;
  }

  if (!response.ok || (data && data.success === false)) {
    const message =
      (data && (data.message || data.error || data.msg)) ||
      `HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    err.rawText = rawText;
    err.url = url;
    throw err;
  }

  if (data && typeof data === 'object') {
    Object.defineProperty(data, '__httpStatus', {
      value: response.status,
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(data, '__rawText', {
      value: rawText,
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(data, '__url', {
      value: url,
      enumerable: false,
      configurable: true,
    });
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
        mobile: identifier,
        username: identifier,
        email: identifier,
        identifier,
        password,
        app_type: 'courier',
        device_name:
          typeof navigator !== 'undefined' && navigator.userAgent
            ? navigator.userAgent.slice(0, 80)
            : 'WebStack Courier',
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

  confirmPickup: (payload) =>
    apiRequest('/courier/update_status.php', {
      method: 'POST',
      body: {
        action: 'confirm_pickup',
        status: 'picked_up',
        status_id: 5,
        received_via: payload?.received_via || 'manual',
        ...payload,
      },
    }),

  finalizePickup: (payload) =>
    apiRequest('/courier/pickup_receive.php', {
      method: 'POST',
      body: {
        action: 'finalize_pickup',
        cancel_unreceived: Boolean(payload?.cancel_unreceived),
        received_via: payload?.received_via || 'manual',
        ...payload,
      },
    }),

  deliverMerchantReturnBatch: (payload) =>
    apiRequest('/courier/return_batch_deliver.php', {
      method: 'POST',
      body: {
        action: 'deliver_return_batch',
        ...payload,
      },
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
