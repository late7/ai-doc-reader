import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs/promises';

const VALID_SECTIONS = ['team-execution', 'business-potential-market', 'product-technology', 'economics-finance'];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');

        if (!workspaceSlug) {
            return NextResponse.json({ error: 'workspace parameter is required' }, { status: 400 });
        }

        const projectRoot = process.cwd();
        const summaryFile = path.join(projectRoot, 'storage', workspaceSlug, 'processed', 'factsheet_case_summary.json');

        try {
            const content = await fs.readFile(summaryFile, 'utf-8');
            return NextResponse.json({ summary: JSON.parse(content) });
        } catch {
            return NextResponse.json({
                summary: {
                    companyName: null,
                    overallScore: null,
                    recommendation: null,
                    askAmount: null,
                    stage: null,
                    summary: '',
                    keyHighlights: [],
                    keyInsights: [],
                    watchouts: [],
                    lastUpdated: null,
                }
            });
        }
    } catch (error) {
        console.error('Error reading case summary:', error);
        return NextResponse.json({ error: 'Failed to read case summary' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug } = body;

        if (!workspaceSlug) {
            return NextResponse.json({ error: 'workspaceSlug is required' }, { status: 400 });
        }
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: 'OpenAI API key is not configured' }, { status: 500 });
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');
        const summaryFile = path.join(processedDir, 'factsheet_case_summary.json');

        // Load prompts config
        const promptsFile = path.join(projectRoot, 'src', 'config', 'factSheetPrompts.json');
        let promptsConfig: Record<string, unknown>;
        try {
            const content = await fs.readFile(promptsFile, 'utf-8');
            promptsConfig = JSON.parse(content);
        } catch {
            return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 });
        }

        const caseSummaryPrompt = (promptsConfig as Record<string, Record<string, string>>).caseSummary?.prompt;
        if (!caseSummaryPrompt) {
            return NextResponse.json({ error: 'No case summary prompt configured' }, { status: 500 });
        }

        // Load all 4 canonical docs
        const canonicals: Record<string, unknown> = {};
        let hasAnyData = false;
        for (const sec of VALID_SECTIONS) {
            const canonicalFile = path.join(processedDir, `factsheet_${sec}.json`);
            try {
                const content = await fs.readFile(canonicalFile, 'utf-8');
                canonicals[sec] = JSON.parse(content);
                hasAnyData = true;
            } catch {
                canonicals[sec] = { sectionId: sec, score: null, summary: 'No data yet' };
            }
        }

        // Load web analysis for all sections if available
        const webAnalyses: Record<string, unknown> = {};
        for (const sec of VALID_SECTIONS) {
            try {
                const webAnalysisFile = path.join(processedDir, `factsheet_web_analysis_${sec}.json`);
                const webContent = await fs.readFile(webAnalysisFile, 'utf-8');
                webAnalyses[sec] = JSON.parse(webContent);
            } catch {
                // No web analysis for this section — that's fine
            }
        }

        // Also load web summaries (human-readable) for all sections
        const webSummaries: Record<string, unknown> = {};
        for (const sec of VALID_SECTIONS) {
            try {
                const webSummaryFile = path.join(processedDir, `factsheet_web_summary_${sec}.json`);
                const content = await fs.readFile(webSummaryFile, 'utf-8');
                webSummaries[sec] = JSON.parse(content);
            } catch {
                // No web summary for this section — that's fine
            }
        }

        const hasWebData = Object.keys(webAnalyses).length > 0;

        if (!hasAnyData) {
            return NextResponse.json({ error: 'No section data available. Process documents first.' }, { status: 400 });
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const response = await openai.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5.4',
            input: [
                {
                    role: 'developer',
                    content: [{
                        type: 'input_text',
                        text: `${caseSummaryPrompt}\n\nReturn JSON with this structure:\n{\n  "companyName": "string or null",\n  "overallScore": <number 0-10 or null>,\n  "recommendation": "Pass|Consider|Invest|Strong Invest",\n  "askAmount": "string or null",\n  "stage": "string or null",\n  "summary": "<markdown formatted investment memo summary>",\n  "keyHighlights": ["..."],\n  "keyInsights": ["..."],\n  "watchouts": ["..."]\n}`,
                    }],
                },
                {
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: `Here are the four Fact Sheet canonical documents:\n\n${JSON.stringify(canonicals, null, 2)}${
                            hasWebData
                                ? `\n\nAdditionally, here are the Web Analysis results from live web research for each section (validating/challenging the canonical claims with external evidence):\n\n${JSON.stringify(webAnalyses, null, 2)}`
                                : ''
                        }${
                            Object.keys(webSummaries).length > 0
                                ? `\n\nHere are the executive Web Analysis Summaries synthesizing canonical and web evidence:\n\n${JSON.stringify(webSummaries, null, 2)}`
                                : ''
                        }`,
                    }],
                },
            ],
            text: { format: { type: 'json_object' } },
            reasoning: { effort: 'medium', summary: null },
            tools: [],
            store: false,
        });

        // Extract response
        let responseText: string | null = null;
        const resp = response as unknown as Record<string, unknown>;
        if (typeof resp.output_text === 'string') {
            responseText = resp.output_text.trim();
        } else if (Array.isArray(resp.output)) {
            for (const item of resp.output as Array<Record<string, unknown>>) {
                if (item?.content && Array.isArray(item.content)) {
                    for (const content of item.content as Array<Record<string, unknown>>) {
                        if ((content?.type === 'output_text' || content?.type === 'text') && typeof content.text === 'string') {
                            responseText = (content.text as string).trim();
                            break;
                        }
                    }
                }
                if (responseText) break;
            }
        }

        if (!responseText) {
            return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
        }

        const summaryData = JSON.parse(responseText);
        summaryData.lastUpdated = new Date().toISOString();

        await fs.mkdir(processedDir, { recursive: true });
        await fs.writeFile(summaryFile, JSON.stringify(summaryData, null, 2), 'utf-8');

        return NextResponse.json({ success: true, summary: summaryData });
    } catch (error) {
        console.error('Error generating case summary:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate' }, { status: 500 });
    }
}
