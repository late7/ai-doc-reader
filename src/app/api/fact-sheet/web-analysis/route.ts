import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs/promises';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const VALID_SECTIONS = ['team-execution', 'business-potential-market', 'product-technology', 'economics-finance'];

const SECTION_TITLES: Record<string, string> = {
    'team-execution': 'Team & Execution',
    'business-potential-market': 'Business Potential & Market',
    'product-technology': 'Product & Technology',
    'economics-finance': 'Economics & Finance',
};

const SECTION_ANALYST_ROLES: Record<string, string> = {
    'team-execution': 'a Due Diligence analyst specializing in leadership assessment, team evaluation, and organizational analysis',
    'business-potential-market': 'a Due Diligence analyst specializing in market research and competitive analysis',
    'product-technology': 'a Due Diligence analyst specializing in product evaluation, technology assessment, and technical moat analysis',
    'economics-finance': 'a Due Diligence analyst specializing in financial analysis, unit economics, and comparable company research',
};

function extractResponseText(response: unknown): string | null {
    if (!response || typeof response !== 'object') return null;
    const resp = response as Record<string, unknown>;
    if (typeof resp.output_text === 'string') return resp.output_text.trim();
    if (Array.isArray(resp.output)) {
        for (const item of resp.output as Array<Record<string, unknown>>) {
            if (item?.content && Array.isArray(item.content)) {
                for (const content of item.content as Array<Record<string, unknown>>) {
                    if ((content?.type === 'output_text' || content?.type === 'text') && typeof content.text === 'string') {
                        return (content.text as string).trim();
                    }
                }
            }
        }
    }
    return null;
}

// GET - Retrieve stored web analysis results
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');
        const sectionId = searchParams.get('section') || 'business-potential-market';

        if (!workspaceSlug) {
            return NextResponse.json({ error: 'workspace parameter is required' }, { status: 400 });
        }
        if (!VALID_SECTIONS.includes(sectionId)) {
            return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
        }

        const projectRoot = process.cwd();
        const webAnalysisFile = path.join(
            projectRoot, 'storage', workspaceSlug, 'processed',
            `factsheet_web_analysis_${sectionId}.json`
        );

        try {
            const content = await fs.readFile(webAnalysisFile, 'utf-8');
            return NextResponse.json({ webAnalysis: JSON.parse(content) });
        } catch {
            return NextResponse.json({ webAnalysis: null });
        }
    } catch (error) {
        console.error('Error reading web analysis:', error);
        return NextResponse.json({ error: 'Failed to read web analysis' }, { status: 500 });
    }
}

// POST - Run web analysis using OpenAI with web search
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, sectionId = 'business-potential-market' } = body;

        if (!workspaceSlug) {
            return NextResponse.json({ error: 'workspaceSlug is required' }, { status: 400 });
        }
        if (!VALID_SECTIONS.includes(sectionId)) {
            return NextResponse.json({ error: 'Invalid sectionId' }, { status: 400 });
        }
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: 'OpenAI API key is not configured' }, { status: 500 });
        }

        const sectionTitle = SECTION_TITLES[sectionId] || sectionId;
        const analystRole = SECTION_ANALYST_ROLES[sectionId] || 'a Due Diligence analyst';

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');
        const canonicalFile = path.join(processedDir, `factsheet_${sectionId}.json`);
        const webAnalysisFile = path.join(processedDir, `factsheet_web_analysis_${sectionId}.json`);
        const statusFile = path.join(processedDir, `factsheet_web_analysis_status_${sectionId}.json`);

        await fs.mkdir(processedDir, { recursive: true });

        // Update status to running
        await fs.writeFile(statusFile, JSON.stringify({
            status: 'running',
            progress: 'Starting web analysis...',
            error: null,
        }), 'utf-8');

        // Load the canonical document for this section
        let canonicalData: Record<string, unknown>;
        try {
            const content = await fs.readFile(canonicalFile, 'utf-8');
            canonicalData = JSON.parse(content);
        } catch {
            await fs.writeFile(statusFile, JSON.stringify({
                status: 'error',
                progress: '',
                error: 'No canonical document found. Process documents first.',
            }), 'utf-8');
            return NextResponse.json({
                error: `No canonical document found for ${sectionTitle}. Process documents first.`,
            }, { status: 400 });
        }

        if (!canonicalData.summary && !(canonicalData.details as unknown[])?.length) {
            await fs.writeFile(statusFile, JSON.stringify({
                status: 'error',
                progress: '',
                error: 'Canonical document has no data. Process documents first.',
            }), 'utf-8');
            return NextResponse.json({
                error: 'Canonical document is empty. Process documents first.',
            }, { status: 400 });
        }

        // Load web analysis prompt from config
        const promptsFile = path.join(projectRoot, 'src', 'config', 'factSheetPrompts.json');
        let webAnalysisPrompt = '';
        try {
            const promptsContent = await fs.readFile(promptsFile, 'utf-8');
            const promptsConfig = JSON.parse(promptsContent);
            webAnalysisPrompt = promptsConfig.sections?.[sectionId]?.webAnalysisPrompt || '';
        } catch {
            console.warn('Could not load web analysis prompt from config');
        }

        if (!webAnalysisPrompt) {
            webAnalysisPrompt = `Search the web for evidence and analysis related to the ${sectionTitle} aspects described in the canonical document. Validate or challenge the claims made. Find supporting or contradicting evidence.`;
        }

        await fs.writeFile(statusFile, JSON.stringify({
            status: 'running',
            progress: `Searching the web for ${sectionTitle} evidence...`,
            error: null,
        }), 'utf-8');

        // Build a concise summary of what to search for
        const canonicalSummary = typeof canonicalData.summary === 'string' ? canonicalData.summary : '';
        const strengths = Array.isArray(canonicalData.strengths) ? canonicalData.strengths as string[] : [];
        const weaknesses = Array.isArray(canonicalData.weaknesses) ? canonicalData.weaknesses as string[] : [];
        
        // Truncate summary to first 2000 chars to keep request reasonable
        const truncatedSummary = canonicalSummary.length > 2000 
            ? canonicalSummary.substring(0, 2000) + '...[truncated]' 
            : canonicalSummary;
        const companyInfo = `Summary: ${truncatedSummary}\n\nStrengths: ${strengths.join('; ')}\n\nWeaknesses: ${weaknesses.join('; ')}`;

        const systemPrompt = `You are ${analystRole}.

${webAnalysisPrompt}

Use web search to find real, current information. Cite sources with URLs where possible.

Return your analysis as a JSON object with this structure:
{
  "summary": "markdown formatted web analysis report",
  "marketValidation": [{"claim": "...", "webEvidence": "...", "source": "...", "verdict": "supported or challenged or inconclusive"}],
  "competitors": [{"name": "...", "description": "...", "relevance": "...", "source": "..."}],
  "industryTrends": [{"trend": "...", "evidence": "...", "source": "..."}],
  "riskFactors": [{"risk": "...", "evidence": "...", "severity": "high or medium or low", "source": "..."}],
  "supportingEvidence": [{"point": "...", "evidence": "...", "sentiment": "positive or negative or neutral", "source": "..."}],
  "overallWebScore": 5
}`;

        const userPrompt = `Here is the canonical ${sectionTitle} document from our due diligence analysis. Please search the web to validate, supplement, or challenge these findings:

${companyInfo}`;

        console.log('[web-analysis] System prompt length:', systemPrompt.length);
        console.log('[web-analysis] User prompt length:', userPrompt.length);
        console.log('[web-analysis] Calling OpenAI SDK...');

        // Initialize OpenAI client (same pattern as working market-analysis route)
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const startTime = Date.now();
        const response = await openai.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5-mini',
            input: [
                {
                    role: 'developer',
                    content: [{
                        type: 'input_text',
                        text: systemPrompt,
                    }],
                },
                {
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: userPrompt,
                    }],
                },
            ],
            reasoning: {
                effort: 'medium' as const,
                summary: 'auto' as any,
            },
            text: {
                format: { type: 'text' },
            },
            tools: [
                {
                    type: 'web_search_preview',
                    search_context_size: 'medium',
                    user_location: {
                        type: 'approximate',
                        country: 'FI',
                    },
                } as any,
            ],
            store: false,
        });

        const elapsed = Date.now() - startTime;
        console.log('[web-analysis] OpenAI response received in ' + elapsed + 'ms');

        await fs.writeFile(statusFile, JSON.stringify({
            status: 'running',
            progress: 'Processing web search results...',
            error: null,
        }), 'utf-8');

        // Extract response content from raw API response
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

        const responseText = outputText.trim() || extractResponseText(response);
        if (!responseText) {
            await fs.writeFile(statusFile, JSON.stringify({
                status: 'error',
                progress: '',
                error: 'No response from AI web search',
            }), 'utf-8');
            return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
        }

        let webAnalysisData;
        try {
            webAnalysisData = JSON.parse(responseText);
        } catch {
            // If JSON parsing fails, wrap raw text as summary
            webAnalysisData = {
                summary: responseText,
                marketValidation: [],
                competitors: [],
                industryTrends: [],
                riskFactors: [],
                supportingEvidence: [],
                overallWebScore: null,
            };
        }

        webAnalysisData.lastUpdated = new Date().toISOString();
        webAnalysisData.sectionId = sectionId;

        // Save web analysis results
        await fs.writeFile(webAnalysisFile, JSON.stringify(webAnalysisData, null, 2), 'utf-8');

        await fs.writeFile(statusFile, JSON.stringify({
            status: 'completed',
            progress: 'Web analysis complete.',
            error: null,
        }), 'utf-8');

        return NextResponse.json({ success: true, webAnalysis: webAnalysisData });
    } catch (error) {
        console.error('Error in web analysis:', error);

        // Try to update status file
        try {
            const body = await request.clone().json().catch(() => ({}));
            const workspaceSlug = (body as Record<string, string>).workspaceSlug;
            const errSectionId = (body as Record<string, string>).sectionId || 'business-potential-market';
            if (workspaceSlug) {
                const statusFile = path.join(
                    process.cwd(), 'storage', workspaceSlug, 'processed',
                    `factsheet_web_analysis_status_${errSectionId}.json`
                );
                await fs.writeFile(statusFile, JSON.stringify({
                    status: 'error',
                    progress: '',
                    error: error instanceof Error ? error.message : 'Unknown error',
                }), 'utf-8');
            }
        } catch { /* ignore */ }

        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to run web analysis',
        }, { status: 500 });
    }
}
