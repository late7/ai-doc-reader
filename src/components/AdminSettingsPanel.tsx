'use client';

import { useState, useEffect } from 'react';

interface Question {
    id: string;
    question: string;
    category: string;
}

interface Category {
    id: string;
    title: string;
    prompt: string;
    categoryName: string;
}

interface QuestionsConfig {
    questions: Question[];
}

interface GlobalPromptsConfig {
    prompts: {
        companySummary: string;
    };
}

interface FormattingPromptConfig {
    prompt: string;
}

interface CategoriesConfig {
    categories: Category[];
}

interface AdminSettingsPanelProps {
    onFinanceToggle?: (enabled: boolean) => void;
}

export default function AdminSettingsPanel({ onFinanceToggle }: AdminSettingsPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [config, setConfig] = useState<QuestionsConfig | null>(null);
    const [categoriesConfig, setCategoriesConfig] = useState<CategoriesConfig | null>(null);
    const [globalPrompts, setGlobalPrompts] = useState<GlobalPromptsConfig | null>(null);
    const [formattingPromptConfig, setFormattingPromptConfig] = useState<FormattingPromptConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [globalSaving, setGlobalSaving] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [newQuestion, setNewQuestion] = useState<Partial<Question>>({});
    const [newCategory, setNewCategory] = useState<Partial<Category>>({});
    const [creatingNewCategory, setCreatingNewCategory] = useState(false);
    const [financeEnabled, setFinanceEnabled] = useState(true);
    const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
    const [showGlobalPrompts, setShowGlobalPrompts] = useState(false);
    const [showNewQuestion, setShowNewQuestion] = useState(false);
    const [activeSection, setActiveSection] = useState<'prompts' | 'categories' | 'questions'>('categories');

    // Load configs when expanded
    useEffect(() => {
        if (isExpanded && !config) {
            fetchConfigs();
        }
    }, [isExpanded]);

    useEffect(() => {
        if (selectedCategoryName) {
            setNewQuestion(prev => ({ ...prev, category: selectedCategoryName }));
        }
    }, [selectedCategoryName]);

    // Load finance setting
    useEffect(() => {
        const loadSystemConfig = async () => {
            try {
                const response = await fetch('/api/system');
                if (response.ok) {
                    const cfg = await response.json();
                    setFinanceEnabled(cfg.financeEnabled ?? true);
                }
            } catch (error) {
                console.error('Failed to load system config:', error);
                setFinanceEnabled(true);
            }
        };
        loadSystemConfig();
    }, []);

    const fetchConfigs = async () => {
        try {
            setLoading(true);
            const [questionsResponse, categoriesResponse, globalPromptsResponse, formattingPromptResponse] = await Promise.all([
                fetch('/api/questions'),
                fetch('/api/categories'),
                fetch('/api/global-prompts'),
                fetch('/api/formatting-prompt')
            ]);

            if (!questionsResponse.ok || !categoriesResponse.ok || !globalPromptsResponse.ok || !formattingPromptResponse.ok) {
                throw new Error('Failed to load configurations');
            }

            const questionsData = await questionsResponse.json();
            const categoriesData = await categoriesResponse.json();
            const globalPromptsData = await globalPromptsResponse.json();
            const formattingPromptData = await formattingPromptResponse.json();

            setConfig(questionsData);
            setCategoriesConfig(categoriesData);
            setGlobalPrompts(globalPromptsData);
            setFormattingPromptConfig(formattingPromptData);

            if (!selectedCategoryName && categoriesData?.categories?.length) {
                const firstCat = categoriesData.categories[0];
                setSelectedCategoryName(firstCat.categoryName);
                setEditingCategory(firstCat);
            }
        } catch (error) {
            console.error('Error fetching configs:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveConfigs = async (overrides?: { q?: QuestionsConfig; c?: CategoriesConfig; g?: GlobalPromptsConfig; silent?: boolean }) => {
        const qConf = overrides?.q || config;
        const cConf = overrides?.c || categoriesConfig;
        const gConf = overrides?.g || globalPrompts;
        if (!qConf || !cConf || !gConf) return;
        setSaving(true);
        try {
            const [questionsResponse, categoriesResponse, globalPromptsResp] = await Promise.all([
                fetch('/api/questions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: qConf.questions }) }),
                fetch('/api/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cConf) }),
                fetch('/api/global-prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gConf) })
            ]);
            if (!questionsResponse.ok || !categoriesResponse.ok || !globalPromptsResp.ok) {
                throw new Error('One or more saves failed');
            }
        } catch (e) {
            console.error('Save failed', e);
            if (!overrides?.silent) alert('Failed saving configuration');
        } finally {
            setSaving(false);
        }
    };

    const saveGlobalPrompts = async () => {
        if (!globalPrompts) return;
        setGlobalSaving(true);
        try {
            const resp = await fetch('/api/global-prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(globalPrompts) });
            if (!resp.ok) throw new Error('Failed global prompts save');
        } catch {
            alert('Failed to save global prompt');
        } finally {
            setGlobalSaving(false);
        }
    };

    const handleFinanceToggle = async (enabled: boolean) => {
        setFinanceEnabled(enabled);
        try {
            await fetch('/api/system', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ financeEnabled: enabled })
            });
            onFinanceToggle?.(enabled);
        } catch (error) {
            console.error('Error saving finance setting:', error);
        }
    };

    const addQuestion = async () => {
        const questionText = newQuestion.question?.trim();
        if (!config || !questionText || !selectedCategoryName) return;

        const question: Question = {
            id: `q${Date.now()}`,
            question: questionText,
            category: selectedCategoryName,
        };
        const updatedConfig = { ...config, questions: [...config.questions, question] };
        setConfig(updatedConfig);
        setNewQuestion({ category: selectedCategoryName });
        await saveConfigs({ q: updatedConfig, silent: true });
    };

    const deleteQuestion = async (questionId: string) => {
        if (!config) return;
        const updated = { ...config, questions: config.questions.filter(q => q.id !== questionId) };
        setConfig(updated);
        await saveConfigs({ q: updated, silent: true });
    };

    const updateQuestion = async (questionId: string, newText: string) => {
        if (!config) return;
        const trimmedText = newText.trim();
        if (!trimmedText) return;

        const updated = {
            ...config,
            questions: config.questions.map(q =>
                q.id === questionId ? { ...q, question: trimmedText } : q
            )
        };
        setConfig(updated);
        setEditingQuestion(null);
        await saveConfigs({ q: updated, silent: true });
    };

    const addCategory = async () => {
        if (!categoriesConfig) return;
        const name = newCategory.categoryName?.trim();
        const title = newCategory.title?.trim();
        const prompt = newCategory.prompt?.trim();
        if (!name || !title || !prompt) return;

        const duplicate = categoriesConfig.categories.some(c => c.categoryName.toLowerCase() === name.toLowerCase());
        if (duplicate) {
            alert('Category key already exists.');
            return;
        }

        const category: Category = {
            id: `c${Date.now()}`,
            title,
            prompt,
            categoryName: name,
        };
        const updatedCats = { ...categoriesConfig, categories: [...categoriesConfig.categories, category] };
        setCategoriesConfig(updatedCats);
        setCreatingNewCategory(false);
        setSelectedCategoryName(name);
        setEditingCategory(category);
        setNewCategory({});
        await saveConfigs({ c: updatedCats, silent: true });
    };

    const deleteCategory = async (categoryId: string) => {
        if (!categoriesConfig) return;
        const toDelete = categoriesConfig.categories.find(c => c.id === categoryId);
        if (!toDelete) return;

        const remaining = categoriesConfig.categories.filter(c => c.id !== categoryId);
        const updatedCats = { ...categoriesConfig, categories: remaining };
        setCategoriesConfig(updatedCats);

        if (config) {
            const filteredQs = config.questions.filter(q => q.category !== toDelete.categoryName);
            if (filteredQs.length !== config.questions.length) {
                const updatedConfig = { ...config, questions: filteredQs };
                setConfig(updatedConfig);
                await saveConfigs({ c: updatedCats, q: updatedConfig, silent: true });
            } else {
                await saveConfigs({ c: updatedCats, q: config, silent: true });
            }
        }

        if (selectedCategoryName === toDelete.categoryName) {
            if (remaining.length) {
                const first = remaining[0];
                setSelectedCategoryName(first.categoryName);
                setEditingCategory(first);
            } else {
                setSelectedCategoryName(null);
                setEditingCategory(null);
            }
        }
    };

    const updatePrompts = (updates: Partial<GlobalPromptsConfig['prompts']>) => {
        if (!globalPrompts) return;
        setGlobalPrompts({ prompts: { ...globalPrompts.prompts, ...updates } });
    };

    const filteredQuestions = config?.questions.filter(q => !selectedCategoryName || q.category === selectedCategoryName) || [];

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {/* Collapsible Header */}
            <div
                role="button"
                tabIndex={0}
                onClick={() => setIsExpanded(!isExpanded)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsExpanded(!isExpanded);
                    }
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer"
            >
                <div className="flex items-center space-x-3">
                    <span className="text-lg">⚙️</span>
                    <div>
                        <span className="font-semibold text-gray-900">Analysis Dashboard Settings</span>
                        <p className="text-xs text-gray-500">Configure questions, categories, and prompts</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    {/* Finance Toggle */}
                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs text-gray-600">Finance</span>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleFinanceToggle(!financeEnabled); }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${financeEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${financeEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    <svg
                        className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-gray-200 px-4 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : !config || !categoriesConfig || !globalPrompts || !formattingPromptConfig ? (
                        <div className="text-center py-6 text-gray-500">
                            <p>Failed to load configuration.</p>
                            <button onClick={fetchConfigs} className="mt-2 text-blue-600 hover:underline text-sm">Retry</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Section Tabs */}
                            <div className="flex space-x-2 border-b border-gray-200 pb-2">
                                {(['prompts', 'categories', 'questions'] as const).map((section) => (
                                    <button
                                        key={section}
                                        onClick={() => setActiveSection(section)}
                                        className={`px-3 py-1.5 text-sm rounded-t-lg transition-colors ${activeSection === section
                                            ? 'bg-blue-100 text-blue-700 font-medium'
                                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                                            }`}
                                    >
                                        {section === 'prompts' ? '📝 Global Prompts' : section === 'categories' ? '📁 Categories' : '❓ Questions'}
                                    </button>
                                ))}
                            </div>

                            {/* Global Prompts Section */}
                            {activeSection === 'prompts' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Summary Prompt</label>
                                        <textarea
                                            value={globalPrompts.prompts.companySummary}
                                            onChange={(e) => updatePrompts({ companySummary: e.target.value })}
                                            className="w-full p-3 border rounded-lg text-gray-700 text-sm"
                                            rows={3}
                                        />
                                        <div className="flex justify-end mt-2">
                                            <button
                                                onClick={saveGlobalPrompts}
                                                disabled={globalSaving}
                                                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {globalSaving ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Formatting Prompt</label>
                                        <textarea
                                            value={formattingPromptConfig.prompt}
                                            onChange={(e) => setFormattingPromptConfig({ prompt: e.target.value })}
                                            className="w-full p-3 border rounded-lg text-gray-700 text-sm"
                                            rows={2}
                                        />
                                        <div className="flex justify-end mt-2">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await fetch('/api/formatting-prompt', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: formattingPromptConfig.prompt }) });
                                                    } catch {
                                                        alert('Failed to save');
                                                    }
                                                }}
                                                className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Categories Section */}
                            {activeSection === 'categories' && (
                                <div className="space-y-4">
                                    {/* Category Tabs */}
                                    <div className="flex flex-wrap gap-2">
                                        {categoriesConfig.categories.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => { setSelectedCategoryName(cat.categoryName); setEditingCategory(cat); setCreatingNewCategory(false); }}
                                                className={`px-3 py-1 rounded-full text-xs border transition-colors ${selectedCategoryName === cat.categoryName ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                    }`}
                                            >
                                                {cat.categoryName}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => { setCreatingNewCategory(true); setSelectedCategoryName(null); setEditingCategory(null); setNewCategory({}); }}
                                            className={`px-3 py-1 rounded-full text-xs border transition-colors ${creatingNewCategory ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                }`}
                                        >
                                            + New
                                        </button>
                                    </div>

                                    {/* Category Editor */}
                                    {creatingNewCategory ? (
                                        <div className="space-y-3 bg-green-50 p-3 rounded-lg">
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <input
                                                    type="text"
                                                    value={newCategory.categoryName || ''}
                                                    onChange={e => setNewCategory(prev => ({ ...prev, categoryName: e.target.value }))}
                                                    className="w-full p-2 border rounded text-sm text-gray-800"
                                                    placeholder="Category key (e.g. market)"
                                                />
                                                <input
                                                    type="text"
                                                    value={newCategory.title || ''}
                                                    onChange={e => setNewCategory(prev => ({ ...prev, title: e.target.value }))}
                                                    className="w-full p-2 border rounded text-sm text-gray-800"
                                                    placeholder="Display title"
                                                />
                                            </div>
                                            <textarea
                                                value={newCategory.prompt || ''}
                                                onChange={e => setNewCategory(prev => ({ ...prev, prompt: e.target.value }))}
                                                className="w-full p-2 border rounded text-sm text-gray-800"
                                                rows={3}
                                                placeholder="Category prompt..."
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={addCategory} disabled={!newCategory.categoryName?.trim() || !newCategory.title?.trim() || !newCategory.prompt?.trim()} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">Create</button>
                                                <button onClick={() => { setCreatingNewCategory(false); if (categoriesConfig.categories.length) { const f = categoriesConfig.categories[0]; setSelectedCategoryName(f.categoryName); setEditingCategory(f); } }} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
                                            </div>
                                        </div>
                                    ) : editingCategory && selectedCategoryName ? (
                                        <div className="space-y-3 bg-blue-50 p-3 rounded-lg">
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <input
                                                    type="text"
                                                    value={editingCategory.title}
                                                    onChange={e => setEditingCategory(prev => prev ? { ...prev, title: e.target.value } : prev)}
                                                    className="w-full p-2 border rounded text-sm text-gray-800"
                                                    placeholder="Title"
                                                />
                                                <input
                                                    type="text"
                                                    value={editingCategory.categoryName}
                                                    className="w-full p-2 border rounded text-sm text-gray-500 bg-gray-100"
                                                    disabled
                                                />
                                            </div>
                                            <textarea
                                                value={editingCategory.prompt}
                                                onChange={e => setEditingCategory(prev => prev ? { ...prev, prompt: e.target.value } : prev)}
                                                className="w-full p-2 border rounded text-sm text-gray-800"
                                                rows={3}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={async () => {
                                                        if (editingCategory && categoriesConfig) {
                                                            const updatedCats = { ...categoriesConfig, categories: categoriesConfig.categories.map(c => c.id === editingCategory.id ? editingCategory : c) };
                                                            setCategoriesConfig(updatedCats);
                                                            await saveConfigs({ c: updatedCats, silent: true });
                                                        }
                                                    }}
                                                    className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
                                                    disabled={saving}
                                                >
                                                    {saving ? 'Saving...' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={() => { if (confirm(`Delete "${editingCategory.categoryName}"?`)) deleteCategory(editingCategory.id); }}
                                                    className="bg-red-600 text-white px-3 py-1.5 rounded text-sm"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">Select a category to edit.</p>
                                    )}
                                </div>
                            )}

                            {/* Questions Section */}
                            {activeSection === 'questions' && (
                                <div className="space-y-4">
                                    {/* Category Filter */}
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <span className="text-sm text-gray-600">Category:</span>
                                        {categoriesConfig.categories.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => setSelectedCategoryName(cat.categoryName)}
                                                className={`px-2 py-1 rounded text-xs border ${selectedCategoryName === cat.categoryName ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border-gray-300'
                                                    }`}
                                            >
                                                {cat.categoryName}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Add Question */}
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newQuestion.question || ''}
                                                onChange={e => setNewQuestion(prev => ({ ...prev, question: e.target.value }))}
                                                className="flex-1 p-2 border rounded text-sm text-gray-800"
                                                placeholder="New question..."
                                            />
                                            <button
                                                onClick={addQuestion}
                                                disabled={!newQuestion.question?.trim() || !selectedCategoryName}
                                                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Warning about editing questions */}
                                    {editingQuestion && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                                            <svg className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <div>
                                                <p className="text-sm font-medium text-amber-800">Warning: Editing questions may affect results</p>
                                                <p className="text-xs text-amber-700 mt-0.5">Changing a question text makes previously stored analysis results outdated. You may need to re-run the analysis.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Questions List */}
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {filteredQuestions.length > 0 ? filteredQuestions.map(q => (
                                            <div key={q.id} className="p-2 bg-white border rounded text-sm">
                                                {editingQuestion?.id === q.id ? (
                                                    /* Editing Mode */
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            value={editingQuestion.question}
                                                            onChange={e => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                                                            className="w-full p-2 border rounded text-sm text-gray-800"
                                                            autoFocus
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    updateQuestion(q.id, editingQuestion.question);
                                                                } else if (e.key === 'Escape') {
                                                                    setEditingQuestion(null);
                                                                }
                                                            }}
                                                        />
                                                        <div className="flex gap-2 justify-end">
                                                            <button
                                                                onClick={() => setEditingQuestion(null)}
                                                                className="px-2 py-1 text-xs border rounded text-gray-600 hover:bg-gray-100"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={() => updateQuestion(q.id, editingQuestion.question)}
                                                                disabled={!editingQuestion.question.trim()}
                                                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                                            >
                                                                Save
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Display Mode */
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-800">{q.question}</span>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setEditingQuestion({ ...q })}
                                                                className="text-blue-600 hover:text-blue-800 text-xs"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => deleteQuestion(q.id)}
                                                                className="text-red-600 hover:text-red-800 text-xs"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )) : (
                                            <p className="text-gray-500 text-sm text-center py-4">No questions in this category.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
