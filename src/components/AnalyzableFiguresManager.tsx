'use client';

import { useState, useEffect } from 'react';

interface AnalyzableFigure {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  order: number;
}

interface AnalyzableFiguresConfig {
  figures: AnalyzableFigure[];
}

interface AnalyzableFiguresManagerProps {
  onFiguresChange?: (figures: AnalyzableFigure[]) => void;
}

export default function AnalyzableFiguresManager({ onFiguresChange }: AnalyzableFiguresManagerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [figures, setFigures] = useState<AnalyzableFigure[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingFigure, setEditingFigure] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ name: '', description: '' });
  const [newFigure, setNewFigure] = useState({ name: '', description: '' });

  // Load figures on component mount
  useEffect(() => {
    loadFigures();
  }, []);

  const loadFigures = async () => {
    try {
      const response = await fetch('/api/analyzable-figures');
      if (response.ok) {
        const config: AnalyzableFiguresConfig = await response.json();
        const sortedFigures = config.figures.sort((a, b) => a.order - b.order);
        setFigures(sortedFigures);
        onFiguresChange?.(sortedFigures);
      }
    } catch (error) {
      console.error('Error loading figures:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveFigures = async (updatedFigures: AnalyzableFigure[]) => {
    setSaving(true);
    try {
      const response = await fetch('/api/analyzable-figures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figures: updatedFigures }),
      });

      if (response.ok) {
        setFigures(updatedFigures);
        onFiguresChange?.(updatedFigures);
      } else {
        console.error('Failed to save figures');
      }
    } catch (error) {
      console.error('Error saving figures:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleFigure = (id: string) => {
    const updatedFigures = figures.map(fig =>
      fig.id === id ? { ...fig, enabled: !fig.enabled } : fig
    );
    saveFigures(updatedFigures);
  };

  const startEditing = (figure: AnalyzableFigure) => {
    setEditingFigure(figure.id);
    setEditValues({ name: figure.name, description: figure.description });
  };

  const cancelEditing = () => {
    setEditingFigure(null);
    setEditValues({ name: '', description: '' });
  };

  const saveEditing = (id: string) => {
    if (!editValues.name.trim() || !editValues.description.trim()) return;
    
    updateFigure(id, { name: editValues.name.trim(), description: editValues.description.trim() });
    setEditValues({ name: '', description: '' });
  };

  const updateFigure = (id: string, updates: Partial<AnalyzableFigure>) => {
    const updatedFigures = figures.map(fig =>
      fig.id === id ? { ...fig, ...updates } : fig
    );
    saveFigures(updatedFigures);
    setEditingFigure(null);
  };

  const deleteFigure = (id: string) => {
    const updatedFigures = figures.filter(fig => fig.id !== id);
    saveFigures(updatedFigures);
  };

  const updateFigureOrder = (id: string, newOrder: number) => {
    // Ensure newOrder is within valid range
    const validOrder = Math.max(1, Math.min(figures.length, newOrder));
    
    // Create a new array with the updated order
    const updatedFigures = figures.map(fig => ({ ...fig }));
    
    // Find the figure being moved
    const figureToMove = updatedFigures.find(fig => fig.id === id);
    if (!figureToMove) return;
    
    // Remove the figure from its current position
    const filteredFigures = updatedFigures.filter(fig => fig.id !== id);
    
    // Insert the figure at the new position
    filteredFigures.splice(validOrder - 1, 0, { ...figureToMove, order: validOrder });
    
    // Reassign sequential order numbers to all figures
    const reorderedFigures = filteredFigures.map((fig, index) => ({
      ...fig,
      order: index + 1
    }));
    
    saveFigures(reorderedFigures);
  };

  const moveFigureUp = (id: string) => {
    const currentIndex = figures.findIndex(f => f.id === id);
    if (currentIndex > 0) {
      const newFigures = [...figures];
      // Swap with the previous item
      [newFigures[currentIndex - 1], newFigures[currentIndex]] = [newFigures[currentIndex], newFigures[currentIndex - 1]];
      
      // Reassign order numbers
      const reorderedFigures = newFigures.map((fig, index) => ({
        ...fig,
        order: index + 1
      }));
      
      saveFigures(reorderedFigures);
    }
  };

  const moveFigureDown = (id: string) => {
    const currentIndex = figures.findIndex(f => f.id === id);
    if (currentIndex < figures.length - 1) {
      const newFigures = [...figures];
      // Swap with the next item
      [newFigures[currentIndex], newFigures[currentIndex + 1]] = [newFigures[currentIndex + 1], newFigures[currentIndex]];
      
      // Reassign order numbers
      const reorderedFigures = newFigures.map((fig, index) => ({
        ...fig,
        order: index + 1
      }));
      
      saveFigures(reorderedFigures);
    }
  };

  const generateId = (name: string): string => {
    // Convert name to lowercase, replace spaces and special chars with underscores
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const addFigure = () => {
    if (!newFigure.name.trim() || !newFigure.description.trim()) return;

    const newFig: AnalyzableFigure = {
      id: generateId(newFigure.name),
      name: newFigure.name.trim(),
      description: newFigure.description.trim(),
      enabled: true,
      order: Math.max(...figures.map(f => f.order), 0) + 1,
    };

    const updatedFigures = [...figures, newFig];
    saveFigures(updatedFigures);
    setNewFigure({ name: '', description: '' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            📊 Analyzable Figures Configuration
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure which financial figures to extract and their AI analysis instructions
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-200">
          {/* Existing Figures */}
          <div className="space-y-4 mb-6">
            <h4 className="text-md font-medium text-gray-900">Current Figures</h4>
            {figures
              .sort((a, b) => a.order - b.order)
              .map((figure) => (
              <div key={figure.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {editingFigure === figure.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editValues.name}
                          onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Figure name"
                        />
                        <textarea
                          value={editValues.description}
                          onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                          placeholder="AI analysis instructions"
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={cancelEditing}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEditing(figure.id)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                            disabled={!editValues.name.trim() || !editValues.description.trim()}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => moveFigureUp(figure.id)}
                              disabled={figures.findIndex(f => f.id === figure.id) === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:text-gray-200 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => moveFigureDown(figure.id)}
                              disabled={figures.findIndex(f => f.id === figure.id) === figures.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:text-gray-200 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                          <h5 className="text-sm font-medium text-gray-900">{figure.name}</h5>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            figure.enabled
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {figure.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{figure.description}</p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => toggleFigure(figure.id)}
                            className={`px-3 py-1 text-xs rounded ${
                              figure.enabled
                                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {figure.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => startEditing(figure)}
                            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteFigure(figure.id)}
                            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add New Figure */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-md font-medium text-gray-900 mb-3">Add New Figure</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={newFigure.name}
                onChange={(e) => setNewFigure({ ...newFigure, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Figure name (e.g., EBITDA, Gross Margin)"
              />
              <textarea
                value={newFigure.description}
                onChange={(e) => setNewFigure({ ...newFigure, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="AI analysis instructions (e.g., EBITDA, earnings before interest, taxes, depreciation, and amortization - a measure of operational profitability)"
              />
              <button
                onClick={addFigure}
                disabled={!newFigure.name.trim() || !newFigure.description.trim() || saving}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                {saving ? 'Saving...' : 'Add Figure'}
              </button>
            </div>
          </div>

          {/* Save Status */}
          {saving && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm text-blue-700">Saving configuration...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
