import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

const VALID_SECTIONS = ['team-execution', 'business-potential-market', 'product-technology', 'economics-finance'];

function getCanonicalPath(workspaceSlug: string, sectionId: string): string {
    const projectRoot = process.cwd();
    return path.join(projectRoot, 'storage', workspaceSlug, 'processed', `factsheet_${sectionId}.json`);
}

function createEmptyCanonical(sectionId: string): Record<string, unknown> {
    const titles: Record<string, string> = {
        'team-execution': 'Team & Execution',
        'business-potential-market': 'Business Potential and Market',
        'product-technology': 'Product & Technology',
        'economics-finance': 'Economics and Finance',
    };
    return {
        sectionId,
        title: titles[sectionId] || sectionId,
        score: null,
        summary: '',
        details: [],
        strengths: [],
        weaknesses: [],
        openQuestions: [],
        sourcesProcessed: [],
        lastUpdated: null,
    };
}

// GET - Read canonical doc for a section
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');
        const sectionId = searchParams.get('section');

        if (!workspaceSlug) {
            return NextResponse.json({ error: 'workspace parameter is required' }, { status: 400 });
        }

        // If section is specified, return that one canonical doc
        if (sectionId) {
            if (!VALID_SECTIONS.includes(sectionId)) {
                return NextResponse.json({ error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(', ')}` }, { status: 400 });
            }

            const canonicalPath = getCanonicalPath(workspaceSlug, sectionId);
            try {
                const content = await fs.readFile(canonicalPath, 'utf-8');
                return NextResponse.json({ canonical: JSON.parse(content) });
            } catch {
                return NextResponse.json({ canonical: createEmptyCanonical(sectionId) });
            }
        }

        // No section specified - return all 4 canonical docs
        const canonicals: Record<string, unknown> = {};
        for (const sec of VALID_SECTIONS) {
            const canonicalPath = getCanonicalPath(workspaceSlug, sec);
            try {
                const content = await fs.readFile(canonicalPath, 'utf-8');
                canonicals[sec] = JSON.parse(content);
            } catch {
                canonicals[sec] = createEmptyCanonical(sec);
            }
        }

        return NextResponse.json({ canonicals });
    } catch (error) {
        console.error('Error reading fact sheet canonical:', error);
        return NextResponse.json({ error: 'Failed to read canonical document' }, { status: 500 });
    }
}

// POST - Save/update canonical doc for a section
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, sectionId, canonical } = body;

        if (!workspaceSlug || !sectionId || !canonical) {
            return NextResponse.json({ error: 'workspaceSlug, sectionId, and canonical are required' }, { status: 400 });
        }

        if (!VALID_SECTIONS.includes(sectionId)) {
            return NextResponse.json({ error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(', ')}` }, { status: 400 });
        }

        const canonicalPath = getCanonicalPath(workspaceSlug, sectionId);
        const processedDir = path.dirname(canonicalPath);
        await fs.mkdir(processedDir, { recursive: true });

        canonical.lastUpdated = new Date().toISOString();
        await fs.writeFile(canonicalPath, JSON.stringify(canonical, null, 2), 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving fact sheet canonical:', error);
        return NextResponse.json({ error: 'Failed to save canonical document' }, { status: 500 });
    }
}
