import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getOpenAIClient, getServiceTier, withFlexRetry } from '@/lib/openaiClient';

const VALID_SECTIONS = ['team-execution', 'business-potential-market', 'product-technology', 'economics-finance'];

const INVESTOR_FACTSHEET_PROMPT = `You are a seasoned venture capital associate writing EXTERNAL marketing material for institutional investors (Family Offices and Funds).

Your task is to synthesise from the provided due-diligence data a concise, compelling one-pager "Investor Fact Sheet" intended as SALES MATERIAL for qualified institutional investors.

CRITICAL REFRAMING RULES — strictly follow these:
1. NEVER use the words "gap", "weakness", "concern", "risk" or "problem". Instead:
   - "gap" → "scaling opportunity" or "capital deployment priority"
   - "weakness" → "growth lever" or "strategic expansion area"
   - "Engineering capacity is small" → "Strategic Engineering Expansion to meet surge in Enterprise demand"
   - "Manual processes" → "Automation Roadmap to drive 10x Operational Leverage"
2. Frame every challenge as a FUNDED SOLUTION. Use the investment round to explain HOW each challenge becomes an opportunity.
3. Lead with TRACTION, MOAT, and TEAM PEDIGREE.
4. All financial figures should be presented as confirmed or pipeline — never speculative.
5. Tone: institutional, confident, data-driven. NOT salesy or hyperbolic.

STRUCTURE to extract and populate (JSON):
{
  "companyName": "string or null",
  "sector": "string — primary sector/industry tag (e.g. 'Fintech / Compliance')",
  "valueProposition": "string — a single punchy sentence, max 15 words, that captures the core value",
  "keyBadges": ["string array — 4-6 bold metric badges, e.g. '€0.5M Lead Committed', '2 Patents Pending', '~5k Users', '€60k ARR'"],
  "investmentHighlights": [
    {
      "type": "efficiency",
      "icon": "⚡",
      "label": "Proven Efficiency",
      "headline": "string — 1 punchy sentence leading with the metric",
      "detail": "string — 1-2 sentences of supporting evidence"
    },
    {
      "type": "traction",
      "icon": "📈",
      "label": "Revenue Traction",
      "headline": "string — lead with ARR / pipeline figure",
      "detail": "string — supporting evidence on pipeline and enterprise customers"
    },
    {
      "type": "moat",
      "icon": "🛡️",
      "label": "Defensible Moat",
      "headline": "string — lead with IP / proprietary tech claim",
      "detail": "string — patent applications, proprietary data, regulatory advantage"
    },
    {
      "type": "team",
      "icon": "👥",
      "label": "High-Pedigree Team",
      "headline": "string — lead with 'Prior Scaling Experience' and strongest founder credential",
      "detail": "string — reference specific prior companies/exits (e.g. Klinik Healthcare Solutions), domain expertise"
    }
  ],
  "leadInvestorValidation": {
    "investor": "string — lead investor name",
    "commitment": "string — monetary commitment (e.g. '€0.5M')",
    "detail": "string — one sentence on why this validates the opportunity"
  },
  "whyNow": {
    "headline": "string — frame around a specific dated catalyst (e.g. 'March 2026 platform launch')",
    "detail": "string — 2-3 sentences explaining first-mover opportunity, market timing, regulatory tailwind, or technology shift"
  },
  "financialSnapshot": [
    { "metric": "ARR", "value": "string", "note": "string or null" },
    { "metric": "Enterprise Pipeline", "value": "string", "note": "string or null" },
    { "metric": "Active Users", "value": "string", "note": "string or null" },
    { "metric": "Lead Committed", "value": "string", "note": "string or null" }
  ],
  "useOfFunds": [
    { "percentage": 40, "label": "Scale Engineering", "detail": "Scale Engineering for Platform Launch — meeting surge in enterprise demand" },
    { "percentage": 30, "label": "Convert Enterprise Pipeline", "detail": "Close €100k+ Q1 2026 pipeline via enterprise sales motion" },
    { "percentage": 30, "label": "Automate Operations", "detail": "Automation Roadmap to drive 10x Operational Leverage" }
  ],
  "executionTimeline": [
    {
      "date": "string — e.g. 'Autumn 2025'",
      "milestone": "string — keep to 8 words max",
      "status": "completed | in-progress | planned"
    }
  ],
  "askAmount": "string or null — total raise amount",
  "stage": "string or null — e.g. 'Pre-Seed', 'Seed'",
  "lastUpdated": null
}

IMPORTANT:
- executionTimeline: include 4-6 milestones from Autumn 2025 onwards, ordered chronologically. At minimum include: product/platform launch, first paying customer, enterprise pipeline conversion.
- useOfFunds: adjust percentages and labels if the data contains specific allocation info; otherwise use the defaults above.
- financialSnapshot: populate values from the data; use 'TBD' if not available but known to exist.
- keyBadges: include commitments, metrics, IP, and notable milestones as short badge strings.
- Keep all language positive and forward-looking. This is a sales document.`;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');

        if (!workspaceSlug) {
            return NextResponse.json({ error: 'workspace parameter is required' }, { status: 400 });
        }

        const projectRoot = process.cwd();
        const factsheetFile = path.join(projectRoot, 'storage', workspaceSlug, 'processed', 'factsheet_investor_factsheet.json');

        try {
            const content = await fs.readFile(factsheetFile, 'utf-8');
            return NextResponse.json({ factsheet: JSON.parse(content) });
        } catch {
            return NextResponse.json({ factsheet: null });
        }
    } catch (error) {
        console.error('Error reading investor factsheet:', error);
        return NextResponse.json({ error: 'Failed to read investor factsheet' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, serviceTier } = body;
        const useFlex = serviceTier === 'flex';

        if (!workspaceSlug) {
            return NextResponse.json({ error: 'workspaceSlug is required' }, { status: 400 });
        }
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: 'OpenAI API key is not configured' }, { status: 500 });
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');
        const outFile = path.join(processedDir, 'factsheet_investor_factsheet.json');

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

        // Load web analyses if available
        const webAnalyses: Record<string, unknown> = {};
        for (const sec of VALID_SECTIONS) {
            try {
                const webAnalysisFile = path.join(processedDir, `factsheet_web_analysis_${sec}.json`);
                const webContent = await fs.readFile(webAnalysisFile, 'utf-8');
                webAnalyses[sec] = JSON.parse(webContent);
            } catch {
                // No web analysis — that's fine
            }
        }

        // Load web summaries if available
        const webSummaries: Record<string, unknown> = {};
        for (const sec of VALID_SECTIONS) {
            try {
                const webSummaryFile = path.join(processedDir, `factsheet_web_summary_${sec}.json`);
                const content = await fs.readFile(webSummaryFile, 'utf-8');
                webSummaries[sec] = JSON.parse(content);
            } catch {
                // No web summary — that's fine
            }
        }

        // Also try to load the internal investment memo for additional context
        let internalMemo: unknown = null;
        try {
            const memoFile = path.join(processedDir, 'factsheet_case_summary.json');
            const content = await fs.readFile(memoFile, 'utf-8');
            internalMemo = JSON.parse(content);
        } catch {
            // No memo yet — that's fine
        }

        if (!hasAnyData) {
            return NextResponse.json({ error: 'No section data available. Process documents first.' }, { status: 400 });
        }

        const openai = getOpenAIClient({ flex: useFlex });
        const service_tier = getServiceTier(useFlex);

        const contextParts: string[] = [
            `Here are the four due-diligence canonical documents:\n\n${JSON.stringify(canonicals, null, 2)}`,
        ];
        if (Object.keys(webAnalyses).length > 0) {
            contextParts.push(`\n\nWeb Analysis results (external evidence):\n\n${JSON.stringify(webAnalyses, null, 2)}`);
        }
        if (Object.keys(webSummaries).length > 0) {
            contextParts.push(`\n\nWeb Analysis Summaries:\n\n${JSON.stringify(webSummaries, null, 2)}`);
        }
        if (internalMemo) {
            contextParts.push(`\n\nInternal Investment Memo (internal context only — use the facts but reframe for external investors per the reframing rules):\n\n${JSON.stringify(internalMemo, null, 2)}`);
        }

        const makeCall = () => openai.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5.2',
            input: [
                {
                    role: 'developer',
                    content: [{
                        type: 'input_text',
                        text: `${INVESTOR_FACTSHEET_PROMPT}\n\nReturn ONLY valid JSON matching the structure above. No markdown code fences.`,
                    }],
                },
                {
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: contextParts.join(''),
                    }],
                },
            ],
            text: { format: { type: 'json_object' } },
            reasoning: { effort: 'medium', summary: null },
            tools: [],
            store: false,
            ...(service_tier && { service_tier }),
        } as any);
        const response = useFlex ? await withFlexRetry(makeCall) : await makeCall();

        // Extract response text
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

        const factsheetData = JSON.parse(responseText);
        factsheetData.lastUpdated = new Date().toISOString();

        await fs.mkdir(processedDir, { recursive: true });
        await fs.writeFile(outFile, JSON.stringify(factsheetData, null, 2), 'utf-8');

        return NextResponse.json({ success: true, factsheet: factsheetData });
    } catch (error) {
        console.error('Error generating investor factsheet:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate' }, { status: 500 });
    }
}
