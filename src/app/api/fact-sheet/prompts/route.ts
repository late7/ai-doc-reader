import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// GET - Read current prompts
export async function GET() {
    try {
        const projectRoot = process.cwd();
        const promptsFile = path.join(projectRoot, 'src', 'config', 'factSheetPrompts.json');

        const content = await fs.readFile(promptsFile, 'utf-8');
        return NextResponse.json({ prompts: JSON.parse(content) });
    } catch (error) {
        console.error('Error reading fact sheet prompts:', error);
        return NextResponse.json({ error: 'Failed to read prompts' }, { status: 500 });
    }
}

// POST - Save updated prompts
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompts } = body;

        if (!prompts) {
            return NextResponse.json({ error: 'prompts object is required' }, { status: 400 });
        }

        const projectRoot = process.cwd();
        const promptsFile = path.join(projectRoot, 'src', 'config', 'factSheetPrompts.json');

        await fs.writeFile(promptsFile, JSON.stringify(prompts, null, 2), 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving fact sheet prompts:', error);
        return NextResponse.json({ error: 'Failed to save prompts' }, { status: 500 });
    }
}
