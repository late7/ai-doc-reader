'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Types for structured team summary ──────────────────────────
interface FounderProfile {
    name: string;
    role: string;
    archetype: 'Hustler' | 'Hacker' | 'Hipster' | string;
    background: string;
    linkedinSignal: string;
}

interface FoundersMoat {
    unfairAdvantage: string;
    signal: string;
}

interface TimelineMilestone {
    date: string;
    milestone: string;
    status: 'completed' | 'in-progress' | 'planned';
}

interface ExecutionGap {
    gap: string;
    detail: string;
    severity: 'critical' | 'warning';
}

interface KeyMetrics {
    teamSize: string | null;
    activeUsers: string | null;
    payingCompanies: string | null;
    arr: string | null;
    fundingRaised: string | null;
}

interface TeamSummaryData {
    verdict: string;
    founderProfiles: FounderProfile[];
    foundersMoat: FoundersMoat;
    executionTimeline: TimelineMilestone[];
    executionGaps: ExecutionGap[];
    keyMetrics: KeyMetrics;
}

interface TeamInvestorCardProps {
    score: number | null;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    openQuestions: string[];
    webSummary: { markdown: string; webScore?: string | number; generatedAt?: string } | null;
    webAnalysis: Record<string, unknown> | null;
}

// ── Helpers ────────────────────────────────────────────────────
function parseTeamSummary(summary: string | Record<string, unknown>): TeamSummaryData | null {
    try {
        // Handle case where summary is already an object (runtime override of TS type)
        const data = typeof summary === 'object' && summary !== null
            ? summary
            : JSON.parse(summary as string);
        if (data && data.verdict && data.founderProfiles && data.executionTimeline) {
            return data as unknown as TeamSummaryData;
        }
        return null;
    } catch {
        return null;
    }
}

function getScoreColor(score: number): string {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-amber-600';
    return 'text-red-600';
}

function getScoreRingColor(score: number): string {
    if (score >= 8) return 'stroke-green-500';
    if (score >= 6) return 'stroke-amber-500';
    return 'stroke-red-500';
}

function getScoreBg(score: number): string {
    if (score >= 8) return 'bg-green-50 border-green-200';
    if (score >= 6) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
}

function getArchetypeStyle(archetype: string): { emoji: string; bg: string; text: string; border: string } {
    const lower = archetype.toLowerCase();
    if (lower === 'hustler') return { emoji: '💼', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    if (lower === 'hacker') return { emoji: '⚡', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' };
    if (lower === 'hipster') return { emoji: '🎨', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' };
    return { emoji: '👤', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
}

// ── Score Gauge (SVG ring) ─────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 10) * circumference;

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width="100" height="100" className="-rotate-90">
                <circle
                    cx="50" cy="50" r={radius}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                />
                <circle
                    cx="50" cy="50" r={radius}
                    fill="none"
                    className={getScoreRingColor(score)}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
                <span className="text-[10px] text-gray-600 font-medium">/10</span>
            </div>
        </div>
    );
}

// ── Metric Pill ────────────────────────────────────────────────
function MetricPill({ label, value }: { label: string; value: string | null }) {
    if (!value) return null;
    return (
        <div className="flex flex-col items-center bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
            <span className="text-xs text-gray-600 font-medium">{label}</span>
            <span className="text-sm font-bold text-gray-900">{value}</span>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────
export default function TeamInvestorCard({
    score,
    summary,
    strengths,
    weaknesses,
    openQuestions,
    webSummary,
    webAnalysis,
}: TeamInvestorCardProps) {
    const parsed = useMemo(() => parseTeamSummary(summary), [summary]);

    // ── Fallback: generic markdown view (same as default summary) ──
    if (!parsed) {
        return (
            <div className="prose prose-sm prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {summary || '_No summary generated yet. Process documents to generate._'}
                </ReactMarkdown>

                <div className="mt-4 grid grid-cols-2 gap-2 not-prose">
                    {strengths.length > 0 && (
                        <div className="bg-green-50 rounded-lg p-3">
                            <h5 className="text-xs font-semibold text-green-800 mb-1.5">✅ Strengths</h5>
                            <ul className="space-y-1">
                                {strengths.map((s, i) => (
                                    <li key={i} className="text-xs text-green-700">• {s}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {weaknesses.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-3">
                            <h5 className="text-xs font-semibold text-red-800 mb-1.5">⚠️ Weaknesses</h5>
                            <ul className="space-y-1">
                                {weaknesses.map((w, i) => (
                                    <li key={i} className="text-xs text-red-700">• {w}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {openQuestions.length > 0 && (
                    <div className="mt-3 bg-amber-50 rounded-lg p-3 not-prose">
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
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{webSummary.markdown}</ReactMarkdown>
                        </div>
                        {webSummary.generatedAt && (
                            <p className="mt-1 text-[10px] text-gray-600">
                                Web analysis: {new Date(webSummary.generatedAt).toLocaleString()}
                            </p>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── Structured Investor Card ───────────────────────────────────
    const { verdict, founderProfiles, foundersMoat, executionTimeline, executionGaps, keyMetrics } = parsed;

    return (
        <div className="space-y-5">
            {/* ── Row 1: Score Gauge + Verdict + Key Metrics ── */}
            <div className={`rounded-xl border p-4 ${score != null ? getScoreBg(score) : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-5">
                    {score != null && <ScoreGauge score={score} />}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-gray-900 mb-1">Team & Execution</h3>
                        <p className="text-sm text-gray-800 leading-relaxed">{verdict}</p>
                    </div>
                </div>

                {/* Key Metrics strip */}
                {keyMetrics && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        <MetricPill label="Team Size" value={keyMetrics.teamSize} />
                        <MetricPill label="Active Users" value={keyMetrics.activeUsers} />
                        <MetricPill label="Paying Cos." value={keyMetrics.payingCompanies} />
                        <MetricPill label="ARR" value={keyMetrics.arr} />
                        <MetricPill label="Funding Raised" value={keyMetrics.fundingRaised} />
                    </div>
                )}
            </div>

            {/* ── Row 2: Founder Profiles ── */}
            {founderProfiles.length > 0 && (
                <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                        👥 Founding Team
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {founderProfiles.map((founder, i) => {
                            const style = getArchetypeStyle(founder.archetype);
                            return (
                                <div
                                    key={i}
                                    className={`rounded-lg border p-3 ${style.bg} ${style.border}`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{founder.name}</p>
                                            <p className="text-xs text-gray-700">{founder.role}</p>
                                        </div>
                                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${style.bg} ${style.text} border ${style.border}`}>
                                            {style.emoji} {founder.archetype}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-800 leading-relaxed mb-1">{founder.background}</p>
                                    <p className="text-[10px] text-gray-600 italic">{founder.linkedinSignal}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Row 3: Founders' Moat Callout ── */}
            {foundersMoat && (
                <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/60 p-4">
                    <h4 className="text-sm font-bold text-indigo-900 mb-1 flex items-center gap-1.5">
                        🏰 Founders&apos; Moat
                    </h4>
                    <p className="text-sm text-gray-800 leading-relaxed mb-2">{foundersMoat.unfairAdvantage}</p>
                    <div className="flex items-start gap-2 bg-white/70 rounded-lg p-2 border border-indigo-100">
                        <span className="text-indigo-500 text-xs mt-0.5">▸</span>
                        <p className="text-xs text-gray-700 italic">{foundersMoat.signal}</p>
                    </div>
                </div>
            )}

            {/* ── Row 4: Execution Velocity Timeline (FOCAL POINT) ── */}
            {executionTimeline.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-1.5">
                        🚀 Execution Velocity
                    </h4>
                    <div className="relative">
                        {/* Timeline vertical line */}
                        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
                        <div className="space-y-4">
                            {executionTimeline.map((item, i) => {
                                const isCompleted = item.status === 'completed';
                                const isInProgress = item.status === 'in-progress';
                                return (
                                    <div key={i} className="relative flex items-start gap-3 pl-0">
                                        {/* Dot */}
                                        <div className={`relative z-10 mt-0.5 flex-shrink-0 w-[15px] h-[15px] rounded-full border-2 ${
                                            isCompleted
                                                ? 'bg-green-500 border-green-500'
                                                : isInProgress
                                                    ? 'bg-amber-400 border-amber-400 animate-pulse'
                                                    : 'bg-white border-gray-300'
                                        }`}>
                                            {isCompleted && (
                                                <svg className="w-full h-full text-white p-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        {/* Content */}
                                        <div className="flex-1 min-w-0 -mt-0.5">
                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                <span className="text-xs font-bold text-gray-900">{item.date}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide ${
                                                    isCompleted ? 'bg-green-100 text-green-700' :
                                                    isInProgress ? 'bg-amber-100 text-amber-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {item.status.replace('-', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-700 leading-relaxed mt-0.5">{item.milestone}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Row 5: Execution Gaps (Actionable Insights) ── */}
            {executionGaps.length > 0 && (
                <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                        🎯 Critical Focus Areas
                    </h4>
                    <div className="space-y-2">
                        {executionGaps.map((gap, i) => (
                            <div
                                key={i}
                                className={`rounded-lg border-l-4 p-3 ${
                                    gap.severity === 'critical'
                                        ? 'border-l-red-500 bg-red-50/70 border border-red-200'
                                        : 'border-l-amber-400 bg-amber-50/70 border border-amber-200'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-bold ${
                                        gap.severity === 'critical' ? 'text-red-800' : 'text-amber-800'
                                    }`}>
                                        {gap.gap}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                        gap.severity === 'critical'
                                            ? 'bg-red-200 text-red-800'
                                            : 'bg-amber-200 text-amber-800'
                                    }`}>
                                        {gap.severity}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-700 leading-relaxed">{gap.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Row 6: Strengths / Weaknesses (collapsed) ── */}
            {(strengths.length > 0 || weaknesses.length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                    {strengths.length > 0 && (
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                            <h5 className="text-xs font-semibold text-green-800 mb-1.5">✅ Execution Signals</h5>
                            <ul className="space-y-1">
                                {strengths.map((s, i) => (
                                    <li key={i} className="text-xs text-green-700">• {s}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {weaknesses.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                            <h5 className="text-xs font-semibold text-red-800 mb-1.5">⚠️ Risk Flags</h5>
                            <ul className="space-y-1">
                                {weaknesses.map((w, i) => (
                                    <li key={i} className="text-xs text-red-700">• {w}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* ── Row 7: Open Questions ── */}
            {openQuestions.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <h5 className="text-xs font-semibold text-amber-800 mb-1.5">❓ Open Diligence Questions</h5>
                    <ul className="space-y-1">
                        {openQuestions.map((q, i) => (
                            <li key={i} className="text-xs text-amber-700">• {q}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ── Row 8: Web Analysis Summary ── */}
            {webSummary && (
                <div className="border-t border-purple-200 pt-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-purple-800">🌐 Web Analysis Summary</span>
                        {webAnalysis?.overallWebScore != null && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-bold">
                                {String(webAnalysis.overallWebScore)}/10
                            </span>
                        )}
                    </div>
                    <div className="prose prose-sm prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{webSummary.markdown}</ReactMarkdown>
                    </div>
                    {webSummary.generatedAt && (
                        <p className="mt-1 text-[10px] text-gray-600">
                            Web analysis: {new Date(webSummary.generatedAt).toLocaleString()}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
