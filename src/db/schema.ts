import { getDb } from './client.ts';

/**
 * Schema for the AI Digital Front Desk.
 *
 * Multi-tenancy: every business table carries `hotel_id`; all application
 * queries MUST filter by hotel_id (enforced by repositories + tests). This
 * matches the "pool with tenant column" SaaS pattern and maps cleanly onto
 * PostgreSQL row-level security later.
 */

const TABLES: Array<[string, string]> = [
  [
    'platform_meta',
    `CREATE TABLE IF NOT EXISTS platform_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ],
  [
    'hotels',
    `CREATE TABLE IF NOT EXISTS hotels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      whatsapp_phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      country TEXT DEFAULT 'Cameroon',
      currency TEXT DEFAULT 'XAF',
      check_in_time TEXT DEFAULT '14:00',
      check_out_time TEXT DEFAULT '12:00',
      tax_rate REAL DEFAULT 0,
      timezone TEXT DEFAULT 'Africa/Douala',
      demo_enabled INTEGER DEFAULT 0,
      settings TEXT DEFAULT '{}',
      created_at TEXT NOT NULL
    )`,
  ],
  [
    'hotel_users',
    `CREATE TABLE IF NOT EXISTS hotel_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    )`,
  ],
  [
    'rooms',
    `CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      number TEXT NOT NULL,
      name TEXT DEFAULT '',
      room_type TEXT NOT NULL,
      floor INTEGER DEFAULT 1,
      capacity INTEGER NOT NULL DEFAULT 2,
      base_price REAL NOT NULL,
      amenities TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'clean',
      maintenance INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    )`,
  ],
  [
    'customers',
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      language TEXT DEFAULT 'fr',
      notes TEXT DEFAULT '',
      source TEXT DEFAULT 'ai',
      created_at TEXT NOT NULL
    )`,
  ],
  [
    'conversations',
    `CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      channel TEXT NOT NULL DEFAULT 'web',
      status TEXT NOT NULL DEFAULT 'open',
      intent_last TEXT DEFAULT '',
      started_at TEXT NOT NULL,
      last_message_at TEXT NOT NULL
    )`,
  ],
  [
    'messages',
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      hotel_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT DEFAULT 'text',
      ref_id INTEGER,
      created_at TEXT NOT NULL
    )`,
  ],
  [
    'reservations',
    `CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      lead_id INTEGER,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      guests INTEGER NOT NULL DEFAULT 1,
      room_ids TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'requested',
      total_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'XAF',
      source TEXT NOT NULL DEFAULT 'ai',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      confirmed_at TEXT
    )`,
  ],
  [
    'leads',
    `CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      name TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      intent TEXT DEFAULT '',
      source TEXT DEFAULT 'ai',
      status TEXT NOT NULL DEFAULT 'new',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    )`,
  ],
  [
    'knowledge_items',
    `CREATE TABLE IF NOT EXISTS knowledge_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      category TEXT DEFAULT 'general',
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      keywords TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1
    )`,
  ],
  [
    'feedback',
    `CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      reservation_id INTEGER,
      rating INTEGER,
      comment TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    )`,
  ],
  [
    'followups',
    `CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      conversation_id INTEGER,
      due_at TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    )`,
  ],
  [
    'escalations',
    `CREATE TABLE IF NOT EXISTS escalations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      conversation_id INTEGER,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      reason TEXT DEFAULT '',
      requested_by_guest INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to TEXT DEFAULT '',
      handled_at TEXT,
      created_at TEXT NOT NULL
    )`,
  ],
  [
    'audit_log',
    `CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER,
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT DEFAULT '',
      entity_id INTEGER,
      details TEXT DEFAULT '',
      created_at TEXT NOT NULL
    )`,
  ],
  [
    'agent_runs',
    `CREATE TABLE IF NOT EXISTS agent_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL,
      conversation_id INTEGER,
      intent TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0,
      actions TEXT DEFAULT '[]',
      latency_ms INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
  ],
];

export function migrate(): void {
  const db = getDb();
  for (const [, ddl] of TABLES) db.exec(ddl);
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_reservations_hotel_dates ON reservations(hotel_id, check_in, check_out, status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customers_hotel_phone ON customers(hotel_id, phone)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_audit_hotel ON audit_log(hotel_id, created_at)');
  db.exec("CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON knowledge_items(hotel_id, keywords)");
}