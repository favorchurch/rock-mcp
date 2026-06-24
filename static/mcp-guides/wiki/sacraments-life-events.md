---
id: sacraments-life-events
title: Sacraments & Life Events
aliases: [baptism, water baptism, child dedication, wedding, pre-marital, funeral, wake]
tags: [workflows, groups, sacraments, life-events, process]
---

## What it is

Favor tracks sacraments and life events through a mix of GroupTypes, Workflows, and Connection
Types — several of them **payment-enabled**.

| Event | How it's modelled |
|---|---|
| Water Baptism | GroupType #38 + workflow `Water Baptism 2026` + connection type `MNL \| SS \| Water Baptism` |
| Child Dedication | GroupType #43 (`MNL \| Child Dedication`) + dedication workflows + `Dedication Request (with payment)` |
| Weddings / Pre-Marital | `Before Forever` course, `Pre-Marital Counseling`, `Wedding Application w/ Payment` |
| Wake & Funeral | `Wake & Funeral Service Request` workflow |

## Best practice when querying

- Use `rock_workflow` for in-flight requests; use `rock_ministry`/`rock_entity` for the resulting
  group memberships (e.g. a baptism cohort).
- Payment-enabled workflows tie into Rock's financial transactions — treat financial data as
  **sensitive** and only surface on explicit request.

## Config note

There are **two** `Child Dedication` workflow types (IDs 37 and 38) and two `Congratulatory Email`
types (65 and 67). Confirm which is canonical before acting — see the config-hygiene strategy issue.

## Related

`volunteer-onboarding` · `discipleship-fdna-build` · `reporting`
