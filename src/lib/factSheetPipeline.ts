/**
 * Server-side orchestrator for the full Fact Sheet pipeline.
 * Calls existing API routes sequentially via internal fetch.
 * Supports passing serviceTier ('flex' for overnight, undefined for standard).
 */

const SECTIONS = [
    'case-overview',
    'team-execution',
    'business-potential-market',
    'product-technology',
    'economics-finance',
];

// 20 minutes — flex processing can be very slow, and process route loops over multiple files
const FETCH_TIMEOUT_MS = 20 * 60 * 1000;

interface PipelineResult {
    success: boolean;
    error?: string;
    stepsCompleted: string[];
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function postStep(
    baseUrl: string,
    path: string,
    body: Record<string, unknown>,
    stepLabel: string
): Promise<void> {
    console.log(`[pipeline] Starting: ${stepLabel}`);
    const startTime = Date.now();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        headers['Authorization'] = `Bearer ${cronSecret}`;
    }

    const res = await fetchWithTimeout(
        `${baseUrl}${path}`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        },
        FETCH_TIMEOUT_MS
    );

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (!res.ok) {
        const errorBody = await res.text().catch(() => 'unknown');
        throw new Error(`${stepLabel} failed (${res.status}) after ${elapsed}s: ${errorBody}`);
    }

    console.log(`[pipeline] Completed: ${stepLabel} in ${elapsed}s`);
}

/**
 * Runs the full Fact Sheet pipeline for a workspace:
 * 1. For each section: process docs → web analysis → web summary
 * 2. Generate investment memo (case summary)
 * 3. Generate investor fact sheet
 */
export async function runFullFactSheetPipeline(
    workspaceSlug: string,
    baseUrl: string,
    options?: { serviceTier?: string }
): Promise<PipelineResult> {
    const serviceTier = options?.serviceTier;
    const stepsCompleted: string[] = [];

    try {
        // Phase 1: Process all sections with document analysis + web analysis + web summary
        for (const sectionId of SECTIONS) {
            // Step 1: Process documents for this section
            await postStep(baseUrl, '/api/fact-sheet/process', {
                workspaceSlug,
                sectionId,
                processNewOnly: false,
                serviceTier,
            }, `process ${sectionId}`);
            stepsCompleted.push(`process:${sectionId}`);

            // Step 2: Web analysis for this section
            await postStep(baseUrl, '/api/fact-sheet/web-analysis', {
                workspaceSlug,
                sectionId,
                serviceTier,
            }, `web-analysis ${sectionId}`);
            stepsCompleted.push(`web-analysis:${sectionId}`);

            // Step 3: Web analysis summary for this section
            await postStep(baseUrl, '/api/fact-sheet/web-analysis-summary', {
                workspaceSlug,
                sectionId,
                serviceTier,
            }, `web-summary ${sectionId}`);
            stepsCompleted.push(`web-summary:${sectionId}`);
        }

        // Phase 2: Generate investment memo
        await postStep(baseUrl, '/api/fact-sheet/case-summary', {
            workspaceSlug,
            serviceTier,
        }, 'case-summary');
        stepsCompleted.push('case-summary');

        // Phase 3: Generate investor fact sheet
        await postStep(baseUrl, '/api/fact-sheet/investor-factsheet', {
            workspaceSlug,
            serviceTier,
        }, 'investor-factsheet');
        stepsCompleted.push('investor-factsheet');

        return { success: true, stepsCompleted };
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[pipeline] Failed for workspace "${workspaceSlug}": ${errMsg}`);
        return { success: false, error: errMsg, stepsCompleted };
    }
}
