import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// GET - Load existing finance data
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspace is required' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');
        const financeDataFile = path.join(processedDir, 'finance_data.json');

        try {
            await fs.access(financeDataFile);
            const content = await fs.readFile(financeDataFile, 'utf-8');
            const data = JSON.parse(content);

            return NextResponse.json({
                success: true,
                exists: true,
                data,
            });
        } catch {
            return NextResponse.json({
                success: true,
                exists: false,
                data: null,
            });
        }
    } catch (error) {
        console.error('Error loading finance data:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to load finance data' },
            { status: 500 }
        );
    }
}

// POST - Save finance data
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, financeData, filename } = body;

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspaceSlug is required' },
                { status: 400 }
            );
        }

        if (!financeData) {
            return NextResponse.json(
                { success: false, message: 'financeData is required' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');
        const financeDataFile = path.join(processedDir, 'finance_data.json');

        await fs.mkdir(processedDir, { recursive: true });
        await fs.writeFile(financeDataFile, JSON.stringify({
            financeData,
            filename,
            savedAt: new Date().toISOString(),
        }, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: 'Finance data saved',
        });
    } catch (error) {
        console.error('Error saving finance data:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to save finance data' },
            { status: 500 }
        );
    }
}
