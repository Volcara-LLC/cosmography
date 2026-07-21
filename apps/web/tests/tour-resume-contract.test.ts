import assert from "node:assert/strict";
import test from "node:test";

import { sevenScalesToJezeroTour } from "../app/data/tours/seven-scales-to-jezero";
import {
  assertTourResumeTourContract,
  createStoredTourResumeJson,
  parseStoredTourResumeRow,
  readTourResumeJson,
  TOUR_RESUME_METRIC_CODE,
  TOUR_RESUME_RELEASE_ID,
  TOUR_RESUME_SCHEMA_ID,
  TOUR_RESUME_SCHEMA_VERSION,
  TOUR_RESUME_SCOPE_ENTITY_ID,
  TOUR_RESUME_TIMESTAMP_MAX_MS,
  TOUR_RESUME_TOUR_ID,
  TourResumeDeleteInputSchema,
  tourResumeEnvelope,
  TourResumePutInputSchema,
} from "../app/lib/personal/tour-resume";

const mappings = [
  [1, "scale-observable-universe", "Known Universe", "observable-universe"],
  [2, "scale-laniakea", "Laniakea", "laniakea"],
  [3, "scale-local-group", "Local Group", "local-group"],
  [4, "scale-milky-way", "Milky Way", "milky-way"],
  [5, "scale-solar-system", "Solar System", "solar-system"],
  [6, "scale-mars", "Mars", "mars"],
  [7, "scale-jezero", "Jezero Crater", "jezero"],
] as const;

test("Seven Scales resume constants and inputs are exact and strict", () => {
  assert.equal(TOUR_RESUME_SCHEMA_ID, "cosmography.user-tour-resume");
  assert.equal(TOUR_RESUME_SCHEMA_VERSION, "1.0.0");
  assert.equal(TOUR_RESUME_TOUR_ID, "tour_seven_scales_to_jezero_v1");
  assert.equal(TOUR_RESUME_SCOPE_ENTITY_ID, TOUR_RESUME_TOUR_ID);
  assert.equal(TOUR_RESUME_METRIC_CODE, "manual-resume-point-v1");
  assert.equal(TOUR_RESUME_RELEASE_ID, "rel_landing_atlas_v0_1_0");

  for (const expectedSavedAtMs of [null, 1, TOUR_RESUME_TIMESTAMP_MAX_MS]) {
    assert.equal(
      TourResumePutInputSchema.safeParse({
        tourId: TOUR_RESUME_TOUR_ID,
        releaseId: TOUR_RESUME_RELEASE_ID,
        resumeOrdinal: 1,
        expectedSavedAtMs,
      }).success,
      true,
    );
  }
  for (const invalid of [
    {},
    {
      tourId: "tour_other",
      releaseId: TOUR_RESUME_RELEASE_ID,
      resumeOrdinal: 1,
      expectedSavedAtMs: null,
    },
    {
      tourId: TOUR_RESUME_TOUR_ID,
      releaseId: "rel_future",
      resumeOrdinal: 1,
      expectedSavedAtMs: null,
    },
    {
      tourId: TOUR_RESUME_TOUR_ID,
      releaseId: TOUR_RESUME_RELEASE_ID,
      resumeOrdinal: 0,
      expectedSavedAtMs: null,
    },
    {
      tourId: TOUR_RESUME_TOUR_ID,
      releaseId: TOUR_RESUME_RELEASE_ID,
      resumeOrdinal: 8,
      expectedSavedAtMs: null,
    },
    {
      tourId: TOUR_RESUME_TOUR_ID,
      releaseId: TOUR_RESUME_RELEASE_ID,
      resumeOrdinal: 1.5,
      expectedSavedAtMs: null,
    },
    {
      tourId: TOUR_RESUME_TOUR_ID,
      releaseId: TOUR_RESUME_RELEASE_ID,
      resumeOrdinal: 1,
      expectedSavedAtMs: 0,
    },
    {
      tourId: TOUR_RESUME_TOUR_ID,
      releaseId: TOUR_RESUME_RELEASE_ID,
      resumeOrdinal: 1,
      expectedSavedAtMs: null,
      passiveNavigation: true,
    },
  ]) {
    assert.equal(TourResumePutInputSchema.safeParse(invalid).success, false);
  }
  assert.equal(
    TourResumeDeleteInputSchema.safeParse({ expectedSavedAtMs: 1 }).success,
    true,
  );
  assert.equal(
    TourResumeDeleteInputSchema.safeParse({ expectedSavedAtMs: null }).success,
    false,
  );
  assert.equal(
    TourResumeDeleteInputSchema.safeParse({
      expectedSavedAtMs: 1,
      resumeOrdinal: 1,
    }).success,
    false,
  );
});

test("all seven stored mappings derive the exact private public record", () => {
  for (const [ordinal, stopId, stopTitle, targetEntityId] of mappings) {
    const savedAtMs = 1_000 + ordinal;
    const valueJson = createStoredTourResumeJson(ordinal, savedAtMs);
    const stored = JSON.parse(valueJson) as Record<string, unknown>;
    assert.deepEqual(Object.keys(stored), [
      "schemaId",
      "schemaVersion",
      "tourId",
      "tourSlug",
      "releaseId",
      "resumeOrdinal",
      "stopId",
      "targetEntityId",
      "savedAtMs",
      "method",
      "truth",
    ]);
    assert.equal(stored.resumeOrdinal, ordinal);
    assert.equal(stored.stopId, stopId);
    assert.equal(stored.targetEntityId, targetEntityId);
    assert.deepEqual(stored.truth, {
      userConfirmed: true,
      passiveNavigation: false,
      resumeStateOnly: true,
      storedStateDefinesTour: false,
      completionClaim: false,
      achievementClaim: false,
      scientificDiscoveryClaim: false,
    });

    const record = parseStoredTourResumeRow({
      valueNumeric: ordinal,
      valueJson,
      updatedAtMs: savedAtMs,
    });
    assert.deepEqual(Object.keys(record), [
      "tour",
      "resume",
      "savedAtMs",
      "method",
      "truth",
    ]);
    assert.deepEqual(record.tour, {
      id: TOUR_RESUME_TOUR_ID,
      slug: "seven-scales-to-jezero",
      title: "Seven Scales to Jezero",
      releaseId: TOUR_RESUME_RELEASE_ID,
    });
    assert.deepEqual(record.resume, {
      ordinal,
      stopId,
      stopTitle,
      targetEntityId,
      href: `/?tour=seven-scales-to-jezero&step=${ordinal}&focus=${targetEntityId}&release=${TOUR_RESUME_RELEASE_ID}`,
    });
    assert.equal(record.savedAtMs, savedAtMs);
    assert.equal(record.method, "manual-save-resume-point");
    assert.deepEqual(record.truth, stored.truth);
    assert.equal("userId" in record, false);
    assert.equal("valueJson" in record, false);
  }
});

test("runtime contract pins every frozen stop title and tour title", () => {
  assert.doesNotThrow(() =>
    assertTourResumeTourContract(sevenScalesToJezeroTour),
  );
  assert.throws(
    () =>
      assertTourResumeTourContract({
        ...sevenScalesToJezeroTour,
        title: "Seven Stops to Jezero",
      }),
    /tour contract has drifted/,
  );
  for (const index of mappings.keys()) {
    assert.throws(
      () =>
        assertTourResumeTourContract({
          ...sevenScalesToJezeroTour,
          stops: sevenScalesToJezeroTour.stops.map((stop, stopIndex) =>
            stopIndex === index
              ? { ...stop, title: `${stop.title} drifted` }
              : stop,
          ),
        }),
      /tour contract has drifted/,
    );
  }
});

test("stored resume parsing fails closed on noncanonical, mismatched, or drifted state", () => {
  const savedAtMs = 1_000;
  const canonical = JSON.parse(
    createStoredTourResumeJson(6, savedAtMs),
  ) as Record<string, unknown>;
  const truth = canonical.truth as Record<string, unknown>;
  const driftedJson = [
    { ...canonical, releaseId: "rel_future" },
    { ...canonical, resumeOrdinal: 5 },
    { ...canonical, stopId: "scale-jezero" },
    { ...canonical, targetEntityId: "jezero" },
    { ...canonical, savedAtMs: savedAtMs + 1 },
    { ...canonical, method: "passive-navigation" },
    { ...canonical, truth: { ...truth, completionClaim: true } },
    { ...canonical, extra: true },
  ];
  for (const value of driftedJson) {
    assert.throws(
      () =>
        parseStoredTourResumeRow({
          valueNumeric: 6,
          valueJson: JSON.stringify(value),
          updatedAtMs: savedAtMs,
        }),
      /Stored Seven Scales resume/,
    );
  }
  for (const row of [
    { valueNumeric: null, valueJson: JSON.stringify(canonical), updatedAtMs: savedAtMs },
    { valueNumeric: 0, valueJson: JSON.stringify(canonical), updatedAtMs: savedAtMs },
    { valueNumeric: 8, valueJson: JSON.stringify(canonical), updatedAtMs: savedAtMs },
    { valueNumeric: 6, valueJson: null, updatedAtMs: savedAtMs },
    { valueNumeric: 6, valueJson: "{", updatedAtMs: savedAtMs },
    { valueNumeric: 6, valueJson: ` ${JSON.stringify(canonical)}`, updatedAtMs: savedAtMs },
    { valueNumeric: 6, valueJson: JSON.stringify(canonical), updatedAtMs: 0 },
    {
      valueNumeric: 6,
      valueJson: JSON.stringify(canonical),
      updatedAtMs: TOUR_RESUME_TIMESTAMP_MAX_MS + 1,
    },
  ]) {
    assert.throws(() => parseStoredTourResumeRow(row), /Stored Seven Scales resume/);
  }
});

test("resume timestamps include the JavaScript Date boundary and envelope stays singular", () => {
  const record = parseStoredTourResumeRow({
    valueNumeric: 7,
    valueJson: createStoredTourResumeJson(7, TOUR_RESUME_TIMESTAMP_MAX_MS),
    updatedAtMs: TOUR_RESUME_TIMESTAMP_MAX_MS,
  });
  assert.doesNotThrow(() => new Date(record.savedAtMs).toISOString());
  assert.deepEqual(Object.keys(tourResumeEnvelope(record)), [
    "schemaId",
    "schemaVersion",
    "record",
  ]);
  assert.deepEqual(tourResumeEnvelope(null), {
    schemaId: TOUR_RESUME_SCHEMA_ID,
    schemaVersion: TOUR_RESUME_SCHEMA_VERSION,
    record: null,
  });
});

test("resume JSON reader requires application/json, valid UTF-8, and at most 4 KiB", async () => {
  await assert.rejects(
    () =>
      readTourResumeJson(
        new Request("https://cosmography.test/resume", {
          method: "PUT",
          headers: { "content-type": "text/plain" },
          body: "{}",
        }),
      ),
    /application\/json/,
  );
  await assert.rejects(
    () =>
      readTourResumeJson(
        new Request("https://cosmography.test/resume", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ padding: "x".repeat(4_096) }),
        }),
      ),
    /4 KiB/,
  );
  await assert.rejects(
    () =>
      readTourResumeJson(
        new Request("https://cosmography.test/resume", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: new Uint8Array([0xff]),
        }),
      ),
    /UTF-8 JSON/,
  );
});
