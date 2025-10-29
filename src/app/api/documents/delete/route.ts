import { NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';
import { logger } from '@/lib/logger';
import { promises as fs } from 'fs';
import path from 'path';

interface StoredMetadata {
  originalName: string;
  storedName: string;
  docFilename?: string | null;
  docPath?: string | null;
  docId?: string | null;
  metadataId?: string | null;
}

const METADATA_EXTENSION = '.meta.json';

async function readMetadataById(storageDir: string, identifier: string | null) {
  if (!identifier) return null;
  const safeIdentifier = identifier.replace(/[^a-zA-Z0-9-_]/g, '');
  const metadataPath = path.join(storageDir, `${safeIdentifier}${METADATA_EXTENSION}`);
  try {
    const raw = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(raw) as StoredMetadata;
    return { metadata, metadataPath } as const;
  } catch (error) {
    logger.debug('Metadata file not found during delete lookup', { identifier, error: String(error) });
    return null;
  }
}

async function findMetadataCandidate(
  storageDir: string,
  {
    documentUuid,
    docFilename,
    docId,
  }: { documentUuid?: string | null; docFilename?: string | null; docId?: string | null }
) {
  try {
    const entries = await fs.readdir(storageDir);
    for (const entry of entries) {
      if (!entry.endsWith(METADATA_EXTENSION)) continue;
      try {
        const raw = await fs.readFile(path.join(storageDir, entry), 'utf-8');
        const parsed = JSON.parse(raw) as StoredMetadata;
        if (
          (documentUuid && parsed.metadataId && parsed.metadataId.toLowerCase() === documentUuid.toLowerCase()) ||
          (docId && parsed.docId && parsed.docId.toLowerCase() === docId.toLowerCase()) ||
          (docFilename && parsed.docFilename && parsed.docFilename === docFilename)
        ) {
          return {
            metadata: parsed,
            metadataPath: path.join(storageDir, entry),
          } as const;
        }
      } catch (parseError) {
        logger.warn('Unable to parse metadata candidate during delete scan', { entry, parseError: String(parseError) });
      }
    }
  } catch (scanError) {
    logger.warn('Failed to scan metadata files during delete fallback', scanError);
  }
  return null;
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get('workspaceSlug');
  const documentPath = searchParams.get('documentPath');
  const docIdParam = searchParams.get('docId');

    logger.debug('Delete request received:', { workspaceSlug, documentPath });

    if (!workspaceSlug || !documentPath) {
      return NextResponse.json(
        { error: 'Workspace slug and document path are required' },
        { status: 400 }
      );
    }

    // Delete from AnythingLLM
    const result = await anythingLLM.removeDocument(workspaceSlug, documentPath);
    logger.debug('Delete result from AnythingLLM:', result);

    // Also delete from local storage if it exists
    // The documentPath from AnythingLLM has format like "custom-documents/filename-uuid.json"
    // but we stored the original file with its original name
    try {
      const storageDir = path.join(process.cwd(), 'storage', workspaceSlug);
      const filenameWithUUID = path.basename(documentPath);
      const uuidMatch = filenameWithUUID.match(/-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.json$/i);
      const documentUuid = uuidMatch?.[1] ?? null;

      let metadataEntry = await readMetadataById(storageDir, documentUuid);
      if (!metadataEntry && docIdParam) {
        metadataEntry = await readMetadataById(storageDir, docIdParam);
      }
      if (!metadataEntry) {
        metadataEntry = await findMetadataCandidate(storageDir, {
          documentUuid,
          docFilename: filenameWithUUID,
          docId: docIdParam,
        });
      }

      if (metadataEntry) {
        const { metadata, metadataPath } = metadataEntry;
        const storedName = metadata?.storedName;
        if (storedName) {
          const storedFilePath = path.join(storageDir, storedName);
          await fs.unlink(storedFilePath).catch((unlinkError) => {
            logger.debug('Stored file already removed or missing during delete', { storedFilePath, unlinkError: String(unlinkError) });
          });
          logger.info(`Local file deleted: ${storedFilePath}`);
        }

        await fs.unlink(metadataPath).catch(() => {
          // Ignore missing metadata file errors
        });
      }

      // Fallback for legacy stored files using original filenames
      const filenameWithHyphens = filenameWithUUID.replace(/-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json$/, '');
      if (filenameWithHyphens) {
        const files = await fs.readdir(storageDir).catch(() => []);
        const matchingFile = files.find(f => {
          const normalized = f.replace(/\s+/g, '-');
          return normalized === filenameWithHyphens;
        });
        if (matchingFile) {
          const filePath = path.join(storageDir, matchingFile);
          await fs.unlink(filePath).catch(() => undefined);
          logger.info(`Legacy local file deleted: ${filePath}`);
        }
      }
    } catch (storageError) {
      logger.warn('Error deleting local file:', storageError);
      // Continue even if local deletion fails - AnythingLLM deletion succeeded
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
