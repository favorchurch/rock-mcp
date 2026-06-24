---
id: reporting
title: Reporting & Datasets
aliases: [reports, reporting, dataset, datasets, analytics, dashboard]
tags: [reports, analytics, datasets]
liveBinding:
  kind: reports
---

## What it is

Rock Reports produce report-like tables/dashboards. They run through **datasets**, not raw dumps.

## Current state (best practice for expectations)

Favor currently has only the **4 stock data-integrity reports** (Self Inactivated, Pending
Individuals, Duplicate Phone Numbers, Duplicate Emails) — no custom Rock Reports. Most
analytics happen *outside* Rock's report engine (via connections/workflows/external tools). Set
expectations accordingly when a user asks for a "report".

## How to run reports

1. `rock_report` `list` to find a report.
2. `rock_report` `run` (by reportId) → returns a `datasetId`.
3. `rock_report` `summary` / `export` / `app` to view results. `Reports/run` can 404 — use
   `$select=Id` when you only need counts.

Return a **summary + preview rows + a `datasetId`** for large results; don't inline all rows. Use
the MCP App (`app` action) for full tables.

## Related

`data-hygiene` · `connection-status`
