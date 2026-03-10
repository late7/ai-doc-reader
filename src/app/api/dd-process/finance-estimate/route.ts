import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';

// POST - Estimate financial metrics from Master Document and Finance Data
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, estimateType, existingPeriods } = body;

        console.log(`[finance-estimate] Starting ${estimateType} estimation for workspace: ${workspaceSlug}`);
        console.log(`[finance-estimate] Existing periods:`, existingPeriods);

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspaceSlug is required' },
                { status: 400 }
            );
        }

        if (!estimateType || !['headcount', 'drivers', 'assumptions'].includes(estimateType)) {
            return NextResponse.json(
                { success: false, message: 'estimateType must be headcount, drivers, or assumptions' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');

        // Load master document
        const masterDocFile = path.join(processedDir, 'master_document.json');
        let masterDocContent: string = '';

        try {
            await fs.access(masterDocFile);
            masterDocContent = await fs.readFile(masterDocFile, 'utf-8');
            console.log(`[finance-estimate] Loaded master document (${masterDocContent.length} chars)`);
        } catch {
            console.log(`[finance-estimate] Master document not found at ${masterDocFile}`);
        }

        // Load finance data (P&L, cashflow, etc.)
        const financeDataFile = path.join(processedDir, 'finance_data.json');
        let financeDataContent: string = '';

        try {
            await fs.access(financeDataFile);
            const financeRaw = await fs.readFile(financeDataFile, 'utf-8');
            const financeData = JSON.parse(financeRaw);
            if (financeData?.financeData) {
                financeDataContent = JSON.stringify(financeData.financeData, null, 2);
                console.log(`[finance-estimate] Loaded finance data (${financeDataContent.length} chars)`);
                console.log(`[finance-estimate] P&L periods:`, financeData.financeData.pnl?.map((p: any) => p.period));
            }
        } catch {
            console.log(`[finance-estimate] Finance data not found at ${financeDataFile}`);
        }

        if (!masterDocContent && !financeDataContent) {
            return NextResponse.json(
                { success: false, message: 'No master document or finance data found. Please process documents first.' },
                { status: 400 }
            );
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { success: false, message: 'OPENAI_API_KEY is not configured' },
                { status: 500 }
            );
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const periodsInstruction = existingPeriods?.length
            ? `Use these periods: ${existingPeriods.join(', ')}`
            : 'Use years like 2024, 2025, 2026';

        // Define prompts for each estimate type
        const prompts: Record<string, string> = {
            headcount: `Based on the provided documents, extract or estimate headcount data.
IMPORTANT: Count ALL people mentioned AND use financial data to estimate if needed.

Return a JSON object with a "data" property containing an array:
{
  "data": [
    {
      "period": "2024",
      "total_fte": 5,
      "sales_fte": 1,
      "tech_fte": 3,
      "avg_cost_per_fte": 100000
    }
  ]
}

EXTRACTION METHODS (use all that apply):
1. COUNT all mentioned personnel: founders, CEO, CTO, developers, sales, marketing, etc.
2. If OPEX or Personnel Costs are available: headcount = Personnel Costs / 100000 (avg salary)
3. If only Total Costs available: assume 60-70% is personnel, then divide by 100000
4. If Revenue available but no costs: estimate headcount as Revenue / 150000 (revenue per employee)
5. Project growth based on hiring plans or revenue growth rate

DEFAULTS:
- avg_cost_per_fte = 100000 (EUR 100k) if not specified
- If 5 people mentioned in team section, total_fte = 5
- tech_fte typically 50-60% of total for tech companies
- sales_fte typically 20-30% of total

Look for:
- Team member names, bios, roles
- Personnel costs, salaries, OpEx breakdown
- Total costs or operating expenses
- Revenue (to estimate headcount)
- Founder/co-founder mentions
- Hiring plans

${periodsInstruction}

ALWAYS return data using any available method above. Never return empty data array.`,

            drivers: `Based on the provided documents, extract or estimate revenue driver data.
IMPORTANT: Use financial data to CALCULATE customer metrics if not directly stated.

Return a JSON object with a "data" property containing an array:
{
  "data": [
    {
      "period": "2024",
      "customers": 50,
      "new_customers": 20,
      "arpa": 20000,
      "churn_pct": 5
    }
  ]
}

EXTRACTION METHODS (use all that apply):
1. Direct customer/user counts from documents
2. If Revenue and ARPA known: customers = Revenue / ARPA
3. If Revenue known but not ARPA, use industry benchmarks:
   - B2B SaaS: ARPA = 10000-50000/year
   - B2C SaaS: ARPA = 100-500/year  
   - Enterprise: ARPA = 50000-200000/year
   - SMB: ARPA = 5000-20000/year
4. Calculate new_customers from growth: (current - previous) or use growth rate
5. Default churn: 5% for sticky products, 10-15% for average, 20%+ for high-churn

CALCULATION EXAMPLE:
- If Revenue = 1,000,000 and product looks like B2B SaaS
- Assume ARPA = 25,000
- Then customers = 1,000,000 / 25,000 = 40 customers

Look for:
- Customer/user/client/subscriber counts
- Revenue figures (use to calculate customers)
- Pricing tiers and plans
- Contract values
- Growth rates
- Churn or retention mentions

${periodsInstruction}

ALWAYS return data - calculate from revenue if direct counts not available. Never return empty data array.`,

            assumptions: `Based on the Master Document, extract key business and financial assumptions.
IMPORTANT: Find ALL stated assumptions, projections, targets, and business model details.

Return a JSON object with a "data" property containing an array:
{
  "data": [
    {
      "category": "revenue",
      "assumption": "Annual revenue growth rate",
      "value": "50%",
      "description": "Based on projected expansion"
    }
  ]
}

Categories: revenue, costs, margin, hiring, funding, other

EXTRACT:
- Revenue targets and growth rates
- Pricing strategy and models
- Cost structure and burn rate
- Gross margin and profitability targets
- Hiring plans and team growth
- Funding needs and runway
- Market size and penetration assumptions
- Product roadmap milestones
- Break-even projections
- Any percentages or targets mentioned

ALWAYS return at least 5 assumptions - every company has implicit or explicit assumptions. Never return empty data array.`
        };

        // Build context string with both master doc and finance data
        // Truncate master doc if too long to avoid overwhelming the model
        const maxMasterDocLength = 40000;
        let truncatedMasterDoc = masterDocContent;
        if (masterDocContent.length > maxMasterDocLength) {
            truncatedMasterDoc = masterDocContent.substring(0, maxMasterDocLength) + '\n\n[... document truncated for length ...]';
            console.log(`[finance-estimate] Truncated master doc from ${masterDocContent.length} to ${maxMasterDocLength} chars`);
        }

        let contextString = '';
        if (truncatedMasterDoc) {
            contextString += `## Master Document (Company Information):\n${truncatedMasterDoc}\n\n`;
        }
        if (financeDataContent) {
            contextString += `## Financial Data (P&L, Revenue, Costs):\n${financeDataContent}\n\n`;
        }

        console.log(`[finance-estimate] Sending to OpenAI for ${estimateType}...`);
        console.log(`[finance-estimate] Context length: ${contextString.length} chars`);

        const response = await openai.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5.2',
            input: [
                {
                    role: 'system',
                    content: 'You are a financial analyst expert at extracting and CALCULATING data from company documents. Your job is to find and return useful financial estimates. Be THOROUGH - extract all relevant data, count all people mentioned, use financial data to CALCULATE missing metrics, and make reasonable estimates based on industry benchmarks. Return valid JSON with a "data" array property. NEVER return empty arrays - always calculate or estimate using available data.'
                },
                {
                    role: 'user',
                    content: `${prompts[estimateType]}\n\n---\n\n${contextString}`
                }
            ],
            text: {
                format: {
                    type: 'json_object'
                }
            }
        });

        // Parse the response
        const outputText = response.output_text || '';
        console.log(`[finance-estimate] OpenAI response length: ${outputText.length} chars`);
        console.log(`[finance-estimate] Raw response:`, outputText.substring(0, 500));

        let estimatedData: any[] = [];

        try {
            const parsed = JSON.parse(outputText);
            console.log(`[finance-estimate] Parsed JSON keys:`, Object.keys(parsed));

            // Handle various response formats
            if (parsed.data && Array.isArray(parsed.data)) {
                estimatedData = parsed.data;
            } else if (Array.isArray(parsed)) {
                estimatedData = parsed;
            } else if (parsed[estimateType] && Array.isArray(parsed[estimateType])) {
                estimatedData = parsed[estimateType];
            } else if (parsed.headcount && Array.isArray(parsed.headcount)) {
                estimatedData = parsed.headcount;
            } else if (parsed.drivers && Array.isArray(parsed.drivers)) {
                estimatedData = parsed.drivers;
            } else if (parsed.assumptions && Array.isArray(parsed.assumptions)) {
                estimatedData = parsed.assumptions;
            } else {
                // Try to find any array in the response
                const values = Object.values(parsed);
                const arrayValue = values.find(v => Array.isArray(v));
                if (arrayValue && Array.isArray(arrayValue)) {
                    estimatedData = arrayValue;
                }
            }
            console.log(`[finance-estimate] Parsed ${estimatedData.length} items for ${estimateType}`);
        } catch (e) {
            console.error('[finance-estimate] Failed to parse response:', e);
            console.error('[finance-estimate] Raw output:', outputText);
        }

        return NextResponse.json({
            success: true,
            estimateType,
            data: estimatedData,
            source: 'master_document_and_finance_data'
        });

    } catch (error) {
        console.error('[finance-estimate] Error:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
