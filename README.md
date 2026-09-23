# AI Business Operating System

An AI-powered multi-agent platform for businesses — starting with hotels.

## Quick Start

```bash
npm install
npm run dev
```

Visit: http://localhost:3000

**Demo login**: `admin@demo.hotel` / `demo-admin-123`

## What's Included

| Feature | Status |
|---------|--------|
| AI Employee configuration (Sarah, AI Receptionist) | ✅ |
| Multi-step onboarding wizard | ✅ |
| Business services & policies management | ✅ |
| Knowledge base (FAQs) | ✅ |
| Booking flow with confirmation | ✅ |
| Availability & pricing queries | ✅ |
| Escalation to human | ✅ |
| Multi-turn conversation context | ✅ |
| Customer-facing chat widget | ✅ |
| Owner dashboard | ✅ |
| Mobile-first responsive design | ✅ |
| Tenant isolation | ✅ |
| LLM provider abstraction (Anthropic, OpenAI-compatible, demo) | ✅ |
| Embedded chat widget | ✅ |
| End-to-end booking workflow | ✅ |

## Architecture

- **Backend**: Node.js built-in HTTP (zero dependencies)
- **Database**: SQLite via node:sqlite
- **AI**: Intent classification + deterministic tools + LLM abstraction
- **Frontend**: Vanilla JS dashboard + embeddable widget
- **Testing**: Node.js built-in test runner

## API Endpoints

### Public (Customer)
- `POST /api/chat` — Send message, get AI reply
- `GET /api/hotels/:slug/branding` — Hotel branding + employee info
- `GET /widget.html?hotel=slug` — Customer chat widget

### Authenticated (Owner)
- `GET /api/hotels` — List hotels
- `GET /api/hotels/:id` — Hotel details
- `POST /api/hotels` — Create hotel
- `GET /api/hotels/:id/employee` — Employee profile
- `PUT /api/hotels/:id/employee` — Update employee
- `POST /api/hotels/:id/test-employee` — Test employee chat
- `GET /api/hotels/:id/services` — List services
- `POST /api/hotels/:id/services` — Create service
- `GET /api/hotels/:id/policies` — List policies
- `POST /api/hotels/:id/policies` — Create policy
- `GET /api/hotels/:id/onboarding` — Onboarding checklist

## LLM Integration

| Provider | Status |
|----------|--------|
| Demo (deterministic fallback) | ✅ Built-in |
| Anthropic Claude | ✅ Via `ANTHROPIC_API_KEY` |
| OpenAI-compatible | ✅ Via `OPENAI_COMPATIBLE_*` |

## Testing

```bash
npm test
```

19/19 tests passing.

## Demo Mode

Without LLM credentials, uses deterministic intent-based responses with real database data.

With LLM keys, connects to real models.

## Deployment

```bash
npm run build
npm start
```

## GitHub

Repository: `https://github.com/penndivinefavour-lab/ai-business-operating-system`
Branch: `main`

## License

MIT
