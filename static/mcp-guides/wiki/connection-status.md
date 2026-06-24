---
id: connection-status
title: Connection Status & the Favor Lifecycle
aliases: [lifecycle, connection status, stages, statuses, new crowd core leader]
tags: [people, lifecycle, connection-status, discipleship]
liveBinding:
  kind: definedType
  definedTypeName: Connection Status
  definedTypeId: 4
  countsByStatus: true
---

## What it is

Favor Church tracks every person against a **four-stage assimilation lifecycle**:

| Stage | Meaning |
|---|---|
| **New** | Created recently (often from a web/registration form); not yet engaged. |
| **Crowd** | Attends or participates in non-service events; no formal connection. |
| **Core** | Consistently active — serving on a team or in a Connect Group. |
| **Leader** | Leads a Connect Group or Ministry Team. |

This lifecycle is stored in Rock's **`Connection Status`** DefinedType (DefinedType #4). The
person's value lives on `Person.ConnectionStatusValueId` (display: `ConnectionStatusValue`).

## How Favor configured it (important)

Favor **renamed Rock's stock Connection Status values in place** rather than creating new ones, so
the underlying system `Description` text no longer matches the label:

- `Leader` (Id 65) — description still reads "…to become a member" (Rock's *Member*).
- `Core` (Id 146) — Rock's *Attendee*.
- `Crowd` (Id 203) — Rock's *Participant*.
- `New` (Id 67) — Rock's *Prospect*.
- `Guest` (Id 66) — Rock's *Visitor*.
- Custom additions: `Staff` (1342), `SYSTEM` (1343), `Open Access` / "Favor Friends" (1344).

The displayed funnel is **New → Crowd → Core → Leader**, which is *not* the same as the stored
`Order` field. Do not infer the funnel from `Order`.

## Best practice when querying

- **Never hardcode DefinedValue IDs.** Resolve by name via `rock_lookup` or the two-step
  DefinedType→DefinedValue lookup (Rock v1 OData rejects navigation-property filters).
- Use `rock_people` `filter` with `connectionStatus` + `countOnly:true` for **true totals**
  (not page-capped).
- Break down by campus with `campusName`/`campusId`; counts are Manila-heavy by default.
- Treat `Staff`, `SYSTEM`, and `Open Access` as **outside** the discipleship funnel — exclude them
  from "New/Crowd/Core/Leader" rollups unless explicitly asked.

## Common pitfalls

- Confusing **lifecycle attribute** drift vs the connection-status value — they can disagree.
- "Leaders for an age group" ≠ leaders whose personal age is in that band — derive from the group
  they lead first (see `age-groups`).

## Related

`connect-groups` · `ministry-teams` · `discipleship-fdna-build` · `age-groups`
