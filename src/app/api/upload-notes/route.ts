import { NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';

export async function POST(request: Request) {
  try {
    const { workspaceSlug, fileName, content } = await request.json();
    
    if (!workspaceSlug || !fileName || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: workspaceSlug, fileName, or content' },
        { status: 400 }
      );
    }

    console.log('Upload notes API called:', { workspaceSlug, fileName, contentLength: content.length });

    // Create a File object from the text content
    const blob = new Blob([content], { type: 'text/plain' });
    const file = new File([blob], fileName, { type: 'text/plain' });

    // Upload the document to AnythingLLM
    const result = await anythingLLM.uploadDocument(workspaceSlug, file);
    
    console.log('Notes upload result:', result);
    
    return NextResponse.json({ 
      success: true, 
      fileName,
      message: 'Notes uploaded successfully',
      result
    });
  } catch (error) {
    console.error('Error uploading notes:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to upload notes',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}
