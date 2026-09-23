import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from '../config.ts';

/**
 * SQLite access layer (Node built-in `node:sqlite`).
 *
 * This class is the ONLY place SQLite specifics live for the application.
 * The strategy: use a portable, SQL-standard-ish surface here so the
 * application layer (`repositories.ts`) can migrate to PostgreSQL later by
 * swapping this class for a `node-postgres` implementation behind the same
 * method signatures.
 */

let db: DatabaseSync | null = null;

export function openDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(config.dataDir, { recursive: true });
  db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  return db;
}

export function getDb(): DatabaseSync {
  return db ?? openDb();
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/** Run `fn` inside a transaction (rollback on throw, commit on success). */
export function withTx<T>(fn: () => T): T {
  const d = getDb();
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

// Convenience typed helpers mirroring what a future Postgres client wrapper would offer.
export type Row = Record<string, unknown>;
export type SqlValue = string | number | bigint | null | Uint8Array | boolean;

type SqlInput = string | number | bigint | null | Uint8Array;

/** node:sqlite does not accept booleans — normalize to 0/1. */
function normalizeParams(params: ReadonlyArray<SqlValue>): SqlInput[] {
  return params.map((v): SqlInput => (typeof v === 'boolean' ? (v ? 1 : 0) : v));
}

/** Run a statement with positional params and return the lastInsertRowid. */
export function execute(sql: string, params: SqlValue[] = []): number | bigint {
  const d = getDb();
  return d.prepare(sql).run(...normalizeParams(params)).lastInsertRowid;
}

/** Run a statement and return count of changes. */
export function executeChange(sql: string, params: SqlValue[] = []): number {
  const d = getDb();
  return Number(d.prepare(sql).run(...normalizeParams(params)).changes);
}

/** Query multiple rows. */
export function all<T = Row>(sql: string, params: SqlValue[] = []): T[] {
  const d = getDb();
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