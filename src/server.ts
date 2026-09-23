import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { config } from './config.ts';
import { openDb, closeDb } from './db/client.ts';
import { migrate } from './db/schema.ts';
import { seedDemoHotel, isDemoHotelSeeded, verifyPassword } from './db/seed.ts';
import {
  averageRating,
  countConversations,
  countCustomers,
  countFeedback,
  countFollowupsDue,
  countLeads,
  createEscalation,
  createFeedback,
  createHotel,
  createKnowledgeItem,
  createLead,
  deleteKnowledgeItem,
  findUserByEmail,
  findUserById,
  getConversation,
  getHotelById,
  getHotelBySlug,
  getKnowledgeItem,
  getReservation,
  getRoom,
  listAgentRuns,
  listAudit,
  listConversations,
  listCustomers,
  listEscalations,
  listFeedback,
  listFollowups,
  listHotels,
  listKnowledge,
  listLeads,
  listMessages,
  listReservations,
  listRooms,
  markEscalationHandled,
  markFollowupDone,
  updateConversationStatus,
  updateHotel,
  updateKnowledgeItem,
  updateLeadStatus,
  updateReservationStatus,
  updateRoom,
  writeAudit,
} from './db/repositories.ts';
import { processMessage } from './core/orchestrator.ts';
import { registry } from './core/orchestrator.ts';
import { normalizePhone } from './core/format.ts';
import { addDays, todayIso } from './core/time.ts';
import type { Hotel, Reservation, ReservationStatus, Sender } from './types.ts';
import { slugify } from './core/format.ts';
import { runScenario, scenarioIds } from './demo/simulator.ts';
import { webhookReady, verifyWebhookSignature, sendWhatsAppText, normalizeInbound } from './channels/whatsapp.ts';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const ok = (body: unknown) => ({ ok: true, ...(body as object) });
const bad = (error: string, code = 'bad_request') => ({ ok: false, code, error });

function json(res: ServerResponse, code: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 2_000_000) reject(new Error('body too large'));
    });
  });
}

async function parseJson<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

// ---------------------------------------------------------------------------
// sessions (stateless HMAC tokens)
// ---------------------------------------------------------------------------

interface Session {
  sub: string;
  role: 'platform' | 'staff';
  hotelId: number | null;
  exp: number;
}

function sign(data: string): string {
  return createHmac('sha256', config.appSecret).update(data).digest('hex');
}

function makeToken(s: Session): string {
  const payload = Buffer.from(JSON.stringify({ sub: s.sub, role: s.role, hotelId: s.hotelId })).toString('base64url');
  const exp = Date.now() + 12 * 3600_000;
  return `${payload}.${exp}.${sign(`${payload}.${exp}`)}`;
}

function verifyToken(token: string): Session | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [payload, expStr, sig] = parts as [string, string, string];
  if (sign(`${payload}.${expStr}`) !== sig) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Partial<Session>;
    if (data.sub && (data.role === 'platform' || data.role === 'staff')) {
      return { sub: data.sub, role: data.role, hotelId: data.hotelId ?? null, exp };
    }
    return null;
  } catch {
    return null;
  }
}

function tokenFrom(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  const cookie = req.headers.cookie ?? '';
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : null;
}

async function authenticate(req: IncomingMessage): Promise<Session | null> {
  const token = tokenFrom(req);
  if (!token) return null;
  const session = verifyToken(token);
  if (!session) return null;
  // platform admin credentials are env-managed (no DB lookup); staff checked in DB
  if (session.role === 'staff' && session.hotelId !== null) {
    const user = findUserById(Number(session.sub.split(':').pop()));
    if (!user) return null;
    // re-check that the user's role/email still match
    if (user.email !== session.sub.split(':')[0]) return null;
  }
  return session;
}

// ---------------------------------------------------------------------------
// rate limiting (in-memory) for public chat + login
// ---------------------------------------------------------------------------

const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  if (b.count > max) return false;
  return true;
}

// ---------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------

const DASH_DIR = decodeURIComponent(new URL('./dashboard/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(req: IncomingMessage, res: ServerResponse, urlPath: string): void {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/\\/g, '/');
  let filePath = join(DASH_DIR, clean === '/' ? 'index.html' : clean);
  if (!filePath.startsWith(join(DASH_DIR))) filePath = join(DASH_DIR, 'index.html');
  let content: Buffer;
  try {
    content = readFileSync(filePath);
  } catch {
    // SPA fallback for non-API GETs
    try {
      content = readFileSync(join(DASH_DIR, 'index.html'));
    } catch {
      json(res, 404, bad('not found', 'not_found'));
      return;
    }
  }
  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(content);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const method = (req.method ?? 'GET').toUpperCase();

  try {
    // ---- public: health ----------------------------------------------------
    if (method === 'GET' && path === '/api/health') {
      json(res, 200, ok({ up: true, provider: 'demo', time: todayIso() }));
      return;
    }

    // ---- public: login -----------------------------------------------------
    if (method === 'POST' && path === '/api/login') {
      if (!rateLimit(`login:${req.socket.remoteAddress ?? 'x'}`, 10, 60_000)) {
        json(res, 429, bad('too many login attempts', 'rate_limited'));
        return;
      }
      const body = await parseJson<{ email?: string; password?: string }>(req);
      const email = (body.email ?? '').trim().toLowerCase();
      const password = body.password ?? '';

      if (email === config.admin.email.toLowerCase() && password === config.admin.password) {
        const token = makeToken({ sub: email, role: 'platform', hotelId: null, exp: Date.now() + 12 * 3600_000 });
        writeAudit({ hotelId: null, actorType: 'admin', actorId: email, action: 'login', entity: 'platform' });
        json(res, 200, ok({ token, role: 'platform', email }));
        return;
      }
      const staff = findUserByEmail(email);
      if (staff && verifyPassword(password, staff.password_hash)) {
        const token = makeToken({ sub: `${email}:${staff.id}`, role: 'staff', hotelId: staff.hotel_id, exp: Date.now() + 12 * 3600_000 });
        writeAudit({ hotelId: staff.hotel_id, actorType: 'human', actorId: email, action: 'login', entity: 'staff' });
        json(res, 200, ok({ token, role: 'staff', email, hotelId: staff.hotel_id, name: staff.name }));
        return;
      }
      writeAudit({ hotelId: null, actorType: 'system', actorId: email, action: 'login_failed', entity: 'auth' });
      json(res, 401, bad('invalid credentials', 'unauthorized'));
      return;
    }

    // ---- public: guest web chat -------------------------------------------
    if (method === 'POST' && path === '/api/chat') {
      if (!rateLimit(`chat:${req.socket.remoteAddress ?? 'x'}`)) {
        json(res, 429, bad('too many requests', 'rate_limited'));
        return;
      }
      const body = await parseJson<{ hotelSlug?: string; text?: string; conversationId?: number; contact?: { phone?: string; name?: string; email?: string } }>(req);
      const hotel = body.hotelSlug ? getHotelBySlug(body.hotelSlug) : undefined;
      if (!hotel || hotel.demo_enabled !== 1) {
        json(res, 404, bad('hotel not found or not public', 'not_found'));
        return;
      }
      const text = (body.text ?? '').trim();
      if (!text) {
        json(res, 400, bad('text is required', 'bad_request'));
        return;
      }
      const result = await processMessage({
        hotelId: hotel.id,
        conversationId: body.conversationId,
        channel: 'web',
        text,
        contact: body.contact,
      });
      json(res, 200, {
        ok: true,
        reply: result.reply,
        conversationId: result.conversationId,
        intent: result.intent,
        changed: result.changed,
        provider: result.provider,
      });
      return;
    }

    // ---- public: fetch chat messages for the web widget --------------------
    const chatMsgsMatch = path.match(/^\/api\/chat\/(\d+)\/messages$/);
    if (method === 'GET' && chatMsgsMatch) {
      const conversationId = Number(chatMsgsMatch[1]);
      let conv;
      let hotel;
      for (const h of listHotels()) {
        if (h.demo_enabled !== 1) continue;
        const c = getConversation(h.id, conversationId);
        if (c) {
          conv = c;
          hotel = h;
          break;
        }
      }
      if (!conv || !hotel) {
        json(res, 404, bad('conversation not found', 'not_found'));
        return;
      }
      const messages = listMessages(conv.hotel_id, conversationId).map((m) => ({
        sender: m.sender,
        body: m.body,
        at: m.created_at,
      }));
      json(res, 200, ok({ hotelSlug: hotel.slug, messages }));
      return;
    }

    // ---- WhatsApp webhook --------------------------------------------------
    if (path === '/api/webhooks/whatsapp' && method === 'GET') {
      const verifyToken = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (webhookReady() && verifyToken === config.whatsapp.verifyToken && challenge) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge);
        return;
      }
      json(res, 403, bad('webhook verification failed', 'forbidden'));
      return;
    }
    if (path === '/api/webhooks/whatsapp' && method === 'POST') {
      const raw = await readBody(req);
      if (!webhookReady()) {
        json(res, 501, bad('whatsapp not configured', 'not_configured'));
        return;
      }
      if (!verifyWebhookSignature(raw, req.headers['x-hub-signature-256'] as string | undefined, config.whatsapp.verifyToken)) {
        json(res, 403, bad('invalid signature', 'forbidden'));
        return;
      }
      const payload = JSON.parse(raw) as Record<string, unknown>;
      const inbound = normalizeInbound(payload);
      const results: Array<{ from: string; ok: boolean }> = [];
      for (const msg of inbound) {
        // Route to the first demo hotel owning this number (MVP single-hotel routing)
        const hotels = listHotels().filter((h) => h.whatsapp_phone && normalizePhone(msg.from) !== normalizePhone(h.whatsapp_phone));
        const hotel = hotels[0] ?? listHotels().find((h) => h.demo_enabled === 1) ?? listHotels()[0];
        if (!hotel) {
          results.push({ from: msg.from, ok: false });
          continue;
        }
        const result = await processMessage({
          hotelId: hotel.id,
          channel: 'whatsapp',
          text: msg.text,
          contact: { phone: msg.from },
        });
        await sendWhatsAppText(msg.from, result.reply, hotel.id);
        results.push({ from: msg.from, ok: true });
      }
      json(res, 200, { ok: true, results });
      return;
    }

    // ---- public: demo scenarios --------------------------------------------
    if (method === 'GET' && path === '/api/demo/scenarios') {
      json(res, 200, ok({ scenarios: scenarioIds() }));
      return;
    }
    if (method === 'POST' && path === '/api/demo/run') {
      const body = await parseJson<{ scenario?: string; language?: 'fr' | 'en' }>(req);
      const hotel = listHotels().find((h) => h.demo_enabled === 1) ?? getHotelById(1);
      if (!hotel) {
        json(res, 404, bad('no demo hotel', 'not_found'));
        return;
      }
      const transcript = await runScenario(hotel.id, body.scenario ?? 'all', body.language ?? 'fr');
      json(res, 200, ok({ hotelId: hotel.id, transcript }));
      return;
    }

    // ======================================================================
    // Admin API (authenticated, tenant-scoped). Static assets need no auth:
    // anything that is not an /api path falls through to static serving.
    // ======================================================================
    if (!path.startsWith('/api/')) {
      serveStatic(req, res, path);
      return;
    }
    const session = await authenticate(req);
    if (!session) {
      json(res, 401, bad('authentication required', 'unauthorized'));
      return;
    }

    if (method === 'GET' && path === '/api/me') {
      json(res, 200, ok({ session }));
      return;
    }

    // hotels list + onboarding
    if (method === 'GET' && path === '/api/hotels') {
      json(res, 200, ok({
        hotels: listHotels().map((h) => ({
          id: h.id,
          slug: h.slug,
          name: h.name,
          city: h.city,
          demo: h.demo_enabled === 1,
          rooms: listRooms(h.id).length,
        })),
      }));
      return;
    }
    if (method === 'POST' && path === '/api/hotels') {
      const body = await parseJson<Record<string, string>>(req);
      const name = (body.name ?? '').trim();
      if (!name) {
        json(res, 400, bad('name is required', 'bad_request'));
        return;
      }
      const base = slugify(name || 'hotel');
      let slug = base;
      let n = 2;
      while (getHotelBySlug(slug)) slug = `${base}-${n++}`;
      const hotelId = createHotel({
        slug,
        name,
        email: body.email ?? '',
        phone: body.phone ?? '',
        whatsappPhone: body.whatsappPhone ?? '',
        address: body.address ?? '',
        city: body.city ?? '',
        country: body.country ?? 'Cameroon',
        currency: body.currency ?? 'XAF',
        checkInTime: body.checkInTime ?? '14:00',
        checkOutTime: body.checkOutTime ?? '12:00',
      });
      writeAudit({ hotelId, actorType: 'admin', actorId: session.sub, action: 'hotel_onboarded', entity: 'hotel', entityId: hotelId });
      json(res, 201, ok({ hotelId, slug }));
      return;
    }

    // per-hotel routes -------------------------------------------------------
    const m = path.match(/^\/api\/hotels\/(\d+)(\/.*)?$/);
    if (m) {
      const hotelId = Number(m[1]);
      const hotel = getHotelById(hotelId);
      if (!hotel) {
        json(res, 404, bad('hotel not found', 'not_found'));
        return;
      }
      if (session.role === 'staff' && session.hotelId !== hotelId) {
        json(res, 403, bad('cross-tenant access denied', 'forbidden'));
        return;
      }
      const sub = m[2]?.split('?')[0] ?? '';
      await handleHotelRoute(req, res, hotel, sub, session);
      return;
    }

    json(res, 404, bad('unknown route', 'not_found'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`500 ${method} ${path}: ${msg}`);
    if (err instanceof Error && err.stack) console.error(err.stack.split('\n').slice(0, 4).join('\n'));
    json(res, 500, bad(`internal error: ${msg}`, 'internal'));
  }
});

// ---------------------------------------------------------------------------
// per-hotel admin routes (all tenant-scoped)
// ---------------------------------------------------------------------------

async function handleHotelRoute(
  req: IncomingMessage,
  res: ServerResponse,
  hotel: Hotel,
  sub: string,
  session: Session,
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  const hotelId = hotel.id;

  if (method === 'GET' && sub === '/overview') {
    const rooms = listRooms(hotelId);
    const reservations = listReservations(hotelId, 'all');
    const active = reservations.filter((r) => r.status === 'confirmed' || r.status === 'checked_in' || r.status === 'requested');
    const inHouse = reservations.filter((r) => r.status === 'checked_in').length;
    const arrivals = reservations.filter((r) => r.status !== 'cancelled' && r.status !== 'declined' && r.check_in === todayIso()).length;
    const departures = reservations.filter((r) => r.status !== 'cancelled' && r.status !== 'declined' && r.check_out === todayIso()).length;
    const nextSeven = reservations
      .filter((r) => r.status !== 'cancelled' && r.status !== 'declined' && r.check_in >= todayIso() && r.check_in <= addDays(todayIso(), 7))
      .map((r) => ({ id: r.id, checkIn: r.check_in, checkOut: r.check_out, status: r.status, total: r.total_amount, roomIds: safeJson(r.room_ids) }));
    const revenue7d = reservations
      .filter((r) => (r.status === 'checked_in' || r.status === 'checked_out' || r.status === 'confirmed') && r.check_in >= addDays(todayIso(), -7) && r.check_in <= todayIso())
      .reduce((s, r) => s + r.total_amount, 0);
    json(res, 200, ok({
      hotel,
      occupancy: {
        totalRooms: rooms.length,
        activeRooms: rooms.filter((r) => r.active === 1).length,
        inHouse,
        arrivals,
        departures,
        occupancyPct: rooms.length ? Math.round((inHouse / rooms.length) * 100) : 0,
      },
      revenue: { next7d: revenue7d },
      upcoming: nextSeven.slice(0, 10),
      kpis: {
        conversations: countConversations(hotelId),
        customers: countCustomers(hotelId),
        leads: countLeads(hotelId),
        leadsNew: countLeads(hotelId, 'new'),
        feedbackNew: countFeedback(hotelId, 'new'),
        rating: averageRating(hotelId),
        followupsDue: countFollowupsDue(hotelId),
      },
      timeframe: todayIso(),
    }));
    return;
  }

  if (method === 'GET' && sub === '/conversations') {
    const conversations = listConversations(hotelId).map((c) => ({
      ...c,
      messages: countMessages(hotelId, c.id),
    }));
    json(res, 200, ok({ conversations }));
    return;
  }
  const convMatch = sub.match(/^\/conversations\/(\d+)(\/messages)?$/);
  if (convMatch) {
    const conversationId = Number(convMatch[1]);
    const conv = getConversation(hotelId, conversationId);
    if (!conv) {
      json(res, 404, bad('conversation not found', 'not_found'));
      return;
    }
    if (method === 'GET') {
      const messages = listMessages(hotelId, conversationId).map(decorateMessage);
      json(res, 200, ok({ conversation: conv, messages }));
      return;
    }
    if (method === 'PATCH' && sub.includes('/messages') === false) {
      const body = await parseJson<{ status?: string }>(req);
      const allowed = ['open', 'awaiting', 'escalated', 'resolved'];
      if (!body.status || !allowed.includes(body.status)) {
        json(res, 400, bad('invalid status', 'bad_request'));
        return;
      }
      updateConversationStatus(hotelId, conversationId, body.status as 'open', body.status);
      writeAudit({ hotelId, actorType: 'human', actorId: session.sub, action: 'conversation_status', entity: 'conversation', entityId: conversationId, details: body.status });
      json(res, 200, ok({ status: body.status }));
      return;
    }
  }

  if (method === 'GET' && sub === '/customers') {
    json(res, 200, ok({ customers: listCustomers(hotelId) }));
    return;
  }

  if (method === 'GET' && sub === '/leads') {
    json(res, 200, ok({ leads: listLeads(hotelId) }));
    return;
  }
  const leadMatch = sub.match(/^\/leads\/(\d+)$/);
  if (leadMatch && method === 'PATCH') {
    const body = await parseJson<{ status?: string }>(req);
    const allowed = ['new', 'contacted', 'qualified', 'converted', 'lost'];
    if (!body.status || !allowed.includes(body.status)) {
      json(res, 400, bad('invalid status', 'bad_request'));
      return;
    }
    updateLeadStatus(hotelId, Number(leadMatch[1]), body.status as 'new');
    writeAudit({ hotelId, actorType: 'human', actorId: session.sub, action: 'lead_status', entity: 'lead', entityId: Number(leadMatch[1]), details: body.status });
    json(res, 200, ok({ status: body.status }));
    return;
  }

  if (method === 'GET' && sub === '/reservations') {
    json(res, 200, ok({ reservations: listReservations(hotelId, 'all').map(decorateReservation) }));
    return;
  }
  const resvMatch = sub.match(/^\/reservations\/(\d+)$/);
  if (resvMatch && method === 'PATCH') {
    const body = await parseJson<{ status?: ReservationStatus }>(req);
    const allowed: ReservationStatus[] = ['requested', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'declined'];
    const resv = getReservation(hotelId, Number(resvMatch[1]));
    if (!resv) {
      json(res, 404, bad('reservation not found', 'not_found'));
      return;
    }
    if (!body.status || !allowed.includes(body.status)) {
      json(res, 400, bad('invalid status', 'bad_request'));
      return;
    }
    updateReservationStatus(hotelId, Number(resvMatch[1]), body.status);
    writeAudit({ hotelId, actorType: 'human', actorId: session.sub, action: 'reservation_status', entity: 'reservation', entityId: Number(resvMatch[1]), details: body.status });
    json(res, 200, ok({ status: body.status }));
    return;
  }

  if (method === 'GET' && sub === '/rooms') {
    json(res, 200, ok({ rooms: listRooms(hotelId) }));
    return;
  }
  const roomMatch = sub.match(/^\/rooms\/(\d+)$/);
  if (roomMatch && method === 'PATCH') {
    const body = await parseJson<{ status?: string; maintenance?: number }>(req);
    const room = getRoom(hotelId, Number(roomMatch[1]));
    if (!room) {
      json(res, 404, bad('room not found', 'not_found'));
      return;
    }
    const allowed = ['clean', 'dirty', 'maintenance', 'out_of_service'];
    if (body.status && allowed.includes(body.status)) updateRoom(hotelId, room.id, { status: body.status as 'clean' });
    if (body.maintenance !== undefined) updateRoom(hotelId, room.id, { maintenance: body.maintenance === 1 ? 1 : 0 });
    writeAudit({ hotelId, actorType: 'human', actorId: session.sub, action: 'room_status', entity: 'room', entityId: room.id, details: body.status ?? `maintenance=${body.maintenance}` });
    json(res, 200, ok({ updated: true }));
    return;
  }

  if (sub === '/knowledge') {
    if (method === 'GET') {
      json(res, 200, ok({ items: listKnowledge(hotelId) }));
      return;
    }
    if (method === 'POST') {
      const body = await parseJson<{ question?: string; answer?: string; category?: string; keywords?: string }>(req);
      if (!body.answer) {
        json(res, 400, bad('answer is required', 'bad_request'));
        return;
      }
      const id = createKnowledgeItem(hotelId, { question: body.question ?? '', answer: body.answer, category: body.category ?? 'general', keywords: body.keywords ?? '' });
      writeAudit({ hotelId, actorType: 'human', actorId: session.sub, action: 'knowledge_create', entity: 'knowledge_item', entityId: id });
      json(res, 201, ok({ itemId: id }));
      return;
    }
  }
  const kbMatch = sub.match(/^\/knowledge\/(\d+)$/);
  if (kbMatch) {
    const id = Number(kbMatch[1]);
    const item = getKnowledgeItem(hotelId, id);
    if (!item) {
      json(res, 404, bad('knowledge item not found', 'not_found'));
      return;
    }
    if (method === 'PATCH') {
      const body = await parseJson<Partial<{ question: string; answer: string; category: string; keywords: string; active: number }>>(req);
      updateKnowledgeItem(hotelId, id, body);
      writeAudit({ hotelId, actorType: 'human', actorId: session.sub, action: 'knowledge_update', entity: 'knowledge_item', entityId: id });
      json(res, 200, ok({ updated: true }));
      return;
    }
    if (method === 'DELETE') {
      deleteKnowledgeItem(hotelId, id);
      writeAudit({ hotelId, actorType: 'human', actorId: session.sub, action: 'knowledge_delete', entity: 'knowledge_item', entityId: id });
      json(res, 200, ok({ deleted: true }));
      return;
    }
  }

  if (method === 'GET' && sub === '/feedback') {
    json(res, 200, ok({ feedback: listFeedback(hotelId).map((f) => ({ ...f })) }));
    return;
  }
  if (method === 'POST' && sub === '/feedback') {
    const body = await parseJson<{ rating?: number; comment?: string }>(req);
    const id = createFeedback(hotelId, { rating: body.rating ?? null, comment: body.comment ?? '' });
    json(res, 201, ok({ feedbackId: id }));
    return;
  }

  if (method === 'GET' && sub === '/followups') {
    json(res, 200, ok({ followups: listFollowups(hotelId, 'all') }));
    return;
  }
  const fuMatch = sub.match(/^\/followups\/(\d+)$/);
  if (fuMatch && method === 'PATCH') {
    markFollowupDone(hotelId, Number(fuMatch[1]));
    json(res, 200, ok({ done: true }));
    return;
  }

  if (method === 'GET' && sub === '/escalations') {
    json(res, 200, ok({ escalations: listEscalations(hotelId, 'all') }));
    return;
  }
  if (method === 'POST' && sub === '/escalations') {
    const body = await parseJson<{ reason?: string }>(req);
    const id = createEscalation(hotelId, { reason: body.reason ?? 'manual escalation' });
    writeAudit({ hotelId, actorType: 'human', actorId: session.sub, action: 'escalation_create', entity: 'escalation', entityId: id });
    json(res, 201, ok({ escalationId: id }));
    return;
  }
  const escMatch = sub.match(/^\/escalations\/(\d+)$/);
  if (escMatch && method === 'PATCH') {
    markEscalationHandled(hotelId, Number(escMatch[1]));
    json(res, 200, ok({ handled: true }));
    return;
  }

  if (method === 'GET' && sub === '/audit') {
    json(res, 200, ok({ entries: listAudit(hotelId, 300) }));
    return;
  }

  if (method === 'GET' && sub === '/reports') {
    const reservations = listReservations(hotelId, 'all');
    const thirtyDaysAgo = addDays(todayIso(), -30);
    const recent = reservations.filter((r) => r.check_in >= thirtyDaysAgo && !['cancelled', 'declined'].includes(r.status));
    const bySource = new Map<string, number>();
    for (const r of recent) bySource.set(r.source || 'other', (bySource.get(r.source || 'other') ?? 0) + 1);
    const revenueByDay = new Map<string, number>();
    for (const r of reservations) {
      if (['confirmed', 'checked_in', 'checked_out'].includes(r.status)) {
        revenueByDay.set(r.check_in, (revenueByDay.get(r.check_in) ?? 0) + r.total_amount);
      }
    }
    json(res, 200, ok({
      period: { from: thirtyDaysAgo, to: todayIso() },
      reservations: recent.length,
      revenue: recent.reduce((s, r) => s + r.total_amount, 0),
      avgRate: recent.length ? Math.round(recent.reduce((s, r) => s + r.total_amount, 0) / recent.length) : 0,
      bySource: [...bySource.entries()].map(([source, count]) => ({ source, count })),
      revenueByDay: [...revenueByDay.entries()].sort().map(([date, amount]) => ({ date, amount })),
      rating: averageRating(hotelId),
      feedbackCount: listFeedback(hotelId).length,
    }));
    return;
  }

  if (method === 'GET' && sub === '/agents') {
    const capabilities = Object.entries(registry.list().reduce<Record<string, string[]>>((acc, t) => {
      (acc[t.permission] ??= []).push(t.name);
      return acc;
    }, {}));
    json(res, 200, ok({
      tools: registry.list().map((t) => ({ name: t.name, permission: t.permission, summary: t.summary })),
      agents: agentsCatalog(),
      runs: listAgentRuns(hotelId, 50),
      capabilities,
    }));
    return;
  }

  if (method === 'GET' && sub === '/config') {
    json(res, 200, ok({ hotel }));
    return;
  }
  if (method === 'PATCH' && sub === '/config') {
    const body = await parseJson<Record<string, string>>(req);
    updateHotel(hotelId, {
      name: body.name,
      email: body.email,
      phone: body.phone,
      whatsapp_phone: body.whatsappPhone ?? body.whatsapp_phone,
      address: body.address,
      city: body.city,
      check_in_time: body.checkInTime,
      check_out_time: body.checkOutTime,
      currency: body.currency,
      description: body.description,
    });
    writeAudit({ hotelId, actorType: 'admin', actorId: session.sub, action: 'hotel_config', entity: 'hotel', entityId: hotelId });
    json(res, 200, ok({ updated: true }));
    return;
  }

  json(res, 404, bad('unknown route', 'not_found'));
}

// ---------------------------------------------------------------------------
// decorators + small helpers
// ---------------------------------------------------------------------------

function safeJson(s: string): number[] {
  try {
    const v = JSON.parse(s) as unknown;
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

function countMessages(hotelId: number, convId: number): number {
  return listMessages(hotelId, convId).length;
}

function decorateMessage(m: { id: number; conversation_id: number; sender: Sender; body: string; kind: string; created_at: string }) {
  return { id: m.id, conversationId: m.conversation_id, sender: m.sender, body: m.body, kind: m.kind, at: m.created_at };
}

function decorateReservation(r: Reservation) {
  return { ...r, roomIds: safeJson(String(r.room_ids ?? '[]')) };
}

function agentsCatalog(): Array<{ id: string; name: string; description: string; capabilities: string[] }> {
  return [
    { id: 'reception', name: 'Réception / Conversation', description: 'Accueil, petite conversation, orientation.', capabilities: [] },
    { id: 'knowledge', name: 'Knowledge / FAQ', description: 'Réponses à partir de la base de connaissances (localisation, wifi, petit-déjeuner…).', capabilities: ['knowledge.search', 'hotel.info'] },
    { id: 'availability', name: 'Disponibilité', description: 'Vérifie les chambres libres et les tarifs (déterministe, depuis la base).', capabilities: ['availability.check', 'price.check'] },
    { id: 'booking', name: 'Réservation', description: 'Crée une demande, confirme après accord explicite du client, calcule le prix.', capabilities: ['availability.check', 'reservation.request', 'reservation.confirm', 'followup.create'] },
    { id: 'lead', name: 'Lead Capture', description: 'Capte demandes devis/groupe/entreprise et planifie le suivi.', capabilities: ['lead.create', 'followup.create'] },
    { id: 'crm', name: 'CRM / Client', description: 'Reconnaît le client, enrichit son profil.', capabilities: ['customer.lookup'] },
    { id: 'feedback', name: 'Feedback / Avis', description: 'Enregistre avis & plaintes; escalade les retours négatifs.', capabilities: ['feedback.log', 'followup.create'] },
    { id: 'escalation', name: 'Escalade Humaine', description: 'Bascule la conversation en mode humain + notification.', capabilities: ['escalation.create'] },
  ];
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

(async () => {
  openDb();
  migrate();
  if (!isDemoHotelSeeded()) {
    seedDemoHotel();
    console.log('[boot] demo hotel seeded');
  } else {
    console.log('[boot] existing data found — reusing', config.dbPath);
  }

  server.listen(config.port, () => {
    console.log('');
    console.log('==========================================================');
    console.log('  AI Digital Front Desk — management dashboard');
    console.log(`  http://localhost:${config.port}`);
    console.log('  Chat demo widget:  http://localhost:' + config.port + '/chat-demo.html');
    console.log('  Demo provider:    offline deterministic (no API keys)');
    console.log(`  AI provider:      ${config.ai.provider}`);
    console.log('==========================================================');
    console.log(`Dashboard login: ${config.admin.email} / ${config.admin.password} (dev only — change in .env)`);
  });
})();

function shutdown(): void {
  closeDb();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);