import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

const AUTH_FILE = path.join(process.cwd(), 'src', 'config', 'auth.json');

// Simple in-memory session store (reset on server restart)
const sessions = new Map<string, string>(); // token -> username

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const raw = fs.readFileSync(AUTH_FILE, 'utf8');
    const data = JSON.parse(raw);
    const match = data.users.find((u: any) => u.username === username && u.password === password);
    if (!match) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, username);
    const timestamp = new Date().toISOString();
    logger.info(`User logged in: ${username} at ${timestamp}`);

    // Set HttpOnly cookie
    const res = NextResponse.json({ ok: true });
    res.cookies.set('auth_token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
    return res;
  } catch (e) {
    console.error('Login error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export function validateAuth(req: NextRequest): string | null {
  const token = req.cookies.get('auth_token')?.value;
  if (!token) return null;
  return sessions.get(token) || null;
}
