import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  atlasEntities,
  missionAgencies,
  sources,
} from "../app/data/atlas";
import {
  FOUNDATION_BUNDLE_SHA256,
  FOUNDATION_MANIFEST_SHA256,
  ReleaseIdSchema,
  ReleaseRegistryQueryError,
  SchemaVersionSchema,
  assertReleaseBundleIntegrity,
  calculateReleaseBundleSha256,
  canonicalNavigationBundleJson,
  getReleaseRegistryRecord,
  getReleaseSnapshot,
  listReleaseRegistry,
  parseFoundationReleaseFixture,
  searchReleaseRegistry,
} from "../app/lib/releases/catalog";
import { AtlasNavigationIdSchema } from "../app/lib/science/scene";

const releaseId = "rel_landing_atlas_v0_1_0";

test("foundation bundle is hash-bound, coherent, and deeply immutable", async () => {
  const snapshot = getReleaseSnapshot(releaseId);
  assert.ok(snapshot);
  assert.equal(snapshot.records.length, 15);
  assert.deepEqual(snapshot.descriptor.counts, {
    entities: 15,
    sources: 9,
    agencies: 13,
  });
  assert.equal(
    await calculateReleaseBundleSha256(releaseId),
    FOUNDATION_BUNDLE_SHA256,
  );
  await assert.doesNotReject(assertReleaseBundleIntegrity(releaseId));

  const manifest = await readFile(
    new URL("../db/foundation-release-manifest.json", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(manifest).digest("hex"),
    FOUNDATION_MANIFEST_SHA256,
  );
  const manifestRecord = JSON.parse(manifest.toString("utf8"));
  assert.equal(manifestRecord.content.sha256, FOUNDATION_BUNDLE_SHA256);
  assert.deepEqual(manifestRecord.counts, snapshot.descriptor.counts);

  assert.equal(Object.isFrozen(snapshot.descriptor), true);
  assert.equal(Object.isFrozen(snapshot.descriptor.sources), true);
  assert.equal(Object.isFrozen(snapshot.descriptor.agencies), true);
  assert.equal(Object.isFrozen(snapshot.records), true);
  assert.equal(Object.isFrozen(snapshot.records[0]), true);
  assert.equal(Object.isFrozen(snapshot.records[0]?.representation), true);
  assert.equal(Object.isFrozen(snapshot.records[0]?.sourceIds), true);
  assert.equal(Object.hasOwn(snapshot, "recordsById"), false);

  assert.equal(
    new Set(snapshot.records.map((record) => record.id)).size,
    snapshot.records.length,
  );
  assert.equal(
    new Set(snapshot.records.map((record) => record.slug)).size,
    snapshot.records.length,
  );
  assert.equal(
    new Set(snapshot.records.map((record) => record.representation.id)).size,
    snapshot.records.length,
  );
  assert.equal(
    new Set(snapshot.descriptor.sources.map((source) => source.id)).size,
    snapshot.descriptor.sources.length,
  );
  assert.equal(
    new Set(snapshot.descriptor.agencies.map((agency) => agency.id)).size,
    snapshot.descriptor.agencies.length,
  );
  const publicSourceIds = new Set(
    snapshot.descriptor.sources.map((source) => source.id),
  );
  for (const record of snapshot.records) {
    assert.equal(new Set(record.sourceIds).size, record.sourceIds.length);
    assert.ok(record.sourceIds.every((sourceId) => publicSourceIds.has(sourceId)));
  }
  assert.equal(
    JSON.stringify(snapshot.descriptor.sources).includes("secretEnv"),
    false,
  );
  assert.equal(
    JSON.stringify(snapshot.descriptor.sources).includes("killSwitch"),
    false,
  );

  const mars = snapshot.records.find((record) => record.id === "mars");
  assert.ok(mars);
  assert.match(mars.subtitle, /procedural/i);
  assert.match(mars.summary, /reference-only.*pending controlled ingest/i);
  assert.deepEqual(mars.facts, [
    { label: "Surface", value: "Procedural preview; product coverage pending" },
    { label: "Recorded views", value: "Reference capture nodes; geometry withheld" },
  ]);
  assert.doesNotMatch(
    JSON.stringify(mars),
    /assembled from controlled imagery|global-to-local measured coverage|reconstructed geometry/i,
  );
});

test("release catalog authoritatively parses the raw typed atlas fixture", () => {
  const valid = parseFoundationReleaseFixture({
    entities: atlasEntities,
    sources: Object.values(sources),
    agencies: missionAgencies,
  });
  assert.deepEqual(valid.parsedEntities, atlasEntities);
  assert.deepEqual(valid.registeredSources, Object.values(sources));
  assert.deepEqual(valid.registeredAgencies, missionAgencies);

  const invalidEntities = structuredClone(atlasEntities) as unknown as Array<
    Record<string, unknown>
  >;
  invalidEntities[0]!.color = "not-a-color";
  assert.throws(() =>
    parseFoundationReleaseFixture({
      entities: invalidEntities,
      sources: Object.values(sources),
      agencies: missionAgencies,
    }),
  );

  const invalidSources = structuredClone(
    Object.values(sources),
  ) as unknown as Array<Record<string, unknown>>;
  invalidSources[0]!.url = "not-a-url";
  assert.throws(() =>
    parseFoundationReleaseFixture({
      entities: atlasEntities,
      sources: invalidSources,
      agencies: missionAgencies,
    }),
  );

  const invalidAgencies = structuredClone(
    missionAgencies,
  ) as unknown as Array<Record<string, unknown>>;
  invalidAgencies[0]!.status = "self-published";
  assert.throws(() =>
    parseFoundationReleaseFixture({
      entities: atlasEntities,
      sources: Object.values(sources),
      agencies: invalidAgencies,
    }),
  );
});

test("navigation-bundle canonicalization has a distinct golden vector", () => {
  assert.equal(
    canonicalNavigationBundleJson({
      z: "last",
      a: 2,
      A: 1,
      omitted: undefined,
      nested: { β: 2, b: 1 },
    }),
    '{"A":1,"a":2,"nested":{"b":1,"β":2},"z":"last"}',
  );
  assert.throws(
    () => canonicalNavigationBundleJson([undefined]),
    /only JSON values/,
  );
});

test("release identifiers align with the shared opaque-ID contract", () => {
  assert.equal(ReleaseIdSchema.safeParse(releaseId).success, true);
  assert.equal(ReleaseIdSchema.safeParse("rel_abc12-z").success, true);
  assert.equal(ReleaseIdSchema.safeParse("rel_short").success, false);
  assert.equal(ReleaseIdSchema.safeParse("REL_landing_atlas_v0_1_0").success, false);
  assert.equal(SchemaVersionSchema.safeParse("0.1.0").success, true);
  assert.equal(SchemaVersionSchema.safeParse("1.2.3-rc.1+build.7").success, true);
  assert.equal(SchemaVersionSchema.safeParse("01.2.3").success, false);
  assert.equal(SchemaVersionSchema.safeParse("1.2.3-01").success, false);
  assert.equal(SchemaVersionSchema.safeParse("v1").success, false);
});

test("navigation identifiers cannot produce unresolvable detail links", () => {
  const snapshot = getReleaseSnapshot(releaseId);
  assert.ok(snapshot);
  for (const record of snapshot.records) {
    assert.equal(AtlasNavigationIdSchema.safeParse(record.id).success, true);
    assert.equal(AtlasNavigationIdSchema.safeParse(record.slug).success, true);
    assert.equal(
      record.links.self,
      `/api/v1/releases/${releaseId}/registry/${record.id}`,
    );
  }
  assert.equal(AtlasNavigationIdSchema.safeParse("Bad_ID").success, false);
  assert.equal(AtlasNavigationIdSchema.safeParse("../mars").success, false);
});

test("registry pagination is stable, complete, and cursor-bound", () => {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = listReleaseRegistry({ releaseId, limit: 4, cursor });
    ids.push(...page.records.map((record) => record.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  assert.equal(ids.length, 15);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [
    ...ids,
  ].sort((left, right) => {
    const leftRecord = getReleaseRegistryRecord(releaseId, left);
    const rightRecord = getReleaseRegistryRecord(releaseId, right);
    assert.ok(leftRecord && rightRecord);
    return (
      leftRecord.name.toLowerCase() < rightRecord.name.toLowerCase()
        ? -1
        : leftRecord.name.toLowerCase() > rightRecord.name.toLowerCase()
          ? 1
          : left.localeCompare(right)
    );
  }));

  const worlds = listReleaseRegistry({
    releaseId,
    filters: { section: "worlds" },
    limit: 50,
  });
  assert.deepEqual(
    worlds.records.map((record) => record.id),
    ["apollo-17", "jezero", "mars"],
  );

  const firstSearchPage = searchReleaseRegistry({
    releaseId,
    query: "a",
    limit: 1,
  });
  assert.ok(firstSearchPage.nextCursor);
  assert.throws(
    () =>
      searchReleaseRegistry({
        releaseId,
        query: "mars",
        limit: 1,
        cursor: firstSearchPage.nextCursor ?? undefined,
      }),
    (error) =>
      error instanceof ReleaseRegistryQueryError &&
      error.code === "cursor_context_mismatch",
  );
  assert.throws(
    () =>
      listReleaseRegistry({
        releaseId,
        limit: 1,
        cursor: firstSearchPage.nextCursor ?? undefined,
      }),
    (error) =>
      error instanceof ReleaseRegistryQueryError &&
      error.code === "cursor_context_mismatch",
  );
});

test("search is normalized, deterministic, truth-preserving, and fail-closed", () => {
  const mars = searchReleaseRegistry({ releaseId, query: "mars", limit: 50 });
  const wideMars = searchReleaseRegistry({
    releaseId,
    query: "ＭＡＲＳ",
    limit: 50,
  });
  assert.equal(mars.records[0]?.id, "mars");
  assert.deepEqual(
    wideMars.records.map((record) => record.id),
    mars.records.map((record) => record.id),
  );

  const m31 = searchReleaseRegistry({ releaseId, query: "M31", limit: 50 });
  assert.equal(m31.records[0]?.id, "andromeda");

  const multiTerm = searchReleaseRegistry({
    releaseId,
    query: "Gaia star",
    limit: 50,
  });
  assert.ok(multiTerm.records.length > 0);
  assert.ok(
    multiTerm.records.every(
      (record) =>
        record.relevance.matchedFields.length > 0 &&
        record.representation.evidence &&
        record.representation.appearance &&
        record.representation.geometry &&
        record.representation.timeState &&
        record.representation.aiInvolvement &&
        record.sourceIds.length > 0,
    ),
  );
  assert.deepEqual(
    searchReleaseRegistry({ releaseId, query: "Gaia star", limit: 50 }),
    multiTerm,
  );

  const filtered = searchReleaseRegistry({
    releaseId,
    query: "mars",
    filters: { kind: "world", evidence: "derived-result" },
    limit: 50,
  });
  assert.deepEqual(filtered.records.map((record) => record.id), ["mars"]);
  assert.equal(
    searchReleaseRegistry({ releaseId, query: "definitely-no-object", limit: 50 })
      .total,
    0,
  );

  assert.throws(
    () => searchReleaseRegistry({ releaseId, query: "\u0000", limit: 20 }),
    (error) =>
      error instanceof ReleaseRegistryQueryError && error.code === "invalid_query",
  );
  assert.throws(
    () => searchReleaseRegistry({ releaseId, query: "mars\u200b", limit: 20 }),
    (error) =>
      error instanceof ReleaseRegistryQueryError && error.code === "invalid_query",
  );
  for (const invisibleQuery of ["\ufe0f", "\u034f", "\u0301"]) {
    assert.throws(
      () =>
        searchReleaseRegistry({ releaseId, query: invisibleQuery, limit: 20 }),
      (error) =>
        error instanceof ReleaseRegistryQueryError &&
        error.code === "invalid_query",
    );
  }
  assert.throws(
    () => searchReleaseRegistry({ releaseId, query: "x".repeat(161), limit: 20 }),
    (error) =>
      error instanceof ReleaseRegistryQueryError && error.code === "invalid_query",
  );
  assert.throws(
    () => listReleaseRegistry({ releaseId, limit: 51 }),
    (error) =>
      error instanceof ReleaseRegistryQueryError && error.code === "invalid_limit",
  );
});

test("search pagination traverses the complete ranked result without duplicates", () => {
  const ids: string[] = [];
  let cursor: string | undefined;
  let expectedTotal: number | undefined;
  do {
    const page = searchReleaseRegistry({
      releaseId,
      query: "a",
      limit: 3,
      cursor,
    });
    expectedTotal ??= page.total;
    assert.equal(page.total, expectedTotal);
    ids.push(...page.records.map((record) => record.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  assert.equal(ids.length, expectedTotal);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    ids,
    searchReleaseRegistry({ releaseId, query: "a", limit: 50 }).records.map(
      (record) => record.id,
    ),
  );
});
