import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

/**
 * GET: Read current "Process All" orchestration status from disk.
 * POST: Save/update "Process All" orchestration status to disk.
 *
 * The status file (factsheet_process_all.json) persists across page reloads
 * so the client can resume polling and orchestrating where it left off.
 */

interface ProcessAllStatus {
    active: boolean;
    sections: string[];
    completedSections: string[];
    startedAt: string | null;
    error: string | null;
}

const DEFAULT_STATUS: ProcessAllStatus = {
    active: false,
    sections: [],
    completedSections: [],
    startedAt: null,
    error: null,
};

function getStatusFilePath(workspaceSlug: string): string {
    const projectRoot = process.cwd();
    return path.join(projectRoot, 'storage', workspaceSlug, 'processed', 'factsheet_process_all.json');
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');

        if (!workspaceSlug) {
            return NextResponse.json({ error: 'workspace parameter is required' }, { status: 400 });
        }

        const statusFile = getStatusFilePath(workspaceSlug);

        try {
            const content = await fs.readFile(statusFile, 'utf-8');
            return NextResponse.json(JSON.parse(content));
        } catch {
            return NextResponse.json(DEFAULT_STATUS);
        }
    } catch (error) {
        console.error('Error reading process-all status:', error);
        return NextResponse.json({ error: 'Failed to read status' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, status } = body;

        if (!workspaceSlug) {
            return NextResponse.json({ error: 'workspaceSlug is required' }, { status: 400 });
        }

        if (!status) {
            return NextResponse.json({ error: 'status is required' }, { status: 400 });
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');
        await fs.mkdir(processedDir, { recursive: true });

        const statusFile = path.join(processedDir, 'factsheet_process_all.json');
        await fs.writeFile(statusFile, JSON.stringify(status, null, 2), 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving process-all status:', error);
        return NextResponse.json({ error: 'Failed to save status' }, { status: 500 });
    }
}
