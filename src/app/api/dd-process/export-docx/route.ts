import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FONT_FAMILY = 'Arial';
const FONT_SIZE_BODY = 24; // 12pt in half-points
const FONT_SIZE_H1 = 48;   // 24pt
const FONT_SIZE_H2 = 36;   // 18pt
const FONT_SIZE_H3 = 28;   // 14pt
const FONT_SIZE_H4 = 26;   // 13pt

// Simple markdown to plain text with basic parsing
function parseContentSimple(markdown: string): { type: string; content: string; tableData?: string[][] }[] {
    const lines = markdown.split('\n');
    const elements: { type: string; content: string; tableData?: string[][] }[] = [];
    let tableRows: string[][] = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            if (inTable && tableRows.length > 0) {
                elements.push({ type: 'table', content: '', tableData: [...tableRows] });
                tableRows = [];
                inTable = false;
            }
            continue;
        }

        // Table row
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            if (trimmed.match(/^[\|\s\-:]+$/)) continue; // Skip separator
            const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
            tableRows.push(cells);
            inTable = true;
            continue;
        }

        // End table if we hit a non-table line
        if (inTable && tableRows.length > 0) {
            elements.push({ type: 'table', content: '', tableData: [...tableRows] });
            tableRows = [];
            inTable = false;
        }

        // Headings
        if (trimmed.startsWith('####')) {
            elements.push({ type: 'h4', content: trimmed.replace(/^####\s*/, '') });
        } else if (trimmed.startsWith('###')) {
            elements.push({ type: 'h3', content: trimmed.replace(/^###\s*/, '') });
        } else if (trimmed.startsWith('##')) {
            elements.push({ type: 'h2', content: trimmed.replace(/^##\s*/, '') });
        } else if (trimmed.startsWith('#')) {
            elements.push({ type: 'h1', content: trimmed.replace(/^#\s*/, '') });
        }
        // Bullet points
        else if (trimmed.match(/^[-*]\s/)) {
            elements.push({ type: 'bullet', content: trimmed.replace(/^[-*]\s/, '') });
        }
        // Numbered list
        else if (trimmed.match(/^\d+\.\s/)) {
            elements.push({ type: 'numbered', content: trimmed.replace(/^\d+\.\s/, '') });
        }
        // Regular paragraph
        else {
            elements.push({ type: 'paragraph', content: trimmed });
        }
    }

    // Final table cleanup
    if (tableRows.length > 0) {
        elements.push({ type: 'table', content: '', tableData: tableRows });
    }

    return elements;
}

// Parse inline formatting and return TextRun array with proper formatting
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInlineFormatting(text: string, TextRun: any, fontSize: number = FONT_SIZE_BODY, isBold: boolean = false): any[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runs: any[] = [];

    // Pattern to match: **bold**, *italic*, ***bold italic***, `code`
    const regex = /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            const beforeText = text.slice(lastIndex, match.index);
            if (beforeText) {
                runs.push(new TextRun({
                    text: beforeText,
                    font: FONT_FAMILY,
                    size: fontSize,
                    bold: isBold,
                }));
            }
        }

        if (match[2]) {
            // Bold italic (***text***)
            runs.push(new TextRun({
                text: match[2],
                font: FONT_FAMILY,
                size: fontSize,
                bold: true,
                italics: true,
            }));
        } else if (match[3]) {
            // Bold (**text**)
            runs.push(new TextRun({
                text: match[3],
                font: FONT_FAMILY,
                size: fontSize,
                bold: true,
            }));
        } else if (match[4]) {
            // Italic (*text*)
            runs.push(new TextRun({
                text: match[4],
                font: FONT_FAMILY,
                size: fontSize,
                italics: true,
                bold: isBold,
            }));
        } else if (match[5]) {
            // Code (`text`)
            runs.push(new TextRun({
                text: match[5],
                font: 'Courier New',
                size: fontSize,
                bold: isBold,
            }));
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        runs.push(new TextRun({
            text: text.slice(lastIndex),
            font: FONT_FAMILY,
            size: fontSize,
            bold: isBold,
        }));
    }

    // If no formatting found, return plain text
    if (runs.length === 0) {
        runs.push(new TextRun({
            text: text,
            font: FONT_FAMILY,
            size: fontSize,
            bold: isBold,
        }));
    }

    return runs;
}

export async function POST(request: NextRequest) {
    try {
        console.log('[DOCX] Starting export...');

        const body = await request.json();
        const { markdown, filename } = body;

        if (!markdown) {
            return NextResponse.json(
                { success: false, message: 'markdown content is required' },
                { status: 400 }
            );
        }

        console.log('[DOCX] Markdown length:', markdown.length);

        // Dynamic require to bypass webpack module issues
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const docx = require('docx');
        const {
            Document,
            Packer,
            Paragraph,
            TextRun,
            HeadingLevel,
            Table,
            TableRow,
            TableCell,
            WidthType,
            BorderStyle,
            AlignmentType,
            ShadingType,
        } = docx;

        // Parse content
        const elements = parseContentSimple(markdown);
        console.log('[DOCX] Parsed elements:', elements.length);

        // Build document children
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const children: any[] = [];

        for (const el of elements) {
            try {
                switch (el.type) {
                    case 'h1':
                        children.push(new Paragraph({
                            children: parseInlineFormatting(el.content, TextRun, FONT_SIZE_H1, true),
                            heading: HeadingLevel.HEADING_1,
                            spacing: { before: 400, after: 200 },
                        }));
                        break;
                    case 'h2':
                        children.push(new Paragraph({
                            children: parseInlineFormatting(el.content, TextRun, FONT_SIZE_H2, true),
                            heading: HeadingLevel.HEADING_2,
                            spacing: { before: 300, after: 150 },
                        }));
                        break;
                    case 'h3':
                        children.push(new Paragraph({
                            children: parseInlineFormatting(el.content, TextRun, FONT_SIZE_H3, true),
                            heading: HeadingLevel.HEADING_3,
                            spacing: { before: 240, after: 120 },
                        }));
                        break;
                    case 'h4':
                        children.push(new Paragraph({
                            children: parseInlineFormatting(el.content, TextRun, FONT_SIZE_H4, true),
                            heading: HeadingLevel.HEADING_4,
                            spacing: { before: 200, after: 100 },
                        }));
                        break;
                    case 'bullet':
                        children.push(new Paragraph({
                            children: parseInlineFormatting(el.content, TextRun, FONT_SIZE_BODY),
                            bullet: { level: 0 },
                            spacing: { before: 60, after: 60 },
                        }));
                        break;
                    case 'numbered':
                        children.push(new Paragraph({
                            children: parseInlineFormatting(el.content, TextRun, FONT_SIZE_BODY),
                            spacing: { before: 60, after: 60 },
                        }));
                        break;
                    case 'table':
                        if (el.tableData && el.tableData.length > 0) {
                            // Table borders
                            const tableBorders = {
                                top: { style: BorderStyle.SINGLE, size: 1, color: '666666' },
                                bottom: { style: BorderStyle.SINGLE, size: 1, color: '666666' },
                                left: { style: BorderStyle.SINGLE, size: 1, color: '666666' },
                                right: { style: BorderStyle.SINGLE, size: 1, color: '666666' },
                                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
                                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
                            };

                            const rows = el.tableData.map((rowData: string[], rowIndex: number) =>
                                new TableRow({
                                    children: rowData.map((cellText: string) =>
                                        new TableCell({
                                            children: [new Paragraph({
                                                children: parseInlineFormatting(cellText, TextRun, FONT_SIZE_BODY, rowIndex === 0),
                                                alignment: AlignmentType.LEFT,
                                            })],
                                            width: { size: Math.floor(100 / rowData.length), type: WidthType.PERCENTAGE },
                                            shading: rowIndex === 0 ? {
                                                type: ShadingType.SOLID,
                                                color: 'E8E8E8',
                                                fill: 'E8E8E8',
                                            } : undefined,
                                            margins: {
                                                top: 80,
                                                bottom: 80,
                                                left: 120,
                                                right: 120,
                                            },
                                        })
                                    ),
                                })
                            );

                            children.push(new Table({
                                rows,
                                width: { size: 100, type: WidthType.PERCENTAGE },
                                borders: tableBorders,
                            }));

                            // Add space after table
                            children.push(new Paragraph({
                                children: [],
                                spacing: { before: 120, after: 120 },
                            }));
                        }
                        break;
                    default:
                        children.push(new Paragraph({
                            children: parseInlineFormatting(el.content, TextRun, FONT_SIZE_BODY),
                            spacing: { before: 80, after: 80 },
                        }));
                }
            } catch (elementError) {
                console.error('[DOCX] Error processing element:', el.type, elementError);
                children.push(new Paragraph({
                    children: [new TextRun({
                        text: el.content || '',
                        font: FONT_FAMILY,
                        size: FONT_SIZE_BODY,
                    })],
                }));
            }
        }

        console.log('[DOCX] Created children:', children.length);

        // Create document with default styles
        const doc = new Document({
            styles: {
                default: {
                    document: {
                        run: {
                            font: FONT_FAMILY,
                            size: FONT_SIZE_BODY,
                        },
                        paragraph: {
                            spacing: { line: 276 }, // 1.15 line spacing
                        },
                    },
                    heading1: {
                        run: {
                            font: FONT_FAMILY,
                            size: FONT_SIZE_H1,
                            bold: true,
                            color: '2E74B5',
                        },
                    },
                    heading2: {
                        run: {
                            font: FONT_FAMILY,
                            size: FONT_SIZE_H2,
                            bold: true,
                            color: '2E74B5',
                        },
                    },
                    heading3: {
                        run: {
                            font: FONT_FAMILY,
                            size: FONT_SIZE_H3,
                            bold: true,
                            color: '404040',
                        },
                    },
                    heading4: {
                        run: {
                            font: FONT_FAMILY,
                            size: FONT_SIZE_H4,
                            bold: true,
                            color: '404040',
                        },
                    },
                },
            },
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top: 1440,    // 1 inch in twips
                            right: 1440,
                            bottom: 1440,
                            left: 1440,
                        },
                    },
                },
                children: children,
            }],
        });

        console.log('[DOCX] Packing document...');
        const buffer = await Packer.toBuffer(doc);
        console.log('[DOCX] Buffer size:', buffer.length);

        // Convert to base64
        const base64 = Buffer.from(buffer).toString('base64');

        return NextResponse.json({
            success: true,
            docx: base64,
            filename: `${filename || 'document'}.docx`,
        });
    } catch (error) {
        console.error('[DOCX] Export error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error('[DOCX] Stack:', errorStack);

        return NextResponse.json(
            { success: false, message: `Failed to convert to DOCX: ${errorMessage}` },
            { status: 500 }
        );
    }
}
