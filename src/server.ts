/**
 * AI Business Operating System — HTTP Server
 * 
 * Multi-tenant SaaS with:
 * - Account registration/login (secure scrypt passwords, database sessions)
 * - Business/tenant management (hotels + future verticals)
 * - AI Employee configuration
 * - Customer-facing chat widget
 * - Owner dashboard with activity
 * - WhatsApp webhook integration
 * 
 * Architecture:
 *   Public: Landing, Signup, Login, Widget (branding + chat), WhatsApp webhook
 *   Authenticated: Business workspace, Onboarding, Employee config, Conversations, Activity
 * 
 * All authenticated routes enforce tenant isolation via auth.ts sessions.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { config } from './config.ts';
import { processMessage } from './core/orchestrator.ts';
import { seedDemoHotel } from './db/seed.ts';
import { migrate } from './db/schema.ts';
import { openDb, closeDb } from './db/client.ts';
import { hashPassword, verifyPassword, createSession, destroySession, authenticateRequest, setSessionCookieHeaders, clearSessionCookieHeaders, isValidEmail, isValidPassword, sanitizeText, sanitizeString, type Session } from './auth.ts';
import {
  listHotels,
  getHotelById,
  getHotelBySlug,
  createHotel,
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
  getEmployeeProfile,
  createEmployeeProfile,
  updateEmployeeProfile,
  listBusinessServices,
  createBusinessService,
  updateBusinessService,
  deleteBusinessService,
  listBusinessPolicies,
  createBusinessPolicy,
  updateBusinessPolicy,
  deleteBusinessPolicy,
  getOnboardingChecklist,
  initOnboardingChecklist,
  completeOnboardingStep,
  resetOnboardingStep,
  createAccount,
  findAccountByEmail,
  findAccountById,
  createBusiness,
  getBusinessBySlug,
  getBusinessById,
  createMembership,
  getMembership,
  listMembershipsForAccount,
  listMembershipsForBusiness,
} from './db/repositories.ts';
import { registry } from './core/orchestrator.ts';
import { addDays, todayIso } from './core/time.ts';
import { slugify } from './core/format.ts';

// ─── Seed database on boot ─────────────────────────────────────────────────

openDb();
migrate();
seedDemoHotel();

// Initialize onboarding + employee for existing hotels
for (const h of listHotels()) {
  initOnboardingChecklist(h.id);
  const existing = getEmployeeProfile(h.id);
  if (!existing) {
    createEmployeeProfile(h.id, {
      name: 'Sarah',
      role: 'Réceptionniste',
      avatar_emoji: '👩‍💼',
      welcome_message: `Bienvenue à ${h.name}! Je suis Sarah, votre réceptionniste numérique. Comment puis-je vous aider?`,
      status: h.demo_enabled ? 'active' : 'draft',
    });
  }
}

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
    let size = 0;
    const MAX_BODY = 1_000_000; // 1MB limit
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

async function parseJson<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw) return {} as T;
  try { return JSON.parse(raw) as T; } catch { return {} as T; }
}

// ─── Rate Limiting (Simple in-memory, per-IP) ─────────────────────────────

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

// Periodically clean up rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of rateHits.entries()) {
    const recent = hits.filter((t) => now - t < 120_000);
    if (recent.length === 0) rateHits.delete(key);
    else rateHits.set(key, recent);
  }
}, 60_000);

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

// ─── CORS ──────────────────────────────────────────────────────────────────

function setCors(res: ServerResponse, origin?: string): void {
  const allowedOrigin = config.corsOrigin || origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ─── Security Headers ──────────────────────────────────────────────────────

function setSecurityHeaders(res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
}

// ─── Public Routes ─────────────────────────────────────────────────────────

async function handlePublicRoutes(req: IncomingMessage, res: ServerResponse, path: string, method: string): Promise<boolean> {
  // Health check
  if (method === 'GET' && path === '/api/health') {
    json(res, 200, ok({ up: true, provider: config.ai.provider, time: todayIso() }));
    return true;
  }

  // CORS preflight
  if (method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return true;
  }

  // Account registration
  if (method === 'POST' && path === '/api/signup') {
    setCors(res);
    if (!rateLimit(`signup:${req.socket.remoteAddress ?? 'x'}`, 5, 60_000)) {
      json(res, 429, bad('too many signup attempts', 'rate_limited'));
      return true;
    }
    const body = await parseJson<{ email?: string; password?: string; name?: string; businessName?: string }>(req);
    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';
    const name = sanitizeString(body.name ?? '', 100);
    const businessName = sanitizeString(body.businessName ?? '', 200);

    if (!email || !password || !name) {
      json(res, 400, bad('email, password, and name are required', 'bad_request'));
      return true;
    }
    if (!isValidEmail(email)) {
      json(res, 400, bad('invalid email address', 'bad_request'));
      return true;
    }
    if (!isValidPassword(password)) {
      json(res, 400, bad('password must be between 8 and 128 characters', 'bad_request'));
      return true;
    }

    const existingAccount = findAccountByEmail(email);
    if (existingAccount) {
      json(res, 409, bad('email already registered', 'conflict'));
      return true;
    }

    const passwordHash = hashPassword(password);
    const accountId = createAccount(email, name, passwordHash);

    const bizSlug = slugify(businessName || `${name}'s Business`);
    let finalSlug = bizSlug;
    let n = 2;
    while (getBusinessBySlug(finalSlug)) finalSlug = `${bizSlug}-${n++}`;

    const businessId = createBusiness({
      slug: finalSlug,
      name: businessName || `${name}'s Business`,
      business_type: 'hotel',
    });

    const hotelId = createHotel({
      slug: `${finalSlug}-hotel`,
      name: businessName || `${name}'s Hotel`,
      description: '',
    });

    createMembership(accountId, businessId, 'owner');
    initOnboardingChecklist(hotelId);
    createEmployeeProfile(hotelId, {
      name: 'Assistant',
      role: 'Réceptionniste',
      status: 'draft',
      welcome_message: `Bienvenue! Je suis l'assistant(e) numérique de ${businessName || 'votre établissement'}. Comment puis-je vous aider?`,
    });

    writeAudit({
      hotelId,
      actorType: 'human',
      actorId: email,
      action: 'account_created',
      entity: 'account',
      entityId: accountId,
      details: `Account created for ${email}, business: ${businessName}`,
    });

    const session = createSession(accountId, businessId, req.socket.remoteAddress ?? '0.0.0.0', req.headers['user-agent'] ?? 'unknown');

    res.setHeader('Set-Cookie', setSessionCookieHeaders(session.token));
    json(res, 201, ok({
      token: session.token,
      account: { id: accountId, email, name },
      business: { id: businessId, slug: finalSlug, name: businessName },
      hotelId,
    }));
    return true;
  }

  // Login
  if (method === 'POST' && path === '/api/login') {
    setCors(res);
    if (!rateLimit(`login:${req.socket.remoteAddress ?? 'x'}`, 10, 60_000)) {
      json(res, 429, bad('too many login attempts', 'rate_limited'));
      return true;
    }
    const body = await parseJson<{ email?: string; password?: string }>(req);
    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';

    if (!email || !password) {
      json(res, 400, bad('email and password are required', 'bad_request'));
      return true;
    }

    // Check platform admin (only if explicitly configured)
    if (config.admin.apiToken && email === config.admin.email.toLowerCase()) {
      // Use constant-time comparison for admin token
      // For MVP, password-based admin login is kept but flagged as insecure
    }

    const account = findAccountByEmail(email);
    if (account && verifyPassword(password, account.password_hash)) {
      const memberships = listMembershipsForAccount(account.id);
      const primaryMembership = memberships[0];
      const business = primaryMembership ? getBusinessById(primaryMembership.business_id) : null;

      const session = createSession(
        account.id,
        business?.id ?? null,
        req.socket.remoteAddress ?? '0.0.0.0',
        req.headers['user-agent'] ?? 'unknown'
      );

      writeAudit({
        hotelId: null,
        actorType: 'human',
        actorId: email,
        action: 'login',
        entity: 'account',
        entityId: account.id,
      });

      res.setHeader('Set-Cookie', setSessionCookieHeaders(session.token));
      json(res, 200, ok({
        token: session.token,
        role: 'owner',
        email: account.email,
        name: account.name,
        businessId: business?.id,
        businessName: business?.name,
        memberships: memberships.map(m => ({ businessId: m.business_id, role: m.role })),
      }));
      return true;
    }

    writeAudit({ hotelId: null, actorType: 'system', actorId: email, action: 'login_failed', entity: 'auth' });
    json(res, 401, bad('invalid credentials', 'unauthorized'));
    return true;
  }

  // Logout
  if (method === 'POST' && path === '/api/logout') {
    setCors(res);
    const session = authenticateRequest(req);
    if (session) {
      destroySession(session.token);
    }
    res.setHeader('Set-Cookie', clearSessionCookieHeaders());
    json(res, 200, ok({ loggedOut: true }));
    return true;
  }

  // Public: Business branding (for widget)
  const brandingMatch = path.match(/^\/api\/businesses\/([^\/]+)\/branding$/);
  if (method === 'GET' && brandingMatch) {
    setCors(res);
    const slug = brandingMatch[1];
    const business = getBusinessBySlug(slug);
    if (!business) {
      json(res, 404, bad('business not found', 'not_found'));
      return true;
    }

    const hotels = listHotels().filter(h => h.slug.includes(slug) || h.demo_enabled === 1);
    const hotel = hotels[0];
    const employee = hotel ? getEmployeeProfile(hotel.id) : null;

    json(res, 200, ok({
      slug: business.slug,
      name: business.name,
      description: business.description,
      city: business.city,
      country: business.country,
      businessType: business.business_type,
      employee: employee ? {
        name: employee.name,
        role: employee.role,
        avatar_emoji: employee.avatar_emoji,
        welcome_message: employee.welcome_message,
        status: employee.status,
      } : null,
    }));
    return true;
  }

  // Public: Customer chat (widget)
  if (method === 'POST' && path === '/api/widget/chat') {
    setCors(res);
    if (!rateLimit(`chat:${req.socket.remoteAddress ?? 'x'}`, 30, 60_000)) {
      json(res, 429, bad('too many requests', 'rate_limited'));
      return true;
    }

    const body = await parseJson<{
      businessSlug?: string;
      hotelSlug?: string;
      text?: string;
      conversationId?: number;
      sessionId?: string;
      contact?: { phone?: string; name?: string; email?: string };
    }>(req);

    const slug = body.businessSlug || body.hotelSlug;
    if (!slug) {
      json(res, 400, bad('businessSlug or hotelSlug is required', 'bad_request'));
      return true;
    }

    let hotel = getHotelBySlug(slug);
    if (!hotel) {
      const business = getBusinessBySlug(slug);
      if (business) {
        const hotels = listHotels();
        hotel = hotels.find(h => h.slug.includes(slug) || h.slug.includes(business.slug));
      }
    }
    if (!hotel && slug === 'demo') {
      hotel = getHotelBySlug('demo');
    }

    if (!hotel) {
      json(res, 404, bad('business not found or not accepting messages', 'not_found'));
      return true;
    }

    const text = sanitizeText(body.text ?? '', 2000);
    if (!text) {
      json(res, 400, bad('text is required', 'bad_request'));
      return true;
    }

    const result = await processMessage({
      hotelId: hotel.id,
      conversationId: body.conversationId,
      channel: 'web',
      text,
      contact: body.contact,
    });

    const employee = getEmployeeProfile(hotel.id);

    json(res, 200, {
      ok: true,
      reply: result.reply,
      conversationId: result.conversationId,
      intent: result.intent,
      provider: result.provider,
      employee: employee ? {
        name: employee.name,
        avatar_emoji: employee.avatar_emoji,
        role: employee.role,
        welcome_message: employee.welcome_message,
      } : null,
    });
    return true;
  }

  // Public: Fetch conversation messages (for widget history)
  const chatHistoryMatch = path.match(/^\/api\/widget\/conversations\/(\d+)\/messages$/);
  if (method === 'GET' && chatHistoryMatch) {
    setCors(res);
    const conversationId = Number(chatHistoryMatch[1]);

    let conv;
    let hotel;
    for (const h of listHotels()) {
      const c = getConversation(h.id, conversationId);
      if (c) { conv = c; hotel = h; break; }
    }

    if (!conv || !hotel) {
      json(res, 404, bad('conversation not found', 'not_found'));
      return true;
    }

    const messages = listMessages(conv.hotel_id, conversationId).map(m => ({
      sender: m.sender,
      body: m.body,
      kind: m.kind,
      at: m.created_at,
    }));

    const employee = getEmployeeProfile(hotel.id);
    const business = getBusinessBySlug(hotel.slug);

    json(res, 200, ok({
      messages,
      employee: employee ? { name: employee.name, avatar_emoji: employee.avatar_emoji, role: employee.role } : null,
      business: business ? { name: business.name, slug: business.slug } : { name: hotel.name, slug: hotel.slug },
    }));
    return true;
  }

  return false;
}

// ─── Authenticated Routes ──────────────────────────────────────────────────

async function handleAuthenticatedRoutes(req: IncomingMessage, res: ServerResponse, session: Session, path: string, method: string): Promise<boolean> {
  
  // Get current session info
  if (method === 'GET' && path === '/api/me') {
    const account = findAccountById(session.account_id);
    const memberships = listMembershipsForAccount(session.account_id);
    const businesses = memberships.map(m => {
      const biz = getBusinessById(m.business_id);
      return biz ? { id: biz.id, slug: biz.slug, name: biz.name, role: m.role, businessType: biz.business_type } : null;
    }).filter(Boolean);

    json(res, 200, ok({
      session: {
        accountId: session.account_id,
        email: account?.email,
        name: account?.name,
        role: memberships[0]?.role ?? 'owner',
      },
      currentBusiness: session.business_id ? { id: session.business_id, name: account?.name } : null,
      businesses,
    }));
    return true;
  }

  // Switch active business
  if (method === 'POST' && path === '/api/me/business') {
    const body = await parseJson<{ businessId?: number }>(req);
    const businessId = body.businessId;
    if (!businessId) {
      json(res, 400, bad('businessId is required', 'bad_request'));
      return true;
    }
    const membership = getMembership(session.account_id, businessId);
    if (!membership) {
      json(res, 403, bad('not a member of this business', 'forbidden'));
      return true;
    }
    const business = getBusinessById(businessId);
    if (!business) {
      json(res, 404, bad('business not found', 'not_found'));
      return true;
    }
    const token = createSession(session.account_id, businessId, req.socket.remoteAddress ?? '0.0.0.0', req.headers['user-agent'] ?? 'unknown');
    res.setHeader('Set-Cookie', setSessionCookieHeaders(token.token));
    json(res, 200, ok({ token: token.token, business: { id: business.id, slug: business.slug, name: business.name } }));
    return true;
  }

  // List businesses for current account
  if (method === 'GET' && path === '/api/businesses') {
    const memberships = listMembershipsForAccount(session.account_id);
    const businesses = memberships.map(m => {
      const biz = getBusinessById(m.business_id);
      if (!biz) return null;
      return {
        id: biz.id,
        slug: biz.slug,
        name: biz.name,
        description: biz.description,
        city: biz.city,
        country: biz.country,
        businessType: biz.business_type,
        isPublic: biz.is_public === 1,
        role: m.role,
        createdAt: biz.created_at,
      };
    }).filter(Boolean);
    json(res, 200, ok({ businesses }));
    return true;
  }

  // Create a new business
  if (method === 'POST' && path === '/api/businesses') {
    const body = await parseJson<{
      name?: string;
      slug?: string;
      description?: string;
      businessType?: string;
      city?: string;
      country?: string;
    }>(req);
    const name = sanitizeString(body.name ?? '', 200);
    if (!name) {
      json(res, 400, bad('name is required', 'bad_request'));
      return true;
    }
    const baseSlug = slugify(body.slug || name);
    let finalSlug = baseSlug;
    let n = 2;
    while (getBusinessBySlug(finalSlug)) finalSlug = `${baseSlug}-${n++}`;

    const businessId = createBusiness({
      slug: finalSlug,
      name,
      description: body.description ?? '',
      business_type: body.businessType ?? 'hotel',
      city: body.city ?? '',
      country: body.country ?? 'Cameroon',
    });

    createMembership(session.account_id, businessId, 'owner');

    const hotelId = createHotel({
      slug: `${finalSlug}-hotel`,
      name,
      description: body.description ?? '',
      city: body.city ?? '',
      country: body.country ?? 'Cameroon',
    });

    initOnboardingChecklist(hotelId);
    createEmployeeProfile(hotelId, {
      name: 'Assistant',
      role: 'Réceptionniste',
      status: 'draft',
      welcome_message: `Bienvenue! Je suis l'assistant(e) numérique de ${name}. Comment puis-je vous aider?`,
    });

    writeAudit({
      hotelId,
      actorType: 'human',
      actorId: 'account:' + session.account_id,
      action: 'business_created',
      entity: 'business',
      entityId: businessId,
      details: `Business created: ${name}`,
    });

    json(res, 201, ok({
      business: { id: businessId, slug: finalSlug, name, businessType: body.businessType ?? 'hotel' },
      hotelId,
    }));
    return true;
  }

  // Per-business routes
  const businessMatch = path.match(/^\/api\/businesses\/(\d+)(\/.*)?$/);
  if (businessMatch) {
    const businessId = Number(businessMatch[1]);
    const membership = getMembership(session.account_id, businessId);
    if (!membership) {
      json(res, 403, bad('not authorized for this business', 'forbidden'));
      return true;
    }

    const sub = businessMatch[2]?.split('?')[0] ?? '';

    // Business details
    if (method === 'GET' && sub === '') {
      const business = getBusinessById(businessId);
      if (!business) { json(res, 404, bad('business not found', 'not_found')); return true; }
      json(res, 200, ok({ business }));
      return true;
    }

    // Find the hotel for this business (legacy)
    const hotels = listHotels().filter(h => h.slug.includes(getBusinessById(businessId)?.slug ?? ''));
    const hotel = hotels[0];
    if (!hotel) {
      json(res, 404, bad('no hotel found for this business', 'not_found'));
      return true;
    }

    return await handleHotelRoutes(req, res, hotel, session, sub, method);
  }

  return false;
}

// ─── Hotel Routes (scoped to a business the user owns) ─────────────────────

async function handleHotelRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  hotel: NonNullable<ReturnType<typeof getHotelById>>,
  session: Session,
  sub: string,
  method: string,
): Promise<boolean> {
  const hotelId = hotel.id;

  // Employee Profile
  if (method === 'GET' && sub === '/employee') {
    const profile = getEmployeeProfile(hotelId);
    const checklist = getOnboardingChecklist(hotelId);
    json(res, 200, ok({ profile, checklist }));
    return true;
  }

  if (method === 'PUT' && sub === '/employee') {
    const body = await parseJson<Record<string, string | number>>(req);
    const updates: Record<string, string | number> = {};
    const fields = ['name', 'role', 'personality', 'tone', 'languages', 'avatar_emoji',
      'welcome_message', 'escalation_trigger', 'escalation_message', 'pause_on_escalation',
      'max_response_length', 'custom_greeting', 'status', 'onboarding_step', 'onboarding_completed'];
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f] as string | number;
    }
    updateEmployeeProfile(hotelId, updates);
    const profile = getEmployeeProfile(hotelId);
    writeAudit({ hotelId, actorType: 'human', actorId: 'account:' + session.account_id, action: 'employee_updated', entity: 'employee', details: JSON.stringify(Object.keys(updates)) });
    json(res, 200, ok({ profile }));
    return true;
  }

  // Business Services
  if (method === 'GET' && sub === '/services') {
    json(res, 200, ok({ services: listBusinessServices(hotelId) }));
    return true;
  }

  if (method === 'POST' && sub === '/services') {
    const body = await parseJson<{ name?: string; description?: string; category?: string; price?: number | null; price_unit?: string; available?: number; sort_order?: number }>(req);
    if (!body.name) { json(res, 400, bad('name required', 'bad_request')); return true; }
    const id = createBusinessService(hotelId, body as any);
    writeAudit({ hotelId, actorType: 'human', actorId: 'account:' + session.account_id, action: 'service_created', entity: 'service', entityId: id, details: body.name });
    json(res, 201, ok({ id }));
    return true;
  }

  const svcMatch = sub.match(/^\/services\/(\d+)$/);
  if (svcMatch) {
    const id = Number(svcMatch[1]);
    if (method === 'PUT') {
      const body = await parseJson<Record<string, string | number | null>>(req);
      updateBusinessService(hotelId, id, {
        name: body.name as string,
        description: body.description as string,
        category: body.category as string,
        price: body.price as number | null,
        price_unit: body.price_unit as string,
        available: body.available as number,
        sort_order: body.sort_order as number,
      });
    } else if (method === 'DELETE') {
      deleteBusinessService(hotelId, id);
    }
    json(res, 200, ok({}));
    return true;
  }

  // Business Policies
  if (method === 'GET' && sub === '/policies') {
    json(res, 200, ok({ policies: listBusinessPolicies(hotelId) }));
    return true;
  }

  if (method === 'POST' && sub === '/policies') {
    const body = await parseJson<{ policy_type?: string; title?: string; content?: string; active?: number; sort_order?: number }>(req);
    if (!body.title || !body.content || !body.policy_type) {
      json(res, 400, bad('policy_type, title, content required', 'bad_request'));
      return true;
    }
    const id = createBusinessPolicy(hotelId, {
      policy_type: body.policy_type,
      title: body.title,
      content: body.content,
      active: body.active,
      sort_order: body.sort_order,
    });
    writeAudit({ hotelId, actorType: 'human', actorId: 'account:' + session.account_id, action: 'policy_created', entity: 'policy', entityId: id, details: body.title });
    json(res, 201, ok({ id }));
    return true;
  }

  const polMatch = sub.match(/^\/policies\/(\d+)$/);
  if (polMatch) {
    const id = Number(polMatch[1]);
    if (method === 'PUT') {
      const body = await parseJson<Record<string, string | number>>(req);
      updateBusinessPolicy(hotelId, id, {
        policy_type: body.policy_type as string,
        title: body.title as string,
        content: body.content as string,
        active: body.active as number,
        sort_order: body.sort_order as number,
      });
    } else if (method === 'DELETE') {
      deleteBusinessPolicy(hotelId, id);
    }
    json(res, 200, ok({}));
    return true;
  }

  // Onboarding Checklist
  if (method === 'GET' && sub === '/onboarding') {
    json(res, 200, ok({ checklist: getOnboardingChecklist(hotelId) }));
    return true;
  }

  if (method === 'POST' && sub === '/onboarding/complete') {
    const body = await parseJson<{ step?: string }>(req);
    if (!body.step) { json(res, 400, bad('step required', 'bad_request')); return true; }
    completeOnboardingStep(hotelId, body.step);
    const current = getEmployeeProfile(hotelId);
    if (current) {
      const stepIdx = ['business_info', 'employee_identity', 'services', 'policies', 'knowledge', 'escalation', 'test', 'activate'].indexOf(body.step);
      if (stepIdx > current.onboarding_step) {
        updateEmployeeProfile(hotelId, { onboarding_step: stepIdx });
      }
    }
    writeAudit({ hotelId, actorType: 'human', actorId: 'account:' + session.account_id, action: 'onboarding_step_completed', entity: 'onboarding', details: body.step });
    json(res, 200, ok({ checklist: getOnboardingChecklist(hotelId) }));
    return true;
  }

  if (method === 'POST' && sub === '/onboarding/reset') {
    const body = await parseJson<{ step?: string }>(req);
    if (!body.step) { json(res, 400, bad('step required', 'bad_request')); return true; }
    resetOnboardingStep(hotelId, body.step);
    json(res, 200, ok({ checklist: getOnboardingChecklist(hotelId) }));
    return true;
  }

  // Test employee (preview mode)
  if (method === 'POST' && sub === '/test-employee') {
    const body = await parseJson<{ text?: string }>(req);
    const text = sanitizeText(body.text ?? '', 2000);
    if (!text) { json(res, 400, bad('text required', 'bad_request')); return true; }
    const result = await processMessage({
      hotelId,
      channel: 'web',
      text,
      contact: { name: 'Test User', phone: '+237****0000' },
    });
    json(res, 200, ok({
      reply: result.reply,
      intent: result.intent,
      confidence: result.confidence,
      actions: result.actions.map((a) => ({ tool: a.tool, ok: a.ok, facts: a.facts })),
    }));
    return true;
  }

  // Overview
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
    return true;
  }

  // Conversations list
  if (method === 'GET' && sub === '/conversations') {
    const conversations = listConversations(hotelId).map((c) => ({
      ...c,
      messages: c.id,
    }));
    json(res, 200, ok({ conversations }));
    return true;
  }

  // Single conversation with messages
  const convMatch = sub.match(/^\/conversations\/(\d+)(\/messages)?$/);
  if (convMatch) {
    const cid = Number(convMatch[1]);
    const conv = getConversation(hotelId, cid);
    if (!conv) { json(res, 404, bad('conversation not found', 'not_found')); return true; }
    const messages = listMessages(hotelId, cid).map((m) => ({ sender: m.sender, body: m.body, kind: m.kind, at: m.created_at }));
    json(res, 200, ok({ conversation: conv, messages }));
    return true;
  }

  // Reservations
  if (method === 'GET' && sub === '/reservations') {
    json(res, 200, ok({ reservations: listReservations(hotelId, 'all') }));
    return true;
  }

  const resvMatch = sub.match(/^\/reservations\/(\d+)$/);
  if (resvMatch && method === 'PATCH') {
    const rid = Number(resvMatch[1]);
    const body = await parseJson<{ status?: string }>(req);
    if (body.status) updateReservationStatus(hotelId, rid, body.status as any);
    json(res, 200, ok({}));
    return true;
  }

  // Customers
  if (method === 'GET' && sub === '/customers') {
    json(res, 200, ok({ customers: listCustomers(hotelId) }));
    return true;
  }

  // Leads
  if (method === 'GET' && sub === '/leads') {
    json(res, 200, ok({ leads: listLeads(hotelId) }));
    return true;
  }

  const leadMatch = sub.match(/^\/leads\/(\d+)$/);
  if (leadMatch && method === 'PATCH') {
    const lid = Number(leadMatch[1]);
    const body = await parseJson<{ status?: string }>(req);
    if (body.status) updateLeadStatus(hotelId, lid, body.status as any);
    json(res, 200, ok({}));
    return true;
  }

  // Rooms
  if (method === 'GET' && sub === '/rooms') {
    json(res, 200, ok({ rooms: listRooms(hotelId) }));
    return true;
  }

  const roomMatch = sub.match(/^\/rooms\/(\d+)$/);
  if (roomMatch && method === 'PATCH') {
    const rid = Number(roomMatch[1]);
    const body = await parseJson<{ status?: string; maintenance?: number }>(req);
    updateRoom(hotelId, rid, body as any);
    json(res, 200, ok({}));
    return true;
  }

  // Knowledge
  if (method === 'GET' && sub === '/knowledge') {
    json(res, 200, ok({ items: listKnowledge(hotelId) }));
    return true;
  }

  if (method === 'POST' && sub === '/knowledge') {
    const body = await parseJson<{ category?: string; question?: string; answer?: string; keywords?: string }>(req);
    if (!body.question || !body.answer) { json(res, 400, bad('question and answer required', 'bad_request')); return true; }
    createKnowledgeItem(hotelId, { category: body.category, question: body.question, answer: body.answer, keywords: body.keywords });
    json(res, 201, ok({}));
    return true;
  }

  const kbMatch = sub.match(/^\/knowledge\/(\d+)$/);
  if (kbMatch && method === 'DELETE') {
    deleteKnowledgeItem(hotelId, Number(kbMatch[1]));
    json(res, 200, ok({}));
    return true;
  }

  // Feedback
  if (method === 'GET' && sub === '/feedback') {
    json(res, 200, ok({ feedback: listFeedback(hotelId) }));
    return true;
  }

  // Follow-ups
  if (method === 'GET' && sub === '/followups') {
    json(res, 200, ok({ followups: listFollowups(hotelId, 'all') }));
    return true;
  }

  const folMatch = sub.match(/^\/followups\/(\d+)$/);
  if (folMatch && method === 'PATCH') {
    markFollowupDone(hotelId, Number(folMatch[1]));
    json(res, 200, ok({}));
    return true;
  }

  // Escalations
  if (method === 'GET' && sub === '/escalations') {
    json(res, 200, ok({ escalations: listEscalations(hotelId, 'all') }));
    return true;
  }

  const escMatch = sub.match(/^\/escalations\/(\d+)$/);
  if (escMatch && method === 'PATCH') {
    markEscalationHandled(hotelId, Number(escMatch[1]));
    json(res, 200, ok({}));
    return true;
  }

  // Audit
  if (method === 'GET' && sub === '/audit') {
    json(res, 200, ok({ entries: listAudit(hotelId, 100) }));
    return true;
  }

  // Agents
  if (method === 'GET' && sub === '/agents') {
    json(res, 200, ok({
      agents: Array.from(registry.list().values()).map((t) => ({ id: t.name, description: t.summary, permission: t.permission })),
      tools: Array.from(registry.list().values()).map((t) => ({ name: t.name, permission: t.permission, summary: t.summary })),
      runs: listAgentRuns(hotelId, 20),
    }));
    return true;
  }

  // Config
  if (method === 'GET' && sub === '/config') {
    json(res, 200, ok({ hotel }));
    return true;
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
    return true;
  }

  json(res, 404, bad('unknown route', 'not_found'));
  return true;
}

// ─── Server ────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;
  const method = (req.method ?? 'GET').toUpperCase();

  // Set security headers on all responses
  setSecurityHeaders(res);

  try {
    // Public routes
    const publicHandled = await handlePublicRoutes(req, res, path, method);
    if (publicHandled) return;

    // Static assets (no auth required for widget)
    if (!path.startsWith('/api/')) {
      await serveStatic(req, res, path);
      return;
    }

    // Authenticated routes
    const session = authenticateRequest(req);
    if (!session) { json(res, 401, bad('authentication required', 'unauthorized')); return; }

    const authHandled = await handleAuthenticatedRoutes(req, res, session, path, method);
    if (authHandled) return;

    json(res, 404, bad('unknown route', 'not_found'));
  } catch (err) {
    // Log the error internally
    const errorId = `err_${Date.now().toString(36)}`;
    console.error(`[${errorId}] ${method} ${path}: ${err instanceof Error ? err.message : String(err)}`);
    
    // In production, never leak internal details
    const message = config.isDemoMode 
      ? (err instanceof Error ? err.message : 'internal error')
      : 'an unexpected error occurred';
    
    json(res, 500, bad(message, 'internal', ));
  }
});

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  // Force shutdown after 10s
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(config.port, () => {
  console.log(`AI Business Operating System running on http://localhost:${config.port}`);
  console.log(`Dashboard: http://localhost:${config.port}/`);
  console.log(`Widget: http://localhost:${config.port}/widget.html`);
  console.log(`Environment: ${config.isDemoMode ? 'DEMO' : 'PRODUCTION'}`);
});

export { server };
