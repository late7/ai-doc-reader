'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TeamInvestorCard from './TeamInvestorCard';
import CaseOverviewCard from './CaseOverviewCard';

interface FactSheetTabProps {
    workspaceSlug: string;
    sectionId: string;
    sectionTitle: string;
    canonical: CanonicalDoc | null;
    fileStatus: FileStatus | null;
    onProcessed: () => void;
    isGlobalProcessing?: boolean;
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
    financialMetrics?: {
        currency: string | null;
        scalingNote: string | null;
        items: Array<{ label: string; value: number | null; formatted: string; period: string | null }>;
    } | null;
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
    isGlobalProcessing = false,
}: FactSheetTabProps) {
    const [processStatus, setProcessStatus] = useState<ProcessStatus>({ status: 'idle', progress: '', error: null });
    const [showPromptEditor, setShowPromptEditor] = useState(false);
    const [analysisPrompt, setAnalysisPrompt] = useState('');
    const [summaryPrompt, setSummaryPrompt] = useState('');
    const [webAnalysisPrompt, setWebAnalysisPrompt] = useState('');
    const [webSearchContextSize, setWebSearchContextSize] = useState<'low' | 'medium' | 'high'>('low');
    const [isSavingPrompts, setIsSavingPrompts] = useState(false);
    const [activeView, setActiveView] = useState<'summary' | 'details' | 'raw' | 'web-analysis' | 'web-analysis-raw'>('summary');
    const [showFileList, setShowFileList] = useState(false);

    // Web Analysis state
    const [webAnalysis, setWebAnalysis] = useState<Record<string, unknown> | null>(null);
    const [webAnalysisStatus, setWebAnalysisStatus] = useState<ProcessStatus>({ status: 'idle', progress: '', error: null });

    // Web Analysis Summary state
    const [webSummary, setWebSummary] = useState<{ markdown: string; webScore: string; generatedAt: string } | null>(null);
    const [webSummaryStatus, setWebSummaryStatus] = useState<ProcessStatus>({ status: 'idle', progress: '', error: null });

    // Load prompts
    useEffect(() => {
        loadPrompts();
    }, [sectionId]);

    // Load web analysis results and summary on mount
    useEffect(() => {
        loadWebAnalysis();
        loadWebSummary();
    }, [workspaceSlug, sectionId]);

    // Check initial processing status on mount (handles page reload during processing)
    useEffect(() => {
        const checkInitialStatus = async () => {
            try {
                const response = await fetch(`/api/fact-sheet/status?workspace=${workspaceSlug}&section=${sectionId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'running') {
                        setProcessStatus(data);
                    }
                }
            } catch (error) {
                console.error('Error checking initial status:', error);
            }
        };
        checkInitialStatus();
    }, [workspaceSlug, sectionId]);

    // Poll web analysis status
    useEffect(() => {
        if (webAnalysisStatus.status !== 'running') return;

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/fact-sheet/web-analysis?workspace=${workspaceSlug}&section=${sectionId}&poll=status`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.webAnalysis) {
                        setWebAnalysis(data.webAnalysis);
                        setWebAnalysisStatus({ status: 'completed', progress: 'Web analysis complete.', error: null });
                    }
                }
            } catch (error) {
                console.error('Error polling web analysis:', error);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [webAnalysisStatus.status, workspaceSlug, sectionId]);

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
                        console.log(`[FactSheet] ✅ Document processing complete for "${sectionTitle}"`);
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
                    setWebAnalysisPrompt(sectionPrompts.webAnalysisPrompt || '');
                    setWebSearchContextSize((sectionPrompts.searchContextSize as 'low' | 'medium' | 'high') || 'low');
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
                const sectionData: Record<string, string> = { analysisPrompt, summaryPrompt, webAnalysisPrompt, searchContextSize: webSearchContextSize };
                prompts.sections[sectionId] = sectionData;

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
        console.log(`[FactSheet] 📄 Starting document processing for "${sectionTitle}" (${sectionId}) — processNewOnly=${processNewOnly}`);
        setProcessStatus({ status: 'running', progress: 'Starting...', error: null });

        try {
            fetch('/api/fact-sheet/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, sectionId, processNewOnly }),
            }).then(async (response) => {
                const data = await response.json();
                if (!response.ok) {
                    console.error(`[FactSheet] ❌ Processing failed for "${sectionTitle}":`, data.message);
                    setProcessStatus({ status: 'error', progress: '', error: data.message || 'Processing failed' });
                }
            }).catch((error) => {
                console.error('[FactSheet] ❌ Processing error:', error);
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

    const loadWebAnalysis = async () => {
        try {
            const response = await fetch(`/api/fact-sheet/web-analysis?workspace=${workspaceSlug}&section=${sectionId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.webAnalysis) setWebAnalysis(data.webAnalysis);
            }
        } catch (error) {
            console.error('Error loading web analysis:', error);
        }
    };

    const loadWebSummary = async () => {
        try {
            const response = await fetch(`/api/fact-sheet/web-analysis-summary?workspace=${workspaceSlug}&section=${sectionId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.summary) setWebSummary(data.summary);
            }
        } catch (error) {
            console.error('Error loading web summary:', error);
        }
    };

    const startWebAnalysis = async () => {
        console.log(`[FactSheet] 🌐 Starting web analysis for "${sectionTitle}" (${sectionId})...`);
        setWebAnalysisStatus({ status: 'running', progress: 'Starting web analysis...', error: null });

        try {
            const response = await fetch('/api/fact-sheet/web-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, sectionId }),
            });
            const data = await response.json();
            if (response.ok && data.webAnalysis) {
                console.log(`[FactSheet] 🌐 Web analysis complete for "${sectionTitle}" — score: ${data.webAnalysis.overallWebScore ?? 'N/A'}/10. Generating summary...`);
                setWebAnalysis(data.webAnalysis);
                setWebAnalysisStatus({ status: 'completed', progress: 'Web analysis complete. Generating summary...', error: null });
                // Auto-trigger summary generation
                await startWebSummary();
            } else {
                setWebAnalysisStatus({ status: 'error', progress: '', error: data.error || 'Web analysis failed' });
            }
        } catch (error) {
            console.error('Web analysis error:', error);
            setWebAnalysisStatus({ status: 'error', progress: '', error: 'Failed to start web analysis' });
        }
    };

    const startWebSummary = async () => {
        setWebSummaryStatus({ status: 'running', progress: 'Generating executive summary...', error: null });

        try {
            const response = await fetch('/api/fact-sheet/web-analysis-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, sectionId }),
            });
            const data = await response.json();
            if (response.ok && data.summary) {
                console.log(`[FactSheet] 📊 Web summary generated for "${sectionTitle}" — pipeline complete`);
                setWebSummary(data.summary);
                setWebSummaryStatus({ status: 'completed', progress: 'Summary complete.', error: null });
                setWebAnalysisStatus({ status: 'completed', progress: 'Web analysis and summary complete.', error: null });
                setActiveView('web-analysis');
            } else {
                setWebSummaryStatus({ status: 'error', progress: '', error: data.error || 'Summary generation failed' });
                // Still switch to raw view since web analysis itself succeeded
                setActiveView('web-analysis-raw');
            }
        } catch (error) {
            console.error('Web summary error:', error);
            setWebSummaryStatus({ status: 'error', progress: '', error: 'Failed to generate summary' });
            setActiveView('web-analysis-raw');
        }
    };

    const hasData = canonical && canonical.summary;
    const hasSources = canonical && canonical.sourcesProcessed && canonical.sourcesProcessed.length > 0;
    const isProcessingDisabled = processStatus.status === 'running' || isGlobalProcessing;

    // Build a UUID filename → original name lookup from fileStatus
    const resolveSourceName = useCallback((uuidName: string): string => {
        if (!fileStatus) return uuidName;
        const match = fileStatus.files.find(f => f.name === uuidName);
        return match?.originalName || uuidName;
    }, [fileStatus]);

    return (
        <div className="flex flex-col h-full">
            {/* Action Bar */}
            <div className="border-b border-gray-100 px-4 py-2 bg-gray-50/50">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {/* Process buttons */}
                        <button
                            onClick={() => startProcessing(false)}
                            disabled={isProcessingDisabled}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                isProcessingDisabled
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
                            ) : isGlobalProcessing ? (
                                <span className="flex items-center gap-1">
                                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Queued...
                                </span>
                            ) : (
                                'Process'
                            )}
                        </button>

                        {fileStatus && fileStatus.newFilesCount > 0 && fileStatus.processedFilesCount > 0 && (
                            <button
                                onClick={() => startProcessing(true)}
                                disabled={isProcessingDisabled}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                    isProcessingDisabled
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                            >
                                + {fileStatus.newFilesCount} New
                            </button>
                        )}

                        {/* Web Analysis button */}
                        {hasSources && (
                            <button
                                onClick={startWebAnalysis}
                                disabled={webAnalysisStatus.status === 'running' || webSummaryStatus.status === 'running' || isProcessingDisabled}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                    webAnalysisStatus.status === 'running' || webSummaryStatus.status === 'running' || isProcessingDisabled
                                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                                }`}
                                title="Search the web for evidence and validate claims"
                            >
                                {webAnalysisStatus.status === 'running' || webSummaryStatus.status === 'running' ? (
                                    <span className="flex items-center gap-1">
                                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        {webSummaryStatus.status === 'running' ? 'Summarizing...' : 'Searching...'}
                                    </span>
                                ) : isProcessingDisabled ? (
                                    <span className="flex items-center gap-1">
                                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Wait...
                                    </span>
                                ) : (
                                    '🌐 Web Analysis'
                                )}
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
                                �️
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

                {/* Web analysis status */}
                {webAnalysisStatus.status === 'running' && (
                    <div className="mt-2 bg-purple-50 border border-purple-200 rounded px-3 py-1.5">
                        <p className="text-xs text-purple-800">{webAnalysisStatus.progress || 'Running web analysis...'}</p>
                    </div>
                )}
                {webAnalysisStatus.status === 'error' && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded px-3 py-1.5">
                        <p className="text-xs text-red-800">Web Analysis Error: {webAnalysisStatus.error}</p>
                    </div>
                )}
                {webSummaryStatus.status === 'running' && (
                    <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded px-3 py-1.5">
                        <p className="text-xs text-indigo-800">{webSummaryStatus.progress || 'Generating summary...'}</p>
                    </div>
                )}
                {webSummaryStatus.status === 'error' && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded px-3 py-1.5">
                        <p className="text-xs text-red-800">Summary Error: {webSummaryStatus.error}</p>
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
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-gray-800 font-medium">🌐 Web Analysis Prompt (web search):</label>
                            <div className="flex items-center gap-1.5">
                                <label className="text-xs text-gray-700">Context size:</label>
                                <select
                                    value={webSearchContextSize}
                                    onChange={(e) => setWebSearchContextSize(e.target.value as 'low' | 'medium' | 'high')}
                                    className="text-xs text-gray-800 border border-gray-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 bg-white"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                        </div>
                        <textarea
                            value={webAnalysisPrompt}
                            onChange={(e) => setWebAnalysisPrompt(e.target.value)}
                            rows={3}
                            className="w-full px-2 py-1.5 text-xs text-gray-800 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500"
                            placeholder="Prompt for web search analysis..."
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
                            {(['summary', 'details', 'raw', 'web-analysis', 'web-analysis-raw'] as const).map((view) => (
                                <button
                                    key={view}
                                    onClick={() => setActiveView(view as typeof activeView)}
                                    className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                                        activeView === view
                                            ? (view === 'web-analysis' || view === 'web-analysis-raw') ? 'border-purple-500 text-purple-600' : 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-600 hover:text-gray-800'
                                    }`}
                                >
                                    {view === 'web-analysis' ? (
                                        <span className="flex items-center gap-1">
                                            🌐 Web Analysis
                                            {webSummary && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />}
                                        </span>
                                    ) : view === 'web-analysis-raw' ? (
                                        <span className="flex items-center gap-1">
                                            Web Analysis Raw
                                            {webAnalysis && <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />}
                                        </span>
                                    ) : (
                                        <span className="capitalize">{view}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {activeView === 'summary' && sectionId === 'team-execution' && (
                            <TeamInvestorCard
                                score={canonical!.score}
                                summary={canonical!.summary}
                                strengths={canonical!.strengths}
                                weaknesses={canonical!.weaknesses}
                                openQuestions={canonical!.openQuestions}
                                webSummary={webSummary}
                                webAnalysis={webAnalysis}
                            />
                        )}

                        {activeView === 'summary' && sectionId === 'case-overview' && (
                            <CaseOverviewCard
                                score={canonical!.score}
                                summary={canonical!.summary}
                                strengths={canonical!.strengths}
                                weaknesses={canonical!.weaknesses}
                                openQuestions={canonical!.openQuestions}
                                webSummary={webSummary}
                                webAnalysis={webAnalysis}
                            />
                        )}

                        {activeView === 'summary' && sectionId !== 'team-execution' && sectionId !== 'case-overview' && (
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

                                {/* Financial Key Metrics — economics-finance section only */}
                                {sectionId === 'economics-finance' && canonical!.financialMetrics && canonical!.financialMetrics.items && canonical!.financialMetrics.items.length > 0 && (
                                    <div className="mt-4 not-prose">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h5 className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Key Financial Metrics</h5>
                                            {canonical!.financialMetrics.scalingNote && (
                                                <span className="text-[10px] text-gray-600 italic">{canonical!.financialMetrics.scalingNote}</span>
                                            )}
                                        </div>
                                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-gray-50 border-b border-gray-200">
                                                        <th className="text-left px-3 py-2 font-semibold text-gray-700">Metric</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-gray-700">Value</th>
                                                        <th className="text-right px-3 py-2 font-semibold text-gray-600 font-normal">Period</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {canonical!.financialMetrics.items.map((item, i) => (
                                                        <tr key={i} className={`border-b border-gray-100 last:border-0 ${item.value !== null ? '' : 'opacity-50'}`}>
                                                            <td className="px-3 py-2 text-gray-800 font-medium">{item.label}</td>
                                                            <td className="px-3 py-2 text-right text-gray-800 tabular-nums">{item.formatted}</td>
                                                            <td className="px-3 py-2 text-right text-gray-600">{item.period ?? '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

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

                                {/* Web Analysis Summary embedded in section summary */}
                                {webSummary && (
                                    <div className="mt-4 border-t border-purple-200 pt-4 not-prose">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-semibold text-purple-800">🌐 Web Analysis Summary</span>
                                            {webAnalysis?.overallWebScore != null && (
                                                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-bold">
                                                    {String(webAnalysis.overallWebScore)}/10
                                                </span>
                                            )}
                                        </div>
                                        <div className="prose prose-sm prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {webSummary.markdown}
                                            </ReactMarkdown>
                                        </div>
                                        {webSummary.generatedAt && (
                                            <p className="mt-1 text-[10px] text-gray-600">
                                                Web analysis: {new Date(webSummary.generatedAt).toLocaleString()}
                                            </p>
                                        )}
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
                                            <p className="mt-1 text-gray-600">Source: {resolveSourceName(detail.source)}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeView === 'raw' && (
                            <pre className="text-xs text-gray-800 bg-gray-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap border border-gray-200">
                                {JSON.stringify(canonical, null, 2)}
                            </pre>
                        )}

                        {/* Web Analysis Summary Tab */}
                        {activeView === 'web-analysis' && (
                            <div className="space-y-4">
                                {webSummary ? (
                                    <>
                                        <div className="prose prose-sm prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {webSummary.markdown}
                                            </ReactMarkdown>
                                        </div>
                                        {webSummary.generatedAt && (
                                            <p className="text-[10px] text-gray-600">
                                                Summary generated: {new Date(webSummary.generatedAt).toLocaleString()}
                                            </p>
                                        )}
                                    </>
                                ) : webSummaryStatus.status === 'running' ? (
                                    <div className="text-center py-8">
                                        <svg className="animate-spin h-8 w-8 mx-auto text-purple-500 mb-3" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <p className="text-sm text-gray-700">Generating executive summary...</p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="text-3xl mb-2">📊</div>
                                        <h4 className="text-sm font-medium text-gray-800 mb-1">No Web Analysis Summary Yet</h4>
                                        <p className="text-xs text-gray-600 max-w-xs mx-auto mb-3">
                                            {webAnalysis
                                                ? 'Web analysis data exists. Click below to generate a readable summary.'
                                                : 'Run the web analysis first using the 🌐 button above.'}
                                        </p>
                                        {webAnalysis && (
                                            <button
                                                onClick={startWebSummary}
                                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-md font-medium"
                                            >
                                                Generate Summary
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Web Analysis Raw Tab Content */}
                        {activeView === 'web-analysis-raw' && (
                            <div className="space-y-4">
                                {webAnalysis ? (
                                    <>
                                        {/* Web Analysis Summary */}
                                        {webAnalysis.summary && (
                                            <div className="prose prose-sm prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {webAnalysis.summary as string}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                        {/* Web Score */}
                                        {webAnalysis.overallWebScore != null && (
                                            <div className="flex items-center gap-2 bg-purple-50 rounded-lg p-3">
                                                <span className="text-xs font-semibold text-purple-800">Web Evidence Score:</span>
                                                <span className="text-lg font-bold text-purple-900">{String(webAnalysis.overallWebScore)}/10</span>
                                            </div>
                                        )}

                                        {/* Market Validation */}
                                        {Array.isArray(webAnalysis.marketValidation) && (webAnalysis.marketValidation as Array<Record<string, string>>).length > 0 && (
                                            <div className="bg-blue-50 rounded-lg p-3">
                                                <h5 className="text-xs font-semibold text-blue-800 mb-2">📊 Market Validation</h5>
                                                <div className="space-y-2">
                                                    {(webAnalysis.marketValidation as Array<Record<string, string>>).map((item, i) => (
                                                        <div key={i} className="border border-blue-200 rounded p-2 bg-white">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <p className="text-xs font-medium text-gray-800">{item.claim}</p>
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                                                                    item.verdict === 'supported' ? 'bg-green-100 text-green-700' :
                                                                    item.verdict === 'challenged' ? 'bg-red-100 text-red-700' :
                                                                    'bg-gray-100 text-gray-600'
                                                                }`}>
                                                                    {item.verdict}
                                                                </span>
                                                            </div>
                                                            <p className="mt-1 text-xs text-gray-700">{item.webEvidence}</p>
                                                            {item.source && <p className="mt-1 text-[10px] text-gray-600">Source: {item.source}</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Competitors */}
                                        {Array.isArray(webAnalysis.competitors) && (webAnalysis.competitors as Array<Record<string, string>>).length > 0 && (
                                            <div className="bg-amber-50 rounded-lg p-3">
                                                <h5 className="text-xs font-semibold text-amber-800 mb-2">🏢 Competitors Found</h5>
                                                <div className="space-y-1.5">
                                                    {(webAnalysis.competitors as Array<Record<string, string>>).map((comp, i) => (
                                                        <div key={i} className="flex items-start gap-2 text-xs">
                                                            <span className="font-medium text-gray-800 flex-shrink-0">{comp.name}:</span>
                                                            <span className="text-gray-700">{comp.description}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Risk Factors */}
                                        {Array.isArray(webAnalysis.riskFactors) && (webAnalysis.riskFactors as Array<Record<string, string>>).length > 0 && (
                                            <div className="bg-red-50 rounded-lg p-3">
                                                <h5 className="text-xs font-semibold text-red-800 mb-2">⚠️ Risk Factors</h5>
                                                <div className="space-y-1.5">
                                                    {(webAnalysis.riskFactors as Array<Record<string, string>>).map((risk, i) => (
                                                        <div key={i} className="text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                                    risk.severity === 'high' ? 'bg-red-200 text-red-800' :
                                                                    risk.severity === 'medium' ? 'bg-amber-200 text-amber-800' :
                                                                    'bg-gray-200 text-gray-700'
                                                                }`}>
                                                                    {risk.severity}
                                                                </span>
                                                                <span className="font-medium text-gray-800">{risk.risk}</span>
                                                            </div>
                                                            <p className="mt-0.5 text-gray-700 ml-12">{risk.evidence}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Last updated */}
                                        {webAnalysis.lastUpdated && (
                                            <p className="text-[10px] text-gray-600">
                                                Web analysis last updated: {new Date(webAnalysis.lastUpdated as string).toLocaleString()}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="text-3xl mb-2">🌐</div>
                                        <h4 className="text-sm font-medium text-gray-800 mb-1">No Web Analysis Yet</h4>
                                        <p className="text-xs text-gray-600 max-w-xs mx-auto">
                                            Click the &quot;🌐 Web Analysis&quot; button to search the web for market evidence, competitor data, and industry trends.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sources */}
                        {hasSources && (
                            <div className="pt-2 border-t border-gray-100">
                                <p className="text-[10px] text-gray-600">
                                    Sources: {canonical!.sourcesProcessed.map(s => resolveSourceName(s)).join(', ')}
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
