import assert from "node:assert/strict";
import test from "node:test";

import {
  createSavedPlaceHref,
  SAVED_PLACE_ENTITY_IDENTITIES,
  SAVED_PLACE_ENTITY_IDS,
  SAVED_PLACE_RELEASE_ID,
  SAVED_PLACE_TRUTH,
} from "../app/lib/personal/saved-place-foundation";
import {
  assertSavedPlaceFoundationContract,
  createSavedPlaceSceneJson,
  parseStoredSavedPlaceRow,
  readSavedPlaceJson,
  SavedPlaceDeleteInputSchema,
  SavedPlaceInputSchema,
  savedPlaceEnvelope,
} from "../app/lib/personal/saved-places";
import { getReleaseRegistryRecord } from "../app/lib/releases/catalog";

const bookmarkId = `bmk_${"a".repeat(32)}`;

function storedMars(overrides: Record<string, unknown> = {}) {
  return {
    id: bookmarkId,
    contractVersion: "1.0.0",
    entityId: "mars",
    navigationTargetId: "mars",
    releaseId: SAVED_PLACE_RELEASE_ID,
    label: "Mars",
    sceneJson: createSavedPlaceSceneJson("mars", "immersive", 1_000),
    sceneR2Key: null,
    createdAtMs: 1_000,
    ...overrides,
  };
}

test("saved-place foundation identities are immutable and match all 15 release records", () => {
  assert.equal(SAVED_PLACE_ENTITY_IDENTITIES.length, 15);
  assert.deepEqual(
    SAVED_PLACE_ENTITY_IDENTITIES.map(({ id }) => id),
    [...SAVED_PLACE_ENTITY_IDS],
  );
  assert.ok(Object.isFrozen(SAVED_PLACE_ENTITY_IDENTITIES));
  assert.ok(SAVED_PLACE_ENTITY_IDENTITIES.every(Object.isFrozen));
  assert.doesNotThrow(assertSavedPlaceFoundationContract);

  for (const identity of SAVED_PLACE_ENTITY_IDENTITIES) {
    const registry = getReleaseRegistryRecord(
      SAVED_PLACE_RELEASE_ID,
      identity.id,
    );
    assert.ok(registry);
    assert.deepEqual(
      {
        id: registry.id,
        name: registry.name,
        slug: registry.slug,
        kind: registry.kind,
        domain: registry.domain,
      },
      identity,
    );
    assert.equal(
      createSavedPlaceHref(identity.slug, "scientific"),
      `/?appearance=scientific&focus=${identity.slug}&release=${SAVED_PLACE_RELEASE_ID}`,
    );
  }
});

test("saved-place inputs are exact release assertions with no caller metadata", () => {
  assert.deepEqual(
    SavedPlaceInputSchema.parse({
      entityId: "mars",
      appearance: "immersive",
      releaseId: SAVED_PLACE_RELEASE_ID,
    }),
    {
      entityId: "mars",
      appearance: "immersive",
      releaseId: SAVED_PLACE_RELEASE_ID,
    },
  );
  for (const invalid of [
    { entityId: "earth", appearance: "scientific", releaseId: SAVED_PLACE_RELEASE_ID },
    { entityId: "mars", appearance: "observed", releaseId: SAVED_PLACE_RELEASE_ID },
    { entityId: "mars", appearance: "scientific", releaseId: "rel_future" },
    { entityId: "mars", appearance: "scientific" },
    {
      entityId: "mars",
      appearance: "scientific",
      releaseId: SAVED_PLACE_RELEASE_ID,
      label: "Caller controlled",
    },
  ]) {
    assert.equal(SavedPlaceInputSchema.safeParse(invalid).success, false);
  }
  assert.equal(
    SavedPlaceDeleteInputSchema.safeParse({
      id: bookmarkId,
      expectedSavedAtMs: 1_000,
    }).success,
    true,
  );
  assert.equal(
    SavedPlaceDeleteInputSchema.safeParse({
      id: bookmarkId,
      expectedSavedAtMs: 1_000,
      extra: true,
    }).success,
    false,
  );
});

test("stored saved-place JSON is versioned, canonical, and cross-bound to the row", () => {
  const raw = createSavedPlaceSceneJson("mars", "immersive", 1_000);
  assert.deepEqual(JSON.parse(raw), {
    schemaId: "cosmography.user-saved-places",
    schemaVersion: "1.0.0",
    entityId: "mars",
    domain: "globe",
    focusId: "mars",
    appearance: "immersive",
    timelineYear: 2026,
    releaseId: SAVED_PLACE_RELEASE_ID,
    savedAtMs: 1_000,
    method: "manual-save-place",
    truth: SAVED_PLACE_TRUTH,
  });

  const record = parseStoredSavedPlaceRow(storedMars());
  assert.deepEqual(Object.keys(record), [
    "id",
    "entity",
    "scene",
    "href",
    "savedAtMs",
    "method",
    "truth",
  ]);
  assert.deepEqual(record.entity, {
    id: "mars",
    name: "Mars",
    slug: "mars",
    kind: "world",
    domain: "globe",
  });
  assert.deepEqual(record.scene, {
    focusId: "mars",
    appearance: "immersive",
    timelineYear: 2026,
    releaseId: SAVED_PLACE_RELEASE_ID,
  });
  assert.equal(
    record.href,
    `/?appearance=immersive&focus=mars&release=${SAVED_PLACE_RELEASE_ID}`,
  );
  assert.equal("sceneJson" in record, false);
  assert.equal("userId" in record, false);
});

test("stored saved-place parsing fails closed on row, JSON, truth, and canonical-byte drift", () => {
  const canonical = JSON.parse(
    createSavedPlaceSceneJson("mars", "immersive", 1_000),
  ) as Record<string, unknown>;
  const truth = canonical.truth as Record<string, unknown>;
  const invalidRows = [
    storedMars({ id: "bmk_short" }),
    storedMars({ contractVersion: "0.9.0" }),
    storedMars({ navigationTargetId: "jezero" }),
    storedMars({ releaseId: "rel_future" }),
    storedMars({ label: "Red planet" }),
    storedMars({ sceneR2Key: "private/scene.json" }),
    storedMars({ createdAtMs: 0 }),
    storedMars({ sceneJson: "{" }),
    storedMars({ sceneJson: ` ${JSON.stringify(canonical)}` }),
    storedMars({ sceneJson: JSON.stringify({ ...canonical, extra: true }) }),
    storedMars({ sceneJson: JSON.stringify({ ...canonical, domain: "surface" }) }),
    storedMars({ sceneJson: JSON.stringify({ ...canonical, focusId: "jezero" }) }),
    storedMars({ sceneJson: JSON.stringify({ ...canonical, savedAtMs: 1_001 }) }),
    storedMars({ sceneJson: JSON.stringify({ ...canonical, method: "passive-navigation" }) }),
    storedMars({
      sceneJson: JSON.stringify({
        ...canonical,
        truth: { ...truth, userConfirmed: false },
      }),
    }),
    storedMars({
      sceneJson: JSON.stringify({
        ...canonical,
        truth: { ...truth, physicalCameraPose: true },
      }),
    }),
  ];
  for (const row of invalidRows) {
    assert.throws(
      () => parseStoredSavedPlaceRow(row),
      /Stored saved-place/,
    );
  }
});

test("saved-place envelope is exact and the JSON reader enforces media type, UTF-8, and 4 KiB", async () => {
  assert.deepEqual(savedPlaceEnvelope([]), {
    schemaId: "cosmography.user-saved-places",
    schemaVersion: "1.0.0",
    releaseId: SAVED_PLACE_RELEASE_ID,
    records: [],
  });
  await assert.rejects(
    () =>
      readSavedPlaceJson(
        new Request("https://cosmography.test/api/v1/me/bookmarks", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "{}",
        }),
      ),
    /application\/json/,
  );
  await assert.rejects(
    () =>
      readSavedPlaceJson(
        new Request("https://cosmography.test/api/v1/me/bookmarks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ padding: "x".repeat(4_096) }),
        }),
      ),
    /4 KiB/,
  );
  await assert.rejects(
    () =>
      readSavedPlaceJson(
        new Request("https://cosmography.test/api/v1/me/bookmarks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: new Uint8Array([0xff]),
        }),
      ),
    /UTF-8 JSON/,
  );
});
