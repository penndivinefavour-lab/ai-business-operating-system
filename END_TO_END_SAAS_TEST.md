# End-to-End SaaS Test Documentation

## Verified Lifecycle

### 1. Account Registration
```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@hotel.com","password":"password123","name":"Hotel Owner","businessName":"Hotel Test"}'
```

Response:
```json
{
  "ok": true,
  "token": "abc123...",
  "account": { "id": 1, "email": "test@hotel.com", "name": "Hotel Owner" },
  "business": { "id": 1, "slug": "hotel-test", "name": "Hotel Test" },
  "hotelId": 1
}
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@hotel.com","password":"password123"}'
```

Response:
```json
{
  "ok": true,
  "token": "abc123...",
  "role": "owner",
  "email": "test@hotel.com",
  "businessId": 1,
  "businessName": "Hotel Test",
  "memberships": [{ "businessId": 1, "role": "owner" }]
}
```

### 3. Configure Employee
```bash
curl -X PUT http://localhost:3000/api/businesses/1/hotels/1/employee \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sarah","role":"Réceptionniste","status":"active","welcome_message":"Bienvenue!"}'
```

### 4. Add Services
```bash
curl -X POST http://localhost:3000/api/businesses/1/hotels/1/services \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Petit-déjeuner","price":5000,"category":"restauration"}'
```

### 5. Add Knowledge (FAQs)
```bash
curl -X POST http://localhost:3000/api/businesses/1/hotels/1/knowledge \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"question":"WiFi?","answer":"Gratuit et illimité.","category":"amenities"}'
```

### 6. Customer Widget Chat
```bash
curl -X POST http://localhost:3000/api/widget/chat \
  -H "Content-Type: application/json" \
  -d '{"businessSlug":"hotel-test","text":"Do you have rooms?"}'
```

Response:
```json
{
  "ok": true,
  "reply": "Oui, nous avons des chambres...",
  "employee": { "name": "Sarah", "role": "Réceptionniste" },
  "conversationId": 1
}
```

### 7. View Conversations (Owner)
```bash
curl http://localhost:3000/api/businesses/1/hotels/1/conversations \
  -H "Authorization: Bearer <token>"
```

### 8. Security Tests

#### Cross-tenant access denied:
```bash
# Login as owner of business 2
curl -X POST http://localhost:3000/api/login \
  -d '{"email":"owner2@hotel.com","password":"password123"}'

# Try to access business 1's data
curl http://localhost:3000/api/businesses/1/employee \
  -H "Authorization: Bearer <token2>"
# Expected: 403 Forbidden
```

#### Invalid credentials:
```bash
curl -X POST http://localhost:3000/api/login \
  -d '{"email":"test@hotel.com","password":"wrong"}'
# Expected: 401 Unauthorized
```

#### Invalid widget slug:
```bash
curl -X POST http://localhost:3000/api/widget/chat \
  -d '{"businessSlug":"nonexistent","text":"Hello"}'
# Expected: 404 Not Found
```

## Test Results

### Unit Tests (26/26 passing)
- Account CRUD with scrypt password hashing
- Password verification (correct + wrong passwords)
- Duplicate email rejection
- Business creation with unique slug
- Business membership linking
- Tenant isolation (cross-tenant membership denied)
- Listing memberships per account
- Legacy hotel/room/availability/booking tests
- Employee profile CRUD
- Services CRUD
- Policies CRUD
- Onboarding checklist (init, complete, reset)
- Multi-turn conversation context
- Employee identity in responses
- Tool results are factual (no hallucination)

### Live API Tests (manual verification)
- POST /api/signup → Creates account, business, hotel, employee
- POST /api/login → Returns token with business context
- GET /api/me → Returns session + businesses list
- POST /api/me/business → Switches active business context
- GET /api/businesses/:id/employee → Returns employee profile
- PUT /api/businesses/:id/employee → Updates employee (name, role, status)
- POST /api/widget/chat → Customer gets AI response with employee identity
- GET /api/businesses/:slug/branding → Public branding endpoint

### Browser/UI Verification
- Landing page with signup/login modals ✅
- Auth flow with token storage ✅
- Owner dashboard with business workspace ✅
- Employee configuration form ✅
- Services/Policies/Knowledge CRUD ✅
- Customer widget preview ✅
- Embed snippet copy functionality ✅
- Logout flow ✅

### Security Verification
- Cross-tenant API access returns 403 ✅
- Invalid credentials return 401 ✅
- Public widget endpoint only exposes public-safe data ✅
- Rate limiting on chat/auth endpoints ✅
- No secrets exposed in widget responses ✅
