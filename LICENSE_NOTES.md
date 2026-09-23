# License Notes — AI Business Operating System

This project is proprietary software. Below are the licenses of all external open-source components used.

---

## Direct Dependencies (MIT — Commercial Use OK)

| Component | License | Usage |
|---|---|---|
| PocketBase | MIT | Database/backend runtime |
| Next.js | MIT | Dashboard frontend |
| React | MIT | UI library |
| Fastify | MIT | API server framework |
| Zod | MIT | Schema validation |
| Vercel AI SDK | MIT | AI provider abstraction |
| Tailwind CSS | MIT | Styling |
| shadcn/ui | MIT | UI components |
| Vitest | MIT | Testing framework |
| TypeScript | Apache 2.0 | Language |
| Evolution API | Apache 2.0 (with attribution) | WhatsApp gateway (production) |
| WAHA | Apache 2.0 | WhatsApp dev mode |

## Indirect/Development Dependencies

All production dependencies are MIT, Apache 2.0, BSD-3-Clause, or ISC licensed. No GPL/AGPL components are used in production code.

## License Compliance Notes

1. **MIT components**: Copyright notices preserved in source. Free for commercial use.
2. **Apache 2.0 components**: NOTICE files included where required. Evolution API requires attribution and usage notification (see OPEN_SOURCE_AUDIT.md).
3. **No copyleft (GPL/AGPL)**: Kamra PMS was evaluated but NOT incorporated due to AGPL copyleft.
4. **No fair-code**: n8n and NocoDB evaluated but rejected for core platform due to SaaS resale restrictions.

## What We Built

All original code in this repository is proprietary and not licensed to third parties. External components retain their original licenses.

---

## Dependency Audit Command

```bash
# Check all production licenses
npx license-checker --production --csv licenses.csv

# Verify no GPL/AGPL
npx license-checker --production | grep -iE "GPL|AGPL" && echo "FOUND COPYLEFT!" || echo "Clean"
```
