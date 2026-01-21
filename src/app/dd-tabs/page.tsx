'use client';

import { useState, useRef, Suspense } from 'react';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import DocumentUploader, { DocumentUploaderRef } from '@/components/DocumentUploader';
import DDTabsContainer from '@/components/DDTabsContainer';
import MainNavigation from '@/components/MainNavigation';
import { usePersistentWorkspace } from '@/lib/usePersistentWorkspace';

interface Workspace {
    id: number;
    name: string;
    slug: string;
}

export default function DDTabsPage() {
    const [selectedWorkspace, setSelectedWorkspace] = usePersistentWorkspace();
    const [refreshKey, setRefreshKey] = useState(0);
    const documentUploaderRef = useRef<DocumentUploaderRef>(null);

    const handleWorkspaceSelect = (workspace: Workspace) => {
        setSelectedWorkspace(workspace);
        setRefreshKey(prev => prev + 1);
    };

    const handleUploadComplete = () => {
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="w-[98%] max-w-[98%] mx-auto px-3 py-4 sm:px-4 lg:px-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                                DD Tabs
                            </h1>
                            <p className="mt-1 text-gray-600">
                                AI-Powered Due Diligence Process & Analysis
                            </p>
                        </div>
                        <MainNavigation />
                    </div>
                </div>
            </header>

            <main className="w-[98%] max-w-[98%] mx-auto px-3 py-4 sm:px-4 lg:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
                            <Suspense fallback={<div className="h-10 w-full bg-gray-100 animate-pulse rounded-lg"></div>}>
                                <WorkspaceSelector
                                    onWorkspaceSelect={handleWorkspaceSelect}
                                    selectedWorkspace={selectedWorkspace}
                                />
                            </Suspense>

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

                    {/* Main Content - 4 Tab Panels */}
                    <div className="lg:col-span-5">
                        {selectedWorkspace ? (
                            <DDTabsContainer
                                key={refreshKey}
                                workspaceSlug={selectedWorkspace.slug}
                            />
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
                                    Select a workspace to begin
                                </h2>
                                <p className="mt-2 text-gray-500 max-w-md mx-auto">
                                    Choose an AnythingLLM workspace from the sidebar to access Due Diligence reporting tools.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
