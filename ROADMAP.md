# Roadmap — AI Business Operating System

---

## Phase 1: MVP (Current)
**Goal**: Working product that demonstrates complete hotel AI front desk workflow

- [x] Research & audit open-source projects
- [x] Architecture design
- [ ] Database schema & PocketBase setup
- [ ] Core API server (Fastify + TypeScript)
- [ ] AI orchestrator + intent classifier
- [ ] Specialist tools (booking, knowledge, CRM, escalation, feedback)
- [ ] WhatsApp adapter (mock for demo, Evolution API for prod)
- [ ] Management dashboard (Next.js)
- [ ] Demo mode with seeded data
- [ ] Automated tests
- [ ] Documentation

**Deliverables**: `npm run demo` shows full product working locally

---

## Phase 2: Hotel Pilot
**Goal**: Deploy for 1-2 real hotels in Cameroon

- [ ] Production WhatsApp (Meta Cloud API)
- [ ] Real hotel onboarding flow
- [ ] Payment integration (Mobile Money)
- [ ] Email notifications (Resend)
- [ ] Production deployment (Docker + VPS)
- [ ] Monitoring (Uptime Kuma)
- [ ] Backup automation
- [ ] Hotel staff training materials

**Deliverables**: Live hotel using the system

---

## Phase 3: SaaS v1
**Goal**: Multi-tenant platform serving 5-20 hotels

- [ ] PostgreSQL migration
- [ ] pgvector for production RAG
- [ ] Stripe billing integration
- [ ] White-label support
- [ ] API for third-party integrations
- [ ] Advanced analytics
- [ ] Role-based access (hotel staff roles)
- [ ] Performance optimization
- [ ] Security audit

**Deliverables**: SaaS platform with billing

---

## Phase 4: Multi-Vertical Expansion
**Goal**: Support hospitals, schools, restaurants, real estate, clinics, SMEs

- [ ] Vertical-specific templates
- [ ] Configurable data models per vertical
[ ] Vertical-specific booking/reservation types
- [ ] Industry-specific compliance
- [ ] Partner/integrator marketplace

---

## Phase 5: Scale
**Goal**: 50+ hotels, multi-country

- [ ] Multi-region deployment
- [ ] Advanced AI (fine-tuned models)
- [ ] Voice AI receptionist
- [ ] Mobile app (React Native)
- [ ] Advanced reporting/BI
