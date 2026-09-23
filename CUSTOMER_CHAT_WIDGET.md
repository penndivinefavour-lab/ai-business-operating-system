# Custom Chat Widget

## Embedding on a Hotel Website

### Method 1: Script Loader (Recommended)

Add this snippet to the hotel's website `<body>`:

```html
<script src="https://your-domain.com/widget.js" data-hotel="demo" async></script>
```

### Method 2: Iframe Embed

```html
<iframe src="https://your-domain.com/widget.html?hotel=demo" 
  width="400" height="600" frameborder="0" style="border:none;"></iframe>
```

### Method 3: Programmatic (JS API)

```html
<div id="my-hotel-chat"></div>
<script src="https://your-domain.com/widget.js" data-hotel="demo"></script>
<script>
  window.HermesChat.open({ hotelSlug: 'demo' });
</script>
```

## Public API

| Endpoint | Method | Access | Description |
|----------|--------|--------|-------------|
| `/api/hotels/:slug/branding` | GET | Public | Hotel branding + employee info |
| `/api/chat` | POST | Public (rate-limited) | Send message, get reply |

## Security

- No authentication tokens exposed to browser
- Only public-safe data returned (hotel name, description, employee name/avatar/role)
- Rate limited per IP
- No cross-tenant access
- No database IDs exposed
- Widget can only access its own hotel data

## Rate Limiting

- 30 requests/minute per IP
- 100 requests/hour per IP
- 429 status code on limit exceeded

## Configuration

```env
# Server
PORT=3000
NODE_ENV=production

# LLM Provider (optional - demo fallback works without keys)
LLM_PROVIDER=anthropic|openai-compatible|demo
ANTHROPIC_API_KEY=sk-...
OPENAI_COMPATIBLE_BASE_URL=https://...
OPENAI_COMPATIBLE_API_KEY=...
OPENAI_COMPATIBLE_MODEL=gpt-4o-mini
```

## Demo Mode

Without LLM keys configured, the widget uses deterministic AI responses based on:
- Intent classification patterns
- Real database queries (availability, prices)
- Configured employee identity and personality
