'use client';

import { useState, useEffect, useRef } from 'react';

interface InvestmentHighlight {
    type: string;
    icon: string;
    label: string;
    headline: string;
    detail: string;
}

interface LeadInvestorValidation {
    investor: string;
    commitment: string;
    detail: string;
}

interface WhyNow {
    headline: string;
    detail: string;
}

interface FinancialRow {
    metric: string;
    value: string;
    note: string | null;
}

interface UseOfFundsItem {
    percentage: number;
    label: string;
    detail: string;
}

interface TimelineItem {
    date: string;
    milestone: string;
    status: 'completed' | 'in-progress' | 'planned';
}

interface InvestorFactSheet {
    companyName: string | null;
    sector: string | null;
    valueProposition: string | null;
    keyBadges: string[];
    investmentHighlights: InvestmentHighlight[];
    leadInvestorValidation: LeadInvestorValidation | null;
    whyNow: WhyNow | null;
    financialSnapshot: FinancialRow[];
    useOfFunds: UseOfFundsItem[];
    executionTimeline: TimelineItem[];
    askAmount: string | null;
    stage: string | null;
    lastUpdated: string | null;
}

interface InvestorFactSheetPanelProps {
    factsheet: InvestorFactSheet | null;
    canonicals: Record<string, unknown>;
    isLoading: boolean;
    onUpdate: () => void;
    workspaceSlug: string;
    isGlobalProcessing?: boolean;
}

const USE_OF_FUNDS_COLORS = ['bg-blue-600', 'bg-emerald-600', 'bg-violet-600'];

export default function InvestorFactSheetPanel({
    factsheet,
    canonicals,
    isLoading,
    onUpdate,
    workspaceSlug,
    isGlobalProcessing = false,
}: InvestorFactSheetPanelProps) {
    const hasData = factsheet && (factsheet.companyName || factsheet.valueProposition);
    const reportContentRef = useRef<HTMLDivElement>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const sectionsWithData = Object.values(canonicals).filter(
        (c) => c && typeof c === 'object' && ((c as { sourcesProcessed?: string[] }).sourcesProcessed?.length ?? 0) > 0
    ).length;

    // ── Markdown Export ──────────────────────────────────────────────────────
    const buildMarkdownForExport = (): string => {
        if (!factsheet) return '';
        const lines: string[] = [];

        const company = factsheet.companyName || 'Company';
        const sector = factsheet.sector ? ` · ${factsheet.sector}` : '';
        lines.push(`# ${company} — Investor Fact Sheet${sector}`);
        if (factsheet.askAmount) lines.push(`**Ask:** ${factsheet.askAmount}  |  **Stage:** ${factsheet.stage || 'TBD'}`);
        if (factsheet.valueProposition) lines.push(`\n> ${factsheet.valueProposition}\n`);

        if (factsheet.keyBadges?.length) {
            lines.push('**' + factsheet.keyBadges.join('  ·  ') + '**');
            lines.push('');
        }

        if (factsheet.investmentHighlights?.length) {
            lines.push('## Investment Highlights\n');
            factsheet.investmentHighlights.forEach(h => {
                lines.push(`### ${h.icon} ${h.label}`);
                lines.push(`**${h.headline}**`);
                lines.push(h.detail);
                lines.push('');
            });
        }

        if (factsheet.leadInvestorValidation) {
            const v = factsheet.leadInvestorValidation;
            lines.push('## Lead Investor Validation\n');
            lines.push(`**${v.investor}** — ${v.commitment} committed`);
            lines.push(v.detail);
            lines.push('');
        }

        if (factsheet.whyNow) {
            lines.push('## Why Now\n');
            lines.push(`**${factsheet.whyNow.headline}**`);
            lines.push(factsheet.whyNow.detail);
            lines.push('');
        }

        if (factsheet.financialSnapshot?.length) {
            lines.push('## Financial Snapshot\n');
            lines.push('| Metric | Value | Note |');
            lines.push('|--------|-------|------|');
            factsheet.financialSnapshot.forEach(row => {
                lines.push(`| ${row.metric} | ${row.value} | ${row.note || '—'} |`);
            });
            lines.push('');
        }

        if (factsheet.useOfFunds?.length) {
            lines.push('## Use of Funds\n');
            factsheet.useOfFunds.forEach(u => {
                lines.push(`- **${u.percentage}% — ${u.label}:** ${u.detail}`);
            });
            lines.push('');
        }

        if (factsheet.executionTimeline?.length) {
            lines.push('## Execution Track Record\n');
            factsheet.executionTimeline.forEach(t => {
                const statusIcon = t.status === 'completed' ? '✅' : t.status === 'in-progress' ? '🔄' : '📅';
                lines.push(`- ${statusIcon} **${t.date}** — ${t.milestone}`);
            });
            lines.push('');
        }

        return lines.join('\n');
    };

    const exportToMarkdown = () => {
        const md = buildMarkdownForExport();
        if (!md) return;
        setShowExportMenu(false);
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Investor-FactSheet-${workspaceSlug}-${new Date().toISOString().split('T')[0]}.md`;
        a.click();
        URL.revokeObjectURL(url);
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
                    filename: `Investor-FactSheet-${workspaceSlug}-${new Date().toISOString().split('T')[0]}`,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.docx) {
                alert('Failed to generate DOCX: ' + (data.message || 'Unknown error'));
                return;
            }
            const binaryString = atob(data.docx);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
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
        const fileName = `Investor-FactSheet-${workspaceSlug}-${new Date().toISOString().split('T')[0]}`;
        printWindow.document.write(`
<!DOCTYPE html><html><head><title>${fileName}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; font-size: 11px; line-height: 1.5; color: #111827; margin: 0; padding: 32px 40px; background: #fff; }
  h1 { font-size: 22px; font-weight: 800; color: #111827; margin: 0 0 4px; }
  h2 { font-size: 13px; font-weight: 700; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: 0.06em; }
  h3 { font-size: 11px; font-weight: 700; color: #111827; margin: 0 0 2px; }
  p { margin: 4px 0 8px; color: #374151; }
  .header { border-bottom: 3px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 16px; }
  .sector-tag { display: inline-block; background: #1e3a5f; color: #fff; font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 999px; margin-left: 8px; vertical-align: middle; text-transform: uppercase; letter-spacing: 0.08em; }
  .value-prop { font-size: 13px; font-style: italic; color: #1e3a5f; margin: 6px 0; }
  .badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
  .badge { background: #1e3a5f; color: #fff; font-size: 9px; font-weight: 700; padding: 3px 10px; border-radius: 4px; letter-spacing: 0.04em; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
  .highlight-card { border-left: 3px solid #1e3a5f; padding: 8px 10px; background: #f8fafc; margin-bottom: 8px; }
  .highlight-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 2px; }
  .highlight-headline { font-size: 11px; font-weight: 700; color: #111827; }
  .highlight-detail { font-size: 10px; color: #374151; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #1e3a5f; color: #fff; font-weight: 700; padding: 6px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
  td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; color: #111827; }
  td:first-child { font-weight: 600; color: #374151; width: 140px; }
  .funds-bar { height: 8px; border-radius: 4px; margin-bottom: 6px; }
  .timeline-item { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; }
  .timeline-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
  .dot-completed { background: #059669; }
  .dot-progress { background: #2563eb; }
  .dot-planned { background: #9ca3af; }
  .timeline-date { font-size: 9px; font-weight: 700; color: #6b7280; min-width: 80px; }
  .timeline-text { font-size: 10px; font-weight: 600; color: #111827; }
  .ask-box { background: #1e3a5f; color: #fff; padding: 12px 16px; border-radius: 6px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
  .ask-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.75; }
  .ask-value { font-size: 18px; font-weight: 800; }
  .why-now-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 14px; }
  .why-now-headline { font-size: 11px; font-weight: 700; color: #1e40af; }
  .why-now-detail { font-size: 10px; color: #1e3a5f; margin-top: 4px; }
  .lead-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; margin: 8px 0; }
  .lead-name { font-size: 11px; font-weight: 700; color: #065f46; }
  .lead-commitment { font-size: 13px; font-weight: 800; color: #065f46; }
  .lead-detail { font-size: 10px; color: #374151; margin-top: 3px; }
  .funds-item { margin-bottom: 8px; }
  .funds-label { font-size: 10px; font-weight: 700; color: #111827; margin-bottom: 2px; }
  .funds-detail { font-size: 9px; color: #6b7280; }
  .footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 8px; color: #9ca3af; text-align: center; }
  @media print { @page { margin: 1.5cm; size: A4; } body { padding: 0; } }
</style></head><body>
${reportContentRef.current.innerHTML}
</body></html>`);
        printWindow.document.close();
        printWindow.onload = () => { printWindow.print(); setExporting(false); };
        setTimeout(() => setExporting(false), 2500);
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-blue-50/30 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">Investor Fact Sheet</h3>
                    <div className="flex items-center gap-1.5">
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
                                    title="Export investor fact sheet"
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
                                                <div className="text-xs font-medium text-gray-900">PDF / Print</div>
                                                <div className="text-[10px] text-gray-600">Print-ready one-pager</div>
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
                            disabled={isLoading || sectionsWithData === 0 || isGlobalProcessing}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                                isLoading || sectionsWithData === 0 || isGlobalProcessing
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-700 hover:bg-blue-800 text-white'
                            }`}
                            title={isGlobalProcessing ? 'Processing in progress…' : sectionsWithData === 0 ? 'Process at least one section first' : 'Generate investor fact sheet'}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-1">
                                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Generating...
                                </span>
                            ) : (
                                'Generate'
                            )}
                        </button>
                    </div>
                </div>
                {factsheet?.lastUpdated && (
                    <p className="text-[10px] text-gray-600 mt-1">
                        Last generated: {new Date(factsheet.lastUpdated).toLocaleString()}
                    </p>
                )}
            </div>

            {/* Scrollable one-pager content */}
            <div className="flex-1 overflow-auto bg-white">
                {isLoading && (
                    <div className="flex items-center justify-center h-40 gap-3">
                        <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-sm text-gray-700 font-medium">Generating investor fact sheet…</span>
                    </div>
                )}

                {!isLoading && !hasData && (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-6">
                        <p className="text-sm font-semibold text-gray-800">No Investor Fact Sheet yet</p>
                        <p className="text-xs text-gray-600">
                            Process documents in the section tabs, then click &quot;Generate&quot; to create the external one-pager for investors.
                        </p>
                    </div>
                )}

                {!isLoading && hasData && factsheet && (
                    <div ref={reportContentRef} className="px-5 py-5 space-y-5 max-w-3xl mx-auto">

                        {/* ── HEADER ─────────────────────────────────────────────── */}
                        <div className="border-b-2 border-slate-800 pb-4 space-y-3">
                            {/* Company basics */}
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl font-extrabold text-gray-900 leading-tight">
                                        {factsheet.companyName || 'Company'}
                                    </h1>
                                    {factsheet.sector && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-white uppercase tracking-wider">
                                            {factsheet.sector}
                                        </span>
                                    )}
                                </div>
                                {factsheet.valueProposition && (
                                    <p className="mt-1.5 text-sm font-semibold text-slate-700 italic leading-snug">
                                        &ldquo;{factsheet.valueProposition}&rdquo;
                                    </p>
                                )}
                            </div>
                            {/* Ask + Stage box — full width below company basics */}
                            {(factsheet.askAmount || factsheet.stage) && (
                                <div className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 text-center">
                                    {factsheet.askAmount && (
                                        <div className="text-xl font-extrabold leading-tight">{factsheet.askAmount}</div>
                                    )}
                                    {factsheet.stage && (
                                        <div className="text-[10px] uppercase tracking-widest opacity-75 mt-0.5">{factsheet.stage}</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── INVESTMENT HIGHLIGHTS ────────────────────────────────── */}
                        {factsheet.investmentHighlights?.length > 0 && (
                            <div>
                                <h2 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-1 mb-3">
                                    Investment Highlights
                                </h2>
                                <div className="space-y-3">
                                    {factsheet.investmentHighlights.map((h, i) => (
                                        <div key={i}>
                                            <p className="text-xs font-bold text-gray-900 mb-0.5">
                                                {h.label}:{' '}
                                                <span className="font-semibold text-gray-800">{h.headline}</span>
                                            </p>
                                            <p className="text-xs text-gray-700 leading-relaxed">{h.detail}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── TWO COLUMNS: Lead Investor + Why Now ─────────────────── */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Lead Investor Validation */}
                            {factsheet.leadInvestorValidation && (
                                <div>
                                    <h2 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">
                                        Lead Investor Validation
                                    </h2>
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                            <span className="text-xs font-bold text-emerald-900">
                                                {factsheet.leadInvestorValidation.investor}
                                            </span>
                                            <span className="text-base font-extrabold text-emerald-800">
                                                {factsheet.leadInvestorValidation.commitment}
                                                <span className="text-[10px] font-medium text-emerald-700 ml-1">committed</span>
                                            </span>
                                        </div>
                                        {factsheet.leadInvestorValidation.detail && (
                                            <p className="text-[10px] text-emerald-800 mt-1 leading-snug">
                                                {factsheet.leadInvestorValidation.detail}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Why Now */}
                            {factsheet.whyNow && (
                                <div>
                                    <h2 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">
                                        Why Now
                                    </h2>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                                        <div className="text-xs font-bold text-blue-900 leading-snug">
                                            {factsheet.whyNow.headline}
                                        </div>
                                        <p className="text-[10px] text-blue-800 mt-1 leading-snug">
                                            {factsheet.whyNow.detail}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── FINANCIAL SNAPSHOT: full width ───────────────────────── */}
                        {factsheet.financialSnapshot?.length > 0 && (
                            <div>
                                <h2 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-1 mb-2">
                                    Financial Snapshot
                                </h2>
                                <table className="w-full text-[10px] border-collapse">
                                    <thead>
                                        <tr className="bg-slate-800 text-white">
                                            <th className="text-left px-3 py-2 font-bold uppercase tracking-wider text-[9px] rounded-tl w-1/4">Metric</th>
                                            <th className="text-right px-3 py-2 font-bold uppercase tracking-wider text-[9px] w-1/4">Value</th>
                                            <th className="text-left px-3 py-2 font-normal text-[9px] opacity-80 rounded-tr">Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {factsheet.financialSnapshot.map((row, i) => (
                                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                <td className="px-3 py-2 font-semibold text-gray-800 border-b border-slate-100">{row.metric}</td>
                                                <td className="px-3 py-2 text-right font-bold text-slate-900 border-b border-slate-100 whitespace-nowrap">{row.value}</td>
                                                <td className="px-3 py-2 text-gray-600 border-b border-slate-100">{row.note || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ── USE OF FUNDS ─────────────────────────────────────────── */}
                        {factsheet.useOfFunds?.length > 0 && (
                            <div>
                                <h2 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-1 mb-3">
                                    Capital Deployment Priorities
                                </h2>
                                {/* Stacked bar */}
                                <div className="flex rounded-full overflow-hidden h-3 mb-3 gap-px">
                                    {factsheet.useOfFunds.map((u, i) => (
                                        <div
                                            key={i}
                                            className={`${USE_OF_FUNDS_COLORS[i % USE_OF_FUNDS_COLORS.length]} transition-all`}
                                            style={{ width: `${u.percentage}%` }}
                                            title={`${u.label}: ${u.percentage}%`}
                                        />
                                    ))}
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {factsheet.useOfFunds.map((u, i) => (
                                        <div key={i} className="flex gap-2">
                                            <div className={`w-2 h-2 rounded-sm flex-shrink-0 mt-1 ${USE_OF_FUNDS_COLORS[i % USE_OF_FUNDS_COLORS.length]}`} />
                                            <div>
                                                <div className="text-[10px] font-bold text-gray-900">
                                                    {u.percentage}% — {u.label}
                                                </div>
                                                <div className="text-[9px] text-gray-600 leading-snug mt-0.5">
                                                    {u.detail}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── EXECUTION TIMELINE ──────────────────────────────────── */}
                        {factsheet.executionTimeline?.length > 0 && (
                            <div>
                                <h2 className="text-[10px] font-bold text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-1 mb-3">
                                    Execution Track Record
                                </h2>
                                <div className="relative">
                                    {/* connector line */}
                                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200" />
                                    <div className="space-y-2.5">
                                        {factsheet.executionTimeline.map((item, i) => {
                                            const dotColor =
                                                item.status === 'completed'
                                                    ? 'bg-emerald-500 border-emerald-300'
                                                    : item.status === 'in-progress'
                                                    ? 'bg-blue-500 border-blue-300 ring-2 ring-blue-200'
                                                    : 'bg-gray-300 border-gray-200';
                                            const textColor =
                                                item.status === 'completed'
                                                    ? 'text-gray-800'
                                                    : item.status === 'in-progress'
                                                    ? 'text-blue-800 font-semibold'
                                                    : 'text-gray-600';
                                            return (
                                                <div key={i} className="flex items-start gap-3">
                                                    <div className={`w-5 h-5 rounded-full flex-shrink-0 border-2 z-10 mt-0.5 ${dotColor}`} />
                                                    <div className="flex items-baseline gap-2 flex-wrap">
                                                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                                                            {item.date}
                                                        </span>
                                                        <span className={`text-xs leading-snug ${textColor}`}>
                                                            {item.milestone}
                                                        </span>
                                                        {item.status === 'in-progress' && (
                                                            <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">
                                                                Live
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── FOOTER ───────────────────────────────────────────────── */}
                        <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                            <p className="text-[9px] text-gray-500 italic">
                                Confidential — For qualified institutional investors only. Not for public distribution.
                            </p>
                            {factsheet.lastUpdated && (
                                <p className="text-[9px] text-gray-500">
                                    {new Date(factsheet.lastUpdated).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
