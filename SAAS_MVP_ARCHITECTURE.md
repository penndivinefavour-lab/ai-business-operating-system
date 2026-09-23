# SaaS MVP Architecture

## Overview

The AI Business Operating System is a multi-tenant SaaS platform where each business gets a configurable AI employee that communicates with customers, handles bookings, captures leads, and learns the business.

## Data Model

### Core Entities

| Table | Purpose |
|-------|---------|
| `accounts` | Platform-level user accounts (email, password hash, name) |
| `businesses` | One row per tenant business (hotel, restaurant, clinic, etc.) |
| `business_memberships` | Account ↔ Business relationship with role (owner/staff) |
| `hotels` | Legacy hotel-specific config (kept for backward compatibility) |
| `hotel_users` | Legacy hotel admin accounts |
| `employee_profiles` | AI employee identity, personality, tone, status |
| `business_services` | Configurable services/products per business |
| `business_policies` | Business rules (cancellation, pets, etc.) |
| `onboarding_checklist` | Per-business setup progress tracking |
| `rooms` | Hotel room inventory |
| `customers` | Per-hotel customer records |
| `conversations` | Customer ↔ AI employee conversations |
| `messages` | Individual messages within conversations |
| `reservations` | Booking records |
| `leads` | Potential customers |
| `knowledge_items` | FAQ/knowledge base |
| `escalations` | Human handoff events |
| `followups` | Pending tasks |
| `audit_log` | Activity/audit trail |

### Multi-Tenant Architecture

```
Account (platform user)
    ↓
BusinessMembership (account_id, business_id, role)
    ↓
Business (tenant)
    ↓
Hotel (legacy, business_id FK)
    ↓
EmployeeProfile, Rooms, Customers, Conversations, etc.
```

## Authentication Flow

### Signup
1. User submits email, password, name, business name
2. System creates:
   - Account row
   - Business row (with unique slug)
   - BusinessMembership (role=owner)
   - Legacy hotel row (for compatibility)
   - EmployeeProfile (draft status)
   - OnboardingChecklist
3. Returns session token

### Login
1. User submits email + password
2. System checks accounts table (scrypt password verify)
3. Returns session token with account + business context

### Session Management
- In-memory token store (can be replaced with Redis for production)
- 24-hour token expiration
- Bearer token in Authorization header or session cookie

## Authorization Model

### Public Endpoints
| Endpoint | Access |
|----------|--------|
| GET /api/health | Public |
| POST /api/signup | Public |
| POST /api/login | Public |
| POST /api/logout | Public |
| GET /api/businesses/:slug/branding | Public |
| POST /api/widget/chat | Public (rate-limited) |
| GET /api/widget/conversations/:id/messages | Public |
| GET /widget.html | Public |
| GET / | Landing page |
| GET /signup, /login | Public |

### Authenticated Endpoints
| Endpoint | Authorization |
|----------|---------------|
| GET /api/me | Valid session |
| POST /api/me/business | Valid session + membership |
| GET /api/businesses | Valid session (own businesses only) |
| POST /api/businesses | Valid session |
| GET /api/businesses/:id | Session + membership check |
| PUT /api/businesses/:id | Session + membership check |
| GET /api/businesses/:id/employee | Session + ownership |
| PUT /api/businesses/:id/employee | Session + ownership |
| GET /api/hotels/:id/* | Session + ownership (via business) |

### Cross-Tenant Protection
Every authenticated route verifies:
1. Session is valid (token exists, not expired)
2. Session's account has a `business_memberships` row for the requested business
3. If not → 403 Forbidden

## Employee Lifecycle

```
Draft → Active → Paused → Active → ...
```

- **Employee is created** when a business is created (signup or business creation)
- **Employee is configured** through the 9-step onboarding wizard
- **Employee is activated** by setting status='active'
- **Employee can be paused** by setting status='paused'
- **Employee is "ready"** when onboarding is complete AND status is 'active'

## Customer Widget Flow

1. **Hotel owner** copies embed snippet from dashboard
2. **Customer** visits hotel website → widget loads
3. **Widget** calls GET /api/businesses/:slug/branding → gets employee identity
4. **Customer** types message → POST /api/widget/chat → gets AI reply
5. **Conversation** is maintained via conversationId

### Widget Embed Methods
- **Script loader**: `<script src="/widget.js" data-business="slug" async></script>`
- **Iframe**: `<iframe src="/widget.html?business=slug">`
- **JS API**: `window.HermesChat.open({ hotelSlug: 'slug' })`

## Vertical Expansion

The `businesses` table supports any vertical:
- `business_type = 'hotel'` → rooms, reservations, check-in/out
- `business_type = 'restaurant'` → tables, reservations, menu
- `business_type = 'clinic'` → appointments, services
- `business_type = 'real_estate'` → properties, viewings
- `business_type = 'sme'` → services, inquiries

The AI employee model is vertical-agnostic — it's configured via services, policies, and knowledge, not hard-coded to hotels.

## Security Model

1. **Password security**: scrypt with random salt, timing-safe comparison
2. **Token security**: 256-bit random hex tokens
3. **Tenant isolation**: Every data query filters by hotel_id/business_id
4. **Rate limiting**: Per-IP rate limits on chat and auth endpoints
5. **Public API boundary**: Only intentionally public data exposed (no DB IDs, no secrets)
6. **CORS**: Widget endpoints allow cross-origin
7. **Input validation**: All inputs validated before DB operations
8. **SQL injection prevention**: Parameterized queries throughout

## Future Phases

1. **WhatsApp integration** (Evolution API)
2. **Production deployment** (Docker, Nginx, SSL)
3. **Advanced analytics** (conversion tracking, employee performance)
4. **Multi-language support** (expand beyond fr/en)
5. **Custom AI model selection** (per-business model config)
