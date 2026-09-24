# Channel Architecture

## Overview

The AI Business Operating System uses a channel-agnostic architecture where the core AI employee/orchestrator layer is decoupled from communication channels.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Customer Touchpoints                       │
│  ┌─────────┐  ┌──────────┐  ┌──────┐  ┌─────────┐             │
│  │  Web    │  │ WhatsApp │  │ SMS  │  │  Voice  │  (future)   │
│  │ Widget  │  │  Cloud   │  │      │  │         │             │
│  └────┬────┘  └────┬─────┘  └──┬───┘  └────┬────┘             │
│       │            │           │            │                   │
├───────┼────────────┼───────────┼────────────┼───────────────────┤
│       ▼            ▼           ▼            ▼                   │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              Channel Abstraction Layer                │        │
│  │  • normalizeInbound() → UserMessage                 │        │
│  │  • sendText() → External delivery                  │        │
│  │  • verifyWebhook() → Signature validation           │        │
│  └──────────────────────┬──────────────────────────────┘        │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              Orchestrator (Core AI)                  │        │
│  │  • Intent classification                            │        │
│  │  • Tool selection (deterministic)                   │        │
│  │  • Business data access (tenant-scoped)             │        │
│  │  • Reply composition (LLM + guards)                 │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Design Principles

1. **Channel Agnosticism**: The orchestrator doesn't know or care which channel a message came from
2. **Tenant Isolation**: All data access is scoped to the business that owns the conversation
3. **Deterministic Facts**: Critical business data (prices, availability) always comes from tools, never LLM
4. **Webhook Security**: All inbound webhooks verify signatures before processing
5. **Idempotency**: Duplicate messages are detected and prevented from creating duplicate records

## Channel Types

### Web (Stateless Widget)
- **Inbound**: POST `/api/widget/chat`
- **Outbound**: HTTP response (synchronous)
- **Session**: conversationId maintained client-side
- **Security**: CORS, rate limiting, input sanitization

### WhatsApp (Official Cloud API)
- **Inbound**: POST `/api/webhooks/whatsapp`
- **Outbound**: WhatsApp Cloud API (async)
- **Session**: Phone number mapped to conversation
- **Security**: Signature verification, webhook token validation

## Message Flow

### Inbound
```
Channel → Signature Verification → normalizeInbound() → UserMessage → processMessage()
```

### Outbound
```
OrchestratorResult → ChannelAdapter.sendText() → External Delivery
```

## Tenant Mapping

Each channel connection is mapped to a specific business/tenant:
- Web: businessSlug/hotelSlug in request
- WhatsApp: phone number → business mapping (configured per tenant)

This ensures that customer conversations always use the correct business's AI employee configuration.
