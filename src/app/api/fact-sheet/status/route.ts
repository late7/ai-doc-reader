import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

const VALID_SECTIONS = ['case-overview', 'team-execution', 'business-potential-market', 'product-technology', 'economics-finance'];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');
        const sectionId = searchParams.get('section');

        if (!workspaceSlug) {
            return NextResponse.json({ status: 'error', progress: '', error: 'workspace parameter is required' }, { status: 400 });
        }

        if (sectionId && !VALID_SECTIONS.includes(sectionId)) {
            return NextResponse.json({ status: 'error', progress: '', error: 'Invalid section' }, { status: 400 });
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');

        if (sectionId) {
            const statusFile = path.join(processedDir, `factsheet_status_${sectionId}.json`);
            try {
                const content = await fs.readFile(statusFile, 'utf-8');
                return NextResponse.json(JSON.parse(content));
            } catch {
                return NextResponse.json({ status: 'idle', progress: '', error: null });
            }
        }

        // Return all section statuses
        const statuses: Record<string, unknown> = {};
        for (const sec of VALID_SECTIONS) {
            const statusFile = path.join(processedDir, `factsheet_status_${sec}.json`);
            try {
                const content = await fs.readFile(statusFile, 'utf-8');
                statuses[sec] = JSON.parse(content);
            } catch {
                statuses[sec] = { status: 'idle', progress: '', error: null };
            }
        }
        return NextResponse.json({ statuses });
    } catch (error) {
        console.error('Error reading fact sheet status:', error);
        return NextResponse.json({ status: 'error', progress: '', error: 'Failed to read status' }, { status: 500 });
    }
}
