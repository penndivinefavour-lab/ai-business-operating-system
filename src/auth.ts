/**
 * AI Business Operating System — Production-Ready Authentication & Sessions
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { config } from './config.ts';
import { execute, first } from './db/client.ts';
import { writeAudit } from './db/repositories.ts';
import { nowIso } from './core/time.ts';

export interface Session {
  token: string;
  account_id: number;
  business_id: number | null;
  created_at: string;
  last_active: string;
  ip_hash: string;
  user_agent_hash: string;
  email?: string;
  name?: string;
  role?: string;
  businessName?: string;
}

function hashIp(ip: string): string {
  return scryptSync(ip, 'ip-salt', 16).toString('hex').slice(0, 16);
}

function hashUa(ua: string): string {
  return scryptSync(ua, 'ua-salt', 16).toString('hex').slice(0, 16);
}

export function createSession(accountId: number, businessId: number | null, ip: string, ua: string): Session {
  const token = randomBytes(32).toString('hex');
  const now = nowIso();
  execute(
    'INSERT INTO sessions (token, account_id, business_id, created_at, last_active, ip_hash, user_agent_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [token, accountId, businessId, now, now, hashIp(ip), hashUa(ua)]
  );
  return { token, account_id: accountId, business_id: businessId, created_at: now, last_active: now, ip_hash: '', user_agent_hash: '' };
}

export function getSession(token: string): Session | undefined {
  const s = first<Session>(
    'SELECT token, account_id, business_id, created_at, last_active, ip_hash, user_agent_hash FROM sessions WHERE token = ?',
    [token]
  );
  if (s) {
    execute('UPDATE sessions SET last_active = ? WHERE token = ?', [nowIso(), token]);
  }
  return s;
}

export function setSessionBusiness(token: string, businessId: number): void {
  execute('UPDATE sessions SET business_id = ? WHERE token = ?', [businessId, token]);
}

export function destroySession(token: string): void {
  execute('DELETE FROM sessions WHERE token = ?', [token]);
}

export function destroyAllSessionsForAccount(accountId: number): void {
  execute('DELETE FROM sessions WHERE account_id = ?', [accountId]);
}

export function cleanupExpiredSessions(maxAgeHours: number = 24): void {
  const cutoff = new Date(Date.now() - maxAgeHours * 3600000).toISOString();
  execute('DELETE FROM sessions WHERE last_active < ?', [cutoff]);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const check = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return check.length === expected.length && timingSafeEqual(check, expected);
}

export function generateCsrfToken(sessionToken: string): string {
  return scryptSync(sessionToken, 'csrf-salt', 32).toString('hex');
}

export function verifyCsrfToken(sessionToken: string, csrfToken: string): boolean {
  const expected = generateCsrfToken(sessionToken);
  const a = Buffer.from(csrfToken, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function getSessionCookie(req: { headers: { cookie?: string } }): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(';').map(c => c.trim().split('='));
  for (const [name, ...rest] of cookies) {
    if (name === 'session') return rest.join('=');
  }
  return undefined;
}

export function setSessionCookieHeaders(token: string): string[] {
  const maxAge = config.sessionMaxAgeHours * 3600;
  const secure = config.cookieSecure ? 'Secure; ' : '';
  return [
    `session=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; ${secure}SameSite=Lax`
  ];
}

export function clearSessionCookieHeaders(): string[] {
  const secure = config.cookieSecure ? 'Secure; ' : '';
  return [
    `session=; HttpOnly; Path=/; Max-Age=0; ${secure}SameSite=Lax`
  ];
}

export function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader) return undefined;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : undefined;
}

const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}

// Remove control characters except tab (0x09), newline (0x0a), carriage return (0x0d)
function stripControlChars(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) {
      result += text[i];
    }
  }
  return result;
}

export function sanitizeText(text: string, maxLength: number = 1000): string {
  if (!text) return '';
  return stripControlChars(text.slice(0, maxLength));
}

export function sanitizeString(text: string, maxLength: number = 200): string {
  if (!text) return '';
  return stripControlChars(text.slice(0, maxLength));
}

// ─── Compatibility with existing server.ts ────────────────────────────────

export function createToken(data: {
  accountId: number;
  email: string;
  name: string;
  role: string;
  businessId?: number | null;
  businessName?: string;
}): string {
  return createSession(
    data.accountId,
    data.businessId ?? null,
    '0.0.0.0',
    'server'
  ).token;
}

export function destroyToken(token: string): void {
  destroySession(token);
}

export function authenticateRequest(req: {
  headers: { authorization?: string; cookie?: string };
}): Session | undefined {
  const token = extractBearerToken(req.headers.authorization) || getSessionCookie(req);
  if (!token) return undefined;
  return getSession(token);
}
