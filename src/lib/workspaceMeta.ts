import path from 'path';
import fs from 'fs/promises';

export interface WorkspaceMeta {
    createdAt: string;
    factSheetRequired: boolean;
    factSheetCompletedAt: string | null;
}

const STORAGE_DIR = path.join(process.cwd(), 'storage');

function metaPath(slug: string): string {
    return path.join(STORAGE_DIR, slug, 'processed', 'workspace_meta.json');
}

export async function getWorkspaceMeta(slug: string): Promise<WorkspaceMeta | null> {
    try {
        const content = await fs.readFile(metaPath(slug), 'utf-8');
        return JSON.parse(content) as WorkspaceMeta;
    } catch {
        return null;
    }
}

export async function setWorkspaceMeta(slug: string, data: WorkspaceMeta): Promise<void> {
    const filePath = metaPath(slug);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function setFactSheetRequired(slug: string, required: boolean): Promise<void> {
    const existing = await getWorkspaceMeta(slug);
    const meta: WorkspaceMeta = existing || {
        createdAt: new Date().toISOString(),
        factSheetRequired: required,
        factSheetCompletedAt: null,
    };
    meta.factSheetRequired = required;
    if (!required) {
        meta.factSheetCompletedAt = new Date().toISOString();
    }
    await setWorkspaceMeta(slug, meta);
}

/**
 * Scans all workspace directories for those with factSheetRequired === true.
 * Returns an array of workspace slugs that need Fact Sheet processing.
 */
export async function listWorkspacesNeedingFactSheet(): Promise<string[]> {
    const slugs: string[] = [];
    try {
        const entries = await fs.readdir(STORAGE_DIR, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const meta = await getWorkspaceMeta(entry.name);
            if (meta?.factSheetRequired) {
                slugs.push(entry.name);
            }
        }
    } catch {
        // storage dir doesn't exist yet
    }
    return slugs;
}

/**
 * Checks whether a workspace has any uploaded documents (excluding internal dirs).
 */
export async function workspaceHasDocuments(slug: string): Promise<boolean> {
    const SKIP_DIRS = new Set(['processed', 'processed-analysis', 'finance-source-files']);
    const SKIP_EXTS = new Set(['.json']);
    try {
        const dir = path.join(STORAGE_DIR, slug);
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
            if (entry.isDirectory()) continue;
            if (entry.name.startsWith('.')) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (SKIP_EXTS.has(ext)) continue;
            // Found a real document
            return true;
        }
    } catch {
        // directory doesn't exist
    }
    return false;
}
