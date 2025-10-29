'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
// Removed static jsPDF import to support dynamic import client-side only
import ReactMarkdown from 'react-markdown';

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

interface QuestionAnalyzerProps {
  workspaceSlug: string;
  onDocumentsRefresh?: () => void;
}

interface AnalysisResult {
  questionId: string;
  result: string;
  timestamp: Date;
  additionalNotes?: string;
  coverageScore?: string;
  sources?: Array<{
    document: string;
    text: string;
  }>;
}

export interface QuestionAnalyzerRef {
  exportReport: () => void;
}

const QuestionAnalyzer = forwardRef<QuestionAnalyzerRef, QuestionAnalyzerProps>(function QuestionAnalyzer({ workspaceSlug, onDocumentsRefresh }, ref) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<Map<string, AnalysisResult>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [coverageLoading, setCoverageLoading] = useState<Set<string>>(new Set());
  const [additionalNotes, setAdditionalNotes] = useState<Map<string, string>>(new Map());
  const [companySummary, setCompanySummary] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(new Set());
  const [summaryCollapsed, setSummaryCollapsed] = useState(false); // Summary collapse state
  const [adHocInputs, setAdHocInputs] = useState<Record<string, string>>({});
  const [adHocLoading, setAdHocLoading] = useState<Set<string>>(new Set());
  const [runningAll, setRunningAll] = useState(false);
  const [runAllProgress, setRunAllProgress] = useState<{current:number; total:number}>({current:0,total:0});

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const [qRes, cRes] = await Promise.all([
        fetch('/api/questions'),
        fetch('/api/categories')
      ]);

      const qData = await qRes.json();
      const cData = await cRes.json();

      const questionList = qData.questions || [];
      setQuestions(questionList);

      const categoriesList: Category[] = cData.categories || [];
      setAllCategories(categoriesList);

      // Prefer previously active tab if still exists
      setActiveTab(prev => {
        if (prev && categoriesList.some(c => c.categoryName === prev)) return prev;
        return categoriesList.length ? categoriesList[0].categoryName : (questionList[0]?.category || null);
      });
    } catch (error) {
      console.error('Error fetching questions or categories:', error);
    }
  };

  const generateCompanySummary = async () => {
    console.log('Generate summary clicked');
    setSummaryLoading(true);
    try {
      console.log('Sending request to /api/analyze with workspaceSlug:', workspaceSlug);
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceSlug }),
      });

      console.log('API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      console.log('API response data:', data);
      
      const summaryText = data.textResponse || data.response || 'No response generated';
      console.log('Setting summary:', summaryText);
      setCompanySummary(summaryText);
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Failed to generate Summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const runQuestion = async (questionId: string) => {
    console.log('Run question clicked:', questionId);
    setLoading(prev => new Set(prev).add(questionId));
    setCoverageLoading(prev => new Set(prev).add(questionId));
    
    try {
      const question = questions.find(q => q.id === questionId);
      if (!question) {
        throw new Error('Question not found');
      }

      // First run coverage analysis
      console.log('Running coverage analysis first...');
      const coveragePrompt = `How well does the documents provide information for the question? Answer in scale 1 to 10. 1=Not at all, 5=Some info found but not comprehensive, 10=Comprehensive. Answer just the number. Question: "${question.question}"`;

      const coverageResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceSlug, customPrompt: coveragePrompt }),
      });

      let coverageScore = 'N/A';
      if (coverageResponse.ok) {
        const coverageData = await coverageResponse.json();
        coverageScore = coverageData.textResponse || coverageData.response || 'N/A';
        console.log('Coverage score received:', coverageScore);
      }

      // Stop coverage loading
      setCoverageLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(questionId);
        return newSet;
      });

      // Then run the main analysis
      console.log('Running main analysis...');
      console.log('Sending request to /api/analyze with:', { workspaceSlug, questionId });
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceSlug, questionId }),
      });

      console.log('Question API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Question API error response:', errorText);
        throw new Error('Failed to analyze question');
      }

      const data = await response.json();
      console.log('Question API response data:', data);
      
      const resultText = data.textResponse || data.response || 'No response generated';
      console.log('Setting question result for', questionId, ':', resultText);
      
      setResultsWithCollapsedSources(questionId, {
        questionId,
        result: resultText,
        timestamp: new Date(),
        sources: data.sources || [],
        coverageScore
      });
    } catch (error) {
      console.error('Error running question:', error);
      alert('Failed to run analysis');
    } finally {
      setLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(questionId);
        return newSet;
      });
      setCoverageLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(questionId);
        return newSet;
      });
    }
  };

  const runAdHocQuestion = async (categoryName: string) => {
    const raw = adHocInputs[categoryName];
    const text = raw?.trim();
    if (!text) return;
    const tempId = `adhoc-${categoryName}-${Date.now()}`;
    // Optimistically add placeholder question to UI so result anchors
    setQuestions(prev => [...prev, { id: tempId, question: text, category: categoryName }]);
  // Mark loading states so the new card shows progress indicator similar to predefined questions
  setLoading(prev => new Set(prev).add(tempId));
  setCoverageLoading(prev => new Set(prev).add(tempId));
    setAdHocLoading(prev => new Set(prev).add(categoryName));
    try {
      // Coverage analysis first
      const coveragePrompt = `How well does the documents provide information for the question? Answer in scale 1 to 10. 1=Not at all, 5=Some info found but not comprehensive, 10=Comprehensive. Answer just the number. Question: "${text}"`;
      const coverageResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceSlug, customPrompt: coveragePrompt })
      });
      let coverageScore = 'N/A';
      if (coverageResponse.ok) {
        const coverageData = await coverageResponse.json();
        coverageScore = coverageData.textResponse || coverageData.response || 'N/A';
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceSlug, adHocQuestion: text, categoryName })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Failed ad-hoc analysis');
      }
      const data = await response.json();
      const resultText = data.textResponse || data.response || 'No response generated';
      setResultsWithCollapsedSources(tempId, {
        questionId: tempId,
        result: resultText,
        timestamp: new Date(),
        sources: data.sources || [],
        coverageScore
      });
      // Clear input
      setAdHocInputs(prev => ({ ...prev, [categoryName]: '' }));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to analyze ad-hoc question');
      // Remove temp question on failure
      setQuestions(prev => prev.filter(q => q.id !== tempId));
    } finally {
      setAdHocLoading(prev => { const s = new Set(prev); s.delete(categoryName); return s; });
  setLoading(prev => { const s = new Set(prev); s.delete(tempId); return s; });
  setCoverageLoading(prev => { const s = new Set(prev); s.delete(tempId); return s; });
    }
  };

  const saveAdditionalNotes = async (questionId: string) => {
    const notes = additionalNotes.get(questionId);
    if (!notes || !workspaceSlug) return;

    try {
      // Find the question details
      const question = questions.find(q => q.id === questionId);
      if (!question) {
        throw new Error('Question not found');
      }

      // Create document content with question and notes only
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `question-${questionId}-${timestamp}.txt`;
      
      const documentContent = [
        `Question ID: ${questionId}`,
        `Question: ${question.question}`,
        `Timestamp: ${new Date().toLocaleString()}`,
        ``,
        notes
      ].join('\n');

      // Create a File object from the content
      const blob = new Blob([documentContent], { type: 'text/plain' });
      const file = new File([blob], fileName, { type: 'text/plain' });

      // Upload the document to the workspace
      const response = await fetch('/api/upload-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceSlug,
          fileName,
          content: documentContent
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to upload notes: ${response.status}`);
      }

      // Update local state
      setResults(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(questionId);
        if (existing) {
          newMap.set(questionId, { ...existing, additionalNotes: notes });
        }
        return newMap;
      });

      setAdditionalNotes(prev => {
        const newMap = new Map(prev);
        newMap.delete(questionId);
        return newMap;
      });

      alert(`Notes saved successfully and uploaded as ${fileName} to workspace!`);
      
      // Refresh the document list to show the new notes file
      if (onDocumentsRefresh) {
        onDocumentsRefresh();
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      alert(`Failed to save notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const exportReport = async () => {
    try {
      const jsPdfModule: any = await import('jspdf');
      const JsPDFCtor = jsPdfModule.jsPDF || jsPdfModule.default || jsPdfModule;
      const doc = new JsPDFCtor({ unit: 'pt', format: 'a4' });
      let y = 50;
      const left = 50;
      const maxWidth = 515; // 595 - margins
      const lineHeight = 16;

      const addTitle = (text: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        const lines: string[] = doc.splitTextToSize(text, maxWidth) as string[];
        lines.forEach((l: string) => {
          if (y > 780) { doc.addPage(); y = 50; }
          doc.text(l, left, y);
          y += lineHeight;
        });
        y += 4;
      };

      const addHeading = (text: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        if (y > 780) { doc.addPage(); y = 50; }
        doc.text(text, left, y);
        y += lineHeight;
      };

      const addBody = (text: string) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const lines: string[] = doc.splitTextToSize(text, maxWidth) as string[];
        lines.forEach((l: string) => {
          if (y > 780) { doc.addPage(); y = 50; }
            doc.text(l, left, y);
            y += lineHeight;
        });
        y += 6;
      };

      // Document meta
      addTitle('VC Analysis Report');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, left, y);
      y += lineHeight + 4;

      //  Summary
      addHeading('Summary');
      addBody(companySummary || 'No summary generated yet.');

      // Questions
      addHeading('Analysis Questions');
      // Group by category for structure
      const byCategory: Record<string, Question[]> = questions.reduce((acc, q) => {
        (acc[q.category] = acc[q.category] || []).push(q);
        return acc;
      }, {} as Record<string, Question[]>);

      Object.keys(byCategory).sort().forEach(cat => {
        addHeading(cat);
        byCategory[cat].forEach(q => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          if (y > 780) { doc.addPage(); y = 50; }
          const qLines: string[] = doc.splitTextToSize(q.question, maxWidth) as string[];
          qLines.forEach((l: string) => { if (y > 780) { doc.addPage(); y = 50; } doc.text(l, left, y); y += lineHeight; });
          doc.setFont('helvetica', 'normal');
          const r = results.get(q.id);
          const answer = r ? r.result : 'Not answered yet.';
          const coverage = r?.coverageScore ? `Coverage Score: ${r.coverageScore}/10` : undefined;
          const notes = r?.additionalNotes ? `Additional Notes: ${r.additionalNotes}` : undefined;
          const answerBlocks = [answer, coverage, notes].filter(Boolean).join('\n\n');
          addBody(answerBlocks);
        });
      });

  doc.save('vc-analysis-report.pdf');
    } catch (e) {
      alert('Failed to generate PDF report');
      console.error(e);
    }
  };

  useImperativeHandle(ref, () => ({ exportReport }));

  const groupedQuestions = questions.reduce((acc, question) => {
    if (!acc[question.category]) acc[question.category] = [];
    acc[question.category].push(question);
    return acc;
  }, {} as Record<string, Question[]>);

  // All category names from config; fall back to those present in questions
  const categories = allCategories.length ? allCategories.map(c => c.categoryName) : Object.keys(groupedQuestions);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCoverageColors = (score: string) => {
    const numScore = parseInt(score);
    if (numScore >= 1 && numScore <= 3) {
      return 'bg-red-50 border-red-200 text-red-700';
    } else if (numScore >= 4 && numScore <= 6) {
      return 'bg-yellow-50 border-yellow-200 text-yellow-700';
    } else if (numScore >= 7 && numScore <= 10) {
      return 'bg-green-50 border-green-200 text-green-700';
    }
    return 'bg-gray-50 border-gray-200 text-gray-700';
  };

  const toggleSources = (questionId: string) => {
    setCollapsedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const cleanSourceText = (text: string) => {
    // Remove document metadata tags (using global and multiline flags)
    let cleaned = text.replace(/<document_metadata>[\s\S]*?<\/document_metadata>/g, '');
    // Remove any remaining XML/HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    // Clean up multiple whitespaces and normalize line breaks
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    // Add some structure by splitting on common patterns if the text is very long
    if (cleaned.length > 300) {
      // Add line breaks before bullet points or numbered items
      cleaned = cleaned.replace(/([.!?])\s*([A-Z•])/g, '$1\n\n$2');
      // Add line breaks before years (common pattern in financial docs)
      cleaned = cleaned.replace(/(\d{4})\s*([A-Z])/g, '$1\n$2');
    }
    return cleaned;
  };

  const extractDocumentName = (text: string) => {
    // First try to extract sourceDocument from metadata
    let match = text.match(/<document_metadata>[\s\S]*?sourceDocument:\s*([^<\n,]+)[\s\S]*?<\/document_metadata>/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Try alternative format with filename
    match = text.match(/<document_metadata>[\s\S]*?filename:\s*([^<\n,]+)[\s\S]*?<\/document_metadata>/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Try to extract any document name from the metadata
    match = text.match(/<document_metadata>([\s\S]*?)<\/document_metadata>/);
    if (match && match[1]) {
      const metadata = match[1];
      // Look for any field that might be a filename
      const fileMatch = metadata.match(/(?:sourceDocument|filename|name|file):\s*([^<\n,]+)/);
      if (fileMatch && fileMatch[1]) {
        return fileMatch[1].trim();
      }
    }
    
    return null;
  };

  // Initialize sources as collapsed by default when results are set
  const setResultsWithCollapsedSources = (questionId: string, result: AnalysisResult) => {
    setResults(prev => new Map(prev).set(questionId, result));
    // Collapse sources by default
    setCollapsedSources(prev => new Set(prev).add(questionId));
  };

  const runAllQuestions = async () => {
    if (runningAll || questions.length === 0) return;
    setRunningAll(true);
    setRunAllProgress({current:0,total:questions.length});
    try {
      for (let i=0; i<questions.length; i++) {
        const q = questions[i];
        setRunAllProgress({current:i,total:questions.length});
        // Await sequentially to reduce API load bursts
        // eslint-disable-next-line no-await-in-loop
        await runQuestion(q.id);
      }
      setRunAllProgress({current:questions.length,total:questions.length});
    } finally {
      setTimeout(()=>setRunningAll(false), 300); // slight delay so user sees 100%
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Section */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSummaryCollapsed(c => !c)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-blue-200 hover:bg-blue-100 transition"
              aria-expanded={!summaryCollapsed}
              aria-label={summaryCollapsed ? 'Expand Summary' : 'Collapse Summary'}
            >
              <span className={`transition-transform ${summaryCollapsed ? '' : 'rotate-90'}`}>▶</span>
            </button>
            <h2 className="text-xl font-bold text-gray-800">Summary</h2>
          </div>
          <div className="flex items-center gap-2">
            {companySummary && (
              <button
                onClick={() => setSummaryCollapsed(c => !c)}
                className="text-xs text-blue-700 hover:underline"
              >
                {summaryCollapsed ? 'Expand' : 'Collapse'}
              </button>
            )}
            <button
              onClick={generateCompanySummary}
              disabled={summaryLoading}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                summaryLoading 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {summaryLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : 'Generate Summary'}
            </button>
          </div>
        </div>
        {companySummary ? (
          summaryCollapsed ? (
            <div className="bg-white p-3 rounded-md border border-gray-200 shadow-sm text-sm text-gray-800">
              {companySummary.slice(0,200)}{companySummary.length > 200 && '…'}
            </div>
          ) : (
            <div className="bg-white p-3 rounded-md border border-gray-200 shadow-sm text-gray-800">
              <div className="prose prose-sm max-w-none prose-p:text-gray-800 prose-li:text-gray-800">
                <ReactMarkdown>{companySummary}</ReactMarkdown>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-6 bg-white rounded-md border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No summary generated</h3>
            <p className="mt-1 text-sm text-gray-500">
              Generate a summary to get an overview of this startup opportunity
            </p>
          </div>
        )}
      </div>

      {/* Questions Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Analysis Questions</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={runAllQuestions}
              disabled={runningAll || questions.length === 0}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${runningAll || questions.length===0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed':'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {runningAll ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
                    <path className="opacity-75" d="M4 12a8 8 0 018-8" strokeWidth="4" />
                  </svg>
                  Running {runAllProgress.current + (runAllProgress.total>0?1:0)}/{runAllProgress.total}
                </>
              ) : 'Run All Questions'}
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        {categories.length > 0 && (
          <div className="border-b border-gray-200 mb-4">
            <nav className="-mb-px flex space-x-6">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setActiveTab(category)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === category
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </nav>
          </div>
        )}

        {activeTab && (
          <div className="space-y-4">
            {groupedQuestions[activeTab] && groupedQuestions[activeTab].length > 0 ? groupedQuestions[activeTab].map((question) => (
              <div key={question.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-gray-900">{question.question}</h3>
                    <button
                      onClick={() => runQuestion(question.id)}
                      disabled={loading.has(question.id)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                        loading.has(question.id)
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {loading.has(question.id) ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Running...
                        </span>
                      ) : 'Run Analysis'}
                    </button>
                  </div>

                </div>
                
                {results.has(question.id) && (
                  <div className="px-4 py-3">
                    {/* Documentation Coverage - Moved above Analysis Result */}
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Documentation Coverage</h4>
                      {results.get(question.id)?.coverageScore ? (
                        <div className={`p-2 rounded-md border ${getCoverageColors(results.get(question.id)?.coverageScore || '')}`}>
                          <div className="flex items-center">
                            <span className="text-sm mr-2">Coverage Score:</span>
                            <span className="text-lg font-bold">
                              {results.get(question.id)?.coverageScore}/10
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-2 rounded-md border border-gray-200 text-center">
                          <p className="text-sm text-gray-500">Coverage will be checked automatically when running analysis</p>
                        </div>
                      )}
                    </div>

                    {/* Analysis Result */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-medium text-gray-700">Analysis Result</h4>
                        <span className="text-xs text-gray-500">
                          Generated at {formatTimestamp(results.get(question.id)!.timestamp)}
                        </span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md border border-gray-200 text-gray-800">
                        <div className="prose prose-sm max-w-none prose-p:text-gray-800 prose-li:text-gray-800">
                          <ReactMarkdown>{results.get(question.id)?.result}</ReactMarkdown>
                        </div>
                      </div>
                    </div>

                    {/* Sources */}
                    {results.get(question.id)?.sources && results.get(question.id)!.sources!.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-700">Sources ({results.get(question.id)!.sources!.length})</h4>
                          <button
                            onClick={() => toggleSources(question.id)}
                            className="flex items-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            {collapsedSources.has(question.id) ? (
                              <>
                                <span className="mr-1">Show</span>
                                <svg className="h-3 w-3 transform rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </>
                            ) : (
                              <>
                                <span className="mr-1">Hide</span>
                                <svg className="h-3 w-3 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </>
                            )}
                          </button>
                        </div>
                        {!collapsedSources.has(question.id) && (
                          <ul className="space-y-2">
                            {results.get(question.id)!.sources!.map((source, index) => {
                              const documentName = extractDocumentName(source.text) || source.document;
                              console.log('Document name extracted:', documentName, 'from source:', source.text.substring(0, 200));
                              return (
                                <li key={index} className="bg-blue-50 p-3 rounded-md border border-blue-100">
                                  <div className="font-bold text-blue-800 mb-2 text-lg">
                                    📄 {documentName}
                                  </div>
                                  <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                                    {cleanSourceText(source.text)}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                    

                    
                    <div>
                      <label htmlFor={`notes-${question.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                        <span className="font-semibold">Add your notes</span>
                        <span className="ml-1 text-gray-500">(this creates new .txt document into RAG)</span>
                      </label>
                      <textarea
                        id={`notes-${question.id}`}
                        value={additionalNotes.get(question.id) || ''}
                        onChange={(e) => setAdditionalNotes(prev => new Map(prev).set(question.id, e.target.value))}
                        placeholder="Add additional notes or insights about this analysis..."
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm text-gray-800 placeholder-gray-500"
                        rows={3}
                      />
                      <div className="mt-1 flex justify-end">
                        <button
                          onClick={() => saveAdditionalNotes(question.id)}
                          disabled={!additionalNotes.get(question.id)}
                          className={`px-3 py-1 rounded-md text-sm font-medium ${
                            !additionalNotes.get(question.id)
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-600 text-white hover:bg-gray-700'
                          }`}
                        >
                          Save Notes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )) : (
              <div className="border rounded-lg bg-white p-6 text-center text-sm text-gray-500">
                No questions yet for this category.
              </div>
            )}
            {/* Ad-hoc question input */}
            <div className="border rounded-lg bg-white p-4 shadow-sm">
              <h3 className="text-lg font-medium text-gray-900">Ask Additional Question</h3>
              <textarea
                value={adHocInputs[activeTab] || ''}
                onChange={e => setAdHocInputs(prev => ({ ...prev, [activeTab]: e.target.value }))}
                placeholder="Type an additional question to analyze using this category's prompt..."
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm mb-2 text-gray-800 placeholder-gray-500"
                rows={2}
              />
              <div className="flex justify-end">
                <button
                  onClick={() => runAdHocQuestion(activeTab)}
                  disabled={!adHocInputs[activeTab]?.trim() || adHocLoading.has(activeTab)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${adHocInputs[activeTab]?.trim() && !adHocLoading.has(activeTab) ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                >
                  {adHocLoading.has(activeTab) ? 'Analyzing...' : 'Run Additional Question'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default QuestionAnalyzer;
