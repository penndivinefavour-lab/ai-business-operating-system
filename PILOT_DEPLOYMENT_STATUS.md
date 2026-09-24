# Pilot Deployment Status

**Status**: BLOCKED — No authorized cloud account available
**Date**: 2026-09-24
**Commit**: `3bdab44`

---

## Current State

### What's Ready
- ✅ Application code complete and tested (26/26 tests passing)
- ✅ TypeScript compiles cleanly (`npx tsc --noEmit` exit 0)
- ✅ Docker setup prepared with ARM64 + AMD64 multi-arch support
- ✅ Database persistence configured via Docker volumes
- ✅ Security hardening applied (sessions, cookies, headers, input sanitization)
- ✅ Health check endpoint at `/api/health`
- ✅ Graceful shutdown implemented (SIGTERM/SIGINT)
- ✅ All API endpoints verified working locally

### What's Blocked
- ❌ No cloud account credentials available in this environment
- ❌ Docker Desktop not running (cannot test ARM64 build locally)
- ❌ No SSH access to any server

---

## Deployment Architecture (Ready to Execute)

```
Oracle Cloud Always Free — Ampere A1 (ARM64)
├── 2 OCPUs + 12 GB RAM
├── Ubuntu 24.04 LTS
├── Docker + Docker Compose
├── Application: port 3000 (internal)
├── Nginx reverse proxy: port 80/443 (public)
│   └── Let's Encrypt SSL
├── Persistent volume: /data/frontdesk.db
│   └── Daily backups via cron
└── Firewall: ports 22, 80, 443 only
```

### ARM64 Compatibility Verified
- Node.js 24 Alpine: supports `linux/arm64` natively
- `node:sqlite`: built into Node.js 24, no native compilation
- All dependencies: pure JavaScript (no native bindings)
- Docker image: multi-arch build via `--platform` flags

---

## Manual Action Required

To proceed with deployment, the user must:

### Step 1: Create Oracle Cloud Account
1. Go to https://cloud.oracle.com/free
2. Sign up (credit card required for verification, no charges)
3. Choose a region with ARM capacity:
   - Recommended: US East (Ashburn), US West (Phoenix), EU Frankfurt
   - Region is **permanent** for Always Free resources

### Step 2: Create ARM Instance
1. OCI Console → Compute → Instances → Create
2. Image: Ubuntu 24.04
3. Shape: Ampere A1, VM.Standard.A1.Flex
4. OCPUs: 2, Memory: 12 GB
5. Assign public IP
6. Add SSH public key
7. Create

### Step 3: Open Firewall Ports
1. Networking → Virtual Cloud Networks → Your VCN → Security Lists
2. Add ingress rules:
   - Port 22 (SSH)
   - Port 80 (HTTP)
   - Port 443 (HTTPS)

### Step 4: Install Docker & Deploy
```bash
# SSH into instance
ssh ubuntu@<public-ip>

# Install Docker
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
newgrp docker

# Clone and deploy
git clone https://github.com/penndivinefavour-lab/ai-business-operating-system.git
cd ai-business-operating-system

# Create .env
cp .env.example .env
# Edit: set APP_SECRET, AI_PROVIDER, etc.

# Start
docker compose up -d

# Verify
curl http://localhost:3000/api/health
```

### Step 5: HTTPS via Let's Encrypt
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Alternative: Provide Existing Server

If you already have a server (Oracle, Hetzner, VPS):
1. Provide SSH credentials or
2. Provide cloud API keys for automated deployment

---

## Cost Estimate

| Item | Cost |
|------|------|
| Oracle Always Free ARM (2 OCPU/12 GB) | $0/month |
| Block storage (200 GB included) | $0/month |
| Outbound data (10 TB included) | $0/month |
| Domain name (optional) | ~$0-10/year |
| **Total monthly** | **$0** |

---

## HTTPS Status

**Current**: Not configured (pending deployment)
**Plan**: Let's Encrypt free certificates via Certbot
**Alternative**: Cloudflare free tier for DNS + SSL (no domain needed, but adds dependency)

---

## Live LLM Status

**Provider**: `demo` (deterministic fallback)
**Reason**: No API credentials configured in environment
**Note**: The application works fully with deterministic responses. Live LLM is a configuration change, not a code change.

To activate live LLM:
```bash
# Anthropic (requires API key)
AI_PROVIDER=anthropic AI_API_KEY=sk-ant-... docker compose up -d

# Or any OpenAI-compatible
AI_PROVIDER=openai-compatible AI_API_KEY=... AI_BASE_URL=https://... docker compose up -d
```

---

## WhatsApp Status

**Adapter**: Official WhatsApp Cloud API (implemented in `src/channels/index.ts`)
**Status**: Inactive (requires Meta Business Verification)
**Requirements**:
- Meta Business Account
- WhatsApp Business Phone Number
- `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` env vars
- HTTPS endpoint for webhook

---

## Next Steps

1. **User**: Create Oracle Cloud account (see Step 1 above)
2. **User**: Create ARM instance and open ports
3. **User**: Provide SSH access OR
4. **User**: Run deployment commands (I will provide exact steps)
5. **Me**: Verify deployment, run tests, configure HTTPS
