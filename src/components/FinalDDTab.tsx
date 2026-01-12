'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FinalDDTabProps {
    workspaceSlug: string;
    onStatusChange: (status: 'not_started' | 'in_progress' | 'completed') => void;
}

export default function FinalDDTab({ workspaceSlug, onStatusChange }: FinalDDTabProps) {
    const [report, setReport] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCached, setIsCached] = useState(false);

    useEffect(() => {
        loadReport(false);
    }, [workspaceSlug]);

    const loadReport = async (regenerate: boolean) => {
        if (regenerate) {
            setIsGenerating(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const response = await fetch('/api/dd-process/generate-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, regenerate }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || 'Failed to generate report');
                setReport(null);
                onStatusChange('not_started');
            } else if (data.report) {
                setReport(data.report);
                setIsCached(data.cached || false);
                onStatusChange('completed');
            } else {
                setError('No report generated');
                setReport(null);
                onStatusChange('not_started');
            }
        } catch (err) {
            console.error('Error loading report:', err);
            setError('Failed to connect to server');
            onStatusChange('not_started');
        } finally {
            setIsLoading(false);
            setIsGenerating(false);
        }
    };

    // Convert markdown to RTF
    const markdownToRTF = (md: string): string => {
        let rtf = '{\\rtf1\\ansi\\deff0\n';
        rtf += '{\\fonttbl{\\f0 Arial;}{\\f1 Times New Roman;}}\n';
        rtf += '{\\colortbl;\\red0\\green0\\blue0;\\red51\\green51\\blue51;\\red100\\green100\\blue100;}\n';
        rtf += '\\f0\\fs24\n';

        // Process markdown line by line
        const lines = md.split('\n');

        for (const line of lines) {
            let processedLine = line;

            // Escape RTF special characters first
            processedLine = processedLine.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');

            // Headers
            if (processedLine.startsWith('# ')) {
                processedLine = `\\par\\b\\fs48 ${processedLine.slice(2)}\\b0\\fs24\\par\n`;
            } else if (processedLine.startsWith('## ')) {
                processedLine = `\\par\\b\\fs36 ${processedLine.slice(3)}\\b0\\fs24\\par\n`;
            } else if (processedLine.startsWith('### ')) {
                processedLine = `\\par\\b\\fs32 ${processedLine.slice(4)}\\b0\\fs24\\par\n`;
            } else if (processedLine.startsWith('#### ')) {
                processedLine = `\\par\\b\\fs28 ${processedLine.slice(5)}\\b0\\fs24\\par\n`;
            } else if (processedLine.startsWith('- ') || processedLine.startsWith('* ')) {
                // Bullet points
                processedLine = `\\par\\bullet  ${processedLine.slice(2)}\\par\n`;
            } else if (processedLine.match(/^\d+\.\s/)) {
                // Numbered list
                processedLine = `\\par${processedLine}\\par\n`;
            } else if (processedLine.startsWith('> ')) {
                // Blockquote
                processedLine = `\\par\\li720\\i ${processedLine.slice(2)}\\i0\\li0\\par\n`;
            } else if (processedLine.trim() === '') {
                processedLine = '\\par\n';
            } else {
                // Bold: **text**
                processedLine = processedLine.replace(/\*\*([^*]+)\*\*/g, '\\b $1\\b0 ');
                // Italic: *text* or _text_
                processedLine = processedLine.replace(/\*([^*]+)\*/g, '\\i $1\\i0 ');
                processedLine = processedLine.replace(/_([^_]+)_/g, '\\i $1\\i0 ');
                processedLine = `${processedLine}\\par\n`;
            }

            rtf += processedLine;
        }

        rtf += '}';
        return rtf;
    };

    const exportToRTF = () => {
        if (!report) return;

        setExporting(true);
        try {
            const rtfContent = markdownToRTF(report);
            const blob = new Blob([rtfContent], { type: 'application/rtf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            const fileName = `DD-Report-${workspaceSlug}-${new Date().toISOString().split('T')[0]}.rtf`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Error exporting to RTF:', err);
            alert('Failed to export document.');
        } finally {
            setExporting(false);
        }
    };

    const exportToMarkdown = () => {
        if (!report) return;

        const blob = new Blob([report], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const fileName = `DD-Report-${workspaceSlug}-${new Date().toISOString().split('T')[0]}.md`;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                </div>
            </div>
        );
    }

    if (error && !report) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300 m-4">
                <div className="text-center p-8">
                    <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">No Final Document Available</h3>
                    <p className="mt-2 text-sm text-gray-500 max-w-sm">
                        {error}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                        Process documents in the "Canonical Document Raw Content" tab first to generate the master document.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 h-full flex flex-col">
            {/* Header with Controls */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">📄 Final Due Diligence Report</h3>
                    <p className="text-sm text-gray-600">
                        Professional investor report generated using AI
                        {isCached && <span className="ml-2 text-xs text-blue-500">(cached)</span>}
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    {/* Regenerate Button */}
                    <button
                        onClick={() => loadReport(true)}
                        disabled={isGenerating}
                        className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        title="Regenerate report"
                    >
                        {isGenerating ? (
                            <>
                                <svg className="animate-spin mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Generating...
                            </>
                        ) : (
                            <>
                                <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Regenerate
                            </>
                        )}
                    </button>

                    {/* Export Markdown Button */}
                    <button
                        onClick={exportToMarkdown}
                        disabled={!report}
                        className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm font-medium transition-colors"
                        title="Export as Markdown"
                    >
                        <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        MD
                    </button>

                    {/* Export RTF Button */}
                    <button
                        onClick={exportToRTF}
                        disabled={exporting || !report}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors shadow-sm"
                    >
                        {exporting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Exporting...
                            </>
                        ) : (
                            <>
                                <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                                </svg>
                                Export RTF
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Generation Progress */}
            {isGenerating && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <svg className="animate-spin mr-3 h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-blue-800">Generating polished report with AI... This may take a moment.</span>
                    </div>
                </div>
            )}

            {/* Document Content */}
            <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="max-w-4xl mx-auto p-8 prose prose-slate prose-headings:text-gray-900 prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-gray-700 prose-strong:text-gray-900 prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:text-gray-700 prose-li:text-gray-700 prose-table:border prose-th:bg-gray-100 prose-th:p-2 prose-td:p-2 prose-td:border max-w-none">
                    {report ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {report}
                        </ReactMarkdown>
                    ) : (
                        <div className="text-center text-gray-500 py-8">
                            <p>Click "Regenerate" to generate the final report.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
