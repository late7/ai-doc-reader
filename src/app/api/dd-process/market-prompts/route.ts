import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

interface MarketAnalysisPrompts {
    systemPrompt: string;
    userPrompt: string;
}

const DEFAULT_PROMPTS: MarketAnalysisPrompts = {
    systemPrompt: `Act as a sell-side technology due diligence analyst. 
Use the provided DD master document as the primary source for company claims. 
Validate those claims using independent web sources. 
Do not infer missing information.
Format your response in clear Markdown with sections for:
1. Executive Summary
2. Market Size Analysis
3. Competitive Landscape
4. Key Findings
5. Sources and References`,
    userPrompt: `Compare the company's stated market size, growth rate, and target segments from the DD master document with independent market evidence. 

Search the web to validate market claims and provide:
1. Verification of stated TAM/SAM/SOM figures
2. Comparison with industry analyst reports (Gartner, Forrester, etc.)
3. Competitive landscape analysis
4. Any inconsistencies or lack of external confirmation

Clearly indicate any claims that could not be verified.`
};

function getPromptsFilePath(): string {
    const projectRoot = process.cwd();
    return path.join(projectRoot, 'config', 'market-analysis-prompts.json');
}

// GET - Load prompts
export async function GET() {
    try {
        const filePath = getPromptsFilePath();

        try {
            await fs.access(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            const prompts: MarketAnalysisPrompts = JSON.parse(content);

            return NextResponse.json({
                success: true,
                prompts,
            });
        } catch {
            // File doesn't exist, return defaults
            return NextResponse.json({
                success: true,
                prompts: DEFAULT_PROMPTS,
            });
        }
    } catch (error) {
        console.error('Error loading prompts:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to load prompts' },
            { status: 500 }
        );
    }
}

// POST - Save prompts
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { systemPrompt, userPrompt } = body;

        if (typeof systemPrompt !== 'string' || typeof userPrompt !== 'string') {
            return NextResponse.json(
                { success: false, message: 'Both systemPrompt and userPrompt are required as strings' },
                { status: 400 }
            );
        }

        const filePath = getPromptsFilePath();
        const dirPath = path.dirname(filePath);

        // Ensure directory exists
        await fs.mkdir(dirPath, { recursive: true });

        const prompts: MarketAnalysisPrompts = {
            systemPrompt,
            userPrompt,
        };

        await fs.writeFile(filePath, JSON.stringify(prompts, null, 4), 'utf-8');

        return NextResponse.json({
            success: true,
            message: 'Prompts saved successfully',
            prompts,
        });
    } catch (error) {
        console.error('Error saving prompts:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to save prompts' },
            { status: 500 }
        );
    }
}

// DELETE - Reset to defaults
export async function DELETE() {
    try {
        const filePath = getPromptsFilePath();
        const dirPath = path.dirname(filePath);

        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(DEFAULT_PROMPTS, null, 4), 'utf-8');

        return NextResponse.json({
            success: true,
            message: 'Prompts reset to defaults',
            prompts: DEFAULT_PROMPTS,
        });
    } catch (error) {
        console.error('Error resetting prompts:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to reset prompts' },
            { status: 500 }
        );
    }
}
