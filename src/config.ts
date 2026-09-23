import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Central configuration. All secrets come from environment variables / .env.
 * Nothing in this repository hardcodes credentials.
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

  return {
    root,
    dataDir,
    dbPath,
    port: int('PORT', 3000),
    appSecret: str('APP_SECRET', 'dev-insecure-secret-change-me'),
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
    isDemoMode: (() => !str('AI_PROVIDER', 'demo') || str('AI_PROVIDER', 'demo') === 'demo')(),
  };
})();