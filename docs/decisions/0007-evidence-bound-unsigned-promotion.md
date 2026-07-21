# ADR 0007: Evidence-Bound Unsigned Release Promotion

**Status:** Accepted for governance foundation | **Date:** 2026-07-19

## Context

A quarantine record is not publication evidence. Its hashes establish internal consistency, while a syntactically valid response can still be scientifically wrong, unsafe to parse, outside the reviewed rights scope, or paired with a self-consistently altered validation report. Every current connector also requires publication-rights review, so a gate that accepts only the structural `accepted-basic` state could never process a canonical current-source report.

Cosmography needs a deterministic review handoff before release signing without giving the connector runner, a reviewer, or the handoff object any way to publish or move an active-release pointer.

## Decision

- Promotion rechecks the frozen manifest, run, capture, and report integrity; binds the exact expected quarantine object paths; rehashes the raw response bytes; and reruns the current deterministic validator at the report's recorded time. Missing, added, or altered findings fail even when every outer ID and checksum is recomputed.
- The review subject binds the connector source slug to a separate opaque scientific source ID through a versioned internal crosswalk; callers cannot supply or derive that mapping. It also binds release/manifest/run/capture/report IDs and hashes, the quarantined raw-object hash/length/media type, the complete rights-statement hash, its authenticated reviewer and expiry, the exact intended display/redistribution/modification/commercial scope, the promotion-policy version, and the required reviewer roles.
- Scientific and rights approvals are always required. Known schema-review findings resolve to scientific review; FITS and binary sandbox findings additionally require security review. Unknown validators, versions, codes, or review requirements fail closed. Blocking failures and rejected reports are never waivable by this gate.
- Each approval signs one canonical subject digest only after the full subject evaluation and records its actor, role-grant ID, decision, decision/expiry times, algorithm, key ID, and canonicalization. Required roles use canonical order, distinct actors, and distinct keys. An injected verifier must validate signature bytes plus current key purpose, grant scope, validity, and revocation state at an explicit check time.
- The rights approval actor must be the rights statement's recorded reviewer. The statement must target the explicitly mapped scientific source, remain reviewed and unexpired through candidate creation, permit display and redistribution for this locally captured object, and permit any requested modification or commercial use. Restricted and unknown bases do not pass this foundation gate.
- A separately injected release-key authorizer must approve the requested signing key and keep it distinct from reviewer keys. Candidate assembly repeats exact artifact validation rather than accepting an arbitrary schema-valid subject. Every later authorization check takes an explicit time, replays the original artifacts, and rechecks rights, approval, role-grant, and key validity. The output contains a strict `pending` signature request over the complete evidence digest, but no signature.
- The only output state is `awaiting-signature-and-activation`, and its canonical destination is `release-candidates/<release-id>/<candidate-id>.json`. This checkpoint defines a pure immutable object; it does not persist it, sign it, publish a release, create an activation endpoint, or change an active pointer.

## Consequences

- Reviewers sign one compact digest while the candidate retains the complete rights statement and immutable pointers needed to reproduce that digest.
- Reversed approval input order produces identical evidence and candidate IDs, while changes to rights, use, raw bytes, reports, roles, keys, or timestamps produce different records or fail.
- Key registries, revocation/role-grant storage, candidate persistence, final release signing, activation authorization, atomic active-pointer changes, and revalidation at activation remain separate future gates. A candidate is review progress, never proof that a release is published.

## Validation

Scientific-model tests cover deterministic canonical records, signed approval payload integrity, role/actor separation, review and approval expiry, tamper detection, and pending-only signature requests. Connector tests use exact quarantined Horizons bytes to prove current `needs-review` promotion, validator replay, missing-finding rejection, unknown-review rejection, sandbox role escalation, object-path binding, rights target/use/basis/expiry checks, approval and release-key authorization, deterministic output, and the absence of signature/publication/activation fields.
