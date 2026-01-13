import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import OpenAI from 'openai';

interface FinanceAnalysisResult {
    workspaceSlug: string;
    generatedAt: string;
    content: string;
    reasoningSummary?: string;
}

// GET - Load existing finance analysis
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
        const analysisFile = path.join(processedDir, 'finance_analysis.json');

        try {
            await fs.access(analysisFile);
            const content = await fs.readFile(analysisFile, 'utf-8');
            const data: FinanceAnalysisResult = JSON.parse(content);

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
        console.error('Error loading finance analysis:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to load finance analysis' },
            { status: 500 }
        );
    }
}

// POST - Run finance analysis
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, financeData } = body;

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

        // Check for master document
        const masterDocFile = path.join(processedDir, 'master_document.json');
        let masterDocContent: string;

        try {
            await fs.access(masterDocFile);
            masterDocContent = await fs.readFile(masterDocFile, 'utf-8');
        } catch {
            return NextResponse.json(
                { success: false, message: 'Master document not found. Please process the Canonical Document first.' },
                { status: 400 }
            );
        }

        // Check for OpenAI API key
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { success: false, message: 'OPENAI_API_KEY is not configured' },
                { status: 500 }
            );
        }

        // Load prompts from config file
        const configDir = path.join(projectRoot, 'config');
        const promptsFile = path.join(configDir, 'finance-analysis-prompts.json');

        let systemPrompt = `You are a senior financial analyst conducting due diligence review.
Your task is to analyze the alignment between company claims in the master document and the financial data provided.

Focus on:
1. Verifying claims against financial evidence
2. Assessing growth plan feasibility based on financial metrics
3. Identifying inconsistencies between stated plans and financial reality
4. Evaluating overall financial health and sustainability

Be direct, specific, and objective in your analysis.`;

        let userPrompt = `Analyze the following data and provide a comprehensive financial due diligence assessment:

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

Provide specific examples and cite actual figures from the data when possible.`;

        try {
            const promptsContent = await fs.readFile(promptsFile, 'utf-8');
            const prompts = JSON.parse(promptsContent);
            if (prompts.systemPrompt) systemPrompt = prompts.systemPrompt;
            if (prompts.userPrompt) userPrompt = prompts.userPrompt;
        } catch {
            // Use defaults if file doesn't exist
        }

        // Formatting instructions added automatically
        const markdownFormatInstructions = `

IMPORTANT FORMATTING AND OUTPUT RULES:
1. Format your response using proper Markdown syntax:
   - Use ## for main section headings (e.g., ## Executive Summary)
   - Use ### for subsections
   - Use **bold** for emphasis
   - Use bullet points with - or *
   - Use tables where appropriate for data comparison

2. DO NOT include any conversational elements at the end of your response such as:
   - "If you want, I can..."
   - "Would you like me to..."
   - "Let me know if..."
   - Offers to do additional work
   - Follow-up questions

3. End the document cleanly with a summary. This is a formal deliverable document, not a conversation.`;

        const fullSystemPrompt = `${systemPrompt}${markdownFormatInstructions}`;

        const fullUserPrompt = `${userPrompt}

---

## Master Document (Company Claims and Information):

${masterDocContent}

---

## Financial Data (Extracted from Finance Documents):

${JSON.stringify(financeData, null, 2)}`;

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Run GPT-5.2 analysis (no web search)
        const response = await openai.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5.2',
            input: [
                {
                    role: 'developer',
                    content: [{
                        type: 'input_text',
                        text: fullSystemPrompt
                    }],
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: fullUserPrompt
                        }
                    ],
                },
            ],
            reasoning: {
                effort: 'high',
                summary: 'auto' as any,
            },
            text: {
                format: { type: 'text' },
            },
            tools: [], // No web search
            store: false,
        });

        // Extract response content
        let outputText = '';
        if (response.output && Array.isArray(response.output)) {
            for (const item of response.output) {
                if (item.type === 'message' && item.content) {
                    for (const contentItem of item.content) {
                        if (contentItem.type === 'output_text') {
                            outputText += contentItem.text;
                        }
                    }
                }
            }
        }

        // Create the result object
        const result: FinanceAnalysisResult = {
            workspaceSlug,
            generatedAt: new Date().toISOString(),
            content: outputText || 'No analysis content generated',
            reasoningSummary: (response as any).reasoning?.summary,
        };

        // Save to file
        await fs.mkdir(processedDir, { recursive: true });
        const analysisFile = path.join(processedDir, 'finance_analysis.json');
        await fs.writeFile(analysisFile, JSON.stringify(result, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error running finance analysis:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to run finance analysis' },
            { status: 500 }
        );
    }
}
