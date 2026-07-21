# ADR 0001: Federated Atlas Instead of Universal Data Mirror

**Status:** Accepted | **Date:** 2026-07-18 | **Accepted:** 2026-07-19

## Context

Authoritative space and astronomy holdings span specialized archives, standards, rights regimes, update cadences, and petabyte-scale collections. Gaia DR4 alone is expected to approach hundreds of terabytes. Copying every raw product would create unsustainable storage/egress costs, stale duplicates, rights risk, and loss of archive-specific scientific context.

## Proposed decision

Build Cosmography as a federated atlas:

- keep authoritative source links and stable product identifiers;
- ingest normalized discovery metadata, assertions, provenance, rights, and selected subsets;
- preserve raw objects only when permitted and required for reproducibility, resilience, offline use, or derivative generation;
- generate versioned render/search derivatives with full lineage;
- query or redirect to authoritative archives for specialist/raw access when mirroring is unnecessary;
- publish only through signed, rollback-capable manifests.

## Consequences

- Connector health and source governance become core operations.
- Some experiences depend on upstream availability unless assets are lawfully cached.
- The platform needs source-aware query federation and stable internal identity crosswalks.
- Storage remains bounded by product needs rather than total archive size.
- Updates and corrections can preserve authoritative context instead of silently overwriting it.

## Acceptance

The decision becomes Accepted when the owner approves the research direction and the first dataset passport/connector demonstrates the complete flow.
