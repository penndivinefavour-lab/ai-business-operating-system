# AI Employee Model

## Overview

The AI Employee is the core product concept: each business gets a configurable digital employee that communicates with customers, handles bookings, captures learns, and learns the business.

## Architecture

### Database Tables

| Table | Purpose |
|-------|---------|
| `employee_profiles` | AI employee identity, personality, status |
| `business_services` | Services/products the employee knows about |
| `business_policies` | Rules the employee must follow |
| `onboarding_checklist` | Progress tracking for setup wizard |

### Employee Profile Fields

- **Identity**: name, role, avatar emoji
- **Personality**: tone, languages, greeting style
- **Behavior**: escalation triggers, response length, welcome message
- **Status**: draft, active, paused
- **Onboarding**: step progress, completion flag

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/hotels/:id/employee` | Get employee profile + checklist |
| PUT | `/api/hotels/:id/employee` | Update profile |
| GET | `/api/hotels/:id/services` | List services |
| POST | `/api/hotels/:id/services` | Create service |
| PUT | `/api/hotels/:id/services/:sid` | Update service |
| DELETE | `/api/hotels/:id/services/:sid` | Delete service |
| GET | `/api/hotels/:id/policies` | List policies |
| POST | `/api/hotels/:id/policies` | Create policy |
| PUT | `/api/hotels/:id/policies/:pid` | Update policy |
| DELETE | `/api/hotels/:id/policies/:pid` | Delete policy |
| GET | `/api/hotels/:id/onboarding` | Get checklist |
| POST | `/api/hotels/:id/onboarding/complete` | Mark step done |
| POST | `/api/hotels/:id/test-employee` | Test AI response |

## Onboarding Flow

9-step wizard:

1. Welcome — explain the product
2. Business info — hotel name, city, contact
3. Employee identity — name, role, personality, languages, emoji
4. Services — add services with prices
5. Policies — define rules (cancellation, etc.)
6. Knowledge — FAQ entries
7. Escalation — when to hand off to human
8. Test — preview responses
9. Activate — save and go live

## Tenant Isolation

Every query filters by `hotel_id`. Employee profiles are unique per hotel. Cross-tenant access returns 403.
