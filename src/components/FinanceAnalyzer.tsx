'use client';

import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import * as XLSX from 'xlsx';

interface AnalyzableFigure {
  id: string;
  name: string;
  description: string;
  enabled?: boolean;
  order?: number;
}

interface BasicFinancialData {
  company_name: string;
  report_period: string;
  currency: string;
  financial_data: Record<string, {
    value: number | null;
    currency: string;
    period: string;
  }>;
}

interface TimeSeriesFinancialData {
  company_name: string;
  currency: string;
  analysis_type: 'timeseries';
  financial_data: Record<string, {
    metric_name: string;
    years: Record<string, {
      value: number | null;
      currency: string;
      note: string;
    }>;
  }>;
}

type FinancialData = BasicFinancialData | TimeSeriesFinancialData;

function isTimeSeriesData(data: FinancialData): data is TimeSeriesFinancialData {
  return 'analysis_type' in data && data.analysis_type === 'timeseries';
}

interface FinanceAnalyzerProps {
  workspaceSlug: string;
  workspaceName: string;
}

export default function FinanceAnalyzer({ workspaceSlug, workspaceName }: FinanceAnalyzerProps) {
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzableFigures, setAnalyzableFigures] = useState<AnalyzableFigure[]>([]);
  const [defaultFigures, setDefaultFigures] = useState<AnalyzableFigure[]>([]);
  const [analysisMode, setAnalysisMode] = useState<'config' | 'excel'>('config');
  const [analysisType, setAnalysisType] = useState<'basic' | 'timeseries'>('basic');
  const [uploadedFiguresName, setUploadedFiguresName] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load analyzable figures on component mount
  useEffect(() => {
    loadAnalyzableFigures();
  }, []);

  useEffect(() => {
    if (analysisMode === 'config') {
      setAnalyzableFigures(defaultFigures);
      setUploadedFiguresName(null);
      setExcelError(null);
    }
  }, [analysisMode, defaultFigures]);

  const loadAnalyzableFigures = async () => {
    try {
      const response = await fetch('/api/analyzable-figures');
      if (response.ok) {
        const config = await response.json();
        const enabledFigures = (config.figures || [])
          .filter((fig: AnalyzableFigure) => fig.enabled !== false)
          .sort((a: AnalyzableFigure, b: AnalyzableFigure) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
        setDefaultFigures(enabledFigures);
        if (analysisMode === 'config') {
          setAnalyzableFigures(enabledFigures);
        }
      }
    } catch (error) {
      console.error('Error loading analyzable figures:', error);
    }
  };

  const handleAnalysisModeChange = (mode: 'config' | 'excel', options?: { preserveFigures?: boolean }) => {
    setAnalysisMode(mode);
    setFinancialData(null);
    if (mode === 'config') {
      setUploadedFiguresName(null);
      setExcelError(null);
    } else if (!options?.preserveFigures) {
      setAnalyzableFigures([]);
    }
  };

  const slugifyFigureId = (value: string, fallbackIndex: number) => {
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    return sanitized || `figure_${fallbackIndex + 1}`;
  };

  const handleExcelUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

  setExcelError(null);
  setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      if (!workbook.SheetNames.length) {
        throw new Error('The uploaded workbook does not contain any sheets.');
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        throw new Error('Unable to read the first sheet of the workbook.');
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
      const seenIds = new Set<string>();

      const parsedFigures = rows
        .map((row, index) => {
          const normalizedRow = Object.keys(row).reduce<Record<string, string | number>>((acc, key) => {
            acc[key.toLowerCase()] = row[key];
            return acc;
          }, {});

          const nameValue = normalizedRow['name'] ?? normalizedRow['metric'] ?? '';
          const instructionsValue = normalizedRow['instructions'] ?? normalizedRow['guidance'] ?? normalizedRow['description'] ?? '';
          const name = String(nameValue).trim();
          const instructions = String(instructionsValue).trim();

          if (!name) {
            return null;
          }

          let id = slugifyFigureId(name, index);
          let counter = 1;
          while (seenIds.has(id)) {
            id = `${slugifyFigureId(name, index)}_${counter}`;
            counter += 1;
          }
          seenIds.add(id);

          return {
            id,
            name,
            description: instructions || 'No guidance provided.',
            enabled: true
          } as AnalyzableFigure;
        })
        .filter((figure): figure is AnalyzableFigure => figure !== null);

      if (parsedFigures.length === 0) {
        throw new Error('No valid rows found. Please provide at least one row with "Name" and "Instructions" columns.');
      }

  setAnalyzableFigures(parsedFigures);
      setFinancialData(null);
      setUploadedFiguresName(file.name);
  handleAnalysisModeChange('excel', { preserveFigures: true });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Failed to read the Excel file.';
      setExcelError(message);
    } finally {
      event.target.value = '';
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openExcelPicker = () => {
    fileInputRef.current?.click();
  };

  const downloadTemplate = () => {
    const template = [
  {
    "Name": "Revenue",
    "Instructions": "Total revenue, turnover or net sales. Convert any abbreviated figures (M, K, etc.) to whole numbers and specify the currency."
  },
  {
    "Name": "Funding Raised",
    "Instructions": "Cumulative equity funding raised to date. Provide the most recent total in absolute numbers and list the period covered."
  },
  {
    "Name": "Burn Rate",
    "Instructions": "Monthly cash consumption rate. Calculate as the average monthly decrease in cash balance, expressed as a positive number with currency."
  },
  {
    "Name": "Runway",
    "Instructions": "Number of months until cash depletion at current burn rate. Calculate as current cash divided by monthly burn rate, rounded to one decimal place."
  },
  {
    "Name": "Cash Balance",
    "Instructions": "Total cash and cash equivalents available. Include both restricted and unrestricted cash, specify currency and reporting date."
  },
  {
    "Name": "Gross Margin",
    "Instructions": "Gross profit as a percentage of revenue. Calculate as (Revenue - Cost of Goods Sold) / Revenue × 100, expressed as a percentage."
  },
  {
    "Name": "Operating Expenses",
    "Instructions": "Total operating costs including R&D, sales & marketing, and general & administrative expenses. Exclude cost of goods sold, specify period and currency."
  },
  {
    "Name": "Net Loss",
    "Instructions": "Bottom line net income (typically negative for startups). Report as a negative number if loss, positive if profit, with currency and period."
  },
  {
    "Name": "Customer Acquisition Cost (CAC)",
    "Instructions": "Total sales and marketing expenses divided by number of new customers acquired in the period. Specify currency and time period."
  },
  {
    "Name": "Monthly Recurring Revenue (MRR)",
    "Instructions": "Predictable monthly revenue from subscriptions or recurring contracts. Normalize annual contracts to monthly amounts, specify currency and reporting date."
  }
];

    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [
      { wch: 30 },
      { wch: 70 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analyzable Figures');
    XLSX.writeFile(wb, 'financial-figures-template.xlsx');
  };

  const analyzeFinance = async () => {
    if (analysisMode === 'excel' && (!uploadedFiguresName || analyzableFigures.length === 0)) {
      setError('Upload an Excel file with at least one analyzable figure before running the analysis.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        workspaceSlug,
        companyName: workspaceName,
        analysisMode,
        analysisType
      };

      if (analysisMode === 'excel') {
        payload.figures = analyzableFigures.map(({ id, name, description }) => ({
          id,
          name,
          description: description || 'No guidance provided.'
        }));
      }

      const response = await fetch('/api/finance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze financial data');
      }

      const result = await response.json();

      if (result.parsedData) {
        setFinancialData(result.parsedData);
      } else {
        throw new Error('No financial data received');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    if (!financialData) return;

    const dataStr = JSON.stringify(financialData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const safeWorkspace = (workspaceSlug || workspaceName || 'workspace').replace(/[^a-zA-Z0-9-_]+/g, '_');
    const exportFileDefaultName = `${safeWorkspace}_financial_data.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const downloadExcel = () => {
    if (!financialData) return;

    let ws: XLSX.WorkSheet;
    
    if (isTimeSeriesData(financialData)) {
      // Time Series Excel Export
      const years = Object.keys(Object.values(financialData.financial_data)[0]?.years || {});
      
      const excelData = analyzableFigures.map(figure => {
        const figureData = financialData.financial_data[figure.id];
        if (!figureData || !('years' in figureData)) return null;
        
        const row: Record<string, any> = {
          Metric: figure.name,
          Guidance: figure.description
        };
        
        // Add each year as a column
        years.forEach(year => {
          const yearData = figureData.years[year];
          row[year] = yearData?.value ?? '';
          row[`${year}_Note`] = yearData?.note || '';
        });
        
        return row;
      }).filter(Boolean);

      ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for time series
      const colWidths = [
        { wch: 20 }, // Metric
        { wch: 50 }, // Guidance
        ...years.flatMap(() => [
          { wch: 15 }, // Year value
          { wch: 20 }  // Year note
        ])
      ];
      ws['!cols'] = colWidths;
    } else {
      // Basic Analysis Excel Export
      const excelData = analyzableFigures.map(figure => {
        const figureData = financialData.financial_data[figure.id];
        if (!figureData || 'years' in figureData) return null;
        
        return {
          Metric: figure.name,
          Value: figureData.value ?? '',
          Currency: figureData.currency || financialData.currency,
          Period: figureData.period || '',
          Guidance: figure.description
        };
      }).filter(Boolean);

      ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for basic analysis
      const colWidths = [
        { wch: 15 }, // Metric
        { wch: 15 }, // Value
        { wch: 10 }, // Currency
        { wch: 15 }, // Period
        { wch: 50 } // Guidance
      ];
      ws['!cols'] = colWidths;
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Financial Data');

    // Generate filename with company name
    const safeWorkspace = (workspaceSlug || workspaceName || 'workspace').replace(/[^a-zA-Z0-9-_]+/g, '_');
    const analysisTypeSuffix = isTimeSeriesData(financialData) ? '_timeseries' : '';
    const fileName = `${safeWorkspace}_financial_data${analysisTypeSuffix}.xlsx`;

    // Save file
    XLSX.writeFile(wb, fileName);
  };

  const formatCurrency = (value: number | null | undefined, currency: string) => {
    if (value === null || value === undefined) return 'Not found';

    // Format large numbers with appropriate suffixes
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}B ${currency}`;
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M ${currency}`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K ${currency}`;
    } else {
      return `${value.toLocaleString()} ${currency}`;
    }
  };

  const isAnalyzeDisabled = loading || (analysisMode === 'excel' && (!uploadedFiguresName || analyzableFigures.length === 0));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Financial Analysis</h2>
          <p className="text-gray-600">Extract key financial figures from documents in workspace: {workspaceName}</p>
          <p className="text-gray-600">This analysis uses local Document Storage, RAG. It is not as efficient as OpenAI Assistant Analysis.</p>
        </div>
        <button
          onClick={analyzeFinance}
          disabled={isAnalyzeDisabled}
          className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Analyze Financial Data
            </>
          )}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900">Analysis Input Options</h3>
        <p className="mt-1 text-sm text-gray-600">Choose whether to use the configured analyzable figures or provide a custom Excel sheet with guidance.</p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <label className="inline-flex items-center space-x-2 text-sm text-gray-700">
            <input
              type="radio"
              name="analysis-mode"
              value="config"
              checked={analysisMode === 'config'}
              onChange={() => handleAnalysisModeChange('config')}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Use configured analyzable figures</span>
          </label>
          <label className="inline-flex items-center space-x-2 text-sm text-gray-700">
            <input
              type="radio"
              name="analysis-mode"
              value="excel"
              checked={analysisMode === 'excel'}
              onChange={() => handleAnalysisModeChange('excel')}
              className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Use uploaded Excel guidance</span>
          </label>
        </div>

        <div
          className={`mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6 transition-opacity ${
            analysisMode === 'excel' ? 'opacity-100' : 'opacity-50'
          }`}
          aria-disabled={analysisMode !== 'excel'}
        >
          <div className="flex-1">
            <span className="block text-sm font-medium text-gray-700 mb-1">Upload Excel (.xlsx) with columns "Name" and "Instructions"</span>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={openExcelPicker}
                className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
              >
                Choose Excel File
              </button>
              <span className="text-sm text-gray-600">
                {uploadedFiguresName ? (
                  <span className="font-medium text-gray-800">{uploadedFiguresName}</span>
                ) : (
                  'No file selected'
                )}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center self-start rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
          >
            Download Template Excel
          </button>
      </div>
        <div>
          {uploadedFiguresName && analysisMode === 'excel' && (
            <p className="mt-3 text-sm text-gray-600">
              Using analyzable figures from <span className="font-medium text-gray-800">{uploadedFiguresName}</span>.
            </p>
          )}


          {analysisMode === 'config' && (
            <p className="mt-3 text-sm text-gray-600">Using analyzable figures defined in top of the page Header. </p>
          )}

          {excelError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {excelError}
            </div>
          )}
        </div>




      <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-base font-semibold text-gray-900 mb-3">Analysis Type</h4>
          <p className="text-sm text-gray-600 mb-4">Choose between basic single-period analysis or time series analysis across multiple years.</p>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
            <label className="inline-flex items-start space-x-2 text-sm text-gray-700">
              <input
                type="radio"
                name="analysis-type"
                value="basic"
                checked={analysisType === 'basic'}
                onChange={() => setAnalysisType('basic')}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
              />
              <div>
                <span className="font-medium">Basic Analysis</span>
                <p className="text-xs text-gray-500 mt-0.5">Extract most recent financial figures (single period)</p>
              </div>
            </label>
            <label className="inline-flex items-start space-x-2 text-sm text-gray-700">
              <input
                type="radio"
                name="analysis-type"
                value="timeseries"
                checked={analysisType === 'timeseries'}
                onChange={() => setAnalysisType('timeseries')}
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
              />
              <div>
                <span className="font-medium">Time Series (8 Years)</span>
                <p className="text-xs text-gray-500 mt-0.5">Extract 3 years historical + current + 4 years projected data</p>
              </div>
            </label>
          </div>
        </div>
        



      </div>


      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Analysis Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {financialData && (
        <div className="space-y-6">
          {/* Results Table */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Analysis Results - {financialData.company_name || 'Unknown Company'}</h3>
            <div className="overflow-x-auto">
              {isTimeSeriesData(financialData) ? (
                // Time Series Table
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                        Metric
                      </th>
                      {Object.keys(Object.values(financialData.financial_data)[0]?.years || {}).map((year) => (
                        <th key={year} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {year}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analyzableFigures.map((figure) => {
                      const figureData = financialData.financial_data[figure.id];
                      if (!figureData || !('years' in figureData)) return null;
                      
                      return (
                        <tr key={figure.id}>
                          <td className="px-4 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                            {figure.name}
                          </td>
                          {Object.entries(figureData.years).map(([year, yearData]) => (
                            <td key={year} className="px-4 py-4 text-sm text-gray-900">
                              <div className="flex flex-col">
                                <span className={yearData.value === null ? 'text-gray-400' : ''}>
                                  {yearData.value !== null 
                                    ? formatCurrency(yearData.value, yearData.currency || financialData.currency)
                                    : 'N/A'
                                  }
                                </span>
                                {yearData.note && yearData.note !== 'Not found in documents' && (
                                  <span className="text-xs text-gray-500 mt-1">{yearData.note}</span>
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                // Basic Analysis Table
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Metric
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Currency
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Period
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analyzableFigures.map((figure) => {
                      const figureData = financialData.financial_data[figure.id];
                      if (!figureData || 'years' in figureData) return null;
                      
                      return (
                        <tr key={figure.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {figure.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(figureData.value, figureData.currency || financialData.currency)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {figureData.currency || financialData.currency}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {figureData.period}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Download Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={downloadJSON}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download JSON
            </button>
            <button
              onClick={downloadExcel}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
