# Pilot Runbook

## How to Run a Two-Tenant Pilot Test

This guide walks you through testing the AI Business Operating System with two separate businesses (tenants) to verify multi-tenant isolation.

### Prerequisites

1. Start the server: `npm run dev`
2. Server running at `http://localhost:3000`
3. API available at `http://localhost:3000/api/`

---

### Step 1: Create Tenant A (Hotel La Paix)

```bash
# Register Tenant A
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@hotel-paix.com",
    "password": "securePass123",
    "name": "Jean Mballa",
    "businessName": "Hotel La Paix"
  }'

# Save the token from the response as TENANT_A_TOKEN
```

### Step 2: Configure Tenant A's AI Employee

```bash
# Get businesses to find the business ID
curl -X GET http://localhost:3000/api/businesses \
  -H "Authorization: Bearer $TENANT_A_TOKEN"

# Update employee profile (use actual businessId from above)
curl -X PUT http://localhost:3000/api/businesses/1/employee \
  -H "Authorization: Bearer $TENANT_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sarah",
    "role": "Réceptionniste",
    "personality": "professional_friendly",
    "tone": "warm_professional",
    "languages": "fr,en",
    "welcome_message": "Bienvenue à Hotel La Paix! Je suis Sarah, votre réceptionniste numérique.",
    "status": "active"
  }'
```

### Step 3: Add Services for Tenant A

```bash
curl -X POST http://localhost:3000/api/businesses/1/services \
  -H "Authorization: Bearer $TENANT_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Navette aéroport",
    "description": "Transfert aéroport-hôtel",
    "price": 5000,
    "category": "transport"
  }'
```

### Step 4: Create Tenant B (Hotel du Plateau)

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@plateau-hotel.com",
    "password": "securePass456",
    "name": "Marie Fouda",
    "businessName": "Hotel du Plateau"
  }'

# Save as TENANT_B_TOKEN
```

### Step 5: Configure Tenant B Differently

```bash
curl -X PUT http://localhost:3000/api/businesses/2/employee \
  -H "Authorization: Bearer $TENANT_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Marc",
    "role": "Concierge Digital",
    "personality": "formal_elegant",
    "tone": "formal_polite",
    "welcome_message": "Bienvenue à l'\''Hotel du Plateau. Je suis Marc, votre concierge.",
    "status": "active"
  }'
```

### Step 6: Verify Tenant Isolation

```bash
# Try to access Tenant A's data with Tenant B's token (should fail with 403)
curl -X GET http://localhost:3000/api/businesses/1/employee \
  -H "Authorization: Bearer $TENANT_B_TOKEN"

# Expected: 403 Forbidden
```

### Step 7: Test Customer Chat (Public Widget)

```bash
# Customer asks Tenant A about rooms
curl -X POST http://localhost:3000/api/widget/chat \
  -H "Content-Type: application/json" \
  -d '{
    "businessSlug": "hotel-la-paix",
    "text": "Bonjour, avez-vous des chambres disponibles?"
  }'

# Customer asks Tenant B
curl -X POST http://localhost:3000/api/widget/chat \
  -H "Content-Type: application/json" \
  -d '{
    "businessSlug": "hotel-du-plateau",
    "text": "Hello, what are your room rates?"
  }'
```

### Step 8: Verify Different Employee Responses

Each business's AI should respond with its configured name and personality. Tenant A says "Je suis Sarah" and Tenant B says "Je suis Marc".

### Step 9: Test Booking Flow

```bash
# Ask about availability
curl -X POST http://localhost:3000/api/widget/chat \
  -H "Content-Type: application/json" \
  -d '{
    "businessSlug": "hotel-la-paix",
    "text": "Je voudrais réserver une chambre standard pour 2 nuits"
  }'

# Confirm the booking (use conversationId from previous response)
curl -X POST http://localhost:3000/api/widget/chat \
  -H "Content-Type: application/json" \
  -d '{
    "businessSlug": "hotel-la-paix",
    "conversationId": 1,
    "text": "Oui, confirmez la réservation"
  }'
```

### Step 10: Check Owner Dashboard

```bash
# View Tenant A's conversations
curl -X GET http://localhost:3000/api/businesses/1/conversations \
  -H "Authorization: Bearer $TENANT_A_TOKEN"

# View Tenant A's reservations
curl -X GET http://localhost:3000/api/businesses/1/reservations \
  -H "Authorization: Bearer $TENANT_A_TOKEN"
```

### Step 11: Test Escalation

```bash
curl -X POST http://localhost:3000/api/widget/chat \
  -H "Content-Type: application/json" \
  -d '{
    "businessSlug": "hotel-la-paix",
    "text": "Je souhaite parler à un humain"
  }'

# Check escalations as owner
curl -X GET http://localhost:3000/api/businesses/1/escalations \
  -H "Authorization: Bearer $TENANT_A_TOKEN"
```

### Step 12: Test Provider Failure Fallback

The system should always fall back to deterministic responses if the LLM is unavailable:

```bash
# Temporarily set AI_PROVIDER to something invalid
# The system still works using deterministic agent responses
```

### Expected Outcomes

| Test | Expected |
|------|----------|
| Signup creates account + business | 201 |
| Login returns session token | 200 |
| Cross-tenant access | 403 Forbidden |
| Widget chat without auth | 200 (public) |
| Different employee names per tenant | Verified |
| Booking creates reservation | 200 |
| Escalation creates record | 200 |
| LLM fallback works | Verified |

### Recovery from Failures

If something goes wrong:

1. **Reset database**: `rm data/frontdesk.db* && npm run seed`
2. **Restart server**: Stop and restart `npm run dev`
3. **Check logs**: Server logs show error IDs for debugging

### WhatsApp Testing (Optional)

If WhatsApp is configured:

```bash
# Verify webhook (for Meta Cloud API)
curl -X GET "http://localhost:3000/api/webhooks/whatsapp?hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=123&hub.mode=subscribe"

# Simulate incoming message
curl -X POST http://localhost:3000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[{"from":"1234567890","text":{"body":"Hello"},"timestamp":"1234567890","id":"test123"}]}}]}]}'
```
