import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStoredRecordedEncounterRow,
  PublicRecordedEncounterSchema,
  readRecordedEncounterJson,
  RECORDED_ENCOUNTER_ENTITY_IDS,
  RECORDED_ENCOUNTER_RELEASE_ID,
  RECORDED_ENCOUNTER_TIMESTAMP_MAX_MS,
  RecordedEncounterInputSchema,
} from "../app/lib/personal/discoveries";

const storedMars = {
  entityId: "mars",
  firstSeenAtMs: 1_000,
  lastSeenAtMs: 1_005,
  visitCount: 2,
  discoveryMethod: "manual-atlas-record",
  releaseId: RECORDED_ENCOUNTER_RELEASE_ID,
};

test("recorded encounter input accepts only exact foundation entities and release", () => {
  assert.equal(RECORDED_ENCOUNTER_ENTITY_IDS.length, 15);
  assert.equal(
    new Set(RECORDED_ENCOUNTER_ENTITY_IDS).size,
    RECORDED_ENCOUNTER_ENTITY_IDS.length,
  );
  for (const entityId of RECORDED_ENCOUNTER_ENTITY_IDS) {
    assert.deepEqual(
      RecordedEncounterInputSchema.parse({
        entityId,
        releaseId: RECORDED_ENCOUNTER_RELEASE_ID,
      }),
      { entityId, releaseId: RECORDED_ENCOUNTER_RELEASE_ID },
    );
  }
  for (const invalid of [
    { entityId: "earth", releaseId: RECORDED_ENCOUNTER_RELEASE_ID },
    { entityId: "mars", releaseId: "rel_future" },
    {
      entityId: "mars",
      releaseId: RECORDED_ENCOUNTER_RELEASE_ID,
      passiveNavigation: true,
    },
  ]) {
    assert.equal(RecordedEncounterInputSchema.safeParse(invalid).success, false);
  }
});

test("stored encounter maps legacy columns to the exact private public contract", () => {
  const record = parseStoredRecordedEncounterRow(storedMars);
  assert.deepEqual(Object.keys(record), [
    "entity",
    "firstRecordedAtMs",
    "lastRecordedAtMs",
    "recordCount",
    "method",
    "firstReleaseId",
    "truth",
  ]);
  assert.deepEqual(Object.keys(record.entity), [
    "id",
    "name",
    "slug",
    "kind",
    "domain",
    "href",
  ]);
  assert.deepEqual(record.entity, {
    id: "mars",
    name: "Mars",
    slug: "mars",
    kind: "world",
    domain: "globe",
    href: "/?focus=mars&release=rel_landing_atlas_v0_1_0",
  });
  assert.equal(record.firstRecordedAtMs, 1_000);
  assert.equal(record.lastRecordedAtMs, 1_005);
  assert.equal(record.recordCount, 2);
  assert.equal(record.method, "manual-atlas-record");
  assert.equal(record.firstReleaseId, RECORDED_ENCOUNTER_RELEASE_ID);
  assert.deepEqual(record.truth, {
    userConfirmed: true,
    passiveNavigation: false,
    completionClaim: false,
    achievementClaim: false,
    scientificDiscoveryClaim: false,
  });
  assert.equal(PublicRecordedEncounterSchema.safeParse(record).success, true);
  assert.equal("entityId" in record, false);
  assert.equal("userId" in record, false);
});

test("stored encounter parsing fails closed on chronology and truth drift", () => {
  for (const drift of [
    { entityId: "unknown" },
    { firstSeenAtMs: 0 },
    { firstSeenAtMs: RECORDED_ENCOUNTER_TIMESTAMP_MAX_MS + 1 },
    { firstSeenAtMs: 1_006 },
    { lastSeenAtMs: RECORDED_ENCOUNTER_TIMESTAMP_MAX_MS + 1 },
    { visitCount: 0 },
    { visitCount: 1.5 },
    { discoveryMethod: "passive-navigation" },
    { releaseId: "rel_future" },
  ]) {
    assert.throws(
      () => parseStoredRecordedEncounterRow({ ...storedMars, ...drift }),
      /Stored recorded encounter/,
    );
  }
});

test("server encounter timestamps stop at the JavaScript Date boundary", () => {
  const boundary = parseStoredRecordedEncounterRow({
    ...storedMars,
    firstSeenAtMs: RECORDED_ENCOUNTER_TIMESTAMP_MAX_MS - 1,
    lastSeenAtMs: RECORDED_ENCOUNTER_TIMESTAMP_MAX_MS,
  });
  assert.equal(boundary.lastRecordedAtMs, RECORDED_ENCOUNTER_TIMESTAMP_MAX_MS);
  assert.doesNotThrow(() => new Date(boundary.lastRecordedAtMs).toISOString());
});

test("recorded encounter reader requires JSON and enforces the 4 KiB byte cap", async () => {
  await assert.rejects(
    () =>
      readRecordedEncounterJson(
        new Request("https://cosmography.test/api/v1/me/discoveries", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "{}",
        }),
      ),
    (error: unknown) =>
      error instanceof Error && error.message.includes("application/json"),
  );
  await assert.rejects(
    () =>
      readRecordedEncounterJson(
        new Request("https://cosmography.test/api/v1/me/discoveries", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ padding: "x".repeat(4_096) }),
        }),
      ),
    (error: unknown) =>
      error instanceof Error && error.message.includes("4 KiB"),
  );
});
