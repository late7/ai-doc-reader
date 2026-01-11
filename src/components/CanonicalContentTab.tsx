'use client';

import { useState, useEffect, useCallback } from 'react';
import MasterDocEditor from './MasterDocEditor';

interface CanonicalContentTabProps {
    workspaceSlug: string;
    onStatusChange: (status: 'not_started' | 'in_progress' | 'completed') => void;
}

interface CompileStatus {
    status: 'idle' | 'running' | 'completed' | 'error';
    progress: string;
    error: string | null;
}

interface MasterDocument {
    [key: string]: unknown;
}

export default function CanonicalContentTab({ workspaceSlug, onStatusChange }: CanonicalContentTabProps) {
    const [compileStatus, setCompileStatus] = useState<CompileStatus>({
        status: 'idle',
        progress: '',
        error: null,
    });
    const [masterDoc, setMasterDoc] = useState<MasterDocument | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Load master document on mount
    useEffect(() => {
        loadMasterDocument();
    }, [workspaceSlug]);

    const loadMasterDocument = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/dd-process/master-doc?workspace=${workspaceSlug}`);
            if (response.ok) {
                const data = await response.json();
                if (data.document) {
                    setMasterDoc(data.document);
                    onStatusChange('completed');
                } else {
                    setMasterDoc(null);
                }
            }
        } catch (error) {
            console.error('Error loading master document:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Poll for compile status while running
    useEffect(() => {
        if (compileStatus.status !== 'running') return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/dd-process/status?workspace=${workspaceSlug}`);
                if (response.ok) {
                    const data = await response.json();
                    setCompileStatus(data);

                    if (data.status === 'completed') {
                        onStatusChange('completed');
                        loadMasterDocument();
                    } else if (data.status === 'error') {
                        onStatusChange('not_started');
                    }
                }
            } catch (error) {
                console.error('Error polling status:', error);
            }
        }, 2000);

        return () => clearInterval(pollInterval);
    }, [compileStatus.status, workspaceSlug, onStatusChange]);

    const startCompilation = async () => {
        setCompileStatus({ status: 'running', progress: 'Starting compilation...', error: null });
        onStatusChange('in_progress');

        try {
            const response = await fetch('/api/dd-process/compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug }),
            });

            if (!response.ok) {
                const error = await response.json();
                setCompileStatus({
                    status: 'error',
                    progress: '',
                    error: error.message || 'Failed to start compilation',
                });
                onStatusChange('not_started');
            }
        } catch (error) {
            setCompileStatus({
                status: 'error',
                progress: '',
                error: 'Failed to start compilation',
            });
            onStatusChange('not_started');
        }
    };

    const startCloudCompilation = async () => {
        setCompileStatus({ status: 'running', progress: 'Starting cloud processing...', error: null });
        onStatusChange('in_progress');

        try {
            const response = await fetch('/api/dd-process/compile-cloud', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug }),
            });

            const data = await response.json();

            if (!response.ok) {
                setCompileStatus({
                    status: 'error',
                    progress: '',
                    error: data.message || 'Failed to process with cloud AI',
                });
                onStatusChange('not_started');
            } else {
                // Cloud processing is synchronous, so we get the result immediately
                setCompileStatus({
                    status: 'completed',
                    progress: data.message || 'Cloud processing completed!',
                    error: null,
                });
                onStatusChange('completed');
                loadMasterDocument();
            }
        } catch (error) {
            setCompileStatus({
                status: 'error',
                progress: '',
                error: 'Failed to connect to cloud AI service',
            });
            onStatusChange('not_started');
        }
    };

    const handleSave = async (updates: Record<string, unknown>) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/dd-process/master-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceSlug,
                    updates,
                }),
            });

            if (response.ok) {
                await loadMasterDocument();
            } else {
                console.error('Failed to save updates');
            }
        } catch (error) {
            console.error('Error saving updates:', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 h-full flex flex-col">
            {/* Header with Process Button */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">Document Processing</h3>
                    <p className="text-sm text-gray-600">
                        Extract information from workspace documents
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    {/* Local Python Processing Button */}
                    <button
                        onClick={startCompilation}
                        disabled={compileStatus.status === 'running'}
                        title="Process documents locally using Python chunking"
                        className={`
                            px-4 py-2 rounded-lg font-medium text-sm transition-colors
                            ${compileStatus.status === 'running'
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }
                        `}
                    >
                        {compileStatus.status === 'running' ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </span>
                        ) : (
                            <span className="flex items-center">
                                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Local Process
                            </span>
                        )}
                    </button>

                    {/* Cloud AI Processing Button */}
                    <button
                        onClick={startCloudCompilation}
                        disabled={compileStatus.status === 'running'}
                        title="Send files to OpenAI for cloud-based analysis"
                        className={`
                            px-4 py-2 rounded-lg font-medium text-sm transition-colors
                            ${compileStatus.status === 'running'
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }
                        `}
                    >
                        {compileStatus.status === 'running' ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </span>
                        ) : (
                            <span className="flex items-center">
                                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                ☁️ Cloud AI
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Status Display */}
            {compileStatus.status === 'running' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">{compileStatus.progress || 'Processing...'}</p>
                </div>
            )}

            {compileStatus.status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">Error: {compileStatus.error}</p>
                </div>
            )}

            {/* Master Document Editor */}
            <div className="flex-1 overflow-auto">
                {masterDoc ? (
                    <MasterDocEditor
                        document={masterDoc}
                        onSave={handleSave}
                        isSaving={isSaving}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <div className="text-center p-8">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h3 className="mt-4 text-sm font-medium text-gray-900">No processed document</h3>
                            <p className="mt-1 text-xs text-gray-500">
                                Click "Process Documents" to extract information from workspace files.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
