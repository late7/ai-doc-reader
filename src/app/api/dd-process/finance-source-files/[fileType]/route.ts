import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// GET - Download a source file
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ fileType: string }> }
) {
    try {
        const { fileType } = await params;
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspace is required' },
                { status: 400 }
            );
        }

        if (!['financial-model', 'pnl', 'balance-sheet', 'supportive-docs'].includes(fileType)) {
            return NextResponse.json(
                { success: false, message: 'Invalid fileType' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const sourceFilesDir = path.join(projectRoot, 'storage', workspaceSlug, 'finance-source-files');
        const metadataFile = path.join(sourceFilesDir, 'metadata.json');

        // Load metadata
        let metadata;
        try {
            const content = await fs.readFile(metadataFile, 'utf-8');
            metadata = JSON.parse(content);
        } catch {
            return NextResponse.json(
                { success: false, message: 'File not found' },
                { status: 404 }
            );
        }

        const fileKey = fileType === 'financial-model' ? 'financialModel' :
            fileType === 'pnl' ? 'pnl' :
                fileType === 'balance-sheet' ? 'balanceSheet' : 'supportiveDocs';

        const fileInfo = metadata.files[fileKey];
        if (!fileInfo) {
            return NextResponse.json(
                { success: false, message: 'File not found' },
                { status: 404 }
            );
        }

        const filePath = path.join(sourceFilesDir, fileInfo.filename);

        try {
            const fileBuffer = await fs.readFile(filePath);

            // Determine content type based on file extension
            const ext = path.extname(fileInfo.originalName).toLowerCase();
            let contentType = 'application/octet-stream';
            if (ext === '.pdf') contentType = 'application/pdf';
            else if (ext === '.xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            else if (ext === '.xls') contentType = 'application/vnd.ms-excel';
            else if (ext === '.csv') contentType = 'text/csv';

            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Type': contentType,
                    'Content-Disposition': `attachment; filename="${fileInfo.originalName}"`,
                    'Content-Length': fileBuffer.length.toString(),
                },
            });
        } catch {
            return NextResponse.json(
                { success: false, message: 'File not found on disk' },
                { status: 404 }
            );
        }
    } catch (error) {
        console.error('Error downloading source file:', error);
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to download file' },
            { status: 500 }
        );
    }
}
