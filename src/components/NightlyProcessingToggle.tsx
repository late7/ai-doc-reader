'use client';

import { useState, useEffect, useCallback } from 'react';

interface NightlyProcessingToggleProps {
    workspaceSlug: string;
}

export default function NightlyProcessingToggle({ workspaceSlug }: NightlyProcessingToggleProps) {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);

    const loadFlag = useCallback(async () => {
        try {
            const res = await fetch(`/api/workspaces/factsheet-flag?workspace=${encodeURIComponent(workspaceSlug)}`);
            if (res.ok) {
                const data = await res.json();
                setEnabled(data.meta?.factSheetRequired ?? false);
            }
        } catch {
            // ignore — flag may not exist yet
        } finally {
            setLoading(false);
        }
    }, [workspaceSlug]);

    useEffect(() => {
        setLoading(true);
        loadFlag();
    }, [loadFlag]);

    const handleToggle = async () => {
        const newValue = !enabled;

        if (newValue) {
            const confirmed = window.confirm(
                'This will clear all existing Fact Sheet data for this company and queue it for overnight reprocessing using Flex tier (50% cheaper).\n\nContinue?'
            );
            if (!confirmed) return;
        }

        setToggling(true);
        try {
            const res = await fetch('/api/workspaces/factsheet-flag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceSlug,
                    factSheetRequired: newValue,
                    clearData: newValue, // clear data only when enabling
                }),
            });
            if (res.ok) {
                setEnabled(newValue);
                if (newValue) {
                    // Reload page to reflect cleared fact sheet data
                    window.location.reload();
                }
            }
        } catch (err) {
            console.error('Failed to toggle nightly processing:', err);
        } finally {
            setToggling(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 py-2">
                <div className="w-9 h-5 bg-gray-200 rounded-full animate-pulse" />
                <span className="text-xs text-gray-600">Loading...</span>
            </div>
        );
    }

    return (
        <div className="border-t border-gray-200 pt-3">
            <label className="flex items-center gap-2.5 cursor-pointer group">
                <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    disabled={toggling}
                    onClick={handleToggle}
                    className={`
                        relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
                        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                        ${enabled ? 'bg-blue-600' : 'bg-gray-300'}
                        ${toggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                    `}
                >
                    <span
                        className={`
                            pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0
                            transition duration-200 ease-in-out
                            ${enabled ? 'translate-x-4' : 'translate-x-0'}
                        `}
                    />
                </button>
                <div className="select-none">
                    <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                        Nightly reprocessing
                    </span>
                    {enabled && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                            Queued
                        </span>
                    )}
                </div>
            </label>
            <p className="mt-1 text-[11px] text-gray-600 leading-tight ml-[2.875rem]">
                {enabled
                    ? 'Data cleared. Will reprocess overnight at 2 AM using Flex tier.'
                    : 'Queue this company for overnight Fact Sheet processing.'}
            </p>
        </div>
    );
}
