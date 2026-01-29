import { NextRequest, NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
    try {
        const { workspaceSlug, message } = await request.json();

        if (!workspaceSlug) {
            return NextResponse.json(
                { error: 'Workspace slug is required' },
                { status: 400 }
            );
        }

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return NextResponse.json(
                { error: 'Message is required and must be a non-empty string' },
                { status: 400 }
            );
        }

        logger.info(`Chat request for workspace: ${workspaceSlug}`);
        logger.debug(`Message: ${message}`);

        const result = await anythingLLM.sendMessage(workspaceSlug, message.trim());

        logger.debug('Chat response received:', result);

        // Return the response in a consistent format
        return NextResponse.json({
            textResponse: result.textResponse || result.response || '',
            response: result.response || result.textResponse || '',
            sources: result.sources || [],
            chatId: result.chatId,
            close: result.close,
            error: result.error || null,
        });
    } catch (error) {
        logger.error('Error in chat API:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'An error occurred while processing your request' },
            { status: 500 }
        );
    }
}
