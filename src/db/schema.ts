import { getDb } from './client.ts';

/**
 * Schema for the AI Digital Front Desk.
 *
 * Multi-tenancy: every business table carries `hotel_id`; all application
 * queries MUST filter by hotel_id (enforced by repositories + tests). This
 * matches the "pool with tenant column" SaaS pattern and maps cleanly onto
 * PostgreSQL row-level security later.
 *
 * Schema versioning: the `schema_migrations` table tracks which DDL batches
 * have been applied. New migrations are idempotent (IF NOT EXISTS) and appended
 * to the MIGRATIONS array with a unique key.
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
    'schema_migrations',
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      key TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
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

// ─── AI Employee & Onboarding tables (Phase 2) ─────────────────────────────

const PHASE2_TABLES: Array<[string, string]> = [
  [
    'employee_profiles',
    `CREATE TABLE IF NOT EXISTS employee_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL UNIQUE REFERENCES hotels(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Assistant',
      role TEXT NOT NULL DEFAULT 'Receptionist',
      personality TEXT NOT NULL DEFAULT 'professional_friendly',
      tone TEXT NOT NULL DEFAULT 'warm_professional',
      languages TEXT NOT NULL DEFAULT 'fr,en',
      avatar_emoji TEXT NOT NULL DEFAULT '👩‍💼',
      welcome_message TEXT DEFAULT '',
      escalation_trigger TEXT DEFAULT 'guest_request',
      escalation_message TEXT DEFAULT '',
      pause_on_escalation INTEGER NOT NULL DEFAULT 1,
      max_response_length INTEGER NOT NULL DEFAULT 500,
      custom_greeting TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      onboarding_step INTEGER NOT NULL DEFAULT 0,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ],
  [
    'business_services',
    `CREATE TABLE IF NOT EXISTS business_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      price REAL,
      price_unit TEXT DEFAULT 'per_unit',
      available INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
  ],
  [
    'business_policies',
    `CREATE TABLE IF NOT EXISTS business_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      policy_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
  ],
  [
    'onboarding_checklist',
    `CREATE TABLE IF NOT EXISTS onboarding_checklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL,
      step_name TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      UNIQUE(hotel_id, step_key)
    )`,
  ],
];

const INDEXES: string[] = [
  'CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_reservations_hotel_dates ON reservations(hotel_id, check_in, check_out, status)',
  'CREATE INDEX IF NOT EXISTS idx_customers_hotel_phone ON customers(hotel_id, phone)',
  'CREATE INDEX IF NOT EXISTS idx_audit_hotel ON audit_log(hotel_id, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON knowledge_items(hotel_id, keywords)',
  'CREATE INDEX IF NOT EXISTS idx_employee_hotel ON employee_profiles(hotel_id)',
  'CREATE INDEX IF NOT EXISTS idx_services_hotel ON business_services(hotel_id, available)',
  'CREATE INDEX IF NOT EXISTS idx_policies_hotel ON business_policies(hotel_id, active)',
  'CREATE INDEX IF NOT EXISTS idx_checklist_hotel ON onboarding_checklist(hotel_id)',
];

export function migrate(): void {
  const db = getDb();
  for (const [, ddl] of TABLES) db.exec(ddl);
  for (const [, ddl] of PHASE2_TABLES) db.exec(ddl);
  for (const idx of INDEXES) db.exec(idx);
}
