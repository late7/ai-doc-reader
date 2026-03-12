'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import FactSheetTab from './FactSheetTab';
import FactSheetSummaryPanel from './FactSheetSummaryPanel';
import InvestorFactSheetPanel from './InvestorFactSheetPanel';

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
    financialMetrics?: {
        currency: string | null;
        scalingNote: string | null;
        items: Array<{ label: string; value: number | null; formatted: string; period: string | null }>;
    } | null;
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
    executiveSummary: {
        whatTheyDo: string | null;
        growthSignal: string | null;
        capitalRationale: string | null;
    } | null;
}

interface InvestorFactSheet {
    companyName: string | null;
    sector: string | null;
    valueProposition: string | null;
    keyBadges: string[];
    investmentHighlights: Array<{ type: string; icon: string; label: string; headline: string; detail: string }>;
    leadInvestorValidation: { investor: string; commitment: string; detail: string } | null;
    whyNow: { headline: string; detail: string } | null;
    financialSnapshot: Array<{ metric: string; value: string; note: string | null }>;
    useOfFunds: Array<{ percentage: number; label: string; detail: string }>;
    executionTimeline: Array<{ date: string; milestone: string; status: 'completed' | 'in-progress' | 'planned' }>;
    askAmount: string | null;
    stage: string | null;
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
        id: 'case-overview',
        title: 'Case Overview',
        shortTitle: 'Case',
        color: 'bg-indigo-500',
        bgColor: 'bg-indigo-50',
        bgColorExpanded: 'bg-indigo-50',
        headerColor: 'bg-indigo-100',
        headerHover: 'hover:bg-indigo-200',
        icon: '🏢',
    },
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
    const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({
        'case-overview': true,
        'team-execution': false,
        'business-potential-market': false,
        'product-technology': false,
        'economics-finance': false,
        'investment-memo': false,
        'investor-factsheet': false,
    });
    const [canonicals, setCanonicals] = useState<Record<string, CanonicalDoc>>({});
    const [caseSummary, setCaseSummary] = useState<CaseSummary | null>(null);
    const [investorFactSheet, setInvestorFactSheet] = useState<InvestorFactSheet | null>(null);
    const [fileStatuses, setFileStatuses] = useState<Record<string, FileStatus>>({});
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);
    const [isLoadingFactSheet, setIsLoadingFactSheet] = useState(false);

    // Global "Process All" state
    const [globalProcessing, setGlobalProcessing] = useState<{
        active: boolean;
        currentSectionIndex: number;
        sectionsCompleted: number;
        docsProcessed: number;
        totalDocs: number;
        error: string | null;
    }>({ active: false, currentSectionIndex: 0, sectionsCompleted: 0, docsProcessed: 0, totalDocs: 0, error: null });
    const globalProcessingRef = useRef(false);
    const hasCheckedResume = useRef(false);

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

    // Load investor fact sheet
    const loadInvestorFactSheet = useCallback(async () => {
        try {
            const response = await fetch(`/api/fact-sheet/investor-factsheet?workspace=${workspaceSlug}`);
            if (response.ok) {
                const data = await response.json();
                if (data.factsheet) setInvestorFactSheet(data.factsheet);
            }
        } catch (error) {
            console.error('Error loading investor fact sheet:', error);
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
        loadInvestorFactSheet();
        loadFileStatuses();
    }, [loadCanonicals, loadCaseSummary, loadInvestorFactSheet, loadFileStatuses]);

    const toggleTab = (tabId: string) => {
        setExpandedTabs(prev => ({ ...prev, [tabId]: !prev[tabId] }));
    };

    const handleSectionProcessed = useCallback(async (sectionId: string) => {
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
    }, [workspaceSlug]);

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

    const handleUpdateInvestorFactSheet = async () => {
        setIsLoadingFactSheet(true);
        try {
            const response = await fetch('/api/fact-sheet/investor-factsheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug }),
            });
            if (response.ok) {
                const data = await response.json();
                if (data.factsheet) setInvestorFactSheet(data.factsheet);
            }
        } catch (error) {
            console.error('Error generating investor fact sheet:', error);
        } finally {
            setIsLoadingFactSheet(false);
        }
    };

    // --- Process All: persistence helpers ---
    const saveProcessAllStatus = useCallback(async (status: {
        active: boolean;
        sections: string[];
        completedSections: string[];
        startedAt: string | null;
        error: string | null;
    }) => {
        try {
            await fetch('/api/fact-sheet/process-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, status }),
            });
        } catch (e) {
            console.error('Failed to save process-all status:', e);
        }
    }, [workspaceSlug]);

    const loadProcessAllStatus = useCallback(async () => {
        try {
            const res = await fetch(`/api/fact-sheet/process-all?workspace=${workspaceSlug}`);
            if (res.ok) return res.json();
        } catch (e) {
            console.error('Failed to load process-all status:', e);
        }
        return { active: false, sections: [], completedSections: [], startedAt: null, error: null };
    }, [workspaceSlug]);

    const fetchSectionStatus = useCallback(async (sectionId: string) => {
        try {
            const res = await fetch(`/api/fact-sheet/status?workspace=${workspaceSlug}&section=${sectionId}`);
            if (res.ok) return res.json();
        } catch {}
        return { status: 'idle', progress: '', error: null };
    }, [workspaceSlug]);

    // Helper: run web analysis + summary for a section (fire-and-forget style with await)
    const runWebAnalysisForSection = useCallback(async (sectionId: string): Promise<boolean> => {
        try {
            console.log(`[process-all] Starting web analysis for ${sectionId}...`);
            const webRes = await fetch('/api/fact-sheet/web-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, sectionId }),
            });
            if (!webRes.ok) {
                console.error(`[process-all] Web analysis failed for ${sectionId}`);
                return false;
            }
            console.log(`[process-all] Web analysis complete for ${sectionId}, generating summary...`);
            const summaryRes = await fetch('/api/fact-sheet/web-analysis-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, sectionId }),
            });
            if (!summaryRes.ok) {
                console.warn(`[process-all] Web summary failed for ${sectionId} (non-fatal)`);
            }
            return true;
        } catch (err) {
            console.error(`[process-all] Web analysis error for ${sectionId}:`, err);
            return false;
        }
    }, [workspaceSlug]);

    // Helper: generate Investment Memo
    const generateInvestmentMemo = useCallback(async () => {
        try {
            console.log('[process-all] Generating Investment Memo...');
            const response = await fetch('/api/fact-sheet/case-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug }),
            });
            if (response.ok) {
                const data = await response.json();
                if (data.summary) setCaseSummary(data.summary);
                console.log('[process-all] Investment Memo generated successfully');
                return true;
            }
            console.error('[process-all] Investment Memo generation failed');
            return false;
        } catch (err) {
            console.error('[process-all] Investment Memo error:', err);
            return false;
        }
    }, [workspaceSlug]);

    // Helper: generate Investor Fact Sheet
    const generateInvestorFactSheetHelper = useCallback(async () => {
        try {
            console.log('[process-all] Generating Investor Fact Sheet...');
            const response = await fetch('/api/fact-sheet/investor-factsheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug }),
            });
            if (response.ok) {
                const data = await response.json();
                if (data.factsheet) setInvestorFactSheet(data.factsheet);
                console.log('[process-all] Investor Fact Sheet generated successfully');
                return true;
            }
            console.error('[process-all] Investor Fact Sheet generation failed');
            return false;
        } catch (err) {
            console.error('[process-all] Investor Fact Sheet error:', err);
            return false;
        }
    }, [workspaceSlug]);

    // --- Global Process All: sequentially process all 5 sections + web analysis + investment memo ---
    // Works by fire-and-forget POST + polling so it can resume after page reload.
    // Pipeline: Case Overview (1st) → Team → Market → Product → Finance → Investment Memo → Investor Fact Sheet
    // Per section: Canonical Processing → Web Analysis → Web Summary
    // Case Overview runs first so company name is available for all subsequent web analysis calls.
    const processAllSections = useCallback(async (resumeCompletedSections?: string[]) => {
        if (globalProcessing.active && !resumeCompletedSections) return;

        const sectionIds = SECTIONS.map(s => s.id);
        const completedSections = resumeCompletedSections ? [...resumeCompletedSections] : [];
        const startedAt = resumeCompletedSections ? (await loadProcessAllStatus()).startedAt : new Date().toISOString();

        console.log(`[ProcessAll] ⚡ Starting pipeline — ${resumeCompletedSections ? 'resuming from ' + completedSections.length + ' completed' : 'fresh run'}, sections: ${sectionIds.join(', ')}`);

        // Calculate total docs across all sections
        let totalDocs = 0;
        for (const section of SECTIONS) {
            const fs = fileStatuses[section.id];
            if (fs) totalDocs += fs.files.length;
        }
        console.log(`[ProcessAll] Total documents across all sections: ${totalDocs}`);

        globalProcessingRef.current = true;
        setGlobalProcessing({
            active: true,
            currentSectionIndex: completedSections.length,
            sectionsCompleted: completedSections.length,
            docsProcessed: 0,
            totalDocs,
            error: null,
        });

        // Save initial state to server (only for fresh start)
        if (!resumeCompletedSections) {
            await saveProcessAllStatus({
                active: true,
                sections: sectionIds,
                completedSections: [],
                startedAt: startedAt,
                error: null,
            });
        }

        let docsProcessedSoFar = 0;
        let sectionsActuallyProcessed = 0;

        for (let i = 0; i < SECTIONS.length; i++) {
            if (!globalProcessingRef.current) break;

            const section = SECTIONS[i];

            // Skip sections that were already completed in this run
            if (completedSections.includes(section.id)) {
                const sectionDocs = fileStatuses[section.id]?.files.length || 0;
                docsProcessedSoFar += sectionDocs;
                continue;
            }

            // Skip sections that are fully processed (canonical current + no new files)
            const sectionFileStatus = fileStatuses[section.id];
            const sectionCanonical = canonicals[section.id];
            const isFullyProcessed = sectionCanonical?.sourcesProcessed?.length > 0
                && sectionFileStatus && sectionFileStatus.newFilesCount === 0;
            if (isFullyProcessed && !resumeCompletedSections) {
                const sectionDocs = sectionFileStatus?.files.length || 0;
                docsProcessedSoFar += sectionDocs;
                completedSections.push(section.id);
                setGlobalProcessing(prev => ({
                    ...prev,
                    sectionsCompleted: completedSections.length,
                    docsProcessed: docsProcessedSoFar,
                }));

                // Check if web analysis already exists — skip if it does
                let webAlreadyDone = false;
                try {
                    const webRes = await fetch(`/api/fact-sheet/web-analysis?workspace=${workspaceSlug}&section=${section.id}`);
                    if (webRes.ok) {
                        const webData = await webRes.json();
                        webAlreadyDone = webData?.webAnalysis != null;
                    }
                } catch {}

                if (webAlreadyDone) {
                    console.log(`[ProcessAll] ⏭️ Fully skipping "${section.title}" — canonical and web analysis both current`);
                } else {
                    console.log(`[ProcessAll] ⏭️ Canonical current for "${section.title}" — running web analysis (no existing results)`);
                    await runWebAnalysisForSection(section.id);
                    sectionsActuallyProcessed++;
                }
                continue;
            }

            setGlobalProcessing(prev => ({ ...prev, currentSectionIndex: i }));
            console.log(`[ProcessAll] 📄 Processing section ${i + 1}/${SECTIONS.length}: "${section.title}" — canonical docs + web analysis`);

            // Check if this section is already running on the server (e.g. from before reload)
            const serverStatus = await fetchSectionStatus(section.id);

            if (serverStatus.status !== 'running') {
                // Fire POST (don't await the response — it blocks until processing finishes)
                fetch('/api/fact-sheet/process', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workspaceSlug, sectionId: section.id, processNewOnly: false }),
                }).catch(err => console.error(`Error processing ${section.id}:`, err));

                // Wait for server to start and update status to 'running'
                let acknowledged = false;
                for (let attempt = 0; attempt < 15 && globalProcessingRef.current; attempt++) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const s = await fetchSectionStatus(section.id);
                    if (s.status === 'running') {
                        acknowledged = true;
                        break;
                    }
                    // If it already completed (fast section), that also counts
                    if (s.status === 'completed') {
                        acknowledged = true;
                        break;
                    }
                }

                if (!acknowledged && globalProcessingRef.current) {
                    console.error(`Server did not acknowledge processing for ${section.id}`);
                    setGlobalProcessing(prev => ({ ...prev, active: false, error: `Failed to start ${section.title}` }));
                    await saveProcessAllStatus({
                        active: false, sections: sectionIds, completedSections, startedAt, error: `Failed to start ${section.title}`,
                    });
                    globalProcessingRef.current = false;
                    return;
                }
            }

            // Poll until this section completes
            let sectionDone = false;
            while (!sectionDone && globalProcessingRef.current) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const pollStatus = await fetchSectionStatus(section.id);
                if (pollStatus.status === 'completed' || pollStatus.status === 'idle') {
                    sectionDone = true;
                } else if (pollStatus.status === 'error') {
                    sectionDone = true;
                    console.error(`Section ${section.id} processing error:`, pollStatus.error);
                }
            }

            // Refresh this section's data
            await handleSectionProcessed(section.id);

            // --- Auto-trigger web analysis after canonical processing ---
            if (globalProcessingRef.current) {
                await runWebAnalysisForSection(section.id);
            }

            const sectionDocs = fileStatuses[section.id]?.files.length || 0;
            docsProcessedSoFar += sectionDocs;
            sectionsActuallyProcessed++;
            completedSections.push(section.id);
            console.log(`[ProcessAll] ✅ Section "${section.title}" complete (${completedSections.length}/${SECTIONS.length})`); 

            setGlobalProcessing(prev => ({
                ...prev,
                sectionsCompleted: completedSections.length,
                docsProcessed: docsProcessedSoFar,
            }));

            // Save progress to server so we can resume after reload
            await saveProcessAllStatus({
                active: true,
                sections: sectionIds,
                completedSections: [...completedSections],
                startedAt,
                error: null,
            });
        }

        // --- After all sections done: generate Investment Memo then Investor Fact Sheet ---
        // Only regenerate if something was actually processed this run, or if they don't exist yet
        if (globalProcessingRef.current) {
            if (sectionsActuallyProcessed > 0 || !caseSummary) {
                setGlobalProcessing(prev => ({
                    ...prev,
                    currentSectionIndex: SECTIONS.length, // signals "Investment Memo" step
                }));
                await generateInvestmentMemo();
            } else {
                console.log('[process-all] Skipping Investment Memo — no new data processed, existing memo is current');
            }
        }

        if (globalProcessingRef.current) {
            if (sectionsActuallyProcessed > 0 || !investorFactSheet) {
                setGlobalProcessing(prev => ({
                    ...prev,
                    currentSectionIndex: SECTIONS.length + 1, // signals "Investor Fact Sheet" step
                }));
                await generateInvestorFactSheetHelper();
            } else {
                console.log('[process-all] Skipping Investor Fact Sheet — no new data processed, existing sheet is current');
            }
        }

        // All done - reload everything
        console.log(`[ProcessAll] 🎉 Pipeline complete — ${completedSections.length} sections processed + Investment Memo + Investor Fact Sheet generated`);
        await Promise.all([loadCanonicals(), loadFileStatuses()]);
        globalProcessingRef.current = false;
        setGlobalProcessing(prev => ({ ...prev, active: false }));

        await saveProcessAllStatus({
            active: false,
            sections: sectionIds,
            completedSections,
            startedAt,
            error: null,
        });
    }, [globalProcessing.active, fileStatuses, canonicals, workspaceSlug, fetchSectionStatus, saveProcessAllStatus, loadProcessAllStatus, handleSectionProcessed, loadCanonicals, loadFileStatuses, runWebAnalysisForSection, generateInvestmentMemo, generateInvestorFactSheetHelper]);

    const cancelGlobalProcessing = useCallback(async () => {
        globalProcessingRef.current = false;
        setGlobalProcessing(prev => ({ ...prev, active: false }));
        await saveProcessAllStatus({
            active: false,
            sections: SECTIONS.map(s => s.id),
            completedSections: [],
            startedAt: null,
            error: 'Cancelled by user',
        });
    }, [saveProcessAllStatus]);

    // --- Resume Process All on mount if it was active ---
    useEffect(() => {
        if (hasCheckedResume.current) return;
        hasCheckedResume.current = true;

        const checkAndResume = async () => {
            const savedStatus = await loadProcessAllStatus();
            if (savedStatus.active && savedStatus.sections?.length > 0) {
                // There was an active Process All when the page was closed/reloaded
                console.log('Resuming Process All from:', savedStatus.completedSections?.length || 0, 'completed sections');
                processAllSections(savedStatus.completedSections || []);
            }
        };
        checkAndResume();
    }, [loadProcessAllStatus, processAllSections]);

    return (
        <div className="flex flex-col gap-3 h-[calc(100vh-160px)]">
            {/* Top Bar: Process All + Status */}
            <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => processAllSections()}
                        disabled={globalProcessing.active}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            globalProcessing.active
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                        }`}
                    >
                        {globalProcessing.active ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Processing... this can take 5 to 30 minutes
                            </span>
                        ) : (
                            '⚡ Process All'
                        )}
                    </button>

                    {globalProcessing.active && (
                        <button
                            onClick={cancelGlobalProcessing}
                            className="px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-4">
                    {globalProcessing.active && (
                        <div className="flex items-center gap-3">
                            {/* Current section indicator */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">
                                    {globalProcessing.currentSectionIndex < SECTIONS.length ? (
                                        <>
                                            {SECTIONS[globalProcessing.currentSectionIndex]?.icon}{' '}
                                            {SECTIONS[globalProcessing.currentSectionIndex]?.title}
                                        </>
                                    ) : globalProcessing.currentSectionIndex === SECTIONS.length ? (
                                        <>Internal Investment Memo</>
                                    ) : (
                                        <>Investor Fact Sheet</>
                                    )}
                                </span>
                                <span className="text-xs text-gray-600">
                                    ({Math.min(globalProcessing.sectionsCompleted + 1, SECTIONS.length + 2)} of {SECTIONS.length + 2})
                                </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                    style={{ width: `${(globalProcessing.sectionsCompleted / (SECTIONS.length + 2)) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Doc count summary */}
                    <div className="text-sm text-gray-700">
                        {(() => {
                            const processedCount = Object.values(fileStatuses).reduce(
                                (sum, fs) => sum + (fs?.processedFilesCount || 0), 0
                            );
                            const totalCount = Object.values(fileStatuses).reduce(
                                (sum, fs) => sum + (fs?.files?.length || 0), 0
                            );
                            return (
                                <span className="font-medium">
                                    {processedCount} <span className="text-gray-600">({totalCount})</span>{' '}
                                    <span className="text-gray-700">Data Points Processed</span>
                                </span>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Score Meters — case-overview excluded, it has no investment score */}
            <div className="grid grid-cols-4 gap-3">
                {SECTIONS.filter(s => s.id !== 'case-overview').map((section) => {
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

            {/* Vertical Collapsible Tabs (Sections + Investment Memo) */}
            <div className="flex gap-2 flex-1 min-h-0">
                {SECTIONS.map((section) => {
                    const isExpanded = expandedTabs[section.id] ?? false;
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
                                        isGlobalProcessing={globalProcessing.active}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Investment Memo - Collapsible Tab (50% wider when collapsed) */}
                {(() => {
                    const isMemoExpanded = expandedTabs['investment-memo'] ?? false;
                    const hasMemoData = caseSummary && (caseSummary.overallScore !== null || caseSummary.summary);
                    return (
                        <div
                            className={`
                                flex flex-col rounded-lg shadow-sm border border-blue-200 overflow-hidden transition-all duration-300 ease-in-out
                                ${isMemoExpanded ? 'flex-1 min-w-[320px]' : 'w-[5.25rem] cursor-pointer'}
                            `}
                        >
                            {/* Tab Header / Collapsed Bar */}
                            <button
                                onClick={() => toggleTab('investment-memo')}
                                className={`
                                    relative flex items-center transition-colors
                                    ${isMemoExpanded
                                        ? 'bg-gradient-to-r from-gray-100 to-blue-100 hover:from-gray-200 hover:to-blue-200 px-4 py-3 justify-between'
                                        : 'bg-gradient-to-b from-gray-100 to-blue-100 hover:from-gray-200 hover:to-blue-200 flex-col h-full py-4 px-1 justify-start'
                                    }
                                `}
                            >
                                {/* Status dot */}
                                <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0 ${
                                    hasMemoData ? 'bg-green-500' : 'bg-gray-400'
                                } ${isMemoExpanded ? '' : 'mb-3'}`} />

                                {isMemoExpanded ? (
                                    <div className="flex-1 ml-3 text-left">
                                        <h3 className="font-semibold text-gray-800 text-sm">
                                            📋 Internal Investment Memo
                                        </h3>
                                        {caseSummary?.overallScore != null && (
                                            <span className="text-xs text-gray-600">
                                                Score: {caseSummary.overallScore.toFixed(1)}/10
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center mt-2">
                                        <span className="text-lg mb-2">📋</span>
                                        {caseSummary?.overallScore != null && (
                                            <span className="text-xs font-bold text-gray-800 mb-1">
                                                {caseSummary.overallScore.toFixed(1)}
                                            </span>
                                        )}
                                        <span
                                            className="text-xs font-medium text-gray-700 whitespace-nowrap"
                                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                                        >
                                            Internal Investment Memo
                                        </span>
                                    </div>
                                )}

                                {isMemoExpanded && (
                                    <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                )}
                            </button>

                            {/* Memo Content */}
                            {isMemoExpanded && (
                                <div className="flex-1 overflow-hidden bg-white">
                                    <FactSheetSummaryPanel
                                        caseSummary={caseSummary}
                                        canonicals={canonicals}
                                        isLoading={isLoadingSummary}
                                        onUpdate={handleUpdateCaseSummary}
                                        workspaceSlug={workspaceSlug}
                                        isGlobalProcessing={globalProcessing.active}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Investor Fact Sheet - Collapsible Tab */}
                {(() => {
                    const isFactSheetExpanded = expandedTabs['investor-factsheet'] ?? false;
                    const hasFactSheetData = investorFactSheet && (investorFactSheet.companyName || investorFactSheet.valueProposition);
                    return (
                        <div
                            className={`
                                flex flex-col rounded-lg shadow-sm border border-emerald-200 overflow-hidden transition-all duration-300 ease-in-out
                                ${isFactSheetExpanded ? 'flex-1 min-w-[320px]' : 'w-[5.25rem] cursor-pointer'}
                            `}
                        >
                            {/* Tab Header / Collapsed Bar */}
                            <button
                                onClick={() => toggleTab('investor-factsheet')}
                                className={`
                                    relative flex items-center transition-colors
                                    ${isFactSheetExpanded
                                        ? 'bg-gradient-to-r from-slate-100 to-emerald-100 hover:from-slate-200 hover:to-emerald-200 px-4 py-3 justify-between'
                                        : 'bg-gradient-to-b from-slate-100 to-emerald-100 hover:from-slate-200 hover:to-emerald-200 flex-col h-full py-4 px-1 justify-start'
                                    }
                                `}
                            >
                                {/* Status dot */}
                                <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0 ${
                                    hasFactSheetData ? 'bg-green-500' : 'bg-gray-400'
                                } ${isFactSheetExpanded ? '' : 'mb-3'}`} />

                                {isFactSheetExpanded ? (
                                    <div className="flex-1 ml-3 text-left">
                                        <h3 className="font-semibold text-gray-800 text-sm">
                                            Fact Sheet
                                        </h3>
                                        <span className="text-xs text-gray-600">External Investor One-Pager</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center mt-2">
                                        <span
                                            className="text-xs font-medium text-gray-700 whitespace-nowrap"
                                            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                                        >
                                            Fact Sheet
                                        </span>
                                    </div>
                                )}

                                {isFactSheetExpanded && (
                                    <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                )}
                            </button>

                            {/* Fact Sheet Content */}
                            {isFactSheetExpanded && (
                                <div className="flex-1 overflow-hidden bg-white">
                                    <InvestorFactSheetPanel
                                        factsheet={investorFactSheet}
                                        canonicals={canonicals}
                                        isLoading={isLoadingFactSheet}
                                        onUpdate={handleUpdateInvestorFactSheet}
                                        workspaceSlug={workspaceSlug}
                                        isGlobalProcessing={globalProcessing.active}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
