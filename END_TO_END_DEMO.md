# End-to-End Demo Guide

## Quick Start

```bash
cd "D:/HERMES AGENT/AI Business Operating System"
npm install
npm run dev
```

Visit: http://localhost:3000

## Demo Credentials

- **Email**: admin@demo.hotel
- **Password**: demo-admin-123

## Complete Workflow

### 1. Owner Logs In
- Visit http://localhost:3000
- Login with demo credentials
- Dashboard shows "Sarah — AI Receptionist" card

### 2. Owner Configures Sarah
- Click "Mon Employé IA" in sidebar
- Click "Modifier" to open onboarding wizard
- Walk through 9 steps: business info → identity → services → policies → FAQ → escalation → test → activate

### 3. Owner Tests Sarah
- Click "Tester" button in employee profile
- Type questions like a customer
- Sarah responds using configured identity and real DB data

### 4. Customer Opens Chat Widget
- Visit http://localhost:3000/widget.html?hotel=demo
- Sarah's name and avatar appear in header
- Customer types: "Do you have rooms for tomorrow?"
- Sarah checks real availability and responds

### 5. Multi-Turn Conversation
- Customer: "Do you have rooms for Friday?"
- Sarah: Shows available rooms with real prices
- Customer: "How much is the executive room?"
- Sarah: Responds with price from DB (38,000 FCFA)
- Customer: "Book it for me"
- Sarah: Initiates booking flow, asks for confirmation
- Customer: "Yes"
- Sarah: Confirms booking, creates follow-up

### 6. Escalation Flow
- Customer: "I want to speak to a manager"
- Sarah detects escalation intent
- Creates escalation record
- Owner sees escalation in dashboard

### 7. Tenant Isolation
- Create a second hotel via API
- Each hotel has its own Sarah, rooms, knowledge
- Cross-tenant data access returns 403

## API Endpoints

| Method | Path | Access |
|--------|------|--------|
| POST | /api/login | Public |
| GET | /api/health | Public |
| POST | /api/chat | Public (customer) |
| GET | /api/hotels/:slug/branding | Public (widget) |
| GET | /api/hotels | Authenticated |
| GET | /api/hotels/:id/employee | Authenticated (owner) |
| PUT | /api/hotels/:id/employee | Authenticated (owner) |
| POST | /api/hotels/:id/test-employee | Authenticated (owner) |
| POST | /api/hotels | Authenticated (platform admin) |

## Architecture

```
Customer Browser
    ↓
/widget.html?hotel=demo
    ↓
GET /api/hotels/demo/branding → { employee: { name, avatar, role } }
    ↓
POST /api/chat { hotelSlug, text, conversationId }
    ↓
Orchestrator → Classify Intent → Agent → Tools → Database
    ↓
Response { reply, employee, conversationId }
```
