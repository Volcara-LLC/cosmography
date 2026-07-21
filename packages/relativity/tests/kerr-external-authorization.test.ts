import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  KERR_COMPARISON_NO_AUTHORITY,
  createKerrComparisonPlan,
  createKerrReferenceTraceRequest,
  kerrSha256Hex,
  kerrStableStringify,
  traceKerrReferenceLensMap,
  verifyKerrComparisonReferenceBundle,
  type KerrComparisonExternalImplementation,
  type KerrComparisonMapping,
  type KerrComparisonPlan,
  type VerifiedKerrComparisonReferenceBundle,
} from "../src/index.js";
import {
  KERR_EXTERNAL_AUTHORIZATION_NO_AUTHORITY,
  KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
  assertAuthorizedKerrExternalExecution,
  assertClaimedKerrExternalRunnerHandoffPlanBinding,
  assertKerrExternalExecutionRequestIntegrity,
  assertIssuedClaimedKerrExternalRunnerHandoff,
  assertIssuedKerrExternalRunnerHandoff,
  assertReviewedKerrExternalImplementationSelection,
  authorizeKerrExternalExecution,
  claimKerrExternalRunnerHandoffForImmediateUse,
  consumeKerrExternalExecutionAuthorization,
  createKerrExternalBlindedRunInput,
  createKerrExternalExecutionRequest,
  createKerrExternalSelectionReviewSubject,
  canUseKerrExternalAuthorizationForRender,
  recheckClaimedKerrExternalRunnerHandoffCurrentGrants,
  reviewKerrExternalImplementationSelection,
  type ClaimedKerrExternalRunnerHandoff,
  type KerrExternalBlindedRunInput,
  type KerrExternalExecutionRequest,
  type KerrExternalSelectionApproval,
  type KerrExternalSelectionReviewSubject,
  type ReviewedKerrExternalImplementationSelection,
} from "../src/kerr-external-authorization.js";

const requestFrozenAt = "2026-07-19T21:00:00Z";
const reportGeneratedAt = "2026-07-19T21:01:00Z";
const planFrozenAt = "2026-07-19T21:02:00Z";
const declaredCodeCommit = "a".repeat(40);
const reviewAssembledAt = "2026-07-19T21:06:00Z";
const selectionExpiresAt = "2026-07-19T22:00:00Z";

function sha256(character: string): string {
  return character.repeat(64);
}

function externalImplementation(
  overrides: Partial<KerrComparisonExternalImplementation> = {},
): KerrComparisonExternalImplementation {
  return {
    implementationId: "synthetic-independent-kerr-solver",
    displayName: "Synthetic Independent Kerr Solver",
    upstreamRepositoryUrl: "https://github.com/example/synthetic-kerr",
    version: "1.0.0-test",
    vcs: {
      system: "git",
      commitAlgorithm: "sha1",
      commit: "b".repeat(40),
    },
    sourceArchive: { byteLength: 12_345, sha256: sha256("1") },
    environment: {
      language: "Rust",
      runtime: "native-test-fixture",
      compiler: "rustc synthetic",
      platform: "isolated-test-platform",
      architecture: "x86_64",
      precision: "ieee-754-binary64",
      buildRecipeSha256: sha256("2"),
      environmentManifestSha256: sha256("3"),
      runRecipeSha256: sha256("4"),
    },
    algorithm: {
      geodesicMethod: "independent Hamiltonian null geodesics",
      integrator: "independent bounded integrator",
      errorControl: "synthetic local error control",
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
    normalizerId: "synthetic-independent-normalizer",
    version: "1.0.0-test",
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
      "Future-directed camera-emitted rays, normalized to E=1 before mapping.",
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

function referenceBundle(): VerifiedKerrComparisonReferenceBundle {
  const request = createKerrReferenceTraceRequest({
    frozenAt: requestFrozenAt,
    spin: 0.5,
    camera: {
      observer: "zamo",
      radiusRg: 30,
      inclinationDegrees: 90,
      azimuthDegrees: 0,
      verticalFieldOfViewDegrees: 30,
      tetrad: "orthonormal-zamo-v1",
    },
    grid: { width: 1, height: 1, sampling: "pixel-centers-row-major" },
    integration: {
      method: "bounded-event-guarded-rk4-hamiltonian",
      derivativeMethod: "analytic-inverse-metric-derivatives",
      stepSize: 0.025,
      maxSteps: 4_000,
      maxAffineParameter: 100,
      horizonGuardRg: 0.5,
      escapeRadiusRg: 60,
      thetaGuardRadians: 0.005,
    },
  });
  const report = traceKerrReferenceLensMap({
    request,
    generatedAt: reportGeneratedAt,
    declaredCodeCommit,
  });
  return verifyKerrComparisonReferenceBundle({
    cases: [
      {
        caseId: "krcase_authorization-fixture",
        scientificRole: "prograde-spin",
        request,
        report,
      },
    ],
  });
}

function planFor(
  bundle: VerifiedKerrComparisonReferenceBundle,
  overrides: {
    externalImplementation?: KerrComparisonExternalImplementation;
    mapping?: KerrComparisonMapping;
  } = {},
): KerrComparisonPlan {
  return createKerrComparisonPlan({
    referenceBundle: bundle,
    frozenAt: planFrozenAt,
    declaredCodeCommit,
    comparisonScope: "camera-and-solver",
    externalImplementation:
      overrides.externalImplementation ?? externalImplementation(),
    mapping: overrides.mapping ?? mapping(),
  });
}

function recursivelyCollectedKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) recursivelyCollectedKeys(entry, keys);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      keys.add(key);
      recursivelyCollectedKeys(entry, keys);
    }
  }
  return keys;
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

const bundle = referenceBundle();
const plan = planFor(bundle);
const blindedInput = createKerrExternalBlindedRunInput({
  referenceBundle: bundle,
  plan,
});
const evidenceBindings = {
  sourceTreeSha256: sha256("7"),
  dependencyManifestSha256: sha256("8"),
  submoduleManifestSha256: sha256("9"),
  lfsManifestSha256: sha256("d"),
  sbomSha256: sha256("e"),
  independenceReviewPackageSha256: sha256("f"),
  licenseReviewPackageSha256: sha256("0"),
  outputRightsReviewPackageSha256: sha256("a"),
  knownCosmographyTreeMatch: false,
  knownCosmographySolverDependencyMatch: false,
  knownCosmographyGeneratedFixtureMatch: false,
  knownMirrorOrForkLineageMatch: false,
};
const executionProfile = {
  executableSha256: sha256("f"),
  invocation: {
    executablePath: "/implementation/bin/kerr-solver",
    argv: ["--input", "/work/input.json"],
    shell: false,
    pathLookup: false,
    stdin: "closed",
    workingDirectory: "/work",
  },
  deterministicEnvironment: {
    inheritedEnvironment: false,
    locale: "C",
    timezone: "UTC",
    randomSeed: "12345",
    threadCount: 1,
    variables: [{ name: "RUST_BACKTRACE", value: "0" }],
    secretsAvailable: false,
    proxyVariablesAllowed: false,
    dynamicPreloadAllowed: false,
  },
  sandbox: {
    network: "disabled",
    sourceMount: "read-only-content-addressed",
    writableArea: "isolated-empty-temporary-directory",
    cosmographyRepositoryMounted: false,
    comparisonPlanMounted: false,
    referenceBundleMounted: false,
    referenceOutcomesMounted: false,
    referenceHashesMounted: false,
    tolerancesMounted: false,
  },
  limits: {
    maxCpuMilliseconds: 10_000,
    maxWallMilliseconds: 20_000,
    maxMemoryBytes: 268_435_456,
    maxProcesses: 1,
    maxWritableBytes: 10_485_760,
    maxStderrBytes: 65_536,
  },
} as const;
const subject = createKerrExternalSelectionReviewSubject({
  referenceBundle: bundle,
  plan,
  blindedInput,
  subjectFrozenAt: "2026-07-19T21:02:30Z",
  evidenceBindings,
  executionProfile,
});

function approvalsFor(
  reviewSubject: KerrExternalSelectionReviewSubject = subject,
): KerrExternalSelectionApproval[] {
  return [
    {
      role: "scientific-independence",
      reviewerId: "reviewer-science",
      roleGrantId: "grant-science",
      keyId: "key-science",
      approvalReference: "fixture-approval-science",
      subjectSha256: reviewSubject.subjectChecksum.value,
      decidedAt: "2026-07-19T21:03:00Z",
      expiresAt: selectionExpiresAt,
      decision: "accepted-for-bounded-evaluation",
    },
    {
      role: "execution-security",
      reviewerId: "reviewer-security",
      roleGrantId: "grant-security",
      keyId: "key-security",
      approvalReference: "fixture-approval-security",
      subjectSha256: reviewSubject.subjectChecksum.value,
      decidedAt: "2026-07-19T21:04:00Z",
      expiresAt: selectionExpiresAt,
      decision: "accepted-for-bounded-evaluation",
    },
    {
      role: "license-output-rights",
      reviewerId: "reviewer-rights",
      roleGrantId: "grant-rights",
      keyId: "key-rights",
      approvalReference: "fixture-approval-rights",
      subjectSha256: reviewSubject.subjectChecksum.value,
      decidedAt: "2026-07-19T21:05:00Z",
      expiresAt: selectionExpiresAt,
      decision: "accepted-for-bounded-evaluation",
    },
  ];
}

function reviewReceipt(
  approval: KerrExternalSelectionApproval,
  checkedAt = "2026-07-19T21:05:30Z",
) {
  return {
    accepted: true as const,
    role: approval.role,
    reviewerId: approval.reviewerId,
    roleGrantId: approval.roleGrantId,
    keyId: approval.keyId,
    subjectSha256: approval.subjectSha256,
    checkedAt,
    signatureVerified: true as const,
    roleGrantValid: true as const,
    notRevoked: true as const,
  };
}

async function reviewedSelectionFor(
  options: {
    referenceBundle?: VerifiedKerrComparisonReferenceBundle;
    plan?: KerrComparisonPlan;
    blindedInput?: KerrExternalBlindedRunInput;
    subject?: KerrExternalSelectionReviewSubject;
    approvals?: readonly unknown[];
    reviewedAt?: string;
    verifier?: Parameters<
      typeof reviewKerrExternalImplementationSelection
    >[1];
  } = {},
): Promise<ReviewedKerrExternalImplementationSelection> {
  const selectedBundle = options.referenceBundle ?? bundle;
  const selectedPlan = options.plan ?? plan;
  const selectedBlinded = options.blindedInput ?? blindedInput;
  const selectedSubject = options.subject ?? subject;
  const selectedApprovals = options.approvals ?? approvalsFor(selectedSubject);
  return reviewKerrExternalImplementationSelection(
    {
      referenceBundle: selectedBundle,
      plan: selectedPlan,
      blindedInput: selectedBlinded,
      subject: selectedSubject,
      approvals: selectedApprovals,
      reviewedAt: options.reviewedAt ?? reviewAssembledAt,
    },
    options.verifier ??
      ((_reviewSubject, approval) => reviewReceipt(approval)),
  );
}

let nonceSequence = 0;

function nextNonce(): string {
  nonceSequence += 1;
  return nonceSequence.toString(16).padStart(32, "0");
}

function executionRequestFor(
  selection: ReviewedKerrExternalImplementationSelection,
  selectedBlindedInput: KerrExternalBlindedRunInput = blindedInput,
  overrides: Partial<{
    requestedAt: string;
    expiresAt: string;
    attemptNonce: string;
    executableSha256: string;
    executablePath: string;
    argv: readonly string[];
    randomSeed: string;
    threadCount: number;
    environmentVariables: readonly { name: string; value: string }[];
    maxCpuMilliseconds: number;
    maxWallMilliseconds: number;
    maxMemoryBytes: number;
    maxProcesses: number;
    maxWritableBytes: number;
    maxStderrBytes: number;
  }> = {},
): KerrExternalExecutionRequest {
  return createKerrExternalExecutionRequest({
    selection,
    blindedInput: selectedBlindedInput,
    requestedAt: overrides.requestedAt ?? "2026-07-19T21:07:00Z",
    expiresAt: overrides.expiresAt ?? "2026-07-19T21:30:00Z",
    attemptNonce: overrides.attemptNonce ?? nextNonce(),
    executableSha256:
      overrides.executableSha256 ?? executionProfile.executableSha256,
    executablePath:
      overrides.executablePath ?? executionProfile.invocation.executablePath,
    argv: overrides.argv ?? executionProfile.invocation.argv,
    randomSeed:
      overrides.randomSeed ?? executionProfile.deterministicEnvironment.randomSeed,
    threadCount: overrides.threadCount ?? 1,
    environmentVariables:
      overrides.environmentVariables ??
      executionProfile.deterministicEnvironment.variables,
    maxCpuMilliseconds:
      overrides.maxCpuMilliseconds ?? executionProfile.limits.maxCpuMilliseconds,
    maxWallMilliseconds:
      overrides.maxWallMilliseconds ?? executionProfile.limits.maxWallMilliseconds,
    maxMemoryBytes:
      overrides.maxMemoryBytes ?? executionProfile.limits.maxMemoryBytes,
    maxProcesses: overrides.maxProcesses ?? 1,
    maxWritableBytes:
      overrides.maxWritableBytes ?? executionProfile.limits.maxWritableBytes,
    maxStderrBytes:
      overrides.maxStderrBytes ?? executionProfile.limits.maxStderrBytes,
  });
}

function currentGrantReceipt(
  approval: KerrExternalSelectionApproval,
  checkedAt: string,
) {
  return {
    accepted: true as const,
    role: approval.role,
    reviewerId: approval.reviewerId,
    roleGrantId: approval.roleGrantId,
    keyId: approval.keyId,
    subjectSha256: approval.subjectSha256,
    checkedAt,
    roleGrantValid: true as const,
    keyValid: true as const,
    notRevoked: true as const,
  };
}

async function authorizationFor(
  selection: ReviewedKerrExternalImplementationSelection,
  request: KerrExternalExecutionRequest,
  options: {
    authorizedAt?: string;
    authorizer?: Parameters<typeof authorizeKerrExternalExecution>[1];
  } = {},
) {
  return authorizeKerrExternalExecution(
    {
      selection,
      request,
      authorizedAt: options.authorizedAt ?? "2026-07-19T21:08:00Z",
    },
    options.authorizer ??
      ((approval, context) =>
        currentGrantReceipt(approval, context.checkedAt)),
  );
}

async function runnerHandoffFor() {
  const selection = await reviewedSelectionFor();
  const request = executionRequestFor(selection);
  const authorization = await authorizationFor(selection, request);
  const handoff = await consumeKerrExternalExecutionAuthorization(
    {
      authorization,
      selection,
      blindedInput,
      consumedAt: "2026-07-19T21:09:00Z",
    },
    (approval, context) =>
      currentGrantReceipt(approval, context.checkedAt),
  );
  return { selection, request, authorization, handoff };
}

function rehashExecutionRequest(
  input: KerrExternalExecutionRequest,
  mutate: (draft: KerrExternalExecutionRequest) => void,
): KerrExternalExecutionRequest {
  const draft = structuredClone(input);
  mutate(draft);
  const {
    requestId: _oldRequestId,
    requestChecksum: _oldRequestChecksum,
    ...unsignedWithoutIdentity
  } = draft;
  draft.requestId = `krxreq_${kerrSha256Hex(
    kerrStableStringify(unsignedWithoutIdentity),
  ).slice(0, 24)}`;
  const { requestChecksum: _excludedChecksum, ...unsignedWithId } = draft;
  draft.requestChecksum = {
    algorithm: "sha256",
    value: kerrSha256Hex(kerrStableStringify(unsignedWithId)),
    scope: "kerr-external-execution-request",
  };
  return draft;
}

test("blinded Kerr run input is deterministic and recursively excludes reference answers", () => {
  const first = createKerrExternalBlindedRunInput({
    referenceBundle: bundle,
    plan,
  });
  const second = createKerrExternalBlindedRunInput({
    referenceBundle: bundle,
    plan,
  });
  assert.deepEqual(second, first);
  assert.equal(Object.isFrozen(first), true);

  const keys = recursivelyCollectedKeys(first);
  for (const forbidden of [
    "planId",
    "planChecksum",
    "tolerances",
    "requestId",
    "requestChecksum",
    "reportId",
    "reportChecksum",
    "rayId",
    "rayChecksum",
    "screenX",
    "screenY",
    "referenceOutcome",
    "endpoint",
    "termination",
    "comparisonResult",
  ]) {
    assert.equal(keys.has(forbidden), false, `blinded input exposed ${forbidden}`);
  }

  const serialized = JSON.stringify(first);
  for (const referenceCase of plan.cases) {
    assert.equal(serialized.includes(referenceCase.request.requestId), false);
    assert.equal(
      serialized.includes(referenceCase.request.requestChecksum.value),
      false,
    );
    assert.equal(serialized.includes(referenceCase.report.reportId), false);
    assert.equal(
      serialized.includes(referenceCase.report.reportChecksum.value),
      false,
    );
    for (const ray of referenceCase.rays) {
      assert.equal(serialized.includes(ray.rayId), false);
      assert.equal(serialized.includes(ray.rayChecksum.value), false);
    }
  }
});

test("selection subjects, reviewed selections, and requests have deterministic identities", async () => {
  const duplicateSubject = createKerrExternalSelectionReviewSubject({
    referenceBundle: bundle,
    plan,
    blindedInput,
    subjectFrozenAt: subject.subjectFrozenAt,
    evidenceBindings,
    executionProfile,
  });
  assert.equal(duplicateSubject.subjectId, subject.subjectId);
  assert.equal(
    duplicateSubject.subjectChecksum.value,
    subject.subjectChecksum.value,
  );

  const firstSelection = await reviewedSelectionFor();
  const secondSelection = await reviewedSelectionFor();
  assert.equal(secondSelection.selectionId, firstSelection.selectionId);
  assert.equal(
    secondSelection.selectionChecksum.value,
    firstSelection.selectionChecksum.value,
  );
  assert.equal(Object.isFrozen(firstSelection), true);
  assert.equal(Object.isFrozen(firstSelection.approvals[0]), true);

  const attemptNonce = "1".repeat(32);
  const firstRequest = executionRequestFor(firstSelection, blindedInput, {
    attemptNonce,
  });
  const secondRequest = executionRequestFor(firstSelection, blindedInput, {
    attemptNonce,
  });
  assert.equal(secondRequest.requestId, firstRequest.requestId);
  assert.equal(
    secondRequest.requestChecksum.value,
    firstRequest.requestChecksum.value,
  );

  const authorization = await authorizationFor(firstSelection, firstRequest);
  assert.match(authorization.authorizationId, /^krxauth_[a-f0-9]{24}$/);
  assert.equal(Object.isFrozen(authorization), true);
  await assert.rejects(
    authorizationFor(firstSelection, firstRequest),
    /already been authorized/i,
  );
});

test("review binds the exact plan source, build, environment, run recipe, and mapping", async () => {
  const implementation = externalImplementation();
  const variants: KerrComparisonPlan[] = [
    planFor(bundle, {
      externalImplementation: {
        ...implementation,
        sourceArchive: {
          ...implementation.sourceArchive,
          sha256: sha256("c"),
        },
      },
    }),
    planFor(bundle, {
      externalImplementation: {
        ...implementation,
        vcs: { ...implementation.vcs, commit: "d".repeat(40) },
      },
    }),
    planFor(bundle, {
      externalImplementation: {
        ...implementation,
        environment: {
          ...implementation.environment,
          buildRecipeSha256: sha256("c"),
        },
      },
    }),
    planFor(bundle, {
      externalImplementation: {
        ...implementation,
        environment: {
          ...implementation.environment,
          environmentManifestSha256: sha256("d"),
        },
      },
    }),
    planFor(bundle, {
      externalImplementation: {
        ...implementation,
        environment: {
          ...implementation.environment,
          runRecipeSha256: sha256("e"),
        },
      },
    }),
    planFor(bundle, {
      mapping: mapping({ sourceSha256: sha256("f") }),
    }),
  ];

  for (const changedPlan of variants) {
    const changedBlindedInput = createKerrExternalBlindedRunInput({
      referenceBundle: bundle,
      plan: changedPlan,
    });
    let verifierCalls = 0;
    await assert.rejects(
      reviewedSelectionFor({
        plan: changedPlan,
        blindedInput: changedBlindedInput,
        subject,
        approvals: approvalsFor(subject),
        verifier: (_reviewSubject, approval) => {
          verifierCalls += 1;
          return reviewReceipt(approval);
        },
      }),
      /does not match|comparison plan/i,
    );
    assert.equal(verifierCalls, 0);
  }

  const changedEvidenceSubject = createKerrExternalSelectionReviewSubject({
    referenceBundle: bundle,
    plan,
    blindedInput,
    subjectFrozenAt: subject.subjectFrozenAt,
    evidenceBindings: {
      ...evidenceBindings,
      dependencyManifestSha256: sha256("c"),
    },
    executionProfile,
  });
  await assert.rejects(
    reviewedSelectionFor({
      subject: changedEvidenceSubject,
      approvals: approvalsFor(subject),
    }),
    /binding|chronology/i,
  );
});

test("any declared Cosmography or mirror lineage match blocks selection subject creation", () => {
  const lineageFlags = [
    "knownCosmographyTreeMatch",
    "knownCosmographySolverDependencyMatch",
    "knownCosmographyGeneratedFixtureMatch",
    "knownMirrorOrForkLineageMatch",
  ] as const;
  for (const flag of lineageFlags) {
    assert.throws(
      () =>
        createKerrExternalSelectionReviewSubject({
          referenceBundle: bundle,
          plan,
          blindedInput,
          subjectFrozenAt: subject.subjectFrozenAt,
          evidenceBindings: { ...evidenceBindings, [flag]: true },
          executionProfile,
        }),
      /expected false|invalid input|lineage|Cosmography/i,
    );
  }
});

test("selection requires exactly three canonical roles and distinct reviewers, grants, and keys", async () => {
  const valid = approvalsFor();
  const invalidSets: readonly unknown[][] = [
    valid.slice(0, 2),
    [...valid, { ...valid[0], role: "unknown-review-role" }],
    [valid[1], valid[0], valid[2]],
    [valid[0], { ...valid[1], role: valid[0].role }, valid[2]],
    [valid[0], { ...valid[1], reviewerId: valid[0].reviewerId }, valid[2]],
    [valid[0], { ...valid[1], roleGrantId: valid[0].roleGrantId }, valid[2]],
    [valid[0], { ...valid[1], keyId: valid[0].keyId }, valid[2]],
  ];

  for (const approvals of invalidSets) {
    let verifierCalls = 0;
    await assert.rejects(
      reviewedSelectionFor({
        approvals,
        verifier: (_reviewSubject, approval) => {
          verifierCalls += 1;
          return reviewReceipt(approval);
        },
      }),
      /role|length|distinct|invalid|expected/i,
    );
    assert.equal(verifierCalls, 0);
  }

  let verifierCalls = 0;
  await reviewedSelectionFor({
    verifier: (_reviewSubject, approval) => {
      verifierCalls += 1;
      return reviewReceipt(approval);
    },
  });
  assert.equal(verifierCalls, 3);
});

test("review chronology, expiry, receipt binding, and revocation fail closed", async () => {
  const chronologyCases = [
    (() => {
      const approvals = approvalsFor();
      approvals[0] = {
        ...approvals[0],
        decidedAt: "2026-07-19T21:02:00Z",
      };
      return { approvals };
    })(),
    (() => {
      const approvals = approvalsFor();
      approvals[2] = {
        ...approvals[2],
        decidedAt: "2026-07-19T21:06:01Z",
      };
      return { approvals };
    })(),
    (() => {
      const approvals = approvalsFor();
      approvals[2] = {
        ...approvals[2],
        expiresAt: reviewAssembledAt,
      };
      return { approvals };
    })(),
  ];
  for (const item of chronologyCases) {
    let verifierCalls = 0;
    await assert.rejects(
      reviewedSelectionFor({
        ...item,
        verifier: (_reviewSubject, approval) => {
          verifierCalls += 1;
          return reviewReceipt(approval);
        },
      }),
      /chronology|binding/i,
    );
    assert.equal(verifierCalls, 0);
  }

  await assert.rejects(
    reviewedSelectionFor({
      verifier: (_reviewSubject, approval) => ({
        ...reviewReceipt(approval),
        notRevoked: false,
      }),
    }),
    /notRevoked|expected true|literal/i,
  );
  await assert.rejects(
    reviewedSelectionFor({
      verifier: (_reviewSubject, approval) => ({
        ...reviewReceipt(approval),
        subjectSha256: sha256("c"),
      }),
    }),
    /does not match/i,
  );
});

test("review authorizers receive frozen values and mutation or exceptions cannot authorize", async () => {
  let calls = 0;
  const selection = await reviewedSelectionFor({
    verifier: (reviewSubject, approval) => {
      calls += 1;
      assert.equal(Object.isFrozen(reviewSubject), true);
      assert.equal(Object.isFrozen(approval), true);
      assert.throws(() => {
        (reviewSubject as { subjectId: string }).subjectId = "forged";
      }, TypeError);
      assert.throws(() => {
        (approval as { reviewerId: string }).reviewerId = "forged";
      }, TypeError);
      return reviewReceipt(approval);
    },
  });
  assert.equal(calls, 3);
  assert.equal(selection.subject.subjectId, subject.subjectId);

  await assert.rejects(
    reviewedSelectionFor({
      verifier: () => {
        throw new Error("synthetic verifier failure");
      },
    }),
    /synthetic verifier failure/i,
  );
});

test("structural copies cannot cross reviewed-selection or execution capability boundaries", async () => {
  const selection = await reviewedSelectionFor();
  assert.doesNotThrow(() =>
    assertReviewedKerrExternalImplementationSelection(selection),
  );
  for (const forged of [
    structuredClone(selection),
    { ...selection },
    JSON.parse(JSON.stringify(selection)) as unknown,
  ]) {
    assert.throws(
      () => assertReviewedKerrExternalImplementationSelection(forged),
      /in-process|structural copies/i,
    );
  }

  const request = executionRequestFor(selection);
  const authorization = await authorizationFor(selection, request);
  assert.doesNotThrow(() => assertAuthorizedKerrExternalExecution(authorization));
  const forgedAuthorization = structuredClone(authorization);
  assert.throws(
    () => assertAuthorizedKerrExternalExecution(forgedAuthorization),
    /in-process|structural copies/i,
  );
  await assert.rejects(
    consumeKerrExternalExecutionAuthorization(
      {
        authorization: forgedAuthorization,
        selection,
        blindedInput,
        consumedAt: "2026-07-19T21:09:00Z",
      },
      (approval, context) =>
        currentGrantReceipt(approval, context.checkedAt),
    ),
    /in-process|structural copies/i,
  );
});

test("execution request enforces review validity and exact blinded-content binding", async () => {
  const selection = await reviewedSelectionFor();
  assert.throws(
    () =>
      executionRequestFor(selection, blindedInput, {
        requestedAt: selection.validUntil,
      }),
    /chronology|validity/i,
  );
  assert.throws(
    () =>
      executionRequestFor(selection, blindedInput, {
        requestedAt: "2026-07-19T21:07:00Z",
        expiresAt: "2026-07-19T22:00:01Z",
      }),
    /chronology|validity/i,
  );

  const tampered = structuredClone(blindedInput);
  tampered.cases[0]!.maxAffineParameter += 0.25;
  assert.throws(
    () => executionRequestFor(selection, tampered),
    /checksum|reviewed blinded input|integrity/i,
  );
});

test("execution requests cannot drift from the reviewed executable or sandbox profile", async () => {
  const selection = await reviewedSelectionFor();
  const driftedProfiles: ReadonlyArray<
    Partial<Parameters<typeof executionRequestFor>[2]>
  > = [
    { executableSha256: sha256("c") },
    { executablePath: "/implementation/bin/other-kerr" },
    { argv: ["--different-input", "/work/input.json"] },
    { randomSeed: "999" },
    { threadCount: 2 },
    { environmentVariables: [{ name: "RUST_BACKTRACE", value: "1" }] },
    { maxCpuMilliseconds: executionProfile.limits.maxCpuMilliseconds + 1 },
    { maxWallMilliseconds: executionProfile.limits.maxWallMilliseconds + 1 },
    { maxMemoryBytes: executionProfile.limits.maxMemoryBytes + 1 },
    { maxProcesses: 2 },
    { maxWritableBytes: executionProfile.limits.maxWritableBytes + 1 },
    { maxStderrBytes: executionProfile.limits.maxStderrBytes + 1 },
  ];
  for (const overrides of driftedProfiles) {
    assert.throws(
      () => executionRequestFor(selection, blindedInput, overrides),
      /reviewed command|environment|sandbox|limits|execution profile/i,
    );
  }
});

test("tampered blinded input cannot reach the consumed runner handoff", async () => {
  const selection = await reviewedSelectionFor();
  const request = executionRequestFor(selection);
  const authorization = await authorizationFor(selection, request);
  const tampered = structuredClone(blindedInput);
  tampered.cases[0]!.maxAffineParameter += 0.5;
  await assert.rejects(
    consumeKerrExternalExecutionAuthorization(
      {
        authorization,
        selection,
        blindedInput: tampered,
        consumedAt: "2026-07-19T21:09:00Z",
      },
      (approval, context) =>
        currentGrantReceipt(approval, context.checkedAt),
    ),
    /checksum|blinded input|integrity/i,
  );
});

test("current grant checks bind time and revocation at authorization and consumption", async () => {
  const selection = await reviewedSelectionFor();
  const request = executionRequestFor(selection);
  await assert.rejects(
    authorizationFor(selection, request, {
      authorizer: (approval, context) => ({
        ...currentGrantReceipt(approval, context.checkedAt),
        notRevoked: false,
      }),
    }),
    /notRevoked|expected true|literal/i,
  );

  const retryRequest = executionRequestFor(selection);
  const retry = await authorizationFor(selection, retryRequest);
  await assert.rejects(
    consumeKerrExternalExecutionAuthorization(
      {
        authorization: retry,
        selection,
        blindedInput,
        consumedAt: "2026-07-19T21:09:00Z",
      },
      (approval, context) => ({
        ...currentGrantReceipt(approval, context.checkedAt),
        notRevoked: false,
      }),
    ),
    /notRevoked|expected true|literal/i,
  );

  const expiringRequest = executionRequestFor(selection, blindedInput, {
    expiresAt: "2026-07-19T21:10:00Z",
  });
  await assert.rejects(
    authorizationFor(selection, expiringRequest, {
      authorizedAt: expiringRequest.expiresAt,
    }),
    /outside validity/i,
  );
});

test("one execution request cannot be reauthorized by changing the authorization time", async () => {
  const selection = await reviewedSelectionFor();
  const request = executionRequestFor(selection);
  await authorizationFor(selection, request, {
    authorizedAt: "2026-07-19T21:08:00Z",
  });
  await assert.rejects(
    authorizationFor(selection, request, {
      authorizedAt: "2026-07-19T21:09:00Z",
    }),
    /request|intent|already|burned|authorized/i,
  );
});

test("a failed or throwing current-grant check burns that request in-process", async () => {
  const selection = await reviewedSelectionFor();
  for (const failure of ["rejected-receipt", "thrown-authorizer"] as const) {
    const request = executionRequestFor(selection);
    await assert.rejects(
      authorizationFor(selection, request, {
        authorizedAt: "2026-07-19T21:08:00Z",
        authorizer:
          failure === "rejected-receipt"
            ? (approval, context) => ({
                ...currentGrantReceipt(approval, context.checkedAt),
                notRevoked: false,
              })
            : () => {
                throw new Error("synthetic current-grant outage");
              },
      }),
      /notRevoked|expected true|literal|synthetic current-grant outage/i,
    );
    await assert.rejects(
      authorizationFor(selection, request, {
        authorizedAt: "2026-07-19T21:09:00Z",
      }),
      /request|intent|already|burned|authorized/i,
    );
  }
});

test("public rehashing cannot alter reviewed case or ray counts", async () => {
  const selection = await reviewedSelectionFor();
  const request = executionRequestFor(selection);
  const tampered = [
    rehashExecutionRequest(request, (draft) => {
      draft.blindedInputBinding.caseCount += 1;
    }),
    rehashExecutionRequest(request, (draft) => {
      draft.blindedInputBinding.totalRays += 1;
    }),
  ];
  for (const changed of tampered) {
    assert.notEqual(changed.requestId, request.requestId);
    assert.notEqual(changed.requestChecksum.value, request.requestChecksum.value);
    assert.throws(
      () => assertKerrExternalExecutionRequestIntegrity(selection, changed),
      /does not match its reviewed selection/i,
    );
  }
});

test("grant authorizers receive frozen inputs and poison or thrown receipts fail closed", async () => {
  const selection = await reviewedSelectionFor();
  const request = executionRequestFor(selection);
  let calls = 0;
  const authorization = await authorizationFor(selection, request, {
    authorizer: (approval, context) => {
      calls += 1;
      assert.equal(Object.isFrozen(approval), true);
      assert.equal(Object.isFrozen(context), true);
      assert.throws(() => {
        (approval as { keyId: string }).keyId = "forged";
      }, TypeError);
      assert.throws(() => {
        (context as { checkedAt: string }).checkedAt = planFrozenAt;
      }, TypeError);
      return currentGrantReceipt(approval, context.checkedAt);
    },
  });
  assert.equal(calls, 3);
  assert.equal(authorization.executionVerified, false);

  const thrownRequest = executionRequestFor(selection);
  await assert.rejects(
    authorizationFor(selection, thrownRequest, {
      authorizer: () => {
        throw new Error("synthetic grant registry failure");
      },
    }),
    /synthetic grant registry failure/i,
  );

  const poisonRequest = executionRequestFor(selection);
  let getterReads = 0;
  await assert.rejects(
    authorizationFor(selection, poisonRequest, {
      authorizer: (approval, context) => {
        const receipt = currentGrantReceipt(approval, context.checkedAt);
        Object.defineProperty(receipt, "role", {
          enumerable: true,
          get() {
            getterReads += 1;
            return approval.role;
          },
        });
        return receipt;
      },
    }),
    /data propert|canonical plain data/i,
  );
  assert.equal(getterReads, 0);
});

test("poison, sparse, custom, exotic, and oversized review inputs fail before callbacks", async () => {
  const valid = approvalsFor();
  let getterReads = 0;
  const accessorApproval = { ...valid[0] };
  Object.defineProperty(accessorApproval, "role", {
    enumerable: true,
    get() {
      getterReads += 1;
      return valid[0]!.role;
    },
  });
  const sparse = new Array<unknown>(3);
  sparse[0] = valid[0];
  sparse[2] = valid[2];
  const custom = [...valid] as unknown[] & { marker?: boolean };
  custom.marker = true;
  const exoticApproval = Object.assign(Object.create({ inherited: true }), valid[0]);
  const oversized = new Array<unknown>(626).fill(valid[0]);
  const invalidInputs: readonly unknown[] = [
    [accessorApproval, valid[1], valid[2]],
    sparse,
    custom,
    [exoticApproval, valid[1], valid[2]],
    oversized,
  ];

  let verifierCalls = 0;
  for (const approvals of invalidInputs) {
    await assert.rejects(
      reviewedSelectionFor({
        approvals: approvals as readonly unknown[],
        verifier: (_reviewSubject, approval) => {
          verifierCalls += 1;
          return reviewReceipt(approval);
        },
      }),
      /array|plain|data propert|canonical|length|oversized|bounded/i,
    );
  }
  assert.equal(getterReads, 0);
  assert.equal(verifierCalls, 0);

  const poisonTopLevel: Record<string, unknown> = {
    referenceBundle: bundle,
    plan,
    blindedInput,
    subject,
    reviewedAt: reviewAssembledAt,
  };
  Object.defineProperty(poisonTopLevel, "approvals", {
    enumerable: true,
    get() {
      getterReads += 1;
      return valid;
    },
  });
  await assert.rejects(
    reviewKerrExternalImplementationSelection(
      poisonTopLevel as unknown as Parameters<
        typeof reviewKerrExternalImplementationSelection
      >[0],
      (_reviewSubject, approval) => {
        verifierCalls += 1;
        return reviewReceipt(approval);
      },
    ),
    /own data property/i,
  );
  assert.equal(getterReads, 0);
  assert.equal(verifierCalls, 0);
});

test("poisoned execution arguments and environment values are rejected without getter reads", async () => {
  const selection = await reviewedSelectionFor();
  let getterReads = 0;
  const poisonArgv: string[] = [];
  Object.defineProperty(poisonArgv, "0", {
    enumerable: true,
    get() {
      getterReads += 1;
      return "--input";
    },
  });
  poisonArgv.length = 1;
  assert.throws(
    () => executionRequestFor(selection, blindedInput, { argv: poisonArgv }),
    /data element|data propert|canonical plain data/i,
  );
  assert.equal(getterReads, 0);

  const poisonVariable: { name: string; value?: string } = {
    name: "RUST_BACKTRACE",
  };
  Object.defineProperty(poisonVariable, "value", {
    enumerable: true,
    get() {
      getterReads += 1;
      return "0";
    },
  });
  assert.throws(
    () =>
      executionRequestFor(selection, blindedInput, {
        environmentVariables: [
          poisonVariable as { name: string; value: string },
        ],
      }),
    /data propert|canonical plain data/i,
  );
  assert.equal(getterReads, 0);
});

test("environment allowlist blocks loader, shell, language, path, and proxy controls before authorization", async () => {
  const selection = await reviewedSelectionFor();
  const forbiddenNames = [
    "BASH_ENV",
    "ENV",
    "PERL5OPT",
    "RUBYOPT",
    "GCONV_PATH",
    "PATH",
    "LD_PRELOAD",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
  ] as const;
  for (const name of forbiddenNames) {
    assert.throws(
      () =>
        executionRequestFor(selection, blindedInput, {
          environmentVariables: [{ name, value: "1" }],
        }),
      /environment variable|allowlist|invalid input/i,
      name,
    );
  }

  for (const value of ["0", "01", "1000", "many"]) {
    assert.throws(
      () =>
        executionRequestFor(selection, blindedInput, {
          environmentVariables: [{ name: "OMP_NUM_THREADS", value }],
        }),
      /environment value|allowlist|invalid input/i,
      `OMP_NUM_THREADS=${value}`,
    );
  }
  for (const value of ["2", "true", "yes", "FULL"]) {
    assert.throws(
      () =>
        executionRequestFor(selection, blindedInput, {
          environmentVariables: [{ name: "RUST_BACKTRACE", value }],
        }),
      /environment value|allowlist|invalid input/i,
      `RUST_BACKTRACE=${value}`,
    );
  }
  for (const threadCount of [0, 65]) {
    assert.throws(
      () =>
        executionRequestFor(selection, blindedInput, { threadCount }),
      /threadCount|too small|too big|invalid input/i,
    );
  }
});

test("execution authorization is atomically one-use under concurrent consumption", async () => {
  const selection = await reviewedSelectionFor();
  const request = executionRequestFor(selection);
  const authorization = await authorizationFor(selection, request);
  const consume = () =>
    consumeKerrExternalExecutionAuthorization(
      {
        authorization,
        selection,
        blindedInput,
        consumedAt: "2026-07-19T21:09:00Z",
      },
      async (approval, context) =>
        currentGrantReceipt(approval, context.checkedAt),
    );
  const results = await Promise.allSettled([
    Promise.resolve().then(consume),
    Promise.resolve().then(consume),
  ]);
  assert.equal(
    results.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter(({ status }) => status === "rejected").length,
    1,
  );
  await assert.rejects(consume(), /already been consumed/i);
});

test("runner handoff stays answer-blinded and grants no runner or downstream authority", async () => {
  const selection = await reviewedSelectionFor();
  const request = executionRequestFor(selection);
  const authorization = await authorizationFor(selection, request);
  const handoff = await consumeKerrExternalExecutionAuthorization(
    {
      authorization,
      selection,
      blindedInput,
      consumedAt: "2026-07-19T21:09:00Z",
    },
    (approval, context) =>
      currentGrantReceipt(approval, context.checkedAt),
  );

  assert.equal(handoff.externalExecutionRequestReleased, true);
  assert.equal(handoff.externalExecutionAuthorized, true);
  assert.equal(handoff.executionVerified, false);
  assert.equal(handoff.expiresAt, authorization.expiresAt);
  assert.equal(handoff.expiresAt, request.expiresAt);
  assert.equal(Object.isFrozen(handoff), true);
  assert.doesNotThrow(() => assertIssuedKerrExternalRunnerHandoff(handoff));
  for (const forged of [
    structuredClone(handoff),
    { ...handoff },
    JSON.parse(JSON.stringify(handoff)) as unknown,
  ]) {
    assert.throws(
      () => assertIssuedKerrExternalRunnerHandoff(forged),
      /in-process|structural copies/i,
    );
  }
  for (const [key, expected] of Object.entries(
    KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
  )) {
    assert.equal(
      (handoff as unknown as Record<string, unknown>)[key],
      expected,
      key,
    );
  }
  for (const [key, expected] of Object.entries(
    KERR_EXTERNAL_AUTHORIZATION_NO_AUTHORITY,
  )) {
    assert.equal(
      (handoff as unknown as Record<string, unknown>)[key],
      expected,
      key,
    );
  }
  assert.equal("runner" in handoff, false);
  assert.equal("execute" in handoff, false);
  assert.equal(canUseKerrExternalAuthorizationForRender(handoff), false);

  const keys = recursivelyCollectedKeys(handoff);
  for (const forbidden of [
    "planId",
    "planChecksum",
    "tolerances",
    "requestChecksum",
    "reportId",
    "reportChecksum",
    "rayId",
    "rayChecksum",
    "screenX",
    "screenY",
    "referenceOutcome",
    "endpoint",
    "termination",
  ]) {
    assert.equal(keys.has(forbidden), false, `handoff exposed ${forbidden}`);
  }
  const serialized = JSON.stringify(handoff);
  for (const referenceCase of plan.cases) {
    assert.equal(serialized.includes(referenceCase.request.requestId), false);
    assert.equal(
      serialized.includes(referenceCase.request.requestChecksum.value),
      false,
    );
    assert.equal(serialized.includes(referenceCase.report.reportId), false);
    assert.equal(
      serialized.includes(referenceCase.report.reportChecksum.value),
      false,
    );
    for (const ray of referenceCase.rays) {
      assert.equal(serialized.includes(ray.rayId), false);
      assert.equal(serialized.includes(ray.rayChecksum.value), false);
    }
  }
});

test("immediate-use claim rejects forged handoffs without consuming the issued original", async () => {
  const { handoff } = await runnerHandoffFor();
  assert.doesNotThrow(() => assertIssuedKerrExternalRunnerHandoff(handoff));
  for (const forged of [
    structuredClone(handoff),
    { ...handoff },
    JSON.parse(JSON.stringify(handoff)) as unknown,
  ]) {
    await assert.rejects(
      claimKerrExternalRunnerHandoffForImmediateUse(
        {
          handoff: forged as typeof handoff,
          checkedAt: "2026-07-19T21:10:00Z",
        },
        (approval, context) =>
          currentGrantReceipt(approval, context.checkedAt),
      ),
      /in-process|structural copies/i,
    );
  }
  const claimed = await claimKerrExternalRunnerHandoffForImmediateUse(
    { handoff, checkedAt: "2026-07-19T21:10:00Z" },
    (approval, context) =>
      currentGrantReceipt(approval, context.checkedAt),
  );
  assert.notEqual(claimed, handoff);
  assert.deepEqual(claimed.handoff, handoff);
});

test("claimed runner capability is distinct, deeply frozen, unforgeable, and exact-plan bound", async () => {
  const { handoff } = await runnerHandoffFor();
  const claimed = await claimKerrExternalRunnerHandoffForImmediateUse(
    { handoff, checkedAt: "2026-07-19T21:10:00Z" },
    (approval, context) =>
      currentGrantReceipt(approval, context.checkedAt),
  );
  assert.notEqual(claimed, handoff);
  assert.deepEqual(claimed.handoff, handoff);
  assert.equal(claimed.claimedAt, "2026-07-19T21:10:00Z");
  assert.equal(claimed.expiresAt, handoff.expiresAt);
  assertDeepFrozen(claimed);
  assert.doesNotThrow(() =>
    assertIssuedClaimedKerrExternalRunnerHandoff(claimed),
  );
  assert.doesNotThrow(() =>
    assertClaimedKerrExternalRunnerHandoffPlanBinding(claimed, bundle, plan),
  );

  for (const forged of [
    structuredClone(claimed),
    { ...claimed },
    JSON.parse(JSON.stringify(claimed)) as unknown,
  ]) {
    assert.throws(
      () => assertIssuedClaimedKerrExternalRunnerHandoff(forged),
      /issued in this process|structural copies/i,
    );
    assert.throws(
      () =>
        assertClaimedKerrExternalRunnerHandoffPlanBinding(
          forged,
          bundle,
          plan,
        ),
      /issued in this process|structural copies/i,
    );
  }

  const changedPlan = planFor(bundle, {
    mapping: mapping({ sourceSha256: sha256("c") }),
  });
  assert.throws(
    () =>
      assertClaimedKerrExternalRunnerHandoffPlanBinding(
        claimed,
        bundle,
        changedPlan,
      ),
    /does not match|plan|blinded input/i,
  );
});

test("claimed runner capability current-grant recheck enforces time and revocation", async () => {
  const { handoff } = await runnerHandoffFor();
  const claimed = await claimKerrExternalRunnerHandoffForImmediateUse(
    { handoff, checkedAt: "2026-07-19T21:10:00Z" },
    (approval, context) =>
      currentGrantReceipt(approval, context.checkedAt),
  );
  let calls = 0;
  await recheckClaimedKerrExternalRunnerHandoffCurrentGrants(
    claimed,
    "2026-07-19T21:11:00Z",
    (approval, context) => {
      calls += 1;
      return currentGrantReceipt(approval, context.checkedAt);
    },
  );
  assert.equal(calls, 3);

  for (const checkedAt of [
    "2026-07-19T21:09:59Z",
    claimed.expiresAt,
  ]) {
    let rejectedCalls = 0;
    await assert.rejects(
      recheckClaimedKerrExternalRunnerHandoffCurrentGrants(
        claimed,
        checkedAt,
        (approval, context) => {
          rejectedCalls += 1;
          return currentGrantReceipt(approval, context.checkedAt);
        },
      ),
      /expired|not yet valid/i,
    );
    assert.equal(rejectedCalls, 0);
  }

  await assert.rejects(
    recheckClaimedKerrExternalRunnerHandoffCurrentGrants(
      claimed,
      "2026-07-19T21:12:00Z",
      (approval, context) => ({
        ...currentGrantReceipt(approval, context.checkedAt),
        notRevoked: false,
      }),
    ),
    /notRevoked|expected true|literal/i,
  );
  await assert.rejects(
    recheckClaimedKerrExternalRunnerHandoffCurrentGrants(
      structuredClone(claimed),
      "2026-07-19T21:12:00Z",
      (approval, context) =>
        currentGrantReceipt(approval, context.checkedAt),
    ),
    /issued in this process|structural copies/i,
  );
});

test("immediate-use claim rechecks expiry and revocation and burns failed claims", async () => {
  const expired = await runnerHandoffFor();
  let expiredVerifierCalls = 0;
  await assert.rejects(
    claimKerrExternalRunnerHandoffForImmediateUse(
      { handoff: expired.handoff, checkedAt: expired.handoff.expiresAt },
      (approval, context) => {
        expiredVerifierCalls += 1;
        return currentGrantReceipt(approval, context.checkedAt);
      },
    ),
    /expired|not yet valid/i,
  );
  assert.equal(expiredVerifierCalls, 0);
  await assert.rejects(
    claimKerrExternalRunnerHandoffForImmediateUse(
      { handoff: expired.handoff, checkedAt: "2026-07-19T21:10:00Z" },
      (approval, context) =>
        currentGrantReceipt(approval, context.checkedAt),
    ),
    /already been claimed/i,
  );

  for (const failure of ["revoked", "thrown"] as const) {
    const fixture = await runnerHandoffFor();
    await assert.rejects(
      claimKerrExternalRunnerHandoffForImmediateUse(
        { handoff: fixture.handoff, checkedAt: "2026-07-19T21:10:00Z" },
        failure === "revoked"
          ? (approval, context) => ({
              ...currentGrantReceipt(approval, context.checkedAt),
              notRevoked: false,
            })
          : () => {
              throw new Error("synthetic immediate-use registry outage");
            },
      ),
      /notRevoked|expected true|literal|synthetic immediate-use registry outage/i,
    );
    await assert.rejects(
      claimKerrExternalRunnerHandoffForImmediateUse(
        { handoff: fixture.handoff, checkedAt: "2026-07-19T21:11:00Z" },
        (approval, context) =>
          currentGrantReceipt(approval, context.checkedAt),
      ),
      /already been claimed/i,
    );
  }
});

test("immediate-use runner handoff claim is atomic and one-use under concurrency", async () => {
  const { handoff } = await runnerHandoffFor();
  const claim = () =>
    claimKerrExternalRunnerHandoffForImmediateUse(
      { handoff, checkedAt: "2026-07-19T21:10:00Z" },
      async (approval, context) =>
        currentGrantReceipt(approval, context.checkedAt),
    );
  const results = await Promise.allSettled([
    Promise.resolve().then(claim),
    Promise.resolve().then(claim),
  ]);
  assert.equal(
    results.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.filter(({ status }) => status === "rejected").length,
    1,
  );
  const fulfilled = results.find(
    (result): result is PromiseFulfilledResult<ClaimedKerrExternalRunnerHandoff> =>
      result.status === "fulfilled",
  );
  assert.notEqual(fulfilled?.value, handoff);
  assert.deepEqual(fulfilled?.value.handoff, handoff);
  await assert.rejects(claim(), /already been claimed/i);
});

test("authorization source has no I/O, process, dynamic-loader, or runner imports", () => {
  const source = readFileSync(
    new URL("../src/kerr-external-authorization.ts", import.meta.url),
    "utf8",
  );
  const moduleSpecifiers = [
    ...source.matchAll(/\bfrom\s+["']([^"']+)["']/g),
  ].map((match) => match[1]!);
  assert.deepEqual(
    [...moduleSpecifiers].sort(),
    ["./kerr-comparison-plan.js", "./trace-contracts.js", "zod"],
  );
  for (const specifier of moduleSpecifiers) {
    assert.doesNotMatch(
      specifier,
      /^(?:node:)?(?:fs|fs\/promises|net|http|https|http2|child_process|worker_threads|cluster|dgram|tls|dns|module|vm)(?:\/|$)|runner/i,
    );
  }
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.doesNotMatch(
    source,
    /\b(?:fetch|XMLHttpRequest|WebSocket|require|spawn|execFile|fork)\s*\(/,
  );
  assert.doesNotMatch(source, /\bnew\s+(?:Worker|SharedWorker)\s*\(/);
  assert.doesNotMatch(source, /\b(?:class|function)\s+\w*Runner\b/);
});
