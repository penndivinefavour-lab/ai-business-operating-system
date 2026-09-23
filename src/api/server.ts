// src/api/server.ts

import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { createDatabaseClient } from '../adapters/database/index.js';
import { createAiAdapter } from '../adapters/ai/AiAdapter.js';
import { createWhatsAppAdapter } from '../adapters/whatsapp/WhatsAppAdapter.js';
import { Orchestrator } from '../orchestrator/Orchestrator.js';
import type { IncomingMessage } from '../types/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || '4000');
const PB_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';
const PB_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || 'admin@hotel.com';
const PB_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || 'admin123456';

async function main() {
  const app = Fastify({ logger: true });
  
  await app.register(cors, { origin: true });
  await app.register(fastifyStatic, {
    root: join(__dirname, '../../public'),
    prefix: '/',
  });

  // Initialize adapters
  const db = createDatabaseClient(PB_URL);
  const ai = createAiAdapter(
    process.env.AI_PROVIDER || 'mock',
    process.env.AI_API_KEY
  );
  const whatsapp = createWhatsAppAdapter(
    process.env.WHATSAPP_PROVIDER || 'mock',
    process.env.WHATSAPP_API_KEY,
    process.env.WHATSAPP_PHONE_NUMBER_ID
  );

  // Authenticate with PocketBase
  try {
    await db.authenticate(PB_EMAIL, PB_PASSWORD);
    console.log('[API] Authenticated with PocketBase');
  } catch (e) {
    console.warn('[API] PocketBase auth failed, some features may not work');
  }

  const orchestrator = new Orchestrator(db, ai, whatsapp);

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Receive message (from webhook or direct)
  app.post<{ Body: IncomingMessage }>('/api/messages', async (req, reply) => {
    const message = req.body;
    await orchestrator.handleMessage(message);
    return { success: true };
  });

  // Get conversations
  app.get('/api/conversations', async (req, reply) => {
    const { tenant_id, status } = req.query as { tenant_id?: string; status?: string };
    if (!tenant_id) return reply.status(400).send({ error: 'tenant_id required' });
    const conversations = await db.list('conversations', `tenant_id="${tenant_id}"${status ? ` && status="${status}"` : ''}`);
    return conversations;
  });

  // Get rooms
  app.get('/api/rooms', async (req, reply) => {
    const { tenant_id } = req.query as { tenant_id?: string };
    if (!tenant_id) return reply.status(400).send({ error: 'tenant_id required' });
    const rooms = await db.getRooms(tenant_id);
    return rooms;
  });

  // Get bookings
  app.get('/api/bookings', async (req, reply) => {
    const { tenant_id, status } = req.query as { tenant_id?: string; status?: string };
    if (!tenant_id) return reply.status(400).send({ error: 'tenant_id required' });
    const bookings = await db.getBookings(tenant_id, status ? { status } : undefined);
    return bookings;
  });

  // Get customers
  app.get('/api/customers', async (req, reply) => {
    const { tenant_id } = req.query as { tenant_id?: string };
    if (!tenant_id) return reply.status(400).send({ error: 'tenant_id required' });
    const customers = await db.list('customers', `tenant_id="${tenant_id}"`);
    return customers;
  });

  // Get leads
  app.get('/api/leads', async (req, reply) => {
    const { tenant_id, status } = req.query as { tenant_id?: string; status?: string };
    if (!tenant_id) return reply.status(400).send({ error: 'tenant_id required' });
    const leads = await db.getLeads(tenant_id, status);
    return leads;
  });

  // Get feedback
  app.get('/api/feedback', async (req, reply) => {
    const { tenant_id } = req.query as { tenant_id?: string };
    if (!tenant_id) return reply.status(400).send({ error: 'tenant_id required' });
    const feedback = await db.getFeedback(tenant_id);
    return feedback;
  });

  // Get escalations
  app.get('/api/escalations', async (req, reply) => {
    const { tenant_id, status } = req.query as { tenant_id?: string; status?: string };
    if (!tenant_id) return reply.status(400).send({ error: 'tenant_id required' });
    const escalations = await db.getEscalations(tenant_id);
    const filtered = status ? escalations.filter(e => e.status === status) : escalations;
    return filtered;
  });

  // Get audit logs
  app.get('/api/audit-logs', async (req, reply) => {
    const { tenant_id } = req.query as { tenant_id?: string };
    if (!tenant_id) return reply.status(400).send({ error: 'tenant_id required' });
    const logs = await db.list('audit_logs', `tenant_id="${tenant_id}"`, 1, 100);
    return logs;
  });

  // Get knowledge documents
  app.get('/api/knowledge', async (req, reply) => {
    const { tenant_id } = req.query as { tenant_id?: string };
    if (!tenant_id) return reply.status(400).send({ error: 'tenant_id required' });
    const docs = await db.getKnowledgeDocuments(tenant_id);
    return docs;
  });

  // Simulate incoming message (for demo) — returns AI response
  app.post<{ Body: { tenant_id: string; customer_phone: string; message: string } }>('/api/simulate', async (req, reply) => {
    const { tenant_id, customer_phone, message } = req.body;
    const incoming: IncomingMessage = {
      id: crypto.randomUUID(),
      tenant_id,
      customer_phone,
      content: message,
      channel: 'whatsapp',
      timestamp: new Date().toISOString(),
    };
    const result = await orchestrator.handleMessage(incoming);
    return { success: true, response: result };
  });

  // Start server
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[API] Server running on http://localhost:${PORT}`);
    console.log(`[API] Demo mode: ${process.env.DEMO_MODE !== 'false'}`);
    console.log(`[AI] Provider: ${process.env.AI_PROVIDER || 'mock'}`);
    console.log(`[WhatsApp] Provider: ${process.env.WHATSAPP_PROVIDER || 'mock'}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
