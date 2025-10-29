import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export interface AnalyzableFigure {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  order: number;
}

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
    return config.figures.filter(figure => figure.enabled).sort((a, b) => a.order - b.order);
  } catch (error) {
    logger.error('Error loading analyzable figures:', error);
    return [];
  }
}

export function generateFinancePrompt(companyName: string, isOpenAI: boolean = false): string {
  const figures = loadAnalyzableFigures();

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
