# Architecture — AI Business Operating System

Date: 2026-09-23

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CUSTOMER CHANNELS                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  WhatsApp   │  │    Web      │  │   Email     │  │   Future    │        │
│  │  (Cloud API)│  │  (Chat UI)  │  │  (Receipts) │  │  (Telegram) │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                          │
│                           ┌───────▼───────┐                                  │
│                           │  CHANNEL      │                                  │
│                           │  ADAPTER      │                                  │
│                           │  (Unified     │                                  │
│                           │   Message)    │                                  │
│                           └───────┬───────┘                                  │
│                                   │                                          │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI ORCHESTRATOR                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. Receive Message → 2. Classify Intent → 3. Route to Capability  │    │
│  │  4. Execute Tool(s) → 5. Generate Response → 6. Send via Channel  │    │
│  │  7. Log to AuditLog                                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐         │
│  │  AI Provider│          │  Intent     │          │  Response   │         │
│  │  Adapter    │          │  Classifier │          │  Generator  │         │
│  │  (Vercel AI │          │  (Rules +   │          │  (AI or     │         │
│  │   SDK)      │          │   AI)       │          │   Template) │         │
│  └─────────────┘          └─────────────┘          └─────────────┘         │
│                                    │                                         │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SPECIALIST AGENTS / TOOLS                             │
│                                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Knowledge  │ │  Booking    │ │  Customer   │ │  Lead       │           │
│  │  Retrieval  │ │  Manager    │ │  Manager    │ │  Capture    │           │
│  │  (RAG)      │ │             │ │  (CRM)      │ │             │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │               │                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Feedback   │ │  Follow-up  │ │  Human      │ │  Room       │           │
│  │  Collector  │ │  Scheduler  │ │  Escalation │ │  Availability│          │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │               │                   │
│         └───────────────┴───────────────┴───────────────┘                   │
│                                 │                                            │
│                                 ▼                                            │
│                    ┌────────────────────────┐                                │
│                    │   TOOL PERMISSION      │                                │
│                    │   BOUNDARY             │                                │
│                    │   (Zod schemas,        │                                │
│                    │    tenant isolation,   │                                │
│                    │    audit logging)      │                                │
│                    └────────────────────────┘                                │
│                                 │                                            │
└─────────────────────────────────┼────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        PocketBase (SQLite)                           │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │    │
│  │  │ Tenants │ │ Rooms   │ │Customers│ │Bookings │ │Conversa-│     │    │
│  │  │         │ │         │ │         │ │         │ │  tions  │     │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │    │
│  │  │ Leads   │ │Feedback │ │Escalat- │ │Knowledge│ │ Audit   │     │    │
│  │  │         │ │         │ │  ions   │ │  Docs   │ │  Logs   │     │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Vector Store (for RAG)                            │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │  SQLite-vec / In-memory embeddings (MVP)                    │    │    │
│  │  │  → Migrate to pgvector when moving to PostgreSQL            │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MANAGEMENT DASHBOARD                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Overview   │ │Conversations│ │   Leads     │ │  Customers  │           │
│  │  (KPIs)     │ │  (Inbox)    │ │  (Pipeline) │ │  (Profiles) │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │Reservations │ │  Knowledge  │ │ Automations │ │  Feedback   │           │
│  │  (Calendar) │ │  Base       │ │  (Rules)    │ │  (Reviews)  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐                                            │
│  │  Reports    │ │  Settings   │                                            │
│  │ (Analytics) │ │  (Hotel)    │                                            │
│  └─────────────┘ └─────────────┘                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### 1. Channel Adapter
- Receives messages from WhatsApp, Web, Email
- Normalizes to internal `IncomingMessage` format
- Sends outbound messages via appropriate channel
- Handles webhook verification, signature validation

### 2. AI Orchestrator
- Receives normalized message
- Classifies intent (booking, knowledge, feedback, escalation, etc.)
- Routes to appropriate specialist tool(s)
- Generates response (AI or template)
- Enforces permission boundaries
- Logs all actions

### 3. Specialist Tools
Each tool is a controlled function with:
- Input validation (Zod schema)
- Tenant isolation (always filter by tenant_id)
- Permission check (what can this tool do?)
- Audit log entry
- Deterministic output (no LLM hallucination of facts)

| Tool | Purpose | Data Source |
|---|---|---|
| `check_availability` | Query room availability by date/type | Database (deterministic) |
| `get_room_price` | Get price for room type | Database (deterministic) |
| `create_booking` | Create reservation record | Database (deterministic) |
| `get_customer` | Look up customer by phone | Database (deterministic) |
| `create_lead` | Create lead record | Database (deterministic) |
| `submit_feedback` | Store feedback/rating | Database (deterministic) |
| `escalate_to_human` | Create escalation record | Database (deterministic) |
| `search_knowledge` | RAG retrieval from knowledge base | Vector store |
| `update_customer` | Update customer profile | Database (deterministic) |

### 4. AI Provider Adapter
- Provider-agnostic interface (Vercel AI SDK)
- Supports: Anthropic, OpenRouter, DeepSeek, OpenAI, Ollama (local)
- Configured via environment variables
- No API keys in code

### 5. Database Layer (PocketBase)
- SQLite for MVP (zero-config, file-based)
- REST API + realtime subscriptions
- Built-in auth and admin dashboard
- Migration path to PostgreSQL via abstraction layer

### 6. Vector Store (RAG)
- MVP: In-memory embeddings or SQLite-vec
- Production: pgvector (when migrating to PostgreSQL)
- Embeddings via AI provider (OpenAI text-embedding-3-small, etc.)

### 7. Management Dashboard
- Next.js 15 App Router
- Server Components for data fetching
- Real-time updates via PocketBase subscriptions
- Role-based access (admin, staff, viewer)

---

## Data Flow: Customer Asks "Do you have a room for Friday?"

```
1. Customer → WhatsApp → "Do you have a room for Friday?"
2. Channel Adapter → Normalizes to IncomingMessage
3. Orchestrator → Classifies intent: CHECK_AVAILABILITY
4. Orchestrator → Calls check_availability tool
   ├── Input: { date: "2026-09-26", tenant_id: "hotel_1" }
   ├── Query: SELECT * FROM rooms WHERE tenant_id = ? AND id NOT IN 
   │          (SELECT room_id FROM bookings WHERE tenant_id = ? AND 
   │           check_in <= ? AND check_out > ? AND status != 'cancelled')
   ├── Output: [{ type: "Standard", price: 25000, available: 3 }, ...]
   └── AuditLog: { action: "check_availability", actor: "ai", ... }
5. Orchestrator → Generates response: "Yes! We have 3 Standard rooms 
   available for Friday, September 26th at 25,000 FCFA/night..."
6. Channel Adapter → Sends response via WhatsApp
7. AuditLog: { action: "send_message", actor: "ai", ... }
```

---

## Deployment Architecture (MVP)

```
┌─────────────────────────────────────────┐
│              Single Server               │
│  ┌───────────────────────────────────┐  │
│  │  Docker Compose (optional)        │  │
│  │  ┌─────────┐  ┌───────────────┐  │  │
│  │  │ Next.js │  │  API Server   │  │  │
│  │  │Dashboard│  │  (Fastify)    │  │  │
│  │  │  :3000  │  │    :4000      │  │  │
│  │  └─────────┘  └───────┬───────┘  │  │
│  │                       │           │  │
│  │                ┌──────▼───────┐   │  │
│  │                │  PocketBase  │   │  │
│  │                │    :8090     │   │  │
│  │                └──────────────┘   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  OR (no Docker):                        │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Next.js │ │ Fastify  │ │PocketBase│ │
│  │  :3000  │ │  :4000   │ │  :8090   │ │
│  └─────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────┘
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **PocketBase for MVP** | Zero-config, single binary, MIT license, Windows-compatible, realtime |
| **Modular monolith** | Early-stage product, must run on single PC, no microservices overhead |
| **Adapter pattern** | Swap AI/WhatsApp/DB providers without rewriting core |
| **Deterministic tools** | LLM never invents availability, prices, or customer data |
| **Zod validation** | Runtime validation of all inputs/outputs, prevents bad data |
| **Audit log (append-only)** | Compliance, debugging, analytics, trust |
| **Next.js Dashboard** | Modern, type-safe, server components, easy to demo |
| **Demo mode** | Full product demo without external credentials |

---

## Migration Path: PocketBase → PostgreSQL

The application layer uses a `DatabaseProvider` interface. PocketBase is the MVP implementation. When scaling beyond SQLite limits:

1. Implement `PostgresDatabaseProvider` using Prisma or Drizzle
2. Migrate data via export/import scripts
3. Add pgvector for production RAG
4. Update `DATABASE_PROVIDER=postgres` in environment
5. No business logic changes required

This is why we use an abstraction layer from day one.
