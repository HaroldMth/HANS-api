'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Key, BarChart3, Clock, TestTube, Copy, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useApi } from '@/lib/hooks/useApi';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api-api-hans.onrender.com';

export default function DashboardPage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const { user, logout } = useAuth();
  const { execute, loading: testLoading } = useApi();

  useEffect(() => {
    let mounted = true;
    const fetchUserInfo = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');

        const keyRes = await fetch(`${API_BASE_URL}/user/api-key`, {
          headers: { Authorization: 'Bearer ' + token }
        });
        if (!keyRes.ok) throw new Error('Failed to fetch API key');
        const keyData = await keyRes.json();
        if (keyData.status !== 'success') throw new Error('Failed to fetch API key');
        const apiKey = keyData.data.apiKey;

        const infoRes = await fetch(`${API_BASE_URL}/api/info?key=${apiKey}`);
        if (!infoRes.ok) throw new Error('Failed to fetch user info');
        const infoData = await infoRes.json();
        if (infoData.status !== 'success') throw new Error('Failed to fetch user info');

        if (!mounted) return;

        setUserInfo({
          api_key: apiKey,
          email: infoData.data.email,
          requests_remaining: infoData.data.requests_left,
          reset_time: infoData.data.reset_at
        });

        if (user?.role === 'admin') {
          try {
            const statsRes = await fetch(`${API_BASE_URL}/dashboard-control-9000`, {
              headers: { Authorization: 'Bearer ' + token }
            });
            if (statsRes.ok) {
              const statsJson = await statsRes.json();
              if (statsJson.status === 'success' && statsJson.data) {
                setStats(statsJson.data);
              } else {
                setStats(statsJson.data || statsJson);
              }
            }
          } catch (err) {
            console.error('Error fetching admin stats', err);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load user information');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUserInfo();
    return () => { mounted = false; };
  }, [user]);

  const handleTestEndpoint = async () => {
    try {
      const result = await execute('/api/time');
      setTestResult({ success: true, data: result });
    } catch (err) {
      setTestResult({ success: false, error: (err as any)?.message || 'Request failed' });
    }
  };

  const copyApiKey = () => {
    if (userInfo?.api_key) navigator.clipboard.writeText(userInfo.api_key).catch(() => {});
  };

  const formatResetTime = (resetTime: string) => {
    if (!resetTime) return 'Unknown';
    try {
      return new Date(resetTime).toLocaleString();
    } catch {
      return resetTime;
    }
  };

  const obfuscateApiKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 12) return key;
    return key.substring(0, 8) + '•'.repeat(Math.max(0, key.length - 12)) + key.substring(key.length - 4);
  };

  const computeProgressWidth = (remaining: number) => {
    if (remaining == null) return '0%';
    const capped = Math.min(1000, Math.max(0, Number(remaining)));
    const pct = Math.round((capped / 1000) * 100);
    return `${pct}%`;
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {userInfo?.email || user?.email}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {user?.role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Users</h3>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalUsers ?? 0}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">API Calls Today</h3>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalRequestsToday ?? 0}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                  <Key className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">API Key</h3>
              </div>
              <button onClick={() => setShowApiKey(!showApiKey)} className="text-gray-500 hover:text-gray-700">
                {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <code className="text-sm font-mono text-gray-800 break-all">
                {userInfo?.api_key ? (showApiKey ? userInfo.api_key : obfuscateApiKey(userInfo.api_key)) : 'Loading...'}
              </code>
            </div>
            <button onClick={copyApiKey} className="flex items-center space-x-2 text-purple-600 hover:text-purple-800 text-sm font-medium hover:underline">
              <Copy size={14} />
              <span>Copy to clipboard</span>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Usage Today</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Requests Remaining</p>
                <p className="text-2xl font-bold text-gray-900">{userInfo?.requests_remaining ?? 'Loading...'}</p>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500" style={{ width: computeProgressWidth(userInfo?.requests_remaining) }}></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-pink-500 to-blue-500 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Reset Time</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">Next reset</p>
            <p className="text-lg font-semibold text-gray-900">{formatResetTime(userInfo?.reset_time)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <TestTube className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Test API</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button onClick={handleTestEndpoint} disabled={testLoading} className="flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-3 rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              <RefreshCw className={`h-4 w-4 ${testLoading ? 'animate-spin' : ''}`} />
              <span>{testLoading ? 'Testing...' : 'Test /api/time'}</span>
            </button>
            <button onClick={logout} className="bg-gray-100 text-gray-700 px-4 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors">Logout</button>
          </div>

          {testResult && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">API Response:</h4>
              {testResult.success ? (
                <pre className="text-sm text-gray-800 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(testResult.data, null, 2)}</pre>
              ) : (
                <p className="text-red-600 text-sm">{testResult.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}