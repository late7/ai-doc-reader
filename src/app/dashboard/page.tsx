'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import DocumentUploader, { DocumentUploaderRef } from '@/components/DocumentUploader';
import QuestionAnalyzer, { QuestionAnalyzerRef } from '@/components/QuestionAnalyzer';
import { usePersistentWorkspace } from '@/lib/usePersistentWorkspace';

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

export default function Dashboard() {
  const [selectedWorkspace, setSelectedWorkspace] = usePersistentWorkspace();
  const [refreshKey, setRefreshKey] = useState(0);
  const [financeEnabled, setFinanceEnabled] = useState(true);
  const documentUploaderRef = useRef<DocumentUploaderRef>(null);
  const analyzerRef = useRef<QuestionAnalyzerRef>(null);

  const handleWorkspaceSelect = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
  // Force remount of QuestionAnalyzer to reset company summary & analysis results
  setRefreshKey(prev => prev + 1);
  };

  const handleUploadComplete = () => {
    // Refresh any components that need to update after upload
    setRefreshKey(prev => prev + 1);
  };

  // Load finance setting from system config
  useEffect(() => {
    const loadSystemConfig = async () => {
      try {
        const response = await fetch('/api/system');
        if (response.ok) {
          const config = await response.json();
          setFinanceEnabled(config.financeEnabled ?? true);
        }
      } catch (error) {
        console.error('Failed to load system config:', error);
        // Default to true if config can't be loaded
        setFinanceEnabled(true);
      }
    };
    loadSystemConfig();
  }, []);

  const refreshDocuments = () => {
    if (documentUploaderRef.current) {
      documentUploaderRef.current.refreshDocuments();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-[1920px] mx-auto px-3 py-4 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Analysis Dashboard
              </h1>
              <p className="mt-1 text-gray-600">
                Analyze Company Documents with AI-powered insights from AnythingLLM
              </p>
            </div>
            <div className="flex space-x-4 items-center">
              {selectedWorkspace && (
                <button
                  onClick={() => analyzerRef.current?.exportReport()}
                  className="flex items-center px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium transition-colors disabled:bg-gray-300 disabled:text-gray-500"
                  disabled={!selectedWorkspace}
                >
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Report
                </button>
              )}
              {financeEnabled && (
                <Link 
                  href="/finance"
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors"
                >
                  💰 Finance
                </Link>
              )}
              <Link 
                href="/admin"
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium transition-colors"
              >
                🔧 Admin Panel
              </Link>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-[1920px] mx-auto px-3 py-4 sm:px-4 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
              <WorkspaceSelector 
                onWorkspaceSelect={handleWorkspaceSelect}
                selectedWorkspace={selectedWorkspace}
              />
              
              {selectedWorkspace && (
                <DocumentUploader
                  key={selectedWorkspace.slug}
                  ref={documentUploaderRef}
                  workspaceSlug={selectedWorkspace.slug}
                  onUploadComplete={handleUploadComplete}
                />
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-4">
            {selectedWorkspace ? (
              <div className="bg-white rounded-lg shadow-md p-4">
                <QuestionAnalyzer 
                  key={refreshKey}
                  ref={analyzerRef}
                  workspaceSlug={selectedWorkspace.slug}
                  onDocumentsRefresh={refreshDocuments}
                />
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <svg 
                  className="mx-auto h-16 w-16 text-gray-400" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  aria-hidden="true"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                  />
                </svg>
                <h2 className="mt-4 text-xl font-semibold text-gray-600">
                  Select a workspace to begin analysis
                </h2>
                <p className="mt-2 text-gray-500 max-w-md mx-auto">
                  Choose an AnythingLLM workspace from the sidebar to start analyzing documents and generating insights.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
