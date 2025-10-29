import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

// Ensure this route is always dynamic and not statically optimized / cached
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
  const configPath = path.join(process.cwd(), 'src/config/categoryPrompts.json');
    const configData = await readFile(configPath, 'utf8');
    const categoriesConfig = JSON.parse(configData);
    return NextResponse.json(categoriesConfig, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache'
      }
    });
  } catch (error) {
    console.error('Error reading categories config:', error);
    return NextResponse.json(
      { error: 'Failed to read categories configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    
  const configPath = path.join(process.cwd(), 'src', 'config', 'categoryPrompts.json');
    await writeFile(configPath, JSON.stringify(data, null, 2), 'utf8');

    return NextResponse.json({ success: true }, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Error saving categories config:', error);
    return NextResponse.json(
      { error: 'Failed to save categories configuration' },
      { status: 500 }
    );
  }
}
