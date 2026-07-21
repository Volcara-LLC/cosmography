# ADR 0006: Sandboxed Quarantine-First Connector Execution

**Status:** Accepted for connector foundation | **Date:** 2026-07-19

## Context

Cosmography must eventually retrieve untrusted scientific responses, archives, documents, models, and media without letting an upstream service, redirect, DNS change, decompression bomb, credential leak, or parser exploit write into a public release. The existing connector package freezes bounded read-only request manifests and validates manifest-bound receipts, but deliberately has no executor. Treating a successful HTTP status as publication would violate the release, rights, and evidence model.

## Decision

- The core runner depends on an injected `ConnectorTransport`; it never calls ambient/global `fetch` and this checkpoint supplies no production network transport. Abort-signal-backed hard deadlines bound open/header/body and streaming-store waits; the future transport remains responsible for enforcing the socket-level phases it owns.
- Redirects are disabled. Any future redirect design must re-run URL, DNS, address, TLS, authorization, quota, and secret-forwarding checks for every hop before the policy can change.
- A transport must attest the canonical hostname, all resolved A/AAAA addresses, connected address, resolution time/TTL, and original-host TLS server name. The runner rejects mixed public/private sets and every private, loopback, link-local, multicast, reserved, documentation, or mapped-private address.
- A frozen manifest is accepted only when its intent can be parsed and recompiled byte-for-byte through the exact approved adapter. This prevents a source response from selecting a weaker intent or validator after hashes are recomputed.
- Exact wire bytes stream into a conditional-create, immutable quarantine-only sink while hashing. Request/header/body, wire/decoded bytes, compression ratio, records, connection/header/total time, concurrency, retry, and source-policy limits remain bounded. The foundation rejects compressed and partial responses and caps small fixtures at 8 MiB.
- Credentials resolve only through an injected secret resolver after admission. Persisted records retain environment-key references only. Manual, interactive-account, rights-gated, optional, and restricted connectors are default-off and require an audited authorization plus a live quota lease.
- Async TAP/UWS POST execution is held at `manual-required`; it cannot enter automatic retry until a separate idempotent job-creation, job-URL capture, phase-polling, and abort/recovery workflow is approved.
- Raw capture, validation findings, run state, and any promotion candidate are separately canonicalized and hashed. Raw payload objects use `response-bytes`; canonical record objects use `record-bytes`. Captures bind admission and causal timestamps as well as the frozen request/manifest checksums, internal release ID, policy and validator versions, response checksum/length, immutable object pointer, and safe network metadata. A collision at an immutable key succeeds only for identical bytes.
- A connector writes only `quarantine/`. It cannot produce a published state or active-release pointer. Unsigned candidates remain in `release-candidates/` with `awaiting-signature-and-activation` until a separately controlled rights/readiness review, signer, and atomic release transaction accepts them.

## Consequences

- Offline deterministic transports and stores can exercise the runner without network access or credentials.
- Capturing raw bytes before parsing preserves forensic evidence and makes validation replayable; rejected material remains quarantined rather than disappearing or entering a release.
- Production transport, malware/archive/media sandboxes, source-specific scientific parsers, signing, and activation remain separate reviewed gates. Schema-level attestations are not proof unless the eventual transport controls DNS resolution and the connected socket.
- Bulk ingestion remains blocked. The first executable fixtures must be small, anonymous, exact, and rights-reviewed.

## Validation

Contract and execution tests enforce injected-only transport mode (including a throwing ambient `fetch`), exact adapter recompilation, zero redirects, bounded uncompressed limits, DNS/socket/TLS binding, causal admission/capture/validation times, canonical quarantine keys, byte-distinct storage checksum scopes, validation-state consistency, non-public runner states, and signature-gated promotion candidates. Offline fake transports and stores cover conditional-write collisions, secret leakage, DNS classification, size limits, source-response envelopes/domain errors, deterministic retries with complete attempt ledgers, and immutable run receipts. No production transport or live-source execution is authorized by this decision.
