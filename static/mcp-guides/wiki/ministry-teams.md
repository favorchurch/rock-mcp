---
id: ministry-teams
title: Ministry Teams & Serving
aliases: [ministry team, serving teams, volunteer teams, teams]
tags: [groups, ministry-teams, serving, volunteers]
liveBinding:
  kind: groupType
  match: ministryTeams
---

## What it is

Ministry Teams are Favor's serving/volunteer structure, modelled on Rock **GroupType
"Ministry Teams"** (GroupType #23). Serving on a team is a primary marker of **Core** status.

## Structure (best practice)

Teams are organised in a campus-scoped hierarchy beneath a single root:

```
Ministry Teams (root)
├── MNL Teams   (Manila)
├── SEL Teams   (Seoul)
└── BNE Teams   (Brisbane)
```

Each regional parent contains the individual teams (Worship, Host, People, Favor Kids, CRTVS x
Prod, Prayer, Grow, Events, Tech, Socials, Security, Parking, Street, Movement, Logistics, Deaf,
Fitness, Care, …). Manila has the deepest structure, including governance/HR groups modelled as
teams (Staff, Pastors, Local Board, Contractual Hire and Suppliers, Volunteer Staff).

Campus prefixes use IATA city codes: **MNL** = Manila, **BNE** = Brisbane, **SEL** = Seoul.

## Best practice when querying

- Use `rock_ministry` `groups` with `kind:'ministryTeam'`, `groupMembers` for rosters, and
  `leaderCount` for distinct leaders.
- Team membership is the source of truth for "is serving"; pair with `connection-status`.
- Volunteer onboarding/offboarding is driven by workflows — see `volunteer-onboarding`.

## Related

`volunteer-onboarding` · `connect-groups` · `connection-status`
