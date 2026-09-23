# Open Source Audit — AI Business Operating System (Hotel MVP)

Date: 2026-09-23
Purpose: Evaluate existing open-source projects for reuse, adaptation, or study.

---

## EXECUTIVE SUMMARY

| Project | License | Verdict | Reason |
|---|---|---|---|
| **Kamra PMS** | AGPL-3.0 | STUDY ONLY | AGPL copyleft incompatible with proprietary commercial SaaS without sharing all modifications. Frappe/ERPNext stack (Python/MariaDB) diverges from our Node.js architecture. |
| **DeskcommCRM** | MIT | STUDY + ADAPT PATTERNS | Excellent multi-tenant CRM architecture with AI agents, RAG, MCP. Built on Supabase (banned). Replace data layer with PocketBase. |
| **Hiberius/whatsapp-receptionist** | MIT | STUDY + ADAPT PATTERNS | Best-in-class multi-tenant Next.js + Supabase architecture with 544 tests, pgvector RAG, human escalation. Supabase dependency must be replaced. |
| **martin-minghetti/whatsapp-ai-receptionist** | MIT | STUDY | Clean FastAPI + Claude architecture. Single-tenant, but good orchestration patterns. |
| **Evolution API** | Apache 2.0 (+branding) | INTEGRATE (gateway) | Production-ready WhatsApp gateway with multi-tenant instances, Baileys + Meta Cloud API, webhooks. Use as WhatsApp adapter layer. |
| **WAHA (devlikeapro)** | Apache 2.0 | INTEGRATE (dev mode) | WhatsApp Web engine for QR-based connection. Use for development/demo without Meta credentials. |
| **PocketBase** | MIT | PRIMARY DATABASE | Single Go binary, SQLite, realtime, auth, admin dashboard. Windows-compatible. Perfect for MVP. |
| **n8n** | Sustainable Use License | REJECT for core | Fair-code license restricts SaaS resale. Useful for internal automations but not as orchestration backbone. |
| **NocoDB** | Sustainable Use License | REJECT | Same fair-code issue. |
| **Appwrite** | BSD-3-Clause | BACKUP OPTION | Full BaaS platform. Heavier than PocketBase but viable alternative if PocketBase hits limits. |
| **Frappe Framework** | MIT | STUDY | Foundation of Kamra. Python-based, heavy. Not for our Node.js stack but good RBAC/multi-tenancy patterns. |
| **QloApps** | OSL-3.0 | REJECT | PHP/MySQL, outdated, low maintenance. |
| **Supabase** | Apache 2.0 | BANNED | User explicitly banned Supabase. |

---

## DETAILED FINDINGS

### 1. Kamra PMS
- **URL**: https://github.com/Kamra-PMS/kamra-pms
- **License**: AGPL-3.0
- **Stack**: Python (Frappe/ERPNext), MariaDB, React frontend
- **Stars**: Active, 2.6.x release, demo at demo.kamrapms.com
- **Strengths**: 
  - 85 MCP tools (role-gated, permission-checked)
  - Full hotel PMS: front desk, booking engine, housekeeping, folios, POS, banquet
  - Deterministic pricing engine (never from LLM)
  - WhatsApp (Meta Cloud API) confirmations, check-in links
  - Multi-property RBAC, audit trail
  - AI provider presets, eval harness in CI
- **Weaknesses**:
  - **AGPL-3.0** — copyleft requires sharing ALL modifications if offered as SaaS. **Incompatible with proprietary commercial SaaS** without open-sourcing our entire platform.
  - Frappe framework (Python) — we're building Node.js/TypeScript
  - Complex setup (bench, Frappe v16)
  - Heavy dependencies (ERPNext ecosystem)
- **Verdict**: **STUDY ONLY**. Learn MCP tool design patterns, booking engine architecture, deterministic pricing. Do NOT incorporate code.

### 2. DeskcommCRM
- **URL**: https://github.com/melgarafael/DeskcommCRM
- **License**: MIT
- **Stack**: Next.js 16 + React 19 + Supabase + Upstash + WAHA + Meta Cloud API
- **Stars**: Active, v1.2.3+, 196 route handlers
- **Strengths**:
  - Multi-tenant by design with RLS isolation tests
  - AI agents with RAG (pgvector), skills, memory, intent router
  - MCP server for external agent integration
  - WhatsApp via WAHA (QR) OR Meta Cloud API — dual channel
  - Human escalation, handoff IA→human
  - Full CRM: kanban, contacts, pipeline, tags
  - Webhooks & automations (QUANDO/SE/ENTÃO rules)
  - RBAC server-side, audit log, GDPR tools
  - Self-host kit with 1-command install
  - 5 CI jobs: verify, build, invariants, e2e, docker images
- **Weaknesses**:
  - **Supabase-dependent** (banned by user) — RLS, pgvector, auth all tied to Supabase
  - Portuguese language (UI, docs)
  - Upstash Redis dependency (cost)
  - Not hotel-specific (e-commerce origin, now multi-vertical)
- **Verdict**: **STUDY + ADAPT PATTERNS**. Best architecture reference. Replace Supabase with PocketBase. Adopt: tenant isolation pattern, intent router, dual WhatsApp channel, audit log structure, automation rules engine.

### 3. Hiberius/whatsapp-receptionist
- **URL**: https://github.com/Hiberius/whatsapp-receptionist
- **License**: MIT
- **Stack**: Next.js 15 + Supabase + Anthropic + 360dialog + Google Calendar + Upstash
- **Tests**: 544 unit + 56 E2E
- **Strengths**:
  - Best-in-class multi-tenant architecture (22 tables, all RLS)
  - GDPR-native (Art. 15/17, PII redaction, data retention)
  - pgvector RAG for knowledge base
  - Human escalation with guardrails
  - Tenant-scoped WhatsApp credentials (AES-256-GCM encrypted)
  - Webhook idempotency, retry/backoff, dead-letter
  - Stripe subscriptions, data retention jobs
  - Excellent test coverage (RLS regression tests)
- **Weaknesses**:
  - **Supabase-dependent** (banned by user)
  - Italian language
  - Google Calendar for booking (not hotel-specific)
  - 360dialog WhatsApp provider (not self-hosted)
  - Single-user per tenant limitation
- **Verdict**: **STUDY + ADAPT PATTERNS**. Best reference for: RLS isolation testing, GDPR patterns, human escalation flow, knowledge RAG, webhook reliability. Replace Supabase.

### 4. martin-minghetti/whatsapp-ai-receptionist
- **URL**: https://github.com/martin-minghetti/whatsapp-ai-receptionist
- **License**: MIT
- **Stack**: FastAPI + Anthropic + Google Calendar + Redis + Meta Cloud API
- **Stars**: 2 (low maturity)
- **Strengths**:
  - Clean, simple architecture (~50 lines AI calls, no LangChain)
  - Config-driven onboarding (YAML)
  - Dates pre-calculated (no hallucination)
  - Redis + in-memory fallback
  - 42 tests
- **Weaknesses**:
  - Low maturity (2 stars, single developer)
  - Single-tenant
  - No multi-tenancy, no knowledge base
  - Google Calendar booking only
- **Verdict**: **STUDY**. Good reference for: simple AI orchestration, config-driven design, date handling patterns.

### 5. Evolution API
- **URL**: https://github.com/evolution-foundation/evolution-api
- **License**: Apache 2.0 (with brand protection conditions — must preserve logo/copyright, notify usage)
- **Stack**: Node.js + TypeScript + Express + Prisma (PostgreSQL/MySQL) + Redis
- **Docker**: evoapicloud/evolution-api
- **Strengths**:
  - Production-ready, multi-tenant REST API for WhatsApp
  - Dual connection: Baileys (free, QR) + Meta Cloud API (paid, official)
  - 900+ stars, active development
  - Integrations: Typebot, Chatwoot, Dify, OpenAI, RabbitMQ, S3/MinIO
  - Event-driven architecture
  - Webhook signature validation
- **Weaknesses**:
  - Apache 2.0 + trademark conditions (must notify Evolution Foundation of usage)
  - PostgreSQL/MySQL + Redis required (heavier than MVP needs)
  - Not a full CRM/PMS — just WhatsApp gateway
  - Trademark obligations add friction
- **Verdict**: **INTEGRATE as WhatsApp gateway layer**. Use for production WhatsApp connectivity. For MVP/demo, implement lightweight Baileys adapter directly to avoid dependencies.

### 6. WAHA (devlikeapro)
- **URL**: https://waha.devlikeapro.com/
- **License**: Apache 2.0
- **Purpose**: WhatsApp Web API engine (NOWEB/BAILEYS)
- **Verdict**: **INTEGRATE for dev/demo mode**. QR-based WhatsApp connection without Meta credentials. Perfect for MVP demo.

### 7. PocketBase
- **URL**: https://github.com/pocketbase/pocketbase
- **License**: MIT
- **Stack**: Go binary + SQLite
- **Strengths**:
  - Single ~30MB executable, no Docker needed
  - Built-in: SQLite database, REST API, realtime subscriptions, file storage, auth, admin dashboard
  - Windows-compatible
  - MIT license (commercial use OK)
  - JS VM plugin for custom logic
  - Multi-tenant via separate databases or collection-level filtering
- **Weaknesses**:
  - SQLite (not PostgreSQL-level concurrency)
  - No native pgvector/RAG (must implement separately)
  - Go-based — harder to extend in-process
  - Not a full CRM/PMS
- **Verdict**: **PRIMARY DATABASE for MVP**. Easy migration path to PostgreSQL via abstraction layer.

### 8. n8n
- **URL**: https://github.com/n8n-io/n8n
- **License**: Sustainable Use License (fair-code)
- **Issue**: License restricts SaaS resale. Using n8n as our orchestration backbone would expose our platform to licensing ambiguity in a commercial SaaS.
- **Verdict**: **REJECT for core orchestration**. Fine for internal hotel automations, not for our platform backbone.

### 9. Appwrite
- **URL**: https://github.com/appwrite/appwrite
- **License**: BSD-3-Clause
- **Verdict**: **BACKUP OPTION**. If PocketBase proves insufficient, Appwrite is a heavier but more full-featured alternative.

---

## WHAT WE REUSE (LEGAL)

| Component | Source | License | How |
|---|---|---|---|
| Architecture patterns | DeskcommCRM | MIT | Study, reimplement with PocketBase |
| Multi-tenant isolation | Hiberius | MIT | Study, reimplement with PocketBase |
| Intent router pattern | martin-minghetti | MIT | Study, reimplement |
| WhatsApp gateway | Evolution API | Apache 2.0 | Integrate as adapter (preserve attribution) |
| Dev WhatsApp (WAHA) | WAHA | Apache 2.0 | Use for demo mode |
| Database | PocketBase | MIT | Primary data layer |

## WHAT WE DO NOT REUSE

| Component | Source | Reason |
|---|---|---|
| Kamra PMS code | AGPL-3.0 | Copyleft incompatible with proprietary SaaS |
| n8n core | Fair-code | SaaS resale restriction |
| DeskcommCRM Supabase layer | User banned | User explicitly banned Supabase |
| Hiberius Supabase layer | User banned | User explicitly banned Supabase |

---

## LICENSING IMPLICATIONS FOR COMMERCIAL SaaS

1. **MIT components** (PocketBase, DeskcommCRM patterns, Hiberius patterns, martin-minghetti): Free to use, modify, distribute commercially. No copyleft. Must preserve copyright notice.
2. **Apache 2.0 components** (Evolution API, WAHA): Free to use commercially. Must preserve attribution, include NOTICE file. Evolution API requires trademark notification.
3. **AGPL-3.0 components** (Kamra PMS): AVOID entirely. Copyleft would require open-sourcing our entire platform.
4. **Fair-code** (n8n, NocoDB): AVOID for core platform.

**Bottom line**: Our stack is MIT + Apache 2.0 only. No copyleft.
