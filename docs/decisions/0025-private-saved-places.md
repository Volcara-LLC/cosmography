# ADR 0025: Private Saved Places v1

**Status:** Accepted for private saved-places v1 foundation | **Date:** 2026-07-20

## Context

The first account bookmark route accepted caller-supplied labels and a loose scene object, while My Atlas offered no list, canonical reopen action, or confirmed removal flow. That shape could retain metadata the server had not derived from the immutable release and did not distinguish a deliberate navigation aid from a physical camera pose, passive visit, observation, encounter, route, progress record, or discovery.

Cosmography needs a small private return list before broader account features, but the frozen foundation release, owner isolation, and false-authority boundaries must remain exact. A partial database migration must also fail closed rather than silently normalizing older loose rows.

## Decision

- Pin v1 to the exact 15 entities in release `rel_landing_atlas_v0_1_0`, the two appearances `scientific` and `immersive`, and fixed scene-time context `2026`. The server derives the entity name, slug, kind, domain, focus, release, canonical reopen URL, method, timestamp, and truth flags from frozen release records.
- Accept exactly `{entityId, appearance, releaseId}` for a save and exactly `{id, expectedSavedAtMs}` for removal. Require `application/json`, fatal UTF-8 decoding, no query parameters, and at most 4 KiB. Unknown fields, stale releases, aliases, malformed identifiers, and caller metadata fail closed.
- Store at most one row per owner, entity, and release, capped at 15 rows per owner. A repeated explicit save updates that row with a strictly newer timestamp and selected appearance; the first insert returns `201` and an update returns `200`. Listing is newest-first with deterministic ID ordering for ties.
- Version the stored canonical payload and database row as `cosmography.user-saved-places` / `1.0.0`. Cross-bind the row ID, owner, entity, navigation target, release, canonical name, null R2 key, timestamp, appearance, domain, method, and every literal truth flag. Parse the retained row before returning, updating, or deleting it so a drifted row cannot be healed by a later write.
- Adopt only pre-existing rows whose bytes already match the v1 contract. Migration `0004_private_saved_places_v1.sql` preflights retained rows, adds `contract_version`, and installs insert/update triggers that reject noncanonical writes, immutable-identity changes, timestamp rollback, duplicate tuples, cross-owner ID replacement, `INSERT OR REPLACE`, and conflicting upserts. Every API request verifies both exact triggers exist; databases stopped before migration 0004 return storage unavailable without changing loose bytes.
- Keep all reads and mutations account-scoped, private, and `no-store`. Public responses expose only the versioned exact-release envelope and derived navigation record; they never expose owner IDs, retained JSON, R2 keys, authentication subjects, or secrets. Removal uses an owner-scoped saved-time compare-and-swap and an inline confirmation with deterministic focus restoration.
- Write only after the explorer presses **Save place**. Loading, selecting, orbiting, zooming, entering full cosmos, opening a tour, and reopening a record never create or refresh one. There is no browser-storage fallback, passive synchronization, cross-release fall-forward, sharing, folder/note system, physical pose, observation, encounter, route, progress, completion, mastery, achievement, or discovery authority.

## Consequences

An authenticated explorer can explicitly save, list, reopen, update, and remove any foundation destination while preserving its exact release and appearance. Signed-out, unavailable, error, empty, ready, conflict, and ambiguous-removal states remain truthful, and My Atlas stays useful as a daylight private workspace.

This is a bounded private navigation list, not a visit log, camera-state system, scientific notebook, social collection, or claim that the 15-entity seed is complete. It adds no catalog record, scientific measurement, asset byte, rights decision, publication authority, hosted database, secret, production ingress, deployment, or public-release readiness. The feature can be rolled back independently at commit `3549d16d67bdad8a33e82e687478941b224309fe` without changing the frozen release bundle.

## Validation

Web lint, production build, 69 Node tests, and 125 TypeScript tests pass. The suites cover the strict request/envelope contract, exact 15-entity binding, canonical retained bytes, owner isolation, first-insert/update status, monotonic updates, compare-and-swap removal, quota/order/uniqueness, partial migration, positive canonical adoption, stale release rejection, direct-SQL drift, replacement/upsert collision, loading/signed-out/unavailable/error/empty/ready UI, confirmed deletion, focus restoration, forced colors, reduced motion, mobile controls, and absence from the eager home graph. The unchanged packages pass 64 scientific-model, 120 relativity, and 71 connector tests. An independent threat review found no remaining P1 or P2 issue.

The measured home graph is 346,610 raw / 112,221 gzip bytes of eager JavaScript and 142,479 raw / 29,002 gzip bytes of global CSS. The lazy personal-storage client is 5,253 raw / 2,235 gzip bytes; the lazy My Atlas hangar graph is 52,019 raw / 11,949 gzip bytes plus 36,603 raw / 6,881 gzip bytes of route-local CSS. Browser QA covers the My Atlas loading and signed-out states plus the atlas save-to-sign-in return path; authenticated lifecycle coverage runs against ephemeral workerd/D1. GitHub push run `29758422154` and draft-PR run `29758426736` passed all eight jobs.
