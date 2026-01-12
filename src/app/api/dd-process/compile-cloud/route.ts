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

        await updateStatus(statusFile, { progress: `Found ${validFiles.length} files. Starting analysis...` });

        // Build the field catalog from template
        const fieldCatalog = collectFieldCatalog(template);

        // Create the prompt
        const systemPrompt = buildSystemPrompt(fieldCatalog);

        // Initialize OpenAI client
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Initialize output document from template
        const outputDoc = JSON.parse(JSON.stringify(template));
        initializeLeafNodes(outputDoc);

        // Track all source files processed
        const processedSourceFiles: string[] = [];
        let totalExtractionsCount = 0;

        // Process each file individually for better accuracy
        for (let fileIndex = 0; fileIndex < validFiles.length; fileIndex++) {
            const file = validFiles[fileIndex];
            const fileProgress = `Processing file ${fileIndex + 1} of ${validFiles.length}: ${file.name}`;
            await updateStatus(statusFile, { progress: fileProgress });

            try {
                // Read and encode the file
                const fileBuffer = await fs.readFile(file.path);
                const base64Content = Buffer.from(fileBuffer).toString('base64');
                const mimeType = ALLOWED_MIME_TYPES[file.ext] || 'application/octet-stream';

                const encodedFile = {
                    type: 'input_file' as const,
                    filename: file.name,
                    file_data: `data:${mimeType};base64,${base64Content}`,
                };

                // Call OpenAI for this single file
                await updateStatus(statusFile, { progress: `Analyzing ${file.name} with AI... (${fileIndex + 1}/${validFiles.length})` });

                const response = await openai.responses.create({
                    model: process.env.OPENAI_MODEL || 'gpt-5.2',
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
                                    text: `Analyze the attached document "${file.name}" and extract the relevant information for the Due Diligence report. Return only valid JSON matching the output_format specified. Focus on extracting all relevant facts from this specific document.`,
                                },
                                encodedFile,
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
                        effort: 'medium',
                        summary: null,
                    },
                    tools: [],
                    store: false,
                });

                // Extract response text
                const responseText = extractResponseText(response);

                if (responseText) {
                    // Parse and merge the extractions
                    try {
                        let extractedData = JSON.parse(responseText);

                        // Handle case where JSON is wrapped
                        if (!extractedData.extractions) {
                            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                extractedData = JSON.parse(jsonMatch[0]);
                            }
                        }

                        if (extractedData.extractions) {
                            const extractionCount = mergeExtractions(outputDoc, extractedData.extractions, file.name);
                            totalExtractionsCount += extractionCount;
                            processedSourceFiles.push(file.name);

                            await updateStatus(statusFile, {
                                progress: `Completed ${file.name}: extracted ${extractionCount} items (${fileIndex + 1}/${validFiles.length} files done)`
                            });
                        }
                    } catch (parseError) {
                        console.warn(`Failed to parse response for ${file.name}:`, parseError);
                        await updateStatus(statusFile, {
                            progress: `Warning: Could not parse AI response for ${file.name}, continuing...`
                        });
                    }
                } else {
                    console.warn(`No response text for ${file.name}`);
                    await updateStatus(statusFile, {
                        progress: `Warning: No AI response for ${file.name}, continuing...`
                    });
                }
            } catch (fileError) {
                console.error(`Error processing file ${file.name}:`, fileError);
                await updateStatus(statusFile, {
                    progress: `Error processing ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}, continuing...`
                });
            }

            // Small delay between files to avoid rate limiting
            if (fileIndex < validFiles.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Fill sources reviewed
        try {
            const metadata = outputDoc.document_metadata as Record<string, unknown>;
            const sourcesReviewed = metadata?.sources_reviewed as Record<string, unknown>;
            if (sourcesReviewed && typeof sourcesReviewed === 'object') {
                sourcesReviewed.extracted = processedSourceFiles;
            }
        } catch {
            // Ignore if path doesn't exist
        }

        // Write the output
        await updateStatus(statusFile, { progress: 'Writing master document...' });
        await fs.writeFile(outputFile, JSON.stringify(outputDoc, null, 2), 'utf-8');

        await updateStatus(statusFile, {
            status: 'completed',
            progress: `Completed! Processed ${processedSourceFiles.length} files, extracted ${totalExtractionsCount} items.`,
            error: null
        });

        return NextResponse.json({
            success: true,
            message: `Cloud compilation completed: ${processedSourceFiles.length} files, ${totalExtractionsCount} extractions`,
            filesProcessed: processedSourceFiles.length,
            extractionsCount: totalExtractionsCount,
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

// Merge extractions from a single file into the output document
function mergeExtractions(
    outputDoc: Record<string, unknown>,
    extractions: Record<string, { value: unknown; sources?: string[] }>,
    sourceFile: string
): number {
    let mergedCount = 0;

    for (const [pointer, extraction] of Object.entries(extractions)) {
        try {
            const parts = pointer.split('/').filter(p => p);
            let current = outputDoc;

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
                const updateRule = String(leaf.update_rule || '').toLowerCase();

                // Skip locked fields
                if (updateRule === 'locked') continue;

                // Handle evidence
                if (!Array.isArray(leaf.evidence)) {
                    leaf.evidence = [];
                }
                const evidenceArray = leaf.evidence as Array<{ source_file: string; source_location: string; quote: string }>;
                evidenceArray.push({
                    source_file: sourceFile,
                    source_location: 'document',
                    quote: `Extracted from ${sourceFile}`,
                });

                // Handle value based on update rule
                if (updateRule === 'overwrite') {
                    // Overwrite: replace with new value
                    if (extraction.value !== null && extraction.value !== undefined) {
                        leaf.extracted = extraction.value;
                        mergedCount++;
                    }
                } else if (updateRule === 'append') {
                    // Append: add to existing array
                    if (!Array.isArray(leaf.extracted)) {
                        leaf.extracted = leaf.extracted ? [leaf.extracted] : [];
                    }
                    const extractedArray = leaf.extracted as unknown[];

                    if (Array.isArray(extraction.value)) {
                        extractedArray.push(...extraction.value);
                        mergedCount += extraction.value.length;
                    } else if (extraction.value !== null && extraction.value !== undefined) {
                        extractedArray.push(extraction.value);
                        mergedCount++;
                    }
                } else {
                    // Default: treat like append
                    if (!Array.isArray(leaf.extracted)) {
                        leaf.extracted = leaf.extracted ? [leaf.extracted] : [];
                    }
                    const extractedArray = leaf.extracted as unknown[];

                    if (Array.isArray(extraction.value)) {
                        extractedArray.push(...extraction.value);
                        mergedCount += extraction.value.length;
                    } else if (extraction.value !== null && extraction.value !== undefined) {
                        extractedArray.push(extraction.value);
                        mergedCount++;
                    }
                }
            }
        } catch (e) {
            console.warn(`Failed to merge extraction for ${pointer}:`, e);
        }
    }

    return mergedCount;
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
