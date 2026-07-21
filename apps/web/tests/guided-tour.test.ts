import assert from "node:assert/strict";
import test from "node:test";

import { atlasEntities, atlasRelease } from "../app/data/atlas";
import {
  SEVEN_SCALES_TO_JEZERO_TARGETS,
  sevenScalesToJezeroTour,
} from "../app/data/tours/seven-scales-to-jezero";
import {
  GUIDED_TOUR_NO_AUTHORITY,
  GuidedTourContractError,
  GuidedTourOrdinalError,
  GuidedTourSchema,
  createGuidedTour,
  createGuidedTourLocationSearch,
  parseGuidedTourOrdinal,
} from "../app/lib/education/guided-tour";

const binding = {
  releaseId: atlasRelease.id,
  entities: atlasEntities,
} as const;

function mutableTour(): Record<string, unknown> {
  return structuredClone(sevenScalesToJezeroTour) as unknown as Record<
    string,
    unknown
  >;
}

function mutableStops(tour: Record<string, unknown>) {
  return tour.stops as Record<string, unknown>[];
}

test("Seven Scales to Jezero pins the exact release and ordered semantic path", () => {
  const tour = sevenScalesToJezeroTour;
  assert.equal(tour.releaseId, "rel_landing_atlas_v0_1_0");
  assert.equal(tour.releaseId, atlasRelease.id);
  assert.equal(tour.navigationMode, "semantic-navigation");
  assert.equal(tour.advanceMode, "manual");
  assert.equal(tour.physicalJourneyClaim, false);
  assert.equal(tour.autoAdvance, false);
  assert.equal(
    tour.viewportRepresentation,
    "procedural-scientific-display-context",
  );
  assert.equal(tour.stops.length, 7);
  assert.deepEqual(
    tour.stops.map((stop) => stop.targetEntityId),
    SEVEN_SCALES_TO_JEZERO_TARGETS,
  );
  assert.deepEqual(
    tour.stops.map((stop) => stop.ordinal),
    [1, 2, 3, 4, 5, 6, 7],
  );

  const expectedBindings = [
    ["lightcone", "rep-observable-universe-v0", ["nasa-lambda", "ned-tap"]],
    ["extragalactic", "rep-laniakea-v0", ["ned-tap"]],
    ["extragalactic", "rep-local-group-v0", ["ned-tap"]],
    ["galactic", "rep-milky-way-v0", ["gaia-dr3"]],
    ["system", "rep-solar-system-v0", ["naif-spice", "jpl-horizons"]],
    ["globe", "rep-mars-v0", ["nasa-pds", "usgs-astrogeology", "naif-spice"]],
    ["surface", "rep-jezero-v0", ["nasa-pds", "usgs-astrogeology", "naif-spice"]],
  ] as const;

  assert.deepEqual(
    tour.stops.map((stop) => [
      stop.domain,
      stop.representationId,
      stop.sourceIds,
    ]),
    expectedBindings,
  );

  for (const stop of tour.stops) {
    const entity = atlasEntities.find(
      (candidate) => candidate.id === stop.targetEntityId,
    );
    assert.ok(entity);
    assert.equal(stop.domain, entity.domain);
    assert.equal(stop.representationId, entity.representation.id);
    assert.equal(stop.evidenceClass, entity.representation.evidence);
    assert.deepEqual(
      stop.sourceIds,
      entity.sources.map((source) => source.id),
    );
  }
});

test("tour policy and all nested release records are deeply immutable", () => {
  const tour = sevenScalesToJezeroTour;
  assert.deepEqual(tour.authority, GUIDED_TOUR_NO_AUTHORITY);
  assert.ok(Object.values(tour.authority).every((value) => value === false));
  assert.equal(Object.isFrozen(tour), true);
  assert.equal(Object.isFrozen(tour.authority), true);
  assert.equal(Object.isFrozen(tour.stops), true);
  assert.equal(Object.isFrozen(tour.stops[0]), true);
  assert.equal(Object.isFrozen(tour.stops[0]?.sourceIds), true);
  assert.throws(() => {
    (tour.stops[0].sourceIds as string[]).reverse();
  }, TypeError);
});

test("strict parsing rejects policy drift, unknown fields, duplicates, and ordinal gaps", () => {
  for (const [field, value] of [
    ["navigationMode", "cinematic-flight"],
    ["advanceMode", "automatic"],
    ["physicalJourneyClaim", true],
    ["autoAdvance", true],
    ["viewportRepresentation", "literal-observed-view"],
  ] as const) {
    const candidate = mutableTour();
    candidate[field] = value;
    assert.equal(GuidedTourSchema.safeParse(candidate).success, false, field);
  }

  const authorityDrift = mutableTour();
  (authorityDrift.authority as Record<string, unknown>).renderAllowed = true;
  assert.equal(GuidedTourSchema.safeParse(authorityDrift).success, false);

  const unknownField = mutableTour();
  unknownField.latest = true;
  assert.equal(GuidedTourSchema.safeParse(unknownField).success, false);

  const ordinalGap = mutableTour();
  mutableStops(ordinalGap)[2].ordinal = 4;
  assert.equal(GuidedTourSchema.safeParse(ordinalGap).success, false);

  const duplicateTarget = mutableTour();
  mutableStops(duplicateTarget)[1].targetEntityId = "observable-universe";
  assert.equal(GuidedTourSchema.safeParse(duplicateTarget).success, false);

  const duplicateSource = mutableTour();
  mutableStops(duplicateSource)[0].sourceIds = ["nasa-lambda", "nasa-lambda"];
  assert.equal(GuidedTourSchema.safeParse(duplicateSource).success, false);
});

test("release/entity binding validation fails closed on every pinned field", () => {
  const wrongRelease = mutableTour();
  wrongRelease.releaseId = "rel_another_release";
  assert.throws(
    () => createGuidedTour(wrongRelease, binding),
    (error) =>
      error instanceof GuidedTourContractError && /not bound to release/i.test(error.message),
  );

  for (const [field, value, message] of [
    ["domain", "surface", /entity domain/i],
    ["representationId", "rep-wrong-v0", /representation/i],
    ["evidenceClass", "artist-interpretation", /evidence class/i],
  ] as const) {
    const candidate = mutableTour();
    mutableStops(candidate)[0][field] = value;
    assert.throws(
      () => createGuidedTour(candidate, binding),
      (error) => error instanceof GuidedTourContractError && message.test(error.message),
      field,
    );
  }

  const missingEntity = mutableTour();
  mutableStops(missingEntity)[0].targetEntityId = "absent-entity";
  assert.throws(
    () => createGuidedTour(missingEntity, binding),
    (error) =>
      error instanceof GuidedTourContractError && /absent from release/i.test(error.message),
  );

  const sourceOrderDrift = mutableTour();
  mutableStops(sourceOrderDrift)[0].sourceIds = ["ned-tap", "nasa-lambda"];
  assert.throws(
    () => createGuidedTour(sourceOrderDrift, binding),
    (error) =>
      error instanceof GuidedTourContractError && /ordered release source bindings/i.test(error.message),
  );
});

test("URL ordinal parsing accepts only canonical in-range stop values", () => {
  assert.equal(parseGuidedTourOrdinal("1", 7), 1);
  assert.equal(parseGuidedTourOrdinal("7", 7), 7);

  for (const value of [
    null,
    undefined,
    1,
    "",
    "0",
    "01",
    "+1",
    "1.0",
    " 1",
    "1 ",
    "8",
    "9007199254740992",
  ]) {
    assert.throws(
      () => parseGuidedTourOrdinal(value, 7),
      GuidedTourOrdinalError,
      String(value),
    );
  }

  for (const stopCount of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => parseGuidedTourOrdinal("1", stopCount),
      GuidedTourOrdinalError,
    );
  }
});

test("tour locations discard stale and unknown query state", () => {
  assert.equal(
    createGuidedTourLocationSearch(
      sevenScalesToJezeroTour,
      2,
      "?campaign=preview&travel=warp&appearance=immersive&step=99",
    ),
    "appearance=immersive&tour=seven-scales-to-jezero&step=2&focus=laniakea&release=rel_landing_atlas_v0_1_0",
  );
  assert.equal(
    createGuidedTourLocationSearch(
      sevenScalesToJezeroTour,
      7,
      "?appearance=unknown&release=rel_stale",
    ),
    "tour=seven-scales-to-jezero&step=7&focus=jezero&release=rel_landing_atlas_v0_1_0",
  );
  assert.throws(
    () => createGuidedTourLocationSearch(sevenScalesToJezeroTour, 8),
    GuidedTourOrdinalError,
  );
});
