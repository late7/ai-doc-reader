import { NextRequest, NextResponse } from 'next/server';
import { setFactSheetRequired, getWorkspaceMeta } from '@/lib/workspaceMeta';
import path from 'path';
import fs from 'fs/promises';

const VALID_SECTIONS = ['case-overview', 'team-execution', 'business-potential-market', 'product-technology', 'economics-finance'];

/**
 * Deletes all fact sheet output files for a workspace so the nightly cron
 * will regenerate everything from scratch.
 */
async function clearFactSheetData(workspaceSlug: string): Promise<void> {
    const processedDir = path.join(process.cwd(), 'storage', workspaceSlug, 'processed');
    const filesToDelete: string[] = [];

    for (const sec of VALID_SECTIONS) {
        filesToDelete.push(
            `factsheet_${sec}.json`,
            `factsheet_tracker_${sec}.json`,
            `factsheet_status_${sec}.json`,
            `factsheet_web_analysis_${sec}.json`,
            `factsheet_web_analysis_status_${sec}.json`,
            `factsheet_web_summary_${sec}.json`,
            `factsheet_web_summary_status_${sec}.json`,
        );
    }
    filesToDelete.push(
        'factsheet_case_summary.json',
        'factsheet_investor_factsheet.json',
        'factsheet_process_all.json',
    );

    for (const f of filesToDelete) {
        try { await fs.unlink(path.join(processedDir, f)); } catch { /* doesn't exist */ }
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, factSheetRequired, clearData } = body;

        if (!workspaceSlug || typeof workspaceSlug !== 'string') {
            return NextResponse.json({ error: 'workspaceSlug is required' }, { status: 400 });
        }
        if (typeof factSheetRequired !== 'boolean') {
            return NextResponse.json({ error: 'factSheetRequired must be a boolean' }, { status: 400 });
        }

        // When marking for nightly reprocessing, clear existing fact sheet data
        if (factSheetRequired && clearData) {
            await clearFactSheetData(workspaceSlug);
        }

        await setFactSheetRequired(workspaceSlug, factSheetRequired);
        const meta = await getWorkspaceMeta(workspaceSlug);

        return NextResponse.json({ success: true, meta });
    } catch (error) {
        console.error('Error updating factsheet flag:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update flag' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');

        if (!workspaceSlug) {
            return NextResponse.json({ error: 'workspace parameter is required' }, { status: 400 });
        }

        const meta = await getWorkspaceMeta(workspaceSlug);
        return NextResponse.json({ meta });
    } catch (error) {
        console.error('Error reading factsheet flag:', error);
        return NextResponse.json({ error: 'Failed to read flag' }, { status: 500 });
    }
}
