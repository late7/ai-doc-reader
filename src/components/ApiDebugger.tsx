'use client';

import { useState } from 'react';

export default function ApiDebugger() {
  const [endpoint, setEndpoint] = useState('/api/v1/healthz');
  const [method, setMethod] = useState('GET');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const ANYTHINGLLM_ENDPOINT = process.env.NEXT_PUBLIC_ANYTHINGLLM_ENDPOINT || 'http://localhost:62934';
  const ANYTHINGLLM_KEY = '2NN1DX8-HPBMTCK-NF05NYM-YRPTWGM';

  const makeRequest = async () => {
    setLoading(true);
    setError(null);
    setResponse('');
    
    try {
      const url = `${ANYTHINGLLM_ENDPOINT}${endpoint}`;
      console.log('Making request to:', url);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${ANYTHINGLLM_KEY}`
        }
      });
      
      const contentType = response.headers.get('content-type') || '';
      let result;
      
      if (contentType.includes('application/json')) {
        result = await response.json();
        setResponse(JSON.stringify(result, null, 2));
      } else {
        result = await response.text();
        setResponse(result);
      }
      
      console.log('API Response:', result);
    } catch (err) {
      console.error('API Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to make API request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">AnythingLLM API Debugger</h2>
      
      <div className="flex space-x-2 mb-4">
        <select 
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
        
        <input 
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="API Endpoint (e.g., /api/v1/workspaces)"
          className="flex-1 p-2 border rounded"
        />
        
        <button
          onClick={makeRequest}
          disabled={loading}
          className={`px-4 py-2 rounded ${loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
        >
          {loading ? 'Loading...' : 'Send Request'}
        </button>
      </div>
      
      <div className="mb-2">
        <p className="text-sm text-gray-600">
          Server: {ANYTHINGLLM_ENDPOINT}
        </p>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      {response && (
        <div className="mt-4">
          <h3 className="text-md font-medium mb-2">Response:</h3>
          <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-80 text-sm">{response}</pre>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Common endpoints:</p>
        <ul className="list-disc ml-5 mt-1 space-y-1">
          <li><button className="text-blue-500 hover:underline" onClick={() => setEndpoint('/api/v1/healthz')}>GET /api/v1/healthz</button> - Server health check</li>
          <li><button className="text-blue-500 hover:underline" onClick={() => setEndpoint('/api/v1/workspaces')}>GET /api/v1/workspaces</button> - List all workspaces</li>
          <li><button className="text-blue-500 hover:underline" onClick={() => setEndpoint('/api/v1/workspace/dd-startup')}>GET /api/v1/workspace/dd-startup</button> - Get workspace details</li>
        </ul>
      </div>
    </div>
  );
}
