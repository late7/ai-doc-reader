import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

const VALID_SECTIONS = ['team-execution', 'business-potential-market', 'product-technology', 'economics-finance'];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');
        const sectionId = searchParams.get('section');

        if (!workspaceSlug) {
            return NextResponse.json({ success: false, message: 'workspace is required' }, { status: 400 });
        }

        const projectRoot = process.cwd();
        const storageDir = path.join(projectRoot, 'storage', workspaceSlug);
        const processedDir = path.join(storageDir, 'processed');

        const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.xls', '.txt', '.md', '.csv'];

        // Load tracker for the specific section (or generic if no section)
        const trackerFile = sectionId
            ? path.join(processedDir, `factsheet_tracker_${sectionId}.json`)
            : null;

        interface TrackerRecord { name: string; size: number; modifiedTime: string; processedTime: string; }
        interface Tracker { lastProcessedAt: string; files: Record<string, TrackerRecord>; }
        let tracker: Tracker = { lastProcessedAt: '', files: {} };

        if (trackerFile) {
            try {
                const trackerContent = await fs.readFile(trackerFile, 'utf-8');
                tracker = JSON.parse(trackerContent);
            } catch { /* no tracker yet */ }
        }

        // Collect files
        let entries: import('fs').Dirent[];
        try {
            entries = await fs.readdir(storageDir, { withFileTypes: true });
        } catch {
            return NextResponse.json({ success: true, files: [], newFilesCount: 0, processedFilesCount: 0, lastProcessedAt: null });
        }

        const files: Array<{
            name: string;
            originalName: string;
            size: number;
            modifiedTime: string;
            processedTime: string | null;
            isNew: boolean;
        }> = [];
        let newFilesCount = 0;
        let processedFilesCount = 0;

        for (const entry of entries) {
            if (entry.isDirectory()) continue;
            if (entry.name.startsWith('.')) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === '.json') continue;
            if (!ALLOWED_EXTENSIONS.includes(ext)) continue;

            const filePath = path.join(storageDir, entry.name);
            const stats = await fs.stat(filePath);
            const modifiedTime = stats.mtime.toISOString();

            const record = tracker.files[entry.name];
            let isNew = true;
            let processedTime: string | null = null;

            if (record && record.modifiedTime === modifiedTime && record.size === stats.size) {
                isNew = false;
                processedTime = record.processedTime;
                processedFilesCount++;
            } else {
                newFilesCount++;
            }

            // Try to load original name from meta file
            let originalName = entry.name;
            try {
                const metaPath = path.join(storageDir, entry.name.replace(ext, '.meta.json'));
                const metaContent = await fs.readFile(metaPath, 'utf-8');
                const meta = JSON.parse(metaContent);
                if (meta.originalName) originalName = meta.originalName;
            } catch { /* no meta file */ }

            files.push({ name: entry.name, originalName, size: stats.size, modifiedTime, processedTime, isNew });
        }

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
        console.error('Error getting fact sheet file status:', error);
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
    }
}

// Reset tracker for a section
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceSlug = searchParams.get('workspace');
        const sectionId = searchParams.get('section');

        if (!workspaceSlug) {
            return NextResponse.json({ success: false, message: 'workspace is required' }, { status: 400 });
        }

        const projectRoot = process.cwd();
        const processedDir = path.join(projectRoot, 'storage', workspaceSlug, 'processed');

        if (sectionId && VALID_SECTIONS.includes(sectionId)) {
            // Reset specific section
            const files = [
                path.join(processedDir, `factsheet_${sectionId}.json`),
                path.join(processedDir, `factsheet_tracker_${sectionId}.json`),
                path.join(processedDir, `factsheet_status_${sectionId}.json`),
            ];
            for (const f of files) {
                try { await fs.unlink(f); } catch { /* file doesn't exist */ }
            }
        } else {
            // Reset all sections
            for (const sec of VALID_SECTIONS) {
                const files = [
                    path.join(processedDir, `factsheet_${sec}.json`),
                    path.join(processedDir, `factsheet_tracker_${sec}.json`),
                    path.join(processedDir, `factsheet_status_${sec}.json`),
                ];
                for (const f of files) {
                    try { await fs.unlink(f); } catch { /* file doesn't exist */ }
                }
            }
            // Also remove case summary
            try { await fs.unlink(path.join(processedDir, 'factsheet_case_summary.json')); } catch { /* */ }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error resetting fact sheet:', error);
        return NextResponse.json({ success: false, message: 'Failed to reset' }, { status: 500 });
    }
}
