# `@cosmography/scientific-model`

This package is the small scientific contract at Cosmography's publication
boundary. It makes the app say what a fact or visual actually represents before
that material can be released. It is intentionally not a universal astronomy
ontology and not a container for the full source archives.

## What it models

- prefixed, opaque, TypeScript-branded identifiers;
- split Julian-date and uncorrelated spacecraft-clock time values;
- source-backed assertions with mutually exclusive value variants;
- per-component evidence, time, appearance, geometry, and AI labels;
- reviewed rights determinations and fail-closed use decisions;
- metric and cosmology-dependent distance definitions;
- physical, fictional-warp, and map-navigation travel definitions that cannot be
  interchanged silently;
- immutable release envelopes with source snapshots, content hashes, validation
  results, compatibility, rollback, and signatures.
- deterministic governance evidence with exact intended-use scope, signed
  role-granted approvals, expiry, separation of duties, and pending-only
  signature requests.
- mission provenance with separately authorized kernel selections, canonically
  bound SPICE artifact manifests, in-process evidence-verified execution
  tokens, byte-to-parsed-state verification, lineage-aware Horizons comparison
  plans, verifier-issued media render tokens, and typed withheld capture
  geometry.
- shared Mars/Moon surface provenance with strict reference-only pre-ingest
  ledgers, exact reviewed product manifests, body-specific cartographic and
  recorded-media metadata, derivative lineage, verifier-issued runtime-use
  tokens, and withheld-only surface capture contexts.
- release-scoped Coverage Packs with exact source-record/artifact bindings, a
  fixed eight-dimension vocabulary, reciprocal gap and next-evidence links,
  canonical digests and ETags, and pair-verifiable cross-release correction
  declarations.

Draft schemas accept some incomplete review state so ingestion and curation can
work. `Publishable*Schema` validators add fail-closed representation/travel
rules. Release envelopes instead have an explicitly named structural
`ReleasePublicationPreflightSchema`; callers must additionally use the injected
signature verifier, bind approved governance evidence, and pass a separate
atomic activation gate. A schema parse alone never authorizes publication.

## D1 is the control plane; R2 is the bulk plane

| D1: small, relational, queryable | R2 or authoritative archive: large/immutable |
| --- | --- |
| Active release pointer and rollback target | Release manifests and validation reports |
| Canonical entities and authority-ID crosswalks | Gaia/SDSS/DESI catalog partitions and indexes |
| Assertions and their source links | FITS, VOTable, Parquet, Arrow, Zarr, CDF, and NetCDF |
| Source passports and release snapshots | Planetary rasters, terrain, 3D Tiles, meshes, and point clouds |
| Representation truth labels | SPICE kernels and reproducible mission bundles |
| Rights decisions and exact credit lines | Images, panoramas, audio, and video derivatives |
| Object keys, URLs, hashes, sizes, and media types | Original bytes when storage and rights permit |

D1 must not become a copy of Gaia or PDS. Bulk products use immutable keys such
as `releases/<release-id>/...`; D1 records their digest and release membership.
Some products should remain federated at their authoritative archive, with a
versioned URL/request manifest rather than a local copy. This separation keeps
rollback atomic and preserves source context without forcing every archive into
one database.

The initial migration is in [`migrations/0001_core_control_plane.sql`](migrations/0001_core_control_plane.sql).
It is designed for D1/SQLite. Release-scoped API contracts keep open a later move
to PostgreSQL/PostGIS without making an unversioned database row part of the
public scientific identity.

## Important invariants

1. A Cosmography ID identifies a local record; authority identifiers and source
   releases remain first-class metadata and must not be overwritten.
2. Conflicting facts are separate assertions. A preference rule selects one for
   a view without erasing the alternatives.
3. Time scale and role are explicit. Event, observation, validity, ingestion,
   and publication times are not interchangeable.
4. Evidence class applies to each independently meaningful representation, not
   as one “scientifically accurate” badge for a mixed scene.
5. Generative output cannot be published as observation, reconstruction, or
   physics simulation. AI involvement is a separate production-method axis.
6. An asset-bearing representation needs a rights record, even when its provider
   is a government agency or the data are publicly accessible.
7. Warp is an explicitly fictional gameplay mode. Instant travel is map
   navigation. Neither can emit a scientific travel duration.
8. A published release is immutable and signed; rollback changes an active
   pointer rather than mutating or deleting that release.
9. Approval-record hashes are not authentication by themselves. A caller must
   verify their signatures, current role grants, key purpose, validity, and
   revocation before accepting release-candidate evidence.
10. A named kernel file—or even a parsed complete manifest—is not an executable
    kernel set. Execution requires a separately authorized reviewed-selection
    token, exact selection-to-manifest binding, canonical digest recomputation,
    reviewed bytes, hashes, load order, toolkit identity, coverage evidence, and
    an in-process verifier-issued token. It never grants release eligibility.
11. A media record or policy link is not asset-level publication authority.
    Every intended use must be explicitly allowed at an evaluation time.
    Reference-only and raw reviewed-asset records cannot render bytes; rendering
    requires an injected exact-byte/rights verifier to issue a non-serializable
    token. The foundation has no renderable camera-context branch.
12. A separately calculated parsed-state digest is not proof that retained
    state-artifact bytes contain those vectors. The injected artifact verifier
    must return the parser output from the exact retained object, and that output
    must exactly match the canonical candidate before a state token is issued.
13. A surface source page, panorama caption, product requirement, or parsed
    reviewed manifest is not runtime authority. A future frozen surface product
    must bind exact primary bytes and source labels, hashes, immutable keys,
    lineage, planetary spatial/temporal metadata, a retained projection
    definition where applicable, passed validation, intended use, and
    asset-level rights. Artifact verification first requires an independently
    authorized, in-process reviewed-selection token that binds the exact
    reference requirement, product identity, representation class, and approved
    use. Runtime use then requires exact parsed asset and report receipts;
    booleans and structural token copies fail, and the issued token grants
    neither camera placement nor release eligibility.
14. Surface capture placement is a separate gate. The current Mars and Moon
    ledgers expose only approximate display anchors or unresolved coordinates,
    preserve reported-time precision, bind their missing product requirements,
    and keep every media, localization, calibration, optical-center,
    orientation, terrain-frame, uncertainty, render, and release flag false.
15. A Coverage Pack is a frozen summary of evidence within one exact release,
    not proof of source authenticity, scientific validation, completeness,
    rights clearance, runtime/render permission, publication, or release
    eligibility. Its scoped record must resolve through the same exact bound
    source identity. `validated-artifact-evidence` is reserved in v1 and always
    rejected until a verifier-bound artifact-validation contract exists.
    A serialized correction lineage is only a predecessor declaration, not
    verified history. Trusted corrections use `createCoverageCorrectionPack`
    to derive the prior release/digest, next revision, and affected dimensions,
    then `assertCoverageCorrectionPair` whenever both immutable packs are read.
    Corrections retain the logical pack ID and scope but enter a distinct exact
    release. Source paths and versions reject traversal and mutable aliases.

The checked-in Mars and Apollo 17 ledgers currently contain reference records
only. No surface product bytes have been admitted, no reviewed-selection or
surface runtime token has been issued, and no capture pose is renderable.

## Usage

```ts
import {
  PublishableRepresentationSchema,
  RouteDefinitionSchema,
} from "@cosmography/scientific-model";

const representation = PublishableRepresentationSchema.parse(candidate);
const route = RouteDefinitionSchema.parse(routeCandidate);
```

Zod parsing is required at ingestion, service, and publication boundaries.
Static TypeScript types help callers after parsing but do not validate external
JSON by themselves. Coverage consumers should use `parseCoveragePack` or
`parseCoveragePackSet` to receive a deeply frozen parsed copy. The corresponding
integrity assertions additionally require already-canonical input and freeze the
validated original, preventing mutation after a successful boundary check.

## Development

```sh
npm install
npm run check
```

`npm run check` runs strict TypeScript checking and focused contract tests. The
tests cover value exclusivity, reversed scientific intervals, representation
publication labels, rights fail-closed behavior, warp separation, deterministic
governance evidence, approval/signature expiry, release-signature preflight,
kernel execution gates, Horizons/SPICE comparison drift, asset-bound media
rights, fail-closed mission capture geometry, reference-only surface ledgers,
canonical reviewed surface manifests, reviewed-selection capabilities, parsed
exact-evidence runtime-token issuance,
planetary CRS/no-data/accuracy rules, derivative lineage, withheld surface
capture geometry, and release-bound Coverage Pack integrity and correction
lineage.
