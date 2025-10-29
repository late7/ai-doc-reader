import { NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';
import { logger } from '@/lib/logger';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    logger.debug('Upload request received');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceSlug = formData.get('workspaceSlug') as string;

    logger.debug('Form data:', { fileName: file?.name, workspaceSlug });

    if (!file || !workspaceSlug) {
      logger.debug('Missing file or workspaceSlug');
      return NextResponse.json(
        { error: 'File and workspace slug are required' },
        { status: 400 }
      );
    }

    // Read file content once for both operations
    const buffer = Buffer.from(await file.arrayBuffer());
    logger.debug('File buffer created, size:', buffer.length);

    // Create a new File object from buffer for AnythingLLM upload
    const fileForUpload = new File([buffer], file.name, { type: file.type });
    
    // Upload to AnythingLLM first to capture document metadata/ids
    logger.debug('Uploading to AnythingLLM');
    const result = await anythingLLM.uploadDocument(workspaceSlug, fileForUpload);

    const uploadedDoc = result?.document;
    const workspaceDoc = result?.workspaceDoc;

    logger.debug('AnythingLLM upload result:', { uploadedDoc: !!uploadedDoc, workspaceDoc: !!workspaceDoc });

    const rawMetadataCandidates = [uploadedDoc?.metadata, workspaceDoc?.metadata];
    let metadata: Record<string, any> | null = null;
    for (const candidate of rawMetadataCandidates) {
      if (!candidate) continue;
      try {
        metadata = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
        if (metadata && typeof metadata === 'object') {
          logger.debug('Parsed metadata:', metadata);
          break;
        }
      } catch (parseError) {
        logger.warn('Unable to parse document metadata from AnythingLLM response:', parseError);
      }
    }

    const metadataId: string | undefined = metadata?.id || (workspaceDoc?.metadataId as string | undefined);
    const docId: string | undefined = workspaceDoc?.docId || uploadedDoc?.docId || uploadedDoc?.id;
    const workspaceFilename: string | undefined = workspaceDoc?.filename || uploadedDoc?.filename || (uploadedDoc as any)?.name;
    const documentPath: string | undefined = workspaceDoc?.docpath || uploadedDoc?.location;

    logger.debug('Extracted IDs and paths:', { metadataId, docId, workspaceFilename, documentPath });

    const originalName: string = metadata?.title || file.name;
    const extension = path.extname(originalName) || path.extname(file.name) || path.extname(workspaceFilename ?? '') || '.bin';
    const uniqueId = metadataId || docId || randomUUID();
    const storageFilename = `${uniqueId}${extension}`;
    const storageDir = path.join(process.cwd(), 'storage', workspaceSlug);

    logger.debug('Storage details:', { originalName, extension, uniqueId, storageFilename, storageDir });

    // Save file locally using unique AnythingLLM identifier to avoid collisions
    try {
      await fs.mkdir(storageDir, { recursive: true });
      const filePath = path.join(storageDir, storageFilename);
      await fs.writeFile(filePath, buffer);
      logger.info(`File saved locally: ${filePath}`);

      // Persist minimal metadata to restore original filename on download
      const metadataPath = path.join(storageDir, `${uniqueId}.meta.json`);
      const metadataPayload = {
        originalName,
        storedName: storageFilename,
        docFilename: workspaceFilename || null,
        docPath: documentPath || null,
        docId: docId || null,
        metadataId: metadataId || null,
        mimeType: file.type || null,
        savedAt: new Date().toISOString(),
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadataPayload, null, 2));
      logger.debug(`Metadata saved for ${file.name} at ${metadataPath}`);
    } catch (storageError) {
      logger.error('Error saving file or metadata to local storage:', storageError);
      // Continue even if local storage fails
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}