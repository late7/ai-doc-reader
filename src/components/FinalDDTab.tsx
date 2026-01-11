'use client';

import { useState, useEffect } from 'react';

interface FinalDDTabProps {
    workspaceSlug: string;
    onStatusChange: (status: 'not_started' | 'in_progress' | 'completed') => void;
}

interface LeafSection {
    update_rule?: string;
    instruction?: string;
    extracted?: string | string[] | null;
    evidence?: Array<{
        source_file: string;
        source_location: string;
        quote: string;
    }>;
}

interface MasterDocument {
    [key: string]: LeafSection | MasterDocument;
}

// Convert key like "2_company_overview" to "2. Company Overview"
function formatSectionTitle(key: string): string {
    // Check if starts with number pattern like "1_", "2_", etc.
    const match = key.match(/^(\d+)_(.+)$/);
    if (match) {
        const number = match[1];
        const rest = match[2];
        const formatted = rest
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        return `${number}. ${formatted}`;
    }

    // Check for subsection pattern like "2_1_company_description"
    const subMatch = key.match(/^(\d+)_(\d+)_(.+)$/);
    if (subMatch) {
        const section = subMatch[1];
        const subsection = subMatch[2];
        const rest = subMatch[3];
        const formatted = rest
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        return `${section}.${subsection} ${formatted}`;
    }

    // Default: just replace underscores with spaces and capitalize
    return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Check if a node is a leaf section (has update_rule and instruction)
function isLeafSection(node: unknown): node is LeafSection {
    return (
        typeof node === 'object' &&
        node !== null &&
        'update_rule' in node &&
        'instruction' in node
    );
}

// Extract text content from a leaf section
function getExtractedContent(leaf: LeafSection): string {
    if (leaf.extracted === null || leaf.extracted === undefined) {
        return '';
    }
    if (Array.isArray(leaf.extracted)) {
        return leaf.extracted.filter(item => item && item.trim()).join('\n\n');
    }
    return String(leaf.extracted);
}

// Check if section has meaningful content
function hasContent(leaf: LeafSection): boolean {
    const content = getExtractedContent(leaf);
    return content.trim().length > 0;
}

export default function FinalDDTab({ workspaceSlug, onStatusChange }: FinalDDTabProps) {
    const [masterDoc, setMasterDoc] = useState<MasterDocument | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [showSources, setShowSources] = useState(false);

    useEffect(() => {
        loadMasterDocument();
    }, [workspaceSlug]);

    const loadMasterDocument = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/dd-process/master-doc?workspace=${workspaceSlug}`);
            if (response.ok) {
                const data = await response.json();
                if (data.document) {
                    setMasterDoc(data.document);
                    onStatusChange('completed');
                } else {
                    setMasterDoc(null);
                    onStatusChange('not_started');
                }
            }
        } catch (error) {
            console.error('Error loading master document:', error);
            onStatusChange('not_started');
        } finally {
            setIsLoading(false);
        }
    };

    // Render the document recursively
    const renderSection = (node: MasterDocument | LeafSection, key: string, level: number): React.ReactNode => {
        if (isLeafSection(node)) {
            // Skip locked sections or sections without content
            if (node.update_rule === 'locked' || !hasContent(node)) {
                return null;
            }

            const content = getExtractedContent(node);
            const HeadingTag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
            const headingClasses = {
                h2: 'text-xl font-bold text-gray-900 mt-6 mb-3 border-b border-gray-200 pb-2',
                h3: 'text-lg font-semibold text-gray-800 mt-4 mb-2',
                h4: 'text-md font-medium text-gray-700 mt-3 mb-1',
            };

            return (
                <div key={key} className="mb-4">
                    <HeadingTag className={headingClasses[HeadingTag]}>
                        {formatSectionTitle(key)}
                    </HeadingTag>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap pl-4">
                        {content}
                    </div>
                    {showSources && node.evidence && node.evidence.length > 0 && (
                        <div className="mt-2 pl-4">
                            <details className="text-xs text-gray-500">
                                <summary className="cursor-pointer hover:text-gray-700">
                                    Sources ({node.evidence.length})
                                </summary>
                                <ul className="mt-1 space-y-1 pl-4">
                                    {node.evidence.map((ev, idx) => (
                                        <li key={idx} className="border-l-2 border-gray-200 pl-2">
                                            <span className="font-medium">{ev.source_file}</span>
                                            <span className="text-gray-400"> ({ev.source_location})</span>
                                            <p className="italic text-gray-600 mt-0.5">"{ev.quote.substring(0, 150)}..."</p>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        </div>
                    )}
                </div>
            );
        }

        // It's a nested section
        const children = Object.entries(node)
            .filter(([k]) => k !== 'update_rule' && k !== 'instruction' && k !== 'extracted' && k !== 'evidence')
            .map(([k, v]) => renderSection(v as MasterDocument | LeafSection, k, level + 1))
            .filter(Boolean);

        if (children.length === 0) {
            return null;
        }

        const HeadingTag = level === 0 ? 'h1' : level === 1 ? 'h2' : 'h3';
        const headingClasses = {
            h1: 'text-2xl font-bold text-gray-900 mt-8 mb-4 border-b-2 border-blue-500 pb-2',
            h2: 'text-xl font-bold text-gray-900 mt-6 mb-3 border-b border-gray-200 pb-2',
            h3: 'text-lg font-semibold text-gray-800 mt-4 mb-2',
        };

        return (
            <div key={key} className={level === 0 ? 'mb-8' : 'mb-4'}>
                <HeadingTag className={headingClasses[HeadingTag]}>
                    {formatSectionTitle(key)}
                </HeadingTag>
                <div className={level > 0 ? 'pl-4' : ''}>
                    {children}
                </div>
            </div>
        );
    };

    // RTF Export
    const markdownToRTF = (text: string): string => {
        let rtf = text;
        // Escape RTF special characters
        rtf = rtf.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
        // Newlines
        rtf = rtf.replace(/\n/g, '\\par\n');
        return rtf;
    };

    const buildRTFContent = (doc: MasterDocument): string => {
        let rtfContent = '{\\rtf1\\ansi\\deff0\n';
        rtfContent += '{\\fonttbl{\\f0 Arial;}{\\f1 Times New Roman;}}\n';
        rtfContent += '{\\colortbl;\\red0\\green0\\blue0;\\red51\\green51\\blue51;\\red100\\green100\\blue100;}\n';
        rtfContent += '\\f0\\fs24\n';

        // Get company name for title
        const companyName = (doc.document_metadata as MasterDocument)?.company_name;
        const companyNameText = companyName && isLeafSection(companyName)
            ? getExtractedContent(companyName) || 'Company'
            : 'Company';

        // Title
        rtfContent += `\\qc\\b\\fs48 Due Diligence Report\\b0\\par\n`;
        rtfContent += `\\qc\\fs32 ${markdownToRTF(companyNameText)}\\par\n`;
        rtfContent += `\\qc\\fs20\\cf3 Generated on ${new Date().toLocaleDateString()}\\cf1\\par\\par\\ql\n`;
        rtfContent += '\\fs24\n';

        // Recursively build content
        const buildSection = (node: MasterDocument | LeafSection, key: string, level: number): string => {
            let content = '';

            if (isLeafSection(node)) {
                if (node.update_rule === 'locked' || !hasContent(node)) {
                    return '';
                }

                const title = formatSectionTitle(key);
                const text = getExtractedContent(node);

                // Subsection heading
                const fontSize = level <= 1 ? 28 : level === 2 ? 26 : 24;
                content += `\\par\\b\\fs${fontSize} ${markdownToRTF(title)}\\b0\\fs24\\par\n`;
                content += markdownToRTF(text) + '\\par\n';

                return content;
            }

            // Nested section
            const children = Object.entries(node)
                .filter(([k]) => k !== 'update_rule' && k !== 'instruction' && k !== 'extracted' && k !== 'evidence')
                .map(([k, v]) => buildSection(v as MasterDocument | LeafSection, k, level + 1))
                .filter(c => c.length > 0);

            if (children.length === 0) {
                return '';
            }

            const title = formatSectionTitle(key);
            const fontSize = level === 0 ? 36 : level === 1 ? 32 : 28;
            content += `\\par\\par\\b\\fs${fontSize} ${markdownToRTF(title)}\\b0\\fs24\\par\n`;
            content += children.join('');

            return content;
        };

        // Process top-level sections
        for (const [key, value] of Object.entries(doc)) {
            const sectionContent = buildSection(value as MasterDocument | LeafSection, key, 0);
            rtfContent += sectionContent;
        }

        rtfContent += '}';
        return rtfContent;
    };

    const exportToRTF = () => {
        if (!masterDoc) return;

        setExporting(true);
        try {
            const rtfContent = buildRTFContent(masterDoc);
            const blob = new Blob([rtfContent], { type: 'application/rtf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Get company name for filename
            const companyName = (masterDoc.document_metadata as MasterDocument)?.company_name;
            const companyNameText = companyName && isLeafSection(companyName)
                ? getExtractedContent(companyName).replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)
                : workspaceSlug;

            const fileName = `DD-Report-${companyNameText}-${new Date().toISOString().split('T')[0]}.rtf`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error exporting to RTF:', error);
            alert('Failed to export document.');
        } finally {
            setExporting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                </div>
            </div>
        );
    }

    if (!masterDoc) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300 m-4">
                <div className="text-center p-8">
                    <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-gray-900">No Final Document Available</h3>
                    <p className="mt-2 text-sm text-gray-500 max-w-sm">
                        Process documents in the "Canonical Document Raw Content" tab first to generate the master document.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 h-full flex flex-col">
            {/* Header with Controls */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">📄 Final Due Diligence Report</h3>
                    <p className="text-sm text-gray-600">
                        Human-readable investor report generated from analyzed documents
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showSources}
                            onChange={(e) => setShowSources(e.target.checked)}
                            className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Show sources
                    </label>
                    <button
                        onClick={loadMasterDocument}
                        className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Refresh document"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    <button
                        onClick={exportToRTF}
                        disabled={exporting}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors shadow-sm"
                    >
                        {exporting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Exporting...
                            </>
                        ) : (
                            <>
                                <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                                </svg>
                                Export RTF
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="max-w-4xl mx-auto p-8">
                    {/* Document Header */}
                    <div className="text-center mb-10 pb-6 border-b-2 border-blue-500">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Due Diligence Report</h1>
                        {masterDoc.document_metadata && (masterDoc.document_metadata as MasterDocument).company_name && (
                            <p className="text-xl text-gray-700">
                                {getExtractedContent((masterDoc.document_metadata as MasterDocument).company_name as LeafSection)}
                            </p>
                        )}
                        <p className="text-sm text-gray-500 mt-2">
                            Generated on {new Date().toLocaleDateString()}
                        </p>
                    </div>

                    {/* Document Sections */}
                    {Object.entries(masterDoc).map(([key, value]) =>
                        renderSection(value as MasterDocument | LeafSection, key, 0)
                    )}
                </div>
            </div>
        </div>
    );
}
