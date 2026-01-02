import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'dd-report.json');

export interface ReportSection {
    id: string;
    title: string;
    prompt: string;
}

export interface DDReportConfig {
    sections: ReportSection[];
}

// GET - Load current dd-report configuration
export async function GET() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            // Return default configuration if file doesn't exist
            const defaultConfig: DDReportConfig = {
                sections: [
                    {
                        id: 'executive-summary',
                        title: 'Executive Summary',
                        prompt: 'Please provide a comprehensive executive summary of the provided documents, highlighting key findings, opportunities, and risks.'
                    },
                    {
                        id: 'company-overview',
                        title: 'Company Overview',
                        prompt: 'Describe the company based on the documents. Include details about its history, mission, business model, and key stakeholders.'
                    },
                    {
                        id: 'financial-health',
                        title: 'Financial Health',
                        prompt: 'Analyze the financial health of the company. Look for revenue trends, profitability, debt levels, and any concerning financial metrics found in the documents.'
                    }
                ]
            };

            // Ensure directory exists
            const configDir = path.dirname(CONFIG_PATH);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // Create the file with default config
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
            return NextResponse.json(defaultConfig);
        }

        let config: DDReportConfig;
        try {
            const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const parsed = JSON.parse(configData);

            // Check if it's likely the old format or corrupted
            if (parsed.dueDiligencePrompts) {
                // Migration logic: map dueDiligencePrompts to sections
                config = {
                    sections: parsed.dueDiligencePrompts.map((p: any) => ({
                        id: p.id || generateId(p.section),
                        title: p.section || p.title || 'Untitled',
                        prompt: p.prompt || ''
                    }))
                };
                // Save the migrated config
                fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
            } else if (Array.isArray(parsed.sections)) {
                config = parsed;
            } else {
                throw new Error('Invalid config structure');
            }
        } catch (parseError) {
            console.warn('dd-report.json is invalid or corrupted, resetting to defaults:', parseError);
            // Return default configuration if file is corrupted
            const defaultConfig: DDReportConfig = {
                sections: [
                    {
                        id: 'executive-summary',
                        title: 'Executive Summary',
                        prompt: 'Please provide a comprehensive executive summary of the provided documents, highlighting key findings, opportunities, and risks.'
                    },
                    {
                        id: 'company-overview',
                        title: 'Company Overview',
                        prompt: 'Describe the company based on the documents. Include details about its history, mission, business model, and key stakeholders.'
                    },
                    {
                        id: 'financial-health',
                        title: 'Financial Health',
                        prompt: 'Analyze the financial health of the company. Look for revenue trends, profitability, debt levels, and any concerning financial metrics found in the documents.'
                    }
                ]
            };

            // Overwrite the corrupted file
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
            return NextResponse.json(defaultConfig);
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error loading dd-report config:', error);
        return NextResponse.json(
            { error: 'Failed to load configuration' },
            { status: 500 }
        );
    }
}

function generateId(text: string = ''): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `section-${Date.now()}`;
}

// POST - Save dd-report configuration
export async function POST(request: NextRequest) {
    try {
        const config: DDReportConfig = await request.json();

        // Validate the configuration
        if (!config.sections || !Array.isArray(config.sections)) {
            return NextResponse.json(
                { error: 'Invalid configuration format' },
                { status: 400 }
            );
        }

        // Validate each section
        for (const section of config.sections) {
            if (!section.id || !section.title || !section.prompt) {
                return NextResponse.json(
                    { error: 'Invalid section format. Each section must have id, title, and prompt.' },
                    { status: 400 }
                );
            }
        }

        // Save to file
        // Ensure directory exists
        const configDir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving dd-report config:', error);
        return NextResponse.json(
            { error: 'Failed to save configuration' },
            { status: 500 }
        );
    }
}
