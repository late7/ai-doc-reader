'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import FinanceAnalysisSection from './FinanceAnalysisSection';

interface FinanceData {
    metadata: {
        company_name: string;
        currency: string;
        period_granularity: "monthly" | "quarterly" | "yearly";
        start_period: string;
        end_period: string;
        model_type: "historical" | "forecast" | "mixed";
        prepared_by?: string;
        last_updated: string;
        notes?: string;
    };
    pnl: Array<{
        period: string;
        revenue: number | null;
        cogs: number | null;
        gross_profit: number | null;
        opex: number | null;
        ebitda: number | null;
        notes?: string;
    }>;
    cashflow: Array<{
        period: string;
        opening_cash: number | null;
        operating_cashflow: number | null;
        investing_cashflow: number | null;
        financing_cashflow: number | null;
        closing_cash: number | null;
        notes?: string;
    }>;
    headcount?: Array<{
        period: string;
        total_fte: number;
        sales_fte: number | null;
        tech_fte: number | null;
        avg_cost_per_fte: number | null;
    }>;
    revenue_drivers?: Array<{
        period: string;
        customers: number | null;
        new_customers: number | null;
        arpa: number | null;
        churn_pct: number | null;
    }>;
    assumptions?: Array<{
        category: "revenue" | "costs" | "margin" | "hiring" | "funding" | "other";
        assumption: string;
        value: string | number;
        description?: string;
    }>;
    validation_notes?: Array<{
        level: "info" | "warning" | "error";
        message: string;
    }>;
}

interface FinanceDataTabProps {
    workspaceSlug: string;
    onStatusChange?: (status: 'not_started' | 'in_progress' | 'completed') => void;
}

// Helper to format currency values
function formatCurrency(value: number | null, currency: string): string {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

// Helper to format percentage
function formatPercent(value: number | null): string {
    if (value === null) return '-';
    return `${value.toFixed(1)}%`;
}

// Editable cell component
function EditableCell({
    value,
    onChange,
    type = 'text',
    currency = 'EUR'
}: {
    value: string | number | null;
    onChange: (val: any) => void;
    type?: 'text' | 'number' | 'currency' | 'percent';
    currency?: string;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value?.toString() || '');

    const handleBlur = () => {
        setIsEditing(false);
        if (type === 'number' || type === 'currency' || type === 'percent') {
            const numVal = editValue === '' ? null : parseFloat(editValue);
            onChange(numVal);
        } else {
            onChange(editValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setEditValue(value?.toString() || '');
        }
    };

    if (isEditing) {
        return (
            <input
                type={type === 'text' ? 'text' : 'number'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full px-2 py-1 border border-blue-400 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        );
    }

    let displayValue: string;
    if (type === 'currency') {
        displayValue = formatCurrency(value as number | null, currency);
    } else if (type === 'percent') {
        displayValue = formatPercent(value as number | null);
    } else if (value === null || value === '') {
        displayValue = '-';
    } else {
        displayValue = value.toString();
    }

    return (
        <div
            onClick={() => {
                setIsEditing(true);
                setEditValue(value?.toString() || '');
            }}
            className="cursor-pointer px-2 py-1 hover:bg-blue-50 rounded transition-colors min-h-[28px] text-gray-900"
            title="Click to edit"
        >
            {displayValue}
        </div>
    );
}

export default function FinanceDataTab({ workspaceSlug, onStatusChange }: FinanceDataTabProps) {
    const [financeData, setFinanceData] = useState<FinanceData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [activeTable, setActiveTable] = useState<'pnl' | 'cashflow' | 'headcount' | 'drivers' | 'assumptions'>('pnl');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load existing finance data on mount
    useEffect(() => {
        loadExistingData();
    }, [workspaceSlug]);

    // Auto-save finance data when it changes
    useEffect(() => {
        if (financeData && !isLoading && !isInitialLoading) {
            saveFinanceData(financeData);
        }
    }, [financeData, isLoading, isInitialLoading]);

    const loadExistingData = async () => {
        setIsInitialLoading(true);
        try {
            const response = await fetch(`/api/dd-process/finance-data?workspace=${workspaceSlug}`);
            if (response.ok) {
                const data = await response.json();
                if (data.exists && data.data) {
                    setFinanceData(data.data.financeData);
                    setUploadedFile(data.data.filename || 'Loaded from storage');
                    onStatusChange?.('completed');
                }
            }
        } catch (err) {
            console.error('Error loading finance data:', err);
        } finally {
            setIsInitialLoading(false);
        }
    };

    const saveFinanceData = async (data: FinanceData) => {
        try {
            await fetch('/api/dd-process/finance-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workspaceSlug, financeData: data, filename: uploadedFile }),
            });
        } catch (err) {
            console.error('Error auto-saving finance data:', err);
        }
    };

    const handleFileUpload = useCallback(async (file: File) => {
        if (file.type !== 'application/pdf') {
            setError('Please upload a PDF file');
            return;
        }

        setIsLoading(true);
        setError(null);
        onStatusChange?.('in_progress');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/dd-process/finance-extract', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to extract finance data');
            }

            const result = await response.json();
            setFinanceData(result.data);
            setUploadedFile(result.filename);
            onStatusChange?.('completed');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            onStatusChange?.('not_started');
        } finally {
            setIsLoading(false);
        }
    }, [onStatusChange]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileUpload(file);
        }
    }, [handleFileUpload]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const updatePnlField = (index: number, field: keyof FinanceData['pnl'][0], value: any) => {
        if (!financeData) return;
        const newPnl = [...financeData.pnl];
        newPnl[index] = { ...newPnl[index], [field]: value };
        setFinanceData({ ...financeData, pnl: newPnl });
    };

    const updateCashflowField = (index: number, field: keyof FinanceData['cashflow'][0], value: any) => {
        if (!financeData) return;
        const newCashflow = [...financeData.cashflow];
        newCashflow[index] = { ...newCashflow[index], [field]: value };
        setFinanceData({ ...financeData, cashflow: newCashflow });
    };

    const updateHeadcountField = (index: number, field: string, value: any) => {
        if (!financeData || !financeData.headcount) return;
        const newHeadcount = [...financeData.headcount];
        newHeadcount[index] = { ...newHeadcount[index], [field]: value };
        setFinanceData({ ...financeData, headcount: newHeadcount });
    };

    const updateDriversField = (index: number, field: string, value: any) => {
        if (!financeData || !financeData.revenue_drivers) return;
        const newDrivers = [...financeData.revenue_drivers];
        newDrivers[index] = { ...newDrivers[index], [field]: value };
        setFinanceData({ ...financeData, revenue_drivers: newDrivers });
    };

    const updateAssumptionField = (index: number, field: string, value: any) => {
        if (!financeData || !financeData.assumptions) return;
        const newAssumptions = [...financeData.assumptions];
        newAssumptions[index] = { ...newAssumptions[index], [field]: value };
        setFinanceData({ ...financeData, assumptions: newAssumptions });
    };

    const downloadJson = () => {
        if (!financeData) return;
        const blob = new Blob([JSON.stringify(financeData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance_data_${workspaceSlug}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const currency = financeData?.metadata?.currency || 'EUR';

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-800">Finance Data Extraction</h2>
                    <p className="text-sm text-gray-500">Upload a PDF with financial information to extract structured data</p>
                </div>
                {financeData && (
                    <button
                        onClick={downloadJson}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export JSON
                    </button>
                )}
            </div>

            {/* Upload Area */}
            {!financeData && (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`
            border-2 border-dashed rounded-xl p-8 text-center transition-all
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${isLoading ? 'opacity-50 pointer-events-none' : ''}
          `}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file);
                        }}
                        className="hidden"
                    />

                    {isLoading ? (
                        <div className="space-y-3">
                            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
                            <p className="text-gray-600 font-medium">Extracting financial data with AI...</p>
                            <p className="text-sm text-gray-500">This may take a moment</p>
                        </div>
                    ) : (
                        <>
                            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-gray-600 font-medium mb-1">Drop your finance PDF here</p>
                            <p className="text-sm text-gray-500 mb-4">or click to browse</p>
                            <div className="flex items-center justify-center gap-3 mb-4">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Select PDF File
                                </button>
                                <a
                                    href="/Financials_Example_for_pdf_export.xlsx"
                                    download="Financials_Example_for_pdf_export.xlsx"
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download Excel Template
                                </a>
                            </div>

                            {/* Instruction text */}
                            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 text-left max-w-md mx-auto">
                                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="text-blue-500">💡</span> How to use:
                                </h4>
                                <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
                                    <li><strong>Download</strong> the Excel template using the green button</li>
                                    <li><strong>Fill in</strong> your company's financial data</li>
                                    <li><strong>Export as PDF</strong> (File → Export → PDF)</li>
                                    <li><strong>Upload</strong> the PDF here for AI extraction</li>
                                </ol>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <p className="text-sm font-medium text-red-800">Error extracting data</p>
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                    <button
                        onClick={() => {
                            setError(null);
                            setFinanceData(null);
                        }}
                        className="ml-auto text-red-500 hover:text-red-700"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Data Display */}
            {financeData && (
                <div className="space-y-4">
                    {/* Metadata Card */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                {financeData.metadata.company_name}
                            </h3>
                            <span className="text-xs px-2 py-1 bg-white rounded-full text-gray-600 border">
                                📄 {uploadedFile}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div className="bg-white/60 rounded-lg p-2">
                                <span className="text-gray-500 text-xs">Currency</span>
                                <p className="font-medium text-gray-800">{financeData.metadata.currency}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-2">
                                <span className="text-gray-500 text-xs">Period</span>
                                <p className="font-medium text-gray-800">{financeData.metadata.period_granularity}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-2">
                                <span className="text-gray-500 text-xs">Range</span>
                                <p className="font-medium text-gray-800">{financeData.metadata.start_period} → {financeData.metadata.end_period}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-2">
                                <span className="text-gray-500 text-xs">Type</span>
                                <p className="font-medium text-gray-800 capitalize">{financeData.metadata.model_type}</p>
                            </div>
                        </div>
                    </div>

                    {/* Validation Notes */}
                    {financeData.validation_notes && financeData.validation_notes.length > 0 && (
                        <div className="space-y-2">
                            {financeData.validation_notes.map((note, idx) => (
                                <div
                                    key={idx}
                                    className={`rounded-lg p-3 flex items-start gap-2 text-sm ${note.level === 'error' ? 'bg-red-50 border border-red-200' :
                                        note.level === 'warning' ? 'bg-amber-50 border border-amber-200' :
                                            'bg-blue-50 border border-blue-200'
                                        }`}
                                >
                                    <span>
                                        {note.level === 'error' ? '❌' : note.level === 'warning' ? '⚠️' : 'ℹ️'}
                                    </span>
                                    <span className={
                                        note.level === 'error' ? 'text-red-800' :
                                            note.level === 'warning' ? 'text-amber-800' :
                                                'text-blue-800'
                                    }>{note.message}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Table Tabs */}
                    <div className="border-b border-gray-200">
                        <div className="flex gap-1 -mb-px">
                            {[
                                { id: 'pnl', label: 'P&L Statement', icon: '📊' },
                                { id: 'cashflow', label: 'Cash Flow', icon: '💰' },
                                { id: 'headcount', label: 'Headcount', icon: '👥', disabled: !financeData.headcount?.length },
                                { id: 'drivers', label: 'Revenue Drivers', icon: '📈', disabled: !financeData.revenue_drivers?.length },
                                { id: 'assumptions', label: 'Assumptions', icon: '📝', disabled: !financeData.assumptions?.length },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => !tab.disabled && setActiveTable(tab.id as any)}
                                    disabled={tab.disabled}
                                    className={`
                    px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
                    ${activeTable === tab.id
                                            ? 'bg-white border-t border-l border-r border-gray-200 text-blue-600 -mb-px'
                                            : tab.disabled
                                                ? 'text-gray-300 cursor-not-allowed'
                                                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                        }
                  `}
                                >
                                    <span className="mr-1">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* P&L Table */}
                    {activeTable === 'pnl' && (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Period</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Revenue</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">COGS</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Gross Profit</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">OpEx</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">EBITDA</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {financeData.pnl.map((row, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-4 py-2 font-medium text-gray-800 border-b">
                                                    <EditableCell value={row.period} onChange={(v) => updatePnlField(idx, 'period', v)} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.revenue} onChange={(v) => updatePnlField(idx, 'revenue', v)} type="currency" currency={currency} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.cogs} onChange={(v) => updatePnlField(idx, 'cogs', v)} type="currency" currency={currency} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.gross_profit} onChange={(v) => updatePnlField(idx, 'gross_profit', v)} type="currency" currency={currency} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.opex} onChange={(v) => updatePnlField(idx, 'opex', v)} type="currency" currency={currency} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b font-semibold">
                                                    <EditableCell value={row.ebitda} onChange={(v) => updatePnlField(idx, 'ebitda', v)} type="currency" currency={currency} />
                                                </td>
                                                <td className="px-4 py-2 text-gray-800 border-b">
                                                    <EditableCell value={row.notes || ''} onChange={(v) => updatePnlField(idx, 'notes', v)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Cashflow Table */}
                    {activeTable === 'cashflow' && (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Period</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Opening Cash</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Operating CF</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Investing CF</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Financing CF</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Closing Cash</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {financeData.cashflow.map((row, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-4 py-2 font-medium text-gray-800 border-b">
                                                    <EditableCell value={row.period} onChange={(v) => updateCashflowField(idx, 'period', v)} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.opening_cash} onChange={(v) => updateCashflowField(idx, 'opening_cash', v)} type="currency" currency={currency} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.operating_cashflow} onChange={(v) => updateCashflowField(idx, 'operating_cashflow', v)} type="currency" currency={currency} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.investing_cashflow} onChange={(v) => updateCashflowField(idx, 'investing_cashflow', v)} type="currency" currency={currency} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.financing_cashflow} onChange={(v) => updateCashflowField(idx, 'financing_cashflow', v)} type="currency" currency={currency} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b font-semibold">
                                                    <EditableCell value={row.closing_cash} onChange={(v) => updateCashflowField(idx, 'closing_cash', v)} type="currency" currency={currency} />
                                                </td>
                                                <td className="px-4 py-2 text-gray-800 border-b">
                                                    <EditableCell value={row.notes || ''} onChange={(v) => updateCashflowField(idx, 'notes', v)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Headcount Table */}
                    {activeTable === 'headcount' && financeData.headcount && (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Period</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Total FTE</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Sales FTE</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Tech FTE</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Avg Cost/FTE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {financeData.headcount.map((row, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-4 py-2 font-medium text-gray-800 border-b">
                                                    <EditableCell value={row.period} onChange={(v) => updateHeadcountField(idx, 'period', v)} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.total_fte} onChange={(v) => updateHeadcountField(idx, 'total_fte', v)} type="number" />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.sales_fte} onChange={(v) => updateHeadcountField(idx, 'sales_fte', v)} type="number" />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.tech_fte} onChange={(v) => updateHeadcountField(idx, 'tech_fte', v)} type="number" />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.avg_cost_per_fte} onChange={(v) => updateHeadcountField(idx, 'avg_cost_per_fte', v)} type="currency" currency={currency} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Revenue Drivers Table */}
                    {activeTable === 'drivers' && financeData.revenue_drivers && (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Period</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Customers</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">New Customers</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">ARPA</th>
                                            <th className="px-4 py-3 text-right font-semibold text-gray-900 border-b">Churn %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {financeData.revenue_drivers.map((row, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-4 py-2 font-medium text-gray-800 border-b">
                                                    <EditableCell value={row.period} onChange={(v) => updateDriversField(idx, 'period', v)} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.customers} onChange={(v) => updateDriversField(idx, 'customers', v)} type="number" />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.new_customers} onChange={(v) => updateDriversField(idx, 'new_customers', v)} type="number" />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.arpa} onChange={(v) => updateDriversField(idx, 'arpa', v)} type="currency" currency={currency} />
                                                </td>
                                                <td className="px-4 py-2 text-right border-b">
                                                    <EditableCell value={row.churn_pct} onChange={(v) => updateDriversField(idx, 'churn_pct', v)} type="percent" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Assumptions Table */}
                    {activeTable === 'assumptions' && financeData.assumptions && (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Category</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Assumption</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Value</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {financeData.assumptions.map((row, idx) => (
                                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-4 py-2 border-b">
                                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${row.category === 'revenue' ? 'bg-green-100 text-green-800' :
                                                        row.category === 'costs' ? 'bg-red-100 text-red-800' :
                                                            row.category === 'margin' ? 'bg-blue-100 text-blue-800' :
                                                                row.category === 'hiring' ? 'bg-purple-100 text-purple-800' :
                                                                    row.category === 'funding' ? 'bg-amber-100 text-amber-800' :
                                                                        'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {row.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 border-b">
                                                    <EditableCell value={row.assumption} onChange={(v) => updateAssumptionField(idx, 'assumption', v)} />
                                                </td>
                                                <td className="px-4 py-2 border-b font-medium">
                                                    <EditableCell value={row.value} onChange={(v) => updateAssumptionField(idx, 'value', v)} />
                                                </td>
                                                <td className="px-4 py-2 text-gray-800 border-b">
                                                    <EditableCell value={row.description || ''} onChange={(v) => updateAssumptionField(idx, 'description', v)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Reset Button */}
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={() => {
                                setFinanceData(null);
                                setUploadedFile(null);
                                setError(null);
                                onStatusChange?.('not_started');
                            }}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            ↺ Upload New File
                        </button>
                    </div>

                    {/* Finance Analysis Section */}
                    <FinanceAnalysisSection
                        workspaceSlug={workspaceSlug}
                        financeData={financeData}
                    />
                </div>
            )}
        </div>
    );
}
