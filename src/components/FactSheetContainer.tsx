'use client';

import { useState, useEffect, useCallback } from 'react';
import FactSheetTab from './FactSheetTab';
import FactSheetSummaryPanel from './FactSheetSummaryPanel';

interface FactSheetContainerProps {
    workspaceSlug: string;
}

interface SectionConfig {
    id: string;
    title: string;
    shortTitle: string;
    color: string;
    bgColor: string;
    bgColorExpanded: string;
    headerColor: string;
    headerHover: string;
    icon: string;
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
}

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

const SECTIONS: SectionConfig[] = [
    {
        id: 'team-execution',
        title: 'Team & Execution',
        shortTitle: 'Team',
        color: 'bg-blue-500',
        bgColor: 'bg-blue-50',
        bgColorExpanded: 'bg-blue-50',
        headerColor: 'bg-blue-100',
        headerHover: 'hover:bg-blue-200',
        icon: '👥',
    },
    {
        id: 'business-potential-market',
        title: 'Business Potential and Market',
        shortTitle: 'Market',
        color: 'bg-emerald-500',
        bgColor: 'bg-emerald-50',
        bgColorExpanded: 'bg-emerald-50',
        headerColor: 'bg-emerald-100',
        headerHover: 'hover:bg-emerald-200',
        icon: '📈',
    },
    {
        id: 'product-technology',
        title: 'Product & Technology',
        shortTitle: 'Product',
        color: 'bg-violet-500',
        bgColor: 'bg-violet-50',
        bgColorExpanded: 'bg-violet-50',
        headerColor: 'bg-violet-100',
        headerHover: 'hover:bg-violet-200',
        icon: '⚙️',
    },
    {
        id: 'economics-finance',
        title: 'Economics and Finance',
        shortTitle: 'Finance',
        color: 'bg-amber-500',
        bgColor: 'bg-amber-50',
        bgColorExpanded: 'bg-amber-50',
        headerColor: 'bg-amber-100',
        headerHover: 'hover:bg-amber-200',
        icon: '💰',
    },
];

function getScoreLabel(score: number | null): { label: string; color: string } {
    if (score === null) return { label: 'N/A', color: 'text-gray-500' };
    if (score >= 8) return { label: 'Great', color: 'text-blue-600' };
    if (score >= 6) return { label: 'Moderate', color: 'text-amber-600' };
    if (score >= 4) return { label: 'Fair', color: 'text-orange-500' };
    return { label: 'Weak', color: 'text-red-500' };
}

function getScoreBarColor(score: number | null): string {
    if (score === null) return 'bg-gray-200';
    if (score >= 8) return 'bg-blue-500';
    if (score >= 6) return 'bg-amber-500';
    if (score >= 4) return 'bg-orange-500';
    return 'bg-red-500';
}

export default function FactSheetContainer({ workspaceSlug }: FactSheetContainerProps) {
    const [expandedTab, setExpandedTab] = useState<string | null>('team-execution');
    const [canonicals, setCanonicals] = useState<Record<string, CanonicalDoc>>({});
    const [caseSummary, setCaseSummary] = useState<CaseSummary | null>(null);
    const [fileStatuses, setFileStatuses] = useState<Record<string, FileStatus>>({});
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);

    // Load all canonical docs
    const loadCanonicals = useCallback(async () => {
        try {
            const response = await fetch(`/api/fact-sheet/canonical?workspace=${workspaceSlug}`);
            if (response.ok) {
                const data = await response.json();
                if (data.canonicals) setCanonicals(data.canonicals);
            }
        } catch (error) {
            console.error('Error loading canonicals:', error);
        }
    }, [workspaceSlug]);

    // Load case summary
    const loadCaseSummary = useCallback(async () => {
        try {
            const response = await fetch(`/api/fact-sheet/case-summary?workspace=${workspaceSlug}`);
            if (response.ok) {
                const data = await response.json();
                if (data.summary) setCaseSummary(data.summary);
            }
        } catch (error) {
            console.error('Error loading case summary:', error);
        }
    }, [workspaceSlug]);

    // Load file statuses for all sections
    const loadFileStatuses = useCallback(async () => {
        const statuses: Record<string, FileStatus> = {};
        for (const section of SECTIONS) {
            try {
                const response = await fetch(`/api/fact-sheet/file-status?workspace=${workspaceSlug}&section=${section.id}`);
                if (response.ok) {
                    const data = await response.json();
                    statuses[section.id] = data;
                }
            } catch (error) {
                console.error(`Error loading file status for ${section.id}:`, error);
            }
        }
        setFileStatuses(statuses);
    }, [workspaceSlug]);

    useEffect(() => {
        loadCanonicals();
        loadCaseSummary();
        loadFileStatuses();
    }, [loadCanonicals, loadCaseSummary, loadFileStatuses]);

    const toggleTab = (tabId: string) => {
        setExpandedTab(prev => prev === tabId ? null : tabId);
    };

    const handleSectionProcessed = async (sectionId: string) => {
        // Reload that section's canonical doc and file status
        try {
            const [canonicalRes, fileStatusRes] = await Promise.all([
                fetch(`/api/fact-sheet/canonical?workspace=${workspaceSlug}&section=${sectionId}`),
                fetch(`/api/fact-sheet/file-status?workspace=${workspaceSlug}&section=${sectionId}`),
            ]);

            if (canonicalRes.ok) {
                const data = await canonicalRes.json();
                if (data.canonical) {
                    setCanonicals(prev => ({ ...prev, [sectionId]: data.canonical }));
                }
            }
            if (fileStatusRes.ok) {
                const data = await fileStatusRes.json();
                setFileStatuses(prev => ({ ...prev, [sectionId]: data }));
            }
        } catch (error) {
            console.error('Error refreshing section:', error);
        }
    };

    const handleUpdateCaseSummary = async () => {
        setIsLoadingSummary(true);
        try {
            const response = await fetch('/api/fact-sheet/case-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug }),
            });
            if (response.ok) {
                const data = await response.json();
                if (data.summary) setCaseSummary(data.summary);
            }
        } catch (error) {
            console.error('Error updating case summary:', error);
        } finally {
            setIsLoadingSummary(false);
        }
    };

    return (
        <div className="flex flex-col gap-3 h-[calc(100vh-160px)]">
            {/* Top: Score Meters */}
            <div className="grid grid-cols-4 gap-3">
                {SECTIONS.map((section) => {
                    const canonical = canonicals[section.id] as CanonicalDoc | undefined;
                    const score = canonical?.score ?? null;
                    const { label, color } = getScoreLabel(score);
                    const barColor = getScoreBarColor(score);

                    return (
                        <div
                            key={section.id}
                            className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => toggleTab(section.id)}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700 truncate">
                                    {section.shortTitle}
                                </span>
                                <span className="text-2xl font-bold text-gray-900">
                                    {score !== null ? score.toFixed(1) : '—'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium ${color}`}>{label}</span>
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                        style={{ width: score !== null ? `${score * 10}%` : '0%' }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Middle + Right: Tabs + Summary Panel */}
            <div className="flex gap-3 flex-1 min-h-0">
                {/* Vertical Collapsible Tabs */}
                <div className="flex gap-2 flex-1 min-w-0">
                    {SECTIONS.map((section) => {
                        const isExpanded = expandedTab === section.id;
                        const canonical = canonicals[section.id] as CanonicalDoc | undefined;
                        const fileStatus = fileStatuses[section.id];

                        return (
                            <div
                                key={section.id}
                                className={`
                                    flex flex-col rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ease-in-out
                                    ${isExpanded ? 'flex-1 min-w-[320px]' : 'w-14 cursor-pointer'}
                                `}
                            >
                                {/* Tab Header / Collapsed Bar */}
                                <button
                                    onClick={() => toggleTab(section.id)}
                                    className={`
                                        relative flex items-center transition-colors
                                        ${isExpanded
                                            ? `${section.headerColor} ${section.headerHover} px-4 py-3 justify-between`
                                            : `${section.headerColor} ${section.headerHover} flex-col h-full py-4 px-1 justify-start`
                                        }
                                    `}
                                >
                                    {/* Status dot */}
                                    <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0 ${
                                        canonical?.sourcesProcessed?.length
                                            ? (fileStatus?.newFilesCount ? 'bg-yellow-500' : 'bg-green-500')
                                            : 'bg-red-400'
                                    } ${isExpanded ? '' : 'mb-3'}`} />

                                    {isExpanded ? (
                                        <div className="flex-1 ml-3 text-left">
                                            <h3 className="font-semibold text-gray-800 text-sm">
                                                {section.icon} {section.title}
                                            </h3>
                                            {fileStatus && fileStatus.newFilesCount > 0 && (
                                                <span className="text-xs text-amber-700">
                                                    {fileStatus.newFilesCount} unprocessed
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center mt-2">
                                            <span className="text-lg mb-2">{section.icon}</span>
                                            <span
                                                className="text-xs font-medium text-gray-700 whitespace-nowrap"
                                                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                                            >
                                                {section.title}
                                            </span>
                                            {fileStatus && fileStatus.newFilesCount > 0 && (
                                                <span className="mt-2 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                                                    {fileStatus.newFilesCount}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {isExpanded && (
                                        <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    )}
                                </button>

                                {/* Tab Content */}
                                {isExpanded && (
                                    <div className="flex-1 overflow-auto bg-white">
                                        <FactSheetTab
                                            workspaceSlug={workspaceSlug}
                                            sectionId={section.id}
                                            sectionTitle={section.title}
                                            canonical={canonical || null}
                                            fileStatus={fileStatus || null}
                                            onProcessed={() => handleSectionProcessed(section.id)}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Right Panel: Investment Memo / Case Summary */}
                <div className="w-72 flex-shrink-0">
                    <FactSheetSummaryPanel
                        caseSummary={caseSummary}
                        canonicals={canonicals}
                        isLoading={isLoadingSummary}
                        onUpdate={handleUpdateCaseSummary}
                    />
                </div>
            </div>
        </div>
    );
}
