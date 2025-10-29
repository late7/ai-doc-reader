import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'system.json');

interface SystemConfig {
  financeEnabled: boolean;
}

// GET - Load current system configuration
export async function GET() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      // Return default configuration if file doesn't exist
      const defaultConfig: SystemConfig = {
        financeEnabled: true
      };
      return NextResponse.json(defaultConfig);
    }

    const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config: SystemConfig = JSON.parse(configData);

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error reading system config:', error);
    return NextResponse.json(
      { error: 'Failed to load system configuration' },
      { status: 500 }
    );
  }
}

// PUT - Update system configuration
export async function PUT(request: NextRequest) {
  try {
    const updates: Partial<SystemConfig> = await request.json();

    // Load current config or create default
    let currentConfig: SystemConfig;
    if (fs.existsSync(CONFIG_PATH)) {
      const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
      currentConfig = JSON.parse(configData);
    } else {
      currentConfig = { financeEnabled: true };
    }

    // Apply updates
    const newConfig: SystemConfig = {
      ...currentConfig,
      ...updates
    };

    // Save updated config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');

    return NextResponse.json(newConfig);
  } catch (error) {
    console.error('Error updating system config:', error);
    return NextResponse.json(
      { error: 'Failed to update system configuration' },
      { status: 500 }
    );
  }
}