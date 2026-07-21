import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseHorizonsVectorArtifact } from "../app/data/missions/horizons-vector-parser";
import { voyager1 } from "../app/data/missions/voyager-1";
import {
  TravelEstimateSchema,
  TravelModeCatalogSchema,
  VOYAGER1_SPEED_REFERENCE,
  Voyager1SpeedReferenceSchema,
  estimateTravel,
  formatDurationYears,
  getTravelMode,
  parseTravelModeCatalog,
  travelModes,
} from "../app/lib/navigation/travel";

const ASTRONOMICAL_UNIT_KILOMETERS = 149_597_870.7;
const SECONDS_PER_DAY = 86_400;
const SPEED_OF_LIGHT_KILOMETERS_PER_SECOND = 299_792.458;

function assertDeeplyFrozen(value: unknown): void {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

test("Flight Deck publishes exactly five ordered and immutable truth classes", () => {
  assert.deepEqual(
    travelModes.map(({ id, truthClass }) => ({ id, truthClass })),
    [
      { id: "instant", truthClass: "navigation" },
      { id: "light", truthClass: "physical-limit" },
      { id: "voyager", truthClass: "historical-comparison" },
      { id: "fusion", truthClass: "hypothetical-physical" },
      { id: "warp", truthClass: "fictional-only" },
    ],
  );
  assert.equal(travelModes.length, 5);
  assert.equal(travelModes.every((mode) => mode.actualJourneyClaim === false), true);
  assert.equal(travelModes.every((mode) => mode.availableVehicle === false), true);
  assert.equal(getTravelMode("fusion").fictional, false);
  assert.equal(getTravelMode("warp").fictional, true);
  assert.doesNotMatch(getTravelMode("voyager").label, /Voyager-class/i);
  assertDeeplyFrozen(travelModes);
});

test("Voyager comparison is pinned to the exact frozen Horizons epoch and vector", async () => {
  const reference = VOYAGER1_SPEED_REFERENCE;
  const parsed = parseHorizonsVectorArtifact(
    await readFile(
      new URL("./fixtures/horizons/voyager-1-vectors-2026-07-19.txt", import.meta.url),
      "utf8",
    ),
  );
  const golden = voyager1.provenance.horizonsValidation.goldenEpochs.find(
    (candidate) => candidate.epochId === "horizons-1990-02-14",
  );
  const source = voyager1.sources.find(
    (candidate) => candidate.id === reference.sourceId,
  );
  assert.ok(golden);
  assert.ok(source);

  assert.equal(
    reference.artifactSha256,
    voyager1.trajectory.responseArtifact.sha256,
  );
  assert.equal(
    reference.artifactPath,
    voyager1.trajectory.responseArtifact.repositoryPath,
  );
  assert.equal(reference.epochTdb, golden.epochTdb);
  assert.equal(reference.julianDateTdb, golden.julianDateTdb);
  assert.deepEqual(reference.velocityAuPerDay, golden.velocityAuPerDay);
  assert.equal(reference.solutionName, voyager1.trajectory.solutionName);
  assert.equal(reference.solutionName, parsed.solutionName);
  assert.equal(reference.center, voyager1.trajectory.centerName);
  assert.equal(reference.center, parsed.centerName);
  assert.equal(reference.centerNaifId, voyager1.trajectory.centerNaifId);
  assert.equal(reference.centerNaifId, parsed.centerNaifId);
  assert.equal(reference.referenceFrame, voyager1.trajectory.frame);
  assert.equal(reference.referenceFrame, parsed.referenceFrame);
  assert.equal(reference.referenceSystem, voyager1.trajectory.referenceSystem);
  assert.equal(reference.referenceSystem, parsed.referenceSystem);
  assert.equal(reference.outputUnits, parsed.outputUnits);
  assert.equal(reference.aberrationCorrection, parsed.correction);

  const speedKilometersPerSecond =
    Math.hypot(...golden.velocityAuPerDay) *
    (ASTRONOMICAL_UNIT_KILOMETERS / SECONDS_PER_DAY);
  assert.equal(reference.speedKilometersPerSecond, speedKilometersPerSecond);
  assert.equal(
    reference.fractionOfLightSpeed,
    speedKilometersPerSecond / SPEED_OF_LIGHT_KILOMETERS_PER_SECOND,
  );
  assert.ok(
    Math.abs(reference.speedKilometersPerSecond - 17.882843512) < 1e-9,
  );
  assert.ok(
    Math.abs(reference.fractionOfLightSpeed - 0.000059650745) < 1e-12,
  );
  assert.equal(reference.comparisonUse, "counterfactual-constant-speed-only");
  assert.equal(reference.trajectoryClaim, false);
  assert.equal(reference.telemetryClaim, false);
  assertDeeplyFrozen(reference);
});

test("map navigation and fictional warp never emit a duration", () => {
  const mapJump = estimateTravel(4.2465, "instant");
  assert.equal(mapJump.resultKind, "semantic-navigation");
  assert.equal(mapJump.durationYears, null);
  assert.equal(mapJump.durationLabel, null);
  assert.equal(mapJump.fictional, false);
  assert.match(mapJump.scientificMeaning, /no physical journey or duration/i);

  const warp = estimateTravel(4.2465, "warp");
  assert.equal(warp.resultKind, "fictional-only");
  assert.equal(warp.durationYears, null);
  assert.equal(warp.durationLabel, null);
  assert.equal(warp.fictional, true);
  assert.match(warp.scientificMeaning, /no scientific duration/i);
});

test("light time uses source distance and never claims a ship", () => {
  const estimate = estimateTravel(4.2465, "light");
  assert.equal(estimate.resultKind, "source-distance-light-time");
  assert.equal(estimate.durationYears, 4.2465);
  assert.equal(estimate.durationLabel, "4.25 years");
  assert.equal(estimate.speedFractionOfC, 1);
  assert.equal(estimate.counterfactual, false);
  assert.equal(estimate.availableVehicle, false);
  assert.match(estimate.scientificMeaning, /signal, not a spacecraft/i);
});

test("Voyager and fusion estimates remain counterfactual physical comparisons", () => {
  const voyager = estimateTravel(1, "voyager");
  assert.equal(voyager.truthClass, "historical-comparison");
  assert.equal(voyager.resultKind, "constant-speed-counterfactual");
  assert.equal(
    voyager.durationYears,
    1 / VOYAGER1_SPEED_REFERENCE.fractionOfLightSpeed,
  );
  assert.deepEqual(voyager.sourceIds, [VOYAGER1_SPEED_REFERENCE.sourceId]);
  assert.equal(voyager.fictional, false);
  assert.equal(voyager.counterfactual, true);
  assert.equal(voyager.trajectoryClaim, false);
  assert.equal(voyager.telemetryClaim, false);
  assert.match(voyager.scientificMeaning, /not its trajectory, not telemetry/i);

  const fusion = estimateTravel(10, "fusion");
  assert.equal(fusion.truthClass, "hypothetical-physical");
  assert.equal(fusion.resultKind, "constant-speed-counterfactual");
  assert.equal(fusion.durationYears, 100);
  assert.equal(fusion.durationLabel, "100 years");
  assert.equal(fusion.speedFractionOfC, 0.1);
  assert.equal(fusion.fictional, false);
  assert.equal(fusion.availableVehicle, false);
  assert.match(fusion.scientificMeaning, /no available spacecraft/i);
});

test("physical comparisons wait for source distance and all estimates are immutable", () => {
  for (const modeId of ["light", "voyager", "fusion"] as const) {
    const estimate = estimateTravel(undefined, modeId);
    assert.equal(estimate.resultKind, "awaiting-source-distance");
    assert.equal(estimate.durationYears, null);
    assert.equal(estimate.durationLabel, null);
    assert.match(estimate.scientificMeaning, /release-backed source distance/i);
    assertDeeplyFrozen(estimate);
  }
});

test("travel schemas reject drift, unknown fields, invalid IDs, and unsafe numbers", () => {
  assert.doesNotThrow(() => parseTravelModeCatalog(structuredClone(travelModes)));
  assert.equal(TravelModeCatalogSchema.safeParse(travelModes).success, true);
  assert.equal(
    Voyager1SpeedReferenceSchema.safeParse(VOYAGER1_SPEED_REFERENCE).success,
    true,
  );

  const fusionDrift = structuredClone(travelModes) as unknown as Array<
    Record<string, unknown>
  >;
  fusionDrift[3]!.fictional = true;
  assert.equal(TravelModeCatalogSchema.safeParse(fusionDrift).success, false);

  const sourceDrift = structuredClone(travelModes) as unknown as Array<
    Record<string, unknown>
  >;
  const voyager = sourceDrift[2]!.reference as Record<string, unknown>;
  voyager.artifactSha256 = "0".repeat(64);
  assert.equal(TravelModeCatalogSchema.safeParse(sourceDrift).success, false);

  const unknownField = structuredClone(travelModes) as unknown as Array<
    Record<string, unknown>
  >;
  unknownField[0]!.durationSeconds = 0;
  assert.equal(TravelModeCatalogSchema.safeParse(unknownField).success, false);

  assert.throws(() => getTravelMode("unknown"));
  assert.throws(() => estimateTravel(-1, "light"));
  assert.throws(() => estimateTravel(Number.NaN, "light"));
  assert.throws(() => estimateTravel(Number.POSITIVE_INFINITY, "light"));
  assert.throws(() => formatDurationYears(-1));
  assert.throws(() => formatDurationYears(Number.NaN));

  const estimateDrift = structuredClone(estimateTravel(1, "voyager"));
  Reflect.set(estimateDrift, "telemetryClaim", true);
  assert.equal(TravelEstimateSchema.safeParse(estimateDrift).success, false);

  const truthProseDrift = structuredClone(estimateTravel(1, "light"));
  Reflect.set(
    truthProseDrift,
    "scientificMeaning",
    "This is a crewed spacecraft trip plan with a physically available vehicle.",
  );
  assert.equal(TravelEstimateSchema.safeParse(truthProseDrift).success, false);
});

test("duration labels retain sub-minute information and singular units", () => {
  const secondsPerYear = 365.25 * 86_400;
  assert.equal(formatDurationYears(0), "0 seconds");
  assert.equal(formatDurationYears(1 / secondsPerYear), "1 second");
  assert.equal(formatDurationYears(60 / secondsPerYear), "1 minute");
  assert.equal(formatDurationYears(3_600 / secondsPerYear), "1 hour");
  assert.equal(formatDurationYears(1 / 365.25), "1 day");
  assert.equal(formatDurationYears(1), "1 year");
});
