import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

interface StoredMetadata {
  originalName: string;
  storedName: string;
  docFilename?: string | null;
  docPath?: string | null;
  docId?: string | null;
  metadataId?: string | null;
  mimeType?: string | null;
  savedAt: string;
  updatedAt?: string;
}

const METADATA_EXTENSION = '.meta.json';

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

async function readMetadata(storageDir: string, identifier: string | null) {
  if (!identifier) {
    return null;
  }

  const safeIdentifier = identifier.replace(/[^a-zA-Z0-9-_]/g, '');
  const metadataPath = path.join(storageDir, `${safeIdentifier}${METADATA_EXTENSION}`);

  try {
    const raw = await fs.readFile(metadataPath, 'utf-8');
    const parsed = JSON.parse(raw) as StoredMetadata;
    return { metadata: parsed, path: metadataPath } as const;
  } catch (error) {
    logger.debug('Metadata file not found for identifier', { identifier, error: String(error) });
    return null;
  }
}

async function findMetadataByScan(
  storageDir: string,
  {
    metadataId,
    docFilename,
    originalName,
  }: { metadataId?: string | null; docFilename?: string | null; originalName?: string | null }
) {
  try {
    const entries = await fs.readdir(storageDir);
    for (const entry of entries) {
      if (!entry.endsWith(METADATA_EXTENSION)) continue;
      try {
        const raw = await fs.readFile(path.join(storageDir, entry), 'utf-8');
        const parsed = JSON.parse(raw) as StoredMetadata;
        if (
          (metadataId && parsed.metadataId && parsed.metadataId.toLowerCase() === metadataId.toLowerCase()) ||
          (docFilename && parsed.docFilename && parsed.docFilename === docFilename) ||
          (originalName && parsed.originalName && parsed.originalName === originalName)
        ) {
          return {
            metadata: parsed,
            path: path.join(storageDir, entry),
          } as const;
        }
      } catch (scanError) {
        logger.warn('Failed to parse metadata during scan', { entry, scanError: String(scanError) });
      }
    }
  } catch (error) {
    logger.warn('Failed to scan metadata directory', error);
  }

  return null;
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[\\/]/g, '');
}

function resolveContentType(filename: string, explicitType?: string | null) {
  if (explicitType) {
    return explicitType;
  }
  const ext = path.extname(filename).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get('workspaceSlug');
    const filenameParam = searchParams.get('filename');
    const docIdParam = searchParams.get('docId');

    if (!workspaceSlug || !filenameParam) {
      return NextResponse.json(
        { error: 'Workspace slug and filename are required' },
        { status: 400 }
      );
    }

    const sanitizedWorkspace = path.basename(workspaceSlug);
    const requestedFilename = sanitizeFilename(path.basename(filenameParam));
    const uuidMatch = requestedFilename.match(/-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.json$/i);
    const documentUuid = uuidMatch?.[1] ?? null;
    const filenameWithoutUuid = documentUuid
      ? requestedFilename.replace(new RegExp(`-${documentUuid}\.json$`, 'i'), '')
      : requestedFilename.replace(/\.json$/i, '');

    const storageDir = path.join(process.cwd(), 'storage', sanitizedWorkspace);
    let metadataEntry = await readMetadata(storageDir, docIdParam);

    if (!metadataEntry && documentUuid) {
      metadataEntry = await readMetadata(storageDir, documentUuid);
    }

    if (!metadataEntry) {
      metadataEntry = await findMetadataByScan(storageDir, {
        metadataId: documentUuid,
        docFilename: requestedFilename,
        originalName: filenameWithoutUuid,
      });
    }

    let storedFilename: string | null = metadataEntry?.metadata?.storedName ?? null;
    let downloadFilename: string | null = metadataEntry?.metadata?.originalName ?? filenameWithoutUuid;
    let metadataToPersist: StoredMetadata | null = metadataEntry?.metadata ?? null;
    let metadataPathToPersist: string | null = metadataEntry?.path ?? null;

    if (!storedFilename) {
      try {
        const files = await fs.readdir(storageDir);
        if (documentUuid) {
          const candidate = files.find((f) => f.toLowerCase().startsWith(documentUuid.toLowerCase())) || null;
          if (candidate) {
            storedFilename = candidate;
          }
        }
        if (!storedFilename) {
          const normalizedTarget = filenameWithoutUuid.replace(/\s+/g, '-');
          const candidate = files.find((f) => f.replace(/\s+/g, '-') === normalizedTarget) || null;
          if (candidate) {
            storedFilename = candidate;
          }
        }
      } catch (dirError) {
        logger.warn('Could not read storage directory while resolving file:', dirError);
      }
    }

    if (!storedFilename) {
      logger.warn('No stored file found for requested download', {
        workspaceSlug: sanitizedWorkspace,
        requestedFilename,
        documentUuid,
        docId: docIdParam,
      });
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const filePath = path.join(storageDir, storedFilename);

    try {
      await fs.access(filePath);
    } catch {
      logger.warn('Stored file missing on disk', { filePath });
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    if (metadataToPersist && metadataPathToPersist) {
      let shouldPersist = false;
      if (!metadataToPersist.metadataId && documentUuid) {
        metadataToPersist.metadataId = documentUuid;
        shouldPersist = true;
      }
      if (!metadataToPersist.docFilename) {
        metadataToPersist.docFilename = requestedFilename;
        shouldPersist = true;
      }
      if (!metadataToPersist.updatedAt || shouldPersist) {
        metadataToPersist.updatedAt = new Date().toISOString();
      }
      if (shouldPersist) {
        try {
          await fs.writeFile(metadataPathToPersist, JSON.stringify(metadataToPersist, null, 2));
        } catch (writeError) {
          logger.warn('Failed to update metadata file with new values', writeError);
        }
      }
    }

    const fileBuffer = await fs.readFile(filePath);
    const contentType = resolveContentType(storedFilename, metadataToPersist?.mimeType);
    const finalDownloadName = downloadFilename || storedFilename;

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${finalDownloadName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error('Error downloading document:', error);
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}
