# SaaS MVP Architecture

## Overview

The AI Business Operating System is a multi-tenant SaaS platform where each business gets a configurable AI employee that communicates with customers, handles bookings, manages inquiries, and escalates to humans when needed.

## Architecture Principles

1. **Vertical-Neutral Core**: The AI employee/orchestrator/tool model works for hotels, restaurants, clinics, schools, hospitals, real-estate businesses, and SMEs.
2. **Tenant Isolation**: Every authenticated request is scoped to a business the user actually owns.
3. **Deterministic Facts**: Critical business data (prices, availability, policies) comes ONLY from database-backed tools, never from LLM hallucination.
4. **Channel-Agnostic**: The core AI doesn't know or care if a message came from web widget, WhatsApp, or future channels.

## Data Model

### Platform Level
- **accounts**: Platform user authentication (email, password_hash, name)
- **sessions**: Durable session tokens (token, account_id, business_id, created_at, last_active)
- **businesses**: Tenant entities (hotel, restaurant, clinic, etc.)
- **business_memberships**: Account↔Business relationships with roles

### Tenant Level (all tables carry business_id)
- **hotels**: Hotel-specific config (legacy, being phased into businesses)
- **employee_profiles**: AI employee identity, personality, tone
- **rooms**: Inventory with pricing
- **customers**: Contact info, language preference
- **conversations**: Channel-linked conversation records
- **messages**: Individual messages within conversations
- **reservations**: Booking records with status workflow
- **business_services**: Configurable services with pricing
- **business_policies**: Business rules and policies
- **knowledge_items**: FAQ/knowledge base
- **leads**: Prospective customer tracking
- **escalations**: Human escalation records
- **followups**: Task tracking
- **audit_log**: Activity events
- **agent_runs**: Performance and debugging data

## Security Model

### Authentication
- **Passwords**: scrypt hashing (salt + hash stored in database)
- **Sessions**: Database-backed tokens with 24h TTL
- **Cookies**: httpOnly, secure (in production), SameSite=Lax
- **Bearer Tokens**: Supported for API access

### Authorization
- **Public Routes**: Widget chat, branding, signup, login, health check
- **Protected Routes**: All `/api/businesses/:id/*` routes require membership
- **Cross-Tenant Protection**: 403 Forbidden for unauthorized business access

### Production Security
- **CSRF Protection**: Token-based (generated from session)
- **Input Validation**: Email format, password length, sanitization
- **Security Headers**: CSP, X-Frame-Options, X-Content-Type-Options, etc.
- **Error Handling**: No stack traces or internal details in production responses

## API Architecture

### Public Endpoints
- `POST /api/signup` - Account registration
- `POST /api/login` - Authentication
- `POST /api/logout` - Session destruction
- `GET /api/health` - Health check
- `GET /api/businesses/:slug/branding` - Public business info
- `POST /api/widget/chat` - Customer chat (widget)

### Protected Endpoints
- `GET /api/me` - Session info
- `GET /api/businesses` - List user's businesses
- `POST /api/businesses` - Create business
- `GET /api/businesses/:id` - Business details
- `GET /api/businesses/:id/employee` - Employee config
- `PUT /api/businesses/:id/employee` - Update employee
- `GET/POST /api/businesses/:id/services` - Services CRUD
- `GET/POST /api/businesses/:id/policies` - Policies CRUD
- `GET /api/businesses/:id/conversations` - Conversation list
- `GET /api/businesses/:id/reservations` - Reservation list

## Channel Architecture

### Web Widget
- **Embed**: `<script src="widget.js" data-hotel="slug">` or iframe
- **Branding**: Dynamic from business config
- **Session**: conversationId maintained client-side

### WhatsApp (Official Cloud API)
- **Inbound**: Webhook → signature verification → orchestrator
- **Outbound**: Cloud API message delivery
- **Mapping**: Phone number → conversation

## LLM Integration

### Providers
- **Demo**: Deterministic fallback (default, no credentials needed)
- **Anthropic**: Claude 3.5 Haiku (fast, affordable)
- **OpenAI-Compatible**: Any OpenAI API-compatible service

### Context Building
The LLM receives:
1. Employee identity (name, role, personality, tone)
2. Business context (services, policies, knowledge)
3. Conversation history (last 8 messages)
4. Verified facts from deterministic tools

### Safety
- FCFA amount verification (no unbacked figures)
- Fallback to deterministic reply on LLM failure
- No system prompt exposure to customers

## Deployment

### Docker
- Node.js 24 Alpine base
- Volume-mounted /data for persistent SQLite
- Health check on /api/health

### Manual
- Node.js 24+ with built-in SQLite
- PM2 for process management
- Nginx for HTTPS reverse proxy

## Scaling Path

1. **MVP**: Single instance + SQLite (current)
2. **Growth**: Add Redis for sessions, migrate to PostgreSQL
3. **Scale**: Load balancer + multiple instances + read replicas
