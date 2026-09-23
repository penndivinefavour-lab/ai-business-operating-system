# DESIGN SYSTEM — AI Business Operating System

**Date:** 2026-09-23

---

## Product Story

A hotel hires an AI employee. The employee talks to customers, answers questions, captures leads, handles booking requests, follows up, collects feedback, and escalates to humans. The owner supervises the employee.

---

## Design Principles

1. **Calm, trustworthy, commercially credible** — not flashy, not gimmicky
2. **Mobile-first** — owner checks on their phone, not a desktop
3. **AI employee is the product** — not "orchestration," not "intents," not "agents"
4. **Animations communicate state** — message arrival, thinking, tool use, response
5. **Fast** — no heavy frameworks, instant feedback, optimistic UI
6. **Accessible** — readable contrast, touch targets ≥44px, keyboard navigable

---

## Color Palette

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0e1116` | Page background |
| `--bg-2` | `#151a21` | Card/panel background |
| `--bg-3` | `#1c232d` | Input/button background |
| `--line` | `#252d38` | Borders, dividers |
| `--text` | `#e8edf3` | Primary text |
| `--muted` | `#8a96a6` | Secondary text |
| `--accent` | `#2b7c7e` | Primary action (deep teal) |
| `--accent-2` | `#1f5f61` | Hover state |
| `--accent-soft` | rgba(43,124,126,0.12) | Subtle backgrounds |
| `--ok` | `#3a9e6e` | Success/confirmed |
| `--warn` | `#d4a04a` | Warning/pending |
| `--danger` | `#c95f5f` | Error/critical |
| `--info` | `#4a8fc8` | Information |

---

## Typography

- **Font stack:** `-apple-system, "Segoe UI", system-ui, Roboto, sans-serif`
- **Monospace:** `"SF Mono", Consolas, Menlo, monospace`
- **Scale:** 12px (caption) · 13px (body) · 14px (base) · 16px (subtitle) · 20px (title) · 28px (display)
- **Line-height:** 1.5 body · 1.2 headings
- **Weight:** 400 normal · 600 semibold · 700 bold

---

## Spacing & Geometry

- **Border radius:** 8px (cards) · 10px (buttons) · 12px (modals) · 50% (avatars)
- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48
- **Touch targets:** minimum 44×44px
- **Sidebar width:** 240px (desktop)
- **Bottom nav height:** 60px (mobile)

---

## Animation

| Animation | Duration | Easing | Use |
|-----------|----------|--------|-----|
| `fade-in` | 200ms | ease-out | New elements appearing |
| `slide-up` | 250ms | cubic-bezier(.2,.7,.3,1) | Cards, modals |
| `pulse-soft` | 2s ease-in-out infinite | — | AI thinking state |
| `shimmer` | 1.5s linear infinite | — | Loading skeletons |
| `badge-pop` | 300ms | cubic-bezier(.2,.7,.3,1) | Status changes |

**Rules:**
- All animations under 300ms
- No infinite animations except thinking indicators
- Respect `prefers-reduced-motion: reduce`
- Animate transform/opacity only (compositor-friendly)

---

## Iconography

Use inline SVG icons (no icon library). Key icons:
- Home, Message, Users, Calendar, Star, Settings, Plus, Search, Bell, Menu, Close, Check, Alert, Arrow

---

## Components

### Cards
- Background: `--bg-2`, border: 1px solid `--line`, radius: 8px
- Padding: 16px mobile / 24px desktop
- Hover: subtle background shift

### Buttons
- Primary: `--accent` background, white text, radius 10px
- Secondary: `--bg-3` background, `--text` color
- Ghost: transparent, `--muted` text
- Height: 40px mobile / 36px desktop

### Inputs
- Background: `--bg-3`, border: 1px solid `--line`
- Focus: 2px solid `--accent`
- Height: 44px mobile / 36px desktop

### Badges
- Pill shape, 20px height
- Color-coded by status (ok/warn/danger/info)

### Navigation
- **Desktop:** Fixed sidebar, 240px, full height
- **Mobile:** Fixed bottom nav, 5 visible items + more

---

## Responsive Breakpoints

| Breakpoint | Target |
|------------|--------|
| `< 480px** | Small phones |
| `480-767px` | Large phones |
| `768-1023px` | Tablets |
| `≥ 1024px` | Desktop |

**Mobile-first** — base styles for mobile, enhance with `min-width` media queries.

---

## Empty States

Every empty state shows:
1. Icon (muted, 48px)
2. Short explanation (muted text)
3. Action button (if applicable)

Example: "No conversations yet. When customers chat with Sarah, they'll appear here."

---

## Loading States

- **Skeleton screens** for cards and lists (shimmer animation)
- **Inline spinners** for buttons
- **Optimistic updates** where safe

---

**End of Design System**
