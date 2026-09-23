# OPEN SOURCE NEXT RESEARCH — AI Business Operating System

**Date:** 2026-09-23
**Purpose:** Identify mature open-source projects that could accelerate our hotel AI SaaS

---

## Search Methodology

- Searched GitHub for: hotel PMS, CRM, WhatsApp inbox, AI agent frameworks, workflow automation, customer support platforms
- Evaluated: stars, license, language, maturity, API quality, self-hosting, Windows compatibility
- Rejected: GPL/AGPL copyleft for core platform integration, projects with <100 stars, abandoned projects

---

## Tier 1: Strong Candidates

### 1. Chatwoot (Customer Communication Platform)
- **GitHub:** chatwoot/chatwoot
- **Stars:** 35,000+
- **License:** MIT (core), Enterprise addons are source-available/commercial
- **Language:** Ruby on Rails (backend), Vue.js (frontend)
- **Database:** PostgreSQL, Redis
- **What it provides:**
  - Omnichannel inbox (WhatsApp, Email, Web Chat, Facebook, Instagram, Telegram, SMS, Line)
  - Conversation assignment, notes, tagging
  - Captain AI (built-in auto-response from knowledge base)
  - Automations (if-then rules)
  - Custom attributes, team inboxes
  - REST API + Webhooks
- **What we would still build:**
  - Hotel-specific AI orchestration (room availability, booking, pricing)
  - Hotel onboarding and room configuration
  - Integration layer between Chatwoot and our deterministic tools
- **Integration difficulty:** Medium
  - Our orchestrator would sit as a "bot" agent in Chatwoot's inbox
  - Webhooks connect Chatwoot conversations to our orchestrator
  - Our tools would remain the deterministic backend
- **Resource requirements:** Ruby, PostgreSQL, Redis (heavy for Windows dev)
- **Commercial SaaS suitability:** Yes (MIT core is safe)
- **Verdict:** **INTEGRATE** — This is our strongest candidate for the customer communication layer

### 2. Twenty CRM (Modern Open-Source CRM)
- **GitHub:** twentyhq/twenty
- **Stars:** 56,000+
- **License:** AGPL-3.0 (with commercial license option)
- **Language:** TypeScript, NestJS, React, GraphQL
- **Database:** PostgreSQL, Redis
- **What it provides:**
  - Objects, views, workflows, agents
  - Lead/Opportunity/Contact management
  - GraphQL API
  - Webhooks
  - Modern Notion-like UI
- **What we would still build:**
  - Hotel-specific data model (rooms, reservations, housekeeping)
  - WhatsApp/web chat AI receptionist
  - Booking engine
- **Integration difficulty:** Medium
  - Can integrate via GraphQL API as our CRM backend
  - But AGPL-3.0 requires careful separation
- **Resource requirements:** PostgreSQL, Redis, Node 18+
- **Commercial SaaS suitability:** RISKY — AGPL requires sharing modifications if offered as SaaS. The "Twenty Application Exception" allows building apps on top, but running Twenty as a service requires the commercial license.
- **Verdict:** **REFERENCE ONLY** — Study patterns, don't integrate as core backend

### 3. Dify (AI Agent Workflow Platform)
- **GitHub:** langgenius/dify
- **Stars:** 154,000+
- **License:** Apache 2.0 with additional restrictions (Dify Open Source License)
- **Language:** Python (Flask/FastAPI), React
- **Database:** PostgreSQL, Redis, vector DB options
- **What it provides:**
  - Visual AI workflow builder
  - RAG pipeline
  - Agent runtime with tool calling
  - 50+ built-in tools
  - Model management
  - Knowledge base management
  - API + Webhook triggers
- **What we would still build:**
  - Hotel-specific deterministic tools (availability, booking)
  - WhatsApp/web chat frontend
  - Hotel onboarding UI
- **Integration difficulty:** High
  - Dify is a monolith, not designed to be a library
  - We could use its API as the AI layer, but our tool architecture is better suited
- **Resource requirements:** Python, PostgreSQL, Redis (heavy)
- **Commercial SaaS suitability:** OK (Apache 2.0 derivative)
- **Verdict:** **REFERENCE ONLY** — Impressive but overkill; our custom orchestrator is better for hotel-specific needs

---

## Tier 2: Worth Studying

### 4. Frappe Framework / ERPNext
- **GitHub:** frappe/erpnext
- **Stars:** 38,000+
- **License:** GPL-3.0
- **Language:** Python, JavaScript (Vue)
- **What it provides:**
  - Full ERP with CRM, HR, Accounting, Inventory, Manufacturing
  - Frappe Hospitality module (hotels & restaurants)
  - REST API, webhooks, custom apps
- **Verdict:** **REJECT for integration** — GPL-3.0 copyleft. Hospitality module is too small (72 stars). But study Frappe's "DocType" pattern for hotel room/reservation modeling.

### 5. Evolution API (WhatsApp Gateway)
- **GitHub:** EvolutionAPI/evolution-api
- **License:** Apache 2.0 (verified)
- **Language:** Node.js (TypeScript)
- **What it provides:**
  - WhatsApp Web QR connection (Baileys, no Meta Business required)
  - WhatsApp Cloud API (official) support
  - REST API for send/receive
  - Multi-tenant instance support
- **Verdict:** **INTEGRATE for WhatsApp QR** — This is the best free option for hotels that don't have Meta Business accounts. Can replace our custom WhatsApp channel.

### 6. Rasa (Conversational AI Framework)
- **GitHub:** RasaHQ/rasa
- **Stars:** 18,000+
- **License:** Apache 2.0
- **Language:** Python
- **What it provides:**
  - NLU intent classification
  - Dialogue management
  - Custom actions (Python)
- **Verdict:** **REFERENCE ONLY** — Our rule-based system is more deterministic and appropriate for business operations. Rasa adds ML complexity we don't need.

---

## Tier 3: Rejected

| Project | Reason |
|---------|--------|
| **Supabase** | Banned by user |
| **n8n** | Sustainable Use License restricts SaaS resale |
| **Kamra PMS** | AGPL-3.0 copyleft |
| **QloApps** | Outdated PHP/MySQL, low activity |
| **Odoo Community** | AGPL-3.0, heavy Python ERP |
| **Langflow** | MIT license but immature for production |

---

## Summary: What to Actually Integrate

| Priority | Project | What We Get | Effort |
|----------|---------|-------------|--------|
| 1 | **Evolution API** | Free WhatsApp QR connection, no Meta Business needed | 2-3 days |
| 2 | **Chatwoot** | Omnichannel inbox, Captain AI, automations | 1-2 weeks |
| 3 | **Dify** | AI workflow builder (if we need visual builder) | 2-4 weeks |

---

**End of Research**
