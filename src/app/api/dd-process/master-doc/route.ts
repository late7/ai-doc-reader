import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

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
        const masterDocPath = path.join(projectRoot, 'storage', workspaceSlug, 'processed', 'master_document.json');

        try {
            const content = await fs.readFile(masterDocPath, 'utf-8');
            const document = JSON.parse(content);
            return NextResponse.json({ document });
        } catch {
            // No master document exists yet
            return NextResponse.json({ document: null });
        }
    } catch (error) {
        console.error('Error reading master document:', error);
        return NextResponse.json(
            { error: 'Failed to read master document' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, updates } = body;

        if (!workspaceSlug || !updates) {
            return NextResponse.json(
                { error: 'workspaceSlug and updates are required' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const masterDocPath = path.join(projectRoot, 'storage', workspaceSlug, 'processed', 'master_document.json');

        // Read current document
        let document: Record<string, unknown>;
        try {
            const content = await fs.readFile(masterDocPath, 'utf-8');
            document = JSON.parse(content);
        } catch {
            return NextResponse.json(
                { error: 'Master document not found' },
                { status: 404 }
            );
        }

        // Apply updates using JSON pointers
        for (const [pointer, value] of Object.entries(updates)) {
            const parts = pointer.split('/').filter(p => p);
            let current: Record<string, unknown> = document;

            // Navigate to the parent
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (typeof current[part] === 'object' && current[part] !== null) {
                    current = current[part] as Record<string, unknown>;
                } else {
                    console.warn(`Path not found: ${pointer}`);
                    break;
                }
            }

            // Update the leaf value
            const leafKey = parts[parts.length - 1];
            if (current && typeof current[leafKey] === 'object' && current[leafKey] !== null) {
                const leaf = current[leafKey] as Record<string, unknown>;
                leaf.extracted = value;
            }
        }

        // Write back
        await fs.writeFile(masterDocPath, JSON.stringify(document, null, 2), 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating master document:', error);
        return NextResponse.json(
            { error: 'Failed to update master document' },
            { status: 500 }
        );
    }
}
