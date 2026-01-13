import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import OpenAI from 'openai';

interface MarketAnalysisResult {
    workspaceSlug: string;
    generatedAt: string;
    searchContextSize: 'high' | 'medium' | 'low';
    content: string;
    reasoningSummary?: string;
    webSources?: Array<{
        url: string;
        title?: string;
    }>;
}

// GET - Load existing market analysis
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
        const marketAnalysisFile = path.join(processedDir, 'market_analysis.json');

        try {
            await fs.access(marketAnalysisFile);
            const content = await fs.readFile(marketAnalysisFile, 'utf-8');
            const data: MarketAnalysisResult = JSON.parse(content);

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
        console.error('Error loading market analysis:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to load market analysis' },
            { status: 500 }
        );
    }
}

// POST - Run market analysis with web search
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, searchContextSize = 'medium' } = body;

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspaceSlug is required' },
                { status: 400 }
            );
        }

        // Validate search context size
        if (!['high', 'medium', 'low'].includes(searchContextSize)) {
            return NextResponse.json(
                { success: false, message: 'searchContextSize must be high, medium, or low' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');
        const masterDocFile = path.join(processedDir, 'master_document.json');
        const marketAnalysisFile = path.join(processedDir, 'market_analysis.json');

        // Check if master document exists
        try {
            await fs.access(masterDocFile);
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

        // Read master document
        const masterDocContent = await fs.readFile(masterDocFile, 'utf-8');

        // Load prompts from config file
        const configDir = path.join(projectRoot, 'config');
        const promptsFile = path.join(configDir, 'market-analysis-prompts.json');

        let systemPrompt = `Act as a sell-side technology due diligence analyst.
Use the provided DD master document as the primary source for company claims.
Validate those claims using independent web sources.
Do not infer missing information.

Your response MUST include these sections:
1. Executive Summary
2. Market Size Analysis
3. Competitive Landscape
4. Key Findings
5. Sources and References`;

        let userPrompt = `Compare the company's stated market size, growth rate, and target segments from the DD master document with independent market evidence.

Search the web to validate market claims and provide:
1. Verification of stated TAM/SAM/SOM figures
2. Comparison with industry analyst reports (Gartner, Forrester, etc.)
3. Competitive landscape analysis
4. Any inconsistencies or lack of external confirmation

Clearly indicate any claims that could not be verified.`;

        try {
            const promptsContent = await fs.readFile(promptsFile, 'utf-8');
            const prompts = JSON.parse(promptsContent);
            if (prompts.systemPrompt) systemPrompt = prompts.systemPrompt;
            if (prompts.userPrompt) userPrompt = prompts.userPrompt;
        } catch {
            // Use defaults if file doesn't exist
        }

        // Formatting instructions added automatically (user cannot modify these)
        const markdownFormatInstructions = `

IMPORTANT FORMATTING AND OUTPUT RULES:
1. Format your response using proper Markdown syntax:
   - Use ## for main section headings (e.g., ## Executive Summary)
   - Use ### for subsections
   - Use **bold** for emphasis
   - Use bullet points with - or *

2. DO NOT include any conversational elements at the end of your response such as:
   - "If you want, I can..."
   - "Would you like me to..."
   - "Let me know if..."
   - Offers to do additional work
   - Follow-up questions
   - Suggestions for next steps you could take

3. End the document cleanly after the Sources and References section. This is a formal deliverable document, not a conversation.`;

        // Combine system prompt with formatting instructions
        const fullSystemPrompt = `${systemPrompt}${markdownFormatInstructions}`;

        // Append master document content to user prompt
        const fullUserPrompt = `${userPrompt}

Here is the DD Master Document content:

${masterDocContent}`;

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Upload the master document file for use in the response
        const masterDocBuffer = Buffer.from(masterDocContent, 'utf-8');
        const uploadedFile = await openai.files.create({
            file: new File([masterDocBuffer], 'master_document.json', { type: 'application/json' }),
            purpose: 'assistants' as any, // Using 'assistants' as closest available purpose
        });

        // Run GPT-5.2 with Web Search + DD document
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
                effort: searchContextSize as 'high' | 'medium' | 'low',
                summary: 'auto' as any,
            },
            text: {
                format: { type: 'text' },
            },
            tools: [
                {
                    type: 'web_search_preview',
                    search_context_size: searchContextSize as 'high' | 'medium' | 'low',
                    user_location: {
                        type: 'approximate',
                        country: 'FI',
                    },
                } as any,
            ],
            store: false,
        });

        // Clean up uploaded file
        try {
            await openai.files.delete(uploadedFile.id);
        } catch {
            // Ignore cleanup errors
        }

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

        // Extract web sources if available
        const webSources: Array<{ url: string; title?: string }> = [];
        if (response.output && Array.isArray(response.output)) {
            for (const item of response.output) {
                if (item.type === 'web_search_call' && (item as any).action?.sources) {
                    for (const source of (item as any).action.sources) {
                        webSources.push({
                            url: source.url || source,
                            title: source.title,
                        });
                    }
                }
            }
        }

        // Create the result object
        const result: MarketAnalysisResult = {
            workspaceSlug,
            generatedAt: new Date().toISOString(),
            searchContextSize: searchContextSize as 'high' | 'medium' | 'low',
            content: outputText || 'No analysis content generated',
            reasoningSummary: (response as any).reasoning?.summary,
            webSources: webSources.length > 0 ? webSources : undefined,
        };

        // Save to file
        await fs.mkdir(processedDir, { recursive: true });
        await fs.writeFile(marketAnalysisFile, JSON.stringify(result, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error running market analysis:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to run market analysis' },
            { status: 500 }
        );
    }
}
