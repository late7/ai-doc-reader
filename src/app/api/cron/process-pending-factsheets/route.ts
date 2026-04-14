import { NextRequest, NextResponse } from 'next/server';
import { listWorkspacesNeedingFactSheet, workspaceHasDocuments, setFactSheetRequired } from '@/lib/workspaceMeta';
import { runFullFactSheetPipeline } from '@/lib/factSheetPipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Next.js route timeout — the actual pipeline has its own internal timeouts

/**
 * GET /api/cron/process-pending-factsheets
 *
 * Overnight cron endpoint that processes Fact Sheet pipelines for all
 * workspaces flagged with factSheetRequired=true.
 *
 * Uses OpenAI Flex processing (service_tier: 'flex') for 50% cost savings.
 * Protected by CRON_SECRET Bearer token.
 */
export async function GET(request: NextRequest) {
    // Authenticate with CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    console.log('[cron] Starting overnight Fact Sheet processing (Flex tier)...');

    try {
        const slugs = await listWorkspacesNeedingFactSheet();
        console.log(`[cron] Found ${slugs.length} workspace(s) needing Fact Sheet: ${slugs.join(', ') || 'none'}`);

        if (slugs.length === 0) {
            return NextResponse.json({
                message: 'No workspaces need processing',
                processed: [],
                skipped: [],
                durationMs: Date.now() - startTime,
            });
        }

        // Determine base URL for internal API calls
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

        const results: { slug: string; success: boolean; error?: string; stepsCompleted: string[] }[] = [];
        const skipped: { slug: string; reason: string }[] = [];

        // Process workspaces sequentially to avoid overloading OpenAI
        for (const slug of slugs) {
            // Check if workspace has any documents to process
            const hasDocs = await workspaceHasDocuments(slug);
            if (!hasDocs) {
                console.log(`[cron] Skipping "${slug}" — no documents found`);
                skipped.push({ slug, reason: 'no documents' });
                continue;
            }

            console.log(`[cron] Processing workspace "${slug}" with Flex tier...`);
            const result = await runFullFactSheetPipeline(slug, baseUrl, { serviceTier: 'flex' });

            if (result.success) {
                await setFactSheetRequired(slug, false);
                console.log(`[cron] ✓ Completed "${slug}" — flag cleared`);
            } else {
                console.error(`[cron] ✗ Failed "${slug}": ${result.error} — flag remains for retry`);
            }

            results.push({ slug, ...result });
        }

        const durationMs = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        console.log(`[cron] Finished: ${successCount}/${results.length} succeeded, ${skipped.length} skipped, took ${Math.round(durationMs / 1000)}s`);

        return NextResponse.json({
            message: `Processed ${results.length} workspace(s)`,
            processed: results,
            skipped,
            durationMs,
        });
    } catch (error) {
        console.error('[cron] Fatal error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Cron job failed' },
            { status: 500 }
        );
    }
}
