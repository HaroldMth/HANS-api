'use client';

import { useEffect, useRef, useState } from 'react';
import { 
  Play, 
  Copy, 
  Download, 
  Save, 
  Lock, 
  X, 
  Link as LinkIcon, 
  Sparkles, 
  Code2, 
  Zap,
  Settings,
  Eye,
  Terminal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

interface EndpointExplorerProps {
  endpoint: string;
  description: string;
  category: string;
  params?: any[];
}

export default function EndpointExplorer({ endpoint, description, category, params = [] }: EndpointExplorerProps) {
  const { isAuthenticated } = useAuth();

  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [includeKey, setIncludeKey] = useState(true);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [serverDefaults, setServerDefaults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [responseData, setResponseData] = useState<any>(null);
  const [paramErrors, setParamErrors] = useState<string[]>([]);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  const lastBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { Authorization: 'Bearer ' + token } : {};

    const fetchProfile = async () => {
      if (!isAuthenticated) {
        if (mounted) {
          setIsAdmin(false);
          setApiKey(null);
        }
        return;
      }

      try {
        const p = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/user/me`, { headers });
        const j = await p.json().catch(() => null);
        if (mounted && p.ok && j?.data) setIsAdmin(Boolean(j.data.isAdmin));
      } catch (e) {
        console.error('profile fetch', e);
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/user/api-key`, { headers });
        const j = await res.json().catch(() => null);
        if (mounted && res.ok && j?.status === 'success' && j.data?.apiKey) setApiKey(j.data.apiKey);
      } catch (e) {
        console.error('apikey fetch', e);
      }
    };

    fetchProfile();
    return () => { mounted = false; };
  }, [isAuthenticated]);

  useEffect(() => {
    let mounted = true;
    const loadDefaults = async () => {
      if (!endpoint) return;
      try {
        const enc = encodeURIComponent(endpoint);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/endpoint-defaults/${enc}`);
        const j = await res.json().catch(() => null);
        if (mounted && res.ok && j?.status === 'success') setServerDefaults(j.data || {});
      } catch (e) {
        console.error('load defaults', e);
      }
    };
    loadDefaults();
    return () => { mounted = false; };
  }, [endpoint]);

  useEffect(() => {
    const init: Record<string, string> = {};
    (params || []).forEach((p) => {
      if (serverDefaults && Object.prototype.hasOwnProperty.call(serverDefaults, p.name)) {
        init[p.name] = String(serverDefaults[p.name] ?? '');
      } else if (p?.default !== undefined && p?.default !== null) {
        init[p.name] = String(p.default);
      } else {
        init[p.name] = smartDefaultForType(p.type);
      }
    });
    setParamValues((prev) => ({ ...init, ...prev }));
  }, [JSON.stringify(params), JSON.stringify(serverDefaults)]);

  const smartDefaultForType = (type: string) => {
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
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || '';
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

      if (contentType.startsWith('audio/')) {
        const blob = await res.blob();
        clearBlobUrl();
        const urlObj = URL.createObjectURL(blob);
        lastBlobUrlRef.current = urlObj;
        setResponseData({ type: 'audio', url: urlObj, headers, status, time: took, size: blob.size, contentType });
        setLoading(false);
        return;
      }

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
    } catch (err: any) {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/endpoint-defaults`, {
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

  const copyToClipboard = async (text: string) => {
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

  const paramList = params && params.length ? params : [];

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Enhanced Card Design */}
      <div className="group relative overflow-hidden bg-white rounded-3xl shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        
        {/* Glowing Border Effect */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500"></div>
        
        <div className="relative p-6">
          {/* Header Section */}
          <div className="flex items-start justify-between space-x-4 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg">
                  <Code2 className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg text-gray-900 break-words font-mono bg-gray-50 px-3 py-1 rounded-lg">
                    {endpoint}
                  </div>
                </div>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
              {category && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-3 py-1 rounded-full border border-purple-200">
                  <Sparkles className="h-3 w-3" />
                  {category}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col items-end space-y-3">
              <div className="flex space-x-2">
                <button
                  onClick={() => setOpen(true)}
                  disabled={!isAuthenticated}
                  className={`group/btn relative overflow-hidden flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all text-sm ${
                    !isAuthenticated 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 hover:scale-105 shadow-lg hover:shadow-xl'
                  }`}
                >
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
                  <Play className="h-4 w-4 relative z-10" />
                  <span className="relative z-10">Test API</span>
                </button>

                <button 
                  onClick={() => copyToClipboard(buildUrl())} 
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-purple-300 transition-all text-sm shadow-sm hover:shadow-md"
                >
                  <LinkIcon className="h-4 w-4" />
                  <span>Copy URL</span>
                </button>
              </div>

              {/* API Key Toggle */}
              <div className="text-xs">
                <label className="flex items-center gap-2 select-none cursor-pointer group/toggle">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={includeKey} 
                      onChange={() => setIncludeKey((s) => !s)} 
                    />
                    <div className={`w-10 h-5 rounded-full transition-colors ${includeKey ? 'bg-purple-500' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${includeKey ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`}></div>
                    </div>
                  </div>
                  <span className="text-gray-600 group-hover/toggle:text-purple-600 transition-colors">
                    {apiKey ? 'Include API key' : 'No API key available'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative w-full h-full max-w-5xl overflow-hidden bg-white shadow-2xl rounded-3xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Terminal className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{endpoint}</h2>
                  <p className="text-purple-100 text-sm">{description}</p>
                </div>
              </div>
              <button 
                onClick={() => setOpen(false)} 
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
                {/* Parameters Panel */}
                <div className="p-6 border-r border-gray-200 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-purple-600" />
                      <h3 className="font-semibold text-gray-900">Parameters</h3>
                    </div>
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
                    >
                      <span>Advanced</span>
                      {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {paramList.length === 0 ? (
                    <div className="p-6 rounded-xl bg-white border-2 border-dashed border-gray-200 text-center">
                      <Zap className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 text-sm">No parameters required for this endpoint</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paramList.map((p) => {
                        const val = paramValues[p.name] ?? '';
                        const missing = paramErrors.includes(p.name);
                        const hasPersistedDefault = serverDefaults && Object.prototype.hasOwnProperty.call(serverDefaults, p.name);
                        const readonlyBecausePersisted = hasPersistedDefault && !isAdmin;

                        return (
                          <div key={p.name} className="bg-white rounded-xl p-4 border border-gray-200 hover:border-purple-300 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 capitalize">{p.name}</span>
                                {p.required && <span className="text-red-500 text-sm">*</span>}
                                {hasPersistedDefault && (
                                  <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                    <Lock className="h-3 w-3" />
                                    <span>Persisted</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                {p.type || 'string'}
                              </span>
                            </div>
                            
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => {
                                if (!readonlyBecausePersisted) {
                                  setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }));
                                  if (paramErrors.includes(p.name)) {
                                    setParamErrors((errs) => errs.filter((x) => x !== p.name));
                                  }
                                }
                              }}
                              placeholder={hasPersistedDefault ? String(serverDefaults[p.name]) : (p?.default ?? smartDefaultForType(p.type))}
                              className={`w-full px-4 py-3 border rounded-xl text-sm transition-colors ${
                                missing 
                                  ? 'border-red-400 bg-red-50' 
                                  : 'border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                              }`}
                              disabled={readonlyBecausePersisted}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Advanced Options */}
                  {showAdvanced && (
                    <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-3">Advanced Options</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Request Method</span>
                          <select className="px-3 py-1 border border-gray-300 rounded-lg text-sm">
                            <option>GET</option>
                            <option>POST</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Content Type</span>
                          <select className="px-3 py-1 border border-gray-300 rounded-lg text-sm">
                            <option>application/json</option>
                            <option>text/plain</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Ready to test? Click run to execute the request
                    </div>
                    <div className="flex items-center gap-3">
                      {isAdmin && (
                        <button 
                          onClick={saveDefaults} 
                          disabled={savingDefaults} 
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all"
                        >
                          <Save className="h-4 w-4" />
                          {savingDefaults ? 'Saving...' : 'Save Defaults'}
                        </button>
                      )}

                      <button 
                        onClick={handleRun} 
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all hover:scale-105 shadow-lg"
                      >
                        <Play className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>{loading ? 'Running...' : 'Run Request'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Response Panel */}
                <div className="p-6 bg-gray-900 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-green-400" />
                      <h3 className="font-semibold">Response</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => copyToClipboard(buildUrl())} 
                        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                        title="Copy URL"
                      >
                        <LinkIcon className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => responseData && copyToClipboard(responseData.type === 'image' ? responseData.url : (responseData.rawText || ''))} 
                        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                        title="Copy Response"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={downloadResponse} 
                        className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                        title="Download Response"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-xl p-4 min-h-[300px] border border-gray-700">
                    {loading && (
                      <div className="flex items-center justify-center py-20">
                        <div className="relative">
                          <div className="animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                          <div className="absolute inset-0 animate-ping h-12 w-12 border-4 border-purple-500/30 rounded-full"></div>
                        </div>
                      </div>
                    )}

                    {!loading && responseData && (
                      <div className="space-y-4">
                        {/* Status Bar */}
                        <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${responseData.status >= 200 && responseData.status < 300 ? 'bg-green-400' : 'bg-red-400'}`}></div>
                            <span className="font-mono text-sm">
                              Status: {responseData.status ?? '—'}
                            </span>
                          </div>
                          <span className="text-sm text-gray-400">
                            {responseData.time ?? '—'}ms
                          </span>
                        </div>

                        {/* Response Content */}
                        {responseData.type === 'image' ? (
                          <div className="text-center p-4">
                            <img 
                              src={responseData.url} 
                              alt="API Response" 
                              className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600" 
                            />
                          </div>
                        ) : responseData.type === 'audio' ? (
                          <div className="text-center p-4">
                            <audio controls src={responseData.url} className="w-full">
                              Your browser does not support the audio element.
                            </audio>
                          </div>
                        ) : responseData.type === 'video' ? (
                          <div className="text-center p-4">
                            <video controls src={responseData.url} className="w-full max-h-64">
                              Your browser does not support the video tag.
                            </video>
                          </div>
                        ) : (
                          <pre className="text-sm text-green-400 whitespace-pre-wrap break-words font-mono leading-relaxed overflow-auto max-h-96">
                            {(() => {
                              let formatted = responseData.rawText ?? '';
                              try {
                                const parsed = JSON.parse(responseData.rawText);
                                formatted = JSON.stringify(parsed, null, 2);
                              } catch {}
                              return formatted;
                            })()}
                          </pre>
                        )}
                      </div>
                    )}

                    {!loading && !responseData && (
                      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <Terminal className="h-16 w-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">Ready to Execute</p>
                        <p className="text-sm text-center">
                          Configure your parameters and click <span className="font-semibold text-purple-400">Run Request</span> to see the response
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}