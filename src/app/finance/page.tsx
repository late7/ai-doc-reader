'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import DocumentUploader, { DocumentUploaderRef } from '@/components/DocumentUploader';
import FinanceAnalyzer from '@/components/FinanceAnalyzer';
import OpenAIFinanceAnalyzer from '@/components/OpenAIFinanceAnalyzer';
import AnalyzableFiguresManager from '@/components/AnalyzableFiguresManager';
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

interface AnalyzableFigure {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export default function FinancePage() {
  const [selectedWorkspace, setSelectedWorkspace] = usePersistentWorkspace();
  const [refreshKey, setRefreshKey] = useState(0);
  const [analysisMode, setAnalysisMode] = useState<'local' | 'openai'>('local');
  const [analyzableFigures, setAnalyzableFigures] = useState<AnalyzableFigure[]>([]);
  const documentUploaderRef = useRef<DocumentUploaderRef>(null);

  const handleWorkspaceSelect = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    // Force remount of FinanceAnalyzer to reset financial analysis results
    setRefreshKey(prev => prev + 1);
  };

  const handleUploadComplete = () => {
    // Reset financial analysis when new documents are uploaded
    setRefreshKey(prev => prev + 1);
  };

  const refreshDocuments = () => {
    if (documentUploaderRef.current) {
      documentUploaderRef.current.refreshDocuments();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-[1920px] mx-auto px-3 py-4 sm:px-4 lg:px-6">
          {/* Analyzable Figures Configuration */}
          <div className="mb-6">
            <AnalyzableFiguresManager onFiguresChange={setAnalyzableFigures} />
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Finance Dashboard
              </h1>
              <p className="mt-1 text-gray-600">
                Financial analysis and reporting tools
              </p>
              


              
              {/* Analysis Mode Selection */}
              <div className="mt-4">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-700">Analysis Method:</span>
                  <div className="relative">
                    <div className="flex items-center bg-gray-200 rounded-full p-1 w-80">
                      <button
                        type="button"
                        onClick={() => setAnalysisMode('local')}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-full transition-all duration-200 ${
                          analysisMode === 'local'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        📁 Local Workspace
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalysisMode('openai')}
                        className={`flex-1 py-2 px-4 text-sm font-medium rounded-full transition-all duration-200 ${
                          analysisMode === 'openai'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        🤖 OpenAI Assistant
                      </button>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {analysisMode === 'local' 
                    ? 'Uses local document storage and RAG for analysis (efficient but less accurate)' 
                    : 'Uses OpenAI ChatGPT Assistant for advanced document analysis (more accurate but uploads documents to OpenAI cloud under Paid plan DPA'
                  }
                </p>
              </div>
            </div>
            <div className="flex space-x-4 items-center">
              <Link
                href="/dashboard"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
              >
                📊 Analysis
              </Link>
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
        {analysisMode === 'local' ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
                <WorkspaceSelector
                  onWorkspaceSelect={handleWorkspaceSelect}
                  selectedWorkspace={selectedWorkspace}
                  confirmationMessage="Changing workspace will reset the Company Summary and all Analysis Questions and Financial Analysis. Continue?"
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
                <div className="bg-white rounded-lg shadow-md p-6">
                  <FinanceAnalyzer
                    key={refreshKey}
                    workspaceSlug={selectedWorkspace.slug}
                    workspaceName={selectedWorkspace.name}
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
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  </svg>
                  <h2 className="mt-4 text-xl font-semibold text-gray-600">
                    Select a workspace to begin
                  </h2>
                  <p className="mt-2 text-gray-500 max-w-md mx-auto">
                    Choose an AnythingLLM workspace from the sidebar to access financial analysis tools.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <OpenAIFinanceAnalyzer />
        )}
      </main>
    </div>
  );
}