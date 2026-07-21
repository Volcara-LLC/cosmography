# ADR 0024: Foundation Projected Labels

**Status:** Accepted for foundation projected-label v1 | **Date:** 2026-07-20

## Context

The foundation atlas contains exactly 15 immutable release entities, but its previous marker treatment did not remain attached to the rendered scene as the camera moved and could make the interface look like a dark control wall around an unlabeled center. Cosmography needs readable names and designations inside the immersive view without implying that procedural renderer particles are measured catalog objects, that semantic scene anchors are astrometric coordinates, or that a small release seed is complete sky coverage.

The frozen navigation release cannot be rewritten to add presentation state. A separate derivative label projection therefore has to bind the exact release identities while keeping its own canonical identity and explicit false-authority claims.

## Decision

- Bind the projected-label set to release `rel_landing_atlas_v0_1_0`, raw manifest SHA-256 `e1dc9decfb38fa4996a4fe163dd5eba2b8fc448bea7a9d717a1a4febb3cf5b0e`, and foundation bundle SHA-256 `beeac15802d8ee504bef88607dcf06dcc052c72e9653ba3213eb0fc966d8ced3`. Its separate canonical label-and-peer-graph digest is `184c5869ec7adb320d53f3028957abfe3499e18d2afee82e966ab2cb58af5f97`; it does not modify the frozen navigation release.
- Include exactly the 15 release entities in frozen release order and derive every displayed primary name from the release records. The only alternate designation is the already source-backed `M31` for Andromeda. No generated nickname or inferred catalog alias is admitted.
- Treat anchors as renderer-local semantic placement only. Project each anchor through its renderer root world matrix and active camera, and reject non-finite, behind-camera, near/far-clipped, or off-frustum results. Do not clamp a rejected label to a screen edge. These positions are not astrometry, physical proximity, body-fixed coordinates, proper motion, or identities for procedural particles.
- Permit only explicit same-renderer semantic peers. Domain coincidence alone is insufficient. Cross-domain parent/child navigation remains in the shell because coordinates are not interchangeable between render domains. The selected entity is always considered first.
- Retain zoom-tier hysteresis in renderer state: overview enters context at `0.36`; context returns to overview below `0.28`, enters detail at `0.72`, and detail returns to context below `0.64`. Continuous camera updates are capped at 30 Hz with one forced trailing snapshot, while travel, resize, reset, completion, cancellation, and restoration publish an immediate truthful state.
- Use deterministic selection and collision layout with caps of 1, 2, and 6 by tier and a compact cap of 5. Sort by selected state, explicit peer status, section match, priority, and code-point entity ID; test four placements against viewport and reserved chrome; reserve the complete label target; and backfill after invalid, off-screen, reserved, or colliding candidates.
- Load the label interface lazily. Ready in-frame labels are native buttons with visible primary names, optional designations/details, 44 px targets, selected state, and descriptions that disclose semantic placement and false astrometric/proximity/streaming/completeness authority. If no clear in-frame anchor exists—or the renderer is unavailable—show a truthful selectable non-positional Foundation destinations list rather than removing navigation or inventing a location.
- Keep **Names & designations** independently toggleable. Other unimplemented scientific layers remain disabled rather than acting as placebo controls, and `2026` is disclosed as fixed scene context rather than an active time-varying scientific layer. Full cosmos removes surrounding chrome and pseudo-wings but preserves camera interaction, label/list selection, a subtle exit control, Escape handling, and focus restoration.
- Use welcoming daylight, high-contrast navigation and reading surfaces outside immersive canvases. Reserve dark plates for labels placed over space, terrain, journey-stage, and relativity renderers. This presentation decision does not change scientific or release state.
- Keep the literal truth flags false for catalog completeness, external streaming, scientific position, physical proximity, and procedural-particle identity, and make no proper-motion, body-fixed-placement, validation, publication, release-activation, or deployment claim. Adding real catalog tiles or measured coordinates requires a new governed data and rendering contract.

## Consequences

Explorers can identify and select the exact foundation destinations while orbiting, zooming, using a structured profile, or entering full cosmos. The interface remains useful when a semantic anchor cannot be placed clearly, and ordinary product chrome no longer visually boxes the dark renderer.

This is a bounded presentation projection, not catalog ingestion. It adds no source records, measurements, artifact bytes, rights clearance, scientific validation, release membership, hosted resource, or production capability. The feature can be rolled back independently at commit `074ccfcc407a359bd26a98b909a4911b1ed5e81a` without changing the frozen release or its bundle.

## Validation

Web lint, production build, 61 Node tests, and 114 TypeScript tests pass. Focused identity, projection, deterministic-layout, and UI suites pin the exact 15-entity set, `M31`-only designation, canonical peer-graph digest, false-authority flags, frustum rejection, hysteresis, collision backfill, reserved chrome, structured fallback, full-view behavior, keyboard focus, narrow layouts, forced colors, reduced motion, and target sizes. Browser QA covers desktop, portrait, short landscape, narrow split view, projected and zero-clear-anchor states, labels on/off, selection, and full-view entry/exit.

The measured home graph is 346,053 raw / 112,045 gzip bytes of eager JavaScript and 142,479 raw / 29,002 gzip bytes of global CSS. The lazy label UI is 7,750 raw / 2,699 gzip bytes of JavaScript plus 5,680 raw / 1,663 gzip bytes of CSS; the shared renderer graph is 548,150 raw / 138,942 gzip bytes. GitHub push run `29754266484` and draft-PR run `29754269404` passed all eight jobs.
