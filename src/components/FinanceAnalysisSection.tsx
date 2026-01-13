'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FinanceAnalysisSectionProps {
    workspaceSlug: string;
    financeData: any;
}

interface AnalysisResult {
    workspaceSlug: string;
    generatedAt: string;
    content: string;
    reasoningSummary?: string;
}

export default function FinanceAnalysisSection({ workspaceSlug, financeData }: FinanceAnalysisSectionProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const reportContentRef = useRef<HTMLDivElement>(null);

    // Prompt editor states
    const [promptsExpanded, setPromptsExpanded] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState('');
    const [userPrompt, setUserPrompt] = useState('');
    const [promptsSaving, setPromptsSaving] = useState(false);
    const [promptsSaved, setPromptsSaved] = useState(false);
    const [promptsModified, setPromptsModified] = useState(false);

    useEffect(() => {
        loadPrompts();
        loadExistingResults();
    }, [workspaceSlug]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadPrompts = async () => {
        try {
            const response = await fetch('/api/dd-process/finance-prompts');
            if (response.ok) {
                const data = await response.json();
                if (data.prompts) {
                    setSystemPrompt(data.prompts.systemPrompt || '');
                    setUserPrompt(data.prompts.userPrompt || '');
                }
            }
        } catch (err) {
            console.error('Error loading prompts:', err);
        }
    };

    const savePrompts = async () => {
        setPromptsSaving(true);
        try {
            const response = await fetch('/api/dd-process/finance-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt, userPrompt }),
            });
            if (response.ok) {
                setPromptsSaved(true);
                setPromptsModified(false);
                setTimeout(() => setPromptsSaved(false), 2000);
            }
        } catch (err) {
            console.error('Error saving prompts:', err);
        } finally {
            setPromptsSaving(false);
        }
    };

    const resetPrompts = async () => {
        if (!confirm('Reset prompts to default values?')) return;
        try {
            const response = await fetch('/api/dd-process/finance-prompts', { method: 'DELETE' });
            if (response.ok) {
                const data = await response.json();
                if (data.prompts) {
                    setSystemPrompt(data.prompts.systemPrompt || '');
                    setUserPrompt(data.prompts.userPrompt || '');
                    setPromptsModified(false);
                }
            }
        } catch (err) {
            console.error('Error resetting prompts:', err);
        }
    };

    const loadExistingResults = async () => {
        try {
            const response = await fetch(`/api/dd-process/finance-analysis?workspace=${workspaceSlug}`);
            if (response.ok) {
                const data = await response.json();
                if (data.exists && data.data) {
                    setResult(data.data);
                }
            }
        } catch (err) {
            console.error('Error loading finance analysis:', err);
        }
    };

    const runAnalysis = async () => {
        if (!financeData) return;
        setIsRunning(true);
        setError(null);

        try {
            const response = await fetch('/api/dd-process/finance-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, financeData }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to run analysis');
            }
            setResult(data.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsRunning(false);
        }
    };

    // Export functions
    const exportToMarkdown = () => {
        if (!result) return;
        const blob = new Blob([result.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workspaceSlug}-finance-analysis.md`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    const markdownToRTF = (markdown: string): string => {
        let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}\\fs24 ';
        for (const line of markdown.split('\n')) {
            let processedLine = line;
            if (line.startsWith('### ')) processedLine = `\\b\\fs28 ${line.slice(4)}\\b0\\fs24 `;
            else if (line.startsWith('## ')) processedLine = `\\b\\fs32 ${line.slice(3)}\\b0\\fs24 `;
            else if (line.startsWith('# ')) processedLine = `\\b\\fs36 ${line.slice(2)}\\b0\\fs24 `;
            else if (line.startsWith('- ')) processedLine = `\\bullet  ${line.slice(2)}`;
            else {
                processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '\\b $1\\b0 ');
                processedLine = processedLine.replace(/\*(.+?)\*/g, '\\i $1\\i0 ');
            }
            rtf += processedLine + '\\par ';
        }
        return rtf + '}';
    };

    const exportToRTF = () => {
        if (!result) return;
        const blob = new Blob([markdownToRTF(result.content)], { type: 'application/rtf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workspaceSlug}-finance-analysis.rtf`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    const exportToPDF = () => {
        if (!reportContentRef.current) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert('Please allow popups'); return; }

        printWindow.document.write(`<!DOCTYPE html><html><head><title>Finance Analysis</title>
            <style>body{font-family:Arial;padding:40px;line-height:1.6}h1{font-size:24px}h2{font-size:20px}h3{font-size:16px}ul,ol{margin-left:20px}</style>
            </head><body><h1>Finance Analysis Report</h1><p>Generated: ${new Date(result?.generatedAt || '').toLocaleString()}</p><hr/>
            ${reportContentRef.current.innerHTML}</body></html>`);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
        setShowExportMenu(false);
    };

    const exportToDocx = async () => {
        if (!result) return;
        setShowExportMenu(false);
        try {
            const response = await fetch('/api/dd-process/export-docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markdown: result.content, filename: `${workspaceSlug}-finance-analysis` }),
            });
            const data = await response.json();
            if (!response.ok || !data.docx) { alert('Failed to generate DOCX'); return; }

            const bytes = new Uint8Array(atob(data.docx).split('').map(c => c.charCodeAt(0)));
            const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = data.filename;
            a.click();
        } catch (err) {
            alert('Failed to export DOCX');
        }
    };

    return (
        <div className="mt-6 space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-800">🔍 Financial Due Diligence Analysis</h3>
            <p className="text-sm text-gray-600">AI-powered analysis comparing company claims with financial data</p>

            {/* Prompts Editor */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                    onClick={() => setPromptsExpanded(!promptsExpanded)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100"
                >
                    <div className="flex items-center gap-2">
                        <svg className={`w-4 h-4 transition-transform ${promptsExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">AI Prompts Configuration</span>
                        {promptsModified && <span className="text-xs text-amber-600">(unsaved)</span>}
                    </div>
                </button>

                {promptsExpanded && (
                    <div className="p-4 bg-white space-y-4 border-t">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt (Developer)</label>
                            <textarea
                                value={systemPrompt}
                                onChange={(e) => { setSystemPrompt(e.target.value); setPromptsModified(true); }}
                                className="w-full px-3 py-2 border rounded-md text-sm text-gray-800 resize-y"
                                rows={8}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">User Prompt</label>
                            <textarea
                                value={userPrompt}
                                onChange={(e) => { setUserPrompt(e.target.value); setPromptsModified(true); }}
                                className="w-full px-3 py-2 border rounded-md text-sm text-gray-800 resize-y"
                                rows={8}
                            />
                            <p className="text-xs text-gray-500 mt-1">Master document and finance data are automatically appended.</p>
                        </div>
                        <div className="flex justify-between">
                            <button onClick={resetPrompts} className="text-sm text-gray-600 hover:underline">Reset to defaults</button>
                            <div className="flex items-center gap-3">
                                {promptsSaved && <span className="text-sm text-green-600">✓ Saved!</span>}
                                <button
                                    onClick={savePrompts}
                                    disabled={promptsSaving || !promptsModified}
                                    className={`px-4 py-2 rounded-md text-sm font-medium ${promptsSaving || !promptsModified ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                >
                                    {promptsSaving ? 'Saving...' : 'Save Prompts'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <button
                    onClick={runAnalysis}
                    disabled={isRunning || !financeData}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${isRunning ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                >
                    {isRunning ? (
                        <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Analyzing...
                        </span>
                    ) : (
                        <span className="flex items-center">
                            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            {result ? 'Rerun Analysis' : 'Run Financial Analysis'}
                        </span>
                    )}
                </button>

                {result && (
                    <div className="relative" ref={exportMenuRef}>
                        <button
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            className="px-4 py-2 rounded-lg font-medium text-sm bg-green-600 hover:bg-green-700 text-white flex items-center"
                        >
                            Export ▼
                        </button>
                        {showExportMenu && (
                            <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                                <div className="py-1">
                                    <button onClick={exportToDocx} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">📘 DOCX (Word)</button>
                                    <button onClick={exportToPDF} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">📄 PDF</button>
                                    <button onClick={exportToRTF} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">📝 RTF</button>
                                    <button onClick={exportToMarkdown} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">📋 Markdown</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">Error: {error}</p>
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                        Generated: {new Date(result.generatedAt).toLocaleString()}
                    </div>
                    {result.reasoningSummary && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                            <h4 className="text-sm font-medium text-indigo-800 mb-1">AI Reasoning</h4>
                            <p className="text-sm text-indigo-700">{result.reasoningSummary}</p>
                        </div>
                    )}
                    <div ref={reportContentRef} className="bg-white border rounded-lg p-6 prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                            h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-4">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xl font-bold text-gray-900 mt-5 mb-3">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">{children}</h3>,
                            h4: ({ children }) => <h4 className="text-base font-semibold text-gray-900 mt-3 mb-2">{children}</h4>,
                            p: ({ children }) => <p className="text-gray-900 leading-relaxed mb-3">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc ml-6 mb-3 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal ml-6 mb-3 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-gray-900">{children}</li>,
                            strong: ({ children }) => <strong className="font-bold text-black">{children}</strong>,
                            em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
                            table: ({ children }) => <table className="w-full border-collapse border border-gray-300 my-4">{children}</table>,
                            thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
                            th: ({ children }) => <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-900">{children}</th>,
                            td: ({ children }) => <td className="border border-gray-300 px-3 py-2 text-gray-900">{children}</td>,
                        }}>
                            {result.content}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {!result && !isRunning && (
                <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
                    <p className="text-gray-500 text-sm">Run analysis to verify claims and assess financial alignment</p>
                </div>
            )}
        </div>
    );
}
