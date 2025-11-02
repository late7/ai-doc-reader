import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export interface AnalyzableFigure {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  order?: number;
}

export type FigureDefinition = Pick<AnalyzableFigure, 'id' | 'name' | 'description'>;

export interface AnalyzableFiguresConfig {
  figures: AnalyzableFigure[];
}

const CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'analyzableFigures.json');

export function loadAnalyzableFigures(): AnalyzableFigure[] {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      // Return default figures if config doesn't exist
      return [
        {
          id: 'revenue',
          name: 'Revenue',
          description: 'Total revenue, net sales, turnover - the total income from all sources before any expenses are deducted',
          enabled: true,
          order: 1
        },
        {
          id: 'profit',
          name: 'Profit',
          description: 'Net profit, net income, profit after tax - the final profit figure after all expenses, taxes, and costs have been deducted',
          enabled: true,
          order: 2
        },
        {
          id: 'costs',
          name: 'Costs',
          description: 'Total costs, expenses, cost of goods sold, operating expenses - all expenses incurred in running the business',
          enabled: true,
          order: 3
        }
      ];
    }

    const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config: AnalyzableFiguresConfig = JSON.parse(configData);
    return config.figures
      .filter(figure => figure.enabled)
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
  } catch (error) {
    logger.error('Error loading analyzable figures:', error);
    return [];
  }
}

export function generateFinancePrompt(
  companyName: string,
  isOpenAI: boolean = false,
  overrideFigures?: FigureDefinition[]
): string {
  const figures = (overrideFigures && overrideFigures.length > 0)
    ? overrideFigures
    : loadAnalyzableFigures();

  if (figures.length === 0) {
    throw new Error('No analyzable figures configured');
  }

  // Build the figures list for the prompt
  // const figuresList = figures.map(figure => `- ${figure.name} (${figure.description})`).join('\n');
  const figuresList = figures.map(figure => `- ${figure.name} → "${figure.id}" (${figure.description})`).join('\n');

  // Build the JSON structure dynamically
  const jsonStructure = {
    company_name: "Company Name",
    report_period: "2024 or Q4 2024 etc",
    currency: "EUR or USD etc",
    financial_data: figures.reduce((acc, figure) => {
      acc[figure.id] = {
        value: 15500000,
        currency: "currency code",
        period: "time period"
      };
      return acc;
    }, {} as any)
  };

  const basePrompt = isOpenAI
    ? "You are a financial data extraction expert. Your task is to analyze PDF documents and extract key financial figures."
    : "Please analyze all the uploaded PDF documents for {company_name} and extract the key financial data.";

  const prompt = `${basePrompt}

Extract the following financial data from company reports and return it as JSON:
${figuresList}

CRITICAL VALUE CONVERSION GUIDELINES:
1. Convert ALL values to absolute integers (no decimals, no abbreviations, no strings)
2. Handle abbreviations and scaling meticulously:
   - M, Mill, million = multiply by 1,000,000 (e.g., "5.3M" = 5300000)
   - K, k, thousand, '000 = multiply by 1,000 (e.g., "150k" = 150000)
   - B, billion = multiply by 1,000,000,000 (e.g., "2.5B" = 2500000000)
3. Detect document scaling statements:
   - "All figures in thousands" or "(000s)" = multiply ALL values by 1,000
   - "All figures in millions" = multiply ALL values by 1,000,000
   - "Values shown in EUR thousand" = multiply by 1,000
4. Conversion examples:
   - "Revenue: 15.5M EUR" = value: 15500000
   - "Costs: 450k" = value: 450000
   - "Profit: 2,500" when doc says "in thousands" = value: 2500000
   - "25.3" when doc states "all figures in millions" = value: 25300000
   - "1,250" with no scaling → value: 1250
5. Focus on the most recent or annual figures when multiple periods are present
6. Look for consolidated figures rather than segment-specific data
7. If exact figures aren't found, set the value to null (not string)

Return ONLY valid JSON in this exact format:
${JSON.stringify(jsonStructure, null, 2)}

CRITICAL: All value fields must be absolute integers (numbers without quotes). Use null if not found.`;

  return prompt.replace('{company_name}', companyName);
}

export function generateTimeSeriesFinancePrompt(
  companyName: string,
  isOpenAI: boolean = false,
  overrideFigures?: FigureDefinition[]
): string {
  const figures = (overrideFigures && overrideFigures.length > 0)
    ? overrideFigures
    : loadAnalyzableFigures();

  if (figures.length === 0) {
    throw new Error('No analyzable figures configured');
  }

  // Build the figures list for the prompt
  const figuresList = figures.map(figure => `- ${figure.name} → "${figure.id}" (${figure.description})`).join('\n');

  // Build the JSON structure dynamically for time series (8 years: 3 past + current + 4 future)
  const currentYear = new Date().getFullYear();
  const years = [
    `${currentYear - 3}`,
    `${currentYear - 2}`,
    `${currentYear - 1}`,
    `${currentYear}`,
    `${currentYear + 1}`,
    `${currentYear + 2}`,
    `${currentYear + 3}`,
    `${currentYear + 4}`
  ];

  const timeSeriesStructure = {
    company_name: "Company Name",
    currency: "EUR or USD etc",
    analysis_type: "timeseries",
    financial_data: figures.reduce((acc, figure) => {
      acc[figure.id] = {
        metric_name: figure.name,
        years: years.reduce((yearAcc, year) => {
          yearAcc[year] = {
            value: null as number | null,
            currency: "currency code",
            note: "Historical/Projected/Not found in documents"
          };
          return yearAcc;
        }, {} as any)
      };
      return acc;
    }, {} as any)
  };

  const basePrompt = isOpenAI
    ? "You are a financial data extraction expert specialized in time series analysis. Your task is to analyze PDF documents and extract historical and projected financial figures."
    : "Please analyze all the uploaded PDF documents for {company_name} and extract time series financial data spanning 8 years.";

  const prompt = `${basePrompt}

Extract the following financial data from company reports for an 8-year period (3 years historical + current year + 4 years projected) and return it as JSON:
${figuresList}

TIME SERIES ANALYSIS REQUIREMENTS:
1. Extract data for years ${years.join(', ')}
2. For each metric, find values for as many years as are mentioned in the documents
3. Clearly distinguish between:
   - Historical data (actual results from past years)
   - Current year data
   - Projected/forecasted data (future years)
4. ONLY extract data that is EXPLICITLY mentioned in the documents
5. DO NOT hallucinate, estimate, or calculate values not present in the documents
6. If a year's data is not found in any document, set value to null
7. Add a note field indicating: "Historical", "Current", "Projected", or "Not found in documents"

CRITICAL VALUE CONVERSION GUIDELINES:
1. Convert ALL values to absolute integers (no decimals, no abbreviations, no strings)
2. Handle abbreviations and scaling meticulously:
   - M, Mill, million = multiply by 1,000,000 (e.g., "5.3M" = 5300000)
   - K, k, thousand, '000 = multiply by 1,000 (e.g., "150k" = 150000)
   - B, billion = multiply by 1,000,000,000 (e.g., "2.5B" = 2500000000)
3. Detect document scaling statements:
   - "All figures in thousands" or "(000s)" = multiply ALL values by 1,000
   - "All figures in millions" = multiply ALL values by 1,000,000
   - "Values shown in EUR thousand" = multiply by 1,000
4. Look for historical tables, trend analyses, and forecast sections
5. Look for consolidated figures rather than segment-specific data
6. If exact figures aren't found for a specific year, set value to null (not string)

CRITICAL DATA INTEGRITY RULES:
- NEVER fabricate or estimate data
- NEVER extrapolate trends to fill missing years
- NEVER calculate values based on growth rates unless explicitly shown
- ONLY include values that are directly stated in the documents
- Use null for any year where data is not explicitly provided

Return ONLY valid JSON in this exact format:
${JSON.stringify(timeSeriesStructure, null, 2)}

CRITICAL: All value fields must be absolute integers (numbers without quotes) or null if not found. The note field must accurately reflect whether the data is historical, current, projected, or not found.`;

  return prompt.replace('{company_name}', companyName);
}

export function generateComprehensiveFinancePrompt(
  companyName: string,
  isOpenAI: boolean = false
): string {
  const basePrompt = isOpenAI
    ? "You are a financial data extraction expert specialized in comprehensive data extraction. Your task is to analyze PDF documents and extract ALL numerical financial data."
    : "Please analyze all the uploaded PDF documents for {company_name} and extract ALL numerical financial data found in the documents.";

  const exampleStructure = {
    company_name: "Company Name",
    currency: "EUR or USD etc",
    analysis_type: "comprehensive",
    extracted_data: [
      {
        metric_name: "Revenue",
        value: 15500000,
        currency: "EUR",
        period: "2024 or Q4 2024 or FY2023-2024",
        context: "Brief description or source context",
        category: "Income Statement / Balance Sheet / Cash Flow / KPI / Other"
      },
      {
        metric_name: "Total Assets",
        value: 8750000,
        currency: "EUR",
        period: "2024-12-31",
        context: "End of year balance sheet",
        category: "Balance Sheet"
      }
    ]
  };

  const prompt = `${basePrompt}

COMPREHENSIVE FINANCIAL DATA EXTRACTION TASK:
Extract ALL numerical financial data mentioned in the documents, including but not limited to:

FINANCIAL STATEMENTS:
- Revenue, Sales, Turnover (all periods mentioned)
- Costs, Expenses, COGS, Operating Expenses
- Profit/Loss figures (Gross, Operating, Net)
- Assets (Current, Non-current, Total)
- Liabilities (Current, Non-current, Total)
- Equity, Shareholders' Equity
- Cash and Cash Equivalents
- Receivables, Payables
- Inventory levels
- Depreciation, Amortization

CASH FLOW METRICS:
- Operating Cash Flow
- Investing Cash Flow
- Financing Cash Flow
- Free Cash Flow
- Capital Expenditures (CapEx)

BUSINESS METRICS & KPIs:
- Number of customers, users, or subscribers
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- Monthly/Annual Recurring Revenue (MRR/ARR)
- Churn Rate, Retention Rate
- Average Order Value (AOV)
- Conversion rates
- Growth rates, CAGR

STARTUP/INVESTMENT METRICS:
- Funding raised (by round: Seed, Series A/B/C, etc.)
- Valuation figures
- Burn Rate
- Runway (months)
- Number of employees
- Revenue per employee

OTHER FINANCIAL DATA:
- Tax amounts and rates
- Interest expenses/income
- Dividend payments
- Share prices, market cap
- Debt levels and terms
- Working capital
- Any other numerical business metrics

CRITICAL VALUE CONVERSION GUIDELINES:
1. Convert ALL values to absolute integers (no decimals, no abbreviations)
2. Handle abbreviations and scaling meticulously:
   - M, Mill, million = multiply by 1,000,000 (e.g., "5.3M" = 5300000)
   - K, k, thousand, '000 = multiply by 1,000 (e.g., "150k" = 150000)
   - B, billion = multiply by 1,000,000,000 (e.g., "2.5B" = 2500000000)
3. Detect document scaling statements:
   - "All figures in thousands" or "(000s)" = multiply ALL values by 1,000
   - "All figures in millions" = multiply ALL values by 1,000,000
4. For each extracted value, provide:
   - metric_name: Clear descriptive name
   - value: Absolute integer (or null if not found)
   - currency: Currency code (if applicable, otherwise use the document's base currency)
   - period: The time period this data refers to (year, quarter, date, etc.)
   - context: Brief explanation of where/how this was found
   - category: Classify as "Income Statement", "Balance Sheet", "Cash Flow", "KPI", "Investment", or "Other"

EXTRACTION RULES:
1. Extract data from ALL time periods mentioned (historical, current, projected)
2. If the same metric appears for multiple periods, create separate entries
3. Include both consolidated and significant segment data if available
4. Focus on primary/headline figures rather than every line item
5. ONLY extract values explicitly stated in documents - DO NOT calculate or estimate
6. Use null for values if they cannot be found or converted
7. Provide meaningful context to help understand each data point
8. Order results logically (e.g., by category, then by period)

Return ONLY valid JSON in this exact format:
${JSON.stringify(exampleStructure, null, 2)}

CRITICAL: 
- All value fields must be absolute integers (numbers without quotes) or null
- Extract as many data points as possible from the documents
- Be thorough - this is meant to capture ALL financial data, not just key metrics
- Ensure each entry has clear context explaining what the number represents`;

  return prompt.replace('{company_name}', companyName);
}
