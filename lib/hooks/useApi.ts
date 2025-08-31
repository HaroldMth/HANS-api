import { useState, useCallback } from 'react';
import { callEndpoint } from '../api';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const execute = useCallback(async (endpoint: string, options: any = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await callEndpoint(endpoint, options);
      setData(response.data);
      return { success: true, data: response.data, response };
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Request failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    loading,
    error,
    data,
    execute,
    reset,
  };
};