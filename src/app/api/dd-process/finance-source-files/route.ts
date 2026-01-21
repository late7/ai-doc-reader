import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

interface SourceFileInfo {
    filename: string;
    originalName: string;
    size: number;
    uploadedAt: string;
    type: 'financial-model' | 'pnl' | 'balance-sheet' | 'supportive-docs';
}

interface SourceFilesData {
    files: {
        financialModel?: SourceFileInfo;
        pnl?: SourceFileInfo;
        balanceSheet?: SourceFileInfo;
        supportiveDocs?: SourceFileInfo;
    };
    updatedAt: string;
}

// GET - Load existing source files info
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
        const sourceFilesDir = path.join(projectRoot, 'storage', workspaceSlug, 'finance-source-files');
        const metadataFile = path.join(sourceFilesDir, 'metadata.json');

        try {
            await fs.access(metadataFile);
            const content = await fs.readFile(metadataFile, 'utf-8');
            const data: SourceFilesData = JSON.parse(content);

            return NextResponse.json({
                success: true,
                exists: true,
                data,
            });
        } catch {
            return NextResponse.json({
                success: true,
                exists: false,
                data: { files: {}, updatedAt: new Date().toISOString() },
            });
        }
    } catch (error) {
        console.error('Error loading source files:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to load source files' },
            { status: 500 }
        );
    }
}

// POST - Upload a source file
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const workspaceSlug = formData.get('workspaceSlug') as string | null;
        const fileType = formData.get('fileType') as 'financial-model' | 'pnl' | 'balance-sheet' | 'supportive-docs' | null;

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspaceSlug is required' },
                { status: 400 }
            );
        }

        if (!file) {
            return NextResponse.json(
                { success: false, message: 'file is required' },
                { status: 400 }
            );
        }

        if (!fileType || !['financial-model', 'pnl', 'balance-sheet', 'supportive-docs'].includes(fileType)) {
            return NextResponse.json(
                { success: false, message: 'fileType must be one of: financial-model, pnl, balance-sheet, supportive-docs' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const sourceFilesDir = path.join(projectRoot, 'storage', workspaceSlug, 'finance-source-files');
        const metadataFile = path.join(sourceFilesDir, 'metadata.json');

        // Create directory if needed
        await fs.mkdir(sourceFilesDir, { recursive: true });

        // Load existing metadata
        let metadata: SourceFilesData = {
            files: {},
            updatedAt: new Date().toISOString(),
        };

        try {
            const existingContent = await fs.readFile(metadataFile, 'utf-8');
            metadata = JSON.parse(existingContent);
        } catch {
            // Metadata doesn't exist yet, use default
        }

        // Generate a safe filename
        const ext = path.extname(file.name);
        const safeFilename = `${fileType}${ext}`;
        const filePath = path.join(sourceFilesDir, safeFilename);

        // Delete old file if exists and is different
        const fileKey = fileType === 'financial-model' ? 'financialModel' :
            fileType === 'pnl' ? 'pnl' :
                fileType === 'balance-sheet' ? 'balanceSheet' : 'supportiveDocs';

        if ((metadata.files as any)[fileKey]) {
            const oldFilePath = path.join(sourceFilesDir, (metadata.files as any)[fileKey]!.filename);
            try {
                await fs.unlink(oldFilePath);
            } catch {
                // Old file doesn't exist
            }
        }

        // Save the new file
        const arrayBuffer = await file.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(arrayBuffer));

        // Update metadata
        const fileInfo: SourceFileInfo = {
            filename: safeFilename,
            originalName: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            type: fileType as any,
        };

        (metadata.files as any)[fileKey] = fileInfo;
        metadata.updatedAt = new Date().toISOString();

        await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: 'File uploaded successfully',
            fileInfo,
        });
    } catch (error) {
        console.error('Error uploading source file:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to upload file' },
            { status: 500 }
        );
    }
}

// DELETE - Remove a source file
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');
        const fileType = searchParams.get('fileType') as 'financial-model' | 'pnl' | 'balance-sheet' | 'supportive-docs' | null;

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspace is required' },
                { status: 400 }
            );
        }

        if (!fileType || !['financial-model', 'pnl', 'balance-sheet', 'supportive-docs'].includes(fileType)) {
            return NextResponse.json(
                { success: false, message: 'fileType must be one of: financial-model, pnl, balance-sheet, supportive-docs' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const sourceFilesDir = path.join(projectRoot, 'storage', workspaceSlug, 'finance-source-files');
        const metadataFile = path.join(sourceFilesDir, 'metadata.json');

        // Load existing metadata
        let metadata: SourceFilesData;
        try {
            const existingContent = await fs.readFile(metadataFile, 'utf-8');
            metadata = JSON.parse(existingContent);
        } catch {
            return NextResponse.json({
                success: true,
                message: 'No files to delete',
            });
        }

        const fileKey = fileType === 'financial-model' ? 'financialModel' :
            fileType === 'pnl' ? 'pnl' :
                fileType === 'balance-sheet' ? 'balanceSheet' : 'supportiveDocs';

        if ((metadata.files as any)[fileKey]) {
            const filePath = path.join(sourceFilesDir, (metadata.files as any)[fileKey]!.filename);
            try {
                await fs.unlink(filePath);
            } catch {
                // File doesn't exist
            }
            delete (metadata.files as any)[fileKey];
            metadata.updatedAt = new Date().toISOString();
            await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
        }

        return NextResponse.json({
            success: true,
            message: 'File deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting source file:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to delete file' },
            { status: 500 }
        );
    }
}
