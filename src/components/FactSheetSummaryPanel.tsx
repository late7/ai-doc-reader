'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CaseSummary {
    companyName: string | null;
    overallScore: number | null;
    recommendation: string | null;
    askAmount: string | null;
    stage: string | null;
    summary: string;
    keyHighlights: string[];
    keyInsights: string[];
    watchouts: string[];
    lastUpdated: string | null;
}

interface CanonicalDoc {
    sectionId: string;
    title: string;
    score: number | null;
    summary: string;
    sourcesProcessed: string[];
    lastUpdated: string | null;
}

interface FactSheetSummaryPanelProps {
    caseSummary: CaseSummary | null;
    canonicals: Record<string, unknown>;
    isLoading: boolean;
    onUpdate: () => void;
    workspaceSlug: string;
}

function getRecommendationStyle(rec: string | null): { bg: string; text: string } {
    if (!rec) return { bg: 'bg-gray-100', text: 'text-gray-600' };
    const r = rec.toLowerCase();
    if (r.includes('strong invest')) return { bg: 'bg-green-100', text: 'text-green-800' };
    if (r.includes('invest')) return { bg: 'bg-green-50', text: 'text-green-700' };
    if (r.includes('consider')) return { bg: 'bg-amber-50', text: 'text-amber-700' };
    return { bg: 'bg-red-50', text: 'text-red-700' };
}

export default function FactSheetSummaryPanel({
    caseSummary,
    canonicals,
    isLoading,
    onUpdate,
    workspaceSlug,
}: FactSheetSummaryPanelProps) {
    const summary = caseSummary;
    const hasData = summary && (summary.overallScore !== null || summary.summary);
    const recStyle = getRecommendationStyle(summary?.recommendation || null);

    // Export state
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [exporting, setExporting] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const reportContentRef = useRef<HTMLDivElement>(null);

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

    // Build markdown content for export from the case summary
    const buildMarkdownForExport = (): string => {
        if (!summary) return '';
        const parts: string[] = [];
        if (summary.companyName) {
            parts.push(`# ${summary.companyName} — Investment Memo\n`);
        } else {
            parts.push('# Investment Memo\n');
        }
        if (summary.overallScore !== null && summary.overallScore !== undefined) {
            parts.push(`**Overall Score:** ${summary.overallScore.toFixed(1)} / 10\n`);
        }
        if (summary.recommendation) {
            parts.push(`**Recommendation:** ${summary.recommendation}\n`);
        }
        if (summary.askAmount) parts.push(`**Ask:** ${summary.askAmount}\n`);
        if (summary.stage) parts.push(`**Stage:** ${summary.stage}\n`);
        parts.push('');
        if (summary.keyHighlights?.length) {
            parts.push('## Key Highlights\n');
            summary.keyHighlights.forEach(h => parts.push(`- ${h}`));
            parts.push('');
        }
        if (summary.keyInsights?.length) {
            parts.push('## Key Insights\n');
            summary.keyInsights.forEach(i => parts.push(`- ${i}`));
            parts.push('');
        }
        if (summary.watchouts?.length) {
            parts.push('## Watchouts\n');
            summary.watchouts.forEach(w => parts.push(`- ${w}`));
            parts.push('');
        }
        if (summary.summary) {
            parts.push('## Summary\n');
            parts.push(summary.summary);
        }
        return parts.join('\n');
    };

    const exportToDocx = async () => {
        const md = buildMarkdownForExport();
        if (!md) return;
        setShowExportMenu(false);
        setExporting(true);
        try {
            const response = await fetch('/api/dd-process/export-docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    markdown: md,
                    filename: `Investment-Memo-${workspaceSlug}-${new Date().toISOString().split('T')[0]}`,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.docx) {
                alert('Failed to generate DOCX: ' + (data.message || 'Unknown error'));
                return;
            }
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

    const exportToPDF = () => {
        if (!reportContentRef.current) return;
        setShowExportMenu(false);
        setExporting(true);

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups for PDF export');
            setExporting(false);
            return;
        }
        const fileName = `Investment-Memo-${workspaceSlug}-${new Date().toISOString().split('T')[0]}`;
        printWindow.document.write(`
            <!DOCTYPE html><html><head><title>${fileName}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
                h1 { font-size: 28px; margin-top: 32px; } h2 { font-size: 22px; margin-top: 28px; } h3 { font-size: 18px; margin-top: 24px; }
                p { margin: 12px 0; } ul, ol { margin: 12px 0; padding-left: 24px; } li { margin: 6px 0; }
                table { border-collapse: collapse; width: 100%; margin: 16px 0; } th, td { border: 1px solid #ddd; padding: 10px; text-align: left; } th { background-color: #f5f5f5; }
                blockquote { border-left: 4px solid #3b82f6; margin: 16px 0; padding: 12px 20px; background: #f0f7ff; }
                @media print { body { padding: 0; } @page { margin: 2cm; } }
            </style></head><body>${reportContentRef.current.innerHTML}</body></html>
        `);
        printWindow.document.close();
        printWindow.onload = () => { printWindow.print(); setExporting(false); };
        setTimeout(() => setExporting(false), 2000);
    };

    const exportToRTF = () => {
        const md = buildMarkdownForExport();
        if (!md) return;
        setShowExportMenu(false);
        setExporting(true);
        try {
            let rtf = '{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0 Arial;}{\\f1 Times New Roman;}}\n{\\colortbl;\\red0\\green0\\blue0;}\n\\f0\\fs24\n';
            for (const line of md.split('\n')) {
                let p = line.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
                if (p.startsWith('# ')) p = `\\par\\b\\fs48 ${p.slice(2)}\\b0\\fs24\\par\n`;
                else if (p.startsWith('## ')) p = `\\par\\b\\fs36 ${p.slice(3)}\\b0\\fs24\\par\n`;
                else if (p.startsWith('### ')) p = `\\par\\b\\fs32 ${p.slice(4)}\\b0\\fs24\\par\n`;
                else if (p.startsWith('- ') || p.startsWith('* ')) p = `\\par\\bullet  ${p.slice(2)}\\par\n`;
                else if (p.trim() === '') p = '\\par\n';
                else {
                    p = p.replace(/\*\*([^*]+)\*\*/g, '\\b $1\\b0 ').replace(/\*([^*]+)\*/g, '\\i $1\\i0 ');
                    p = `${p}\\par\n`;
                }
                rtf += p;
            }
            rtf += '}';
            const blob = new Blob([rtf], { type: 'application/rtf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Investment-Memo-${workspaceSlug}-${new Date().toISOString().split('T')[0]}.rtf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error exporting to RTF:', err);
        } finally {
            setExporting(false);
        }
    };

    const exportToMarkdown = () => {
        const md = buildMarkdownForExport();
        if (!md) return;
        setShowExportMenu(false);
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Investment-Memo-${workspaceSlug}-${new Date().toISOString().split('T')[0]}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Count how many sections have data
    const sectionsWithData = Object.values(canonicals).filter(
        (c) => c && typeof c === 'object' && (c as CanonicalDoc).sourcesProcessed?.length > 0
    ).length;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50/30">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">📋 Investment Memo</h3>
                    <div className="flex items-center gap-1.5">
                        {/* Export dropdown */}
                        {hasData && (
                            <div className="relative" ref={exportMenuRef}>
                                <button
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    disabled={exporting}
                                    className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                        exporting
                                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    }`}
                                    title="Export investment memo"
                                >
                                    {exporting ? (
                                        <span className="flex items-center gap-1">
                                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-0.5">
                                            ⬇ Export
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </span>
                                    )}
                                </button>

                                {showExportMenu && (
                                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                                        <button onClick={exportToDocx} className="flex items-center w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors">
                                            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded flex items-center justify-center mr-2">
                                                <svg className="h-3 w-3 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium text-gray-900">DOCX (Word)</div>
                                                <div className="text-[10px] text-gray-600">Best for editing</div>
                                            </div>
                                        </button>
                                        <button onClick={exportToPDF} className="flex items-center w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors">
                                            <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded flex items-center justify-center mr-2">
                                                <svg className="h-3 w-3 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" /></svg>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium text-gray-900">PDF</div>
                                                <div className="text-[10px] text-gray-600">Print-ready</div>
                                            </div>
                                        </button>
                                        <button onClick={exportToRTF} className="flex items-center w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors">
                                            <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded flex items-center justify-center mr-2">
                                                <svg className="h-3 w-3 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium text-gray-900">RTF</div>
                                                <div className="text-[10px] text-gray-600">Legacy Word</div>
                                            </div>
                                        </button>
                                        <button onClick={exportToMarkdown} className="flex items-center w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors">
                                            <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded flex items-center justify-center mr-2">
                                                <span className="text-[9px] font-bold text-gray-600">MD</span>
                                            </div>
                                            <div>
                                                <div className="text-xs font-medium text-gray-900">Markdown</div>
                                                <div className="text-[10px] text-gray-600">Plain text</div>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            onClick={onUpdate}
                            disabled={isLoading || sectionsWithData === 0}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                isLoading || sectionsWithData === 0
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                            title={sectionsWithData === 0 ? 'Process at least one section first' : 'Update investment memo'}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-1">
                                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Updating...
                                </span>
                            ) : (
                                '🔄 Update'
                            )}
                        </button>
                    </div>
                </div>

                {/* Overall Score */}
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xs text-gray-700">Overall Score:</span>
                    <span className="text-2xl font-bold text-gray-900">
                        {summary?.overallScore !== null && summary?.overallScore !== undefined
                            ? `${summary.overallScore.toFixed(1)} / 10`
                            : '— / 10'
                        }
                    </span>
                </div>

                {/* Recommendation badge */}
                {summary?.recommendation && (
                    <div className="mt-1.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${recStyle.bg} ${recStyle.text}`}>
                            Recommend: {summary.recommendation}
                        </span>
                    </div>
                )}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-auto" ref={reportContentRef}>
                {hasData ? (
                    <div className="px-4 py-3 space-y-4">
                        {/* Quick Info */}
                        {(summary?.companyName || summary?.askAmount || summary?.stage) && (
                            <div className="space-y-1.5 text-xs">
                                {summary?.companyName && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-700">Company</span>
                                        <span className="font-medium text-gray-800">{summary.companyName}</span>
                                    </div>
                                )}
                                {summary?.askAmount && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-700">Ask</span>
                                        <span className="font-medium text-gray-800">{summary.askAmount}</span>
                                    </div>
                                )}
                                {summary?.stage && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-700">Stage</span>
                                        <span className="font-medium text-gray-800">{summary.stage}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Key Highlights */}
                        {summary?.keyHighlights && summary.keyHighlights.length > 0 && (
                            <div>
                                <h4 className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                    <span className="text-blue-500">▸</span> Key Highlights
                                </h4>
                                <ul className="space-y-1">
                                    {summary.keyHighlights.map((h, i) => (
                                        <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                            {h}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Key Insights */}
                        {summary?.keyInsights && summary.keyInsights.length > 0 && (
                            <div className="border-t border-gray-100 pt-3">
                                <h4 className="text-xs font-semibold text-gray-700 mb-1.5">Key Insights</h4>
                                <ul className="space-y-1">
                                    {summary.keyInsights.map((ins, i) => (
                                        <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                            {ins}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Watchouts */}
                        {summary?.watchouts && summary.watchouts.length > 0 && (
                            <div className="border-t border-gray-100 pt-3">
                                <h4 className="text-xs font-semibold text-gray-700 mb-1.5">⚠️ Watchouts</h4>
                                <ul className="space-y-1">
                                    {summary.watchouts.map((w, i) => (
                                        <li key={i} className="flex items-start gap-1.5 text-xs text-red-600">
                                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                            {w}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Summary markdown */}
                        {summary?.summary && (
                            <div className="border-t border-gray-100 pt-3">
                                <h4 className="text-xs font-semibold text-gray-700 mb-1.5">Summary</h4>
                                <div className="prose prose-xs max-w-none text-xs prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {summary.summary}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full p-6">
                        <div className="text-center">
                            <div className="text-3xl mb-2">📋</div>
                            <p className="text-xs text-gray-600 max-w-[180px]">
                                Process documents in the section tabs, then click &quot;Update&quot; to generate the investment memo.
                            </p>
                            <p className="text-[10px] text-gray-600 mt-2">
                                {sectionsWithData}/4 sections have data
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            {summary?.lastUpdated && (
                <div className="px-4 py-1.5 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-[10px] text-gray-600">
                        Updated: {new Date(summary.lastUpdated).toLocaleString()}
                    </p>
                </div>
            )}
        </div>
    );
}
