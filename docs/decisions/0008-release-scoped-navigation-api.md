# ADR 0008: Hash-Bound Release-Scoped Navigation API

**Status:** Accepted for API foundation | **Date:** 2026-07-19

## Context

The embedded atlas already carried a release identifier, but its first public endpoint was statically built even though it accepted search parameters. In the packaged Worker, every `q` and `section` request therefore returned the same unfiltered response. The D1 foundation schema also contains release rows and an active-channel pointer, but those rows do not contain the complete scientific registry and the seed is not a production signature authority. Treating any D1 row—or a mutable “latest” alias—as sufficient serving authority would let metadata drift under an apparently immutable release ID.

Cosmography needs a small, deterministic navigation/search contract now without implying that the foundation fixture is a signed production publication or pulling bulk science into D1.

## Decision

- Public navigation endpoints are explicitly path-scoped to one opaque release ID: `/api/v1/releases/{releaseId}`, `/registry`, `/registry/{entityId}`, and `/search`. There is no implicit current/latest fallback. Malformed IDs fail with `400`; well-formed but unavailable IDs fail with `404`.
- This checkpoint serves only a code-known embedded foundation bundle. A D1 release row, active-channel value, client parameter, network response, or connector record cannot register another serveable release.
- The foundation manifest records the canonicalization, SHA-256, exact counts, registry-projection revision, and search-ranker revision for a normalized bundle containing all 15 entities, 9 public source references, and 13 agency records. The D1 seed pins the SHA-256 of that manifest, transitively binding the content and derivative revisions. Every API request passes a cached runtime digest check before the bundle is served.
- `cosmography-navigation-bundle-json-v1` is deliberately distinct from governance signing canonicalization. It accepts finite JSON values, preserves array order, sorts object keys by ECMAScript UTF-16 code-unit order, and omits object properties whose value is `undefined`; golden-vector tests pin this behavior.
- Entity source references are unique and must match the canonical public source record value-for-value. The API exposes public citation metadata only; connector authentication references, kill switches, quotas, and runner controls remain outside this contract.
- Registry and search handlers remain dynamic so parameters are evaluated by the built Worker. Parameters are single-valued and allowlisted; filters and limits are strict; search uses bounded NFKC normalization, deterministic ranking, stable tie-breaking, and truth-label/source retention. Pagination cursors bind the release, mode, normalized query, and filters and are never authorization tokens.
- Successful responses carry a SHA-256 response ETag, content digest, release ID, and derivative revisions. Because the current foundation bundle is not yet governed by signed production activation, caches use bounded browser/CDN freshness plus revalidation rather than a year-long `immutable` directive. Errors are `no-store`; `If-None-Match` uses weak comparison for safe `304` responses. Production immutable caching remains gated on content-addressed derivative identity and activation policy.
- The legacy `/api/atlas` route remains temporarily available but now evaluates requests dynamically, requires an explicit `release` parameter, rejects ambiguous parameters, and advertises the v1 registry as its successor.
- Shareable atlas scene URLs may omit `release` only for an intentional entry into the current bundled experience. Once a URL carries a release ID, an unavailable or duplicate value returns `404` rather than silently falling forward to different content.

## Consequences

- Changing any bundled entity, source, agency, count, registry projection, search ranking, or release metadata requires a new derivative revision, canonical digest, and manifest hash; a test fails if a pinned value drifts. Cursor context includes both derivative revisions, so old cursors cannot silently traverse a changed ordering.
- Search and pagination remain intentionally small navigation-index operations. Gaia-scale catalogs, geometry, imagery, kernels, time series, and full-text infrastructure stay in immutable objects or specialist services.
- The foundation bundle is a hash-bound development fixture, not proof of signed publication. Production registry storage, signed manifest verification, active-release resolution, activation authorization, CDN invalidation, and rollback operations remain separate reviewed gates.

## Validation

Pure contract tests verify canonicalization, bundle/manifest hashes, counts, unique identifiers, source membership, deep immutability, deterministic search/ranking, multi-page traversal, derivative/filter binding, query bounds, and cursor rejection. Built-Worker tests prove that different queries and filters produce different results, exercise release and entity fail-closed behavior, reject duplicate/unknown parameters and invalid limits, verify bounded/no-store cache boundaries and `304` handling, and prevent regressions to the legacy static-query bug.
