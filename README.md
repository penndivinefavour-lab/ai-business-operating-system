# AI Business Operating System

Multi-tenant AI SaaS platform for hotels. First vertical: Hotel Digital Front Desk.

**We are not selling dashboards. We are selling AI employees that operate businesses.**

---

## What It Is

Each hotel gets an AI employee — e.g. "Sarah, AI Receptionist" — that communicates with customers as the hotel itself. Customers talk to Sarah through WhatsApp or website chat. Hotel owners supervise Sarah through a mobile-first control center.

## Architecture

| Layer | Responsibility |
|-------|---------------|
| **Customer Experience** | Web chat widget, WhatsApp — branded to the hotel |
| **Business Owner Experience** | Mobile-first control center for managing the AI employee |
| **Internal Control Plane** | Platform monitoring, multi-business oversight |

## Quick Start

```bash
npm install
npm run dev      # Start the API server on http://localhost:3000
npm run demo     # Run the offline demo (no API keys needed)
npm test         # Run tests
```

### Default credentials (demo only)
- Admin: `admin@demo.hotel` / `demo-admin-123`
- Staff: `staff@demo.hotel` / `demo-staff-123`

## How It Works

1. Customer sends message (web chat or WhatsApp)
2. Message enters the **orchestrator** (src/core/orchestrator.ts)
3. Intent is classified (rule-based, deterministic, bilingual FR/EN)
4. Specialist agent handles the intent using **governed tools**
5. Tools query/update the database — the LLM never invents business facts
6. Response is sent back through the same channel

## Tech Stack

- **Runtime:** Node.js (built-in http module — zero framework dependencies)
- **Database:** SQLite via `node:sqlite` (built-in)
- **AI Provider:** Abstraction layer (demo/OpenAI/Anthropic)
- **Multi-tenancy:** tenant_id isolation on all tables
- **Frontend:** Vanilla HTML/CSS/JS (mobile-first, no build step)

## Project Structure

```
src/
├── core/
│   ├── orchestrator.ts    # Message routing + AI provider abstraction
│   ├── intents.ts         # Bilingual intent classification
│   ├── tools/             # Governed business tools (deterministic)
│   └── dateparse.ts       # Natural language date parsing
├── db/
│   ├── client.ts          # SQLite access layer
│   ├── schema.ts          # 15-table schema
│   ├── repositories.ts    # Tenant-scoped queries
│   └── seed.ts            # Realistic demo data
├── llm/
│   ├── provider.ts        # LLM abstraction (demo/OpenAI/Anthropic)
│   └── ...
├── channels/
│   └── whatsapp.ts        # WhatsApp Cloud API adapter
├── agents/
│   └── index.ts           # 16 specialist agent handlers
├── demo/
│   ├── simulator.ts       # Offline demo scenarios
│   └── run-demo.ts        # CLI demo runner
└── dashboard/
    ├── index.html         # Business owner control center
    ├── app.js             # Dashboard logic
    ├── styles.css         # Design system
    └── chat-demo.html     # Customer-facing web chat widget
```

## Tests

Run with:
```bash
npm test
```

Tests cover:
- Availability queries
- Booking flow
- Tenant isolation (cross-tenant data cannot leak)

## Security

- Password hashing (scrypt)
- Rate limiting on public endpoints
- Cross-tenant access prevention
- No hardcoded secrets (all via .env)
- Audit logging of all AI actions

## Roadmap

- [ ] Owner dashboard redesign (mobile-first, premium UI)
- [ ] Embedded web chat widget for hotel websites
- [ ] WhatsApp QR connection (Evolution API)
- [ ] Voice channel
- [ ] Additional verticals (restaurants, clinics, schools)

## License

MIT

---

*Built in Cameroon 🇨🇲*
