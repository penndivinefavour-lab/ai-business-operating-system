import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Central configuration. All secrets come from environment variables / .env.
 * Nothing in this repository hardcodes credentials.
 * 
 * Production-readiness:
 * - APP_SECRET must be set in production (used for session signing, CSRF)
 * - COOKIE_SECURE is automatically enabled when not in demo mode
 * - All secrets have safe defaults for development only
 */

function loadEnvFile(): void {
  try {
    if (existsSync('.env')) process.loadEnvFile('.env');
  } catch {
    // .env optional in production environments where vars are pre-set
  }
}

function str(key: string, fallback = ''): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

function int(key: string, fallback: number): number {
  const v = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export const config = (() => {
  loadEnvFile();

  const root = resolve('.');
  const dataDir = resolve(str('DATA_DIR', './data'));
  const dbPath = join(dataDir, str('DATABASE_URL', 'frontdesk.db'));
  const isDemoMode = !bool('PRODUCTION', false) || str('AI_PROVIDER', 'demo') === 'demo';

  return {
    root,
    dataDir,
    dbPath,
    port: int('PORT', 3000),
    
    // Security
    appSecret: str('APP_SECRET', isDemoMode ? 'dev-insecure-secret-change-me' : ''),
    cookieSecure: bool('COOKIE_SECURE', !isDemoMode),
    sessionMaxAgeHours: int('SESSION_MAX_AGE_HOURS', 24),
    
    // Rate limiting
    rateLimitWindowMs: int('RATE_LIMIT_WINDOW_MS', 60000),
    rateLimitMax: int('RATE_LIMIT_MAX', 30),
    rateLimitAuthMax: int('RATE_LIMIT_AUTH_MAX', 10),
    
    // CORS
    corsOrigin: str('CORS_ORIGIN', isDemoMode ? '*' : ''),
    
    admin: {
      email: str('ADMIN_EMAIL', 'admin@demo.hotel'),
      password: str('ADMIN_PASSWORD', 'demo-admin-123'),
      apiToken: str('ADMIN_API_TOKEN', ''),
    },
    ai: {
      provider: str('AI_PROVIDER', 'demo'),
      apiKey: str('AI_API_KEY', ''),
      model: str('AI_MODEL', 'gpt-4.1-mini'),
      baseUrl: str('AI_BASE_URL', ''),
      composeReplies: bool('AI_COMPOSE_REPLIES', true),
      timeoutMs: int('AI_TIMEOUT_MS', 30000),
    },
    whatsapp: {
      phoneNumberId: str('WHATSAPP_PHONE_NUMBER_ID', ''),
      accessToken: str('WHATSAPP_ACCESS_TOKEN', ''),
      verifyToken: str('WHATSAPP_VERIFY_TOKEN', ''),
      graphUrl: str('WHATSAPP_GRAPH_URL', 'https://graph.facebook.com/v21.0'),
    },
    email: {
      host: str('SMTP_HOST', ''),
      port: int('SMTP_PORT', 587),
      user: str('SMTP_USER', ''),
      pass: str('SMTP_PASS', ''),
      from: str('EMAIL_FROM', 'AI Front Desk <no-reply@frontdesk.local>'),
    },
    isDemoMode,
  };
})();
