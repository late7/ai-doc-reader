import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

// Minimal test route to isolate web search connection issues
export async function GET() {
    console.log('[web-test] Starting minimal web search test...');
    console.log('[web-test] API key present:', !!process.env.OPENAI_API_KEY);
    console.log('[web-test] API key length:', process.env.OPENAI_API_KEY?.length);
    console.log('[web-test] Model:', process.env.OPENAI_MODEL);

    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        console.log('[web-test] Calling OpenAI responses.create...');
        const startTime = Date.now();

        const response = await openai.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5-mini',
            input: [
                {
                    role: 'user',
                    content: 'What is the current market size of the global SaaS industry? Keep it brief, 2-3 sentences.',
                },
            ],
            tools: [
                {
                    type: 'web_search_preview',
                    search_context_size: 'low',
                    user_location: {
                        type: 'approximate',
                        country: 'FI',
                    },
                } as any,
            ],
            store: false,
        });

        const elapsed = Date.now() - startTime;
        console.log('[web-test] SUCCESS in ' + elapsed + 'ms');

        let outputText = '';
        if (response.output && Array.isArray(response.output)) {
            for (const item of response.output) {
                if (item.type === 'message' && item.content) {
                    for (const c of item.content) {
                        if (c.type === 'output_text') outputText += c.text;
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            elapsed,
            text: outputText.substring(0, 500),
        });
    } catch (error) {
        const elapsed = Date.now();
        console.error('[web-test] FAILED:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error?.constructor?.name,
            cause: error instanceof Error ? (error as any).cause?.message : undefined,
        }, { status: 500 });
    }
}
