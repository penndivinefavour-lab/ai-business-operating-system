# Demo Guide — AI Business Operating System

## Quick Start

```bash
# Clone and enter project
cd "D:\HERMES AGENT\AI Business Operating System"

# Install dependencies
npm install

# Start in demo mode (no external credentials needed)
npm run demo
```

This starts:
- Dashboard at http://localhost:3000
- API server at http://localhost:4000
- PocketBase at http://localhost:8090

A demo hotel "Hotel La Paix, Yaoundé, Cameroon" is automatically seeded with rooms, customers, and bookings.

---

## Demo Scenarios

### Scenario 1: Room Availability

**Customer says**: "Do you have a room for Friday?"

**What happens**:
1. System classifies intent: CHECK_AVAILABILITY
2. Calls `check_availability` tool with date = Friday
3. Queries database for available rooms
4. Responds with available room types and prices
5. Logs action to audit log

**Verify**: Check the dashboard → Conversations tab to see the interaction.

### Scenario 2: Room Price Inquiry

**Customer says**: "How much is the executive room?"

**What happens**:
1. Intent: KNOWLEDGE_QUERY
2. Searches knowledge base for "executive room price"
3. Returns: "Executive rooms are 75,000 FCFA per night..."

### Scenario 3: Booking Request

**Customer says**: "I want to book for two nights"

**What happens**:
1. Intent: BOOKING_REQUEST
2. Asks for: check-in date, guest name, phone number
3. After collecting info, calls `create_booking` tool
4. Booking status: PENDING
5. Sends confirmation: "Your booking request has been received..."

### Scenario 4: Policy Question

**Customer says**: "Can I check in early?"

**What happens**:
1. Intent: KNOWLEDGE_QUERY
2. Searches knowledge base for "check-in policy"
3. Returns: "Standard check-in is at 2:00 PM. Early check-in is subject to availability..."

### Scenario 5: Location

**Customer says**: "Where are you located?"

**What happens**:
1. Intent: KNOWLEDGE_QUERY
2. Searches knowledge base for "location address"
3. Returns: "Hotel La Paix is located at 45 Avenue Ahidjo, Yaoundé, Cameroon..."

### Scenario 6: Complaint/Feedback

**Customer says**: "I had a problem with my room"

**What happens**:
1. Intent: FEEDBACK/ESCALATION
2. Stores feedback record
3. Triggers human escalation flow
4. Responds: "I'm sorry to hear that. Let me connect you with our manager..."

### Scenario 7: Human Escalation

**Customer says**: "I want to speak to someone"

**What happens**:
1. Intent: HUMAN_ESCALATION
2. Creates escalation record with conversation context
3. Notifies human operator (dashboard alert)
4. Responds: "Let me connect you with a team member. Please hold..."

---

## Using the Dashboard

1. Open http://localhost:3000
2. Login with demo credentials (admin@hotel / demo123)
3. Navigate tabs:
   - **Overview**: See KPIs (active conversations, today's bookings, pending leads)
   - **Conversations**: View all customer conversations, reply as human
   - **Leads**: See captured leads, convert to customers
   - **Customers**: View customer profiles and history
   - **Reservations**: Manage bookings, check-in/out
   - **Knowledge Base**: Edit hotel info, services, policies, FAQs
   - **Automations**: Configure follow-up rules
   - **Feedback**: View and respond to feedback
   - **Reports**: Occupancy, revenue, AI resolution rate

## Simulating Conversations

In demo mode, the "Conversations" tab has a "Simulate Customer" button:

1. Click "Simulate Customer"
2. Select a scenario from the dropdown
3. The system plays out the full conversation automatically
4. Watch the AI respond, tools execute, and data update

## What's NOT in Demo Mode

- Real WhatsApp connection (simulated)
- Real AI API calls (deterministic mock responses)
- Real email sending (logged to console)
- Real payments

## Switching to Production

When ready for a real hotel:

1. Get Meta WhatsApp Business API credentials
2. Set environment variables (see `.env.example`)
3. Run `npm run migrate` to set up production database
4. Run `npm run start`

See README.md for full production setup instructions.
