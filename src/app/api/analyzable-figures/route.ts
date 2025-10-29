import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'analyzableFigures.json');

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

// GET - Load current analyzable figures configuration
export async function GET() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      // Return default configuration if file doesn't exist
      const defaultConfig: AnalyzableFiguresConfig = {
        figures: [
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
        ]
      };

      // Create the file with default config
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
      return NextResponse.json(defaultConfig);
    }

    const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config: AnalyzableFiguresConfig = JSON.parse(configData);
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error loading analyzable figures config:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

// POST - Save analyzable figures configuration
export async function POST(request: NextRequest) {
  try {
    const config: AnalyzableFiguresConfig = await request.json();

    // Validate the configuration
    if (!config.figures || !Array.isArray(config.figures)) {
      return NextResponse.json(
        { error: 'Invalid configuration format' },
        { status: 400 }
      );
    }

    // Validate each figure
    for (const figure of config.figures) {
      if (!figure.id || !figure.name || !figure.description || typeof figure.enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid figure format' },
          { status: 400 }
        );
      }
    }

    // Save to file
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving analyzable figures config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}
