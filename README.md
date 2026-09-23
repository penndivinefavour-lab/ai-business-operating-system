# AI Business Operating System

AI-powered multi-agent SaaS platform for businesses. Hotels first.

## Quick Start (Demo Mode - No External Credentials Required)

```bash
cd "D:\HERMES AGENT\AI Business Operating System"
npm install
npm run demo
```

Opens:
- Dashboard: http://localhost:3000
- API: http://localhost:4000
- PocketBase: http://localhost:8090

Demo hotel "Hotel La Paix, Yaoundé" is seeded with rooms, customers, and bookings.

## What's Running in Demo Mode

- **Mock WhatsApp**: Simulates incoming messages (no Meta credentials needed)
- **Mock AI**: Deterministic intent classification and responses (no API keys needed)
- **PocketBase**: SQLite database with real schema and data
- **Full workflow**: Ask about rooms, prices, bookings, feedback, escalation

## Environment Variables

Copy `.env.example` to `.env.local` and configure as needed.

### Required for Demo Mode
None. Demo mode runs without any credentials.

### Required for Production
| Variable | Description | Required |
|---|---|---|
| `POCKETBASE_URL` | PocketBase server URL | Yes |
| `POCKETBASE_ADMIN_EMAIL` | PocketBase admin email | Yes |
| `POCKETBASE_ADMIN_PASSWORD` | PocketBase admin password | Yes |
| `AI_PROVIDER` | AI provider: openrouter, anthropic, deepseek, openai | Yes (for real AI) |
| `AI_API_KEY` | API key for selected AI provider | Yes (for real AI) |
| `WHATSAPP_PROVIDER` | whatsapp, waha, mock | No (default: mock) |
| `WHATSAPP_API_KEY` | WhatsApp API key | For production WhatsApp |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID | For production WhatsApp |

### Optional
| Variable | Default | Description |
|---|---|---|
| `PORT` | 4000 | API server port |
| `DASHBOARD_PORT` | 3000 | Dashboard port |
| `DEMO_MODE` | true | Enable demo mode |

## Project Structure

```
src/
├── api/              # Fastify API server
│   ├── server.ts     # Server entry point
│   ├── routes/       # REST API routes
│   └── hooks/        # Auth, logging hooks
├── orchestrator/     # AI orchestrator (intent routing)
├── tools/            # Specialist tools (deterministic)
│   ├── knowledge.ts  # Knowledge base retrieval (RAG)
│   ├── booking.ts    # Booking management
│   ├── customer.ts   # Customer/CRM operations
│   ├── lead.ts       # Lead capture
│   ├── feedback.ts   # Feedback collection
│   ├── escalation.ts # Human escalation
│   └── availability.ts # Room availability
├── adapters/         # Provider adapters
│   ├── ai/           # AI provider abstraction
│   ├── whatsapp/     # WhatsApp provider abstraction
│   └── database/     # Database abstraction
├── demo/             # Demo mode (seed + simulate)
├── shared/           # Shared types and utilities
└── types/            # TypeScript type definitions
dashboard/            # Next.js management dashboard
  ├── src/
  │   ├── app/        # Next.js App Router pages
  │   ├── components/ # React components
  │   ├── lib/        # Utilities
  │   └── styles/     # Tailwind styles
pocketbase/           # PocketBase binary and data
tests/                # Vitest tests
```

## Architecture

See `ARCHITECTURE.md` for full system diagram.

Core principle: **AI Orchestrator → Intent Classification → Specialist Tools → Audit Log**

The LLM never invents business facts (availability, prices, bookings). All business operations go through deterministic tools backed by structured data.

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

Tests cover:
- Booking conflict prevention
- Tenant isolation
- Customer creation/update
- Lead capture
- Knowledge retrieval
- Tool permission boundaries
- Human escalation
- Invalid request handling
- AI hallucination resistance (deterministic tools)

## Build

```bash
npm run typecheck     # TypeScript check
npm run build         # Production build
```

## Production Deployment

1. Set up Meta WhatsApp Business Account
2. Create PocketBase admin account
3. Set environment variables in `.env.local`
4. Run `npm run build && npm run start`
5. Or use Docker: `docker compose up`

See `SECURITY.md` for production security checklist.

## License

Proprietary. See `LICENSE_NOTES.md` for third-party licenses.

## Contact

ICON Studios - iconstudiosyde@gmail.com - +237 672 536 260
