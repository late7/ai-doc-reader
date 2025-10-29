import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Buffer } from 'buffer';
import { generateFinancePrompt } from '@/lib/financePromptGenerator';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const files: File[] = [];

    // Extract all files from the form data
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword' // .doc
    ];

    for (const value of Array.from(formData.values())) {
      if (value instanceof File && allowedTypes.includes(value.type)) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No supported files provided. Please upload PDF, Excel (.xlsx, .xls), or Word (.docx, .doc) files.' },
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

    const developerPrompt = generateFinancePrompt('the company', true);

    logger.debug('Calling OpenAI Responses API for financial extraction');
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
