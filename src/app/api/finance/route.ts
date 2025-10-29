import { NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';
import { generateFinancePrompt } from '@/lib/financePromptGenerator';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { workspaceSlug, companyName } = await request.json();
    logger.debug('Finance API called:', { workspaceSlug, companyName });

    if (!workspaceSlug) {
      return NextResponse.json(
        { error: 'Workspace slug is required' },
        { status: 400 }
      );
    }

    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // Build the finance analysis prompt
    const prompt = generateFinancePrompt(companyName, false);

    logger.debug('Sending finance prompt to AnythingLLM:', { prompt });
    const result = await anythingLLM.sendMessage(workspaceSlug, prompt);
    logger.debug('AnythingLLM finance result received:', result);

    // Try to parse the JSON response
    let parsedData;
    try {
      if (typeof result.textResponse === 'string') {
        // Extract JSON from the response
        const jsonMatch = result.textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          parsedData = JSON.parse(result.textResponse);
        }
      } else {
        parsedData = result.textResponse;
      }
    } catch (parseError) {
      logger.error('Failed to parse finance response as JSON:', parseError);
      // Return the raw response if parsing fails
      parsedData = {
        extraction_error: 'Failed to parse AnythingLLM response',
        raw_response: result.textResponse
      };
    }

    return NextResponse.json({
      ...result,
      parsedData
    });
  } catch (error) {
    logger.error('Error in finance analysis:', error);
    return NextResponse.json(
      { error: 'Failed to analyze financial data' },
      { status: 500 }
    );
  }
}
