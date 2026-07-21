import { z } from "zod";

import {
  KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
} from "./kerr-external-authorization.js";
import {
  KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
  KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  KERR_RECEIPT_BOUND_NUMERIC_COMPARISON_MAX_CANONICAL_BYTES,
  ReceiptBoundKerrExternalNumericComparisonDispositionSchema,
  ReceiptBoundKerrExternalNumericComparisonReasonSchema,
  ReceiptBoundKerrExternalNumericComparisonSchema,
  assertIssuedReceiptBoundKerrExternalNumericComparison,
  assertReceiptBoundKerrExternalNumericComparisonIntegrity,
  type ReceiptBoundKerrExternalNumericComparison,
} from "./kerr-external-execution-receipt.js";
import {
  KERR_COMPARISON_MAX_TOTAL_PIXELS,
  assertKerrComparisonPlainDataTree,
} from "./kerr-comparison-plan.js";
import {
  KERR_NUMERIC_COMPARISON_REASON_ORDER,
  type KerrNumericComparisonReason,
} from "./kerr-numeric-comparison-core.js";
import {
  deepFreezeKerr,
  kerrSha256Hex,
  kerrStableStringify,
} from "./trace-contracts.js";

export const KERR_EXTERNAL_SCIENTIFIC_REVIEW_POLICY_VERSION =
  "1.0.0" as const;
export const KERR_EXTERNAL_SCIENTIFIC_REVIEW_MAX_VALIDITY_SECONDS =
  7 * 24 * 60 * 60;
export const KERR_EXTERNAL_SCIENTIFIC_REVIEW_SUBJECT_MAX_CANONICAL_BYTES =
  256 * 1024;
export const KERR_EXTERNAL_SCIENTIFIC_REVIEW_DECISION_MAX_CANONICAL_BYTES =
  512 * 1024;
export const KERR_EXTERNAL_SCIENTIFIC_REVIEW_RECORD_MAX_CANONICAL_BYTES =
  2 * 1024 * 1024;

export const KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES = deepFreezeKerr([
  "relativistic-physics",
  "numerical-methods",
] as const);

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const IdentifierSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,127}$/);
const CanonicalTimestampSchema = z.iso.datetime({
  offset: false,
  precision: 0,
});

const packageNoExecutionShape = {
  packageFilesystemAccess: z.literal(false),
  packageNetworkAccess: z.literal(false),
  packageDownloaderSupplied: z.literal(false),
  packageArchiveExtractorSupplied: z.literal(false),
  packageBuildSystemSupplied: z.literal(false),
  packageShellSupplied: z.literal(false),
  packageProcessSpawnerSupplied: z.literal(false),
  packageWorkerSupplied: z.literal(false),
  packageNativeLoaderSupplied: z.literal(false),
  packageSandboxSupplied: z.literal(false),
  packageRunnerSupplied: z.literal(false),
  packageExecutionAllowed: z.literal(false),
} as const;

const noAuthorityShape = {
  implementationProvenanceVerified: z.literal(false),
  independenceVerified: z.literal(false),
  licenseVerified: z.literal(false),
  mappingCorrectnessVerified: z.literal(false),
  checksumAuthenticatesRecord: z.literal(false),
  executionVerified: z.literal(false),
  candidateAdmissionAllowed: z.literal(false),
  comparisonAllowed: z.literal(false),
  scientificValidationPassed: z.literal(false),
  independentValidationPassed: z.literal(false),
  renderAllowed: z.literal(false),
  productionUseAllowed: z.literal(false),
  placeholderReplacementAllowed: z.literal(false),
  releaseEligible: z.literal(false),
  publicationAllowed: z.literal(false),
  activationAllowed: z.literal(false),
} as const;

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

function preflightExactArray(
  input: unknown,
  expectedLength: number,
  label: string,
): readonly unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) {
    throw new TypeError(`${label} must be a plain dense array`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(input, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.value !== expectedLength
  ) {
    throw new RangeError(`${label} must contain exactly ${expectedLength} entries`);
  }
  const allowedKeys = new Set<string>([
    "length",
    ...Array.from({ length: expectedLength }, (_unused, index) => String(index)),
  ]);
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== "string" || !allowedKeys.has(key)) {
      throw new TypeError(`${label} must not contain extra properties or symbols`);
    }
  }
  return Array.from({ length: expectedLength }, (_unused, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`${label}[${index}] must be an own data property`);
    }
    return descriptor.value;
  });
}

function exactUint8ArrayCopy(
  input: unknown,
  maximum: number,
  label: string,
): Uint8Array {
  if (
    !(input instanceof Uint8Array) ||
    Object.getPrototypeOf(input) !== Uint8Array.prototype
  ) {
    throw new TypeError(`${label} must be a nonempty plain Uint8Array`);
  }
  for (const key of ["buffer", "byteLength", "byteOffset", "length"] as const) {
    if (Object.getOwnPropertyDescriptor(input, key) !== undefined) {
      throw new TypeError(`${label} must not shadow typed-array properties`);
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
    throw new RangeError(`${label} is outside its byte budget`);
  }
  const copy = new Uint8Array(length);
  Uint8Array.prototype.set.call(copy, input);
  return copy;
}

function exactBytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function checksum(scope: string, unsigned: unknown) {
  return {
    algorithm: "sha256" as const,
    value: kerrSha256Hex(kerrStableStringify(unsigned)),
    scope,
  };
}

function canonicalByteLength(value: unknown): number {
  return new TextEncoder().encode(kerrStableStringify(value)).byteLength;
}

interface KerrScientificReviewRowDispositionBinding {
  readonly rowId: string;
  readonly rowChecksumSha256: string;
  readonly disposition: ReceiptBoundKerrExternalNumericComparison["rows"][number]["disposition"];
  readonly reasons: readonly KerrNumericComparisonReason[];
}

function orderedRowDispositionAndReasonsSha256(
  rows: readonly KerrScientificReviewRowDispositionBinding[],
): string {
  return kerrSha256Hex(
    kerrStableStringify({
      scope:
        "receipt-bound-kerr-scientific-review-ordered-row-dispositions-and-reasons-v1",
      rows,
    }),
  );
}

function assertCanonicalByteBudget(
  value: unknown,
  maximum: number,
  label: string,
): void {
  if (canonicalByteLength(value) > maximum) {
    throw new RangeError(`${label} exceeds its canonical byte budget`);
  }
}

function assertAlreadyCanonical(
  input: unknown,
  parsed: unknown,
  label: string,
): void {
  if (kerrStableStringify(input) !== kerrStableStringify(parsed)) {
    throw new Error(`${label} must already be canonical`);
  }
}

const ScientificReviewRoleSchema = z.enum([
  "relativistic-physics",
  "numerical-methods",
]);

export const KerrExternalScientificReviewerAssignmentSchema = z
  .object({
    role: ScientificReviewRoleSchema,
    reviewerId: IdentifierSchema,
    roleGrantId: IdentifierSchema,
    keyId: IdentifierSchema,
  })
  .strict();
export type KerrExternalScientificReviewerAssignment = z.infer<
  typeof KerrExternalScientificReviewerAssignmentSchema
>;

export const KerrExternalScientificReviewOpinionSchema = z.enum([
  "supports-provisional-bounded-vacuum-metric-agreement",
  "does-not-support-provisional-bounded-vacuum-metric-agreement",
  "insufficient-evidence",
]);
export type KerrExternalScientificReviewOpinion = z.infer<
  typeof KerrExternalScientificReviewOpinionSchema
>;

const ScientificReviewChecksumSchema = (scope: string) =>
  z
    .object({
      algorithm: z.literal("sha256"),
      value: Sha256Schema,
      scope: z.literal(scope),
    })
    .strict();

const ScientificReviewEvidenceLimitationsSchema = z
  .object({
    reviewerAssignmentsDeclaredByCaller: z.literal(true),
    reviewerAssignmentAuthorityAuthenticatedByPackage: z.literal(false),
    reviewerQualificationsVerifiedByPackage: z.literal(false),
    reviewerConflictClearanceVerifiedByPackage: z.literal(false),
    reviewerCredentialValidityAndRevocationVerifiedByPackage: z.literal(false),
    realExternalExecutionEstablishedByPackage: z.literal(false),
    implementationProvenanceVerified: z.literal(false),
    implementationIndependenceVerified: z.literal(false),
    mappingCorrectnessVerified: z.literal(false),
    executionVerified: z.literal(false),
    comparisonTimeAuthenticatedByPackage: z.literal(false),
    sourceExecutionEvidenceStatus: z.literal(
      "injected-runner-verifier-asserted-not-package-authenticated",
    ),
    mappingReviewEvidenceStatus: z.literal(
      "injected-mapping-verifier-asserted-not-package-authenticated",
    ),
    provisionalToleranceAgreementIsValidation: z.literal(false),
    independentReference: z.literal("not-run"),
    currentEvidenceEligibleForScientificValidation: z.literal(false),
  })
  .strict();

const ScientificReviewComparisonBindingSchema = z
  .object({
    comparisonId: z.string().regex(/^krrbcmp_[a-f0-9]{24}$/),
    comparisonChecksumSha256: Sha256Schema,
    comparisonCanonicalByteLength: z
      .number()
      .int()
      .positive()
      .max(KERR_RECEIPT_BOUND_NUMERIC_COMPARISON_MAX_CANONICAL_BYTES),
    comparisonCanonicalSha256: Sha256Schema,
    comparedAt: CanonicalTimestampSchema,
    preparationBinding:
      ReceiptBoundKerrExternalNumericComparisonSchema.shape.preparationBinding,
    admissionBinding:
      ReceiptBoundKerrExternalNumericComparisonSchema.shape.admissionBinding,
    planBinding: ReceiptBoundKerrExternalNumericComparisonSchema.shape.planBinding,
    mappingReviewBinding:
      ReceiptBoundKerrExternalNumericComparisonSchema.shape.mappingReviewBinding,
    candidateBinding:
      ReceiptBoundKerrExternalNumericComparisonSchema.shape.candidateBinding,
    comparisonScope:
      ReceiptBoundKerrExternalNumericComparisonSchema.shape.comparisonScope,
    rowCount: z
      .number()
      .int()
      .positive()
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    orderedRowIdAndChecksumSha256: Sha256Schema,
    orderedRowDispositionAndReasonsSha256: Sha256Schema,
    summary: ReceiptBoundKerrExternalNumericComparisonSchema.shape.summary,
    summaryCanonicalSha256: Sha256Schema,
    tolerances: ReceiptBoundKerrExternalNumericComparisonSchema.shape.tolerances,
    tolerancesCanonicalSha256: Sha256Schema,
    observedReasonCodes: z
      .array(ReceiptBoundKerrExternalNumericComparisonReasonSchema)
      .max(KERR_NUMERIC_COMPARISON_REASON_ORDER.length),
    machineSupportOpinionEligible: z.boolean(),
  })
  .strict();

const ScientificReviewSubjectChecksumSchema = ScientificReviewChecksumSchema(
  "kerr-external-scientific-review-subject",
);

export const KerrExternalScientificReviewSubjectSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "receipt-bound-kerr-scientific-review-subject-awaiting-two-signed-opinions",
    ),
    policyVersion: z.literal(KERR_EXTERNAL_SCIENTIFIC_REVIEW_POLICY_VERSION),
    subjectId: z.string().regex(/^krsrsubj_[a-f0-9]{24}$/),
    frozenAt: CanonicalTimestampSchema,
    purpose: z.literal(
      "record-two-non-authoritative-scientific-opinions-over-one-exact-issued-comparison",
    ),
    comparisonBinding: ScientificReviewComparisonBindingSchema,
    scientificReviewIdentitySeparationBinding:
      ReceiptBoundKerrExternalNumericComparisonSchema.shape
        .scientificReviewIdentitySeparationBinding,
    reviewerAssignments: z.tuple([
      KerrExternalScientificReviewerAssignmentSchema.extend({
        role: z.literal("relativistic-physics"),
      }),
      KerrExternalScientificReviewerAssignmentSchema.extend({
        role: z.literal("numerical-methods"),
      }),
    ]),
    requiredRoles: z.tuple([
      z.literal("relativistic-physics"),
      z.literal("numerical-methods"),
    ]),
    requiredOpinionCount: z.literal(2),
    comparisonRowsAndDispositionsAreImmutable: z.literal(true),
    disagreementWaiversAllowed: z.literal(false),
    postRunToleranceChangesAllowed: z.literal(false),
    coordinateTimeAndAffineParameterDeltasAreDiagnosticOnly: z.literal(true),
    cameraScreenToleranceInventedAfterExecution: z.literal(false),
    evidenceLimitations: ScientificReviewEvidenceLimitationsSchema,
    subjectIsAuthority: z.literal(false),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    subjectChecksum: ScientificReviewSubjectChecksumSchema,
  })
  .strict()
  .superRefine((subject, context) => {
    const reasons = subject.comparisonBinding
      .observedReasonCodes as KerrNumericComparisonReason[];
    const canonicalReasons = KERR_NUMERIC_COMPARISON_REASON_ORDER.filter((reason) =>
      reasons.includes(reason),
    );
    const supportEligible =
      subject.comparisonBinding.summary.numericAgreement ===
        "within-pre-registered-tolerance" && reasons.length === 0;
    const assignedReviewerIds = new Set(
      subject.reviewerAssignments.map((assignment) => assignment.reviewerId),
    );
    const assignedRoleGrantIds = new Set(
      subject.reviewerAssignments.map((assignment) => assignment.roleGrantId),
    );
    const assignedKeyIds = new Set(
      subject.reviewerAssignments.map((assignment) => assignment.keyId),
    );
    const identities = subject.scientificReviewIdentitySeparationBinding;
    const assignmentReusesPriorActor = subject.reviewerAssignments.some(
      (assignment) =>
        assignment.reviewerId === identities.runner.runnerId ||
        assignment.roleGrantId === identities.runner.runnerGrantId ||
        assignment.keyId === identities.runner.runnerKeyId ||
        assignment.reviewerId === identities.mapping.reviewerId ||
        assignment.roleGrantId === identities.mapping.roleGrantId ||
        assignment.keyId === identities.mapping.reviewerKeyId ||
        identities.selection.approvals.some(
          (approval) =>
            approval.reviewerId === assignment.reviewerId ||
            approval.roleGrantId === assignment.roleGrantId ||
            approval.keyId === assignment.keyId,
        ),
    );
    if (
      Date.parse(subject.frozenAt) <
        Date.parse(subject.comparisonBinding.comparedAt) ||
      new Set(reasons).size !== reasons.length ||
      kerrStableStringify(reasons) !== kerrStableStringify(canonicalReasons) ||
      subject.comparisonBinding.machineSupportOpinionEligible !== supportEligible ||
      assignedReviewerIds.size !== subject.reviewerAssignments.length ||
      assignedRoleGrantIds.size !== subject.reviewerAssignments.length ||
      assignedKeyIds.size !== subject.reviewerAssignments.length ||
      assignmentReusesPriorActor
    ) {
      context.addIssue({
        code: "custom",
        path: ["comparisonBinding"],
        message: "Kerr scientific-review subject comparison binding is inconsistent",
      });
    }
  });
export type KerrExternalScientificReviewSubject = z.infer<
  typeof KerrExternalScientificReviewSubjectSchema
>;

function assertScientificReviewerSeparatedFromPriorActors(
  identities: KerrExternalScientificReviewSubject["scientificReviewIdentitySeparationBinding"],
  reviewerId: string,
  roleGrantId: string,
  keyId: string,
): void {
  if (
    reviewerId === identities.runner.runnerId ||
    roleGrantId === identities.runner.runnerGrantId ||
    keyId === identities.runner.runnerKeyId
  ) {
    throw new Error(
      "Kerr scientific reviewer identity, grant, and key must be distinct from the receipt-declared runner",
    );
  }
  if (
    identities.selection.approvals.some(
      (approval) =>
        approval.reviewerId === reviewerId ||
        approval.roleGrantId === roleGrantId ||
        approval.keyId === keyId,
    )
  ) {
    throw new Error(
      "Kerr scientific reviewer identity, grant, and key must be distinct from every selection reviewer",
    );
  }
  if (
    reviewerId === identities.mapping.reviewerId ||
    roleGrantId === identities.mapping.roleGrantId ||
    keyId === identities.mapping.reviewerKeyId
  ) {
    throw new Error(
      "Kerr scientific reviewer identity, grant, and key must be distinct from the mapping reviewer",
    );
  }
}

function assertScientificReviewerAssignments(
  identities: KerrExternalScientificReviewSubject["scientificReviewIdentitySeparationBinding"],
  assignments: readonly KerrExternalScientificReviewerAssignment[],
): void {
  if (
    assignments.some(
      (assignment, index) =>
        assignment.role !== KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES[index],
    )
  ) {
    throw new Error(
      "Kerr scientific-review assignments must cover both roles in canonical order",
    );
  }
  const reviewerIds = new Set<string>();
  const roleGrantIds = new Set<string>();
  const keyIds = new Set<string>();
  for (const assignment of assignments) {
    assertScientificReviewerSeparatedFromPriorActors(
      identities,
      assignment.reviewerId,
      assignment.roleGrantId,
      assignment.keyId,
    );
    if (
      reviewerIds.has(assignment.reviewerId) ||
      roleGrantIds.has(assignment.roleGrantId) ||
      keyIds.has(assignment.keyId)
    ) {
      throw new Error(
        "The two Kerr scientific reviewers must use distinct identities, grants, and keys",
      );
    }
    reviewerIds.add(assignment.reviewerId);
    roleGrantIds.add(assignment.roleGrantId);
    keyIds.add(assignment.keyId);
  }
}

function orderedObservedReasonCodes(
  comparison: ReceiptBoundKerrExternalNumericComparison,
): KerrNumericComparisonReason[] {
  const observed = new Set<KerrNumericComparisonReason>();
  for (const row of comparison.rows) {
    for (const reason of row.reasons) observed.add(reason);
  }
  return KERR_NUMERIC_COMPARISON_REASON_ORDER.filter((reason) =>
    observed.has(reason),
  );
}

function buildKerrExternalScientificReviewSubject(
  comparison: ReceiptBoundKerrExternalNumericComparison,
  frozenAt: string,
  reviewerAssignments: readonly KerrExternalScientificReviewerAssignment[],
): KerrExternalScientificReviewSubject {
  const observedReasonCodes = orderedObservedReasonCodes(comparison);
  const comparisonBinding = {
    comparisonId: comparison.comparisonId,
    comparisonChecksumSha256: comparison.comparisonChecksum.value,
    comparisonCanonicalByteLength: canonicalByteLength(comparison),
    comparisonCanonicalSha256: kerrSha256Hex(kerrStableStringify(comparison)),
    comparedAt: comparison.comparedAt,
    preparationBinding: comparison.preparationBinding,
    admissionBinding: comparison.admissionBinding,
    planBinding: comparison.planBinding,
    mappingReviewBinding: comparison.mappingReviewBinding,
    candidateBinding: comparison.candidateBinding,
    comparisonScope: comparison.comparisonScope,
    rowCount: comparison.rows.length,
    orderedRowIdAndChecksumSha256: kerrSha256Hex(
      kerrStableStringify(
        comparison.rows.map((row) => ({
          rowId: row.rowId,
          rowChecksumSha256: row.rowChecksum.value,
        })),
      ),
    ),
    orderedRowDispositionAndReasonsSha256:
      orderedRowDispositionAndReasonsSha256(
        comparison.rows.map((row) => ({
          rowId: row.rowId,
          rowChecksumSha256: row.rowChecksum.value,
          disposition: row.disposition,
          reasons: row.reasons,
        })),
      ),
    summary: comparison.summary,
    summaryCanonicalSha256: kerrSha256Hex(kerrStableStringify(comparison.summary)),
    tolerances: comparison.tolerances,
    tolerancesCanonicalSha256: kerrSha256Hex(
      kerrStableStringify(comparison.tolerances),
    ),
    observedReasonCodes,
    machineSupportOpinionEligible:
      comparison.summary.numericAgreement ===
        "within-pre-registered-tolerance" && observedReasonCodes.length === 0,
  };
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state:
      "receipt-bound-kerr-scientific-review-subject-awaiting-two-signed-opinions" as const,
    policyVersion: KERR_EXTERNAL_SCIENTIFIC_REVIEW_POLICY_VERSION,
    frozenAt,
    purpose:
      "record-two-non-authoritative-scientific-opinions-over-one-exact-issued-comparison" as const,
    comparisonBinding,
    scientificReviewIdentitySeparationBinding:
      comparison.scientificReviewIdentitySeparationBinding,
    reviewerAssignments,
    requiredRoles: KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES,
    requiredOpinionCount: 2 as const,
    comparisonRowsAndDispositionsAreImmutable: true as const,
    disagreementWaiversAllowed: false as const,
    postRunToleranceChangesAllowed: false as const,
    coordinateTimeAndAffineParameterDeltasAreDiagnosticOnly: true as const,
    cameraScreenToleranceInventedAfterExecution: false as const,
    evidenceLimitations: {
      reviewerAssignmentsDeclaredByCaller: true as const,
      reviewerAssignmentAuthorityAuthenticatedByPackage: false as const,
      reviewerQualificationsVerifiedByPackage: false as const,
      reviewerConflictClearanceVerifiedByPackage: false as const,
      reviewerCredentialValidityAndRevocationVerifiedByPackage: false as const,
      realExternalExecutionEstablishedByPackage: false as const,
      implementationProvenanceVerified: false as const,
      implementationIndependenceVerified: false as const,
      mappingCorrectnessVerified: false as const,
      executionVerified: false as const,
      comparisonTimeAuthenticatedByPackage: false as const,
      sourceExecutionEvidenceStatus:
        "injected-runner-verifier-asserted-not-package-authenticated" as const,
      mappingReviewEvidenceStatus:
        "injected-mapping-verifier-asserted-not-package-authenticated" as const,
      provisionalToleranceAgreementIsValidation: false as const,
      independentReference: "not-run" as const,
      currentEvidenceEligibleForScientificValidation: false as const,
    },
    subjectIsAuthority: false as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
  const subjectId = `krsrsubj_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const subject = deepFreezeKerr(
    KerrExternalScientificReviewSubjectSchema.parse({
      ...unsigned,
      subjectId,
      subjectChecksum: checksum("kerr-external-scientific-review-subject", {
        ...unsigned,
        subjectId,
      }),
    }),
  );
  assertCanonicalByteBudget(
    subject,
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_SUBJECT_MAX_CANONICAL_BYTES,
    "Kerr external scientific-review subject",
  );
  return subject;
}

export interface CreateKerrExternalScientificReviewSubjectInput {
  readonly comparison: ReceiptBoundKerrExternalNumericComparison;
  readonly frozenAt: unknown;
  readonly reviewerAssignments: readonly KerrExternalScientificReviewerAssignment[];
}

const assignedReceiptBoundKerrComparisonsForScientificReview =
  new WeakSet<object>();
const issuedKerrExternalScientificReviewSubjects = new WeakSet<object>();
const kerrExternalScientificReviewSubjectContexts = new WeakMap<
  object,
  {
    readonly comparison: ReceiptBoundKerrExternalNumericComparison;
    readonly attemptedRoles: Set<string>;
  }
>();

export function createKerrExternalScientificReviewSubject(
  input: CreateKerrExternalScientificReviewSubjectInput,
): KerrExternalScientificReviewSubject {
  const comparisonInput = ownDataValue(
    input,
    "comparison",
    "Kerr external scientific-review subject input",
  );
  assertIssuedReceiptBoundKerrExternalNumericComparison(comparisonInput);
  if (
    assignedReceiptBoundKerrComparisonsForScientificReview.has(comparisonInput)
  ) {
    throw new Error(
      "Receipt-bound Kerr numeric comparison already assigned for scientific review",
    );
  }
  const assignmentInputs = preflightExactArray(
    ownDataValue(
      input,
      "reviewerAssignments",
      "Kerr external scientific-review subject input",
    ),
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES.length,
    "Kerr scientific-review reviewer assignments",
  );
  const reviewerAssignments = assignmentInputs.map((assignmentInput, index) => {
    assertKerrComparisonPlainDataTree(
      assignmentInput,
      `Kerr scientific-review reviewer assignment ${index}`,
    );
    return deepFreezeKerr(
      KerrExternalScientificReviewerAssignmentSchema.parse(assignmentInput),
    );
  });
  assertReceiptBoundKerrExternalNumericComparisonIntegrity(comparisonInput);
  assertScientificReviewerAssignments(
    comparisonInput.scientificReviewIdentitySeparationBinding,
    reviewerAssignments,
  );
  const frozenAt = CanonicalTimestampSchema.parse(
    ownDataValue(
      input,
      "frozenAt",
      "Kerr external scientific-review subject input",
    ),
  );
  if (Date.parse(frozenAt) < Date.parse(comparisonInput.comparedAt)) {
    throw new Error("Kerr scientific-review subject predates its comparison");
  }
  if (
    assignedReceiptBoundKerrComparisonsForScientificReview.has(comparisonInput)
  ) {
    throw new Error(
      "Receipt-bound Kerr numeric comparison already assigned for scientific review",
    );
  }
  assignedReceiptBoundKerrComparisonsForScientificReview.add(comparisonInput);
  const subject = buildKerrExternalScientificReviewSubject(
    comparisonInput,
    frozenAt,
    reviewerAssignments,
  );
  issuedKerrExternalScientificReviewSubjects.add(subject);
  kerrExternalScientificReviewSubjectContexts.set(subject, {
    comparison: comparisonInput,
    attemptedRoles: new Set<string>(),
  });
  return subject;
}

export function assertIssuedKerrExternalScientificReviewSubject(
  input: unknown,
): asserts input is KerrExternalScientificReviewSubject {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedKerrExternalScientificReviewSubjects.has(input)
  ) {
    throw new Error(
      "Kerr external scientific-review subject must be issued in this process; structural copies are rejected",
    );
  }
}

export function assertKerrExternalScientificReviewSubjectSelfIntegrity(
  subjectInput: unknown,
): asserts subjectInput is KerrExternalScientificReviewSubject {
  assertKerrComparisonPlainDataTree(
    subjectInput,
    "Kerr external scientific-review subject",
  );
  const subject = KerrExternalScientificReviewSubjectSchema.parse(subjectInput);
  assertAlreadyCanonical(
    subjectInput,
    subject,
    "Kerr external scientific-review subject",
  );
  const { subjectId, subjectChecksum, ...unsigned } = subject;
  const expectedId = `krsrsubj_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const expectedChecksum = checksum("kerr-external-scientific-review-subject", {
    ...unsigned,
    subjectId: expectedId,
  });
  if (
    subjectId !== expectedId ||
    kerrStableStringify(subjectChecksum) !== kerrStableStringify(expectedChecksum)
  ) {
    throw new Error("Kerr external scientific-review subject failed self-integrity replay");
  }
  assertCanonicalByteBudget(
    subject,
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_SUBJECT_MAX_CANONICAL_BYTES,
    "Kerr external scientific-review subject",
  );
}

export function canonicalKerrExternalScientificReviewSubjectBytes(
  subjectInput: unknown,
): Uint8Array {
  assertKerrExternalScientificReviewSubjectSelfIntegrity(subjectInput);
  return new TextEncoder().encode(kerrStableStringify(subjectInput));
}

export function kerrExternalScientificReviewSubjectSha256(
  subjectInput: unknown,
): string {
  return kerrSha256Hex(
    canonicalKerrExternalScientificReviewSubjectBytes(subjectInput),
  );
}

export function assertKerrExternalScientificReviewSubjectIntegrity(
  comparisonInput: unknown,
  subjectInput: unknown,
): asserts subjectInput is KerrExternalScientificReviewSubject {
  assertIssuedKerrExternalScientificReviewSubject(subjectInput);
  assertReceiptBoundKerrExternalNumericComparisonIntegrity(comparisonInput);
  assertKerrExternalScientificReviewSubjectSelfIntegrity(subjectInput);
  const context = kerrExternalScientificReviewSubjectContexts.get(subjectInput);
  if (context === undefined || context.comparison !== comparisonInput) {
    throw new Error(
      "Kerr external scientific-review subject changed its exact issued comparison capability",
    );
  }
  const expected = buildKerrExternalScientificReviewSubject(
    comparisonInput,
    subjectInput.frozenAt,
    subjectInput.reviewerAssignments,
  );
  if (kerrStableStringify(subjectInput) !== kerrStableStringify(expected)) {
    throw new Error(
      "Kerr external scientific-review subject changed its exact comparison binding",
    );
  }
}

function assertIssuedKerrExternalScientificReviewSubjectIntegrity(
  subjectInput: unknown,
): asserts subjectInput is KerrExternalScientificReviewSubject {
  assertIssuedKerrExternalScientificReviewSubject(subjectInput);
  const context = kerrExternalScientificReviewSubjectContexts.get(subjectInput);
  if (context === undefined) {
    throw new Error("Kerr external scientific-review subject context is unavailable");
  }
  assertKerrExternalScientificReviewSubjectIntegrity(
    context.comparison,
    subjectInput,
  );
}

export const KerrExternalScientificReviewEvidenceBindingsSchema = z
  .object({
    scientificAssessmentSha256: Sha256Schema,
    numericalMethodsAssessmentSha256: Sha256Schema,
    toleranceAndCaseCoverageAssessmentSha256: Sha256Schema,
    qualificationEvidenceSha256: Sha256Schema,
    conflictDisclosureSha256: Sha256Schema,
    reviewerNotesSha256: Sha256Schema,
  })
  .strict();
export type KerrExternalScientificReviewEvidenceBindings = z.infer<
  typeof KerrExternalScientificReviewEvidenceBindingsSchema
>;

export const KerrExternalScientificReviewAssertionsSchema = z
  .object({
    exactComparisonArtifactReviewed: z.literal(true),
    everyComparisonRowReviewedInExactOrder: z.literal(true),
    exactSummaryAndTolerancesReviewed: z.literal(true),
    disagreementAndInconclusiveFindingsRetained: z.literal(true),
    noPostRunToleranceChangeApplied: z.literal(true),
    noDisagreementWaiverApplied: z.literal(true),
    cameraScreenToleranceLimitationAcknowledged: z.literal(true),
    coordinateTimeAndAffineDeltasAreDiagnosticOnlyAcknowledged: z.literal(true),
    sameProjectReferenceIsNotIndependentValidationAcknowledged: z.literal(true),
    upstreamInjectedVerifierEvidenceIsNotPackageAuthenticatedAcknowledged:
      z.literal(true),
    checksumsDoNotAuthenticateEvidenceAcknowledged: z.literal(true),
    reviewerIdentitySeparationIsNotImplementationIndependenceAcknowledged:
      z.literal(true),
    reviewerDeclaresNoParticipationInEitherSolverOrMapping: z.literal(true),
    opinionGrantsNoScientificRenderOrReleaseAuthority: z.literal(true),
  })
  .strict();
export type KerrExternalScientificReviewAssertions = z.infer<
  typeof KerrExternalScientificReviewAssertionsSchema
>;

const ScientificReviewStatementChecksumSchema = ScientificReviewChecksumSchema(
  "kerr-external-scientific-review-decision-statement",
);

export const KerrExternalScientificReviewDecisionStatementSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("kerr-external-scientific-review-decision-statement"),
    policyVersion: z.literal(KERR_EXTERNAL_SCIENTIFIC_REVIEW_POLICY_VERSION),
    statementId: z.string().regex(/^krsrstmt_[a-f0-9]{24}$/),
    subjectId: z.string().regex(/^krsrsubj_[a-f0-9]{24}$/),
    subjectChecksumSha256: Sha256Schema,
    reviewedSubjectCanonicalSha256: Sha256Schema,
    subjectFrozenAt: CanonicalTimestampSchema,
    comparisonId: z.string().regex(/^krrbcmp_[a-f0-9]{24}$/),
    comparisonChecksumSha256: Sha256Schema,
    reviewedComparisonCanonicalSha256: Sha256Schema,
    role: ScientificReviewRoleSchema,
    reviewerId: IdentifierSchema,
    roleGrantId: IdentifierSchema,
    keyId: IdentifierSchema,
    decidedAt: CanonicalTimestampSchema,
    expiresAt: CanonicalTimestampSchema,
    observedNumericAgreement:
      ReceiptBoundKerrExternalNumericComparisonSchema.shape.summary.shape
        .numericAgreement,
    observedReasonCodes: z
      .array(ReceiptBoundKerrExternalNumericComparisonReasonSchema)
      .max(KERR_NUMERIC_COMPARISON_REASON_ORDER.length),
    machineSupportOpinionEligible: z.boolean(),
    opinion: KerrExternalScientificReviewOpinionSchema,
    evidenceBindings: KerrExternalScientificReviewEvidenceBindingsSchema,
    reviewAssertions: KerrExternalScientificReviewAssertionsSchema,
    signedPurpose: z.literal(
      "record-one-non-authoritative-scientific-opinion-over-one-exact-issued-comparison",
    ),
    statementChecksum: ScientificReviewStatementChecksumSchema,
  })
  .strict()
  .superRefine((statement, context) => {
    const reasons = statement.observedReasonCodes as KerrNumericComparisonReason[];
    const canonicalReasons = KERR_NUMERIC_COMPARISON_REASON_ORDER.filter((reason) =>
      reasons.includes(reason),
    );
    const expectedSupportEligibility =
      statement.observedNumericAgreement ===
        "within-pre-registered-tolerance" && reasons.length === 0;
    const subjectFrozenAt = Date.parse(statement.subjectFrozenAt);
    const decidedAt = Date.parse(statement.decidedAt);
    const expiresAt = Date.parse(statement.expiresAt);
    if (
      new Set(reasons).size !== reasons.length ||
      kerrStableStringify(reasons) !== kerrStableStringify(canonicalReasons) ||
      statement.machineSupportOpinionEligible !== expectedSupportEligibility ||
      subjectFrozenAt > decidedAt ||
      expiresAt <= decidedAt ||
      expiresAt - decidedAt >
        KERR_EXTERNAL_SCIENTIFIC_REVIEW_MAX_VALIDITY_SECONDS * 1_000 ||
      (statement.opinion ===
        "supports-provisional-bounded-vacuum-metric-agreement" &&
        !statement.machineSupportOpinionEligible)
    ) {
      context.addIssue({
        code: "custom",
        path: ["opinion"],
        message:
          "Kerr scientific-review chronology, support eligibility, or observed reasons are inconsistent",
      });
    }
  });
export type KerrExternalScientificReviewDecisionStatement = z.infer<
  typeof KerrExternalScientificReviewDecisionStatementSchema
>;

export interface CreateKerrExternalScientificReviewDecisionStatementInput {
  readonly subject: KerrExternalScientificReviewSubject;
  readonly role: unknown;
  readonly decidedAt: unknown;
  readonly expiresAt: unknown;
  readonly opinion: unknown;
  readonly evidenceBindings: unknown;
  readonly reviewAssertions: unknown;
}

const issuedKerrExternalScientificReviewDecisionStatements =
  new WeakSet<object>();
const kerrExternalScientificReviewDecisionStatementContexts = new WeakMap<
  object,
  {
    readonly subject: KerrExternalScientificReviewSubject;
  }
>();

export function createKerrExternalScientificReviewDecisionStatement(
  input: CreateKerrExternalScientificReviewDecisionStatementInput,
): KerrExternalScientificReviewDecisionStatement {
  const subjectInput = ownDataValue(
    input,
    "subject",
    "Kerr scientific-review decision statement input",
  );
  assertIssuedKerrExternalScientificReviewSubjectIntegrity(subjectInput);
  const subject = subjectInput;
  const role = ScientificReviewRoleSchema.parse(
    ownDataValue(input, "role", "Kerr scientific-review decision statement input"),
  );
  const subjectContext = kerrExternalScientificReviewSubjectContexts.get(subject);
  if (subjectContext === undefined) {
    throw new Error("Kerr external scientific-review subject context is unavailable");
  }
  if (subjectContext.attemptedRoles.has(role)) {
    throw new Error(
      `Kerr scientific-review subject already issued its ${role} statement`,
    );
  }
  const assignment = subject.reviewerAssignments.find(
    (candidate) => candidate.role === role,
  );
  if (assignment === undefined) {
    throw new Error("Kerr scientific-review role has no frozen reviewer assignment");
  }
  const decidedAt = CanonicalTimestampSchema.parse(
    ownDataValue(
      input,
      "decidedAt",
      "Kerr scientific-review decision statement input",
    ),
  );
  const expiresAt = CanonicalTimestampSchema.parse(
    ownDataValue(
      input,
      "expiresAt",
      "Kerr scientific-review decision statement input",
    ),
  );
  if (
    Date.parse(decidedAt) < Date.parse(subject.frozenAt) ||
    Date.parse(expiresAt) <= Date.parse(decidedAt) ||
    Date.parse(expiresAt) - Date.parse(decidedAt) >
      KERR_EXTERNAL_SCIENTIFIC_REVIEW_MAX_VALIDITY_SECONDS * 1_000
  ) {
    throw new Error("Kerr scientific-review decision chronology is invalid");
  }
  const opinion = KerrExternalScientificReviewOpinionSchema.parse(
    ownDataValue(
      input,
      "opinion",
      "Kerr scientific-review decision statement input",
    ),
  );
  if (
    opinion === "supports-provisional-bounded-vacuum-metric-agreement" &&
    !subject.comparisonBinding.machineSupportOpinionEligible
  ) {
    throw new Error(
      "A supporting Kerr scientific-review opinion cannot override disagreement, inconclusive results, or unadjudicated screen coordinates",
    );
  }
  const evidenceInput = ownDataValue(
    input,
    "evidenceBindings",
    "Kerr scientific-review decision statement input",
  );
  const assertionsInput = ownDataValue(
    input,
    "reviewAssertions",
    "Kerr scientific-review decision statement input",
  );
  assertKerrComparisonPlainDataTree(
    evidenceInput,
    "Kerr scientific-review evidence bindings",
  );
  assertKerrComparisonPlainDataTree(
    assertionsInput,
    "Kerr scientific-review assertions",
  );
  const evidenceBindings = KerrExternalScientificReviewEvidenceBindingsSchema.parse(
    evidenceInput,
  );
  const reviewAssertions = KerrExternalScientificReviewAssertionsSchema.parse(
    assertionsInput,
  );
  if (subjectContext.attemptedRoles.has(role)) {
    throw new Error(
      `Kerr scientific-review subject already issued its ${role} statement`,
    );
  }
  subjectContext.attemptedRoles.add(role);
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "kerr-external-scientific-review-decision-statement" as const,
    policyVersion: KERR_EXTERNAL_SCIENTIFIC_REVIEW_POLICY_VERSION,
    subjectId: subject.subjectId,
    subjectChecksumSha256: subject.subjectChecksum.value,
    reviewedSubjectCanonicalSha256:
      kerrExternalScientificReviewSubjectSha256(subject),
    subjectFrozenAt: subject.frozenAt,
    comparisonId: subject.comparisonBinding.comparisonId,
    comparisonChecksumSha256:
      subject.comparisonBinding.comparisonChecksumSha256,
    reviewedComparisonCanonicalSha256:
      subject.comparisonBinding.comparisonCanonicalSha256,
    role,
    reviewerId: assignment.reviewerId,
    roleGrantId: assignment.roleGrantId,
    keyId: assignment.keyId,
    decidedAt,
    expiresAt,
    observedNumericAgreement: subject.comparisonBinding.summary.numericAgreement,
    observedReasonCodes: subject.comparisonBinding.observedReasonCodes,
    machineSupportOpinionEligible:
      subject.comparisonBinding.machineSupportOpinionEligible,
    opinion,
    evidenceBindings,
    reviewAssertions,
    signedPurpose:
      "record-one-non-authoritative-scientific-opinion-over-one-exact-issued-comparison" as const,
  };
  const statementId = `krsrstmt_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const statement = deepFreezeKerr(
    KerrExternalScientificReviewDecisionStatementSchema.parse({
      ...unsigned,
      statementId,
      statementChecksum: checksum(
        "kerr-external-scientific-review-decision-statement",
        { ...unsigned, statementId },
      ),
    }),
  );
  assertCanonicalByteBudget(
    statement,
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_DECISION_MAX_CANONICAL_BYTES,
    "Kerr external scientific-review decision statement",
  );
  issuedKerrExternalScientificReviewDecisionStatements.add(statement);
  kerrExternalScientificReviewDecisionStatementContexts.set(statement, {
    subject,
  });
  return statement;
}

export function assertKerrExternalScientificReviewDecisionStatementSelfIntegrity(
  statementInput: unknown,
): asserts statementInput is KerrExternalScientificReviewDecisionStatement {
  assertKerrComparisonPlainDataTree(
    statementInput,
    "Kerr scientific-review decision statement",
  );
  const statement = KerrExternalScientificReviewDecisionStatementSchema.parse(
    statementInput,
  );
  assertAlreadyCanonical(
    statementInput,
    statement,
    "Kerr scientific-review decision statement",
  );
  const { statementId, statementChecksum, ...unsigned } = statement;
  const expectedId = `krsrstmt_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const expectedChecksum = checksum(
    "kerr-external-scientific-review-decision-statement",
    { ...unsigned, statementId: expectedId },
  );
  if (
    statementId !== expectedId ||
    kerrStableStringify(statementChecksum) !== kerrStableStringify(expectedChecksum)
  ) {
    throw new Error(
      "Kerr scientific-review decision statement failed self-integrity replay",
    );
  }
  assertCanonicalByteBudget(
    statement,
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_DECISION_MAX_CANONICAL_BYTES,
    "Kerr external scientific-review decision statement",
  );
}

export function assertIssuedKerrExternalScientificReviewDecisionStatement(
  input: unknown,
): asserts input is KerrExternalScientificReviewDecisionStatement {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedKerrExternalScientificReviewDecisionStatements.has(input)
  ) {
    throw new Error(
      "Kerr external scientific-review decision statement must be issued in this process; structural copies are rejected",
    );
  }
}

export function assertKerrExternalScientificReviewDecisionStatementIntegrity(
  statementInput: unknown,
): asserts statementInput is KerrExternalScientificReviewDecisionStatement {
  assertIssuedKerrExternalScientificReviewDecisionStatement(statementInput);
  assertKerrExternalScientificReviewDecisionStatementSelfIntegrity(statementInput);
  const context =
    kerrExternalScientificReviewDecisionStatementContexts.get(statementInput);
  if (context === undefined) {
    throw new Error(
      "Kerr external scientific-review decision statement context is unavailable",
    );
  }
  assertIssuedKerrExternalScientificReviewSubjectIntegrity(context.subject);
  const assignment = context.subject.reviewerAssignments.find(
    (candidate) => candidate.role === statementInput.role,
  );
  if (
    assignment === undefined ||
    statementInput.reviewerId !== assignment.reviewerId ||
    statementInput.roleGrantId !== assignment.roleGrantId ||
    statementInput.keyId !== assignment.keyId ||
    statementInput.subjectId !== context.subject.subjectId ||
    statementInput.subjectChecksumSha256 !==
      context.subject.subjectChecksum.value ||
    statementInput.reviewedSubjectCanonicalSha256 !==
      kerrExternalScientificReviewSubjectSha256(context.subject) ||
    statementInput.subjectFrozenAt !== context.subject.frozenAt ||
    statementInput.comparisonId !==
      context.subject.comparisonBinding.comparisonId ||
    statementInput.comparisonChecksumSha256 !==
      context.subject.comparisonBinding.comparisonChecksumSha256 ||
    statementInput.reviewedComparisonCanonicalSha256 !==
      context.subject.comparisonBinding.comparisonCanonicalSha256 ||
    statementInput.observedNumericAgreement !==
      context.subject.comparisonBinding.summary.numericAgreement ||
    kerrStableStringify(statementInput.observedReasonCodes) !==
      kerrStableStringify(
        context.subject.comparisonBinding.observedReasonCodes,
      ) ||
    statementInput.machineSupportOpinionEligible !==
      context.subject.comparisonBinding.machineSupportOpinionEligible ||
    Date.parse(statementInput.decidedAt) < Date.parse(context.subject.frozenAt) ||
    Date.parse(statementInput.expiresAt) <= Date.parse(statementInput.decidedAt) ||
    Date.parse(statementInput.expiresAt) - Date.parse(statementInput.decidedAt) >
      KERR_EXTERNAL_SCIENTIFIC_REVIEW_MAX_VALIDITY_SECONDS * 1_000
  ) {
    throw new Error(
      "Kerr external scientific-review decision statement failed exact issued-subject integrity replay",
    );
  }
}

export function canonicalKerrExternalScientificReviewDecisionStatementBytes(
  statementInput: unknown,
): Uint8Array {
  assertKerrExternalScientificReviewDecisionStatementSelfIntegrity(statementInput);
  return new TextEncoder().encode(kerrStableStringify(statementInput));
}

export function kerrExternalScientificReviewDecisionStatementSha256(
  statementInput: unknown,
): string {
  return kerrSha256Hex(
    canonicalKerrExternalScientificReviewDecisionStatementBytes(statementInput),
  );
}

const SignatureEnvelopeBindingSchema = z
  .object({
    mediaType: z.literal("application/octet-stream"),
    encoding: z.literal("opaque-exact-bytes"),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES),
    sha256: Sha256Schema,
  })
  .strict();

const ScientificReviewDecisionChecksumSchema = ScientificReviewChecksumSchema(
  "kerr-external-scientific-review-decision",
);

export const KerrExternalScientificReviewDecisionSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "declared-signed-kerr-external-scientific-review-opinion-awaiting-injected-verification",
    ),
    decisionId: z.string().regex(/^krsrdec_[a-f0-9]{24}$/),
    statement: KerrExternalScientificReviewDecisionStatementSchema,
    signedStatementSha256: Sha256Schema,
    signatureEnvelope: SignatureEnvelopeBindingSchema,
    signatureEnvelopeDeclared: z.literal(true),
    signatureVerifiedByPackage: z.literal(false),
    reviewerAuthorityAuthenticatedByPackage: z.literal(false),
    scientificReviewOpinionIsValidation: z.literal(false),
    decisionIsAuthority: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    decisionChecksum: ScientificReviewDecisionChecksumSchema,
  })
  .strict();
export type KerrExternalScientificReviewDecision = z.infer<
  typeof KerrExternalScientificReviewDecisionSchema
>;

export interface CreateKerrExternalScientificReviewDecisionInput {
  readonly statement: KerrExternalScientificReviewDecisionStatement;
  readonly signatureEnvelopeBytes: Uint8Array;
}

const issuedKerrExternalScientificReviewDecisions = new WeakSet<object>();
const attemptedKerrExternalScientificReviewStatementDecisions =
  new WeakSet<object>();
const kerrExternalScientificReviewDecisionContexts = new WeakMap<
  object,
  {
    readonly subject: KerrExternalScientificReviewSubject;
    readonly statement: KerrExternalScientificReviewDecisionStatement;
    readonly signatureEnvelopeBytes: Uint8Array;
  }
>();

export function createKerrExternalScientificReviewDecision(
  input: CreateKerrExternalScientificReviewDecisionInput,
): KerrExternalScientificReviewDecision {
  const signatureEnvelopeBytes = exactUint8ArrayCopy(
    ownDataValue(
      input,
      "signatureEnvelopeBytes",
      "Kerr scientific-review decision input",
    ),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
    "Kerr scientific-review signature envelope",
  );
  const statementInput = ownDataValue(
    input,
    "statement",
    "Kerr scientific-review decision input",
  );
  assertKerrExternalScientificReviewDecisionStatementIntegrity(statementInput);
  const statement = statementInput;
  if (
    attemptedKerrExternalScientificReviewStatementDecisions.has(statement)
  ) {
    throw new Error(
      "Kerr external scientific-review statement already attempted a signed decision",
    );
  }
  attemptedKerrExternalScientificReviewStatementDecisions.add(statement);
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state:
      "declared-signed-kerr-external-scientific-review-opinion-awaiting-injected-verification" as const,
    statement,
    signedStatementSha256:
      kerrExternalScientificReviewDecisionStatementSha256(statement),
    signatureEnvelope: {
      mediaType: "application/octet-stream" as const,
      encoding: "opaque-exact-bytes" as const,
      byteLength: signatureEnvelopeBytes.byteLength,
      sha256: kerrSha256Hex(signatureEnvelopeBytes),
    },
    signatureEnvelopeDeclared: true as const,
    signatureVerifiedByPackage: false as const,
    reviewerAuthorityAuthenticatedByPackage: false as const,
    scientificReviewOpinionIsValidation: false as const,
    decisionIsAuthority: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
  const decisionId = `krsrdec_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const decision = deepFreezeKerr(
    KerrExternalScientificReviewDecisionSchema.parse({
      ...unsigned,
      decisionId,
      decisionChecksum: checksum("kerr-external-scientific-review-decision", {
        ...unsigned,
        decisionId,
      }),
    }),
  );
  assertCanonicalByteBudget(
    decision,
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_DECISION_MAX_CANONICAL_BYTES,
    "Kerr external scientific-review decision",
  );
  const statementContext =
    kerrExternalScientificReviewDecisionStatementContexts.get(statement);
  if (statementContext === undefined) {
    throw new Error(
      "Kerr external scientific-review decision statement context is unavailable",
    );
  }
  issuedKerrExternalScientificReviewDecisions.add(decision);
  kerrExternalScientificReviewDecisionContexts.set(decision, {
    subject: statementContext.subject,
    statement,
    signatureEnvelopeBytes: new Uint8Array(signatureEnvelopeBytes),
  });
  return decision;
}

export function assertKerrExternalScientificReviewDecisionSelfIntegrity(
  decisionInput: unknown,
): asserts decisionInput is KerrExternalScientificReviewDecision {
  assertKerrComparisonPlainDataTree(
    decisionInput,
    "Kerr external scientific-review decision",
  );
  const decision = KerrExternalScientificReviewDecisionSchema.parse(decisionInput);
  assertAlreadyCanonical(
    decisionInput,
    decision,
    "Kerr external scientific-review decision",
  );
  assertKerrExternalScientificReviewDecisionStatementSelfIntegrity(
    decision.statement,
  );
  const { decisionId, decisionChecksum, ...unsigned } = decision;
  const expectedId = `krsrdec_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const expectedChecksum = checksum("kerr-external-scientific-review-decision", {
    ...unsigned,
    decisionId: expectedId,
  });
  if (
    decision.signedStatementSha256 !==
      kerrExternalScientificReviewDecisionStatementSha256(decision.statement) ||
    decisionId !== expectedId ||
    kerrStableStringify(decisionChecksum) !== kerrStableStringify(expectedChecksum)
  ) {
    throw new Error(
      "Kerr external scientific-review decision failed self-integrity replay",
    );
  }
  assertCanonicalByteBudget(
    decision,
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_DECISION_MAX_CANONICAL_BYTES,
    "Kerr external scientific-review decision",
  );
}

export function assertIssuedKerrExternalScientificReviewDecision(
  input: unknown,
): asserts input is KerrExternalScientificReviewDecision {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedKerrExternalScientificReviewDecisions.has(input)
  ) {
    throw new Error(
      "Kerr external scientific-review decision must be issued in this process; structural copies are rejected",
    );
  }
}

export function assertKerrExternalScientificReviewDecisionIntegrity(
  subjectInput: unknown,
  decisionInput: unknown,
  signatureEnvelopeBytesInput: unknown,
): asserts decisionInput is KerrExternalScientificReviewDecision {
  const signatureEnvelopeBytes = exactUint8ArrayCopy(
    signatureEnvelopeBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
    "Kerr scientific-review signature envelope",
  );
  assertIssuedKerrExternalScientificReviewSubjectIntegrity(subjectInput);
  assertIssuedKerrExternalScientificReviewDecision(decisionInput);
  assertKerrExternalScientificReviewDecisionSelfIntegrity(decisionInput);
  const context = kerrExternalScientificReviewDecisionContexts.get(decisionInput);
  if (context === undefined) {
    throw new Error("Kerr external scientific-review decision context is unavailable");
  }
  assertKerrExternalScientificReviewDecisionStatementIntegrity(
    context.statement,
  );
  const subject = subjectInput;
  const decision = decisionInput;
  const statement = context.statement;
  if (
    context.subject !== subject ||
    kerrStableStringify(decision.statement) !== kerrStableStringify(statement) ||
    statement.subjectId !== subject.subjectId ||
    statement.subjectChecksumSha256 !== subject.subjectChecksum.value ||
    statement.reviewedSubjectCanonicalSha256 !==
      kerrExternalScientificReviewSubjectSha256(subject) ||
    statement.comparisonId !== subject.comparisonBinding.comparisonId ||
    statement.comparisonChecksumSha256 !==
      subject.comparisonBinding.comparisonChecksumSha256 ||
    statement.reviewedComparisonCanonicalSha256 !==
      subject.comparisonBinding.comparisonCanonicalSha256 ||
    statement.observedNumericAgreement !==
      subject.comparisonBinding.summary.numericAgreement ||
    kerrStableStringify(statement.observedReasonCodes) !==
      kerrStableStringify(subject.comparisonBinding.observedReasonCodes) ||
    statement.machineSupportOpinionEligible !==
      subject.comparisonBinding.machineSupportOpinionEligible
  ) {
    throw new Error("Kerr scientific-review decision changed its subject");
  }
  if (
    !exactBytesEqual(context.signatureEnvelopeBytes, signatureEnvelopeBytes) ||
    decision.signatureEnvelope.byteLength !== signatureEnvelopeBytes.byteLength ||
    decision.signatureEnvelope.sha256 !== kerrSha256Hex(signatureEnvelopeBytes)
  ) {
    throw new Error(
      "Kerr external scientific-review decision failed exact integrity replay",
    );
  }
}

export const KerrExternalScientificReviewVerifierReceiptSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "kerr-external-scientific-review-opinion-accepted-by-injected-verifier",
    ),
    accepted: z.literal(true),
    verificationPolicyId: IdentifierSchema,
    subjectId: z.string().regex(/^krsrsubj_[a-f0-9]{24}$/),
    subjectChecksumSha256: Sha256Schema,
    subjectCanonicalSha256: Sha256Schema,
    comparisonId: z.string().regex(/^krrbcmp_[a-f0-9]{24}$/),
    comparisonChecksumSha256: Sha256Schema,
    comparisonCanonicalSha256: Sha256Schema,
    decisionId: z.string().regex(/^krsrdec_[a-f0-9]{24}$/),
    decisionChecksumSha256: Sha256Schema,
    statementId: z.string().regex(/^krsrstmt_[a-f0-9]{24}$/),
    statementChecksumSha256: Sha256Schema,
    signedStatementSha256: Sha256Schema,
    signatureEnvelopeSha256: Sha256Schema,
    signatureEnvelopeByteLength: z
      .number()
      .int()
      .positive()
      .max(KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES),
    role: ScientificReviewRoleSchema,
    reviewerId: IdentifierSchema,
    roleGrantId: IdentifierSchema,
    reviewerKeyId: IdentifierSchema,
    checkedAt: CanonicalTimestampSchema,
    reviewerSignatureVerified: z.literal(true),
    reviewerRoleGrantValid: z.literal(true),
    reviewerKeyValid: z.literal(true),
    reviewerKeyPurposeVerified: z.literal(true),
    reviewerRoleGrantNotRevoked: z.literal(true),
    reviewerKeyNotRevoked: z.literal(true),
    decisionPurposeVerified: z.literal(true),
    exactSubjectBindingVerified: z.literal(true),
    exactComparisonBindingVerified: z.literal(true),
    exactOrderedRowsAndSummaryBindingVerified: z.literal(true),
    evidenceDigestBindingsVerified: z.literal(true),
    signedReviewAssertionsVerified: z.literal(true),
    reviewerIdentitySeparationVerified: z.literal(true),
    verifierAssertsReviewNotCallerDeclared: z.literal(true),
    verifierAssertsNoScientificAuthorityGranted: z.literal(true),
    verifierAuthorityAuthenticatedByPackage: z.literal(false),
    scientificValidationPassed: z.literal(false),
    independentValidationPassed: z.literal(false),
    renderAllowed: z.literal(false),
    releaseEligible: z.literal(false),
  })
  .strict();
export type KerrExternalScientificReviewVerifierReceipt = z.infer<
  typeof KerrExternalScientificReviewVerifierReceiptSchema
>;

export type KerrExternalScientificReviewVerifier = (
  comparison: Readonly<ReceiptBoundKerrExternalNumericComparison>,
  subject: Readonly<KerrExternalScientificReviewSubject>,
  decision: Readonly<KerrExternalScientificReviewDecision>,
  signatureEnvelopeBytes: Uint8Array,
  checkedAt: string,
) => unknown | Promise<unknown>;

function assertScientificReviewVerifierReceiptMatches(
  receipt: KerrExternalScientificReviewVerifierReceipt,
  comparison: ReceiptBoundKerrExternalNumericComparison,
  subject: KerrExternalScientificReviewSubject,
  decision: KerrExternalScientificReviewDecision,
  signatureEnvelopeBytes: Uint8Array,
  checkedAt: string,
): void {
  const statement = decision.statement;
  if (
    receipt.subjectId !== subject.subjectId ||
    receipt.subjectChecksumSha256 !== subject.subjectChecksum.value ||
    receipt.subjectCanonicalSha256 !==
      kerrExternalScientificReviewSubjectSha256(subject) ||
    receipt.comparisonId !== comparison.comparisonId ||
    receipt.comparisonChecksumSha256 !== comparison.comparisonChecksum.value ||
    receipt.comparisonCanonicalSha256 !==
      subject.comparisonBinding.comparisonCanonicalSha256 ||
    receipt.decisionId !== decision.decisionId ||
    receipt.decisionChecksumSha256 !== decision.decisionChecksum.value ||
    receipt.statementId !== statement.statementId ||
    receipt.statementChecksumSha256 !== statement.statementChecksum.value ||
    receipt.signedStatementSha256 !== decision.signedStatementSha256 ||
    receipt.signatureEnvelopeSha256 !== kerrSha256Hex(signatureEnvelopeBytes) ||
    receipt.signatureEnvelopeByteLength !== signatureEnvelopeBytes.byteLength ||
    receipt.role !== statement.role ||
    receipt.reviewerId !== statement.reviewerId ||
    receipt.roleGrantId !== statement.roleGrantId ||
    receipt.reviewerKeyId !== statement.keyId ||
    receipt.checkedAt !== checkedAt
  ) {
    throw new Error(
      "Injected Kerr scientific-review verifier receipt binding mismatch",
    );
  }
}

function assertTwoScientificReviewersAreDistinct(
  subject: KerrExternalScientificReviewSubject,
  decisions: readonly KerrExternalScientificReviewDecision[],
): void {
  const ids = new Set<string>();
  const grants = new Set<string>();
  const keys = new Set<string>();
  for (const [index, decision] of decisions.entries()) {
    const { reviewerId, roleGrantId, keyId } = decision.statement;
    const assignment = subject.reviewerAssignments[index];
    if (
      assignment === undefined ||
      decision.statement.role !== assignment.role ||
      reviewerId !== assignment.reviewerId ||
      roleGrantId !== assignment.roleGrantId ||
      keyId !== assignment.keyId
    ) {
      throw new Error(
        "Kerr scientific-review decision changed its frozen reviewer assignment",
      );
    }
    assertScientificReviewerSeparatedFromPriorActors(
      subject.scientificReviewIdentitySeparationBinding,
      reviewerId,
      roleGrantId,
      keyId,
    );
    if (ids.has(reviewerId) || grants.has(roleGrantId) || keys.has(keyId)) {
      throw new Error(
        "The two Kerr scientific reviewers must use distinct identities, grants, and keys",
      );
    }
    ids.add(reviewerId);
    grants.add(roleGrantId);
    keys.add(keyId);
  }
}

const ScientificReviewRowBindingSchema = z
  .object({
    caseOrdinal: z.number().int().min(0).max(7),
    rayOrdinal: z
      .number()
      .int()
      .min(0)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
    comparisonRowId: z.string().regex(/^krrbcmprow_[a-f0-9]{24}$/),
    comparisonRowChecksumSha256: Sha256Schema,
    caseId: z.string().regex(/^krcase_[a-z0-9][a-z0-9-]{2,63}$/),
    planReferenceRayId: z.string().regex(/^krray_[a-f0-9]{24}$/),
    disposition: ReceiptBoundKerrExternalNumericComparisonDispositionSchema,
    reasons: z
      .array(ReceiptBoundKerrExternalNumericComparisonReasonSchema)
      .max(KERR_NUMERIC_COMPARISON_REASON_ORDER.length),
  })
  .strict()
  .superRefine((row, context) => {
    const reasons = row.reasons as KerrNumericComparisonReason[];
    const canonicalReasons = KERR_NUMERIC_COMPARISON_REASON_ORDER.filter((reason) =>
      reasons.includes(reason),
    );
    if (
      new Set(reasons).size !== reasons.length ||
      kerrStableStringify(reasons) !== kerrStableStringify(canonicalReasons)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: "Kerr scientific-review row reasons are not canonical",
      });
    }
  });

const ScientificReviewDecisionBindingSchema = z
  .object({
    role: ScientificReviewRoleSchema,
    decisionId: z.string().regex(/^krsrdec_[a-f0-9]{24}$/),
    decisionChecksumSha256: Sha256Schema,
    statementId: z.string().regex(/^krsrstmt_[a-f0-9]{24}$/),
    statementChecksumSha256: Sha256Schema,
    signedStatementSha256: Sha256Schema,
    signatureEnvelopeSha256: Sha256Schema,
    signatureEnvelopeByteLength: z
      .number()
      .int()
      .positive()
      .max(KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES),
    reviewerId: IdentifierSchema,
    roleGrantId: IdentifierSchema,
    reviewerKeyId: IdentifierSchema,
    decidedAt: CanonicalTimestampSchema,
    expiresAt: CanonicalTimestampSchema,
    opinion: KerrExternalScientificReviewOpinionSchema,
    evidenceBindingsCanonicalSha256: Sha256Schema,
    reviewAssertionsCanonicalSha256: Sha256Schema,
    injectedVerificationPolicyId: IdentifierSchema,
    injectedVerifierReceiptCanonicalSha256: Sha256Schema,
  })
  .strict();

const ScientificReviewOpinionCountsSchema = z
  .object({
    supportsProvisionalBoundedVacuumMetricAgreement: z
      .number()
      .int()
      .min(0)
      .max(2),
    doesNotSupportProvisionalBoundedVacuumMetricAgreement: z
      .number()
      .int()
      .min(0)
      .max(2),
    insufficientEvidence: z.number().int().min(0).max(2),
  })
  .strict();

const ScientificReviewRecordChecksumSchema = ScientificReviewChecksumSchema(
  "receipt-bound-kerr-external-scientific-opinion-record",
);

const FutureScientificValidationPrerequisitesSchema = z
  .object({
    realExternalExecution: z.literal(true),
    authenticatedSourceExecutableAndNormalizerLineage: z.literal(true),
    verifiedMappingCorrectness: z.literal(true),
    verifiedImplementationIndependence: z.literal(true),
    authenticatedReviewerAuthorityQualificationsAndConflictClearance:
      z.literal(true),
    authoritativeTimeAndRevocation: z.literal(true),
    durableEvidencePreservation: z.literal(true),
  })
  .strict();

export const ReceiptBoundKerrExternalScientificOpinionRecordSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "receipt-bound-kerr-scientific-review-opinions-recorded-insufficient-authenticated-evidence",
    ),
    recordId: z.string().regex(/^krsrrec_[a-f0-9]{24}$/),
    recordedAt: CanonicalTimestampSchema,
    subjectBinding: z
      .object({
        subjectId: z.string().regex(/^krsrsubj_[a-f0-9]{24}$/),
        subjectChecksumSha256: Sha256Schema,
        subjectCanonicalSha256: Sha256Schema,
        frozenAt: CanonicalTimestampSchema,
      })
      .strict(),
    comparisonBinding: z
      .object({
        comparisonId: z.string().regex(/^krrbcmp_[a-f0-9]{24}$/),
        comparisonChecksumSha256: Sha256Schema,
        comparisonCanonicalSha256: Sha256Schema,
        comparedAt: CanonicalTimestampSchema,
        preparationId: z.string().regex(/^krrprep_[a-f0-9]{24}$/),
        candidateId: z.string().regex(/^krrbccand_[a-f0-9]{24}$/),
        admissionId: z.string().regex(/^krxadmit_[a-f0-9]{24}$/),
        planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
        mappingReviewDecisionId: z.string().regex(/^krmapdec_[a-f0-9]{24}$/),
        caseCount: z.number().int().min(1).max(8),
        rowCount: z
          .number()
          .int()
          .positive()
          .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
        orderedRowIdAndChecksumSha256: Sha256Schema,
        orderedRowDispositionAndReasonsSha256: Sha256Schema,
      })
      .strict(),
    requiredRoles: z.tuple([
      z.literal("relativistic-physics"),
      z.literal("numerical-methods"),
    ]),
    reviews: z.array(ScientificReviewDecisionBindingSchema).length(2),
    opinionCounts: ScientificReviewOpinionCountsSchema,
    aggregateOpinion: z.enum([
      "unanimous-provisional-support-recorded",
      "opposition-recorded",
      "inconclusive-recorded",
    ]),
    reviewedRows: z
      .array(ScientificReviewRowBindingSchema)
      .min(1)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    comparisonSummary:
      ReceiptBoundKerrExternalNumericComparisonSchema.shape.summary,
    tolerances: ReceiptBoundKerrExternalNumericComparisonSchema.shape.tolerances,
    observedReasonCodes: z
      .array(ReceiptBoundKerrExternalNumericComparisonReasonSchema)
      .max(KERR_NUMERIC_COMPARISON_REASON_ORDER.length),
    scientificReviewProtocolCompleted: z.literal(true),
    scientificReviewOpinionsRecorded: z.literal(true),
    sourceComparisonCapabilityConsumedInProcess: z.literal(true),
    exactIssuedComparisonIntegrityReplayed: z.literal(true),
    exactPrivateComparisonContextReplayed: z.literal(true),
    reviewersDeclaredAllRowsReviewedInExactOrder: z.literal(true),
    exactComparisonRowBindingsPreservedInOrder: z.literal(true),
    numericDispositionsAndReasonsPreserved: z.literal(true),
    disagreementWaiversApplied: z.literal(false),
    postRunToleranceChangesApplied: z.literal(false),
    coordinateTimeAndAffineParameterDeltasRemainDiagnosticOnly: z.literal(true),
    cameraScreenToleranceInventedAfterExecution: z.literal(false),
    declaredTwoRoleIdentityValuesSeparatedByPackage: z.literal(true),
    reviewerOpinionSignaturesAcceptedByInjectedBoundary: z.literal(true),
    injectedScientificVerifierAuthorityAuthenticatedByPackage: z.literal(false),
    reviewerAssignmentsDeclaredByCaller: z.literal(true),
    reviewerAssignmentAuthorityAuthenticatedByPackage: z.literal(false),
    reviewerQualificationsVerifiedByPackage: z.literal(false),
    reviewerConflictClearanceVerifiedByPackage: z.literal(false),
    reviewerCredentialValidityAndRevocationVerifiedByPackage: z.literal(false),
    reviewerIdentitySeparationEstablishesImplementationIndependence:
      z.literal(false),
    currentEvidenceEligibleForScientificValidation: z.literal(false),
    scientificAdjudicationEstablishedByPackage: z.literal(false),
    nonAuthoritativePrerequisiteRecordCapabilityIssued: z.literal(true),
    authenticationOfThisRecordAloneCanEstablishScientificValidation:
      z.literal(false),
    futureScientificValidationPrerequisitesStillRequired:
      FutureScientificValidationPrerequisitesSchema,
    futureAuthenticatedValidationConsumerImplemented: z.literal(false),
    recordCapabilityConsumedAtIssuance: z.literal(false),
    durableScientificReviewRecorded: z.literal(false),
    adjudicationTimeAuthenticatedByPackage: z.literal(false),
    declaredAdjudicationChronologyChecked: z.literal(true),
    realExternalExecutionEstablishedByPackage: z.literal(false),
    provisionalToleranceAgreementIsValidation: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    recordChecksum: ScientificReviewRecordChecksumSchema,
  })
  .strict()
  .superRefine((record, context) => {
    const expectedRoles = KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES;
    const roles = record.reviews.map((review) => review.role);
    const opinions = record.reviews.map((review) => review.opinion);
    const expectedCounts = {
      supportsProvisionalBoundedVacuumMetricAgreement: opinions.filter(
        (opinion) =>
          opinion ===
          "supports-provisional-bounded-vacuum-metric-agreement",
      ).length,
      doesNotSupportProvisionalBoundedVacuumMetricAgreement: opinions.filter(
        (opinion) =>
          opinion ===
          "does-not-support-provisional-bounded-vacuum-metric-agreement",
      ).length,
      insufficientEvidence: opinions.filter(
        (opinion) => opinion === "insufficient-evidence",
      ).length,
    };
    const expectedAggregate =
      expectedCounts.doesNotSupportProvisionalBoundedVacuumMetricAgreement > 0
        ? "opposition-recorded"
        : expectedCounts.insufficientEvidence > 0
          ? "inconclusive-recorded"
          : "unanimous-provisional-support-recorded";
    const reviewerIds = new Set(record.reviews.map((review) => review.reviewerId));
    const reviewerGrants = new Set(
      record.reviews.map((review) => review.roleGrantId),
    );
    const reviewerKeys = new Set(
      record.reviews.map((review) => review.reviewerKeyId),
    );
    const supportingOpinionIsIneligible = record.reviews.some(
      (review) =>
        review.opinion ===
          "supports-provisional-bounded-vacuum-metric-agreement" &&
        (record.comparisonSummary.numericAgreement !==
          "within-pre-registered-tolerance" ||
          record.observedReasonCodes.length !== 0),
    );
    if (
      kerrStableStringify(roles) !== kerrStableStringify(expectedRoles) ||
      reviewerIds.size !== record.reviews.length ||
      reviewerGrants.size !== record.reviews.length ||
      reviewerKeys.size !== record.reviews.length ||
      supportingOpinionIsIneligible ||
      kerrStableStringify(record.opinionCounts) !==
        kerrStableStringify(expectedCounts) ||
      record.aggregateOpinion !== expectedAggregate ||
      record.comparisonBinding.rowCount !== record.reviewedRows.length ||
      record.comparisonSummary.rowCount !== record.reviewedRows.length ||
      (record.aggregateOpinion === "unanimous-provisional-support-recorded" &&
        record.comparisonSummary.numericAgreement !==
          "within-pre-registered-tolerance")
    ) {
      context.addIssue({
        code: "custom",
        path: ["reviews"],
        message: "Kerr scientific opinion aggregation is inconsistent",
      });
    }
    const comparisonTime = Date.parse(record.comparisonBinding.comparedAt);
    const subjectTime = Date.parse(record.subjectBinding.frozenAt);
    const recordedTime = Date.parse(record.recordedAt);
    const chronologyInvalid =
      comparisonTime > subjectTime ||
      record.reviews.some((review) => {
        const decidedTime = Date.parse(review.decidedAt);
        const expiresTime = Date.parse(review.expiresAt);
        return (
          subjectTime > decidedTime ||
          decidedTime > recordedTime ||
          recordedTime >= expiresTime ||
          expiresTime <= decidedTime ||
          expiresTime - decidedTime >
            KERR_EXTERNAL_SCIENTIFIC_REVIEW_MAX_VALIDITY_SECONDS * 1_000
        );
      });
    if (chronologyInvalid) {
      context.addIssue({
        code: "custom",
        path: ["recordedAt"],
        message: "Kerr scientific-review record chronology is inconsistent",
      });
    }
    const seenRows = new Set<string>();
    const seenReferenceRays = new Set<string>();
    const seenCaseIds = new Set<string>();
    const observedReasons = new Set<KerrNumericComparisonReason>();
    let priorCaseOrdinal = -1;
    let priorRayOrdinal = -1;
    let priorCaseId = "";
    let rowCoverageInvalid = false;
    let withinTolerance = 0;
    let disagreed = 0;
    let inconclusive = 0;
    let incompatibleConventions = 0;
    for (const row of record.reviewedRows) {
      const index = seenRows.size;
      const beginsNextCase = row.caseOrdinal === priorCaseOrdinal + 1;
      const continuesCase = row.caseOrdinal === priorCaseOrdinal;
      if (
        seenRows.has(row.comparisonRowId) ||
        seenReferenceRays.has(row.planReferenceRayId) ||
        (index === 0
          ? row.caseOrdinal !== 0 || row.rayOrdinal !== 0
          : (!continuesCase && !beginsNextCase) ||
            (continuesCase && row.rayOrdinal !== priorRayOrdinal + 1) ||
            (continuesCase && row.caseId !== priorCaseId) ||
            (beginsNextCase && row.rayOrdinal !== 0) ||
            (beginsNextCase && seenCaseIds.has(row.caseId)))
      ) {
        rowCoverageInvalid = true;
      }
      if (beginsNextCase) seenCaseIds.add(row.caseId);
      seenRows.add(row.comparisonRowId);
      seenReferenceRays.add(row.planReferenceRayId);
      for (const reason of row.reasons) observedReasons.add(reason);
      priorCaseOrdinal = row.caseOrdinal;
      priorRayOrdinal = row.rayOrdinal;
      priorCaseId = row.caseId;
      if (row.disposition === "within-tolerance") withinTolerance += 1;
      else if (row.disposition === "disagreed") disagreed += 1;
      else if (row.disposition === "inconclusive") inconclusive += 1;
      else incompatibleConventions += 1;
    }
    const canonicalObservedReasons = KERR_NUMERIC_COMPARISON_REASON_ORDER.filter(
      (reason) => observedReasons.has(reason),
    );
    const expectedOrderedRowsSha256 = kerrSha256Hex(
      kerrStableStringify(
        record.reviewedRows.map((row) => ({
          rowId: row.comparisonRowId,
          rowChecksumSha256: row.comparisonRowChecksumSha256,
        })),
      ),
    );
    const expectedOrderedRowDispositionAndReasonsSha256 =
      orderedRowDispositionAndReasonsSha256(
        record.reviewedRows.map((row) => ({
          rowId: row.comparisonRowId,
          rowChecksumSha256: row.comparisonRowChecksumSha256,
          disposition: row.disposition,
          reasons: row.reasons,
        })),
      );
    if (
      rowCoverageInvalid ||
      priorCaseOrdinal + 1 !== record.comparisonBinding.caseCount ||
      record.comparisonBinding.orderedRowIdAndChecksumSha256 !==
        expectedOrderedRowsSha256 ||
      record.comparisonBinding.orderedRowDispositionAndReasonsSha256 !==
        expectedOrderedRowDispositionAndReasonsSha256 ||
      record.comparisonSummary.dispositionCounts.withinTolerance !==
        withinTolerance ||
      record.comparisonSummary.dispositionCounts.disagreed !== disagreed ||
      record.comparisonSummary.dispositionCounts.inconclusive !== inconclusive ||
      record.comparisonSummary.dispositionCounts.incompatibleConventions !==
        incompatibleConventions ||
      kerrStableStringify(record.observedReasonCodes) !==
        kerrStableStringify(canonicalObservedReasons)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reviewedRows"],
        message: "Kerr scientific-review row dispositions changed",
      });
    }
  });
export type ReceiptBoundKerrExternalScientificOpinionRecord = z.infer<
  typeof ReceiptBoundKerrExternalScientificOpinionRecordSchema
>;

function opinionCounts(decisions: readonly KerrExternalScientificReviewDecision[]) {
  const opinions = decisions.map((decision) => decision.statement.opinion);
  return {
    supportsProvisionalBoundedVacuumMetricAgreement: opinions.filter(
      (opinion) =>
        opinion === "supports-provisional-bounded-vacuum-metric-agreement",
    ).length,
    doesNotSupportProvisionalBoundedVacuumMetricAgreement: opinions.filter(
      (opinion) =>
        opinion ===
        "does-not-support-provisional-bounded-vacuum-metric-agreement",
    ).length,
    insufficientEvidence: opinions.filter(
      (opinion) => opinion === "insufficient-evidence",
    ).length,
  };
}

function buildReceiptBoundKerrExternalScientificOpinionRecord(
  comparison: ReceiptBoundKerrExternalNumericComparison,
  subject: KerrExternalScientificReviewSubject,
  decisions: readonly KerrExternalScientificReviewDecision[],
  signatureEnvelopeBytes: readonly Uint8Array[],
  verifierReceipts: readonly KerrExternalScientificReviewVerifierReceipt[],
  recordedAt: string,
): ReceiptBoundKerrExternalScientificOpinionRecord {
  const counts = opinionCounts(decisions);
  const aggregateOpinion =
    counts.doesNotSupportProvisionalBoundedVacuumMetricAgreement > 0
      ? "opposition-recorded"
      : counts.insufficientEvidence > 0
        ? "inconclusive-recorded"
        : "unanimous-provisional-support-recorded";
  const reviews = decisions.map((decision, index) => {
    const statement = decision.statement;
    const verifierReceipt = verifierReceipts[index]!;
    return {
      role: statement.role,
      decisionId: decision.decisionId,
      decisionChecksumSha256: decision.decisionChecksum.value,
      statementId: statement.statementId,
      statementChecksumSha256: statement.statementChecksum.value,
      signedStatementSha256: decision.signedStatementSha256,
      signatureEnvelopeSha256: kerrSha256Hex(signatureEnvelopeBytes[index]!),
      signatureEnvelopeByteLength: signatureEnvelopeBytes[index]!.byteLength,
      reviewerId: statement.reviewerId,
      roleGrantId: statement.roleGrantId,
      reviewerKeyId: statement.keyId,
      decidedAt: statement.decidedAt,
      expiresAt: statement.expiresAt,
      opinion: statement.opinion,
      evidenceBindingsCanonicalSha256: kerrSha256Hex(
        kerrStableStringify(statement.evidenceBindings),
      ),
      reviewAssertionsCanonicalSha256: kerrSha256Hex(
        kerrStableStringify(statement.reviewAssertions),
      ),
      injectedVerificationPolicyId: verifierReceipt.verificationPolicyId,
      injectedVerifierReceiptCanonicalSha256: kerrSha256Hex(
        kerrStableStringify(verifierReceipt),
      ),
    };
  });
  const reviewedRows = comparison.rows.map((row) => ({
    caseOrdinal: row.caseOrdinal,
    rayOrdinal: row.rayOrdinal,
    comparisonRowId: row.rowId,
    comparisonRowChecksumSha256: row.rowChecksum.value,
    caseId: row.caseId,
    planReferenceRayId: row.planReferenceRayId,
    disposition: row.disposition,
    reasons: row.reasons,
  }));
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state:
      "receipt-bound-kerr-scientific-review-opinions-recorded-insufficient-authenticated-evidence" as const,
    recordedAt,
    subjectBinding: {
      subjectId: subject.subjectId,
      subjectChecksumSha256: subject.subjectChecksum.value,
      subjectCanonicalSha256: kerrExternalScientificReviewSubjectSha256(subject),
      frozenAt: subject.frozenAt,
    },
    comparisonBinding: {
      comparisonId: comparison.comparisonId,
      comparisonChecksumSha256: comparison.comparisonChecksum.value,
      comparisonCanonicalSha256:
        subject.comparisonBinding.comparisonCanonicalSha256,
      comparedAt: comparison.comparedAt,
      preparationId: comparison.preparationBinding.preparationId,
      candidateId: comparison.candidateBinding.candidateId,
      admissionId: comparison.admissionBinding.admissionId,
      planId: comparison.planBinding.planId,
      mappingReviewDecisionId: comparison.mappingReviewBinding.decisionId,
      caseCount: comparison.planBinding.caseCount,
      rowCount: comparison.rows.length,
      orderedRowIdAndChecksumSha256:
        subject.comparisonBinding.orderedRowIdAndChecksumSha256,
      orderedRowDispositionAndReasonsSha256:
        subject.comparisonBinding.orderedRowDispositionAndReasonsSha256,
    },
    requiredRoles: KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES,
    reviews,
    opinionCounts: counts,
    aggregateOpinion,
    reviewedRows,
    comparisonSummary: comparison.summary,
    tolerances: comparison.tolerances,
    observedReasonCodes: subject.comparisonBinding.observedReasonCodes,
    scientificReviewProtocolCompleted: true as const,
    scientificReviewOpinionsRecorded: true as const,
    sourceComparisonCapabilityConsumedInProcess: true as const,
    exactIssuedComparisonIntegrityReplayed: true as const,
    exactPrivateComparisonContextReplayed: true as const,
    reviewersDeclaredAllRowsReviewedInExactOrder: true as const,
    exactComparisonRowBindingsPreservedInOrder: true as const,
    numericDispositionsAndReasonsPreserved: true as const,
    disagreementWaiversApplied: false as const,
    postRunToleranceChangesApplied: false as const,
    coordinateTimeAndAffineParameterDeltasRemainDiagnosticOnly: true as const,
    cameraScreenToleranceInventedAfterExecution: false as const,
    declaredTwoRoleIdentityValuesSeparatedByPackage: true as const,
    reviewerOpinionSignaturesAcceptedByInjectedBoundary: true as const,
    injectedScientificVerifierAuthorityAuthenticatedByPackage: false as const,
    reviewerAssignmentsDeclaredByCaller: true as const,
    reviewerAssignmentAuthorityAuthenticatedByPackage: false as const,
    reviewerQualificationsVerifiedByPackage: false as const,
    reviewerConflictClearanceVerifiedByPackage: false as const,
    reviewerCredentialValidityAndRevocationVerifiedByPackage: false as const,
    reviewerIdentitySeparationEstablishesImplementationIndependence:
      false as const,
    currentEvidenceEligibleForScientificValidation: false as const,
    scientificAdjudicationEstablishedByPackage: false as const,
    nonAuthoritativePrerequisiteRecordCapabilityIssued: true as const,
    authenticationOfThisRecordAloneCanEstablishScientificValidation:
      false as const,
    futureScientificValidationPrerequisitesStillRequired: {
      realExternalExecution: true as const,
      authenticatedSourceExecutableAndNormalizerLineage: true as const,
      verifiedMappingCorrectness: true as const,
      verifiedImplementationIndependence: true as const,
      authenticatedReviewerAuthorityQualificationsAndConflictClearance:
        true as const,
      authoritativeTimeAndRevocation: true as const,
      durableEvidencePreservation: true as const,
    },
    futureAuthenticatedValidationConsumerImplemented: false as const,
    recordCapabilityConsumedAtIssuance: false as const,
    durableScientificReviewRecorded: false as const,
    adjudicationTimeAuthenticatedByPackage: false as const,
    declaredAdjudicationChronologyChecked: true as const,
    realExternalExecutionEstablishedByPackage: false as const,
    provisionalToleranceAgreementIsValidation: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
  const recordId = `krsrrec_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const record = deepFreezeKerr(
    ReceiptBoundKerrExternalScientificOpinionRecordSchema.parse({
      ...unsigned,
      recordId,
      recordChecksum: checksum(
        "receipt-bound-kerr-external-scientific-opinion-record",
        { ...unsigned, recordId },
      ),
    }),
  );
  assertCanonicalByteBudget(
    record,
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_RECORD_MAX_CANONICAL_BYTES,
    "Receipt-bound Kerr external scientific opinion record",
  );
  return record;
}

const attemptedReceiptBoundKerrScientificReviews = new WeakSet<object>();
const issuedReceiptBoundKerrScientificOpinionRecords = new WeakSet<object>();
const receiptBoundKerrScientificOpinionRecordContexts = new WeakMap<
  object,
  {
    readonly comparison: ReceiptBoundKerrExternalNumericComparison;
    readonly subject: KerrExternalScientificReviewSubject;
    readonly decisions: readonly KerrExternalScientificReviewDecision[];
    readonly signatureEnvelopeBytes: readonly Uint8Array[];
    readonly verifierReceipts: readonly KerrExternalScientificReviewVerifierReceipt[];
    readonly recordedAt: string;
  }
>();

export interface RecordReceiptBoundKerrExternalScientificReviewOpinionsInput {
  readonly comparison: ReceiptBoundKerrExternalNumericComparison;
  readonly subject: KerrExternalScientificReviewSubject;
  readonly reviews: readonly {
    readonly decision: KerrExternalScientificReviewDecision;
    readonly signatureEnvelopeBytes: Uint8Array;
  }[];
  readonly recordedAt: unknown;
}

export async function recordReceiptBoundKerrExternalScientificReviewOpinions(
  input: RecordReceiptBoundKerrExternalScientificReviewOpinionsInput,
  verifyScientificReview: KerrExternalScientificReviewVerifier,
): Promise<ReceiptBoundKerrExternalScientificOpinionRecord> {
  const comparisonInput = ownDataValue(
    input,
    "comparison",
    "Receipt-bound Kerr scientific-review recording input",
  );
  assertIssuedReceiptBoundKerrExternalNumericComparison(comparisonInput);
  if (attemptedReceiptBoundKerrScientificReviews.has(comparisonInput)) {
    throw new Error(
      "Receipt-bound Kerr numeric comparison already attempted scientific review",
    );
  }

  // Detach both signature envelopes before traversing either signed decision.
  const reviewEntries = preflightExactArray(
    ownDataValue(
      input,
      "reviews",
      "Receipt-bound Kerr scientific-review recording input",
    ),
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES.length,
    "Kerr scientific-review entries",
  );
  const signatureEnvelopeBytes = reviewEntries.map((entry, index) =>
    exactUint8ArrayCopy(
      ownDataValue(
        entry,
        "signatureEnvelopeBytes",
        `Kerr scientific-review entry ${index}`,
      ),
      KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
      `Kerr scientific-review signature envelope ${index}`,
    ),
  );
  const decisionInputs = reviewEntries.map((entry, index) =>
    ownDataValue(entry, "decision", `Kerr scientific-review entry ${index}`),
  );
  const subjectInput = ownDataValue(
    input,
    "subject",
    "Receipt-bound Kerr scientific-review recording input",
  );
  const recordedAt = CanonicalTimestampSchema.parse(
    ownDataValue(
      input,
      "recordedAt",
      "Receipt-bound Kerr scientific-review recording input",
    ),
  );
  if (typeof verifyScientificReview !== "function") {
    throw new TypeError("Kerr scientific-review verifier must be a function");
  }

  assertReceiptBoundKerrExternalNumericComparisonIntegrity(comparisonInput);
  assertKerrExternalScientificReviewSubjectIntegrity(comparisonInput, subjectInput);
  const subject = subjectInput;
  const decisions = decisionInputs.map((decisionInput, index) => {
    assertKerrExternalScientificReviewDecisionIntegrity(
      subject,
      decisionInput,
      signatureEnvelopeBytes[index],
    );
    return decisionInput;
  });
  if (
    decisions.some(
      (decision, index) =>
        decision.statement.role !==
        KERR_EXTERNAL_SCIENTIFIC_REVIEW_REQUIRED_ROLES[index],
    )
  ) {
    throw new Error(
      "Kerr scientific-review decisions must cover both required roles in canonical order",
    );
  }
  assertTwoScientificReviewersAreDistinct(subject, decisions);
  if (
    decisions.some(
      (decision) =>
        Date.parse(recordedAt) < Date.parse(decision.statement.decidedAt) ||
        Date.parse(recordedAt) >= Date.parse(decision.statement.expiresAt),
    )
  ) {
    throw new Error("Kerr scientific-review recording is outside decision validity");
  }

  // All caller-controlled values are detached and checked above. Repeat the
  // one-use check immediately adjacent to the burn so Proxy/host reentrancy
  // cannot issue two records. Every failure after this point is permanent.
  if (attemptedReceiptBoundKerrScientificReviews.has(comparisonInput)) {
    throw new Error(
      "Receipt-bound Kerr numeric comparison already attempted scientific review",
    );
  }
  attemptedReceiptBoundKerrScientificReviews.add(comparisonInput);

  const verifierReceipts: KerrExternalScientificReviewVerifierReceipt[] = [];
  for (let index = 0; index < decisions.length; index += 1) {
    const receiptInput = await verifyScientificReview(
      comparisonInput,
      subject,
      decisions[index]!,
      new Uint8Array(signatureEnvelopeBytes[index]!),
      recordedAt,
    );
    assertKerrComparisonPlainDataTree(
      receiptInput,
      `Injected Kerr scientific-review verifier receipt ${index}`,
    );
    const receipt = deepFreezeKerr(
      KerrExternalScientificReviewVerifierReceiptSchema.parse(receiptInput),
    );
    assertAlreadyCanonical(
      receiptInput,
      receipt,
      `Injected Kerr scientific-review verifier receipt ${index}`,
    );
    assertCanonicalByteBudget(
      receipt,
      KERR_EXTERNAL_SCIENTIFIC_REVIEW_DECISION_MAX_CANONICAL_BYTES,
      `Injected Kerr scientific-review verifier receipt ${index}`,
    );
    assertScientificReviewVerifierReceiptMatches(
      receipt,
      comparisonInput,
      subject,
      decisions[index]!,
      signatureEnvelopeBytes[index]!,
      recordedAt,
    );
    verifierReceipts.push(receipt);
  }

  // Recheck the complete private comparison lineage and reviewer separation
  // after the asynchronous injected boundary before issuing the record.
  assertReceiptBoundKerrExternalNumericComparisonIntegrity(comparisonInput);
  assertKerrExternalScientificReviewSubjectIntegrity(comparisonInput, subject);
  decisions.forEach((decision, index) =>
    assertKerrExternalScientificReviewDecisionIntegrity(
      subject,
      decision,
      signatureEnvelopeBytes[index],
    ),
  );
  assertTwoScientificReviewersAreDistinct(subject, decisions);

  const record = buildReceiptBoundKerrExternalScientificOpinionRecord(
    comparisonInput,
    subject,
    decisions,
    signatureEnvelopeBytes,
    verifierReceipts,
    recordedAt,
  );
  issuedReceiptBoundKerrScientificOpinionRecords.add(record);
  receiptBoundKerrScientificOpinionRecordContexts.set(record, {
    comparison: comparisonInput,
    subject,
    decisions,
    signatureEnvelopeBytes: signatureEnvelopeBytes.map((bytes) =>
      new Uint8Array(bytes),
    ),
    verifierReceipts,
    recordedAt,
  });
  return record;
}

export function assertReceiptBoundKerrExternalScientificOpinionRecordSelfIntegrity(
  recordInput: unknown,
): asserts recordInput is ReceiptBoundKerrExternalScientificOpinionRecord {
  assertKerrComparisonPlainDataTree(
    recordInput,
    "Receipt-bound Kerr external scientific opinion record",
  );
  const record = ReceiptBoundKerrExternalScientificOpinionRecordSchema.parse(
    recordInput,
  );
  assertAlreadyCanonical(
    recordInput,
    record,
    "Receipt-bound Kerr external scientific opinion record",
  );
  const { recordId, recordChecksum, ...unsigned } = record;
  const expectedId = `krsrrec_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const expectedChecksum = checksum(
    "receipt-bound-kerr-external-scientific-opinion-record",
    { ...unsigned, recordId: expectedId },
  );
  if (
    recordId !== expectedId ||
    kerrStableStringify(recordChecksum) !== kerrStableStringify(expectedChecksum)
  ) {
    throw new Error(
      "Receipt-bound Kerr external scientific opinion record failed self-integrity replay",
    );
  }
  assertCanonicalByteBudget(
    record,
    KERR_EXTERNAL_SCIENTIFIC_REVIEW_RECORD_MAX_CANONICAL_BYTES,
    "Receipt-bound Kerr external scientific opinion record",
  );
}

export function assertIssuedReceiptBoundKerrExternalScientificOpinionRecord(
  input: unknown,
): asserts input is ReceiptBoundKerrExternalScientificOpinionRecord {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedReceiptBoundKerrScientificOpinionRecords.has(input)
  ) {
    throw new Error(
      "Receipt-bound Kerr external scientific opinion record must be issued in this process; structural copies are rejected",
    );
  }
}

export function assertReceiptBoundKerrExternalScientificOpinionRecordIntegrity(
  recordInput: unknown,
): asserts recordInput is ReceiptBoundKerrExternalScientificOpinionRecord {
  assertIssuedReceiptBoundKerrExternalScientificOpinionRecord(recordInput);
  assertReceiptBoundKerrExternalScientificOpinionRecordSelfIntegrity(recordInput);
  const context = receiptBoundKerrScientificOpinionRecordContexts.get(recordInput);
  if (context === undefined) {
    throw new Error(
      "Receipt-bound Kerr external scientific opinion record context is unavailable",
    );
  }
  assertReceiptBoundKerrExternalNumericComparisonIntegrity(context.comparison);
  assertKerrExternalScientificReviewSubjectIntegrity(
    context.comparison,
    context.subject,
  );
  context.decisions.forEach((decision, index) => {
    assertKerrExternalScientificReviewDecisionIntegrity(
      context.subject,
      decision,
      context.signatureEnvelopeBytes[index],
    );
    assertScientificReviewVerifierReceiptMatches(
      context.verifierReceipts[index]!,
      context.comparison,
      context.subject,
      decision,
      context.signatureEnvelopeBytes[index]!,
      context.recordedAt,
    );
  });
  assertTwoScientificReviewersAreDistinct(context.subject, context.decisions);
  const expected = buildReceiptBoundKerrExternalScientificOpinionRecord(
    context.comparison,
    context.subject,
    context.decisions,
    context.signatureEnvelopeBytes,
    context.verifierReceipts,
    context.recordedAt,
  );
  if (kerrStableStringify(recordInput) !== kerrStableStringify(expected)) {
    throw new Error(
      "Receipt-bound Kerr external scientific opinion record failed exact private-context integrity replay",
    );
  }
}

export function canUseReceiptBoundKerrExternalScientificOpinionRecordForRender(
  _input: unknown,
): false {
  return false;
}

export function canUseReceiptBoundKerrExternalScientificOpinionRecordForRelease(
  _input: unknown,
): false {
  return false;
}
