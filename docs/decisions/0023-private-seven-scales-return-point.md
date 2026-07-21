# ADR 0023: Private Seven Scales Return Point

**Status:** Accepted for private return-point v1 foundation | **Date:** 2026-07-20

## Context

Seven Scales to Jezero is a release-pinned, manually advanced semantic tour. Explorers need a deliberate way to leave and later reopen one scale, but automatic progress tracking would turn ordinary navigation into account activity and could imply completed lessons, mastery, achievement, assessment, or discovery. Browser persistence would also conflict with the fail-closed private-state boundary used by My Atlas.

The frozen tour has exactly seven stops and one immutable foundation release. That permits a small v1 contract whose valid stop, title, target, and URL mappings are all derived by the server rather than accepted from the client.

## Decision

- Store at most one private return point per owner for `tour_seven_scales_to_jezero_v1` and `rel_landing_atlas_v0_1_0`. The only write action is the explicit **Save this scale for later** control. Next, Back, Evidence, transcript use, target selection, deep-link loading, and passive viewing never write it.
- Treat the record only as a navigation aid. Its exact truth object permanently states that it is user-confirmed resume state, does not define the tour, and makes no passive-navigation, completion, achievement, mastery, assessment, or scientific-discovery claim. Saving or loading never jumps automatically.
- Expose strict private/no-store GET, PUT, and DELETE operations at `/api/v1/me/tours/seven-scales-to-jezero/resume`. The public record contains the frozen tour identity, one server-derived stop mapping, canonical exact-release URL, save time, exact method, and truth object; it never accepts or exposes a user ID.
- Accept only `tourId`, `releaseId`, `resumeOrdinal`, and `expectedSavedAtMs` on PUT, and only `expectedSavedAtMs` on DELETE. A null expectation creates the record; an exact positive timestamp updates or deletes it. Stale or ambiguous operations fail with a conflict and require a fresh read before controls can mutate state again.
- Derive every public and stored field from code-owned tour data. Runtime assertions pin the tour title plus all seven ordinal, stop ID, stop title, target entity, and canonical URL mappings so copy drift cannot silently rewrite durable meaning.
- Enforce the exact owner/tour/metric tuple, method, release, ordinal mapping, canonical JSON, JavaScript-Date timestamp range, and monotonic save time in D1. Updates first validate the complete old row and use compare-and-swap predicates over the old timestamp, ordinal, payload, and owner tuple. Drift fails closed and cannot be silently healed through an otherwise valid update.
- Keep the controls behind the lazy tour experience and the summary inside the route-local daylight My Atlas workspace. Initial reads do not steal focus. Conflicts and ambiguous network results enter a dedicated reconciliation state; the user must explicitly reload the private point before saving or clearing again.
- Provide no browser-storage fallback, completed-stop ledger, score, badges, automatic resumption, background sync, sharing, public profile, or learning assessment in v1.

## Consequences

An explorer can intentionally keep one exact return location without being passively tracked or having navigation reinterpreted as progress. Moving the point backward is valid because it is a bookmark-like return location, not a monotonic completion marker.

The record is deliberately narrow. Multiple bookmarks, completed-stop histories, annotations, curriculum state, learning activities, cross-release migration, shared tours, and AI-guided tutoring require separate contracts and product decisions. A future tour revision cannot silently reuse this record unless its exact release and stop mappings remain valid under a versioned migration.

## Validation

SQLite probes and ephemeral workerd/D1 tests cover exact insert/update/delete envelopes, empty reads, all seven mappings, strict JSON and 4 KiB limits, owner isolation, stale expectations, concurrent writers, immutable owner identity, canonical old-state validation, retained-timestamp drift, direct-SQL healing attempts, private cache headers, unavailable storage, and no browser fallback. Client and rendered checks cover exact canonical URLs, scheme-relative rejection, explicit-only writes, focus-neutral initial loading, explicit resume, inline nonmodal clear confirmation, query-preserving sign-in links, conflict reconciliation, same-ordinal focus, final-scale wording, daylight My Atlas presentation, full-cosmos focus restoration, and lazy bundle boundaries.
