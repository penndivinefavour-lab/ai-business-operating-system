# Deployment Architecture

## Production Deployment Guide

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        VPS / Cloud Host                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Nginx      │───▶│  Node App   │───▶│   SQLite    │      │
│  │  (reverse    │    │  (port 3000)│    │  Database   │      │
│  │   proxy +    │    │             │    │  (persistent│      │
│  │   HTTPS)     │    │             │    │   storage)  │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│        │                    │                   │            │
│   :443 HTTPS          :3000 HTTP         /data/frontdesk.db  │
│   (public)            (localhost)        (mounted volume)    │
└─────────────────────────────────────────────────────────────┘
```

### Requirements

- **OS**: Ubuntu 22.04+ / Debian 12+ / Any Linux with Node.js 24+
- **RAM**: 512MB minimum (1GB recommended)
- **Storage**: 1GB+ available
- **Node.js**: Version 24+ (built-in SQLite support)

### Quick Deployment (Docker)

```bash
# Clone repository
git clone https://github.com/penndivinefavour-lab/ai-business-operating-system.git
cd ai-business-operating-system

# Build and run
docker-compose up -d
```

### Manual Deployment

1. **Install Node.js 24+**
2. **Clone and install**: `git clone ... && cd ai-business-operating-system`
3. **Configure**: `cp .env.example .env && nano .env`
4. **Run**: `node --experimental-strip-types src/server.ts`

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 3000 | HTTP port |
| PRODUCTION | No | false | Enable production mode |
| APP_SECRET | Yes (prod) | - | Session signing secret |
| DATABASE_URL | No | frontdesk.db | SQLite database file |
| AI_PROVIDER | No | demo | AI provider (demo/anthropic/openai-compatible) |
| AI_API_KEY | No | - | AI provider API key |
| WHATSAPP_ACCESS_TOKEN | No | - | WhatsApp Cloud API token |
| WHATSAPP_PHONE_NUMBER_ID | No | - | WhatsApp phone number ID |
| SESSION_MAX_AGE_HOURS | No | 24 | Session lifetime |
| COOKIE_SECURE | No | !demoMode | Secure cookie flag |
| CORS_ORIGIN | No | * | Allowed CORS origins |

### Database Persistence

SQLite database is stored at `DATA_DIR/DATABASE_DIR`. For production:

- Mount a persistent volume at `/data`
- Ensure regular backups (daily recommended)
- Use WAL mode for better concurrent performance

### HTTPS Requirements

- Use Nginx or Caddy as reverse proxy
- Configure SSL certificate (Let's Encrypt recommended)
- Set `COOKIE_SECURE=true` when HTTPS is enabled
- Redirect HTTP to HTTPS

### Backup Strategy

```bash
# Daily backup (cron)
cp data/frontdesk.db backups/frontdesk-$(date +%Y%m%d).db

# Weekly full backup
tar -czf backups/weekly-$(date +%Y%m%d).tar.gz data/
```

### Startup/Shutdown

```bash
# Start (foreground)
node --experimental-strip-types src/server.ts

# Start (background with PM2)
pm2 start src/server.ts --name ai-frontdesk

# Graceful shutdown
pm2 stop ai-frontdesk
```

### Rollback Procedure

1. Stop the application
2. Restore previous database backup
3. Deploy previous version: `git checkout <previous-commit>`
4. Restart the application

### Monitoring

- Health check: `GET /api/health`
- Logs: stdout/stderr
- Database: Monitor disk usage

### Scaling Considerations

For high traffic:
- Migrate to PostgreSQL
- Add Redis for session storage
- Use load balancer with multiple instances
- Separate read/write database connections
