import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Buffer } from 'buffer';
import { generateFinancePrompt, generateTimeSeriesFinancePrompt, FigureDefinition } from '@/lib/financePromptGenerator';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const files: File[] = [];

    const analysisMode = formData.get('analysisMode');
    const analysisType = formData.get('analysisType');
    let overrideFigures: FigureDefinition[] | undefined;

    const figuresField = formData.get('figures');
    if (typeof figuresField === 'string' && figuresField.trim()) {
      try {
        const parsed = JSON.parse(figuresField) as FigureDefinition[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitizedFigures = parsed
            .map((figure, index) => {
              const id = typeof figure.id === 'string' ? figure.id.trim() : '';
              const name = typeof figure.name === 'string' ? figure.name.trim() : '';
              const description = typeof figure.description === 'string' ? figure.description.trim() : '';

              if (!id || !name) {
                logger.warn(`Skipping invalid custom figure at index ${index}`);
                return null;
              }

              return {
                id,
                name,
                description: description || 'No guidance provided.'
              } satisfies FigureDefinition;
            })
            .filter((figure): figure is FigureDefinition => figure !== null);

          if (sanitizedFigures.length > 0) {
            overrideFigures = sanitizedFigures;
          }
        }
      } catch (parseError) {
        logger.warn('Failed to parse custom figures for OpenAI analysis:', parseError);
      }
    }

    if (typeof analysisMode === 'string') {
      const figureInfo = overrideFigures ? ` with ${overrideFigures.length} custom figures` : '';
      const typeInfo = analysisType === 'timeseries' ? ' (time series)' : ' (basic)';
      logger.debug(`OpenAI analysis mode requested: ${analysisMode}${typeInfo}${figureInfo}`);
    }

    // Extract all files from the form data
    const allowedTypes = ['application/pdf'];

    for (const value of Array.from(formData.values())) {
      if (value instanceof File && allowedTypes.includes(value.type)) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No supported files provided. Please upload PDF files only.' },
        { status: 400 }
      );
    }

    logger.debug(`Processing ${files.length} file(s) with OpenAI Responses API`);

    const encodedFiles = [] as Array<{
      type: 'input_file';
      filename: string;
      file_data: string;
    }>;

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64Content = Buffer.from(arrayBuffer).toString('base64');
        encodedFiles.push({
          type: 'input_file',
          filename: file.name,
          file_data: `data:${file.type};base64,${base64Content}`
        });
        logger.debug(`Prepared ${file.name} (${file.type}) for Responses API`);
      } catch (encodingError) {
        logger.error(`Failed to process ${file.name}:`, encodingError);
      }
    }

    if (encodedFiles.length === 0) {
      throw new Error('Unable to process uploaded files for analysis');
    }

    // Use the appropriate prompt generator based on analysis type
    const isTimeSeries = analysisType === 'timeseries';
    const developerPrompt = isTimeSeries
      ? generateTimeSeriesFinancePrompt('the company', true, overrideFigures)
      : generateFinancePrompt('the company', true, overrideFigures);

    logger.debug('Calling OpenAI Responses API for financial extraction');
    logger.debug(`Analysis Type: ${isTimeSeries ? 'Time Series' : 'Basic'}`);
    logger.debug('Developer Prompt:', developerPrompt);
    
    logger.debug(`Using model: ${process.env.OPENAI_MODEL || 'gpt-5-mini'}`);

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: developerPrompt,
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Analyze the attached financial documents and extract the key figures described in the developer prompt. Return only valid JSON.',
            },
            ...encodedFiles,
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
        effort: 'minimal',
        summary: null,
      },
      tools: [],
      store: false,
      include: ['reasoning.encrypted_content'],
    });

    const responseText = extractResponseText(response);

    if (!responseText) {
      throw new Error('No textual output returned from OpenAI Responses API');
    }

    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse Responses API output as JSON:', parseError);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch (nestedError) {
          logger.error('Failed nested JSON extraction from Responses API output:', nestedError);
        }
      }

      if (!parsedData) {
        parsedData = {
          extraction_error: 'Failed to parse Responses API output',
          raw_response: responseText.substring(0, 1000),
        };
      }
    }

    logger.info('Financial extraction completed via Responses API');

    return NextResponse.json({
      success: true,
      parsedData,
      filesProcessed: encodedFiles.length,
      responseId: response.id,
      analysisType: isTimeSeries ? 'timeseries' : 'basic'
    });

  } catch (error) {
    logger.error('Error in OpenAI finance analysis:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze with OpenAI' },
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
