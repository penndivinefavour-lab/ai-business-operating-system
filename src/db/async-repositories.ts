/**
 * Async repository layer for Turso/libSQL production mode.
 *
 * These functions mirror the sync repositories.ts but return Promises.
 * They are used ONLY when TURSO_DATABASE_URL + TURSO_AUTH_TOKEN are both set.
 *
 * In local mode (no Turso env vars), the sync repositories.ts is used directly.
 */

import {
  executeAsync,
  firstAsync,
  allAsync,
  scalarAsync,
  withTxAsync,
} from './client.ts';

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

// ---------------------------------------------------------------------------
// Hotels (platform-level)
// ---------------------------------------------------------------------------

export async function createHotel(h: {
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
}): Promise<number> {
  return await executeAsync(
    `INSERT INTO hotels (slug, name, description, email, phone, whatsapp_phone, address, city, country,
      currency, check_in_time, check_out_time, tax_rate, timezone, demo_enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      h.slug, h.name, h.description ?? '', h.email ?? '', h.phone ?? '', h.whatsappPhone ?? '',
      h.address ?? '', h.city ?? '', h.country ?? 'Cameroon', h.currency ?? 'XAF',
      h.checkInTime ?? '14:00', h.checkOutTime ?? '12:00', h.taxRate ?? 0, h.timezone ?? 'Africa/Douala',
      h.demoEnabled ?? 0, nowIso(),
    ],
  );
}

export async function getHotelById(id: number): Promise<Hotel | undefined> {
  return await firstAsync<Hotel>('SELECT * FROM hotels WHERE id = ?', [id]);
}

export async function getHotelBySlug(slug: string): Promise<Hotel | undefined> {
  return await firstAsync<Hotel>('SELECT * FROM hotels WHERE slug = ?', [slug]);
}

export async function listHotels(): Promise<Hotel[]> {
  return await allAsync<Hotel>('SELECT * FROM hotels ORDER BY created_at ASC');
}

export async function updateHotel(id: number, patch: Partial<Hotel>): Promise<void> {
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
  await executeAsync(`UPDATE hotels SET ${sets.join(', ')} WHERE id = ?`, params);
}

// ---------------------------------------------------------------------------
// Hotel users (admin/staff)
// ---------------------------------------------------------------------------

export async function createHotelUser(hotelId: number, name: string, email: string, passwordHash: string, role: 'admin' | 'staff'): Promise<number> {
  return await executeAsync(
    'INSERT INTO hotel_users (hotel_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [hotelId, name, email, passwordHash, role, nowIso()],
  );
}

export async function findUserByEmail(email: string): Promise<HotelUser | undefined> {
  return await firstAsync<HotelUser>('SELECT * FROM hotel_users WHERE email = ?', [email]);
}

export async function findUserById(id: number): Promise<HotelUser | undefined> {
  return await firstAsync<HotelUser>('SELECT * FROM hotel_users WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function createRoom(hotelId: number, r: {
  number: string; name?: string; roomType: string; floor?: number; capacity?: number;
  basePrice: number; amenities?: string; status?: Room['status']; maintenance?: number;
}): Promise<number> {
  return await executeAsync(
    `INSERT INTO rooms (hotel_id, number, name, room_type, floor, capacity, base_price, amenities, status, maintenance, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [hotelId, r.number, r.name ?? '', r.roomType, r.floor ?? 1, r.capacity ?? 2, r.basePrice,
      r.amenities ?? '', r.status ?? 'clean', r.maintenance ?? 0],
  );
}

export async function listRooms(hotelId: number): Promise<Room[]> {
  return await allAsync<Room>('SELECT * FROM rooms WHERE hotel_id = ? ORDER BY floor, number', [hotelId]);
}

export async function getRoom(hotelId: number, roomId: number): Promise<Room | undefined> {
  return await firstAsync<Room>('SELECT * FROM rooms WHERE hotel_id = ? AND id = ?', [hotelId, roomId]);
}

export async function updateRoom(hotelId: number, roomId: number, patch: Partial<Room>): Promise<void> {
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
  await executeAsync(`UPDATE rooms SET ${sets.join(', ')} WHERE hotel_id = ? AND id = ?`, params);
}

export async function findAvailableRooms(hotelId: number, checkIn: string, checkOut: string, guests: number): Promise<Room[]> {
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
  return await allAsync<Room>(sql, [hotelId, guests, checkOut, checkIn]);
}

export function sanitizeGuests(g: number): number {
  return Math.max(1, Math.min(50, Math.trunc(g)));
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function findCustomerByPhone(hotelId: number, phone: string): Promise<Customer | undefined> {
  return await firstAsync<Customer>('SELECT * FROM customers WHERE hotel_id = ? AND phone = ?', [hotelId, phone]);
}

export async function findCustomerByEmail(hotelId: number, email: string): Promise<Customer | undefined> {
  return await firstAsync<Customer>('SELECT * FROM customers WHERE hotel_id = ? AND email = ?', [hotelId, email]);
}

export async function getCustomer(hotelId: number, customerId: number): Promise<Customer | undefined> {
  return await firstAsync<Customer>('SELECT * FROM customers WHERE hotel_id = ? AND id = ?', [hotelId, customerId]);
}

export async function createCustomer(hotelId: number, c: { name?: string; phone?: string; email?: string; language?: string; notes?: string; source?: string }): Promise<number> {
  return await executeAsync(
    `INSERT INTO customers (hotel_id, name, phone, email, language, notes, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [hotelId, c.name ?? '', c.phone ?? '', c.email ?? '', c.language ?? 'fr', c.notes ?? '', c.source ?? 'ai', nowIso()],
  );
}

export async function upsertCustomerByPhone(hotelId: number, c: { name?: string; phone?: string; email?: string; language?: string; notes?: string; source?: string }): Promise<Customer> {
  if (c.phone) {
    const existing = await findCustomerByPhone(hotelId, c.phone);
    if (existing) {
      const merged = await updateCustomer(hotelId, existing.id, {
        name: c.name || existing.name,
        email: c.email || existing.email,
        notes: c.notes || existing.notes,
      });
      return merged ?? existing;
    }
  }
  if (c.email) {
    const existing = await findCustomerByEmail(hotelId, c.email);
    if (existing) {
      const merged = await updateCustomer(hotelId, existing.id, {
        name: c.name || existing.name,
        phone: c.phone || existing.phone,
        notes: c.notes || existing.notes,
      });
      return merged ?? existing;
    }
  }
  const id = await createCustomer(hotelId, c);
  return (await getCustomer(hotelId, id))!;
}

export async function updateCustomer(hotelId: number, customerId: number, patch: Partial<Customer>): Promise<Customer | undefined> {
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
    await executeAsync(`UPDATE customers SET ${sets.join(', ')} WHERE hotel_id = ? AND id = ?`, params);
  }
  return await getCustomer(hotelId, customerId);
}

export async function listCustomers(hotelId: number, limit = 200): Promise<Customer[]> {
  return await allAsync<Customer>('SELECT * FROM customers WHERE hotel_id = ? ORDER BY created_at DESC LIMIT ?', [hotelId, limit]);
}

export async function searchCustomers(hotelId: number, term: string, limit = 20): Promise<Customer[]> {
  const like = `%${term}%`;
  return await allAsync<Customer>(
    `SELECT * FROM customers WHERE hotel_id = ?
     AND (name LIKE ? OR phone LIKE ? OR email LIKE ?) ORDER BY created_at DESC LIMIT ?`,
    [hotelId, like, like, like, limit],
  );
}

export async function countCustomers(hotelId: number): Promise<number> {
  return await scalarAsync('SELECT COUNT(*) FROM customers WHERE hotel_id = ?', [hotelId], 0);
}

// ---------------------------------------------------------------------------
// Conversations & messages
// ---------------------------------------------------------------------------

export async function createConversation(hotelId: number, customerId: number | null, channel: string): Promise<number> {
  const now = nowIso();
  return await executeAsync(
    'INSERT INTO conversations (hotel_id, customer_id, channel, status, started_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?)',
    [hotelId, customerId, channel, 'open', now, now],
  );
}

export async function getConversation(hotelId: number, conversationId: number): Promise<Conversation | undefined> {
  return await firstAsync<Conversation>('SELECT * FROM conversations WHERE hotel_id = ? AND id = ?', [hotelId, conversationId]);
}

export async function getConversationForCustomer(hotelId: number, customerId: number): Promise<Conversation | undefined> {
  return await firstAsync<Conversation>(
    'SELECT * FROM conversations WHERE hotel_id = ? AND customer_id = ? ORDER BY last_message_at DESC LIMIT 1',
    [hotelId, customerId],
  );
}

export async function updateConversationStatus(hotelId: number, conversationId: number, status: ConversationStatus, intent?: Intent | string): Promise<void> {
  if (intent) {
    await executeAsync('UPDATE conversations SET status = ?, intent_last = ?, last_message_at = ? WHERE hotel_id = ? AND id = ?',
      [status, intent, nowIso(), hotelId, conversationId]);
  } else {
    await executeAsync('UPDATE conversations SET status = ?, last_message_at = ? WHERE hotel_id = ? AND id = ?',
      [status, nowIso(), hotelId, conversationId]);
  }
}

export async function listConversations(hotelId: number, limit = 100): Promise<Conversation[]> {
  return await allAsync<Conversation>(
    'SELECT * FROM conversations WHERE hotel_id = ? ORDER BY last_message_at DESC LIMIT ?', [hotelId, limit]);
}

export async function countConversations(hotelId: number): Promise<number> {
  return await scalarAsync('SELECT COUNT(*) FROM conversations WHERE hotel_id = ?', [hotelId], 0);
}

export async function addMessage(hotelId: number, conversationId: number, sender: Sender, body: string, kind = 'text', refId: number | null = null): Promise<number> {
  return await executeAsync(
    'INSERT INTO messages (conversation_id, hotel_id, sender, body, kind, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [conversationId, hotelId, sender, body, kind, refId, nowIso()],
  );
}

export async function listMessages(hotelId: number, conversationId: number, limit = 200): Promise<MessageRow[]> {
  return await allAsync<MessageRow>(
    'SELECT * FROM messages WHERE hotel_id = ? AND conversation_id = ? ORDER BY id ASC LIMIT ?',
    [hotelId, conversationId, limit],
  );
}

export async function latestMessage(hotelId: number, conversationId: number): Promise<MessageRow | undefined> {
  return await firstAsync<MessageRow>(
    'SELECT * FROM messages WHERE hotel_id = ? AND conversation_id = ? ORDER BY id DESC LIMIT 1',
    [hotelId, conversationId],
  );
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export async function getReservation(hotelId: number, reservationId: number): Promise<Reservation | undefined> {
  return await firstAsync<Reservation>('SELECT * FROM reservations WHERE hotel_id = ? AND id = ?', [hotelId, reservationId]);
}

export async function createReservation(hotelId: number, r: {
  customerId: number | null; leadId?: number | null; checkIn: string; checkOut: string;
  guests: number; roomIds: number[]; totalAmount: number; source?: string; notes?: string;
}): Promise<number> {
  return await executeAsync(
    `INSERT INTO reservations (hotel_id, customer_id, lead_id, check_in, check_out, guests, room_ids, status, total_amount, currency, source, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', ?, 'XAF', ?, ?, ?)`,
    [hotelId, r.customerId, r.leadId ?? null, r.checkIn, r.checkOut, r.guests,
      JSON.stringify(r.roomIds), r.totalAmount, r.source ?? 'ai', r.notes ?? '', nowIso()],
  );
}

export async function updateReservationStatus(hotelId: number, reservationId: number, status: ReservationStatus): Promise<void> {
  const extra = status === 'confirmed' ? ', confirmed_at = ?' : '';
  const params: Array<string | number> = extra ? [status, nowIso(), hotelId, reservationId] : [status, hotelId, reservationId];
  await executeAsync(`UPDATE reservations SET status = ?${extra} WHERE hotel_id = ? AND id = ?`, params);
}

export async function listReservations(hotelId: number, status: ReservationStatus | 'all' = 'all', limit = 500): Promise<Reservation[]> {
  if (status === 'all') {
    return await allAsync<Reservation>('SELECT * FROM reservations WHERE hotel_id = ? ORDER BY check_in DESC LIMIT ?', [hotelId, limit]);
  }
  return await allAsync<Reservation>(
    'SELECT * FROM reservations WHERE hotel_id = ? AND status = ? ORDER BY check_in DESC LIMIT ?', [hotelId, status, limit]);
}

export async function findPendingReservation(hotelId: number, conversationId: number): Promise<Reservation | undefined> {
  return await firstAsync<Reservation>(
    `SELECT * FROM reservations
     WHERE hotel_id = ? AND status = 'requested' AND notes LIKE ?
     ORDER BY created_at DESC LIMIT 1`,
    [hotelId, `%conv=${conversationId}%`],
  );
}

export async function findUpcomingReservation(hotelId: number, customerId: number): Promise<Reservation | undefined> {
  return await firstAsync<Reservation>(
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

export async function createLead(hotelId: number, l: {
  name?: string; phone?: string; email?: string; customerId?: number | null;
  intent?: string; notes?: string; status?: LeadStatus;
}): Promise<number> {
  return await executeAsync(
    `INSERT INTO leads (hotel_id, customer_id, name, phone, email, intent, source, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'ai', ?, ?, ?)`,
    [hotelId, l.customerId ?? null, l.name ?? '', l.phone ?? '', l.email ?? '', l.intent ?? '',
      l.status ?? 'new', l.notes ?? '', nowIso()],
  );
}

export async function getLead(hotelId: number, leadId: number): Promise<Lead | undefined> {
  return await firstAsync<Lead>('SELECT * FROM leads WHERE hotel_id = ? AND id = ?', [hotelId, leadId]);
}

export async function updateLeadStatus(hotelId: number, leadId: number, status: LeadStatus): Promise<void> {
  await executeAsync('UPDATE leads SET status = ? WHERE hotel_id = ? AND id = ?', [status, hotelId, leadId]);
}

export async function listLeads(hotelId: number, limit = 200): Promise<Lead[]> {
  return await allAsync<Lead>('SELECT * FROM leads WHERE hotel_id = ? ORDER BY created_at DESC LIMIT ?', [hotelId, limit]);
}

export async function countLeads(hotelId: number, status?: LeadStatus): Promise<number> {
  if (status) return await scalarAsync('SELECT COUNT(*) FROM leads WHERE hotel_id = ? AND status = ?', [hotelId, status], 0);
  return await scalarAsync('SELECT COUNT(*) FROM leads WHERE hotel_id = ?', [hotelId], 0);
}

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------

export async function createKnowledgeItem(hotelId: number, k: { category?: string; question: string; answer: string; keywords?: string }): Promise<number> {
  return await executeAsync(
    'INSERT INTO knowledge_items (hotel_id, category, question, answer, keywords, active) VALUES (?, ?, ?, ?, ?, 1)',
    [hotelId, k.category ?? 'general', k.question, k.answer, k.keywords ?? ''],
  );
}

export async function listKnowledge(hotelId: number, limit = 500): Promise<KnowledgeItem[]> {
  return await allAsync<KnowledgeItem>('SELECT * FROM knowledge_items WHERE hotel_id = ? AND active = 1 ORDER BY category, id LIMIT ?', [hotelId, limit]);
}

export async function getKnowledgeItem(hotelId: number, id: number): Promise<KnowledgeItem | undefined> {
  return await firstAsync<KnowledgeItem>('SELECT * FROM knowledge_items WHERE hotel_id = ? AND id = ?', [hotelId, id]);
}

export async function updateKnowledgeItem(hotelId: number, id: number, patch: Partial<KnowledgeItem>): Promise<void> {
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
  await executeAsync(`UPDATE knowledge_items SET ${sets.join(', ')} WHERE hotel_id = ? AND id = ?`, params);
}

export async function deleteKnowledgeItem(hotelId: number, id: number): Promise<void> {
  await executeAsync('UPDATE knowledge_items SET active = 0 WHERE hotel_id = ? AND id = ?', [hotelId, id]);
}

/** Keyword + category + question scoring search over the KB. */
export async function searchKnowledge(hotelId: number, query: string, limit = 3): Promise<KnowledgeItem[]> {
  const items = await listKnowledge(hotelId, 1000);
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

export async function createFeedback(hotelId: number, f: {
  customerId?: number | null; reservationId?: number | null; rating?: number | null; comment?: string;
}): Promise<number> {
  return await executeAsync(
    'INSERT INTO feedback (hotel_id, customer_id, reservation_id, rating, comment, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [hotelId, f.customerId ?? null, f.reservationId ?? null, f.rating ?? null, f.comment ?? '', 'new', nowIso()],
  );
}

export async function listFeedback(hotelId: number, limit = 200): Promise<FeedbackRow[]> {
  return await allAsync<FeedbackRow>('SELECT * FROM feedback WHERE hotel_id = ? ORDER BY created_at DESC LIMIT ?', [hotelId, limit]);
}

export async function countFeedback(hotelId: number, status = 'new'): Promise<number> {
  return await scalarAsync('SELECT COUNT(*) FROM feedback WHERE hotel_id = ? AND status = ?', [hotelId, status], 0);
}

export async function averageRating(hotelId: number): Promise<number | null> {
  return await scalarAsync<number | null>(
    'SELECT AVG(rating) FROM feedback WHERE hotel_id = ? AND rating IS NOT NULL', [hotelId], null);
}

// ---------------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------------

export async function createFollowup(hotelId: number, f: { customerId?: number | null; conversationId?: number | null; dueAt: string; task: string }): Promise<number> {
  return await executeAsync(
    'INSERT INTO followups (hotel_id, customer_id, conversation_id, due_at, task, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [hotelId, f.customerId ?? null, f.conversationId ?? null, f.dueAt, f.task, 'pending', nowIso()],
  );
}

export async function listFollowups(hotelId: number, status: 'pending' | 'done' | 'cancelled' | 'all' = 'pending', limit = 200): Promise<Followup[]> {
  if (status === 'all') {
    return await allAsync<Followup>('SELECT * FROM followups WHERE hotel_id = ? ORDER BY due_at ASC LIMIT ?', [hotelId, limit]);
  }
  return await allAsync<Followup>('SELECT * FROM followups WHERE hotel_id = ? AND status = ? ORDER BY due_at ASC LIMIT ?', [hotelId, status, limit]);
}

export async function countFollowupsDue(hotelId: number): Promise<number> {
  return await scalarAsync('SELECT COUNT(*) FROM followups WHERE hotel_id = ? AND status = ? AND due_at <= ?',
    [hotelId, 'pending', nowIso()], 0);
}

export async function markFollowupDone(hotelId: number, followupId: number): Promise<void> {
  await executeAsync('UPDATE followups SET status = ? WHERE hotel_id = ? AND id = ?', ['done', hotelId, followupId]);
}

// ---------------------------------------------------------------------------
// Escalations
// ---------------------------------------------------------------------------

export async function createEscalation(hotelId: number, e: { conversationId?: number | null; customerId?: number | null; reason: string; requestedByGuest?: number; assignedTo?: string }): Promise<number> {
  return await executeAsync(
    `INSERT INTO escalations (hotel_id, conversation_id, customer_id, reason, requested_by_guest, status, assigned_to, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
    [hotelId, e.conversationId ?? null, e.customerId ?? null, e.reason, e.requestedByGuest ?? 0, e.assignedTo ?? '', nowIso()],
  );
}

export async function listEscalations(hotelId: number, status = 'open', limit = 100): Promise<Escalation[]> {
  return await allAsync<Escalation>(
    'SELECT * FROM escalations WHERE hotel_id = ? AND (status = ? OR ? = \'all\') ORDER BY created_at DESC LIMIT ?',
    [hotelId, status, status, limit],
  );
}

export async function markEscalationHandled(hotelId: number, escalationId: number): Promise<void> {
  await executeAsync('UPDATE escalations SET status = ?, handled_at = ? WHERE hotel_id = ? AND id = ?', ['handled', nowIso(), hotelId, escalationId]);
}

// ---------------------------------------------------------------------------
// Audit log (platform + tenant scoped)
// ---------------------------------------------------------------------------

export async function writeAudit(entry: { hotelId?: number | null; actorType: AuditEntry['actor_type']; actorId: string; action: string; entity?: string; entityId?: number | null; details?: string }): Promise<number> {
  return await executeAsync(
    `INSERT INTO audit_log (hotel_id, actor_type, actor_id, action, entity, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [entry.hotelId ?? null, entry.actorType, entry.actorId, entry.action, entry.entity ?? '', entry.entityId ?? null, entry.details ?? '', nowIso()],
  );
}

export async function listAudit(hotelId: number | null, limit = 300): Promise<AuditEntry[]> {
  if (hotelId === null) {
    return await allAsync<AuditEntry>('SELECT * FROM audit_log WHERE hotel_id IS NULL ORDER BY id DESC LIMIT ?', [limit]);
  }
  return await allAsync<AuditEntry>('SELECT * FROM audit_log WHERE hotel_id = ? ORDER BY id DESC LIMIT ?', [hotelId, limit]);
}

// ---------------------------------------------------------------------------
// Agent runs
// ---------------------------------------------------------------------------

export async function recordAgentRun(hotelId: number, conversationId: number | null, intent: Intent, confidence: number, actionsJson: string, latencyMs: number): Promise<number> {
  return await executeAsync(
    'INSERT INTO agent_runs (hotel_id, conversation_id, intent, confidence, actions, latency_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [hotelId, conversationId, intent, confidence, actionsJson, latencyMs, nowIso()],
  );
}

export async function listAgentRuns(hotelId: number, limit = 200): Promise<Array<{ id: number; hotel_id: number; conversation_id: number | null; intent: string; confidence: number; actions: string; latency_ms: number; created_at: string }>> {
  return await allAsync<{ id: number; hotel_id: number; conversation_id: number | null; intent: string; confidence: number; actions: string; latency_ms: number; created_at: string }>(
    'SELECT * FROM agent_runs WHERE hotel_id = ? ORDER BY id DESC LIMIT ?', [hotelId, limit]);
}

// ---------------------------------------------------------------------------
// AI Employee Profile
// ---------------------------------------------------------------------------

export async function getEmployeeProfile(hotelId: number): Promise<EmployeeProfile | undefined> {
  return await firstAsync<EmployeeProfile>('SELECT * FROM employee_profiles WHERE hotel_id = ?', [hotelId]);
}

export async function createEmployeeProfile(hotelId: number, p: Partial<EmployeeProfile>): Promise<number> {
  const now = nowIso();
  return await executeAsync(
    `INSERT INTO employee_profiles (hotel_id, name, role, personality, tone, languages, avatar_emoji, welcome_message, escalation_trigger, escalation_message, pause_on_escalation, max_response_length, custom_greeting, status, onboarding_step, onboarding_completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hotelId, p.name ?? 'Assistant', p.role ?? 'Receptionist', p.personality ?? 'professional_friendly',
      p.tone ?? 'warm_professional', p.languages ?? 'fr,en', p.avatar_emoji ?? '👩💼',
      p.welcome_message ?? '', p.escalation_trigger ?? 'guest_request', p.escalation_message ?? '',
      p.pause_on_escalation ?? 1, p.max_response_length ?? 500, p.custom_greeting ?? '',
      p.status ?? 'draft', p.onboarding_step ?? 0, p.onboarding_completed ?? 0, now, now,
    ],
  );
}

export async function updateEmployeeProfile(hotelId: number, patch: Partial<EmployeeProfile>): Promise<void> {
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
  await executeAsync(`UPDATE employee_profiles SET ${sets.join(', ')} WHERE hotel_id = ?`, params);
}

// ---------------------------------------------------------------------------
// Business Services
// ---------------------------------------------------------------------------

export async function createBusinessService(hotelId: number, s: { name: string; description?: string; category?: string; price?: number | null; price_unit?: string; available?: number; sort_order?: number }): Promise<number> {
  return await executeAsync(
    `INSERT INTO business_services (hotel_id, name, description, category, price, price_unit, available, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hotelId, s.name, s.description ?? '', s.category ?? 'general', s.price ?? null, s.price_unit ?? 'per_unit', s.available ?? 1, s.sort_order ?? 0, nowIso()],
  );
}

export async function listBusinessServices(hotelId: number): Promise<BusinessService[]> {
  return await allAsync<BusinessService>('SELECT * FROM business_services WHERE hotel_id = ? ORDER BY sort_order, id', [hotelId]);
}

export async function updateBusinessService(hotelId: number, id: number, patch: Partial<BusinessService>): Promise<void> {
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
  await executeAsync(`UPDATE business_services SET ${sets.join(', ')} WHERE hotel_id = ? AND id = ?`, params);
}

export async function deleteBusinessService(hotelId: number, id: number): Promise<void> {
  await executeAsync('DELETE FROM business_services WHERE hotel_id = ? AND id = ?', [hotelId, id]);
}

// ---------------------------------------------------------------------------
// Business Policies
// ---------------------------------------------------------------------------

export async function createBusinessPolicy(hotelId: number, p: { policy_type: string; title: string; content: string; active?: number; sort_order?: number }): Promise<number> {
  return await executeAsync(
    `INSERT INTO business_policies (hotel_id, policy_type, title, content, active, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [hotelId, p.policy_type, p.title, p.content, p.active ?? 1, p.sort_order ?? 0, nowIso()],
  );
}

export async function listBusinessPolicies(hotelId: number): Promise<BusinessPolicy[]> {
  return await allAsync<BusinessPolicy>('SELECT * FROM business_policies WHERE hotel_id = ? AND active = 1 ORDER BY sort_order, id', [hotelId]);
}

export async function updateBusinessPolicy(hotelId: number, id: number, patch: Partial<BusinessPolicy>): Promise<void> {
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
  await executeAsync(`UPDATE business_policies SET ${sets.join(', ')} WHERE hotel_id = ? AND id = ?`, params);
}

export async function deleteBusinessPolicy(hotelId: number, id: number): Promise<void> {
  await executeAsync('DELETE FROM business_policies WHERE hotel_id = ? AND id = ?', [hotelId, id]);
}

// ---------------------------------------------------------------------------
// Onboarding Checklist
// ---------------------------------------------------------------------------

export async function getOnboardingChecklist(hotelId: number): Promise<OnboardingChecklist[]> {
  return await allAsync<OnboardingChecklist>('SELECT * FROM onboarding_checklist WHERE hotel_id = ? ORDER BY id', [hotelId]);
}

export async function initOnboardingChecklist(hotelId: number): Promise<void> {
  const existing = await getOnboardingChecklist(hotelId);
  if (existing.length > 0) return;
  for (const step of ONBOARDING_STEPS) {
    await executeAsync(
      'INSERT OR IGNORE INTO onboarding_checklist (hotel_id, step_key, step_name, completed) VALUES (?, ?, ?, 0)',
      [hotelId, step.key, step.name],
    );
  }
}

export async function completeOnboardingStep(hotelId: number, stepKey: string): Promise<void> {
  await executeAsync(
    'UPDATE onboarding_checklist SET completed = 1, completed_at = ? WHERE hotel_id = ? AND step_key = ?',
    [nowIso(), hotelId, stepKey],
  );
}

export async function resetOnboardingStep(hotelId: number, stepKey: string): Promise<void> {
  await executeAsync('UPDATE onboarding_checklist SET completed = 0, completed_at = NULL WHERE hotel_id = ? AND step_key = ?',
    [hotelId, stepKey]);
}

// ---------------------------------------------------------------------------
// Accounts (platform-level auth)
// ---------------------------------------------------------------------------

export async function createAccount(email: string, name: string, passwordHash: string): Promise<number> {
  return await executeAsync(
    'INSERT INTO accounts (email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [email.toLowerCase(), passwordHash, name, nowIso(), nowIso()],
  );
}

export async function findAccountByEmail(email: string): Promise<{ id: number; email: string; name: string; password_hash: string } | undefined> {
  return await firstAsync<{ id: number; email: string; name: string; password_hash: string }>(
    'SELECT id, email, name, password_hash FROM accounts WHERE email = ?',
    [email.toLowerCase()],
  );
}

export async function findAccountById(id: number): Promise<{ id: number; email: string; name: string } | undefined> {
  return await firstAsync<{ id: number; email: string; name: string }>(
    'SELECT id, email, name FROM accounts WHERE id = ?',
    [id],
  );
}

// ---------------------------------------------------------------------------
// Businesses (multi-tenant)
// ---------------------------------------------------------------------------

export async function createBusiness(data: {
  slug: string;
  name: string;
  description?: string;
  business_type?: string;
  email?: string;
  phone?: string;
  whatsapp_phone?: string;
  address?: string;
  city?: string;
  country?: string;
  currency?: string;
  check_in_time?: string;
  check_out_time?: string;
  tax_rate?: number;
  timezone?: string;
  is_public?: number;
}): Promise<number> {
  return await executeAsync(
    `INSERT INTO businesses (slug, name, description, business_type, email, phone, whatsapp_phone, address, city, country, currency, check_in_time, check_out_time, tax_rate, timezone, is_public, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.slug, data.name, data.description ?? '', data.business_type ?? 'hotel',
      data.email ?? '', data.phone ?? '', data.whatsapp_phone ?? '',
      data.address ?? '', data.city ?? '', data.country ?? 'Cameroon',
      data.currency ?? 'XAF', data.check_in_time ?? '14:00', data.check_out_time ?? '12:00',
      data.tax_rate ?? 0, data.timezone ?? 'Africa/Douala', data.is_public ?? 0,
      nowIso(), nowIso(),
    ],
  );
}

export async function getBusinessBySlug(slug: string): Promise<{ id: number; slug: string; name: string; description: string; business_type: string; email: string; phone: string; whatsapp_phone: string; address: string; city: string; country: string; currency: string; check_in_time: string; check_out_time: string; tax_rate: number; timezone: string; is_public: number; settings: string; created_at: string; updated_at: string } | undefined> {
  return await firstAsync<{ id: number; slug: string; name: string; description: string; business_type: string; email: string; phone: string; whatsapp_phone: string; address: string; city: string; country: string; currency: string; check_in_time: string; check_out_time: string; tax_rate: number; timezone: string; is_public: number; settings: string; created_at: string; updated_at: string }>(
    'SELECT * FROM businesses WHERE slug = ?',
    [slug],
  );
}

export async function getBusinessById(id: number): Promise<{ id: number; slug: string; name: string; description: string; business_type: string; email: string; phone: string; whatsapp_phone: string; address: string; city: string; country: string; currency: string; check_in_time: string; check_out_time: string; tax_rate: number; timezone: string; is_public: number; settings: string; created_at: string; updated_at: string } | undefined> {
  return await firstAsync<{ id: number; slug: string; name: string; description: string; business_type: string; email: string; phone: string; whatsapp_phone: string; address: string; city: string; country: string; currency: string; check_in_time: string; check_out_time: string; tax_rate: number; timezone: string; is_public: number; settings: string; created_at: string; updated_at: string }>(
    'SELECT * FROM businesses WHERE id = ?',
    [id],
  );
}

export async function listBusinesses(): Promise<{ id: number; slug: string; name: string; business_type: string }[]> {
  return await allAsync<{ id: number; slug: string; name: string; business_type: string }>(
    'SELECT id, slug, name, business_type FROM businesses ORDER BY name',
  );
}

// ---------------------------------------------------------------------------
// Business Memberships (account <-> business)
// ---------------------------------------------------------------------------

export async function createMembership(accountId: number, businessId: number, role: string = 'owner'): Promise<number> {
  const existing = await getMembership(accountId, businessId);
  if (existing) return existing.id;
  return await executeAsync(
    'INSERT INTO business_memberships (account_id, business_id, role, created_at) VALUES (?, ?, ?, ?)',
    [accountId, businessId, role, nowIso()],
  );
}

export async function getMembership(accountId: number, businessId: number): Promise<{ id: number; account_id: number; business_id: number; role: string } | undefined> {
  return await firstAsync<{ id: number; account_id: number; business_id: number; role: string }>(
    'SELECT id, account_id, business_id, role FROM business_memberships WHERE account_id = ? AND business_id = ?',
    [accountId, businessId],
  );
}

export async function listMembershipsForAccount(accountId: number): Promise<{ id: number; account_id: number; business_id: number; role: string }[]> {
  return await allAsync<{ id: number; account_id: number; business_id: number; role: string }>(
    'SELECT id, account_id, business_id, role FROM business_memberships WHERE account_id = ?',
    [accountId],
  );
}

export async function listMembershipsForBusiness(businessId: number): Promise<{ id: number; account_id: number; business_id: number; role: string }[]> {
  return await allAsync<{ id: number; account_id: number; business_id: number; role: string }>(
    'SELECT id, account_id, business_id, role FROM business_memberships WHERE business_id = ?',
    [businessId],
  );
}
