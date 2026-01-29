'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import ChatInterface from '@/components/ChatInterface';
import { usePersistentWorkspace } from '@/lib/usePersistentWorkspace';

interface Workspace {
    id: number;
    name: string;
    slug: string;
    threads?: Array<{ user_id: string | null; slug: string; name: string }>;
    vectorTag?: string | null;
    createdAt?: string;
    lastUpdatedAt?: string;
    openAiPrompt?: string | null;
    similarityThreshold?: number;
    chatMode?: string;
}

export default function ChatPage() {
    const [hasMounted, setHasMounted] = useState(false);
    const [selectedWorkspace, setSelectedWorkspace] = usePersistentWorkspace();

    // Prevent hydration mismatch by waiting for client-side mount
    useEffect(() => {
        setHasMounted(true);
    }, []);

    const handleWorkspaceSelect = (workspace: Workspace) => {
        setSelectedWorkspace(workspace);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <header className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 shadow-lg">
                <div className="max-w-[1920px] mx-auto px-4 py-5 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                                Document Chat
                            </h1>
                            <p className="mt-1 text-slate-400">
                                Chat with your documents using AI-powered RAG
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1920px] mx-auto px-4 py-6 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-160px)]">
                    {/* Left Sidebar - Workspace Selection */}
                    <div className="lg:col-span-1">
                        <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-700/50 p-5 h-full">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-semibold text-slate-200">Workspaces</h2>
                                </div>

                                <Suspense fallback={<div className="h-10 w-full bg-slate-700/50 animate-pulse rounded-lg"></div>}>
                                    <WorkspaceSelector
                                        onWorkspaceSelect={handleWorkspaceSelect}
                                        selectedWorkspace={selectedWorkspace}
                                    />
                                </Suspense>

                                {hasMounted && selectedWorkspace && (
                                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                            <span className="text-sm text-slate-300">Connected to:</span>
                                        </div>
                                        <p className="mt-1 text-sm font-medium text-blue-400">{selectedWorkspace.name}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Content - Chat Interface */}
                    <div className="lg:col-span-4 h-full">
                        {hasMounted && selectedWorkspace ? (
                            <ChatInterface workspaceSlug={selectedWorkspace.slug} workspaceName={selectedWorkspace.name} />
                        ) : (
                            <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-700/50 p-12 text-center h-full flex flex-col items-center justify-center">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                                    <svg
                                        className="relative mx-auto h-20 w-20 text-slate-500"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        aria-hidden="true"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                                        />
                                    </svg>
                                </div>
                                <h2 className="mt-6 text-2xl font-semibold bg-gradient-to-r from-slate-300 to-slate-400 bg-clip-text text-transparent">
                                    Select a workspace to start chatting
                                </h2>
                                <p className="mt-3 text-slate-500 max-w-md mx-auto">
                                    Choose a workspace from the sidebar to begin a conversation with your documents using AI-powered retrieval augmented generation.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
