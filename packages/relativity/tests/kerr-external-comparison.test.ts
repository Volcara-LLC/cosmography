import assert from "node:assert/strict";
import test from "node:test";

import {
  KERR_COMPARISON_LIMITS,
  KERR_COMPARISON_MAX_CASES,
  KERR_COMPARISON_MAX_REFERENCE_SOLVER_PASSES,
  KERR_COMPARISON_MAX_TOTAL_CONFIGURED_ACCEPTED_STEPS,
  KERR_COMPARISON_MAX_TOTAL_EVENT_LOCALIZATION_RK4_EVALUATIONS,
  KERR_COMPARISON_MAX_TOTAL_RK4_EVALUATIONS,
  KERR_COMPARISON_NO_AUTHORITY,
  KERR_COMPARISON_PROVISIONAL_TOLERANCES,
  KERR_EXTERNAL_OUTPUT_MAX_NORMALIZED_BYTES,
  KERR_EXTERNAL_OUTPUT_MAX_RAW_BYTES,
  KERR_EXTERNAL_OUTPUT_NO_AUTHORITY,
  KerrComparisonExternalImplementationSchema,
  KerrComparisonMappingSchema,
  KerrComparisonPlanSchema,
  KerrExternalNormalizedOutputSchema,
  KerrExternalOutputCandidateSchema,
  KerrExternalOutputComparisonSchema,
  assertKerrComparisonPlanIntegrity,
  assertKerrExternalNormalizedOutputIntegrity,
  assertKerrExternalOutputCandidateExactBytes,
  assertKerrExternalOutputCandidateIntegrity,
  assertKerrExternalOutputComparisonIntegrity,
  assertVerifiedKerrComparisonReferenceBundle,
  canUseKerrExternalComparisonForRender,
  canUseKerrExternalOutputCandidateForRender,
  canUseKerrComparisonPlanForRender,
  canonicalKerrExternalNormalizedOutputBytes,
  compareKerrReferenceToExternalCandidate,
  createKerrComparisonPlan,
  createKerrExternalNormalizedOutput,
  createKerrExternalOutputCandidate,
  createKerrReferenceTraceRequest,
  kerrSha256Hex,
  kerrStableStringify,
  traceKerrReferenceLensMap,
  verifyKerrComparisonReferenceBundle,
  type KerrComparisonExternalImplementation,
  type KerrComparisonMapping,
  type KerrComparisonPlan,
  type KerrComparisonScientificRole,
  type KerrExternalNormalizedOutput,
  type KerrExternalOutputCandidate,
  type KerrExternalOutputComparison,
  type KerrReferenceTraceReport,
  type KerrReferenceTraceRequest,
  type VerifiedKerrComparisonReferenceBundle,
} from "../src/index.js";

const requestFrozenAt = "2026-07-19T20:30:00Z";
const reportGeneratedAt = "2026-07-19T20:31:00Z";
const planFrozenAt = "2026-07-19T20:32:00Z";
const candidateGeneratedAt = "2026-07-19T20:33:00Z";
const comparisonGeneratedAt = "2026-07-19T20:34:00Z";
const declaredCodeCommit = "a".repeat(40);
const textEncoder = new TextEncoder();

function syntheticExternalRun(
  overrides: Partial<{
    evidenceClass: "synthetic-test-fixture";
    startedAt: string;
    completedAt: string;
    rawCapturedAt: string;
    provenance: "caller-declared-unverified";
    runnerSuppliedByPackage: false;
    executionVerified: false;
  }> = {},
) {
  return {
    evidenceClass: "synthetic-test-fixture" as const,
    startedAt: "2026-07-19T20:32:01Z",
    completedAt: "2026-07-19T20:32:02Z",
    rawCapturedAt: "2026-07-19T20:32:03Z",
    provenance: "caller-declared-unverified" as const,
    runnerSuppliedByPackage: false as const,
    executionVerified: false as const,
    ...overrides,
  };
}

function sha256(character: string): string {
  return character.repeat(64);
}

function requestFor(
  overrides: {
    spin?: number;
    width?: number;
    height?: number;
    verticalFieldOfViewDegrees?: number;
    stepSize?: number;
    maxSteps?: number;
    maxAffineParameter?: number;
  } = {},
): KerrReferenceTraceRequest {
  return createKerrReferenceTraceRequest({
    frozenAt: requestFrozenAt,
    spin: overrides.spin ?? 0.5,
    camera: {
      observer: "zamo",
      radiusRg: 30,
      inclinationDegrees: 90,
      azimuthDegrees: 0,
      verticalFieldOfViewDegrees:
        overrides.verticalFieldOfViewDegrees ?? 30,
      tetrad: "orthonormal-zamo-v1",
    },
    grid: {
      width: overrides.width ?? 1,
      height: overrides.height ?? 1,
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

function reportFor(request: KerrReferenceTraceRequest): KerrReferenceTraceReport {
  return traceKerrReferenceLensMap({
    request,
    generatedAt: reportGeneratedAt,
    declaredCodeCommit,
  });
}

function externalImplementation(
  overrides: Partial<KerrComparisonExternalImplementation> = {},
): KerrComparisonExternalImplementation {
  return {
    implementationId: "independent-kerr-solver",
    displayName: "Independent Kerr Solver",
    upstreamRepositoryUrl: "https://github.com/example/independent-kerr",
    version: "1.0.0",
    vcs: {
      system: "git",
      commitAlgorithm: "sha1",
      commit: "b".repeat(40),
    },
    sourceArchive: {
      byteLength: 12_345,
      sha256: sha256("1"),
    },
    environment: {
      language: "Rust",
      runtime: "native",
      compiler: "rustc 1.80.0",
      platform: "Windows",
      architecture: "x86_64",
      precision: "ieee-754-binary64",
      buildRecipeSha256: sha256("2"),
      environmentManifestSha256: sha256("3"),
      runRecipeSha256: sha256("4"),
    },
    algorithm: {
      geodesicMethod: "Hamiltonian null geodesics",
      integrator: "independently implemented adaptive RK",
      errorControl: "local truncation control",
      cameraConstruction: "independent orthonormal tetrad",
    },
    license: {
      spdxExpression: "MIT",
      licenseTextSha256: sha256("5"),
      codeReview: "not-run",
      outputRightsReview: "not-run",
    },
    provenance: "caller-declared-unverified",
    independenceRequirements: {
      separateImplementationRequired: true,
      noCosmographySolverCodeReuseRequired: true,
      noCosmographyGeneratedFixtureReuseRequired: true,
      reviewState: "required-not-reviewed",
    },
    ...KERR_COMPARISON_NO_AUTHORITY,
    ...overrides,
  };
}

function mapping(
  overrides: Partial<KerrComparisonMapping> = {},
): KerrComparisonMapping {
  return {
    normalizerId: "independent-kerr-normalizer",
    version: "1.0.0",
    vcs: {
      system: "git",
      commitAlgorithm: "sha256",
      commit: "c".repeat(64),
    },
    sourceSha256: sha256("6"),
    provenance: "caller-declared-unverified",
    canonicalization:
      "review-required-external-output-to-cosmography-kerr-comparison-v1",
    sourceOrientationDisclosure:
      "Source rays are future-directed from the camera and normalized to E=1 before mapping.",
    targetConventions: {
      units: "G=M=c=1",
      metricSignature: "-+++",
      coordinates: "Boyer-Lindquist",
      thetaMeaning: "colatitude-radians",
      spinMeaning: "signed-a-over-M",
      momentumOrder: "p_t,p_r,p_theta,p_phi",
      energyMeaning: "E=-p_t",
      angularMomentumMeaning: "L_z=p_phi",
      carterMeaning: "Q-not-K",
      rayOrientation: "future-directed-camera-emitted-inward",
      screenBasis: "screen-x=+e-phi;screen-y=-e-theta;inward=-e-r",
      azimuthRepresentation:
        "wrapped-[0,2pi)-plus-signed-integer-winding",
    },
    reviewState: "not-run",
    ...KERR_COMPARISON_NO_AUTHORITY,
    ...overrides,
  };
}

function resolvedCase(
  caseId: string,
  scientificRole: KerrComparisonScientificRole,
  spin: number,
) {
  const request = requestFor({ spin });
  return {
    caseId,
    scientificRole,
    request,
    report: reportFor(request),
  } as const;
}

function twoCaseBundle(): VerifiedKerrComparisonReferenceBundle {
  return verifyKerrComparisonReferenceBundle({
    cases: [
      resolvedCase("krcase_retrograde", "retrograde-spin", -0.5),
      resolvedCase("krcase_prograde", "prograde-spin", 0.5),
    ],
  });
}

function planFor(
  referenceBundle: VerifiedKerrComparisonReferenceBundle,
  overrides: {
    frozenAt?: string;
    declaredCodeCommit?: string;
    externalImplementation?: KerrComparisonExternalImplementation;
    mapping?: KerrComparisonMapping;
  } = {},
): KerrComparisonPlan {
  return createKerrComparisonPlan({
    referenceBundle,
    frozenAt: overrides.frozenAt ?? planFrozenAt,
    declaredCodeCommit:
      overrides.declaredCodeCommit ?? declaredCodeCommit,
    comparisonScope: "camera-and-solver",
    externalImplementation:
      overrides.externalImplementation ?? externalImplementation(),
    mapping: overrides.mapping ?? mapping(),
  });
}

function oneCaseBundle(): VerifiedKerrComparisonReferenceBundle {
  return verifyKerrComparisonReferenceBundle({
    cases: [resolvedCase("krcase_primary", "prograde-spin", 0.5)],
  });
}

function fourCaseBundle(): VerifiedKerrComparisonReferenceBundle {
  return verifyKerrComparisonReferenceBundle({
    cases: [
      resolvedCase("krcase_summary-0", "retrograde-spin", -0.7),
      resolvedCase("krcase_summary-1", "inclined-observer", -0.2),
      resolvedCase("krcase_summary-2", "prograde-spin", 0.3),
      resolvedCase("krcase_summary-3", "high-spin-stress", 0.8),
    ],
  });
}

function exactCandidateRowPayloads(
  plan: KerrComparisonPlan,
): Array<Record<string, unknown>> {
  return plan.cases.flatMap((referenceCase) =>
    referenceCase.rays.map((referenceRay) => ({
      schemaVersion: "1.0.0",
      state: "normalized-unreviewed-declared-external-kerr-ray",
      planId: plan.planId,
      planChecksum: plan.planChecksum,
      caseId: referenceCase.caseId,
      scientificRole: referenceCase.scientificRole,
      requestId: referenceCase.request.requestId,
      requestChecksum: referenceCase.request.requestChecksum,
      referenceReportId: referenceCase.report.reportId,
      referenceReportChecksum: referenceCase.report.reportChecksum,
      referenceRayId: referenceRay.rayId,
      referenceRayChecksum: referenceRay.rayChecksum,
      pixelIndex: referenceRay.pixelIndex,
      pixelX: referenceRay.pixelX,
      pixelY: referenceRay.pixelY,
      screenX: referenceRay.screenX,
      screenY: referenceRay.screenY,
      termination: referenceRay.referenceOutcome.termination,
      initialMomentum: { ...referenceRay.initialMomentum },
      constants: { ...referenceRay.constants },
      endpoint: {
        eventSurface: referenceRay.referenceOutcome.eventSurface,
        ...referenceRay.referenceOutcome.endpoint,
        momentum: {
          ...referenceRay.referenceOutcome.endpoint.momentum,
        },
      },
      mappingReview: "not-run",
      sourceExecutionReview: "not-run",
      independentReference: "not-run",
      ...KERR_EXTERNAL_OUTPUT_NO_AUTHORITY,
    })),
  );
}

function candidateLifecycle(
  options: {
    referenceBundle?: VerifiedKerrComparisonReferenceBundle;
    mutateRows?: (
      rows: Array<Record<string, unknown>>,
      plan: KerrComparisonPlan,
    ) => void;
    rawBytes?: Uint8Array;
    candidateGeneratedAt?: string;
    comparisonGeneratedAt?: string;
    externalRun?: ReturnType<typeof syntheticExternalRun>;
  } = {},
) {
  const referenceBundle = options.referenceBundle ?? oneCaseBundle();
  const plan = planFor(referenceBundle);
  const rows = exactCandidateRowPayloads(plan);
  options.mutateRows?.(rows, plan);
  const normalizedOutput = createKerrExternalNormalizedOutput({
    referenceBundle,
    plan,
    generatedAt: options.candidateGeneratedAt ?? candidateGeneratedAt,
    externalRun: options.externalRun ?? syntheticExternalRun(),
    rows,
  });
  const normalizedBytes = canonicalKerrExternalNormalizedOutputBytes(
    normalizedOutput,
  );
  const rawBytes =
    options.rawBytes ??
    textEncoder.encode("synthetic external Kerr solver output fixture");
  const candidate = createKerrExternalOutputCandidate({
    referenceBundle,
    plan,
    rawBytes,
    normalizedBytes,
    normalizedOutput,
  });
  const comparisonInput = {
    referenceBundle,
    plan,
    candidate,
    candidateRawBytes: rawBytes,
    candidateNormalizedBytes: normalizedBytes,
    generatedAt:
      options.comparisonGeneratedAt ?? comparisonGeneratedAt,
  } as const;
  const comparison = compareKerrReferenceToExternalCandidate(comparisonInput);
  return {
    referenceBundle,
    plan,
    rows,
    normalizedOutput,
    normalizedBytes,
    rawBytes,
    candidate,
    comparisonInput,
    comparison,
  };
}

function canonicalByteBinding(value: unknown) {
  const canonical = kerrStableStringify(value);
  return {
    encoding: "utf-8",
    canonicalization: "kerr-stable-json-v1",
    byteLength: new TextEncoder().encode(canonical).byteLength,
    sha256: kerrSha256Hex(canonical),
  } as const;
}

function splitAzimuth(phi: number) {
  const twoPi = 2 * Math.PI;
  let phiWinding = Math.floor(phi / twoPi);
  let phiWrappedRadians = phi - phiWinding * twoPi;
  if (phiWrappedRadians < 0) {
    phiWrappedRadians += twoPi;
    phiWinding -= 1;
  } else if (phiWrappedRadians >= twoPi) {
    phiWrappedRadians -= twoPi;
    phiWinding += 1;
  }
  return {
    phiWrappedRadians: Object.is(phiWrappedRadians, -0)
      ? 0
      : phiWrappedRadians,
    phiWinding,
  };
}

function adjacentFloat(value: number, direction: "up" | "down"): number {
  assert.equal(Number.isFinite(value), true);
  if (Object.is(value, -0)) value = 0;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  let bits = view.getBigUint64(0, false);
  const increment =
    (value >= 0 && direction === "up") ||
    (value < 0 && direction === "down");
  bits = increment ? bits + 1n : bits - 1n;
  view.setBigUint64(0, bits, false);
  return view.getFloat64(0, false);
}

function sphereChordAtSamePhi(
  referenceTheta: number,
  candidateTheta: number,
): number {
  return Math.hypot(
    Math.sin(referenceTheta) - Math.sin(candidateTheta),
    Math.cos(referenceTheta) - Math.cos(candidateTheta),
  );
}

function greatestThetaWithinChordTolerance(
  referenceTheta: number,
  tolerance: number,
): number {
  let candidateTheta = referenceTheta + 2 * Math.asin(tolerance / 2);
  while (
    sphereChordAtSamePhi(referenceTheta, candidateTheta) > tolerance
  ) {
    candidateTheta = adjacentFloat(candidateTheta, "down");
  }
  while (
    sphereChordAtSamePhi(
      referenceTheta,
      adjacentFloat(candidateTheta, "up"),
    ) <= tolerance
  ) {
    candidateTheta = adjacentFloat(candidateTheta, "up");
  }
  return candidateTheta;
}

function asRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

function rehashPlan(plan: Record<string, unknown>): void {
  const identity = {
    policyVersion: plan.policyVersion,
    frozenAt: plan.frozenAt,
    declaredCodeCommit: plan.declaredCodeCommit,
    comparisonScope: plan.comparisonScope,
    externalImplementation: plan.externalImplementation,
    mapping: plan.mapping,
    cases: plan.cases,
    tolerances: plan.tolerances,
  };
  plan.planId = `krcplan_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const { planChecksum: _checksum, ...unsigned } = plan;
  plan.planChecksum = {
    algorithm: "sha256",
    value: kerrSha256Hex(kerrStableStringify(unsigned)),
    scope: "kerr-external-output-comparison-plan",
  };
}

function rehashNormalizedRow(row: Record<string, unknown>): void {
  const {
    rowId: _rowId,
    rowChecksum: _rowChecksum,
    ...payload
  } = row;
  const identity = {
    planId: row.planId,
    planChecksum: row.planChecksum,
    caseId: row.caseId,
    requestId: row.requestId,
    reportId: row.referenceReportId,
    pixelIndex: row.pixelIndex,
    payloadSha256: kerrSha256Hex(kerrStableStringify(payload)),
  };
  row.rowId = `krxrow_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const { rowChecksum: _checksum, ...unsigned } = row;
  row.rowChecksum = {
    algorithm: "sha256",
    value: kerrSha256Hex(kerrStableStringify(unsigned)),
    scope: "normalized-external-kerr-output-row",
  };
}

function rehashNormalizedOutput(output: Record<string, unknown>): void {
  const rows = output.rows as Array<Record<string, unknown>>;
  const identity = {
    policyVersion: output.policyVersion,
    generatedAt: output.generatedAt,
    planId: output.planId,
    planChecksum: output.planChecksum,
    comparisonScope: output.comparisonScope,
    externalImplementation: output.externalImplementation,
    mapping: output.mapping,
    externalRun: output.externalRun,
    rowChecksums: rows.map(({ rowChecksum }) => rowChecksum),
  };
  output.normalizedOutputId = `krxout_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const { normalizedOutputChecksum: _checksum, ...unsigned } = output;
  output.normalizedOutputChecksum = {
    algorithm: "sha256",
    value: kerrSha256Hex(kerrStableStringify(unsigned)),
    scope: "normalized-external-kerr-output",
  };
}

function rehashCandidate(candidate: Record<string, unknown>): void {
  const rows = candidate.rows as Array<Record<string, unknown>>;
  const identity = {
    policyVersion: candidate.policyVersion,
    generatedAt: candidate.generatedAt,
    planId: candidate.planId,
    planChecksum: candidate.planChecksum,
    comparisonScope: candidate.comparisonScope,
    externalImplementation: candidate.externalImplementation,
    mapping: candidate.mapping,
    externalRun: candidate.externalRun,
    rawArtifact: candidate.rawArtifact,
    normalizedArtifact: candidate.normalizedArtifact,
    rowChecksums: rows.map(({ rowChecksum }) => rowChecksum),
  };
  candidate.candidateId = `krcand_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const { candidateChecksum: _checksum, ...unsigned } = candidate;
  candidate.candidateChecksum = {
    algorithm: "sha256",
    value: kerrSha256Hex(kerrStableStringify(unsigned)),
    scope: "external-kerr-output-candidate",
  };
}

function rehashComparisonRow(
  row: Record<string, unknown>,
  plan: KerrComparisonPlan,
): void {
  const {
    rowId: _rowId,
    rowChecksum: _rowChecksum,
    ...payload
  } = row;
  const identity = {
    planId: plan.planId,
    planChecksum: plan.planChecksum,
    candidateId: row.candidateId,
    caseId: row.caseId,
    pixelIndex: row.pixelIndex,
    payloadSha256: kerrSha256Hex(kerrStableStringify(payload)),
  };
  row.rowId = `krcrow_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const { rowChecksum: _checksum, ...unsigned } = row;
  row.rowChecksum = {
    algorithm: "sha256",
    value: kerrSha256Hex(kerrStableStringify(unsigned)),
    scope: "kerr-external-output-comparison-row",
  };
}

function rehashComparison(
  comparison: Record<string, unknown>,
  plan: KerrComparisonPlan,
  candidate: KerrExternalOutputCandidate,
): void {
  const reference = asRecord(comparison.reference);
  const rows = comparison.rows as Array<Record<string, unknown>>;
  const identity = {
    planId: plan.planId,
    planChecksum: plan.planChecksum,
    referenceBindingSha256: reference.bindingSha256,
    candidateId: candidate.candidateId,
    candidateChecksum: candidate.candidateChecksum,
    candidateRawArtifact: candidate.rawArtifact,
    candidateNormalizedArtifact: candidate.normalizedArtifact,
    generatedAt: comparison.generatedAt,
    rowChecksums: rows.map(({ rowChecksum }) => rowChecksum),
  };
  comparison.comparisonId = `krcmp_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const { comparisonChecksum: _checksum, ...unsigned } = comparison;
  comparison.comparisonChecksum = {
    algorithm: "sha256",
    value: kerrSha256Hex(kerrStableStringify(unsigned)),
    scope: "kerr-external-output-comparison",
  };
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      assertDeepFrozen(descriptor.value, seen);
    }
  }
}

test("comparison plans deterministically bind ordered reference evidence exactly", () => {
  const bundle = twoCaseBundle();
  const first = planFor(bundle);
  const second = planFor(bundle);

  assert.deepEqual(second, first);
  assert.deepEqual(
    first.cases.map(({ caseId }) => caseId),
    ["krcase_retrograde", "krcase_prograde"],
  );
  assert.equal(bundle.totalPixels, 2);
  assert.equal(bundle.configuredAcceptedStepsPerReferenceSolverPass, 8_000);
  assert.equal(first.comparisonExecuted, false);
  assert.equal(first.comparisonResult, "not-run");
  assert.deepEqual(KerrComparisonPlanSchema.parse(first), first);
  assert.doesNotThrow(() => assertKerrComparisonPlanIntegrity(bundle, first));

  for (const [caseIndex, binding] of first.cases.entries()) {
    const evidence = bundle.cases[caseIndex]!;
    assert.equal(binding.caseId, evidence.caseId);
    assert.equal(binding.scientificRole, evidence.scientificRole);
    assert.equal(binding.request.requestId, evidence.request.requestId);
    assert.deepEqual(binding.request.requestChecksum, evidence.request.requestChecksum);
    assert.deepEqual(
      binding.request.canonicalBytes,
      canonicalByteBinding(evidence.request),
    );
    assert.equal(binding.report.reportId, evidence.report.reportId);
    assert.deepEqual(binding.report.reportChecksum, evidence.report.reportChecksum);
    assert.equal(binding.report.generatedAt, evidence.report.generatedAt);
    assert.deepEqual(
      binding.report.canonicalBytes,
      canonicalByteBinding(evidence.report),
    );
    assert.equal(binding.spin, evidence.request.spin);
    assert.deepEqual(binding.grid, evidence.request.grid);
    assert.deepEqual(binding.eventSurfaces, {
      horizonGuardRadiusRg:
        1 +
        Math.sqrt(1 - evidence.request.spin ** 2) +
        evidence.request.integration.horizonGuardRg,
      finiteEscapeDomainRadiusRg:
        evidence.request.integration.escapeRadiusRg,
    });
    assert.equal(binding.rays.length, evidence.report.rays.length);

    for (const [rayIndex, rayBinding] of binding.rays.entries()) {
      const ray = evidence.report.rays[rayIndex]!;
      const energy = ray.constants.energy;
      assert.equal(rayBinding.rayId, ray.rayId);
      assert.deepEqual(rayBinding.rayChecksum, ray.rayChecksum);
      assert.equal(rayBinding.pixelIndex, ray.pixelIndex);
      assert.equal(rayBinding.pixelX, ray.pixelX);
      assert.equal(rayBinding.pixelY, ray.pixelY);
      assert.equal(rayBinding.screenX, ray.screenX);
      assert.equal(rayBinding.screenY, ray.screenY);
      assert.deepEqual(rayBinding.initialMomentum, {
        pTOverEnergy: ray.initialState.pT / energy,
        pROverEnergy: ray.initialState.pR / energy,
        pThetaOverEnergy: ray.initialState.pTheta / energy,
        pPhiOverEnergy: ray.initialState.pPhi / energy,
      });
      assert.deepEqual(rayBinding.constants, {
        xiAngularMomentumOverEnergy:
          ray.constants.angularMomentumZ / energy,
        etaCarterQOverEnergySquared: ray.constants.carterQ / energy ** 2,
      });
      assert.deepEqual(
        {
          phiWrappedRadians:
            rayBinding.referenceOutcome.endpoint.phiWrappedRadians,
          phiWinding: rayBinding.referenceOutcome.endpoint.phiWinding,
        },
        splitAzimuth(ray.finalState.phi),
      );
      assert.equal(rayBinding.referenceOutcome.termination, ray.termination);
      assert.equal(
        rayBinding.referenceOutcome.eventSurface,
        ray.termination === "captured-horizon-guard"
          ? "horizon-guard"
          : "finite-escape-domain",
      );
      assert.equal(
        rayBinding.referenceOutcome.endpoint.radiusRg,
        ray.finalState.r,
      );
      assert.equal(
        rayBinding.referenceOutcome.endpoint.thetaRadians,
        ray.finalState.theta,
      );
      assert.deepEqual(rayBinding.referenceOutcome.endpoint.momentum, {
        pTOverEnergy: ray.finalState.pT / energy,
        pROverEnergy: ray.finalState.pR / energy,
        pThetaOverEnergy: ray.finalState.pTheta / energy,
        pPhiOverEnergy: ray.finalState.pPhi / energy,
      });
      assert.equal(
        rayBinding.referenceOutcome.endpoint.energyTimesAffineParameter,
        energy * ray.affineParameter,
      );
      assert.equal(
        rayBinding.referenceOutcome.endpoint.coordinateTime,
        ray.finalState.t,
      );
    }
  }
});

test("the frozen five-pass ceilings are exact and internally additive", () => {
  assert.equal(KERR_COMPARISON_MAX_REFERENCE_SOLVER_PASSES, 5);
  assert.equal(KERR_COMPARISON_MAX_TOTAL_CONFIGURED_ACCEPTED_STEPS, 10_000_000);
  assert.equal(
    KERR_COMPARISON_MAX_TOTAL_EVENT_LOCALIZATION_RK4_EVALUATIONS,
    162_500,
  );
  assert.equal(KERR_COMPARISON_MAX_TOTAL_RK4_EVALUATIONS, 10_162_500);
  assert.equal(KERR_COMPARISON_LIMITS.maxReferenceSolverPasses, 5);
  assert.equal(
    KERR_COMPARISON_LIMITS.maxConfiguredAcceptedStepsPerReferenceSolverPass,
    2_000_000,
  );
  assert.equal(
    KERR_COMPARISON_LIMITS.maxEventLocalizationRk4EvaluationsPerReferenceSolverPass,
    32_500,
  );
  assert.equal(
    KERR_COMPARISON_LIMITS.maxRk4EvaluationsPerReferenceSolverPass,
    2_032_500,
  );
  assert.equal(
    KERR_COMPARISON_LIMITS.maxTotalConfiguredAcceptedSteps,
    5 * KERR_COMPARISON_LIMITS.maxConfiguredAcceptedStepsPerReferenceSolverPass,
  );
  assert.equal(
    KERR_COMPARISON_LIMITS.maxTotalEventLocalizationRk4Evaluations,
    5 *
      KERR_COMPARISON_LIMITS.maxEventLocalizationRk4EvaluationsPerReferenceSolverPass,
  );
  assert.equal(
    KERR_COMPARISON_LIMITS.maxTotalRk4Evaluations,
    KERR_COMPARISON_LIMITS.maxTotalConfiguredAcceptedSteps +
      KERR_COMPARISON_LIMITS.maxTotalEventLocalizationRk4Evaluations,
  );
});

test("full Git commits are mandatory and must match their declared algorithm", () => {
  const bundle = twoCaseBundle();
  assert.throws(
    () => planFor(bundle, { declaredCodeCommit: "abcdef1" }),
    /invalid|format|string/i,
  );
  assert.doesNotThrow(() =>
    planFor(bundle, { declaredCodeCommit: "d".repeat(64) }),
  );

  assert.throws(
    () =>
      KerrComparisonExternalImplementationSchema.parse(
        externalImplementation({
          vcs: {
            system: "git",
            commitAlgorithm: "sha1",
            commit: "b".repeat(64),
          },
        }),
      ),
    /commit length/i,
  );
  assert.throws(
    () =>
      KerrComparisonMappingSchema.parse(
        mapping({
          vcs: {
            system: "git",
            commitAlgorithm: "sha256",
            commit: "c".repeat(40),
          },
        }),
      ),
    /commit length/i,
  );
});

test("repository provenance requires canonical HTTPS and rejects self-reference", () => {
  for (const upstreamRepositoryUrl of [
    "http://github.com/example/independent-kerr",
    "https://user:secret@github.com/example/independent-kerr",
    "https://github.com/example/independent-kerr?ref=main",
    "https://github.com/example/independent-kerr#readme",
    "https://GitHub.com/example/independent-kerr",
  ]) {
    assert.throws(() =>
      KerrComparisonExternalImplementationSchema.parse(
        externalImplementation({ upstreamRepositoryUrl }),
      ),
    );
  }

  assert.throws(
    () =>
      KerrComparisonExternalImplementationSchema.parse(
        externalImplementation({
          implementationId: "cosmography-kerr-vacuum-reference",
        }),
      ),
    /current Cosmography Kerr reference/i,
  );
  for (const upstreamRepositoryUrl of [
    "https://github.com/Volcara/cosmography",
    "https://github.com/Volcara/cosmography.git",
    "https://github.com/Volcara/cosmography.git/",
    "https://github.com/Volcara/cosmography%2e.git",
    "https://www.github.com/Volcara/cosmography",
    "https://github.com/Volcara/cosmography/tree/main",
  ]) {
    assert.throws(
      () =>
        KerrComparisonExternalImplementationSchema.parse(
          externalImplementation({ upstreamRepositoryUrl }),
        ),
      /current Cosmography Kerr reference/i,
    );
  }
});

test("plan timestamps are canonical and cannot predate request or report evidence", () => {
  const bundle = twoCaseBundle();
  assert.throws(
    () => planFor(bundle, { frozenAt: "2026-07-19T20:30:59Z" }),
    /cannot be frozen before/i,
  );
  assert.throws(
    () => planFor(bundle, { frozenAt: "2026-07-19T20:32:00.000Z" }),
  );
  assert.throws(
    () => planFor(bundle, { frozenAt: "2026-07-19T20:32:00+00:00" }),
  );
  assert.doesNotThrow(() =>
    planFor(bundle, { frozenAt: reportGeneratedAt }),
  );
});

test("unresolved reference outcomes cannot enter a comparison bundle", () => {
  const request = requestFor({
    stepSize: 0.01,
    maxSteps: 100,
    maxAffineParameter: 1,
  });
  const report = reportFor(request);
  assert.equal(report.rays[0]!.termination, "indeterminate-limit");
  assert.throws(
    () =>
      verifyKerrComparisonReferenceBundle({
        cases: [
          {
            caseId: "krcase_unresolved",
            scientificRole: "near-critical",
            request,
            report,
          },
        ],
      }),
    /fully resolved event outcomes/i,
  );
});

test("aggregate configured work is enforced across otherwise valid cases", () => {
  const cases = Array.from({ length: 7 }, (_, index) => {
    const request = requestFor({
      spin: -0.6 + index * 0.2,
      width: 5,
      height: 5,
      verticalFieldOfViewDegrees: 3,
      maxSteps: 12_000,
    });
    const report = reportFor(request);
    assert.equal(
      report.rays.every(
        ({ termination }) =>
          termination === "captured-horizon-guard" ||
          termination === "escaped-domain",
      ),
      true,
    );
    return {
      caseId: `krcase_work-${index}`,
      scientificRole: "high-spin-stress" as const,
      request,
      report,
    };
  });
  const atBudget = verifyKerrComparisonReferenceBundle({
    cases: cases.slice(0, 6),
  });
  assert.equal(atBudget.totalPixels, 150);
  assert.equal(
    atBudget.configuredAcceptedStepsPerReferenceSolverPass,
    1_800_000,
  );
  assert.throws(
    () => verifyKerrComparisonReferenceBundle({ cases }),
    /aggregate work budget/i,
  );
});

test("oversized case arrays reject during preflight without reading elements", () => {
  let elementReads = 0;
  const poison = new Proxy(
    {},
    {
      get() {
        elementReads += 1;
        throw new Error("poison element read");
      },
      getOwnPropertyDescriptor() {
        elementReads += 1;
        throw new Error("poison element descriptor read");
      },
      getPrototypeOf() {
        elementReads += 1;
        throw new Error("poison element prototype read");
      },
    },
  );
  const cases = Array.from(
    { length: KERR_COMPARISON_MAX_CASES + 1 },
    () => poison,
  );
  assert.throws(
    () => verifyKerrComparisonReferenceBundle({ cases }),
    /bounded length/i,
  );
  assert.equal(elementReads, 0);
});

test("verified-bundle authority is process-issued and structural copies are rejected", () => {
  const bundle = twoCaseBundle();
  assert.doesNotThrow(() => assertVerifiedKerrComparisonReferenceBundle(bundle));
  const structuralCopy = structuredClone(bundle);
  assert.throws(
    () => assertVerifiedKerrComparisonReferenceBundle(structuralCopy),
    /verified in this process|structural copies/i,
  );
  assert.throws(
    () =>
      createKerrComparisonPlan({
        referenceBundle: structuralCopy,
        frozenAt: planFrozenAt,
        declaredCodeCommit,
        comparisonScope: "integrator-only",
        externalImplementation: externalImplementation(),
        mapping: mapping(),
      }),
    /verified in this process|structural copies/i,
  );

  const duplicatedEvidence = resolvedCase(
    "krcase_duplicate-a",
    "prograde-spin",
    0.4,
  );
  assert.throws(
    () =>
      verifyKerrComparisonReferenceBundle({
        cases: [
          duplicatedEvidence,
          {
            ...duplicatedEvidence,
            caseId: "krcase_duplicate-b",
            scientificRole: "near-critical",
          },
        ],
      }),
    /request|report|unique|duplicate/i,
  );
});

test("tampering, rehashing, reordering, and authority laundering all fail closed", () => {
  const bundle = twoCaseBundle();
  const plan = planFor(bundle);

  const checksumTamper = structuredClone(plan) as unknown as Record<
    string,
    unknown
  >;
  asRecord(checksumTamper.planChecksum).value = sha256("f");
  assert.throws(
    () => assertKerrComparisonPlanIntegrity(bundle, checksumTamper),
    /checksum mismatch/i,
  );

  const rebound = structuredClone(plan) as unknown as Record<string, unknown>;
  const reboundCases = rebound.cases as Array<Record<string, unknown>>;
  reboundCases[0]!.scientificRole = "weak-field";
  rehashPlan(rebound);
  assert.doesNotThrow(() => KerrComparisonPlanSchema.parse(rebound));
  assert.throws(
    () => assertKerrComparisonPlanIntegrity(bundle, rebound),
    /does not match its verified reference bundle/i,
  );

  const reordered = structuredClone(plan) as unknown as Record<string, unknown>;
  (reordered.cases as unknown[]).reverse();
  rehashPlan(reordered);
  assert.doesNotThrow(() => KerrComparisonPlanSchema.parse(reordered));
  assert.throws(
    () => assertKerrComparisonPlanIntegrity(bundle, reordered),
    /does not match its verified reference bundle/i,
  );

  const laundered = structuredClone(plan) as unknown as Record<string, unknown>;
  laundered.renderAllowed = true;
  rehashPlan(laundered);
  assert.throws(() => KerrComparisonPlanSchema.parse(laundered));

  const toleranceTamper = structuredClone(plan) as unknown as Record<
    string,
    unknown
  >;
  asRecord(toleranceTamper.tolerances).xiMaxAbsolute = 1;
  rehashPlan(toleranceTamper);
  assert.throws(() => KerrComparisonPlanSchema.parse(toleranceTamper));
});

test("plans and bundles are deeply frozen and never authorize rendering", () => {
  const bundle = twoCaseBundle();
  const plan = planFor(bundle);
  assertDeepFrozen(bundle);
  assertDeepFrozen(plan);
  assert.throws(() => {
    (plan as unknown as { renderAllowed: boolean }).renderAllowed = true;
  }, /read only|readonly|Cannot assign/i);
  assert.equal(canUseKerrComparisonPlanForRender(plan), false);
  assert.equal(
    canUseKerrComparisonPlanForRender(KerrComparisonPlanSchema.parse(plan)),
    false,
  );
  assert.equal(canUseKerrComparisonPlanForRender({ renderAllowed: true }), false);
});

test("normalized output, candidate quarantine, and comparison are deterministic and exact-byte bound", () => {
  const fixture = candidateLifecycle();
  const secondOutput = createKerrExternalNormalizedOutput({
    referenceBundle: fixture.referenceBundle,
    plan: fixture.plan,
    generatedAt: candidateGeneratedAt,
    externalRun: syntheticExternalRun(),
    rows: fixture.rows,
  });
  const secondNormalizedBytes = canonicalKerrExternalNormalizedOutputBytes(
    secondOutput,
  );
  const secondCandidate = createKerrExternalOutputCandidate({
    referenceBundle: fixture.referenceBundle,
    plan: fixture.plan,
    rawBytes: fixture.rawBytes,
    normalizedBytes: secondNormalizedBytes,
    normalizedOutput: secondOutput,
  });
  const secondComparison = compareKerrReferenceToExternalCandidate({
    ...fixture.comparisonInput,
    candidate: secondCandidate,
    candidateNormalizedBytes: secondNormalizedBytes,
  });

  assert.deepEqual(secondOutput, fixture.normalizedOutput);
  assert.deepEqual(secondNormalizedBytes, fixture.normalizedBytes);
  assert.deepEqual(secondCandidate, fixture.candidate);
  assert.deepEqual(secondComparison, fixture.comparison);
  assert.deepEqual(
    KerrExternalNormalizedOutputSchema.parse(fixture.normalizedOutput),
    fixture.normalizedOutput,
  );
  assert.deepEqual(
    KerrExternalOutputCandidateSchema.parse(fixture.candidate),
    fixture.candidate,
  );
  assert.deepEqual(
    KerrExternalOutputComparisonSchema.parse(fixture.comparison),
    fixture.comparison,
  );
  assert.deepEqual(
    fixture.normalizedBytes,
    textEncoder.encode(kerrStableStringify(fixture.normalizedOutput)),
  );
  assert.equal(
    fixture.candidate.rawArtifact.byteLength,
    fixture.rawBytes.byteLength,
  );
  assert.equal(
    fixture.candidate.rawArtifact.sha256,
    kerrSha256Hex(fixture.rawBytes),
  );
  assert.equal(
    fixture.candidate.rawArtifact.capturedAt,
    fixture.normalizedOutput.externalRun.rawCapturedAt,
  );
  assert.equal(
    fixture.candidate.normalizedArtifact.byteLength,
    fixture.normalizedBytes.byteLength,
  );
  assert.equal(
    fixture.candidate.normalizedArtifact.sha256,
    kerrSha256Hex(fixture.normalizedBytes),
  );
  assert.equal(
    fixture.candidate.rows[0]!.rowId,
    fixture.normalizedOutput.rows[0]!.rowId,
  );
  assert.equal(
    fixture.comparison.rows[0]!.candidateRowChecksum,
    fixture.candidate.rows[0]!.rowChecksum.value,
  );
  assert.doesNotThrow(() =>
    assertKerrExternalNormalizedOutputIntegrity(
      fixture.referenceBundle,
      fixture.plan,
      fixture.normalizedOutput,
    ),
  );
  assert.doesNotThrow(() =>
    assertKerrExternalOutputCandidateIntegrity(
      fixture.referenceBundle,
      fixture.plan,
      fixture.candidate,
    ),
  );
  assert.doesNotThrow(() =>
    assertKerrExternalOutputCandidateExactBytes(
      fixture.candidate,
      fixture.rawBytes,
      fixture.normalizedBytes,
    ),
  );
  assert.doesNotThrow(() =>
    assertKerrExternalOutputComparisonIntegrity(
      fixture.comparisonInput,
      fixture.comparison,
    ),
  );
});

test("candidate row coverage is preflighted before reads and exact plan order is mandatory", () => {
  const referenceBundle = oneCaseBundle();
  const plan = planFor(referenceBundle);
  let poisonReads = 0;
  const poison = new Proxy(
    {},
    {
      get() {
        poisonReads += 1;
        throw new Error("poison normalized row read");
      },
      getOwnPropertyDescriptor() {
        poisonReads += 1;
        throw new Error("poison normalized row descriptor read");
      },
      getPrototypeOf() {
        poisonReads += 1;
        throw new Error("poison normalized row prototype read");
      },
    },
  );
  assert.throws(
    () =>
      createKerrExternalNormalizedOutput({
        referenceBundle,
        plan,
        generatedAt: candidateGeneratedAt,
        externalRun: syntheticExternalRun(),
        rows: [poison, poison],
      }),
    /exactly one bounded row per planned ray/i,
  );
  assert.equal(poisonReads, 0);

  const accessorRows = new Array<unknown>(1);
  Object.defineProperty(accessorRows, "0", {
    enumerable: true,
    configurable: true,
    get() {
      poisonReads += 1;
      throw new Error("normalized row accessor executed");
    },
  });
  assert.throws(
    () =>
      createKerrExternalNormalizedOutput({
        referenceBundle,
        plan,
        generatedAt: candidateGeneratedAt,
        externalRun: syntheticExternalRun(),
        rows: accessorRows,
      }),
    /own .*data elements/i,
  );
  assert.equal(poisonReads, 0);

  const orderedBundle = twoCaseBundle();
  const orderedPlan = planFor(orderedBundle);
  const orderedRows = exactCandidateRowPayloads(orderedPlan);
  assert.throws(
    () =>
      createKerrExternalNormalizedOutput({
        referenceBundle: orderedBundle,
        plan: orderedPlan,
        generatedAt: candidateGeneratedAt,
        externalRun: syntheticExternalRun(),
        rows: [...orderedRows].reverse(),
      }),
    /exact planned reference binding/i,
  );
  assert.throws(
    () =>
      createKerrExternalNormalizedOutput({
        referenceBundle: orderedBundle,
        plan: orderedPlan,
        generatedAt: candidateGeneratedAt,
        externalRun: syntheticExternalRun(),
        rows: [orderedRows[0]!, orderedRows[0]!],
      }),
    /exact planned reference binding/i,
  );
  assert.throws(
    () =>
      createKerrExternalNormalizedOutput({
        referenceBundle: orderedBundle,
        plan: orderedPlan,
        generatedAt: candidateGeneratedAt,
        externalRun: syntheticExternalRun(),
        rows: orderedRows.slice(0, 1),
      }),
    /exactly one bounded row per planned ray/i,
  );

  const nonfinite = exactCandidateRowPayloads(plan);
  asRecord(nonfinite[0]!.initialMomentum).pTOverEnergy = Number.NaN;
  assert.throws(() =>
    createKerrExternalNormalizedOutput({
      referenceBundle,
      plan,
      generatedAt: candidateGeneratedAt,
      externalRun: syntheticExternalRun(),
      rows: nonfinite,
    }),
  );
  const laundered = exactCandidateRowPayloads(plan);
  laundered[0]!.renderAllowed = true;
  assert.throws(() =>
    createKerrExternalNormalizedOutput({
      referenceBundle,
      plan,
      generatedAt: candidateGeneratedAt,
      externalRun: syntheticExternalRun(),
      rows: laundered,
    }),
  );
});

test("raw and canonical normalized byte budgets and exact bytes fail closed", () => {
  assert.equal(KERR_EXTERNAL_OUTPUT_MAX_RAW_BYTES, 1_048_576);
  assert.equal(KERR_EXTERNAL_OUTPUT_MAX_NORMALIZED_BYTES, 2_097_152);
  const fixture = candidateLifecycle();

  const changedRaw = new Uint8Array(fixture.rawBytes);
  changedRaw[0] ^= 1;
  assert.throws(
    () =>
      assertKerrExternalOutputCandidateExactBytes(
        fixture.candidate,
        changedRaw,
        fixture.normalizedBytes,
      ),
    /raw byte binding mismatch/i,
  );
  assert.throws(() =>
    compareKerrReferenceToExternalCandidate({
      ...fixture.comparisonInput,
      candidateRawBytes: changedRaw,
    }),
  );

  const changedNormalized = new Uint8Array(fixture.normalizedBytes);
  changedNormalized[changedNormalized.length - 1] ^= 1;
  assert.throws(
    () =>
      assertKerrExternalOutputCandidateExactBytes(
        fixture.candidate,
        fixture.rawBytes,
        changedNormalized,
      ),
    /normalized byte binding.*mismatch/i,
  );
  assert.throws(() =>
    compareKerrReferenceToExternalCandidate({
      ...fixture.comparisonInput,
      candidateNormalizedBytes: changedNormalized,
    }),
  );

  let typedArrayGetterReads = 0;
  const byteLengthGetterBytes = new Uint8Array([1]);
  Object.defineProperty(byteLengthGetterBytes, "byteLength", {
    enumerable: false,
    configurable: true,
    get() {
      typedArrayGetterReads += 1;
      throw new Error("typed-array byteLength getter executed");
    },
  });
  assert.throws(
    () =>
      assertKerrExternalOutputCandidateExactBytes(
        fixture.candidate,
        byteLengthGetterBytes,
        fixture.normalizedBytes,
      ),
    /plain Uint8Array|own data/i,
  );
  assert.equal(typedArrayGetterReads, 0);

  const bufferGetterBytes = new Uint8Array([1]);
  Object.defineProperty(bufferGetterBytes, "buffer", {
    enumerable: false,
    configurable: true,
    get() {
      typedArrayGetterReads += 1;
      throw new Error("typed-array buffer getter executed");
    },
  });
  assert.throws(
    () =>
      assertKerrExternalOutputCandidateExactBytes(
        fixture.candidate,
        fixture.rawBytes,
        bufferGetterBytes,
      ),
    /plain Uint8Array|own data/i,
  );
  assert.equal(typedArrayGetterReads, 0);

  let outputReads = 0;
  const poisonOutput = new Proxy(
    {},
    {
      get() {
        outputReads += 1;
        throw new Error("poison output read");
      },
      getOwnPropertyDescriptor() {
        outputReads += 1;
        throw new Error("poison output descriptor read");
      },
      getPrototypeOf() {
        outputReads += 1;
        throw new Error("poison output prototype read");
      },
    },
  ) as unknown as KerrExternalNormalizedOutput;
  assert.throws(
    () =>
      createKerrExternalOutputCandidate({
        referenceBundle: fixture.referenceBundle,
        plan: fixture.plan,
        rawBytes: new Uint8Array(KERR_EXTERNAL_OUTPUT_MAX_RAW_BYTES + 1),
        normalizedBytes: fixture.normalizedBytes,
        normalizedOutput: poisonOutput,
      }),
    /byte budget|within its byte budget/i,
  );
  assert.equal(outputReads, 0);
  assert.throws(
    () =>
      createKerrExternalOutputCandidate({
        referenceBundle: fixture.referenceBundle,
        plan: fixture.plan,
        rawBytes: fixture.rawBytes,
        normalizedBytes: new Uint8Array(
          KERR_EXTERNAL_OUTPUT_MAX_NORMALIZED_BYTES + 1,
        ),
        normalizedOutput: poisonOutput,
      }),
    /byte budget|within its byte budget/i,
  );
  assert.equal(outputReads, 0);

  const tarBytes = new Uint8Array(262);
  tarBytes.set(textEncoder.encode("ustar"), 257);
  for (const archiveBytes of [
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    new Uint8Array([0x50, 0x4b, 0x07, 0x08]),
    new Uint8Array([0x1f, 0x8b]),
    new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]),
    new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]),
    new Uint8Array([0x42, 0x5a, 0x68]),
    new Uint8Array([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]),
    tarBytes,
  ]) {
    assert.throws(
      () =>
        createKerrExternalOutputCandidate({
          referenceBundle: fixture.referenceBundle,
          plan: fixture.plan,
          rawBytes: archiveBytes,
          normalizedBytes: fixture.normalizedBytes,
          normalizedOutput: fixture.normalizedOutput,
        }),
      /archive containers are not accepted/i,
    );
  }

  const maximumRaw = new Uint8Array(KERR_EXTERNAL_OUTPUT_MAX_RAW_BYTES);
  maximumRaw[maximumRaw.length - 1] = 1;
  const maximumCandidate = createKerrExternalOutputCandidate({
    referenceBundle: fixture.referenceBundle,
    plan: fixture.plan,
    rawBytes: maximumRaw,
    normalizedBytes: fixture.normalizedBytes,
    normalizedOutput: fixture.normalizedOutput,
  });
  assert.equal(
    maximumCandidate.rawArtifact.byteLength,
    KERR_EXTERNAL_OUTPUT_MAX_RAW_BYTES,
  );
});

test("candidate and comparison chronology is canonical and monotonic", () => {
  const referenceBundle = oneCaseBundle();
  const plan = planFor(referenceBundle);
  const rows = exactCandidateRowPayloads(plan);
  assert.throws(
    () =>
      createKerrExternalNormalizedOutput({
        referenceBundle,
        plan,
        generatedAt: "2026-07-19T20:31:59Z",
        externalRun: syntheticExternalRun(),
        rows,
      }),
    /must follow|cannot predate/i,
  );
  assert.throws(
    () =>
      createKerrExternalNormalizedOutput({
        referenceBundle,
        plan,
        generatedAt: candidateGeneratedAt,
        externalRun: syntheticExternalRun({
          startedAt: "2026-07-19T20:31:59Z",
        }),
        rows,
      }),
    /must follow/i,
  );
  for (const externalRun of [
    syntheticExternalRun({
      startedAt: "2026-07-19T20:32:02Z",
      completedAt: "2026-07-19T20:32:01Z",
    }),
    syntheticExternalRun({
      completedAt: "2026-07-19T20:32:04Z",
      rawCapturedAt: "2026-07-19T20:32:03Z",
    }),
  ]) {
    assert.throws(
      () =>
        createKerrExternalNormalizedOutput({
          referenceBundle,
          plan,
          generatedAt: candidateGeneratedAt,
          externalRun,
          rows,
        }),
      /chronology is reversed/i,
    );
  }
  assert.throws(
    () =>
      createKerrExternalNormalizedOutput({
        referenceBundle,
        plan,
        generatedAt: candidateGeneratedAt,
        externalRun: syntheticExternalRun({
          rawCapturedAt: "2026-07-19T20:35:00Z",
        }),
        rows,
      }),
    /must follow/i,
  );
  for (const generatedAt of [
    "2026-07-19T20:33:00.000Z",
    "2026-07-19T20:33:00+00:00",
  ]) {
    assert.throws(() =>
      createKerrExternalNormalizedOutput({
        referenceBundle,
        plan,
        generatedAt,
        externalRun: syntheticExternalRun(),
        rows,
      }),
    );
  }

  const fixture = candidateLifecycle();
  const capturedAtTamper = structuredClone(
    fixture.candidate,
  ) as unknown as Record<string, unknown>;
  asRecord(capturedAtTamper.rawArtifact).capturedAt =
    "2026-07-19T20:32:04Z";
  rehashCandidate(capturedAtTamper);
  assert.doesNotThrow(() =>
    KerrExternalOutputCandidateSchema.parse(capturedAtTamper),
  );
  assert.throws(
    () =>
      assertKerrExternalOutputCandidateIntegrity(
        fixture.referenceBundle,
        fixture.plan,
        capturedAtTamper,
      ),
    /chronology mismatch/i,
  );
  assert.throws(
    () =>
      compareKerrReferenceToExternalCandidate({
        ...fixture.comparisonInput,
        generatedAt: planFrozenAt,
      }),
    /cannot predate/i,
  );
  assert.throws(() =>
    compareKerrReferenceToExternalCandidate({
      ...fixture.comparisonInput,
      generatedAt: "2026-07-19T20:34:00.000Z",
    }),
  );
});

test("one ordered comparison reports all four dispositions and recomputes its summary", () => {
  const fixture = candidateLifecycle({
    referenceBundle: fourCaseBundle(),
    mutateRows(rows) {
      const disagreementEndpoint = asRecord(rows[1]!.endpoint);
      disagreementEndpoint.phiWinding =
        (disagreementEndpoint.phiWinding as number) + 1;
      disagreementEndpoint.radiusRg =
        (disagreementEndpoint.radiusRg as number) + 2e-9;
      disagreementEndpoint.thetaRadians =
        (disagreementEndpoint.thetaRadians as number) + 3e-6;
      const disagreementMomentum = asRecord(
        disagreementEndpoint.momentum,
      );
      disagreementMomentum.pROverEnergy =
        (disagreementMomentum.pROverEnergy as number) + 1e-3;

      rows[2]!.termination = "indeterminate-limit";
      rows[2]!.endpoint = null;

      const incompatibleMomentum = asRecord(rows[3]!.initialMomentum);
      incompatibleMomentum.pTOverEnergy =
        (incompatibleMomentum.pTOverEnergy as number) + 1e-6;
    },
  });
  const rows = fixture.comparison.rows;
  assert.deepEqual(
    rows.map(({ disposition }) => disposition),
    [
      "within-tolerance",
      "disagreed",
      "inconclusive",
      "incompatible-conventions",
    ],
  );
  assert.deepEqual(rows[0]!.reasons, []);
  assert.deepEqual(rows[1]!.reasons, [
    "phi-winding-mismatch",
    "event-radius-mismatch",
    "endpoint-direction-mismatch",
    "endpoint-normalized-momentum-mismatch",
  ]);
  assert.deepEqual(rows[2]!.reasons, ["candidate-unresolved"]);
  assert.deepEqual(rows[3]!.reasons, [
    "seed-normalized-momentum-mismatch",
  ]);
  assert.deepEqual(fixture.comparison.summary.dispositionCounts, {
    withinTolerance: 1,
    disagreed: 1,
    inconclusive: 1,
    incompatibleConventions: 1,
  });
  assert.equal(fixture.comparison.summary.rowCount, 4);
  assert.equal(fixture.comparison.summary.comparableEndpointCount, 2);
  assert.equal(fixture.comparison.summary.numericAgreement, "disagreed");
  assert.ok(
    fixture.comparison.summary.maxEndpointSphereChord! >
      KERR_COMPARISON_PROVISIONAL_TOLERANCES.endpointSphereChordMaxAbsolute,
  );
  assert.ok(
    fixture.comparison.summary.maxEventRadiusAbsoluteDeltaRg! >
      KERR_COMPARISON_PROVISIONAL_TOLERANCES.eventRadiusMaxAbsoluteRg,
  );
  assert.ok(
    fixture.comparison.summary.maxEndpointMomentumOverEnergyAbsoluteDelta! >
      KERR_COMPARISON_PROVISIONAL_TOLERANCES
        .endpointMomentumOverEnergyMaxAbsolute,
  );
  assert.deepEqual(
    rows.map(({ caseId }) => caseId),
    fixture.plan.cases.map(({ caseId }) => caseId),
  );
});

test("pre-registered numeric boundaries are inclusive and just-over values fail", () => {
  const atBoundary = candidateLifecycle({
    mutateRows(rows, plan) {
      const momentum = asRecord(rows[0]!.initialMomentum);
      momentum.pTOverEnergy =
        (momentum.pTOverEnergy as number) +
        KERR_COMPARISON_PROVISIONAL_TOLERANCES
          .initialMomentumOverEnergyMaxAbsolute;
      const constants = asRecord(rows[0]!.constants);
      constants.xiAngularMomentumOverEnergy =
        (constants.xiAngularMomentumOverEnergy as number) +
        KERR_COMPARISON_PROVISIONAL_TOLERANCES.xiMaxAbsolute;
      constants.etaCarterQOverEnergySquared =
        (constants.etaCarterQOverEnergySquared as number) +
        KERR_COMPARISON_PROVISIONAL_TOLERANCES.etaMaxAbsolute;
      const endpoint = asRecord(rows[0]!.endpoint);
      endpoint.thetaRadians = greatestThetaWithinChordTolerance(
        plan.cases[0]!.rays[0]!.referenceOutcome.endpoint.thetaRadians,
        KERR_COMPARISON_PROVISIONAL_TOLERANCES
          .endpointSphereChordMaxAbsolute,
      );
      endpoint.radiusRg =
        (endpoint.radiusRg as number) +
        KERR_COMPARISON_PROVISIONAL_TOLERANCES.eventRadiusMaxAbsoluteRg / 2;
      const endpointMomentum = asRecord(endpoint.momentum);
      endpointMomentum.pROverEnergy =
        (endpointMomentum.pROverEnergy as number) +
        KERR_COMPARISON_PROVISIONAL_TOLERANCES
          .endpointMomentumOverEnergyMaxAbsolute;
    },
  });
  assert.deepEqual(atBoundary.comparison.rows[0]!.reasons, []);
  assert.equal(atBoundary.comparison.rows[0]!.disposition, "within-tolerance");
  assert.equal(
    atBoundary.comparison.rows[0]!.seedComparison.momentumWithinTolerance,
    true,
  );
  assert.equal(
    atBoundary.comparison.rows[0]!.seedComparison.xiWithinTolerance,
    true,
  );
  assert.equal(
    atBoundary.comparison.rows[0]!.seedComparison.etaWithinTolerance,
    true,
  );
  assert.equal(
    atBoundary.comparison.rows[0]!.endpointComparison!.directionWithinTolerance,
    true,
  );
  assert.ok(
    KERR_COMPARISON_PROVISIONAL_TOLERANCES.endpointSphereChordMaxAbsolute -
      atBoundary.comparison.rows[0]!.endpointComparison!.sphereChord <
      1e-15,
  );
  assert.equal(
    atBoundary.comparison.summary.numericAgreement,
    "within-pre-registered-tolerance",
  );

  const outsideEndpoint = candidateLifecycle({
    mutateRows(rows, plan) {
      const endpoint = asRecord(rows[0]!.endpoint);
      endpoint.thetaRadians =
        plan.cases[0]!.rays[0]!.referenceOutcome.endpoint.thetaRadians +
        1.1 *
          KERR_COMPARISON_PROVISIONAL_TOLERANCES
            .endpointSphereChordMaxAbsolute;
      endpoint.radiusRg =
        (endpoint.radiusRg as number) +
        2 * KERR_COMPARISON_PROVISIONAL_TOLERANCES.eventRadiusMaxAbsoluteRg;
      const endpointMomentum = asRecord(endpoint.momentum);
      endpointMomentum.pROverEnergy =
        (endpointMomentum.pROverEnergy as number) + 1e-3;
    },
  });
  assert.equal(outsideEndpoint.comparison.rows[0]!.disposition, "disagreed");
  assert.deepEqual(outsideEndpoint.comparison.rows[0]!.reasons, [
    "event-radius-mismatch",
    "endpoint-direction-mismatch",
    "endpoint-normalized-momentum-mismatch",
  ]);

  const outsideSeed = candidateLifecycle({
    mutateRows(rows) {
      const momentum = asRecord(rows[0]!.initialMomentum);
      momentum.pTOverEnergy =
        (momentum.pTOverEnergy as number) +
        1.1 *
          KERR_COMPARISON_PROVISIONAL_TOLERANCES
            .initialMomentumOverEnergyMaxAbsolute;
      const constants = asRecord(rows[0]!.constants);
      constants.xiAngularMomentumOverEnergy =
        (constants.xiAngularMomentumOverEnergy as number) +
        1.1 * KERR_COMPARISON_PROVISIONAL_TOLERANCES.xiMaxAbsolute;
      constants.etaCarterQOverEnergySquared =
        (constants.etaCarterQOverEnergySquared as number) +
        1.1 * KERR_COMPARISON_PROVISIONAL_TOLERANCES.etaMaxAbsolute;
    },
  });
  assert.equal(
    outsideSeed.comparison.rows[0]!.disposition,
    "incompatible-conventions",
  );
  assert.deepEqual(outsideSeed.comparison.rows[0]!.reasons, [
    "seed-normalized-momentum-mismatch",
    "seed-xi-mismatch",
    "seed-eta-mismatch",
  ]);
  assert.equal(outsideSeed.comparison.summary.numericAgreement, "inconclusive");
});

test("resolved termination disagreement is distinct from endpoint disagreement", () => {
  const fixture = candidateLifecycle({
    mutateRows(rows) {
      assert.equal(rows[0]!.termination, "captured-horizon-guard");
      rows[0]!.termination = "escaped-domain";
      asRecord(rows[0]!.endpoint).eventSurface = "finite-escape-domain";
    },
  });
  const row = fixture.comparison.rows[0]!;
  assert.equal(row.disposition, "disagreed");
  assert.deepEqual(row.reasons, ["resolved-termination-mismatch"]);
  assert.equal(row.endpointComparison, null);
  assert.equal(row.referenceTermination, "captured-horizon-guard");
  assert.equal(row.candidateTermination, "escaped-domain");
});

test("semantic rehashing, summary forgery, and authority laundering fail closed", () => {
  const fixture = candidateLifecycle();

  const reboundOutput = structuredClone(
    fixture.normalizedOutput,
  ) as unknown as Record<string, unknown>;
  const reboundRow = (reboundOutput.rows as Array<Record<string, unknown>>)[0]!;
  reboundRow.pixelX = (reboundRow.pixelX as number) + 1;
  rehashNormalizedRow(reboundRow);
  rehashNormalizedOutput(reboundOutput);
  assert.doesNotThrow(() =>
    KerrExternalNormalizedOutputSchema.parse(reboundOutput),
  );
  assert.throws(
    () =>
      assertKerrExternalNormalizedOutputIntegrity(
        fixture.referenceBundle,
        fixture.plan,
        reboundOutput,
      ),
    /exact planned reference binding/i,
  );

  const reboundCandidate = structuredClone(
    fixture.candidate,
  ) as unknown as Record<string, unknown>;
  asRecord(reboundCandidate.externalImplementation).displayName =
    "Rehashed Impostor";
  rehashCandidate(reboundCandidate);
  assert.doesNotThrow(() =>
    KerrExternalOutputCandidateSchema.parse(reboundCandidate),
  );
  assert.throws(
    () =>
      assertKerrExternalOutputCandidateIntegrity(
        fixture.referenceBundle,
        fixture.plan,
        reboundCandidate,
      ),
    /implementation binding mismatch/i,
  );

  const candidateAuthority = structuredClone(
    fixture.candidate,
  ) as unknown as Record<string, unknown>;
  candidateAuthority.renderAllowed = true;
  rehashCandidate(candidateAuthority);
  assert.throws(() =>
    KerrExternalOutputCandidateSchema.parse(candidateAuthority),
  );

  const forgedComparison = structuredClone(
    fixture.comparison,
  ) as unknown as Record<string, unknown>;
  const forgedRow = (forgedComparison.rows as Array<Record<string, unknown>>)[0]!;
  forgedRow.disposition = "disagreed";
  forgedRow.reasons = ["endpoint-direction-mismatch"];
  rehashComparisonRow(forgedRow, fixture.plan);
  const forgedSummary = asRecord(forgedComparison.summary);
  forgedSummary.dispositionCounts = {
    withinTolerance: 0,
    disagreed: 1,
    inconclusive: 0,
    incompatibleConventions: 0,
  };
  forgedSummary.numericAgreement = "disagreed";
  rehashComparison(forgedComparison, fixture.plan, fixture.candidate);
  assert.throws(
    () => KerrExternalOutputComparisonSchema.parse(forgedComparison),
    /inconsistent with its deltas/i,
  );

  const forgedSummaryOnly = structuredClone(
    fixture.comparison,
  ) as unknown as Record<string, unknown>;
  asRecord(forgedSummaryOnly.summary).maxXiAbsoluteDelta = 1;
  rehashComparison(forgedSummaryOnly, fixture.plan, fixture.candidate);
  assert.doesNotThrow(() =>
    KerrExternalOutputComparisonSchema.parse(forgedSummaryOnly),
  );
  assert.throws(
    () =>
      assertKerrExternalOutputComparisonIntegrity(
        fixture.comparisonInput,
        forgedSummaryOnly,
      ),
    /deterministic recomputation/i,
  );

  const comparisonAuthority = structuredClone(
    fixture.comparison,
  ) as unknown as Record<string, unknown>;
  comparisonAuthority.scientificValidationPassed = true;
  rehashComparison(comparisonAuthority, fixture.plan, fixture.candidate);
  assert.throws(() =>
    KerrExternalOutputComparisonSchema.parse(comparisonAuthority),
  );
});

test("comparison integrity preflights poisoned rows and detects checksum tampering", () => {
  const fixture = candidateLifecycle();
  let rowReads = 0;
  const poison = new Proxy(
    {},
    {
      get() {
        rowReads += 1;
        throw new Error("poison comparison row read");
      },
      getOwnPropertyDescriptor() {
        rowReads += 1;
        throw new Error("poison comparison row descriptor read");
      },
      getPrototypeOf() {
        rowReads += 1;
        throw new Error("poison comparison row prototype read");
      },
    },
  );
  const oversized = {
    ...structuredClone(fixture.comparison),
    rows: [poison, poison],
  };
  assert.throws(
    () =>
      assertKerrExternalOutputComparisonIntegrity(
        fixture.comparisonInput,
        oversized,
      ),
    /exactly one bounded row per planned ray/i,
  );
  assert.equal(rowReads, 0);

  const candidateAccessorRows = new Array<unknown>(1);
  Object.defineProperty(candidateAccessorRows, "0", {
    enumerable: true,
    configurable: true,
    get() {
      rowReads += 1;
      throw new Error("candidate row accessor executed");
    },
  });
  const accessorCandidate = {
    ...structuredClone(fixture.candidate),
    rows: candidateAccessorRows,
  };
  assert.throws(
    () =>
      assertKerrExternalOutputCandidateIntegrity(
        fixture.referenceBundle,
        fixture.plan,
        accessorCandidate,
      ),
    /own .*data elements/i,
  );
  assert.equal(rowReads, 0);

  let candidateRowsGetterReads = 0;
  const candidateWithRowsGetter = structuredClone(
    fixture.candidate,
  ) as unknown as Record<string, unknown>;
  Object.defineProperty(candidateWithRowsGetter, "rows", {
    enumerable: true,
    configurable: true,
    get() {
      candidateRowsGetterReads += 1;
      throw new Error("candidate rows getter executed");
    },
  });
  assert.throws(
    () =>
      assertKerrExternalOutputCandidateExactBytes(
        candidateWithRowsGetter,
        fixture.rawBytes,
        fixture.normalizedBytes,
      ),
    /own data property|rows/i,
  );
  assert.equal(candidateRowsGetterReads, 0);

  const comparisonAccessorRows = new Array<unknown>(1);
  Object.defineProperty(comparisonAccessorRows, "0", {
    enumerable: true,
    configurable: true,
    get() {
      rowReads += 1;
      throw new Error("comparison row accessor executed");
    },
  });
  const accessorComparison = {
    ...structuredClone(fixture.comparison),
    rows: comparisonAccessorRows,
  };
  assert.throws(
    () =>
      assertKerrExternalOutputComparisonIntegrity(
        fixture.comparisonInput,
        accessorComparison,
      ),
    /own .*data elements/i,
  );
  assert.equal(rowReads, 0);

  let nestedRowGetterReads = 0;
  const nestedAccessorComparison = structuredClone(
    fixture.comparison,
  ) as unknown as Record<string, unknown>;
  const nestedAccessorRow = (
    nestedAccessorComparison.rows as Array<Record<string, unknown>>
  )[0]!;
  Object.defineProperty(nestedAccessorRow, "reasons", {
    enumerable: true,
    configurable: true,
    get() {
      nestedRowGetterReads += 1;
      throw new Error("nested comparison-row getter executed");
    },
  });
  assert.throws(
    () =>
      assertKerrExternalOutputComparisonIntegrity(
        fixture.comparisonInput,
        nestedAccessorComparison,
      ),
    /own .*data properties/i,
  );
  assert.equal(nestedRowGetterReads, 0);

  const checksumTamper = structuredClone(
    fixture.comparison,
  ) as unknown as Record<string, unknown>;
  asRecord(checksumTamper.comparisonChecksum).value = sha256("f");
  assert.throws(
    () =>
      assertKerrExternalOutputComparisonIntegrity(
        fixture.comparisonInput,
        checksumTamper,
      ),
    /checksum mismatch/i,
  );
});

test("candidate and comparison records stay frozen, non-authoritative, and non-renderable", () => {
  const fixture = candidateLifecycle();
  assertDeepFrozen(fixture.normalizedOutput);
  assertDeepFrozen(fixture.candidate);
  assertDeepFrozen(fixture.comparison);
  for (const key of Object.keys(KERR_EXTERNAL_OUTPUT_NO_AUTHORITY)) {
    assert.equal(
      (fixture.normalizedOutput as unknown as Record<string, unknown>)[key],
      false,
    );
    assert.equal(
      (fixture.candidate as unknown as Record<string, unknown>)[key],
      false,
    );
    assert.equal(
      (fixture.comparison as unknown as Record<string, unknown>)[key],
      false,
    );
  }
  assert.equal(
    canUseKerrExternalOutputCandidateForRender(fixture.candidate),
    false,
  );
  assert.equal(
    canUseKerrExternalOutputCandidateForRender({ renderAllowed: true }),
    false,
  );
  assert.equal(
    canUseKerrExternalComparisonForRender(fixture.comparison),
    false,
  );
  assert.equal(
    canUseKerrExternalComparisonForRender({ renderAllowed: true }),
    false,
  );
});
