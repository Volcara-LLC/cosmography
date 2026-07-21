import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

const releaseId = "rel_landing_atlas_v0_1_0";
const coverageManifestCanonicalization =
  "cosmography-foundation-coverage-manifest-stable-json-v1";
const coverageManifestSha256 =
  "8a2733bf5298f73bfa90006e71059737091bedcfc9e3d6f192dd08ef179d6326";
const coveragePacks = [
  {
    coverageKey: "apollo-17",
    packId: "covp_apollo_17_foundation_v1",
    scene: "/worlds/moon",
  },
  {
    coverageKey: "earth-network",
    packId: "covp_earth_network_foundation_v1",
    scene: "/earth",
  },
  {
    coverageKey: "mars-jezero",
    packId: "covp_mars_jezero_foundation_v1",
    scene: "/worlds/mars",
  },
  {
    coverageKey: "voyager-1",
    packId: "covp_voyager_1_foundation_v1",
    scene: "/missions/voyager-1",
  },
];

async function request(pathname, headers = {}, method = "GET") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(
    "release-api-test",
    `${process.pid}-${Date.now()}-${Math.random()}-${pathname}`,
  );
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      method,
      headers: { accept: "application/json", ...headers },
    }),
    {
      JUDGE_ACCESS_MODE: "disabled",
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function json(pathname, status = 200, headers = {}) {
  const response = await request(pathname, headers);
  assert.equal(response.status, status, pathname);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  const body = await response.text();
  return { response, body, payload: JSON.parse(body) };
}

test("release descriptor exposes only its hash-bound public bundle", async () => {
  const pathname = `/api/v1/releases/${releaseId}`;
  const { response, body, payload } = await json(pathname);
  assert.equal(payload.releaseId, releaseId);
  assert.deepEqual(payload.counts, { entities: 15, sources: 9, agencies: 13 });
  assert.match(payload.manifest.sha256, /^[0-9a-f]{64}$/);
  assert.match(payload.content.sha256, /^[0-9a-f]{64}$/);
  assert.equal(payload.sources.length, 9);
  assert.equal(payload.agencies.length, 13);
  assert.equal(JSON.stringify(payload).includes("secretEnv"), false);
  assert.equal(JSON.stringify(payload).includes("killSwitch"), false);
  assert.match(response.headers.get("cache-control") ?? "", /max-age=60/);
  assert.doesNotMatch(response.headers.get("cache-control") ?? "", /immutable/);
  assert.equal(response.headers.get("x-cosmography-release-id"), releaseId);
  assert.equal(
    response.headers.get("x-cosmography-registry-version"),
    payload.derivatives.registryProjectionVersion,
  );
  assert.equal(
    response.headers.get("x-cosmography-search-version"),
    payload.derivatives.searchRankerVersion,
  );
  assert.match(response.headers.get("content-digest") ?? "", /^sha-256=:/);
  assert.equal(
    response.headers.get("content-digest"),
    `sha-256=:${createHash("sha256").update(body).digest("base64")}:`,
  );

  const etag = response.headers.get("etag");
  assert.ok(etag);
  const conditional = await request(pathname, { "if-none-match": etag });
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), "");
  assert.equal(conditional.headers.get("etag"), etag);
  for (const ifNoneMatch of [`W/${etag}`, `"unrelated", ${etag}`, "*"]) {
    const variant = await request(pathname, { "if-none-match": ifNoneMatch });
    assert.equal(variant.status, 304, ifNoneMatch);
    assert.equal(await variant.text(), "");
  }
});

test("release resolution and query contracts fail closed", async () => {
  const malformed = await json("/api/v1/releases/not-a-release", 400);
  assert.equal(malformed.payload.error.code, "invalid_release_id");
  assert.match(malformed.response.headers.get("cache-control") ?? "", /no-store/);

  const unavailable = await json("/api/v1/releases/rel_unknown-release", 404);
  assert.equal(unavailable.payload.error.code, "release_not_found");
  assert.equal(unavailable.payload.releaseId, "rel_unknown-release");

  const unknownParameter = await json(
    `/api/v1/releases/${releaseId}?latest=true`,
    400,
  );
  assert.equal(unknownParameter.payload.error.code, "unknown_parameter");

  for (const pathname of [
    `/api/v1/releases/${releaseId}/registry?%E2%80%AE=x`,
    `/api/atlas?release=${releaseId}&%E2%80%AE=x`,
  ]) {
    const reflectedControl = await json(pathname, 400);
    assert.equal(reflectedControl.payload.error.code, "unknown_parameter");
    assert.equal(reflectedControl.body.includes("\u202e"), false);
  }

  const duplicateFilter = await json(
    `/api/v1/releases/${releaseId}/registry?section=worlds&section=missions`,
    400,
  );
  assert.equal(duplicateFilter.payload.error.code, "duplicate_parameter");

  for (const limit of ["0", "51", "1e2", "1.5", "-1"]) {
    const result = await json(
      `/api/v1/releases/${releaseId}/registry?limit=${encodeURIComponent(limit)}`,
      400,
    );
    assert.equal(result.payload.error.code, "invalid_limit");
  }
});

test("registry filters and cursor pagination execute in the built worker", async () => {
  const first = await json(
    `/api/v1/releases/${releaseId}/registry?limit=4&section=worlds`,
  );
  assert.equal(first.payload.page.count, 3);
  assert.equal(first.payload.page.total, 3);
  assert.deepEqual(
    first.payload.records.map(({ id }) => id),
    ["apollo-17", "jezero", "mars"],
  );

  const unfiltered = await json(
    `/api/v1/releases/${releaseId}/registry?limit=4`,
  );
  assert.equal(unfiltered.payload.page.count, 4);
  assert.equal(unfiltered.payload.page.total, 15);
  assert.ok(unfiltered.payload.page.nextCursor);
  const next = await json(unfiltered.payload.links.next);
  assert.equal(next.payload.page.count, 4);
  assert.equal(
    new Set([
      ...unfiltered.payload.records.map(({ id }) => id),
      ...next.payload.records.map(({ id }) => id),
    ]).size,
    8,
  );

  const mismatched = await json(
    `/api/v1/releases/${releaseId}/registry?limit=4&section=missions&cursor=${encodeURIComponent(unfiltered.payload.page.nextCursor)}`,
    400,
  );
  assert.equal(mismatched.payload.error.code, "cursor_context_mismatch");
});

test("search ranking, normalization, filters, and zero results are request-scoped", async () => {
  const mars = await json(`/api/v1/releases/${releaseId}/search?q=mars`);
  const voyager = await json(`/api/v1/releases/${releaseId}/search?q=voy`);
  assert.equal(mars.payload.records[0].id, "mars");
  assert.equal(voyager.payload.records[0].id, "voyager-1");
  assert.notEqual(mars.response.headers.get("etag"), voyager.response.headers.get("etag"));

  const wideMars = await json(
    `/api/v1/releases/${releaseId}/search?q=${encodeURIComponent("ＭＡＲＳ")}`,
  );
  assert.deepEqual(
    wideMars.payload.records.map(({ id }) => id),
    mars.payload.records.map(({ id }) => id),
  );

  const multiTerm = await json(
    `/api/v1/releases/${releaseId}/search?q=${encodeURIComponent("Gaia star")}`,
  );
  assert.ok(multiTerm.payload.records.length > 0);
  assert.ok(
    multiTerm.payload.records.every(
      (record) =>
        record.relevance.matchedFields.length > 0 &&
        record.representation.evidence &&
        record.representation.timeState &&
        record.sourceIds.length > 0,
    ),
  );

  const filtered = await json(
    `/api/v1/releases/${releaseId}/search?q=mars&kind=world&evidence=derived-result`,
  );
  assert.deepEqual(filtered.payload.records.map(({ id }) => id), ["mars"]);

  const empty = await json(
    `/api/v1/releases/${releaseId}/search?q=definitely-no-object`,
  );
  assert.equal(empty.payload.page.total, 0);
  assert.deepEqual(empty.payload.records, []);
});

test("search rejects ambiguous and abusive inputs", async () => {
  const missing = await json(`/api/v1/releases/${releaseId}/search`, 400);
  assert.equal(missing.payload.error.code, "query_required");

  const duplicate = await json(
    `/api/v1/releases/${releaseId}/search?q=mars&q=voyager`,
    400,
  );
  assert.equal(duplicate.payload.error.code, "duplicate_parameter");

  const control = await json(
    `/api/v1/releases/${releaseId}/search?q=${encodeURIComponent("mars\u0000")}`,
    400,
  );
  assert.equal(control.payload.error.code, "invalid_query");

  const oversized = await json(
    `/api/v1/releases/${releaseId}/search?q=${"x".repeat(161)}`,
    400,
  );
  assert.equal(oversized.payload.error.code, "invalid_query");

  const unknownFilter = await json(
    `/api/v1/releases/${releaseId}/search?q=mars&section=unknown`,
    400,
  );
  assert.equal(unknownFilter.payload.error.code, "invalid_filter");
});

test("entity detail cannot escape immutable release membership", async () => {
  const mars = await json(
    `/api/v1/releases/${releaseId}/registry/mars`,
  );
  assert.equal(mars.payload.record.id, "mars");
  assert.deepEqual(
    mars.payload.sources.map(({ id }) => id).sort(),
    [...mars.payload.record.sourceIds].sort(),
  );

  const missing = await json(
    `/api/v1/releases/${releaseId}/registry/not-in-release`,
    404,
  );
  assert.equal(missing.payload.error.code, "entity_not_found");

  const malformed = await json(
    `/api/v1/releases/${releaseId}/registry/Bad_ID`,
    400,
  );
  assert.equal(malformed.payload.error.code, "invalid_entity_id");
});

test("legacy atlas endpoint requires release context and honors filters", async () => {
  const missing = await json("/api/atlas?q=mars", 400);
  assert.equal(missing.payload.error.code, "release_required");

  const mars = await json(`/api/atlas?release=${releaseId}&q=mars`);
  const voyager = await json(`/api/atlas?release=${releaseId}&q=voyager`);
  assert.equal(mars.response.headers.get("deprecation"), "true");
  assert.ok(mars.payload.count > 0);
  assert.ok(voyager.payload.count > 0);
  assert.notDeepEqual(
    mars.payload.records.map(({ id }) => id),
    voyager.payload.records.map(({ id }) => id),
  );
  assert.notEqual(mars.response.headers.get("etag"), voyager.response.headers.get("etag"));

  const worlds = await json(
    `/api/atlas?release=${releaseId}&section=worlds`,
  );
  assert.equal(worlds.payload.count, 3);
  assert.ok(worlds.payload.records.every(({ section }) => section === "worlds"));
});

test("Coverage Pack collection exposes pinned identities with representation-safe caching", async () => {
  const pathname = `/api/v1/releases/${releaseId}/coverage`;
  const { response, body, payload } = await json(pathname);
  assert.equal(payload.releaseId, releaseId);
  assert.equal(payload.projectionVersion, "coverage-pack-v1");
  assert.equal(
    payload.coverageManifest.canonicalization,
    coverageManifestCanonicalization,
  );
  assert.equal(payload.coverageManifest.sha256, coverageManifestSha256);
  assert.equal(payload.coverageSet.packs.length, 4);
  assert.deepEqual(
    payload.coverageSet.packs.map(({ coverageKey, packId }) => ({
      coverageKey,
      packId,
    })),
    coveragePacks.map(({ coverageKey, packId }) => ({ coverageKey, packId })),
  );
  assert.deepEqual(
    payload.links.packs,
    coveragePacks.map(({ coverageKey, packId, scene }) => ({
      coverageKey,
      packId,
      href: `${pathname}/${packId}`,
      scene,
    })),
  );
  assert.equal(JSON.stringify(payload).includes("latest"), false);
  assert.equal(payload.coverageSet.completenessEstablished, false);
  assert.equal(payload.coverageSet.runtimeUseAllowed, false);
  assert.equal(payload.coverageSet.renderAllowed, false);
  assert.equal(payload.coverageSet.releaseEligible, false);

  assert.equal(
    response.headers.get("content-digest"),
    `sha-256=:${createHash("sha256").update(body).digest("base64")}:`,
  );
  assert.equal(
    response.headers.get("x-cosmography-coverage-version"),
    payload.coverageSet.projectionVersion,
  );
  assert.equal(
    response.headers.get("x-cosmography-coverage-record-etag"),
    payload.coverageSet.etag,
  );
  assert.equal(
    response.headers.get("x-cosmography-coverage-sha256"),
    payload.coverageSet.setSha256,
  );
  assert.equal(
    response.headers.get("x-cosmography-coverage-manifest-sha256"),
    coverageManifestSha256,
  );
  assert.equal(
    response.headers.get("x-cosmography-coverage-manifest-canonicalization"),
    coverageManifestCanonicalization,
  );
  const transportEtag = response.headers.get("etag");
  assert.ok(transportEtag);
  assert.notEqual(transportEtag, payload.coverageSet.etag);
  const conditional = await request(pathname, {
    "if-none-match": transportEtag,
  });
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), "");
  assert.equal(conditional.headers.get("etag"), transportEtag);
  assert.equal(
    conditional.headers.get("x-cosmography-coverage-record-etag"),
    payload.coverageSet.etag,
  );
});

test("Coverage Pack detail is keyed by each exact opaque pack ID", async () => {
  for (const { coverageKey, packId, scene } of coveragePacks) {
    const pathname = `/api/v1/releases/${releaseId}/coverage/${packId}`;
    const { response, body, payload } = await json(pathname);
    assert.equal(payload.releaseId, releaseId);
    assert.equal(
      payload.coverageManifest.canonicalization,
      coverageManifestCanonicalization,
    );
    assert.equal(payload.coverageManifest.sha256, coverageManifestSha256);
    assert.equal(payload.pack.coverageKey, coverageKey);
    assert.equal(payload.pack.packId, packId);
    assert.equal(payload.pack.completenessEstablished, false);
    assert.equal(payload.pack.runtimeUseAllowed, false);
    assert.equal(payload.pack.renderAllowed, false);
    assert.equal(payload.pack.releaseEligible, false);
    assert.deepEqual(payload.links, {
      self: pathname,
      collection: `/api/v1/releases/${releaseId}/coverage`,
      scene,
    });
    assert.equal(
      response.headers.get("content-digest"),
      `sha-256=:${createHash("sha256").update(body).digest("base64")}:`,
    );
    assert.equal(
      response.headers.get("x-cosmography-coverage-record-etag"),
      payload.pack.etag,
    );
    assert.equal(
      response.headers.get("x-cosmography-coverage-sha256"),
      payload.pack.packSha256,
    );
    assert.equal(
      response.headers.get("x-cosmography-coverage-manifest-sha256"),
      coverageManifestSha256,
    );
    assert.equal(
      response.headers.get("x-cosmography-coverage-manifest-canonicalization"),
      coverageManifestCanonicalization,
    );
    const transportEtag = response.headers.get("etag");
    assert.ok(transportEtag);
    assert.notEqual(transportEtag, payload.pack.etag);
    const conditional = await request(pathname, {
      "if-none-match": `W/${transportEtag}`,
    });
    assert.equal(conditional.status, 304);
    assert.equal(await conditional.text(), "");
  }
});

test("Coverage Pack API rejects aliases, queries, and non-member IDs", async () => {
  const latest = await json("/api/v1/releases/latest/coverage", 400);
  assert.equal(latest.payload.error.code, "invalid_release_id");
  assert.match(latest.response.headers.get("cache-control") ?? "", /no-store/);

  const unknownRelease = await json(
    "/api/v1/releases/rel_unknown-release/coverage",
    404,
  );
  assert.equal(unknownRelease.payload.error.code, "release_not_found");

  for (const pathname of [
    `/api/v1/releases/${releaseId}/coverage?latest=true`,
    `/api/v1/releases/${releaseId}/coverage/${coveragePacks[0].packId}?view=summary`,
  ]) {
    const query = await json(pathname, 400);
    assert.equal(query.payload.error.code, "unknown_parameter");
    assert.match(query.response.headers.get("cache-control") ?? "", /no-store/);
  }

  for (const malformedId of ["apollo-17", "latest", "COVP_apollo_17"]) {
    const malformed = await json(
      `/api/v1/releases/${releaseId}/coverage/${malformedId}`,
      400,
    );
    assert.equal(malformed.payload.error.code, "invalid_coverage_pack_id");
  }

  const unknownPack = await json(
    `/api/v1/releases/${releaseId}/coverage/covp_unknown_pack_v1`,
    404,
  );
  assert.equal(unknownPack.payload.error.code, "coverage_pack_not_found");
});

test("Coverage Pack endpoints implement HEAD, OPTIONS, and explicit read-only methods", async () => {
  const paths = [
    `/api/v1/releases/${releaseId}/coverage`,
    `/api/v1/releases/${releaseId}/coverage/${coveragePacks[3].packId}`,
  ];
  for (const pathname of paths) {
    const get = await request(pathname);
    assert.equal(get.status, 200);
    const getBody = await get.text();
    assert.ok(getBody.length > 0);
    const etag = get.headers.get("etag");
    const digest = get.headers.get("content-digest");
    const recordEtag = get.headers.get(
      "x-cosmography-coverage-record-etag",
    );
    assert.ok(etag);
    assert.ok(digest);
    assert.ok(recordEtag);

    const head = await request(pathname, {}, "HEAD");
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal(head.headers.get("etag"), etag);
    assert.equal(head.headers.get("content-digest"), digest);
    assert.equal(
      head.headers.get("x-cosmography-coverage-record-etag"),
      recordEtag,
    );

    const conditionalHead = await request(
      pathname,
      { "if-none-match": etag },
      "HEAD",
    );
    assert.equal(conditionalHead.status, 304);
    assert.equal(await conditionalHead.text(), "");
    assert.equal(conditionalHead.headers.get("etag"), etag);
    assert.equal(conditionalHead.headers.get("content-digest"), digest);

    const options = await request(pathname, {}, "OPTIONS");
    assert.equal(options.status, 204);
    assert.equal(await options.text(), "");
    assert.equal(options.headers.get("allow"), "GET, HEAD, OPTIONS");
    assert.match(options.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(options.headers.get("x-content-type-options"), "nosniff");

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const response = await request(pathname, {}, method);
      assert.equal(response.status, 405, `${method} ${pathname}`);
      assert.equal(response.headers.get("allow"), "GET, HEAD, OPTIONS");
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.match(
        response.headers.get("content-type") ?? "",
        /^application\/json\b/i,
      );
      assert.equal((await response.json()).error.code, "method_not_allowed");
    }
  }
});
