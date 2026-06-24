---
id: data-hygiene
title: Data Hygiene & Deduplication
aliases: [data hygiene, duplicates, dedup, cleanup, data quality]
tags: [data-quality, hygiene, reports, config]
---

## What it is

Practices and tooling for keeping Favor's Rock data clean — duplicates, stale records, and config
drift.

## Built-in integrity reports

Rock ships four data-integrity reports that Favor relies on (see `reporting`):

- **Self Inactivated Individuals**
- **Pending Individuals** (web/registration sign-ups awaiting staff confirmation)
- **Individuals with Duplicate Phone Numbers**
- **Individuals with Duplicate Emails**

## Known config-hygiene issues (tracked)

- **Duplicate workflow types**: `Child Dedication` (37 & 38), `Congratulatory Email` (65 & 67).
- **Duplicate attributes**: `Server Key (Legacy)` (6853 & 6857), `Show Legacy Signature Providers`
  (5164 & 5748).
- **Active legacy attributes** to review/retire: `Person Token Use Legacy Fallback` (2130),
  `Registration Mode (Legacy Check-in)` (3095), `Enable Legacy Reload` (6258).

Pick one canonical record each and archive duplicates after confirming references.

## Best practice when querying

- Use `rock_report` to run the integrity reports; export datasets rather than dumping rows.
- Record Status `Pending` is the triage queue — review before activating to avoid duplicate person
  records.

## Related

`reporting` · `connection-status` · `security-best-practices`
