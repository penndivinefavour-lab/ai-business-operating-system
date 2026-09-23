/**
 * AI Business Operating System — Authentication & Authorization
 * 
 * Secure password handling using Node.js built-in crypto (scrypt).
 * Session tokens are random hex strings stored in memory.
 * All authenticated routes verify the session AND check tenant ownership.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export interface Session {
  accountId: number;
  email: string;
  name: string;
  role: 'owner' | 'staff' | 'admin';
  businessId?: number;
  businessName?: string;
  exp: number;
}

// In-memory session store (sufficient for MVP; can be replaced with Redis for production)
const tokens = new Map<string, Session>();

const SESSION_DURATION_MS = 24 * 3600 * 1000; // 24 hours

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const check = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return check.length === expected.length && timingSafeEqual(check, expected);
}

export function createToken(session: Omit<Session, 'exp'>): string {
  const token = randomBytes(32).toString('hex');
  tokens.set(token, { ...session, exp: Date.now() + SESSION_DURATION_MS });
  return token;
}

export function validateToken(token: string): Session | null {
  const session = tokens.get(token);
  if (!session) return null;
  if (session.exp < Date.now()) {
    tokens.delete(token);
    return null;
  }
  return session;
}

export function destroyToken(token: string): void {
  tokens.delete(token);
}

export function destroyAllSessionsForAccount(accountId: number): void {
  for (const [token, session] of tokens.entries()) {
    if (session.accountId === accountId) {
      tokens.delete(token);
    }
  }
}

/**
 * Authenticate a request from either:
 * 1. Authorization: Bearer <token> header
 * 2. Cookie: session=<token>
 */
export function authenticateRequest(req: IncomingMessage): Session | null {
  // Check Authorization header first
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return validateToken(auth.slice(7));
  }

  // Check cookie
  const cookie = req.headers.cookie;
  if (cookie) {
    const match = cookie.match(/session=([^;]+)/);
    if (match) {
      return validateToken(match[1]);
    }
  }

  return null;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}
