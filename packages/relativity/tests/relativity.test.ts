import assert from "node:assert/strict";
import test from "node:test";
import {
  BlackHoleEvidenceSchema,
  BlackHoleRenderManifestSchema,
  equatorialIscoRadiusRg,
  equatorialPhotonOrbitRadiusRg,
  gravitationalRadiusMeters,
  gravitationalTimeSeconds,
  outerHorizonRadiusRg,
  schwarzschildCriticalCurveDiameterMicroarcseconds,
} from "../src/index.js";

test("Schwarzschild reference radii use GM/c² units", () => {
  assert.equal(outerHorizonRadiusRg(0), 2);
  assert.ok(Math.abs(equatorialPhotonOrbitRadiusRg(0, "prograde") - 3) < 1e-12);
  assert.ok(Math.abs(equatorialIscoRadiusRg(0, "prograde") - 6) < 1e-12);
});

test("Kerr prograde and retrograde reference radii separate correctly", () => {
  assert.ok(outerHorizonRadiusRg(1) - 1 < 1e-12);
  assert.ok(Math.abs(equatorialPhotonOrbitRadiusRg(1, "prograde") - 1) < 1e-12);
  assert.ok(Math.abs(equatorialPhotonOrbitRadiusRg(1, "retrograde") - 4) < 1e-12);
  assert.ok(Math.abs(equatorialIscoRadiusRg(1, "prograde") - 1) < 1e-12);
  assert.ok(Math.abs(equatorialIscoRadiusRg(1, "retrograde") - 9) < 1e-12);
});

test("solar-mass conversions retain expected physical scale", () => {
  assert.ok(Math.abs(gravitationalRadiusMeters(1) - 1476.67) < 0.2);
  assert.ok(Math.abs(gravitationalTimeSeconds(1) - 4.9255e-6) < 1e-9);
});

test("Sgr A* critical-curve cross-check is in the EHT-scale range", () => {
  const diameter = schwarzschildCriticalCurveDiameterMicroarcseconds(4_000_000, 8_000);
  assert.ok(diameter > 48 && diameter < 55, `unexpected reference diameter ${diameter}`);
});

test("interferometric image reconstructions cannot collapse into direct observations", () => {
  assert.equal(
    BlackHoleEvidenceSchema.parse("interferometric-reconstruction"),
    "interferometric-reconstruction",
  );
  assert.equal(
    BlackHoleEvidenceSchema.parse("processed-observation"),
    "processed-observation",
  );
});

test("invalid spin and missing render validation fail closed", () => {
  assert.throws(() => outerHorizonRadiusRg(1.001), /spin/i);
  const result = BlackHoleRenderManifestSchema.safeParse({
    id: "bhr_unvalidated",
    schemaVersion: "0.1.0",
  });
  assert.equal(result.success, false);
});

test("generative output cannot pass as a validated Kerr simulation", () => {
  const result = BlackHoleRenderManifestSchema.safeParse({
    id: "bhr_sgra_bad_ai",
    schemaVersion: "0.1.0",
    object: {
      id: "bh_sgra",
      name: "Sgr A* scenario",
      massSolar: 4_000_000,
      distanceParsecs: 8_000,
      dimensionlessSpin: 0.5,
      inclinationDegrees: null,
      parameterEvidence: "derived-result",
      sources: [{ id: "src", title: "Source", url: "https://example.org", release: "v1", retrievedAt: "2026-07-19" }],
    },
    camera: { radiusRg: 100, inclinationDegrees: 60, azimuthDegrees: 0, fieldOfViewDegrees: 45, tetradDefinition: "documented", motionModel: "stationary observer" },
    integrator: { metric: "Kerr", coordinateSystem: "Boyer-Lindquist", method: "reference integrator", codeCommit: "abcdef1", absoluteTolerance: 1e-8, relativeTolerance: 1e-8, maxSteps: 10000, rayBundleMode: "single-ray" },
    emission: { kind: "none", statement: "Lensing-only reference" },
    backgroundManifestSha256: "a".repeat(64),
    label: { evidence: "physics-simulation", appearance: "representative-color", geometry: "kerr-spacetime", timeState: "conceptual", aiInvolvement: "generative-output" },
    references: [{ id: "method", title: "Method", url: "https://example.org/method", release: "v1", retrievedAt: "2026-07-19" }],
    validation: { schwarzschildDeflection: "passed", criticalCurve: "passed", conservationConstants: "passed", stepConvergence: "passed", independentReference: "passed", reportSha256: "b".repeat(64) },
  });
  assert.equal(result.success, false);
});
