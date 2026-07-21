# Cosmography Relativity Kernel

This package is the publication boundary for black-hole visualization. It exists because an attractive dark sphere with a glowing ring is not an Interstellar-grade black-hole model.

The reference path is:

1. trace null geodesics through an explicitly parameterized Kerr metric;
2. define the camera tetrad, motion, field of view, and units;
3. separately model background lensing and emitting plasma;
4. add frequency shifts, relativistic beaming, intensity transfer, and polarization only when the emission model supports them;
5. validate conserved quantities, critical curves, Schwarzschild limits, step-size convergence, and an independent implementation;
6. preserve a scientific reference output before any cinematic grading, flare, bloom, or exposure treatment.

## Implemented now

- gravitational radius/time conversion;
- Kerr outer-horizon, equatorial photon-orbit, and ISCO reference functions;
- Schwarzschild critical-curve-diameter cross-check;
- source-backed black-hole parameter schemas;
- emission-model separation;
- immutable render-manifest contract;
- fail-closed validation and generative-AI restrictions;
- a bounded deterministic Float64 vacuum Kerr reference trace using analytic
  Boyer-Lindquist inverse-metric derivatives, event-guarded RK4 steps, and
  exact capture/finite-escape radial-boundary localization;
- strict hash-bound and solver-replayed request, per-ray, and neutral
  lens-coordinate/mask report contracts whose checksums are non-authenticating
  and whose independent-reference and render authority remain false;
- a frozen multi-case protocol for future external Kerr output, with an
  in-process verified-reference capability, exact convention and provenance
  declarations, provisional tolerances, bounded raw/canonical candidate bytes,
  and deterministic agreement, disagreement, or inconclusive dispositions;
- a package-only external-selection and execution-request authorization
  boundary with answer-blinded run inputs, exactly three distinct review roles,
  and process-local one-use authorization and handoff capabilities that cannot
  be reconstructed from serialized records;
- a package-only runner-known statement, execution-receipt verification, and
  quarantined-output admission boundary with exact detached signature, raw,
  and canonical normalized byte bindings;
- an answer-blinded mapping-review and one-use comparison-review preparation
  boundary that reconstructs a receipt-bound candidate only in private
  process context, followed by an atomic one-use numeric consumer that
  preserves runner numerics and disagreement without granting render authority;
- a two-role, one-use scientific-review-opinion boundary that preserves every
  numeric finding, accepts negative opinions as terminal evidence, and cannot
  convert injected verification or synthetic comparison data into validation;
- numeric reference tests, including a Sagittarius A* angular-scale check.

The new trace is deliberately `unvalidated-offline-kerr-reference-trace`. It uses geometric `G=M=c=1` units and a first-slice policy that keeps its ZAMO camera well outside the static limit; that margin is a conservative product boundary, not a claim that the ZAMO construction physically requires a static observer. Small code-owned grids and work budgets record absolute Hamiltonian plus normalized null, Carter-drift, radial-potential, and polar-potential residuals. Absolute Hamiltonian remains diagnostic because its scale is coordinate-dependent. Normalized ceilings fail unsafe paths closed, and every serialized ray is regenerated twice against its frozen request before a report passes integrity. A horizon result means only that a ray reached an exterior Boyer-Lindquist guard. An escape result means only that an outgoing ray reached the configured finite radius. Polar-coordinate exits, invariant failures, and work exhaustion remain visibly unresolved.

This package does **not** yet claim a validated production ray tracer. The reference trace emits no image pixels, emission model, radiative transfer, framebuffer, or `BlackHoleRenderManifest`. It has not been compared with an independently implemented Kerr code, and its declared implementation commit is not authenticated. Cosmography's current real-time ring remains a labeled physics-visualization placeholder. It may not be promoted to “validated Kerr simulation” until separately frozen outputs pass analytic, convergence, independent-implementation, renderer-parity, performance, and scientific review gates.

The comparison foundation does not change that status. It permits at most eight ordered cases and 625 total rays, fixes canonical `E`, `L_z`, `Q`, screen, endpoint, event-surface, and azimuth-winding conventions, and freezes tolerances before a candidate exists. Raw output is capped at 1 MiB and canonical normalized interchange at 2 MiB; they are separately size- and SHA-bound, but their hashes do not prove origin. Caller-declared start, completion, capture, and normalization timestamps must be causal, while runner verification remains false. Per-ray results deliberately say only `within-tolerance`, `disagreed`, `inconclusive`, or `incompatible-conventions`; aggregate proximity cannot set scientific validation or render authority. Current tests use synthetic exact bytes and same-project reports. No external solver source or output has been selected, downloaded, run, license-reviewed, independence-reviewed, or scientifically approved.

The authorization foundation also does not change that status. A future external process may receive only a scope-specific blinded artifact, never the full plan containing Cosmography endpoints, result hashes, or provisional tolerances; camera-and-solver inputs also omit Cosmography-derived screen coordinates. Selection requires exactly one decision from each of the scientific-independence, security/execution, and license/output-rights roles, with distinct reviewer, role-grant, and key identities, before the package can issue a non-serializable selection capability. The selection review subject binds declared source/dependency/SBOM and independence-evidence digests, explicit non-match declarations for known Cosmography trees/dependencies/fixtures/mirrors, executable digest, structured argument vector, code-owned environment-name/value allowlist, sandbox prohibitions, and resource ceilings. A separately bound serialized execution request is checked against that selection and its live object can be authorized only once; the resulting process-issued execution authorization yields a one-use handoff that rechecks current grants and revocation at consumption. That handoff carries the request expiry and must be claimed once immediately before future runner use, with another expiry and revocation check; all capabilities are lost on restart and cannot be recreated from checksums or structural copies. This package supplies no filesystem or network I/O, downloader, repository client, archive extraction, build system, shell, subprocess, worker, native loader, sandbox, or runner, so authorization is not execution evidence. Current tests use synthetic review declarations only: no real implementation, source, mapping, license, review, authorization, build, run, or external output exists.

The receipt/admission checkpoint starts only from a claimed process-issued handoff, exposes one strict handoff-visible canonical statement for a future runner to sign, requires a strict runner receipt plus an injected structured attestation-verification receipt, and binds the exact detached signature envelope and one bounded raw artifact separately from exact canonical normalized bytes. Normalized rows remain answer-blinded and complete in ordinal order; they cannot contain Cosmography reference identities, outcomes, checksums, tolerances, residuals, or dispositions. One claimed handoff can attempt verification once and one verified receipt can attempt admission once. Its verifier evidence remains explicitly injected and unauthenticated by this package, and `realExternalExecutionEstablishedByPackage` remains false.

The comparison-review preparation boundary consumes that exact process-local admission only once. It freezes a structurally answer-blinded mapping-review subject containing the mapping, normalizer digest, exact output bindings, opaque row-association digest, receipt-declared runner identity, and all three prior selection-review identities, while excluding typed reference records, outcomes, tolerances, and results. Caller-controlled mapping free text remains visible and the package explicitly does not verify that it is answer-free; a fourth, identity-separated mapping reviewer declares that property in the signed exact canonical subject, and an injected structured verifier must bind the exact decision and signature-envelope bytes, validity, revocation, semantic assertions, answer-blinding declaration, and identity separation. The package burns the admission before that asynchronous boundary. After acceptance it joins rows to the private full plan by exact ordinal, preserving every runner numeric value and attaching only plan metadata. The resulting 3 MiB-bounded candidate and exact bytes remain private; the public process-issued preparation capability is incompatible with the legacy comparator and rejects structural copies.

The active receipt-bound numeric checkpoint consumes that preparation capability once. It replays the retained raw, normalized, signature, candidate, mapping-review, plan, and row bindings before an atomic synchronous burn, then uses the same internal deterministic math as the legacy comparator without converting the candidate into a legacy object. Integrator-only screen coordinates remain exact inputs. Camera-and-solver screen differences are retained but cannot pass an invented post-run tolerance; an otherwise matching row is `inconclusive`. Coordinate-time and affine-parameter deltas remain diagnostic because no tolerance was pre-registered for them. The deeply frozen result preserves all runner numerics, disagreement, unresolved outcomes, exact evidence identities, provisional deltas, and aggregate diagnostics behind a new process-local capability. Its caller-declared comparison time is checked for canonical ordering but is not authenticated by an authoritative clock. `comparisonExecuted` and `numericComparisonExecuted` become true as narrow comparison-status facts for that generated record; no authority field becomes true. Mapping correctness, authenticated execution, provenance, independence, scientific validation, rendering, production, placeholder replacement, release, publication, and activation remain false. Synthetic fixtures are still the only evidence, and the package supplies no I/O, runner, build, sandbox, output capture, signing, external execution, or real independent comparison.

The scientific-review-opinion checkpoint consumes only that exact issued comparison. One process-issued subject binds the complete comparison digest, summary, tolerances, ordered rows, evidence limitations, runner, three selection reviewers, mapping reviewer, and one exact pair of future reviewer assignments. Exactly one relativistic-physics opinion and one numerical-methods opinion must use those pairwise-distinct declared reviewer, grant, and key values. Each assigned role can issue one package-built statement and each statement one detached-signature decision, so callers cannot discard an adverse opinion and regenerate a favorable one in the same process. A supporting opinion cannot override any disagreed, incompatible, unresolved, or unadjudicated-screen machine result. Opposing or insufficient-evidence opinions still consume the final comparison capability and produce a frozen record, preventing retry-until-support. The package repeats full private-context integrity after both asynchronous injected checks and preserves every row disposition/reason plus both opinions behind a new process-local capability capped at 2 MiB. Reviewer assignment authority, qualifications, conflicts, credential validity/revocation, verifier authority, identities, and declared chronology remain caller/injector assertions unauthenticated by the package. The record state explicitly says authenticated evidence is insufficient, and scientific validation, independent validation, rendering, production, placeholder replacement, release, publication, and activation remain false.

A durable signed review, authorization, receipt, comparison, and opinion ledger; authenticated reviewer assignment authority, qualifications, conflicts, and reviewer/runner keys; authoritative time and revocation checks; cross-process atomic consumption; immutable artifact retention; verified source-to-executable/normalizer lineage, mapping, and independence capabilities; and an isolated reproducible runner remain separate future gates. The opinion capability is only a non-authoritative prerequisite input, and authenticating that record alone cannot establish scientific validation. Even an issued opinion record still requires authenticated scientific validation, GPU/WebGL parity, image and performance validation, and release governance. Implementation provenance, independence, mapping correctness, scientific validation, rendering, production use, placeholder replacement, release, publication, and activation all remain false here.

The browser imports only the analytic `@cosmography/relativity/kerr` subpath. Hashing and replay contracts remain on the offline package surface, so Node's cryptographic module is not pulled into or externalized by the client build.

Observation taxonomy is deliberately granular: `direct-observation` identifies instrument-level
measurements, `processed-observation` identifies calibrated or transformed products, and
`interferometric-reconstruction` identifies an image reconstructed from sparse visibility data.
Catalog measurements, derived parameters, physics simulations, and artist interpretations remain
separate classes. An EHT reconstruction must never be labeled as a direct optical photograph.

## Primary references

- James, von Tunzelmann, Franklin & Thorne, [“Gravitational Lensing by Spinning Black Holes in Astrophysics, and in the Movie Interstellar”](https://doi.org/10.1088/0264-9381/32/6/065001), *Classical and Quantum Gravity* 32 (2015). This documents the DNGR method and also identifies cinematic choices made for audience comprehension.
- Event Horizon Telescope Collaboration, [First Sagittarius A* Results I: The Shadow](https://eventhorizontelescope.org/publications/first-sagittarius-event-horizon-telescope-results-i-shadow-supermassive-black-hole) and the [official EHT data-product index](https://eventhorizontelescope.org/for-astronomers/data). Observed interferometric reconstructions and model-derived parameters remain separate from a nearby-camera visualization.
- Chang, [“Krang: Kerr Raytracer for Analytic Null Geodesics”](https://doi.org/10.21105/joss.07273), *Journal of Open Source Software* 9 (2024), an independent modern reference implementation to evaluate during the renderer benchmark. Reuse requires a separate code and license review.

Checked against the official/publisher sources on 2026-07-19.

## Development

```powershell
npm install
npm run check
```
