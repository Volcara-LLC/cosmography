# ADR 0004: Durable Control-Plane and User State

**Status:** Accepted | **Date:** 2026-07-19

## Context

Cosmography needs durable accounts, private routes, bookmarks, ships, discoveries, progress, content releases, and rollback pointers. It also needs Gaia-scale catalogs, kernels, terrain, images, video, meshes, and time series. Treating those workloads as one database would make the Sites deployment expensive, brittle, and scientifically incomplete.

## Decision

- Use D1 for curated metadata, immutable release records, active release pointers, small navigation indexes, and durable user state.
- Use dispatch-owned identity and store a versioned keyed HMAC of the normalized identity plus an optional bounded display name; never store raw email, encoded forwarded headers, credentials, or browser storage as the authoritative account database.
- Scope every personal query explicitly by authenticated `user_id`, because D1 does not provide application row-level security.
- Keep routes private by default and distinguish physical, hypothetical, fictional warp, and instant map navigation in both storage and UI.
- Store immutable permitted media/manifests in R2 and keep bulk catalogs, geometry computation, kernels, and time series in authority archives or specialized services.
- Freeze external requests, versions, timestamps, and checksums before a derived product can enter a release.

## Consequences

- D1 remains operable and inexpensive because it is not used as a science warehouse.
- A later Postgres/PostGIS or columnar service can replace a specialist backend without changing the account or release contract.
- User-data deletion, retention, authorization, backup, and recovery require explicit operational procedures before public accounts launch.
- Identity and database bindings must fail closed in preview/test environments rather than silently storing local substitutes.
- HMAC rotation uses explicit current/previous key versions and dual-key lookup. All matching versions must resolve to one application user, and a verified concurrent winner may be accepted only for the same HMAC/user mapping. Previous mappings remain until an active-user coverage query reaches zero missing current-version identities; losing an old key before migration makes dormant mappings unrecoverable.
- Forwarded identity headers are trusted only behind the dispatch-owned Sites authentication boundary. A separately reachable Worker endpoint would require signed assertion validation or an equivalent independently reviewed boundary.
- Email is mutable and can be reassigned. Public durable accounts remain blocked until Sites exposes a stable provider subject or an independently reviewed migration, reassignment, recovery, and deletion process exists.
- Personal responses are explicitly `private, no-store`; no intermediary cache may become authoritative for account data.
- The foundation release uses one canonical `rel_` identifier across the embedded atlas, D1 seed, APIs, bookmarks, routes, and discoveries. Foreign keys, strict hashes, publication-state triggers, and route ownership constraints fail closed on inconsistent writes.

## Validation

The generated migration creates 13 constrained tables, a hash-verified canonical foundation seed, and release/ownership triggers. Tests prove release foreign keys, strict hashes, published immutability, active-channel gating, cross-route rejection, spacecraft ownership, cache controls, and anonymous fail-closed behavior. A workerd-backed non-production harness applies the exact packaged migration and proves account creation, bookmark upsert/list/delete, route create/list/delete, cross-account isolation, route-batch rollback, concurrent first use, dual-key migration, retirement coverage, conflict rejection, and post-retirement continuity with in-memory secrets. A hosted private migration, dispatch-boundary verification, exact R2-manifest verification, backup/restore, and stable-subject/recovery design remain mandatory before public use.
