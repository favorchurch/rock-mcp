---
id: discipleship-fdna-build
title: "Discipleship: Favor DNA & BUILD"
aliases: [fdna, favor dna, build, discipleship, grow, growth track]
tags: [discipleship, workflows, groups, grow, process]
liveBinding:
  kind: attribute
  match: personLifecycle
---

## What it is

Favor's growth/discipleship path runs people through two multi-session courses, tracked by
dedicated Rock Workflows that advance attendees through group "sessions":

- **Favor DNA (FDNA)** — `Favor DNA`, `Favor DNA - Saturday`, and the progression workflows
  `Update FDNA Group (Signup → Session 1 → Session 2)`.
- **BUILD** — `Build`, `BUILD ONLINE` (+ Saturday variant), `Update BUILD Group
  (Signup → Session 1 → Session 2)`, and `BUILD GRADUATION`.

The Connection Type **`MNL | Grow | Build & FDNA`** ties the pipeline together.

## How it relates to lifecycle

Completing FDNA/BUILD is part of moving a person toward **Core** and **Leader**. The person's
lifecycle stage lives in the connection-status value plus a discovered **person lifecycle
attribute** (see live values below for the current canonical attribute).

## Best practice when querying

- Use `rock_workflow` `workflowTypes` to enumerate the FDNA/BUILD progression workflows and
  `workflowStatus` for a specific run.
- Session progression is modelled as group membership changes driven by the `Update … Group`
  workflows — read the target group's membership for current cohort state.
- Saturday variants exist for most steps; don't assume a single weekly cadence.

## Related

`connection-status` · `volunteer-onboarding` · `sacraments-life-events`
