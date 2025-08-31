import React, { useState, useEffect } from 'react';
import { Settings, Users, BarChart3, RefreshCw, Plus, Download, AlertTriangle } from 'lucide-react';
import { admin } from '../api.js';

const AdminPanel = () => {
  const [dashboardData, setDashboardData] = useState({
    totalUsers: 0,
    totalRequestsToday: 0,
    totalRequestsAllTime: 0 // 👈 add this
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [actionLoading, setActionLoading] = useState('');
  const [showModal, setShowModal] = useState(null);

  // modal form state
  const [modalUserId, setModalUserId] = useState('');
  const [modalLimit, setModalLimit] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchDashboardAndUsers = async () => {
    setError('');
    try {
      // dashboard
      const dashRes = await admin.getDashboard();
      const dashData = (dashRes && dashRes.status === 'success' && dashRes.data) ? dashRes.data : (dashRes || {});
      setDashboardData(prev => ({
        ...prev,
        totalUsers: dashData.totalUsers ?? dashData.total_users ?? dashData.totalUsersCount ?? 0,
        totalRequestsToday: (
          dashData.totalRequestsToday ??
          dashData.total_requests_today ??
          dashData.totalRequestsTodayCount ??
          0
        )
      }));

      // fetch all-time total requests
      try {
        const totalReqRes = await admin.getTotalRequests();
        const totalReqData = (totalReqRes && totalReqRes.status === 'success' && totalReqRes.data)
          ? totalReqRes.data
          : (totalReqRes || {});
        setDashboardData(prev => ({
          ...prev,
          totalRequestsAllTime: totalReqData.totalRequests ?? 0
        }));
      } catch (err) {
        console.error('fetch total requests error', err);
      }

      // users
      const usersRes = await admin.getUsers();
      const ux = (usersRes && usersRes.status === 'success' && usersRes.data) ? usersRes.data : (usersRes && usersRes.data) ? usersRes.data : (usersRes || []);
      setUsers(Array.isArray(ux) ? ux : []);
    } catch (err) {
      console.error('fetchDashboardAndUsers error', err);
      setError('Failed to load admin dashboard or users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardAndUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = async () => {
    setLoading(true);
    await fetchDashboardAndUsers();
  };

  const handleRegenerateKey = async (userId) => {
    setActionLoading('regenerate');
    setError('');
    setSuccessMsg('');
    try {
      await admin.regenerateKey(userId);
      setSuccessMsg('API key regenerated.');
      await fetchDashboardAndUsers();
    } catch (err) {
      console.error('regenerate error', err);
      setError(err?.response?.data?.message || 'Failed to regenerate API key');
    } finally {
      setActionLoading('');
      setShowModal(null);
    }
  };

  const handleUpdateLimit = async (userId, limit) => {
    setActionLoading('limit');
    setError('');
    setSuccessMsg('');
    try {
      await admin.updateLimit(userId, limit);
      setSuccessMsg('User limit updated.');
      await fetchDashboardAndUsers();
    } catch (err) {
      console.error('update limit error', err);
      setError(err?.response?.data?.message || 'Failed to update limit');
    } finally {
      setActionLoading('');
      setShowModal(null);
    }
  };

  const handleAddRequests = async (userId, amount) => {
    setActionLoading('requests');
    setError('');
    setSuccessMsg('');
    try {
      await admin.addRequests(userId, amount);
      setSuccessMsg('Added requests to user.');
      await fetchDashboardAndUsers();
    } catch (err) {
      console.error('add requests error', err);
      setError(err?.response?.data?.message || 'Failed to add requests');
    } finally {
      setActionLoading('');
      setShowModal(null);
    }
  };

  const handleDownloadLogs = async () => {
    setActionLoading('logs');
    setError('');
    setSuccessMsg('');
    try {
      const blobOrData = await admin.downloadLogs();
      // if axios returned a Blob, use it directly; if it's raw data string, create blob
      const blob = (blobOrData instanceof Blob) ? blobOrData : new Blob([blobOrData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hans-api-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSuccessMsg('Logs downloaded.');
    } catch (err) {
      console.error('download logs error', err);
      setError(err?.response?.data?.message || 'Failed to download logs');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
            <Settings className="h-8 w-8 mr-3 text-purple-600" />
            Admin Panel
          </h1>
          <p className="text-gray-600">Manage users, API keys, and system settings</p>
        </div>

        {(error || successMsg) && (
          <div className={`rounded-lg p-4 mb-6 ${error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <p className={`${error ? 'text-red-800' : 'text-green-800'}`}>{error || successMsg}</p>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.totalUsers ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">API Calls Today</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.totalRequestsToday ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">API Calls (All Time)</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.totalRequestsAllTime ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden mb-8">
          <div className="p-6 bg-gradient-to-r from-purple-500 to-pink-500">
            <h2 className="text-xl font-semibold text-white">Admin Actions</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button onClick={() => setShowModal('regenerate')} disabled={actionLoading === 'regenerate'} className="flex items-center justify-center space-x-2 bg-yellow-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-yellow-600 disabled:opacity-50 transition-all">
                <RefreshCw className={`h-4 w-4 ${actionLoading === 'regenerate' ? 'animate-spin' : ''}`} />
                <span>Regenerate Key</span>
              </button>

              <button onClick={() => setShowModal('limit')} disabled={actionLoading === 'limit'} className="flex items-center justify-center space-x-2 bg-blue-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-all">
                <Settings className="h-4 w-4" />
                <span>Update Limit</span>
              </button>

              <button onClick={() => setShowModal('requests')} disabled={actionLoading === 'requests'} className="flex items-center justify-center space-x-2 bg-green-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 transition-all">
                <Plus className="h-4 w-4" />
                <span>Add Requests</span>
              </button>

              <button onClick={handleDownloadLogs} disabled={actionLoading === 'logs'} className="flex items-center justify-center space-x-2 bg-purple-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 transition-all">
                <Download className={`h-4 w-4 ${actionLoading === 'logs' ? 'animate-spin' : ''}`} />
                <span>Download Logs</span>
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="mt-8 bg-white rounded-xl shadow-lg border border-purple-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Users</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse">
              <thead>
                <tr className="bg-purple-100 text-left">
                  <th className="px-4 py-2">User ID</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">API Key</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Daily Limit</th>
                  <th className="px-4 py-2">Usage Today</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id || u.id} className="border-t border-gray-200">
                    <td className="px-4 py-2 font-mono">{u._id || u.id}</td>
                    <td className="px-4 py-2">{u.email}</td>
                    <td className="px-4 py-2 font-mono break-words max-w-xs">{u.apiKey}</td>
                    <td className="px-4 py-2">{u.role}</td>
                    <td className="px-4 py-2">{u.dailyLimit}</td>
                    <td className="px-4 py-2">{u.usageToday}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => { setShowModal('regenerate'); setModalUserId(u._id || u.id); }} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Regenerate</button>
                        <button onClick={() => { setShowModal('limit'); setModalUserId(u._id || u.id); setModalLimit(u.dailyLimit || ''); }} className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Limit</button>
                        <button onClick={() => { setShowModal('requests'); setModalUserId(u._id || u.id); }} className="px-2 py-1 bg-green-100 text-green-800 rounded">Add</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confirmation Modals */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Action</h3>
                </div>

                {showModal === 'regenerate' && (
                  <div>
                    <p className="text-gray-600 mb-4">Are you sure you want to regenerate the API key for this user? This action cannot be undone.</p>
                    <input value={modalUserId} onChange={(e) => setModalUserId(e.target.value)} type="text" placeholder="Enter User ID" className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                )}

                {showModal === 'limit' && (
                  <div>
                    <p className="text-gray-600 mb-4">Update the request limit for a user.</p>
                    <input value={modalUserId} onChange={(e) => setModalUserId(e.target.value)} type="text" placeholder="Enter User ID" className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <input value={modalLimit} onChange={(e) => setModalLimit(e.target.value)} type="number" placeholder="Enter New Limit" className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                )}

                {showModal === 'requests' && (
                  <div>
                    <p className="text-gray-600 mb-4">Add additional requests to a user's quota.</p>
                    <input value={modalUserId} onChange={(e) => setModalUserId(e.target.value)} type="text" placeholder="Enter User ID" className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <input value={modalAmount} onChange={(e) => setModalAmount(e.target.value)} type="number" placeholder="Number of Requests" className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex space-x-3 justify-end">
                <button onClick={() => { setShowModal(null); setModalUserId(''); setModalLimit(''); setModalAmount(''); }} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={async () => {
                  if (showModal === 'regenerate') {
                    if (!modalUserId) return setError('User ID required');
                    await handleRegenerateKey(modalUserId);
                  } else if (showModal === 'limit') {
                    if (!modalUserId || !modalLimit) return setError('User ID and new limit required');
                    await handleUpdateLimit(modalUserId, parseInt(modalLimit, 10));
                  } else if (showModal === 'requests') {
                    if (!modalUserId || !modalAmount) return setError('User ID and amount required');
                    await handleAddRequests(modalUserId, parseInt(modalAmount, 10));
                  }
                  // reset modal fields after action
                  setModalUserId(''); setModalLimit(''); setModalAmount('');
                }} className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
