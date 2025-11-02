import { NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';
import { FigureDefinition, generateFinancePrompt, generateTimeSeriesFinancePrompt } from '@/lib/financePromptGenerator';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workspaceSlug, companyName, figures, analysisMode, analysisType } = body;
    logger.debug('Finance API called:', {
      workspaceSlug,
      companyName,
      analysisMode,
      analysisType,
      customFigureCount: Array.isArray(figures) ? figures.length : 0
    });

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

    let overrideFigures: FigureDefinition[] | undefined;
    if (Array.isArray(figures)) {
      overrideFigures = figures
        .map((figure: any) => {
          const id = typeof figure.id === 'string' ? figure.id.trim() : '';
          const name = typeof figure.name === 'string' ? figure.name.trim() : '';
          const description = typeof figure.description === 'string' ? figure.description.trim() : '';
          if (!id || !name) {
            return null;
          }
          return {
            id,
            name,
            description: description || 'No guidance provided.'
          } satisfies FigureDefinition;
        })
        .filter((figure): figure is FigureDefinition => figure !== null);

      if (overrideFigures.length === 0) {
        overrideFigures = undefined;
      }
    }

    // Build the finance analysis prompt based on analysis type
    const isTimeSeries = analysisType === 'timeseries';
    const prompt = isTimeSeries
      ? generateTimeSeriesFinancePrompt(companyName, false, overrideFigures)
      : generateFinancePrompt(companyName, false, overrideFigures);

    logger.debug('Sending finance prompt to AnythingLLM:', { prompt, isTimeSeries });
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
      parsedData,
      analysisType: isTimeSeries ? 'timeseries' : 'basic'
    });
  } catch (error) {
    logger.error('Error in finance analysis:', error);
    return NextResponse.json(
      { error: 'Failed to analyze financial data' },
      { status: 500 }
    );
  }
}
