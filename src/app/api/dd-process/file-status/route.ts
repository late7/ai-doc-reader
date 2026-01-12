import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

interface FileInfo {
    name: string;
    originalName: string;
    path: string;
    size: number;
    modifiedTime: string;
    processedTime: string | null;
    isNew: boolean;
}

interface ProcessedFileRecord {
    name: string;
    size: number;
    modifiedTime: string;
    processedTime: string;
}

interface ProcessedFilesTracker {
    lastProcessedAt: string;
    files: Record<string, ProcessedFileRecord>;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.xls', '.txt', '.md'];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspace is required' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const storageDir = path.join(projectRoot, 'storage', workspaceSlug);
        const processedDir = path.join(storageDir, 'processed');
        const trackerFile = path.join(processedDir, 'processed_files.json');

        // Check if storage directory exists
        try {
            await fs.access(storageDir);
        } catch {
            return NextResponse.json({
                success: true,
                files: [],
                newFilesCount: 0,
                processedFilesCount: 0,
                lastProcessedAt: null,
            });
        }

        // Load processed files tracker
        let tracker: ProcessedFilesTracker = { lastProcessedAt: '', files: {} };
        try {
            const trackerContent = await fs.readFile(trackerFile, 'utf-8');
            tracker = JSON.parse(trackerContent);
        } catch {
            // No tracker file yet - all files are new
        }

        // Collect all files in storage directory
        const entries = await fs.readdir(storageDir, { withFileTypes: true });
        const files: FileInfo[] = [];
        let newFilesCount = 0;
        let processedFilesCount = 0;

        for (const entry of entries) {
            if (entry.isDirectory()) continue;
            if (entry.name.startsWith('.')) continue;

            const ext = path.extname(entry.name).toLowerCase();
            if (ext === '.json') continue; // Skip metadata files
            if (!ALLOWED_EXTENSIONS.includes(ext)) continue;

            const filePath = path.join(storageDir, entry.name);
            const stats = await fs.stat(filePath);
            const modifiedTime = stats.mtime.toISOString();

            // Check if file has been processed
            const record = tracker.files[entry.name];
            let isNew = true;
            let processedTime: string | null = null;

            if (record) {
                // File was processed before - check if it's been modified since
                if (record.modifiedTime === modifiedTime && record.size === stats.size) {
                    isNew = false;
                    processedTime = record.processedTime;
                    processedFilesCount++;
                } else {
                    // File has been modified - treat as new
                    newFilesCount++;
                }
            } else {
                newFilesCount++;
            }

            // Try to get original filename from meta.json
            const metaPath = path.join(storageDir, entry.name.replace(ext, '.meta.json'));
            let originalName = entry.name;
            try {
                const metaContent = await fs.readFile(metaPath, 'utf-8');
                const meta = JSON.parse(metaContent);
                if (meta.originalName) {
                    originalName = meta.originalName;
                }
            } catch {
                // No meta file, use stored name
            }

            files.push({
                name: entry.name,
                originalName,
                path: filePath,
                size: stats.size,
                modifiedTime,
                processedTime,
                isNew,
            });
        }

        // Sort files: new files first, then by name
        files.sort((a, b) => {
            if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        return NextResponse.json({
            success: true,
            files,
            newFilesCount,
            processedFilesCount,
            lastProcessedAt: tracker.lastProcessedAt || null,
        });
    } catch (error) {
        console.error('Error getting file status:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to get file status' },
            { status: 500 }
        );
    }
}

// Mark files as processed
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug, files } = body;

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspaceSlug is required' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const storageDir = path.join(projectRoot, 'storage', workspaceSlug);
        const processedDir = path.join(storageDir, 'processed');
        const trackerFile = path.join(processedDir, 'processed_files.json');

        // Create processed directory if needed
        await fs.mkdir(processedDir, { recursive: true });

        // Load existing tracker
        let tracker: ProcessedFilesTracker = { lastProcessedAt: '', files: {} };
        try {
            const trackerContent = await fs.readFile(trackerFile, 'utf-8');
            tracker = JSON.parse(trackerContent);
        } catch {
            // No tracker file yet
        }

        const now = new Date().toISOString();

        // Update tracker with processed files
        for (const file of files) {
            const filePath = path.join(storageDir, file.name);
            try {
                const stats = await fs.stat(filePath);
                tracker.files[file.name] = {
                    name: file.name,
                    size: stats.size,
                    modifiedTime: stats.mtime.toISOString(),
                    processedTime: now,
                };
            } catch {
                // File doesn't exist - skip
            }
        }

        tracker.lastProcessedAt = now;

        // Save tracker
        await fs.writeFile(trackerFile, JSON.stringify(tracker, null, 2), 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating file tracker:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to update file tracker' },
            { status: 500 }
        );
    }
}

// Delete master document and reset tracker for complete reprocessing
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspace is required' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const storageDir = path.join(projectRoot, 'storage', workspaceSlug);
        const processedDir = path.join(storageDir, 'processed');
        const trackerFile = path.join(processedDir, 'processed_files.json');
        const masterDocFile = path.join(processedDir, 'master_document.json');

        // Delete tracker file
        try {
            await fs.unlink(trackerFile);
        } catch {
            // File may not exist
        }

        // Delete master document
        try {
            await fs.unlink(masterDocFile);
        } catch {
            // File may not exist
        }

        return NextResponse.json({
            success: true,
            message: 'Master document and file tracker have been reset. All files will be reprocessed.'
        });
    } catch (error) {
        console.error('Error resetting file tracker:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to reset' },
            { status: 500 }
        );
    }
}
