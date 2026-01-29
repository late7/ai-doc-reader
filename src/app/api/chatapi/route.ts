import { NextRequest, NextResponse } from 'next/server';
import { anythingLLM } from '@/lib/anythingllm';
import { logger } from '@/lib/logger';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(process.cwd(), 'src', 'config', 'auth.json');

function validateBasicAuth(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        return false;
    }

    try {
        const base64Credentials = authHeader.slice(6); // Remove 'Basic ' prefix
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [username, password] = credentials.split(':');

        // Read credentials from auth.json
        const raw = fs.readFileSync(AUTH_FILE, 'utf8');
        const data = JSON.parse(raw);
        const match = data.users.find((u: any) => u.username === username && u.password === password);

        return !!match;
    } catch (error) {
        logger.error('Error validating auth:', error);
        return false;
    }
}

export async function POST(request: NextRequest) {
    // Validate Basic Auth
    if (!validateBasicAuth(request)) {
        return new NextResponse('Unauthorized', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic realm="Chat API"',
                'Content-Type': 'text/plain',
            },
        });
    }

    try {
        // Get workspace from query parameter
        const { searchParams } = new URL(request.url);
        const workspace = searchParams.get('workspace');

        if (!workspace) {
            return new NextResponse('Missing required query parameter: workspace', {
                status: 400,
                headers: { 'Content-Type': 'text/plain' },
            });
        }

        // Get message from request body (plain text)
        const message = await request.text();

        if (!message || message.trim() === '') {
            return new NextResponse('Missing message in request body', {
                status: 400,
                headers: { 'Content-Type': 'text/plain' },
            });
        }

        logger.info(`ChatAPI request for workspace: ${workspace}`);
        logger.debug(`Message: ${message}`);

        // Send message to AnythingLLM
        const result = await anythingLLM.sendMessage(workspace, message.trim());

        logger.debug('ChatAPI response received:', result);

        // Return just the text response
        const textResponse = result.textResponse || result.response || '';

        return new NextResponse(textResponse, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    } catch (error) {
        logger.error('Error in chatapi:', error);
        const errorMessage = error instanceof Error ? error.message : 'An error occurred while processing your request';
        return new NextResponse(errorMessage, {
            status: 500,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
}

// Also support GET for simple testing (returns usage info)
export async function GET(request: NextRequest) {
    // Validate Basic Auth
    if (!validateBasicAuth(request)) {
        return new NextResponse('Unauthorized', {
            status: 401,
            headers: {
                'WWW-Authenticate': 'Basic realm="Chat API"',
                'Content-Type': 'text/plain',
            },
        });
    }

    return new NextResponse(
        `Chat API Usage:
POST /chatapi?workspace=<workspace-slug>
Content-Type: text/plain
Authorization: Basic <base64(username:password)>
Body: Your question as plain text

Example:
POST /chatapi?workspace=test
Body: What is the name of the company?

Response: Plain text answer from the AI`,
        {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        }
    );
}
