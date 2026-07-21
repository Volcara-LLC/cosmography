# ADR 0005: Lazy Semantic Render Domains and Explicit Display Profiles

**Status:** Accepted for the web foundation | **Date:** 2026-07-19

## Context

The initial atlas route statically imported one 554,303-byte viewport chunk that was approximately 96.6% Three.js. The home route therefore preloaded about 955,991 raw bytes / 262,197 gzip bytes of JavaScript before a user interacted with the visualization. The same module also contained all eight procedural domains, so every route paid for unrelated builders.

Cosmography needs continuous-feeling navigation, but it does not have one universal coordinate or rendering domain. Display workload must also adapt without changing measurements, evidence, source releases, frames, epochs, uncertainty, or representation labels.

## Decision

- Keep `UniverseViewport` as a lightweight, server-rendered accessibility and interaction host. Its structured description and canvas fallback remain present before WebGL code loads.
- Load the WebGL2 renderer only after hydration, then load exactly one literal semantic-domain module: cosmic, galactic, system, globe, surface/panorama, or relativity.
- Keep the shared Three.js engine lazy. Domain modules may share that engine but cannot enter the home route's eager preload graph.
- Use WebGL2 as the actual baseline by requesting a WebGL2 context, not by checking the obsolete WebGL1 constructor symbol.
- Expose display profiles named `structured`, `efficient`, `balanced`, and `fidelity`, plus an `auto` request. These names remain distinct from scientific validation tiers.
- Allow profiles to change only framebuffer limits, deterministic procedural density, and motion cadence. Scientific and publication state is invariant across profiles.
- Start `auto` at the portable balanced profile and permit downgrade only after three consecutive failing two-second windows. Never auto-upgrade during a session.
- Bound effective device-pixel ratio by device DPR, component/profile caps, and a framebuffer-pixel budget. This permits DPR below 1 on very large displays.
- Stop animation while the page is hidden. Reduced-motion and the user's Pause choice remain authoritative.
- Expose portable diagnostics—profile/reason, WebGL version, framebuffer, frame intervals, draw/resource counts, domain-build time, and context loss—without GPU-vendor fingerprint data.

## Performance contract

- Home eager JavaScript: at most 425,000 raw bytes and 130,000 gzip bytes.
- Global CSS: at most 30,000 gzip bytes.
- Shared lazy renderer: at most 145 KiB gzip; pinned lazy Three.js module at most 540,000 raw bytes.
- Each semantic domain: at most 15 KiB gzip.
- Efficient: 30 fps target, 1.0-megapixel framebuffer cap, 50% procedural point density.
- Balanced: 60 fps target, 2.1-megapixel cap, 75% density.
- Fidelity: 60 fps target, 4.1-megapixel cap, full foundation density.
- Structured: complete HTML atlas and controls without WebGL.

## Consequences

- The home route no longer downloads Three.js or any semantic renderer domain eagerly.
- Domain changes intentionally load and construct a new evidence-labeled procedural scene; preserving a single renderer across domain handoffs remains a later benchmark optimization.
- Lower-density procedural buffers are deterministic prefixes of the full seeded fixture, so profiles do not invent different catalog claims.
- Real target-device measurements, camera-handoff precision, GPU context-loss drills, and reference-hardware frame budgets remain required before the Stage 1 renderer gate can pass.
- The current procedural relativity domain remains a labeled placeholder; lazy loading does not promote it to validated Kerr ray tracing.

## Validation

The checkpoint production build server-renders the accessible viewport while its module manifest exposes one lazy engine and six literal semantic-domain chunks. Automated tests verify eager-route exclusion, raw/gzip budgets, profile classification, monotonic downgrade, three-window hysteresis, framebuffer caps, and deterministic density counts. At this checkpoint the home preload graph is approximately 409,343 raw bytes / 125,529 gzip bytes; the shared lazy Three.js module is approximately 535,762 raw bytes / 132,994 gzip bytes.
