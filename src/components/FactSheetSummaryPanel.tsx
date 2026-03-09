'use client';

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
}: FactSheetSummaryPanelProps) {
    const summary = caseSummary;
    const hasData = summary && (summary.overallScore !== null || summary.summary);
    const recStyle = getRecommendationStyle(summary?.recommendation || null);

    // Count how many sections have data
    const sectionsWithData = Object.values(canonicals).filter(
        (c) => c && typeof c === 'object' && (c as CanonicalDoc).sourcesProcessed?.length > 0
    ).length;

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50/30">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">Investment Memo</h3>
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
            <div className="flex-1 overflow-auto">
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
