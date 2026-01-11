import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs/promises';
import { Buffer } from 'buffer';

// Allowed file types for DD analysis
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.xlsx', '.xls', '.txt', '.md'];
const ALLOWED_MIME_TYPES: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
};

interface StatusFile {
    status: 'idle' | 'running' | 'completed' | 'error';
    progress: string;
    error: string | null;
}

async function updateStatus(statusPath: string, status: Partial<StatusFile>): Promise<void> {
    try {
        let current: StatusFile = { status: 'running', progress: '', error: null };
        try {
            const content = await fs.readFile(statusPath, 'utf-8');
            current = JSON.parse(content);
        } catch {
            // File doesn't exist yet
        }
        const updated = { ...current, ...status };
        await fs.writeFile(statusPath, JSON.stringify(updated), 'utf-8');
    } catch (e) {
        console.error('Failed to update status:', e);
    }
}

export async function POST(request: NextRequest) {
    const projectRoot = process.cwd();
    let statusFile = '';

    try {
        const body = await request.json();
        const { workspaceSlug } = body;

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspaceSlug is required' },
                { status: 400 }
            );
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { success: false, message: 'OpenAI API key is not configured' },
                { status: 500 }
            );
        }

        const storageDir = path.join(projectRoot, 'storage', workspaceSlug);
        const processedDir = path.join(storageDir, 'processed');
        statusFile = path.join(processedDir, 'compile_status.json');
        const outputFile = path.join(processedDir, 'master_document.json');
        const templateFile = path.join(projectRoot, 'master-document-template.json');

        // Create processed directory if it doesn't exist
        await fs.mkdir(processedDir, { recursive: true });

        // Check if storage directory exists
        try {
            await fs.access(storageDir);
        } catch {
            return NextResponse.json(
                { success: false, message: `Storage directory not found for workspace: ${workspaceSlug}` },
                { status: 404 }
            );
        }

        // Initialize status
        await updateStatus(statusFile, { status: 'running', progress: 'Starting cloud processing...', error: null });

        // Load template
        await updateStatus(statusFile, { progress: 'Loading template...' });
        let template: Record<string, unknown>;
        try {
            const templateContent = await fs.readFile(templateFile, 'utf-8');
            template = JSON.parse(templateContent);
        } catch {
            await updateStatus(statusFile, { status: 'error', error: 'Failed to load master document template' });
            return NextResponse.json(
                { success: false, message: 'Failed to load master document template' },
                { status: 500 }
            );
        }

        // Collect all valid files from storage directory
        await updateStatus(statusFile, { progress: 'Collecting files...' });
        const entries = await fs.readdir(storageDir, { withFileTypes: true });
        const validFiles: { name: string; path: string; ext: string }[] = [];

        for (const entry of entries) {
            if (entry.isDirectory()) continue;
            if (entry.name.startsWith('.')) continue;

            const ext = path.extname(entry.name).toLowerCase();
            if (ext === '.json') continue; // Skip metadata files
            if (!ALLOWED_EXTENSIONS.includes(ext)) continue;

            validFiles.push({
                name: entry.name,
                path: path.join(storageDir, entry.name),
                ext,
            });
        }

        if (validFiles.length === 0) {
            await updateStatus(statusFile, { status: 'error', error: 'No valid documents found in workspace' });
            return NextResponse.json(
                { success: false, message: 'No valid documents found in workspace' },
                { status: 400 }
            );
        }

        await updateStatus(statusFile, { progress: `Found ${validFiles.length} files. Preparing for upload...` });

        // Prepare files for OpenAI
        const encodedFiles: Array<{
            type: 'input_file';
            filename: string;
            file_data: string;
        }> = [];

        for (const file of validFiles) {
            try {
                const fileBuffer = await fs.readFile(file.path);
                const base64Content = Buffer.from(fileBuffer).toString('base64');
                const mimeType = ALLOWED_MIME_TYPES[file.ext] || 'application/octet-stream';

                encodedFiles.push({
                    type: 'input_file',
                    filename: file.name,
                    file_data: `data:${mimeType};base64,${base64Content}`,
                });
            } catch (e) {
                console.error(`Failed to read file ${file.name}:`, e);
            }
        }

        if (encodedFiles.length === 0) {
            await updateStatus(statusFile, { status: 'error', error: 'Failed to process any files' });
            return NextResponse.json(
                { success: false, message: 'Failed to process any files' },
                { status: 500 }
            );
        }

        await updateStatus(statusFile, { progress: `Sending ${encodedFiles.length} files to OpenAI...` });

        // Build the field catalog from template
        const fieldCatalog = collectFieldCatalog(template);

        // Create the prompt
        const systemPrompt = buildSystemPrompt(fieldCatalog);

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Call OpenAI Responses API with file attachments
        await updateStatus(statusFile, { progress: 'Analyzing documents with AI...' });

        const response = await openai.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5-mini',
            input: [
                {
                    role: 'developer',
                    content: [
                        {
                            type: 'input_text',
                            text: systemPrompt,
                        },
                    ],
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: 'Analyze all the attached documents and extract the relevant information for the Due Diligence report. Return only valid JSON matching the output_format specified.',
                        },
                        ...encodedFiles,
                    ],
                },
            ],
            text: {
                format: {
                    type: 'json_object',
                },
                verbosity: 'low',
            },
            reasoning: {
                effort: 'high',
                summary: null,
            },
            tools: [],
            store: false,
        });

        await updateStatus(statusFile, { progress: 'Processing AI response...' });

        // Extract response text
        const responseText = extractResponseText(response);

        if (!responseText) {
            await updateStatus(statusFile, { status: 'error', error: 'No response from OpenAI' });
            return NextResponse.json(
                { success: false, message: 'No response from OpenAI' },
                { status: 500 }
            );
        }

        // Parse the response
        let extractedData: Record<string, unknown>;
        try {
            extractedData = JSON.parse(responseText);
        } catch {
            // Try to extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    extractedData = JSON.parse(jsonMatch[0]);
                } catch {
                    await updateStatus(statusFile, { status: 'error', error: 'Failed to parse AI response as JSON' });
                    return NextResponse.json(
                        { success: false, message: 'Failed to parse AI response' },
                        { status: 500 }
                    );
                }
            } else {
                await updateStatus(statusFile, { status: 'error', error: 'Invalid AI response format' });
                return NextResponse.json(
                    { success: false, message: 'Invalid AI response format' },
                    { status: 500 }
                );
            }
        }

        // Build the output document
        await updateStatus(statusFile, { progress: 'Building master document...' });
        const outputDoc = buildOutputDocument(template, extractedData, validFiles.map(f => f.name));

        // Write the output
        await fs.writeFile(outputFile, JSON.stringify(outputDoc, null, 2), 'utf-8');

        await updateStatus(statusFile, {
            status: 'completed',
            progress: `Completed! Processed ${encodedFiles.length} files with cloud AI.`,
            error: null
        });

        return NextResponse.json({
            success: true,
            message: 'Cloud compilation completed',
            filesProcessed: encodedFiles.length,
        });

    } catch (error) {
        console.error('Error in cloud compilation:', error);
        if (statusFile) {
            await updateStatus(statusFile, {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            });
        }
        return NextResponse.json(
            { success: false, message: error instanceof Error ? error.message : 'Failed to process' },
            { status: 500 }
        );
    }
}

// Helper function to collect field catalog from template
function collectFieldCatalog(template: Record<string, unknown>, prefix = ''): Array<{ pointer: string; instruction: string; update_rule: string }> {
    const catalog: Array<{ pointer: string; instruction: string; update_rule: string }> = [];

    for (const [key, value] of Object.entries(template)) {
        const pointer = prefix ? `${prefix}/${key}` : `/${key}`;

        if (typeof value === 'object' && value !== null) {
            const obj = value as Record<string, unknown>;

            // Check if it's a leaf section (has update_rule and instruction)
            if ('update_rule' in obj && 'instruction' in obj) {
                const updateRule = String(obj.update_rule || '').toLowerCase();
                if (updateRule !== 'locked') {
                    catalog.push({
                        pointer,
                        instruction: String(obj.instruction || ''),
                        update_rule: updateRule,
                    });
                }
            } else {
                // Recurse into nested objects
                catalog.push(...collectFieldCatalog(obj, pointer));
            }
        }
    }

    return catalog;
}

// Build the system prompt for extraction
function buildSystemPrompt(fieldCatalog: Array<{ pointer: string; instruction: string; update_rule: string }>): string {
    const fieldsDescription = fieldCatalog.map(f =>
        `- "${f.pointer}": ${f.instruction}`
    ).join('\n');

    return `You are a Due Diligence analyst extracting information from company documents.

Your task is to analyze the attached documents and extract relevant information for a Due Diligence report.

IMPORTANT RULES:
1. Only extract information that is EXPLICITLY stated in the documents
2. Do NOT infer, guess, or use outside knowledge
3. For each piece of information, you must be able to point to where it appears in the source documents
4. If information for a field is not found, set its value to null
5. Be thorough - examine all attached documents for relevant information

Fields to extract:
${fieldsDescription}

Return a JSON object with the following structure:
{
    "extractions": {
        "/pointer/path": {
            "value": "extracted text or array of texts",
            "sources": ["filename1.pdf", "filename2.docx"]
        },
        ...
    }
}

For fields with update_rule "append", the value should be an array of strings.
For fields with update_rule "overwrite", the value should be a single string.
If no relevant information is found for a field, omit it from the output.`;
}

// Extract text from OpenAI response
function extractResponseText(response: unknown): string | null {
    if (!response || typeof response !== 'object') return null;

    const resp = response as Record<string, unknown>;

    if (typeof resp.output_text === 'string') {
        return resp.output_text.trim();
    }

    if (Array.isArray(resp.output)) {
        for (const item of resp.output) {
            if (item?.content && Array.isArray(item.content)) {
                for (const content of item.content) {
                    if (content?.type === 'output_text' && typeof content.text === 'string') {
                        return content.text.trim();
                    }
                    if (content?.type === 'text' && typeof content.text === 'string') {
                        return content.text.trim();
                    }
                }
            }
        }
    }

    return null;
}

// Build output document from template and extracted data
function buildOutputDocument(
    template: Record<string, unknown>,
    extractedData: Record<string, unknown>,
    sourceFiles: string[]
): Record<string, unknown> {
    const output = JSON.parse(JSON.stringify(template)); // Deep clone
    const extractions = (extractedData.extractions || {}) as Record<string, { value: unknown; sources?: string[] }>;

    // Apply extractions to output
    for (const [pointer, extraction] of Object.entries(extractions)) {
        try {
            const parts = pointer.split('/').filter(p => p);
            let current = output;

            // Navigate to parent
            for (let i = 0; i < parts.length - 1; i++) {
                if (current[parts[i]] && typeof current[parts[i]] === 'object') {
                    current = current[parts[i]] as Record<string, unknown>;
                } else {
                    throw new Error(`Path not found: ${pointer}`);
                }
            }

            const leafKey = parts[parts.length - 1];
            if (current[leafKey] && typeof current[leafKey] === 'object') {
                const leaf = current[leafKey] as Record<string, unknown>;
                leaf.extracted = extraction.value;
                if (extraction.sources) {
                    leaf.evidence = extraction.sources.map(source => ({
                        source_file: source,
                        source_location: 'document',
                        quote: 'Extracted via cloud AI',
                    }));
                }
            }
        } catch (e) {
            console.warn(`Failed to apply extraction for ${pointer}:`, e);
        }
    }

    // Add extracted field and evidence to all leaf nodes that don't have them
    initializeLeafNodes(output);

    // Fill sources reviewed
    try {
        const metadata = output.document_metadata as Record<string, unknown>;
        const sourcesReviewed = metadata?.sources_reviewed as Record<string, unknown>;
        if (sourcesReviewed && typeof sourcesReviewed === 'object') {
            sourcesReviewed.extracted = sourceFiles;
        }
    } catch {
        // Ignore if path doesn't exist
    }

    return output;
}

// Initialize leaf nodes with extracted and evidence fields
function initializeLeafNodes(obj: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
            const node = value as Record<string, unknown>;
            if ('update_rule' in node && 'instruction' in node) {
                // It's a leaf node
                const updateRule = String(node.update_rule || '').toLowerCase();
                if (updateRule !== 'locked') {
                    if (!('extracted' in node)) {
                        node.extracted = null;
                    }
                    if (!('evidence' in node)) {
                        node.evidence = [];
                    }
                }
            } else {
                // Recurse
                initializeLeafNodes(node);
            }
        }
    }
}
