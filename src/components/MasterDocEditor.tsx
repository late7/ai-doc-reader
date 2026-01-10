'use client';

import { useState } from 'react';

interface MasterDocEditorProps {
    document: Record<string, unknown>;
    onSave: (updates: Record<string, unknown>) => void;
    isSaving: boolean;
}

interface LeafSection {
    instruction?: string;
    update_rule?: string;
    extracted?: unknown;
    evidence?: Array<{ quote: string; source_file: string; source_location: string }>;
}

function isLeafSection(obj: unknown): obj is LeafSection {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'instruction' in obj &&
        'update_rule' in obj
    );
}

function formatSectionTitle(key: string): string {
    return key
        .replace(/_/g, ' ')
        .replace(/^\d+\s*/, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

interface SectionEditorProps {
    sectionKey: string;
    section: LeafSection;
    onUpdate: (value: unknown) => void;
}

function SectionEditor({ sectionKey, section, onUpdate }: SectionEditorProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

    const startEditing = () => {
        const currentValue = section.extracted;
        if (Array.isArray(currentValue)) {
            setEditValue(currentValue.join('\n\n'));
        } else if (typeof currentValue === 'string') {
            setEditValue(currentValue);
        } else {
            setEditValue(JSON.stringify(currentValue, null, 2) || '');
        }
        setIsEditing(true);
    };

    const saveEdit = () => {
        // Determine if original was an array
        const wasArray = Array.isArray(section.extracted);
        let newValue: unknown;

        if (wasArray && editValue.includes('\n\n')) {
            newValue = editValue.split('\n\n').filter(s => s.trim());
        } else if (wasArray) {
            newValue = editValue.split('\n').filter(s => s.trim());
        } else {
            newValue = editValue;
        }

        onUpdate(newValue);
        setIsEditing(false);
    };

    const cancelEdit = () => {
        setIsEditing(false);
    };

    const renderExtractedValue = () => {
        const value = section.extracted;
        if (value === null || value === undefined) {
            return <span className="text-gray-400 italic">No data extracted</span>;
        }
        if (Array.isArray(value)) {
            return (
                <ul className="list-disc list-inside space-y-1">
                    {value.map((item, idx) => (
                        <li key={idx} className="text-gray-700 text-sm">{String(item)}</li>
                    ))}
                </ul>
            );
        }
        return <p className="text-gray-700 text-sm whitespace-pre-wrap">{String(value)}</p>;
    };

    return (
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-800 text-sm">
                    {formatSectionTitle(sectionKey)}
                </h4>
                {!isEditing && section.update_rule !== 'locked' && (
                    <button
                        onClick={startEditing}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                    >
                        Edit
                    </button>
                )}
            </div>

            {/* Instruction (read-only) */}
            {section.instruction && (
                <p className="text-xs text-gray-500 mb-2 italic">{section.instruction}</p>
            )}

            {/* Extracted Value */}
            <div className="mb-2">
                {isEditing ? (
                    <div className="space-y-2">
                        <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={5}
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={saveEdit}
                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                                Save
                            </button>
                            <button
                                onClick={cancelEdit}
                                className="px-3 py-1 text-gray-600 text-xs hover:text-gray-800"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    renderExtractedValue()
                )}
            </div>

            {/* Evidence (read-only) */}
            {section.evidence && section.evidence.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-1">Evidence:</p>
                    <div className="space-y-1">
                        {section.evidence.slice(0, 3).map((ev, idx) => (
                            <p key={idx} className="text-xs text-gray-500 bg-gray-50 p-1 rounded">
                                <span className="italic">"{ev.quote.substring(0, 100)}..."</span>
                                <br />
                                <span className="text-gray-400">— {ev.source_file}, {ev.source_location}</span>
                            </p>
                        ))}
                        {section.evidence.length > 3 && (
                            <p className="text-xs text-gray-400">+{section.evidence.length - 3} more sources</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function MasterDocEditor({ document, onSave, isSaving }: MasterDocEditorProps) {
    const [pendingUpdates, setPendingUpdates] = useState<Record<string, unknown>>({});
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    const handleSectionUpdate = (pointer: string, value: unknown) => {
        setPendingUpdates(prev => ({ ...prev, [pointer]: value }));
    };

    const saveAllChanges = () => {
        if (Object.keys(pendingUpdates).length > 0) {
            onSave(pendingUpdates);
            setPendingUpdates({});
        }
    };

    const toggleSection = (sectionKey: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey],
        }));
    };

    const renderSection = (key: string, value: unknown, path: string = '') => {
        const currentPath = path ? `${path}/${key}` : `/${key}`;

        if (isLeafSection(value)) {
            return (
                <SectionEditor
                    key={currentPath}
                    sectionKey={key}
                    section={value}
                    onUpdate={(newValue) => handleSectionUpdate(currentPath, newValue)}
                />
            );
        }

        if (typeof value === 'object' && value !== null) {
            const isExpanded = expandedSections[currentPath] !== false; // Default expanded

            return (
                <div key={currentPath} className="border border-gray-300 rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleSection(currentPath)}
                        className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 flex items-center justify-between transition-colors"
                    >
                        <h3 className="font-semibold text-gray-800">{formatSectionTitle(key)}</h3>
                        <svg
                            className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {isExpanded && (
                        <div className="p-3 space-y-3 bg-gray-50">
                            {Object.entries(value as Record<string, unknown>).map(([k, v]) =>
                                renderSection(k, v, currentPath)
                            )}
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };

    const hasPendingChanges = Object.keys(pendingUpdates).length > 0;

    return (
        <div className="space-y-4">
            {/* Save Button */}
            {hasPendingChanges && (
                <div className="sticky top-0 z-10 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm text-yellow-800">
                        You have unsaved changes ({Object.keys(pendingUpdates).length} fields)
                    </span>
                    <button
                        onClick={saveAllChanges}
                        disabled={isSaving}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 disabled:bg-gray-400"
                    >
                        {isSaving ? 'Saving...' : 'Save All Changes'}
                    </button>
                </div>
            )}

            {/* Document Sections */}
            <div className="space-y-3">
                {Object.entries(document).map(([key, value]) => renderSection(key, value))}
            </div>
        </div>
    );
}
