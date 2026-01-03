import { NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { workspaceSlug, prompt, existingFindings } = body;

        logger.info('[DD Report] API Request:', {
            workspaceSlug,
            hasPrompt: !!prompt,
            hasExistingFindings: !!existingFindings,
            findingsCount: existingFindings ? Object.keys(existingFindings).length : 0
        });

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

        // Construct the final prompt
        let finalPrompt = prompt;
        if (existingFindings && Object.keys(existingFindings).length > 0) {
            logger.debug('[DD Report] Appending existing findings to prompt');
            let findingsContext = "\n\nHere are the findings from other sections of the report so far:\n";
            for (const [sectionId, finding] of Object.entries(existingFindings)) {
                findingsContext += `\n[Section: ${sectionId}]\n${finding}\n`;
            }
            findingsContext += "\nUse these findings to inform your response, especially for drawing conclusions.\n";
            finalPrompt += findingsContext;
        }

        logger.debug('[DD Report] Sending prompt to LLM:', {
            promptLength: finalPrompt.length,
            preview: finalPrompt.substring(0, 100) + '...'
        });

        const result = await anythingLLM.sendMessage(workspaceSlug, finalPrompt);

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
