# No-Card Hosting Research — Final Report
## AI Business Operating System

**Date**: 2026-09-29  
**Commit**: `6f81c0f` | Branch: `main` | Working tree: clean  
**Project path**: `D:\HERMES AGENT\AI Business Operating System`

---

## Executive Summary

The application is a lightweight Node.js/TypeScript monolith using **built-in `node:sqlite`**, zero runtime dependencies, ~350 MB Docker image, and no background workers. The primary deployment blocker is **persistent storage for SQLite** — every free Docker/PaaS host provides an ephemeral filesystem. Two truly free, no-card options exist:

1. **Render (free) + Turso (free)** — cloud-hosted, requires ~1 file change (`src/db/client.ts`)
2. **Cloudflare Quick Tunnel** — instant public URL from your PC, zero code changes, but PC must stay on

Both cost $0/month, require no credit card, and get the app publicly accessible today.

---

## Current Application Requirements (Verified from Codebase)

| Attribute | Value |
|---|---|
| Runtime | Node.js 24+, TypeScript via `--experimental-strip-types` |
| Dependencies | **None at runtime** (only devDependencies: `@types/node`, `tsx`, `typescript`) |
| Port | `8080` (configurable via `PORT` env var) |
| Database | SQLite via `node:sqlite` (built-in, no native compilation) |
| DB file location | `$DATA_DIR/frontdesk.db` (defaults to `./data/frontdesk.db`) |
| Session storage | In-memory (survives restart; lost on crash) |
| Health endpoint | `GET /api/health` → `{"ok":true}` |
| Auth flow | Cookie-based sessions, scrypt password hashing |
| Customer widget | Public endpoints: `POST /api/widget/chat`, `GET /api/businesses/:slug/branding` |
| Docker image size | ~357 MB (multi-stage, `node:24-alpine` base) |
| Test suite | 26/26 passing |
| TypeScript | Clean (`tsc --noEmit` exit 0) |
| GitHub | Public, `main` branch, `6f81c0f` (clean, synced with origin) |

**Key architectural constraint**: The app writes to a local SQLite file at runtime. Any hosting platform that provides an **ephemeral filesystem** will lose all data on restart/redeploy. This is the single most important factor in choosing a hosting strategy.

---

## Platform-by-Platform Analysis (September 2026)

### Tier 1: Truly Free, No Credit Card Required ✅

#### 1. Render — Free Web Service

| Criteria | Detail |
|---|---|
| Credit card | ❌ **Not required** for free tier signup |
| Free tier | 750 instance-hours/month (enough for ~1 always-on service) |
| Docker support | ✅ Full Dockerfile support |
| GitHub deploy | ✅ Automatic on push to selected branch |
| Persistent storage | ❌ **Ephemeral filesystem only on free tier** |
| Free database | PostgreSQL 1 GB — **expires after 30 days** (deleted after 14-day grace) |
| Sleep behavior | Spins down after **15 minutes** of inactivity; ~1 min cold start |
| RAM / CPU | 512 MB / 0.1 vCPU |
| Bandwidth | 100 GB/month included |
| Custom domain | ✅ Free (TLS auto-provisioned) |
| Commercial use | ✅ Allowed on free tier |
| Cameroon access | ✅ No geographic restrictions documented |
| Cost | **$0/month** |

**SQLite verdict: UNSAFE** — filesystem is ephemeral. All data lost on deploy/restart. Must migrate to external DB.

**Source**: [render.com/docs/free](https://render.com/docs/free), [render.com/pricing](https://render.com/pricing)

---

#### 2. Turso (libSQL) — Free Database Only

| Criteria | Detail |
|---|---|
| Credit card | ❌ **Not required** — email or GitHub login |
| Free tier | **Indefinite** — no expiry, no trial clock |
| Storage | **5 GB total** across all databases |
| Reads | 500M rows/month |
| Writes | 10M rows/month |
| Databases | Up to 100 per account |
| SQLite compatibility | ✅ **Drop-in replacement** — libSQL is a fork of SQLite with MVCC concurrent writes |
| Node.js SDK | ✅ `@libsql/client` NPM package |
| Edge locations | NA, EU, APAC |
| Commercial use | ✅ Allowed |
| Overages | Requests fail (hard cap), no surprise charges |
| Cameroon access | ✅ API is global, no geo-restrictions |
| Cost | **$0/month** |

**Assessment**: The ideal companion to any free host. Your existing SQL queries work unchanged. Migration requires only replacing the `node:sqlite` import with `@libsql/client` and passing the connection string. No schema changes needed for standard CRUD operations.

**Source**: [turso.tech/pricing](https://turso.tech/pricing)

---

#### 3. Cloudflare Quick Tunnel (TryCloudflare)

| Criteria | Detail |
|---|---|
| Credit card | ❌ **Not required at all** — no account needed |
| Account | None required for quick tunnel |
| How it works | `cloudflared tunnel --url http://localhost:8080` creates a random `*.trycloudflare.com` URL |
| HTTPS | ✅ Automatic via Cloudflare edge |
| Persistent storage | ✅ **Your local disk** — SQLite persists normally |
| PC requirement | **Must remain on and connected** |
| Concurrency limit | 200 in-flight requests per tunnel |
| SSE support | ❌ Not supported on quick tunnels |
| Custom domain | ❌ Random subdomain only (named tunnels require Cloudflare account + domain) |
| Stability |隧道 can drop; URL changes per restart |
| Cost | **$0/month** |
| Suitability | **Demo/pilot only** — not production-grade |

**Source**: [developers.cloudflare.com/cloudflare-one/.../trycloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/index.md)

---

#### 4. Cloudflare Workers + D1 (Serverless Rewrite — Requires Architecture Change)

| Criteria | Detail |
|---|---|
| Credit card | ❌ Not required for Workers Free plan |
| Free tier | 100K requests/day, 10ms CPU/request, 5 GB D1 storage |
| Architecture | Requires rewriting the app as a Worker (event-driven, no long-running process) |
| SQLite equivalent | D1 (serverless SQLite) — compatible but not identical |
| Current app fit | ❌ **Major rewrite required** — monolithic Express-style server incompatible with Workers model |
| Cost | $0/month (free tier) |

**Verdict**: Technically free and robust, but would require a complete architectural rewrite. Not recommended unless you want to re-architect.

**Source**: [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [blog.krispyai.com/self-hosting-on-cloudflare-2026](https://blog.krispyai.com/self-hosting-on-cloudflare-2026)

---

#### 5. SnapDeploy — Free Container Hosting

| Criteria | Detail |
|---|---|
| Credit card | ❌ **Not required** — GitHub or email signup |
| Free tier | 10 deploys/day, up to 4 containers, 512 MB RAM each |
| Docker support | ✅ Native — detects Dockerfile automatically |
| GitHub deploy | ✅ Auto-deploys on push |
| Persistent storage | ❌ **Ephemeral** — data lost on redeploy/sleep |
| Sleep behavior | Auto-sleep after ~45 min idle; 10–30s wake time |
| RAM / CPU | 512 MB / 0.25 vCPU per container |
| Custom domain | ❌ Always-On plan only ($12/mo+) |
| Commercial use | ✅ Allowed |
| Cameroon access | Unclear — no published restrictions, but limited documentation |
| Cost | **$0/month** (free tier) |

**SQLite verdict: UNSAFE** — same ephemeral filesystem problem as Render. Would need external DB.

**Source**: [snapdeploy.dev/free-container-hosting](https://snapdeploy.dev/free-container-hosting), [snapdeploy.dev](https://snapdeploy.dev/)

---

### Tier 2: Credit Card Required ❌ (Eliminated)

| Platform | Why Eliminated |
|---|---|
| **Fly.io** | Free tier removed Oct 2024; new accounts get 2-hour trial then require card. Usage-based billing kicks in immediately after. |
| **Railway** | $5 one-time credit + $1/mo ongoing. Card required once credits deplete (~1–2 weeks for always-on). Services pause when credits exhausted. |
| **Koyeb** | $29/mo minimum for Pro plan. Free web service tier removed Feb 2026 (acquisition by Mistral AI). Free Postgres DB only (5 hrs/mo runtime). |
| **Oracle Cloud Always Free** | Credit/debit card **required** for identity verification at signup. ARM instances (2 OCPU/12 GB) are excellent but inaccessible without a card. |
| **Google Cloud Run** | Requires linked billing account (credit card) even for free tier (180K vCPU-sec/mo). |
| **Supabase** | Free tier exists (500 MB DB, 2 projects) but **auto-pauses after 7 days of inactivity**. Also requires card for any paid feature. |
| **Hugging Face Spaces (Docker)** | Docker Spaces require PRO paid plan. Free tier limited to Gradio/ZeroGPU spaces only. |
| **Aiven** | Free Postgres tier exists but **requires credit card** for signup. Single-node, no HA. |
| **Netlify** | Static/serverless only — cannot run a long-running Node.js process. |
| **Vercel** | Serverless functions only (10s timeout) — cannot run persistent HTTP server. |

---

## Persistence / SQLite Analysis

The critical challenge for this application is **filesystem persistence**:

| Host | Filesystem | SQLite Survives Restart? | Verdict |
|---|---|---|---|
| Render (free) | Ephemeral | ❌ Lost on every deploy/restart | Must use external DB |
| SnapDeploy (free) | Ephemeral | ❌ Lost on every redeploy/sleep | Must use external DB |
| Cloudflare Quick Tunnel | Local disk | ✅ Fully persistent | Works as-is |
| Your own VPS (paid) | Persistent | ✅ Fully persistent | Works as-is |

**Conclusion**: Any free PaaS with ephemeral storage requires an external database. **Turso (libSQL)** is the best match because:
- It is SQLite-compatible (your existing SQL queries work unchanged)
- Free tier: 5 GB, 500M reads/mo, 10M writes/mo — more than enough for a pilot
- No credit card required
- No expiration
- `@libsql/client` is a drop-in replacement for `node:sqlite` in read-heavy workloads

---

## Cloudflare Architecture Deep Dive

### Quick Tunnel (No Account)
- Command: `cloudflared tunnel --url http://localhost:8080`
- Generates random `*.trycloudflare.com` URL
- ⚠️ URL changes on each restart
- ⚠️ PC must stay on
- ⚠️ 200 concurrent request limit
- ✅ Instant, zero setup, zero cost

### Named Tunnel (Cloudflare Account Required, Still No Card)
- Requires a Cloudflare account (free, email-only signup)
- Requires a domain pointed at Cloudflare (can use free tier domain or existing domain)
- Stable URL (`yourapp.yourdomain.com`)
- Same 200 concurrent request limit on free tier
- More reliable than quick tunnel

**For your use case**, the quick tunnel is sufficient for immediate public access during pilot testing. A named tunnel adds stability but requires a domain.

---

## Architecture Options Compared

### OPTION A: Current App + External DB (Turso) + Render Free

```
User → Render free web service (512 MB, spins down after 15 min idle)
     → Turso (libSQL, 5 GB free, no card)
     → Customer widget / Dashboard
```

| Aspect | Detail |
|---|---|
| Cost | $0/month |
| Card required | No |
| Code changes | Minimal — swap `node:sqlite` for `@libsql/client` in `src/db/client.ts` (~15 lines) |
| Persistent data | ✅ Yes (Turso) |
| Uptime | ❌ 15-min idle spin-down on Render free; ~1 min cold start |
| Production ready | Pilot-grade (sleep/wake acceptable for low-traffic pilot) |
| Complex ity | Low |
| Best for | Real pilot with cloud-hosted app |

---

### OPTION B: Cloudflare Quick Tunnel (Immediate, Zero Changes)

```
Your PC (running Docker or Node) → cloudflared → *.trycloudflare.com
                                  → Local SQLite (persistent on your disk)
```

| Aspect | Detail |
|---|---|
| Cost | $0/month |
| Card required | No |
| Code changes | **None** |
| Persistent data | ✅ Yes (local disk) |
| Uptime | Depends on your PC being on and connected |
| Production ready | ❌ Demo/pilot only — single point of failure |
| Complexity | Minimal |
| Best for | Immediate public testing while evaluating Option A |

---

### OPTION C: Current App + SnapDeploy Free + Turso

```
User → SnapDeploy free container (512 MB, 45-min sleep)
     → Turso (libSQL, 5 GB free)
     → Customer widget / Dashboard
```

| Aspect | Detail |
|---|---|
| Cost | $0/month |
| Card required | No |
| Code changes | Same minimal swap as Option A |
| Persistent data | ✅ Yes (Turso) |
| Uptime | ❌ 45-min idle sleep; 10–30s wake |
| Production ready | Pilot-grade |
| Complexity | Low |
| Best for | Alternative to Render if Render has issues |

---

## Cost Analysis

| Component | Platform | Monthly Cost |
|---|---|---|
| Hosting | Render Free / SnapDeploy Free | $0 |
| Database | Turso Free | $0 |
| Domain | — | $0 (subdomain) or ~$10/year (custom) |
| AI/LLM | Demo mode (built-in) | $0 |
| WhatsApp | Not activated | $0 |
| Email (SMTP) | Not configured | $0 |
| **Total** | | **$0/month** |

If you later need 24/7 uptime (remove sleep), paid options start at:
- Render Starter: $7/mo (persistent disk + no sleep)
- SnapDeploy Always-On: $12/mo per container
- Turso Developer: $4.99/mo (9 GB storage, higher limits)

---

## Recommendation

### PRIMARY: Option B → Option A progression

**Phase 1 — Today (immediate public access):**
Run Cloudflare Quick Tunnel from your PC. Zero code changes, zero setup cost, public URL in minutes.

**Phase 2 — This week (proper cloud deployment):**
1. Create a free Turso account → create a database → get connection string
2. Swap `node:sqlite` for `@libsql/client` in `src/db/client.ts` (minimal change)
3. Deploy to Render free tier (or SnapDeploy as fallback)
4. Point environment variables to Turso

This gives you a real cloud-hosted, publicly accessible, persistent-application pilot at $0/month with no credit card.

---

## Exact Next Steps

### For Option B (Quick Tunnel — do this now):
1. Install `cloudflared`: `npm install -g cloudflared` or download from [developers.cloudflare.com/cloudflared](https://developers.cloudflare.com/downloads/)
2. Start your app locally: `npm run dev` (port 3000) or `npm start` (port 8080)
3. In a separate terminal: `cloudflared tunnel --url http://localhost:8080`
4. Share the generated `*.trycloudflare.com` URL

### For Option A (Render + Turso — do this this week):
1. **Turso**: Sign up at [turso.tech](https://turso.tech) (email or GitHub, no card) → Create database → Get `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
2. **Code change** in `src/db/client.ts`: Replace `import { DatabaseSync } from 'node:sqlite'` with `import { createClient } from '@libsql/client'` and wrap the connection in a provider check
3. Add to `.env.example`: `TURSO_DATABASE_URL=` and `TURSO_AUTH_TOKEN=`
4. Install dependency: `npm install @libsql/client`
5. **Render**: Sign up at [render.com](https://render.com) (GitHub login, no card) → New → Web Service → Connect GitHub repo → Select `main` branch → Set env vars → Deploy
6. Verify: `GET /api/health` returns 200, widget chat works, data persists across deploys

---

## Risks

1. **Render free tier spin-down**: 15-minute idle timeout means first visitor waits ~1 minute. Acceptable for pilot; problematic for production.
2. **Turso write limits**: 10M writes/month free — adequate for pilot, monitor if traffic grows.
3. **Quick Tunnel instability**: URL changes on restart; not suitable for sharing a permanent link.
4. **No automated backups**: Neither Render free nor Turso free includes automated backups. You must implement your own backup strategy (e.g., periodic `turso db shell` exports).
5. **Cloudflare Tunnel PC dependency**: If your PC goes offline, the app is unreachable.

---

## Sources

1. [Render Free Tier Docs](https://render.com/docs/free) — verified Sep 2026
2. [Render Pricing](https://render.com/pricing) — verified Sep 2026
3. [Turso Pricing](https://turso.tech/pricing) — verified Sep 2026
4. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/index.md) — last updated Apr 2026
5. [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) — verified Sep 2026
6. [SnapDeploy Free Container Hosting](https://snapdeploy.dev/free-container-hosting) — verified Sep 2026
7. [SnapDeploy](https://snapdeploy.dev/) — verified Sep 2026
8. [Supabase Billing FAQ](https://supabase.com/docs/guides/platform/billing-on-supabase) — verified Sep 2026
9. [Hosting Free Tier Comparison 2026](https://agentdeals.dev/hosting-free-tier-comparison-2026) — verified Sep 2026
10. [Every Free Hosting Provider Side-by-Side](https://flaviocopes.com/hosting-free-tiers/) — verified Sep 2026
11. [Fly.io Billing](https://fly.io/docs/about/billing) — verified Sep 2026
12. [Fly.io Free Tier Community Discussion](https://community.fly.io/t/understanding-the-free-tier/17405) — Dec 2023 / updated 2026
13. [Koyeb Pricing FAQ](https://www.koyeb.com/docs/api/v1/get-/pricing) — Feb 2026 (acquisition by Mistral AI)
14. [Zeabur Free Plan](https://zeabur.com/docs/en-US/pricing/free-plan) — last updated Jun 2026
15. [Oracle Cloud Always Free 2026 Guide](https://metamorphosis.com.bd/insights/oracle-cloud-always-free-hosting-guide) — 2026
16. [Google Cloud Run Free Tier](https://cloud.google.com/run/pricing) — verified Sep 2026
17. [Hugging Face Spaces Overview](https://huggingface.co/docs/hub/spaces-overview) — verified Sep 2026
18. [Hugging Face Spaces Storage](https://huggingface.co/docs/hub/main/spaces-storage) — verified Sep 2026
19. [Self-Hosting on Cloudflare 2026](https://blog.krispyai.com/self-hosting-on-cloudflare-2026) — verified Sep 2026
20. [Claude Code + Turso Guide](https://claudify.tech/blog/claude-code-turso) — 2026
21. [Raivo Ottó — Best free hosting without credit card 2026](https://raivooner.com/best-free-hosting-without-credit-card-2026/) — Jan 2026

---

*Report generated by Hermes Agent. No accounts created. No code modified. No deployments made.*
