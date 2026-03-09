'use client';

import { useState, useRef, Suspense } from 'react';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import DocumentUploader, { DocumentUploaderRef } from '@/components/DocumentUploader';
import FactSheetContainer from '@/components/FactSheetContainer';
import MainNavigation from '@/components/MainNavigation';
import { usePersistentWorkspace } from '@/lib/usePersistentWorkspace';

interface Workspace {
    id: number;
    name: string;
    slug: string;
}

export default function FactSheetPage() {
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
                <div className="w-[98%] max-w-[98%] mx-auto px-3 py-3 sm:px-4 lg:px-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">📋</span>
                                <div>
                                    <h1 className="text-xl font-bold tracking-tight text-gray-900">
                                        Fact Sheet
                                    </h1>
                                    <p className="text-xs text-gray-600">
                                        AI-Powered Investment Analysis
                                    </p>
                                </div>
                            </div>
                            {selectedWorkspace && (
                                <div className="ml-4 flex items-center">
                                    <Suspense fallback={<div className="h-8 w-32 bg-gray-100 animate-pulse rounded-lg" />}>
                                        <WorkspaceSelector
                                            onWorkspaceSelect={handleWorkspaceSelect}
                                            selectedWorkspace={selectedWorkspace}
                                        />
                                    </Suspense>
                                </div>
                            )}
                        </div>
                        <MainNavigation />
                    </div>
                </div>
            </header>

            <main className="w-[98%] max-w-[98%] mx-auto px-3 py-3 sm:px-4 lg:px-6">
                {selectedWorkspace ? (
                    <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
                        {/* Sidebar - Documents */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 space-y-3">
                                {!selectedWorkspace ? (
                                    <Suspense fallback={<div className="h-10 w-full bg-gray-100 animate-pulse rounded-lg" />}>
                                        <WorkspaceSelector
                                            onWorkspaceSelect={handleWorkspaceSelect}
                                            selectedWorkspace={selectedWorkspace}
                                        />
                                    </Suspense>
                                ) : null}

                                <DocumentUploader
                                    key={selectedWorkspace.slug}
                                    ref={documentUploaderRef}
                                    workspaceSlug={selectedWorkspace.slug}
                                    onUploadComplete={handleUploadComplete}
                                />
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="lg:col-span-5">
                            <FactSheetContainer
                                key={refreshKey}
                                workspaceSlug={selectedWorkspace.slug}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="bg-white rounded-lg shadow-md p-8 text-center max-w-md">
                            <div className="text-5xl mb-4">📋</div>
                            <h2 className="text-xl font-semibold text-gray-700 mb-2">
                                Select a workspace to begin
                            </h2>
                            <p className="text-sm text-gray-600 mb-4">
                                Choose a workspace to analyze documents and generate the investment fact sheet.
                            </p>
                            <Suspense fallback={<div className="h-10 w-full bg-gray-100 animate-pulse rounded-lg" />}>
                                <WorkspaceSelector
                                    onWorkspaceSelect={handleWorkspaceSelect}
                                    selectedWorkspace={selectedWorkspace}
                                />
                            </Suspense>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
