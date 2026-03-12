'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Types ──────────────────────────────────────────────────────
interface CaseOverviewData {
    companyName: string | null;
    tagline: string | null;
    description: string | null;
    sector: string | null;
    stage: string | null;
    foundedYear: string | null;
    headquarters: string | null;
    teamSize: string | null;
    website: string | null;
    businessModel: string | null;
    capitalRequirement: string | null;
    statedValuation: string | null;
    opportunityType: string | null;
    investmentRationale: string | null;
}

interface CaseOverviewCardProps {
    score: number | null;
    summary: unknown;
    strengths: string[];
    weaknesses: string[];
    openQuestions: string[];
    webSummary: { markdown: string; webScore?: string | number; generatedAt?: string } | null;
    webAnalysis: Record<string, unknown> | null;
}

// ── Score helpers ──────────────────────────────────────────────
function getScoreLabel(score: number | null): { label: string; color: string; bg: string } {
    if (score === null) return { label: 'N/A', color: 'text-gray-600', bg: 'bg-gray-100' };
    if (score >= 8) return { label: 'Strong', color: 'text-blue-700', bg: 'bg-blue-100' };
    if (score >= 6) return { label: 'Moderate', color: 'text-amber-700', bg: 'bg-amber-100' };
    if (score >= 4) return { label: 'Fair', color: 'text-orange-700', bg: 'bg-orange-100' };
    return { label: 'Weak', color: 'text-red-700', bg: 'bg-red-100' };
}

function parseSummary(raw: unknown): CaseOverviewData | null {
    if (!raw) return null;
    // Already a parsed object
    if (typeof raw === 'object' && !Array.isArray(raw) && 'companyName' in (raw as object)) {
        return raw as CaseOverviewData;
    }
    if (typeof raw !== 'string') return null;
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed === 'object' && parsed !== null && 'companyName' in parsed) {
            return parsed as CaseOverviewData;
        }
        return null;
    } catch {
        return null;
    }
}

// ── Fact row helper ────────────────────────────────────────────
function FactRow({ label, value }: { label: string; value: string | null }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0">
            <span className="text-xs text-gray-600 w-32 flex-shrink-0">{label}</span>
            <span className="text-xs text-gray-800 font-medium flex-1">{value}</span>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────
export default function CaseOverviewCard({
    score,
    summary,
    strengths,
    weaknesses,
    openQuestions,
    webSummary,
    webAnalysis,
}: CaseOverviewCardProps) {
    const data = useMemo(() => parseSummary(summary), [summary]);
    const scoreInfo = getScoreLabel(score);

    if (!data) {
        // Fallback: render as plain markdown (only if summary is a string)
        const summaryStr = typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2);
        return (
            <div className="prose prose-sm prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {summaryStr || '_No data yet. Process documents to generate._'}
                </ReactMarkdown>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header card */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-bold text-gray-900">{data.companyName ?? 'Unknown Company'}</h2>
                            {data.stage && (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold">
                                    {data.stage}
                                </span>
                            )}
                            {data.opportunityType && (
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                                    {data.opportunityType}
                                </span>
                            )}
                        </div>
                        {data.tagline && (
                            <p className="mt-1 text-sm text-indigo-800 italic">&ldquo;{data.tagline}&rdquo;</p>
                        )}
                        {data.description && (
                            <p className="mt-2 text-sm text-gray-700 leading-relaxed">{data.description}</p>
                        )}
                        {data.website && (
                            <a
                                href={data.website.startsWith('http') ? data.website : `https://${data.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-900 hover:underline"
                            >
                                🌐 {data.website}
                            </a>
                        )}
                    </div>
                    {score !== null && (
                        <div className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg ${scoreInfo.bg}`}>
                            <span className={`text-xl font-bold ${scoreInfo.color}`}>{score.toFixed(1)}</span>
                            <span className={`text-[10px] font-semibold ${scoreInfo.color}`}>{scoreInfo.label}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Company facts + Investment facts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Company Info</h4>
                    <FactRow label="Sector" value={data.sector} />
                    <FactRow label="Founded" value={data.foundedYear} />
                    <FactRow label="Headquarters" value={data.headquarters} />
                    <FactRow label="Team Size" value={data.teamSize} />
                    <FactRow label="Business Model" value={data.businessModel} />
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Investment Info</h4>
                    <FactRow label="Capital Ask" value={data.capitalRequirement} />
                    <FactRow label="Valuation" value={data.statedValuation} />
                    <FactRow label="Opportunity Type" value={data.opportunityType} />
                    <FactRow label="Stage" value={data.stage} />
                    {data.investmentRationale && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wide mb-1">Investment Rationale</p>
                            <p className="text-xs text-gray-700 italic">{data.investmentRationale}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Strengths / Weaknesses */}
            {(strengths.length > 0 || weaknesses.length > 0) && (
                <div className="grid grid-cols-2 gap-2">
                    {strengths.length > 0 && (
                        <div className="bg-green-50 rounded-lg p-3">
                            <h5 className="text-xs font-semibold text-green-800 mb-1.5">✅ Positives</h5>
                            <ul className="space-y-1">
                                {strengths.map((s, i) => (
                                    <li key={i} className="text-xs text-green-700">• {s}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {weaknesses.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-3">
                            <h5 className="text-xs font-semibold text-red-800 mb-1.5">⚠️ Concerns</h5>
                            <ul className="space-y-1">
                                {weaknesses.map((w, i) => (
                                    <li key={i} className="text-xs text-red-700">• {w}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Open Questions */}
            {openQuestions.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-3">
                    <h5 className="text-xs font-semibold text-amber-800 mb-1.5">❓ Open Questions</h5>
                    <ul className="space-y-1">
                        {openQuestions.map((q, i) => (
                            <li key={i} className="text-xs text-amber-700">• {q}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Web Analysis Summary */}
            {webSummary && (
                <div className="border-t border-purple-200 pt-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-purple-800">🌐 Web Research</span>
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
                            Web research: {new Date(webSummary.generatedAt).toLocaleString()}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
