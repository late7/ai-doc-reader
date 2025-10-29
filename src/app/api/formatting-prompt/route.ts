import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import formattingPrompt from '@/config/formattingPrompt.json';

const filePath = path.join(process.cwd(), 'src', 'config', 'formattingPrompt.json');

export async function GET() {
  try {
    return NextResponse.json(formattingPrompt);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load formatting prompt' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (typeof body?.prompt !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    await fs.writeFile(filePath, JSON.stringify({ prompt: body.prompt }, null, 2), 'utf-8');
    return NextResponse.json({ prompt: body.prompt });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to save formatting prompt' }, { status: 500 });
  }
}
