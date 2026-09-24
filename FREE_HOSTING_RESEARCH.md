# Free Hosting Options Research

## Overview

This document evaluates genuinely free hosting options for the AI Business Operating System, a Node.js/Docker multi-tenant SaaS with SQLite persistence.

Requirements:
- Persistent HTTP server (24/7 or near-24/7)
- Public endpoint (HTTPS preferred)
- Persistent storage (database survives restarts)
- ARM64 or x86_64 compatibility
- Zero recurring cost

---

## Option 1: Oracle Cloud Always Free Compute (Chosen if account available)

### Current Limits (as of August 2026, from [Oracle documentation](https://docs.cloud.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm) and [WebProNews](https://webpronews.com/oracle-slashes-always-free-arm-capacity-in-half))

| Resource | Limit |
|----------|-------|
| ARM Compute (Ampere A1) | 2 OCPUs + 12 GB RAM (halved from 4/24 in June 2026) |
| AMD Micro VMs | 2× VM.Standard.E2.1.Micro (1 GB RAM each) |
| Block Storage | 200 GB total |
| Outbound Data | 10 TB/month |
| Idle Reclamation | Instances reclaimed if CPU/network/memory <20% for 7 days |

### Pros
- Most generous permanent free compute tier available
- Persistent VMs with real public IPs
- Supports Docker, Node.js, SQLite natively
- Multiple regions available
- No credit card charges for Always Free resources

### Cons
- Credit card required for verification
- ARM architecture requires ARM64-compatible Docker images (our app is pure JS, so no issue)
- Idle instances can be reclaimed
- "Out of host capacity" errors in popular regions
- Region chosen at signup is permanent

### ARM64 Compatibility
Our application is pure JavaScript (Node.js 24) with SQLite via `node:sqlite` (built into Node.js 24). No native dependencies requiring compilation. Fully compatible with ARM64.

**Verdict**: Best option if an authorized account is available.

---

## Option 2: Google Cloud Always Free (e2-micro)

### Current Limits (from [Google Cloud documentation](https://cloud.google.com/free/docs/free-cloud-features))

| Resource | Limit |
|----------|-------|
| e2-micro VM | 1 instance, ~0.25 vCPU, 600 MB RAM |
| Regions | us-west1, us-central1, us-east1 only |
| Persistent Disk | 30 GB-months HDD |
| Outbound Data | 1 GB/month |
| Duration | Forever (no expiry) |

### Pros
- Genuinely free forever
- x86_64 architecture (no compatibility concerns)
- Persistent disk included

### Cons
- Extremely limited resources (e2-micro has 0.25 vCPU, 600 MB RAM)
- 1 GB/month outbound is very restrictive (our app could exceed this quickly)
- Only US regions
- Credit card required for signup

**Verdict**: Usable but very constrained. 600 MB RAM may be insufficient for Docker + Node.js + workloads.

---

## Option 3: Render Free Tier

### Current Limits (from [Render documentation](https://render.com/docs/free))

| Resource | Limit |
|----------|-------|
| Free web service hours | 750 hours/month |
| RAM | 512 MB per service |
| CPU | 0.1 CPU (fractional) |
| Sleep policy | Spins down after 15 min idle |
| Cold start | 30-60 seconds |
| PostgreSQL | Free for 30 days (then expires) |
| Bandwidth | 5 GB/month |
| Persistent disk | Not available on free tier |

### Pros
- No credit card required
- Easy Docker deployment
- Custom domains with free SSL
- No VM management

### Cons
- **Free services sleep after 15 minutes** (unacceptable for 24/7 SaaS)
- **750 hours/month** (enough for ~1 always-on service, but sleep makes this moot)
- **No persistent disk on free tier** (SQLite data lost on every restart)
- **PostgreSQL expires after 30 days** (must migrate or upgrade)
- **Cold start 30-60 seconds** (poor UX)

**Verdict**: Not suitable for a multi-tenant SaaS requiring persistent data and 24/7 availability.

---

## Option 4: Kaggle Notebooks (NOT suitable for hosting)

### Current Limits (from [Kaggle documentation](https://www.kaggle.com/docs/notebooks))

| Resource | Limit |
|----------|-------|
| Session time | 12 hours (CPU/GPU) |
| RAM | 29-330 GB (depending on accelerator) |
| Disk | 20 GB /kaggle/working (persistent within session) |
| Idle timeout | 20 minutes (interactive), 40 minutes (background) |
| Internet | Available (can install packages, access APIs) |
| Public endpoint | **Not provided** |
| Persistent long-running process | **Not supported** |

### Pros
- Free GPU/TPU compute (useful for AI training)
- Large RAM and disk within sessions
- Persistent /kaggle/working across sessions (with caveats)

### Cons
- **No public HTTP endpoint** (notebooks run in isolated environments)
- **12-hour session limit** (cannot run indefinitely)
- **Idle timeout** (process killed after 20-40 min of inactivity)
- **No stable public URL** (cannot host a web service)
- **Not designed for hosting** (designed for ML experimentation)

### Where Kaggle IS Useful
Kaggle's free compute could be useful for:
- AI model experimentation and benchmarking
- Testing local LLM inference (llama.cpp, Ollama)
- Training/fine-tuning models on free GPUs
- Data processing pipelines

**Verdict**: Completely unsuitable for hosting. Kaggle provides no public HTTP endpoint and sessions are ephemeral.

---

## Final Recommendation

| Provider | Suitability | Reason |
|----------|-------------|--------|
| Oracle Always Free | ✅ Best choice | Real persistent VM, 2 OCPU/12 GB, Docker-compatible |
| Google e2-micro | ⚠️ Usable but tight | Only 600 MB RAM, restrictive bandwidth |
| Render Free | ❌ Not suitable | Sleeps, no persistent disk, data loss |
| Kaggle | ❌ Not suitable | No public endpoint, ephemeral sessions |

**Chosen approach**: Oracle Cloud Always Free Ampere A1 instance (2 OCPU, 12 GB ARM64).

If Oracle account creation is blocked, fallback to Google Cloud e2-micro.

---

## Account Availability

### Current Environment Status
- **Oracle Cloud CLI**: Not installed
- **Google Cloud CLI**: Not installed
- **Existing cloud credentials**: None detected
- **Browser session**: Not available in this environment

### Required User Action
To proceed with deployment, the user needs to:

1. **Create an Oracle Cloud account** at https://cloud.oracle.com/free
   - Requires credit card for verification (no charges for Always Free)
   - Choose a region with ARM capacity (US East, US West, EU Frankfurt, AP Mumbai)
   - Region is permanent for Always Free resources

2. **Install OCI CLI** and authenticate:
   ```bash
   pip install oci-cli
   oci setup config
   ```

3. **Create the ARM instance** (2 OCPU, 12 GB):
   - Ubuntu 24.04 image
   - VM.Standard.A1.Flex shape
   - Assign public IP
   - Add SSH key

4. **Open required ports** in the security list:
   - Port 22 (SSH)
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
   - Port 3000 (app)

5. **Provide SSH access** or authorize deployment via API

### Alternative: User provides server access
If the user already has a server (Oracle, Hetzner, etc.), they can provide:
- SSH connection details
- Or authorize deployment via cloud API keys

---

## Post-Deployment Checklist

Once a server is available:

- [ ] SSH access to the VM
- [ ] Docker installed on the VM
- [ ] Application deployed via docker-compose
- [ ] Health check passing
- [ ] Signup/login tested
- [ ] Two-tenant isolation verified
- [ ] HTTPS configured (Let's Encrypt)
- [ ] Firewall rules applied (ports 80, 443 only)
- [ ] Automated restart configured
- [ ] Database persistence verified across restarts
- [ ] Backups configured (daily)
