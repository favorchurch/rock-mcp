---
id: connect-groups
title: Connect Groups
aliases: [connect group, small groups, cg, connect]
tags: [groups, connect-groups, ministry, discipleship]
liveBinding:
  kind: groupType
  match: connectGroups
---

## What it is

Connect Groups are Favor's small-group structure, modelled on Rock **GroupType "Connect Group"**
(GroupType #25). They are the primary vehicle for moving a person from **Crowd** to **Core**.

## Naming convention (structure best practice)

Connect Groups follow a strict, self-documenting naming pattern — treat it as semi-structured data:

```
name:        "<AgeBand> // <Leader(s)>"
description: "<NEW!?> <City> // <Venue> // <Day> // <Time> // <Demographic> (<age range>)"
```

Example — `Adults // Jerome & Yayo Oliveros` → `Quezon City // UP Techno Hub // Friday // 5PM //
Couples Men & Women (Married, Engaged) (30-49)`.

Age bands: **Youth** (Junior/Senior High), **Young Adults** (college / 18–25), **Adults** (26–49),
**Seasoned** (50+). The demographic suffix (Single / Couples / Women-only / Single-Moms …) is
targeting metadata living *inside the description string*, not a structured attribute.

## Best practice when querying

- Use `rock_ministry` `groups` with `kind:'connectGroup'`, and `connectGroupHealth` for health by
  campus/age group.
- Parse the `description` by the `//` delimiter to extract city, venue, day, time, demographic.
- The `NEW!` prefix marks recently launched groups.

## Known gap

Connect Groups are effectively **Manila-only** today — Brisbane and Seoul have Ministry Teams but
no Connect Group structure in Rock, so cross-campus small-group analytics aren't comparable. See
strategy issue on extending the model to BNE/SEL.

## Related

`ministry-teams` · `connection-status` · `age-groups`
