import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Buffer } from 'buffer';
import { logger } from '@/lib/logger';

// Finance data structure
export interface FinanceData {
    metadata: {
        company_name: string;
        currency: string; // ISO 4217
        period_granularity: "monthly" | "quarterly" | "yearly";
        start_period: string;
        end_period: string;
        model_type: "historical" | "forecast" | "mixed";
        prepared_by?: string;
        last_updated: string; // YYYY-MM-DD
        notes?: string;
    };
    pnl: Array<{
        period: string;
        revenue: number | null;
        cogs: number | null;
        gross_profit: number | null;
        opex: number | null;
        ebitda: number | null;
        notes?: string;
    }>;
    cashflow: Array<{
        period: string;
        opening_cash: number | null;
        operating_cashflow: number | null;
        investing_cashflow: number | null;
        financing_cashflow: number | null;
        closing_cash: number | null;
        notes?: string;
    }>;
    headcount?: Array<{
        period: string;
        total_fte: number;
        sales_fte: number | null;
        tech_fte: number | null;
        avg_cost_per_fte: number | null;
    }>;
    revenue_drivers?: Array<{
        period: string;
        customers: number | null;
        new_customers: number | null;
        arpa: number | null;
        churn_pct: number | null;
    }>;
    assumptions?: Array<{
        category: "revenue" | "costs" | "margin" | "hiring" | "funding" | "other";
        assumption: string;
        value: string | number;
        description?: string;
    }>;
    validation_notes?: Array<{
        level: "info" | "warning" | "error";
        message: string;
    }>;
}

const FINANCE_EXTRACTION_PROMPT = `Read the attached document (PDF) and extract financial data into the following JSON structure. Respond with JSON only, no explanations or proposals.

CRITICAL: DETECT UNIT MULTIPLIERS
Financial documents often express values in abbreviated units. You MUST detect these and NORMALIZE all values to actual amounts:
- "'000" or "in thousands" = multiply by 1,000
- "'000,000" or "in millions" or "M" or "mn" = multiply by 1,000,000  
- "'000,000,000" or "in billions" or "B" or "bn" = multiply by 1,000,000,000
- "k" or "K" suffix = multiply by 1,000
- Look for table headers, footnotes, or column labels like "€'000", "USD millions", "in thousands EUR", etc.

Example: If document says "Revenue: 5,200" and header shows "'000 EUR", the actual revenue is 5,200,000 EUR.

{
  "metadata": {
    "company_name": "string - name of the company",
    "currency": "string - ISO 4217 currency code (e.g., EUR, USD)",
    "unit_multiplier": "number - detected multiplier (1 = actual values, 1000 = thousands, 1000000 = millions)",
    "unit_multiplier_source": "string - where the multiplier was detected (e.g., 'header: in thousands EUR', 'footnote: figures in millions')",
    "period_granularity": "monthly|quarterly|yearly",
    "start_period": "string - first period in the data (e.g., 2024-Q1, 2024-01)",
    "end_period": "string - last period in the data",
    "model_type": "historical|forecast|mixed",
    "prepared_by": "string - optional, who prepared this",
    "last_updated": "string - YYYY-MM-DD format",
    "notes": "string - optional general notes"
  },
  "pnl": [
    {
      "period": "string - period identifier",
      "revenue": "number|null - ACTUAL value after applying multiplier",
      "cogs": "number|null - cost of goods sold, ACTUAL value",
      "gross_profit": "number|null - ACTUAL value",
      "opex": "number|null - operating expenses, ACTUAL value",
      "ebitda": "number|null - ACTUAL value",
      "notes": "string - optional notes for this period"
    }
  ],
  "cashflow": [
    {
      "period": "string",
      "opening_cash": "number|null - ACTUAL value",
      "operating_cashflow": "number|null - ACTUAL value",
      "investing_cashflow": "number|null - ACTUAL value",
      "financing_cashflow": "number|null - ACTUAL value",
      "closing_cash": "number|null - ACTUAL value",
      "notes": "string - optional"
    }
  ],
  "headcount": [
    {
      "period": "string",
      "total_fte": "number",
      "sales_fte": "number|null",
      "tech_fte": "number|null",
      "avg_cost_per_fte": "number|null - ACTUAL value after applying multiplier"
    }
  ],
  "revenue_drivers": [
    {
      "period": "string",
      "customers": "number|null - total customers",
      "new_customers": "number|null",
      "arpa": "number|null - average revenue per account, ACTUAL value",
      "churn_pct": "number|null - churn percentage (keep as percentage, do not multiply)"
    }
  ],
  "assumptions": [
    {
      "category": "revenue|costs|margin|hiring|funding|other",
      "assumption": "string - the assumption statement",
      "value": "string|number - the assumed value",
      "description": "string - optional description"
    }
  ],
  "validation_notes": [
    {
      "level": "info|warning|error",
      "message": "string - any issues or notes about data quality"
    }
  ]
}

IMPORTANT RULES:
1. Extract ONLY data that is explicitly present in the document
2. Use null for any values not found in the document
3. ALWAYS check for unit multipliers in headers, footers, column labels, and footnotes
4. ALL monetary values must be normalized to actual amounts (apply the multiplier)
5. Percentages should remain as percentages (do NOT multiply)
6. Include validation_notes for any data quality issues, missing data, or if multiplier was ambiguous
7. If no multiplier is found, assume values are actual (unit_multiplier = 1)
8. Ensure all numbers are numeric (not strings)
9. Include optional arrays only if relevant data is found
10. Return valid JSON that exactly matches this schema`;


export async function POST(request: Request) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is missing. Please configure OPENAI_API_KEY in your environment settings.');
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Parse the multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided. Please upload a PDF file.' },
                { status: 400 }
            );
        }

        // Only accept PDF files
        const allowedTypes = ['application/pdf'];
        const fileExtension = file.name.toLowerCase().split('.').pop();
        const isAllowedExtension = fileExtension === 'pdf';

        if (!allowedTypes.includes(file.type) && !isAllowedExtension) {
            return NextResponse.json(
                { error: 'Invalid file type. Please upload a PDF file.' },
                { status: 400 }
            );
        }

        logger.debug(`Processing finance file: ${file.name} (${file.size} bytes, type: ${file.type})`);

        // Convert file to base64 with correct MIME type
        const arrayBuffer = await file.arrayBuffer();
        const base64Content = Buffer.from(arrayBuffer).toString('base64');

        // Determine the correct MIME type
        const mimeType = file.type || 'application/pdf';

        const encodedFile = {
            type: 'input_file' as const,
            filename: file.name,
            file_data: `data:${mimeType};base64,${base64Content}`
        };

        logger.debug('Calling OpenAI GPT-5.2 for finance data extraction');

        const response = await openai.responses.create({
            model: 'gpt-5.2',
            input: [
                {
                    role: 'developer',
                    content: [
                        {
                            type: 'input_text',
                            text: FINANCE_EXTRACTION_PROMPT,
                        },
                    ],
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: 'Extract the financial data from this PDF document. Return only valid JSON matching the schema provided.',
                        },
                        encodedFile,
                    ],
                },
            ],
            text: {
                format: {
                    type: 'json_object',
                },
                verbosity: 'low',
            },
            reasoning: {
                effort: 'medium',
                summary: null,
            },
            tools: [],
            store: false,
            include: ['reasoning.encrypted_content'],
        });

        const responseText = extractResponseText(response);

        if (!responseText) {
            throw new Error('No response from OpenAI');
        }

        let financeData: FinanceData;
        try {
            financeData = JSON.parse(responseText);
        } catch (parseError) {
            logger.error('Failed to parse OpenAI response as JSON:', parseError);
            // Try to extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                financeData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Failed to parse finance data from OpenAI response');
            }
        }

        logger.info('Finance data extraction completed successfully');

        return NextResponse.json({
            success: true,
            data: financeData,
            filename: file.name,
        });

    } catch (error) {
        logger.error('Error in finance PDF extraction:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to extract finance data' },
            { status: 500 }
        );
    }
}

function extractResponseText(response: any): string | null {
    if (!response) {
        return null;
    }

    if (typeof response.output_text === 'string') {
        return response.output_text.trim();
    }

    if (Array.isArray(response.output)) {
        for (const item of response.output) {
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

    if (Array.isArray(response.content)) {
        for (const content of response.content) {
            if (content?.type === 'output_text' && typeof content.text === 'string') {
                return content.text.trim();
            }
            if (content?.type === 'text' && typeof content.text === 'string') {
                return content.text.trim();
            }
        }
    }

    return null;
}
