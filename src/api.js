// src/lib/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_KEY = import.meta.env.VITE_HANS_API_KEY || 'f6804386f2d04bdf878b46ae34cb5e977dcdacd9e73b4d09a6f9496970cc13a3';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Accept': 'application/json' }
});

// Attach JWT from localStorage when present
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // silent
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response handling (simple 401 flow)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      try { localStorage.removeItem('token'); } catch (e) {}
      // redirect to login page for SPA
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth functions
export const register = async (email, password) => {
  try {
    const res = await api.post('/auth/register', { email, password });
    return res.data;
  } catch (err) {
    console.error('register error', err?.response?.data || err.message);
    throw err;
  }
};

export const login = async (email, password) => {
  try {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  } catch (err) {
    console.error('login error', err?.response?.data || err.message);
    throw err;
  }
};

// Use API key header for info endpoint (safer than query string)
export const getInfo = async (opts = {}) => {
  try {
    const res = await api.get('/api/info', {
      headers: { 'x-api-key': opts.apiKey || API_KEY }
    });
    return res.data;
  } catch (err) {
    console.error('getInfo error', err?.response?.data || err.message);
    throw err;
  }
};

export const getCategories = async () => {
  try {
    const res = await api.get('/api/categories');
    return res.data;
  } catch (err) {
    console.error('getCategories error', err?.response?.data || err.message);
    throw err;
  }
};

// Generic endpoint caller - endpoint should be relative (e.g. '/api/foo')
export const callEndpoint = async (endpoint, options = {}) => {
  try {
    const config = {
      url: endpoint,
      method: options.method || 'GET',
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(options.apiKey ? { 'x-api-key': options.apiKey } : {}),
      },
    };
    const res = await api(config);
    return res.data;
  } catch (err) {
    console.error('callEndpoint error', err?.response?.data || err.message);
    throw err;
  }
};

// Admin functions (paths aligned with server.js)
export const admin = {
  getDashboard: async () => {
    try {
      const res = await api.get('/dashboard-control-9000');
      return res.data;
    } catch (err) {
      console.error('admin.getDashboard error', err?.response?.data || err.message);
      throw err;
    }
  },

  regenerateKey: async (userId) => {
    try {
      const res = await api.post(`/admin/user/${userId}/regenerate-key`);
      return res.data;
    } catch (err) {
      console.error('admin.regenerateKey error', err?.response?.data || err.message);
      throw err;
    }
  },

  // change persistent daily limit (server expects POST /admin/user/:id/limit)
  updateLimit: async (userId, limit) => {
    try {
      const res = await api.post(`/admin/user/${userId}/limit`, { limit });
      return res.data;
    } catch (err) {
      console.error('admin.updateLimit error', err?.response?.data || err.message);
      throw err;
    }
  },

  // add persistent requests (POST /admin/user/:id/add-requests)
  addRequests: async (userId, amount) => {
    try {
      const res = await api.post(`/admin/user/${userId}/add-requests`, { amount });
      return res.data;
    } catch (err) {
      console.error('admin.addRequests error', err?.response?.data || err.message);
      throw err;
    }
  },

  // download logs file -> server route: GET /admin/logs/download
  downloadLogs: async () => {
    try {
      const res = await api.get('/admin/logs/download', { responseType: 'blob' });
      return res.data; // blob of CSV
    } catch (err) {
      console.error('admin.downloadLogs error', err?.response?.data || err.message);
      throw err;
    }
  },

  getUsers: async () => {
    try {
      const res = await api.get('/admin/users');
      return res.data;
    } catch (err) {
      console.error('admin.getUsers error', err?.response?.data || err.message);
      throw err;
    }
  },

  getTotalRequests: async () => {
    try {
      const res = await api.get('/admin/total-requests');
      return res.data;
    } catch (err) {
      console.error('admin.getTotalRequests error', err?.response?.data || err.message);
      throw err;
    }
  },

  // convenience aliases that match server routes
  setUserLimit: async (userId, limit) => admin.updateLimit(userId, limit),
  addUserRequests: async (userId, amount) => admin.addRequests(userId, amount),
  addTodayBoost: async (userId, amount) => {
    try {
      const res = await api.post(`/admin/user/${userId}/add-today`, { amount });
      return res.data;
    } catch (err) {
      console.error('admin.addTodayBoost error', err?.response?.data || err.message);
      throw err;
    }
  }
};

export default api;
