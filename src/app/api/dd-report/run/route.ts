import { NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { workspaceSlug, prompt } = body;

        if (!workspaceSlug) {
            return NextResponse.json(
                { error: 'Workspace slug is required' },
                { status: 400 }
            );
        }

        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt is required' },
                { status: 400 }
            );
        }

        logger.debug('DD Report Run API called:', { workspaceSlug });

        const result = await anythingLLM.sendMessage(workspaceSlug, prompt);

        // The result from anythingLLM.sendMessage usually contains textResponse
        return NextResponse.json({
            result: result.textResponse
        });

    } catch (error) {
        logger.error('Error in DD Report analysis:', error);
        return NextResponse.json(
            { error: 'Failed to run analysis' },
            { status: 500 }
        );
    }
}
