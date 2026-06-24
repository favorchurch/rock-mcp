---
id: volunteer-onboarding
title: Volunteer Onboarding & Offboarding
aliases: [volunteer onboarding, add to team, remove from team, serving signup, volunteer pipeline]
tags: [workflows, connections, volunteers, serving, process]
liveBinding:
  kind: workflows
---

## What it is

Favor runs volunteer onboarding through Rock **Connection Types** (the pipeline/approval stage) and
**paired Workflows** (the executable membership change). Almost all of it is Manila-scoped today.

## The engine (process best practice)

```
Volunteer signup  →  Connection Type (MNL | VOL | …)  →  Approved?
                                                          ├─ yes →  "Add to <Team>" workflow  → GroupMember added
                                                          └─ exit → "Remove from <Team>" workflow → GroupMember removed
```

- **Connection Types** group volunteer pipelines by ministry cluster: `MNL | VOL | Worship`,
  `… | CRTVS x Prod`, `… | Deaf/Prayer/Grow/Street`, `… | Events/Support Ops/Logistics/Socials`,
  `… | Kids`, `… | People`, `… | Tech`, `… | Youth`, `… | Fitness`, `… | Movement`.
- **~80 paired "Add to / Remove from <Team>" workflows** are the executable side — one matched pair
  per team. They mutate Ministry Team membership.

## Best practice when querying

- Use `rock_workflow` `connectionRequests` to see in-flight pipelines and `workflowTypes` to list
  the Add/Remove pairs.
- A volunteer's *current* serving state is the Ministry Team membership (`ministry-teams`), not the
  workflow history.
- Non-volunteer pipelines reuse the same Connection Type machinery: `MNL | Grow | Build & FDNA`,
  `MNL | SS | Water Baptism`, `MNL | SS | Before Forever`, `MNL | Financial Assistance Requests`,
  `MNL | Ticket Transfers`.

## Related

`ministry-teams` · `discipleship-fdna-build` · `sacraments-life-events`
