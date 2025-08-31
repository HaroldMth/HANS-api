import React from 'react';
import { Copy, Download, CheckCircle, XCircle } from 'lucide-react';

const ApiResponse = ({ response, error, loading, onCopy, onDownload }) => {
  if (loading) {
    return (
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-gray-600">Processing request...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <XCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-800 font-medium">Error</span>
        </div>
        <p className="text-red-700 mt-2">{error}</p>
      </div>
    );
  }

  if (!response) return null;

  const isImage = response.headers?.['content-type']?.includes('image');
  const isSuccess = response.status >= 200 && response.status < 300;

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {isSuccess ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
          <span className="font-medium text-gray-900">
            {response.status} {response.statusText}
          </span>
        </div>
        
        <div className="flex space-x-2">
          {!isImage && onCopy && (
            <button
              onClick={onCopy}
              className="flex items-center space-x-1 px-2 py-1 text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded"
            >
              <Copy size={14} />
              <span>Copy</span>
            </button>
          )}
          {isImage && onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center space-x-1 px-2 py-1 text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded"
            >
              <Download size={14} />
              <span>Download</span>
            </button>
          )}
        </div>
      </div>
      
      <div className="p-4">
        {isImage ? (
          <div className="text-center">
            <img 
              src={URL.createObjectURL(new Blob([response.data]))} 
              alt="API Response" 
              className="max-w-full h-auto rounded-lg shadow-md"
            />
          </div>
        ) : (
          <pre className="text-sm text-gray-800 whitespace-pre-wrap overflow-x-auto">
            {typeof response.data === 'string' 
              ? response.data 
              : JSON.stringify(response.data, null, 2)
            }
          </pre>
        )}
      </div>
    </div>
  );
};

export default ApiResponse;