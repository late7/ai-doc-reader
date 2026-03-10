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

const SECTION_SUMMARY_FOCUS: Record<string, { brief: string; sections: string[] }> = {
    'team-execution': {
        brief: 'executive team and leadership assessment',
        sections: [
            'Leadership Assessment — comparing claimed backgrounds vs web evidence',
            'Team Strength Summary — evidence of execution capability, track record, and domain expertise',
            'Key Gaps & Concerns — missing roles, red flags, reputation issues',
        ],
    },
    'business-potential-market': {
        brief: 'executive market analysis',
        sections: [
            'Market Position Summary — comparing what the company claims vs what web evidence shows',
            'Competitive Landscape — summarizing key competitors found',
            'Key Risks & Gaps — highlighting material concerns',
        ],
    },
    'product-technology': {
        brief: 'executive product and technology assessment',
        sections: [
            'Product Validation — comparing claimed capabilities vs web evidence (reviews, benchmarks)',
            'Technology Moat Assessment — evidence of technical differentiation, IP, or defensibility',
            'Key Risks & Gaps — technical debt signals, competitor tech advantages, scalability concerns',
        ],
    },
    'economics-finance': {
        brief: 'executive financial and economics assessment',
        sections: [
            'Financial Validation — comparing claimed metrics vs web evidence (funding data, benchmarks)',
            'Unit Economics Assessment — evidence supporting or challenging the financial model',
            'Key Risks & Gaps — burn rate concerns, funding environment, comparable company performance',
        ],
    },
};

// GET - Retrieve stored web analysis summary
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
        const summaryFile = path.join(
            projectRoot, 'storage', workspaceSlug, 'processed',
            `factsheet_web_summary_${sectionId}.json`
        );

        try {
            const content = await fs.readFile(summaryFile, 'utf-8');
            return NextResponse.json({ summary: JSON.parse(content) });
        } catch {
            return NextResponse.json({ summary: null });
        }
    } catch (error) {
        console.error('Error reading web analysis summary:', error);
        return NextResponse.json({ error: 'Failed to read web analysis summary' }, { status: 500 });
    }
}

// POST - Generate human-readable summary from canonical data + web analysis
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
        const summaryFocus = SECTION_SUMMARY_FOCUS[sectionId] || SECTION_SUMMARY_FOCUS['business-potential-market'];

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');
        const canonicalFile = path.join(processedDir, `factsheet_${sectionId}.json`);
        const webAnalysisFile = path.join(processedDir, `factsheet_web_analysis_${sectionId}.json`);
        const summaryFile = path.join(processedDir, `factsheet_web_summary_${sectionId}.json`);
        const statusFile = path.join(processedDir, `factsheet_web_summary_status_${sectionId}.json`);

        await fs.mkdir(processedDir, { recursive: true });

        // Update status
        await fs.writeFile(statusFile, JSON.stringify({
            status: 'running',
            progress: `Generating ${sectionTitle} summary...`,
            error: null,
        }), 'utf-8');

        // Load canonical data
        let canonicalData: Record<string, unknown>;
        try {
            const content = await fs.readFile(canonicalFile, 'utf-8');
            canonicalData = JSON.parse(content);
        } catch {
            await fs.writeFile(statusFile, JSON.stringify({ status: 'error', progress: '', error: 'No canonical document found.' }), 'utf-8');
            return NextResponse.json({ error: 'No canonical document found.' }, { status: 400 });
        }

        // Load web analysis results
        let webAnalysisData: Record<string, unknown>;
        try {
            const content = await fs.readFile(webAnalysisFile, 'utf-8');
            webAnalysisData = JSON.parse(content);
        } catch {
            await fs.writeFile(statusFile, JSON.stringify({ status: 'error', progress: '', error: 'No web analysis found. Run web analysis first.' }), 'utf-8');
            return NextResponse.json({ error: 'No web analysis found. Run web analysis first.' }, { status: 400 });
        }

        // Build concise inputs for the summarization prompt
        const canonicalSummary = typeof canonicalData.summary === 'string'
            ? (canonicalData.summary.length > 3000 ? canonicalData.summary.substring(0, 3000) + '...[truncated]' : canonicalData.summary)
            : '';
        const strengths = Array.isArray(canonicalData.strengths) ? (canonicalData.strengths as string[]).join('; ') : '';
        const weaknesses = Array.isArray(canonicalData.weaknesses) ? (canonicalData.weaknesses as string[]).join('; ') : '';

        // Extract key web analysis sections (truncated for prompt size)
        const webSummary = typeof webAnalysisData.summary === 'string'
            ? (webAnalysisData.summary.length > 3000 ? webAnalysisData.summary.substring(0, 3000) + '...[truncated]' : webAnalysisData.summary)
            : '';

        const marketValidation = Array.isArray(webAnalysisData.marketValidation)
            ? (webAnalysisData.marketValidation as Array<Record<string, string>>)
                .map(v => `- ${v.claim}: ${v.verdict} — ${v.webEvidence?.substring(0, 200)}`).join('\n')
            : '';

        const competitors = Array.isArray(webAnalysisData.competitors)
            ? (webAnalysisData.competitors as Array<Record<string, string>>)
                .map(c => `- ${c.name}: ${c.description?.substring(0, 150)}`).join('\n')
            : '';

        const risks = Array.isArray(webAnalysisData.riskFactors)
            ? (webAnalysisData.riskFactors as Array<Record<string, string>>)
                .map(r => `- [${r.severity}] ${r.risk}: ${r.evidence?.substring(0, 200)}`).join('\n')
            : '';

        const trends = Array.isArray(webAnalysisData.industryTrends)
            ? (webAnalysisData.industryTrends as Array<Record<string, string>>)
                .map(t => `- ${t.trend}: ${t.evidence?.substring(0, 200)}`).join('\n')
            : '';

        const webScore = webAnalysisData.overallWebScore != null ? String(webAnalysisData.overallWebScore) : 'N/A';

        const systemPrompt = `You are a senior Due Diligence analyst writing an ${summaryFocus.brief} brief.

Your task is to synthesize two sources into one clear, readable executive summary:
1. The CANONICAL ${sectionTitle} analysis (from internal documents/data room)
2. The WEB analysis (from live web research validating/challenging the canonical claims)

Write a well-structured markdown report that a senior investment professional can quickly read.

Requirements:
- Start with a bold executive verdict (1-2 sentences): are the key claims supported, partially supported, or challenged by web evidence?
- Use clear section headers (##)
${summaryFocus.sections.map(s => `- Include a "${s}" section`).join('\n')}
- Include a "Web Evidence Score" section explaining the ${webScore}/10 rating
- End with 3-5 bullet "Key Takeaways for Investment Committee"
- Use concise, professional language — no filler
- Cite sources inline where relevant using markdown links
- Keep the total length to approximately 800-1200 words`;

        const userPrompt = `## CANONICAL ${sectionTitle.toUpperCase()} DATA (from documents)

### Summary
${canonicalSummary}

### Strengths
${strengths}

### Weaknesses
${weaknesses}

---

## WEB ANALYSIS RESULTS (from live web research)

### Web Research Summary
${webSummary}

### Market Claim Validation
${marketValidation}

### Competitors Found
${competitors}

### Industry Trends
${trends}

### Risk Factors
${risks}

### Overall Web Evidence Score: ${webScore}/10

---

Please synthesize all of the above into a single executive ${sectionTitle} analysis brief.`;

        console.log('[web-summary] System prompt length:', systemPrompt.length);
        console.log('[web-summary] User prompt length:', userPrompt.length);
        console.log('[web-summary] Calling OpenAI...');

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const startTime = Date.now();
        const response = await openai.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5.2',
            input: [
                {
                    role: 'developer',
                    content: [{ type: 'input_text', text: systemPrompt }],
                },
                {
                    role: 'user',
                    content: [{ type: 'input_text', text: userPrompt }],
                },
            ],
            reasoning: {
                effort: 'medium' as const,
                summary: 'auto' as any,
            },
            text: {
                format: { type: 'text' },
            },
            store: false,
        });

        const elapsed = Date.now() - startTime;
        console.log('[web-summary] OpenAI response received in ' + elapsed + 'ms');

        // Extract response text
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

        const responseText = outputText.trim();
        if (!responseText) {
            await fs.writeFile(statusFile, JSON.stringify({ status: 'error', progress: '', error: 'No response from AI' }), 'utf-8');
            return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
        }

        const summaryData = {
            markdown: responseText,
            webScore,
            generatedAt: new Date().toISOString(),
            sectionId,
        };

        await fs.writeFile(summaryFile, JSON.stringify(summaryData, null, 2), 'utf-8');
        await fs.writeFile(statusFile, JSON.stringify({ status: 'completed', progress: 'Summary complete.', error: null }), 'utf-8');

        return NextResponse.json({ success: true, summary: summaryData });
    } catch (error) {
        console.error('Error generating web analysis summary:', error);

        try {
            const body = await request.clone().json().catch(() => ({}));
            const workspaceSlug = (body as Record<string, string>).workspaceSlug;
            const errSectionId = (body as Record<string, string>).sectionId || 'business-potential-market';
            if (workspaceSlug) {
                const statusFile = path.join(
                    process.cwd(), 'storage', workspaceSlug, 'processed',
                    `factsheet_web_summary_status_${errSectionId}.json`
                );
                await fs.writeFile(statusFile, JSON.stringify({
                    status: 'error',
                    progress: '',
                    error: error instanceof Error ? error.message : 'Unknown error',
                }), 'utf-8');
            }
        } catch { /* ignore */ }

        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to generate summary',
        }, { status: 500 });
    }
}
