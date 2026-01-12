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

interface FileInfo {
    name: string;
    originalName: string;
    size: number;
    modifiedTime: string;
    processedTime: string | null;
    isNew: boolean;
}

interface FileStatus {
    files: FileInfo[];
    newFilesCount: number;
    processedFilesCount: number;
    lastProcessedAt: string | null;
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
    const [fileStatus, setFileStatus] = useState<FileStatus | null>(null);
    const [showFileList, setShowFileList] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // Load master document and file status on mount
    useEffect(() => {
        loadMasterDocument();
        loadFileStatus();
    }, [workspaceSlug]);

    const loadFileStatus = async () => {
        try {
            const response = await fetch(`/api/dd-process/file-status?workspace=${workspaceSlug}`);
            if (response.ok) {
                const data = await response.json();
                setFileStatus(data);
            }
        } catch (error) {
            console.error('Error loading file status:', error);
        }
    };

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
                        loadFileStatus(); // Refresh file status after processing
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

    const startCloudCompilation = async (processNewOnly: boolean = false) => {
        setCompileStatus({ status: 'running', progress: 'Starting cloud processing...', error: null });
        onStatusChange('in_progress');

        try {
            // Make the API call without awaiting the full result
            // The server will process files and update status
            fetch('/api/dd-process/compile-cloud', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, processNewOnly }),
            }).then(async (response) => {
                // This callback happens when the full processing is done  
                const data = await response.json();
                if (!response.ok) {
                    setCompileStatus({
                        status: 'error',
                        progress: '',
                        error: data.message || 'Failed to process with cloud AI',
                    });
                    onStatusChange('not_started');
                }
            }).catch((error) => {
                console.error('Cloud compilation error:', error);
            });

            // Start polling for status updates (cloud processes files one by one)
            // The actual result will come from the status polling
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

    const resetMasterDocument = async () => {
        if (!confirm('This will delete the current master document and reset all file processing status. All files will need to be reprocessed. Continue?')) {
            return;
        }

        setIsResetting(true);
        try {
            const response = await fetch(`/api/dd-process/file-status?workspace=${workspaceSlug}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setMasterDoc(null);
                await loadFileStatus();
                onStatusChange('not_started');
            } else {
                const data = await response.json();
                alert(data.message || 'Failed to reset');
            }
        } catch (error) {
            console.error('Error resetting master document:', error);
            alert('Failed to reset master document');
        } finally {
            setIsResetting(false);
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
                        onClick={() => startCompilation()}
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

                    {/* Cloud AI Processing Button - Process All */}
                    <button
                        onClick={() => startCloudCompilation(false)}
                        disabled={compileStatus.status === 'running'}
                        title="Process all documents with OpenAI"
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

            {/* File Status Display */}
            {fileStatus && (
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                            {/* Unprocessed Files Badge */}
                            <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${fileStatus.newFilesCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {fileStatus.newFilesCount} unprocessed
                                </span>
                                <span className="text-xs text-gray-500">
                                    {fileStatus.processedFilesCount > 0 && `${fileStatus.processedFilesCount} processed`}
                                </span>
                            </div>

                            {/* Last Processed */}
                            {fileStatus.lastProcessedAt && (
                                <div className="text-xs text-gray-500">
                                    Last processed: {new Date(fileStatus.lastProcessedAt).toLocaleString()}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center space-x-2">
                            {/* Process New Only Button - Only show if there are new files */}
                            {fileStatus.newFilesCount > 0 && fileStatus.processedFilesCount > 0 && (
                                <button
                                    onClick={() => startCloudCompilation(true)}
                                    disabled={compileStatus.status === 'running'}
                                    title={`Process only ${fileStatus.newFilesCount} new file(s) and merge into existing document`}
                                    className={`
                                        px-3 py-1.5 rounded-lg font-medium text-xs transition-colors
                                        ${compileStatus.status === 'running'
                                            ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                            : 'bg-green-600 hover:bg-green-700 text-white'
                                        }
                                    `}
                                >
                                    <span className="flex items-center">
                                        <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        Process {fileStatus.newFilesCount} Unprocessed
                                    </span>
                                </button>
                            )}

                            {/* Toggle File List */}
                            <button
                                onClick={() => setShowFileList(!showFileList)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                {showFileList ? 'Hide files' : 'Show files'}
                            </button>

                            {/* Reset Button - Only show if there's a master document */}
                            {(fileStatus.processedFilesCount > 0 || masterDoc) && (
                                <button
                                    onClick={resetMasterDocument}
                                    disabled={isResetting || compileStatus.status === 'running'}
                                    title="Delete master document and reset file tracking to reprocess all files"
                                    className={`
                                        text-xs font-medium transition-colors
                                        ${isResetting || compileStatus.status === 'running'
                                            ? 'text-gray-400 cursor-not-allowed'
                                            : 'text-red-600 hover:text-red-800'
                                        }
                                    `}
                                >
                                    {isResetting ? 'Resetting...' : '🔄 Reset & Reprocess'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Expandable File List */}
                    {showFileList && fileStatus.files.length > 0 && (
                        <div className="mt-3 border-t border-gray-200 pt-3">
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                {fileStatus.files.map((file) => (
                                    <div
                                        key={file.name}
                                        className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${file.isNew ? 'bg-amber-50' : 'bg-white'
                                            }`}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <span className={`inline-block w-2 h-2 rounded-full ${file.isNew ? 'bg-amber-500' : 'bg-gray-400'}`}></span>
                                            <span className="font-medium text-gray-700 truncate max-w-[300px]" title={file.originalName}>
                                                {file.originalName}
                                            </span>
                                        </div>
                                        <span className="text-gray-500">
                                            {file.isNew ? (
                                                <span className="text-amber-600">Unprocessed</span>
                                            ) : (
                                                file.processedTime && new Date(file.processedTime).toLocaleDateString()
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

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
                                Click &quot;Process Documents&quot; to extract information from workspace files.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
