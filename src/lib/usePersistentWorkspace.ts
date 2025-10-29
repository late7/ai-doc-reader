'use client';

import { useState, useEffect } from 'react';

interface Workspace {
  id: number;
  name: string;
  slug: string;
  threads?: Array<{ user_id: string | null; slug: string; name: string }>;
  vectorTag?: string | null;
  createdAt?: string;
  lastUpdatedAt?: string;
  openAiPrompt?: string | null;
  similarityThreshold?: number;
  chatMode?: string;
}

const WORKSPACE_STORAGE_KEY = 'selectedWorkspace';

export function usePersistentWorkspace() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);

  // Load workspace from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (stored) {
        const workspace = JSON.parse(stored);
        setSelectedWorkspace(workspace);
      }
    } catch (error) {
      console.error('Error loading workspace from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
  }, []);

  // Save workspace to localStorage whenever it changes
  const setPersistentWorkspace = (workspace: Workspace | null) => {
    setSelectedWorkspace(workspace);
    try {
      if (workspace) {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
      } else {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error saving workspace to localStorage:', error);
    }
  };

  return [selectedWorkspace, setPersistentWorkspace] as const;
}