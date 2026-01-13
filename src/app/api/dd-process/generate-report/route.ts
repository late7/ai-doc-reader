import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs/promises';

const SYSTEM_PROMPT = `You are an expert investment analyst creating a professional Due Diligence report for institutional investors (ICs), Family Offices (FOs), and Limited Partners (LPs).

Your task is to transform raw DD research data into a polished, sell-side style Due Diligence report.

GUIDELINES:
1. **Structure**: Follow a professional sell-side DD report format with clear sections
2. **Tone**: Neutral, evidence-based, professional - not promotional
3. **Clarity**: Remove duplication, noise, and raw research fragments
4. **Audience**: Make it readable for sophisticated investors while preserving technical and regulatory depth
5. **Organization**: Clearly separate:
   - **Facts** (verified information from documents)
   - **Positioning** (market position, competitive landscape)
   - **Maturity** (development stage, traction, team experience)
   - **Gaps** (missing information, risks, areas needing clarification)
6. **Terminology**: Use normalized, industry-standard terminology
7. **Formatting**: Use proper Markdown with:
   - Clear hierarchical headings (##, ###, ####)
   - Bullet points for lists
   - Tables where appropriate for comparisons
   - Bold for key terms and metrics
   - Blockquotes for notable quotes or findings

STRUCTURE YOUR REPORT AS:
1. **Executive Summary** - High-level overview, key investment thesis, main findings
2. **Company Overview** - Legal entity, jurisdiction, business description
3. **Product & Technology** - Core offering, tech stack, IP, development stage
4. **Market Opportunity** - TAM/SAM/SOM, competitive landscape, market dynamics
5. **Business Model** - Revenue model, pricing, unit economics if available
6. **Team & Governance** - Key personnel, board, advisors, organizational maturity
7. **Financial Summary** - Key metrics, funding history, use of funds
8. **Regulatory & Compliance** - Licenses, certifications, compliance status
9. **Risk Assessment** - Key risks, mitigation strategies, gaps in information
10. **Appendix** (if needed) - Additional details, source documents reviewed

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

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Prepare the JSON for the prompt (clean up for readability)
        const cleanedJson = cleanMasterDocument(masterDocument);
        const jsonString = JSON.stringify(cleanedJson, null, 2);

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
                            text: `Here is the raw DD research data in JSON format. Please transform this into a professional, readable Due Diligence report:\n\n${jsonString}`,
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
