# Cost Model — AI Business Operating System

Date: 2026-09-23
Currency: USD (1 USD ≈ 600 FCFA approximately)

---

## INFRASTRUCTURE ASSUMPTIONS

- **MVP/Single Hotel**: Self-hosted on hotel owner's existing PC or cheap VPS
- **SaaS Multi-Tenant**: Single VPS running Docker, serving multiple hotels
- **Database**: PocketBase (SQLite) for MVP → PostgreSQL for production scale
- **WhatsApp**: Meta Cloud API for production; WAHA/Baileys for dev/demo
- **AI**: Mix of free-tier APIs + paid fallback

---

## FIXED COSTS (Monthly, Per Server/VPS)

| Tier | Specs | Cost/Month | Who |
|---|---|---|---|
| **Dev/Prototype** | Hotel PC, no VPS | $0 | Single hotel demo |
| **Small VPS** | 2 vCPU, 4GB RAM, 80GB SSD | $6-12 | 1-5 hotels |
| **Medium VPS** | 4 vCPU, 8GB RAM, 160GB SSD | $24-36 | 5-20 hotels |
| **Large VPS** | 8 vCPU, 16GB RAM, 320GB SSD | $48-72 | 20-50 hotels |

**Cheap VPS Options (verified pricing):**
- Hetzner Cloud CX21: 2 vCPU, 4GB, €4.51/mo (~$5)
- Hetzner CPX21: 4 vCPU, 8GB, €8.21/mo (~$9)
- DigitalOcean Basic: 2 vCPU, 4GB, $24/mo
- Vultr Cloud: 2 vCPU, 4GB, $20/mo
- Scaleway DEV1-M: 4 vCPU, 8GB, €15.99/mo (~$17)
- OVH Starter: 2 vCPU, 4GB, €6.50/mo (~$7)

**Recommended**: Hetzner for EU-hosted, OVH for Africa-friendly (Cameroon→France latency ~80ms).

---

## PER-HOTEL COSTS (Monthly)

### 1. WhatsApp Messaging (Meta Cloud API, effective July 2025)

Per-message pricing (not per-conversation). Cameroon country code +232.

**Free messages (within 24h customer service window):**
- Text messages: FREE
- Image/video/audio: FREE
- Utility templates within CSW: FREE
- Free entry point window (72h): FREE for all messages

**Paid messages:**
| Message Type | Rate (USD) | Source |
|---|---|---|
| Marketing template | ~$0.0248 | Plivo Cameroon rate (verified) |
| Utility template (outside CSW) | ~$0.005-0.03 | Varies by volume tier |
| Authentication template | ~$0.008-0.03 | Varies by volume tier |

**Realistic monthly estimate per hotel (moderate use):**
- 500 conversations/month, avg 4 messages each = 2,000 messages
- 1,800 free (within CSW) + 200 paid follow-up/utility templates
- **Cost: ~$1-6/month per hotel**

### 2. AI Model API

**Free options for MVP:**
| Provider | Free Tier | Quality |
|---|---|---|
| OpenRouter (free models) | Unlimited free models (LLaMA, Mistral) | Good for classification/intent |
| Groq | Free tier (rate limited) | Fast inference, good quality |
| DeepSeek | Free credits at launch | Strong reasoning |
| Together AI | $5 free credits | Good for chat |

**Paid fallback (production):**
| Provider | Cost per 1M tokens | Use Case |
|---|---|---|
| DeepSeek V3 | ~$0.07 input / $0.28 output | Main conversation AI |
| Claude Haiku 3.5 | ~$0.80 input / $4.00 output | Fast, cheap, good quality |
| GPT-4o-mini | ~$0.15 input / $0.60 output | Reliable, fast |

**Estimated per hotel (500 conversations × 2K tokens avg):**
- 1M tokens/month input + 200K output
- DeepSeek: ~$0.11/month
- Claude Haiku: ~$2.40/month
- GPT-4o-mini: ~$0.27/month
- **Using free tier: $0/month**
- **Using paid (normal use): $1-3/month per hotel**

### 3. Voice/Transcription

**Free for MVP** (no voice in demo mode).
**Paid (production):**
- OpenAI Whisper API: $0.006/min → ~$3/month per hotel (500 mins)
- DeepSeek Voice: TBD pricing

### 4. Email

- Resend: Free tier 100 emails/day (3,000/month)
- AWS SES: $0.10 per 1,000 emails
- **Per hotel: $0-0.50/month**

### 5. Object Storage

- MinIO (self-hosted): $0 (part of VPS)
- Cloudflare R2: Free 10GB, then $0.015/GB
- **Per hotel: $0-0.50/month**

### 6. Monitoring

- Uptime Kuma (self-hosted): $0
- Grafana Cloud: Free tier 10K metrics
- **Per hotel: $0/month**

---

## TOTAL COST SUMMARY

### Scenario 1: LOW USAGE (Small hotel, 200 conversations/month)

| Hotels | VPS | WhatsApp | AI (free) | Other | **TOTAL/MO** | **Per Hotel** |
|---|---|---|---|---|---|---|
| 1 | $0 (hotel PC) | $0.50 | $0 | $0 | **$0.50** | $0.50 |
| 5 | $6 | $2.50 | $0 | $0 | **$8.50** | $1.70 |
| 10 | $12 | $5.00 | $0 | $0 | **$17.00** | $1.70 |
| 50 | $48 | $25.00 | $0 | $0 | **$73.00** | $1.46 |

### Scenario 2: NORMAL USAGE (Moderate hotel, 500 conversations/month)

| Hotels | VPS | WhatsApp | AI (DeepSeek) | Other | **TOTAL/MO** | **Per Hotel** |
|---|---|---|---|---|---|---|
| 1 | $0 | $3.00 | $0.11 | $0 | **$3.11** | $3.11 |
| 5 | $6 | $15.00 | $0.55 | $1 | **$22.55** | $4.51 |
| 10 | $12 | $30.00 | $1.10 | $2 | **$45.10** | $4.51 |
| 50 | $48 | $150.00 | $5.50 | $10 | **$213.50** | $4.27 |

### Scenario 3: HIGH USAGE (Busy hotel, 2,000 conversations/month)

| Hotels | VPS | WhatsApp | AI (Claude Haiku) | Voice | Other | **TOTAL/MO** | **Per Hotel** |
|---|---|---|---|---|---|---|---|
| 1 | $0 | $12.00 | $9.60 | $12 | $2 | **$35.60** | $35.60 |
| 5 | $12 | $60.00 | $48.00 | $60 | $10 | **$190.00** | $38.00 |
| 10 | $24 | $120.00 | $96.00 | $120 | $20 | **$380.00** | $38.00 |
| 50 | $72 | $600.00 | $480.00 | $600 | $100 | **$1,852.00** | $37.04 |

---

## COMMERCIAL HYPOTHESIS VALIDATION

**Target**: 300,000 FCFA setup (~$500) + recurring monthly maintenance

**Proposed pricing model (defensible):**

| Component | 1 Hotel | 5 Hotels | 10 Hotels | 50 Hotels |
|---|---|---|---|---|
| **Setup/Implementation** | $300-500 | $500-1,000 | $1,000-2,000 | $3,000-5,000 |
| **Monthly SaaS** | $15-25 | $40-60 | $75-120 | $300-500 |
| **Monthly per hotel** | $15-25 | $8-12 | $7.50-12 | $6-10 |
| **Margin (normal usage)** | ~85% | ~85% | ~85% | ~90% |

**Key insight**: At normal usage, our cost per hotel is $4-5/month. Selling at $10-15/month leaves healthy margin while remaining affordable for Cameroonian hotels. The initial setup fee covers our time for onboarding, customization, and knowledge base setup.

**Pricing in FCFA:**
- Setup: 150,000-300,000 FCFA (~$250-500)
- Monthly: 6,000-12,000 FCFA/hotel (~$10-20)
- 5-hotel package: 25,000 FCFA/month (~$42)
- 10-hotel package: 45,000 FCFA/month (~$75)

This is competitive against:
- Traditional PMS: $50-200/month per hotel
- International SaaS: $100-500/month per hotel
- Our price: 5-10x cheaper, tailored for Cameroon/Africa

---

## EXTERNAL CREDENTIALS REQUIRED FOR PRODUCTION

| Service | Cost | When Needed |
|---|---|---|
| Meta WhatsApp Business Account | Free (per-message charges apply) | Production WhatsApp |
| Meta Business Verification | Free | Production WhatsApp |
| Domain name | $8-12/year | Production deployment |
| VPS (Hetzner/OVH) | $6-72/month | Production hosting |

**No credentials required for MVP/demo mode** (demo mode simulates everything locally).

---

## RISK FACTORS

1. **WhatsApp pricing changes**: Meta updates quarterly. 1 month notice for rate changes.
2. **Free AI tier changes**: Could shift to paid. Mitigation: multi-provider adapter.
3. **SQLite scaling limit**: PocketBase → PostgreSQL migration needed at ~20-50 hotels. Designed for this.
4. **Voice costs**: $12/month per hotel at high usage is significant. Defer to v2.
5. **FX risk**: FCFA/USD fluctuations. Price in FCFA for local stability.
