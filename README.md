# AI Business Operating System

An AI-powered multi-agent platform for businesses — starting with hotels.

## Quick Start

```bash
npm install
npm run dev
```

Visit: http://localhost:3000

**Note**: there is no seeded dashboard login. Create an account via the dashboard
sign-up form or `POST /api/signup`. The seeded demo hotel (`demo`) is available to
the public chat widget without authentication.

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

### Public (Customer widget)
- `POST /api/widget/chat` — Send message, get AI reply
- `GET /api/businesses/:slug/branding` — Business branding + employee info
- `GET /api/widget/conversations/:id/messages` — Conversation history
- `GET /widget.html?hotel=slug` — Customer chat widget

### Authenticated (Owner)
- `POST /api/signup` — Create account + first business
- `POST /api/login` — Log in
- `POST /api/logout` — Log out
- `GET /api/me` — Current session
- `POST /api/me/business` — Switch active business
- `GET /api/businesses` — List your businesses
- `POST /api/businesses` — Create a business
- `GET /api/businesses/:id` — Business details
- `GET /api/businesses/:id/employee` — Employee profile
- `PUT /api/businesses/:id/employee` — Update employee
- `POST /api/businesses/:id/test-employee` — Test employee chat
- `GET /api/businesses/:id/services` — List services
- `POST /api/businesses/:id/services` — Create service
- `GET /api/businesses/:id/policies` — List policies
- `POST /api/businesses/:id/policies` — Create policy
- `GET /api/businesses/:id/onboarding` — Onboarding checklist
- `POST /api/businesses/:id/onboarding/complete` — Complete onboarding
- `GET /api/businesses/:id/overview` — Dashboard metrics
- `GET /api/businesses/:id/conversations` — Conversations
- `GET /api/businesses/:id/reservations` — Reservations
- `GET /api/businesses/:id/customers` — Customers
- `GET /api/businesses/:id/knowledge` — Knowledge base
- `GET /api/businesses/:id/audit` — Audit log

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

26/26 tests passing.

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
