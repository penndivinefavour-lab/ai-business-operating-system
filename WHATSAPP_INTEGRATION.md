# WhatsApp Integration

## Options Analysis

### 1. Official WhatsApp Cloud API (Meta)

**License**: Free (Meta platform terms)
**Reliability**: Official, supported by Meta
**Multi-tenancy**: Yes (multiple phone numbers per Business Manager)
**Operational Complexity**: Medium (requires Meta Business Verification)

**Pros:**
- Official Meta solution, highest reliability
- No third-party dependencies
- Good documentation and support
- Free for businesses (pay per conversation after free tier)

**Cons:**
- Requires Meta Business Verification (can be slow)
- Phone number must be dedicated (can't use personal WhatsApp)
- WhatsApp session-based QR connection NOT supported (cloud-only)
- Requires Facebook Business Manager setup

**Implementation Status**: Adapter exists in `src/channels/whatsapp.ts` and `src/channels/index.ts`

### 2. Evolution API (Open Source)

**License**: MIT (some versions AGPL-3.0)
**Reliability**: Community-maintained, good for prototyping
**Multi-tenancy**: Yes (multiple instances)
**Operational Complexity**: Medium (requires Docker + QR scanning)

**Pros:**
- QR-based connection (any WhatsApp number)
- Self-hosted, full control
- Works with regular WhatsApp (not Business API)
- Good for prototyping and MVP

**Cons:**
- Not official (risk of WhatsApp banning)
- Requires QR re-scanning periodically
- Less reliable than official API
- Instance management overhead

**Decision**: Available as alternative, but Cloud API recommended for production

### 3. Baileys (WhatsApp Web JS)

**License**: MIT (unofficial)
**Reliability**: Unofficial, frequent breaking changes
**Multi-tenancy**: Yes
**Operational Complexity**: High (QR management, session persistence)

**Pros:**
- Works with any WhatsApp number
- Full WhatsApp Web protocol

**Cons**:
- Unofficial (high ban risk)
- Breaks frequently with WhatsApp updates
- Session management complex

**Decision**: Not recommended for production SaaS

## Recommendation

For the AI Business Operating System:

1. **MVP/Testing**: Use Evolution API (QR-based, easy to test)
2. **Production**: Use Official Cloud API (Meta-verified, reliable)

The channel abstraction layer supports both simultaneously.

## Implementation

### Inbound Webhook (Cloud API)
```
POST /api/webhooks/whatsapp
- Verifies X-Hub-Signature-256
- Normalizes payload to UserMessage
- Routes to orchestrator
```

### Outbound (Cloud API)
```
POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages
- Standard Cloud API message delivery
- Within 24h service window
- Template messages for outside window
```

### Security
- Webhook signature verification (HMAC-SHA256)
- Webhook token validation (GET verify)
- Idempotency via message deduplication
- Rate limiting
- No secrets exposed to customers
