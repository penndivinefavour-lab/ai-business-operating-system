# Research Report — AI Business Operating System

Date: 2026-09-23

---

## 1. Market Research

### Existing Products

| Product | Type | Pricing | Notes |
|---|---|---|---|
| Cloudbeds | Hotel PMS | $100-500/mo per property | Established, expensive |
| Opera PMS | Hotel PMS | Enterprise pricing | Oracle, hotels only |
| QloApps | Open-source PMS | Free (hosting costs) | PHP, outdated UI |
| Little Hotelier | Hotel PMS | $100+/mo | Small hotels |
| Booking.com Manager | Channel Manager | Commission-based | Not a full PMS |
| HubSys | Hotel PMS | Enterprise | Large hotels |
| Kamra PMS | Open-source PMS | Free (AGPL-3.0) | Frappe-based, MCP-native |

### Gap Analysis
- **No African-focused AI receptionist SaaS exists**
- **No multi-vertical AI business assistant for SMEs**
- Traditional PMS are expensive, complex, desktop-based
- Existing AI chatbots are bolted-on, not native to hospitality workflows
- Opportunity: build for Cameroon/Africa first, then expand

---

## 2. Open-Source Components Evaluated

### Selected for Integration

1. **PocketBase (MIT)** — Database/backend. Single Go binary, SQLite, realtime, auth. Perfect for MVP.
2. **Evolution API (Apache 2.0)** — WhatsApp gateway for production. Multi-tenant, Baileys + Meta Cloud API.
3. **WAHA (Apache 2.0)** — WhatsApp Web engine for dev/demo mode.

### Selected for Study/Adaptation

4. **DeskcommCRM (MIT)** — Best multi-tenant CRM architecture with AI agents, RAG, MCP. Patterns: tenant isolation, intent router, dual WhatsApp, audit log.
5. **Hiberius/whatsapp-receptionist (MIT)** — Best-in-class Next.js + multi-tenant architecture. Patterns: RLS isolation testing, GDPR, human escalation, webhook reliability.
6. **martin-minghetti/whatsapp-ai-receptionist (MIT)** — Clean FastAPI + Claude. Patterns: simple orchestration, config-driven, date handling.

### Rejected

7. **Kamra PMS (AGPL-3.0)** — AGPL copyleft incompatible with proprietary SaaS. Studied MCP tool design only.
8. **n8n (Fair-code)** — SaaS resale restriction. Rejected for core platform.
9. **NocoDB (Fair-code)** — Same fair-code issue.
10. **Supabase (Apache 2.0)** — Banned by user.

---

## 3. Database Comparison

| Criteria | PocketBase | PostgreSQL | Appwrite | Supabase (banned) |
|---|---|---|---|---|
| License | MIT | PostgreSQL License | BSD-3 | Apache 2.0 |
| Self-hosted | ✅ (binary) | ✅ | ✅ (Docker) | ✅ |
| Multi-tenant | Via app logic | Via RLS | Via app logic | Via RLS |
| Windows dev | ✅ | ✅ (Docker/WSL) | ✅ (Docker) | ✅ |
| Realtime | ✅ | ✅ (pg_notify) | ✅ | ✅ |
| Search/RAG | External | pgvector | External | pgvector |
| Auth | Built-in | Manual | Built-in | Built-in |
| Setup difficulty | Easy | Medium | Medium (Docker) | Medium |
| Migration path | → PostgreSQL | — | — | — |
| Commercial use | ✅ | ✅ | ✅ | ✅ |

**Recommendation**: PocketBase for MVP, migrate to PostgreSQL for production. Migration designed into architecture from day one.

---

## 4. Infrastructure Options

### Development
- Local PC (Windows 11, i7, 16GB RAM)
- Node.js + npm already installed
- Docker available
- No VPS needed

### Production (per hotel)
| Option | Cost/Month | Notes |
|---|---|---|
| Hotel PC (existing) | $0 | Best for single hotel |
| Hetzner CX21 VPS | $5 | EU hosting, reliable |
| OVH Starter | $7 | Africa-friendly |
| DigitalOcean Basic | $24 | More expensive |

**Recommendation**: Start on hotel owner's PC, migrate to VPS when needed.

---

## 5. Key Licensing Findings

1. **AGPL-3.0 is a hard blocker** for any code we incorporate into our SaaS. Kamra PMS cannot be forked.
2. **MIT/Apache 2.0/BSD-3** are all safe for commercial use.
3. **Fair-code licenses** (n8n, NocoDB) restrict SaaS resale — avoid for core platform.
4. **Apache 2.0 trademark clauses** (Evolution API) require attribution but don't restrict use.

---

## 6. AI Model Strategy

### Free Tier (MVP)
- OpenRouter free models (LLaMA, Mistral) for classification/intent
- DeepSeek free credits for conversation

### Production
- **Primary**: DeepSeek V3 ($0.07/1M input tokens)
- **Fallback**: Claude Haiku 3.5 ($0.80/1M input tokens)
- **Local**: Ollama (when GPU available)

### Why this matters
At 500 conversations/month × 2K tokens avg:
- DeepSeek: $0.11/month per hotel
- Claude Haiku: $2.40/month per hotel
- **Cost is negligible**, focus on quality

---

## 7. Commercial Validation

### Pricing Hypothesis
- **Setup**: 150,000-300,000 FCFA (~$250-500)
- **Monthly**: 6,000-12,000 FCFA/hotel (~$10-20)
- **Margin**: ~85% at normal usage

### Competitive Position
- 5-10x cheaper than international PMS ($100-500/mo)
- Cheaper than traditional Cameroonian IT services
- First-mover in AI receptionist for African hotels

### Risk Factors
- Meta WhatsApp pricing changes (quarterly reviews)
- Free AI tier changes
- Requires internet connectivity
- Hotel owner tech literacy varies

---

## 8. Conclusion

The research validates the project is feasible:
1. Open-source foundations exist to study (not copy directly)
2. Infrastructure costs are extremely low
3. Legal/licensing path is clear (MIT + Apache 2.0 only)
4. Commercial model is defensible
5. Technical stack is mature and Windows-compatible

**Next step**: Begin MVP implementation.
