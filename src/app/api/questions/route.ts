import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    console.log('Questions GET route called');
    const configPath = path.join(process.cwd(), 'src/config/questions.json');
    console.log('Config path:', configPath);
    const configData = await readFile(configPath, 'utf8');
    console.log('Config data read successfully');
    const questionsConfig = JSON.parse(configData);
    console.log('Config parsed successfully');
    return NextResponse.json(questionsConfig);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const updatedConfig = await request.json();
    
    // Validate the structure
    if (!updatedConfig.questions || !Array.isArray(updatedConfig.questions)) {
      return NextResponse.json(
        { error: 'Invalid questions configuration' },
        { status: 400 }
      );
    }

    // Write to file
    const configPath = path.join(process.cwd(), 'src/config/questions.json');
    await writeFile(configPath, JSON.stringify(updatedConfig, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating questions:', error);
    return NextResponse.json(
      { error: 'Failed to update questions' },
      { status: 500 }
    );
  }
}
