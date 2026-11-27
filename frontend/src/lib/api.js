export const API_BASE = 'http://localhost:5080/api';

function getToken() {
  return localStorage.getItem('nutrilens_token');
}

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }

  return data;
}

export const PRODUCTS_API = {
  categories: () => apiRequest('/products/categories'),
  list: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') {
        qs.set(k, String(v));
      }
    });
    const str = qs.toString();
    return apiRequest(`/products${str ? `?${str}` : ''}`);
  },
  get: (id) => apiRequest(`/products/${id}`),
  getExternal: (source, externalId) =>
    apiRequest(`/products/external/${encodeURIComponent(source)}/${encodeURIComponent(externalId)}`),
  compare: (ids) => apiRequest(`/products/compare?ids=${ids.join(',')}`),
  searchExternal: ({ q = '', category = 'all', source = 'all', page = 1, pageSize = 12 } = {}) => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (category && category !== 'all') qs.set('category', category);
    if (source) qs.set('source', source);
    qs.set('page', String(page));
    qs.set('pageSize', String(pageSize));
    return apiRequest(`/products/search-external?${qs.toString()}`);
  },
  importExternal: (source, externalId) =>
    apiRequest(`/products/import-external/${encodeURIComponent(source)}/${encodeURIComponent(externalId)}`, {
      method: 'POST',
    }),
  searchOff: (q) => apiRequest(`/products/search-off?q=${encodeURIComponent(q)}`),
  importOff: (barcode) => apiRequest(`/products/import-off/${encodeURIComponent(barcode)}`, { method: 'POST' }),
};

export const SCANS_API = {
  analyzeImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/scans/analyze-image', { method: 'POST', body: formData });
  },
  evaluate: (payload) =>
    apiRequest('/scans/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  decodeIngredients: (ingredientsText, allergens) =>
    apiRequest('/scans/decode-ingredients', {
      method: 'POST',
      body: JSON.stringify({ ingredientsText, allergens }),
    }),
  history: () => apiRequest('/scans/history'),
  get: (id) => apiRequest(`/scans/${id}`),
  remove: (id) => apiRequest(`/scans/${id}`, { method: 'DELETE' }),
};

export const AUTH_API = {
  register: (payload) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => apiRequest('/auth/me'),
  updatePreferences: (payload) =>
    apiRequest('/auth/preferences', { method: 'PUT', body: JSON.stringify(payload) }),
};

export const USER_API = {
  dashboard: () => apiRequest('/user/dashboard'),
  saveProduct: (payload) => apiRequest('/user/saved-products', { method: 'POST', body: JSON.stringify(payload) }),
  removeSaved: (id) => apiRequest(`/user/saved-products/${id}`, { method: 'DELETE' }),
};

export const PACKAGED_CATEGORIES = [
  'Packaged Snacks',
  'Biscuits & Cookies',
  'Chocolates & Confectionery',
  'Beverages & Juices',
  'Instant Foods & Noodles',
  'Cereals & Breakfast',
  'Dairy Products',
  'Packaged Indian Foods',
  'Protein Bars & Nutrition',
  'Other Packaged Foods',
];
