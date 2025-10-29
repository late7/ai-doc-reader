'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

// Import constants from anythingllm.ts
const ANYTHINGLLM_ENDPOINT = process.env.NEXT_PUBLIC_ANYTHINGLLM_ENDPOINT || 'http://localhost:62934';

interface Workspace {
  id: number;  // Changed from string to number to match API response
  name: string;
  slug: string;
  threads?: Array<{ user_id: string | null; slug: string; name: string }>;
  // Additional fields from the API response that we might need later
  vectorTag?: string | null;
  createdAt?: string;
  lastUpdatedAt?: string;
  openAiPrompt?: string | null;
  similarityThreshold?: number;
  chatMode?: string;
}

interface WorkspaceSelectorProps {
  onWorkspaceSelect: (workspace: Workspace) => void;
  selectedWorkspace: Workspace | null;
  confirmationMessage?: string;
}

export default function WorkspaceSelector({ onWorkspaceSelect, selectedWorkspace, confirmationMessage }: WorkspaceSelectorProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Add cache-busting parameters and headers
      const timestamp = Date.now();
      const response = await fetch(`/api/workspaces?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch workspaces: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.workspaces) {
        logger.error('Unexpected API response format:', data);
        throw new Error('Invalid response format from API');
      }
      
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      logger.error('Error fetching workspaces:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWorkspaceName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create workspace: ${response.status}`);
      }

      const data = await response.json();
      
      // The response should contain a workspace object
      if (data.workspace) {
        setWorkspaces(prev => [...prev, data.workspace]);
        setNewWorkspaceName('');
        setShowCreateForm(false);
        
        // Optionally auto-select the newly created workspace
        onWorkspaceSelect(data.workspace);
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      logger.error('Error creating workspace:', err);
      alert(err instanceof Error ? err.message : 'Failed to create workspace');
    }
  };

  if (loading) {
    return (
      <div className="mb-6">
  <h2 className="text-xl font-semibold mb-3 text-gray-800">Workspaces</h2>
        <div className="space-y-2">
          <div className="animate-pulse h-10 bg-gray-200 rounded-md"></div>
          <div className="animate-pulse h-10 bg-gray-200 rounded-md w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6">
  <h2 className="text-xl font-semibold mb-3 text-gray-800">Workspaces</h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <p className="text-sm font-medium">Error: {error}</p>
          <p className="text-xs mt-1">
            Make sure AnythingLLM is running at {ANYTHINGLLM_ENDPOINT} and that your API key is correct.
          </p>
          <div className="mt-3 flex space-x-3">
            <button
              className="text-sm text-red-600 hover:text-red-800 underline"
              onClick={fetchWorkspaces}
            >
              Try again
            </button>
            <button
              className="text-sm text-gray-600 hover:text-gray-800 underline"
              onClick={() => {
                // Create a temporary link to enable mock data for debugging
                const useLocalStorage = typeof window !== 'undefined' && window.localStorage;
                if (useLocalStorage) {
                  localStorage.setItem('USE_MOCK_DATA', 'true');
                  window.location.reload();
                }
              }}
            >
              Use mock data
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
  <h2 className="text-xl font-semibold text-gray-800">Workspaces</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showCreateForm ? 'Cancel' : '+ New'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateWorkspace} className="mb-4 p-3 bg-blue-50 rounded-md">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Workspace Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="Enter workspace name"
              className="flex-1 p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-600"
              required
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {workspaces.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-md border border-gray-200">
          <p className="text-gray-600 mb-2">No workspaces found</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Create your first workspace
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <select
            value={selectedWorkspace?.slug || ''}
            onChange={(e) => {
              const newSlug = e.target.value;
              if (newSlug === (selectedWorkspace?.slug || '')) return; // No actual change

              const workspace = workspaces.find(w => w.slug === newSlug);
              if (!workspace) return; // invalid selection

              // If there is an existing workspace selected, confirm reset
              if (selectedWorkspace) {
                const message = confirmationMessage || 'Changing workspace will reset the Company Summary and all Analysis Questions. Continue?';
                const confirmed = window.confirm(message);
                if (!confirmed) {
                  // Revert selection by not calling onWorkspaceSelect (controlled value remains old slug)
                  return;
                }
              }

              onWorkspaceSelect(workspace);
            }}
            className="w-full p-2.5 bg-white border border-gray-400 text-gray-800 placeholder-gray-500 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a workspace</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.slug}>
                {workspace.name}
              </option>
            ))}
          </select>
          
          {selectedWorkspace && (
            <div className="mt-2 text-sm text-gray-600">
              Currently analyzing: <span className="font-medium">{selectedWorkspace.name}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
