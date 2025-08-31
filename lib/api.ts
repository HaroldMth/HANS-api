import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api-api-hans.onrender.com';
const API_KEY = process.env.NEXT_PUBLIC_HANS_API_KEY || 'f6804386f2d04bdf878b46ae34cb5e977dcdacd9e73b4d09a6f9496970cc13a3';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Accept': 'application/json' }
});

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      try { localStorage.removeItem('token'); } catch (e) {}
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const register = async (email: string, password: string) => {
  try {
    const res = await api.post('/auth/register', { email, password });
    return res.data;
  } catch (err: any) {
    console.error('register error', err?.response?.data || err.message);
    throw err;
  }
};

export const login = async (email: string, password: string) => {
  try {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  } catch (err: any) {
    console.error('login error', err?.response?.data || err.message);
    throw err;
  }
};

export const getInfo = async (opts: { apiKey?: string } = {}) => {
  try {
    const res = await api.get('/api/info', {
      headers: { 'x-api-key': opts.apiKey || API_KEY }
    });
    return res.data;
  } catch (err: any) {
    console.error('getInfo error', err?.response?.data || err.message);
    throw err;
  }
};

export const getCategories = async () => {
  try {
    const res = await api.get('/api/categories');
    return res.data;
  } catch (err: any) {
    console.error('getCategories error', err?.response?.data || err.message);
    throw err;
  }
};

export const callEndpoint = async (endpoint: string, options: any = {}) => {
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
  } catch (err: any) {
    console.error('callEndpoint error', err?.response?.data || err.message);
    throw err;
  }
};

export const admin = {
  getDashboard: async () => {
    try {
      const res = await api.get('/dashboard-control-9000');
      return res.data;
    } catch (err: any) {
      console.error('admin.getDashboard error', err?.response?.data || err.message);
      throw err;
    }
  },

  regenerateKey: async (userId: string) => {
    try {
      const res = await api.post(`/admin/user/${userId}/regenerate-key`);
      return res.data;
    } catch (err: any) {
      console.error('admin.regenerateKey error', err?.response?.data || err.message);
      throw err;
    }
  },

  updateLimit: async (userId: string, limit: number) => {
    try {
      const res = await api.post(`/admin/user/${userId}/limit`, { limit });
      return res.data;
    } catch (err: any) {
      console.error('admin.updateLimit error', err?.response?.data || err.message);
      throw err;
    }
  },

  addRequests: async (userId: string, amount: number) => {
    try {
      const res = await api.post(`/admin/user/${userId}/add-requests`, { amount });
      return res.data;
    } catch (err: any) {
      console.error('admin.addRequests error', err?.response?.data || err.message);
      throw err;
    }
  },

  downloadLogs: async () => {
    try {
      const res = await api.get('/admin/logs/download', { responseType: 'blob' });
      return res.data;
    } catch (err: any) {
      console.error('admin.downloadLogs error', err?.response?.data || err.message);
      throw err;
    }
  },

  getUsers: async () => {
    try {
      const res = await api.get('/admin/users');
      return res.data;
    } catch (err: any) {
      console.error('admin.getUsers error', err?.response?.data || err.message);
      throw err;
    }
  },

  getTotalRequests: async () => {
    try {
      const res = await api.get('/admin/total-requests');
      return res.data;
    } catch (err: any) {
      console.error('admin.getTotalRequests error', err?.response?.data || err.message);
      throw err;
    }
  },

  setUserLimit: async (userId: string, limit: number) => admin.updateLimit(userId, limit),
  addUserRequests: async (userId: string, amount: number) => admin.addRequests(userId, amount),
  addTodayBoost: async (userId: string, amount: number) => {
    try {
      const res = await api.post(`/admin/user/${userId}/add-today`, { amount });
      return res.data;
    } catch (err: any) {
      console.error('admin.addTodayBoost error', err?.response?.data || err.message);
      throw err;
    }
  }
};

export default api;