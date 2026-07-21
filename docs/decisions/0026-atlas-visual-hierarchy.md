# ADR 0026: Atlas Visual Hierarchy and Responsive Chrome

**Status:** Accepted for atlas visual-hierarchy foundation | **Date:** 2026-07-20

## Context

The first welcoming-atlas pass gave Cosmography light interface surfaces and a chrome-free full-cosmos mode, but the desktop shell still read as dark side walls enclosing a center canvas. At phone, tablet, split-screen, and short-landscape sizes, the destination card, label fallback, tools, timeline, release state, and compass could also compete for the same pixels. Narrative copy on the Earth, surface, mission, and directory routes retained several operational-size text rules that were too small for comfortable reading.

The atlas needs to feel like one full-viewport sky with approachable instruments around it. That visual change cannot weaken the existing truth boundary: projected foundation labels remain semantic display anchors, structured fallback remains non-positional, and full COSMO must not remove navigation or keyboard recovery.

## Decision

- Reserve darkness for space, terrain, journey, map, and simulation canvases. Navigation, explanation, destination, directory, and private-account reading surfaces use opaque daylight substrates with destination-specific accents and tested text/control contrast.
- Present the header, scale rail, destination card, scene tools, scene-time card, and release state as separate edge instruments instead of continuous opaque side walls. The sky remains visible between them, while every text-bearing plate stays opaque enough to read.
- Keep full COSMO genuinely chrome-free. The exit remains a visible 46 by 44 pixel native button; entering moves focus to it, Escape restores the originating Full view control, and the selectable foundation-destination fallback remains available when real-time rendering is unavailable.
- Use a closed-by-default native `details` disclosure for the truthful Foundation destinations list at widths through 1024 pixels and in wider short viewports. It is selected-first, keyboard-native, vertically bounded, and remains an interface list rather than pretending to be a projected sky position. Full COSMO retains the complete list.
- Make projected-label collision reservations follow the measured responsive chrome. Compact portrait, constrained landscape, tall tablet, normal desktop, short desktop, and full-COSMO states receive explicit header, rail, destination, tool, lower-dock, or exit reservations. Hydration suppresses constrained labels until the media state is known rather than briefly placing them beneath controls.
- Use one contained constrained-landscape layout for 560–1024 pixel widths through 760 pixels high and for wider viewports through 700 pixels high: compact header actions, horizontal scale rail, scrollable destination card, two-by-three tool grid, and no scene-time/release/compass decoration. At the adjacent 701–760 pixel desktop boundary the decorative compass also stays hidden so it cannot collide with the scene-time card.
- Keep interactive targets at least 44 pixels high for search, destination, evidence, release, directory, and nearby actions. Narrative prose uses a 14 pixel floor while compact operational metadata may remain at 12 pixels. Forced-colors focus/selection boundaries, increased contrast, and reduced-motion behavior remain first-class contracts.
- Preserve lazy renderer and projected-label boundaries and the established eager-JavaScript, global-CSS, lazy-label, and shared-renderer budgets. Visual refinement does not authorize catalog ingestion, scientific positioning, publication, hosted infrastructure, or deployment.

## Consequences

The main atlas now reads as a full-viewport cosmos with approachable instruments attached to its edges rather than a dark dashboard surrounding a center rectangle. Directory and narrative routes are easier to read, compact failure states remain usable, and the same interactions survive phone, tablet, short-landscape, desktop, structured, and full-COSMO modes.

The layout is intentionally conservative: some decorative controls disappear when vertical space is scarce, the compact fallback is an interface disclosure rather than sky placement, and the exact 15-entity release seed is still not catalog coverage. Zoom-driven external catalog tiles, astrometric propagation, production hosting, feedback operations, and public launch remain separate gates. The feature can be rolled back independently at commit `1b4db89b77613642edc8539c837ff859c180a08c` without changing the frozen release bundle.

## Validation

Web lint, production build, 69 Node tests, and 143 TypeScript tests pass. The unchanged packages pass 64 scientific-model, 120 relativity, and 71 connector tests. Focused visual contracts cover daylight contrast, narrative type floors, 44 pixel targets, forced colors, full-COSMO exit, native fallback semantics, real responsive geometry, collision rejection, compact hydration, short-landscape lanes, and the 700/701 pixel transition.

Browser QA covered 320 and 390 pixel portrait lanes; 761×480 and 1024×480 constrained layouts; 1280×720 and 1536×776 desktop lanes; the 1440×700/701 transition; disclosure expansion; full-COSMO entry; and Escape focus restoration. Independent accessibility, performance/regression, and final-diff reviews found no remaining actionable P1/P2 issue. The final home graph is 346,610 raw / 112,230 gzip bytes of eager JavaScript; global CSS is 145,648 raw / 29,396 gzip bytes; lazy projected labels are 10,626 raw / 3,362 gzip bytes with 9,247 raw / 2,298 gzip bytes of CSS; and the shared renderer remains 548,150 raw / 138,941 gzip bytes. GitHub push run `29764731212` and draft-PR run `29764733357` passed all eight jobs.
