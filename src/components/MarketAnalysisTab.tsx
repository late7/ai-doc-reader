'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarketAnalysisTabProps {
    workspaceSlug: string;
    onStatusChange: (status: 'not_started' | 'in_progress' | 'completed') => void;
}

interface MarketAnalysisResult {
    workspaceSlug: string;
    generatedAt: string;
    searchContextSize: 'high' | 'medium' | 'low';
    content: string;
    reasoningSummary?: string;
    webSources?: Array<{
        url: string;
        title?: string;
    }>;
}

export default function MarketAnalysisTab({ workspaceSlug, onStatusChange }: MarketAnalysisTabProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<MarketAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [searchContextSize, setSearchContextSize] = useState<'high' | 'medium' | 'low'>('medium');
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

    // Load existing results and prompts on mount
    useEffect(() => {
        loadExistingResults();
        loadPrompts();
    }, [workspaceSlug]);

    // Close export menu when clicking outside
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
            const response = await fetch('/api/dd-process/market-prompts');
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
        setPromptsSaved(false);
        try {
            const response = await fetch('/api/dd-process/market-prompts', {
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
            const response = await fetch('/api/dd-process/market-prompts', { method: 'DELETE' });
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
        setIsLoading(true);
        try {
            const response = await fetch(`/api/dd-process/market-analysis?workspace=${workspaceSlug}`);
            if (response.ok) {
                const data = await response.json();
                if (data.exists && data.data) {
                    setResult(data.data);
                    onStatusChange('completed');
                }
            }
        } catch (err) {
            console.error('Error loading market analysis:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const runMarketAnalysis = async () => {
        setIsRunning(true);
        setError(null);
        onStatusChange('in_progress');

        try {
            const response = await fetch('/api/dd-process/market-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceSlug,
                    searchContextSize,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to run market analysis');
            }

            setResult(data.data);
            onStatusChange('completed');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
            onStatusChange('not_started');
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
        a.download = `${workspaceSlug}-market-analysis.md`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    const markdownToRTF = (markdown: string): string => {
        let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}}\\fs24 ';
        const lines = markdown.split('\n');

        for (const line of lines) {
            let processedLine = line;

            if (line.startsWith('### ')) {
                processedLine = `\\b\\fs28 ${line.substring(4)}\\b0\\fs24 `;
            } else if (line.startsWith('## ')) {
                processedLine = `\\b\\fs32 ${line.substring(3)}\\b0\\fs24 `;
            } else if (line.startsWith('# ')) {
                processedLine = `\\b\\fs36 ${line.substring(2)}\\b0\\fs24 `;
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
                processedLine = `\\bullet  ${line.substring(2)}`;
            } else {
                processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '\\b $1\\b0 ');
                processedLine = processedLine.replace(/\*(.+?)\*/g, '\\i $1\\i0 ');
            }

            rtf += processedLine + '\\par ';
        }

        rtf += '}';
        return rtf;
    };

    const exportToRTF = () => {
        if (!result) return;
        const rtfContent = markdownToRTF(result.content);
        const blob = new Blob([rtfContent], { type: 'application/rtf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workspaceSlug}-market-analysis.rtf`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    };

    const exportToPDF = () => {
        if (!reportContentRef.current) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to export PDF');
            return;
        }

        const styles = `
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
                h1 { font-size: 24px; margin-bottom: 16px; }
                h2 { font-size: 20px; margin-top: 24px; margin-bottom: 12px; }
                h3 { font-size: 16px; margin-top: 16px; margin-bottom: 8px; }
                p { margin-bottom: 12px; }
                ul, ol { margin-left: 20px; margin-bottom: 12px; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; }
            </style>
        `;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Market Analysis - ${workspaceSlug}</title>
                ${styles}
            </head>
            <body>
                <h1>Market Analysis Report</h1>
                <p><strong>Generated:</strong> ${new Date(result?.generatedAt || '').toLocaleString()}</p>
                <p><strong>Search Context:</strong> ${result?.searchContextSize}</p>
                <hr />
                ${reportContentRef.current.innerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);

        setShowExportMenu(false);
    };

    const exportToDocx = async () => {
        if (!result) return;
        setShowExportMenu(false);

        try {
            const response = await fetch('/api/dd-process/export-docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    markdown: result.content,
                    filename: `${workspaceSlug}-market-analysis`,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.docx) {
                alert('Failed to generate DOCX: ' + (data.message || 'Unknown error'));
                return;
            }

            // Convert base64 to blob and download
            const binaryString = atob(data.docx);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error exporting to DOCX:', err);
            alert('Failed to export to DOCX');
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
            {/* Collapsible Prompt Editor */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                    onClick={() => setPromptsExpanded(!promptsExpanded)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                    <div className="flex items-center space-x-2">
                        <svg
                            className={`w-4 h-4 text-gray-600 transition-transform ${promptsExpanded ? 'rotate-90' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">AI Prompts Configuration</span>
                        {promptsModified && (
                            <span className="text-xs text-amber-600 font-medium">(unsaved changes)</span>
                        )}
                    </div>
                    <span className="text-xs text-gray-500">
                        {promptsExpanded ? 'Click to collapse' : 'Click to expand'}
                    </span>
                </button>

                {promptsExpanded && (
                    <div className="p-4 bg-white space-y-4 border-t border-gray-200">
                        {/* System Prompt */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                System Prompt (Developer)
                            </label>
                            <textarea
                                value={systemPrompt}
                                onChange={(e) => {
                                    setSystemPrompt(e.target.value);
                                    setPromptsModified(true);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={10}
                                placeholder="Enter system prompt..."
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Defines the AI's role and formatting guidelines
                            </p>
                        </div>

                        {/* User Prompt */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                User Prompt
                            </label>
                            <textarea
                                value={userPrompt}
                                onChange={(e) => {
                                    setUserPrompt(e.target.value);
                                    setPromptsModified(true);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={10}
                                placeholder="Enter user prompt..."
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                The analysis request. Master document content is automatically appended.
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-2">
                            <button
                                onClick={resetPrompts}
                                className="text-sm text-gray-600 hover:text-gray-800 underline"
                            >
                                Reset to defaults
                            </button>
                            <div className="flex items-center space-x-3">
                                {promptsSaved && (
                                    <span className="text-sm text-green-600 flex items-center">
                                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Saved!
                                    </span>
                                )}
                                <button
                                    onClick={savePrompts}
                                    disabled={promptsSaving || !promptsModified}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${promptsSaving || !promptsModified
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    {promptsSaving ? 'Saving...' : 'Save Prompts'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">Market Analysis</h3>
                    <p className="text-sm text-gray-600">
                        Web search-based market validation using canonical document
                    </p>
                </div>

                <div className="flex items-center space-x-3">
                    {/* Search Context Size Selector */}
                    <div className="flex items-center space-x-2">
                        <label className="text-xs text-gray-600">Search depth:</label>
                        <select
                            value={searchContextSize}
                            onChange={(e) => setSearchContextSize(e.target.value as 'high' | 'medium' | 'low')}
                            disabled={isRunning}
                            className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="low" className="text-gray-800">Low</option>
                            <option value="medium" className="text-gray-800">Medium</option>
                            <option value="high" className="text-gray-800">High</option>
                        </select>
                    </div>

                    {/* Run Button */}
                    <button
                        onClick={runMarketAnalysis}
                        disabled={isRunning}
                        className={`
                            px-4 py-2 rounded-lg font-medium text-sm transition-colors
                            ${isRunning
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : result
                                    ? 'bg-gray-500 hover:bg-gray-600 text-white'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }
                        `}
                    >
                        {isRunning ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analyzing...
                            </span>
                        ) : (
                            <span className="flex items-center">
                                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                {result ? 'Rerun Analysis' : 'Run Market Analysis'}
                            </span>
                        )}
                    </button>

                    {/* Export Menu */}
                    {result && (
                        <div className="relative" ref={exportMenuRef}>
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="px-4 py-2 rounded-lg font-medium text-sm bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center"
                            >
                                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export
                                <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                                    <div className="py-1">
                                        <button
                                            onClick={exportToDocx}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start"
                                        >
                                            <span className="text-blue-600 mr-3">📘</span>
                                            <div>
                                                <div className="text-sm font-medium text-gray-700">DOCX (Word)</div>
                                                <div className="text-xs text-gray-500">Best for editing</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={exportToPDF}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start"
                                        >
                                            <span className="text-red-500 mr-3">📄</span>
                                            <div>
                                                <div className="text-sm font-medium text-gray-700">PDF</div>
                                                <div className="text-xs text-gray-500">Print-ready format</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={exportToRTF}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start"
                                        >
                                            <span className="text-blue-500 mr-3">📝</span>
                                            <div>
                                                <div className="text-sm font-medium text-gray-700">RTF</div>
                                                <div className="text-xs text-gray-500">Legacy Word format</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={exportToMarkdown}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start"
                                        >
                                            <span className="text-gray-600 mr-3">📋</span>
                                            <div>
                                                <div className="text-sm font-medium text-gray-700">Markdown</div>
                                                <div className="text-xs text-gray-500">Plain text format</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">Error: {error}</p>
                </div>
            )}

            {/* Results Display */}
            <div className="flex-1 overflow-auto">
                {result ? (
                    <div className="space-y-4">
                        {/* Meta info */}
                        <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-4">
                                <span className="text-gray-600">
                                    Generated: {new Date(result.generatedAt).toLocaleString()}
                                </span>
                                <span className="text-gray-600">
                                    Search: {result.searchContextSize}
                                </span>
                            </div>
                            {result.webSources && result.webSources.length > 0 && (
                                <span className="text-blue-600">
                                    {result.webSources.length} web sources
                                </span>
                            )}
                        </div>

                        {/* Reasoning Summary */}
                        {result.reasoningSummary && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <h4 className="text-sm font-medium text-blue-800 mb-1">AI Reasoning</h4>
                                <p className="text-sm text-blue-700">{result.reasoningSummary}</p>
                            </div>
                        )}

                        {/* Main Content */}
                        <div
                            ref={reportContentRef}
                            className="bg-white border border-gray-200 rounded-lg p-6"
                        >
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-4">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-xl font-bold text-gray-900 mt-5 mb-3">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-lg font-semibold text-gray-800 mt-4 mb-2">{children}</h3>,
                                    h4: ({ children }) => <h4 className="text-base font-semibold text-gray-800 mt-3 mb-2">{children}</h4>,
                                    p: ({ children }) => <p className="text-gray-700 leading-relaxed mb-3">{children}</p>,
                                    strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                                    em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                                    ul: ({ children }) => <ul className="list-disc ml-6 mb-3 space-y-1">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal ml-6 mb-3 space-y-1">{children}</ol>,
                                    li: ({ children }) => <li className="text-gray-700">{children}</li>,
                                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">{children}</a>,
                                    blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-3">{children}</blockquote>,
                                    code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm text-gray-800">{children}</code>,
                                    pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>,
                                }}
                            >
                                {result.content}
                            </ReactMarkdown>
                        </div>

                        {/* Web Sources */}
                        {result.webSources && result.webSources.length > 0 && (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-gray-800 mb-2">Web Sources Referenced</h4>
                                <ul className="space-y-1">
                                    {result.webSources.map((source, index) => (
                                        <li key={index} className="text-sm">
                                            <a
                                                href={source.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                                {source.title || source.url}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <div className="text-center p-8">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <h3 className="mt-4 text-sm font-medium text-gray-900">No market analysis yet</h3>
                            <p className="mt-1 text-xs text-gray-500">
                                Run market analysis to validate company claims using web search.
                            </p>
                            <p className="mt-2 text-xs text-gray-400">
                                Requires processed Canonical Document.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
