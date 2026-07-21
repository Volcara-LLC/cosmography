# ADR 0022: Private User-Confirmed Recorded Encounters

**Status:** Accepted | **Date:** 2026-07-20

## Context

Cosmography needs a personal memory surface without turning ordinary browsing into surveillance or turning an object count into a claim of exploration, learning, achievement, or scientific discovery. The durable control-plane schema already contained a dormant `user_discoveries` table with legacy `first_seen`, `last_seen`, and `visit_count` column names, but no approved write semantics, exact public contract, database invariants, or user interface.

The foundation atlas contains 15 exact release members. A v1 encounter can therefore bind to known immutable release content without accepting arbitrary entity strings or silently falling forward to a future release.

## Decision

- Call the feature **recorded encounters**, not discoveries, visits, progress, achievements, or completion. An encounter is created only after the user presses “Record this encounter” in an object's Evidence panel. Selection, navigation, viewport interaction, full view, tours, and page loads never write it.
- Bind v1 writes to one of the 15 members of `rel_landing_atlas_v0_1_0`. Store the exact first release with the record and resolve public entity name, kind, domain, and evidence-bound link from the immutable release registry.
- Expose legacy storage columns explicitly as `firstRecordedAtMs`, `lastRecordedAtMs`, and `recordCount`. The record method is exactly `manual-atlas-record`. The public truth object permanently states that the record is user-confirmed and that passive navigation, completion, achievement, and scientific-discovery claims are false.
- Treat the data as private account state. Every collection or item read/mutation derives the owner from the authenticated dispatch identity, returns private/no-store responses, and never accepts or exposes a user ID. No browser-storage fallback is allowed.
- On a repeated explicit press, retain the immutable first timestamp and first release, advance the latest timestamp monotonically, and increment the count exactly once. Cap each owner at 200 distinct recorded objects.
- Enforce the exact entity set, method, release, JavaScript-Date timestamp range, chronology, count, and immutable owner/history fields in D1 triggers. Reject replacement/upsert reset paths. Use an update-first, insert, and conflicting-insert retry sequence so concurrent first writes resolve to exact counts instead of losing or resetting history.
- Return exact versioned envelopes. Item removal and clear-all operations require exact acknowledgements before the client changes its visible history. Ambiguous network outcomes tell the user to reload rather than falsely claiming success or failure.
- Keep the recorder behind the already-lazy Evidence panel and keep the history inside the route-local daylight My Atlas workspace. Sign-in links retain the current path, query, and hash. Initial storage checks never steal focus; a user-triggered unavailable transition restores focus to its status.

## Consequences

- Explorers can intentionally keep a small private memory of atlas objects without being passively tracked.
- A count means only how many times the user pressed the record action for that object. Only first and latest timestamps are retained; this is not a continuous path or a complete ledger of every intermediate moment.
- The first version is deliberately limited to the foundation release. Adding new release members, merging aliases, or carrying records across changed entity identities requires a versioned contract and migration rather than silent coercion.
- Removing one record or clearing the collection is destructive private-state deletion and therefore requires an explicit inline confirmation with keyboard focus recovery.
- Tour resume state, learning activities, annotations, sharing, social features, public profiles, scoring, badges, and scientific contribution workflows remain separate decisions.

## Validation

Migration probes reject passive methods, unknown entities/releases, invalid chronology, count skipping, owner or first-history rewrites, `INSERT OR REPLACE`, `OR IGNORE`, upsert, and insert-select bypasses while leaving the original row unchanged. Workerd tests cover exact envelopes, strict JSON and 4 KiB limits, five-way concurrent writes with counts 1–5, owner isolation, foreign/missing deletion equivalence, clear-all scoping, drifted storage, and private cache headers. Client and UI checks cover exact record and acknowledgement parsing, 200/201 write responses, no passive POST, no browser persistence API, fresh return URLs, user-triggered focus recovery, daylight AA contrast, 12 px text, 44 px controls, reduced motion, and lazy home-bundle exclusion.
