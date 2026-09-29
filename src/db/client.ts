/**
 * Database client — dual-mode SQLite / Turso libSQL adapter.
 *
 * LOCAL MODE (default):
 *   Uses Node built-in `node:sqlite` (DatabaseSync) for synchronous operations.
 *   Zero configuration required; works with the existing .env.example values.
 *
 * TURSO MODE (production):
 *   Activated ONLY when BOTH env vars are set:
 *     TURSO_DATABASE_URL  e.g. libsql://your-db.turso.io
 *     TURSO_AUTH_TOKEN    e.g. <token>
 *   Falls back to local mode if either variable is missing.
 *
 * Mixed mode (only one var set):
 *   Throws at startup — do NOT partially configure Turso.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.ts';

// ─── Turso env detection ─────────────────────────────────────────────────────

export const TURSO_DB_URL = process.env.TURSO_DATABASE_URL ?? '';
export const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? '';

/** True when both Turso env vars are explicitly set (non-empty). */
export const IS_TURSO_MODE = (): boolean => {
  return !!TURSO_DB_URL && !!TURSO_AUTH_TOKEN;
};

/**
 * Throws a clear configuration error when only one Turso variable is set.
 * Call this early (e.g. in server.ts before openDb) so partial configs fail fast.
 */
export function assertTursoConfigOrThrow(): void {
  if (!TURSO_DB_URL && !TURSO_AUTH_TOKEN) return; // nothing configured → local mode OK
  if (TURSO_DB_URL && TURSO_AUTH_TOKEN) return; // fully configured → proceed
  // Only one set → ambiguous
  throw new Error(
    'Turso database configuration is incomplete.\n' +
    'Set BOTH environment variables or neither:\n' +
    '  TURSO_DATABASE_URL=<your-libsql-url>\n' +
    '  TURSO_AUTH_TOKEN=<your-auth-token>\n' +
    '(Both must be present together for production mode.)'
  );
}

// ─── Local (sync) SQLite layer ───────────────────────────────────────────────

let localDb: DatabaseSync | null = null;

export function openLocalDb(): DatabaseSync {
  if (localDb) return localDb;
  mkdirSync(config.dataDir, { recursive: true });
  localDb = new DatabaseSync(config.dbPath);
  localDb.exec('PRAGMA journal_mode = WAL;');
  localDb.exec('PRAGMA foreign_keys = ON;');
  localDb.exec('PRAGMA busy_timeout = 5000;');
  return localDb;
}

export function getLocalDb(): DatabaseSync {
  return localDb ?? openLocalDb();
}

export function closeLocalDb(): void {
  if (localDb) {
    localDb.close();
    localDb = null;
  }
}

// ─── Turso (async) client layer ──────────────────────────────────────────────

let _tursoClient: Awaited<ReturnType<typeof import('@libsql/client').createClient>> | null = null;

/** Lazily creates and caches the Turso client on first access. */
export async function getTursoClient(): Promise<Awaited<ReturnType<typeof import('@libsql/client').createClient>>> {
  if (_tursoClient) return _tursoClient;
  const { createClient } = await import('@libsql/client');
  _tursoClient = createClient({
    url: TURSO_DB_URL,
    authToken: TURSO_AUTH_TOKEN,
    intMode: 'bigint', // preserve integer precision
  });
  return _tursoClient;
}

/** Release the Turso connection (call on shutdown or between tests). */
export async function closeTursoClient(): Promise<void> {
  if (_tursoClient) {
    await _tursoClient.close();
    _tursoClient = null;
  }
}

// ─── Common types ─────────────────────────────────────────────────────────────

/** Row returned by queries (keys are column names). */
export type Row = Record<string, unknown>;

/** Parameter value accepted by both SQLite and libSQL. */
export type SqlValue = string | number | bigint | null | Uint8Array | boolean;

// ─── Param normalisation helpers ──────────────────────────────────────────────

/** node:sqlite does not accept booleans — normalize to 0/1. libSQL accepts both. */
function normalizeParams(params: ReadonlyArray<SqlValue>): Array<string | number | bigint | null | Uint8Array> {
  return params.map((v): string | number | bigint | null | Uint8Array => (typeof v === 'boolean' ? (v ? 1 : 0) : v));
}

// ─── Public sync API (local mode) ─────────────────────────────────────────────

/** Run a statement with positional params and return the lastInsertRowid. */
export function execute(sql: string, params: SqlValue[] = []): number | bigint {
  const d = getLocalDb();
  const normalized = normalizeParams(params);
  return d.prepare(sql).run(...normalized).lastInsertRowid;
}

/** Run a statement and return count of changes. */
export function executeChange(sql: string, params: SqlValue[] = []): number {
  const d = getLocalDb();
  return Number(d.prepare(sql).run(...normalizeParams(params)).changes);
}

/** Query multiple rows. */
export function all<T = Row>(sql: string, params: SqlValue[] = []): T[] {
  const d = getLocalDb();
  return d.prepare(sql).all(...normalizeParams(params)) as T[];
}

/** Query a single row (first) or undefined. */
export function first<T = Row>(sql: string, params: SqlValue[] = []): T | undefined {
  const result = all<T>(sql, params);
  return result[0];
}

/** Query a single scalar value. */
export function scalar<T = string | number>(sql: string, params: SqlValue[] = [], fallback: T): T {
  const row = first(sql, params);
  if (!row) return fallback;
  const keys = Object.keys(row);
  if (keys.length === 0) return fallback;
  return row[keys[0]!] as T;
}

/** Run `fn` inside a transaction (rollback on throw, commit on success). */
export function withTx<T>(fn: () => T): T {
  const d = getLocalDb();
  d.exec('BEGIN');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

// ─── Public async API (Turso mode) ────────────────────────────────────────────

/**
 * Async execute — runs a write statement and returns the insert ID.
 * Returns number for compatibility with callers expecting number|bigint.
 */
export async function executeAsync(sql: string, params: SqlValue[] = []): Promise<number> {
  const client = await getTursoClient();
  const result = await client.execute(sql, normalizeParams(params));
  // libSQL ResultSet has lastInsertRowId for INSERT statements
  return Number(result.lastInsertRowid ?? 0);
}

/** Async executeChange — returns the number of affected rows. */
export async function executeChangeAsync(sql: string, params: SqlValue[] = []): Promise<number> {
  const client = await getTursoClient();
  const result = await client.execute(sql, normalizeParams(params));
  return Number(result.rowsAffected ?? 0);
}

/** Async query all rows. */
export async function allAsync<T = Row>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  const client = await getTursoClient();
  const result = await client.execute(sql, normalizeParams(params));
  return result.rows as T[];
}

/** Async query single row (first) or undefined. */
export async function firstAsync<T = Row>(sql: string, params: SqlValue[] = []): Promise<T | undefined> {
  const rows = await allAsync<T>(sql, params);
  return rows[0];
}

/** Async query single scalar value. */
export async function scalarAsync<T = string | number>(sql: string, params: SqlValue[] = [], fallback: T): Promise<T> {
  const row = await firstAsync(sql, params);
  if (!row) return fallback;
  const keys = Object.keys(row);
  if (keys.length === 0) return fallback;
  return row[keys[0]!] as T;
}

/** Async transaction: runs `fn` inside a transaction, rolls back on throw. */
export async function withTxAsync<T>(fn: () => Promise<T>): Promise<T> {
  const client = await getTursoClient();
  const tx = await client.transaction();
  try {
    const result = await fn();
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback().catch(() => {}); // ignore rollback errors
    throw err;
  }
}

// ─── Convenience: openDb / closeDb aliases ─────────────────────────────────────

/**
 * Open the active database (local sync or initializes async Turso client).
 * In local mode returns DatabaseSync; in Turso mode resolves to void after init.
 */
export function openDb() {
  if (IS_TURSO_MODE()) {
    // Turso client is lazy — first actual query will create it.
    console.log('[db] Turso mode active — using remote libSQL database');
    return;
  }
  return openLocalDb();
}

/** Get the active database handle (local mode only; Turso uses async client). */
export function getDb(): DatabaseSync | null {
  if (IS_TURSO_MODE()) return null;
  return getLocalDb();
}

/** Close the active database. */
export async function closeDb(): Promise<void> {
  if (IS_TURSO_MODE()) {
    await closeTursoClient();
  } else {
    closeLocalDb();
  }
}
