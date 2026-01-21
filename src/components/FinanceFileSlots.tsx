'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface SourceFileInfo {
    filename: string;
    originalName: string;
    size: number;
    uploadedAt: string;
    type: 'financial-model' | 'pnl' | 'balance-sheet' | 'supportive-docs';
}

interface FinanceFileSlotProps {
    workspaceSlug: string;
    fileType: 'financial-model' | 'pnl' | 'balance-sheet' | 'supportive-docs';
    label: string;
    description: string;
    icon: string;
    fileInfo?: SourceFileInfo;
    onFileChange?: (fileInfo: SourceFileInfo | null) => void;
    acceptedTypes: string;
    isProcessing?: boolean;
}

function FinanceFileSlot({
    workspaceSlug,
    fileType,
    label,
    description,
    icon,
    fileInfo,
    onFileChange,
    acceptedTypes,
    isProcessing = false
}: FinanceFileSlotProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = useCallback(async (file: File) => {
        setIsUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('workspaceSlug', workspaceSlug);
            formData.append('fileType', fileType);

            const response = await fetch('/api/dd-process/finance-source-files', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Upload failed');
            }

            const result = await response.json();
            onFileChange?.(result.fileInfo);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    }, [workspaceSlug, fileType, onFileChange]);

    const handleDelete = useCallback(async () => {
        try {
            const response = await fetch(
                `/api/dd-process/finance-source-files?workspace=${workspaceSlug}&fileType=${fileType}`,
                { method: 'DELETE' }
            );

            if (response.ok) {
                onFileChange?.(null);
            }
        } catch (err) {
            console.error('Failed to delete file:', err);
        }
    }, [workspaceSlug, fileType, onFileChange]);

    const handleDownload = useCallback(() => {
        if (!fileInfo) return;
        window.open(`/api/dd-process/finance-source-files/${fileType}?workspace=${workspaceSlug}`, '_blank');
    }, [fileInfo, fileType, workspaceSlug]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    }, [handleUpload]);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div
            className={`
                relative flex-1 min-w-[200px] rounded-xl border-2 transition-all duration-200
                ${isDragging ? 'border-blue-500 bg-blue-50' :
                    fileInfo ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50' :
                        'border-gray-200 border-dashed bg-white hover:border-gray-300 hover:bg-gray-50'}
                ${isProcessing ? 'opacity-60' : ''}
            `}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = '';
                }}
                className="hidden"
            />

            {isUploading ? (
                <div className="p-4 flex flex-col items-center justify-center min-h-[100px]">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2" />
                    <p className="text-xs text-gray-500">Uploading...</p>
                </div>
            ) : fileInfo ? (
                <div className="p-3">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{icon}</span>
                            <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">{label}</span>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={handleDownload}
                                className="p-1 rounded hover:bg-green-100 transition-colors text-green-600"
                                title="Download original file"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-1 rounded hover:bg-blue-100 transition-colors text-blue-600"
                                title="Replace file"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                            <button
                                onClick={handleDelete}
                                className="p-1 rounded hover:bg-red-100 transition-colors text-red-500"
                                title="Remove file"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="text-xs text-gray-700 font-medium truncate" title={fileInfo.originalName}>
                        {fileInfo.originalName}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        {formatFileSize(fileInfo.size)} • {new Date(fileInfo.uploadedAt).toLocaleDateString()}
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 flex flex-col items-center justify-center min-h-[100px] cursor-pointer"
                >
                    <span className="text-2xl mb-1 opacity-60">{icon}</span>
                    <span className="text-xs font-semibold text-gray-600 mb-0.5">{label}</span>
                    <span className="text-xs text-gray-400 text-center">{description}</span>
                </button>
            )}

            {error && (
                <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-red-50 text-xs text-red-600 text-center rounded-b-lg">
                    {error}
                </div>
            )}

            {isProcessing && fileInfo && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-blue-600">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                        Processing...
                    </div>
                </div>
            )}
        </div>
    );
}

interface FinanceFileSlotsProps {
    workspaceSlug: string;
    onFilesChange?: (files: {
        financialModel?: SourceFileInfo;
        pnl?: SourceFileInfo;
        balanceSheet?: SourceFileInfo;
        supportiveDocs?: SourceFileInfo;
    }) => void;
    onProcess?: () => void;
    isProcessing?: boolean;
}

export default function FinanceFileSlots({ workspaceSlug, onFilesChange, onProcess, isProcessing }: FinanceFileSlotsProps) {
    const [files, setFiles] = useState<{
        financialModel?: SourceFileInfo;
        pnl?: SourceFileInfo;
        balanceSheet?: SourceFileInfo;
        supportiveDocs?: SourceFileInfo;
    }>({});

    const loadFiles = useCallback(async () => {
        try {
            const response = await fetch(`/api/dd-process/finance-source-files?workspace=${workspaceSlug}`);
            if (response.ok) {
                const data = await response.json();
                if (data.exists && data.data?.files) {
                    setFiles(data.data.files);
                    onFilesChange?.(data.data.files);
                }
            }
        } catch (err) {
            console.error('Error loading source files:', err);
        }
    }, [workspaceSlug, onFilesChange]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    const handleFileChange = (key: 'financialModel' | 'pnl' | 'balanceSheet' | 'supportiveDocs', fileInfo: SourceFileInfo | null) => {
        setFiles(prev => {
            const newFiles = { ...prev };
            if (fileInfo) {
                newFiles[key] = fileInfo;
            } else {
                delete newFiles[key];
            }
            onFilesChange?.(newFiles);
            return newFiles;
        });
    };

    return (
        <div className="bg-gradient-to-r from-slate-50 to-zinc-50 rounded-xl p-4 border border-gray-200 mb-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Source Documents
                </h3>
            </div>
            <div className="flex gap-3 flex-wrap">
                <FinanceFileSlot
                    workspaceSlug={workspaceSlug}
                    fileType="financial-model"
                    label="Financial Model"
                    description="PDF only"
                    icon="📊"
                    fileInfo={files.financialModel}
                    onFileChange={(fi) => handleFileChange('financialModel', fi)}
                    acceptedTypes=".pdf"
                    isProcessing={isProcessing}
                />
                <FinanceFileSlot
                    workspaceSlug={workspaceSlug}
                    fileType="pnl"
                    label="P&L Statement"
                    description="PDF only"
                    icon="📈"
                    fileInfo={files.pnl}
                    onFileChange={(fi) => handleFileChange('pnl', fi)}
                    acceptedTypes=".pdf"
                    isProcessing={isProcessing}
                />
                <FinanceFileSlot
                    workspaceSlug={workspaceSlug}
                    fileType="balance-sheet"
                    label="Balance Sheet"
                    description="PDF only"
                    icon="📋"
                    fileInfo={files.balanceSheet}
                    onFileChange={(fi) => handleFileChange('balanceSheet', fi)}
                    acceptedTypes=".pdf"
                    isProcessing={isProcessing}
                />
                <FinanceFileSlot
                    workspaceSlug={workspaceSlug}
                    fileType="supportive-docs"
                    label="Supportive Docs"
                    description="PDF only"
                    icon="📁"
                    fileInfo={files.supportiveDocs}
                    onFileChange={(fi) => handleFileChange('supportiveDocs', fi)}
                    acceptedTypes=".pdf"
                    isProcessing={isProcessing}
                />
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-3">
                    <a
                        href="/Financials_Example_for_pdf_export.xlsx"
                        download="Financials_Example_for_pdf_export.xlsx"
                        className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5 font-medium border border-gray-200"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Excel Template
                    </a>
                    <span className="text-xs text-gray-400">|
                    </span>
                    <span className="text-xs text-gray-500">
                        {Object.keys(files).length}/4 uploaded
                    </span>
                </div>
                <button
                    onClick={onProcess}
                    disabled={isProcessing || Object.keys(files).length === 0}
                    className={`text-sm px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${isProcessing || Object.keys(files).length === 0
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                >
                    {isProcessing ? (
                        <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Processing...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            Extract Financial Data
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
