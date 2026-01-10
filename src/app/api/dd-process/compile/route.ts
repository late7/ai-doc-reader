import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { workspaceSlug } = body;

        if (!workspaceSlug) {
            return NextResponse.json(
                { success: false, message: 'workspaceSlug is required' },
                { status: 400 }
            );
        }

        const projectRoot = process.cwd();
        const storageDir = path.join(projectRoot, 'storage', workspaceSlug);
        const processedDir = path.join(storageDir, 'processed');
        const statusFile = path.join(processedDir, 'compile_status.json');
        const outputFile = path.join(processedDir, 'master_document.json');
        const templateFile = path.join(projectRoot, 'master-document-template.json');
        const scriptPath = path.join(projectRoot, 'dd_tabs_compile.py');

        // Create processed directory if it doesn't exist
        await fs.mkdir(processedDir, { recursive: true });

        // Check if storage directory exists
        try {
            await fs.access(storageDir);
        } catch {
            return NextResponse.json(
                { success: false, message: `Storage directory not found for workspace: ${workspaceSlug}` },
                { status: 404 }
            );
        }

        // Initialize status file
        await fs.writeFile(
            statusFile,
            JSON.stringify({ status: 'running', progress: 'Starting compilation...', error: null }),
            'utf-8'
        );

        // Spawn the Python script
        const pythonProcess = spawn('python', [
            scriptPath,
            '--docs', storageDir,
            '--template', templateFile,
            '--out-json', outputFile,
            '--status-file', statusFile,
        ], {
            cwd: projectRoot,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
        });

        // Handle stdout for progress updates
        pythonProcess.stdout.on('data', async (data) => {
            const message = data.toString().trim();
            if (message) {
                try {
                    const currentStatus = JSON.parse(await fs.readFile(statusFile, 'utf-8'));
                    currentStatus.progress = message;
                    await fs.writeFile(statusFile, JSON.stringify(currentStatus), 'utf-8');
                } catch {
                    // Ignore errors during status update
                }
            }
        });

        // Handle completion
        pythonProcess.on('close', async (code) => {
            try {
                if (code === 0) {
                    await fs.writeFile(
                        statusFile,
                        JSON.stringify({ status: 'completed', progress: 'Compilation complete!', error: null }),
                        'utf-8'
                    );
                } else {
                    const currentStatus = JSON.parse(await fs.readFile(statusFile, 'utf-8').catch(() => '{}'));
                    await fs.writeFile(
                        statusFile,
                        JSON.stringify({
                            status: 'error',
                            progress: '',
                            error: currentStatus.error || `Process exited with code ${code}`,
                        }),
                        'utf-8'
                    );
                }
            } catch (e) {
                console.error('Error updating final status:', e);
            }
        });

        // Handle stderr for errors
        pythonProcess.stderr.on('data', async (data) => {
            const message = data.toString().trim();
            console.error('Python stderr:', message);
            try {
                const currentStatus = JSON.parse(await fs.readFile(statusFile, 'utf-8'));
                currentStatus.error = message;
                await fs.writeFile(statusFile, JSON.stringify(currentStatus), 'utf-8');
            } catch {
                // Ignore errors during status update
            }
        });

        // Unref the process so it doesn't block Node.js exit
        pythonProcess.unref();

        return NextResponse.json({
            success: true,
            message: 'Compilation started',
        });
    } catch (error) {
        console.error('Error starting compilation:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to start compilation' },
            { status: 500 }
        );
    }
}
