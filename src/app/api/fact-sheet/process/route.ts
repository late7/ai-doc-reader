import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs/promises';
import { Buffer } from 'buffer';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.xls', '.txt', '.md', '.csv'];
const ALLOWED_MIME_TYPES: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
};

const VALID_SECTIONS = ['team-execution', 'business-potential-market', 'product-technology', 'economics-finance'];

const SECTION_TITLES: Record<string, string> = {
    'team-execution': 'Team & Execution',
    'business-potential-market': 'Business Potential and Market',
    'product-technology': 'Product & Technology',
    'economics-finance': 'Economics and Finance',
};

interface StatusFile {
    status: 'idle' | 'running' | 'completed' | 'error';
    progress: string;
    error: string | null;
    section?: string;
}

async function updateStatus(statusPath: string, status: Partial<StatusFile>): Promise<void> {
    try {
        let current: StatusFile = { status: 'running', progress: '', error: null };
        try {
            const content = await fs.readFile(statusPath, 'utf-8');
            current = JSON.parse(content);
        } catch { /* file doesn't exist yet */ }
        const updated = { ...current, ...status };
        await fs.writeFile(statusPath, JSON.stringify(updated), 'utf-8');
    } catch (e) {
        console.error('Failed to update status:', e);
    }
}

function extractResponseText(response: unknown): string | null {
    if (!response || typeof response !== 'object') return null;
    const resp = response as Record<string, unknown>;
    if (typeof resp.output_text === 'string') return resp.output_text.trim();
    if (Array.isArray(resp.output)) {
        for (const item of resp.output) {
            if (item?.content && Array.isArray(item.content)) {
                for (const content of item.content) {
                    if (content?.type === 'output_text' && typeof content.text === 'string') return content.text.trim();
                    if (content?.type === 'text' && typeof content.text === 'string') return content.text.trim();
                }
            }
        }
    }
    return null;
}

export async function POST(request: NextRequest) {
    const projectRoot = process.cwd();
    let statusFile = '';

    try {
        const body = await request.json();
        const { workspaceSlug, sectionId, processNewOnly } = body;

        if (!workspaceSlug) {
            return NextResponse.json({ success: false, message: 'workspaceSlug is required' }, { status: 400 });
        }
        if (!sectionId || !VALID_SECTIONS.includes(sectionId)) {
            return NextResponse.json({ success: false, message: `sectionId must be one of: ${VALID_SECTIONS.join(', ')}` }, { status: 400 });
        }
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ success: false, message: 'OpenAI API key is not configured' }, { status: 500 });
        }

        const storageDir = path.join(projectRoot, 'storage', workspaceSlug);
        const processedDir = path.join(storageDir, 'processed');
        statusFile = path.join(processedDir, `factsheet_status_${sectionId}.json`);
        const canonicalFile = path.join(processedDir, `factsheet_${sectionId}.json`);
        const trackerFile = path.join(processedDir, `factsheet_tracker_${sectionId}.json`);

        await fs.mkdir(processedDir, { recursive: true });

        // Check if storage directory exists
        try {
            await fs.access(storageDir);
        } catch {
            return NextResponse.json({ success: false, message: `Storage directory not found for workspace: ${workspaceSlug}` }, { status: 404 });
        }

        await updateStatus(statusFile, { status: 'running', progress: `Starting ${SECTION_TITLES[sectionId]} analysis...`, error: null, section: sectionId });

        // Load prompts config
        const promptsFile = path.join(projectRoot, 'src', 'config', 'factSheetPrompts.json');
        let prompts: Record<string, unknown>;
        try {
            const promptsContent = await fs.readFile(promptsFile, 'utf-8');
            prompts = JSON.parse(promptsContent);
        } catch {
            await updateStatus(statusFile, { status: 'error', error: 'Failed to load fact sheet prompts config' });
            return NextResponse.json({ success: false, message: 'Failed to load prompts config' }, { status: 500 });
        }

        const sectionPrompts = (prompts as Record<string, Record<string, Record<string, string>>>).sections?.[sectionId];
        if (!sectionPrompts) {
            await updateStatus(statusFile, { status: 'error', error: `No prompts found for section: ${sectionId}` });
            return NextResponse.json({ success: false, message: `No prompts for section: ${sectionId}` }, { status: 500 });
        }

        const analysisPrompt = sectionPrompts.analysisPrompt;
        const summaryPrompt = sectionPrompts.summaryPrompt;

        // Collect valid files from storage
        await updateStatus(statusFile, { progress: 'Collecting files...' });
        const entries = await fs.readdir(storageDir, { withFileTypes: true });
        const validFiles: { name: string; path: string; ext: string }[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) continue;
            if (entry.name.startsWith('.')) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === '.json') continue;
            if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
            validFiles.push({ name: entry.name, path: path.join(storageDir, entry.name), ext });
        }

        if (validFiles.length === 0) {
            await updateStatus(statusFile, { status: 'error', error: 'No valid documents found in workspace' });
            return NextResponse.json({ success: false, message: 'No valid documents found' }, { status: 400 });
        }

        // Load tracker for incremental processing
        interface TrackerRecord { name: string; size: number; modifiedTime: string; processedTime: string; }
        interface Tracker { lastProcessedAt: string; files: Record<string, TrackerRecord>; }
        let tracker: Tracker = { lastProcessedAt: '', files: {} };
        try {
            const trackerContent = await fs.readFile(trackerFile, 'utf-8');
            tracker = JSON.parse(trackerContent);
        } catch { /* no tracker yet */ }

        // Determine which files to process
        let filesToProcess = validFiles;
        if (processNewOnly && Object.keys(tracker.files).length > 0) {
            const newFiles: typeof validFiles = [];
            for (const file of validFiles) {
                const stats = await fs.stat(file.path);
                const modifiedTime = stats.mtime.toISOString();
                const record = tracker.files[file.name];
                if (!record || record.modifiedTime !== modifiedTime || record.size !== stats.size) {
                    newFiles.push(file);
                }
            }
            filesToProcess = newFiles;
            if (filesToProcess.length === 0) {
                await updateStatus(statusFile, { status: 'completed', progress: 'No new files to process.', error: null });
                return NextResponse.json({ success: true, message: 'No new files to process', filesProcessed: 0 });
            }
        }

        await updateStatus(statusFile, { progress: `Processing ${filesToProcess.length} files for ${SECTION_TITLES[sectionId]}...` });

        // Load existing canonical doc
        let canonical: Record<string, unknown>;
        try {
            const existingContent = await fs.readFile(canonicalFile, 'utf-8');
            canonical = JSON.parse(existingContent);
        } catch {
            canonical = {
                sectionId,
                title: SECTION_TITLES[sectionId],
                score: null,
                summary: '',
                details: [],
                strengths: [],
                weaknesses: [],
                openQuestions: [],
                sourcesProcessed: [],
                lastUpdated: null,
            };
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const processedSourceFiles: string[] = [];

        // Process each file
        for (let i = 0; i < filesToProcess.length; i++) {
            const file = filesToProcess[i];
            await updateStatus(statusFile, { progress: `Analyzing ${file.name} (${i + 1}/${filesToProcess.length})...` });

            try {
                const fileBuffer = await fs.readFile(file.path);
                const base64Content = Buffer.from(fileBuffer).toString('base64');
                const mimeType = ALLOWED_MIME_TYPES[file.ext] || 'application/octet-stream';

                const response = await openai.responses.create({
                    model: process.env.OPENAI_MODEL || 'gpt-4.1',
                    input: [
                        {
                            role: 'developer',
                            content: [{ type: 'input_text', text: `You are a Due Diligence analyst focused on ${SECTION_TITLES[sectionId]}.\n\n${analysisPrompt}\n\nReturn a JSON object with:\n{\n  "findings": [{"point": "...", "evidence": "...", "sentiment": "positive|negative|neutral"}],\n  "score": <0-10 or null if insufficient data>,\n  "strengths": ["..."],\n  "weaknesses": ["..."],\n  "openQuestions": ["..."]\n}\n\nOnly extract information explicitly stated in the document. If the document has no relevant information for this section, return {"findings": [], "score": null, "strengths": [], "weaknesses": [], "openQuestions": []}.` }],
                        },
                        {
                            role: 'user',
                            content: [
                                { type: 'input_text', text: `Analyze "${file.name}" for the "${SECTION_TITLES[sectionId]}" section of a Fact Sheet.` },
                                { type: 'input_file' as const, filename: file.name, file_data: `data:${mimeType};base64,${base64Content}` },
                            ],
                        },
                    ],
                    text: { format: { type: 'json_object' } },
                    reasoning: { effort: 'medium', summary: null },
                    tools: [],
                    store: false,
                });

                const responseText = extractResponseText(response);
                if (responseText) {
                    try {
                        const result = JSON.parse(responseText);
                        // Merge findings into canonical
                        if (result.findings && Array.isArray(result.findings)) {
                            const details = (canonical.details as Array<unknown>) || [];
                            for (const finding of result.findings) {
                                details.push({ ...finding, source: file.name, processedAt: new Date().toISOString() });
                            }
                            canonical.details = details;
                        }
                        if (result.strengths && Array.isArray(result.strengths)) {
                            const strengths = (canonical.strengths as string[]) || [];
                            canonical.strengths = Array.from(new Set([...strengths, ...result.strengths]));
                        }
                        if (result.weaknesses && Array.isArray(result.weaknesses)) {
                            const weaknesses = (canonical.weaknesses as string[]) || [];
                            canonical.weaknesses = Array.from(new Set([...weaknesses, ...result.weaknesses]));
                        }
                        if (result.openQuestions && Array.isArray(result.openQuestions)) {
                            const openQs = (canonical.openQuestions as string[]) || [];
                            canonical.openQuestions = Array.from(new Set([...openQs, ...result.openQuestions]));
                        }
                        // Update score as rolling average
                        if (result.score !== null && result.score !== undefined) {
                            const currentScore = canonical.score as number | null;
                            const sourcesCount = (canonical.sourcesProcessed as string[])?.length || 0;
                            if (currentScore !== null && sourcesCount > 0) {
                                canonical.score = Math.round(((currentScore * sourcesCount + result.score) / (sourcesCount + 1)) * 10) / 10;
                            } else {
                                canonical.score = result.score;
                            }
                        }
                        processedSourceFiles.push(file.name);
                    } catch (parseError) {
                        console.warn(`Failed to parse response for ${file.name}:`, parseError);
                    }
                }
            } catch (fileError) {
                console.error(`Error processing file ${file.name}:`, fileError);
                await updateStatus(statusFile, { progress: `Error processing ${file.name}, continuing...` });
            }

            if (i < filesToProcess.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Update sources processed
        const existingSources = (canonical.sourcesProcessed as string[]) || [];
        canonical.sourcesProcessed = Array.from(new Set([...existingSources, ...processedSourceFiles]));
        canonical.lastUpdated = new Date().toISOString();

        // Now generate updated summary using summaryPrompt
        if (processedSourceFiles.length > 0) {
            await updateStatus(statusFile, { progress: 'Generating summary...' });
            try {
                const summaryResponse = await openai.responses.create({
                    model: process.env.OPENAI_MODEL || 'gpt-4.1',
                    input: [
                        {
                            role: 'developer',
                            content: [{ type: 'input_text', text: `${summaryPrompt}\n\nYou will receive the current canonical document data as JSON. Generate a human-readable markdown summary and an updated score.\n\nReturn JSON:\n{\n  "summary": "<markdown formatted summary>",\n  "score": <0-10 number>\n}` }],
                        },
                        {
                            role: 'user',
                            content: [{ type: 'input_text', text: `Current canonical data:\n${JSON.stringify(canonical, null, 2)}` }],
                        },
                    ],
                    text: { format: { type: 'json_object' } },
                    reasoning: { effort: 'medium', summary: null },
                    tools: [],
                    store: false,
                });

                const summaryText = extractResponseText(summaryResponse);
                if (summaryText) {
                    const summaryResult = JSON.parse(summaryText);
                    if (summaryResult.summary) canonical.summary = summaryResult.summary;
                    if (summaryResult.score !== null && summaryResult.score !== undefined) canonical.score = summaryResult.score;
                }
            } catch (summaryError) {
                console.error('Error generating summary:', summaryError);
            }
        }

        // Save canonical document
        await fs.writeFile(canonicalFile, JSON.stringify(canonical, null, 2), 'utf-8');

        // Update tracker
        const now = new Date().toISOString();
        for (const file of filesToProcess) {
            if (processedSourceFiles.includes(file.name)) {
                const stats = await fs.stat(file.path);
                tracker.files[file.name] = {
                    name: file.name,
                    size: stats.size,
                    modifiedTime: stats.mtime.toISOString(),
                    processedTime: now,
                };
            }
        }
        tracker.lastProcessedAt = now;
        await fs.writeFile(trackerFile, JSON.stringify(tracker, null, 2), 'utf-8');

        await updateStatus(statusFile, {
            status: 'completed',
            progress: `Completed! Processed ${processedSourceFiles.length} files for ${SECTION_TITLES[sectionId]}.`,
            error: null,
        });

        return NextResponse.json({
            success: true,
            message: `Processed ${processedSourceFiles.length} files`,
            filesProcessed: processedSourceFiles.length,
        });
    } catch (error) {
        console.error('Error in fact sheet processing:', error);
        if (statusFile) {
            await updateStatus(statusFile, { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
        }
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Failed to process' }, { status: 500 });
    }
}
