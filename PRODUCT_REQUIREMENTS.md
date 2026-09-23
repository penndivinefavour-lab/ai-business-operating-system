# Product Requirements — AI Digital Front Desk (Hotel MVP)

Date: 2026-09-23
Status: DRAFT → IMPLEMENTING

---

## 1. VISION

A single intelligent **AI Business Assistant** / **AI Digital Front Desk** that hotels offer to their customers. The customer experiences one seamless conversation (WhatsApp, Web, etc.) that can answer questions, check availability, book rooms, collect feedback, and escalate to a human when needed.

Internally, the system uses an **orchestrator** + **specialist agents/tools** for each capability, with deterministic and auditable business operations (the LLM never invents facts).

---

## 2. MVP SCOPE

### 2.1 Must Have (MVP)

| # | Capability | Description |
|---|---|---|
| 1 | **Hotel Knowledge Base** | Static content (policies, services, FAQs, location) that the AI retrieves via RAG. |
| 2 | **Customer Conversations** | Receive, understand, and respond to customer messages (WhatsApp + Web). |
| 3 | **Lead Capture & Qualification** | Identify potential customers, capture contact info, qualify interest. |
| 4 | **Customer Profiles** | Create/update customer records, track history and preferences. |
| 5 | **Room / Availability Data** | Query room inventory, prices, availability by date. |
| 6 | **Booking Requests** | Create reservation requests, confirm availability, record booking. |
| 7 | **Follow-up Reminders** | Schedule and send reminders (WhatsApp/email) for pending bookings, check-in, etc. |
| 8 | **Feedback Collection** | Collect and store customer feedback, ratings, reviews. |
| 9 | **Human Escalation** | Detect when to escalate, hand off to human operator, log handoff. |
| 10 | **Activity / Audit Logs** | Immutable log of every action taken by AI or human. |
| 11 | **Management Dashboard** | Web UI for hotel staff to view conversations, leads, bookings, feedback. |
| 12 | **Demo Mode** | Simulate incoming conversations + full workflow without WhatsApp/AI credentials. |
| 13 | **Realistic Seeded Data** | Demo hotel with rooms, customers, bookings, feedback pre-loaded. |

### 2.2 Must NOT Have (Out of Scope for MVP)

- Payment processing (Stripe, mobile money)
- Housekeeping module
- POS / restaurant billing
- Multi-property chain support
- White-label / rebranding
- Voice messages
- Live production WhatsApp (demo mode only)
- Mobile app (PWA only)
- Internationalization beyond English

---

## 3. DEMO CONVERSATIONS (Required Scenarios)

The system must handle these demo conversations correctly:

| # | Customer Says | Expected AI Action |
|---|---|---|
| 1 | "Do you have a room for Friday?" | Query room availability for Friday, show available rooms/prices |
| 2 | "How much is the executive room?" | Retrieve executive room price from knowledge base |
| 3 | "I want to book for two nights" | Start booking flow, ask for dates/guest details, create reservation |
| 4 | "Can I check in early?" | Retrieve check-in policy from knowledge base |
| 5 | "Where are you located?" | Retrieve location/address from knowledge base |
| 6 | "I had a problem with my room" | Log feedback/issue, escalate to human |
| 7 | "I want to speak to someone" | Human escalation flow |
| 8 | "What are your services?" | List services (WiFi, parking, restaurant, etc.) from knowledge base |
| 9 | "I need a taxi to the airport" | Store as service request, escalate to human |
| 10 | "Do you allow pets?" | Retrieve pet policy from knowledge base |
| 11 | "I want to cancel my booking" | Look up customer booking, explain cancellation policy |
| 12 | "Is breakfast included?" | Retrieve room/package details from knowledge base |

---

## 4. FUNCTIONAL REQUIREMENTS

### 4.1 Knowledge Base

- Hotel profile: name, description, address, phone, email, website, check-in/out times
- Services: list of amenities (WiFi, parking, pool, restaurant, gym, spa, etc.)
- Policies: cancellation, pets, smoking, children, payment, early check-in/late check-out
- FAQs: pre-defined question-answer pairs
- Rooms: types, descriptions, prices, amenities, images, total count
- All retrievable via semantic search (RAG)

### 4.2 Customer Conversations

- Receive messages via channel adapters (WhatsApp, Web)
- Maintain conversation context (last N messages)
- Classify intent (question, booking, feedback, escalation, small talk)
- Route to correct capability
- Generate response (AI-generated or template-based)
- Log all interactions to audit log

### 4.3 Lead Capture

- Detect potential customer from conversation
- Capture: name, phone, email, interest, preferred contact method
- Store in leads table
- Assign status (new, contacted, qualified, converted, lost)

### 4.4 Customer Profiles

- Create/update from conversation or booking
- Fields: name, phone, email, total stays, total spent, preferences, notes
- Link to all conversations and bookings
- Guest recognition by phone number

### 4.5 Room / Availability

- Query by date range and room type
- Return: available rooms, prices, occupancy
- Deterministic: never from LLM, always from database
- Handle overbooking prevention

### 4.6 Booking Requests

- Collect: guest info, dates, room type, special requests
- Check availability (deterministic)
- Create reservation record with status (pending, confirmed, cancelled, completed)
- Send confirmation message
- Prevent double-booking

### 4.7 Follow-up Reminders

- Schedule reminders for: booking confirmation, pre-check-in, post-stay feedback
- Send via channel adapter (WhatsApp/email)
- Log all reminder sends

### 4.8 Feedback Collection

- Collect ratings (1-5) and text feedback
- Store with customer and booking reference
- Trigger follow-up actions for low ratings (<3)

### 4.9 Human Escalation

- Detect triggers: explicit request ("speak to someone"), sensitive topic (complaint, safety), AI confidence low, customer anger
- Escalation flow:
  1. Acknowledge: "Let me connect you with a team member."
  2. Create escalation record with context
  3. Notify human operator (dashboard alert, email)
  4. Customer waits for human
- All escalations logged

### 4.10 Audit Logs

- Append-only table
- Fields: timestamp, actor (AI/human/system), tenant_id, action, entity, entity_id, details (JSON), ip
- Used for compliance, debugging, analytics

### 4.11 Management Dashboard

- **Overview**: KPIs (active conversations, today's bookings, pending leads, average rating)
- **Conversations**: list of all conversations, filter by status, view thread, reply as human
- **Leads**: list, filter by status, convert to customer
- **Customers**: list, search, view profile, view history
- **Reservations**: list, filter by date/status, check-in/out actions
- **Knowledge Base**: edit hotel info, services, policies, FAQs
- **Automations**: configure follow-up rules, escalation triggers
- **Feedback**: list, filter by rating, respond
- **Reports**: occupancy, revenue, conversation volume, AI resolution rate

---

## 5. NON-FUNCTIONAL REQUIREMENTS

| Category | Requirement |
|---|---|
| **Performance** | AI response < 5s, API response < 500ms |
| **Availability** | 99% uptime (excluding WhatsApp dependency) |
| **Scalability** | Modular monolith, single VPS supports 50+ hotels |
| **Security** | Tenant isolation, no data leakage, encrypted credentials |
| **Auditability** | All business operations logged immutably |
| **Determinism** | Business facts (availability, prices, bookings) never from LLM |
| **Testability** | Unit tests for all tools, integration tests for all workflows |
| **Portability** | Runs on Windows 11, macOS, Linux |
| **Demo-ability** | Full demo without external credentials |

---

## 6. TECHNICAL ARCHITECTURE

### 6.1 Stack

| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js 24 + TypeScript | Already installed, modern, fast |
| Web Framework | Fastify (or Express) | Lightweight, fast, easy routing |
| Database | PocketBase (SQLite) | Zero-config, realtime, auth, MIT |
| AI Adapter | Vercel AI SDK | Provider-agnostic (Anthropic, OpenRouter, DeepSeek, etc.) |
| WhatsApp Adapter | Evolution API (prod) / WAHA (dev) / Mock (demo) | Swappable |
| Frontend | Next.js 15 + React 19 + Tailwind + shadcn/ui | Modern, type-safe, component library |
| Validation | Zod | Runtime schema validation |
| Testing | Vitest + Playwright | Fast, modern, E2E capable |

### 6.2 Data Model (Core Entities)

```
Tenant (Hotel)
├── id, name, slug, contact info, settings, created_at

Room
├── id, tenant_id, type, name, description, price_cents, amenities[], total_count, images[]

Customer
├── id, tenant_id, name, phone, email, total_stays, total_spent_cents, preferences, notes, created_at

Conversation
├── id, tenant_id, customer_id, channel (whatsapp/web), status, metadata, created_at

Message
├── id, conversation_id, direction (in/out), content, actor (ai/human/system), metadata, created_at

Lead
├── id, tenant_id, name, phone, email, interest, status, source, converted_to_customer_id, created_at

Booking
├── id, tenant_id, customer_id, room_id, check_in, check_out, status, total_cents, special_requests, created_at

Feedback
├── id, tenant_id, customer_id, booking_id, rating, comment, status, created_at

Escalation
├── id, tenant_id, conversation_id, reason, status, assigned_to, context, created_at

AuditLog
├── id, tenant_id, actor, action, entity, entity_id, details (json), created_at

KnowledgeDocument
├── id, tenant_id, type (policy/faq/service/room), title, content, embedding, metadata, created_at
```

### 6.3 Adapter Layer

All external services behind interfaces:

```typescript
interface AiProvider {
  chat(messages: Message[], tools: Tool[]): Promise<Stream>;
  embed(texts: string[]): Promise<number[][]>;
}

interface WhatsAppProvider {
  send(to: string, message: Message): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => void): void;
}

interface DatabaseProvider {
  // CRUD + realtime + auth
}

interface EmailProvider {
  send(to: string, template: string, data: object): Promise<void>;
}
```

### 6.4 Orchestrator Pattern

```
Incoming Message
    │
    ▼
┌─────────────────────┐
│  Intent Classifier  │ (AI or rule-based)
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
 BOOKING      KNOWLEDGE    FEEDBACK    ESCALATE
    │             │            │           │
    ▼             ▼            ▼           ▼
BookingTool  KnowledgeTool  FeedbackTool  EscalationTool
    │             │            │           │
    └──────┬──────┴────────────┴───────────┘
           │
           ▼
   Generate Response (AI)
           │
           ▼
   Send via Channel Adapter
           │
           ▼
   Log to AuditLog
```

---

## 7. ACCEPTANCE CRITERIA

### 7.1 Demo Mode
- [ ] User runs `npm run demo` and sees seeded hotel data
- [ ] User can simulate all 12 demo conversations
- [ ] Each conversation triggers the correct capability
- [ ] Data changes are visible in the dashboard
- [ ] No external credentials required

### 7.2 Booking Flow
- [ ] Customer asks about availability → system shows available rooms
- [ ] Customer confirms booking → system creates booking record
- [ ] Double-booking prevented at database level
- [ ] Confirmation sent to customer

### 7.3 Tenant Isolation
- [ ] Hotel A cannot see Hotel B's data
- [ ] All queries filtered by tenant_id
- [ ] Tests verify isolation

### 7.4 Audit & Determinism
- [ ] Every business operation logged
- [ ] Room availability/price never generated by LLM
- [ ] Tool calls are validated against permission boundaries

---

## 8. SUCCESS METRICS

| Metric | Target |
|---|---|
| Demo conversations handled correctly | 12/12 |
| Booking conflicts prevented | 100% |
| Tenant isolation test coverage | 100% |
| AI response time (demo mode) | < 3s |
| Application startup time | < 10s |
| Tests passing | > 95% |
| Production build | Clean, no errors |
