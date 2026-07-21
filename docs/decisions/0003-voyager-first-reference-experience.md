# ADR 0003: Voyager 1 as the First Reference Experience

**Status:** Accepted | **Date:** 2026-07-18 | **Accepted:** 2026-07-19

## Context

The first experience must exercise the platform's hardest cross-cutting systems without requiring mass catalog and terrain ingestion. Candidate stories include Voyager 1 and Jezero/Perseverance.

## Proposed decision

Build Voyager 1 first, followed by Jezero/Perseverance.

Voyager crosses Earth launch history, mission chronology, SPICE/Horizons geometry, planetary encounters, image capture context, heliophysics, present-position semantics, future prediction, media rights, and semantic scale transitions. Jezero then adds the missing terrain, planetary CRS, rover path, panorama, sample, and surface-measurement proof.

## Consequences

- The first release will validate the platform kernel across many scales with a bounded source set.
- Detailed terrain is deferred to the second reference experience, not removed from the product vision.
- The user experience can be emotionally complete while the broad universe catalog remains representative rather than comprehensive.

## Acceptance

The decision becomes Accepted when the owner confirms Voyager 1 after reviewing the research and roadmap.
