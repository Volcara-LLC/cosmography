import assert from "node:assert/strict";
import test from "node:test";

import { atlasEntities, atlasRelease } from "../app/data/atlas";
import {
  FLIGHT_DECK_DISTANCE_PROJECTION_VERSION,
  FlightDeckDistanceContractError,
  FlightDeckDistanceBindingSchema,
  createFlightDeckDistanceProjection,
  flightDeckDistanceBindings,
  getFlightDeckDistanceBinding,
} from "../app/lib/navigation/flight-deck-distance";

test("Flight Deck distance inputs are a separate exact-release projection", () => {
  const entitiesWithDistances = atlasEntities.filter(
    (entity) => entity.routeDistanceFromSunLy !== undefined,
  );
  assert.equal(
    flightDeckDistanceBindings.length,
    entitiesWithDistances.length,
  );
  assert.equal(Object.isFrozen(flightDeckDistanceBindings), true);

  for (const entity of entitiesWithDistances) {
    const binding = getFlightDeckDistanceBinding(entity.id);
    assert.ok(binding);
    assert.equal(binding.projectionVersion, FLIGHT_DECK_DISTANCE_PROJECTION_VERSION);
    assert.equal(binding.releaseId, atlasRelease.id);
    assert.equal(
      binding.releaseManifestSha256,
      "e1dc9decfb38fa4996a4fe163dd5eba2b8fc448bea7a9d717a1a4febb3cf5b0e",
    );
    assert.equal(
      binding.releaseContentSha256,
      "beeac15802d8ee504bef88607dcf06dcc052c72e9653ba3213eb0fc966d8ced3",
    );
    assert.equal(binding.distanceLightYears, entity.routeDistanceFromSunLy);
    assert.equal(binding.distanceLabel, entity.distanceLabel);
    assert.deepEqual(
      binding.recordSourceIds,
      entity.sources.map((source) => source.id),
    );
    assert.equal(binding.fieldLevelIngestionLineageAvailable, false);
    assert.equal(binding.straightLineRouteClaim, false);
    assert.equal(Object.isFrozen(binding), true);
    assert.equal(Object.isFrozen(binding.recordSourceIds), true);
  }
});

test("distance projection distinguishes the observer origin without inventing lineage", () => {
  const origin = getFlightDeckDistanceBinding("solar-system");
  assert.ok(origin);
  assert.equal(origin.basis, "observer-origin-definition");
  assert.equal(origin.distanceLightYears, 0);

  const proxima = getFlightDeckDistanceBinding("proxima-centauri");
  assert.ok(proxima);
  assert.equal(proxima.basis, "foundation-destination-record");
  assert.deepEqual(proxima.recordSourceIds, [
    "gaia-dr3",
    "nasa-exoplanet-archive",
  ]);
  assert.match(proxima.scientificMeaning, /not a route length/i);
  assert.match(proxima.scientificMeaning, /lineage is not yet available/i);
});

test("distance projection rejects source, origin, authority, and field drift", () => {
  const proxima = structuredClone(
    getFlightDeckDistanceBinding("proxima-centauri"),
  );
  assert.ok(proxima);

  assert.equal(
    FlightDeckDistanceBindingSchema.safeParse({
      ...proxima,
      fieldLevelIngestionLineageAvailable: true,
    }).success,
    false,
  );
  assert.equal(
    FlightDeckDistanceBindingSchema.safeParse({
      ...proxima,
      straightLineRouteClaim: true,
    }).success,
    false,
  );
  assert.equal(
    FlightDeckDistanceBindingSchema.safeParse({
      ...proxima,
      basis: "observer-origin-definition",
    }).success,
    false,
  );
  assert.equal(
    FlightDeckDistanceBindingSchema.safeParse({
      ...proxima,
      recordSourceIds: [],
    }).success,
    false,
  );
  assert.equal(
    FlightDeckDistanceBindingSchema.safeParse({
      ...proxima,
      newest: true,
    }).success,
    false,
  );
  assert.equal(
    FlightDeckDistanceBindingSchema.safeParse({
      ...proxima,
      scientificMeaning:
        "This is an exact physical route length with complete field-level ingestion lineage.",
    }).success,
    false,
  );

  const sourceDrift = structuredClone(flightDeckDistanceBindings);
  sourceDrift.find(
    (binding) => binding.entityId === "proxima-centauri",
  )!.recordSourceIds[0] = "ned-tap";
  assert.throws(
    () => createFlightDeckDistanceProjection(sourceDrift),
    FlightDeckDistanceContractError,
  );

  const distanceDrift = structuredClone(flightDeckDistanceBindings);
  distanceDrift.find(
    (binding) => binding.entityId === "proxima-centauri",
  )!.distanceLightYears = 4.3;
  assert.throws(
    () => createFlightDeckDistanceProjection(distanceDrift),
    FlightDeckDistanceContractError,
  );

  const meaningDrift = structuredClone(flightDeckDistanceBindings);
  meaningDrift.find(
    (binding) => binding.entityId === "proxima-centauri",
  )!.scientificMeaning =
    "This is an exact physical route length with complete field-level ingestion lineage.";
  assert.throws(() => createFlightDeckDistanceProjection(meaningDrift));

  assert.throws(
    () => createFlightDeckDistanceProjection(sourceDrift.slice(1)),
    FlightDeckDistanceContractError,
  );
});
