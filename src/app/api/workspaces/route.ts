import { NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    logger.debug('API route: Fetching workspaces');
    const workspacesData = await anythingLLM.getWorkspaces();
    // console.log('API route: Workspaces received:', workspacesData);
    
    // Ensure we always return data in the expected format
    const response = NextResponse.json({
      workspaces: workspacesData.workspaces || []
    });
    
    // Prevent caching to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;
  } catch (error) {
    logger.error('Error fetching workspaces:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch workspaces',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    
    if (!name) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      );
    }

    const workspace = await anythingLLM.createWorkspace(name);
    return NextResponse.json(workspace);
  } catch (error) {
    logger.error('Error creating workspace:', error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
