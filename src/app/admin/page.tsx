'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ApiDebugger from '@/components/ApiDebugger';

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

export default function AdminPage() {
  const [config, setConfig] = useState<QuestionsConfig | null>(null);
  const [categoriesConfig, setCategoriesConfig] = useState<CategoriesConfig | null>(null);
  const [globalPrompts, setGlobalPrompts] = useState<GlobalPromptsConfig | null>(null);
  const [formattingPromptConfig, setFormattingPromptConfig] = useState<FormattingPromptConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newQuestion, setNewQuestion] = useState<Partial<Question>>({});
  const [newCategory, setNewCategory] = useState<Partial<Category>>({});
  const [creatingNewCategory, setCreatingNewCategory] = useState(false);
  const [financeEnabled, setFinanceEnabled] = useState(true);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [showGlobalPrompts, setShowGlobalPrompts] = useState(false); // collapsed by default
  const [showNewQuestion, setShowNewQuestion] = useState(false); // Add Question collapsed by default

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Load finance setting from system config
  useEffect(() => {
    const loadSystemConfig = async () => {
      try {
        const response = await fetch('/api/system');
        if (response.ok) {
          const config = await response.json();
          setFinanceEnabled(config.financeEnabled ?? true);
        }
      } catch (error) {
        console.error('Failed to load system config:', error);
        // Default to true if config can't be loaded
        setFinanceEnabled(true);
      }
    };
    loadSystemConfig();
  }, []);

  // Save finance toggle state to system config
  const saveFinanceSetting = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financeEnabled: enabled })
      });
      if (!response.ok) {
        throw new Error('Failed to save finance setting');
      }
    } catch (error) {
      console.error('Error saving finance setting:', error);
      alert('Failed to save finance setting');
    }
  };

  const handleFinanceToggle = async (enabled: boolean) => {
    setFinanceEnabled(enabled);
    await saveFinanceSetting(enabled);
  };

  // Keep newQuestion.category aligned with currently selected category so the Add Question button can enable
  useEffect(() => {
    if (selectedCategoryName) {
      setNewQuestion(prev => ({ ...prev, category: selectedCategoryName }));
    }
  }, [selectedCategoryName]);

  const fetchConfigs = async () => {
    try {
      console.log('Fetching configurations...');
      setLoading(true);
      const [questionsResponse, categoriesResponse, globalPromptsResponse, formattingPromptResponse] = await Promise.all([
        fetch('/api/questions'),
        fetch('/api/categories'),
        fetch('/api/global-prompts'),
        fetch('/api/formatting-prompt')
      ]);
      
      console.log('Questions response status:', questionsResponse.status);
  console.log('Categories response status:', categoriesResponse.status);
  console.log('Global prompts response status:', globalPromptsResponse.status);
      
      if (!questionsResponse.ok) {
        throw new Error(`Questions API failed: ${questionsResponse.status}`);
      }
      if (!categoriesResponse.ok) {
        throw new Error(`Categories API failed: ${categoriesResponse.status}`);
      }
      if (!globalPromptsResponse.ok) {
        throw new Error(`GlobalPrompts API failed: ${globalPromptsResponse.status}`);
      }
      if (!formattingPromptResponse.ok) {
        throw new Error(`FormattingPrompt API failed: ${formattingPromptResponse.status}`);
      }
      
  const questionsData = await questionsResponse.json();
  const categoriesData = await categoriesResponse.json();
  const globalPromptsData = await globalPromptsResponse.json();
  const formattingPromptData = await formattingPromptResponse.json();
      
      console.log('Questions data:', questionsData);
      console.log('Categories data:', categoriesData);
  console.log('Questions array:', questionsData.questions);
  console.log('Categories array:', categoriesData.categories);
  console.log('Global prompts object:', globalPromptsData.prompts);
      
  setConfig(questionsData);
  setCategoriesConfig(categoriesData);
  setGlobalPrompts(globalPromptsData);
  setFormattingPromptConfig(formattingPromptData);
      // Initialize selected category if not already chosen
      if (!selectedCategoryName && categoriesData?.categories?.length) {
        const firstCat = categoriesData.categories[0];
        setSelectedCategoryName(firstCat.categoryName);
        setEditingCategory(firstCat);
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to load configuration: ${errorMessage}`);
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
      console.log('Saving configurations...');
      const [questionsResponse, categoriesResponse, globalPromptsResp] = await Promise.all([
        fetch('/api/questions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: qConf.questions }) }),
        fetch('/api/categories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cConf) }),
        fetch('/api/global-prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gConf) })
      ]);
      if (!questionsResponse.ok || !categoriesResponse.ok || !globalPromptsResp.ok) {
        throw new Error('One or more saves failed');
      }
      if (!overrides?.silent) {
        console.log('All configurations saved');
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
    } catch (e) {
      alert('Failed to save global prompt');
    } finally {
      setGlobalSaving(false);
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

  const addCategory = async () => {
    if (!categoriesConfig) return;
    const name = newCategory.categoryName?.trim();
    const title = newCategory.title?.trim();
    const prompt = newCategory.prompt?.trim();
    if (!name || !title || !prompt) return;
    const duplicate = categoriesConfig.categories.some(c => c.categoryName.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      alert('Category key already exists. Choose a unique categoryName.');
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

  const updateQuestion = (questionId: string, updates: Partial<Question>) => {
    if (!config) return;

    setConfig({
      ...config,
      questions: config.questions.map(q => 
        q.id === questionId ? { ...q, ...updates } : q
      ),
    });
  };

  const deleteQuestion = async (questionId: string) => {
    if (!config) return;
    const updated = { ...config, questions: config.questions.filter(q => q.id !== questionId) };
    setConfig(updated);
    await saveConfigs({ q: updated, silent: true });
  };

  const updateCategory = (categoryId: string, updates: Partial<Category>) => {
    if (!categoriesConfig) return;

    setCategoriesConfig({
      ...categoriesConfig,
      categories: categoriesConfig.categories.map(c => 
        c.id === categoryId ? { ...c, ...updates } : c
      ),
    });
  };

  const deleteCategory = async (categoryId: string) => {
    if (!categoriesConfig) return;
    const toDelete = categoriesConfig.categories.find(c => c.id === categoryId);
    if (!toDelete) return;

    // Remove category
    const remaining = categoriesConfig.categories.filter(c => c.id !== categoryId);
    const updatedCats = { ...categoriesConfig, categories: remaining };
    setCategoriesConfig(updatedCats);

    // Remove orphaned questions for the category
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

    // Adjust selection/editing context
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!config || !categoriesConfig || !globalPrompts || !formattingPromptConfig) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">Failed to load configuration</div>
          <div className="text-sm text-gray-600">
            Config loaded: {config ? 'Yes' : 'No'} | Categories loaded: {categoriesConfig ? 'Yes' : 'No'}
          </div>
          <button 
            onClick={fetchConfigs}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const categories = categoriesConfig.categories.map(c => c.categoryName);
  const selectedCategory = selectedCategoryName
    ? categoriesConfig.categories.find(c => c.categoryName === selectedCategoryName) || null
    : null;
  const filteredQuestions = config.questions.filter(q => !selectedCategoryName || q.category === selectedCategoryName);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Admin Panel - Questions Configuration
              </h1>
              <p className="text-gray-800">
                Manage analysis questions and prompts for the Analysis dashboard
              </p>

            </div>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <label htmlFor="finance-toggle" className="text-sm font-medium text-gray-700">
                  Finance
                </label>
                <button
                  id="finance-toggle"
                  onClick={() => handleFinanceToggle(!financeEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    financeEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      financeEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {financeEnabled && (
                <Link 
                  href="/finance"
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors"
                >
                  💰 Finance
                </Link>
              )}
              <Link 
                href="/dashboard"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
              >
                📊 Analysis
              </Link>
            </div>
          </div>
        </div>
      </header>
      
      <div className="max-w-6xl mx-auto px-4 py-8">
  {/* Stacked Layout (was three columns) */}
  <div className="flex flex-col space-y-8">
          
          {/* Global Prompts Configuration (collapsible) */}
          <div className="bg-white rounded-lg shadow">
            <button
              type="button"
              onClick={() => setShowGlobalPrompts(p => !p)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
              aria-expanded={showGlobalPrompts}
            >
              <span className="text-xl font-bold text-gray-800">Global Prompts</span>
              <span className={`transition-transform transform ${showGlobalPrompts ? 'rotate-90' : ''}`}>▶</span>
            </button>
            {showGlobalPrompts && (
              <div className="px-6 pb-6 space-y-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Summary Prompt
                  </label>
                  <textarea
                    value={globalPrompts.prompts.companySummary}
                    onChange={(e) => updatePrompts({ companySummary: e.target.value })}
                    className="w-full p-3 border rounded-lg  text-gray-700"
                    rows={4}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveGlobalPrompts}
                    disabled={globalSaving}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {globalSaving ? 'Saving...' : 'Save Global Prompt'}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formatting Prompt (affects Questions only)
                  </label>
                  <textarea
                    value={formattingPromptConfig.prompt}
                    onChange={(e) => setFormattingPromptConfig({ prompt: e.target.value })}
                    className="w-full p-3 border rounded-lg  text-gray-700"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={async () => { if (!formattingPromptConfig) return; try { await fetch('/api/formatting-prompt', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: formattingPromptConfig.prompt }) }); } catch { alert('Failed to save formatting prompt'); } }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    Save Formatting Prompt
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Category Tabs & Editable Prompt */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Categories</h2>
            <div className="flex flex-wrap gap-2 mb-6">
              {categoriesConfig.categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategoryName(cat.categoryName); setEditingCategory(cat); setNewQuestion(prev => ({ ...prev, category: cat.categoryName })); }}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${selectedCategoryName === cat.categoryName ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'}`}
                >
                  {cat.categoryName}
                </button>
              ))}
              <button
                onClick={() => { setCreatingNewCategory(true); setSelectedCategoryName(null); setEditingCategory(null); setNewCategory({ categoryName: '', title: '', prompt: '' }); }}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${creatingNewCategory ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'}`}
              >
                + New
              </button>
            </div>
            {creatingNewCategory ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Key (categoryName)</label>
                    <input
                      type="text"
                      value={newCategory.categoryName || ''}
                      onChange={e => setNewCategory(prev => ({ ...prev, categoryName: e.target.value }))}
                      className="w-full p-2 border rounded text-gray-800"
                      placeholder="e.g. market"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={newCategory.title || ''}
                      onChange={e => setNewCategory(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full p-2 border rounded text-gray-800"
                      placeholder="Market Analysis"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                  <textarea
                    value={newCategory.prompt || ''}
                    onChange={e => setNewCategory(prev => ({ ...prev, prompt: e.target.value }))}
                    className="w-full p-3 border rounded resize-none text-gray-800"
                    rows={5}
                    placeholder="Analysis prompt for this category..."
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={addCategory}
                    disabled={!newCategory.categoryName?.trim() || !newCategory.title?.trim() || !newCategory.prompt?.trim()}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-green-700"
                  >
                    Create Category
                  </button>
                  <button
                    onClick={() => { setCreatingNewCategory(false); setNewCategory({}); if (categoriesConfig.categories.length) { const first = categoriesConfig.categories[0]; setSelectedCategoryName(first.categoryName); setEditingCategory(first);} }}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : editingCategory && selectedCategoryName ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={editingCategory.title}
                      onChange={e => setEditingCategory(prev => prev ? { ...prev, title: e.target.value } : prev)}
                      className="w-full p-2 border rounded text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Key (categoryName)</label>
                    <input
                      type="text"
                      value={editingCategory.categoryName}
                      onChange={e => setEditingCategory(prev => prev ? { ...prev, categoryName: e.target.value } : prev)}
                      className="w-full p-2 border rounded text-gray-800"
                      disabled
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                  <textarea
                    value={editingCategory.prompt}
                    onChange={e => setEditingCategory(prev => prev ? { ...prev, prompt: e.target.value } : prev)}
                    className="w-full p-3 border rounded resize-none text-gray-800"
                    rows={5}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={async () => { if (editingCategory && categoriesConfig) { const updatedCats = { ...categoriesConfig, categories: categoriesConfig.categories.map(c => c.id === editingCategory.id ? editingCategory : c) }; setCategoriesConfig(updatedCats); await saveConfigs({ c: updatedCats, silent: true }); }} }
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Category Changes'}
                  </button>
                  <button
                    onClick={() => { const original = categoriesConfig.categories.find(c => c.id === editingCategory.id); if (original) setEditingCategory(original); }}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-500 text-gray-800"
                  >
                    Revert
                  </button>
                  <button
                    onClick={() => { if (editingCategory && confirm(`Delete category "${editingCategory.categoryName}" and its questions? This cannot be undone.`)) { deleteCategory(editingCategory.id); } }}
                    className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700"
                  >
                    Delete Category
                  </button>
                </div>
                <div className="text-xs text-gray-700">Editing ID: {editingCategory.id}</div>
              </div>
            ) : (
              <div className="text-sm text-gray-800">Select a category tab to edit its prompt.</div>
            )}
          </div>

          {/* Questions Management */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Questions in {selectedCategoryName}</h2>
            
            {/* Add New Question (collapsible) */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowNewQuestion(s => !s)}
                className="mb-3 flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                {showNewQuestion ? '− Close New Question' : '+ New Question'}
              </button>
              {showNewQuestion && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-800">Add New Question</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Text
                    </label>
                    <input
                      type="text"
                      value={newQuestion.question || ''}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, question: e.target.value }))}
                      className="w-full p-3 border rounded-lg text-gray-800"
                      placeholder="What is the...?"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <input
                      type="text"
                      disabled
                      value={selectedCategoryName || ''}
                      className="w-full p-3 border rounded-lg bg-gray-100 text-gray-800"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={addQuestion}
                      disabled={!newQuestion.question?.trim() || !selectedCategoryName || saving}
                      className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Add Question'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowNewQuestion(false); setNewQuestion({ category: selectedCategoryName || undefined }); }}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800">
                Questions ({filteredQuestions.length})
              </h3>

              {filteredQuestions.length > 0 ? (
                filteredQuestions.map((question) => (
                <div key={question.id} className="border rounded-lg p-4">
                  {editingQuestion?.id === question.id ? (
                    <div className="space-y-3 text-gray-800">
                      <input
                        type="text"
                        value={editingQuestion.question}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                        className="w-full p-2 border rounded text-gray-800"
                        placeholder="Question text"
                      />
                      <input
                        type="text"
                        value={editingQuestion.category}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                        className="w-full p-2 border rounded text-gray-800"
                        placeholder="Category"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={async () => {
                            if (!config) return;
                            const updated = { ...config, questions: config.questions.map(q => q.id === question.id ? { ...q, ...editingQuestion } : q) };
                            setConfig(updated);
                            setEditingQuestion(null);
                            await saveConfigs({ q: updated, silent: true });
                          }}
                          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingQuestion(null)}
                          className="bg-gray-900 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">{question.question}</h4>
                          <span className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            {question.category}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setEditingQuestion(question)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => { await deleteQuestion(question.id); }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
            <p className="text-gray-900 text-sm">Category: {question.category}</p>
                    </div>
                  )}
                </div>
              ))
              ) : (
                <div className="text-center py-8 text-gray-900">
          No questions found for this category. Add a new question above.
                </div>
              )}
            </div>
          </div>
        </div>
                            <p className="text-sm text-gray-700 mt-1">
                📁 Categories loaded from <code>categoryPrompts.json</code> • Questions from <code>questions.json</code> • Global Prompts from <code>globalPrompts.json</code> and <code>formattingPromptConfig.json</code>
              </p>
      </div>

    </div>
  );
}
