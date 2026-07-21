# Cosmography source connectors

Agency-neutral, read-only ingestion contracts for Cosmography. This package validates source passports, compiles a scientific query or reviewed manual task into a deterministic content-addressed request manifest, and executes an approved manifest only through injected transport, clock, secret, quota, and immutable-store boundaries. It ships no production network transport and its offline tests make no network calls. Returned manifests and receipts are runtime-deep-frozen.

Registry and primary documentation were checked online on **2026-07-19**. Service state is frozen as a fact of that date, not assumed to remain true forever.

## Non-negotiable storage boundary

- D1 is the small control plane: source passports, cursors, run status, checksums, object pointers, and deliberately small normalized metadata.
- R2, an external authority, or a specialized scientific service holds bulk catalog rows, kernels, imagery, spectra, telemetry, and media.
- `bulkScienceDataInD1` is a schema literal `false`.
- A destination with `payloadClass: "bulk-science"` or `"binary-media"` fails validation when its store is D1.

This boundary matters for both cost and scientific reproducibility: a D1 row points to versioned bytes and their checksum; it does not silently become a second, incomplete science archive.

## What a source passport records

Every source has an independently reviewable passport containing:

- authority, official endpoints, protocols, documents, checked date, and current release state;
- sync mode, Cosmography cadence, cursor types, and release-snapshot retention behavior;
- anonymous, account, token, or data-rights access requirements;
- published or unknown quota state plus conservative local limits;
- source-specific rights, acknowledgement, and publication-review policy;
- freshness target and stale threshold;
- retry behavior and `Retry-After` handling;
- an audited environment kill switch and circuit breaker;
- the D1 control-plane / R2 bulk-payload boundary.

Cadences labeled `cosmography-policy` are our operational choices. They are not presented as promises made by an upstream archive.

## Frozen request manifest

A compiled manifest records and runtime-deep-freezes:

- exact adapter version, source, release label, UTC time, and normalized intent;
- URL/form keys in canonical order while preserving the caller's order for repeated values, safe headers, media types, and a reference to—not the value of—a secret;
- input cursor, destination class/store, retry policy, and freshness policy;
- SHA-256 of the canonical request and SHA-256 of the unsigned canonical manifest;
- an optional upstream response checksum for an explicitly selected artifact.

Canonical JSON recursively sorts object keys, and query/form parameter keys are sorted without reordering repeated values such as multi-field scientific sort precedence. The same inputs therefore produce the same manifest id and checksums. `assertManifestIntegrity` verifies internal content consistency when the recorded checksums are trusted; it detects accidental alteration when the hashes are retained. It does **not** authenticate a manifest because a party able to replace the content can also recompute its hashes. Authenticity requires an external signature or signed append-only ledger.

Credential-bearing headers (`Authorization`, cookies, proxy authorization, and API keys) are rejected. Rubin's manifest contains `RUBIN_RSP_TOKEN` as an environment-variable reference only.

## Manifest-bound ingestion receipts

`IngestionReceiptSchema` performs structural validation only. A runner must call `parseIngestionReceiptForManifest(manifest, receipt)` before accepting a receipt. That binding verifies the manifest's internal checksums and then requires matching manifest/source identity, start time at or after `frozenAt`, monotonic start/completion times, a response-bytes SHA-256 for `succeeded` and `empty` results, the exact expected response hash when one was frozen, and a payload pointer matching the authorized destination store and key. Non-D1 completed payloads require a pointer; D1 control-plane results cannot substitute an external pointer.

## Sandboxed runner boundary

The runner foundation is intentionally transport-agnostic. `runner.ts` consumes an injected `ConnectorTransport`; it never calls ambient/global `fetch` and this package does not ship a production network implementation. Before opening transport, it verifies manifest integrity, recompiles the normalized intent through the exact approved adapter, applies kill-switch/rights/quota admission, resolves credentials only at the transport boundary, and enforces request and record ceilings. Abort signals plus injected hard-deadline races bound transport open, header receipt, body iteration, streaming writes, secret lookup, and immutable-store operations; the transport must additionally enforce its socket-level phase limits. Mixed public/private DNS results, private or reserved addresses, redirects, compressed payloads, partial responses, oversize responses, expired quota leases, and untrusted direct writes fail closed.

The foundation defaults to an 8 MiB wire/decoded response cap, no content compression, no redirects, at most three deterministic attempts, and 30 seconds total. These are ceilings for small frozen validation inputs—not permission for bulk acquisition. Source passports may reduce them further.

Raw response bytes go only to conditional-create (`ifAbsent`) `quarantine/` objects. Raw bytes use a `response-bytes` checksum scope; canonical capture, validation, and run JSON objects use a separate `record-bytes` storage checksum so the two cannot be confused. Separately hashed capture and validation records bind the raw object to admission/release evidence, the frozen request checksum, runner-policy version, DNS/socket attestation, causal timestamps, byte count, response hash, validator versions, and canonical findings. Immutable key collisions must match byte-for-byte or fail closed. A runner record can say only `quarantined`, `manual-required`, `killed`, or `failed`; it cannot say `published`.

## Offline surface-candidate quarantine

Mars and Moon product discovery needs a state that is earlier than the reviewed surface-selection and runtime gates but more exact than a source-page link. `surface-quarantine.ts` provides that state without fabricating an HTTP request, DNS/socket receipt, rights decision, or product admission. It accepts bytes only through an injected byte source; the module has no network method and never calls ambient `fetch`.

`createSurfaceQuarantineProposal` binds the complete canonical reference-only requirement to one exact candidate identity and an exact artifact list. Each artifact freezes its role, filename, query-free credential-free HTTPS file URL, media type, byte length, SHA-256, and reciprocal primary-data/source-label pairing. An already exact reference identity cannot drift. A selection-pending requirement may nominate a candidate identity, but the proposal remains `unreviewed-offline-surface-candidate` and cannot approve that choice. Cartographic candidates require exactly one retained projection definition.

The fixture policy is deliberately small and code-owned: at most 16 artifacts, 16 MiB per general artifact, 4 MiB per label or metadata artifact, and 32 MiB total. Unsafe, mutable, executable, or archive filenames fail closed; media types must match known filename extensions; labels and projection definitions must be textual; and ZIP, gzip, bzip2, xz, 7z, RAR, zstd, or tar magic is rejected even when mislabeled. These limits are contract-test ceilings, not a terrain/media ingestion budget.

`quarantineAndInspectSurfaceCandidate` checks each injected byte-array length before copying it, recomputes its exact SHA-256, writes only an internally derived `quarantine/surface/` key with `ifAbsent: true`, checks the object claim returned by the store, and then re-reads and rehashes those bounded bytes before invoking an injected label parser. The parser payload must reproduce the proposal/reference digests, candidate identity, body, product kind, source release, label bytes, and complete captured file inventory. The final state can only be `machine-inspected-needs-selection-and-rights-review`; proposal, capture, and report schemas keep selection, artifact verification, rights, scientific validation, runtime/render use, camera placement, release, publication, activation, source authenticity, and dependency provenance literal `false`. They also state only the narrower fact that this module itself performed no ambient-network fetch.

The injected source, store, reader, parser, and clock are all trust boundaries. Their returned bytes and claims are bounded, cross-bound, hashed, and replayed, but this pure contract cannot prove how a dependency obtained bytes, that a storage service is physically immutable, or that a parser is scientifically correct. Even self-consistent or colluding dependency output remains non-authoritative and cannot cross the later reviewed-selection, rights, scientific-validation, or runtime gates.

This foundation uses synthetic in-memory fixtures only. It does not ship a PDS3/PDS4, ODE, USGS, Trek, GeoTIFF, JP2, or archive sandbox; does not stream real bulk products; does not download or retain a Mars/Moon source product; and cannot emit the scientific model's reviewed-selection or runtime-verification receipts. A separately reviewed streaming/parser policy, real exact file selection, source and asset rights, independent scientific validation, and release governance remain mandatory.

The separate promotion foundation rehashes the exact raw bytes, checks the canonical capture/report object paths, and reruns the source validator before assembling a review digest—and repeats that artifact gate during candidate assembly. That digest binds a versioned internal connector-to-scientific source crosswalk, reviewed rights, intended use, required roles, and signed scientific/rights/security approvals. Injected trust resolvers authenticate reviewer role grants and the requested release-signing key at one explicit check time. Later signing/activation work must replay the artifacts and recheck current rights, approval, grant, and key validity. The resulting object stays under `release-candidates/` with `awaiting-signature-and-activation` and a strict pending signature request. It has no release signature, persistence side effect, publication method, activation method, or active-pointer access.

Credentials are resolved only after admission through an injected secret resolver. Frozen manifests, quarantine metadata, validation reports, runner records, and store metadata retain the environment-key reference—not the resolved value. Manual and interactive sources return `manual-required`; data-rights-gated, optional, restricted, default-off, expired-lease, and over-quota runs are stopped before transport unless their exact audited admission requirements are satisfied.

## Source register

| Connector | State frozen on 2026-07-19 | Primary official references |
| --- | --- | --- |
| NAIF SPICE | Active. Explicit kernel artifacts only; freeze kernel set and load order. | [SPICE data](https://naif.jpl.nasa.gov/naif/data.html), [WebGeocalc](https://naif.jpl.nasa.gov/naif/webgeocalc.html), [usage rules](https://naif.jpl.nasa.gov/naif/WGC_rules_of_use.html) |
| JPL Horizons | Active endpoint. The documentation identified itself as **1.3**, while a small live JSON probe on 2026-07-19 returned `signature.version` **1.2**. These are recorded separately. Each intent freezes expected signature 1.2, and a runner must stop before parsing if the response differs. | [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [system manual](https://ssd.jpl.nasa.gov/horizons/manual.html), [API policy](https://ssd-api.jpl.nasa.gov/doc/index.php) |
| NASA PDS4 | Active Search API. PDS4 Standards Reference lists Information Model 1.26.0.0 / Build 17, released June 2026. | [Search API](https://nasa-pds.github.io/pds-api/guides/search/endpoints.html), [PDS APIs](https://nasa-pds.github.io/pds-api/), [PDS4 standards](https://pds.nasa.gov/datastandards/documents/sr/) |
| ESA PSA | Active TAP+ service with PDS3 and PDS4 holdings. The retired PDAP URL is intentionally not used. | [PSA](https://www.cosmos.esa.int/web/psa/psa-introduction), [live TAP+ resources](https://psa.esa.int/psa-tap/tap/), [PDS4 in PSA](https://www.cosmos.esa.int/web/psa/pds4-standards) |
| JAXA DARTS | Active explicit HTTP artifacts. DARTS documents a one-second wget delay; project restrictions still apply. | [About DARTS](https://darts.isas.jaxa.jp/en/about), [HTTP access FAQ](https://darts.isas.jaxa.jp/en/faq), [ISAS data policy](https://www.isas.jaxa.jp/en/researchers/data-policy/) |
| ISRO ISSDC/ISDA | Manual-only and default-off. The official ISRO page identifies PRADAN/ISDA, but no supported public machine API was documented. | [ISRO science data](https://www.isro.gov.in/Sciencedata.html), [PRADAN](https://pradan1.issdc.gov.in/) |
| ESA Gaia TAP | Active public TAP. Gaia DR3 remains the current full release, the Focused Product Release is available, and DR4 is still marked upcoming—not silently treated as released. | [programmatic access](https://www.cosmos.esa.int/web/gaia-users/archive/programmatic-access), [release scenario](https://www.cosmos.esa.int/web/gaia/release), [DR4 page](https://www.cosmos.esa.int/web/gaia/data-release-4) |
| CDS SIMBAD TAP | Active. Official page reported SIMBAD4 1.8 (2026-06), free unregistered access under ODbL. SIMBAD is an object database, not a complete survey catalogue. | [SIMBAD service and acknowledgement](https://simbad.cds.unistra.fr/simbad/), [TAP capabilities](https://simbad.cds.unistra.fr/simbad/sim-tap/capabilities) |
| CDS VizieR TAP | Active. Releases and rights remain catalogue-specific; preserve catalogue namespace, ReadMe, DOI, and original paper. | [TAP capabilities](https://tapvizier.cds.unistra.fr/TAPVizieR/tap/capabilities), [VizieR](https://vizier.cds.unistra.fr/viz-bin/VizieR) |
| MAST | Active multi-mission archive. Supports the invoke API and CAOM TAP; product public/proprietary state must be checked. | [using MAST APIs](https://outerspace.stsci.edu/spaces/MASTDOCS/pages/113771434/Using+MAST+APIs), [API tutorial](https://mast.stsci.edu/api/v0/MastApiTutorial.html), [VO/TAP services](https://archive.stsci.edu/virtual-observatory) |
| NASA Exoplanet Archive | Active, TAP-first. Official guidance says all new tables and nearly all legacy API tables use TAP. | [TAP guide](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html), [API transition](https://exoplanetarchive.ipac.caltech.edu/docs/program_interfaces.html) |
| NASA/IPAC NED | Active **new 2026 `NED::API`** adapter. Official NED warns legacy APIs cannot see data ingested after January 2026. | [new API specification](https://ned.ipac.caltech.edu/Docs%3A%3AAPI/), [TAP transition notice](https://ned.ipac.caltech.edu/Documents/Guides/Interface/TAP), [acknowledgement](https://ned.ipac.caltech.edu/help/intro.html) |
| UNOOSA space-object register | Manual-only and default-off. No supported public bulk API was documented; reviewed UN registration documents are captured with amendment lineage. This is not a real-time orbit source. | [space-object register resources](https://www.unoosa.org/oosa/en/spaceobjectregister/resources/index.html), [2026 submissions](https://www.unoosa.org/oosa/en/spaceobjectregister/submissions/years/2026.html), [UN treaty implementation](https://www.unoosa.org/oosa/en/treatyimplementation/) |
| Rubin DP1 | Optional, data-rights-gated, token-authenticated, and default-off. DP1 is a preview—not LSST annual DR1. Early Data Preview 2 was scheduled for 2026-07-27 and was not yet active on the checked date. | [DP1 access policy](https://dp1.lsst.io/access/index.html), [TAP tutorial](https://dp1.lsst.io/tutorials/api/api-101-1.html), [citation guide](https://dp1.lsst.io/citedp1.html), [EDP2 scheduled event](https://rubinobservatory.org/events/edp2-release) |

## Why ISSDC and UNOOSA are manual connectors

An archive web page is not automatically a supported API. Automating a login flow or scraping a dynamic search page creates brittle behavior, can violate terms, and cannot provide a trustworthy incremental cursor. These two passports compile a signed-off manual review task instead:

1. a person opens the official service;
2. confirms the exact public release or registration documents;
3. records exact official document/file links, release label, rights, and amendments;
4. freezes a small manifest and checksum;
5. only then may an approved runner acquire permitted files into R2.

The kill switch remains off until that review is complete.

## Example

```ts
import {
  assertManifestIntegrity,
  compileConnectorIntent,
} from "@cosmography/connectors";

const manifest = compileConnectorIntent(
  {
    kind: "tap",
    sourceId: "esa-gaia-tap",
    adql:
      "SELECT TOP 100 source_id, ra, dec, parallax " +
      "FROM gaiadr3.gaia_source WHERE parallax > 100",
    execution: "sync",
    format: "votable",
    maxRecords: 100,
  },
  {
    frozenAt: "2026-07-19T10:00:00Z",
    releaseLabel: "gaia-dr3-nearby-sample",
    cursorIn: { kind: "release", label: "Gaia DR3" },
    destination: {
      payloadClass: "bulk-science",
      payloadStore: "r2",
      controlPointerStore: "d1",
      objectKey: "ingest/esa-gaia-tap/dr3/nearby-sample.vot",
    },
  },
);

assertManifestIntegrity(manifest);
```

Executable, fixed-time examples for Horizons, PDS4 pagination, Gaia TAP, and UNOOSA review are exported as `deterministicExampleManifests`.

## Supported intent families

- bounded TAP `SELECT`/`WITH` manifests for sync or async endpoints; the foundation runner executes sync only, while async UWS creation remains `manual-required` until a separately idempotent job-state workflow exists;
- Horizons JSON query-parameter requests with a frozen expected payload-signature version; vector intents additionally require explicit reference plane, reference system, time scale, output units, correction mode, and vector-table selection;
- PDS Search API structured/keyword searches with `search-after` cursors;
- explicit, allowlisted NAIF and DARTS artifacts;
- MAST invoke-service pagination and MAST CAOM TAP;
- current NED `NED::API` object/cone services;
- reviewed ISSDC and UNOOSA manual snapshots.

Adapters only compile read operations. TAP requests require `maxRecords`; PDS requires a query or keywords plus sort and limit; artifact URLs must match the exact authority host and path prefix.

## Validation

```powershell
npm install
npm run check
```

`check` performs strict TypeScript checking, deterministic offline unit tests, and internal content-consistency verification for all example manifests. The suite exercises fake transports and immutable stores, DNS/redirect policy, manifest-intent laundering, secret isolation, retries, byte ceilings, object collisions, timestamp/hash tampering, Horizons domain errors, TAP XML error/overflow/entity cases, and the unreviewed surface-fixture hash/replay/label-binding boundary. Tests make no network calls and download no scientific data.

The online source audit used official primary documentation and small liveness probes only. On 2026-07-19, the following returned successful metadata/capability or tiny sample responses: Horizons JSON, PDS Search JSON, NED XML, Gaia TAP capabilities, PSA TAP+ resources, SIMBAD TAP capabilities, VizieR TAP capabilities, MAST CAOM TAP capabilities, Rubin TAP capabilities, and the NAIF/DARTS/PRADAN landing endpoints. No bulk data were downloaded and no network writes were made.

## Limits of this package

- It is not a license opinion. Product-level rights and citations still require review.
- It is not a scheduler, distributed queue, production network transport, scientific normalizer, or complete scientific validator.
- The runner and injected boundaries do not yet constitute a production network sandbox or authorize live source execution. Transport-level DNS/socket/TLS attestations become trustworthy only when a separately reviewed production transport actually controls those operations.
- Its foundation validators reject unsafe HTTP/envelope/domain-error cases and require source/rights review, but accepted-basic syntax is never equivalent to scientifically validated or publication-ready data. The promotion foundation verifies signed review evidence but does not supply production key/role registries, final signing, persistence, or activation.
- Its SHA-256 fields are content-integrity checks, not signatures, provenance attestations, or proof of authenticity. Deployments need a separately controlled signed ledger for those guarantees.
- It does not merge identifiers across releases. Gaia source ids, preferred exoplanet solutions, NED measurements, and registration amendments all have explicit release lineage.
