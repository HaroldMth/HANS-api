import React, { useEffect, useRef, useState } from 'react';
import { FaPlay, FaCopy, FaDownload, FaSave, FaLock, FaImage, FaTimes, FaLink } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi';
import { useAuth } from '../hooks/useAuth.jsx';

// EndpointExplorerModal (English, mobile-first)
// - All parameters + results live in a single modal
// - Endpoints with NO declared params will NOT render a text input
// - Modal is full-screen on small devices for better usability
// - Uses react-icons and Tailwind utility classes

export default function EndpointExplorerModal({ endpoint, description, category, params = [] }) {
  const { isAuthenticated } = useAuth();

  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [apiKey, setApiKey] = useState(null);
  const [includeKey, setIncludeKey] = useState(true);
  const [paramValues, setParamValues] = useState({});
  const [serverDefaults, setServerDefaults] = useState({});
  const [loading, setLoading] = useState(false);
  const [responseData, setResponseData] = useState(null);
  const [paramErrors, setParamErrors] = useState([]);
  const [savingDefaults, setSavingDefaults] = useState(false);

  const controllerRef = useRef(null);
  const lastBlobUrlRef = useRef(null);

  // Fetch profile & API key when auth changes
  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: 'Bearer ' + token } : {};

    const fetchProfile = async () => {
      if (!isAuthenticated) {
        if (mounted) {
          setIsAdmin(false);
          setApiKey(null);
        }
        return;
      }

      try {
        const p = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/me`, { headers });
        const j = await p.json().catch(() => null);
        if (mounted && p.ok && j?.data) setIsAdmin(Boolean(j.data.isAdmin));
      } catch (e) {
        console.error('profile fetch', e);
      }

      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/user/api-key`, { headers });
        const j = await res.json().catch(() => null);
        if (mounted && res.ok && j?.status === 'success' && j.data?.apiKey) setApiKey(j.data.apiKey);
      } catch (e) {
        console.error('apikey fetch', e);
      }
    };

    fetchProfile();
    return () => (mounted = false);
  }, [isAuthenticated]);

  // Load persisted defaults
  useEffect(() => {
    let mounted = true;
    const loadDefaults = async () => {
      if (!endpoint) return;
      try {
        const enc = encodeURIComponent(endpoint);
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/endpoint-defaults/${enc}`);
        const j = await res.json().catch(() => null);
        if (mounted && res.ok && j?.status === 'success') setServerDefaults(j.data || {});
      } catch (e) {
        console.error('load defaults', e);
      }
    };
    loadDefaults();
    return () => (mounted = false);
  }, [endpoint]);

  // Initialize parameter values (but do NOT invent a param when none are declared)
  useEffect(() => {
    const init = {};
    (params || []).forEach((p) => {
      if (serverDefaults && Object.prototype.hasOwnProperty.call(serverDefaults, p.name)) init[p.name] = String(serverDefaults[p.name] ?? '');
      else if (p?.default !== undefined && p?.default !== null) init[p.name] = String(p.default);
      else init[p.name] = smartDefaultForType(p.type);
    });
    setParamValues((prev) => ({ ...init, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params), JSON.stringify(serverDefaults)]);

  const smartDefaultForType = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'number':
      case 'int':
      case 'float':
        return '123';
      case 'boolean':
      case 'bool':
        return 'true';
      case 'email':
        return 'user@example.com';
      default:
        return 'https://hans.tech';
    }
  };

  const clearBlobUrl = () => {
    if (lastBlobUrlRef.current) {
      try {
        URL.revokeObjectURL(lastBlobUrlRef.current);
      } catch {}
      lastBlobUrlRef.current = null;
    }
  };

  const buildQueryString = () => {
    const qs = new URLSearchParams();
    Object.entries(paramValues || {}).forEach(([k, v]) => {
      if (v === '' || v === undefined || v === null) return;
      qs.append(k, v);
    });
    if (includeKey && apiKey) qs.append('key', apiKey);
    const s = qs.toString();
    return s ? `?${s}` : '';
  };

  const buildUrl = () => {
    const base = import.meta.env.VITE_API_BASE_URL || '';
    const ep = endpoint || '';
    const hasExistingQs = ep.includes('?');
    const qs = buildQueryString();
    if (!qs) return base + ep;
    if (hasExistingQs) return base + ep + '&' + qs.substring(1);
    return base + ep + qs;
  };

  const validateRequired = () => {
    const missing = (params || []).filter((p) => p.required && (!paramValues[p.name] || String(paramValues[p.name]).trim() === ''));
    return missing.map((m) => m.name);
  };

  const handleRun = async () => {
    if (!isAuthenticated) return alert('Please log in to test endpoints');

    setParamErrors([]);
    const missing = validateRequired();
    if (missing.length) {
      setParamErrors(missing);
      setResponseData({ type: 'text', rawText: `Missing required parameter(s): ${missing.join(', ')}`, status: 400, time: 0 });
      return;
    }

    setResponseData(null);
    setLoading(true);

    controllerRef.current = new AbortController();
    const signal = controllerRef.current.signal;
    const start = performance.now();

    try {
      const url = buildUrl();
      const res = await fetch(url, { method: 'GET', signal });
      const took = Math.round(performance.now() - start);
      const status = res.status;
      const headers = Object.fromEntries(res.headers.entries());
      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      if (contentType.includes('image')) {
        const blob = await res.blob();
        clearBlobUrl();
        const urlObj = URL.createObjectURL(blob);
        lastBlobUrlRef.current = urlObj;
        setResponseData({ type: 'image', url: urlObj, headers, status, time: took, size: blob.size });
        setLoading(false);
        return;
      }
      // Support audio
      if (contentType.startsWith('audio/')) {
        const blob = await res.blob();
        clearBlobUrl();
        const urlObj = URL.createObjectURL(blob);
        lastBlobUrlRef.current = urlObj;
        setResponseData({ type: 'audio', url: urlObj, headers, status, time: took, size: blob.size, contentType });
        setLoading(false);
        return;
      }
      // Support video
      if (contentType.startsWith('video/')) {
        const blob = await res.blob();
        clearBlobUrl();
        const urlObj = URL.createObjectURL(blob);
        lastBlobUrlRef.current = urlObj;
        setResponseData({ type: 'video', url: urlObj, headers, status, time: took, size: blob.size, contentType });
        setLoading(false);
        return;
      }

      const rawText = await res.text();
      setResponseData({ type: 'raw', rawText, headers, status, time: took });
      setLoading(false);
    } catch (err) {
      if (err?.name === 'AbortError') {
        setResponseData({ type: 'text', rawText: 'Request cancelled', status: null, time: null });
        setLoading(false);
        return;
      }
      console.error('Request failed', err);
      setResponseData({ type: 'text', rawText: `Error: ${err?.message ?? err}`, status: null, time: null });
      setLoading(false);
    }
  };

  const saveDefaults = async () => {
    if (!isAdmin) return alert('Not allowed');
    try {
      setSavingDefaults(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/endpoint-defaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
        body: JSON.stringify({ endpoint, defaults: paramValues })
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.status === 'success') {
        alert('Defaults saved.');
        setServerDefaults(j.data.defaults || paramValues);
      } else {
        alert('Save failed');
      }
    } catch (e) {
      console.error(e);
      alert('Save error');
    } finally {
      setSavingDefaults(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text || '');
      alert('Copied to clipboard');
    } catch (e) {
      console.error('copy', e);
      alert('Unable to copy');
    }
  };

  const downloadResponse = () => {
    if (!responseData) return;
    if (responseData.type === 'image') {
      const a = document.createElement('a');
      a.href = responseData.url;
      a.download = `${(endpoint || 'response').replace(/[^a-z0-9]/gi, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      const blob = new Blob([responseData.rawText ?? ''], { type: 'text/plain;charset=utf-8' });
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = `${(endpoint || 'response').replace(/[^a-z0-9]/gi, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => {
        try {
          URL.revokeObjectURL(urlObj);
        } catch {}
      }, 1000);
    }
  };

  useEffect(() => {
    return () => {
      clearBlobUrl();
      try {
        controllerRef.current?.abort();
      } catch {}
    };
  }, []);

  // parameter list to render (do NOT create a fake param when none are declared)
  const paramList = params && params.length ? params : [];

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-pink-500 rounded-2xl p-5 shadow-lg text-white flex items-start justify-between space-x-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <HiSparkles className="text-2xl opacity-90" />
            <div>
              <div className="font-bold text-lg break-words">{endpoint}</div>
              <div className="text-sm opacity-90 break-words">{description}</div>
            </div>
          </div>
          {category && <div className="mt-3 inline-block text-xs bg-white/20 px-3 py-1 rounded-full">{category}</div>}
        </div>

        <div className="flex flex-col items-end space-y-2">
          <div className="flex space-x-2">
            <button
              onClick={() => setOpen(true)}
              disabled={!isAuthenticated}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all text-sm ${
                !isAuthenticated ? 'bg-white/20 text-white/60 cursor-not-allowed' : 'bg-white text-indigo-700 hover:scale-[1.02]'
              }`}
            >
              <FaPlay />
              <span>Test</span>
            </button>

            <button onClick={() => copyToClipboard(buildUrl())} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm">
              <FaLink />
              <span>Copy GET</span>
            </button>
          </div>

          <div className="text-xs opacity-90">
            <label className="flex items-center gap-2 select-none">
              <input type="checkbox" className="form-checkbox h-4 w-4" checked={includeKey} onChange={() => setIncludeKey((s) => !s)} />
              <span>{apiKey ? 'Include API key' : 'No API key available'}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

          <div className="relative w-full h-full sm:h-auto max-w-2xl overflow-auto sm:rounded-2xl bg-white shadow-2xl p-4 sm:p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-lg font-bold">{endpoint}</div>
                <div className="text-sm text-gray-600">{description}</div>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100">
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Parameters</div>
                  <div className="text-xs text-gray-500">Edit the fields then click <span className="font-semibold">Run</span></div>
                </div>

                {/* If there are no declared params, show a clear message and keep Run available */}
                {paramList.length === 0 ? (
                  <div className="p-4 rounded-md bg-white border text-sm text-gray-600">No parameters declared for this endpoint.</div>
                ) : (
                  <div className="grid gap-3">
                    {paramList.map((p) => {
                      const val = paramValues[p.name] ?? '';
                      const missing = paramErrors.includes(p.name);
                      const hasPersistedDefault = serverDefaults && Object.prototype.hasOwnProperty.call(serverDefaults, p.name);
                      const readonlyBecausePersisted = hasPersistedDefault && !isAdmin;

                      return (
                        <label key={p.name} className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                          <div className="sm:w-48 text-sm font-medium text-gray-700 flex items-center gap-2">
                            <span className="capitalize">{p.name}</span>
                            {p.required && <span className="text-red-500">*</span>}
                            {hasPersistedDefault && (
                              <span className="text-gray-400 text-xs flex items-center gap-1" title="Persisted on server">
                                <FaLock /> persisted
                              </span>
                            )}
                          </div>

                          <div className="flex-1">
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => {
                                if (!readonlyBecausePersisted) {
                                  setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }));
                                  if (paramErrors.includes(p.name)) setParamErrors((errs) => errs.filter((x) => x !== p.name));
                                }
                              }}
                              placeholder={hasPersistedDefault ? String(serverDefaults[p.name]) : (p?.default ?? smartDefaultForType(p.type))}
                              className={`w-full px-3 py-2 border rounded-lg text-sm ${missing ? 'border-red-400' : 'border-gray-200'}`}
                              disabled={readonlyBecausePersisted}
                            />
                          </div>

                          <div className="sm:w-24 text-right text-xs text-gray-500">
                            <div>{p.type || 'string'}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-gray-500">All controls in one place — mobile-first design</div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button onClick={saveDefaults} disabled={savingDefaults} className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm">
                        <FaSave className="inline mr-2" /> {savingDefaults ? 'Saving...' : 'Save defaults'}
                      </button>
                    )}

                    <button onClick={handleRun} className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl flex items-center gap-2">
                      <FaPlay /> Run
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Result</div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => copyToClipboard(buildUrl())} className="text-sm px-2 py-1 rounded hover:bg-gray-100">
                      <FaLink />
                    </button>
                    <button onClick={() => responseData && copyToClipboard(responseData.type === 'image' ? responseData.url : (responseData.rawText || ''))} className="text-sm px-2 py-1 rounded hover:bg-gray-100">
                      <FaCopy />
                    </button>
                    <button onClick={downloadResponse} className="text-sm px-2 py-1 rounded hover:bg-gray-100">
                      <FaDownload />
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3 min-h-[140px]">
                  {loading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin h-10 w-10 border-4 border-t-indigo-600 rounded-full"></div>
                    </div>
                  )}

                  {!loading && responseData && (
                    <div>
                      {responseData.headers && (
                        <div className="mb-3 text-xs text-gray-600">
                          <div className="font-medium mb-1">Headers</div>
                          <pre className="p-2 bg-white rounded overflow-x-auto text-xs">{JSON.stringify(responseData.headers, null, 2)}</pre>
                        </div>
                      )}

                      {responseData.type === 'image' ? (
                        <div className="text-center">
                          <img src={responseData.url} alt="response" className="max-w-full h-auto rounded-lg shadow" />
                        </div>
                      ) : responseData.type === 'audio' ? (
                        <div className="text-center">
                          <audio controls src={responseData.url} style={{ width: '100%' }}>
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      ) : responseData.type === 'video' ? (
                        <div className="text-center">
                          <video controls src={responseData.url} style={{ width: '100%' }}>
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      ) : (
                        <pre className="text-sm whitespace-pre-wrap break-words">{
                          (() => {
                            let formatted = responseData.rawText ?? '';
                            try {
                              const parsed = JSON.parse(responseData.rawText);
                              formatted = JSON.stringify(parsed, null, 2);
                            } catch {}
                            return formatted;
                          })()
                        }</pre>
                      )}

                      <div className="mt-3 text-xs text-gray-500">Status: {responseData.status ?? '—'} • Time: {responseData.time ?? '—'}ms</div>
                    </div>
                  )}

                  {!loading && !responseData && <div className="text-sm text-gray-500">No response yet — click <span className="font-semibold">Run</span>.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
