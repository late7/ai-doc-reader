import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

const DEFAULT_PROMPTS = {
    systemPrompt: `You are a senior financial analyst conducting due diligence review.
Your task is to analyze the alignment between company claims in the master document and the financial data provided.

Focus on:
1. Verifying claims against financial evidence
2. Assessing growth plan feasibility based on financial metrics
3. Identifying inconsistencies between stated plans and financial reality
4. Evaluating overall financial health and sustainability

Be direct, specific, and objective in your analysis.`,

    userPrompt: `Analyze the following data and provide a comprehensive financial due diligence assessment:

## Required Analysis:

### 1. Claims Verification
Review the company's stated claims, promises, and projections from the master document. Cross-reference each major claim with the financial data to determine:
- Which claims are supported by financial evidence
- Which claims lack financial support or are contradicted
- Any claims that cannot be verified with available data

### 2. Growth Plan Assessment
Evaluate the company's growth plans and projections by analyzing:
- Revenue growth trends and sustainability
- Cost structure and operational efficiency
- Cash runway and funding requirements
- Hiring plans vs. financial capacity

### 3. Overall Alignment Analysis
Assess the overall alignment between:
- Company narrative and financial reality
- Stated business model and actual revenue patterns
- Market positioning claims and financial performance
- Team capabilities and execution evidence in numbers

### 4. Key Risks and Concerns
Identify any:
- Red flags in the financial data
- Inconsistencies that require clarification
- Areas where further due diligence is recommended

Provide specific examples and cite actual figures from the data when possible.`
};

// GET - Load finance prompts
export async function GET() {
    try {
        const projectRoot = process.cwd();
        const configDir = path.join(projectRoot, 'config');
        const promptsFile = path.join(configDir, 'finance-analysis-prompts.json');

        try {
            const content = await fs.readFile(promptsFile, 'utf-8');
            const prompts = JSON.parse(content);
            return NextResponse.json({ success: true, prompts });
        } catch {
            // Return defaults if file doesn't exist
            return NextResponse.json({ success: true, prompts: DEFAULT_PROMPTS });
        }
    } catch (error) {
        console.error('Error loading finance prompts:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to load prompts' },
            { status: 500 }
        );
    }
}

// POST - Save finance prompts
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { systemPrompt, userPrompt } = body;

        const projectRoot = process.cwd();
        const configDir = path.join(projectRoot, 'config');
        const promptsFile = path.join(configDir, 'finance-analysis-prompts.json');

        await fs.mkdir(configDir, { recursive: true });
        await fs.writeFile(promptsFile, JSON.stringify({ systemPrompt, userPrompt }, null, 2), 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving finance prompts:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to save prompts' },
            { status: 500 }
        );
    }
}

// DELETE - Reset to defaults
export async function DELETE() {
    try {
        const projectRoot = process.cwd();
        const configDir = path.join(projectRoot, 'config');
        const promptsFile = path.join(configDir, 'finance-analysis-prompts.json');

        await fs.mkdir(configDir, { recursive: true });
        await fs.writeFile(promptsFile, JSON.stringify(DEFAULT_PROMPTS, null, 2), 'utf-8');

        return NextResponse.json({ success: true, prompts: DEFAULT_PROMPTS });
    } catch (error) {
        console.error('Error resetting finance prompts:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to reset prompts' },
            { status: 500 }
        );
    }
}
