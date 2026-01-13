'use client';

import { useState, useEffect } from 'react';
import CanonicalContentTab from './CanonicalContentTab';
import FinalDDTab from './FinalDDTab';
import MarketAnalysisTab from './MarketAnalysisTab';
import FinanceDataTab from './FinanceDataTab';

interface DDTabsContainerProps {
    workspaceSlug: string;
}

type TabStatus = 'not_started' | 'in_progress' | 'completed';

interface TabConfig {
    id: string;
    title: string;
    description: string;
    color: string;
    statusKey: string;
}

const TABS: TabConfig[] = [
    {
        id: 'canonical',
        title: 'Canonical Document Raw Content',
        description: 'Python script reads automatically all new docs in Storage folder of the workspace',
        color: 'bg-blue-500',
        statusKey: 'canonical',
    },
    {
        id: 'finance',
        title: 'Finance Tab',
        description: 'Upload PDF to extract financial data with AI',
        color: 'bg-green-500',
        statusKey: 'finance',
    },
    {
        id: 'market',
        title: 'Market Analysis Tab',
        description: 'Collects market analysis using Web search and docs',
        color: 'bg-gray-500',
        statusKey: 'market',
    },
    {
        id: 'final',
        title: 'Final DD Document',
        description: 'Generated once other tabs are ready',
        color: 'bg-gray-500',
        statusKey: 'final',
    },
];

function getStatusColor(status: TabStatus): string {
    switch (status) {
        case 'completed':
            return 'bg-green-500';
        case 'in_progress':
            return 'bg-yellow-500';
        default:
            return 'bg-red-500';
    }
}

export default function DDTabsContainer({ workspaceSlug }: DDTabsContainerProps) {
    const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({
        canonical: true, // Tab 1 expanded by default
        finance: false,
        market: false,
        final: false,
    });

    const [tabStatuses, setTabStatuses] = useState<Record<string, TabStatus>>({
        canonical: 'not_started',
        finance: 'not_started',
        market: 'not_started',
        final: 'not_started',
    });

    // Load tab statuses on mount
    useEffect(() => {
        loadTabStatuses();
    }, [workspaceSlug]);

    const loadTabStatuses = async () => {
        try {
            const response = await fetch(`/api/dd-process/tab-status?workspace=${workspaceSlug}`);
            if (response.ok) {
                const data = await response.json();
                setTabStatuses(data.statuses || {
                    canonical: 'not_started',
                    finance: 'not_started',
                    market: 'not_started',
                    final: 'not_started',
                });
            }
        } catch (error) {
            console.error('Error loading tab statuses:', error);
        }
    };

    const updateTabStatus = async (tabKey: string, status: TabStatus) => {
        try {
            await fetch('/api/dd-process/tab-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspaceSlug,
                    tabKey,
                    status,
                }),
            });
            setTabStatuses(prev => ({ ...prev, [tabKey]: status }));
        } catch (error) {
            console.error('Error updating tab status:', error);
        }
    };

    const toggleTab = (tabId: string) => {
        setExpandedTabs(prev => ({
            ...prev,
            [tabId]: !prev[tabId],
        }));
    };

    const renderTabContent = (tab: TabConfig) => {
        if (tab.id === 'canonical') {
            return (
                <CanonicalContentTab
                    workspaceSlug={workspaceSlug}
                    onStatusChange={(status: 'not_started' | 'in_progress' | 'completed') => updateTabStatus('canonical', status)}
                />
            );
        }

        if (tab.id === 'market') {
            return (
                <MarketAnalysisTab
                    workspaceSlug={workspaceSlug}
                    onStatusChange={(status: 'not_started' | 'in_progress' | 'completed') => updateTabStatus('market', status)}
                />
            );
        }

        if (tab.id === 'finance') {
            return (
                <FinanceDataTab
                    workspaceSlug={workspaceSlug}
                    onStatusChange={(status: 'not_started' | 'in_progress' | 'completed') => updateTabStatus('finance', status)}
                />
            );
        }

        if (tab.id === 'final') {
            return (
                <FinalDDTab
                    workspaceSlug={workspaceSlug}
                    onStatusChange={(status: 'not_started' | 'in_progress' | 'completed') => updateTabStatus('final', status)}
                />
            );
        }

        // Mockup content for other tabs
        return (
            <div className="p-6 text-center text-gray-500">
                <p className="text-lg font-medium mb-2">{tab.title}</p>
                <p className="text-sm">{tab.description}</p>
                <p className="mt-4 text-xs italic">Coming soon...</p>
            </div>
        );
    };

    return (
        <div className="flex gap-4 h-[calc(100vh-180px)]">
            {TABS.map((tab) => (
                <div
                    key={tab.id}
                    className={`
                        flex flex-col rounded-lg shadow-md overflow-hidden transition-all duration-300
                        ${expandedTabs[tab.id] ? 'flex-1 min-w-[300px]' : 'w-16'}
                        ${tab.id === 'canonical' ? 'bg-blue-100' : 'bg-gray-200'}
                    `}
                >
                    {/* Tab Header */}
                    <button
                        onClick={() => toggleTab(tab.id)}
                        className={`
                            relative flex items-center p-4 cursor-pointer
                            ${expandedTabs[tab.id] ? 'justify-between' : 'justify-center flex-col h-full'}
                            ${tab.id === 'canonical' ? 'bg-blue-200 hover:bg-blue-300' : 'bg-gray-300 hover:bg-gray-400'}
                            transition-colors
                        `}
                    >
                        {/* Status Indicator */}
                        <div
                            className={`
                                w-4 h-4 rounded-full border-2 border-white shadow-sm
                                ${getStatusColor(tabStatuses[tab.statusKey])}
                                ${expandedTabs[tab.id] ? '' : 'mb-4'}
                            `}
                        />

                        {expandedTabs[tab.id] ? (
                            <div className="flex-1 ml-3 text-left">
                                <h3 className="font-semibold text-gray-800 text-sm">{tab.title}</h3>
                            </div>
                        ) : (
                            <div className="writing-mode-vertical text-center">
                                <span
                                    className="text-xs font-medium text-gray-700"
                                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                                >
                                    {tab.title}
                                </span>
                            </div>
                        )}

                        {/* Expand/Collapse Arrow */}
                        <svg
                            className={`w-4 h-4 text-gray-600 transition-transform ${expandedTabs[tab.id] ? '' : 'rotate-180'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    {/* Tab Content */}
                    {expandedTabs[tab.id] && (
                        <div className="flex-1 overflow-auto bg-white">
                            {renderTabContent(tab)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
