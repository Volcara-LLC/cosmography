import assert from "node:assert/strict";
import test from "node:test";

import {
  BlackHoleRenderManifestSchema,
  KERR_REFERENCE_INVARIANT_LIMITS,
  KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS,
  KERR_REFERENCE_TRACE_MAX_PIXELS,
  KERR_TERMINATION_REASONS,
  KerrReferenceRayRecordSchema,
  KerrReferenceTraceReportSchema,
  KerrReferenceTraceRequestSchema,
  assertKerrReferenceRayRecordIntegrity,
  assertKerrReferenceTraceReportIntegrity,
  assertKerrReferenceTraceRequestIntegrity,
  canUseKerrReferenceTraceForRender,
  createKerrReferenceTraceReport,
  createKerrReferenceTraceRequest,
  createKerrZamoScreenRay,
  createSchwarzschildEquatorialImpactRay,
  kerrConstantsOfMotion,
  kerrMetricContravariant,
  kerrMetricCovariant,
  kerrMetricInverseResidual,
  kerrNormalizedNullResidual,
  kerrNullHamiltonian,
  kerrSha256Hex,
  kerrStableStringify,
  multiplyKerrMatrices,
  outerHorizonRadiusRg,
  traceKerrNullGeodesic,
  traceKerrReferenceLensMap,
  type KerrReferenceTraceReport,
  type KerrReferenceTraceRequest,
} from "../src/index.js";

const frozenAt = "2026-07-19T20:30:00Z";
const generatedAt = "2026-07-19T20:31:00Z";

function requestFor(
  overrides: {
    spin?: number;
    stepSize?: number;
    maxSteps?: number;
    maxAffineParameter?: number;
    width?: number;
    height?: number;
    inclinationDegrees?: number;
    verticalFieldOfViewDegrees?: number;
  } = {},
): KerrReferenceTraceRequest {
  return createKerrReferenceTraceRequest({
    frozenAt,
    spin: overrides.spin ?? 0.5,
    camera: {
      observer: "zamo",
      radiusRg: 30,
      inclinationDegrees: overrides.inclinationDegrees ?? 90,
      azimuthDegrees: 0,
      verticalFieldOfViewDegrees:
        overrides.verticalFieldOfViewDegrees ?? 30,
      tetrad: "orthonormal-zamo-v1",
    },
    grid: {
      width: overrides.width ?? 3,
      height: overrides.height ?? 3,
      sampling: "pixel-centers-row-major",
    },
    integration: {
      method: "bounded-event-guarded-rk4-hamiltonian",
      derivativeMethod: "analytic-inverse-metric-derivatives",
      stepSize: overrides.stepSize ?? 0.025,
      maxSteps: overrides.maxSteps ?? 4_000,
      maxAffineParameter: overrides.maxAffineParameter ?? 100,
      horizonGuardRg: 0.5,
      escapeRadiusRg: 60,
      thetaGuardRadians: 0.005,
    },
  });
}

function reportFor(request = requestFor()): KerrReferenceTraceReport {
  return traceKerrReferenceLensMap({
    request,
    generatedAt,
    declaredCodeCommit: "abcdef1",
  });
}

function recomputeReportEnvelope(report: Record<string, unknown>): void {
  const rays = report.rays as Array<Record<string, unknown>>;
  const implementation = report.implementation as Record<string, unknown>;
  const identity = {
    requestId: report.requestId,
    requestChecksum: report.requestChecksum,
    generatedAt: report.generatedAt,
    declaredCodeCommit: implementation.declaredCodeCommit,
    rayChecksums: rays.map(({ rayChecksum }) => rayChecksum),
  };
  report.reportId = `krrep_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const { reportChecksum: _checksum, ...unsigned } = report;
  (report.reportChecksum as Record<string, unknown>).value = kerrSha256Hex(
    kerrStableStringify(unsigned),
  );
}

function recomputeRayEnvelope(ray: Record<string, unknown>): void {
  const {
    rayId: _rayId,
    rayChecksum: _rayChecksum,
    ...payload
  } = ray;
  const identity = {
    requestId: ray.requestId,
    requestChecksum: ray.requestChecksum,
    pixelIndex: ray.pixelIndex,
    payloadSha256: kerrSha256Hex(kerrStableStringify(payload)),
  };
  ray.rayId = `krray_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const { rayChecksum: _checksum, ...unsigned } = ray;
  (ray.rayChecksum as Record<string, unknown>).value = kerrSha256Hex(
    kerrStableStringify(unsigned),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

test("covariant and contravariant Kerr metrics multiply to identity", () => {
  for (const [spin, radius, theta] of [
    [0, 10, Math.PI / 2],
    [0.7, 8, 1.1],
    [-0.8, 25, 2.2],
    [0.999, 100, 0.4],
  ] as const) {
    const product = multiplyKerrMatrices(
      kerrMetricCovariant(spin, radius, theta),
      kerrMetricContravariant(spin, radius, theta),
    );
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        assert.ok(
          Math.abs(product[row]![column]! - (row === column ? 1 : 0)) <
            2e-13,
        );
      }
    }
    assert.ok(kerrMetricInverseResidual(spin, radius, theta) < 2e-13);
  }
});

test("metric helpers reject the inner Kerr region, poles, and finite overflow", () => {
  const spin = 0.9;
  const innerHorizon = 1 - Math.sqrt(1 - spin ** 2);
  for (const metric of [kerrMetricCovariant, kerrMetricContravariant]) {
    assert.throws(
      () => metric(spin, innerHorizon / 2, 1),
      /exterior Boyer-Lindquist coordinate domain/i,
    );
    assert.throws(() => metric(spin, 10, 0), /exterior/i);
    assert.throws(
      () => metric(spin, Number.MAX_VALUE, 1),
      /non-finite/i,
    );
  }
  assert.throws(
    () =>
      kerrMetricCovariant(
        spin,
        outerHorizonRadiusRg(spin),
        Math.PI / 2,
      ),
    /exterior/i,
  );
});

test("ZAMO screen rays are future-directed null canonical states", () => {
  for (const screen of [
    [0, 0],
    [0.2, -0.1],
    [-0.35, 0.25],
  ] as const) {
    const ray = createKerrZamoScreenRay({
      spin: 0.7,
      radiusRg: 30,
      thetaRadians: 1.2,
      phiRadians: 0.3,
      screenX: screen[0],
      screenY: screen[1],
    });
    assert.ok(-ray.pT > 0);
    assert.ok(ray.pR < 0);
    assert.ok(Math.abs(kerrNullHamiltonian(0.7, ray)) < 2e-14);
    assert.ok(Number.isFinite(kerrConstantsOfMotion(0.7, ray).carterQ));
  }
});

test("extreme finite screen coordinates remain normalized or reject safely", () => {
  const limitingRay = createKerrZamoScreenRay({
    spin: 0.5,
    radiusRg: 30,
    thetaRadians: 1,
    phiRadians: 0,
    screenX: 1e308,
    screenY: 0,
  });
  assert.ok(Object.values(limitingRay).every(Number.isFinite));
  assert.ok(kerrNormalizedNullResidual(0.5, limitingRay) <= 1e-10);
  assert.ok(Math.abs(kerrNullHamiltonian(0.5, limitingRay)) <= 1e-14);

  assert.throws(
    () =>
      createKerrZamoScreenRay({
        spin: 0.5,
        radiusRg: 30,
        thetaRadians: 1,
        phiRadians: 0,
        screenX: Number.MAX_VALUE,
        screenY: Number.MAX_VALUE,
      }),
    /normalized safely|finite unit vector/i,
  );
});

test("a Schwarzschild radial null ray advances linearly in affine parameter", () => {
  const trace = traceKerrNullGeodesic(
    createSchwarzschildEquatorialImpactRay(20, 0),
    {
      spin: 0,
      stepSize: 0.005,
      maxSteps: 100,
      maxAffineParameter: 0.5,
      horizonGuardRg: 0.5,
      escapeRadiusRg: 30,
      thetaGuardRadians: 0.001,
    },
  );
  assert.equal(trace.termination, "indeterminate-limit");
  assert.ok(Math.abs(trace.finalState.r - 19.5) < 2e-12);
  assert.ok(trace.diagnostics.maxAbsoluteHamiltonian < 1e-12);
  assert.equal(trace.diagnostics.maxRelativeCarterDrift, 0);
});

test("Schwarzschild capture and escape bracket the 3 sqrt(3) critical impact", () => {
  const options = {
    spin: 0,
    stepSize: 0.025,
    maxSteps: 5_000,
    maxAffineParameter: 125,
    horizonGuardRg: 0.5,
    escapeRadiusRg: 50.1,
    thetaGuardRadians: 0.001,
  } as const;
  const captured = traceKerrNullGeodesic(
    createSchwarzschildEquatorialImpactRay(50, 5.15),
    options,
  );
  const escaped = traceKerrNullGeodesic(
    createSchwarzschildEquatorialImpactRay(50, 5.25),
    options,
  );
  assert.equal(captured.termination, "captured-horizon-guard");
  assert.equal(escaped.termination, "escaped-domain");
  assert.equal(
    captured.finalState.r,
    outerHorizonRadiusRg(0) + options.horizonGuardRg,
  );
  assert.equal(escaped.finalState.r, options.escapeRadiusRg);
  assert.equal(
    captured.terminationReason,
    KERR_TERMINATION_REASONS.horizonGuardReached,
  );
  assert.equal(
    escaped.terminationReason,
    KERR_TERMINATION_REASONS.finiteEscapeDomainReached,
  );
  assert.ok(5.15 < 3 * Math.sqrt(3));
  assert.ok(5.25 > 3 * Math.sqrt(3));
});

test("weak-field Schwarzschild deflection approaches the 4M over b limit", () => {
  const radius = 500;
  const impact = 50;
  const trace = traceKerrNullGeodesic(
    createSchwarzschildEquatorialImpactRay(radius, impact),
    {
      spin: 0,
      stepSize: 0.05,
      maxSteps: 25_000,
      maxAffineParameter: 1_500,
      horizonGuardRg: 0.5,
      escapeRadiusRg: radius + 0.1,
      thetaGuardRadians: 0.001,
    },
  );
  assert.equal(trace.termination, "escaped-domain");
  const finiteDistanceFlatAngle = 2 * Math.acos(impact / radius);
  const deflection = Math.abs(trace.finalState.phi) - finiteDistanceFlatAngle;
  assert.ok(deflection > 0.07 && deflection < 0.1, `${deflection}`);
  assert.ok(Math.abs(deflection - 4 / impact) < 0.015);
  assert.ok(trace.diagnostics.maxAbsoluteHamiltonian < 1e-11);
});

test("spin reflection with horizontal momentum reflection preserves the ray", () => {
  const options = {
    stepSize: 0.025,
    maxSteps: 4_000,
    maxAffineParameter: 100,
    horizonGuardRg: 0.5,
    escapeRadiusRg: 60,
    thetaGuardRadians: 0.005,
  } as const;
  const positiveInitial = createKerrZamoScreenRay({
    spin: 0.7,
    radiusRg: 30,
    thetaRadians: Math.PI / 2,
    phiRadians: 0,
    screenX: 0.25,
    screenY: 0.1,
  });
  const negativeInitial = createKerrZamoScreenRay({
    spin: -0.7,
    radiusRg: 30,
    thetaRadians: Math.PI / 2,
    phiRadians: 0,
    screenX: -0.25,
    screenY: 0.1,
  });
  const positive = traceKerrNullGeodesic(positiveInitial, {
    spin: 0.7,
    ...options,
  });
  const negative = traceKerrNullGeodesic(negativeInitial, {
    spin: -0.7,
    ...options,
  });
  assert.equal(positive.termination, negative.termination);
  assert.ok(Math.abs(positive.finalState.r - negative.finalState.r) < 1e-12);
  assert.ok(
    Math.abs(positive.finalState.theta - negative.finalState.theta) < 1e-12,
  );
  assert.ok(Math.abs(positive.finalState.phi + negative.finalState.phi) < 1e-12);
  assert.ok(Math.abs(positiveInitial.pPhi + negativeInitial.pPhi) < 1e-12);
});

test("equatorial reflection preserves radius and azimuth while reflecting theta", () => {
  const options = {
    spin: 0.8,
    stepSize: 0.025,
    maxSteps: 4_000,
    maxAffineParameter: 100,
    horizonGuardRg: 0.5,
    escapeRadiusRg: 60,
    thetaGuardRadians: 0.005,
  } as const;
  const north = traceKerrNullGeodesic(
    createKerrZamoScreenRay({
      spin: options.spin,
      radiusRg: 30,
      thetaRadians: 1.1,
      phiRadians: 0.2,
      screenX: 0.3,
      screenY: 0.25,
    }),
    options,
  );
  const south = traceKerrNullGeodesic(
    createKerrZamoScreenRay({
      spin: options.spin,
      radiusRg: 30,
      thetaRadians: Math.PI - 1.1,
      phiRadians: 0.2,
      screenX: 0.3,
      screenY: -0.25,
    }),
    options,
  );
  assert.equal(north.termination, south.termination);
  assert.ok(Math.abs(north.finalState.r - south.finalState.r) < 5e-13);
  assert.ok(
    Math.abs(north.finalState.theta + south.finalState.theta - Math.PI) <
      2e-14,
  );
  assert.ok(Math.abs(north.finalState.phi - south.finalState.phi) < 2e-14);
  assert.ok(
    Math.abs(north.finalState.pTheta + south.finalState.pTheta) < 2e-13,
  );
});

test("reference requests are deterministic, deeply frozen, bounded, and non-authoritative", () => {
  const first = requestFor();
  const second = requestFor();
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.camera), true);
  assert.equal(Object.isFrozen(first.integration), true);
  assert.equal(first.independentReference, "not-run");
  assert.equal(first.checksumAuthenticatesRecord, false);
  assert.equal(
    first.limits.maxAggregateStepsPerSolverPass,
    KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS,
  );
  assert.equal(first.limits.integrityReplayPasses, 2);
  assert.equal(first.limits.maxTotalSolverPasses, 3);
  assert.equal(first.limits.eventLocalizationIterations, 52);
  assert.equal(
    first.limits.maxEventLocalizationRk4EvaluationsPerSolverPass,
    KERR_REFERENCE_TRACE_MAX_PIXELS *
      first.limits.eventLocalizationIterations,
  );
  assert.equal(
    first.limits.maxEventLocalizationRk4EvaluationsPerSolverPass,
    32_500,
  );
  assert.equal(
    first.limits.maxRk4EvaluationsPerSolverPass,
    first.limits.maxAggregateStepsPerSolverPass +
      first.limits.maxEventLocalizationRk4EvaluationsPerSolverPass,
  );
  assert.equal(first.limits.maxRk4EvaluationsPerSolverPass, 2_032_500);
  assert.equal(
    first.limits.maxTotalConfiguredAcceptedSteps,
    first.limits.maxAggregateStepsPerSolverPass *
      first.limits.maxTotalSolverPasses,
  );
  assert.equal(first.limits.maxTotalConfiguredAcceptedSteps, 6_000_000);
  assert.equal(
    first.limits.maxTotalEventLocalizationRk4Evaluations,
    first.limits.maxEventLocalizationRk4EvaluationsPerSolverPass *
      first.limits.maxTotalSolverPasses,
  );
  assert.equal(
    first.limits.maxTotalEventLocalizationRk4Evaluations,
    97_500,
  );
  assert.equal(
    first.limits.maxTotalRk4Evaluations,
    first.limits.maxRk4EvaluationsPerSolverPass *
      first.limits.maxTotalSolverPasses,
  );
  assert.equal(first.limits.maxTotalRk4Evaluations, 6_097_500);
  assert.equal(
    first.conventions.integrityReplay,
    "ray-factory-replay-plus-report-integrity-replay",
  );
  assert.equal(
    first.conventions.radialEventLocalization,
    `fixed-${first.limits.eventLocalizationIterations}-iteration-rk4-bisection-at-horizon-and-escape-guards`,
  );
  assert.equal(first.renderAllowed, false);
  assert.equal(first.placeholderReplacementAllowed, false);
  assert.equal(first.publicationAllowed, false);
  assert.doesNotThrow(() => assertKerrReferenceTraceRequestIntegrity(first));
  assert.deepEqual(KerrReferenceTraceRequestSchema.parse(first), first);
});

test("request schemas reject unsafe physics and aggregate-work configurations", () => {
  assert.throws(() => requestFor({ spin: 1 }));
  assert.throws(() => requestFor({ width: 4 }));
  assert.throws(() => requestFor({ stepSize: 0.1 }));
  assert.throws(
    () => requestFor({ width: 25, height: 25, maxSteps: 4_000 }),
    /aggregate work budget/i,
  );
  assert.ok(25 * 25 * 4_000 > KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS);
  const invalid = structuredClone(requestFor()) as unknown as Record<
    string,
    unknown
  >;
  (invalid.camera as Record<string, unknown>).radiusRg = 2.5;
  assert.throws(() => KerrReferenceTraceRequestSchema.parse(invalid));
});

test("lens-map reports are deterministic, complete, and explicitly unvalidated", () => {
  const request = requestFor();
  const first = reportFor(request);
  const second = reportFor(request);
  assert.deepEqual(first, second);
  assert.equal(first.rays.length, 9);
  assert.equal(
    Object.values(first.summary.terminationCounts).reduce(
      (total, count) => total + count,
      0,
    ),
    9,
  );
  assert.ok(first.summary.terminationCounts.capturedHorizonGuard > 0);
  assert.ok(first.summary.terminationCounts.escapedDomain > 0);
  assert.equal(first.summary.terminationCounts.numericalFailure, 0);
  assert.equal(first.independentReference, "not-run");
  assert.equal(first.imagePixelsProduced, false);
  assert.equal(first.emissionModelIncluded, false);
  assert.equal(first.radiativeTransferIncluded, false);
  assert.equal(first.checksumAuthenticatesRecord, false);
  assert.equal(
    first.implementation.provenance,
    "caller-declared-unverified",
  );
  assert.equal(first.scientificValidationPassed, false);
  assert.equal(first.renderAllowed, false);
  assert.equal(first.placeholderReplacementAllowed, false);
  assert.equal(first.releaseEligible, false);
  assert.equal(first.publicationAllowed, false);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.rays), true);
  assert.equal(Object.isFrozen(first.rays[0]), true);
  assert.doesNotThrow(() =>
    assertKerrReferenceTraceReportIntegrity(request, first),
  );
  for (const ray of first.rays) {
    assert.equal(ray.checksumAuthenticatesRecord, false);
    assert.doesNotThrow(() =>
      assertKerrReferenceRayRecordIntegrity(request, ray),
    );
  }
});

test("step refinement preserves classification and improves invariant residuals", () => {
  const coarse = reportFor(requestFor({ stepSize: 0.05 }));
  const medium = reportFor(requestFor({ stepSize: 0.025 }));
  const fine = reportFor(
    requestFor({ stepSize: 0.0125, maxSteps: 8_000 }),
  );
  const outcomes = (report: KerrReferenceTraceReport) =>
    report.rays.map(({ termination }) => termination);
  assert.deepEqual(outcomes(coarse), outcomes(medium));
  assert.deepEqual(outcomes(medium), outcomes(fine));
  assert.ok(
    fine.summary.maxAbsoluteHamiltonian <
      medium.summary.maxAbsoluteHamiltonian,
  );
  assert.ok(
    medium.summary.maxAbsoluteHamiltonian <
      coarse.summary.maxAbsoluteHamiltonian,
  );
});

test("bounded exhaustion remains indeterminate instead of becoming a renderable result", () => {
  const request = requestFor({
    width: 1,
    height: 1,
    stepSize: 0.01,
    maxSteps: 100,
    maxAffineParameter: 1,
  });
  const report = reportFor(request);
  assert.equal(report.rays[0]!.termination, "indeterminate-limit");
  assert.equal(report.rays[0]!.lensCoordinate.kind, "unresolved");
  assert.equal(report.renderAllowed, false);
});

test("nonfinite and non-null low-level inputs fail closed", () => {
  const valid = createKerrZamoScreenRay({
    spin: 0.5,
    radiusRg: 30,
    thetaRadians: Math.PI / 2,
    phiRadians: 0,
    screenX: 0,
    screenY: 0,
  });
  assert.throws(
    () =>
      traceKerrNullGeodesic(
        { ...valid, r: Number.NaN },
        {
          spin: 0.5,
          stepSize: 0.025,
          maxSteps: 1_000,
          maxAffineParameter: 25,
          horizonGuardRg: 0.5,
          escapeRadiusRg: 60,
          thetaGuardRadians: 0.005,
        },
      ),
    /finite/i,
  );
  assert.throws(
    () =>
      traceKerrNullGeodesic(
        { ...valid, pR: valid.pR * 0.5 },
        {
          spin: 0.5,
          stepSize: 0.025,
          maxSteps: 1_000,
          maxAffineParameter: 25,
          horizonGuardRg: 0.5,
          escapeRadiusRg: 60,
          thetaGuardRadians: 0.005,
        },
      ),
    /not null/i,
  );
});

test("normalized null and momentum-scale gates reject tiny timelike and huge states", () => {
  const valid = createKerrZamoScreenRay({
    spin: 0.5,
    radiusRg: 30,
    thetaRadians: Math.PI / 2,
    phiRadians: 0,
    screenX: 0,
    screenY: 0,
  });
  const options = {
    spin: 0.5,
    stepSize: 0.025,
    maxSteps: 100,
    maxAffineParameter: 2.5,
    horizonGuardRg: 0.5,
    escapeRadiusRg: 60,
    thetaGuardRadians: 0.005,
  } as const;

  const tinyTimelike = {
    ...valid,
    pT: -1e-4,
    pR: 0,
    pTheta: 0,
    pPhi: 0,
  };
  assert.ok(Math.abs(kerrNullHamiltonian(options.spin, tinyTimelike)) < 1e-8);
  assert.ok(kerrNormalizedNullResidual(options.spin, tinyTimelike) > 0.99);
  assert.throws(
    () => traceKerrNullGeodesic(tinyTimelike, options),
    /not null/i,
  );

  const tinyNull = Object.fromEntries(
    Object.entries(valid).map(([key, value]) => [
      key,
      key.startsWith("p") ? value * 1e-9 : value,
    ]),
  ) as unknown as typeof valid;
  assert.throws(
    () => traceKerrNullGeodesic(tinyNull, options),
    /normalization scale/i,
  );

  const hugeMomentum = {
    ...valid,
    pT: valid.pT * 1e9,
    pR: valid.pR * 1e9,
    pTheta: valid.pTheta * 1e9,
    pPhi: valid.pPhi * 1e9,
  };
  assert.throws(
    () => traceKerrNullGeodesic(hugeMomentum, options),
    /normalization scale/i,
  );
});

test("a null exterior ray with reversed coordinate-time orientation fails closed", () => {
  const spin = 0.9;
  const state = {
    t: 0,
    r: 1.6,
    theta: Math.PI / 2,
    phi: 0,
    pT: -1,
    pR: -24.69131223029621,
    pTheta: 0,
    pPhi: 10,
  };
  const inverse = kerrMetricContravariant(spin, state.r, state.theta);
  const coordinateTimeDerivative =
    inverse[0][0] * state.pT + inverse[0][3] * state.pPhi;
  assert.ok(kerrNormalizedNullResidual(spin, state) < 1e-15);
  assert.ok(coordinateTimeDerivative < 0);
  assert.equal(
    KERR_TERMINATION_REASONS.timeOrientationViolation,
    "time-orientation-violation",
  );
  assert.throws(
    () =>
      traceKerrNullGeodesic(state, {
        spin,
        stepSize: 0.005,
        maxSteps: 100,
        maxAffineParameter: 0.5,
        horizonGuardRg: 0.1,
        escapeRadiusRg: 10,
        thetaGuardRadians: 0.001,
      }),
    /future-directed/i,
  );
});

test("pathological allowed requests fail the invariant gate without yielding coordinates", () => {
  const request = requestFor({
    spin: 0.999,
    width: 1,
    height: 1,
    inclinationDegrees: 90,
    verticalFieldOfViewDegrees: 90,
    stepSize: 0.05,
    maxSteps: 4_000,
    maxAffineParameter: 200,
  });
  const report = reportFor(request);
  const ray = report.rays[0]!;
  assert.equal(ray.termination, "numerical-failure");
  assert.equal(
    ray.terminationReason,
    KERR_TERMINATION_REASONS.invariantToleranceExceeded,
  );
  assert.equal(ray.lensCoordinate.kind, "unresolved");
  assert.equal(report.summary.terminationCounts.numericalFailure, 1);
  assert.ok(
    ray.diagnostics.maxNormalizedNullResidual >
      KERR_REFERENCE_INVARIANT_LIMITS.maxNormalizedNullResidual ||
      ray.diagnostics.maxRelativeCarterDrift >
        KERR_REFERENCE_INVARIANT_LIMITS.maxRelativeCarterDrift ||
      ray.diagnostics.maxNormalizedRadialPotentialResidual >
        KERR_REFERENCE_INVARIANT_LIMITS.maxNormalizedPotentialResidual ||
      ray.diagnostics.maxNormalizedPolarPotentialResidual >
        KERR_REFERENCE_INVARIANT_LIMITS.maxNormalizedPotentialResidual,
  );
  assert.equal(report.renderAllowed, false);
});

test("self-consistent ray rehashes cannot launder camera, path, lens, or outcome semantics", () => {
  const request = requestFor({ width: 1, height: 1 });
  const original = reportFor(request).rays[0]!;
  assert.equal(original.termination, "captured-horizon-guard");

  const cases: ReadonlyArray<
    readonly [string, (ray: Record<string, unknown>) => void]
  > = [
    [
      "camera seed",
      (ray) => {
        const initial = asRecord(ray.initialState);
        initial.phi = (initial.phi as number) + 0.125;
      },
    ],
    [
      "zero-step teleport",
      (ray) => {
        ray.termination = "indeterminate-limit";
        ray.terminationReason = KERR_TERMINATION_REASONS.stepLimitReached;
        ray.steps = 0;
        ray.affineParameter = 0;
        ray.lensCoordinate = { kind: "unresolved" };
        const diagnostics = asRecord(ray.diagnostics);
        diagnostics.minStep = 0;
        diagnostics.maxStep = 0;
        const final = asRecord(ray.finalState);
        final.r = (asRecord(ray.initialState).r as number) - 1;
      },
    ],
    [
      "lens coordinate mismatch",
      (ray) => {
        const lens = asRecord(ray.lensCoordinate);
        lens.thetaRadians = (lens.thetaRadians as number) + 0.01;
      },
    ],
    [
      "endpoint extrema",
      (ray) => {
        const diagnostics = asRecord(ray.diagnostics);
        const initialRadius = asRecord(ray.initialState).r as number;
        const finalRadius = asRecord(ray.finalState).r as number;
        diagnostics.minRadiusRg = Math.min(initialRadius, finalRadius) + 0.01;
      },
    ],
    [
      "inside-horizon capture",
      (ray) => {
        asRecord(ray.finalState).r = outerHorizonRadiusRg(request.spin) / 2;
      },
    ],
    [
      "incoming escape",
      (ray) => {
        ray.termination = "escaped-domain";
        ray.terminationReason =
          KERR_TERMINATION_REASONS.finiteEscapeDomainReached;
        const final = asRecord(ray.finalState);
        final.r = request.integration.escapeRadiusRg;
        final.pR = -1;
        const phi = final.phi as number;
        ray.lensCoordinate = {
          kind: "finite-escape-domain-coordinate",
          thetaRadians: final.theta,
          phiRadians: ((phi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
        };
      },
    ],
  ];

  for (const [label, mutate] of cases) {
    const candidate = structuredClone(original) as unknown as Record<
      string,
      unknown
    >;
    mutate(candidate);
    recomputeRayEnvelope(candidate);
    assert.doesNotThrow(
      () => KerrReferenceRayRecordSchema.parse(candidate),
      `${label} should remain structurally well-formed after rehash`,
    );
    assert.throws(
      () => assertKerrReferenceRayRecordIntegrity(request, candidate),
      /deterministic reference trace|bounded deterministic replay|outcome does not match|initial ZAMO state|request-relative|exterior horizon|finite domain outward/i,
      label,
    );
  }
});

test("standalone rays enforce request-relative bounds and canonical reason codes", () => {
  const request = requestFor({
    width: 1,
    height: 1,
    stepSize: 0.01,
    maxSteps: 100,
    maxAffineParameter: 1,
  });
  const original = reportFor(request).rays[0]!;
  const requestBoundMutations: Array<
    (ray: Record<string, unknown>) => void
  > = [
    (ray) => {
      ray.pixelX = request.grid.width;
      ray.pixelIndex = request.grid.width;
    },
    (ray) => {
      ray.steps = request.integration.maxSteps + 1;
    },
  ];
  for (const mutate of requestBoundMutations) {
    const candidate = structuredClone(original) as unknown as Record<
      string,
      unknown
    >;
    mutate(candidate);
    recomputeRayEnvelope(candidate);
    assert.doesNotThrow(() => KerrReferenceRayRecordSchema.parse(candidate));
    assert.throws(
      () => assertKerrReferenceRayRecordIntegrity(request, candidate),
      /request-relative pixel or work bounds/i,
    );
  }

  const proseReason = structuredClone(original) as unknown as Record<
    string,
    unknown
  >;
  proseReason.terminationReason = "Configured step limit was reached.";
  recomputeRayEnvelope(proseReason);
  assert.equal(KerrReferenceRayRecordSchema.safeParse(proseReason).success, false);

  const mismatchedReason = structuredClone(original) as unknown as Record<
    string,
    unknown
  >;
  mismatchedReason.terminationReason =
    KERR_TERMINATION_REASONS.horizonGuardReached;
  recomputeRayEnvelope(mismatchedReason);
  assert.equal(
    KerrReferenceRayRecordSchema.safeParse(mismatchedReason).success,
    false,
  );
});

test("request and report timestamps require canonical whole-second UTC", () => {
  const template = requestFor({ width: 1, height: 1 });
  for (const invalidTimestamp of [
    "2026-07-19T20:30:00.001Z",
    "2026-07-19T20:30:00.000001Z",
    "2026-07-19T20:30:00+00:00",
  ]) {
    assert.throws(() =>
      createKerrReferenceTraceRequest({
        frozenAt: invalidTimestamp,
        spin: template.spin,
        camera: template.camera,
        grid: template.grid,
        integration: template.integration,
      }),
    );
    assert.throws(() =>
      createKerrReferenceTraceReport({
        request: template,
        generatedAt: invalidTimestamp,
        declaredCodeCommit: "abcdef1",
        rays: [],
      }),
    );
  }
  assert.throws(
    () =>
      createKerrReferenceTraceReport({
        request: template,
        generatedAt: "2026-07-19T20:29:59Z",
        declaredCodeCommit: "abcdef1",
        rays: [],
      }),
    /precede/i,
  );
});

test("report factory and verifier reject oversized ray arrays before inspecting elements", () => {
  const request = requestFor({ width: 1, height: 1 });
  let propertyReads = 0;
  const poison = new Proxy(Object.create(null) as Record<string, unknown>, {
    get() {
      propertyReads += 1;
      throw new Error("oversized ray element was inspected");
    },
    ownKeys() {
      propertyReads += 1;
      throw new Error("oversized ray element was enumerated");
    },
  });
  const oversized = Array.from(
    { length: KERR_REFERENCE_TRACE_MAX_PIXELS + 1 },
    () => poison,
  );
  assert.throws(
    () =>
      createKerrReferenceTraceReport({
        request,
        generatedAt,
        declaredCodeCommit: "abcdef1",
        rays: oversized,
      }),
    /exactly one bounded ray/i,
  );
  assert.equal(propertyReads, 0);

  assert.throws(
    () =>
      assertKerrReferenceTraceReportIntegrity(request, {
        rays: oversized,
      }),
    /preflight exactly one bounded ray/i,
  );
  assert.equal(propertyReads, 0);
});

test("canonical Kerr JSON rejects ambiguous values and normalizes negative zero", () => {
  assert.equal(kerrStableStringify({ value: -0 }), '{"value":0}');
  assert.throws(
    () => kerrStableStringify({ value: undefined }),
    /undefined/i,
  );
  assert.throws(
    () => kerrStableStringify({ value: new Date(0) }),
    /plain objects/i,
  );
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => kerrStableStringify(cyclic), /cyclic/i);
});

test("report integrity rejects tampering, reordering, and authority laundering", () => {
  const request = requestFor();
  const report = reportFor(request);

  const tamperedRay = structuredClone(report) as unknown as Record<
    string,
    unknown
  >;
  const rays = tamperedRay.rays as Array<Record<string, unknown>>;
  (rays[0]!.finalState as Record<string, unknown>).phi = 99;
  recomputeReportEnvelope(tamperedRay);
  assert.throws(
    () => assertKerrReferenceTraceReportIntegrity(request, tamperedRay),
    /ray identity mismatch|ray checksum mismatch/i,
  );

  const reordered = structuredClone(report) as unknown as Record<string, unknown>;
  (reordered.rays as unknown[]).reverse();
  recomputeReportEnvelope(reordered);
  assert.throws(
    () => assertKerrReferenceTraceReportIntegrity(request, reordered),
    /grid order/i,
  );

  const laundered = structuredClone(report) as unknown as Record<string, unknown>;
  laundered.renderAllowed = true;
  assert.throws(
    () => assertKerrReferenceTraceReportIntegrity(request, laundered),
    /invalid input/i,
  );
});

test("reference traces and structural copies cannot authorize a renderer", () => {
  const request = requestFor();
  const report = reportFor(request);
  assert.equal(canUseKerrReferenceTraceForRender(request), false);
  assert.equal(canUseKerrReferenceTraceForRender(report), false);
  assert.equal(canUseKerrReferenceTraceForRender(structuredClone(report)), false);
  assert.equal(KerrReferenceTraceReportSchema.safeParse(report).success, true);
  assert.equal(BlackHoleRenderManifestSchema.safeParse(report).success, false);
});
