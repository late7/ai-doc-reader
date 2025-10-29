import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const filePath = path.join(process.cwd(), 'src', 'config', 'globalPrompts.json');

export async function GET() {
  try {
    const data = await readFile(filePath, 'utf8');
    const json = JSON.parse(data);
    return NextResponse.json(json);
  } catch (error) {
    console.error('Error reading global prompts:', error);
    return NextResponse.json({ error: 'Failed to read global prompts' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.prompts || typeof body.prompts !== 'object') {
      return NextResponse.json({ error: 'Invalid payload: missing prompts' }, { status: 400 });
    }
    await writeFile(filePath, JSON.stringify(body, null, 2), 'utf8');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving global prompts:', error);
    return NextResponse.json({ error: 'Failed to save global prompts' }, { status: 500 });
  }
}
