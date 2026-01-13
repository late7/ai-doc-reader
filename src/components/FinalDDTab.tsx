'use client';

import { useState, useEffect, useRef } from 'react';
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
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const reportContentRef = useRef<HTMLDivElement>(null);

    // Only check for existing report on mount, don't auto-generate
    useEffect(() => {
        checkExistingReport();
    }, [workspaceSlug]);

    // Check if a cached report exists without triggering generation
    const checkExistingReport = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // First check if master document exists
            const masterDocResponse = await fetch(`/api/dd-process/master-doc?workspace=${workspaceSlug}`);
            if (!masterDocResponse.ok) {
                setError('Master document not found. Process documents first.');
                setReport(null);
                onStatusChange('not_started');
                setIsLoading(false);
                return;
            }

            // Check for cached final report (don't generate)
            const response = await fetch('/api/dd-process/generate-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, regenerate: false, checkOnly: true }),
            });

            const data = await response.json();

            if (response.ok && data.report) {
                setReport(data.report);
                setIsCached(true);
                onStatusChange('completed');
            } else {
                // No cached report - that's OK, user can generate manually
                setReport(null);
                onStatusChange('not_started');
            }
        } catch (err) {
            console.error('Error checking report:', err);
            setError('Failed to connect to server');
            onStatusChange('not_started');
        } finally {
            setIsLoading(false);
        }
    };

    // Generate report (only called when user clicks button)
    const generateReport = async (regenerate: boolean = false) => {
        setIsGenerating(true);
        setError(null);
        onStatusChange('in_progress');

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
            console.error('Error generating report:', err);
            setError('Failed to connect to server');
            onStatusChange('not_started');
        } finally {
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

    const exportToPDF = () => {
        if (!reportContentRef.current) return;

        setExporting(true);
        setShowExportMenu(false);

        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups for PDF export');
            setExporting(false);
            return;
        }

        const fileName = `DD-Report-${workspaceSlug}-${new Date().toISOString().split('T')[0]}`;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${fileName}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                        line-height: 1.6;
                        color: #1a1a1a;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 40px 20px;
                    }
                    h1 { font-size: 28px; margin-top: 32px; margin-bottom: 16px; color: #111; }
                    h2 { font-size: 22px; margin-top: 28px; margin-bottom: 12px; color: #222; }
                    h3 { font-size: 18px; margin-top: 24px; margin-bottom: 10px; color: #333; }
                    h4 { font-size: 16px; margin-top: 20px; margin-bottom: 8px; color: #444; }
                    p { margin: 12px 0; }
                    ul, ol { margin: 12px 0; padding-left: 24px; }
                    li { margin: 6px 0; }
                    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                    th { background-color: #f5f5f5; font-weight: 600; }
                    blockquote { border-left: 4px solid #3b82f6; margin: 16px 0; padding: 12px 20px; background: #f0f7ff; }
                    strong { font-weight: 600; }
                    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
                    @media print {
                        body { padding: 0; }
                        @page { margin: 2cm; }
                    }
                </style>
            </head>
            <body>
                ${reportContentRef.current.innerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();

        // Wait for content to load, then trigger print
        printWindow.onload = () => {
            printWindow.print();
            setExporting(false);
        };

        // Fallback if onload doesn't fire
        setTimeout(() => {
            setExporting(false);
        }, 2000);
    };

    const exportToDocx = async () => {
        if (!report) return;
        setShowExportMenu(false);
        setExporting(true);

        try {
            const response = await fetch('/api/dd-process/export-docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    markdown: report,
                    filename: `DD-Report-${workspaceSlug}-${new Date().toISOString().split('T')[0]}`,
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
        } finally {
            setExporting(false);
        }
    };

    // Close export menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    // Error state - only show if there's an actual error (like missing master doc)
    if (error && !report && error.includes('Master document')) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300 m-4">
                <div className="text-center p-8">
                    <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Master Document Required</h3>
                    <p className="mt-2 text-sm text-gray-500 max-w-sm">
                        {error}
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                        Process documents in the "Canonical Document Raw Content" tab first.
                    </p>
                </div>
            </div>
        );
    }

    // No report yet - show generate button
    if (!report && !isGenerating) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300 m-4">
                <div className="text-center p-8">
                    <svg className="mx-auto h-16 w-16 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Ready to Generate Report</h3>
                    <p className="mt-2 text-sm text-gray-500 max-w-sm">
                        The final DD report will be generated using AI based on the master document.
                    </p>
                    <button
                        onClick={() => generateReport(false)}
                        disabled={isGenerating}
                        className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                    >
                        <span className="flex items-center">
                            <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Generate Final Report
                        </span>
                    </button>
                    <p className="mt-4 text-xs text-gray-400">
                        This may take a few minutes depending on document size.
                    </p>
                </div>
            </div>
        );
    }

    // Generating state
    if (isGenerating && !report) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 m-4">
                <div className="text-center p-8">
                    <svg className="animate-spin mx-auto h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">Generating Report...</h3>
                    <p className="mt-2 text-sm text-gray-500">
                        AI is analyzing the master document and creating the final report.
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                        This may take a few minutes.
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
                        onClick={() => generateReport(true)}
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

                    {/* Export Dropdown */}
                    <div className="relative" ref={exportMenuRef}>
                        <button
                            onClick={() => setShowExportMenu(!showExportMenu)}
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
                                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Export
                                    <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </>
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {showExportMenu && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                <button
                                    onClick={exportToDocx}
                                    className="flex items-center w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                                        <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">DOCX (Word)</div>
                                        <div className="text-xs text-gray-500">Best for editing</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { exportToPDF(); setShowExportMenu(false); }}
                                    className="flex items-center w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                                        <svg className="h-4 w-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">PDF</div>
                                        <div className="text-xs text-gray-500">Print-ready document</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { exportToRTF(); setShowExportMenu(false); }}
                                    className="flex items-center w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                                        <svg className="h-4 w-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">RTF</div>
                                        <div className="text-xs text-gray-500">Legacy Word format</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { exportToMarkdown(); setShowExportMenu(false); }}
                                    className="flex items-center w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                                        <span className="text-xs font-bold text-gray-600">MD</span>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">Markdown</div>
                                        <div className="text-xs text-gray-500">Plain text format</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
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
                <div ref={reportContentRef} className="max-w-4xl mx-auto p-8 prose prose-slate prose-headings:text-gray-900 prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-gray-700 prose-strong:text-gray-900 prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:text-gray-700 prose-li:text-gray-700 prose-table:border prose-th:bg-gray-100 prose-th:p-2 prose-th:text-gray-900 prose-td:p-2 prose-td:border prose-td:text-gray-900 max-w-none">
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
