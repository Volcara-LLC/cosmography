# ADR 0021: Private Personal Spacecraft Concepts

**Status:** Accepted | **Date:** 2026-07-19

## Context

Cosmography should let an explorer make the atlas feel personal without presenting an invented vehicle as engineering, telemetry, a mission plan, or a way to change a scientific comparison. The durable control-plane schema already separates private user spacecraft from public atlas entities and real missions, but the table had no code-owned concept profiles, strict appearance contract, bounded collection, or private API.

Spacecraft are account state rather than scientific release content. Requiring a release foreign key would either discard a user's concepts when the atlas advances or falsely imply that a personal drawing was admitted to a scientific release.

## Decision

- Treat a user spacecraft as a private visualization concept. It is not a public atlas entity, real mission record, trajectory, telemetry source, scientific validation, available vehicle, or route-estimate authority.
- Keep personal spacecraft release-independent. Their `ship_` identity namespace remains separate from scientific `ent_` identities and public navigation slugs.
- Seed two append-only, code-known propulsion profiles:
  - `fusion-0.1c`: a hypothetical constant-speed comparison at an assumed `0.1c`, with acceleration, deceleration, energy, route geometry, mission constraints, traveler-frame time, and relativistic observer effects omitted.
  - `fictional-warp`: a fictional story concept with no scientific duration or physical transport claim.
- Do not offer instant map navigation, vacuum light, or Voyager as personal propulsion. They are respectively an interface action, a signal limit, and a historical spacecraft comparison—not available personal transport.
- Allow only a bounded display name and enumerated hull, accent, and insignia presets. Arbitrary CSS, HTML, URLs, uploads, asset references, performance values, mass, crew, and dimensions are outside v1.
- Generate identifiers on the server, scope every read and mutation to the authenticated owner, return private no-store responses, limit each owner to 24 concepts, and require optimistic concurrency for edits. Stored model and appearance JSON are parsed against exact code-owned contracts; drift fails closed.
- Keep seeded propulsion rows immutable and make spacecraft identity, owner, profile, and creation time immutable. Edits may change only the name and enumerated appearance while advancing `updated_at_ms`.
- Do not attach concepts to Flight Deck saves in this v1. A later decision must define immutable historical snapshots and compatibility semantics before a personal concept may annotate a saved comparison. Concepts never change distance, duration, truth class, or any Flight Deck authority flag.
- Present the collection in a welcoming daylight “My Atlas” hangar. Every concept permanently displays “Personal concept · not a mission record,” while the real Voyager mission remains a separate evidence-bound link. Signed-out or unconfigured previews remain explanatory but never use browser storage as a substitute for a successful private D1 write.

## Consequences

- Explorers can create recognizable personal craft without confusing imagination with the atlas evidence model.
- Concepts survive atlas release changes, while bookmarks and saved comparisons continue to pin scientific release context where required.
- Changing a propulsion definition requires a new versioned row and an explicit application mapping; existing rows cannot be silently rewritten or deleted.
- Rendering a personal craft in the cosmos, sharing it, attaching it to comparisons, simulation, engineering analysis, collaboration, and public galleries remain future work.
- Account deletion still cascades to private concepts. Existing nullable route associations remain schema-compatible, but this version of the application does not populate them.

## Validation

The migration and API suites verify ordered migration packaging, exact immutable profile seeds, identifier/name/appearance/timestamp/quota guards, owner isolation, private cache headers, strict request bodies, stale-edit rejection, and fail-closed stored-record parsing. UI checks cover permanent truth wording, useful signed-out and storage-unavailable states, keyboard focus, control size, readable contrast, narrow screens, and the absence of a local-storage fallback. The Flight Deck suite continues to prove that saved comparisons have no spacecraft association and retain literal-false journey, trajectory, telemetry, available-vehicle, and mission authority.
