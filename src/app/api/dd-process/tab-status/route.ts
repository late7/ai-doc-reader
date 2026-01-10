import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

const TAB_KEYS = ['canonical', 'finance', 'market', 'final'];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');

        if (!workspaceSlug) {
            return NextResponse.json(
                { error: 'workspace parameter is required' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');

        const statuses: Record<string, string> = {};

        for (const tabKey of TAB_KEYS) {
            const statusFile = path.join(processedDir, `tab_status_${tabKey}.json`);
            try {
                const content = await fs.readFile(statusFile, 'utf-8');
                const data = JSON.parse(content);
                statuses[tabKey] = data.status || 'not_started';
            } catch {
                statuses[tabKey] = 'not_started';
            }
        }

        return NextResponse.json({ statuses });
    } catch (error) {
        console.error('Error reading tab statuses:', error);
        return NextResponse.json(
            { error: 'Failed to read tab statuses' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, tabKey, status } = body;

        if (!workspaceSlug || !tabKey || !status) {
            return NextResponse.json(
                { error: 'workspaceSlug, tabKey, and status are required' },
                { status: 400 }
            );
        }

        if (!TAB_KEYS.includes(tabKey)) {
            return NextResponse.json(
                { error: `Invalid tabKey. Must be one of: ${TAB_KEYS.join(', ')}` },
                { status: 400 }
            );
        }

        const validStatuses = ['not_started', 'in_progress', 'completed'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');

        // Create directory if it doesn't exist
        await fs.mkdir(processedDir, { recursive: true });

        const statusFile = path.join(processedDir, `tab_status_${tabKey}.json`);
        await fs.writeFile(
            statusFile,
            JSON.stringify({ status, updatedAt: new Date().toISOString() }),
            'utf-8'
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating tab status:', error);
        return NextResponse.json(
            { error: 'Failed to update tab status' },
            { status: 500 }
        );
    }
}
