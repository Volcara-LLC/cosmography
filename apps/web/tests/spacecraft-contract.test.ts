import assert from "node:assert/strict";
import test from "node:test";

import {
  isSpacecraftQuotaError,
  parseStoredSpacecraftRow,
  readSpacecraftJson,
  SPACECRAFT_PROPULSION_MODELS,
  spacecraftEnvelope,
  SpacecraftAppearanceSchema,
  SpacecraftCreateInputSchema,
  SpacecraftDisplayNameSchema,
  SpacecraftIdSchema,
  spacecraftPatchChangesRecord,
  SpacecraftPatchInputSchema,
  SpacecraftRequestError,
  verifyPropulsionModelRow,
} from "../app/lib/personal/spacecraft";
import {
  isCanonicalSpacecraftDisplayName,
  normalizeSpacecraftDisplayName,
  spacecraftDisplayNameIssue,
} from "../app/lib/personal/spacecraft-display-name";

const appearance = {
  schemaId: "cosmography.user-spacecraft.appearance" as const,
  schemaVersion: "1.0.0" as const,
  hullPreset: "pearl" as const,
  accentPreset: "cyan" as const,
  insignia: "orbit" as const,
};

const omittedPhysics = [
  "acceleration",
  "deceleration",
  "energy",
  "route-geometry",
  "mission-constraints",
  "traveler-frame-time",
  "relativistic-observer-effects",
] as const;

const fusionDefinition = {
  schemaId: "cosmography.propulsion-model",
  schemaVersion: "1.0.0",
  profile: "fusion-0.1c",
  compatibleTravelMode: "fusion",
  truthClass: "hypothetical-physical",
  speedFractionOfC: 0.1,
  fictional: false,
  counterfactual: true,
  personalConcept: true,
  comparisonOnly: true,
  availableVehicle: false,
  actualJourneyClaim: false,
  missionPlan: false,
  trajectoryClaim: false,
  telemetryClaim: false,
  scientificValidation: false,
  disclosure:
    "Hypothetical constant 0.1c comparison only; no available spacecraft or mission is claimed.",
  omittedPhysics,
} as const;

const fusionModelRow = {
  ...SPACECRAFT_PROPULSION_MODELS["fusion-0.1c"],
  definitionJson: JSON.stringify(fusionDefinition),
};

test("spacecraft IDs, names, inputs, and appearance are strict", () => {
  assert.equal(
    SpacecraftIdSchema.safeParse(`ship_${"0".repeat(32)}`).success,
    true,
  );
  assert.equal(
    SpacecraftIdSchema.safeParse(`ship_${"A".repeat(32)}`).success,
    false,
  );
  assert.equal(SpacecraftIdSchema.safeParse("ship_short").success, false);

  assert.equal(SpacecraftDisplayNameSchema.parse("  Cafe\u0301  "), "Café");
  assert.equal(SpacecraftDisplayNameSchema.safeParse("Voyager\n").success, false);
  assert.equal(
    SpacecraftDisplayNameSchema.safeParse("direction\u202ereversed").success,
    false,
  );
  assert.equal(SpacecraftDisplayNameSchema.safeParse("x".repeat(81)).success, false);
  const eightyAstralCharacters = "🚀".repeat(80);
  assert.equal(SpacecraftDisplayNameSchema.parse(eightyAstralCharacters), eightyAstralCharacters);
  assert.equal(isCanonicalSpacecraftDisplayName(eightyAstralCharacters), true);
  assert.equal(isCanonicalSpacecraftDisplayName("🚀".repeat(81)), false);
  assert.equal(isCanonicalSpacecraftDisplayName(" Cafe\u0301 "), false);
  assert.equal(normalizeSpacecraftDisplayName(" Cafe\u0301 "), "Café");
  assert.equal(spacecraftDisplayNameIssue("hidden\u202edirection"), "forbidden-characters");

  assert.equal(SpacecraftAppearanceSchema.safeParse(appearance).success, true);
  assert.equal(
    SpacecraftAppearanceSchema.safeParse({ ...appearance, customColor: "#fff" })
      .success,
    false,
  );
  assert.equal(
    SpacecraftCreateInputSchema.safeParse({
      displayName: " Horizon ",
      profile: "fusion-0.1c",
      appearance,
    }).data?.displayName,
    "Horizon",
  );
  assert.equal(
    SpacecraftCreateInputSchema.safeParse({
      displayName: "Horizon",
      profile: "fusion-0.1c",
      appearance,
      availableVehicle: true,
    }).success,
    false,
  );
  assert.equal(
    SpacecraftPatchInputSchema.safeParse({ expectedUpdatedAtMs: 1 }).success,
    false,
  );
  assert.equal(
    SpacecraftPatchInputSchema.safeParse({
      expectedUpdatedAtMs: 1,
      profile: "fictional-warp",
      displayName: "Changed",
    }).success,
    false,
  );
});

test("propulsion models and stored spacecraft fail closed on truth drift", () => {
  const model = verifyPropulsionModelRow(fusionModelRow);
  assert.equal(model.profile, "fusion-0.1c");
  assert.equal(model.definition.truthClass, "hypothetical-physical");
  assert.equal(model.definition.availableVehicle, false);

  const record = parseStoredSpacecraftRow({
    id: `ship_${"1".repeat(32)}`,
    displayName: "Horizon",
    propulsionModelId: fusionModelRow.id,
    cosmeticsJson: JSON.stringify(appearance),
    createdAtMs: 1,
    updatedAtMs: 2,
    modelId: fusionModelRow.id,
    modelCode: fusionModelRow.code,
    modelVersion: fusionModelRow.version,
    modelClass: fusionModelRow.modelClass,
    modelTitle: fusionModelRow.title,
    modelDistanceDefinition: fusionModelRow.distanceDefinition,
    modelDefinitionJson: fusionModelRow.definitionJson,
    modelEvidenceClass: fusionModelRow.evidenceClass,
    modelCitationAssertionId: fusionModelRow.citationAssertionId,
  });
  assert.equal(record.profile, "fusion-0.1c");
  assert.equal(record.propulsion.speedFractionOfC, 0.1);
  assert.deepEqual(
    {
      availableVehicle: record.propulsion.availableVehicle,
      actualJourneyClaim: record.propulsion.actualJourneyClaim,
      missionPlan: record.propulsion.missionPlan,
      trajectoryClaim: record.propulsion.trajectoryClaim,
      telemetryClaim: record.propulsion.telemetryClaim,
      scientificValidation: record.propulsion.scientificValidation,
    },
    {
      availableVehicle: false,
      actualJourneyClaim: false,
      missionPlan: false,
      trajectoryClaim: false,
      telemetryClaim: false,
      scientificValidation: false,
    },
  );
  assert.equal("userId" in record, false);
  assert.equal("cosmeticsJson" in record, false);
  assert.equal("definitionJson" in record.propulsion, false);

  const driftedDefinition = { ...fusionDefinition, availableVehicle: true };
  assert.throws(() =>
    verifyPropulsionModelRow({
      ...fusionModelRow,
      definitionJson: JSON.stringify(driftedDefinition),
    }),
  );
  assert.throws(() =>
    verifyPropulsionModelRow({
      ...fusionModelRow,
      title: "Operational fusion craft",
    }),
  );
});

test("PATCH change detection rejects semantic no-ops", () => {
  const current = { displayName: "Horizon", appearance };
  const noOpName = SpacecraftPatchInputSchema.parse({
    expectedUpdatedAtMs: 2,
    displayName: "  Horizon  ",
  });
  const noOpAppearance = SpacecraftPatchInputSchema.parse({
    expectedUpdatedAtMs: 2,
    appearance: { ...appearance },
  });
  const changed = SpacecraftPatchInputSchema.parse({
    expectedUpdatedAtMs: 2,
    displayName: "Far Horizon",
  });
  assert.equal(spacecraftPatchChangesRecord(current, noOpName), false);
  assert.equal(spacecraftPatchChangesRecord(current, noOpAppearance), false);
  assert.equal(spacecraftPatchChangesRecord(current, changed), true);
});

test("spacecraft request reader requires JSON and enforces the 8 KiB byte cap", async () => {
  const parsed = await readSpacecraftJson(
    new Request("https://example.test/api/v1/me/spacecraft", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ hello: "universe" }),
    }),
  );
  assert.deepEqual(parsed, { hello: "universe" });

  await assert.rejects(
    () =>
      readSpacecraftJson(
        new Request("https://example.test/api/v1/me/spacecraft", {
          method: "POST",
          body: "{}",
        }),
      ),
    (error: unknown) =>
      error instanceof SpacecraftRequestError && error.status === 415,
  );
  await assert.rejects(
    () =>
      readSpacecraftJson(
        new Request("https://example.test/api/v1/me/spacecraft", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: `{"value":"${"x".repeat(8_192)}"}`,
        }),
      ),
    (error: unknown) =>
      error instanceof SpacecraftRequestError && error.status === 413,
  );
});

test("spacecraft envelopes and quota detection are stable", () => {
  assert.deepEqual(spacecraftEnvelope([]), {
    schemaId: "cosmography.user-spacecraft",
    schemaVersion: "1.0.0",
    records: [],
  });
  assert.equal(
    isSpacecraftQuotaError(
      new Error("D1_ERROR: durable spacecraft owner quota exceeded"),
    ),
    true,
  );
  assert.equal(
    isSpacecraftQuotaError(
      new Error("Failed query", {
        cause: new Error(
          "D1_ERROR: durable spacecraft owner quota exceeded: SQLITE_CONSTRAINT",
        ),
      }),
    ),
    true,
  );
  assert.equal(isSpacecraftQuotaError(new Error("other constraint")), false);
});
