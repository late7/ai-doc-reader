'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FactSheetTabProps {
    workspaceSlug: string;
    sectionId: string;
    sectionTitle: string;
    canonical: CanonicalDoc | null;
    fileStatus: FileStatus | null;
    onProcessed: () => void;
}

interface CanonicalDoc {
    sectionId: string;
    title: string;
    score: number | null;
    summary: string;
    details: Array<{ point: string; evidence: string; sentiment: string; source: string }>;
    strengths: string[];
    weaknesses: string[];
    openQuestions: string[];
    sourcesProcessed: string[];
    lastUpdated: string | null;
}

interface FileStatus {
    files: Array<{
        name: string;
        originalName: string;
        size: number;
        modifiedTime: string;
        processedTime: string | null;
        isNew: boolean;
    }>;
    newFilesCount: number;
    processedFilesCount: number;
    lastProcessedAt: string | null;
}

interface ProcessStatus {
    status: 'idle' | 'running' | 'completed' | 'error';
    progress: string;
    error: string | null;
}

export default function FactSheetTab({
    workspaceSlug,
    sectionId,
    sectionTitle,
    canonical,
    fileStatus,
    onProcessed,
}: FactSheetTabProps) {
    const [processStatus, setProcessStatus] = useState<ProcessStatus>({ status: 'idle', progress: '', error: null });
    const [showPromptEditor, setShowPromptEditor] = useState(false);
    const [analysisPrompt, setAnalysisPrompt] = useState('');
    const [summaryPrompt, setSummaryPrompt] = useState('');
    const [isSavingPrompts, setIsSavingPrompts] = useState(false);
    const [activeView, setActiveView] = useState<'summary' | 'details' | 'raw'>('summary');
    const [showFileList, setShowFileList] = useState(false);

    // Load prompts
    useEffect(() => {
        loadPrompts();
    }, [sectionId]);

    // Poll for processing status
    useEffect(() => {
        if (processStatus.status !== 'running') return;

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/fact-sheet/status?workspace=${workspaceSlug}&section=${sectionId}`);
                if (response.ok) {
                    const data = await response.json();
                    setProcessStatus(data);
                    if (data.status === 'completed') {
                        onProcessed();
                    }
                }
            } catch (error) {
                console.error('Error polling status:', error);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [processStatus.status, workspaceSlug, sectionId, onProcessed]);

    const loadPrompts = async () => {
        try {
            const response = await fetch('/api/fact-sheet/prompts');
            if (response.ok) {
                const data = await response.json();
                const sectionPrompts = data.prompts?.sections?.[sectionId];
                if (sectionPrompts) {
                    setAnalysisPrompt(sectionPrompts.analysisPrompt || '');
                    setSummaryPrompt(sectionPrompts.summaryPrompt || '');
                }
            }
        } catch (error) {
            console.error('Error loading prompts:', error);
        }
    };

    const savePrompts = async () => {
        setIsSavingPrompts(true);
        try {
            // Load current full prompts, update this section, save back
            const loadRes = await fetch('/api/fact-sheet/prompts');
            if (loadRes.ok) {
                const data = await loadRes.json();
                const prompts = data.prompts;
                if (!prompts.sections) prompts.sections = {};
                prompts.sections[sectionId] = { analysisPrompt, summaryPrompt };

                await fetch('/api/fact-sheet/prompts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompts }),
                });
            }
        } catch (error) {
            console.error('Error saving prompts:', error);
        } finally {
            setIsSavingPrompts(false);
        }
    };

    const startProcessing = async (processNewOnly: boolean) => {
        setProcessStatus({ status: 'running', progress: 'Starting...', error: null });

        try {
            fetch('/api/fact-sheet/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, sectionId, processNewOnly }),
            }).then(async (response) => {
                const data = await response.json();
                if (!response.ok) {
                    setProcessStatus({ status: 'error', progress: '', error: data.message || 'Processing failed' });
                }
            }).catch((error) => {
                console.error('Processing error:', error);
            });
        } catch (error) {
            setProcessStatus({ status: 'error', progress: '', error: 'Failed to start processing' });
        }
    };

    const resetSection = async () => {
        if (!confirm(`Reset ${sectionTitle}? This will delete the canonical document and all processing history for this section.`)) return;

        try {
            const response = await fetch(`/api/fact-sheet/file-status?workspace=${workspaceSlug}&section=${sectionId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                onProcessed();
            }
        } catch (error) {
            console.error('Error resetting section:', error);
        }
    };

    const hasData = canonical && canonical.summary;
    const hasSources = canonical && canonical.sourcesProcessed && canonical.sourcesProcessed.length > 0;

    return (
        <div className="flex flex-col h-full">
            {/* Action Bar */}
            <div className="border-b border-gray-100 px-4 py-2 bg-gray-50/50">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {/* Process buttons */}
                        <button
                            onClick={() => startProcessing(false)}
                            disabled={processStatus.status === 'running'}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                processStatus.status === 'running'
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        >
                            {processStatus.status === 'running' ? (
                                <span className="flex items-center gap-1">
                                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Processing...
                                </span>
                            ) : (
                                'Process All'
                            )}
                        </button>

                        {fileStatus && fileStatus.newFilesCount > 0 && fileStatus.processedFilesCount > 0 && (
                            <button
                                onClick={() => startProcessing(true)}
                                disabled={processStatus.status === 'running'}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                    processStatus.status === 'running'
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                            >
                                + {fileStatus.newFilesCount} New
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        {/* File status summary */}
                        {fileStatus && (
                            <button
                                onClick={() => setShowFileList(!showFileList)}
                                className="text-gray-700 hover:text-gray-900"
                            >
                                📄 {fileStatus.processedFilesCount}/{fileStatus.files.length}
                                {fileStatus.newFilesCount > 0 && (
                                    <span className="ml-1 text-amber-700">({fileStatus.newFilesCount} new)</span>
                                )}
                            </button>
                        )}

                        <button
                            onClick={() => setShowPromptEditor(!showPromptEditor)}
                            className="text-gray-700 hover:text-gray-900"
                            title="Edit prompts"
                        >
                            ⚙️
                        </button>

                        {hasSources && (
                            <button
                                onClick={resetSection}
                                className="text-red-400 hover:text-red-600"
                                title="Reset section"
                            >
                                🔄
                            </button>
                        )}
                    </div>
                </div>

                {/* Processing status */}
                {processStatus.status === 'running' && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
                        <p className="text-xs text-blue-800">{processStatus.progress || 'Processing...'}</p>
                    </div>
                )}
                {processStatus.status === 'error' && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded px-3 py-1.5">
                        <p className="text-xs text-red-800">Error: {processStatus.error}</p>
                    </div>
                )}

                {/* File list expandable */}
                {showFileList && fileStatus && fileStatus.files.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto border border-gray-200 rounded bg-white">
                        {fileStatus.files.map((file) => (
                            <div
                                key={file.name}
                                className={`flex items-center justify-between text-xs px-2 py-1 border-b border-gray-50 ${
                                    file.isNew ? 'bg-amber-50' : ''
                                }`}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${file.isNew ? 'bg-amber-500' : 'bg-gray-400'}`} />
                                    <span className="text-gray-700 truncate max-w-[200px]" title={file.originalName}>
                                        {file.originalName}
                                    </span>
                                </div>
                                <span className="text-gray-600">
                                    {file.isNew ? <span className="text-amber-700">new</span> : '✓'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Prompt Editor */}
            {showPromptEditor && (
                <div className="border-b border-gray-200 px-4 py-3 bg-yellow-50/50 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Prompts for {sectionTitle}</h4>
                    <div>
                        <label className="text-xs text-gray-800 font-medium">Analysis Prompt (per document):</label>
                        <textarea
                            value={analysisPrompt}
                            onChange={(e) => setAnalysisPrompt(e.target.value)}
                            rows={3}
                            className="w-full mt-1 px-2 py-1.5 text-xs text-gray-800 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-800 font-medium">Summary Prompt (canonical update):</label>
                        <textarea
                            value={summaryPrompt}
                            onChange={(e) => setSummaryPrompt(e.target.value)}
                            rows={3}
                            className="w-full mt-1 px-2 py-1.5 text-xs text-gray-800 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                        />
                    </div>
                    <button
                        onClick={savePrompts}
                        disabled={isSavingPrompts}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md font-medium"
                    >
                        {isSavingPrompts ? 'Saving...' : 'Save Prompts'}
                    </button>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-auto">
                {hasData ? (
                    <div className="p-4 space-y-4">
                        {/* View Tabs */}
                        <div className="flex border-b border-gray-200">
                            {(['summary', 'details', 'raw'] as const).map((view) => (
                                <button
                                    key={view}
                                    onClick={() => setActiveView(view)}
                                    className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors capitalize ${
                                        activeView === view
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-600 hover:text-gray-800'
                                    }`}
                                >
                                    {view}
                                </button>
                            ))}
                        </div>

                        {activeView === 'summary' && (
                            <div className="prose prose-sm prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {canonical!.summary || '_No summary generated yet. Process documents to generate._'}
                                </ReactMarkdown>

                                {/* Quick stats */}
                                <div className="mt-4 grid grid-cols-2 gap-2 not-prose">
                                    {canonical!.strengths.length > 0 && (
                                        <div className="bg-green-50 rounded-lg p-3">
                                            <h5 className="text-xs font-semibold text-green-800 mb-1.5">✅ Strengths</h5>
                                            <ul className="space-y-1">
                                                {canonical!.strengths.map((s, i) => (
                                                    <li key={i} className="text-xs text-green-700">• {s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {canonical!.weaknesses.length > 0 && (
                                        <div className="bg-red-50 rounded-lg p-3">
                                            <h5 className="text-xs font-semibold text-red-800 mb-1.5">⚠️ Weaknesses</h5>
                                            <ul className="space-y-1">
                                                {canonical!.weaknesses.map((w, i) => (
                                                    <li key={i} className="text-xs text-red-700">• {w}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {canonical!.openQuestions.length > 0 && (
                                    <div className="mt-3 bg-amber-50 rounded-lg p-3 not-prose">
                                        <h5 className="text-xs font-semibold text-amber-800 mb-1.5">❓ Open Questions</h5>
                                        <ul className="space-y-1">
                                            {canonical!.openQuestions.map((q, i) => (
                                                <li key={i} className="text-xs text-amber-700">• {q}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeView === 'details' && (
                            <div className="space-y-2">
                                {canonical!.details.length === 0 ? (
                                    <p className="text-xs text-gray-600 italic">No detailed findings yet.</p>
                                ) : (
                                    canonical!.details.map((detail, i) => (
                                        <div key={i} className={`border rounded-lg p-3 text-xs ${
                                            detail.sentiment === 'positive' ? 'border-green-200 bg-green-50/50' :
                                            detail.sentiment === 'negative' ? 'border-red-200 bg-red-50/50' :
                                            'border-gray-200 bg-gray-50/50'
                                        }`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-medium text-gray-800">{detail.point}</p>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                    detail.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                                                    detail.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {detail.sentiment}
                                                </span>
                                            </div>
                                            {detail.evidence && (
                                                <p className="mt-1 text-gray-600 italic">&quot;{detail.evidence}&quot;</p>
                                            )}
                                            <p className="mt-1 text-gray-600">Source: {detail.source}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeView === 'raw' && (
                            <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap border border-gray-200">
                                {JSON.stringify(canonical, null, 2)}
                            </pre>
                        )}

                        {/* Sources */}
                        {hasSources && (
                            <div className="pt-2 border-t border-gray-100">
                                <p className="text-[10px] text-gray-600">
                                    Sources: {canonical!.sourcesProcessed.join(', ')}
                                    {canonical!.lastUpdated && ` • Last updated: ${new Date(canonical!.lastUpdated).toLocaleString()}`}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center p-8">
                        <div className="text-center">
                            <div className="text-4xl mb-3">📄</div>
                            <h3 className="text-sm font-medium text-gray-800 mb-1">No data yet for {sectionTitle}</h3>
                            <p className="text-xs text-gray-600 max-w-xs">
                                Click &quot;Process All&quot; to analyze workspace documents and build the canonical document for this section.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
