import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
  KERR_COMPARISON_MAX_TOTAL_PIXELS,
  KERR_COMPARISON_NO_AUTHORITY,
  KERR_COMPARISON_PROVISIONAL_TOLERANCES,
  KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
  KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES,
  KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES,
  KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
  KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  KERR_EXTERNAL_MAPPING_REVIEW_POLICY_VERSION,
  KERR_EXTERNAL_OUTPUT_NO_AUTHORITY,
  KERR_EXTERNAL_SCIENTIFIC_REVIEW_POLICY_VERSION,
  KERR_EXTERNAL_SCIENTIFIC_REVIEW_RECORD_MAX_CANONICAL_BYTES,
  KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES,
  KERR_RECEIPT_BOUND_NUMERIC_COMPARISON_MAX_CANONICAL_BYTES,
  KerrExternalScientificReviewDecisionSchema,
  KerrExternalScientificReviewDecisionStatementSchema,
  KerrExternalScientificReviewSubjectSchema,
  KerrExternalScientificReviewVerifierReceiptSchema,
  KERR_RECEIPT_BOUND_PREPARED_CANDIDATE_MAX_CANONICAL_BYTES,
  KerrExternalBlindedNormalizedOutputSchema,
  KerrExternalMappingReviewDecisionSchema,
  KerrExternalMappingReviewDecisionStatementSchema,
  KerrExternalMappingReviewSubjectSchema,
  KerrExternalMappingReviewVerifierReceiptSchema,
  KerrExternalMappingSemanticAssertionsSchema,
  KerrExternalExecutionReceiptDeclarationSchema,
  KerrExternalExecutionReceiptVerificationSubjectSchema,
  PreparedKerrExternalComparisonReviewSchema,
  ReceiptBoundKerrExternalNumericComparisonSchema,
  ReceiptBoundKerrExternalScientificOpinionRecordSchema,
  VerifiedKerrExternalExecutionReceiptSchema,
  VerifiedKerrExternalOutputAdmissionSchema,
  admitVerifiedKerrExternalOutput,
  assertIssuedPreparedKerrExternalComparisonReview,
  assertIssuedReceiptBoundKerrExternalNumericComparison,
  assertIssuedReceiptBoundKerrExternalScientificOpinionRecord,
  assertIssuedVerifiedKerrExternalExecutionReceipt,
  assertIssuedVerifiedKerrExternalOutputAdmission,
  assertKerrExternalBlindedNormalizedOutputIntegrity,
  assertKerrExternalBlindedNormalizedOutputForRunnerIntegrity,
  assertKerrExternalExecutionReceiptDeclarationIntegrity,
  assertKerrExternalMappingReviewDecisionIntegrity,
  assertKerrExternalMappingReviewSubjectIntegrity,
  assertKerrExternalScientificReviewDecisionIntegrity,
  assertKerrExternalScientificReviewSubjectIntegrity,
  assertKerrExternalScientificReviewSubjectSelfIntegrity,
  assertPreparedKerrExternalComparisonReviewExactBytes,
  assertReceiptBoundKerrExternalNumericComparisonIntegrity,
  assertReceiptBoundKerrExternalNumericComparisonSelfIntegrity,
  assertReceiptBoundKerrExternalScientificOpinionRecordIntegrity,
  assertReceiptBoundKerrExternalScientificOpinionRecordSelfIntegrity,
  assertVerifiedKerrExternalExecutionReceiptExactBytes,
  assertVerifiedKerrExternalOutputAdmissionExactBytes,
  authorizeKerrExternalExecution,
  canonicalKerrExternalBlindedNormalizedOutputBytes,
  canonicalKerrExternalBlindedNormalizedOutputBytesForRunner,
  canonicalKerrExternalMappingReviewDecisionStatementBytes,
  canonicalKerrExternalMappingReviewSubjectBytes,
  canonicalKerrExternalNormalizedOutputBytes,
  canonicalKerrExternalRunnerKnownExecutionStatementBytes,
  canUsePreparedKerrExternalComparisonReviewForRender,
  canUseReceiptBoundKerrExternalNumericComparisonForRender,
  canUseReceiptBoundKerrExternalScientificOpinionRecordForRelease,
  canUseReceiptBoundKerrExternalScientificOpinionRecordForRender,
  canUseVerifiedKerrExternalOutputForRender,
  claimKerrExternalRunnerHandoffForImmediateUse,
  compareKerrReferenceToExternalCandidate,
  consumePreparedKerrExternalComparisonReview,
  consumeKerrExternalExecutionAuthorization,
  createKerrComparisonPlan,
  createKerrExternalBlindedNormalizedOutput,
  createKerrExternalBlindedNormalizedOutputForRunner,
  createKerrExternalBlindedRunInput,
  createKerrExternalExecutionReceiptDeclaration,
  createKerrExternalExecutionRequest,
  createKerrExternalMappingReviewDecision,
  createKerrExternalMappingReviewDecisionStatement,
  createKerrExternalMappingReviewSubject,
  createKerrExternalScientificReviewDecision,
  createKerrExternalScientificReviewDecisionStatement,
  createKerrExternalScientificReviewSubject,
  createKerrExternalNormalizedOutput,
  createKerrExternalOutputCandidate,
  createKerrExternalRunnerExecutionOutputBindings,
  createKerrExternalRunnerKnownExecutionStatement,
  createKerrExternalSelectionReviewSubject,
  createKerrReferenceTraceRequest,
  kerrSha256Hex,
  kerrExternalMappingReviewDecisionStatementSha256,
  kerrExternalMappingReviewSubjectSha256,
  kerrExternalScientificReviewSubjectSha256,
  kerrExternalRunnerKnownExecutionStatementSha256,
  kerrStableStringify,
  prepareVerifiedKerrExternalOutputForComparisonReview,
  recordReceiptBoundKerrExternalScientificReviewOpinions,
  reviewKerrExternalImplementationSelection,
  traceKerrReferenceLensMap,
  verifyKerrComparisonReferenceBundle,
  verifyKerrExternalExecutionReceipt,
  type ClaimedKerrExternalRunnerHandoff,
  type KerrComparisonExternalImplementation,
  type KerrComparisonMapping,
  type KerrComparisonPlan,
  type KerrExternalBlindedNormalizedOutput,
  type KerrExternalExecutionReceiptDeclaration,
  type KerrExternalExecutionReceiptVerificationSubject,
  type KerrExternalExecutionReceiptVerifierReceipt,
  type KerrExternalMappingReviewDecision,
  type KerrExternalMappingReviewSubject,
  type KerrExternalMappingReviewVerifierReceipt,
  type KerrExternalSelectionApproval,
  type KerrExternalSelectionReviewSubject,
  type KerrExternalScientificReviewDecision,
  type KerrExternalScientificReviewOpinion,
  type KerrExternalScientificReviewerAssignment,
  type KerrExternalScientificReviewSubject,
  type KerrExternalScientificReviewVerifierReceipt,
  type ReceiptBoundKerrExternalNumericComparison,
  type VerifiedKerrComparisonReferenceBundle,
  type VerifiedKerrExternalExecutionReceipt,
} from "../src/index.js";
import { KERR_NUMERIC_COMPARISON_REASON_ORDER } from "../src/kerr-numeric-comparison-core.js";

const requestFrozenAt = "2026-07-19T21:00:00Z";
const reportGeneratedAt = "2026-07-19T21:01:00Z";
const planFrozenAt = "2026-07-19T21:02:00Z";
const reviewAssembledAt = "2026-07-19T21:06:00Z";
const selectionExpiresAt = "2026-07-19T22:00:00Z";
const declaredCodeCommit = "a".repeat(40);
const encoder = new TextEncoder();

function sha256(character: string): string {
  return character.repeat(64);
}

function externalImplementation(
  overrides: Partial<KerrComparisonExternalImplementation> = {},
): KerrComparisonExternalImplementation {
  return {
    implementationId: "receipt-fixture-kerr-solver",
    displayName: "Receipt Fixture Kerr Solver",
    upstreamRepositoryUrl: "https://github.com/example/receipt-fixture-kerr",
    version: "1.0.0-test",
    vcs: { system: "git", commitAlgorithm: "sha1", commit: "b".repeat(40) },
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

function mapping(overrides: Partial<KerrComparisonMapping> = {}): KerrComparisonMapping {
  return {
    normalizerId: "receipt-fixture-normalizer",
    version: "1.0.0-test",
    vcs: { system: "git", commitAlgorithm: "sha256", commit: "c".repeat(64) },
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
      azimuthRepresentation: "wrapped-[0,2pi)-plus-signed-integer-winding",
    },
    reviewState: "not-run",
    ...KERR_COMPARISON_NO_AUTHORITY,
    ...overrides,
  };
}

function referenceBundle(
  azimuthDegrees = 0,
): VerifiedKerrComparisonReferenceBundle {
  const request = createKerrReferenceTraceRequest({
    frozenAt: requestFrozenAt,
    spin: 0.5,
    camera: {
      observer: "zamo",
      radiusRg: 30,
      inclinationDegrees: 90,
      azimuthDegrees,
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
        caseId: "krcase_receipt-fixture",
        scientificRole: "prograde-spin",
        request,
        report,
      },
    ],
  });
}

function planFor(
  bundle: VerifiedKerrComparisonReferenceBundle,
  implementation = externalImplementation(),
): KerrComparisonPlan {
  return createKerrComparisonPlan({
    referenceBundle: bundle,
    frozenAt: planFrozenAt,
    declaredCodeCommit,
    comparisonScope: "camera-and-solver",
    externalImplementation: implementation,
    mapping: mapping(),
  });
}

const bundle = referenceBundle();
const plan = planFor(bundle);
const blindedInput = createKerrExternalBlindedRunInput({ referenceBundle: bundle, plan });
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

function reviewReceipt(approval: KerrExternalSelectionApproval) {
  return {
    accepted: true as const,
    role: approval.role,
    reviewerId: approval.reviewerId,
    roleGrantId: approval.roleGrantId,
    keyId: approval.keyId,
    subjectSha256: approval.subjectSha256,
    checkedAt: "2026-07-19T21:05:30Z",
    signatureVerified: true as const,
    roleGrantValid: true as const,
    notRevoked: true as const,
  };
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

let nonceSequence = 0;

function nextNonce(): string {
  nonceSequence += 1;
  return nonceSequence.toString(16).padStart(32, "0");
}

async function freshHandoffCycle() {
  const approvals = approvalsFor();
  const selection = await reviewKerrExternalImplementationSelection(
    {
      referenceBundle: bundle,
      plan,
      blindedInput,
      subject,
      approvals,
      reviewedAt: reviewAssembledAt,
    },
    (_reviewSubject, approval) => reviewReceipt(approval),
  );
  const request = createKerrExternalExecutionRequest({
    selection,
    blindedInput,
    requestedAt: "2026-07-19T21:07:00Z",
    expiresAt: "2026-07-19T21:30:00Z",
    attemptNonce: nextNonce(),
    executableSha256: executionProfile.executableSha256,
    executablePath: executionProfile.invocation.executablePath,
    argv: executionProfile.invocation.argv,
    randomSeed: executionProfile.deterministicEnvironment.randomSeed,
    threadCount: executionProfile.deterministicEnvironment.threadCount,
    environmentVariables: executionProfile.deterministicEnvironment.variables,
    ...executionProfile.limits,
  });
  const authorization = await authorizeKerrExternalExecution(
    { selection, request, authorizedAt: "2026-07-19T21:08:00Z" },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  const handoff = await consumeKerrExternalExecutionAuthorization(
    {
      authorization,
      selection,
      blindedInput,
      consumedAt: "2026-07-19T21:09:00Z",
    },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  return { approvals, selection, request, authorization, handoff };
}

async function freshClaimCycle() {
  const cycle = await freshHandoffCycle();
  const claim = await claimKerrExternalRunnerHandoffForImmediateUse(
    { handoff: cycle.handoff, checkedAt: "2026-07-19T21:10:00Z" },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  return { ...cycle, claim };
}

type ClaimCycle = Awaited<ReturnType<typeof freshClaimCycle>>;

function normalizedRows(claim: ClaimedKerrExternalRunnerHandoff) {
  return claim.handoff.blindedInput.cases.flatMap((inputCase) =>
    inputCase.rays.map((ray) => ({
      schemaVersion: "1.0.0",
      state: "normalized-answer-blinded-external-kerr-ray",
      caseOrdinal: inputCase.caseOrdinal,
      rayOrdinal: ray.rayOrdinal,
      pixelIndex: ray.pixelIndex,
      pixelX: ray.pixelX,
      pixelY: ray.pixelY,
      screenX: "screenX" in ray ? ray.screenX : 0,
      screenY: "screenY" in ray ? ray.screenY : 0,
      termination: "indeterminate-limit",
      initialMomentum: {
        pTOverEnergy: -1,
        pROverEnergy: -0.25,
        pThetaOverEnergy: 0,
        pPhiOverEnergy: 0.125,
      },
      constants: {
        xiAngularMomentumOverEnergy: 0.125,
        etaCarterQOverEnergySquared: 0.25,
      },
      endpoint: null,
    })),
  );
}

interface ArtifactOptions {
  readonly rawBytes?: Uint8Array;
  readonly normalizedAt?: string;
  readonly normalizedBytes?: Uint8Array;
  readonly rows?: readonly unknown[];
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly rawCapturedAt?: string;
  readonly receiptGeneratedAt?: string;
  readonly outcome?: Partial<{
    exitCode: number | null;
    terminationSignal: string | null;
    timedOut: boolean;
    outOfMemory: boolean;
    sandboxViolation: boolean;
    networkAccessObserved: boolean;
    outputTruncated: boolean;
    unexpectedWritableArtifacts: boolean;
  }>;
  readonly resourceUsage?: Partial<{
    cpuMilliseconds: number;
    wallMilliseconds: number;
    peakMemoryBytes: number;
    maximumConcurrentProcesses: number;
    writableBytes: number;
    stdoutBytes: number;
    stderrBytes: number;
    outputBytes: number;
  }>;
  readonly stdout?: Partial<{ byteLength: number; sha256: string; truncated: boolean }>;
  readonly stderr?: Partial<{ byteLength: number; sha256: string; truncated: boolean }>;
}

function declarationInput(cycle: ClaimCycle, options: ArtifactOptions = {}) {
  const normalizedAt = options.normalizedAt ?? "2026-07-19T21:11:03.000Z";
  const normalizedOutput = createKerrExternalBlindedNormalizedOutput({
    claimedHandoff: cycle.claim,
    normalizedAt,
    rows: options.rows ?? normalizedRows(cycle.claim),
  });
  const rawOutputBytes = options.rawBytes ?? encoder.encode("isolated-kerr-output\n");
  const normalizedOutputBytes =
    options.normalizedBytes ??
    canonicalKerrExternalBlindedNormalizedOutputBytes(cycle.claim, normalizedOutput);
  const startedAt = options.startedAt ?? "2026-07-19T21:11:00.000Z";
  const completedAt = options.completedAt ?? "2026-07-19T21:11:01.000Z";
  const stdout = {
    byteLength: 0,
    sha256: kerrSha256Hex(new Uint8Array()),
    truncated: false,
    ...options.stdout,
  };
  const stderr = {
    byteLength: 0,
    sha256: kerrSha256Hex(new Uint8Array()),
    truncated: false,
    ...options.stderr,
  };
  return {
    claimedHandoff: cycle.claim,
    startedAt,
    completedAt,
    rawCapturedAt: options.rawCapturedAt ?? "2026-07-19T21:11:02.000Z",
    receiptGeneratedAt: options.receiptGeneratedAt ?? "2026-07-19T21:11:04.000Z",
    outcome: {
      exitCode: 0,
      terminationSignal: null,
      timedOut: false,
      outOfMemory: false,
      sandboxViolation: false,
      networkAccessObserved: false,
      outputTruncated: false,
      unexpectedWritableArtifacts: false,
      ...options.outcome,
    },
    resourceUsage: {
      cpuMilliseconds: 900,
      wallMilliseconds: Date.parse(normalizedAt) - Date.parse(startedAt),
      peakMemoryBytes: 1_048_576,
      maximumConcurrentProcesses: 1,
      writableBytes: 0,
      stdoutBytes: stdout.byteLength,
      stderrBytes: stderr.byteLength,
      outputBytes: rawOutputBytes.byteLength,
      ...options.resourceUsage,
    },
    stdout,
    stderr,
    rawOutputBytes,
    normalizedOutput,
    normalizedOutputBytes,
    runnerId: "runner-receipt-fixture",
    runnerKeyId: "runner-key-receipt-fixture",
    signatureEnvelopeBytes: encoder.encode("detached-runner-signature-envelope\n"),
  };
}

function artifactsFor(cycle: ClaimCycle, options: ArtifactOptions = {}) {
  const input = declarationInput(cycle, options);
  const receipt = createKerrExternalExecutionReceiptDeclaration(input);
  return {
    ...input,
    receipt,
    rawBytes: input.rawOutputBytes,
    normalizedBytes: input.normalizedOutputBytes,
    signatureBytes: input.signatureEnvelopeBytes,
  };
}

type Artifacts = ReturnType<typeof artifactsFor>;

function verifierReceipt(
  verificationSubject: KerrExternalExecutionReceiptVerificationSubject,
  receipt: KerrExternalExecutionReceiptDeclaration,
  overrides: Partial<KerrExternalExecutionReceiptVerifierReceipt> = {},
): KerrExternalExecutionReceiptVerifierReceipt {
  return {
    accepted: true,
    subjectSha256: verificationSubject.subjectChecksum.value,
    receiptId: receipt.receiptId,
    receiptChecksumSha256: receipt.receiptChecksum.value,
    claimId: verificationSubject.claimId,
    runnerId: receipt.runnerAttestation.runnerId,
    runnerKeyId: receipt.runnerAttestation.runnerKeyId,
    runnerGrantId: "runner-grant-receipt-fixture",
    attestationPolicyId: "runner-attestation-policy-v1",
    checkedAt: verificationSubject.verifiedAt,
    signatureVerified: true,
    runnerGrantValid: true,
    runnerKeyValid: true,
    runnerKeyPurposeVerified: true,
    runnerKeyDistinctFromReviewKeys: true,
    audienceAndPurposeVerified: true,
    notRevoked: true,
    attestationPayloadVerified: true,
    claimBindingVerified: true,
    executionProfileBindingVerified: true,
    sandboxEvidenceVerified: true,
    successfulExitVerified: true,
    resourceLimitsVerified: true,
    exactRawOutputBindingVerified: true,
    exactNormalizedOutputBindingVerified: true,
    verifierAssertsEvidenceNotSynthetic: true,
    verifierAssertsEvidenceNotCallerDeclared: true,
    ...overrides,
  };
}

async function verifyArtifacts(
  cycle: ClaimCycle,
  artifacts: Artifacts,
  verifiedAt = "2026-07-19T21:11:05Z",
): Promise<VerifiedKerrExternalExecutionReceipt> {
  return verifyKerrExternalExecutionReceipt(
    {
      claimedHandoff: cycle.claim,
      receipt: artifacts.receipt,
      rawOutputBytes: artifacts.rawBytes,
      normalizedOutput: artifacts.normalizedOutput,
      normalizedOutputBytes: artifacts.normalizedBytes,
      signatureEnvelopeBytes: artifacts.signatureBytes,
      verifiedAt,
    },
    (verificationSubject, receipt) => verifierReceipt(verificationSubject, receipt),
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
}

async function freshAdmissionFixture(options: ArtifactOptions = {}) {
  const cycle = await freshClaimCycle();
  const artifacts = artifactsFor(cycle, options);
  const verified = await verifyArtifacts(cycle, artifacts);
  const admission = await admitVerifiedKerrExternalOutput(
    {
      referenceBundle: bundle,
      plan,
      verifiedExecutionReceipt: verified,
      admittedAt: "2026-07-19T21:11:06Z",
    },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  return { cycle, artifacts, verified, admission };
}

type AdmissionFixture = Awaited<ReturnType<typeof freshAdmissionFixture>>;

const mappingSubjectFrozenAt = "2026-07-19T21:11:07Z";
const mappingDecisionDecidedAt = "2026-07-19T21:11:08Z";
const mappingDecisionExpiresAt = "2026-07-19T21:29:00Z";
const mappingPreparedAt = "2026-07-19T21:11:09Z";
const comparisonConsumedAt = "2026-07-19T21:11:10Z";
const scientificReviewFrozenAt = "2026-07-19T22:01:00Z";
const scientificReviewDecidedAt = "2026-07-19T22:02:00Z";
const scientificReviewRecordedAt = "2026-07-19T22:03:00Z";
const scientificReviewExpiresAt = "2026-07-20T22:02:00Z";

const mappingEvidenceBindings = {
  normalizerSourceReviewReportSha256: sha256("1"),
  mappingTestVectorReportSha256: sha256("2"),
  mappingReviewerNotesSha256: sha256("3"),
} as const;

const mappingSemanticAssertions = {
  deterministicFullRowTranslationReviewed: true,
  noFilteringOmissionDuplicationOrReorderingReviewed: true,
  noReferenceAnswerOrToleranceDependentAdjustmentReviewed: true,
  unitsCoordinatesAndOrientationReviewed: true,
  momentumEnergyAndAngularMomentumSemanticsReviewed: true,
  carterQNotKSemanticsReviewed: true,
  screenBasisAndRayDirectionReviewed: true,
  terminationAndEventSurfaceReviewed: true,
  azimuthWrappingAndWindingReviewed: true,
  endpointTimeAndAffineParameterReviewed: true,
  unresolvedAndNullOutcomeReviewed: true,
  integratorInputPreservationReviewed: true,
  cameraAndSolverOutputPreservationReviewed: true,
  reviewerDeclaresNoReferenceOutcomesTolerancesOrComparisonResults: true,
  normalizerSourceFrozenBeforeExecutionReviewed: true,
  allMappingTransformationsDisclosedReviewed: true,
} as const;

function mappingSignatureBytes(): Uint8Array {
  return encoder.encode("detached-mapping-review-signature-envelope\n");
}

function mappingSubjectFor(
  fixture: AdmissionFixture,
  frozenAt = mappingSubjectFrozenAt,
): KerrExternalMappingReviewSubject {
  return createKerrExternalMappingReviewSubject({
    admission: fixture.admission,
    referenceBundle: bundle,
    plan,
    frozenAt,
  });
}

interface MappingDecisionOptions {
  readonly reviewerId?: string;
  readonly roleGrantId?: string;
  readonly keyId?: string;
  readonly decidedAt?: string;
  readonly expiresAt?: string;
  readonly evidenceBindings?: unknown;
  readonly semanticAssertions?: unknown;
  readonly signatureEnvelopeBytes?: Uint8Array;
}

function mappingDecisionFor(
  subject: KerrExternalMappingReviewSubject,
  options: MappingDecisionOptions = {},
) {
  const signatureEnvelopeBytes =
    options.signatureEnvelopeBytes ?? mappingSignatureBytes();
  const statement = createKerrExternalMappingReviewDecisionStatement({
    subject,
    reviewerId: options.reviewerId ?? "reviewer-mapping",
    roleGrantId: options.roleGrantId ?? "grant-mapping",
    keyId: options.keyId ?? "key-mapping",
    decidedAt: options.decidedAt ?? mappingDecisionDecidedAt,
    expiresAt: options.expiresAt ?? mappingDecisionExpiresAt,
    evidenceBindings: options.evidenceBindings ?? mappingEvidenceBindings,
    semanticAssertions: options.semanticAssertions ?? mappingSemanticAssertions,
  });
  const decision = createKerrExternalMappingReviewDecision({
    statement,
    signatureEnvelopeBytes,
  });
  return { statement, decision, signatureEnvelopeBytes };
}

function mappingVerifierReceipt(
  subject: KerrExternalMappingReviewSubject,
  decision: KerrExternalMappingReviewDecision,
  signatureEnvelopeBytes: Uint8Array,
  checkedAt = mappingPreparedAt,
  overrides: Partial<KerrExternalMappingReviewVerifierReceipt> = {},
): KerrExternalMappingReviewVerifierReceipt {
  return {
    accepted: true,
    verificationPolicyId: "mapping-review-verification-policy-v1",
    subjectId: subject.subjectId,
    subjectChecksumSha256: subject.subjectChecksum.value,
    subjectCanonicalSha256: kerrExternalMappingReviewSubjectSha256(subject),
    decisionId: decision.decisionId,
    decisionChecksumSha256: decision.decisionChecksum.value,
    statementId: decision.statement.statementId,
    statementChecksumSha256: decision.statement.statementChecksum.value,
    signedStatementSha256: decision.signedStatementSha256,
    signatureEnvelopeSha256: kerrSha256Hex(signatureEnvelopeBytes),
    signatureEnvelopeByteLength: signatureEnvelopeBytes.byteLength,
    role: "mapping-semantics",
    reviewerId: decision.statement.reviewerId,
    roleGrantId: decision.statement.roleGrantId,
    reviewerKeyId: decision.statement.keyId,
    checkedAt,
    reviewerSignatureVerified: true,
    reviewerRoleGrantValid: true,
    reviewerKeyValid: true,
    reviewerKeyPurposeVerified: true,
    notRevoked: true,
    decisionPurposeVerified: true,
    exactSubjectBindingVerified: true,
    exactAdmissionBindingVerified: true,
    frozenMappingBindingVerified: true,
    normalizerSourceDigestBindingVerified: true,
    exactOutputBindingVerified: true,
    orderedRowAssociationBindingVerified: true,
    reviewEvidenceDigestBindingsAcceptedByInjectedVerifier: true,
    signedSemanticAssertionsVerified: true,
    reviewerAnswerBlindingPolicyVerified: true,
    reviewerIdDistinctFromRunnerAndSelectionReviewers: true,
    roleGrantIdDistinctFromRunnerAndSelectionReviewGrants: true,
    reviewerKeyIdDistinctFromRunnerAndSelectionReviewKeys: true,
    verifierAssertsReviewNotSynthetic: true,
    verifierAssertsReviewNotCallerDeclared: true,
    ...overrides,
  };
}

function comparisonPreparationInput(
  fixture: AdmissionFixture,
  subject: KerrExternalMappingReviewSubject,
  decision: KerrExternalMappingReviewDecision,
  signatureEnvelopeBytes: Uint8Array,
  preparedAt = mappingPreparedAt,
) {
  return {
    admission: fixture.admission,
    referenceBundle: bundle,
    plan,
    subject,
    decision,
    rawOutputBytes: fixture.artifacts.rawBytes,
    normalizedOutputBytes: fixture.artifacts.normalizedBytes,
    signatureEnvelopeBytes,
    preparedAt,
  };
}

function referenceMatchedNormalizedRows(
  claim: ClaimedKerrExternalRunnerHandoff,
  comparisonPlan: KerrComparisonPlan,
): Array<Record<string, unknown>> {
  const referenceRows = comparisonPlan.cases.flatMap((planCase) =>
    planCase.rays.map((referenceRay) => referenceRay),
  );
  const rows = normalizedRows(claim);
  assert.equal(rows.length, referenceRows.length);
  return rows.map((row, index) => {
    const reference = referenceRows[index]!;
    return {
      ...row,
      screenX: reference.screenX,
      screenY: reference.screenY,
      termination: reference.referenceOutcome.termination,
      initialMomentum: { ...reference.initialMomentum },
      constants: { ...reference.constants },
      endpoint: {
        eventSurface: reference.referenceOutcome.eventSurface,
        ...reference.referenceOutcome.endpoint,
        momentum: { ...reference.referenceOutcome.endpoint.momentum },
      },
    };
  });
}

interface PreparedComparisonFixtureOptions {
  readonly referenceBundle?: VerifiedKerrComparisonReferenceBundle;
  readonly comparisonPlan?: KerrComparisonPlan;
  readonly mutateRows?: (
    rows: Array<Record<string, unknown>>,
    comparisonPlan: KerrComparisonPlan,
  ) => void;
}

async function freshPreparedComparisonFixture(
  options: PreparedComparisonFixtureOptions = {},
) {
  const referenceBundleInput = options.referenceBundle ?? bundle;
  const comparisonPlan = options.comparisonPlan ?? plan;
  const blindedRunInput = createKerrExternalBlindedRunInput({
    referenceBundle: referenceBundleInput,
    plan: comparisonPlan,
  });
  const selectionSubject = createKerrExternalSelectionReviewSubject({
    referenceBundle: referenceBundleInput,
    plan: comparisonPlan,
    blindedInput: blindedRunInput,
    subjectFrozenAt: "2026-07-19T21:02:30Z",
    evidenceBindings,
    executionProfile,
  });
  const approvals = approvalsFor(selectionSubject);
  const selection = await reviewKerrExternalImplementationSelection(
    {
      referenceBundle: referenceBundleInput,
      plan: comparisonPlan,
      blindedInput: blindedRunInput,
      subject: selectionSubject,
      approvals,
      reviewedAt: reviewAssembledAt,
    },
    (_reviewSubject, approval) => reviewReceipt(approval),
  );
  const request = createKerrExternalExecutionRequest({
    selection,
    blindedInput: blindedRunInput,
    requestedAt: "2026-07-19T21:07:00Z",
    expiresAt: "2026-07-19T21:30:00Z",
    attemptNonce: nextNonce(),
    executableSha256: executionProfile.executableSha256,
    executablePath: executionProfile.invocation.executablePath,
    argv: executionProfile.invocation.argv,
    randomSeed: executionProfile.deterministicEnvironment.randomSeed,
    threadCount: executionProfile.deterministicEnvironment.threadCount,
    environmentVariables: executionProfile.deterministicEnvironment.variables,
    ...executionProfile.limits,
  });
  const authorization = await authorizeKerrExternalExecution(
    { selection, request, authorizedAt: "2026-07-19T21:08:00Z" },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  const handoff = await consumeKerrExternalExecutionAuthorization(
    {
      authorization,
      selection,
      blindedInput: blindedRunInput,
      consumedAt: "2026-07-19T21:09:00Z",
    },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  const claim = await claimKerrExternalRunnerHandoffForImmediateUse(
    { handoff, checkedAt: "2026-07-19T21:10:00Z" },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  const cycle = {
    approvals,
    selection,
    request,
    authorization,
    handoff,
    claim,
  };
  const rows = referenceMatchedNormalizedRows(claim, comparisonPlan);
  options.mutateRows?.(rows, comparisonPlan);
  const artifacts = artifactsFor(cycle, { rows });
  const verified = await verifyArtifacts(cycle, artifacts);
  const admission = await admitVerifiedKerrExternalOutput(
    {
      referenceBundle: referenceBundleInput,
      plan: comparisonPlan,
      verifiedExecutionReceipt: verified,
      admittedAt: "2026-07-19T21:11:06Z",
    },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  const admissionFixture: AdmissionFixture = {
    cycle,
    artifacts,
    verified,
    admission,
  };
  const reviewSubject = createKerrExternalMappingReviewSubject({
    admission,
    referenceBundle: referenceBundleInput,
    plan: comparisonPlan,
    frozenAt: mappingSubjectFrozenAt,
  });
  const { decision, signatureEnvelopeBytes } =
    mappingDecisionFor(reviewSubject);
  let verifierReceiptValue: KerrExternalMappingReviewVerifierReceipt | undefined;
  const preparation = await prepareVerifiedKerrExternalOutputForComparisonReview(
    {
      admission,
      referenceBundle: referenceBundleInput,
      plan: comparisonPlan,
      subject: reviewSubject,
      decision,
      rawOutputBytes: artifacts.rawBytes,
      normalizedOutputBytes: artifacts.normalizedBytes,
      signatureEnvelopeBytes,
      preparedAt: mappingPreparedAt,
    },
    (receivedSubject, receivedDecision, receivedSignatureBytes) => {
      verifierReceiptValue = mappingVerifierReceipt(
        receivedSubject,
        receivedDecision,
        receivedSignatureBytes,
      );
      return verifierReceiptValue;
    },
  );
  assert.ok(verifierReceiptValue);
  return {
    referenceBundle: referenceBundleInput,
    plan: comparisonPlan,
    blindedInput: blindedRunInput,
    selectionSubject,
    admissionFixture,
    cycle,
    artifacts,
    verified,
    admission,
    reviewSubject,
    decision,
    signatureEnvelopeBytes,
    verifierReceipt: verifierReceiptValue,
    preparation,
  };
}

type PreparedComparisonFixture = Awaited<
  ReturnType<typeof freshPreparedComparisonFixture>
>;

function legacyOracleForPreparedFixture(
  fixture: PreparedComparisonFixture,
) {
  const planRows = fixture.plan.cases.flatMap((planCase) =>
    planCase.rays.map((referenceRay) => ({ planCase, referenceRay })),
  );
  const rows = fixture.artifacts.normalizedOutput.rows.map(
    (sourceRow, index) => {
      const expected = planRows[index]!;
      return {
        schemaVersion: "1.0.0",
        state: "normalized-unreviewed-declared-external-kerr-ray",
        planId: fixture.plan.planId,
        planChecksum: fixture.plan.planChecksum,
        caseId: expected.planCase.caseId,
        scientificRole: expected.planCase.scientificRole,
        requestId: expected.planCase.request.requestId,
        requestChecksum: expected.planCase.request.requestChecksum,
        referenceReportId: expected.planCase.report.reportId,
        referenceReportChecksum: expected.planCase.report.reportChecksum,
        referenceRayId: expected.referenceRay.rayId,
        referenceRayChecksum: expected.referenceRay.rayChecksum,
        pixelIndex: sourceRow.pixelIndex,
        pixelX: sourceRow.pixelX,
        pixelY: sourceRow.pixelY,
        screenX: sourceRow.screenX,
        screenY: sourceRow.screenY,
        termination: sourceRow.termination,
        initialMomentum: sourceRow.initialMomentum,
        constants: sourceRow.constants,
        endpoint: sourceRow.endpoint,
        mappingReview: "not-run",
        sourceExecutionReview: "not-run",
        independentReference: "not-run",
        ...KERR_EXTERNAL_OUTPUT_NO_AUTHORITY,
      };
    },
  );
  const normalizedOutput = createKerrExternalNormalizedOutput({
    referenceBundle: fixture.referenceBundle,
    plan: fixture.plan,
    generatedAt: "2026-07-19T21:11:04Z",
    externalRun: {
      evidenceClass: "synthetic-test-fixture",
      startedAt: "2026-07-19T21:11:00Z",
      completedAt: "2026-07-19T21:11:01Z",
      rawCapturedAt: "2026-07-19T21:11:02Z",
      provenance: "caller-declared-unverified",
      runnerSuppliedByPackage: false,
      executionVerified: false,
    },
    rows,
  });
  const rawBytes = encoder.encode("legacy-oracle-for-receipt-bound-candidate\n");
  const normalizedBytes =
    canonicalKerrExternalNormalizedOutputBytes(normalizedOutput);
  const candidate = createKerrExternalOutputCandidate({
    referenceBundle: fixture.referenceBundle,
    plan: fixture.plan,
    rawBytes,
    normalizedBytes,
    normalizedOutput,
  });
  return compareKerrReferenceToExternalCandidate({
    referenceBundle: fixture.referenceBundle,
    plan: fixture.plan,
    candidate,
    candidateRawBytes: rawBytes,
    candidateNormalizedBytes: normalizedBytes,
    generatedAt: comparisonConsumedAt,
  });
}

function numericRowProjection(
  rows: readonly {
    readonly referenceTermination: unknown;
    readonly candidateTermination: unknown;
    readonly seedComparison: unknown;
    readonly endpointComparison: unknown;
    readonly disposition: unknown;
    readonly reasons: readonly unknown[];
  }[],
) {
  return rows.map((row) => ({
    referenceTermination: row.referenceTermination,
    candidateTermination: row.candidateTermination,
    seedComparison: row.seedComparison,
    endpointComparison: row.endpointComparison,
    disposition: row.disposition,
    reasons: row.reasons,
  }));
}

function commonNumericSummaryProjection(summary: {
  readonly rowCount: unknown;
  readonly dispositionCounts: unknown;
  readonly comparableEndpointCount: unknown;
  readonly maxSeedMomentumOverEnergyAbsoluteDelta: unknown;
  readonly maxXiAbsoluteDelta: unknown;
  readonly maxEtaAbsoluteDelta: unknown;
  readonly maxEndpointSphereChord: unknown;
  readonly rmsEndpointSphereChord: unknown;
  readonly maxEventRadiusAbsoluteDeltaRg: unknown;
  readonly maxEndpointMomentumOverEnergyAbsoluteDelta: unknown;
  readonly numericAgreement: unknown;
}) {
  return {
    rowCount: summary.rowCount,
    dispositionCounts: summary.dispositionCounts,
    comparableEndpointCount: summary.comparableEndpointCount,
    maxSeedMomentumOverEnergyAbsoluteDelta:
      summary.maxSeedMomentumOverEnergyAbsoluteDelta,
    maxXiAbsoluteDelta: summary.maxXiAbsoluteDelta,
    maxEtaAbsoluteDelta: summary.maxEtaAbsoluteDelta,
    maxEndpointSphereChord: summary.maxEndpointSphereChord,
    rmsEndpointSphereChord: summary.rmsEndpointSphereChord,
    maxEventRadiusAbsoluteDeltaRg:
      summary.maxEventRadiusAbsoluteDeltaRg,
    maxEndpointMomentumOverEnergyAbsoluteDelta:
      summary.maxEndpointMomentumOverEnergyAbsoluteDelta,
    numericAgreement: summary.numericAgreement,
  };
}

type ScientificReviewRole =
  (typeof KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES)[number];

const scientificReviewAssertions = {
  exactComparisonArtifactReviewed: true,
  everyComparisonRowReviewedInExactOrder: true,
  exactSummaryAndTolerancesReviewed: true,
  disagreementAndInconclusiveFindingsRetained: true,
  noPostRunToleranceChangeApplied: true,
  noDisagreementWaiverApplied: true,
  cameraScreenToleranceLimitationAcknowledged: true,
  coordinateTimeAndAffineDeltasAreDiagnosticOnlyAcknowledged: true,
  sameProjectReferenceIsNotIndependentValidationAcknowledged: true,
  upstreamInjectedVerifierEvidenceIsNotPackageAuthenticatedAcknowledged: true,
  checksumsDoNotAuthenticateEvidenceAcknowledged: true,
  reviewerIdentitySeparationIsNotImplementationIndependenceAcknowledged: true,
  reviewerDeclaresNoParticipationInEitherSolverOrMapping: true,
  opinionGrantsNoScientificRenderOrReleaseAuthority: true,
} as const;

function scientificReviewEvidenceBindings(role: ScientificReviewRole) {
  const digests =
    role === "relativistic-physics"
      ? ["1", "2", "3", "4", "5", "6"]
      : ["7", "8", "9", "a", "b", "c"];
  return {
    scientificAssessmentSha256: sha256(digests[0]!),
    numericalMethodsAssessmentSha256: sha256(digests[1]!),
    toleranceAndCaseCoverageAssessmentSha256: sha256(digests[2]!),
    qualificationEvidenceSha256: sha256(digests[3]!),
    conflictDisclosureSha256: sha256(digests[4]!),
    reviewerNotesSha256: sha256(digests[5]!),
  };
}

function scientificReviewerIdentity(role: ScientificReviewRole) {
  const suffix =
    role === "relativistic-physics" ? "relativistic" : "numerical";
  return {
    reviewerId: `reviewer-${suffix}`,
    roleGrantId: `grant-${suffix}`,
    keyId: `key-${suffix}`,
  };
}

function scientificReviewSignatureBytes(role: ScientificReviewRole) {
  return encoder.encode(`detached-${role}-scientific-review-signature\n`);
}

interface ScientificReviewDecisionOptions {
  readonly decidedAt?: string;
  readonly expiresAt?: string;
  readonly opinion?: KerrExternalScientificReviewOpinion;
  readonly evidenceBindings?: unknown;
  readonly reviewAssertions?: unknown;
  readonly signatureEnvelopeBytes?: Uint8Array;
}

function scientificReviewDecisionFor(
  subject: KerrExternalScientificReviewSubject,
  role: ScientificReviewRole,
  options: ScientificReviewDecisionOptions = {},
) {
  const signatureEnvelopeBytes =
    options.signatureEnvelopeBytes ?? scientificReviewSignatureBytes(role);
  const statement = createKerrExternalScientificReviewDecisionStatement({
    subject,
    role,
    decidedAt: options.decidedAt ?? scientificReviewDecidedAt,
    expiresAt: options.expiresAt ?? scientificReviewExpiresAt,
    opinion:
      options.opinion ??
      "supports-provisional-bounded-vacuum-metric-agreement",
    evidenceBindings:
      options.evidenceBindings ?? scientificReviewEvidenceBindings(role),
    reviewAssertions: options.reviewAssertions ?? scientificReviewAssertions,
  });
  const decision = createKerrExternalScientificReviewDecision({
    statement,
    signatureEnvelopeBytes,
  });
  return { statement, decision, signatureEnvelopeBytes };
}

function scientificReviewerAssignments(
  overrides: Partial<
    Record<
      ScientificReviewRole,
      Partial<Omit<KerrExternalScientificReviewerAssignment, "role">>
    >
  > = {},
): KerrExternalScientificReviewerAssignment[] {
  return KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES.map((role) => ({
    role,
    ...scientificReviewerIdentity(role),
    ...overrides[role],
  }));
}

function scientificReviewVerifierReceipt(
  comparison: ReceiptBoundKerrExternalNumericComparison,
  subject: KerrExternalScientificReviewSubject,
  decision: KerrExternalScientificReviewDecision,
  signatureEnvelopeBytes: Uint8Array,
  checkedAt = scientificReviewRecordedAt,
  overrides: Partial<KerrExternalScientificReviewVerifierReceipt> = {},
): KerrExternalScientificReviewVerifierReceipt {
  const statement = decision.statement;
  return {
    schemaVersion: "1.0.0",
    state:
      "kerr-external-scientific-review-opinion-accepted-by-injected-verifier",
    accepted: true,
    verificationPolicyId: "scientific-review-verification-policy-v1",
    subjectId: subject.subjectId,
    subjectChecksumSha256: subject.subjectChecksum.value,
    subjectCanonicalSha256: kerrExternalScientificReviewSubjectSha256(subject),
    comparisonId: comparison.comparisonId,
    comparisonChecksumSha256: comparison.comparisonChecksum.value,
    comparisonCanonicalSha256:
      subject.comparisonBinding.comparisonCanonicalSha256,
    decisionId: decision.decisionId,
    decisionChecksumSha256: decision.decisionChecksum.value,
    statementId: statement.statementId,
    statementChecksumSha256: statement.statementChecksum.value,
    signedStatementSha256: decision.signedStatementSha256,
    signatureEnvelopeSha256: kerrSha256Hex(signatureEnvelopeBytes),
    signatureEnvelopeByteLength: signatureEnvelopeBytes.byteLength,
    role: statement.role,
    reviewerId: statement.reviewerId,
    roleGrantId: statement.roleGrantId,
    reviewerKeyId: statement.keyId,
    checkedAt,
    reviewerSignatureVerified: true,
    reviewerRoleGrantValid: true,
    reviewerKeyValid: true,
    reviewerKeyPurposeVerified: true,
    reviewerRoleGrantNotRevoked: true,
    reviewerKeyNotRevoked: true,
    decisionPurposeVerified: true,
    exactSubjectBindingVerified: true,
    exactComparisonBindingVerified: true,
    exactOrderedRowsAndSummaryBindingVerified: true,
    evidenceDigestBindingsVerified: true,
    signedReviewAssertionsVerified: true,
    reviewerIdentitySeparationVerified: true,
    verifierAssertsReviewNotCallerDeclared: true,
    verifierAssertsNoScientificAuthorityGranted: true,
    verifierAuthorityAuthenticatedByPackage: false,
    scientificValidationPassed: false,
    independentValidationPassed: false,
    renderAllowed: false,
    releaseEligible: false,
    ...overrides,
  };
}

async function freshScientificReviewComparison(
  options: PreparedComparisonFixtureOptions = {},
) {
  const fixture = await freshPreparedComparisonFixture(options);
  const comparison = consumePreparedKerrExternalComparisonReview({
    preparation: fixture.preparation,
    comparedAt: comparisonConsumedAt,
  });
  return { ...fixture, comparison };
}

async function freshScientificReviewSubject(
  options: PreparedComparisonFixtureOptions = {},
  reviewerAssignments = scientificReviewerAssignments(),
) {
  const fixture = await freshScientificReviewComparison(options);
  const subject = createKerrExternalScientificReviewSubject({
    comparison: fixture.comparison,
    frozenAt: scientificReviewFrozenAt,
    reviewerAssignments,
  });
  return { ...fixture, subject };
}

type ScientificReviewFixture = Awaited<
  ReturnType<typeof freshScientificReviewSubject>
>;

function scientificReviewEntries(
  subject: KerrExternalScientificReviewSubject,
  opinions: readonly [
    KerrExternalScientificReviewOpinion,
    KerrExternalScientificReviewOpinion,
  ] = [
    "supports-provisional-bounded-vacuum-metric-agreement",
    "supports-provisional-bounded-vacuum-metric-agreement",
  ],
) {
  return KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES.map((role, index) =>
    scientificReviewDecisionFor(subject, role, {
      opinion: opinions[index],
    }),
  );
}

function scientificReviewRecordInput(
  fixture: ScientificReviewFixture,
  entries: readonly ReturnType<typeof scientificReviewDecisionFor>[],
  recordedAt = scientificReviewRecordedAt,
) {
  return {
    comparison: fixture.comparison,
    subject: fixture.subject,
    reviews: entries.map(({ decision, signatureEnvelopeBytes }) => ({
      decision,
      signatureEnvelopeBytes,
    })),
    recordedAt,
  };
}

function verifyScientificReviewFixture(
  comparison: ReceiptBoundKerrExternalNumericComparison,
  subject: KerrExternalScientificReviewSubject,
  decision: KerrExternalScientificReviewDecision,
  signatureEnvelopeBytes: Uint8Array,
  checkedAt: string,
) {
  return scientificReviewVerifierReceipt(
    comparison,
    subject,
    decision,
    signatureEnvelopeBytes,
    checkedAt,
  );
}

function expectedPreparedCandidate(
  fixture: AdmissionFixture,
  subject: KerrExternalMappingReviewSubject,
  decision: KerrExternalMappingReviewDecision,
  verifierReceiptValue: KerrExternalMappingReviewVerifierReceipt,
) {
  const planRows = plan.cases.flatMap((planCase, caseOrdinal) =>
    planCase.rays.map((referenceRay, rayOrdinal) => ({
      planCase,
      referenceRay,
      caseOrdinal,
      rayOrdinal,
    })),
  );
  const rows = fixture.artifacts.normalizedOutput.rows.map((sourceRow, index) => {
    const expected = planRows[index]!;
    const admitted = fixture.admission.rows[index]!;
    const unsigned = {
      schemaVersion: "1.0.0" as const,
      state:
        "receipt-bound-kerr-external-row-prepared-for-comparison-review" as const,
      planId: plan.planId,
      planChecksumSha256: plan.planChecksum.value,
      admissionId: fixture.admission.admissionId,
      mappingReviewDecisionId: decision.decisionId,
      caseOrdinal: sourceRow.caseOrdinal,
      rayOrdinal: sourceRow.rayOrdinal,
      sourceBlindedRowId: sourceRow.rowId,
      sourceBlindedRowChecksumSha256: sourceRow.rowChecksum.value,
      caseId: admitted.caseId,
      scientificRole: expected.planCase.scientificRole,
      requestId: admitted.requestId,
      requestChecksum: admitted.requestChecksum,
      referenceReportId: admitted.referenceReportId,
      referenceReportChecksum: admitted.referenceReportChecksum,
      planReferenceRayId: admitted.referenceRayId,
      planReferenceRayChecksum: admitted.referenceRayChecksum,
      pixelIndex: sourceRow.pixelIndex,
      pixelX: sourceRow.pixelX,
      pixelY: sourceRow.pixelY,
      screenX: sourceRow.screenX,
      screenY: sourceRow.screenY,
      termination: sourceRow.termination,
      initialMomentum: sourceRow.initialMomentum,
      constants: sourceRow.constants,
      endpoint: sourceRow.endpoint,
      mappingReviewDecisionAcceptedByInjectedBoundary: true as const,
      injectedMappingVerifierAuthorityAuthenticatedByPackage: false as const,
      sourceExecutionEvidenceStatus:
        "injected-runner-verifier-asserted-not-package-authenticated" as const,
      referenceOutcomesIncluded: false as const,
      referenceTolerancesIncluded: false as const,
      comparisonResultsIncluded: false as const,
      comparisonExecuted: false as const,
      independentReference: "not-run" as const,
      ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
      ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
    };
    const rowId = `krrbcrow_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
    return {
      ...unsigned,
      rowId,
      rowChecksum: {
        algorithm: "sha256" as const,
        value: kerrSha256Hex(kerrStableStringify({ ...unsigned, rowId })),
        scope: "receipt-bound-kerr-comparison-review-prepared-row" as const,
      },
    };
  });
  const mappingReviewBinding = {
    subjectId: subject.subjectId,
    subjectChecksumSha256: subject.subjectChecksum.value,
    subjectCanonicalSha256: kerrExternalMappingReviewSubjectSha256(subject),
    decisionId: decision.decisionId,
    decisionChecksumSha256: decision.decisionChecksum.value,
    statementId: decision.statement.statementId,
    signedStatementSha256: decision.signedStatementSha256,
    reviewerId: decision.statement.reviewerId,
    roleGrantId: decision.statement.roleGrantId,
    reviewerKeyId: decision.statement.keyId,
    injectedVerificationPolicyId: verifierReceiptValue.verificationPolicyId,
    injectedVerifierReceiptCanonicalSha256: kerrSha256Hex(
      kerrStableStringify(verifierReceiptValue),
    ),
  };
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state:
      "receipt-bound-kerr-external-candidate-prepared-for-future-comparison-review" as const,
    policyVersion: KERR_EXTERNAL_MAPPING_REVIEW_POLICY_VERSION,
    preparedAt: mappingPreparedAt,
    admissionBinding: subject.admissionBinding,
    planBinding: subject.planBinding,
    externalImplementation: plan.externalImplementation,
    mapping: plan.mapping,
    mappingReviewBinding,
    admittedOutputBinding: fixture.admission.outputBinding,
    rows,
    rowCoverage:
      "exactly-one-receipt-bound-prepared-row-per-plan-ray-in-plan-order" as const,
    admittedNormalizedOutputBytesArePreparedCandidateBytes: false as const,
    mappingReviewDecisionAcceptedByInjectedBoundary: true as const,
    injectedMappingVerifierAuthorityAuthenticatedByPackage: false as const,
    candidateRowAssociationReconstructedAndCheckedInProcess: true as const,
    referenceOutcomesIncluded: false as const,
    referenceTolerancesIncluded: false as const,
    comparisonResultsIncluded: false as const,
    comparisonExecuted: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
  const candidateId = `krrbccand_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const candidate = {
    ...unsigned,
    candidateId,
    candidateChecksum: {
      algorithm: "sha256" as const,
      value: kerrSha256Hex(kerrStableStringify({ ...unsigned, candidateId })),
      scope: "receipt-bound-kerr-comparison-review-prepared-candidate" as const,
    },
  };
  return {
    candidate,
    canonicalBytes: encoder.encode(kerrStableStringify(candidate)),
  };
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

function mutableRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  return value as Record<string, unknown>;
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

function assertNoScientificAuthority(value: unknown): void {
  const record = mutableRecord(value);
  for (const key of Object.keys(KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY)) {
    assert.equal(record[key], false, `${key} must remain false`);
  }
}

function assertNoAuthority(value: unknown): void {
  assertNoScientificAuthority(value);
  const record = mutableRecord(value);
  for (const key of Object.keys(KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION)) {
    assert.equal(record[key], false, `${key} must remain false`);
  }
}

test("answer-blinded normalized output is deterministic, canonical, and excludes reference answers", async () => {
  const cycle = await freshClaimCycle();
  const rows = normalizedRows(cycle.claim);
  const first = createKerrExternalBlindedNormalizedOutput({
    claimedHandoff: cycle.claim,
    normalizedAt: "2026-07-19T21:11:03.000Z",
    rows,
  });
  const second = createKerrExternalBlindedNormalizedOutput({
    claimedHandoff: cycle.claim,
    normalizedAt: "2026-07-19T21:11:03.000Z",
    rows: structuredClone(rows),
  });
  const runnerCreated = createKerrExternalBlindedNormalizedOutputForRunner({
    handoff: cycle.claim.handoff,
    normalizedAt: "2026-07-19T21:11:03.000Z",
    rows: structuredClone(rows),
  });

  assert.deepEqual(second, first);
  assert.deepEqual(runnerCreated, first);
  assert.deepEqual(KerrExternalBlindedNormalizedOutputSchema.parse(first), first);
  assert.doesNotThrow(() =>
    assertKerrExternalBlindedNormalizedOutputIntegrity(cycle.claim, first),
  );
  assert.doesNotThrow(() =>
    assertKerrExternalBlindedNormalizedOutputForRunnerIntegrity(
      cycle.claim.handoff,
      runnerCreated,
    ),
  );
  assert.deepEqual(
    canonicalKerrExternalBlindedNormalizedOutputBytes(cycle.claim, second),
    canonicalKerrExternalBlindedNormalizedOutputBytes(cycle.claim, first),
  );
  assert.deepEqual(
    canonicalKerrExternalBlindedNormalizedOutputBytesForRunner(
      cycle.claim.handoff,
      runnerCreated,
    ),
    canonicalKerrExternalBlindedNormalizedOutputBytes(cycle.claim, first),
  );
  assertDeepFrozen(first);
  assertNoAuthority(first);

  const keys = recursivelyCollectedKeys(first);
  for (const forbidden of [
    "planId",
    "planChecksum",
    "caseId",
    "scientificRole",
    "requestId",
    "requestChecksum",
    "referenceReportId",
    "referenceReportChecksum",
    "referenceRayId",
    "referenceRayChecksum",
    "referenceOutcome",
    "tolerances",
    "comparisonResult",
  ]) {
    assert.equal(keys.has(forbidden), false, `${forbidden} leaked into blinded output`);
  }
  assert.equal(first.answerBearingFieldsIncluded, false);
  assert.equal(first.referenceIdentifiersIncluded, false);
  assert.equal(first.referenceOutcomesIncluded, false);
  assert.equal(first.referenceChecksumsIncluded, false);
  assert.equal(first.tolerancesIncluded, false);
  assert.equal(first.comparisonResultsIncluded, false);
});

test("clean receipt binds the exact claim, execution profile, verifier, grants, bytes, and plan admission", async () => {
  const cycle = await freshClaimCycle();
  const artifacts = artifactsFor(cycle);

  assert.deepEqual(
    KerrExternalExecutionReceiptDeclarationSchema.parse(artifacts.receipt),
    artifacts.receipt,
  );
  assert.doesNotThrow(() =>
    assertKerrExternalExecutionReceiptDeclarationIntegrity(
      cycle.claim,
      artifacts.receipt,
      artifacts.rawBytes,
      artifacts.normalizedOutput,
      artifacts.normalizedBytes,
      artifacts.signatureBytes,
    ),
  );
  assert.deepEqual(artifacts.receipt.claimBinding, {
    claimId: cycle.claim.claimId,
    claimChecksumSha256: cycle.claim.claimChecksum.value,
    claimedAt: cycle.claim.claimedAt,
    expiresAt: cycle.claim.expiresAt,
    authorizationId: cycle.authorization.authorizationId,
  });
  assert.deepEqual(artifacts.receipt.selectionBinding, cycle.claim.selectionBinding);
  assert.deepEqual(artifacts.receipt.requestBinding, cycle.claim.requestBinding);
  assert.deepEqual(
    artifacts.receipt.executionBinding.artifactBindings,
    cycle.claim.handoff.artifactBindings,
  );
  assert.deepEqual(
    artifacts.receipt.executionBinding.invocation,
    cycle.claim.handoff.invocation,
  );
  assert.deepEqual(
    artifacts.receipt.executionBinding.deterministicEnvironment,
    cycle.claim.handoff.deterministicEnvironment,
  );
  assert.deepEqual(artifacts.receipt.executionBinding.sandbox, cycle.claim.handoff.sandbox);
  assert.deepEqual(artifacts.receipt.executionBinding.limits, cycle.claim.handoff.limits);
  assert.equal(artifacts.receipt.rawOutput.sha256, kerrSha256Hex(artifacts.rawBytes));
  assert.equal(
    artifacts.receipt.normalizedOutput.sha256,
    kerrSha256Hex(artifacts.normalizedBytes),
  );
  assert.equal(artifacts.receipt.outcome.exitCode, 0);
  assert.equal(artifacts.receipt.outcome.terminationSignal, null);
  assertDeepFrozen(artifacts.receipt);
  assertNoAuthority(artifacts.receipt);

  const runnerOutputBindings = createKerrExternalRunnerExecutionOutputBindings({
    handoff: structuredClone(cycle.claim.handoff),
    rawOutputBytes: artifacts.rawBytes.slice(),
    normalizedOutput: structuredClone(artifacts.normalizedOutput),
    normalizedOutputBytes: artifacts.normalizedBytes.slice(),
  });
  assert.deepEqual(runnerOutputBindings.rawOutput, artifacts.receipt.rawOutput);
  assert.deepEqual(
    runnerOutputBindings.normalizedOutput,
    artifacts.receipt.normalizedOutput,
  );
  assertDeepFrozen(runnerOutputBindings);

  const runnerStatementInput = {
    handoff: cycle.claim.handoff,
    chronology: artifacts.receipt.chronology,
    outcome: artifacts.receipt.outcome,
    resourceUsage: artifacts.receipt.resourceUsage,
    streams: artifacts.receipt.streams,
    rawOutput: artifacts.receipt.rawOutput,
    normalizedOutput: artifacts.receipt.normalizedOutput,
    runnerId: artifacts.receipt.runnerAttestation.runnerId,
    runnerKeyId: artifacts.receipt.runnerAttestation.runnerKeyId,
  };
  const runnerStatement = createKerrExternalRunnerKnownExecutionStatement(
    runnerStatementInput,
  );
  const replayedRunnerStatement = createKerrExternalRunnerKnownExecutionStatement(
    structuredClone(runnerStatementInput),
  );
  const runnerStatementBytes =
    canonicalKerrExternalRunnerKnownExecutionStatementBytes(runnerStatement);
  assert.deepEqual(replayedRunnerStatement, runnerStatement);
  assert.deepEqual(
    canonicalKerrExternalRunnerKnownExecutionStatementBytes(replayedRunnerStatement),
    runnerStatementBytes,
  );
  assert.equal(
    kerrExternalRunnerKnownExecutionStatementSha256(runnerStatement),
    artifacts.receipt.runnerAttestation.signedRunnerStatementSha256,
  );
  const signedStatementKeys = recursivelyCollectedKeys(
    JSON.parse(new TextDecoder().decode(runnerStatementBytes)),
  );
  for (const forbidden of ["claimId", "selectionBinding", "requestBinding"]) {
    assert.equal(
      signedStatementKeys.has(forbidden),
      false,
      `${forbidden} leaked into runner-known signed bytes`,
    );
  }
  assertDeepFrozen(runnerStatement);

  const seenGrantChecks: Array<{
    role: string;
    checkedAt: string;
    authorizationId?: string;
  }> = [];
  let seenSubject: KerrExternalExecutionReceiptVerificationSubject | undefined;
  const verified = await verifyKerrExternalExecutionReceipt(
    {
      claimedHandoff: cycle.claim,
      receipt: artifacts.receipt,
      rawOutputBytes: artifacts.rawBytes,
      normalizedOutput: artifacts.normalizedOutput,
      normalizedOutputBytes: artifacts.normalizedBytes,
      signatureEnvelopeBytes: artifacts.signatureBytes,
      verifiedAt: "2026-07-19T21:11:05Z",
    },
    (verificationSubject, receipt, signatureEnvelopeBytes) => {
      seenSubject = verificationSubject;
      assertDeepFrozen(verificationSubject);
      assertDeepFrozen(receipt);
      assert.deepEqual(
        KerrExternalExecutionReceiptVerificationSubjectSchema.parse(
          verificationSubject,
        ),
        verificationSubject,
      );
      assert.equal(verificationSubject.receiptId, artifacts.receipt.receiptId);
      assert.equal(verificationSubject.claimId, cycle.claim.claimId);
      assert.equal(verificationSubject.requestId, cycle.request.requestId);
      assert.equal(verificationSubject.rawOutputSha256, kerrSha256Hex(artifacts.rawBytes));
      assert.equal(
        verificationSubject.normalizedOutputSha256,
        kerrSha256Hex(artifacts.normalizedBytes),
      );
      assert.equal(
        verificationSubject.signedRunnerStatementSha256,
        artifacts.receipt.runnerAttestation.signedRunnerStatementSha256,
      );
      assert.equal(
        verificationSubject.signatureEnvelopeSha256,
        kerrSha256Hex(artifacts.signatureBytes),
      );
      assert.equal(
        verificationSubject.signatureEnvelopeByteLength,
        artifacts.signatureBytes.byteLength,
      );
      assert.notStrictEqual(signatureEnvelopeBytes, artifacts.signatureBytes);
      assert.deepEqual(signatureEnvelopeBytes, artifacts.signatureBytes);
      return verifierReceipt(verificationSubject, receipt);
    },
    (approval, context) => {
      seenGrantChecks.push({
        role: approval.role,
        checkedAt: context.checkedAt,
        authorizationId: context.authorizationId,
      });
      return currentGrantReceipt(approval, context.checkedAt);
    },
  );

  assert.ok(seenSubject);
  assert.deepEqual(
    seenGrantChecks.map(({ role }) => role),
    ["scientific-independence", "execution-security", "license-output-rights"],
  );
  assert.equal(
    seenGrantChecks.every(
      ({ checkedAt, authorizationId }) =>
        checkedAt === "2026-07-19T21:11:05Z" &&
        authorizationId === cycle.authorization.authorizationId,
    ),
    true,
  );
  assert.deepEqual(VerifiedKerrExternalExecutionReceiptSchema.parse(verified), verified);
  assert.doesNotThrow(() => assertIssuedVerifiedKerrExternalExecutionReceipt(verified));
  assert.doesNotThrow(() =>
    assertVerifiedKerrExternalExecutionReceiptExactBytes(
      verified,
      artifacts.rawBytes,
      artifacts.normalizedBytes,
    ),
  );
  assertNoAuthority(verified);
  assert.equal(verified.realExternalExecutionEstablishedByPackage, false);
  assert.equal(verified.injectedVerifierAuthorityAuthenticatedByPackage, false);
  assertDeepFrozen(verified);

  let admissionGrantChecks = 0;
  const admission = await admitVerifiedKerrExternalOutput(
    {
      referenceBundle: bundle,
      plan,
      verifiedExecutionReceipt: verified,
      admittedAt: "2026-07-19T21:11:06Z",
    },
    (approval, context) => {
      admissionGrantChecks += 1;
      return currentGrantReceipt(approval, context.checkedAt);
    },
  );
  assert.equal(admissionGrantChecks, 3);
  assert.deepEqual(VerifiedKerrExternalOutputAdmissionSchema.parse(admission), admission);
  assert.doesNotThrow(() => assertIssuedVerifiedKerrExternalOutputAdmission(admission));
  assert.doesNotThrow(() =>
    assertVerifiedKerrExternalOutputAdmissionExactBytes(
      admission,
      artifacts.rawBytes,
      artifacts.normalizedBytes,
    ),
  );
  const changedAdmittedRaw = artifacts.rawBytes.slice();
  changedAdmittedRaw[0] ^= 1;
  const changedAdmittedNormalized = artifacts.normalizedBytes.slice();
  changedAdmittedNormalized[0] ^= 1;
  assert.throws(() =>
    assertVerifiedKerrExternalOutputAdmissionExactBytes(
      admission,
      changedAdmittedRaw,
      artifacts.normalizedBytes,
    ),
  );
  assert.throws(() =>
    assertVerifiedKerrExternalOutputAdmissionExactBytes(
      admission,
      artifacts.rawBytes,
      changedAdmittedNormalized,
    ),
  );
  assert.equal(admission.planBinding.planId, plan.planId);
  assert.equal(admission.rows.length, 1);
  assert.equal(admission.rows[0]!.candidateRowId, artifacts.normalizedOutput.rows[0]!.rowId);
  assert.equal(admission.executionReceiptBindingVerified, true);
  assert.equal(admission.quarantineAdmissionVerified, true);
  assert.equal(admission.comparisonReviewPreparationAllowed, true);
  assert.equal(admission.realExternalExecutionEstablishedByPackage, false);
  assert.equal(admission.injectedVerifierAuthorityAuthenticatedByPackage, false);
  assert.equal(canUseVerifiedKerrExternalOutputForRender(admission), false);
  assertNoAuthority(admission);
  assertDeepFrozen(admission);
});

test("reviewed resource ceilings are inclusive for one clean execution", async () => {
  const cycle = await freshClaimCycle();
  const rawBytes = new Uint8Array(KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES);
  rawBytes.fill(0x61);
  const artifacts = artifactsFor(cycle, {
    rawBytes,
    startedAt: "2026-07-19T21:11:00.125Z",
    completedAt: "2026-07-19T21:11:19.000Z",
    rawCapturedAt: "2026-07-19T21:11:19.500Z",
    normalizedAt: "2026-07-19T21:11:20.125Z",
    receiptGeneratedAt: "2026-07-19T21:11:21.000Z",
    stdout: {
      byteLength: KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
      sha256: sha256("1"),
      truncated: false,
    },
    stderr: { byteLength: 65_536, sha256: sha256("2"), truncated: false },
    resourceUsage: {
      cpuMilliseconds: 10_000,
      wallMilliseconds: 20_000,
      peakMemoryBytes: 268_435_456,
      maximumConcurrentProcesses: 1,
      writableBytes: 10_485_760,
      stdoutBytes: KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
      stderrBytes: 65_536,
      outputBytes: KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
    },
  });

  const verified = await verifyArtifacts(cycle, artifacts, "2026-07-19T21:11:22Z");
  assert.equal(verified.receipt.resourceUsage.cpuMilliseconds, 10_000);
  assert.equal(verified.receipt.resourceUsage.wallMilliseconds, 20_000);
  assert.equal(
    verified.receipt.resourceUsage.outputBytes,
    KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
  );
  assert.doesNotThrow(() =>
    assertVerifiedKerrExternalExecutionReceiptExactBytes(
      verified,
      rawBytes,
      artifacts.normalizedBytes,
    ),
  );
});

test("raw, normalized, and detached-signature byte mutations are rejected", async () => {
  const cycle = await freshClaimCycle();
  const artifacts = artifactsFor(cycle);
  const changedRaw = artifacts.rawBytes.slice();
  changedRaw[changedRaw.length - 1] ^= 1;
  const changedNormalizedBytes = artifacts.normalizedBytes.slice();
  changedNormalizedBytes[changedNormalizedBytes.length - 1] ^= 1;
  const changedSignatureBytes = artifacts.signatureBytes.slice();
  changedSignatureBytes[changedSignatureBytes.length - 1] ^= 1;
  const changedNormalizedOutput = structuredClone(artifacts.normalizedOutput);
  const changedRow = mutableRecord(changedNormalizedOutput.rows[0]);
  const changedConstants = mutableRecord(changedRow.constants);
  changedConstants.etaCarterQOverEnergySquared = 0.5;

  await assert.rejects(
    verifyKerrExternalExecutionReceipt(
      {
        claimedHandoff: cycle.claim,
        receipt: artifacts.receipt,
        rawOutputBytes: changedRaw,
        normalizedOutput: artifacts.normalizedOutput,
        normalizedOutputBytes: artifacts.normalizedBytes,
        signatureEnvelopeBytes: artifacts.signatureBytes,
        verifiedAt: "2026-07-19T21:11:05Z",
      },
      (verificationSubject, receipt) => verifierReceipt(verificationSubject, receipt),
      (approval, context) => currentGrantReceipt(approval, context.checkedAt),
    ),
  );
  await assert.rejects(
    verifyKerrExternalExecutionReceipt(
      {
        claimedHandoff: cycle.claim,
        receipt: artifacts.receipt,
        rawOutputBytes: artifacts.rawBytes,
        normalizedOutput: artifacts.normalizedOutput,
        normalizedOutputBytes: artifacts.normalizedBytes,
        signatureEnvelopeBytes: changedSignatureBytes,
        verifiedAt: "2026-07-19T21:11:05Z",
      },
      (verificationSubject, receipt) => verifierReceipt(verificationSubject, receipt),
      (approval, context) => currentGrantReceipt(approval, context.checkedAt),
    ),
  );
  await assert.rejects(
    verifyKerrExternalExecutionReceipt(
      {
        claimedHandoff: cycle.claim,
        receipt: artifacts.receipt,
        rawOutputBytes: artifacts.rawBytes,
        normalizedOutput: artifacts.normalizedOutput,
        normalizedOutputBytes: changedNormalizedBytes,
        signatureEnvelopeBytes: artifacts.signatureBytes,
        verifiedAt: "2026-07-19T21:11:05Z",
      },
      (verificationSubject, receipt) => verifierReceipt(verificationSubject, receipt),
      (approval, context) => currentGrantReceipt(approval, context.checkedAt),
    ),
  );
  await assert.rejects(
    verifyKerrExternalExecutionReceipt(
      {
        claimedHandoff: cycle.claim,
        receipt: artifacts.receipt,
        rawOutputBytes: artifacts.rawBytes,
        normalizedOutput: changedNormalizedOutput as KerrExternalBlindedNormalizedOutput,
        normalizedOutputBytes: artifacts.normalizedBytes,
        signatureEnvelopeBytes: artifacts.signatureBytes,
        verifiedAt: "2026-07-19T21:11:05Z",
      },
      (verificationSubject, receipt) => verifierReceipt(verificationSubject, receipt),
      (approval, context) => currentGrantReceipt(approval, context.checkedAt),
    ),
  );

  const verified = await verifyArtifacts(cycle, artifacts);
  assert.throws(() =>
    assertVerifiedKerrExternalExecutionReceiptExactBytes(
      verified,
      changedRaw,
      artifacts.normalizedBytes,
    ),
  );
  assert.throws(() =>
    assertVerifiedKerrExternalExecutionReceiptExactBytes(
      verified,
      artifacts.rawBytes,
      changedNormalizedBytes,
    ),
  );
});

test("verification detaches normalized output before deferred grant and verifier awaits", async () => {
  for (const deferredBoundary of ["grant", "verifier"] as const) {
    const cycle = await freshClaimCycle();
    const artifacts = artifactsFor(cycle);
    const callerOwnedOutput = structuredClone(artifacts.normalizedOutput);
    const expectedRowId = artifacts.normalizedOutput.rows[0]!.rowId;
    let releaseBoundary = (): void => {};
    const boundaryGate = new Promise<void>((resolve) => {
      releaseBoundary = resolve;
    });
    let markBoundaryEntered = (): void => {};
    const boundaryEntered = new Promise<void>((resolve) => {
      markBoundaryEntered = resolve;
    });
    let grantCalls = 0;
    const verification = verifyKerrExternalExecutionReceipt(
      {
        claimedHandoff: cycle.claim,
        receipt: artifacts.receipt,
        rawOutputBytes: artifacts.rawBytes,
        normalizedOutput: callerOwnedOutput,
        normalizedOutputBytes: artifacts.normalizedBytes,
        signatureEnvelopeBytes: artifacts.signatureBytes,
        verifiedAt: "2026-07-19T21:11:05Z",
      },
      async (verificationSubject, receipt) => {
        if (deferredBoundary === "verifier") {
          markBoundaryEntered();
          await boundaryGate;
        }
        return verifierReceipt(verificationSubject, receipt);
      },
      async (approval, context) => {
        grantCalls += 1;
        if (deferredBoundary === "grant" && grantCalls === 1) {
          markBoundaryEntered();
          await boundaryGate;
        }
        return currentGrantReceipt(approval, context.checkedAt);
      },
    );

    await boundaryEntered;
    try {
      mutableRecord(callerOwnedOutput.rows[0]).screenX = 7.5;
      assert.throws(() =>
        assertKerrExternalBlindedNormalizedOutputIntegrity(
          cycle.claim,
          callerOwnedOutput,
        ),
      );
    } finally {
      releaseBoundary();
    }

    const verified = await verification;
    assert.equal(grantCalls, 3);
    assert.equal(
      verified.receipt.normalizedOutput.normalizedOutputChecksumSha256,
      artifacts.normalizedOutput.normalizedOutputChecksum.value,
    );
    const admission = await admitVerifiedKerrExternalOutput(
      {
        referenceBundle: bundle,
        plan,
        verifiedExecutionReceipt: verified,
        admittedAt: "2026-07-19T21:11:06Z",
      },
      (approval, context) => currentGrantReceipt(approval, context.checkedAt),
    );
    assert.equal(admission.rows[0]!.candidateRowId, expectedRowId);
    assert.equal(callerOwnedOutput.rows[0]!.screenX, 7.5);
  }
});

test("admission detaches its bound plan before the deferred grant await", async () => {
  const cycle = await freshClaimCycle();
  const artifacts = artifactsFor(cycle);
  const verified = await verifyArtifacts(cycle, artifacts);
  const callerOwnedPlan = structuredClone(plan);
  const expectedPlanId = plan.planId;
  const expectedCaseId = plan.cases[0]!.caseId;
  let releaseGrant = (): void => {};
  const grantGate = new Promise<void>((resolve) => {
    releaseGrant = resolve;
  });
  let markGrantEntered = (): void => {};
  const grantEntered = new Promise<void>((resolve) => {
    markGrantEntered = resolve;
  });
  let grantCalls = 0;
  const admissionPromise = admitVerifiedKerrExternalOutput(
    {
      referenceBundle: bundle,
      plan: callerOwnedPlan,
      verifiedExecutionReceipt: verified,
      admittedAt: "2026-07-19T21:11:06Z",
    },
    async (approval, context) => {
      grantCalls += 1;
      if (grantCalls === 1) {
        markGrantEntered();
        await grantGate;
      }
      return currentGrantReceipt(approval, context.checkedAt);
    },
  );

  await grantEntered;
  try {
    mutableRecord(callerOwnedPlan).planId = `krcplan_${"0".repeat(24)}`;
    mutableRecord(callerOwnedPlan.cases[0]).caseId = "krcase_mutated-after-await";
  } finally {
    releaseGrant();
  }

  const admission = await admissionPromise;
  assert.equal(grantCalls, 3);
  assert.equal(admission.planBinding.planId, expectedPlanId);
  assert.equal(admission.rows[0]!.caseId, expectedCaseId);
});

test("byte preflight rejects hostile views before poisoned normalized rows can be traversed", async () => {
  const cycle = await freshClaimCycle();
  const ordinary = declarationInput(cycle);

  class DerivedBytes extends Uint8Array {}
  const sharedBytes = new Uint8Array(new SharedArrayBuffer(8)) as Uint8Array;
  const shadowedBytes = new Uint8Array([1, 2, 3]);
  Object.defineProperty(shadowedBytes, "byteOffset", { value: 0 });
  const hostileByteCases: Array<{
    name: string;
    override: Partial<typeof ordinary>;
  }> = [
    {
      name: "SharedArrayBuffer raw bytes",
      override: { rawOutputBytes: sharedBytes },
    },
    {
      name: "derived normalized bytes",
      override: {
        normalizedOutputBytes: new DerivedBytes(ordinary.normalizedOutputBytes),
      },
    },
    {
      name: "shadowed signature bytes",
      override: { signatureEnvelopeBytes: shadowedBytes },
    },
    {
      name: "raw bytes at max plus one",
      override: {
        rawOutputBytes: new Uint8Array(
          KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES + 1,
        ),
      },
    },
    {
      name: "normalized bytes at max plus one",
      override: {
        normalizedOutputBytes: new Uint8Array(
          KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES + 1,
        ),
      },
    },
    {
      name: "signature envelope bytes at max plus one",
      override: {
        signatureEnvelopeBytes: new Uint8Array(
          KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES + 1,
        ),
      },
    },
  ];

  for (const hostile of hostileByteCases) {
    let poisonedRowsTraversed = false;
    const poisonedOutput = {};
    Object.defineProperty(poisonedOutput, "rows", {
      enumerable: true,
      get() {
        poisonedRowsTraversed = true;
        throw new Error("poisoned row accessor executed");
      },
    });
    assert.throws(
      () =>
        createKerrExternalExecutionReceiptDeclaration({
          ...ordinary,
          ...hostile.override,
          normalizedOutput: poisonedOutput as never,
        }),
      hostile.name,
    );
    assert.equal(
      poisonedRowsTraversed,
      false,
      `${hostile.name} traversed normalized rows before byte preflight`,
    );
  }

  let accessorRowTraversed = false;
  const accessorRows = new Array(1);
  Object.defineProperty(accessorRows, "0", {
    enumerable: true,
    get() {
      accessorRowTraversed = true;
      throw new Error("row accessor executed");
    },
  });
  assert.throws(() =>
    createKerrExternalBlindedNormalizedOutput({
      claimedHandoff: cycle.claim,
      normalizedAt: "2026-07-19T21:11:03.000Z",
      rows: accessorRows,
    }),
  );
  assert.equal(accessorRowTraversed, false);

  const rowsWithExtraProperty = normalizedRows(cycle.claim);
  Object.defineProperty(rowsWithExtraProperty, "unexpected", {
    value: true,
    enumerable: true,
  });
  assert.throws(
    () =>
      createKerrExternalBlindedNormalizedOutput({
        claimedHandoff: cycle.claim,
        normalizedAt: "2026-07-19T21:11:03.000Z",
        rows: rowsWithExtraProperty,
      }),
    /must not contain extra properties or symbols/,
  );
});

test("archive signatures and non-exact typed arrays are rejected before receipt declaration", async () => {
  const cycle = await freshClaimCycle();
  const archives = [
    new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]),
    new Uint8Array([0x1f, 0x8b, 0]),
    new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0]),
    new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0]),
  ];
  for (const rawBytes of archives) {
    assert.throws(
      () => createKerrExternalExecutionReceiptDeclaration(declarationInput(cycle, { rawBytes })),
      /uncompressed non-archive file/,
    );
  }

  class DerivedBytes extends Uint8Array {}
  const derivedRaw = new DerivedBytes([1, 2, 3]);
  assert.throws(() =>
    createKerrExternalExecutionReceiptDeclaration(
      declarationInput(cycle, { rawBytes: derivedRaw }),
    ),
  );

  const ordinary = declarationInput(cycle);
  const derivedNormalized = new DerivedBytes(ordinary.normalizedOutputBytes);
  assert.throws(() =>
    createKerrExternalExecutionReceiptDeclaration({
      ...ordinary,
      normalizedOutputBytes: derivedNormalized,
    }),
  );
  const derivedSignature = new DerivedBytes(ordinary.signatureEnvelopeBytes);
  assert.throws(() =>
    createKerrExternalExecutionReceiptDeclaration({
      ...ordinary,
      signatureEnvelopeBytes: derivedSignature,
    }),
  );

  const shadowed = new Uint8Array([1, 2, 3]);
  Object.defineProperty(shadowed, "byteLength", { value: 3 });
  assert.throws(() =>
    createKerrExternalExecutionReceiptDeclaration(
      declarationInput(cycle, { rawBytes: shadowed }),
    ),
  );

  const detached = new Uint8Array([1, 2, 3]);
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  assert.throws(() =>
    createKerrExternalExecutionReceiptDeclaration(
      declarationInput(cycle, { rawBytes: detached }),
    ),
  );
});

test("unclaimed handoffs, other claims, and structural capability copies cannot be substituted", async () => {
  const unclaimed = await freshHandoffCycle();
  assert.throws(() =>
    createKerrExternalBlindedNormalizedOutput({
      claimedHandoff: unclaimed.handoff as never,
      normalizedAt: "2026-07-19T21:11:03.000Z",
      rows: [],
    }),
  );

  const firstCycle = await freshClaimCycle();
  const firstArtifacts = artifactsFor(firstCycle);
  const otherCycle = await freshClaimCycle();
  await assert.rejects(
    verifyKerrExternalExecutionReceipt(
      {
        claimedHandoff: otherCycle.claim,
        receipt: firstArtifacts.receipt,
        rawOutputBytes: firstArtifacts.rawBytes,
      normalizedOutput: firstArtifacts.normalizedOutput,
      normalizedOutputBytes: firstArtifacts.normalizedBytes,
      signatureEnvelopeBytes: firstArtifacts.signatureBytes,
      verifiedAt: "2026-07-19T21:11:05Z",
      },
      (verificationSubject, receipt) => verifierReceipt(verificationSubject, receipt),
      (approval, context) => currentGrantReceipt(approval, context.checkedAt),
    ),
  );

  const copiedClaim = structuredClone(firstCycle.claim);
  assert.throws(() =>
    createKerrExternalBlindedNormalizedOutput({
      claimedHandoff: copiedClaim,
      normalizedAt: "2026-07-19T21:11:03.000Z",
      rows: normalizedRows(firstCycle.claim),
    }),
  );

  const verified = await verifyArtifacts(firstCycle, firstArtifacts);
  const copiedVerified = structuredClone(verified);
  assert.throws(() => assertIssuedVerifiedKerrExternalExecutionReceipt(copiedVerified));
  await assert.rejects(
    admitVerifiedKerrExternalOutput(
      {
        referenceBundle: bundle,
        plan,
        verifiedExecutionReceipt: copiedVerified,
        admittedAt: "2026-07-19T21:11:06Z",
      },
      (approval, context) => currentGrantReceipt(approval, context.checkedAt),
    ),
  );

  const admission = await admitVerifiedKerrExternalOutput(
    {
      referenceBundle: bundle,
      plan,
      verifiedExecutionReceipt: verified,
      admittedAt: "2026-07-19T21:11:06Z",
    },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  assert.throws(() =>
    assertIssuedVerifiedKerrExternalOutputAdmission(structuredClone(admission)),
  );
});

test("receipt chronology requires canonical milliseconds and verification/admission reject expiry", async () => {
  const cycle = await freshClaimCycle();
  const invalidChronologies: ArtifactOptions[] = [
    { startedAt: "2026-07-19T21:09:59.999Z" },
    {
      startedAt: "2026-07-19T21:11:01.000Z",
      completedAt: "2026-07-19T21:11:00.999Z",
    },
    {
      completedAt: "2026-07-19T21:11:02.000Z",
      rawCapturedAt: "2026-07-19T21:11:01.999Z",
    },
    {
      rawCapturedAt: "2026-07-19T21:11:03.001Z",
      normalizedAt: "2026-07-19T21:11:03.000Z",
    },
    { receiptGeneratedAt: "2026-07-19T21:11:02.999Z" },
    { receiptGeneratedAt: "2026-07-19T21:30:00.000Z" },
    { normalizedAt: "2026-07-19T21:11:03Z" },
    { startedAt: "2026-07-19T21:11:00Z" },
  ];
  for (const invalid of invalidChronologies) {
    assert.throws(() =>
      createKerrExternalExecutionReceiptDeclaration(
        declarationInput(cycle, invalid),
      ),
    );
  }

  const artifacts = artifactsFor(cycle);
  await assert.rejects(
    verifyKerrExternalExecutionReceipt(
      {
        claimedHandoff: cycle.claim,
        receipt: artifacts.receipt,
        rawOutputBytes: artifacts.rawBytes,
        normalizedOutput: artifacts.normalizedOutput,
        normalizedOutputBytes: artifacts.normalizedBytes,
        signatureEnvelopeBytes: artifacts.signatureBytes,
        verifiedAt: cycle.claim.expiresAt,
      },
      (verificationSubject, receipt) => verifierReceipt(verificationSubject, receipt),
      (approval, context) => currentGrantReceipt(approval, context.checkedAt),
    ),
    /outside validity/,
  );

  const verified = await verifyArtifacts(cycle, artifacts);
  await assert.rejects(
    admitVerifiedKerrExternalOutput(
      {
        referenceBundle: bundle,
        plan,
        verifiedExecutionReceipt: verified,
        admittedAt: cycle.claim.expiresAt,
      },
      (approval, context) => currentGrantReceipt(approval, context.checkedAt),
    ),
    /outside validity/,
  );
  const admitted = await admitVerifiedKerrExternalOutput(
    {
      referenceBundle: bundle,
      plan,
      verifiedExecutionReceipt: verified,
      admittedAt: "2026-07-19T21:11:06Z",
    },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  assert.equal(admitted.admittedAt, "2026-07-19T21:11:06Z");
});

test("nonzero, signal, timeout, sandbox, network, truncation, OOM, and writable-artifact outcomes fail closed", async () => {
  const scenarios: Array<{ name: string; options: ArtifactOptions }> = [
    { name: "nonzero exit", options: { outcome: { exitCode: 1 } } },
    {
      name: "termination signal",
      options: { outcome: { exitCode: null, terminationSignal: "SIGTERM" } },
    },
    { name: "timeout", options: { outcome: { timedOut: true } } },
    { name: "out of memory", options: { outcome: { outOfMemory: true } } },
    { name: "sandbox violation", options: { outcome: { sandboxViolation: true } } },
    {
      name: "network observed",
      options: { outcome: { networkAccessObserved: true } },
    },
    { name: "output truncation", options: { outcome: { outputTruncated: true } } },
    {
      name: "unexpected writable artifacts",
      options: { outcome: { unexpectedWritableArtifacts: true } },
    },
    { name: "stdout truncation", options: { stdout: { truncated: true } } },
    { name: "stderr truncation", options: { stderr: { truncated: true } } },
  ];

  for (const scenario of scenarios) {
    const cycle = await freshClaimCycle();
    const artifacts = artifactsFor(cycle, scenario.options);
    await assert.rejects(
      verifyArtifacts(cycle, artifacts),
      /does not record one clean bounded exit/,
      scenario.name,
    );
  }
});

test("wall, CPU, memory, process, writable, stderr, and accounting overages fail closed", async () => {
  const scenarios: Array<{
    name: string;
    options: ArtifactOptions;
    verifiedAt?: string;
  }> = [
    {
      name: "wall time",
      options: {
        completedAt: "2026-07-19T21:11:20.001Z",
        rawCapturedAt: "2026-07-19T21:11:21.000Z",
        normalizedAt: "2026-07-19T21:11:22.000Z",
        receiptGeneratedAt: "2026-07-19T21:11:23.000Z",
      },
      verifiedAt: "2026-07-19T21:11:24Z",
    },
    { name: "CPU", options: { resourceUsage: { cpuMilliseconds: 10_001 } } },
    {
      name: "memory",
      options: { resourceUsage: { peakMemoryBytes: 268_435_457 } },
    },
    {
      name: "process count",
      options: { resourceUsage: { maximumConcurrentProcesses: 2 } },
    },
    {
      name: "writable bytes",
      options: { resourceUsage: { writableBytes: 10_485_761 } },
    },
    {
      name: "stderr limit",
      options: {
        stderr: { byteLength: 65_537 },
        resourceUsage: { stderrBytes: 65_537 },
      },
    },
    { name: "stdout accounting", options: { resourceUsage: { stdoutBytes: 1 } } },
    { name: "output accounting", options: { resourceUsage: { outputBytes: 1 } } },
  ];

  for (const scenario of scenarios) {
    const cycle = await freshClaimCycle();
    const artifacts = artifactsFor(cycle, scenario.options);
    await assert.rejects(
      verifyArtifacts(cycle, artifacts, scenario.verifiedAt),
      /exceeds or contradicts reviewed limits/,
      scenario.name,
    );
  }
});

test("structured verifier rejection, binding mismatch, throw, and grant failure each burn the claim", async () => {
  const scenarios: Array<{
    name: string;
    verifier: Parameters<typeof verifyKerrExternalExecutionReceipt>[1];
    authorizer?: Parameters<typeof verifyKerrExternalExecutionReceipt>[2];
  }> = [
    {
      name: "non-structured rejection",
      verifier: () => false,
    },
    {
      name: "literal-true verifier field missing",
      verifier: (verificationSubject, receipt) => ({
        ...verifierReceipt(verificationSubject, receipt),
        runnerKeyPurposeVerified: false,
      }),
    },
    {
      name: "runner key overlaps a review key",
      verifier: (verificationSubject, receipt) => ({
        ...verifierReceipt(verificationSubject, receipt),
        runnerKeyDistinctFromReviewKeys: false,
      }),
    },
    {
      name: "verifier receipt binding mismatch",
      verifier: (verificationSubject, receipt) =>
        verifierReceipt(verificationSubject, receipt, {
          subjectSha256: sha256("9"),
        }),
    },
    {
      name: "verifier throw",
      verifier: () => {
        throw new Error("injected verifier unavailable");
      },
    },
    {
      name: "current grant failure",
      verifier: (verificationSubject, receipt) =>
        verifierReceipt(verificationSubject, receipt),
      authorizer: () => {
        throw new Error("runner-time reviewer grant revoked");
      },
    },
  ];

  for (const scenario of scenarios) {
    const cycle = await freshClaimCycle();
    const artifacts = artifactsFor(cycle);
    const verificationInput = {
      claimedHandoff: cycle.claim,
      receipt: artifacts.receipt,
      rawOutputBytes: artifacts.rawBytes,
      normalizedOutput: artifacts.normalizedOutput,
      normalizedOutputBytes: artifacts.normalizedBytes,
      signatureEnvelopeBytes: artifacts.signatureBytes,
      verifiedAt: "2026-07-19T21:11:05Z",
    };
    await assert.rejects(
      verifyKerrExternalExecutionReceipt(
        verificationInput,
        scenario.verifier,
        scenario.authorizer ??
          ((approval, context) => currentGrantReceipt(approval, context.checkedAt)),
      ),
      scenario.name,
    );
    await assert.rejects(
      verifyKerrExternalExecutionReceipt(
        verificationInput,
        (verificationSubject, receipt) =>
          verifierReceipt(verificationSubject, receipt),
        (approval, context) => currentGrantReceipt(approval, context.checkedAt),
      ),
      /already attempted receipt verification/,
      `${scenario.name} did not burn its claim`,
    );
  }
});

test("verified receipt admission is one-use under replay and concurrency", async () => {
  const replayCycle = await freshClaimCycle();
  const replayArtifacts = artifactsFor(replayCycle);
  const replayVerified = await verifyArtifacts(replayCycle, replayArtifacts);
  await admitVerifiedKerrExternalOutput(
    {
      referenceBundle: bundle,
      plan,
      verifiedExecutionReceipt: replayVerified,
      admittedAt: "2026-07-19T21:11:06Z",
    },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  await assert.rejects(
    admitVerifiedKerrExternalOutput(
      {
        referenceBundle: bundle,
        plan,
        verifiedExecutionReceipt: replayVerified,
        admittedAt: "2026-07-19T21:11:07Z",
      },
      (approval, context) => currentGrantReceipt(approval, context.checkedAt),
    ),
    /already been admitted/,
  );

  const concurrentCycle = await freshClaimCycle();
  const concurrentArtifacts = artifactsFor(concurrentCycle);
  const concurrentVerified = await verifyArtifacts(
    concurrentCycle,
    concurrentArtifacts,
  );
  let releaseGrantCheck = (): void => {};
  const grantGate = new Promise<void>((resolve) => {
    releaseGrantCheck = resolve;
  });
  let markGrantCheckStarted = (): void => {};
  const grantCheckStarted = new Promise<void>((resolve) => {
    markGrantCheckStarted = resolve;
  });
  let grantCalls = 0;
  const firstAdmission = admitVerifiedKerrExternalOutput(
    {
      referenceBundle: bundle,
      plan,
      verifiedExecutionReceipt: concurrentVerified,
      admittedAt: "2026-07-19T21:11:06Z",
    },
    async (approval, context) => {
      grantCalls += 1;
      if (grantCalls === 1) {
        markGrantCheckStarted();
        await grantGate;
      }
      return currentGrantReceipt(approval, context.checkedAt);
    },
  );
  await grantCheckStarted;
  try {
    await assert.rejects(
      admitVerifiedKerrExternalOutput(
        {
          referenceBundle: bundle,
          plan,
          verifiedExecutionReceipt: concurrentVerified,
          admittedAt: "2026-07-19T21:11:06Z",
        },
        (approval, context) => currentGrantReceipt(approval, context.checkedAt),
      ),
      /already been admitted/,
    );
  } finally {
    releaseGrantCheck();
  }
  const admission = await firstAdmission;
  assert.equal(admission.quarantineAdmissionVerified, true);
  assert.equal(grantCalls, 3);
});

test("admission rejects a valid but substituted comparison plan before consuming the receipt", async () => {
  const cycle = await freshClaimCycle();
  const artifacts = artifactsFor(cycle);
  const verified = await verifyArtifacts(cycle, artifacts);
  const substitutedPlan = planFor(
    bundle,
    externalImplementation({ version: "1.0.1-substituted" }),
  );
  assert.notEqual(substitutedPlan.planId, plan.planId);

  await assert.rejects(
    admitVerifiedKerrExternalOutput(
      {
        referenceBundle: bundle,
        plan: substitutedPlan,
        verifiedExecutionReceipt: verified,
        admittedAt: "2026-07-19T21:11:06Z",
      },
      (approval, context) => currentGrantReceipt(approval, context.checkedAt),
    ),
    /does not match its plan, selection, request, or attempt/,
  );
  const admission = await admitVerifiedKerrExternalOutput(
    {
      referenceBundle: bundle,
      plan,
      verifiedExecutionReceipt: verified,
      admittedAt: "2026-07-19T21:11:06Z",
    },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  assert.equal(admission.planBinding.planId, plan.planId);
});

test("mapping review preparation canonically binds the admitted output, signed decision, and injected verifier", async () => {
  const fixture = await freshAdmissionFixture();
  const reviewSubject = mappingSubjectFor(fixture);
  const replayedSubject = mappingSubjectFor(fixture);
  assert.deepEqual(replayedSubject, reviewSubject);
  assert.deepEqual(KerrExternalMappingReviewSubjectSchema.parse(reviewSubject), reviewSubject);
  assert.doesNotThrow(() =>
    assertKerrExternalMappingReviewSubjectIntegrity(
      fixture.admission,
      bundle,
      plan,
      reviewSubject,
    ),
  );
  assert.deepEqual(
    canonicalKerrExternalMappingReviewSubjectBytes(reviewSubject),
    encoder.encode(kerrStableStringify(reviewSubject)),
  );
  assert.equal(
    kerrExternalMappingReviewSubjectSha256(reviewSubject),
    kerrSha256Hex(canonicalKerrExternalMappingReviewSubjectBytes(reviewSubject)),
  );
  assert.equal(reviewSubject.admissionBinding.admissionId, fixture.admission.admissionId);
  assert.equal(reviewSubject.planBinding.planId, plan.planId);
  assert.equal(
    reviewSubject.mappingCanonicalBytes.sha256,
    kerrSha256Hex(kerrStableStringify(plan.mapping)),
  );
  assert.equal(
    reviewSubject.rowAssociationBinding.orderedAssociationSha256,
    kerrSha256Hex(kerrStableStringify(fixture.admission.rows)),
  );
  assert.equal(reviewSubject.structuredReferenceIdentifiersIncluded, false);
  assert.equal(reviewSubject.structuredReferenceChecksumsIncluded, false);
  assert.equal(reviewSubject.structuredReferenceOutcomesIncluded, false);
  assert.equal(reviewSubject.structuredReferenceTolerancesIncluded, false);
  assert.equal(reviewSubject.structuredComparisonResultsIncluded, false);
  assert.equal(reviewSubject.callerControlledMappingFreeTextIncluded, true);
  assert.equal(
    reviewSubject.mappingFreeTextAbsenceOfReferenceDataVerifiedByPackage,
    false,
  );
  assert.equal(reviewSubject.answerBlindingVerifiedByPackage, false);
  assertNoAuthority(reviewSubject);

  assert.deepEqual(
    KerrExternalMappingSemanticAssertionsSchema.parse(mappingSemanticAssertions),
    mappingSemanticAssertions,
  );
  const { statement, decision, signatureEnvelopeBytes } =
    mappingDecisionFor(reviewSubject);
  assert.deepEqual(
    KerrExternalMappingReviewDecisionStatementSchema.parse(statement),
    statement,
  );
  assert.deepEqual(KerrExternalMappingReviewDecisionSchema.parse(decision), decision);
  assert.deepEqual(
    canonicalKerrExternalMappingReviewDecisionStatementBytes(statement),
    encoder.encode(kerrStableStringify(statement)),
  );
  assert.equal(
    kerrExternalMappingReviewDecisionStatementSha256(statement),
    decision.signedStatementSha256,
  );
  assert.doesNotThrow(() =>
    assertKerrExternalMappingReviewDecisionIntegrity(
      reviewSubject,
      decision,
      signatureEnvelopeBytes,
    ),
  );
  assert.equal(decision.signatureVerifiedByPackage, false);
  assert.equal(decision.mappingReviewVerified, false);
  assertNoAuthority(decision);

  let verifierReceiptValue: KerrExternalMappingReviewVerifierReceipt | undefined;
  const preparation = await prepareVerifiedKerrExternalOutputForComparisonReview(
    comparisonPreparationInput(
      fixture,
      reviewSubject,
      decision,
      signatureEnvelopeBytes,
    ),
    (
      receivedSubject,
      receivedDecision,
      receivedSignatureBytes,
      receivedCheckedAt,
    ) => {
      assert.deepEqual(receivedSubject, reviewSubject);
      assert.deepEqual(receivedDecision, decision);
      assert.equal(receivedCheckedAt, mappingPreparedAt);
      assert.notStrictEqual(receivedSubject, reviewSubject);
      assert.notStrictEqual(receivedDecision, decision);
      assert.deepEqual(receivedSignatureBytes, signatureEnvelopeBytes);
      assert.notStrictEqual(receivedSignatureBytes, signatureEnvelopeBytes);
      verifierReceiptValue = mappingVerifierReceipt(
        receivedSubject,
        receivedDecision,
        receivedSignatureBytes,
      );
      receivedSignatureBytes[0] ^= 0xff;
      return verifierReceiptValue;
    },
  );
  assert.ok(verifierReceiptValue);
  assert.deepEqual(
    KerrExternalMappingReviewVerifierReceiptSchema.parse(verifierReceiptValue),
    verifierReceiptValue,
  );
  assert.deepEqual(
    PreparedKerrExternalComparisonReviewSchema.parse(preparation),
    preparation,
  );
  assert.doesNotThrow(() =>
    assertIssuedPreparedKerrExternalComparisonReview(preparation),
  );
  assert.doesNotThrow(() =>
    assertPreparedKerrExternalComparisonReviewExactBytes(
      preparation,
      fixture.artifacts.rawBytes,
      fixture.artifacts.normalizedBytes,
      signatureEnvelopeBytes,
    ),
  );
  assert.equal(preparation.admissionBinding.admissionId, fixture.admission.admissionId);
  assert.equal(preparation.mappingReviewBinding.subjectId, reviewSubject.subjectId);
  assert.equal(preparation.mappingReviewBinding.decisionId, decision.decisionId);
  assert.equal(
    preparation.mappingReviewBinding.injectedVerifierReceiptCanonicalSha256,
    kerrSha256Hex(kerrStableStringify(verifierReceiptValue)),
  );
  assert.equal(preparation.candidateBinding.rowCount, fixture.admission.rows.length);
  assert.equal(
    preparation.preparedCandidateCanonicalByteCeiling,
    KERR_RECEIPT_BOUND_PREPARED_CANDIDATE_MAX_CANONICAL_BYTES,
  );
  assert.equal(preparation.mappingReviewDecisionAcceptedByInjectedBoundary, true);
  assert.equal(preparation.injectedMappingVerifierAuthorityAuthenticatedByPackage, false);
  assert.equal(
    preparation.sourceAdmissionPreparationAttemptConsumedInProcess,
    true,
  );
  assert.equal(preparation.numericComparisonConsumerImplemented, true);
  assert.equal(preparation.preparationCapabilityConsumedAtIssuance, false);
  assert.equal(preparation.comparisonExecuted, false);
  assert.equal(canUsePreparedKerrExternalComparisonReviewForRender(preparation), false);
  assertNoAuthority(preparation);
  assertDeepFrozen(reviewSubject);
  assertDeepFrozen(statement);
  assertDeepFrozen(decision);
  assertDeepFrozen(preparation);

  const structuralCopy = structuredClone(preparation);
  assert.deepEqual(PreparedKerrExternalComparisonReviewSchema.parse(structuralCopy), preparation);
  assert.throws(
    () => assertIssuedPreparedKerrExternalComparisonReview(structuralCopy),
    /must be issued in this process/,
  );
});

test("comparison-review preparation rejects structural admission copies and exact-byte substitutions before burn", async () => {
  const fixture = await freshAdmissionFixture();
  const structuralAdmission = structuredClone(fixture.admission);
  assert.deepEqual(
    VerifiedKerrExternalOutputAdmissionSchema.parse(structuralAdmission),
    fixture.admission,
  );
  assert.throws(
    () =>
      createKerrExternalMappingReviewSubject({
        admission: structuralAdmission,
        referenceBundle: bundle,
        plan,
        frozenAt: mappingSubjectFrozenAt,
      }),
    /must be issued in this process/,
  );

  const reviewSubject = mappingSubjectFor(fixture);
  const { decision, signatureEnvelopeBytes } = mappingDecisionFor(reviewSubject);
  let verifierCalls = 0;
  const verifier = (
    receivedSubject: KerrExternalMappingReviewSubject,
    receivedDecision: KerrExternalMappingReviewDecision,
    receivedSignatureBytes: Uint8Array,
  ) => {
    verifierCalls += 1;
    return mappingVerifierReceipt(
      receivedSubject,
      receivedDecision,
      receivedSignatureBytes,
    );
  };
  const changedRawBytes = new Uint8Array(fixture.artifacts.rawBytes);
  changedRawBytes[0] ^= 0xff;
  const changedNormalizedBytes = new Uint8Array(fixture.artifacts.normalizedBytes);
  changedNormalizedBytes[0] ^= 0xff;
  const changedSignatureBytes = new Uint8Array(signatureEnvelopeBytes);
  changedSignatureBytes[0] ^= 0xff;

  await assert.rejects(
    prepareVerifiedKerrExternalOutputForComparisonReview(
      {
        ...comparisonPreparationInput(
          fixture,
          reviewSubject,
          decision,
          signatureEnvelopeBytes,
        ),
        rawOutputBytes: changedRawBytes,
      },
      verifier,
    ),
    /bytes do not match the admitted receipt/,
  );
  await assert.rejects(
    prepareVerifiedKerrExternalOutputForComparisonReview(
      {
        ...comparisonPreparationInput(
          fixture,
          reviewSubject,
          decision,
          signatureEnvelopeBytes,
        ),
        normalizedOutputBytes: changedNormalizedBytes,
      },
      verifier,
    ),
    /bytes do not match the admitted receipt/,
  );
  await assert.rejects(
    prepareVerifiedKerrExternalOutputForComparisonReview(
      comparisonPreparationInput(
        fixture,
        reviewSubject,
        decision,
        changedSignatureBytes,
      ),
      verifier,
    ),
    /failed exact integrity replay/,
  );
  assert.equal(verifierCalls, 0);

  const preparation = await prepareVerifiedKerrExternalOutputForComparisonReview(
    comparisonPreparationInput(
      fixture,
      reviewSubject,
      decision,
      signatureEnvelopeBytes,
    ),
    verifier,
  );
  assert.equal(verifierCalls, 1);
  assert.throws(
    () =>
      assertPreparedKerrExternalComparisonReviewExactBytes(
        preparation,
        changedRawBytes,
        fixture.artifacts.normalizedBytes,
        signatureEnvelopeBytes,
      ),
    /exact bytes do not match/,
  );
  assert.throws(
    () =>
      assertPreparedKerrExternalComparisonReviewExactBytes(
        preparation,
        fixture.artifacts.rawBytes,
        changedNormalizedBytes,
        signatureEnvelopeBytes,
      ),
    /exact bytes do not match/,
  );
  assert.throws(
    () =>
      assertPreparedKerrExternalComparisonReviewExactBytes(
        preparation,
        fixture.artifacts.rawBytes,
        fixture.artifacts.normalizedBytes,
        changedSignatureBytes,
      ),
    /exact bytes do not match/,
  );
});

test("mapping review chronology and reviewer identity separation fail closed before preparation burn", async () => {
  const fixture = await freshAdmissionFixture();
  assert.throws(
    () => mappingSubjectFor(fixture, "2026-07-19T21:11:05Z"),
    /outside admission validity/,
  );
  assert.throws(
    () => mappingSubjectFor(fixture, "2026-07-19T21:30:00Z"),
    /outside admission validity/,
  );
  const reviewSubject = mappingSubjectFor(fixture);
  const runner = reviewSubject.receiptDeclaredRunnerIdentityBinding;
  const prior = reviewSubject.priorSelectionReviewIdentityBindings.approvals[0]!;
  for (const options of [
    { reviewerId: runner.runnerId },
    { roleGrantId: runner.runnerGrantId },
    { keyId: runner.runnerKeyId },
    { reviewerId: prior.reviewerId },
    { roleGrantId: prior.roleGrantId },
    { keyId: prior.keyId },
  ]) {
    assert.throws(() => mappingDecisionFor(reviewSubject, options), /must be distinct/);
  }
  assert.throws(
    () =>
      mappingDecisionFor(reviewSubject, {
        decidedAt: "2026-07-19T21:11:06Z",
      }),
    /chronology is invalid/,
  );
  assert.throws(
    () =>
      mappingDecisionFor(reviewSubject, {
        expiresAt: "2026-07-19T21:30:01Z",
      }),
    /chronology is invalid/,
  );

  const { decision, signatureEnvelopeBytes } = mappingDecisionFor(reviewSubject);
  let verifierCalls = 0;
  const verifier = (
    receivedSubject: KerrExternalMappingReviewSubject,
    receivedDecision: KerrExternalMappingReviewDecision,
    receivedSignatureBytes: Uint8Array,
  ) => {
    verifierCalls += 1;
    return mappingVerifierReceipt(
      receivedSubject,
      receivedDecision,
      receivedSignatureBytes,
    );
  };
  await assert.rejects(
    prepareVerifiedKerrExternalOutputForComparisonReview(
      comparisonPreparationInput(
        fixture,
        reviewSubject,
        decision,
        signatureEnvelopeBytes,
        "2026-07-19T21:11:07Z",
      ),
      verifier,
    ),
    /outside mapping-review validity/,
  );
  await assert.rejects(
    prepareVerifiedKerrExternalOutputForComparisonReview(
      comparisonPreparationInput(
        fixture,
        reviewSubject,
        decision,
        signatureEnvelopeBytes,
        mappingDecisionExpiresAt,
      ),
      verifier,
    ),
    /outside mapping-review validity/,
  );
  assert.equal(verifierCalls, 0);
  await prepareVerifiedKerrExternalOutputForComparisonReview(
    comparisonPreparationInput(
      fixture,
      reviewSubject,
      decision,
      signatureEnvelopeBytes,
    ),
    verifier,
  );
  assert.equal(verifierCalls, 1);
});

test("comparison-review preparation is atomically one-use under replay and concurrency", async () => {
  const replayFixture = await freshAdmissionFixture();
  const replaySubject = mappingSubjectFor(replayFixture);
  const replayReview = mappingDecisionFor(replaySubject);
  const replayInput = comparisonPreparationInput(
    replayFixture,
    replaySubject,
    replayReview.decision,
    replayReview.signatureEnvelopeBytes,
  );
  await prepareVerifiedKerrExternalOutputForComparisonReview(
    replayInput,
    (receivedSubject, receivedDecision, receivedSignatureBytes) =>
      mappingVerifierReceipt(
        receivedSubject,
        receivedDecision,
        receivedSignatureBytes,
      ),
  );
  await assert.rejects(
    prepareVerifiedKerrExternalOutputForComparisonReview(
      replayInput,
      (receivedSubject, receivedDecision, receivedSignatureBytes) =>
        mappingVerifierReceipt(
          receivedSubject,
          receivedDecision,
          receivedSignatureBytes,
        ),
    ),
    /already attempted comparison-review preparation/,
  );

  const concurrentFixture = await freshAdmissionFixture();
  const concurrentSubject = mappingSubjectFor(concurrentFixture);
  const concurrentReview = mappingDecisionFor(concurrentSubject);
  const concurrentInput = comparisonPreparationInput(
    concurrentFixture,
    concurrentSubject,
    concurrentReview.decision,
    concurrentReview.signatureEnvelopeBytes,
  );
  let releaseVerifier = (): void => {};
  const verifierGate = new Promise<void>((resolve) => {
    releaseVerifier = resolve;
  });
  let markVerifierStarted = (): void => {};
  const verifierStarted = new Promise<void>((resolve) => {
    markVerifierStarted = resolve;
  });
  let verifierCalls = 0;
  const first = prepareVerifiedKerrExternalOutputForComparisonReview(
    concurrentInput,
    async (receivedSubject, receivedDecision, receivedSignatureBytes) => {
      verifierCalls += 1;
      markVerifierStarted();
      await verifierGate;
      return mappingVerifierReceipt(
        receivedSubject,
        receivedDecision,
        receivedSignatureBytes,
      );
    },
  );
  await verifierStarted;
  try {
    await assert.rejects(
      prepareVerifiedKerrExternalOutputForComparisonReview(
        concurrentInput,
        (receivedSubject, receivedDecision, receivedSignatureBytes) =>
          mappingVerifierReceipt(
            receivedSubject,
            receivedDecision,
            receivedSignatureBytes,
          ),
      ),
      /already attempted comparison-review preparation/,
    );
  } finally {
    releaseVerifier();
  }
  const preparation = await first;
  assert.equal(preparation.comparisonReviewCapabilityIssued, true);
  assert.equal(verifierCalls, 1);
});

test("mapping verifier throws and binding mismatches permanently burn the admission", async () => {
  const scenarios = [
    {
      name: "verifier throw",
      verifier: () => {
        throw new Error("mapping verifier unavailable");
      },
      error: /mapping verifier unavailable/,
    },
    {
      name: "verifier binding mismatch",
      verifier: (
        receivedSubject: KerrExternalMappingReviewSubject,
        receivedDecision: KerrExternalMappingReviewDecision,
        receivedSignatureBytes: Uint8Array,
      ) =>
        mappingVerifierReceipt(
          receivedSubject,
          receivedDecision,
          receivedSignatureBytes,
          mappingPreparedAt,
          { subjectCanonicalSha256: sha256("f") },
        ),
      error: /verifier receipt binding mismatch/,
    },
  ];
  for (const scenario of scenarios) {
    const fixture = await freshAdmissionFixture();
    const reviewSubject = mappingSubjectFor(fixture);
    const { decision, signatureEnvelopeBytes } = mappingDecisionFor(reviewSubject);
    const input = comparisonPreparationInput(
      fixture,
      reviewSubject,
      decision,
      signatureEnvelopeBytes,
    );
    await assert.rejects(
      prepareVerifiedKerrExternalOutputForComparisonReview(input, scenario.verifier),
      scenario.error,
      scenario.name,
    );
    await assert.rejects(
      prepareVerifiedKerrExternalOutputForComparisonReview(
        input,
        (receivedSubject, receivedDecision, receivedSignatureBytes) =>
          mappingVerifierReceipt(
            receivedSubject,
            receivedDecision,
            receivedSignatureBytes,
          ),
      ),
      /already attempted comparison-review preparation/,
      `${scenario.name} did not burn the admission`,
    );
  }
});

test("private prepared candidate preserves runner numerics exactly and carries no authority", async () => {
  const cycle = await freshClaimCycle();
  const sourceRow = normalizedRows(cycle.claim)[0]!;
  const distinctiveRows = [
    {
      ...sourceRow,
      screenX: 0.375,
      screenY: -0.625,
      initialMomentum: {
        pTOverEnergy: -1,
        pROverEnergy: -0.8125,
        pThetaOverEnergy: 0.4375,
        pPhiOverEnergy: -0.21875,
      },
      constants: {
        xiAngularMomentumOverEnergy: -0.21875,
        etaCarterQOverEnergySquared: 0.9375,
      },
    },
  ];
  const artifacts = artifactsFor(cycle, { rows: distinctiveRows });
  const verified = await verifyArtifacts(cycle, artifacts);
  const admission = await admitVerifiedKerrExternalOutput(
    {
      referenceBundle: bundle,
      plan,
      verifiedExecutionReceipt: verified,
      admittedAt: "2026-07-19T21:11:06Z",
    },
    (approval, context) => currentGrantReceipt(approval, context.checkedAt),
  );
  const fixture: AdmissionFixture = { cycle, artifacts, verified, admission };
  const reviewSubject = mappingSubjectFor(fixture);
  const { decision, signatureEnvelopeBytes } = mappingDecisionFor(reviewSubject);
  let verifierReceiptValue: KerrExternalMappingReviewVerifierReceipt | undefined;
  const preparation = await prepareVerifiedKerrExternalOutputForComparisonReview(
    comparisonPreparationInput(
      fixture,
      reviewSubject,
      decision,
      signatureEnvelopeBytes,
    ),
    (receivedSubject, receivedDecision, receivedSignatureBytes) => {
      verifierReceiptValue = mappingVerifierReceipt(
        receivedSubject,
        receivedDecision,
        receivedSignatureBytes,
      );
      return verifierReceiptValue;
    },
  );
  assert.ok(verifierReceiptValue);
  const expected = expectedPreparedCandidate(
    fixture,
    reviewSubject,
    decision,
    verifierReceiptValue,
  );
  const expectedRow = expected.candidate.rows[0]!;
  const admittedSourceRow = artifacts.normalizedOutput.rows[0]!;
  assert.deepEqual(
    {
      screenX: expectedRow.screenX,
      screenY: expectedRow.screenY,
      initialMomentum: expectedRow.initialMomentum,
      constants: expectedRow.constants,
      termination: expectedRow.termination,
      endpoint: expectedRow.endpoint,
    },
    {
      screenX: admittedSourceRow.screenX,
      screenY: admittedSourceRow.screenY,
      initialMomentum: admittedSourceRow.initialMomentum,
      constants: admittedSourceRow.constants,
      termination: admittedSourceRow.termination,
      endpoint: admittedSourceRow.endpoint,
    },
  );
  assert.equal(
    preparation.candidateBinding.canonicalSha256,
    kerrSha256Hex(expected.canonicalBytes),
  );
  assert.equal(
    preparation.candidateBinding.canonicalByteLength,
    expected.canonicalBytes.byteLength,
  );
  assert.equal(
    preparation.candidateBinding.candidateChecksumSha256,
    expected.candidate.candidateChecksum.value,
  );
  assert.equal(preparation.rows[0]!.preparedRowId, expectedRow.rowId);
  assert.equal(
    preparation.rows[0]!.preparedRowChecksumSha256,
    expectedRow.rowChecksum.value,
  );
  assertNoAuthority(expectedRow);
  assertNoAuthority(expected.candidate);
  assertNoAuthority(preparation);
  assert.equal(expectedRow.comparisonExecuted, false);
  assert.equal(expected.candidate.comparisonExecuted, false);
  assert.equal(preparation.comparisonExecuted, false);
});

test("receipt-bound numeric comparison consumes an exact-reference candidate into one canonical result", async () => {
  const fixture = await freshPreparedComparisonFixture();
  const expectedPrepared = expectedPreparedCandidate(
    fixture.admissionFixture,
    fixture.reviewSubject,
    fixture.decision,
    fixture.verifierReceipt,
  );
  const preparedRowBytes = encoder.encode(
    kerrStableStringify(expectedPrepared.candidate.rows[0]),
  ).byteLength;
  const preparedFixedBytes = encoder.encode(
    kerrStableStringify({ ...expectedPrepared.candidate, rows: [] }),
  ).byteLength;
  const projectedMaximumPreparedCandidateBytes =
    preparedFixedBytes +
    KERR_COMPARISON_MAX_TOTAL_PIXELS * preparedRowBytes +
    (KERR_COMPARISON_MAX_TOTAL_PIXELS - 1);
  assert.ok(
    Math.ceil(projectedMaximumPreparedCandidateBytes * 1.25) <=
      KERR_RECEIPT_BOUND_PREPARED_CANDIDATE_MAX_CANONICAL_BYTES,
    "prepared-candidate ceiling must retain at least 25% representative max-grid serialization headroom",
  );
  const comparison = consumePreparedKerrExternalComparisonReview({
    preparation: fixture.preparation,
    comparedAt: comparisonConsumedAt,
  });

  assert.deepEqual(
    ReceiptBoundKerrExternalNumericComparisonSchema.parse(comparison),
    comparison,
  );
  assert.doesNotThrow(() =>
    assertIssuedReceiptBoundKerrExternalNumericComparison(comparison),
  );
  assert.doesNotThrow(() =>
    assertReceiptBoundKerrExternalNumericComparisonSelfIntegrity(comparison),
  );
  assert.doesNotThrow(() =>
    assertReceiptBoundKerrExternalNumericComparisonIntegrity(comparison),
  );
  assert.equal(
    comparison.preparationBinding.preparationId,
    fixture.preparation.preparationId,
  );
  assert.equal(
    comparison.preparationBinding.preparationChecksumSha256,
    fixture.preparation.preparationChecksum.value,
  );
  assert.deepEqual(comparison.tolerances, KERR_COMPARISON_PROVISIONAL_TOLERANCES);
  assert.equal(
    comparison.preparedCandidateCanonicalByteCeiling,
    KERR_RECEIPT_BOUND_PREPARED_CANDIDATE_MAX_CANONICAL_BYTES,
  );
  assert.equal(
    comparison.numericComparisonCanonicalByteCeiling,
    KERR_RECEIPT_BOUND_NUMERIC_COMPARISON_MAX_CANONICAL_BYTES,
  );
  assert.deepEqual(comparison.summary.dispositionCounts, {
    withinTolerance: 1,
    disagreed: 0,
    inconclusive: 0,
    incompatibleConventions: 0,
  });
  assert.equal(
    comparison.summary.numericAgreement,
    "within-pre-registered-tolerance",
  );
  const comparedRow = comparison.rows[0]!;
  const sourceRow = fixture.artifacts.normalizedOutput.rows[0]!;
  assert.deepEqual(comparedRow.reasons, []);
  assert.deepEqual(comparedRow.candidateNumerics, {
    screenX: sourceRow.screenX,
    screenY: sourceRow.screenY,
    termination: sourceRow.termination,
    initialMomentum: sourceRow.initialMomentum,
    constants: sourceRow.constants,
    endpoint: sourceRow.endpoint,
  });
  const canonicalByteLength = encoder.encode(
    kerrStableStringify(comparison),
  ).byteLength;
  const comparisonRowBytes = encoder.encode(
    kerrStableStringify(comparison.rows[0]),
  ).byteLength;
  const comparisonFixedBytes = encoder.encode(
    kerrStableStringify({ ...comparison, rows: [] }),
  ).byteLength;
  const projectedMaximumComparisonBytes =
    comparisonFixedBytes +
    KERR_COMPARISON_MAX_TOTAL_PIXELS * comparisonRowBytes +
    (KERR_COMPARISON_MAX_TOTAL_PIXELS - 1);
  assert.ok(
    Math.ceil(projectedMaximumComparisonBytes * 1.25) <=
      KERR_RECEIPT_BOUND_NUMERIC_COMPARISON_MAX_CANONICAL_BYTES,
    "numeric-comparison ceiling must retain at least 25% representative max-grid serialization headroom",
  );
  assert.ok(
    canonicalByteLength <=
      KERR_RECEIPT_BOUND_NUMERIC_COMPARISON_MAX_CANONICAL_BYTES,
  );
  assert.ok(canonicalByteLength < 2 * 1024 * 1024);
});

test("receipt-bound disagreements retain runner numerics and match the legacy numeric oracle", async () => {
  const fixture = await freshPreparedComparisonFixture({
    mutateRows(rows) {
      const endpoint = mutableRecord(rows[0]!.endpoint);
      endpoint.phiWinding = (endpoint.phiWinding as number) + 1;
      endpoint.radiusRg = (endpoint.radiusRg as number) + 2e-9;
      endpoint.thetaRadians = (endpoint.thetaRadians as number) + 3e-6;
      const momentum = mutableRecord(endpoint.momentum);
      momentum.pROverEnergy =
        (momentum.pROverEnergy as number) + 1e-3;
    },
  });
  const comparison = consumePreparedKerrExternalComparisonReview({
    preparation: fixture.preparation,
    comparedAt: comparisonConsumedAt,
  });
  const oracle = legacyOracleForPreparedFixture(fixture);

  assert.deepEqual(numericRowProjection(comparison.rows), numericRowProjection(oracle.rows));
  assert.deepEqual(
    commonNumericSummaryProjection(comparison.summary),
    commonNumericSummaryProjection(oracle.summary),
  );
  assert.equal(comparison.rows[0]!.disposition, "disagreed");
  assert.deepEqual(comparison.rows[0]!.reasons, [
    "phi-winding-mismatch",
    "event-radius-mismatch",
    "endpoint-direction-mismatch",
    "endpoint-normalized-momentum-mismatch",
  ]);
  assert.equal(comparison.summary.numericAgreement, "disagreed");
  assert.deepEqual(
    comparison.rows[0]!.candidateNumerics.endpoint,
    fixture.artifacts.normalizedOutput.rows[0]!.endpoint,
  );
});

test("receipt-bound comparison records unresolved runner outcomes as inconclusive", async () => {
  const fixture = await freshPreparedComparisonFixture({
    mutateRows(rows) {
      rows[0]!.termination = "indeterminate-limit";
      rows[0]!.endpoint = null;
    },
  });
  const comparison = consumePreparedKerrExternalComparisonReview({
    preparation: fixture.preparation,
    comparedAt: comparisonConsumedAt,
  });
  const row = comparison.rows[0]!;

  assert.equal(row.candidateTermination, "indeterminate-limit");
  assert.equal(row.candidateNumerics.termination, "indeterminate-limit");
  assert.equal(row.candidateNumerics.endpoint, null);
  assert.equal(row.endpointComparison, null);
  assert.equal(row.disposition, "inconclusive");
  assert.deepEqual(row.reasons, ["candidate-unresolved"]);
  assert.equal(comparison.summary.comparableEndpointCount, 0);
  assert.equal(comparison.summary.numericAgreement, "inconclusive");
});

test("camera-and-solver screen mismatch is preserved and never adjudicated with an invented tolerance", async () => {
  const fixture = await freshPreparedComparisonFixture({
    mutateRows(rows) {
      rows[0]!.screenX = (rows[0]!.screenX as number) + 0.25;
    },
  });
  const comparison = consumePreparedKerrExternalComparisonReview({
    preparation: fixture.preparation,
    comparedAt: comparisonConsumedAt,
  });
  const row = comparison.rows[0]!;
  const reference = fixture.plan.cases[0]!.rays[0]!;
  const source = fixture.artifacts.normalizedOutput.rows[0]!;

  assert.deepEqual(row.screenComparison, {
    referenceScreenX: reference.screenX,
    referenceScreenY: reference.screenY,
    candidateScreenX: source.screenX,
    candidateScreenY: source.screenY,
    screenXAbsoluteDelta: 0.25,
    screenYAbsoluteDelta: 0,
    matchesExactly: false,
    tolerancePolicy: "no-pre-registered-camera-screen-tolerance",
  });
  assert.equal(row.candidateNumerics.screenX, source.screenX);
  assert.equal(row.disposition, "inconclusive");
  assert.deepEqual(row.reasons, [
    "camera-screen-coordinate-delta-not-adjudicated",
  ]);
  assert.equal(
    row.referenceOutcomeValuesCopiedIntoCandidateNumericsByPackage,
    false,
  );
  assert.equal(comparison.summary.screenCoordinateMismatchCount, 1);
  assert.equal(comparison.summary.maxScreenXAbsoluteDelta, 0.25);
  assert.equal(comparison.cameraScreenToleranceInventedAfterExecution, false);
});

test("antipodal endpoint roundoff clamps the valid sphere chord instead of burning comparison", async () => {
  let rawSphereChord = 0;
  const fixture = await freshPreparedComparisonFixture({
    mutateRows(rows, comparisonPlan) {
      const reference =
        comparisonPlan.cases[0]!.rays[0]!.referenceOutcome.endpoint;
      let candidateTheta = Math.PI - reference.thetaRadians;
      let candidatePhi = reference.phiWrappedRadians + Math.PI;
      for (let index = 0; index < 4; index += 1) {
        candidateTheta = adjacentFloat(candidateTheta, "down");
        candidatePhi = adjacentFloat(candidatePhi, "up");
      }
      const endpoint = mutableRecord(rows[0]!.endpoint);
      endpoint.thetaRadians = candidateTheta;
      endpoint.phiWrappedRadians = candidatePhi;
      rawSphereChord = Math.hypot(
        Math.sin(reference.thetaRadians) *
          Math.cos(reference.phiWrappedRadians) -
          Math.sin(candidateTheta) * Math.cos(candidatePhi),
        Math.sin(reference.thetaRadians) *
          Math.sin(reference.phiWrappedRadians) -
          Math.sin(candidateTheta) * Math.sin(candidatePhi),
        Math.cos(reference.thetaRadians) - Math.cos(candidateTheta),
      );
    },
  });
  assert.ok(rawSphereChord > 2);

  const comparison = consumePreparedKerrExternalComparisonReview({
    preparation: fixture.preparation,
    comparedAt: comparisonConsumedAt,
  });
  const oracle = legacyOracleForPreparedFixture(fixture);
  assert.equal(comparison.rows[0]!.endpointComparison!.sphereChord, 2);
  assert.equal(oracle.rows[0]!.endpointComparison!.sphereChord, 2);
  assert.equal(comparison.rows[0]!.disposition, "disagreed");
  assert.deepEqual(comparison.rows[0]!.reasons, [
    "endpoint-direction-mismatch",
  ]);
  assert.equal(comparison.summary.maxEndpointSphereChord, 2);
  assert.equal(comparison.summary.rmsEndpointSphereChord, 2);
});

test("comparison clone and chronology preflights do not burn the issued preparation, while replay does", async () => {
  const fixture = await freshPreparedComparisonFixture();
  const structuralCopy = structuredClone(fixture.preparation);
  assert.deepEqual(
    PreparedKerrExternalComparisonReviewSchema.parse(structuralCopy),
    fixture.preparation,
  );
  assert.throws(
    () =>
      consumePreparedKerrExternalComparisonReview({
        preparation: structuralCopy,
        comparedAt: comparisonConsumedAt,
      }),
    /must be issued in this process/,
  );

  let accessorReads = 0;
  const accessorInput = { preparation: fixture.preparation } as {
    preparation: typeof fixture.preparation;
    comparedAt: unknown;
  };
  Object.defineProperty(accessorInput, "comparedAt", {
    enumerable: true,
    get() {
      accessorReads += 1;
      return comparisonConsumedAt;
    },
  });
  assert.throws(
    () => consumePreparedKerrExternalComparisonReview(accessorInput),
    /must be an own data property/,
  );
  assert.equal(accessorReads, 0);
  assert.throws(
    () =>
      consumePreparedKerrExternalComparisonReview({
        preparation: fixture.preparation,
        comparedAt: "2026-07-19T21:11:08Z",
      }),
    /outside the declared mapping-review chronology/,
  );
  assert.throws(() =>
    consumePreparedKerrExternalComparisonReview({
      preparation: fixture.preparation,
      comparedAt: "2026-07-19T21:11:10.000Z",
    }),
  );
  assert.throws(
    () =>
      consumePreparedKerrExternalComparisonReview({
        preparation: fixture.preparation,
        comparedAt: mappingDecisionExpiresAt,
      }),
    /outside the declared mapping-review chronology/,
  );

  const comparison = consumePreparedKerrExternalComparisonReview({
    preparation: fixture.preparation,
    comparedAt: comparisonConsumedAt,
  });
  assert.doesNotThrow(() =>
    assertIssuedReceiptBoundKerrExternalNumericComparison(comparison),
  );
  assert.throws(
    () =>
      consumePreparedKerrExternalComparisonReview({
        preparation: fixture.preparation,
        comparedAt: comparisonConsumedAt,
      }),
    /already attempted numeric comparison/,
  );
});

test("comparedAt proxy reentrancy can issue only one receipt-bound comparison", async () => {
  const fixture = await freshPreparedComparisonFixture();
  let nestedResult: ReceiptBoundKerrExternalNumericComparison | undefined;
  let nestedIssueCount = 0;
  let reentered = false;
  const input = new Proxy(
    {
      preparation: fixture.preparation,
      comparedAt: comparisonConsumedAt,
    },
    {
      getOwnPropertyDescriptor(target, property) {
        if (property === "comparedAt" && !reentered) {
          reentered = true;
          nestedResult = consumePreparedKerrExternalComparisonReview({
            preparation: fixture.preparation,
            comparedAt: comparisonConsumedAt,
          });
          nestedIssueCount += 1;
        }
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    },
  );

  assert.throws(
    () => consumePreparedKerrExternalComparisonReview(input),
    /already attempted numeric comparison/,
  );
  assert.equal(nestedIssueCount, 1);
  assert.ok(nestedResult);
  assert.doesNotThrow(() =>
    assertReceiptBoundKerrExternalNumericComparisonIntegrity(nestedResult),
  );
  assert.throws(
    () =>
      consumePreparedKerrExternalComparisonReview({
        preparation: fixture.preparation,
        comparedAt: comparisonConsumedAt,
      }),
    /already attempted numeric comparison/,
  );
});

test("unsafe winding arithmetic fails only after burn and permanently consumes preparation", async () => {
  const windingBundle = referenceBundle(-30);
  const windingPlan = planFor(windingBundle);
  assert.equal(
    windingPlan.cases[0]!.rays[0]!.referenceOutcome.endpoint.phiWinding,
    -1,
  );
  const fixture = await freshPreparedComparisonFixture({
    referenceBundle: windingBundle,
    comparisonPlan: windingPlan,
    mutateRows(rows) {
      const endpoint = mutableRecord(rows[0]!.endpoint);
      endpoint.phiWinding = Number.MAX_SAFE_INTEGER;
    },
  });

  assert.throws(
    () =>
      consumePreparedKerrExternalComparisonReview({
        preparation: fixture.preparation,
        comparedAt: comparisonConsumedAt,
      }),
    /azimuth winding delta is unsafe/,
  );
  assert.throws(
    () =>
      consumePreparedKerrExternalComparisonReview({
        preparation: fixture.preparation,
        comparedAt: comparisonConsumedAt,
      }),
    /already attempted numeric comparison/,
  );
});

test("issued numeric comparisons are immutable no-authority capabilities with distinct self and issuer integrity", async () => {
  const fixture = await freshPreparedComparisonFixture();
  const comparison = consumePreparedKerrExternalComparisonReview({
    preparation: fixture.preparation,
    comparedAt: comparisonConsumedAt,
  });

  assertNoAuthority(comparison);
  for (const row of comparison.rows) {
    assertNoScientificAuthority(row);
    assert.equal(
      row.referenceOutcomeValuesCopiedIntoCandidateNumericsByPackage,
      false,
    );
  }
  assert.equal(comparison.exactRetainedEvidenceBytesRechecked, true);
  assert.equal(comparison.referenceOutcomesAccessedForNumericComparison, true);
  assert.equal(comparison.comparisonRecordContainsReferenceDerivedMetrics, true);
  assert.equal(comparison.comparisonRecordRemainsAnswerBlinded, false);
  assert.equal(comparison.structuredReferenceOutcomesSentByPackageToRunner, false);
  assert.equal(
    comparison.mappingFreeTextAbsenceOfReferenceDataVerifiedByPackage,
    false,
  );
  assert.equal(comparison.answerBlindingVerifiedByPackage, false);
  assert.equal(
    comparison.coordinateTimeAndAffineParameterDeltasAreDiagnosticOnly,
    true,
  );
  assert.equal(
    comparison.aggregateNumericAgreementAdjudicatesCoordinateTimeOrAffineParameter,
    false,
  );
  assert.equal(comparison.futureScientificReviewConsumerImplemented, true);
  assert.equal(comparison.comparisonCapabilityConsumedAtIssuance, false);
  assert.equal(comparison.durableComparisonRecorded, false);
  assert.equal(comparison.comparisonTimeAuthenticatedByPackage, false);
  assert.equal(comparison.declaredComparisonChronologyChecked, true);
  assert.equal(
    canUseReceiptBoundKerrExternalNumericComparisonForRender(comparison),
    false,
  );
  assertDeepFrozen(comparison);
  assert.doesNotThrow(() =>
    assertReceiptBoundKerrExternalNumericComparisonIntegrity(comparison),
  );

  const structuralCopy = structuredClone(comparison);
  assert.deepEqual(
    ReceiptBoundKerrExternalNumericComparisonSchema.parse(structuralCopy),
    comparison,
  );
  assert.doesNotThrow(() =>
    assertReceiptBoundKerrExternalNumericComparisonSelfIntegrity(structuralCopy),
  );
  assert.throws(
    () => assertIssuedReceiptBoundKerrExternalNumericComparison(structuralCopy),
    /must be issued in this process/,
  );
  assert.throws(
    () => assertReceiptBoundKerrExternalNumericComparisonIntegrity(structuralCopy),
    /must be issued in this process/,
  );
  assert.equal(
    canUseReceiptBoundKerrExternalNumericComparisonForRender(structuralCopy),
    false,
  );

  const tampered = structuredClone(comparison);
  tampered.rows[0]!.candidateNumerics.screenX += 0.125;
  assert.throws(() =>
    assertReceiptBoundKerrExternalNumericComparisonSelfIntegrity(tampered),
  );
});

test("two distinct signed scientific roles record one exact clean comparison without gaining authority", async () => {
  const fixture = await freshScientificReviewSubject();
  const entries = scientificReviewEntries(fixture.subject);
  assert.equal(
    fixture.subject.policyVersion,
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_POLICY_VERSION,
  );
  assert.deepEqual(fixture.subject.requiredRoles, [
    "relativistic-physics",
    "numerical-methods",
  ]);
  assert.ok(
    Date.parse(fixture.subject.frozenAt) > Date.parse(selectionExpiresAt),
  );
  assert.deepEqual(
    KerrExternalScientificReviewSubjectSchema.parse(fixture.subject),
    fixture.subject,
  );
  assert.doesNotThrow(() =>
    assertKerrExternalScientificReviewSubjectSelfIntegrity(fixture.subject),
  );
  assert.doesNotThrow(() =>
    assertKerrExternalScientificReviewSubjectIntegrity(
      fixture.comparison,
      fixture.subject,
    ),
  );
  assert.equal(
    fixture.subject.comparisonBinding.comparisonId,
    fixture.comparison.comparisonId,
  );
  assert.equal(
    fixture.subject.comparisonBinding.machineSupportOpinionEligible,
    true,
  );
  assert.equal(
    fixture.subject.evidenceLimitations.reviewerAssignmentsDeclaredByCaller,
    true,
  );
  assert.equal(
    fixture.subject.evidenceLimitations
      .reviewerAssignmentAuthorityAuthenticatedByPackage,
    false,
  );
  assert.equal(
    fixture.subject.evidenceLimitations.reviewerQualificationsVerifiedByPackage,
    false,
  );
  assert.equal(
    fixture.subject.evidenceLimitations.reviewerConflictClearanceVerifiedByPackage,
    false,
  );
  assert.equal(
    fixture.subject.evidenceLimitations
      .reviewerCredentialValidityAndRevocationVerifiedByPackage,
    false,
  );
  assertNoAuthority(fixture.subject);

  const structuralSubject = structuredClone(fixture.subject);
  assert.deepEqual(
    KerrExternalScientificReviewSubjectSchema.parse(structuralSubject),
    fixture.subject,
  );
  assert.doesNotThrow(() =>
    assertKerrExternalScientificReviewSubjectSelfIntegrity(structuralSubject),
  );
  assert.throws(
    () =>
      assertKerrExternalScientificReviewSubjectIntegrity(
        fixture.comparison,
        structuralSubject,
      ),
    /must be issued in this process/,
  );

  const structuralDecision = structuredClone(entries[0]!.decision);
  assert.deepEqual(
    KerrExternalScientificReviewDecisionSchema.parse(structuralDecision),
    entries[0]!.decision,
  );
  assert.throws(
    () =>
      assertKerrExternalScientificReviewDecisionIntegrity(
        fixture.subject,
        structuralDecision,
        entries[0]!.signatureEnvelopeBytes,
      ),
    /must be issued in this process/,
  );

  for (const entry of entries) {
    assert.equal(entry.statement.subjectFrozenAt, fixture.subject.frozenAt);
    assert.deepEqual(
      KerrExternalScientificReviewDecisionStatementSchema.parse(
        entry.statement,
      ),
      entry.statement,
    );
    assert.deepEqual(
      KerrExternalScientificReviewDecisionSchema.parse(entry.decision),
      entry.decision,
    );
    assert.doesNotThrow(() =>
      assertKerrExternalScientificReviewDecisionIntegrity(
        fixture.subject,
        entry.decision,
        entry.signatureEnvelopeBytes,
      ),
    );
    assertNoAuthority(entry.decision);
  }
  const impossibleStatementChronology = structuredClone(entries[0]!.statement);
  mutableRecord(impossibleStatementChronology).subjectFrozenAt =
    "2026-07-19T22:02:01Z";
  assert.throws(
    () =>
      KerrExternalScientificReviewDecisionStatementSchema.parse(
        impossibleStatementChronology,
      ),
    /chronology, support eligibility, or observed reasons are inconsistent/,
  );

  const verifiedRoles: string[] = [];
  const record = await recordReceiptBoundKerrExternalScientificReviewOpinions(
    scientificReviewRecordInput(fixture, entries),
    (
      receivedComparison,
      receivedSubject,
      receivedDecision,
      receivedSignatureEnvelopeBytes,
      checkedAt,
    ) => {
      assert.strictEqual(receivedComparison, fixture.comparison);
      assert.deepEqual(receivedSubject, fixture.subject);
      assert.strictEqual(receivedSubject, fixture.subject);
      assert.equal(checkedAt, scientificReviewRecordedAt);
      const sourceEntry = entries.find(
        ({ decision }) =>
          decision.statement.role === receivedDecision.statement.role,
      );
      assert.ok(sourceEntry);
      assert.deepEqual(receivedDecision, sourceEntry.decision);
      assert.strictEqual(receivedDecision, sourceEntry.decision);
      assert.deepEqual(
        receivedSignatureEnvelopeBytes,
        sourceEntry.signatureEnvelopeBytes,
      );
      assert.notStrictEqual(
        receivedSignatureEnvelopeBytes,
        sourceEntry.signatureEnvelopeBytes,
      );
      verifiedRoles.push(receivedDecision.statement.role);
      const receipt = scientificReviewVerifierReceipt(
        receivedComparison,
        receivedSubject,
        receivedDecision,
        receivedSignatureEnvelopeBytes,
        checkedAt,
      );
      assert.deepEqual(
        KerrExternalScientificReviewVerifierReceiptSchema.parse(receipt),
        receipt,
      );
      receivedSignatureEnvelopeBytes[0] ^= 0xff;
      return receipt;
    },
  );

  assert.deepEqual(verifiedRoles, KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES);
  assert.deepEqual(
    ReceiptBoundKerrExternalScientificOpinionRecordSchema.parse(record),
    record,
  );
  assert.equal(KERR_COMPARISON_MAX_TOTAL_PIXELS, 625);
  const representativeMaximumReviewedRow = {
    ...record.reviewedRows[0]!,
    caseOrdinal: 7,
    rayOrdinal: KERR_COMPARISON_MAX_TOTAL_PIXELS - 1,
    caseId: `krcase_${"z".repeat(64)}`,
    disposition: "incompatible-conventions",
    reasons: KERR_NUMERIC_COMPARISON_REASON_ORDER,
  };
  const reviewedRowBytes = encoder.encode(
    kerrStableStringify(representativeMaximumReviewedRow),
  ).byteLength;
  const recordFixedBytes = encoder.encode(
    kerrStableStringify({ ...record, reviewedRows: [] }),
  ).byteLength;
  const projectedMaximumRecordBytes =
    recordFixedBytes +
    KERR_COMPARISON_MAX_TOTAL_PIXELS * reviewedRowBytes +
    (KERR_COMPARISON_MAX_TOTAL_PIXELS - 1);
  assert.ok(
    Math.ceil(projectedMaximumRecordBytes * 1.25) <=
      KERR_EXTERNAL_SCIENTIFIC_REVIEW_RECORD_MAX_CANONICAL_BYTES,
    "scientific-review record ceiling must retain at least 25% max-grid serialization headroom",
  );
  assert.deepEqual(
    record.reviews.map(({ role }) => role),
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES,
  );
  assert.deepEqual(
    record.reviews.map(({ decidedAt, expiresAt }) => ({ decidedAt, expiresAt })),
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES.map(() => ({
      decidedAt: scientificReviewDecidedAt,
      expiresAt: scientificReviewExpiresAt,
    })),
  );
  assert.equal(
    record.comparisonBinding.orderedRowDispositionAndReasonsSha256,
    fixture.subject.comparisonBinding.orderedRowDispositionAndReasonsSha256,
  );
  assert.deepEqual(record.opinionCounts, {
    supportsProvisionalBoundedVacuumMetricAgreement: 2,
    doesNotSupportProvisionalBoundedVacuumMetricAgreement: 0,
    insufficientEvidence: 0,
  });
  assert.equal(
    record.aggregateOpinion,
    "unanimous-provisional-support-recorded",
  );
  assert.equal(record.sourceComparisonCapabilityConsumedInProcess, true);
  assert.equal(record.exactPrivateComparisonContextReplayed, true);
  assert.equal(record.injectedScientificVerifierAuthorityAuthenticatedByPackage, false);
  assert.equal(record.reviewerAssignmentsDeclaredByCaller, true);
  assert.equal(record.reviewerAssignmentAuthorityAuthenticatedByPackage, false);
  assert.equal(record.reviewerQualificationsVerifiedByPackage, false);
  assert.equal(record.reviewerConflictClearanceVerifiedByPackage, false);
  assert.equal(
    record.reviewerCredentialValidityAndRevocationVerifiedByPackage,
    false,
  );
  assert.equal(record.currentEvidenceEligibleForScientificValidation, false);
  assert.equal(record.scientificAdjudicationEstablishedByPackage, false);
  assert.equal(record.nonAuthoritativePrerequisiteRecordCapabilityIssued, true);
  assert.equal(
    record.authenticationOfThisRecordAloneCanEstablishScientificValidation,
    false,
  );
  assert.deepEqual(record.futureScientificValidationPrerequisitesStillRequired, {
    realExternalExecution: true,
    authenticatedSourceExecutableAndNormalizerLineage: true,
    verifiedMappingCorrectness: true,
    verifiedImplementationIndependence: true,
    authenticatedReviewerAuthorityQualificationsAndConflictClearance: true,
    authoritativeTimeAndRevocation: true,
    durableEvidencePreservation: true,
  });
  assert.equal(record.futureAuthenticatedValidationConsumerImplemented, false);
  assert.equal(record.durableScientificReviewRecorded, false);
  assert.equal(record.adjudicationTimeAuthenticatedByPackage, false);
  assertNoAuthority(record);
  assertDeepFrozen(record);
  assert.doesNotThrow(() =>
    assertIssuedReceiptBoundKerrExternalScientificOpinionRecord(record),
  );
  assert.doesNotThrow(() =>
    assertReceiptBoundKerrExternalScientificOpinionRecordSelfIntegrity(record),
  );
  assert.doesNotThrow(() =>
    assertReceiptBoundKerrExternalScientificOpinionRecordIntegrity(record),
  );
  assert.equal(
    canUseReceiptBoundKerrExternalScientificOpinionRecordForRender(record),
    false,
  );
  assert.equal(
    canUseReceiptBoundKerrExternalScientificOpinionRecordForRelease(record),
    false,
  );

  const structuralCopy = structuredClone(record);
  assert.doesNotThrow(() =>
    assertReceiptBoundKerrExternalScientificOpinionRecordSelfIntegrity(
      structuralCopy,
    ),
  );
  assert.throws(
    () =>
      assertIssuedReceiptBoundKerrExternalScientificOpinionRecord(
        structuralCopy,
      ),
    /must be issued in this process/,
  );
  assert.throws(
    () =>
      assertReceiptBoundKerrExternalScientificOpinionRecordIntegrity(
        structuralCopy,
      ),
    /must be issued in this process/,
  );
  assert.equal(
    canUseReceiptBoundKerrExternalScientificOpinionRecordForRender(
      structuralCopy,
    ),
    false,
  );
  assert.equal(
    canUseReceiptBoundKerrExternalScientificOpinionRecordForRelease(
      structuralCopy,
    ),
    false,
  );
  const impossibleRecordChronology = structuredClone(record);
  const impossibleReview = (
    mutableRecord(impossibleRecordChronology).reviews as unknown[]
  )[0];
  mutableRecord(impossibleReview).decidedAt = "2026-07-19T22:04:00Z";
  assert.throws(
    () =>
      ReceiptBoundKerrExternalScientificOpinionRecordSchema.parse(
        impossibleRecordChronology,
      ),
    /record chronology is inconsistent/,
  );
});

test("non-within comparison prohibits support and records negative opinions as terminal evidence", async () => {
  const fixture = await freshScientificReviewSubject({
    mutateRows(rows) {
      const endpoint = mutableRecord(rows[0]!.endpoint);
      endpoint.phiWinding = (endpoint.phiWinding as number) + 1;
    },
  });
  assert.equal(fixture.comparison.summary.numericAgreement, "disagreed");
  assert.equal(
    fixture.subject.comparisonBinding.machineSupportOpinionEligible,
    false,
  );
  for (const role of KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES) {
    assert.throws(
      () => scientificReviewDecisionFor(fixture.subject, role),
      /cannot override disagreement, inconclusive results, or unadjudicated screen coordinates/,
    );
  }

  const entries = scientificReviewEntries(fixture.subject, [
    "does-not-support-provisional-bounded-vacuum-metric-agreement",
    "insufficient-evidence",
  ]);
  const record = await recordReceiptBoundKerrExternalScientificReviewOpinions(
    scientificReviewRecordInput(fixture, entries),
    verifyScientificReviewFixture,
  );
  assert.deepEqual(record.opinionCounts, {
    supportsProvisionalBoundedVacuumMetricAgreement: 0,
    doesNotSupportProvisionalBoundedVacuumMetricAgreement: 1,
    insufficientEvidence: 1,
  });
  assert.equal(record.aggregateOpinion, "opposition-recorded");
  assert.equal(record.comparisonSummary.numericAgreement, "disagreed");
  assert.equal(record.reviewedRows[0]!.disposition, "disagreed");
  assert.deepEqual(record.reviewedRows[0]!.reasons, [
    "phi-winding-mismatch",
  ]);
  const reassignedRowReason = structuredClone(record);
  const reassignedRows = mutableRecord(reassignedRowReason).reviewedRows as unknown[];
  mutableRecord(reassignedRows[0]).reasons = ["event-radius-mismatch"];
  mutableRecord(reassignedRowReason).observedReasonCodes = [
    "event-radius-mismatch",
  ];
  assert.throws(
    () =>
      ReceiptBoundKerrExternalScientificOpinionRecordSchema.parse(
        reassignedRowReason,
      ),
    /row dispositions changed/,
  );
  assert.equal(record.scientificValidationPassed, false);
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      scientificReviewRecordInput(fixture, entries),
      verifyScientificReviewFixture,
    ),
    /already attempted scientific review/,
  );
});

test("scientific review rejects structural comparison copies before burn", async () => {
  const fixture = await freshScientificReviewSubject();
  const structuralCopy = structuredClone(fixture.comparison);
  assert.deepEqual(
    ReceiptBoundKerrExternalNumericComparisonSchema.parse(structuralCopy),
    fixture.comparison,
  );
  assert.doesNotThrow(() =>
    assertReceiptBoundKerrExternalNumericComparisonSelfIntegrity(
      structuralCopy,
    ),
  );
  assert.throws(
    () =>
      createKerrExternalScientificReviewSubject({
        comparison: structuralCopy,
        frozenAt: scientificReviewFrozenAt,
        reviewerAssignments: scientificReviewerAssignments(),
      }),
    /must be issued in this process/,
  );

  const entries = scientificReviewEntries(fixture.subject);
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      {
        ...scientificReviewRecordInput(fixture, entries),
        comparison: structuralCopy,
      },
      verifyScientificReviewFixture,
    ),
    /must be issued in this process/,
  );
  const record = await recordReceiptBoundKerrExternalScientificReviewOpinions(
    scientificReviewRecordInput(fixture, entries),
    verifyScientificReviewFixture,
  );
  assert.equal(
    record.aggregateOpinion,
    "unanimous-provisional-support-recorded",
  );
});

test("scientific reviewer assignments are frozen once and separated from every actor", async () => {
  const identityFixture = await freshScientificReviewComparison();
  const identities =
    identityFixture.comparison.scientificReviewIdentitySeparationBinding;
  const priorCollisionScenarios: Array<{
    readonly name: string;
    readonly assignment: Partial<
      Omit<KerrExternalScientificReviewerAssignment, "role">
    >;
    readonly error: RegExp;
  }> = [
    {
      name: "runner id",
      assignment: { reviewerId: identities.runner.runnerId },
      error: /distinct from the receipt-declared runner/,
    },
    {
      name: "runner grant",
      assignment: { roleGrantId: identities.runner.runnerGrantId },
      error: /distinct from the receipt-declared runner/,
    },
    {
      name: "runner key",
      assignment: { keyId: identities.runner.runnerKeyId },
      error: /distinct from the receipt-declared runner/,
    },
    ...identities.selection.approvals.flatMap((approval, index) => [
      {
        name: `selection ${index} id`,
        assignment: { reviewerId: approval.reviewerId },
        error: /distinct from every selection reviewer/,
      },
      {
        name: `selection ${index} grant`,
        assignment: { roleGrantId: approval.roleGrantId },
        error: /distinct from every selection reviewer/,
      },
      {
        name: `selection ${index} key`,
        assignment: { keyId: approval.keyId },
        error: /distinct from every selection reviewer/,
      },
    ]),
    {
      name: "mapping id",
      assignment: { reviewerId: identities.mapping.reviewerId },
      error: /distinct from the mapping reviewer/,
    },
    {
      name: "mapping grant",
      assignment: { roleGrantId: identities.mapping.roleGrantId },
      error: /distinct from the mapping reviewer/,
    },
    {
      name: "mapping key",
      assignment: { keyId: identities.mapping.reviewerKeyId },
      error: /distinct from the mapping reviewer/,
    },
  ];
  for (const scenario of priorCollisionScenarios) {
    const scenarioFixture = await freshScientificReviewComparison();
    assert.throws(
      () =>
        createKerrExternalScientificReviewSubject({
          comparison: scenarioFixture.comparison,
          frozenAt: scientificReviewFrozenAt,
          reviewerAssignments: scientificReviewerAssignments({
            "relativistic-physics": scenario.assignment,
          }),
        }),
      scenario.error,
      scenario.name,
    );
  }

  for (const field of ["reviewerId", "roleGrantId", "keyId"] as const) {
    const scenarioFixture = await freshScientificReviewComparison();
    const firstIdentity = scientificReviewerIdentity("relativistic-physics");
    assert.throws(
      () =>
        createKerrExternalScientificReviewSubject({
          comparison: scenarioFixture.comparison,
          frozenAt: scientificReviewFrozenAt,
          reviewerAssignments: scientificReviewerAssignments({
            "numerical-methods": { [field]: firstIdentity[field] },
          }),
        }),
      /must use distinct identities, grants, and keys/,
      `cross-reviewer ${field}`,
    );
  }

  const fixture = await freshScientificReviewSubject();
  assert.throws(
    () =>
      createKerrExternalScientificReviewSubject({
        comparison: fixture.comparison,
        frozenAt: "2026-07-19T22:01:01Z",
        reviewerAssignments: scientificReviewerAssignments({
          "numerical-methods": { reviewerId: "reviewer-reassigned" },
        }),
      }),
    /already assigned for scientific review/,
  );

  const first = scientificReviewDecisionFor(
    fixture.subject,
    "relativistic-physics",
  );
  assert.deepEqual(
    {
      role: first.statement.role,
      reviewerId: first.statement.reviewerId,
      roleGrantId: first.statement.roleGrantId,
      keyId: first.statement.keyId,
    },
    fixture.subject.reviewerAssignments[0],
  );
  assert.throws(
    () =>
      scientificReviewDecisionFor(
        fixture.subject,
        "relativistic-physics",
      ),
    /already issued its relativistic-physics statement/,
  );
  assert.throws(
    () =>
      createKerrExternalScientificReviewDecision({
        statement: first.statement,
        signatureEnvelopeBytes:
          scientificReviewSignatureBytes("relativistic-physics"),
      }),
    /already attempted a signed decision/,
  );
  const second = scientificReviewDecisionFor(
    fixture.subject,
    "numerical-methods",
  );
  let verifierCalls = 0;
  const record = await recordReceiptBoundKerrExternalScientificReviewOpinions(
    scientificReviewRecordInput(fixture, [first, second]),
    (...received) => {
      verifierCalls += 1;
      return verifyScientificReviewFixture(...received);
    },
  );
  assert.equal(verifierCalls, 2);
  assert.equal(record.declaredTwoRoleIdentityValuesSeparatedByPackage, true);
});

test("scientific signed-byte, subject, role-order, and chronology failures remain pre-burn", async () => {
  const fixture = await freshScientificReviewSubject();
  assert.throws(
    () =>
      scientificReviewDecisionFor(fixture.subject, "relativistic-physics", {
        decidedAt: "2026-07-19T22:00:59Z",
      }),
    /chronology is invalid/,
  );
  assert.throws(
    () =>
      scientificReviewDecisionFor(fixture.subject, "relativistic-physics", {
        expiresAt: scientificReviewDecidedAt,
      }),
    /chronology is invalid/,
  );
  assert.throws(
    () =>
      scientificReviewDecisionFor(fixture.subject, "relativistic-physics", {
        expiresAt: "2026-07-27T22:02:01Z",
      }),
    /chronology is invalid/,
  );
  assert.throws(() =>
    scientificReviewDecisionFor(fixture.subject, "relativistic-physics", {
      decidedAt: "2026-07-19T22:02:00.000Z",
    }),
  );

  const entries = scientificReviewEntries(fixture.subject);
  const alternateFixture = await freshScientificReviewSubject();
  const alternateSubject = alternateFixture.subject;
  let verifierCalls = 0;
  const verifier = (...received: Parameters<typeof verifyScientificReviewFixture>) => {
    verifierCalls += 1;
    return verifyScientificReviewFixture(...received);
  };

  const changedSignature = new Uint8Array(entries[0]!.signatureEnvelopeBytes);
  changedSignature[0] ^= 0xff;
  const changedSignatureInput = scientificReviewRecordInput(fixture, entries);
  changedSignatureInput.reviews[0] = {
    decision: entries[0]!.decision,
    signatureEnvelopeBytes: changedSignature,
  };
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      changedSignatureInput,
      verifier,
    ),
    /failed exact integrity replay/,
  );
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      {
        ...scientificReviewRecordInput(fixture, entries),
        subject: alternateSubject,
      },
      verifier,
    ),
    /changed its exact issued comparison capability/,
  );
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      scientificReviewRecordInput(fixture, [...entries].reverse()),
      verifier,
    ),
    /canonical order/,
  );
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      scientificReviewRecordInput(
        fixture,
        entries,
        "2026-07-19T22:01:59Z",
      ),
      verifier,
    ),
    /outside decision validity/,
  );
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      scientificReviewRecordInput(
        fixture,
        entries,
        scientificReviewExpiresAt,
      ),
      verifier,
    ),
    /outside decision validity/,
  );
  assert.equal(verifierCalls, 0);

  const record = await recordReceiptBoundKerrExternalScientificReviewOpinions(
    scientificReviewRecordInput(fixture, entries),
    verifier,
  );
  assert.equal(verifierCalls, 2);
  assert.equal(record.declaredAdjudicationChronologyChecked, true);
});

test("scientific verifier failures burn permanently and concurrent replay cannot enter", async () => {
  const throwingFixture = await freshScientificReviewSubject();
  const throwingEntries = scientificReviewEntries(throwingFixture.subject);
  let throwingCalls = 0;
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      scientificReviewRecordInput(throwingFixture, throwingEntries),
      () => {
        throwingCalls += 1;
        throw new Error("scientific verifier unavailable");
      },
    ),
    /scientific verifier unavailable/,
  );
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      scientificReviewRecordInput(throwingFixture, throwingEntries),
      verifyScientificReviewFixture,
    ),
    /already attempted scientific review/,
  );
  assert.equal(throwingCalls, 1);

  const mismatchFixture = await freshScientificReviewSubject();
  const mismatchEntries = scientificReviewEntries(mismatchFixture.subject);
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      scientificReviewRecordInput(mismatchFixture, mismatchEntries),
      (comparison, subject, decision, signatureBytes, checkedAt) =>
        scientificReviewVerifierReceipt(
          comparison,
          subject,
          decision,
          signatureBytes,
          checkedAt,
          { subjectCanonicalSha256: sha256("f") },
        ),
    ),
    /verifier receipt binding mismatch/,
  );
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      scientificReviewRecordInput(mismatchFixture, mismatchEntries),
      verifyScientificReviewFixture,
    ),
    /already attempted scientific review/,
  );

  const concurrentFixture = await freshScientificReviewSubject();
  const concurrentEntries = scientificReviewEntries(concurrentFixture.subject);
  let releaseFirstVerifier!: () => void;
  const firstVerifierGate = new Promise<void>((resolve) => {
    releaseFirstVerifier = resolve;
  });
  let concurrentVerifierCalls = 0;
  const first = recordReceiptBoundKerrExternalScientificReviewOpinions(
    scientificReviewRecordInput(concurrentFixture, concurrentEntries),
    async (comparison, subject, decision, signatureBytes, checkedAt) => {
      concurrentVerifierCalls += 1;
      if (concurrentVerifierCalls === 1) await firstVerifierGate;
      return scientificReviewVerifierReceipt(
        comparison,
        subject,
        decision,
        signatureBytes,
        checkedAt,
      );
    },
  );
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      scientificReviewRecordInput(concurrentFixture, concurrentEntries),
      verifyScientificReviewFixture,
    ),
    /already attempted scientific review/,
  );
  releaseFirstVerifier();
  const record = await first;
  assert.equal(concurrentVerifierCalls, 2);
  assert.equal(
    record.aggregateOpinion,
    "unanimous-provisional-support-recorded",
  );
});

test("scientific recordedAt proxy reentrancy can issue only one terminal record", async () => {
  const fixture = await freshScientificReviewSubject();
  const entries = scientificReviewEntries(fixture.subject);
  const ordinaryInput = scientificReviewRecordInput(fixture, entries);
  let nestedPromise:
    | ReturnType<typeof recordReceiptBoundKerrExternalScientificReviewOpinions>
    | undefined;
  let reentered = false;
  let verifierCalls = 0;
  const verifier = (...received: Parameters<typeof verifyScientificReviewFixture>) => {
    verifierCalls += 1;
    return verifyScientificReviewFixture(...received);
  };
  const proxiedInput = new Proxy(ordinaryInput, {
    getOwnPropertyDescriptor(target, property) {
      if (property === "recordedAt" && !reentered) {
        reentered = true;
        nestedPromise =
          recordReceiptBoundKerrExternalScientificReviewOpinions(
            ordinaryInput,
            verifier,
          );
      }
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });

  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      proxiedInput,
      verifier,
    ),
    /already attempted scientific review/,
  );
  assert.ok(nestedPromise);
  const record = await nestedPromise;
  assert.equal(verifierCalls, 2);
  assert.doesNotThrow(() =>
    assertReceiptBoundKerrExternalScientificOpinionRecordIntegrity(record),
  );
  await assert.rejects(
    recordReceiptBoundKerrExternalScientificReviewOpinions(
      ordinaryInput,
      verifier,
    ),
    /already attempted scientific review/,
  );
});

function legacyCandidate(
  evidenceClass: "caller-declared-external-run" | "synthetic-test-fixture",
) {
  const rows = plan.cases.flatMap((planCase) =>
    planCase.rays.map((ray) => ({
      schemaVersion: "1.0.0",
      state: "normalized-unreviewed-declared-external-kerr-ray",
      planId: plan.planId,
      planChecksum: plan.planChecksum,
      caseId: planCase.caseId,
      scientificRole: planCase.scientificRole,
      requestId: planCase.request.requestId,
      requestChecksum: planCase.request.requestChecksum,
      referenceReportId: planCase.report.reportId,
      referenceReportChecksum: planCase.report.reportChecksum,
      referenceRayId: ray.rayId,
      referenceRayChecksum: ray.rayChecksum,
      pixelIndex: ray.pixelIndex,
      pixelX: ray.pixelX,
      pixelY: ray.pixelY,
      screenX: ray.screenX,
      screenY: ray.screenY,
      termination: "indeterminate-limit",
      initialMomentum: {
        pTOverEnergy: -1,
        pROverEnergy: -0.25,
        pThetaOverEnergy: 0,
        pPhiOverEnergy: 0.125,
      },
      constants: {
        xiAngularMomentumOverEnergy: 0.125,
        etaCarterQOverEnergySquared: 0.25,
      },
      endpoint: null,
      mappingReview: "not-run",
      sourceExecutionReview: "not-run",
      independentReference: "not-run",
      ...KERR_EXTERNAL_OUTPUT_NO_AUTHORITY,
    })),
  );
  const normalizedOutput = createKerrExternalNormalizedOutput({
    referenceBundle: bundle,
    plan,
    generatedAt: "2026-07-19T21:02:34Z",
    externalRun: {
      evidenceClass,
      startedAt: "2026-07-19T21:02:31Z",
      completedAt: "2026-07-19T21:02:32Z",
      rawCapturedAt: "2026-07-19T21:02:33Z",
      provenance: "caller-declared-unverified",
      runnerSuppliedByPackage: false,
      executionVerified: false,
    },
    rows,
  });
  const rawBytes = encoder.encode(`legacy-${evidenceClass}\n`);
  const normalizedBytes = canonicalKerrExternalNormalizedOutputBytes(normalizedOutput);
  return createKerrExternalOutputCandidate({
    referenceBundle: bundle,
    plan,
    rawBytes,
    normalizedBytes,
    normalizedOutput,
  });
}

test("legacy caller-declared and synthetic candidate objects cannot substitute for process-issued receipt capabilities", async () => {
  for (const evidenceClass of [
    "caller-declared-external-run",
    "synthetic-test-fixture",
  ] as const) {
    const candidate = legacyCandidate(evidenceClass);
    assert.equal(candidate.externalRun.evidenceClass, evidenceClass);
    assert.equal(candidate.externalRun.provenance, "caller-declared-unverified");
    assert.equal(candidate.externalRun.executionVerified, false);
    assert.throws(() => VerifiedKerrExternalExecutionReceiptSchema.parse(candidate));

    const cycle = await freshClaimCycle();
    const input = declarationInput(cycle);
    assert.throws(() =>
      createKerrExternalExecutionReceiptDeclaration({
        ...input,
        normalizedOutput: candidate as never,
      }),
    );
    await assert.rejects(
      admitVerifiedKerrExternalOutput(
        {
          referenceBundle: bundle,
          plan,
          verifiedExecutionReceipt: candidate as never,
          admittedAt: "2026-07-19T21:11:06Z",
        },
        (approval, context) => currentGrantReceipt(approval, context.checkedAt),
      ),
      /must be issued in this process/,
    );
  }
});

test("receipt module statically imports only schemas and local pure contract modules", () => {
  const source = readFileSync(
    new URL("../src/kerr-external-execution-receipt.ts", import.meta.url),
    "utf8",
  );
  const imports = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)]
    .map((match) => match[1]!)
    .sort();
  assert.deepEqual(imports, [
    "./external-kerr-output.js",
    "./kerr-comparison-plan.js",
    "./kerr-external-authorization.js",
    "./kerr-numeric-comparison-core.js",
    "./trace-contracts.js",
    "zod",
  ]);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.doesNotMatch(
    source,
    /node:(?:child_process|cluster|dgram|fs|http|https|net|tls|worker_threads)/,
  );
  assert.doesNotMatch(source, /\b(?:exec|execFile|fork|spawn|spawnSync|fetch)\s*\(/);
  assert.doesNotMatch(source, /\b(?:WebSocket|Worker)\s*\(/);
});

test("scientific-review module statically imports only local pure contract modules", () => {
  const source = readFileSync(
    new URL("../src/kerr-external-scientific-review.ts", import.meta.url),
    "utf8",
  );
  const imports = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)]
    .map((match) => match[1]!)
    .sort();
  assert.deepEqual(imports, [
    "./kerr-comparison-plan.js",
    "./kerr-external-authorization.js",
    "./kerr-external-execution-receipt.js",
    "./kerr-numeric-comparison-core.js",
    "./trace-contracts.js",
    "zod",
  ]);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.doesNotMatch(
    source,
    /node:(?:child_process|cluster|dgram|fs|http|https|net|tls|worker_threads)/,
  );
  assert.doesNotMatch(source, /\b(?:exec|execFile|fork|spawn|spawnSync|fetch)\s*\(/);
  assert.doesNotMatch(source, /\b(?:WebSocket|Worker)\s*\(/);
});
