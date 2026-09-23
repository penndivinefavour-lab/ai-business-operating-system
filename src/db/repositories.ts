import { all, execute, executeChange, first, scalar } from './client.ts';
import type {
  AuditEntry,
  BusinessPolicy,
  BusinessService,
  Conversation,
  ConversationStatus,
  Customer,
  Escalation,
  FeedbackRow,
  Followup,
  Hotel,
  HotelUser,
  Intent,
  KnowledgeItem,
  Lead,
  LeadStatus,
  MessageRow,
  OnboardingChecklist,
  EmployeeProfile,
  Reservation,
  ReservationStatus,
  Room,
  Sender,
} from '../types.ts';
import { ONBOARDING_STEPS } from '../types.ts';
import { nowIso } from '../core/time.ts';

/**
 * Repository layer. Every query is tenant-scoped by `hotelId` (or reads the
 * tenant from the parent row). No un-scoped business queries are exported.
 * This is the seam that isolates the application from the storage engine so a
 * PostgreSQL adapter can be added without touching business logic.
 */

// ---------------------------------------------------------------------------
// Hotels (platform-level)
// ---------------------------------------------------------------------------

export function createHotel(h: {
  slug: string;
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  whatsappPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  currency?: string;
  checkInTime?: string;
  checkOutTime?: string;
  taxRate?: number;
  timezone?: string;
  demoEnabled?: number;
}): number {
  return Number(execute(
    `INSERT INTO hotels (slug, name, description, email, phone, whatsapp_phone, address, city, country,
      currency, check_in_time, check_out_time, tax_rate, timezone, demo_enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      h.slug, h.name, h.description ?? '', h.email ?? '', h.phone ?? '', h.whatsappPhone ?? '',
      h.address ?? '', h.city ?? '', h.country ?? 'Cameroon', h.currency ?? 'XAF',
      h.checkInTime ?? '14:00', h.checkOutTime ?? '12:00', h.taxRate ?? 0, h.timezone ?? 'Africa/Douala',
      h.demoEnabled ?? 0, nowIso(),
    ],
  ));
}

export function getHotelById(id: number): Hotel | undefined {
  return first<Hotel>('SELECT * FROM hotels WHERE id = ?', [id]);
}

export function getHotelBySlug(slug: string): Hotel | undefined {
  return first<Hotel>('SELECT * FROM hotels WHERE slug = ?', [slug]);
}

export function listHotels(): Hotel[] {
  return all<Hotel>('SELECT * FROM hotels ORDER BY created_at ASC');
}

export function updateHotel(id: number, patch: Partial<Hotel>): void {
  const allowed: Array<keyof Hotel> = [
    'name', 'description', 'email', 'phone', 'whatsapp_phone', 'address', 'city',
    'country', 'currency', 'check_in_time', 'check_out_time', 'tax_rate', 'timezone',
    'demo_enabled', 'settings',
  ];
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  for (const k of allowed) {
    const v = patch[k];
    if (v !== undefined) {
      sets.push(`${k} = ?`);
      params.push(v as string | number);
    }
  }
  if (sets.length === 0) return;
  params.push(id);
  execute(`UPDATE hotels SET ${sets.join(', ')} WHERE id = ?`, params);
}

// ---------------------------------------------------------------------------
// Hotel users (admin/staff)
// ---------------------------------------------------------------------------

export function createHotelUser(hotelId: number, name: string, email: string, passwordHash: string, role: 'admin' | 'staff'): number {
  return Number(execute(
    'INSERT INTO hotel_users (hotel_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [hotelId, name, email, passwordHash, role, nowIso()],
  ));
}

export function findUserByEmail(email: string): HotelUser | undefined {
  return first<HotelUser>('SELECT * FROM hotel_users WHERE email = ?', [email]);
}

export function findUserById(id: number): HotelUser | undefined {
  return first<HotelUser>('SELECT * FROM hotel_users WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export function createRoom(hotelId: number, r: {
  number: string; name?: string; roomType: string; floor?: number; capacity?: number;
  basePrice: number; amenities?: string; status?: Room['status']; maintenance?: number;
}): number {
  return Number(execute(
    `INSERT INTO rooms (hotel_id, number, name, room_type, floor, capacity, base_price, amenities, status, maintenance, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [hotelId, r.number, r.name ?? '', r.roomType, r.floor ?? 1, r.capacity ?? 2, r.basePrice,
      r.amenities ?? '', r.status ?? 'clean', r.maintenance ?? 0],
  ));
}

export function listRooms(hotelId: number): Room[] {
  return all<Room>('SELECT * FROM rooms WHERE hotel_id = ? ORDER BY floor, number', [hotelId]);
}

export function getRoom(hotelId: number, roomId: number): Room | undefined {
  return first<Room>('SELECT * FROM rooms WHERE hotel_id = ? AND id = ?', [hotelId, roomId]);
}

export function updateRoom(hotelId: number, roomId: number, patch: Partial<Room>): void {
  const allowed: Array<keyof Room> = ['status', 'maintenance', 'active', 'base_price', 'capacity', 'amenities'];
  const sets: string[] = [];
  const params: Array<string | number> = [];
  for (const k of allowed) {
    const v = patch[k];
    if (v !== undefined) {
      sets.push(`${k} = ?`);
      params.push(v as string | number);
    }
  }
  if (sets.length === 0) return;
  params.push(hotelId, roomId);
  execute(`UPDATE rooms SET ${sets.join(', ')} WHERE hotel_id = ? AND id = ?`, params);
}

/** Rooms that could serve `guests` people on the given stay (not maintenance, not overlapping reservation). */
export function findAvailableRooms(hotelId: number, checkIn: string, checkOut: string, guests: number): Room[] {
  const sql = `
    SELECT r.* FROM rooms r
    WHERE r.hotel_id = ?
      AND r.active = 1
      AND r.maintenance = 0
      AND r.status != 'out_of_service'
      AND r.capacity >= ?
      AND NOT EXISTS (
        SELECT 1 FROM reservations res
        WHERE res.hotel_id = r.hotel_id
          AND res.status IN ('requested','confirmed','checked_in')
          AND res.check_in < ?
          AND res.check_out > ?
          AND EXISTS (SELECT 1 FROM json_each(res.room_ids) je WHERE je.value = r.id)
      )
    ORDER BY r.base_price ASC
  `;
  return all<Room>(sql, [hotelId, guests, checkOut, checkIn]);
}

/** Validate a guest count is ≥ 1 and sane. */
export function sanitizeGuests(g: number): number {
  return Math.max(1, Math.min(50, Math.trunc(g)));
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export function findCustomerByPhone(hotelId: number, phone: string): Customer | undefined {
  return first<Customer>('SELECT * FROM customers WHERE hotel_id = ? AND phone = ?', [hotelId, phone]);
}

export function findCustomerByEmail(hotelId: number, email: string): Customer | undefined {
  return first<Customer>('SELECT * FROM customers WHERE hotel_id = ? AND email = ?', [hotelId, email]);
}

export function getCustomer(hotelId: number, customerId: number): Customer | undefined {
  return first<Customer>('SELECT * FROM customers WHERE hotel_id = ? AND id = ?', [hotelId, customerId]);
}

export function createCustomer(hotelId: number, c: { name?: string; phone?: string; email?: string; language?: string; notes?: string; source?: string }): number {
  return Number(execute(
    `INSERT INTO customers (hotel_id, name, phone, email, language, notes, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [hotelId, c.name ?? '', c.phone ?? '', c.email ?? '', c.language ?? 'fr', c.notes ?? '', c.source ?? 'ai', nowIso()],
  ));
}

export function upsertCustomerByPhone(hotelId: number, c: { name?: string; phone?: string; email?: string; language?: string; notes?: string; source?: string }): Customer {
  if (c.phone) {
    const existing = findCustomerByPhone(hotelId, c.phone);
    if (existing) {
      const merged = updateCustomer(hotelId, existing.id, {
        name: c.name || existing.name,
        email: c.email || existing.email,
        notes: c.notes || existing.notes,
      });
      return merged ?? existing;
    }
  }
  if (c.email) {
    const existing = findCustomerByEmail(hotelId, c.email);
    if (existing) {
      const merged = updateCustomer(hotelId, existing.id, {
        name: c.name || existing.name,
        phone: c.phone || existing.phone,
        notes: c.notes || existing.notes,
      });
      return merged ?? existing;
    }
  }
  const id = createCustomer(hotelId, c);
  return getCustomer(hotelId, id)!;
}

export function updateCustomer(hotelId: number, customerId: number, patch: Partial<Customer>): Customer | undefined {
  const sets: string[] = [];
  const params: Array<string | number> = [];
  for (const k of ['name', 'phone', 'email', 'language', 'notes', 'source'] as const) {
    const v = patch[k];
    if (v !== undefined) {
      sets.push(`${k} = ?`);
      params.push(v);
    }
  }
  if (sets.length > 0) {
    params.push(hotelId, customerId);
    execute(`UPDATE customers SET ${sets.join(', ')} WHERE hotel_id = ? AND id = ?`, params);
  }
  return getCustomer(hotelId, customerId);
}

export function listCustomers(hotelId: number, limit = 200): Customer[] {
  return all<Customer>('SELECT * FROM customers WHERE hotel_id = ? ORDER BY created_at DESC LIMIT ?', [hotelId, limit]);
}

export function searchCustomers(hotelId: number, term: string, limit = 20): Customer[] {
  const like = `%${term}%`;
  return all<Customer>(
    `SELECT * FROM customers WHERE hotel_id = ?
     AND (name LIKE ? OR phone LIKE ? OR email LIKE ?) ORDER BY created_at DESC LIMIT ?`,
    [hotelId, like, like, like, limit],
  );
}

export function countCustomers(hotelId: number): number {
  return scalar('SELECT COUNT(*) FROM customers WHERE hotel_id = ?', [hotelId], 0);
}

// ---------------------------------------------------------------------------
// Conversations & messages
// ---------------------------------------------------------------------------

export function createConversation(hotelId: number, customerId: number | null, channel: string): number {
  const now = nowIso();
  return Number(execute(
    'INSERT INTO conversations (hotel_id, customer_id, channel, status, started_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?)',
    [hotelId, customerId, channel, 'open', now, now],
  ));
}

export function getConversation(hotelId: number, conversationId: number): Conversation | undefined {
  return first<Conversation>('SELECT * FROM conversations WHERE hotel_id = ? AND id = ?', [hotelId, conversationId]);
}

export function getConversationForCustomer(hotelId: number, customerId: number): Conversation | undefined {
  return first<Conversation>(
    'SELECT * FROM conversations WHERE hotel_id = ? AND customer_id = ? ORDER BY last_message_at DESC LIMIT 1',
    [hotelId, customerId],
  );
}

export function updateConversationStatus(hotelId: number, conversationId: number, status: ConversationStatus, intent?: Intent | string): void {
  if (intent) {
    execute('UPDATE conversations SET status = ?, intent_last = ?, last_message_at = ? WHERE hotel_id = ? AND id = ?',
      [status, intent, nowIso(), hotelId, conversationId]);
  } else {
    execute('UPDATE conversations SET status = ?, last_message_at = ? WHERE hotel_id = ? AND id = ?',
      [status, nowIso(), hotelId, conversationId]);
  }
}

export function listConversations(hotelId: number, limit = 100): Conversation[] {
  return all<Conversation>(
    'SELECT * FROM conversations WHERE hotel_id = ? ORDER BY last_message_at DESC LIMIT ?', [hotelId, limit]);
}

export function countConversations(hotelId: number): number {
  return scalar('SELECT COUNT(*) FROM conversations WHERE hotel_id = ?', [hotelId], 0);
}

export function addMessage(hotelId: number, conversationId: number, sender: Sender, body: string, kind = 'text', refId: number | null = null): number {
  return Number(execute(
    'INSERT INTO messages (conversation_id, hotel_id, sender, body, kind, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [conversationId, hotelId, sender, body, kind, refId, nowIso()],
  ));
}

export function listMessages(hotelId: number, conversationId: number, limit = 200): MessageRow[] {
  return all<MessageRow>(
    'SELECT * FROM messages WHERE hotel_id = ? AND conversation_id = ? ORDER BY id ASC LIMIT ?',
    [hotelId, conversationId, limit],
  );
}

export function latestMessage(hotelId: number, conversationId: number): MessageRow | undefined {
  return first<MessageRow>(
    'SELECT * FROM messages WHERE hotel_id = ? AND conversation_id = ? ORDER BY id DESC LIMIT 1',
    [hotelId, conversationId],
  );
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export function getReservation(hotelId: number, reservationId: number): Reservation | undefined {
  return first<Reservation>('SELECT * FROM reservations WHERE hotel_id = ? AND id = ?', [hotelId, reservationId]);
}

export function createReservation(hotelId: number, r: {
  customerId: number | null; leadId?: number | null; checkIn: string; checkOut: string;
  guests: number; roomIds: number[]; totalAmount: number; source?: string; notes?: string;
}): number {
  return Number(execute(
    `INSERT INTO reservations (hotel_id, customer_id, lead_id, check_in, check_out, guests, room_ids, status, total_amount, currency, source, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', ?, 'XAF', ?, ?, ?)`,
    [hotelId, r.customerId, r.leadId ?? null, r.checkIn, r.checkOut, r.guests,
      JSON.stringify(r.roomIds), r.totalAmount, r.source ?? 'ai', r.notes ?? '', nowIso()],
  ));
}

export function updateReservationStatus(hotelId: number, reservationId: number, status: ReservationStatus): void {
  const extra = status === 'confirmed' ? ', confirmed_at = ?' : '';
  const params: Array<string | number> = extra ? [status, nowIso(), hotelId, reservationId] : [status, hotelId, reservationId];
  execute(`UPDATE reservations SET status = ?${extra} WHERE hotel_id = ? AND id = ?`, params);
}

export function listReservations(hotelId: number, status: ReservationStatus | 'all' = 'all', limit = 500): Reservation[] {
  if (status === 'all') {
    return all<Reservation>('SELECT * FROM reservations WHERE hotel_id = ? ORDER BY check_in DESC LIMIT ?', [hotelId, limit]);
  }
  return all<Reservation>(
    'SELECT * FROM reservations WHERE hotel_id = ? AND status = ? ORDER BY check_in DESC LIMIT ?', [hotelId, status, limit]);
}

export function findPendingReservation(hotelId: number, conversationId: number): Reservation | undefined {
  return first<Reservation>(
    `SELECT * FROM reservations
     WHERE hotel_id = ? AND status = 'requested' AND notes LIKE ?
     ORDER BY created_at DESC LIMIT 1`,
    [hotelId, `%conv=${conversationId}%`],
  );
}

export function findUpcomingReservation(hotelId: number, customerId: number): Reservation | undefined {
  return first<Reservation>(
    `SELECT * FROM reservations
     WHERE hotel_id = ? AND customer_id = ?
       AND status IN ('requested','confirmed','checked_in')
       AND check_in >= date('now')
     ORDER BY check_in ASC LIMIT 1`,
    [hotelId, customerId],
  );
}

export function reservationRoomIds(r: Reservation): number[] {
  try {
    const parsed = JSON.parse(r.room_ids) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

/** Deterministic price for a list of rooms over n nights. Pure function of DB data. */
export function computeTotal(rooms: Room[], nights: number): number {
  return rooms.reduce((sum, r) => sum + r.base_price * nights, 0);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000;
  return Math.max(1, Math.round(diff));
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export function createLead(hotelId: number, l: {
  name?: string; phone?: string; email?: string; customerId?: number | null;
  intent?: string; notes?: string; status?: LeadStatus;
}): number {
  return Number(execute(
    `INSERT INTO leads (hotel_id, customer_id, name, phone, email, intent, source, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'ai', ?, ?, ?)`,
    [hotelId, l.customerId ?? null, l.name ?? '', l.phone ?? '', l.email ?? '', l.intent ?? '',
      l.status ?? 'new', l.notes ?? '', nowIso()],
  ));
}

export function getLead(hotelId: number, leadId: number): Lead | undefined {
  return first<Lead>('SELECT * FROM leads WHERE hotel_id = ? AND id = ?', [hotelId, leadId]);
}

export function updateLeadStatus(hotelId: number, leadId: number, status: LeadStatus): void {
  execute('UPDATE leads SET status = ? WHERE hotel_id = ? AND id = ?', [status, hotelId, leadId]);
}

export function listLeads(hotelId: number, limit = 200): Lead[] {
  return all<Lead>('SELECT * FROM leads WHERE hotel_id = ? ORDER BY created_at DESC LIMIT ?', [hotelId, limit]);
}

export function countLeads(hotelId: number, status?: LeadStatus): number {
  if (status) return scalar('SELECT COUNT(*) FROM leads WHERE hotel_id = ? AND status = ?', [hotelId, status], 0);
  return scalar('SELECT COUNT(*) FROM leads WHERE hotel_id = ?', [hotelId], 0);
}

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------

export function createKnowledgeItem(hotelId: number, k: { category?: string; question: string; answer: string; keywords?: string }): number {
  return Number(execute(
    'INSERT INTO knowledge_items (hotel_id, category, question, answer, keywords, active) VALUES (?, ?, ?, ?, ?, 1)',
    [hotelId, k.category ?? 'general', k.question, k.answer, k.keywords ?? ''],
  ));
}

export function listKnowledge(hotelId: number, limit = 500): KnowledgeItem[] {
  return all<KnowledgeItem>('SELECT * FROM knowledge_items WHERE hotel_id = ? AND active = 1 ORDER BY category, id LIMIT ?', [hotelId, limit]);
}

export function getKnowledgeItem(hotelId: number, id: number): KnowledgeItem | undefined {
  return first<KnowledgeItem>('SELECT * FROM knowledge_items WHERE hotel_id = ? AND id = ?', [hotelId, id]);
}

export function updateKnowledgeItem(hotelId: number, id: number, patch: Partial<KnowledgeItem>): void {
  const sets: string[] = [];
  const params: Array<string | number> = [];
  for (const k of ['category', 'question', 'answer', 'keywords', 'active'] as const) {
    const v = patch[k];
    if (v !== undefined) {
      sets.push(`${k} = ?`);
      params.push(v as string | number);
    }
  }
  if (sets.length === 0) return;
  params.push(hotelId, id);
  execute(`UPDATE knowledge_items SET ${sets.join(', ')} WHERE hotel_id = ? AND id = ?`, params);
}

export function deleteKnowledgeItem(hotelId: number, id: number): void {
  executeChange('UPDATE knowledge_items SET active = 0 WHERE hotel_id = ? AND id = ?', [hotelId, id]);
}

/** Keyword + category + question scoring search over the KB. */
export function searchKnowledge(hotelId: number, query: string, limit = 3): KnowledgeItem[] {
  const items = listKnowledge(hotelId, 1000);
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2).slice(0, 8);

  const scored = items
    .map((item) => {
      const kw = (item.keywords + ' ' + item.question + ' ' + item.answer + ' ' + item.category).toLowerCase();
      let score = 0;
      let matched = 0;
      for (const t of tokens) {
        if (kw.includes(t)) {
          score += 1;
          matched += 1;
        }
      }
      const big = tokens.filter((t) => item.question.toLowerCase().includes(t)).length;
      score += big * 2;
      return { item, score, matched };
    })
    .sort((a, b) => b.score - a.score);

  return scored.filter((s) => s.score > 0).slice(0, limit).map((s) => s.item);
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export function createFeedback(hotelId: number, f: {
  customerId?: number | null; reservationId?: number | null; rating?: number | null; comment?: string;
}): number {
  return Number(execute(
    'INSERT INTO feedback (hotel_id, customer_id, reservation_id, rating, comment, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [hotelId, f.customerId ?? null, f.reservationId ?? null, f.rating ?? null, f.comment ?? '', 'new', nowIso()],
  ));
}

export function listFeedback(hotelId: number, limit = 200): FeedbackRow[] {
  return all<FeedbackRow>('SELECT * FROM feedback WHERE hotel_id = ? ORDER BY created_at DESC LIMIT ?', [hotelId, limit]);
}

export function countFeedback(hotelId: number, status = 'new'): number {
  return scalar('SELECT COUNT(*) FROM feedback WHERE hotel_id = ? AND status = ?', [hotelId, status], 0);
}

export function averageRating(hotelId: number): number | null {
  return scalar<number | null>(
    'SELECT AVG(rating) FROM feedback WHERE hotel_id = ? AND rating IS NOT NULL', [hotelId], null);
}

// ---------------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------------

export function createFollowup(hotelId: number, f: { customerId?: number | null; conversationId?: number | null; dueAt: string; task: string }): number {
  return Number(execute(
    'INSERT INTO followups (hotel_id, customer_id, conversation_id, due_at, task, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [hotelId, f.customerId ?? null, f.conversationId ?? null, f.dueAt, f.task, 'pending', nowIso()],
  ));
}

export function listFollowups(hotelId: number, status: 'pending' | 'done' | 'cancelled' | 'all' = 'pending', limit = 200): Followup[] {
  if (status === 'all') {
    return all<Followup>('SELECT * FROM followups WHERE hotel_id = ? ORDER BY due_at ASC LIMIT ?', [hotelId, limit]);
  }
  return all<Followup>('SELECT * FROM followups WHERE hotel_id = ? AND status = ? ORDER BY due_at ASC LIMIT ?', [hotelId, status, limit]);
}

export function countFollowupsDue(hotelId: number): number {
  return scalar('SELECT COUNT(*) FROM followups WHERE hotel_id = ? AND status = ? AND due_at <= ?',
    [hotelId, 'pending', nowIso()], 0);
}

export function markFollowupDone(hotelId: number, followupId: number): void {
  execute('UPDATE followups SET status = ? WHERE hotel_id = ? AND id = ?', ['done', hotelId, followupId]);
}

// ---------------------------------------------------------------------------
// Escalations
// ---------------------------------------------------------------------------

export function createEscalation(hotelId: number, e: { conversationId?: number | null; customerId?: number | null; reason: string; requestedByGuest?: number; assignedTo?: string }): number {
  return Number(execute(
    `INSERT INTO escalations (hotel_id, conversation_id, customer_id, reason, requested_by_guest, status, assigned_to, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
    [hotelId, e.conversationId ?? null, e.customerId ?? null, e.reason, e.requestedByGuest ?? 0, e.assignedTo ?? '', nowIso()],
  ));
}

export function listEscalations(hotelId: number, status = 'open', limit = 100): Escalation[] {
  return all<Escalation>(
    'SELECT * FROM escalations WHERE hotel_id = ? AND (status = ? OR ? = \'all\') ORDER BY created_at DESC LIMIT ?',
    [hotelId, status, status, limit],
  );
}

export function markEscalationHandled(hotelId: number, escalationId: number): void {
  execute('UPDATE escalations SET status = ?, handled_at = ? WHERE hotel_id = ? AND id = ?', ['handled', nowIso(), hotelId, escalationId]);
}

// ---------------------------------------------------------------------------
// Audit log (platform + tenant scoped)
// ---------------------------------------------------------------------------

export function writeAudit(entry: { hotelId?: number | null; actorType: AuditEntry['actor_type']; actorId: string; action: string; entity?: string; entityId?: number | null; details?: string }): number {
  return Number(execute(
    `INSERT INTO audit_log (hotel_id, actor_type, actor_id, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.hotelId ?? null, entry.actorType, entry.actorId, entry.action, entry.entity ?? '', entry.entityId ?? null, entry.details ?? '', nowIso()],
  ));
}

export function listAudit(hotelId: number | null, limit = 300): AuditEntry[] {
  if (hotelId === null) {
    return all<AuditEntry>('SELECT * FROM audit_log WHERE hotel_id IS NULL ORDER BY id DESC LIMIT ?', [limit]);
  }
  return all<AuditEntry>('SELECT * FROM audit_log WHERE hotel_id = ? ORDER BY id DESC LIMIT ?', [hotelId, limit]);
}

// ---------------------------------------------------------------------------
// Agent runs
// ---------------------------------------------------------------------------

export function recordAgentRun(hotelId: number, conversationId: number | null, intent: Intent, confidence: number, actionsJson: string, latencyMs: number): number {
  return Number(execute(
    'INSERT INTO agent_runs (hotel_id, conversation_id, intent, confidence, actions, latency_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [hotelId, conversationId, intent, confidence, actionsJson, latencyMs, nowIso()],
  ));
}

export function listAgentRuns(hotelId: number, limit = 200): Array<{ id: number; hotel_id: number; conversation_id: number | null; intent: string; confidence: number; actions: string; latency_ms: number; created_at: string }> {
  return all<{ id: number; hotel_id: number; conversation_id: number | null; intent: string; confidence: number; actions: string; latency_ms: number; created_at: string }>(
    'SELECT * FROM agent_runs WHERE hotel_id = ? ORDER BY id DESC LIMIT ?', [hotelId, limit]);
}

// ---------------------------------------------------------------------------
// AI Employee Profile
// ---------------------------------------------------------------------------

export function getEmployeeProfile(hotelId: number): EmployeeProfile | undefined {
  return first<EmployeeProfile>('SELECT * FROM employee_profiles WHERE hotel_id = ?', [hotelId]);
}

export function createEmployeeProfile(hotelId: number, p: Partial<EmployeeProfile>): number {
  const now = nowIso();
  return Number(execute(
    `INSERT INTO employee_profiles (hotel_id, name, role, personality, tone, languages, avatar_emoji, welcome_message, escalation_trigger, escalation_message, pause_on_escalation, max_response_length, custom_greeting, status, onboarding_step, onboarding_completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hotelId, p.name ?? 'Assistant', p.role ?? 'Receptionist', p.personality ?? 'professional_friendly',
      p.tone ?? 'warm_professional', p.languages ?? 'fr,en', p.avatar_emoji ?? '👩‍💼',
      p.welcome_message ?? '', p.escalation_trigger ?? 'guest_request', p.escalation_message ?? '',
      p.pause_on_escalation ?? 1, p.max_response_length ?? 500, p.custom_greeting ?? '',
      p.status ?? 'draft', p.onboarding_step ?? 0, p.onboarding_completed ?? 0, now, now,
    ],
  ));
}

export function updateEmployeeProfile(hotelId: number, patch: Partial<EmployeeProfile>): void {
  const allowed: Array<keyof EmployeeProfile> = [
    'name', 'role', 'personality', 'tone', 'languages', 'avatar_emoji',
    'welcome_message', 'escalation_trigger', 'escalation_message',
    'pause_on_escalation', 'max_response_length', 'custom_greeting',
    'status', 'onboarding_step', 'onboarding_completed',
  ];
  const sets: string[] = [];
  const params: Array<string | number> = [];
  for (const k of allowed) {
    const v = patch[k];
    if (v !== undefined) {
      sets.push(`${k} = ?`);
      params.push(v as string | number);
    }
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(nowIso());
  params.push(hotelId);
  execute(`UPDATE employee_profiles SET ${sets.join(', ')} WHERE hotel_id = ?`, params);
}

// ---------------------------------------------------------------------------
// Business Services
// ---------------------------------------------------------------------------

export function createBusinessService(hotelId: number, s: { name: string; description?: string; category?: string; price?: number | null; price_unit?: string; available?: number; sort_order?: number }): number {
  return Number(execute(
    `INSERT INTO business_services (hotel_id, name, description, category, price, price_unit, available, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hotelId, s.name, s.description ?? '', s.category ?? 'general', s.price ?? null, s.price_unit ?? 'per_unit', s.available ?? 1, s.sort_order ?? 0, nowIso()],
  ));
}

export function listBusinessServices(hotelId: number): BusinessService[] {
  return all<BusinessService>('SELECT * FROM business_services WHERE hotel_id = ? ORDER BY sort_order, id', [hotelId]);
}

export function updateBusinessService(hotelId: number, id: number, patch: Partial<BusinessService>): void {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  for (const k of ['name', 'description', 'category', 'price_unit', 'available', 'sort_order'] as const) {
    const v = patch[k];
    if (v !== undefined) {
      sets.push(`${k} = ?`);
      params.push(v as string | number);
    }
  }
  if (patch.price !== undefined) {
    sets.push('price = ?');
    params.push(patch.price);
  }
  if (sets.length === 0) return;
  params.push(hotelId, id);
  execute(`UPDATE business_services SET ${sets.join(', ')} WHERE hotel_id = ? AND id = ?`, params);
}

export function deleteBusinessService(hotelId: number, id: number): void {
  execute('DELETE FROM business_services WHERE hotel_id = ? AND id = ?', [hotelId, id]);
}

// ---------------------------------------------------------------------------
// Business Policies
// ---------------------------------------------------------------------------

export function createBusinessPolicy(hotelId: number, p: { policy_type: string; title: string; content: string; active?: number; sort_order?: number }): number {
  return Number(execute(
    `INSERT INTO business_policies (hotel_id, policy_type, title, content, active, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [hotelId, p.policy_type, p.title, p.content, p.active ?? 1, p.sort_order ?? 0, nowIso()],
  ));
}

export function listBusinessPolicies(hotelId: number): BusinessPolicy[] {
  return all<BusinessPolicy>('SELECT * FROM business_policies WHERE hotel_id = ? AND active = 1 ORDER BY sort_order, id', [hotelId]);
}

export function updateBusinessPolicy(hotelId: number, id: number, patch: Partial<BusinessPolicy>): void {
  const sets: string[] = [];
  const params: Array<string | number> = [];
  for (const k of ['policy_type', 'title', 'content', 'active', 'sort_order'] as const) {
    const v = patch[k];
    if (v !== undefined) {
      sets.push(`${k} = ?`);
      params.push(v as string | number);
    }
  }
  if (sets.length === 0) return;
  params.push(hotelId, id);
  execute(`UPDATE business_policies SET ${sets.join(', ')} WHERE hotel_id = ? AND id = ?`, params);
}

export function deleteBusinessPolicy(hotelId: number, id: number): void {
  execute('DELETE FROM business_policies WHERE hotel_id = ? AND id = ?', [hotelId, id]);
}

// ---------------------------------------------------------------------------
// Onboarding Checklist
// ---------------------------------------------------------------------------

export function getOnboardingChecklist(hotelId: number): OnboardingChecklist[] {
  return all<OnboardingChecklist>('SELECT * FROM onboarding_checklist WHERE hotel_id = ? ORDER BY id', [hotelId]);
}

export function initOnboardingChecklist(hotelId: number): void {
  const existing = getOnboardingChecklist(hotelId);
  if (existing.length > 0) return;
  for (const step of ONBOARDING_STEPS) {
    execute(
      'INSERT OR IGNORE INTO onboarding_checklist (hotel_id, step_key, step_name, completed) VALUES (?, ?, ?, 0)',
      [hotelId, step.key, step.name],
    );
  }
}

export function completeOnboardingStep(hotelId: number, stepKey: string): void {
  execute(
    'UPDATE onboarding_checklist SET completed = 1, completed_at = ? WHERE hotel_id = ? AND step_key = ?',
    [nowIso(), hotelId, stepKey],
  );
}

export function resetOnboardingStep(hotelId: number, stepKey: string): void {
  execute(
    'UPDATE onboarding_checklist SET completed = 0, completed_at = NULL WHERE hotel_id = ? AND step_key = ?',
    [hotelId, stepKey],
  );
}