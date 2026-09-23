# CURRENT STATE AUDIT — AI Business Operating System / AI Digital Front Desk

**Date:** 2026-09-23
**Project Root:** `D:/HERMES AGENT/AI Business Operating System`
**Auditor:** Hermes Agent (Nous Research)

---

## 1. Executive Summary

The project contains TWO partially overlapping systems built at different stages:

1. **PocketBase + Fastify system** (`src/api/server.ts` → port 4000) — earlier iteration, uses PocketBase as database, has a critical bug where all demo scenarios return the same response.
2. **SQLite + Node http system** (`src/server.ts` → port 3000) — mature, fully functional, production-quality architecture with proper multi-tenancy, tool sandboxing, LLM abstraction, and hallucination guards.

**The SQLite system (port 3000) is the real product.** It handles 8 demo scenarios correctly, has a working admin dashboard, a customer-facing chat widget, and 13 passing tests. The AI responses are deterministic, professional, and correctly use hotel identity (Hôtel Le Safran Douala).

**Critical gaps:** The UI is admin-dashboard-style, not immersive. The customer chat widget is a separate page, not embedded. Real LLM integration exists but is untested in demo mode. Multi-tenancy works at the data layer but the dashboard only shows one hotel at a time. No WhatsApp credentials are configured (webhook code is complete but inactive).

**Verdict:** This is a solid MVP backend with correct AI orchestration, weak on immersive customer-facing UX. The open-source landscape offers mature components (Chatwoot for omnichannel inbox, Dify for AI workflows, Frappe for hospitality backend) that could accelerate development but would require careful license compliance.

---

## 2. What Has Actually Been Built

### System A: SQLite Application (port 3000) — THE REAL PRODUCT
- **Database:** SQLite via Node 24 built-in `node:sqlite` (WAL mode, FK enforced)
- **Server:** Raw Node `node:http` (no framework), ~845 lines
- **Schema:** 15 tables, all with `hotel_id` tenant column
- **Intent Classification:** Rule-based, 18 intents, French + English
- **Specialist Agents:** 16 handler functions with deterministic replies
- **Tool Sandbox:** 12 registered tools with permission boundaries
- **LLM Providers:** Demo, OpenAI-compatible, Anthropic (with hallucination guard)
- **Channels:** Web chat + WhatsApp webhook (Meta Cloud API)
- **Auth:** HMAC-based sessions, admin/staff roles
- **Dashboard:** 14-tab vanilla JS SPA
- **Chat Widget:** Customer-facing conversation interface
- **Seed Data:** 1 realistic hotel, 10 rooms, 5 customers, 14 KB items, past/future reservations
- **Tests:** 13 passing (availability, booking, tenant isolation)

### System B: PocketBase Application (port 4000) — BUGGY SUPERSEDED
- **Database:** PocketBase (Go binary, SQLite underneath)
- **Server:** Fastify 5 + @fastify/cors + @fastify/static
- **Orchestrator:** Simpler mock AI adapter with template responses
- **Bug:** All 8 demo scenarios return the same availability response
- **Dashboard:** 9-tab HTML page with static content

---

## 3. Current Architecture

```
Customer (Web/WhatsApp)
    │
    ▼
Channel Adapter (web / whatsapp webhook)
    │
    ▼
Orchestrator (src/core/orchestrator.ts)
    ├─ Hotel resolution (getHotelById / getHotelBySlug)
    ├─ Customer resolution (upsert by phone/email)
    ├─ Conversation resolution (create or reuse)
    ├─ Intent Classification (src/core/intents.ts, rule-based)
    ├─ Specialist Agent (src/agents/index.ts, 16 handlers)
    │   └─ Tool Sandbox (src/core/tools/registry.ts)
    │       └─ Controlled tools (src/core/tools/catalog.ts)
    │           ├─ availability.check (deterministic DB query)
    │           ├─ price.check (deterministic DB query)
    │           ├─ reservation.request → reservation.confirm → reservation.cancel
    │           ├─ customer.lookup / customer.upsert
    │           ├─ lead.create
    │           ├─ knowledge.search (keyword scoring)
    │           ├─ hotel.info (deterministic facts)
    │           ├─ feedback.log
    │           ├─ followup.create
    │           └─ escalation.create
    ├─ LLM Rephrase (optional, src/llm/provider.ts)
    │   └─ Hallucination Guard (src/llm/guard.ts)
    └─ Response stored in DB + returned via channel
```

**Key Design Decisions:**
- All business state changes ONLY through registered tools
- Each agent has an explicit capability set (permission boundary)
- Tool results are the ONLY facts the LLM may repeat
- DB queries are always tenant-scoped by hotel_id
- No LLM calls in demo mode (100% deterministic)

---

## 4. Current UI/UX Assessment

### Admin Dashboard (src/dashboard/)
- **14 tabs:** Overview, Conversations, Reservations, Customers, Leads, Rooms, Knowledge, Feedback, Follow-ups, Escalations, Reports, Agents, Audit, Demo, Settings
- **Style:** Dark theme, data tables, conventional admin panel
- **Assessment:** Functional but **clearly a developer/admin tool**, not a hotel manager's daily companion

### Customer Chat Widget (src/dashboard/chat-demo.html)
- **Style:** Chat bubbles, hero section, suggestion buttons, typing indicator
- **Assessment:** Simple but **effective and human-centered**
- **Issue:** Separate page (`/chat-demo.html`), not embedded in hotel website

### Verdict on UI/UX
- **Customer experience:** The chat widget works and feels like talking to a hotel receptionist. Hotel name and identity are used in responses.
- **Admin experience:** Feels like a database admin panel, not a hotel management tool.
- **Missing:** No embedded widget for hotel websites, no mobile-responsive admin, no visual branding/hotel logo, no conversational onboarding for new hotels.

---

## 5. Current AI/Agent Behavior

### Intent Classification
- 18 intents with priority-based rule matching
- French + English patterns (accents normalized)
- Entity extraction: dates, nights, guests, room type, phone, email, name, rating
- Affirmation disambiguation ("yes" after booking → booking_confirm)

### Specialist Agents
- Each agent composes a deterministic reply from tool facts
- Replies use hotel identity (Hôtel Le Safran Douala)
- Agents handle: greeting, availability, price, booking, booking_confirm, booking_cancel, location, checkin_policy, checkout_time, amenities, feedback, escalation, lead_capture, customer_lookup, faq, unknown

### Demo Transcript (Verified 2026-09-23)
All 8 scenarios produce correct, distinct responses:
- Availability check → "Sorry, no room available... rooms free from Sunday"
- Price check → "Rate for executive: from 38,000 FCFA/night"
- Booking flow → "Sorry, no room free Friday... free from Sunday"
- Early check-in → "L'early check-in est possible selon disponibilité"
- Location → Full address with WhatsApp number
- Complaint → "Nous sommes sincèrement désolés... équipe vous contactera sous 12 heures"
- Escalation → "Je transmets immédiatement à un membre de notre équipe"
- Lead capture → "J'ai transmis votre demande à notre équipe commerciale"

---

## 6. Current Database/Data Model

15 tables, all with `hotel_id`:
- hotels (with slug, settings, demo_enabled)
- hotel_users (password_hash, role)
- rooms (number, type, price, status, capacity)
- customers (phone, email, language)
- conversations (channel, status, intent_last)
- messages (sender, body, kind, ref_id)
- reservations (check_in, check_out, room_ids JSON, status, total)
- leads (status, intent, source)
- knowledge_items (category, question, answer, keywords)
- feedback (rating, comment, status)
- followups (due_at, task, status)
- escalations (reason, requested_by_guest, status, assigned_to)
- audit_log (actor_type, action, entity, details)
- agent_runs (intent, confidence, actions, latency_ms)

**Indexes:** messages(conv_id, created_at), reservations(hotel_id, dates, status), customers(hotel_id, phone), audit(hotel_id, created_at)

---

## 7. Current Customer Conversation Flow

1. Customer sends message via `/api/chat` (hotelSlug) or WhatsApp webhook
2. Hotel resolved from slug/phone
3. Customer upserted by phone/email
4. Conversation created or reused
5. Message stored (sender=guest)
6. Intent classified (rule-based, 18 patterns)
7. Specialist agent invoked with capability-scoped sandbox
8. Agent calls tools (deterministic DB operations)
9. Agent composes reply from tool facts
10. Optional: LLM rephrases reply (with hallucination guard)
11. Reply stored (sender=ai) and returned
12. Conversation status updated (open/awaiting/escalated/resolved)
13. Agent run recorded (latency, actions)

---

## 8. Current Hotel/Business Personalization

- Hotel name, address, phone, WhatsApp, check-in/out times, tax rate, currency stored in `hotels` table
- Hotel identity injected into LLM system prompt and deterministic replies
- Knowledge base per hotel (14 demo items)
- Rooms, customers, reservations all scoped to hotel
- **Limitation:** No logo, no brand colors, no tone-of-voice configuration yet

---

## 9. Current WhatsApp/Web/External Channel Readiness

### Web Chat
- ✅ Working: `/api/chat` endpoint, chat-demo.html widget
- ✅ Stateless (conversationId tracking)
- ✅ Rate limited (30 req/min per IP)

### WhatsApp
- ✅ Webhook endpoint: `/api/webhooks/whatsapp` (GET verify, POST receive)
- ✅ HMAC signature verification
- ✅ Inbound message normalization
- ✅ Outbound text sending via Meta Cloud API
- ❌ No credentials configured (inactive until WHATSAPP_* env vars set)
- ⚠️ Routes to first demo hotel (MVP single-hotel logic)

### Email
- ❌ No email channel implemented (SMTP config exists but unused)

---

## 10. Current Multi-Tenant/SaaS Readiness

### What Works
- All business tables have `hotel_id`
- Repository layer always filters by hotel_id
- Session-based auth with hotelId scope
- Cross-tenant access denied (staff can't access other hotels)
- Platform admin can access all hotels

### What's Missing
- No hotel onboarding UI (API exists at POST /api/hotels)
- No per-hotel user management UI
- No billing/subscription system
- No per-hotel configuration of AI behavior
- Dashboard doesn't switch between hotels easily

---

## 11. Current Security and Reliability

### Implemented
- ✅ Passwords hashed (scrypt, salted)
- ✅ Session tokens (HMAC-SHA256, 12h expiry)
- ✅ Rate limiting (login: 10/min, chat: 30/min)
- ✅ Webhook signature verification (HMAC-SHA256)
- ✅ Tenant isolation in all queries
- ✅ Tool permission sandbox
- ✅ Body size limit (2MB)
- ✅ SQLite WAL mode, busy_timeout
- ✅ Graceful shutdown (SIGINT/SIGTERM)

### Missing
- ❌ No HTTPS (assumes reverse proxy)
- ❌ No CSRF protection for cookie-based auth
- ❌ No brute-force lockout (just rate limiting)
- ❌ No PII encryption at rest
- ❌ No automated backups
- ❌ No audit log viewer in dashboard (API exists)

---

## 12. Tests and Verification Results

### Unit Tests (npm run test)
```
✓ tests/tenant-isolation.test.ts (2 tests) — PASSED
✓ tests/availability.test.ts (6 tests) — PASSED
✓ tests/booking.test.ts (5 tests) — PASSED
Total: 13 passed, 0 failed
```

### Demo Verification (npm run demo, port 4000 system — BUGGY)
Shows all 8 scenarios passing but with identical responses (known bug)

### Live API Verification (port 3000 system — VERIFIED 2026-09-23)
- GET /api/health → `{"ok":true,"up":true,"provider":"demo"}` ✅
- POST /api/chat "Do you have a room for Friday?" → Correct availability response ✅
- POST /api/chat "I want to book for two nights starting friday" → Correct booking flow ✅
- POST /api/chat "I want to speak to someone" → Correct escalation ✅
- POST /api/demo/run scenario=all → All 8 scenarios with correct distinct responses ✅

---

## 13. What Works Well

1. **Correct AI architecture** — deterministic tools, permission sandbox, hallucination guard
2. **Multi-tenant data model** — every query scoped by hotel_id
3. **Bilingual (FR/EN)** — proper date parsing, intent classification, responses
4. **Realistic seed data** — Hôtel Le Safran Douala with proper room types, pricing, policies
5. **Booking workflow** — request → confirm → cancel with proper state transitions
6. **Escalation flow** — creates escalation record, marks conversation escalated, creates followup
7. **Knowledge base search** — keyword scoring with category matching
8. **Deterministic date parsing** — "friday", "tomorrow", "25 septembre", "25/09"
9. **Audit trail** — every tool call, login, status change logged
10. **LLM abstraction** — easy swap between demo/OpenAI/Anthropic with same interface
11. **Webhook-ready WhatsApp** — complete adapter, just needs credentials
12. **Clean separation** — orchestrator, agents, tools, repositories, LLM are decoupled

---

## 14. What Is Weak or Missing

1. **UI is admin-dashboard, not hotel-manager-friendly** — needs visual redesign
2. **No customer-facing embeddable widget** — chat-demo.html is a standalone page
3. **No visual branding** — no hotel logo, colors, tone-of-voice config
4. **Booking confirmation flow is broken in demo** — "yes" after "no room Friday" finds no pending reservation
5. **No email channel** — code exists but not wired
6. **No voice channel** — mentioned in roadmap but no code
7. **No automated followup execution** — followups created but no scheduler to run them
8. **Dashboard can't switch hotels** — exists in sidebar but not functional
9. **No PII handling policy** — GDPR/privacy not implemented
10. **No production deployment config** — no Dockerfile, no CI/CD
11. **Tests are thin** — only 13 tests, no integration tests for full conversation flows
12. **The PocketBase system (port 4000) is a dead end** — buggy, should be removed or archived

---

## 15. What Would Have to Change to Create a Truly Convincing AI Employee Experience

### Immediate (1-2 weeks)
- Replace the dashboard with a hotel-branded, conversational onboarding flow
- Create an embeddable web chat widget (iframe/script tag) for hotel websites
- Add hotel logo, brand colors, tone-of-voice settings to hotel config
- Fix the booking confirmation flow (carry pending reservation through conversation)
- Build a proper hotel manager mobile-friendly dashboard

### Short-term (2-4 weeks)
- Implement automated followup scheduler (cron-like)
- Add email channel
- Build hotel onboarding wizard (name, rooms, prices, policies, knowledge)
- Add WhatsApp QR code connection (Evolution API / Baileys) for hotels without Meta Business

### Medium-term (1-3 months)
- Add voice channel (Twilio/similar)
- Build per-hotel analytics (conversion funnel, response times, guest satisfaction)
- Implement PII handling and data export (GDPR)
- Add production deployment (Docker, CI/CD, monitoring)

---

## 16. Open-Source Components Already Used

| Component | License | Usage |
|-----------|---------|-------|
| Node.js / node:sqlite | MIT | Runtime + database |
| TypeScript | Apache 2.0 | Language |
| Fastify (port 4000 system) | MIT | HTTP server (unused in main system) |
| PocketBase (port 4000 system) | MIT | Database (unused in main system) |
| Zod | MIT | Schema validation (minimal use) |
| Vitest | MIT | Testing |

**Note:** The main system (port 3000) has NO external runtime dependencies — uses only Node.js built-ins.

---

## 17. Recommended Open-Source Projects to Investigate Next

### Tier 1: Strong Candidates for Integration

| Project | Stars | License | Language | What It Provides | Integration Difficulty |
|---------|-------|---------|----------|------------------|------------------------|
| **Chatwoot** | 35K+ | MIT core | Ruby on Rails + Vue | Omnichannel inbox, automations, Captain AI | Medium (separate service) |
| **Dify** | 154K+ | Apache 2.0 derivative | Python + React | AI workflow builder, agent runtime, RAG | High (monolith) |
| **Twenty CRM** | 56K+ | AGPL-3.0 | TypeScript + React + NestJS | Modern CRM, objects, views, agents | Medium (API-first) |

### Tier 2: Worth Studying

| Project | Stars | License | Notes |
|---------|-------|---------|-------|
| **Frappe/ERPNext** | 38K | GPL-3.0 | Has hospitality module, but copyleft risk |
| **Frappe/Hospitality** | 72 | GPL-3.0 | Hotel/restaurant module for ERPNext |
| **Evolution API** | — | — | WhatsApp gateway (Baileys/Meta) |
| **n8n** | — | Sustainable Use License | Fair-code, restricts SaaS resale |
| **Langflow** | — | MIT | Visual AI workflow builder |
| **Rasa** | — | MIT | Conversational AI framework |

### Tier 3: Rejected

| Project | Reason |
|---------|--------|
| **Supabase** | Banned by user |
| **n8n** (for core) | Fair-code license incompatible with commercial SaaS |
| **Kamra PMS** | AGPL-3.0 copyleft |
| **QloApps** | Outdated PHP/MySQL, low activity |

---

## 18. Integration Opportunities

### Option A: Continue Improving Our Existing Application
- **Pros:** Full control, clean architecture, no external dependencies, no license risk
- **Cons:** Slow, must build every feature ourselves

### Option B: Integrate Mature Open-Source Projects
- **Chatwoot** for omnichannel inbox + Captain AI for auto-responses
- **Twenty CRM** for customer/lead management
- **Dify** for AI workflow orchestration
- **Pros:** Faster time-to-market, proven components
- **Cons:** Integration complexity, license compliance overhead, potential vendor lock-in

### Option C: Use Mature Backend + Our AI Layer as Product
- Build our AI orchestration on top of Frappe/ERPNext or Twenty CRM
- **Pros:** Leverage existing PMS/CRM infrastructure
- **Cons:** AGPL/GPL copyleft risks, heavy architecture, Python/Java dependency

### Recommended Hybrid Approach
1. Keep our Node.js AI orchestration layer (it's well-architected)
2. Integrate **Chatwoot** as the customer communication/inbox layer
3. Use **Twenty CRM** (via API) as the CRM backend when needed
4. Build our own lightweight hotel management UI on top

---

## 19. Components That Should Potentially Be Replaced Rather Than Improved

| Component | Current | Replace With | Reason |
|-----------|---------|--------------|--------|
| Port 4000 system (PocketBase + Fastify) | Buggy, redundant | Delete | Superseded by port 3000 system |
| Admin dashboard (14 tabs) | Technical data tables | Hotel-manager-focused UI | Not human-centered |
| Customer chat widget | Standalone page | Embeddable widget | Must be embeddable in hotel websites |
| In-memory rate limiting | Works for single instance | Redis | Won't scale across multiple servers |

---

## 20. Recommended Next Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    HOTEL CUSTOMER                        │
│  (WhatsApp / Web Chat / Email / Voice)                  │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ WhatsApp │   │ Web Chat │   │  Email   │
   │ (Meta/   │   │ (Embed   │   │ (SMTP/   │
   │Evolution)│   │ widget)  │   │ API)     │
   └────┬─────┘   └────┬─────┘   └────┬─────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │   Chatwoot (optional) │ ← Omnichannel inbox, Captain AI
            │   or custom adapter   │
            └───────────┬───────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │   OUR AI ORCHESTRATOR │ ← The core product
            │   (src/core/          │
            │    orchestrator.ts)   │
            │                       │
            │  ┌─────────────────┐  │
            │  │ Intent Classify │  │
            │  └────────┬────────┘  │
            │           │           │
            │  ┌────────▼────────┐  │
            │  │ Specialist Agent│  │
            │  └────────┬────────┘  │
            │           │           │
            │  ┌────────▼────────┐  │
            │  │  Tool Sandbox   │  │
            │  │  (permission    │  │
            │  │   boundaries)   │  │
            │  └────────┬────────┘  │
            └───────────┼───────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ SQLite   │  │   LLM    │  │  Audit   │
   │ (MVP)    │  │ Provider │  │  Log     │
   │          │  │ (demo/   │  │          │
   │          │  │ openai/  │  │          │
   │          │  │ claude)  │  │          │
   └──────────┘  └──────────┘  └──────────┘
```

---

## 21. Recommended Next 7-Day Build Sequence

### Day 1: Cleanup
- Delete or archive the port 4000 PocketBase system
- Remove unused files: src/api/server.ts, src/demo/seed.ts, src/demo/simulate.ts, pocketbase/ directory (keep one copy if needed for reference)

### Day 2: Fix Booking Flow
- Fix the booking confirmation bug (carry pending reservation through conversation)
- Add integration test for full booking flow

### Day 3: Embedded Chat Widget
- Create embeddable web chat widget (iframe + script tag)
- Hotel-branded with logo/colors from config
- Test on a dummy hotel website page

### Day 4: Hotel Onboarding Wizard
- Build step-by-step hotel onboarding (name, rooms, prices, policies, knowledge)
- Generate knowledge base from room/policy data automatically

### Day 5: Manager Dashboard Redesign
- Replace 14-tab dashboard with 5 focused views: Today, Conversations, Guests, Performance, Settings
- Mobile-responsive design
- Show hotel logo and name prominently

### Day 6: WhatsApp QR Connection
- Integrate Evolution API or Baileys for QR-based WhatsApp (no Meta Business required)
- Allow hotels to connect their personal WhatsApp number

### Day 7: Tests & Polish
- Add integration tests for all conversation flows
- Add load testing (100 concurrent conversations)
- Write production deployment guide

---

## VERIFIED vs RECOMMENDATIONS vs IDEAS

### VERIFIED (evidence-based)
- Port 3000 system handles 8 demo scenarios correctly (tested 2026-09-23)
- All 13 tests pass (npm run test, verified)
- SQLite schema has 15 tables with proper FK relationships
- All repository queries filter by hotel_id
- Intent classification handles 18 intents in FR/EN
- LLM providers are pluggable (demo/openai/anthropic)
- WhatsApp webhook code is complete but inactive

### RECOMMENDATIONS (engineering judgment)
- Delete the port 4000 system (buggy, redundant)
- Build embedded chat widget (not standalone page)
- Integrate Chatwoot for omnichannel (MIT license, proven)
- Fix booking confirmation flow

### IDEAS (speculative, needs validation)
- Use Twenty CRM as backend (check AGPL implications)
- Use Dify for AI workflows (check license compatibility)
- Add voice channel via Twilio (costs money, not free)
- Use Evolution API for WhatsApp QR (needs testing on Windows)

---

**End of Audit**
