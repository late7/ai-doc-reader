import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs/promises';

const SYSTEM_PROMPT = `You are an expert investment analyst creating a professional Due Diligence report for institutional investors (ICs), Family Offices (FOs), and Limited Partners (LPs).

Your task is to transform raw DD research data, financial analysis, and market analysis into a polished, comprehensive sell-side Due Diligence report.

GUIDELINES:
1. **Synthesis**: Integrate findings from the Core DD data (master document), the Financial Due Diligence analysis, and the Market Analysis.
2. **Structure**: Follow a professional sell-side DD report format with clear sections.
3. **Tone**: Neutral, evidence-based, professional - not promotional.
4. **Clarity**: Remove duplication, noise, and raw research fragments.
5. **Audience**: Make it readable for sophisticated investors while preserving technical and regulatory depth.
6. **Organization**: Clearly separate:
   - **Facts** (verified information from documents)
   - **Maturity** (development stage, traction, team experience)
   - **Financial Positioning** (analysis of growth, burn, and unit economics)
   - **Market Context** (competitive landscape and external market verification)
   - **Gaps** (missing information, risks, areas needing clarification)
6. **Terminology**: Use normalized, industry-standard terminology
7. **Formatting**: Use proper Markdown with:
   - Clear hierarchical headings (##, ###, ####)
   - Bullet points for lists
   - Tables where appropriate for comparisons
   - Bold for key terms and metrics
   - Blockquotes for notable quotes or findings

STRUCTURE YOUR REPORT AS:
1. **Executive Summary** - High-level overview, key investment thesis, main findings synthesis
2. **Company Overview** - Legal entity, jurisdiction, business description
3. **Product & Technology** - Core offering, tech stack, IP, development stage
4. **Market Opportunity** - TAM/SAM/SOM, competitive landscape, market dynamics
5. **Business Model** - Revenue model, pricing, unit economics if available
6. **Team & Governance** - Key personnel, board, advisors, organizational maturity
7. **Financial Summary** - Key metrics, funding history, use of funds
8. **Regulatory & Compliance** - Licenses, certifications, compliance status
9. **Risk Assessment** - Synthesis of operational, financial, and market risks
10. **Conclusion & DD Gaps** - Final synthesis and high-priority areas for further review

Return ONLY the formatted Markdown document, no additional commentary.`;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, regenerate, checkOnly } = body;

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspaceSlug is required' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');
        const masterDocPath = path.join(processedDir, 'master_document.json');
        const reportPath = path.join(processedDir, 'final_report.md');

        // Check if we have a cached report
        if (!regenerate) {
            try {
                const cachedReport = await fs.readFile(reportPath, 'utf-8');
                const masterDocStat = await fs.stat(masterDocPath);
                const reportStat = await fs.stat(reportPath);

                // Use cached report if it's newer than the master document
                if (reportStat.mtime > masterDocStat.mtime) {
                    return NextResponse.json({
                        success: true,
                        report: cachedReport,
                        cached: true,
                    });
                }
            } catch {
                // No cached report
                // If checkOnly mode, return without generating
                if (checkOnly) {
                    return NextResponse.json({
                        success: true,
                        report: null,
                        cached: false,
                    });
                }
            }
        }

        // If checkOnly mode and we got here, no valid cache exists
        if (checkOnly) {
            return NextResponse.json({
                success: true,
                report: null,
                cached: false,
            });
        }

        // Check for API key only when actually generating
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { success: false, message: 'OpenAI API key is not configured' },
                { status: 500 }
            );
        }

        // Load master document
        let masterDocument: Record<string, unknown>;
        try {
            const content = await fs.readFile(masterDocPath, 'utf-8');
            masterDocument = JSON.parse(content);
        } catch {
            return NextResponse.json(
                { success: false, message: 'Master document not found. Please run document processing first.' },
                { status: 404 }
            );
        }

        // Load Financial and Market Analysis if available
        let financeAnalysis: string | null = null;
        let marketAnalysis: string | null = null;
        let rawFinanceData: any = null;

        try {
            const financePath = path.join(processedDir, 'finance_analysis.json');
            const content = await fs.readFile(financePath, 'utf-8');
            const data = JSON.parse(content);
            financeAnalysis = data.content;
        } catch {
            console.log('Finance analysis not found, skipping.');
        }

        try {
            const marketPath = path.join(processedDir, 'market_analysis.json');
            const content = await fs.readFile(marketPath, 'utf-8');
            const data = JSON.parse(content);
            marketAnalysis = data.content;
        } catch {
            console.log('Market analysis not found, skipping.');
        }

        try {
            const financeDataPath = path.join(processedDir, 'finance_data.json');
            const content = await fs.readFile(financeDataPath, 'utf-8');
            const data = JSON.parse(content);
            rawFinanceData = data.financeData;
        } catch {
            console.log('Raw finance data not found, skipping.');
        }

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Prepare the JSON for the prompt (clean up for readability)
        const cleanedJson = cleanMasterDocument(masterDocument);
        const jsonString = JSON.stringify(cleanedJson, null, 2);

        // Construct the full user prompt
        let fullUserPrompt = `Here is the raw DD research data from the master document (JSON format):\n\n${jsonString}`;

        if (rawFinanceData) {
            fullUserPrompt += `\n\n--- RAW FINANCIAL DATA (Extracted Tables) ---\n${JSON.stringify(rawFinanceData, null, 2)}`;
        }

        if (financeAnalysis) {
            fullUserPrompt += `\n\n--- FINANCIAL DUE DILIGENCE ANALYSIS ---\n${financeAnalysis}`;
        }

        if (marketAnalysis) {
            fullUserPrompt += `\n\n--- MARKET DUE DILIGENCE ANALYSIS ---\n${marketAnalysis}`;
        }

        fullUserPrompt += `\n\nPlease transform this synthesized information into a comprehensive, professional, readable Final Due Diligence report. 

CROSS-REFERENCE Instructions:
1. Use the RAW FINANCIAL DATA to verify and cite specific numbers in the financial sections.
2. Integrate the MARKET DUE DILIGENCE ANALYSIS to provide external validation and competitive context.
3. Synthesize the FINANCIAL DUE DILIGENCE ANALYSIS with the Master Document claims to highlight alignment or gaps.
4. Ensure the final report is a cohesive narrative, not just a collection of separate analyses.`;

        // Call OpenAI Responses API
        const response = await openai.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5.2',
            input: [
                {
                    role: 'developer',
                    content: [
                        {
                            type: 'input_text',
                            text: SYSTEM_PROMPT,
                        },
                    ],
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: fullUserPrompt,
                        },
                    ],
                },
            ],
            text: {
                format: {
                    type: 'text',
                },
            },
            reasoning: {
                effort: 'high',
                summary: null,
            },
            tools: [],
            store: false,
        });

        // Extract the generated report
        const reportContent = extractResponseText(response);

        if (!reportContent) {
            return NextResponse.json(
                { success: false, message: 'Failed to generate report from OpenAI' },
                { status: 500 }
            );
        }

        // Cache the generated report
        await fs.writeFile(reportPath, reportContent, 'utf-8');

        return NextResponse.json({
            success: true,
            report: reportContent,
            cached: false,
        });

    } catch (error) {
        console.error('Error generating DD report:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to generate report' },
            { status: 500 }
        );
    }
}

// Clean the master document for better LLM processing
function cleanMasterDocument(doc: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(doc)) {
        if (typeof value === 'object' && value !== null) {
            const obj = value as Record<string, unknown>;

            // Check if it's a leaf node with extracted content
            if ('extracted' in obj && 'instruction' in obj) {
                // Only include if there's actual extracted content
                if (obj.extracted !== null && obj.extracted !== undefined) {
                    // Simplify: just include the extracted value
                    if (Array.isArray(obj.extracted) && obj.extracted.length > 0) {
                        cleaned[key] = obj.extracted;
                    } else if (!Array.isArray(obj.extracted) && obj.extracted !== '') {
                        cleaned[key] = obj.extracted;
                    }
                }
            } else {
                // Recurse into nested objects
                const nestedCleaned = cleanMasterDocument(obj);
                if (Object.keys(nestedCleaned).length > 0) {
                    cleaned[key] = nestedCleaned;
                }
            }
        }
    }

    return cleaned;
}

// Extract text from OpenAI response
function extractResponseText(response: unknown): string | null {
    if (!response || typeof response !== 'object') return null;

    const resp = response as Record<string, unknown>;

    if (typeof resp.output_text === 'string') {
        return resp.output_text.trim();
    }

    if (Array.isArray(resp.output)) {
        for (const item of resp.output) {
            if (item?.content && Array.isArray(item.content)) {
                for (const content of item.content) {
                    if (content?.type === 'output_text' && typeof content.text === 'string') {
                        return content.text.trim();
                    }
                    if (content?.type === 'text' && typeof content.text === 'string') {
                        return content.text.trim();
                    }
                }
            }
        }
    }

    return null;
}
