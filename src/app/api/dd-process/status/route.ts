import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');

        if (!workspaceSlug) {
            return NextResponse.json(
                { status: 'error', progress: '', error: 'workspace parameter is required' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const statusFile = path.join(projectRoot, 'storage', workspaceSlug, 'processed', 'compile_status.json');

        try {
            const content = await fs.readFile(statusFile, 'utf-8');
            const status = JSON.parse(content);
            return NextResponse.json(status);
        } catch {
            // No status file means compilation hasn't started
            return NextResponse.json({
                status: 'idle',
                progress: '',
                error: null,
            });
        }
    } catch (error) {
        console.error('Error reading compile status:', error);
        return NextResponse.json(
            { status: 'error', progress: '', error: 'Failed to read status' },
            { status: 500 }
        );
    }
}
