# ADR 0002: Evidence-Aware Semantic Zoom Across Coordinate Domains

**Status:** Proposed | **Date:** 2026-07-18

## Context

The observable universe, stellar catalogs, Solar-System ephemerides, planetary globes, and rover terrain do not share one useful precision scale, coordinate frame, time meaning, uncertainty model, or rendering technique. A single Euclidean scene would create precision failures and scientific ambiguity.

## Proposed decision

Present a continuous-feeling journey while transitioning among separately governed scene domains:

1. celestial sphere/survey imagery;
2. cosmological light-cone and galaxy layers;
3. Galactic/local-star space;
4. Solar-System dynamics;
5. body globe/terrain;
6. local surface/instrument space;
7. specialized scientific simulations.

A common scene contract carries entity identity, frame/origin, epoch/time scale, observer/correction, uncertainty, truth labels, source release, lineage, rights, and display transforms. CPU/services retain Float64 authoritative state; GPU renderers use hierarchical/camera-relative coordinates.

## Consequences

- “Infinite zoom” is an experience metaphor, implemented as semantic LOD and domain handoffs.
- Several renderers may coexist behind one navigation/product shell.
- Transitions require deterministic scientific and camera transforms plus validation.
- Data can retain its native scientific domain instead of being forced into invented 3D geometry.

## Acceptance

The decision becomes Accepted only after the Stage 1 benchmark proves precision, reversible transitions, performance, accessibility, evidence overlays, and deployment/license viability.
