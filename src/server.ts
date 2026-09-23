/**
 * AI Business Operating System — HTTP Server
 * 
 * Serves the dashboard, API, and customer chat widget.
 * Uses Node.js built-in http module — zero framework dependencies.
 * Static assets served from src/dashboard/.
 * API endpoints under /api/.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { config } from './config.ts';
import { processMessage } from './core/orchestrator.ts';
import { seedDemoHotel, hashPassword, verifyPassword } from './db/seed.ts';
import { migrate } from './db/schema.ts';
import { openDb, closeDb } from './db/client.ts';
import {
  listHotels,
  getHotelById,
  getHotelBySlug,
  createHotel,
  findUserByEmail,
  updateHotel,
  listRooms,
  updateRoom,
  listCustomers,
  listConversations,
  getConversation,
  listMessages,
  listReservations,
  updateReservationStatus,
  listLeads,
  updateLeadStatus,
  listKnowledge,
  createKnowledgeItem,
  deleteKnowledgeItem,
  listFeedback,
  listFollowups,
  markFollowupDone,
  listEscalations,
  markEscalationHandled,
  listAudit,
  listAgentRuns,
  countConversations,
  countCustomers,
  countLeads,
  countFeedback,
  averageRating,
  countFollowupsDue,
  writeAudit,
} from './db/repositories.ts';
import { sendWhatsAppText, verifyWebhookSignature, normalizeInbound, webhookReady } from './channels/whatsapp.ts';
import { runScenario, scenarioIds } from './demo/simulator.ts';
import { addDays, todayIso } from './core/time.ts';
import { slugify } from './core/format.ts';
import { registry } from './core/orchestrator.ts';

// ─── Seed database on boot ─────────────────────────────────────────────────

openDb();
migrate();
seedDemoHotel();

// ─── Helpers ───────────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function ok(data: unknown): unknown { return { ok: true, ...(data as object) }; }
function bad(error: string, code: string): unknown { return { ok: false, error, code }; }

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

async function parseJson<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw) return {} as T;
  try { return JSON.parse(raw) as T; } catch { return {} as T; }
}

// ─── Rate limiting ─────────────────────────────────────────────────────────

const rateHits = new Map<string, number[]>();
function rateLimit(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const hits = rateHits.get(key) ?? [];
  const recent = hits.filter((t) => now - t < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  rateHits.set(key, recent);
  return true;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

interface Session { sub: string; role: 'admin' | 'staff'; hotelId: number | null; exp: number }
const tokens = new Map<string, Session>();

function makeToken(s: Session): string {
  const t = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  tokens.set(t, s);
  return t;
}

async function authenticate(req: IncomingMessage): Promise<Session | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const s = tokens.get(token);
  if (!s) return null;
  if (s.exp < Date.now()) { tokens.delete(token); return null; }
  return s;
}

// ─── Static Files ──────────────────────────────────────────────────────────

const DASHBOARD_DIR = join(process.cwd(), 'src', 'dashboard');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

async function serveStatic(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  try {
    let filePath = normalize(path);
    if (filePath === '/' || filePath === '') filePath = '/index.html';
    const full = join(DASHBOARD_DIR, filePath);
    if (!full.startsWith(DASHBOARD_DIR)) { res.writeHead(403); res.end(); return; }
    const s = await stat(full);
    if (s.isDirectory()) { res.writeHead(403); res.end(); return; }
    const data = await readFile(full);
    const ext = extname(full);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

// ─── Hotel Routes ──────────────────────────────────────────────────────────

async function handleHotelRoute(
  req: IncomingMessage, res: ServerResponse,
  hotel: ReturnType<typeof getHotelById>,
  sub: string, session: Session,
): Promise<void> {
  if (!hotel) { json(res, 404, bad('hotel not found', 'not_found')); return; }
  const method = (req.method ?? 'GET').toUpperCase();
  const hotelId = hotel.id;

  if (method === 'GET' && sub === '/overview') {
    const rooms = listRooms(hotelId);
    const reservations = listReservations(hotelId, 'all');
    const active = reservations.filter((r) => ['requested', 'confirmed', 'checked_in'].includes(r.status));
    const inHouse = reservations.filter((r) => r.status === 'checked_in').length;
    const arrivals = reservations.filter((r) => !['cancelled', 'declined'].includes(r.status) && r.check_in === todayIso()).length;
    const departures = reservations.filter((r) => !['cancelled', 'declined'].includes(r.status) && r.check_out === todayIso()).length;
    const nextSeven = reservations
      .filter((r) => !['cancelled', 'declined'].includes(r.status) && r.check_in >= todayIso() && r.check_in <= addDays(todayIso(), 7))
      .map((r) => ({ id: r.id, checkIn: r.check_in, checkOut: r.check_out, status: r.status, total: r.total_amount, roomIds: JSON.parse(r.room_ids || '[]') }));
    const revenue7d = reservations
      .filter((r) => ['checked_in', 'checked_out', 'confirmed'].includes(r.status) && r.check_in >= addDays(todayIso(), -7) && r.check_in <= todayIso())
      .reduce((s, r) => s + r.total_amount, 0);
    json(res, 200, ok({
      hotel,
      occupancy: {
        totalRooms: rooms.length,
        activeRooms: rooms.filter((r) => r.active === 1).length,
        inHouse, arrivals, departures,
        occupancyPct: rooms.length ? Math.round((inHouse / rooms.length) * 100) : 0,
      },
      revenue: { next7d: revenue7d },
      upcoming: nextSeven.slice(0, 10),
      kpis: {
        conversations: countConversations(hotelId),
        customers: countCustomers(hotelId),
        leads: countLeads(hotelId),
        leadsNew: countLeads(hotelId),
        feedbackNew: countFeedback(hotelId),
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
      messages: c.id,
    }));
    json(res, 200, ok({ conversations }));
    return;
  }

  const convMatch = sub.match(/^\/conversations\/(\d+)(\/messages)?$/);
  if (convMatch) {
    const cid = Number(convMatch[1]);
    const conv = getConversation(hotelId, cid);
    if (!conv) { json(res, 404, bad('conversation not found', 'not_found')); return; }
    const messages = listMessages(hotelId, cid).map((m) => ({ sender: m.sender, body: m.body, at: m.created_at }));
    json(res, 200, ok({ conversation: conv, messages }));
    return;
  }

  if (method === 'GET' && sub === '/reservations') {
    json(res, 200, ok({ reservations: listReservations(hotelId, 'all') }));
    return;
  }

  const resvMatch = sub.match(/^\/reservations\/(\d+)$/);
  if (resvMatch && method === 'PATCH') {
    const rid = Number(resvMatch[1]);
    const body = await parseJson<{ status?: string }>(req);
    if (body.status) updateReservationStatus(hotelId, rid, body.status as any);
    json(res, 200, ok({}));
    return;
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
    const lid = Number(leadMatch[1]);
    const body = await parseJson<{ status?: string }>(req);
    if (body.status) updateLeadStatus(hotelId, lid, body.status as any);
    json(res, 200, ok({}));
    return;
  }

  if (method === 'GET' && sub === '/rooms') {
    json(res, 200, ok({ rooms: listRooms(hotelId) }));
    return;
  }

  const roomMatch = sub.match(/^\/rooms\/(\d+)$/);
  if (roomMatch && method === 'PATCH') {
    const rid = Number(roomMatch[1]);
    const body = await parseJson<{ status?: string; maintenance?: number }>(req);
    updateRoom(hotelId, rid, body);
    json(res, 200, ok({}));
    return;
  }

  if (method === 'GET' && sub === '/knowledge') {
    json(res, 200, ok({ items: listKnowledge(hotelId) }));
    return;
  }

  if (method === 'POST' && sub === '/knowledge') {
    const body = await parseJson<{ category?: string; question?: string; answer?: string; keywords?: string }>(req);
    if (!body.question || !body.answer) { json(res, 400, bad('question and answer required', 'bad_request')); return; }
    createKnowledgeItem(hotelId, { category: body.category, question: body.question, answer: body.answer, keywords: body.keywords });
    json(res, 201, ok({}));
    return;
  }

  const kbMatch = sub.match(/^\/knowledge\/(\d+)$/);
  if (kbMatch && method === 'DELETE') {
    deleteKnowledgeItem(hotelId, Number(kbMatch[1]));
    json(res, 200, ok({}));
    return;
  }

  if (method === 'GET' && sub === '/feedback') {
    json(res, 200, ok({ feedback: listFeedback(hotelId) }));
    return;
  }

  if (method === 'GET' && sub === '/followups') {
    json(res, 200, ok({ followups: listFollowups(hotelId, 'all') }));
    return;
  }

  const folMatch = sub.match(/^\/followups\/(\d+)$/);
  if (folMatch && method === 'PATCH') {
    markFollowupDone(hotelId, Number(folMatch[1]));
    json(res, 200, ok({}));
    return;
  }

  if (method === 'GET' && sub === '/escalations') {
    json(res, 200, ok({ escalations: listEscalations(hotelId, 'all') }));
    return;
  }

  const escMatch = sub.match(/^\/escalations\/(\d+)$/);
  if (escMatch && method === 'PATCH') {
    markEscalationHandled(hotelId, Number(escMatch[1]));
    json(res, 200, ok({}));
    return;
  }

  if (method === 'GET' && sub === '/reports') {
    const reservations = listReservations(hotelId, 'all');
    const from = reservations.length ? reservations[reservations.length - 1].check_in : todayIso();
    const to = reservations.length ? reservations[0].check_in : todayIso();
    json(res, 200, ok({
      period: { from, to },
      reservations: reservations.filter(r => !['cancelled', 'declined'].includes(r.status)).length,
      revenue: reservations.filter(r => ['checked_in', 'checked_out', 'confirmed'].includes(r.status)).reduce((s, r) => s + r.total_amount, 0),
      avgRate: reservations.length ? reservations.filter(r => !['cancelled', 'declined'].includes(r.status)).reduce((s, r) => s + r.total_amount, 0) / Math.max(1, reservations.filter(r => !['cancelled', 'declined'].includes(r.status)).length) : 0,
      rating: averageRating(hotelId),
      feedbackCount: listFeedback(hotelId).length,
      bySource: [
        { source: 'ai', count: reservations.filter(r => r.source === 'ai').length },
        { source: 'web', count: reservations.filter(r => r.source === 'web').length },
        { source: 'whatsapp', count: reservations.filter(r => r.source === 'whatsapp').length },
        { source: 'walkin', count: reservations.filter(r => r.source === 'walkin').length },
      ],
    }));
    return;
  }

  if (method === 'GET' && sub === '/audit') {
    json(res, 200, ok({ entries: listAudit(hotelId, 100) }));
    return;
  }

  if (method === 'GET' && sub === '/agents') {
    json(res, 200, ok({
      agents: Array.from(registry.list().values()).map((t) => ({ id: t.name, description: t.description, permission: t.permission })),
      tools: Array.from(registry.list().values()).map((t) => ({ name: t.name, permission: t.permission, summary: t.description })),
      runs: listAgentRuns(hotelId, 20),
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
      whatsapp_phone: body.whatsappPhone,
      address: body.address,
      city: body.city,
      currency: body.currency,
      check_in_time: body.checkInTime,
      check_out_time: body.checkOutTime,
    } as any);
    json(res, 200, ok({}));
    return;
  }

  json(res, 404, bad('unknown route', 'not_found'));
}

// ─── Server ────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;
  const method = (req.method ?? 'GET').toUpperCase();

  try {
    // Public: health
    if (method === 'GET' && path === '/api/health') {
      json(res, 200, ok({ up: true, provider: 'demo', time: todayIso() }));
      return;
    }

    // Public: login
    if (method === 'POST' && path === '/api/login') {
      if (!rateLimit(`login:${req.socket.remoteAddress ?? 'x'}`, 10, 60_000)) {
        json(res, 429, bad('too many login attempts', 'rate_limited'));
        return;
      }
      const body = await parseJson<{ email?: string; password?: string }>(req);
      const email = (body.email ?? '').trim().toLowerCase();
      const password = body.password ?? '';
      if (email === config.admin.email.toLowerCase() && password === config.admin.password) {
        const token = makeToken({ sub: email, role: 'admin', hotelId: null, exp: Date.now() + 12 * 3600_000 });
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

    // Public: guest web chat
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
      if (!text) { json(res, 400, bad('text is required', 'bad_request')); return; }
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

    // Public: fetch chat messages for the web widget
    const chatMsgsMatch = path.match(/^\/api\/chat\/(\d+)\/messages$/);
    if (method === 'GET' && chatMsgsMatch) {
      const conversationId = Number(chatMsgsMatch[1]);
      let conv;
      let hotel;
      for (const h of listHotels()) {
        if (h.demo_enabled !== 1) continue;
        const c = getConversation(h.id, conversationId);
        if (c) { conv = c; hotel = h; break; }
      }
      if (!conv || !hotel) { json(res, 404, bad('conversation not found', 'not_found')); return; }
      const messages = listMessages(conv.hotel_id, conversationId).map((m) => ({ sender: m.sender, body: m.body, at: m.created_at }));
      json(res, 200, ok({ hotelSlug: hotel.slug, messages }));
      return;
    }

    // WhatsApp webhook
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
      if (!webhookReady()) { json(res, 501, bad('whatsapp not configured', 'not_configured')); return; }
      if (!verifyWebhookSignature(raw, req.headers['x-hub-signature-256'] as string | undefined, config.whatsapp.verifyToken)) {
        json(res, 403, bad('invalid signature', 'forbidden'));
        return;
      }
      const payload = JSON.parse(raw) as Record<string, unknown>;
      const inbound = normalizeInbound(payload);
      const results: Array<{ from: string; ok: boolean }> = [];
      for (const msg of inbound) {
        const hotels = listHotels().filter((h) => h.whatsapp_phone && msg.from !== h.whatsapp_phone);
        const hotel = hotels[0] ?? listHotels().find((h) => h.demo_enabled === 1) ?? listHotels()[0];
        if (!hotel) { results.push({ from: msg.from, ok: false }); continue; }
        const result = await processMessage({ hotelId: hotel.id, channel: 'whatsapp', text: msg.text, contact: { phone: msg.from } });
        await sendWhatsAppText(msg.from, result.reply, hotel.id);
        results.push({ from: msg.from, ok: true });
      }
      json(res, 200, { ok: true, results });
      return;
    }

    // Public: demo scenarios
    if (method === 'GET' && path === '/api/demo/scenarios') {
      json(res, 200, ok({ scenarios: scenarioIds() }));
      return;
    }
    if (method === 'POST' && path === '/api/demo/run') {
      const body = await parseJson<{ scenario?: string; language?: 'fr' | 'en' }>(req);
      const hotel = listHotels().find((h) => h.demo_enabled === 1) ?? listHotels()[0];
      if (!hotel) { json(res, 404, bad('no demo hotel', 'not_found')); return; }
      const transcript = await runScenario(hotel.id, body.scenario ?? 'all', body.language ?? 'fr');
      json(res, 200, ok({ hotelId: hotel.id, transcript }));
      return;
    }

    // Static assets (no auth required)
    if (!path.startsWith('/api/')) {
      await serveStatic(req, res, path);
      return;
    }

    // Authenticated API
    const session = await authenticate(req);
    if (!session) { json(res, 401, bad('authentication required', 'unauthorized')); return; }

    if (method === 'GET' && path === '/api/me') {
      json(res, 200, ok({ session }));
      return;
    }

    // Hotels list + onboarding
    if (method === 'GET' && path === '/api/hotels') {
      json(res, 200, ok({
        hotels: listHotels().map((h) => ({
          id: h.id, slug: h.slug, name: h.name, city: h.city,
          demo: h.demo_enabled === 1,
          rooms: listRooms(h.id).length,
        })),
      }));
      return;
    }
    if (method === 'POST' && path === '/api/hotels') {
      const body = await parseJson<Record<string, string>>(req);
      const name = (body.name ?? '').trim();
      if (!name) { json(res, 400, bad('name is required', 'bad_request')); return; }
      const base = slugify(name || 'hotel');
      let slug = base;
      let n = 2;
      while (getHotelBySlug(slug)) slug = `${base}-${n++}`;
      const hotelId = createHotel({
        slug, name, email: body.email ?? '', phone: body.phone ?? '',
        whatsappPhone: body.whatsappPhone ?? '', address: body.address ?? '',
        city: body.city ?? '', country: body.country ?? 'Cameroon',
        currency: body.currency ?? 'XAF', checkInTime: body.checkInTime ?? '14:00',
        checkOutTime: body.checkOutTime ?? '12:00',
      });
      writeAudit({ hotelId, actorType: 'admin', actorId: session.sub, action: 'hotel_onboarded', entity: 'hotel', entityId: hotelId });
      json(res, 201, ok({ hotelId, slug }));
      return;
    }

    // Per-hotel routes
    const m = path.match(/^\/api\/hotels\/(\d+)(\/.*)?$/);
    if (m) {
      const hotelId = Number(m[1]);
      const hotel = getHotelById(hotelId);
      if (!hotel) { json(res, 404, bad('hotel not found', 'not_found')); return; }
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
    json(res, 500, bad(`internal error: ${msg}`, 'internal'));
  }
});

server.listen(config.port, () => {
  console.log(`AI Business Operating System running on http://localhost:${config.port}`);
  console.log(`Dashboard: http://localhost:${config.port}/`);
  console.log(`Chat demo: http://localhost:${config.port}/chat-demo.html`);
});

process.on('SIGTERM', () => { closeDb(); server.close(() => process.exit(0)); });
process.on('SIGINT', () => { closeDb(); server.close(() => process.exit(0)); });
