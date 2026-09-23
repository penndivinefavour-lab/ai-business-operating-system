# Security — AI Business Operating System

---

## 1. Secrets Management

- **NEVER** hardcode API keys, tokens, or secrets in source code
- All secrets via environment variables (`.env` files)
- `.env.example` documents required variables (without real values)
- `.env` and `.env.local` are in `.gitignore`
- Production secrets via Docker secrets or VPS environment

## 2. Authentication & Authorization

- **Dashboard**: Session-based auth (httpOnly cookies)
- **API**: Bearer token (JWT or API key)
- **Roles**: super_admin, tenant_admin, staff, viewer
- **Tenant isolation**: Every query filtered by tenant_id
- **Permission boundaries**: Tools declare what they can execute

## 3. Tenant Isolation

- All database queries include `tenant_id` filter
- Row-level security (when on PostgreSQL)
- Per-tenant API keys (encrypted at rest)
- Cross-tenant admin reads bypass RLS via dedicated service
- Tests verify tenant isolation

## 4. AI-Tool Permissions

Tools have explicit permission declarations:

```typescript
const checkAvailabilityTool = {
  name: 'check_availability',
  permissions: ['read:rooms', 'read:bookings'],
  // Can ONLY query availability, cannot modify data
};
```

- AI can only call tools within its permission scope
- Tools validate all inputs (Zod)
- AI cannot directly execute arbitrary database operations

## 5. Audit Logs

- Append-only table (no updates or deletes)
- Every business operation logged: who, what, when, tenant_id
- AI actions tagged with `actor: 'ai'`
- Human actions tagged with `actor: 'human:<user_id>'`
- System actions tagged with `actor: 'system'`

## 6. PII/Customer Data

- Customer phone/email encrypted at rest
- Automatic PII redaction in logs
- GDPR-inspired data retention (configurable per tenant)
- Right to export (customer data download)
- Right to deletion (anonymization preferred over delete)

## 7. WhatsApp Security

- Webhook signature verification (HMAC)
- Per-tenant API keys encrypted at rest
- Rate limiting per tenant
- Message content not logged (only metadata)

## 8. Backup & Recovery

- Daily automated backups (PocketBase: file copy; PostgreSQL: pg_dump)
- Off-site backup storage (S3/MinIO)
- Backup encryption
- Restore testing procedure documented
- RPO: 24 hours, RTO: 4 hours

## 9. Production Security Checklist

- [ ] HTTPS everywhere (TLS 1.3)
- [ ] CORS restricted to dashboard origin
- [ ] Rate limiting on all API endpoints
- [ ] Input validation on all external inputs
- [ ] Dependency audit (npm audit, no critical vulns)
- [ ] CSP headers
- [ ] HSTS enabled
- [ ] Security headers (X-Frame-Options, X-Content-Type-Options)
- [ ] Database backups encrypted
- [ ] Monitoring/alerting for anomalies
