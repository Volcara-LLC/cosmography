# Cosmography Web

The web application opens directly into Cosmography's interactive known-universe atlas. React owns the search, evidence, timeline, route, persistence, and accessibility interfaces; an imperative Three.js host renders deterministic scientific display context for each semantic scale domain.

## Local development

Requirements: Node.js 22.13 or newer.

```powershell
npm install
npm run dev
```

Useful checks:

```powershell
npm run lint
npm test
npm run db:generate
```

`npm test` creates a production build and verifies the server-rendered universe, release-pinned deep links, Mars and Moon evidence experiences, Voyager journey, Earth network, black-hole validation lab, D1 migration constraints, hash-bound release registry/search and Coverage Pack APIs, starter removal, renderer budgets, and fail-closed personal APIs. It also applies the packaged migration to an ephemeral workerd-backed D1 instance and exercises account creation, bookmark upsert/list/delete, route create/list/delete, cross-account isolation, batch rollback, identity-conflict handling, and HMAC rotation.

## Voyager provenance boundary

The Voyager journey freezes five exact official kernel filenames and Cosmography's proposed load order. The merged mission SPKs' own Earth, planetary-barycenter, and Sun segments close the early foreign-center chains; a redundant competing generic planetary SPK is deliberately excluded under NAIF's later-loaded-target priority rule. The selection remains `blocked-missing-artifacts` until every artifact has reviewed bytes, digests, unique canonical immutable storage identity, a normalized meta-kernel, pinned CSPICE version, and coverage report. Even a complete parsed manifest stays non-executable and non-publishable until a separately authorized reviewed-selection token matches it and an in-process verifier recomputes its canonical digest and verifies every retained object. The retained Horizons response is parsed with exact target, center, ordered vector columns, ICRF/ecliptic frame, TDB calendar/JD pairs, units, correction mode, solution identity, and raw decimals. A future separately hashed CSPICE artifact must be parsed from its exact retained bytes and match the same evidence gate. Strict thresholds cover four post-1981 shared-lineage epochs; three earlier cross-solution residuals remain review-only.

Voyager media records are currently links and citation metadata only. No media bytes are admitted for rendering, redistribution, modification, offline packaging, or derivative generation. Future reviewed-asset records also remain non-renderable until an injected exact-byte/rights verifier issues an in-process token at a valid post-admission evaluation time. Pale Blue Dot appears on the mission timeline with minute-level reported time precision, while its physical camera frustum remains withheld. The foundation deliberately has no renderable capture schema; that branch waits for a dedicated exact-epoch, spacecraft-clock, attitude/instrument, target-shape, uncertainty, validation, and asset-rights gate. See [ADR 0009](../../docs/decisions/0009-voyager-provenance-gates.md).

## Release-scoped public APIs

The API foundation never infers “latest.” Supply the immutable release ID in the path:

```text
GET /api/v1/releases/rel_landing_atlas_v0_1_0
GET /api/v1/releases/rel_landing_atlas_v0_1_0/registry?section=worlds&limit=20
GET /api/v1/releases/rel_landing_atlas_v0_1_0/registry/mars
GET /api/v1/releases/rel_landing_atlas_v0_1_0/search?q=mars&kind=world
GET /api/v1/releases/rel_landing_atlas_v0_1_0/coverage
GET /api/v1/releases/rel_landing_atlas_v0_1_0/coverage/covp_mars_jezero_foundation_v1
```

The release descriptor carries the 9-source public evidence registry, 13-agency directory, facets, counts, manifest hash, canonical bundle digest, registry-projection revision, and search-ranker revision. Registry/search records retain evidence, appearance, geometry, time-state, AI-involvement, frame, uncertainty, processing, and source IDs. The separate Coverage Pack projection indexes exact-release packs for Voyager 1, Mars/Jezero, Apollo 17, and the Earth network. Its advertised manifest SHA-256 is over the complete strict parsed manifest under `cosmography-foundation-coverage-manifest-stable-json-v1`, so whitespace and key order do not change identity while warning, authority, release, set, or pack-pin drift fails closed. Unknown releases, packs, methods, and ambiguous parameters fail closed. Successful responses use representation-safe ETags and content digests; canonical pack/set identities remain separately exposed, and errors are never cached.

Only the hash-bound embedded foundation bundle is serveable in this checkpoint. D1 rows do not authorize content, and these routes perform no source fetch, connector execution, release signing, activation, or deployment. `/api/atlas` is a deprecated compatibility route and now requires `release=rel_landing_atlas_v0_1_0`.

## Storage and identity

Logical Sites bindings live in `.openai/hosting.json`:

- D1 `DB` is the curated metadata, release-pointer, navigation, and durable user-state control plane.
- R2 `COSMOGRAPHY_MEDIA` is for immutable manifests and permitted bulk media—not secrets or mutable session state.

The generated D1 migrations are under `drizzle/` and are copied to `dist/.openai/drizzle/` during a production build. The packaged Worker config resolves its migration directory to that exact artifact. The migrations include a canonical seeded foundation release, guarded release pointers, versioned HMAC identities, private bookmarks, spacecraft, routes, waypoints, legs, discoveries, and progress. Release-dependent records such as bookmarks, saved comparisons, and discoveries reference a real release row; release-independent account state such as personal spacecraft, preferences, and progress does not pretend to be scientific release content. Published payloads are immutable, active channels accept only published releases, and route children cannot cross route or spacecraft ownership boundaries. Every user query also filters by the authenticated `user_id` because D1 does not provide row-level security.

Optional Sign in with ChatGPT is dispatch-owned. `app/chatgpt-auth.ts` reads identity headers that must be stripped and injected by the trusted Sites dispatch layer; the Worker must not have a separate untrusted ingress path. Cosmography stores a versioned keyed HMAC of the normalized email identity and, when supplied, a bounded display name. Raw email addresses, encoded identity headers, tokens, passwords, and HMAC secrets are never stored in D1. Multiple key versions resolving to different application users fail closed instead of selecting either account.

Configure `IDENTITY_HMAC_SECRET` with at least 32 random characters and set `IDENTITY_HMAC_KEY_VERSION` before enabling writes. The application rejects the `.env.example` placeholder. For rotation, configure the new current pair alongside `IDENTITY_HMAC_PREVIOUS_SECRET` and `IDENTITY_HMAC_PREVIOUS_KEY_VERSION`; a successful old-key sign-in adds the new identity mapping without discarding the prior recovery mapping. Never remove the previous key until all retained accounts have migrated or been retired. The retirement gate must return zero before removing it:

```sql
select count(*) as missing_current_identity
from app_users u
where u.status = 'active'
  and not exists (
    select 1 from auth_identities ai
    where ai.user_id = u.id
      and ai.provider = 'chatgpt-si-wc'
      and ai.key_version = :current_key_version
  );
```

Dormant users cannot be re-HMACed without seeing their identity again, so a nonzero result means the overlap remains active or those accounts enter an explicit recovery/retirement process. See `.env.example` for names only; hosted production values belong in Sites secret management, while the test harness creates disposable non-production secrets only in memory.

Public durable accounts remain launch-blocked while the platform exposes email—but not a stable, non-reassignable provider subject—as the identity key. Email change or reassignment can otherwise orphan an account or transfer access to its private data. Before public launch, obtain a stable provider subject or implement and independently review an account migration, reassignment, recovery, and deletion process.

## Scientific boundary

The embedded landing atlas is a small release-pinned navigation and contract fixture. Its reviewed seed manifest is `db/foundation-release-manifest.json`; the manifest binds the canonical entity/source/agency bundle digest and counts, while the migration verifies the manifest's own SHA-256 and reserves the corresponding immutable R2 key. Upload and independently verify that exact object before hosted release activation. Large catalogs, PDS products, SPICE kernels, terrain, video, panoramas, meshes, and columnar data do not belong in D1 or Git. They remain immutable R2 objects, frozen authority requests, or specialized geometry/catalog services with hashes and manifests.

Every public response and stored scene includes release/schema context. Every public visual representation must declare its evidence, appearance, geometry, time state, source release, frame, uncertainty, processing, rights, and credit.
