import { NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    logger.debug('Getting workspace details for:', slug);
    
    const workspaceDetails = await anythingLLM.getWorkspaceDetails(slug);
    
    logger.debug('Workspace details received:', workspaceDetails);
    
    // Handle the case where workspace is an array
    const workspace = Array.isArray(workspaceDetails.workspace) 
      ? workspaceDetails.workspace[0] 
      : workspaceDetails.workspace;
    
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }
    
    logger.debug(`Documents in workspace (${workspace.documents?.length || 0}):`, JSON.stringify(workspace.documents));
    
    // Return the entire workspace response to maintain all data with cache-busting headers
    const response = NextResponse.json(workspaceDetails);
    
    // Prevent caching to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;
  } catch (error) {
    logger.error('Error fetching workspace documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspace documents' },
      { status: 500 }
    );
  }
}