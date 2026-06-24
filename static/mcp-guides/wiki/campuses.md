---
id: campuses
title: Campuses
aliases: [campus, manila, brisbane, seoul, mnl, bne, sel, global]
tags: [campuses, structure, geography]
liveBinding:
  kind: campuses
---

## What it is

Favor is a single multi-campus Rock instance. Campuses (and their team prefixes):

| Id | Campus | Prefix |
|---|---|---|
| 1 | Manila | `MNL` |
| 2 | Brisbane | `BNE` |
| 3 | Seoul | `SEL` |
| 4 | Favor Church Global | — (umbrella) |

Prefixes are IATA city codes and appear throughout Ministry Team and Connection Type names.

## Distribution (best practice for analysis)

The data is **Manila-heavy** — most people, all Connect Groups, and ~all Connection Types are
Manila. When reporting org-wide stats, always state the campus scope; an unqualified total is
effectively a Manila total. Brisbane and Seoul have Ministry Teams but limited structured
small-group/pipeline data.

## Best practice when querying

- Use `rock_people` `filter` with `campusName` (resolved case-insensitively) or `campusId`.
- `Favor Church Global` is an umbrella, not a physical campus — exclude or annotate it in
  per-location breakdowns.

## Related

`connect-groups` · `ministry-teams` · `connection-status`
