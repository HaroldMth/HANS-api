// AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as apiLogin, register as apiRegister } from '../api.js';

const AuthContext = createContext();
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

const TOKEN_KEY = 'token';

// safe helpers
const hasWindow = () => typeof window !== 'undefined' && !!window;
const safeGetItem = (key) => {
  if (!hasWindow()) return null;
  try { return window.localStorage.getItem(key); } catch (e) { console.warn('localStorage.getItem failed', e); return null; }
};
const safeSetItem = (key, value) => {
  if (!hasWindow()) return false;
  try { if (typeof value === 'string') { window.localStorage.setItem(key, value); return true; } return false; } catch (e) { console.warn('localStorage.setItem failed', e); return false; }
};
const safeRemoveItem = (key) => {
  if (!hasWindow()) return false;
  try { window.localStorage.removeItem(key); return true; } catch (e) { console.warn('localStorage.removeItem failed', e); return false; }
};

// safe atob (browser or Node fallback)
const safeAtob = (input) => {
  if (!input || typeof input !== 'string') return null;
  try {
    if (hasWindow() && typeof window.atob === 'function') return window.atob(input);
    // Node / other env fallback
    if (typeof Buffer !== 'undefined') return Buffer.from(input, 'base64').toString('binary');
  } catch (e) {
    return null;
  }
  return null;
};

/**
 * tryDecode(token)
 * - If token is a JWT, decode its payload and return parsed JSON
 * - If token is a JSON string, parse and return it
 * - Otherwise return null
 */
const tryDecode = (token) => {
  if (!token || typeof token !== 'string') return null;

  // Try JWT parsing
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4) payload += '=';
      const decodedRaw = safeAtob(payload);
      if (decodedRaw) {
        try { return JSON.parse(decodedRaw); } catch (jsonErr) {
          // maybe percent-encoded UTF-8 fallback
          try {
            // eslint-disable-next-line no-undef
            const decodedUtf8 = decodeURIComponent(escape(decodedRaw));
            return JSON.parse(decodedUtf8);
          } catch (_) {
            return null;
          }
        }
      }
    }
  } catch (e) {
    // ignore and try JSON parse below
  }

  // Try parsing token as JSON string
  try {
    const trimmed = token.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }
  } catch (e) {
    // not JSON
  }

  return null;
};

/**
 * extractToken(resp)
 * Accept many shapes:
 * - raw string token
 * - { token, accessToken, access_token }
 * - axios-like { data: { token } }
 * - nested auth or data objects
 */
const extractToken = (resp) => {
  if (!resp) return undefined;
  if (typeof resp === 'string') return resp;

  // If axios-like response (full object), allow resp.data maybe being a string too
  const data = resp.data ?? resp;

  return (
    (typeof resp === 'string' && resp) ||
    resp?.token ||
    resp?.accessToken ||
    resp?.access_token ||
    data?.token ||
    data?.accessToken ||
    data?.access_token ||
    data?.auth?.token ||
    data?.data?.token ||
    undefined
  );
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // decoded payload or fallback { token }
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize from storage (client-only)
  useEffect(() => {
    if (!hasWindow()) { setIsLoading(false); return; }
    try {
      const token = safeGetItem(TOKEN_KEY);
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const decoded = tryDecode(token);
      if (decoded && decoded.exp) {
        const now = Math.floor(Date.now() / 1000);
        const expVal = Number(decoded.exp);
        if (!Number.isNaN(expVal) && expVal > now) {
          setUser(decoded);
        } else {
          console.warn('AuthProvider: token expired, removing.');
          safeRemoveItem(TOKEN_KEY);
          setUser(null);
        }
      } else if (decoded) {
        setUser(decoded);
      } else {
        // cannot decode -> keep raw token so app remains "logged"
        setUser({ token });
      }
    } catch (e) {
      console.error('AuthProvider:init error', e);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Keep multiple tabs/windows in sync
  useEffect(() => {
    if (!hasWindow()) return;
    const onStorage = (e) => {
      if (e.key !== TOKEN_KEY) return;
      const newToken = e.newValue;
      if (!newToken) setUser(null);
      else {
        const decoded = tryDecode(newToken);
        setUser(decoded || { token: newToken });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = async (email, password) => {
    setIsSubmitting(true);
    try {
      const response = await apiLogin(email, password);
      // normalize axios response or raw data
      const body = response && response.data ? response.data : response;
      console.debug('AuthProvider.login - server response:', body);

      const token = extractToken(body);
      if (!token) {
        const topKeys = body && typeof body === 'object' ? Object.keys(body).join(', ') : String(body);
        throw new Error(`No token found in login response. Top-level keys: ${topKeys}`);
      }

      // persist token (safe)
      safeSetItem(TOKEN_KEY, token);

      const decoded = tryDecode(token);
      setUser(decoded || { token });
      setIsSubmitting(false);
      return { success: true, user: decoded || { token } };
    } catch (err) {
      setIsSubmitting(false);
      // make sure error message is readable for all error shapes
      const msg = (err && (err.response?.data?.message || err.message)) || String(err);
      console.error('AuthProvider.login error:', msg, err);
      return { success: false, error: msg };
    }
  };

  const register = async (email, password) => {
    setIsSubmitting(true);
    try {
      const response = await apiRegister(email, password);
      const body = response && response.data ? response.data : response;
      const message = body?.message || 'Registered';
      setIsSubmitting(false);
      return { success: true, message };
    } catch (err) {
      setIsSubmitting(false);
      const msg = (err && (err.response?.data?.message || err.message)) || String(err);
      console.error('AuthProvider.register error:', msg, err);
      return { success: false, error: msg };
    }
  };

  const logout = useCallback(() => {
    try { safeRemoveItem(TOKEN_KEY); } catch (e) { console.warn('logout error', e); }
    setUser(null);
    if (hasWindow()) window.location.href = '/login';
  }, []);

  const getUser = () => user;
  const isAdmin = () => user?.email === (hasWindow() ? import.meta.env.VITE_ADMIN_EMAIL : undefined);
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        getUser,
        login,
        register,
        logout,
        isAdmin,
        isAuthenticated,
        isLoading,
        isSubmitting,
      }}
    >
      {!isLoading ? (
        children
      ) : (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
        </div>
      )}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
