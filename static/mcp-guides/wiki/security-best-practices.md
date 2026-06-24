---
id: security-best-practices
title: Security & PII Best Practices
aliases: [security, pii, privacy, data protection, safety]
tags: [security, pii, privacy, auth]
---

## PII defaults (always apply)

Person output must be privacy-safe by default. **Allowed**: name, Rock Id/GUID/IdKey, campus,
lifecycle/connection status, group-membership summary, serving summary, attendance summary.
**Excluded unless explicitly requested**: email, phone, birthdate, address, notes, family details,
financial data.

## Access model

- The gateway forwards each user's **own JWT** to Rock; Rock's per-user permissions are
  authoritative. The gateway never uses an admin key to escalate.
- Writes are gated by a **fail-closed allowlist** (model ▸ operation ▸ field), deletes require
  RSR-admin, and bulk operations are bounded. See `logins-auth`.
- Datasets are owned by the requesting subject; cross-user access is blocked.

## Operational guidance

- Prefer counts and summaries over row dumps; use `countOnly` and dataset/app views for large
  results.
- Never echo raw Rock API error bodies to end users — they can leak schema/permission internals.
- Treat financial and benevolence data as the most sensitive tier.

## Known hardening items (tracked)

CORS allowlist, Rock error sanitization, fail-closed rate limiting, per-user rate limiting, and
token revocation/rotation are tracked as gateway improvements. Legacy attributes and v2 REST access
are tracked as Rock-side strategy items.

## Related

`logins-auth` · `data-hygiene`
