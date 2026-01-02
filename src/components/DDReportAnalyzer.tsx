'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface ReportSection {
    id: string;
    title: string;
    prompt: string;
}

interface DDReportConfig {
    sections: ReportSection[];
}

interface DDReportAnalyzerProps {
    workspaceSlug: string;
}

export default function DDReportAnalyzer({ workspaceSlug }: DDReportAnalyzerProps) {
    // Configuration State
    const [sections, setSections] = useState<ReportSection[]>([]);
    const [isConfigExpanded, setIsConfigExpanded] = useState(false);
    const [configLoading, setConfigLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Editing State
    const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState({ title: '', prompt: '' });
    const [newSection, setNewSection] = useState({ title: '', prompt: '' });

    // Analysis State
    const [results, setResults] = useState<Record<string, string>>({});
    const [sectionLoading, setSectionLoading] = useState<Record<string, boolean>>({});
    const [globalLoading, setGlobalLoading] = useState(false);

    // Export State
    const [exporting, setExporting] = useState(false);

    // Load config on mount
    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const response = await fetch('/api/dd-report');
            if (response.ok) {
                const config: DDReportConfig = await response.json();
                setSections(config.sections || []);
            }
        } catch (error) {
            console.error('Error loading dd-report config:', error);
            setSections([]); // Ensure it's empty on error
        } finally {
            setConfigLoading(false);
        }
    };

    const saveConfig = async (updatedSections: ReportSection[]) => {
        setSaving(true);
        try {
            const response = await fetch('/api/dd-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections: updatedSections }),
            });

            if (response.ok) {
                setSections(updatedSections);
            } else {
                console.error('Failed to save configuration');
            }
        } catch (error) {
            console.error('Error saving configuration:', error);
        } finally {
            setSaving(false);
        }
    };

    // Helper to generate IDs
    const generateId = (title: string): string => {
        return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `section-${Date.now()}`;
    };

    // CRUD Operations
    const addSection = () => {
        if (!newSection.title.trim() || !newSection.prompt.trim()) return;

        const newSec: ReportSection = {
            id: generateId(newSection.title),
            title: newSection.title.trim(),
            prompt: newSection.prompt.trim(),
        };

        const updated = [...sections, newSec];
        saveConfig(updated);
        setNewSection({ title: '', prompt: '' });
    };

    const deleteSection = (id: string) => {
        const updated = sections.filter(s => s.id !== id);
        saveConfig(updated);
    };

    const startEditing = (section: ReportSection) => {
        setEditingSectionId(section.id);
        setEditValues({ title: section.title, prompt: section.prompt });
    };

    const cancelEditing = () => {
        setEditingSectionId(null);
        setEditValues({ title: '', prompt: '' });
    };

    const saveEditing = (id: string) => {
        if (!editValues.title.trim() || !editValues.prompt.trim()) return;

        const updated = sections.map(s =>
            s.id === id ? { ...s, title: editValues.title.trim(), prompt: editValues.prompt.trim() } : s
        );
        saveConfig(updated);
        setEditingSectionId(null);
    };

    // Analysis Operations
    const runSection = async (section: ReportSection) => {
        setSectionLoading(prev => ({ ...prev, [section.id]: true }));

        try {
            const response = await fetch('/api/dd-report/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, prompt: section.prompt }),
            });

            if (response.ok) {
                const data = await response.json();
                setResults(prev => ({ ...prev, [section.id]: data.result }));
            } else {
                console.error(`Failed to run section: ${section.title}`);
                setResults(prev => ({ ...prev, [section.id]: 'Error running analysis.' }));
            }
        } catch (error) {
            console.error(`Error running section ${section.title}:`, error);
            setResults(prev => ({ ...prev, [section.id]: 'Error running analysis.' }));
        } finally {
            setSectionLoading(prev => ({ ...prev, [section.id]: false }));
        }
    };

    const runAll = async () => {
        setGlobalLoading(true);
        for (const section of sections) {
            await runSection(section);
        }
        setGlobalLoading(false);
    };

    // RTF Export Helpers
    const markdownToRTF = (text: string): string => {
        let rtf = text;

        // Escape backslashes and braces
        rtf = rtf.replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');

        // Newlines
        rtf = rtf.replace(/\n/g, '\\par\n');

        // Bold (**text**)
        rtf = rtf.replace(/\*\*(.*?)\*\*/g, '\\b $1\\b0 ');

        // Headers (### Title) - Make them bold and slightly larger
        rtf = rtf.replace(/^#{1,6}\s+(.*)$/gm, '\\par\\b\\fs32 $1\\b0\\fs24\\par');

        // Lists (- item)
        rtf = rtf.replace(/^\s*-\s+(.*)$/gm, '\\par\\bullet $1');

        return rtf;
    };

    const exportToRTF = () => {
        setExporting(true);
        try {
            let rtfContent = '{\\rtf1\\ansi\\deff0\n';

            // Fonts
            rtfContent += '{\\fonttbl{\\f0 Arial;}}\n';
            rtfContent += '\\f0\\fs24\n'; // Set font to Arial, size 12 (24 half-points)

            // Title
            rtfContent += `\\qc\\b\\fs48 Due Diligence Report\\b0\\fs24\\par\n`;
            rtfContent += `\\qc Generated on ${new Date().toLocaleDateString()}\\par\\par\\ql\n`;

            sections.forEach(section => {
                // Section Title
                rtfContent += `\\par\\par\\b\\fs36 ${section.title}\\b0\\fs24\\par\n`;
                rtfContent += '\\par\n';

                // Content
                let content = results[section.id] || 'No analysis run for this section.';

                // Remove duplicate header if present in markdown (e.g. # Title)
                // We create a regex to match the title at the start of the content, allowing for markdown header syntax
                try {
                    const escapedTitle = section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
                    const titleRegex = new RegExp(`^#{1,6}\\s*${escapedTitle}\\s*(\\n|$)`, 'im');
                    content = content.replace(titleRegex, '');
                } catch (e) {
                    console.warn('Failed to strip duplicate header for regex:', e);
                }

                rtfContent += markdownToRTF(content.trim());
                rtfContent += '\\par\n';
            });

            rtfContent += '}';

            const blob = new Blob([rtfContent], { type: 'application/rtf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = `due-diligence-report-${workspaceSlug}-${new Date().toISOString().split('T')[0]}.rtf`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('Error exporting to RTF:', error);
            alert('Failed to export RTF document.');
        } finally {
            setExporting(false);
        }
    };

    if (configLoading) {
        return (
            <div className="animate-pulse p-4">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-32 bg-gray-200 rounded mb-4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
            </div>
        );
    }

    // Check if we have any results to show/export
    const hasResults = Object.keys(results).length > 0;

    return (
        <div className="space-y-6">

            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Due Diligence Report</h2>
                    <p className="text-gray-600">Generate comprehensive due diligence reports based on workspace documents.</p>
                </div>
                <div className="flex space-x-3">
                    {hasResults && (
                        <button
                            onClick={exportToRTF}
                            disabled={exporting}
                            className="flex items-center px-4 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                        >
                            {exporting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <svg className="mr-2 h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                                    </svg>
                                    Export RTF
                                </>
                            )}
                        </button>
                    )}
                    <button
                        onClick={runAll}
                        disabled={globalLoading || sections.length === 0}
                        className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                        {globalLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Running All...
                            </>
                        ) : (
                            <>
                                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Run All
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Configuration Accordion */}
            <div className="bg-white rounded-lg shadow-sm border">
                <button
                    onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                            ⚙️ Report Configuration
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                            Customize report sections and AI prompts
                        </p>
                    </div>
                    <svg
                        className={`w-5 h-5 text-gray-500 transition-transform ${isConfigExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isConfigExpanded && (
                    <div className="px-6 pb-6 border-t border-gray-200">
                        <div className="space-y-4 my-6">
                            {sections.map((section) => (
                                <div key={section.id} className="border border-gray-200 rounded-lg p-4">
                                    {editingSectionId === section.id ? (
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={editValues.title}
                                                onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                placeholder="Section Title"
                                            />
                                            <textarea
                                                value={editValues.prompt}
                                                onChange={(e) => setEditValues({ ...editValues, prompt: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                rows={3}
                                                placeholder="AI Prompt"
                                            />
                                            <div className="flex space-x-2">
                                                <button onClick={cancelEditing} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                                                <button onClick={() => saveEditing(section.id)} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="text-md font-medium text-gray-900">{section.title}</h4>
                                                <div className="flex space-x-2">
                                                    <button onClick={() => startEditing(section)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">Edit</button>
                                                    <button onClick={() => deleteSection(section.id)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">Delete</button>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">{section.prompt}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add New Section */}
                        <div className="border-t border-gray-200 pt-4">
                            <h4 className="text-md font-medium text-gray-900 mb-3">Add New Section</h4>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={newSection.title}
                                    onChange={(e) => setNewSection({ ...newSection, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Section Title (e.g., Market Analysis)"
                                />
                                <textarea
                                    value={newSection.prompt}
                                    onChange={(e) => setNewSection({ ...newSection, prompt: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    rows={2}
                                    placeholder="Prompt (e.g., Analyze the market trends mentioned in the documents...)"
                                />
                                <button
                                    onClick={addSection}
                                    disabled={!newSection.title.trim() || !newSection.prompt.trim() || saving}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                                >
                                    {saving ? 'Saving...' : 'Add Section'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Report Sections */}
            <div className="space-y-6">
                {sections.map((section) => (
                    <div key={section.id} className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-800">{section.title}</h3>
                            <button
                                onClick={() => runSection(section)}
                                disabled={sectionLoading[section.id] || globalLoading}
                                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm transition-colors"
                            >
                                {sectionLoading[section.id] ? (
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <>
                                        <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Run Analysis
                                    </>
                                )}
                            </button>
                        </div>

                        {results[section.id] ? (
                            <div className="prose prose-sm sm:prose max-w-none text-gray-700">
                                <ReactMarkdown>{results[section.id]}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 text-sm flex items-center justify-center italic">
                                Run analysis to see results...
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
