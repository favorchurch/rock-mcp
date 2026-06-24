---
id: age-groups
title: Age Groups & Leaders-by-Age
aliases: [age group, age groups, kids, youth, young adults, adults, seasoned]
tags: [people, age-groups, leaders, analytics]
---

## Age bands

| Label | Age range |
|---|---|
| Kids | 0–12 |
| Youth | 13–17 |
| Young Adults | 18–25 |
| Adults | 26–49 |
| Seasoned | 50+ |

## Leaders-by-age (important nuance)

When someone asks for "Youth leaders", "Young Adult leaders", etc., they mean **leaders FOR that
age group**, not leaders whose personal age falls in the band. A 25-year-old who leads a Youth
Connect Group is a *Youth leader*.

Derivation order:

1. **Group assignment first** — find the Connect Groups the leader is assigned to; the age group is
   the group's ministry/campus context (the `<AgeBand>` prefix in the Connect Group name).
2. **Personal age fallback** — only if the leader isn't assigned to any group, bucket by their own
   age using the table above.

## Best practice when querying

- Connect Group names already encode the age band (`Youth // …`, `Adults // …`) — use it directly.
- Pair with `connection-status` to scope to actual `Leader` records.

## Related

`connect-groups` · `connection-status` · `ministry-teams`
