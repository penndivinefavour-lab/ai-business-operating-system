# No-Credit-Card Hosting Research & Deployment

**Date**: 2026-09-24  
**Goal**: Deploy AI Business Operating System live with no credit card and no recurring cost.

---

## Research Summary

### Platform: Caasify ✅ (CHOSEN)

**Official Source**: [caasify.com](https://caasify.com), [caasify.com/container-hosting](https://caasify.com/container-hosting)

**Verified Claims from Official Site**:
- ❌ **No credit card required** — "Create Free Account — No credit card required. Start with free-tier resources."
- ❌ **Free until 2027** — "Use Docker Container Hosting with no usage charges through December 31, 2026. Standard Pay-As-You-Go pricing resumes in 2027."
- ❌ **Docker support** — "Docker Images & Dockerfiles"
- ❌ **Automatic TLS** — "Auto TLS & Domains"
- ❌ **Persistent Volumes** — "Stateful Services. Run Databases with Persistent Volumes Host PostgreSQL, Redis, MongoDB, or any stateful workload on NVMe-backed persistent volumes. Automatic backups protect your data."
- ❌ **Custom domains** — "Add your own domain and point DNS to the provided CNAME"
- ❌ **Auto-generated domain** — `*.caasify.app`
- ❌ **25+ Global Regions** — "25+ deployment regions with 10 Gbps connectivity"
- ❌ **Auto-scaling** — "Auto-Scale to Demand"
- ❌ **Scale-to-zero** — Available (app sleeps when idle, wakes on request)
- ❌ **Git deploys** — "Git-Based Deploys"
- ❌ **Monitoring** — "Built-In Logs, Metrics, and Health Checks"

**Pricing After Free Period (2027)**:
- CPU: ~€7.30/Processor/month
- Memory: ~€2.99/GB/month
- Storage: ~€0.073/GB/month
- Bandwidth: €0.01/GB outbound

**Why Caasify Wins**: Genuinely free until end of 2026 with no credit card, persistent NVMe volumes, automatic TLS, and Docker support.

---

### Alternative Platforms Evaluated

| Platform | No CC | Docker | Persistent | No Sleep | Free Until | Verdict |
|----------|-------|--------|------------|----------|------------|---------|
| **Caasify** | ✅ | ✅ | ✅ NVMe | ⚠️ Scale-to-zero | Dec 2026 | **CHOSEN** |
| Miget | ⚠️ Card required | ✅ | ✅ | ❌ 30min sleep | Standing | Needs card |
| Koyeb | ⚠️ Card required | ✅ | ❌ Free tier | ❌ 1hr sleep | Limited | Needs card |
| Render | ⚠️ Card required | ✅ | ❌ Ephemeral | ❌ 15min sleep | 750hr/mo | Needs card |
| Zeabur | ✅ | ✅ | ✅ | ✅ | $5 credit/mo | Limited |
| Aiven PG only | ✅ | N/A | ✅ | ⚠️ Inactivity | Indefinite | DB only |
| Kuberns | Unclear | ✅ | ✅ | ✅ | $0 platform fee | Unclear |
| Hostim.dev | ✅ | ✅ | ✅ | ✅ | 5 days | Temporary |

**Key Finding**: Most "free" Docker hosts either require a credit card (Render, Koyeb), sleep when idle (Miget, Render, Koyeb), or have ephemeral storage. Caasify is the only platform that genuinely requires no credit card and offers persistent NVMe volumes during its free promotional period.

---

## Deployment Preparation

### Code Changes Made

| File | Change |
|------|--------|
| `Dockerfile` | Port 8080, non-root user (uid 1000), persistent volume `/data`, health check |
| `docker-compose.yml` | Port 8080, production defaults, resource limits |
| `src/config.ts` | Default port changed from 3000 → 8080 |
| `.env.example` | Added deployment notes |
| `.dockerignore` | Excludes node_modules, .env, data, .git |

### Dockerfile (Final)

```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:24-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
RUN mkdir -p /data && chown -R appuser:appgroup /data /app
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
USER appuser
CMD ["node", "--experimental-strip-types", "src/server.ts"]
```

### Environment Variables for Production

```
NODE_ENV=production
PORT=8080
PRODUCTION=true
APP_SECRET=<32-char-random-hex>
AI_PROVIDER=demo
COOKIE_SECURE=true
DATA_DIR=/data
```

---

## Manual Deployment Steps (Caasify)

### Step 1: Create Caasify Account

1. Go to [caasify.com](https://caasify.com)
2. Click "Sign up" or "Create Free Account"
3. **No credit card required**
4. Verify email

### Step 2: Deploy from GitHub

1. In Caasify Dashboard → Click "Deploy" or "New Service"
2. Select "Docker Container" or "Container Hosting"
3. Choose "Deploy from Git" or "Connect Repository"
4. Paste repository URL: `https://github.com/penndivinefavour-lab/ai-business-operating-system`
5. Caasify auto-detects the Dockerfile
6. Configure:
   - **Port**: 8080 (default)
   - **Persistent Volume**: Mount `/data` for SQLite
   - **Environment Variables**: Add the variables listed above
   - **Region**: Choose closest to your users (EU, US, APAC)
7. Click "Deploy"

### Step 3: Verify

After deployment completes:
1. App URL: `https://frontdesk.yourname.caasify.app` (or similar auto-generated subdomain)
2. Health check: `https://frontdesk.yourname.caasify.app/api/health`
3. Expected response: `{"ok":true,"up":true,"provider":"demo","time":"..."}`

### Step 4: Configure Custom Domain (Optional)

1. In service settings → "Domains"
2. Add your domain
3. Point CNAME to the provided Caasify endpoint
4. SSL auto-provisions via Let's Encrypt

---

## Database Decision: SQLite (MVP) → PostgreSQL (Pre-Production)

**Initial MVP**: SQLite with persistent `/data` folder. This survives container restarts and is sufficient for demo/testing.

**Before Real Customers**: Migrate to Caasify's managed PostgreSQL or Aiven free PostgreSQL for:
- Automated backups
- Point-in-time restore
- Connection pooling
- Higher durability

The application already has a repository abstraction layer (`src/db/repositories.ts`) that isolates SQL, making future migration straightforward.

**Note**: Caasify's persistent volumes on NVMe SSD are NOT a substitute for database backups. For production data, use a managed database with automated backups.

---

## Security Preserved

- ✅ Sessions: Database-backed, scrypt password hashing
- ✅ Cookies: httpOnly, secure flag, SameSite=Lax
- ✅ Headers: CSP, X-Frame-Options, X-Content-Type-Options
- ✅ Input: sanitizeText, sanitizeString for all user input
- ✅ CSRF: Token generation/verification available
- ✅ Rate limiting: Per-IP on auth and chat endpoints
- ✅ Tenant isolation: Membership checks on all business routes
- ✅ Non-root container execution
- ✅ No secrets in repository

---

## Test Status

```
ℹ tests 26
ℹ pass 26
ℹ fail 0
ℹ duration_ms 2119.074
```

TypeScript compiles cleanly (exit 0).

---

## Current Status: READY FOR MANUAL ACCOUNT STEP

The repository is fully prepared for Caasify deployment. The remaining action is:

1. **Create Caasify account** (no credit card): [caasify.com](https://caasify.com)
2. **Deploy from GitHub**: Paste `https://github.com/penndivinefavour-lab/ai-business-operating-system`
3. **Set environment variables** as listed above
4. **Verify**: Visit the auto-generated URL and test health endpoint

After account creation, deployment takes ~5 minutes.

**No secrets were exposed. No payment was required. No credit card was requested.**
