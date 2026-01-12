import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

interface AnalysisResult {
    questionId: string;
    question: string;
    result: string;
    timestamp: string;
    additionalNotes?: string;
    coverageScore?: string;
    sources?: Array<{
        document: string;
        text: string;
    }>;
}

interface SavedAnalysis {
    workspaceSlug: string;
    lastUpdated: string;
    companySummary: string;
    questions: Record<string, AnalysisResult>;
}

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
        const analysisDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed-analysis');
        const analysisFile = path.join(analysisDir, 'analysis-results.json');

        // Check if file exists
        try {
            await fs.access(analysisFile);
        } catch {
            return NextResponse.json({
                success: true,
                exists: false,
                data: null,
            });
        }

        // Load and return the analysis
        const content = await fs.readFile(analysisFile, 'utf-8');
        const data: SavedAnalysis = JSON.parse(content);

        return NextResponse.json({
            success: true,
            exists: true,
            data,
        });
    } catch (error) {
        console.error('Error loading analysis:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to load analysis' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, companySummary, questions } = body;

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspaceSlug is required' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const analysisDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed-analysis');
        const analysisFile = path.join(analysisDir, 'analysis-results.json');

        // Create directory if it doesn't exist
        await fs.mkdir(analysisDir, { recursive: true });

        // Load existing data if it exists
        let existingData: SavedAnalysis = {
            workspaceSlug,
            lastUpdated: new Date().toISOString(),
            companySummary: '',
            questions: {},
        };

        try {
            const content = await fs.readFile(analysisFile, 'utf-8');
            existingData = JSON.parse(content);
        } catch {
            // No existing file, use defaults
        }

        // Merge with new data
        if (companySummary !== undefined) {
            existingData.companySummary = companySummary;
        }

        if (questions) {
            // Merge questions - new results override existing
            existingData.questions = {
                ...existingData.questions,
                ...questions,
            };
        }

        existingData.lastUpdated = new Date().toISOString();

        // Save the file
        await fs.writeFile(analysisFile, JSON.stringify(existingData, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: 'Analysis saved successfully',
        });
    } catch (error) {
        console.error('Error saving analysis:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to save analysis' },
            { status: 500 }
        );
    }
}

// Delete saved analysis
export async function DELETE(request: NextRequest) {
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
        const analysisDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed-analysis');
        const analysisFile = path.join(analysisDir, 'analysis-results.json');

        try {
            await fs.unlink(analysisFile);
        } catch {
            // File may not exist
        }

        return NextResponse.json({
            success: true,
            message: 'Analysis cleared successfully',
        });
    } catch (error) {
        console.error('Error deleting analysis:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to delete analysis' },
            { status: 500 }
        );
    }
}
