import { z } from "zod";

import {
  KERR_COMPARISON_MAX_CANDIDATE_CANONICAL_BYTES,
  KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
  KERR_COMPARISON_MAX_PLAN_CANONICAL_BYTES,
  KERR_COMPARISON_NO_AUTHORITY,
  KerrComparisonExternalImplementationSchema,
  KerrComparisonMappingSchema,
  KerrComparisonPlanSchema,
  KerrComparisonScientificRoleSchema,
  type KerrComparisonPlan,
  type VerifiedKerrComparisonReferenceBundle,
  assertKerrComparisonPlanIntegrity,
  assertKerrComparisonPlainDataTree,
} from "./kerr-comparison-plan.js";
import {
  KERR_REFERENCE_TRACE_MAX_PIXELS,
  deepFreezeKerr,
  kerrSha256Hex,
  kerrStableStringify,
} from "./trace-contracts.js";

export const KERR_EXTERNAL_OUTPUT_POLICY_VERSION = "1.0.0" as const;
export const KERR_EXTERNAL_OUTPUT_MAX_RAW_BYTES =
  KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES;
export const KERR_EXTERNAL_OUTPUT_MAX_NORMALIZED_BYTES =
  KERR_COMPARISON_MAX_CANDIDATE_CANONICAL_BYTES;
export const KERR_EXTERNAL_OUTPUT_MAX_CANDIDATE_CANONICAL_BYTES =
  KERR_COMPARISON_MAX_PLAN_CANONICAL_BYTES;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const CanonicalTimestampSchema = z.iso.datetime({
  offset: false,
  precision: 0,
});
const BoundedFiniteSchema = z.number().finite().min(-1e12).max(1e12);
const BoundedNonnegativeSchema = z.number().finite().nonnegative().max(1e12);

const noAuthorityShape = {
  scientificValidationPassed: z.literal(false),
  independentValidationPassed: z.literal(false),
  implementationProvenanceVerified: z.literal(false),
  independenceEstablished: z.literal(false),
  sourceReviewed: z.literal(false),
  licenseVerified: z.literal(false),
  runnerEnvironmentVerified: z.literal(false),
  checksumAuthenticatesRecord: z.literal(false),
  renderAllowed: z.literal(false),
  productionUseAllowed: z.literal(false),
  placeholderReplacementAllowed: z.literal(false),
  releaseEligible: z.literal(false),
  publicationAllowed: z.literal(false),
  activationAllowed: z.literal(false),
} as const;

export const KERR_EXTERNAL_OUTPUT_NO_AUTHORITY = deepFreezeKerr({
  ...KERR_COMPARISON_NO_AUTHORITY,
  independenceEstablished: false,
} as const);

const RequestChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-reference-trace-request"),
  })
  .strict();

const ReportChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-reference-trace-report"),
  })
  .strict();

const RayChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-reference-ray-record"),
  })
  .strict();

const PlanChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-external-output-comparison-plan"),
  })
  .strict();

export const KerrExternalNormalizedMomentumSchema = z
  .object({
    pTOverEnergy: BoundedFiniteSchema,
    pROverEnergy: BoundedFiniteSchema,
    pThetaOverEnergy: BoundedFiniteSchema,
    pPhiOverEnergy: BoundedFiniteSchema,
  })
  .strict();
export type KerrExternalNormalizedMomentum = z.infer<
  typeof KerrExternalNormalizedMomentumSchema
>;

const WrappedAzimuthSchema = z
  .number()
  .finite()
  .nonnegative()
  .refine((value) => value < 2 * Math.PI, {
    message: "Wrapped Kerr azimuth must be in [0, 2 pi)",
  });

export const KerrExternalResolvedEndpointSchema = z
  .object({
    eventSurface: z.enum(["horizon-guard", "finite-escape-domain"]),
    radiusRg: z.number().finite().positive().max(1e12),
    thetaRadians: z.number().finite().min(0).max(Math.PI),
    phiWrappedRadians: WrappedAzimuthSchema,
    phiWinding: z.number().int().safe(),
    momentum: KerrExternalNormalizedMomentumSchema,
    coordinateTime: BoundedFiniteSchema,
    energyTimesAffineParameter: BoundedNonnegativeSchema,
  })
  .strict();
export type KerrExternalResolvedEndpoint = z.infer<
  typeof KerrExternalResolvedEndpointSchema
>;

const CandidateTerminationSchema = z.enum([
  "captured-horizon-guard",
  "escaped-domain",
  "coordinate-domain-exit",
  "indeterminate-limit",
  "numerical-failure",
]);

const CandidateRowPayloadSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("normalized-unreviewed-declared-external-kerr-ray"),
    planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
    planChecksum: PlanChecksumSchema,
    caseId: z.string().regex(/^krcase_[a-z0-9][a-z0-9-]{2,63}$/),
    scientificRole: KerrComparisonScientificRoleSchema,
    requestId: z.string().regex(/^krreq_[a-f0-9]{24}$/),
    requestChecksum: RequestChecksumSchema,
    referenceReportId: z.string().regex(/^krrep_[a-f0-9]{24}$/),
    referenceReportChecksum: ReportChecksumSchema,
    referenceRayId: z.string().regex(/^krray_[a-f0-9]{24}$/),
    referenceRayChecksum: RayChecksumSchema,
    pixelIndex: z
      .number()
      .int()
      .min(0)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS - 1),
    pixelX: z.number().int().min(0).max(24),
    pixelY: z.number().int().min(0).max(24),
    screenX: z.number().finite().min(-32).max(32),
    screenY: z.number().finite().min(-32).max(32),
    termination: CandidateTerminationSchema,
    initialMomentum: KerrExternalNormalizedMomentumSchema,
    constants: z
      .object({
        xiAngularMomentumOverEnergy: BoundedFiniteSchema,
        etaCarterQOverEnergySquared: BoundedFiniteSchema,
      })
      .strict(),
    endpoint: KerrExternalResolvedEndpointSchema.nullable(),
    mappingReview: z.literal("not-run"),
    sourceExecutionReview: z.literal("not-run"),
    independentReference: z.literal("not-run"),
    ...noAuthorityShape,
  })
  .strict()
  .superRefine((row, context) => {
    const resolved =
      row.termination === "captured-horizon-guard" ||
      row.termination === "escaped-domain";
    if (resolved !== (row.endpoint !== null)) {
      context.addIssue({
        code: "custom",
        path: ["endpoint"],
        message:
          "Resolved candidate outcomes require one endpoint and unresolved outcomes require null",
      });
    }
    if (
      row.endpoint !== null &&
      ((row.termination === "captured-horizon-guard" &&
        row.endpoint.eventSurface !== "horizon-guard") ||
        (row.termination === "escaped-domain" &&
          row.endpoint.eventSurface !== "finite-escape-domain"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["endpoint", "eventSurface"],
        message: "Candidate endpoint event surface does not match termination",
      });
    }
  });

const CandidateRowChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("normalized-external-kerr-output-row"),
  })
  .strict();

export const KerrExternalRunDeclarationSchema = z
  .object({
    evidenceClass: z.enum([
      "caller-declared-external-run",
      "synthetic-test-fixture",
    ]),
    startedAt: CanonicalTimestampSchema,
    completedAt: CanonicalTimestampSchema,
    rawCapturedAt: CanonicalTimestampSchema,
    provenance: z.literal("caller-declared-unverified"),
    runnerSuppliedByPackage: z.literal(false),
    executionVerified: z.literal(false),
  })
  .strict()
  .superRefine((run, context) => {
    if (
      run.completedAt < run.startedAt ||
      run.rawCapturedAt < run.completedAt
    ) {
      context.addIssue({
        code: "custom",
        message: "External Kerr run chronology is reversed",
      });
    }
  });
export type KerrExternalRunDeclaration = z.infer<
  typeof KerrExternalRunDeclarationSchema
>;

export const KerrExternalNormalizedOutputRowSchema =
  CandidateRowPayloadSchema.extend({
    rowId: z.string().regex(/^krxrow_[a-f0-9]{24}$/),
    rowChecksum: CandidateRowChecksumSchema,
  });
export type KerrExternalNormalizedOutputRow = z.infer<
  typeof KerrExternalNormalizedOutputRowSchema
>;

const NormalizedOutputChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("normalized-external-kerr-output"),
  })
  .strict();

export const KerrExternalNormalizedOutputSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "normalized-unreviewed-declared-external-kerr-output",
    ),
    normalizedOutputId: z.string().regex(/^krxout_[a-f0-9]{24}$/),
    policyVersion: z.literal(KERR_EXTERNAL_OUTPUT_POLICY_VERSION),
    generatedAt: CanonicalTimestampSchema,
    planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
    planChecksum: PlanChecksumSchema,
    comparisonScope: z.enum(["integrator-only", "camera-and-solver"]),
    externalImplementation: KerrComparisonExternalImplementationSchema,
    mapping: KerrComparisonMappingSchema,
    externalRun: KerrExternalRunDeclarationSchema,
    rows: z
      .array(KerrExternalNormalizedOutputRowSchema)
      .min(1)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
    rowCoverage: z.literal("exactly-one-row-per-planned-ray-in-plan-order"),
    mappingReview: z.literal("not-run"),
    sourceExecutionReview: z.literal("not-run"),
    sourceOutputRightsReview: z.literal("not-run"),
    independentReference: z.literal("not-run"),
    ...noAuthorityShape,
    normalizedOutputChecksum: NormalizedOutputChecksumSchema,
  })
  .strict();
export type KerrExternalNormalizedOutput = z.infer<
  typeof KerrExternalNormalizedOutputSchema
>;

const RawArtifactSchema = z
  .object({
    kind: z.literal("caller-supplied-external-native-output"),
    mediaType: z.literal("application/octet-stream"),
    encoding: z.literal("opaque-exact-bytes"),
    compression: z.literal("none"),
    archivePolicy: z.literal("recognized-signatures-rejected-no-decompression"),
    recognizedArchiveContainer: z.literal(false),
    capturedAt: CanonicalTimestampSchema,
    captureTimeProvenance: z.literal("caller-declared-unverified"),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(KERR_EXTERNAL_OUTPUT_MAX_RAW_BYTES),
    sha256: Sha256Schema,
    provenance: z.literal("caller-supplied-unverified"),
    retainedByPackage: z.literal(false),
    checksumAuthenticatesArtifact: z.literal(false),
  })
  .strict();

const NormalizedArtifactSchema = z
  .object({
    kind: z.literal("canonical-normalized-external-output"),
    mediaType: z.literal("application/json"),
    encoding: z.literal("utf-8"),
    canonicalization: z.literal("kerr-stable-json-v1"),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(KERR_EXTERNAL_OUTPUT_MAX_NORMALIZED_BYTES),
    sha256: Sha256Schema,
    normalizedOutputId: z.string().regex(/^krxout_[a-f0-9]{24}$/),
    normalizedOutputChecksum: NormalizedOutputChecksumSchema,
    provenance: z.literal("mapping-output-unreviewed"),
    retainedByPackage: z.literal(false),
    checksumAuthenticatesArtifact: z.literal(false),
  })
  .strict();

const CandidateChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("external-kerr-output-candidate"),
  })
  .strict();

export const KerrExternalOutputCandidateSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("unreviewed-declared-external-kerr-output-candidate"),
    candidateId: z.string().regex(/^krcand_[a-f0-9]{24}$/),
    policyVersion: z.literal(KERR_EXTERNAL_OUTPUT_POLICY_VERSION),
    generatedAt: CanonicalTimestampSchema,
    planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
    planChecksum: PlanChecksumSchema,
    comparisonScope: z.enum(["integrator-only", "camera-and-solver"]),
    externalImplementation: KerrComparisonExternalImplementationSchema,
    mapping: KerrComparisonMappingSchema,
    externalRun: KerrExternalRunDeclarationSchema,
    rawArtifact: RawArtifactSchema,
    normalizedArtifact: NormalizedArtifactSchema,
    rows: z
      .array(KerrExternalNormalizedOutputRowSchema)
      .min(1)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
    independentReference: z.literal("not-run"),
    independenceReview: z.literal("not-run"),
    mappingReview: z.literal("not-run"),
    sourceReview: z.literal("not-run"),
    sourceExecutionReview: z.literal("not-run"),
    sourceOutputRightsReview: z.literal("not-run"),
    candidateComparison: z.literal("not-run"),
    ...noAuthorityShape,
    candidateChecksum: CandidateChecksumSchema,
  })
  .strict();
export type KerrExternalOutputCandidate = z.infer<
  typeof KerrExternalOutputCandidateSchema
>;

function ownDataValue(input: unknown, key: string, label: string): unknown {
  if (typeof input !== "object" || input === null) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be an own data property`);
  }
  return descriptor.value;
}

function preflightExactRows(
  input: unknown,
  expectedLength: number,
  label: string,
): readonly unknown[] {
  if (!Array.isArray(input)) throw new TypeError(`${label} must be an array`);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(input, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.value !== expectedLength ||
    expectedLength < 1 ||
    expectedLength > KERR_REFERENCE_TRACE_MAX_PIXELS
  ) {
    throw new RangeError(
      `${label} must contain exactly one bounded row per planned ray`,
    );
  }
  return input;
}

function preflightBoundedRows(
  input: unknown,
  label: string,
): readonly unknown[] {
  if (!Array.isArray(input)) throw new TypeError(`${label} must be an array`);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(input, "length");
  const length =
    lengthDescriptor !== undefined && "value" in lengthDescriptor
      ? lengthDescriptor.value
      : undefined;
  if (
    typeof length !== "number" ||
    !Number.isInteger(length) ||
    length < 1 ||
    length > KERR_REFERENCE_TRACE_MAX_PIXELS
  ) {
    throw new RangeError(`${label} exceeds its bounded row count`);
  }
  return input;
}

function ownArrayDataElement(
  input: readonly unknown[],
  index: number,
  label: string,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`${label} must contain only own data elements`);
  }
  return descriptor.value;
}

function expectedRowCount(plan: KerrComparisonPlan): number {
  return plan.cases.reduce(
    (total, referenceCase) => total + referenceCase.rays.length,
    0,
  );
}

function assertCanonicalEquality(
  actual: unknown,
  expected: unknown,
  message: string,
): void {
  if (kerrStableStringify(actual) !== kerrStableStringify(expected)) {
    throw new Error(message);
  }
}

function assertRowBinding(
  plan: KerrComparisonPlan,
  rawRow: z.infer<typeof CandidateRowPayloadSchema>,
  caseIndex: number,
  rayIndex: number,
): void {
  const referenceCase = plan.cases[caseIndex];
  const referenceRay = referenceCase?.rays[rayIndex];
  if (referenceCase === undefined || referenceRay === undefined) {
    throw new Error("Kerr candidate row is outside the planned grid");
  }
  if (
    rawRow.planId !== plan.planId ||
    rawRow.planChecksum.value !== plan.planChecksum.value ||
    rawRow.caseId !== referenceCase.caseId ||
    rawRow.scientificRole !== referenceCase.scientificRole ||
    rawRow.requestId !== referenceCase.request.requestId ||
    rawRow.requestChecksum.value !==
      referenceCase.request.requestChecksum.value ||
    rawRow.referenceReportId !== referenceCase.report.reportId ||
    rawRow.referenceReportChecksum.value !==
      referenceCase.report.reportChecksum.value ||
    rawRow.referenceRayId !== referenceRay.rayId ||
    rawRow.referenceRayChecksum.value !== referenceRay.rayChecksum.value ||
    rawRow.pixelIndex !== referenceRay.pixelIndex ||
    rawRow.pixelX !== referenceRay.pixelX ||
    rawRow.pixelY !== referenceRay.pixelY ||
    rawRow.screenX !== referenceRay.screenX ||
    rawRow.screenY !== referenceRay.screenY
  ) {
    throw new Error(
      "Kerr candidate row does not match its exact planned reference binding",
    );
  }
}

function createNormalizedRow(
  plan: KerrComparisonPlan,
  rowInput: unknown,
  caseIndex: number,
  rayIndex: number,
): KerrExternalNormalizedOutputRow {
  const parsed = CandidateRowPayloadSchema.parse(rowInput);
  assertRowBinding(plan, parsed, caseIndex, rayIndex);
  const identity = {
    planId: plan.planId,
    planChecksum: plan.planChecksum,
    caseId: parsed.caseId,
    requestId: parsed.requestId,
    reportId: parsed.referenceReportId,
    pixelIndex: parsed.pixelIndex,
    payloadSha256: kerrSha256Hex(kerrStableStringify(parsed)),
  };
  const rowId = `krxrow_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const unsigned = { ...parsed, rowId };
  return KerrExternalNormalizedOutputRowSchema.parse({
    ...unsigned,
    rowChecksum: {
      algorithm: "sha256",
      value: kerrSha256Hex(kerrStableStringify(unsigned)),
      scope: "normalized-external-kerr-output-row",
    },
  });
}

function orderedRowsFromPayloads(
  plan: KerrComparisonPlan,
  rowInputs: readonly unknown[],
): KerrExternalNormalizedOutputRow[] {
  const rows: KerrExternalNormalizedOutputRow[] = [];
  let flatIndex = 0;
  for (let caseIndex = 0; caseIndex < plan.cases.length; caseIndex += 1) {
    const referenceCase = plan.cases[caseIndex]!;
    for (
      let rayIndex = 0;
      rayIndex < referenceCase.rays.length;
      rayIndex += 1
    ) {
      rows.push(
        createNormalizedRow(
          plan,
          ownArrayDataElement(rowInputs, flatIndex, "Kerr normalized rows"),
          caseIndex,
          rayIndex,
        ),
      );
      flatIndex += 1;
    }
  }
  return rows;
}

function normalizedOutputUnsigned(
  plan: Pick<
    KerrComparisonPlan,
    | "planId"
    | "planChecksum"
    | "comparisonScope"
    | "externalImplementation"
    | "mapping"
  >,
  generatedAt: string,
  externalRun: KerrExternalRunDeclaration,
  rows: readonly KerrExternalNormalizedOutputRow[],
) {
  const identity = {
    policyVersion: KERR_EXTERNAL_OUTPUT_POLICY_VERSION,
    generatedAt,
    planId: plan.planId,
    planChecksum: plan.planChecksum,
    comparisonScope: plan.comparisonScope,
    externalImplementation: plan.externalImplementation,
    mapping: plan.mapping,
    externalRun,
    rowChecksums: rows.map(({ rowChecksum }) => rowChecksum),
  };
  const normalizedOutputId = `krxout_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  return {
    schemaVersion: "1.0.0" as const,
    state: "normalized-unreviewed-declared-external-kerr-output" as const,
    normalizedOutputId,
    policyVersion: KERR_EXTERNAL_OUTPUT_POLICY_VERSION,
    generatedAt,
    planId: plan.planId,
    planChecksum: plan.planChecksum,
    comparisonScope: plan.comparisonScope,
    externalImplementation: plan.externalImplementation,
    mapping: plan.mapping,
    externalRun,
    rows,
    rowCoverage: "exactly-one-row-per-planned-ray-in-plan-order" as const,
    mappingReview: "not-run" as const,
    sourceExecutionReview: "not-run" as const,
    sourceOutputRightsReview: "not-run" as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_OUTPUT_NO_AUTHORITY,
  };
}

function assertStandaloneNormalizedRowIntegrity(
  row: KerrExternalNormalizedOutputRow,
): void {
  const { rowId, rowChecksum, ...payloadInput } = row;
  const payload = CandidateRowPayloadSchema.parse(payloadInput);
  const identity = {
    planId: payload.planId,
    planChecksum: payload.planChecksum,
    caseId: payload.caseId,
    requestId: payload.requestId,
    reportId: payload.referenceReportId,
    pixelIndex: payload.pixelIndex,
    payloadSha256: kerrSha256Hex(kerrStableStringify(payload)),
  };
  const expectedId = `krxrow_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  if (rowId !== expectedId) {
    throw new Error("Normalized Kerr row identity mismatch");
  }
  const unsigned = { ...payload, rowId };
  if (rowChecksum.value !== kerrSha256Hex(kerrStableStringify(unsigned))) {
    throw new Error("Normalized Kerr row checksum mismatch");
  }
}

function assertCanonicalByteCap(
  input: unknown,
  maximum: number,
  label: string,
): number {
  const length = new TextEncoder().encode(kerrStableStringify(input)).byteLength;
  if (length < 1 || length > maximum) {
    throw new RangeError(`${label} exceeds its canonical byte budget`);
  }
  return length;
}

export interface CreateKerrExternalNormalizedOutputInput {
  readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
  readonly plan: KerrComparisonPlan;
  readonly generatedAt: unknown;
  readonly externalRun: unknown;
  readonly rows: readonly unknown[];
}

export function createKerrExternalNormalizedOutput(
  input: CreateKerrExternalNormalizedOutputInput,
): KerrExternalNormalizedOutput {
  const referenceBundle = ownDataValue(
    input,
    "referenceBundle",
    "Kerr normalized output input",
  );
  const planInput = ownDataValue(
    input,
    "plan",
    "Kerr normalized output input",
  );
  const generatedAtInput = ownDataValue(
    input,
    "generatedAt",
    "Kerr normalized output input",
  );
  const externalRunInput = ownDataValue(
    input,
    "externalRun",
    "Kerr normalized output input",
  );
  assertKerrComparisonPlainDataTree(
    externalRunInput,
    "External Kerr run declaration",
  );
  assertKerrComparisonPlanIntegrity(referenceBundle, planInput);
  const plan = KerrComparisonPlanSchema.parse(planInput);
  const generatedAt = CanonicalTimestampSchema.parse(generatedAtInput);
  const externalRun = KerrExternalRunDeclarationSchema.parse(externalRunInput);
  if (
    externalRun.startedAt < plan.frozenAt ||
    generatedAt < externalRun.rawCapturedAt
  ) {
    throw new Error(
      "Normalized Kerr output must follow its plan, declared run, and raw capture",
    );
  }
  const rowInputs = preflightExactRows(
    ownDataValue(input, "rows", "Kerr normalized output input"),
    expectedRowCount(plan),
    "Kerr normalized rows",
  );
  assertKerrComparisonPlainDataTree(rowInputs, "Kerr normalized rows");
  const rows = orderedRowsFromPayloads(plan, rowInputs);
  const unsigned = normalizedOutputUnsigned(
    plan,
    generatedAt,
    externalRun,
    rows,
  );
  const output = KerrExternalNormalizedOutputSchema.parse({
    ...unsigned,
    normalizedOutputChecksum: {
      algorithm: "sha256",
      value: kerrSha256Hex(kerrStableStringify(unsigned)),
      scope: "normalized-external-kerr-output",
    },
  });
  assertCanonicalByteCap(
    output,
    KERR_EXTERNAL_OUTPUT_MAX_NORMALIZED_BYTES,
    "Normalized Kerr output",
  );
  assertKerrExternalNormalizedOutputIntegrity(
    referenceBundle,
    plan,
    output,
  );
  return deepFreezeKerr(output);
}

function rowPayloadFromRecord(
  row: KerrExternalNormalizedOutputRow,
): z.infer<typeof CandidateRowPayloadSchema> {
  const { rowId: _rowId, rowChecksum: _rowChecksum, ...payload } = row;
  return CandidateRowPayloadSchema.parse(payload);
}

export function assertKerrExternalNormalizedOutputIntegrity(
  bundleInput: unknown,
  planInput: unknown,
  outputInput: unknown,
): asserts outputInput is KerrExternalNormalizedOutput {
  assertKerrComparisonPlanIntegrity(bundleInput, planInput);
  const plan = KerrComparisonPlanSchema.parse(planInput);
  const rawRows = preflightExactRows(
    ownDataValue(outputInput, "rows", "Normalized Kerr output"),
    expectedRowCount(plan),
    "Normalized Kerr output rows",
  );
  assertKerrComparisonPlainDataTree(
    outputInput,
    "Normalized Kerr output",
  );
  const output = KerrExternalNormalizedOutputSchema.parse(outputInput);
  if (
    output.externalRun.startedAt < plan.frozenAt ||
    output.generatedAt < output.externalRun.rawCapturedAt
  ) {
    throw new Error("Normalized Kerr output chronology mismatch");
  }
  if (
    output.planId !== plan.planId ||
    output.planChecksum.value !== plan.planChecksum.value ||
    output.comparisonScope !== plan.comparisonScope
  ) {
    throw new Error("Normalized Kerr output is not bound to its comparison plan");
  }
  assertCanonicalEquality(
    output.externalImplementation,
    plan.externalImplementation,
    "Normalized Kerr output implementation binding mismatch",
  );
  assertCanonicalEquality(
    output.mapping,
    plan.mapping,
    "Normalized Kerr output mapping binding mismatch",
  );
  const payloads: unknown[] = [];
  for (let index = 0; index < rawRows.length; index += 1) {
    const parsedRow = KerrExternalNormalizedOutputRowSchema.parse(
      ownArrayDataElement(rawRows, index, "Normalized Kerr output rows"),
    );
    payloads.push(rowPayloadFromRecord(parsedRow));
  }
  const expectedRows = orderedRowsFromPayloads(plan, payloads);
  assertCanonicalEquality(
    output.rows,
    expectedRows,
    "Normalized Kerr output row identity, order, or checksum mismatch",
  );
  const expectedUnsigned = normalizedOutputUnsigned(
    plan,
    output.generatedAt,
    output.externalRun,
    expectedRows,
  );
  const { normalizedOutputChecksum, ...actualUnsigned } = output;
  assertCanonicalEquality(
    actualUnsigned,
    expectedUnsigned,
    "Normalized Kerr output envelope mismatch",
  );
  if (
    normalizedOutputChecksum.value !==
    kerrSha256Hex(kerrStableStringify(actualUnsigned))
  ) {
    throw new Error("Normalized Kerr output checksum mismatch");
  }
  assertCanonicalByteCap(
    output,
    KERR_EXTERNAL_OUTPUT_MAX_NORMALIZED_BYTES,
    "Normalized Kerr output",
  );
}

function exactUint8ArrayCopy(
  input: unknown,
  maximum: number,
  label: string,
): Uint8Array {
  if (!(input instanceof Uint8Array)) {
    throw new TypeError(
      `${label} must be a nonempty plain Uint8Array within its byte budget`,
    );
  }
  if (Object.getPrototypeOf(input) !== Uint8Array.prototype) {
    throw new TypeError(`${label} must not be a subclass or proxy`);
  }
  for (const key of ["buffer", "byteLength", "byteOffset", "length"] as const) {
    if (Object.getOwnPropertyDescriptor(input, key) !== undefined) {
      throw new TypeError(
        `${label} must be a plain Uint8Array without own data or accessor shadows`,
      );
    }
  }
  const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
  const bufferGetter = Object.getOwnPropertyDescriptor(
    typedArrayPrototype,
    "buffer",
  )?.get;
  const byteLengthGetter = Object.getOwnPropertyDescriptor(
    typedArrayPrototype,
    "byteLength",
  )?.get;
  const lengthGetter = Object.getOwnPropertyDescriptor(
    typedArrayPrototype,
    "length",
  )?.get;
  if (
    bufferGetter === undefined ||
    byteLengthGetter === undefined ||
    lengthGetter === undefined
  ) {
    throw new Error("Typed-array intrinsic getters are unavailable");
  }
  let buffer: ArrayBufferLike;
  let byteLength: number;
  let length: number;
  try {
    buffer = bufferGetter.call(input) as ArrayBufferLike;
    byteLength = byteLengthGetter.call(input) as number;
    length = lengthGetter.call(input) as number;
  } catch {
    throw new TypeError(`${label} must be a genuine attached Uint8Array`);
  }
  if (
    !(buffer instanceof ArrayBuffer) ||
    !Number.isInteger(byteLength) ||
    !Number.isInteger(length) ||
    byteLength !== length ||
    byteLength < 1 ||
    byteLength > maximum
  ) {
    throw new TypeError(
      `${label} must be a nonempty plain Uint8Array within its byte budget`,
    );
  }
  const copy = new Uint8Array(length);
  Uint8Array.prototype.set.call(copy, input);
  return copy;
}

function exactBytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function hasBytePrefix(
  input: Uint8Array,
  prefix: readonly number[],
  offset = 0,
): boolean {
  if (input.byteLength < offset + prefix.length) return false;
  return prefix.every((value, index) => input[offset + index] === value);
}

function rejectRecognizedArchiveContainer(input: Uint8Array): void {
  const recognized =
    hasBytePrefix(input, [0x50, 0x4b, 0x03, 0x04]) || // ZIP/JAR/OOXML
    hasBytePrefix(input, [0x50, 0x4b, 0x05, 0x06]) ||
    hasBytePrefix(input, [0x50, 0x4b, 0x07, 0x08]) ||
    hasBytePrefix(input, [0x1f, 0x8b]) || // gzip
    hasBytePrefix(input, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) || // 7z
    hasBytePrefix(input, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]) || // RAR
    hasBytePrefix(input, [0x42, 0x5a, 0x68]) || // bzip2
    hasBytePrefix(input, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]) || // xz
    hasBytePrefix(input, [0x75, 0x73, 0x74, 0x61, 0x72], 257); // tar
  if (recognized) {
    throw new Error(
      "External Kerr raw output must be a single uncompressed file; archive containers are not accepted",
    );
  }
}

export function canonicalKerrExternalNormalizedOutputBytes(
  output: KerrExternalNormalizedOutput,
): Uint8Array {
  assertKerrComparisonPlainDataTree(
    output,
    "Canonical normalized Kerr output",
  );
  const parsed = KerrExternalNormalizedOutputSchema.parse(output);
  const bytes = new TextEncoder().encode(kerrStableStringify(parsed));
  if (bytes.byteLength > KERR_EXTERNAL_OUTPUT_MAX_NORMALIZED_BYTES) {
    throw new RangeError("Normalized Kerr output exceeds its byte budget");
  }
  return bytes;
}

function candidateUnsigned(
  plan: KerrComparisonPlan,
  output: KerrExternalNormalizedOutput,
  rawArtifact: z.infer<typeof RawArtifactSchema>,
  normalizedArtifact: z.infer<typeof NormalizedArtifactSchema>,
) {
  const identity = {
    policyVersion: KERR_EXTERNAL_OUTPUT_POLICY_VERSION,
    generatedAt: output.generatedAt,
    planId: plan.planId,
    planChecksum: plan.planChecksum,
    comparisonScope: plan.comparisonScope,
    externalImplementation: plan.externalImplementation,
    mapping: plan.mapping,
    externalRun: output.externalRun,
    rawArtifact,
    normalizedArtifact,
    rowChecksums: output.rows.map(({ rowChecksum }) => rowChecksum),
  };
  const candidateId = `krcand_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  return {
    schemaVersion: "1.0.0" as const,
    state: "unreviewed-declared-external-kerr-output-candidate" as const,
    candidateId,
    policyVersion: KERR_EXTERNAL_OUTPUT_POLICY_VERSION,
    generatedAt: output.generatedAt,
    planId: plan.planId,
    planChecksum: plan.planChecksum,
    comparisonScope: plan.comparisonScope,
    externalImplementation: plan.externalImplementation,
    mapping: plan.mapping,
    externalRun: output.externalRun,
    rawArtifact,
    normalizedArtifact,
    rows: output.rows,
    independentReference: "not-run" as const,
    independenceReview: "not-run" as const,
    mappingReview: "not-run" as const,
    sourceReview: "not-run" as const,
    sourceExecutionReview: "not-run" as const,
    sourceOutputRightsReview: "not-run" as const,
    candidateComparison: "not-run" as const,
    ...KERR_EXTERNAL_OUTPUT_NO_AUTHORITY,
  };
}

export interface CreateKerrExternalOutputCandidateInput {
  readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
  readonly plan: KerrComparisonPlan;
  readonly rawBytes: Uint8Array;
  readonly normalizedBytes: Uint8Array;
  readonly normalizedOutput: KerrExternalNormalizedOutput;
}

export function createKerrExternalOutputCandidate(
  input: CreateKerrExternalOutputCandidateInput,
): KerrExternalOutputCandidate {
  // Byte limits are checked before any caller-controlled normalized row is read.
  const rawBytes = exactUint8ArrayCopy(
    ownDataValue(input, "rawBytes", "External Kerr candidate input"),
    KERR_EXTERNAL_OUTPUT_MAX_RAW_BYTES,
    "External Kerr raw bytes",
  );
  const normalizedBytes = exactUint8ArrayCopy(
    ownDataValue(input, "normalizedBytes", "External Kerr candidate input"),
    KERR_EXTERNAL_OUTPUT_MAX_NORMALIZED_BYTES,
    "External Kerr normalized bytes",
  );
  rejectRecognizedArchiveContainer(rawBytes);
  const referenceBundle = ownDataValue(
    input,
    "referenceBundle",
    "External Kerr candidate input",
  );
  const planInput = ownDataValue(
    input,
    "plan",
    "External Kerr candidate input",
  );
  const normalizedOutputInput = ownDataValue(
    input,
    "normalizedOutput",
    "External Kerr candidate input",
  );
  assertKerrComparisonPlanIntegrity(referenceBundle, planInput);
  const plan = KerrComparisonPlanSchema.parse(planInput);
  assertKerrComparisonPlainDataTree(
    normalizedOutputInput,
    "External Kerr normalized output",
  );
  const output = KerrExternalNormalizedOutputSchema.parse(
    normalizedOutputInput,
  );
  assertKerrExternalNormalizedOutputIntegrity(
    referenceBundle,
    plan,
    output,
  );
  const expectedNormalizedBytes = canonicalKerrExternalNormalizedOutputBytes(
    output,
  );
  if (!exactBytesEqual(normalizedBytes, expectedNormalizedBytes)) {
    throw new Error(
      "External Kerr normalized bytes are not the exact canonical output bytes",
    );
  }
  const rawArtifact = RawArtifactSchema.parse({
    kind: "caller-supplied-external-native-output",
    mediaType: "application/octet-stream",
    encoding: "opaque-exact-bytes",
    compression: "none",
    archivePolicy: "recognized-signatures-rejected-no-decompression",
    recognizedArchiveContainer: false,
    capturedAt: output.externalRun.rawCapturedAt,
    captureTimeProvenance: "caller-declared-unverified",
    byteLength: rawBytes.byteLength,
    sha256: kerrSha256Hex(rawBytes),
    provenance: "caller-supplied-unverified",
    retainedByPackage: false,
    checksumAuthenticatesArtifact: false,
  });
  const normalizedArtifact = NormalizedArtifactSchema.parse({
    kind: "canonical-normalized-external-output",
    mediaType: "application/json",
    encoding: "utf-8",
    canonicalization: "kerr-stable-json-v1",
    byteLength: normalizedBytes.byteLength,
    sha256: kerrSha256Hex(normalizedBytes),
    normalizedOutputId: output.normalizedOutputId,
    normalizedOutputChecksum: output.normalizedOutputChecksum,
    provenance: "mapping-output-unreviewed",
    retainedByPackage: false,
    checksumAuthenticatesArtifact: false,
  });
  const unsigned = candidateUnsigned(
    plan,
    output,
    rawArtifact,
    normalizedArtifact,
  );
  const candidate = KerrExternalOutputCandidateSchema.parse({
    ...unsigned,
    candidateChecksum: {
      algorithm: "sha256",
      value: kerrSha256Hex(kerrStableStringify(unsigned)),
      scope: "external-kerr-output-candidate",
    },
  });
  assertCanonicalByteCap(
    candidate,
    KERR_EXTERNAL_OUTPUT_MAX_CANDIDATE_CANONICAL_BYTES,
    "External Kerr candidate",
  );
  assertKerrExternalOutputCandidateIntegrity(
    referenceBundle,
    plan,
    candidate,
  );
  assertKerrExternalOutputCandidateExactBytes(
    candidate,
    rawBytes,
    normalizedBytes,
  );
  return deepFreezeKerr(candidate);
}

function normalizedOutputFromCandidate(
  plan: KerrComparisonPlan,
  candidate: KerrExternalOutputCandidate,
): KerrExternalNormalizedOutput {
  const payloads = candidate.rows.map(rowPayloadFromRecord);
  const rows = orderedRowsFromPayloads(plan, payloads);
  const unsigned = normalizedOutputUnsigned(
    plan,
    candidate.generatedAt,
    candidate.externalRun,
    rows,
  );
  return KerrExternalNormalizedOutputSchema.parse({
    ...unsigned,
    normalizedOutputChecksum: {
      algorithm: "sha256",
      value: kerrSha256Hex(kerrStableStringify(unsigned)),
      scope: "normalized-external-kerr-output",
    },
  });
}

export function assertKerrExternalOutputCandidateIntegrity(
  bundleInput: unknown,
  planInput: unknown,
  candidateInput: unknown,
): asserts candidateInput is KerrExternalOutputCandidate {
  assertKerrComparisonPlanIntegrity(bundleInput, planInput);
  const plan = KerrComparisonPlanSchema.parse(planInput);
  preflightExactRows(
    ownDataValue(candidateInput, "rows", "External Kerr candidate"),
    expectedRowCount(plan),
    "External Kerr candidate rows",
  );
  assertKerrComparisonPlainDataTree(candidateInput, "External Kerr candidate");
  const candidate = KerrExternalOutputCandidateSchema.parse(candidateInput);
  if (
    candidate.generatedAt < plan.frozenAt ||
    candidate.planId !== plan.planId ||
    candidate.planChecksum.value !== plan.planChecksum.value ||
    candidate.comparisonScope !== plan.comparisonScope
  ) {
    throw new Error("External Kerr candidate is not bound to its comparison plan");
  }
  assertCanonicalEquality(
    candidate.externalImplementation,
    plan.externalImplementation,
    "External Kerr candidate implementation binding mismatch",
  );
  assertCanonicalEquality(
    candidate.mapping,
    plan.mapping,
    "External Kerr candidate mapping binding mismatch",
  );
  if (
    candidate.externalRun.startedAt < plan.frozenAt ||
    candidate.generatedAt < candidate.externalRun.rawCapturedAt ||
    candidate.rawArtifact.capturedAt !==
      candidate.externalRun.rawCapturedAt
  ) {
    throw new Error("External Kerr candidate chronology mismatch");
  }
  const output = normalizedOutputFromCandidate(plan, candidate);
  if (
    candidate.normalizedArtifact.normalizedOutputId !==
      output.normalizedOutputId ||
    candidate.normalizedArtifact.normalizedOutputChecksum.value !==
      output.normalizedOutputChecksum.value
  ) {
    throw new Error("External Kerr normalized output binding mismatch");
  }
  const canonicalNormalizedBytes =
    canonicalKerrExternalNormalizedOutputBytes(output);
  if (
    candidate.normalizedArtifact.byteLength !==
      canonicalNormalizedBytes.byteLength ||
    candidate.normalizedArtifact.sha256 !==
      kerrSha256Hex(canonicalNormalizedBytes)
  ) {
    throw new Error(
      "External Kerr normalized artifact does not bind the canonical output bytes",
    );
  }
  const expectedUnsigned = candidateUnsigned(
    plan,
    output,
    candidate.rawArtifact,
    candidate.normalizedArtifact,
  );
  const { candidateChecksum, ...actualUnsigned } = candidate;
  assertCanonicalEquality(
    actualUnsigned,
    expectedUnsigned,
    "External Kerr candidate envelope, rows, or identity mismatch",
  );
  if (
    candidateChecksum.value !==
    kerrSha256Hex(kerrStableStringify(actualUnsigned))
  ) {
    throw new Error("External Kerr candidate checksum mismatch");
  }
  assertCanonicalByteCap(
    candidate,
    KERR_EXTERNAL_OUTPUT_MAX_CANDIDATE_CANONICAL_BYTES,
    "External Kerr candidate",
  );
}

export function assertKerrExternalOutputCandidateExactBytes(
  candidateInput: unknown,
  rawBytesInput: unknown,
  normalizedBytesInput: unknown,
): void {
  const rawBytes = exactUint8ArrayCopy(
    rawBytesInput,
    KERR_EXTERNAL_OUTPUT_MAX_RAW_BYTES,
    "External Kerr raw bytes",
  );
  const normalizedBytes = exactUint8ArrayCopy(
    normalizedBytesInput,
    KERR_EXTERNAL_OUTPUT_MAX_NORMALIZED_BYTES,
    "External Kerr normalized bytes",
  );
  rejectRecognizedArchiveContainer(rawBytes);
  preflightBoundedRows(
    ownDataValue(candidateInput, "rows", "External Kerr candidate"),
    "External Kerr candidate rows",
  );
  assertKerrComparisonPlainDataTree(candidateInput, "External Kerr candidate");
  const candidate = KerrExternalOutputCandidateSchema.parse(candidateInput);
  for (const row of candidate.rows) {
    assertStandaloneNormalizedRowIntegrity(row);
  }
  const normalizedUnsigned = normalizedOutputUnsigned(
    candidate,
    candidate.generatedAt,
    candidate.externalRun,
    candidate.rows,
  );
  const reconstructedOutput = KerrExternalNormalizedOutputSchema.parse({
    ...normalizedUnsigned,
    normalizedOutputChecksum: {
      algorithm: "sha256",
      value: kerrSha256Hex(kerrStableStringify(normalizedUnsigned)),
      scope: "normalized-external-kerr-output",
    },
  });
  if (
    candidate.normalizedArtifact.normalizedOutputId !==
      reconstructedOutput.normalizedOutputId ||
    candidate.normalizedArtifact.normalizedOutputChecksum.value !==
      reconstructedOutput.normalizedOutputChecksum.value
  ) {
    throw new Error("External Kerr normalized output identity mismatch");
  }
  const expectedNormalizedBytes =
    canonicalKerrExternalNormalizedOutputBytes(reconstructedOutput);
  if (
    rawBytes.byteLength !== candidate.rawArtifact.byteLength ||
    kerrSha256Hex(rawBytes) !== candidate.rawArtifact.sha256
  ) {
    throw new Error("External Kerr raw byte binding mismatch");
  }
  if (
    normalizedBytes.byteLength !== candidate.normalizedArtifact.byteLength ||
    kerrSha256Hex(normalizedBytes) !== candidate.normalizedArtifact.sha256 ||
    !exactBytesEqual(normalizedBytes, expectedNormalizedBytes)
  ) {
    throw new Error(
      "External Kerr normalized byte binding or canonical reconstruction mismatch",
    );
  }
}

/** A quarantined candidate can never authorize renderer use. */
export function canUseKerrExternalOutputCandidateForRender(
  _input: unknown,
): false {
  return false;
}
