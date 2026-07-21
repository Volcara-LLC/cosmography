import { z } from "zod";

import {
  KERR_COMPARISON_PROVISIONAL_TOLERANCES,
  KERR_COMPARISON_MAX_CANDIDATE_CANONICAL_BYTES,
  KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
  KERR_COMPARISON_MAX_TOTAL_PIXELS,
  KerrComparisonMappingSchema,
  KerrComparisonPlanSchema,
  KerrComparisonScientificRoleSchema,
  assertKerrComparisonPlanIntegrity,
  assertKerrComparisonPlainDataTree,
  assertVerifiedKerrComparisonReferenceBundle,
  type KerrComparisonPlan,
  type VerifiedKerrComparisonReferenceBundle,
} from "./kerr-comparison-plan.js";
import {
  KERR_NUMERIC_COMPARISON_REASON_ORDER,
  compareKerrNumericRow,
  summarizeKerrNumericRows,
  type KerrNumericCandidateRowLike,
  type KerrNumericComparisonCoreRow,
  type KerrNumericComparisonReason,
} from "./kerr-numeric-comparison-core.js";
import {
  KerrExternalNormalizedMomentumSchema,
  KerrExternalResolvedEndpointSchema,
} from "./external-kerr-output.js";
import {
  KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
  ClaimedKerrExternalRunnerHandoffSchema,
  KerrExternalSelectionReviewIdentityBindingsSchema,
  KerrExternalRunnerHandoffSchema,
  assertClaimedKerrExternalRunnerHandoffPlanBinding,
  assertIssuedClaimedKerrExternalRunnerHandoff,
  kerrExternalClaimedHandoffSelectionReviewIdentityBindings,
  recheckClaimedKerrExternalRunnerHandoffCurrentGrants,
  type ClaimedKerrExternalRunnerHandoff,
  type KerrExternalCurrentGrantAuthorizer,
  type KerrExternalRunnerHandoff,
  type KerrExternalSelectionReviewIdentityBindings,
} from "./kerr-external-authorization.js";
import {
  deepFreezeKerr,
  kerrSha256Hex,
  kerrStableStringify,
} from "./trace-contracts.js";

export const KERR_EXTERNAL_EXECUTION_RECEIPT_POLICY_VERSION = "1.0.0" as const;
export const KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_CANONICAL_BYTES =
  2 * 1024 * 1024;
export const KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES =
  KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES;
export const KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES =
  KERR_COMPARISON_MAX_CANDIDATE_CANONICAL_BYTES;
export const KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES =
  64 * 1024;
export const KERR_RECEIPT_BOUND_PREPARED_CANDIDATE_MAX_CANONICAL_BYTES =
  3 * 1024 * 1024;
export const KERR_RECEIPT_BOUND_NUMERIC_COMPARISON_MAX_CANONICAL_BYTES =
  4 * 1024 * 1024;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const IdentifierSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,127}$/);
const CanonicalTimestampSchema = z.iso.datetime({
  offset: false,
  precision: 0,
});
const ReceiptTimestampSchema = z.iso.datetime({
  offset: false,
  precision: 3,
});
const BoundedFiniteSchema = z.number().finite().min(-1e12).max(1e12);

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

export const KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY = deepFreezeKerr({
  implementationProvenanceVerified: false,
  independenceVerified: false,
  licenseVerified: false,
  mappingCorrectnessVerified: false,
  checksumAuthenticatesRecord: false,
  executionVerified: false,
  candidateAdmissionAllowed: false,
  comparisonAllowed: false,
  scientificValidationPassed: false,
  independentValidationPassed: false,
  renderAllowed: false,
  productionUseAllowed: false,
  placeholderReplacementAllowed: false,
  releaseEligible: false,
  publicationAllowed: false,
  activationAllowed: false,
} as const);

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

function checksum(scope: string, unsigned: unknown) {
  return {
    algorithm: "sha256" as const,
    value: kerrSha256Hex(kerrStableStringify(unsigned)),
    scope,
  };
}

function assertCanonicalByteBudget(value: unknown, label: string): void {
  if (
    new TextEncoder().encode(kerrStableStringify(value)).byteLength >
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_CANONICAL_BYTES
  ) {
    throw new RangeError(`${label} exceeds its canonical byte budget`);
  }
}

function assertReceiptBoundNumericComparisonByteBudget(
  value: unknown,
): void {
  if (
    new TextEncoder().encode(kerrStableStringify(value)).byteLength >
    KERR_RECEIPT_BOUND_NUMERIC_COMPARISON_MAX_CANONICAL_BYTES
  ) {
    throw new RangeError(
      "Receipt-bound Kerr external numeric comparison exceeds its canonical byte budget",
    );
  }
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
    throw new RangeError(`${label} must contain exactly ${expectedLength} rows`);
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
  const rows: unknown[] = [];
  for (let index = 0; index < expectedLength; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`${label}[${index}] must be an own data property`);
    }
    rows.push(descriptor.value);
  }
  return rows;
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
  if (
    hasBytePrefix(input, [0x50, 0x4b, 0x03, 0x04]) ||
    hasBytePrefix(input, [0x50, 0x4b, 0x05, 0x06]) ||
    hasBytePrefix(input, [0x50, 0x4b, 0x07, 0x08]) ||
    hasBytePrefix(input, [0x1f, 0x8b]) ||
    hasBytePrefix(input, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) ||
    hasBytePrefix(input, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]) ||
    hasBytePrefix(input, [0x42, 0x5a, 0x68]) ||
    hasBytePrefix(input, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]) ||
    hasBytePrefix(input, [0x75, 0x73, 0x74, 0x61, 0x72], 257)
  ) {
    throw new Error(
      "External Kerr raw output must be one uncompressed non-archive file",
    );
  }
}

const CandidateTerminationSchema = z.enum([
  "captured-horizon-guard",
  "escaped-domain",
  "coordinate-domain-exit",
  "indeterminate-limit",
  "numerical-failure",
]);

const BlindedNormalizedRowPayloadSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("normalized-answer-blinded-external-kerr-ray"),
    caseOrdinal: z.number().int().min(0).max(7),
    rayOrdinal: z
      .number()
      .int()
      .min(0)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
    pixelIndex: z
      .number()
      .int()
      .min(0)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
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
        message: "Resolved rows require one endpoint and unresolved rows require null",
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
        message: "Endpoint event surface does not match termination",
      });
    }
  });

const BlindedNormalizedRowChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("answer-blinded-normalized-external-kerr-row"),
  })
  .strict();

export const KerrExternalBlindedNormalizedRowSchema =
  BlindedNormalizedRowPayloadSchema.extend({
    rowId: z.string().regex(/^krbnrow_[a-f0-9]{24}$/),
    rowChecksum: BlindedNormalizedRowChecksumSchema,
  });
export type KerrExternalBlindedNormalizedRow = z.infer<
  typeof KerrExternalBlindedNormalizedRowSchema
>;

const BlindedNormalizedOutputChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("answer-blinded-normalized-external-kerr-output"),
  })
  .strict();

export const KerrExternalBlindedNormalizedOutputSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("normalized-answer-blinded-external-kerr-output"),
    normalizedOutputId: z.string().regex(/^krbnout_[a-f0-9]{24}$/),
    policyVersion: z.literal(KERR_EXTERNAL_EXECUTION_RECEIPT_POLICY_VERSION),
    normalizedAt: ReceiptTimestampSchema,
    blindedInputBinding: z
      .object({
        inputId: z.string().regex(/^krblind_[a-f0-9]{24}$/),
        inputChecksumSha256: Sha256Schema,
        caseCount: z.number().int().min(1).max(8),
        totalRays: z.number().int().min(1).max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
      })
      .strict(),
    comparisonScope: z.enum(["integrator-only", "camera-and-solver"]),
    conventions: ClaimedKerrExternalRunnerHandoffSchema.shape.handoff.shape.blindedInput.shape.conventions,
    rows: z
      .array(KerrExternalBlindedNormalizedRowSchema)
      .min(1)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    rowCoverage: z.literal("exactly-one-row-per-blinded-ray-in-input-order"),
    answerBearingFieldsIncluded: z.literal(false),
    referenceIdentifiersIncluded: z.literal(false),
    referenceOutcomesIncluded: z.literal(false),
    referenceChecksumsIncluded: z.literal(false),
    tolerancesIncluded: z.literal(false),
    comparisonResultsIncluded: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    normalizedOutputChecksum: BlindedNormalizedOutputChecksumSchema,
  })
  .strict();
export type KerrExternalBlindedNormalizedOutput = z.infer<
  typeof KerrExternalBlindedNormalizedOutputSchema
>;

function expectedBlindedRows(handoff: KerrExternalRunnerHandoff) {
  return handoff.blindedInput.cases.flatMap((inputCase) =>
    inputCase.rays.map((ray) => ({ inputCase, ray })),
  );
}

function assertBlindedRowBinding(
  handoff: KerrExternalRunnerHandoff,
  row: z.infer<typeof BlindedNormalizedRowPayloadSchema>,
  expected: ReturnType<typeof expectedBlindedRows>[number],
): void {
  if (
    row.caseOrdinal !== expected.inputCase.caseOrdinal ||
    row.rayOrdinal !== expected.ray.rayOrdinal ||
    row.pixelIndex !== expected.ray.pixelIndex ||
    row.pixelX !== expected.ray.pixelX ||
    row.pixelY !== expected.ray.pixelY
  ) {
    throw new Error("Normalized Kerr row changed its blinded input ordering");
  }
  if (
    handoff.blindedInput.comparisonScope === "integrator-only" &&
    expected.ray.inputKind === "canonical-initial-state" &&
    (row.screenX !== expected.ray.screenX || row.screenY !== expected.ray.screenY)
  ) {
    throw new Error(
      "Integrator-only normalized Kerr output changed its supplied screen coordinate",
    );
  }
}

function createBlindedRow(
  handoff: KerrExternalRunnerHandoff,
  rowInput: unknown,
  expected: ReturnType<typeof expectedBlindedRows>[number],
): KerrExternalBlindedNormalizedRow {
  assertKerrComparisonPlainDataTree(rowInput, "Answer-blinded normalized Kerr row");
  const parsed = BlindedNormalizedRowPayloadSchema.parse(rowInput);
  assertBlindedRowBinding(handoff, parsed, expected);
  const rowId = `krbnrow_${kerrSha256Hex(kerrStableStringify(parsed)).slice(0, 24)}`;
  return KerrExternalBlindedNormalizedRowSchema.parse({
    ...parsed,
    rowId,
    rowChecksum: checksum("answer-blinded-normalized-external-kerr-row", {
      ...parsed,
      rowId,
    }),
  });
}

export interface CreateKerrExternalBlindedNormalizedOutputInput {
  readonly claimedHandoff: ClaimedKerrExternalRunnerHandoff;
  readonly normalizedAt: unknown;
  readonly rows: readonly unknown[];
}

export interface CreateKerrExternalBlindedNormalizedOutputForRunnerInput {
  readonly handoff: KerrExternalRunnerHandoff;
  readonly normalizedAt: unknown;
  readonly rows: readonly unknown[];
}

function createKerrExternalBlindedNormalizedOutputFromHandoff(
  handoff: KerrExternalRunnerHandoff,
  validFrom: string,
  normalizedAtInput: unknown,
  rowsInput: unknown,
): KerrExternalBlindedNormalizedOutput {
  const normalizedAt = ReceiptTimestampSchema.parse(normalizedAtInput);
  if (
    Date.parse(normalizedAt) < Date.parse(validFrom) ||
    Date.parse(normalizedAt) >= Date.parse(handoff.expiresAt)
  ) {
    throw new Error("Blinded Kerr normalization is outside the handoff validity");
  }
  const expected = expectedBlindedRows(handoff);
  const rowInputs = preflightExactArray(
    rowsInput,
    expected.length,
    "Answer-blinded normalized Kerr rows",
  );
  const rows = rowInputs.map((row, index) =>
    createBlindedRow(handoff, row, expected[index]!),
  );
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "normalized-answer-blinded-external-kerr-output" as const,
    policyVersion: KERR_EXTERNAL_EXECUTION_RECEIPT_POLICY_VERSION,
    normalizedAt,
    blindedInputBinding: {
      inputId: handoff.blindedInput.inputId,
      inputChecksumSha256: handoff.blindedInput.inputChecksum.value,
      caseCount: handoff.blindedInput.cases.length,
      totalRays: expected.length,
    },
    comparisonScope: handoff.blindedInput.comparisonScope,
    conventions: handoff.blindedInput.conventions,
    rows,
    rowCoverage: "exactly-one-row-per-blinded-ray-in-input-order" as const,
    answerBearingFieldsIncluded: false as const,
    referenceIdentifiersIncluded: false as const,
    referenceOutcomesIncluded: false as const,
    referenceChecksumsIncluded: false as const,
    tolerancesIncluded: false as const,
    comparisonResultsIncluded: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
  const normalizedOutputId = `krbnout_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const output = KerrExternalBlindedNormalizedOutputSchema.parse({
    ...unsigned,
    normalizedOutputId,
    normalizedOutputChecksum: checksum(
      "answer-blinded-normalized-external-kerr-output",
      { ...unsigned, normalizedOutputId },
    ),
  });
  assertCanonicalByteBudget(output, "Answer-blinded normalized Kerr output");
  return deepFreezeKerr(output);
}

export function createKerrExternalBlindedNormalizedOutput(
  input: CreateKerrExternalBlindedNormalizedOutputInput,
): KerrExternalBlindedNormalizedOutput {
  const claim = ownDataValue(
    input,
    "claimedHandoff",
    "Blinded Kerr normalized output input",
  );
  assertIssuedClaimedKerrExternalRunnerHandoff(claim);
  return createKerrExternalBlindedNormalizedOutputFromHandoff(
    claim.handoff,
    claim.claimedAt,
    ownDataValue(input, "normalizedAt", "Blinded Kerr normalized output input"),
    ownDataValue(input, "rows", "Blinded Kerr normalized output input"),
  );
}

/**
 * Runner-facing structural factory. It grants no package capability; the
 * package later replays the result against the exact claimed handoff.
 */
export function createKerrExternalBlindedNormalizedOutputForRunner(
  input: CreateKerrExternalBlindedNormalizedOutputForRunnerInput,
): KerrExternalBlindedNormalizedOutput {
  const handoffInput = ownDataValue(
    input,
    "handoff",
    "Runner-side blinded Kerr normalized output input",
  );
  assertKerrComparisonPlainDataTree(
    handoffInput,
    "Runner-side blinded Kerr handoff",
  );
  const handoff = KerrExternalRunnerHandoffSchema.parse(handoffInput);
  return createKerrExternalBlindedNormalizedOutputFromHandoff(
    handoff,
    handoff.consumedAt,
    ownDataValue(
      input,
      "normalizedAt",
      "Runner-side blinded Kerr normalized output input",
    ),
    ownDataValue(input, "rows", "Runner-side blinded Kerr normalized output input"),
  );
}

export function assertKerrExternalBlindedNormalizedOutputIntegrity(
  claimInput: unknown,
  outputInput: unknown,
): asserts outputInput is KerrExternalBlindedNormalizedOutput {
  assertIssuedClaimedKerrExternalRunnerHandoff(claimInput);
  assertKerrComparisonPlainDataTree(
    outputInput,
    "Answer-blinded normalized Kerr output",
  );
  const output = KerrExternalBlindedNormalizedOutputSchema.parse(outputInput);
  const rowPayloads = output.rows.map(
    ({ rowId: _rowId, rowChecksum: _rowChecksum, ...payload }) => payload,
  );
  const expected = createKerrExternalBlindedNormalizedOutput({
    claimedHandoff: claimInput,
    normalizedAt: output.normalizedAt,
    rows: rowPayloads,
  });
  if (kerrStableStringify(output) !== kerrStableStringify(expected)) {
    throw new Error(
      "Answer-blinded normalized Kerr output failed exact integrity replay",
    );
  }
}

export function canonicalKerrExternalBlindedNormalizedOutputBytes(
  claimInput: unknown,
  outputInput: unknown,
): Uint8Array {
  assertKerrExternalBlindedNormalizedOutputIntegrity(claimInput, outputInput);
  const bytes = new TextEncoder().encode(kerrStableStringify(outputInput));
  if (bytes.byteLength > KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES) {
    throw new RangeError("Answer-blinded normalized Kerr output exceeds its byte budget");
  }
  return bytes;
}

export function assertKerrExternalBlindedNormalizedOutputForRunnerIntegrity(
  handoffInput: unknown,
  outputInput: unknown,
): asserts outputInput is KerrExternalBlindedNormalizedOutput {
  assertKerrComparisonPlainDataTree(handoffInput, "Runner-side blinded Kerr handoff");
  const handoff = KerrExternalRunnerHandoffSchema.parse(handoffInput);
  assertKerrComparisonPlainDataTree(
    outputInput,
    "Runner-side answer-blinded normalized Kerr output",
  );
  const output = KerrExternalBlindedNormalizedOutputSchema.parse(outputInput);
  const rowPayloads = output.rows.map(
    ({ rowId: _rowId, rowChecksum: _rowChecksum, ...payload }) => payload,
  );
  const expected = createKerrExternalBlindedNormalizedOutputForRunner({
    handoff,
    normalizedAt: output.normalizedAt,
    rows: rowPayloads,
  });
  if (kerrStableStringify(output) !== kerrStableStringify(expected)) {
    throw new Error(
      "Runner-side answer-blinded normalized Kerr output failed exact integrity replay",
    );
  }
}

export function canonicalKerrExternalBlindedNormalizedOutputBytesForRunner(
  handoffInput: unknown,
  outputInput: unknown,
): Uint8Array {
  assertKerrExternalBlindedNormalizedOutputForRunnerIntegrity(
    handoffInput,
    outputInput,
  );
  const bytes = new TextEncoder().encode(kerrStableStringify(outputInput));
  if (bytes.byteLength > KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES) {
    throw new RangeError(
      "Runner-side answer-blinded normalized Kerr output exceeds its byte budget",
    );
  }
  return bytes;
}

const StreamBindingSchema = z
  .object({
    byteLength: z.number().int().nonnegative().max(1024 * 1024),
    sha256: Sha256Schema,
    truncated: z.boolean(),
  })
  .strict();

const RunnerOutcomeSchema = z
  .object({
    exitCode: z.number().int().min(0).max(255).nullable(),
    terminationSignal: z
      .string()
      .regex(/^[A-Z][A-Z0-9]{1,31}$/)
      .nullable(),
    timedOut: z.boolean(),
    outOfMemory: z.boolean(),
    sandboxViolation: z.boolean(),
    networkAccessObserved: z.boolean(),
    outputTruncated: z.boolean(),
    unexpectedWritableArtifacts: z.boolean(),
  })
  .strict();

const RunnerResourceUsageSchema = z
  .object({
    cpuMilliseconds: z.number().int().nonnegative().max(2e12),
    wallMilliseconds: z.number().int().nonnegative().max(2e12),
    peakMemoryBytes: z.number().int().nonnegative().max(2e12),
    maximumConcurrentProcesses: z.number().int().nonnegative().max(1_000_000),
    writableBytes: z.number().int().nonnegative().max(2e12),
    stdoutBytes: z.number().int().nonnegative().max(2e12),
    stderrBytes: z.number().int().nonnegative().max(2e12),
    outputBytes: z.number().int().nonnegative().max(2e12),
  })
  .strict();

const ReceiptChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("declared-isolated-kerr-runner-execution-receipt"),
  })
  .strict();

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

export const KerrExternalExecutionReceiptDeclarationSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("isolated-kerr-runner-receipt-awaiting-verification"),
    policyVersion: z.literal(KERR_EXTERNAL_EXECUTION_RECEIPT_POLICY_VERSION),
    receiptId: z.string().regex(/^krxreceipt_[a-f0-9]{24}$/),
    claimedEvidenceClass: z.literal(
      "runner-declared-isolated-execution-receipt-awaiting-verification",
    ),
    claimBinding: z
      .object({
        claimId: z.string().regex(/^krxclaim_[a-f0-9]{24}$/),
        claimChecksumSha256: Sha256Schema,
        claimedAt: CanonicalTimestampSchema,
        expiresAt: CanonicalTimestampSchema,
        authorizationId: z.string().regex(/^krxauth_[a-f0-9]{24}$/),
      })
      .strict(),
    selectionBinding:
      ClaimedKerrExternalRunnerHandoffSchema.shape.selectionBinding,
    requestBinding: ClaimedKerrExternalRunnerHandoffSchema.shape.requestBinding,
    blindedInputBinding: z
      .object({
        inputId: z.string().regex(/^krblind_[a-f0-9]{24}$/),
        inputChecksumSha256: Sha256Schema,
        caseCount: z.number().int().min(1).max(8),
        totalRays: z.number().int().min(1).max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
      })
      .strict(),
    executionBinding: z
      .object({
        audience: z.literal("isolated-external-kerr-runner-v1"),
        artifactBindings:
          ClaimedKerrExternalRunnerHandoffSchema.shape.handoff.shape.artifactBindings,
        invocation:
          ClaimedKerrExternalRunnerHandoffSchema.shape.handoff.shape.invocation,
        deterministicEnvironment:
          ClaimedKerrExternalRunnerHandoffSchema.shape.handoff.shape
            .deterministicEnvironment,
        sandbox: ClaimedKerrExternalRunnerHandoffSchema.shape.handoff.shape.sandbox,
        limits: ClaimedKerrExternalRunnerHandoffSchema.shape.handoff.shape.limits,
      })
      .strict(),
    chronology: z
      .object({
        startedAt: ReceiptTimestampSchema,
        completedAt: ReceiptTimestampSchema,
        rawCapturedAt: ReceiptTimestampSchema,
        normalizedAt: ReceiptTimestampSchema,
        receiptGeneratedAt: ReceiptTimestampSchema,
      })
      .strict(),
    outcome: RunnerOutcomeSchema,
    resourceUsage: RunnerResourceUsageSchema,
    streams: z
      .object({
        stdout: StreamBindingSchema,
        stderr: StreamBindingSchema,
      })
      .strict(),
    rawOutput: z
      .object({
        kind: z.literal("isolated-runner-native-output"),
        mediaType: z.literal("application/octet-stream"),
        encoding: z.literal("opaque-exact-bytes"),
        compression: z.literal("none"),
        recognizedArchiveContainer: z.literal(false),
        byteLength: z
          .number()
          .int()
          .positive()
          .max(KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES),
        sha256: Sha256Schema,
      })
      .strict(),
    normalizedOutput: z
      .object({
        kind: z.literal("answer-blinded-canonical-normalized-output"),
        mediaType: z.literal("application/json"),
        encoding: z.literal("utf-8"),
        canonicalization: z.literal("kerr-stable-json-v1"),
        normalizedOutputId: z.string().regex(/^krbnout_[a-f0-9]{24}$/),
        normalizedOutputChecksumSha256: Sha256Schema,
        normalizerSourceSha256: Sha256Schema,
        rawInputSha256: Sha256Schema,
        byteLength: z
          .number()
          .int()
          .positive()
          .max(KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES),
        sha256: Sha256Schema,
      })
      .strict(),
    runnerAttestation: z
      .object({
        format: z.literal("detached-isolated-runner-attestation-v1"),
        runnerId: IdentifierSchema,
        runnerKeyId: IdentifierSchema,
        signedRunnerStatementSha256: Sha256Schema,
        signatureEnvelope: SignatureEnvelopeBindingSchema,
      })
      .strict(),
    receiptProvenance: z.literal("runner-declared-awaiting-injected-verification"),
    receiptBindingVerified: z.literal(false),
    executionReceiptIsScientificValidation: z.literal(false),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    receiptChecksum: ReceiptChecksumSchema,
  })
  .strict();
export type KerrExternalExecutionReceiptDeclaration = z.infer<
  typeof KerrExternalExecutionReceiptDeclarationSchema
>;

export const KerrExternalRunnerExecutionOutputBindingsSchema = z
  .object({
    rawOutput: KerrExternalExecutionReceiptDeclarationSchema.shape.rawOutput,
    normalizedOutput:
      KerrExternalExecutionReceiptDeclarationSchema.shape.normalizedOutput,
  })
  .strict();
export type KerrExternalRunnerExecutionOutputBindings = z.infer<
  typeof KerrExternalRunnerExecutionOutputBindingsSchema
>;

export interface CreateKerrExternalRunnerExecutionOutputBindingsInput {
  readonly handoff: KerrExternalRunnerHandoff;
  readonly rawOutputBytes: Uint8Array;
  readonly normalizedOutput: KerrExternalBlindedNormalizedOutput;
  readonly normalizedOutputBytes: Uint8Array;
}

/**
 * Runner-facing exact-byte binding factory. It accepts only the serialized
 * handoff and result bytes, grants no authority, and is replayed by receipt
 * creation against the process-local claim.
 */
export function createKerrExternalRunnerExecutionOutputBindings(
  input: CreateKerrExternalRunnerExecutionOutputBindingsInput,
): KerrExternalRunnerExecutionOutputBindings {
  const rawBytes = exactUint8ArrayCopy(
    ownDataValue(
      input,
      "rawOutputBytes",
      "Kerr runner execution-output bindings input",
    ),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES,
    "Kerr runner raw output",
  );
  const normalizedBytes = exactUint8ArrayCopy(
    ownDataValue(
      input,
      "normalizedOutputBytes",
      "Kerr runner execution-output bindings input",
    ),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES,
    "Kerr runner normalized output",
  );
  // Exact bytes are detached and bounded before caller-controlled object trees
  // are traversed.
  rejectRecognizedArchiveContainer(rawBytes);
  const handoffInput = ownDataValue(
    input,
    "handoff",
    "Kerr runner execution-output bindings input",
  );
  const normalizedOutputInput = ownDataValue(
    input,
    "normalizedOutput",
    "Kerr runner execution-output bindings input",
  );
  assertKerrComparisonPlainDataTree(handoffInput, "Kerr runner output handoff");
  const handoff = KerrExternalRunnerHandoffSchema.parse(handoffInput);
  assertKerrExternalBlindedNormalizedOutputForRunnerIntegrity(
    handoff,
    normalizedOutputInput,
  );
  const canonicalNormalizedBytes =
    canonicalKerrExternalBlindedNormalizedOutputBytesForRunner(
      handoff,
      normalizedOutputInput,
    );
  if (!exactBytesEqual(normalizedBytes, canonicalNormalizedBytes)) {
    throw new Error(
      "Kerr runner normalized bytes are not the exact canonical output",
    );
  }
  const normalizedOutput = KerrExternalBlindedNormalizedOutputSchema.parse(
    normalizedOutputInput,
  );
  const rawOutput =
    KerrExternalExecutionReceiptDeclarationSchema.shape.rawOutput.parse({
      kind: "isolated-runner-native-output",
      mediaType: "application/octet-stream",
      encoding: "opaque-exact-bytes",
      compression: "none",
      recognizedArchiveContainer: false,
      byteLength: rawBytes.byteLength,
      sha256: kerrSha256Hex(rawBytes),
    });
  return deepFreezeKerr(
    KerrExternalRunnerExecutionOutputBindingsSchema.parse({
      rawOutput,
      normalizedOutput: {
        kind: "answer-blinded-canonical-normalized-output",
        mediaType: "application/json",
        encoding: "utf-8",
        canonicalization: "kerr-stable-json-v1",
        normalizedOutputId: normalizedOutput.normalizedOutputId,
        normalizedOutputChecksumSha256:
          normalizedOutput.normalizedOutputChecksum.value,
        normalizerSourceSha256:
          handoff.artifactBindings.normalizerSourceSha256,
        rawInputSha256: rawOutput.sha256,
        byteLength: normalizedBytes.byteLength,
        sha256: kerrSha256Hex(normalizedBytes),
      },
    }),
  );
}

function receiptPayloadWithoutAttestation(
  claim: ClaimedKerrExternalRunnerHandoff,
  chronology: z.infer<
    typeof KerrExternalExecutionReceiptDeclarationSchema.shape.chronology
  >,
  outcome: z.infer<typeof RunnerOutcomeSchema>,
  resourceUsage: z.infer<typeof RunnerResourceUsageSchema>,
  streams: { stdout: z.infer<typeof StreamBindingSchema>; stderr: z.infer<typeof StreamBindingSchema> },
  rawOutput: z.infer<
    typeof KerrExternalExecutionReceiptDeclarationSchema.shape.rawOutput
  >,
  normalizedOutput: z.infer<
    typeof KerrExternalExecutionReceiptDeclarationSchema.shape.normalizedOutput
  >,
) {
  const expectedRows = expectedBlindedRows(claim.handoff);
  return {
    schemaVersion: "1.0.0" as const,
    state: "isolated-kerr-runner-receipt-awaiting-verification" as const,
    policyVersion: KERR_EXTERNAL_EXECUTION_RECEIPT_POLICY_VERSION,
    claimedEvidenceClass:
      "runner-declared-isolated-execution-receipt-awaiting-verification" as const,
    claimBinding: {
      claimId: claim.claimId,
      claimChecksumSha256: claim.claimChecksum.value,
      claimedAt: claim.claimedAt,
      expiresAt: claim.expiresAt,
      authorizationId: claim.handoff.authorizationId,
    },
    selectionBinding: claim.selectionBinding,
    requestBinding: claim.requestBinding,
    blindedInputBinding: {
      inputId: claim.handoff.blindedInput.inputId,
      inputChecksumSha256: claim.handoff.blindedInput.inputChecksum.value,
      caseCount: claim.handoff.blindedInput.cases.length,
      totalRays: expectedRows.length,
    },
    executionBinding: {
      audience: claim.handoff.audience,
      artifactBindings: claim.handoff.artifactBindings,
      invocation: claim.handoff.invocation,
      deterministicEnvironment: claim.handoff.deterministicEnvironment,
      sandbox: claim.handoff.sandbox,
      limits: claim.handoff.limits,
    },
    chronology,
    outcome,
    resourceUsage,
    streams,
    rawOutput,
    normalizedOutput,
    receiptProvenance: "runner-declared-awaiting-injected-verification" as const,
    receiptBindingVerified: false as const,
    executionReceiptIsScientificValidation: false as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
}

export const KerrExternalRunnerKnownExecutionStatementSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("isolated-kerr-runner-known-execution-statement"),
    policyVersion: z.literal(KERR_EXTERNAL_EXECUTION_RECEIPT_POLICY_VERSION),
    authorizationId: KerrExternalRunnerHandoffSchema.shape.authorizationId,
    expiresAt: KerrExternalRunnerHandoffSchema.shape.expiresAt,
    audience: KerrExternalRunnerHandoffSchema.shape.audience,
    blindedInputBinding:
      KerrExternalExecutionReceiptDeclarationSchema.shape.blindedInputBinding,
    artifactBindings: KerrExternalRunnerHandoffSchema.shape.artifactBindings,
    invocation: KerrExternalRunnerHandoffSchema.shape.invocation,
    deterministicEnvironment:
      KerrExternalRunnerHandoffSchema.shape.deterministicEnvironment,
    sandbox: KerrExternalRunnerHandoffSchema.shape.sandbox,
    limits: KerrExternalRunnerHandoffSchema.shape.limits,
    chronology: KerrExternalExecutionReceiptDeclarationSchema.shape.chronology,
    outcome: RunnerOutcomeSchema,
    resourceUsage: RunnerResourceUsageSchema,
    streams: KerrExternalExecutionReceiptDeclarationSchema.shape.streams,
    rawOutput: KerrExternalExecutionReceiptDeclarationSchema.shape.rawOutput,
    normalizedOutput:
      KerrExternalExecutionReceiptDeclarationSchema.shape.normalizedOutput,
    attestationFormat: z.literal("detached-isolated-runner-attestation-v1"),
    runnerId: IdentifierSchema,
    runnerKeyId: IdentifierSchema,
  })
  .strict();
export type KerrExternalRunnerKnownExecutionStatement = z.infer<
  typeof KerrExternalRunnerKnownExecutionStatementSchema
>;

export interface CreateKerrExternalRunnerKnownExecutionStatementInput {
  /**
   * The serialized handoff released to the runner. This factory deliberately
   * accepts the strict data contract rather than a process-local capability so
   * an isolated runner can prepare the identical signed statement.
   */
  readonly handoff: KerrExternalRunnerHandoff;
  readonly chronology: unknown;
  readonly outcome: unknown;
  readonly resourceUsage: unknown;
  readonly streams: unknown;
  readonly rawOutput: unknown;
  readonly normalizedOutput: unknown;
  readonly runnerId: unknown;
  readonly runnerKeyId: unknown;
}

export function createKerrExternalRunnerKnownExecutionStatement(
  input: CreateKerrExternalRunnerKnownExecutionStatementInput,
): KerrExternalRunnerKnownExecutionStatement {
  const handoffInput = ownDataValue(
    input,
    "handoff",
    "Kerr runner-known execution statement input",
  );
  assertKerrComparisonPlainDataTree(
    handoffInput,
    "Kerr runner-known execution handoff",
  );
  const handoff = KerrExternalRunnerHandoffSchema.parse(handoffInput);
  const chronologyInput = ownDataValue(
    input,
    "chronology",
    "Kerr runner-known execution statement input",
  );
  const outcomeInput = ownDataValue(
    input,
    "outcome",
    "Kerr runner-known execution statement input",
  );
  const resourceUsageInput = ownDataValue(
    input,
    "resourceUsage",
    "Kerr runner-known execution statement input",
  );
  const streamsInput = ownDataValue(
    input,
    "streams",
    "Kerr runner-known execution statement input",
  );
  const rawOutputInput = ownDataValue(
    input,
    "rawOutput",
    "Kerr runner-known execution statement input",
  );
  const normalizedOutputInput = ownDataValue(
    input,
    "normalizedOutput",
    "Kerr runner-known execution statement input",
  );
  for (const [value, label] of [
    [chronologyInput, "Kerr runner-known chronology"],
    [outcomeInput, "Kerr runner-known outcome"],
    [resourceUsageInput, "Kerr runner-known resource usage"],
    [streamsInput, "Kerr runner-known streams"],
    [rawOutputInput, "Kerr runner-known raw-output binding"],
    [normalizedOutputInput, "Kerr runner-known normalized-output binding"],
  ] as const) {
    assertKerrComparisonPlainDataTree(value, label);
  }
  const chronology =
    KerrExternalExecutionReceiptDeclarationSchema.shape.chronology.parse(
      chronologyInput,
    );
  const outcome = RunnerOutcomeSchema.parse(outcomeInput);
  const resourceUsage = RunnerResourceUsageSchema.parse(resourceUsageInput);
  const streams =
    KerrExternalExecutionReceiptDeclarationSchema.shape.streams.parse(streamsInput);
  const rawOutput =
    KerrExternalExecutionReceiptDeclarationSchema.shape.rawOutput.parse(rawOutputInput);
  const normalizedOutput =
    KerrExternalExecutionReceiptDeclarationSchema.shape.normalizedOutput.parse(
      normalizedOutputInput,
    );
  const runnerId = IdentifierSchema.parse(
    ownDataValue(input, "runnerId", "Kerr runner-known execution statement input"),
  );
  const runnerKeyId = IdentifierSchema.parse(
    ownDataValue(input, "runnerKeyId", "Kerr runner-known execution statement input"),
  );
  const totalRays = handoff.blindedInput.cases.reduce(
    (count, inputCase) => count + inputCase.rays.length,
    0,
  );
  if (
    Date.parse(chronology.startedAt) < Date.parse(handoff.consumedAt) ||
    Date.parse(chronology.startedAt) >= Date.parse(handoff.expiresAt) ||
    Date.parse(chronology.completedAt) < Date.parse(chronology.startedAt) ||
    Date.parse(chronology.completedAt) >= Date.parse(handoff.expiresAt) ||
    Date.parse(chronology.rawCapturedAt) < Date.parse(chronology.completedAt) ||
    Date.parse(chronology.normalizedAt) < Date.parse(chronology.rawCapturedAt) ||
    Date.parse(chronology.receiptGeneratedAt) <
      Date.parse(chronology.normalizedAt) ||
    Date.parse(chronology.receiptGeneratedAt) >= Date.parse(handoff.expiresAt)
  ) {
    throw new Error("Kerr runner-known execution chronology is invalid or expired");
  }
  if (
    normalizedOutput.normalizerSourceSha256 !==
      handoff.artifactBindings.normalizerSourceSha256 ||
    normalizedOutput.rawInputSha256 !== rawOutput.sha256
  ) {
    throw new Error("Kerr runner-known output bindings do not match the handoff");
  }
  const statement = KerrExternalRunnerKnownExecutionStatementSchema.parse({
    schemaVersion: "1.0.0",
    state: "isolated-kerr-runner-known-execution-statement",
    policyVersion: KERR_EXTERNAL_EXECUTION_RECEIPT_POLICY_VERSION,
    authorizationId: handoff.authorizationId,
    expiresAt: handoff.expiresAt,
    audience: handoff.audience,
    blindedInputBinding: {
      inputId: handoff.blindedInput.inputId,
      inputChecksumSha256: handoff.blindedInput.inputChecksum.value,
      caseCount: handoff.blindedInput.cases.length,
      totalRays,
    },
    artifactBindings: handoff.artifactBindings,
    invocation: handoff.invocation,
    deterministicEnvironment: handoff.deterministicEnvironment,
    sandbox: handoff.sandbox,
    limits: handoff.limits,
    chronology,
    outcome,
    resourceUsage,
    streams,
    rawOutput,
    normalizedOutput,
    attestationFormat: "detached-isolated-runner-attestation-v1",
    runnerId,
    runnerKeyId,
  });
  assertCanonicalByteBudget(statement, "Kerr runner-known execution statement");
  return deepFreezeKerr(statement);
}

export function canonicalKerrExternalRunnerKnownExecutionStatementBytes(
  statementInput: unknown,
): Uint8Array {
  assertKerrComparisonPlainDataTree(
    statementInput,
    "Kerr runner-known execution statement",
  );
  const statement = KerrExternalRunnerKnownExecutionStatementSchema.parse(statementInput);
  const bytes = new TextEncoder().encode(kerrStableStringify(statement));
  if (bytes.byteLength > KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_CANONICAL_BYTES) {
    throw new RangeError("Kerr runner-known execution statement exceeds its byte budget");
  }
  return bytes;
}

export function kerrExternalRunnerKnownExecutionStatementSha256(
  statementInput: unknown,
): string {
  return kerrSha256Hex(
    canonicalKerrExternalRunnerKnownExecutionStatementBytes(statementInput),
  );
}

export interface CreateKerrExternalExecutionReceiptDeclarationInput {
  readonly claimedHandoff: ClaimedKerrExternalRunnerHandoff;
  readonly startedAt: unknown;
  readonly completedAt: unknown;
  readonly rawCapturedAt: unknown;
  readonly receiptGeneratedAt: unknown;
  readonly outcome: unknown;
  readonly resourceUsage: unknown;
  readonly stdout: unknown;
  readonly stderr: unknown;
  readonly rawOutputBytes: Uint8Array;
  readonly normalizedOutput: KerrExternalBlindedNormalizedOutput;
  readonly normalizedOutputBytes: Uint8Array;
  readonly runnerId: unknown;
  readonly runnerKeyId: unknown;
  readonly signatureEnvelopeBytes: Uint8Array;
}

export function createKerrExternalExecutionReceiptDeclaration(
  input: CreateKerrExternalExecutionReceiptDeclarationInput,
): KerrExternalExecutionReceiptDeclaration {
  const claim = ownDataValue(
    input,
    "claimedHandoff",
    "Kerr execution receipt declaration input",
  );
  assertIssuedClaimedKerrExternalRunnerHandoff(claim);
  const rawBytes = exactUint8ArrayCopy(
    ownDataValue(input, "rawOutputBytes", "Kerr execution receipt declaration input"),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES,
    "Kerr execution receipt raw output",
  );
  const normalizedBytes = exactUint8ArrayCopy(
    ownDataValue(
      input,
      "normalizedOutputBytes",
      "Kerr execution receipt declaration input",
    ),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES,
    "Kerr execution receipt normalized output",
  );
  const signatureEnvelopeBytes = exactUint8ArrayCopy(
    ownDataValue(
      input,
      "signatureEnvelopeBytes",
      "Kerr execution receipt declaration input",
    ),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
    "Kerr execution receipt signature envelope",
  );
  // All exact byte inputs are detached and size-bounded before normalized
  // caller data is traversed.
  rejectRecognizedArchiveContainer(rawBytes);
  const normalizedOutputInput = ownDataValue(
    input,
    "normalizedOutput",
    "Kerr execution receipt declaration input",
  );
  assertKerrExternalBlindedNormalizedOutputIntegrity(claim, normalizedOutputInput);
  const expectedNormalizedBytes =
    canonicalKerrExternalBlindedNormalizedOutputBytes(claim, normalizedOutputInput);
  if (!exactBytesEqual(normalizedBytes, expectedNormalizedBytes)) {
    throw new Error(
      "Kerr execution receipt normalized bytes are not the exact canonical output",
    );
  }
  const chronology = KerrExternalExecutionReceiptDeclarationSchema.shape.chronology.parse({
    startedAt: ownDataValue(input, "startedAt", "Kerr execution receipt declaration input"),
    completedAt: ownDataValue(
      input,
      "completedAt",
      "Kerr execution receipt declaration input",
    ),
    rawCapturedAt: ownDataValue(
      input,
      "rawCapturedAt",
      "Kerr execution receipt declaration input",
    ),
    normalizedAt: normalizedOutputInput.normalizedAt,
    receiptGeneratedAt: ownDataValue(
      input,
      "receiptGeneratedAt",
      "Kerr execution receipt declaration input",
    ),
  });
  if (
    Date.parse(chronology.startedAt) < Date.parse(claim.claimedAt) ||
    Date.parse(chronology.startedAt) >= Date.parse(claim.expiresAt) ||
    Date.parse(chronology.completedAt) < Date.parse(chronology.startedAt) ||
    Date.parse(chronology.completedAt) >= Date.parse(claim.expiresAt) ||
    Date.parse(chronology.rawCapturedAt) < Date.parse(chronology.completedAt) ||
    Date.parse(chronology.normalizedAt) < Date.parse(chronology.rawCapturedAt) ||
    Date.parse(chronology.receiptGeneratedAt) <
      Date.parse(chronology.normalizedAt) ||
    Date.parse(chronology.receiptGeneratedAt) >= Date.parse(claim.expiresAt)
  ) {
    throw new Error("Kerr execution receipt chronology is invalid or expired");
  }
  const outcomeInput = ownDataValue(
    input,
    "outcome",
    "Kerr execution receipt declaration input",
  );
  const resourcesInput = ownDataValue(
    input,
    "resourceUsage",
    "Kerr execution receipt declaration input",
  );
  const stdoutInput = ownDataValue(
    input,
    "stdout",
    "Kerr execution receipt declaration input",
  );
  const stderrInput = ownDataValue(
    input,
    "stderr",
    "Kerr execution receipt declaration input",
  );
  assertKerrComparisonPlainDataTree(outcomeInput, "Kerr runner outcome");
  assertKerrComparisonPlainDataTree(resourcesInput, "Kerr runner resource usage");
  assertKerrComparisonPlainDataTree(stdoutInput, "Kerr runner stdout binding");
  assertKerrComparisonPlainDataTree(stderrInput, "Kerr runner stderr binding");
  const outcome = RunnerOutcomeSchema.parse(outcomeInput);
  const resourceUsage = RunnerResourceUsageSchema.parse(resourcesInput);
  const streams = {
    stdout: StreamBindingSchema.parse(stdoutInput),
    stderr: StreamBindingSchema.parse(stderrInput),
  };
  const { rawOutput, normalizedOutput } =
    createKerrExternalRunnerExecutionOutputBindings({
      handoff: claim.handoff,
      rawOutputBytes: rawBytes,
      normalizedOutput: normalizedOutputInput,
      normalizedOutputBytes: normalizedBytes,
    });
  const runnerId = IdentifierSchema.parse(
    ownDataValue(input, "runnerId", "Kerr execution receipt declaration input"),
  );
  const runnerKeyId = IdentifierSchema.parse(
    ownDataValue(
      input,
      "runnerKeyId",
      "Kerr execution receipt declaration input",
    ),
  );
  const core = receiptPayloadWithoutAttestation(
    claim,
    chronology,
    outcome,
    resourceUsage,
    streams,
    rawOutput,
    normalizedOutput,
  );
  // The declaration replays the same strict runner-visible preparation API an
  // isolated signer can call before producing the detached envelope.
  const runnerStatement = createKerrExternalRunnerKnownExecutionStatement({
    handoff: claim.handoff,
    chronology,
    outcome,
    resourceUsage,
    streams,
    rawOutput,
    normalizedOutput,
    runnerId,
    runnerKeyId,
  });
  const signedRunnerStatementSha256 =
    kerrExternalRunnerKnownExecutionStatementSha256(runnerStatement);
  const runnerAttestation = KerrExternalExecutionReceiptDeclarationSchema.shape.runnerAttestation.parse({
    format: "detached-isolated-runner-attestation-v1",
    runnerId,
    runnerKeyId,
    signedRunnerStatementSha256,
    signatureEnvelope: {
      mediaType: "application/octet-stream",
      encoding: "opaque-exact-bytes",
      byteLength: signatureEnvelopeBytes.byteLength,
      sha256: kerrSha256Hex(signatureEnvelopeBytes),
    },
  });
  const identity = { core, runnerAttestation };
  const receiptId = `krxreceipt_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const receipt = KerrExternalExecutionReceiptDeclarationSchema.parse({
    ...core,
    receiptId,
    runnerAttestation,
    receiptChecksum: checksum(
      "declared-isolated-kerr-runner-execution-receipt",
      { ...core, receiptId, runnerAttestation },
    ),
  });
  assertCanonicalByteBudget(receipt, "Kerr execution receipt declaration");
  return deepFreezeKerr(receipt);
}

export function assertKerrExternalExecutionReceiptDeclarationIntegrity(
  claimInput: unknown,
  receiptInput: unknown,
  rawBytesInput: unknown,
  normalizedOutputInput: unknown,
  normalizedBytesInput: unknown,
  signatureEnvelopeBytesInput: unknown,
): asserts receiptInput is KerrExternalExecutionReceiptDeclaration {
  assertIssuedClaimedKerrExternalRunnerHandoff(claimInput);
  const rawBytes = exactUint8ArrayCopy(
    rawBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES,
    "Kerr execution receipt raw output",
  );
  const normalizedBytes = exactUint8ArrayCopy(
    normalizedBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES,
    "Kerr execution receipt normalized output",
  );
  const signatureEnvelopeBytes = exactUint8ArrayCopy(
    signatureEnvelopeBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
    "Kerr execution receipt signature envelope",
  );
  rejectRecognizedArchiveContainer(rawBytes);
  assertKerrExternalBlindedNormalizedOutputIntegrity(
    claimInput,
    normalizedOutputInput,
  );
  const expectedNormalizedBytes =
    canonicalKerrExternalBlindedNormalizedOutputBytes(
      claimInput,
      normalizedOutputInput,
    );
  if (!exactBytesEqual(normalizedBytes, expectedNormalizedBytes)) {
    throw new Error("Kerr receipt normalized bytes do not match canonical output");
  }
  assertKerrComparisonPlainDataTree(receiptInput, "Kerr execution receipt declaration");
  const receipt = KerrExternalExecutionReceiptDeclarationSchema.parse(receiptInput);
  const expected = createKerrExternalExecutionReceiptDeclaration({
    claimedHandoff: claimInput,
    startedAt: receipt.chronology.startedAt,
    completedAt: receipt.chronology.completedAt,
    rawCapturedAt: receipt.chronology.rawCapturedAt,
    receiptGeneratedAt: receipt.chronology.receiptGeneratedAt,
    outcome: receipt.outcome,
    resourceUsage: receipt.resourceUsage,
    stdout: receipt.streams.stdout,
    stderr: receipt.streams.stderr,
    rawOutputBytes: rawBytes,
    normalizedOutput: normalizedOutputInput,
    normalizedOutputBytes: normalizedBytes,
    runnerId: receipt.runnerAttestation.runnerId,
    runnerKeyId: receipt.runnerAttestation.runnerKeyId,
    signatureEnvelopeBytes,
  });
  if (kerrStableStringify(receipt) !== kerrStableStringify(expected)) {
    throw new Error("Kerr execution receipt failed exact integrity replay");
  }
}

const VerificationSubjectChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-execution-receipt-verification-subject"),
  })
  .strict();

export const KerrExternalExecutionReceiptVerificationSubjectSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("kerr-execution-receipt-verification-subject"),
    subjectId: z.string().regex(/^krxvsubject_[a-f0-9]{24}$/),
    verifiedAt: CanonicalTimestampSchema,
    claimId: z.string().regex(/^krxclaim_[a-f0-9]{24}$/),
    authorizationId: z.string().regex(/^krxauth_[a-f0-9]{24}$/),
    requestId: z.string().regex(/^krxreq_[a-f0-9]{24}$/),
    attemptNonce: z.string().regex(/^[a-f0-9]{32}$/),
    receiptId: z.string().regex(/^krxreceipt_[a-f0-9]{24}$/),
    receiptChecksumSha256: Sha256Schema,
    signedRunnerStatementSha256: Sha256Schema,
    signatureEnvelopeSha256: Sha256Schema,
    signatureEnvelopeByteLength: z
      .number()
      .int()
      .positive()
      .max(KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES),
    runnerId: IdentifierSchema,
    runnerKeyId: IdentifierSchema,
    rawOutputSha256: Sha256Schema,
    normalizedOutputSha256: Sha256Schema,
    normalizedOutputId: z.string().regex(/^krbnout_[a-f0-9]{24}$/),
    purpose: z.literal(
      "verify-one-claimed-answer-blinded-run-receipt-for-quarantine-admission",
    ),
    subjectChecksum: VerificationSubjectChecksumSchema,
  })
  .strict();
export type KerrExternalExecutionReceiptVerificationSubject = z.infer<
  typeof KerrExternalExecutionReceiptVerificationSubjectSchema
>;

export const KerrExternalExecutionReceiptVerifierReceiptSchema = z
  .object({
    accepted: z.literal(true),
    subjectSha256: Sha256Schema,
    receiptId: z.string().regex(/^krxreceipt_[a-f0-9]{24}$/),
    receiptChecksumSha256: Sha256Schema,
    claimId: z.string().regex(/^krxclaim_[a-f0-9]{24}$/),
    runnerId: IdentifierSchema,
    runnerKeyId: IdentifierSchema,
    runnerGrantId: IdentifierSchema,
    attestationPolicyId: IdentifierSchema,
    checkedAt: CanonicalTimestampSchema,
    signatureVerified: z.literal(true),
    runnerGrantValid: z.literal(true),
    runnerKeyValid: z.literal(true),
    runnerKeyPurposeVerified: z.literal(true),
    runnerKeyDistinctFromReviewKeys: z.literal(true),
    audienceAndPurposeVerified: z.literal(true),
    notRevoked: z.literal(true),
    attestationPayloadVerified: z.literal(true),
    claimBindingVerified: z.literal(true),
    executionProfileBindingVerified: z.literal(true),
    sandboxEvidenceVerified: z.literal(true),
    successfulExitVerified: z.literal(true),
    resourceLimitsVerified: z.literal(true),
    exactRawOutputBindingVerified: z.literal(true),
    exactNormalizedOutputBindingVerified: z.literal(true),
    verifierAssertsEvidenceNotSynthetic: z.literal(true),
    verifierAssertsEvidenceNotCallerDeclared: z.literal(true),
  })
  .strict();
export type KerrExternalExecutionReceiptVerifierReceipt = z.infer<
  typeof KerrExternalExecutionReceiptVerifierReceiptSchema
>;

export type KerrExternalExecutionReceiptVerifier = (
  subject: Readonly<KerrExternalExecutionReceiptVerificationSubject>,
  receipt: Readonly<KerrExternalExecutionReceiptDeclaration>,
  signatureEnvelopeBytes: Uint8Array,
) => unknown | Promise<unknown>;

const VerifiedReceiptChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("verified-kerr-execution-receipt-binding"),
  })
  .strict();

export const VerifiedKerrExternalExecutionReceiptSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "kerr-execution-receipt-binding-verified-in-process-for-quarantine",
    ),
    verificationId: z.string().regex(/^krxverify_[a-f0-9]{24}$/),
    verifiedAt: CanonicalTimestampSchema,
    claimBinding: KerrExternalExecutionReceiptDeclarationSchema.shape.claimBinding,
    selectionBinding:
      KerrExternalExecutionReceiptDeclarationSchema.shape.selectionBinding,
    requestBinding:
      KerrExternalExecutionReceiptDeclarationSchema.shape.requestBinding,
    receipt: KerrExternalExecutionReceiptDeclarationSchema,
    verificationSubject: KerrExternalExecutionReceiptVerificationSubjectSchema,
    verifierReceipt: KerrExternalExecutionReceiptVerifierReceiptSchema,
    executionReceiptBindingVerified: z.literal(true),
    executionVerificationScope: z.literal(
      "one-authorized-answer-blinded-run-and-exact-output-bytes-only",
    ),
    exactRawOutputBytesVerified: z.literal(true),
    exactNormalizedOutputBytesVerified: z.literal(true),
    runnerAttestationVerifiedByInjectedBoundary: z.literal(true),
    injectedVerifierAuthorityAuthenticatedByPackage: z.literal(false),
    quarantineOutputAdmissionAllowed: z.literal(true),
    realExternalExecutionEstablishedByPackage: z.literal(false),
    oneUse: z.literal(true),
    consumed: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    verificationChecksum: VerifiedReceiptChecksumSchema,
  })
  .strict();
export type VerifiedKerrExternalExecutionReceipt = z.infer<
  typeof VerifiedKerrExternalExecutionReceiptSchema
>;

const attemptedReceiptClaims = new WeakSet<object>();
const issuedVerifiedExecutionReceipts = new WeakSet<object>();
const consumedVerifiedExecutionReceipts = new WeakSet<object>();
const verifiedExecutionReceiptContexts = new WeakMap<
  object,
  {
    readonly claim: ClaimedKerrExternalRunnerHandoff;
    readonly normalizedOutput: KerrExternalBlindedNormalizedOutput;
    readonly rawBytes: Uint8Array;
    readonly normalizedBytes: Uint8Array;
  }
>();

function assertSuccessfulBoundedExecution(
  claim: ClaimedKerrExternalRunnerHandoff,
  receipt: KerrExternalExecutionReceiptDeclaration,
): void {
  const { outcome, resourceUsage, streams, chronology } = receipt;
  const limits = claim.handoff.limits;
  const elapsed =
    Date.parse(chronology.normalizedAt) - Date.parse(chronology.startedAt);
  if (
    outcome.exitCode !== 0 ||
    outcome.terminationSignal !== null ||
    outcome.timedOut ||
    outcome.outOfMemory ||
    outcome.sandboxViolation ||
    outcome.networkAccessObserved ||
    outcome.outputTruncated ||
    outcome.unexpectedWritableArtifacts ||
    streams.stdout.truncated ||
    streams.stderr.truncated
  ) {
    throw new Error("Kerr execution receipt does not record one clean bounded exit");
  }
  if (
    resourceUsage.wallMilliseconds !== elapsed ||
    elapsed < 0 ||
    resourceUsage.cpuMilliseconds > limits.maxCpuMilliseconds ||
    resourceUsage.wallMilliseconds > limits.maxWallMilliseconds ||
    resourceUsage.peakMemoryBytes > limits.maxMemoryBytes ||
    resourceUsage.maximumConcurrentProcesses < 1 ||
    resourceUsage.maximumConcurrentProcesses > limits.maxProcesses ||
    resourceUsage.writableBytes > limits.maxWritableBytes ||
    resourceUsage.stdoutBytes !== streams.stdout.byteLength ||
    resourceUsage.stdoutBytes > limits.maxStdoutBytes ||
    resourceUsage.stderrBytes !== streams.stderr.byteLength ||
    resourceUsage.stderrBytes > limits.maxStderrBytes ||
    resourceUsage.outputBytes !== receipt.rawOutput.byteLength ||
    resourceUsage.outputBytes > limits.maxOutputBytes
  ) {
    throw new Error("Kerr execution receipt exceeds or contradicts reviewed limits");
  }
}

function verificationSubject(
  claim: ClaimedKerrExternalRunnerHandoff,
  receipt: KerrExternalExecutionReceiptDeclaration,
  verifiedAt: string,
): KerrExternalExecutionReceiptVerificationSubject {
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "kerr-execution-receipt-verification-subject" as const,
    verifiedAt,
    claimId: claim.claimId,
    authorizationId: claim.handoff.authorizationId,
    requestId: claim.requestBinding.requestId,
    attemptNonce: claim.requestBinding.attemptNonce,
    receiptId: receipt.receiptId,
    receiptChecksumSha256: receipt.receiptChecksum.value,
    signedRunnerStatementSha256:
      receipt.runnerAttestation.signedRunnerStatementSha256,
    signatureEnvelopeSha256:
      receipt.runnerAttestation.signatureEnvelope.sha256,
    signatureEnvelopeByteLength:
      receipt.runnerAttestation.signatureEnvelope.byteLength,
    runnerId: receipt.runnerAttestation.runnerId,
    runnerKeyId: receipt.runnerAttestation.runnerKeyId,
    rawOutputSha256: receipt.rawOutput.sha256,
    normalizedOutputSha256: receipt.normalizedOutput.sha256,
    normalizedOutputId: receipt.normalizedOutput.normalizedOutputId,
    purpose:
      "verify-one-claimed-answer-blinded-run-receipt-for-quarantine-admission" as const,
  };
  const subjectId = `krxvsubject_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  return deepFreezeKerr(
    KerrExternalExecutionReceiptVerificationSubjectSchema.parse({
      ...unsigned,
      subjectId,
      subjectChecksum: checksum(
        "kerr-execution-receipt-verification-subject",
        { ...unsigned, subjectId },
      ),
    }),
  );
}

function assertVerifierReceiptMatches(
  verifierReceipt: KerrExternalExecutionReceiptVerifierReceipt,
  subject: KerrExternalExecutionReceiptVerificationSubject,
  receipt: KerrExternalExecutionReceiptDeclaration,
): void {
  if (
    verifierReceipt.subjectSha256 !== subject.subjectChecksum.value ||
    verifierReceipt.receiptId !== receipt.receiptId ||
    verifierReceipt.receiptChecksumSha256 !== receipt.receiptChecksum.value ||
    verifierReceipt.claimId !== subject.claimId ||
    verifierReceipt.runnerId !== receipt.runnerAttestation.runnerId ||
    verifierReceipt.runnerKeyId !== receipt.runnerAttestation.runnerKeyId ||
    verifierReceipt.checkedAt !== subject.verifiedAt
  ) {
    throw new Error("Injected Kerr runner verifier receipt binding mismatch");
  }
}

export interface VerifyKerrExternalExecutionReceiptInput {
  readonly claimedHandoff: ClaimedKerrExternalRunnerHandoff;
  readonly receipt: KerrExternalExecutionReceiptDeclaration;
  readonly rawOutputBytes: Uint8Array;
  readonly normalizedOutput: KerrExternalBlindedNormalizedOutput;
  readonly normalizedOutputBytes: Uint8Array;
  readonly signatureEnvelopeBytes: Uint8Array;
  readonly verifiedAt: unknown;
}

export async function verifyKerrExternalExecutionReceipt(
  input: VerifyKerrExternalExecutionReceiptInput,
  verifyRunnerAttestation: KerrExternalExecutionReceiptVerifier,
  recheckCurrentGrant: KerrExternalCurrentGrantAuthorizer,
): Promise<VerifiedKerrExternalExecutionReceipt> {
  const claim = ownDataValue(
    input,
    "claimedHandoff",
    "Kerr execution receipt verification",
  );
  assertIssuedClaimedKerrExternalRunnerHandoff(claim);
  if (attemptedReceiptClaims.has(claim)) {
    throw new Error("Claimed Kerr runner handoff already attempted receipt verification");
  }
  const rawBytes = exactUint8ArrayCopy(
    ownDataValue(input, "rawOutputBytes", "Kerr execution receipt verification"),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES,
    "Kerr verified raw output",
  );
  const normalizedBytes = exactUint8ArrayCopy(
    ownDataValue(
      input,
      "normalizedOutputBytes",
      "Kerr execution receipt verification",
    ),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES,
    "Kerr verified normalized output",
  );
  const signatureEnvelopeBytes = exactUint8ArrayCopy(
    ownDataValue(
      input,
      "signatureEnvelopeBytes",
      "Kerr execution receipt verification",
    ),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
    "Kerr verified signature envelope",
  );
  const normalizedOutput = ownDataValue(
    input,
    "normalizedOutput",
    "Kerr execution receipt verification",
  );
  const receiptInput = ownDataValue(
    input,
    "receipt",
    "Kerr execution receipt verification",
  );
  assertKerrExternalExecutionReceiptDeclarationIntegrity(
    claim,
    receiptInput,
    rawBytes,
    normalizedOutput,
    normalizedBytes,
    signatureEnvelopeBytes,
  );
  // Detach every caller-owned normalized field before the first await. The
  // exact bytes above bind this parser-owned copy, which is the only version
  // retained for later plan admission.
  const frozenNormalizedOutput = deepFreezeKerr(
    KerrExternalBlindedNormalizedOutputSchema.parse(normalizedOutput),
  );
  const receipt = deepFreezeKerr(
    KerrExternalExecutionReceiptDeclarationSchema.parse(receiptInput),
  );
  assertSuccessfulBoundedExecution(claim, receipt);
  const verifiedAt = CanonicalTimestampSchema.parse(
    ownDataValue(input, "verifiedAt", "Kerr execution receipt verification"),
  );
  if (
    Date.parse(verifiedAt) < Date.parse(receipt.chronology.receiptGeneratedAt) ||
    Date.parse(verifiedAt) >= Date.parse(claim.expiresAt)
  ) {
    throw new Error("Kerr execution receipt verification is outside validity");
  }
  const subject = verificationSubject(claim, receipt, verifiedAt);
  // Burn before either asynchronous trust-boundary call. A rejected grant or
  // attestation cannot be retried with a changed check time or envelope.
  attemptedReceiptClaims.add(claim);
  await recheckClaimedKerrExternalRunnerHandoffCurrentGrants(
    claim,
    verifiedAt,
    recheckCurrentGrant,
  );
  const verifierReceiptInput = await verifyRunnerAttestation(
    subject,
    receipt,
    new Uint8Array(signatureEnvelopeBytes),
  );
  assertKerrComparisonPlainDataTree(
    verifierReceiptInput,
    "Injected Kerr execution receipt verifier result",
  );
  const verifierReceipt = deepFreezeKerr(
    KerrExternalExecutionReceiptVerifierReceiptSchema.parse(
      verifierReceiptInput,
    ),
  );
  assertVerifierReceiptMatches(verifierReceipt, subject, receipt);
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state:
      "kerr-execution-receipt-binding-verified-in-process-for-quarantine" as const,
    verifiedAt,
    claimBinding: receipt.claimBinding,
    selectionBinding: receipt.selectionBinding,
    requestBinding: receipt.requestBinding,
    receipt,
    verificationSubject: subject,
    verifierReceipt,
    executionReceiptBindingVerified: true as const,
    executionVerificationScope:
      "one-authorized-answer-blinded-run-and-exact-output-bytes-only" as const,
    exactRawOutputBytesVerified: true as const,
    exactNormalizedOutputBytesVerified: true as const,
    runnerAttestationVerifiedByInjectedBoundary: true as const,
    injectedVerifierAuthorityAuthenticatedByPackage: false as const,
    quarantineOutputAdmissionAllowed: true as const,
    realExternalExecutionEstablishedByPackage: false as const,
    oneUse: true as const,
    consumed: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
  const verificationId = `krxverify_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const verified = deepFreezeKerr(
    VerifiedKerrExternalExecutionReceiptSchema.parse({
      ...unsigned,
      verificationId,
      verificationChecksum: checksum("verified-kerr-execution-receipt-binding", {
        ...unsigned,
        verificationId,
      }),
    }),
  );
  assertCanonicalByteBudget(verified, "Verified Kerr execution receipt binding");
  issuedVerifiedExecutionReceipts.add(verified);
  verifiedExecutionReceiptContexts.set(verified, {
    claim,
    normalizedOutput: frozenNormalizedOutput,
    rawBytes,
    normalizedBytes,
  });
  return verified;
}

export function assertIssuedVerifiedKerrExternalExecutionReceipt(
  input: unknown,
): asserts input is VerifiedKerrExternalExecutionReceipt {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedVerifiedExecutionReceipts.has(input)
  ) {
    throw new Error(
      "Verified Kerr execution receipt must be issued in this process; structural copies are rejected",
    );
  }
  if (consumedVerifiedExecutionReceipts.has(input)) {
    throw new Error("Verified Kerr execution receipt has already been admitted");
  }
}

export function assertVerifiedKerrExternalExecutionReceiptExactBytes(
  verifiedInput: unknown,
  rawBytesInput: unknown,
  normalizedBytesInput: unknown,
): void {
  assertIssuedVerifiedKerrExternalExecutionReceipt(verifiedInput);
  const context = verifiedExecutionReceiptContexts.get(verifiedInput);
  if (context === undefined) {
    throw new Error("Verified Kerr execution receipt byte context is unavailable");
  }
  const rawBytes = exactUint8ArrayCopy(
    rawBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES,
    "Verified Kerr raw output",
  );
  const normalizedBytes = exactUint8ArrayCopy(
    normalizedBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES,
    "Verified Kerr normalized output",
  );
  if (
    !exactBytesEqual(rawBytes, context.rawBytes) ||
    !exactBytesEqual(normalizedBytes, context.normalizedBytes)
  ) {
    throw new Error("Verified Kerr execution receipt exact bytes do not match");
  }
}

const ReferenceChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.string().trim().min(1).max(120),
  })
  .strict();

export const KerrVerifiedOutputAdmissionRowBindingSchema = z
  .object({
    caseOrdinal: z.number().int().min(0).max(7),
    rayOrdinal: z
      .number()
      .int()
      .min(0)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
    candidateRowId: z.string().regex(/^krbnrow_[a-f0-9]{24}$/),
    candidateRowChecksumSha256: Sha256Schema,
    caseId: z.string().regex(/^krcase_[a-z0-9][a-z0-9-]{2,63}$/),
    scientificRole: z.string().trim().min(1).max(120),
    requestId: z.string().regex(/^krreq_[a-f0-9]{24}$/),
    requestChecksum: ReferenceChecksumSchema,
    referenceReportId: z.string().regex(/^krrep_[a-f0-9]{24}$/),
    referenceReportChecksum: ReferenceChecksumSchema,
    referenceRayId: z.string().regex(/^krray_[a-f0-9]{24}$/),
    referenceRayChecksum: ReferenceChecksumSchema,
    pixelIndex: z
      .number()
      .int()
      .min(0)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
    pixelX: z.number().int().min(0).max(24),
    pixelY: z.number().int().min(0).max(24),
  })
  .strict();
export type KerrVerifiedOutputAdmissionRowBinding = z.infer<
  typeof KerrVerifiedOutputAdmissionRowBindingSchema
>;

const AdmissionChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("verified-kerr-output-quarantine-admission"),
  })
  .strict();

export const VerifiedKerrExternalOutputAdmissionSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "receipt-verified-kerr-output-admitted-to-process-local-quarantine",
    ),
    admissionId: z.string().regex(/^krxadmit_[a-f0-9]{24}$/),
    admittedAt: CanonicalTimestampSchema,
    verificationBinding: z
      .object({
        verificationId: z.string().regex(/^krxverify_[a-f0-9]{24}$/),
        verificationChecksumSha256: Sha256Schema,
        receiptId: z.string().regex(/^krxreceipt_[a-f0-9]{24}$/),
        receiptChecksumSha256: Sha256Schema,
      })
      .strict(),
    planBinding: z
      .object({
        planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
        planChecksumSha256: Sha256Schema,
        comparisonScope: z.enum(["integrator-only", "camera-and-solver"]),
        caseCount: z.number().int().min(1).max(8),
        totalRays: z.number().int().min(1).max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
      })
      .strict(),
    outputBinding: z
      .object({
        rawByteLength: z
          .number()
          .int()
          .positive()
          .max(KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES),
        rawSha256: Sha256Schema,
        normalizedOutputId: z.string().regex(/^krbnout_[a-f0-9]{24}$/),
        normalizedOutputChecksumSha256: Sha256Schema,
        normalizedByteLength: z
          .number()
          .int()
          .positive()
          .max(KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES),
        normalizedSha256: Sha256Schema,
      })
      .strict(),
    rows: z
      .array(KerrVerifiedOutputAdmissionRowBindingSchema)
      .min(1)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    rowCoverage: z.literal(
      "exactly-one-receipt-verified-candidate-row-per-plan-ray-in-plan-order",
    ),
    executionReceiptBindingVerified: z.literal(true),
    exactRawOutputBytesVerified: z.literal(true),
    exactNormalizedOutputBytesVerified: z.literal(true),
    quarantineAdmissionVerified: z.literal(true),
    comparisonReviewPreparationAllowed: z.literal(true),
    attestationEvidenceStatus: z.literal(
      "injected-verifier-asserted-not-package-authenticated",
    ),
    injectedVerifierAuthorityAuthenticatedByPackage: z.literal(false),
    quarantinePersistencePerformed: z.literal(false),
    durableReceiptRecorded: z.literal(false),
    realExternalExecutionEstablishedByPackage: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    admissionChecksum: AdmissionChecksumSchema,
  })
  .strict();
export type VerifiedKerrExternalOutputAdmission = z.infer<
  typeof VerifiedKerrExternalOutputAdmissionSchema
>;

const issuedVerifiedOutputAdmissions = new WeakSet<object>();
const attemptedVerifiedOutputAdmissionsForComparisonReview = new WeakSet<object>();
const verifiedOutputAdmissionContexts = new WeakMap<
  object,
  {
    readonly rawBytes: Uint8Array;
    readonly normalizedBytes: Uint8Array;
    readonly normalizedOutput: KerrExternalBlindedNormalizedOutput;
    readonly verifiedExecutionReceipt: VerifiedKerrExternalExecutionReceipt;
    readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
    readonly plan: KerrComparisonPlan;
    readonly selectionReviewIdentityBindings: KerrExternalSelectionReviewIdentityBindings;
  }
>();

function admittedRows(
  plan: KerrComparisonPlan,
  normalizedOutput: KerrExternalBlindedNormalizedOutput,
): readonly KerrVerifiedOutputAdmissionRowBinding[] {
  const planRows = plan.cases.flatMap((planCase, caseOrdinal) =>
    planCase.rays.map((referenceRay, rayOrdinal) => ({
      planCase,
      referenceRay,
      caseOrdinal,
      rayOrdinal,
    })),
  );
  if (planRows.length !== normalizedOutput.rows.length) {
    throw new Error("Receipt-verified Kerr output does not cover the exact plan");
  }
  return normalizedOutput.rows.map((candidate, index) => {
    const expected = planRows[index]!;
    if (
      candidate.caseOrdinal !== expected.caseOrdinal ||
      candidate.rayOrdinal !== expected.rayOrdinal ||
      candidate.pixelIndex !== expected.referenceRay.pixelIndex ||
      candidate.pixelX !== expected.referenceRay.pixelX ||
      candidate.pixelY !== expected.referenceRay.pixelY
    ) {
      throw new Error(
        "Receipt-verified Kerr output row does not match plan order and pixels",
      );
    }
    return KerrVerifiedOutputAdmissionRowBindingSchema.parse({
      caseOrdinal: expected.caseOrdinal,
      rayOrdinal: expected.rayOrdinal,
      candidateRowId: candidate.rowId,
      candidateRowChecksumSha256: candidate.rowChecksum.value,
      caseId: expected.planCase.caseId,
      scientificRole: expected.planCase.scientificRole,
      requestId: expected.planCase.request.requestId,
      requestChecksum: expected.planCase.request.requestChecksum,
      referenceReportId: expected.planCase.report.reportId,
      referenceReportChecksum: expected.planCase.report.reportChecksum,
      referenceRayId: expected.referenceRay.rayId,
      referenceRayChecksum: expected.referenceRay.rayChecksum,
      pixelIndex: expected.referenceRay.pixelIndex,
      pixelX: expected.referenceRay.pixelX,
      pixelY: expected.referenceRay.pixelY,
    });
  });
}

export interface AdmitVerifiedKerrExternalOutputInput {
  readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
  readonly plan: KerrComparisonPlan;
  readonly verifiedExecutionReceipt: VerifiedKerrExternalExecutionReceipt;
  readonly admittedAt: unknown;
}

export async function admitVerifiedKerrExternalOutput(
  input: AdmitVerifiedKerrExternalOutputInput,
  recheckCurrentGrant: KerrExternalCurrentGrantAuthorizer,
): Promise<VerifiedKerrExternalOutputAdmission> {
  const verified = ownDataValue(
    input,
    "verifiedExecutionReceipt",
    "Verified Kerr output admission",
  );
  assertIssuedVerifiedKerrExternalExecutionReceipt(verified);
  const context = verifiedExecutionReceiptContexts.get(verified);
  if (context === undefined) {
    throw new Error("Verified Kerr execution receipt context is unavailable");
  }
  const referenceBundle = ownDataValue(
    input,
    "referenceBundle",
    "Verified Kerr output admission",
  );
  const plan = ownDataValue(input, "plan", "Verified Kerr output admission");
  assertVerifiedKerrComparisonReferenceBundle(referenceBundle);
  assertKerrComparisonPlanIntegrity(referenceBundle, plan);
  assertClaimedKerrExternalRunnerHandoffPlanBinding(
    context.claim,
    referenceBundle,
    plan,
  );
  // Retain a parser-owned frozen plan before the admission grant check awaits;
  // caller-owned plan data cannot drift after exact capability binding.
  const parsedPlan = deepFreezeKerr(KerrComparisonPlanSchema.parse(plan));
  const rows = admittedRows(parsedPlan, context.normalizedOutput);
  const admittedAt = CanonicalTimestampSchema.parse(
    ownDataValue(input, "admittedAt", "Verified Kerr output admission"),
  );
  if (admittedAt < verified.verifiedAt || admittedAt >= context.claim.expiresAt) {
    throw new Error("Verified Kerr output admission is outside validity");
  }
  // Burn before the final asynchronous grant check. Rejection cannot be
  // retried with a changed admission time, plan, or output envelope.
  consumedVerifiedExecutionReceipts.add(verified);
  await recheckClaimedKerrExternalRunnerHandoffCurrentGrants(
    context.claim,
    admittedAt,
    recheckCurrentGrant,
  );
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state:
      "receipt-verified-kerr-output-admitted-to-process-local-quarantine" as const,
    admittedAt,
    verificationBinding: {
      verificationId: verified.verificationId,
      verificationChecksumSha256: verified.verificationChecksum.value,
      receiptId: verified.receipt.receiptId,
      receiptChecksumSha256: verified.receipt.receiptChecksum.value,
    },
    planBinding: {
      planId: parsedPlan.planId,
      planChecksumSha256: parsedPlan.planChecksum.value,
      comparisonScope: parsedPlan.comparisonScope,
      caseCount: parsedPlan.cases.length,
      totalRays: rows.length,
    },
    outputBinding: {
      rawByteLength: verified.receipt.rawOutput.byteLength,
      rawSha256: verified.receipt.rawOutput.sha256,
      normalizedOutputId: context.normalizedOutput.normalizedOutputId,
      normalizedOutputChecksumSha256:
        context.normalizedOutput.normalizedOutputChecksum.value,
      normalizedByteLength: verified.receipt.normalizedOutput.byteLength,
      normalizedSha256: verified.receipt.normalizedOutput.sha256,
    },
    rows,
    rowCoverage:
      "exactly-one-receipt-verified-candidate-row-per-plan-ray-in-plan-order" as const,
    executionReceiptBindingVerified: true as const,
    exactRawOutputBytesVerified: true as const,
    exactNormalizedOutputBytesVerified: true as const,
    quarantineAdmissionVerified: true as const,
    comparisonReviewPreparationAllowed: true as const,
    attestationEvidenceStatus:
      "injected-verifier-asserted-not-package-authenticated" as const,
    injectedVerifierAuthorityAuthenticatedByPackage: false as const,
    quarantinePersistencePerformed: false as const,
    durableReceiptRecorded: false as const,
    realExternalExecutionEstablishedByPackage: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
  const admissionId = `krxadmit_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const admission = deepFreezeKerr(
    VerifiedKerrExternalOutputAdmissionSchema.parse({
      ...unsigned,
      admissionId,
      admissionChecksum: checksum("verified-kerr-output-quarantine-admission", {
        ...unsigned,
        admissionId,
      }),
    }),
  );
  assertCanonicalByteBudget(admission, "Verified Kerr output admission");
  issuedVerifiedOutputAdmissions.add(admission);
  verifiedOutputAdmissionContexts.set(admission, {
    rawBytes: context.rawBytes,
    normalizedBytes: context.normalizedBytes,
    normalizedOutput: context.normalizedOutput,
    verifiedExecutionReceipt: verified,
    referenceBundle,
    plan: parsedPlan,
    selectionReviewIdentityBindings:
      kerrExternalClaimedHandoffSelectionReviewIdentityBindings(context.claim),
  });
  return admission;
}

export function assertIssuedVerifiedKerrExternalOutputAdmission(
  input: unknown,
): asserts input is VerifiedKerrExternalOutputAdmission {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedVerifiedOutputAdmissions.has(input)
  ) {
    throw new Error(
      "Verified Kerr output admission must be issued in this process; structural copies are rejected",
    );
  }
}

export function assertVerifiedKerrExternalOutputAdmissionExactBytes(
  admissionInput: unknown,
  rawBytesInput: unknown,
  normalizedBytesInput: unknown,
): void {
  assertIssuedVerifiedKerrExternalOutputAdmission(admissionInput);
  const context = verifiedOutputAdmissionContexts.get(admissionInput);
  if (context === undefined) {
    throw new Error("Verified Kerr output admission byte context is unavailable");
  }
  const rawBytes = exactUint8ArrayCopy(
    rawBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES,
    "Admitted Kerr raw output",
  );
  const normalizedBytes = exactUint8ArrayCopy(
    normalizedBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES,
    "Admitted Kerr normalized output",
  );
  if (
    !exactBytesEqual(rawBytes, context.rawBytes) ||
    !exactBytesEqual(normalizedBytes, context.normalizedBytes)
  ) {
    throw new Error("Verified Kerr output admission exact bytes do not match");
  }
}

export const KERR_EXTERNAL_MAPPING_REVIEW_POLICY_VERSION = "1.0.0" as const;

const MappingReviewSubjectChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-external-mapping-review-subject"),
  })
  .strict();

export const KerrExternalMappingReviewSubjectSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("kerr-external-mapping-review-subject-awaiting-decision"),
    policyVersion: z.literal(KERR_EXTERNAL_MAPPING_REVIEW_POLICY_VERSION),
    subjectId: z.string().regex(/^krmapsubj_[a-f0-9]{24}$/),
    frozenAt: CanonicalTimestampSchema,
    executionClaimExpiresAt: CanonicalTimestampSchema,
    purpose: z.literal(
      "review-one-receipt-bound-mapping-for-comparison-preparation",
    ),
    admissionBinding: z
      .object({
        admissionId: z.string().regex(/^krxadmit_[a-f0-9]{24}$/),
        admissionChecksumSha256: Sha256Schema,
        admittedAt: CanonicalTimestampSchema,
        verificationId: z.string().regex(/^krxverify_[a-f0-9]{24}$/),
        verificationChecksumSha256: Sha256Schema,
        receiptId: z.string().regex(/^krxreceipt_[a-f0-9]{24}$/),
        receiptChecksumSha256: Sha256Schema,
      })
      .strict(),
    planBinding: z
      .object({
        planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
        planChecksumSha256: Sha256Schema,
        comparisonScope: z.enum(["integrator-only", "camera-and-solver"]),
        caseCount: z.number().int().min(1).max(8),
        totalRays: z.number().int().min(1).max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
      })
      .strict(),
    mapping: KerrComparisonMappingSchema,
    mappingCanonicalBytes: z
      .object({
        canonicalization: z.literal("kerr-stable-json-v1"),
        byteLength: z
          .number()
          .int()
          .positive()
          .max(KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_CANONICAL_BYTES),
        sha256: Sha256Schema,
      })
      .strict(),
    receiptDeclaredNormalizerSourceSha256: Sha256Schema,
    outputBinding: VerifiedKerrExternalOutputAdmissionSchema.shape.outputBinding,
    rowAssociationBinding: z
      .object({
        rowCount: z.number().int().min(1).max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
        coverage: VerifiedKerrExternalOutputAdmissionSchema.shape.rowCoverage,
        orderedAssociationSha256: Sha256Schema,
      })
      .strict(),
    receiptDeclaredRunnerIdentityBinding: z
      .object({
        runnerId: IdentifierSchema,
        runnerKeyId: IdentifierSchema,
        runnerGrantId: IdentifierSchema,
      })
      .strict(),
    priorSelectionReviewIdentityBindings:
      KerrExternalSelectionReviewIdentityBindingsSchema,
    priorSelectionReviewIdentityBindingsSha256: Sha256Schema,
    structuredReferenceIdentifiersIncluded: z.literal(false),
    structuredReferenceChecksumsIncluded: z.literal(false),
    structuredReferenceOutcomesIncluded: z.literal(false),
    structuredReferenceTolerancesIncluded: z.literal(false),
    structuredComparisonResultsIncluded: z.literal(false),
    opaqueReferenceAssociationDigestIncluded: z.literal(true),
    callerControlledMappingFreeTextIncluded: z.literal(true),
    mappingFreeTextAbsenceOfReferenceDataVerifiedByPackage: z.literal(false),
    answerBlindingVerifiedByPackage: z.literal(false),
    runnerAttestationEvidenceStatus: z.literal(
      "injected-verifier-asserted-not-package-authenticated",
    ),
    injectedRunnerVerifierAuthorityAuthenticatedByPackage: z.literal(false),
    realExternalExecutionEstablishedByPackage: z.literal(false),
    mappingReviewSubjectIsAuthority: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    subjectChecksum: MappingReviewSubjectChecksumSchema,
  })
  .strict();
export type KerrExternalMappingReviewSubject = z.infer<
  typeof KerrExternalMappingReviewSubjectSchema
>;

function exactAdmissionPlanContext(
  admissionInput: unknown,
  referenceBundleInput: unknown,
  planInput: unknown,
): {
  readonly admission: VerifiedKerrExternalOutputAdmission;
  readonly context: NonNullable<
    ReturnType<typeof verifiedOutputAdmissionContexts.get>
  >;
  readonly plan: KerrComparisonPlan;
} {
  assertIssuedVerifiedKerrExternalOutputAdmission(admissionInput);
  const context = verifiedOutputAdmissionContexts.get(admissionInput);
  if (context === undefined) {
    throw new Error("Verified Kerr output admission context is unavailable");
  }
  if (referenceBundleInput !== context.referenceBundle) {
    throw new Error(
      "Kerr comparison-review preparation requires the exact admitted reference bundle capability",
    );
  }
  assertKerrComparisonPlanIntegrity(referenceBundleInput, planInput);
  const plan = deepFreezeKerr(KerrComparisonPlanSchema.parse(planInput));
  if (
    kerrStableStringify(plan) !== kerrStableStringify(context.plan) ||
    admissionInput.planBinding.planId !== plan.planId ||
    admissionInput.planBinding.planChecksumSha256 !== plan.planChecksum.value ||
    admissionInput.planBinding.comparisonScope !== plan.comparisonScope ||
    admissionInput.planBinding.caseCount !== plan.cases.length ||
    admissionInput.planBinding.totalRays !==
      plan.cases.reduce((total, planCase) => total + planCase.rays.length, 0) ||
    admissionInput.rows.length !== context.normalizedOutput.rows.length ||
    admissionInput.outputBinding.rawSha256 !== kerrSha256Hex(context.rawBytes) ||
    admissionInput.outputBinding.normalizedSha256 !==
      kerrSha256Hex(context.normalizedBytes) ||
    admissionInput.outputBinding.normalizedOutputId !==
      context.normalizedOutput.normalizedOutputId ||
    admissionInput.outputBinding.normalizedOutputChecksumSha256 !==
      context.normalizedOutput.normalizedOutputChecksum.value
  ) {
    throw new Error(
      "Verified Kerr output admission changed its exact bundle, plan, rows, or bytes",
    );
  }
  return { admission: admissionInput, context, plan };
}

export interface CreateKerrExternalMappingReviewSubjectInput {
  readonly admission: VerifiedKerrExternalOutputAdmission;
  readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
  readonly plan: KerrComparisonPlan;
  readonly frozenAt: unknown;
}

export function createKerrExternalMappingReviewSubject(
  input: CreateKerrExternalMappingReviewSubjectInput,
): KerrExternalMappingReviewSubject {
  const admissionInput = ownDataValue(
    input,
    "admission",
    "Kerr mapping-review subject input",
  );
  const referenceBundle = ownDataValue(
    input,
    "referenceBundle",
    "Kerr mapping-review subject input",
  );
  const planInput = ownDataValue(
    input,
    "plan",
    "Kerr mapping-review subject input",
  );
  const { admission, context, plan } = exactAdmissionPlanContext(
    admissionInput,
    referenceBundle,
    planInput,
  );
  const frozenAt = CanonicalTimestampSchema.parse(
    ownDataValue(input, "frozenAt", "Kerr mapping-review subject input"),
  );
  if (
    Date.parse(frozenAt) < Date.parse(admission.admittedAt) ||
    Date.parse(frozenAt) >=
      Date.parse(context.verifiedExecutionReceipt.receipt.claimBinding.expiresAt)
  ) {
    throw new Error("Kerr mapping-review subject is outside admission validity");
  }
  const normalizerSourceSha256 =
    context.verifiedExecutionReceipt.receipt.normalizedOutput.normalizerSourceSha256;
  if (normalizerSourceSha256 !== plan.mapping.sourceSha256) {
    throw new Error(
      "Kerr mapping-review subject normalizer source does not match the frozen plan",
    );
  }
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "kerr-external-mapping-review-subject-awaiting-decision" as const,
    policyVersion: KERR_EXTERNAL_MAPPING_REVIEW_POLICY_VERSION,
    frozenAt,
    executionClaimExpiresAt:
      context.verifiedExecutionReceipt.receipt.claimBinding.expiresAt,
    purpose:
      "review-one-receipt-bound-mapping-for-comparison-preparation" as const,
    admissionBinding: {
      admissionId: admission.admissionId,
      admissionChecksumSha256: admission.admissionChecksum.value,
      admittedAt: admission.admittedAt,
      ...admission.verificationBinding,
    },
    planBinding: admission.planBinding,
    mapping: plan.mapping,
    mappingCanonicalBytes: {
      canonicalization: "kerr-stable-json-v1" as const,
      byteLength: new TextEncoder().encode(kerrStableStringify(plan.mapping))
        .byteLength,
      sha256: kerrSha256Hex(kerrStableStringify(plan.mapping)),
    },
    receiptDeclaredNormalizerSourceSha256: normalizerSourceSha256,
    outputBinding: admission.outputBinding,
    rowAssociationBinding: {
      rowCount: admission.rows.length,
      coverage: admission.rowCoverage,
      orderedAssociationSha256: kerrSha256Hex(
        kerrStableStringify(admission.rows),
      ),
    },
    receiptDeclaredRunnerIdentityBinding: {
      runnerId:
        context.verifiedExecutionReceipt.receipt.runnerAttestation.runnerId,
      runnerKeyId:
        context.verifiedExecutionReceipt.receipt.runnerAttestation.runnerKeyId,
      runnerGrantId: context.verifiedExecutionReceipt.verifierReceipt.runnerGrantId,
    },
    priorSelectionReviewIdentityBindings:
      context.selectionReviewIdentityBindings,
    priorSelectionReviewIdentityBindingsSha256: kerrSha256Hex(
      kerrStableStringify(context.selectionReviewIdentityBindings),
    ),
    structuredReferenceIdentifiersIncluded: false as const,
    structuredReferenceChecksumsIncluded: false as const,
    structuredReferenceOutcomesIncluded: false as const,
    structuredReferenceTolerancesIncluded: false as const,
    structuredComparisonResultsIncluded: false as const,
    opaqueReferenceAssociationDigestIncluded: true as const,
    callerControlledMappingFreeTextIncluded: true as const,
    mappingFreeTextAbsenceOfReferenceDataVerifiedByPackage: false as const,
    answerBlindingVerifiedByPackage: false as const,
    runnerAttestationEvidenceStatus:
      "injected-verifier-asserted-not-package-authenticated" as const,
    injectedRunnerVerifierAuthorityAuthenticatedByPackage: false as const,
    realExternalExecutionEstablishedByPackage: false as const,
    mappingReviewSubjectIsAuthority: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
  const subjectId = `krmapsubj_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const subject = deepFreezeKerr(
    KerrExternalMappingReviewSubjectSchema.parse({
      ...unsigned,
      subjectId,
      subjectChecksum: checksum("kerr-external-mapping-review-subject", {
        ...unsigned,
        subjectId,
      }),
    }),
  );
  assertCanonicalByteBudget(subject, "Kerr external mapping-review subject");
  return subject;
}

export function assertKerrExternalMappingReviewSubjectSelfIntegrity(
  subjectInput: unknown,
): asserts subjectInput is KerrExternalMappingReviewSubject {
  assertKerrComparisonPlainDataTree(
    subjectInput,
    "Kerr external mapping-review subject",
  );
  const subject = KerrExternalMappingReviewSubjectSchema.parse(subjectInput);
  if (
    kerrStableStringify(subjectInput) !== kerrStableStringify(subject)
  ) {
    throw new Error(
      "Kerr external mapping-review subject must already be canonical",
    );
  }
  const mappingBytes = new TextEncoder().encode(
    kerrStableStringify(subject.mapping),
  );
  if (
    Date.parse(subject.frozenAt) <
      Date.parse(subject.admissionBinding.admittedAt) ||
    Date.parse(subject.frozenAt) >=
      Date.parse(subject.executionClaimExpiresAt) ||
    subject.mappingCanonicalBytes.byteLength !== mappingBytes.byteLength ||
    subject.mappingCanonicalBytes.sha256 !== kerrSha256Hex(mappingBytes) ||
    subject.receiptDeclaredNormalizerSourceSha256 !==
      subject.mapping.sourceSha256 ||
    subject.priorSelectionReviewIdentityBindingsSha256 !==
      kerrSha256Hex(
        kerrStableStringify(
          subject.priorSelectionReviewIdentityBindings,
        ),
      ) ||
    subject.rowAssociationBinding.rowCount !==
      subject.planBinding.totalRays
  ) {
    throw new Error(
      "Kerr external mapping-review subject has inconsistent chronology or exact evidence bindings",
    );
  }
  const { subjectId, subjectChecksum, ...unsigned } = subject;
  const expectedSubjectId = `krmapsubj_${kerrSha256Hex(
    kerrStableStringify(unsigned),
  ).slice(0, 24)}`;
  const expectedChecksum = checksum("kerr-external-mapping-review-subject", {
    ...unsigned,
    subjectId: expectedSubjectId,
  });
  if (
    subjectId !== expectedSubjectId ||
    kerrStableStringify(subjectChecksum) !==
      kerrStableStringify(expectedChecksum)
  ) {
    throw new Error(
      "Kerr external mapping-review subject failed self-integrity replay",
    );
  }
  assertCanonicalByteBudget(subject, "Kerr external mapping-review subject");
}

export function canonicalKerrExternalMappingReviewSubjectBytes(
  subjectInput: unknown,
): Uint8Array {
  assertKerrExternalMappingReviewSubjectSelfIntegrity(subjectInput);
  const subject = KerrExternalMappingReviewSubjectSchema.parse(subjectInput);
  return new TextEncoder().encode(kerrStableStringify(subject));
}

export function kerrExternalMappingReviewSubjectSha256(
  subjectInput: unknown,
): string {
  return kerrSha256Hex(
    canonicalKerrExternalMappingReviewSubjectBytes(subjectInput),
  );
}

export function assertKerrExternalMappingReviewSubjectIntegrity(
  admissionInput: unknown,
  referenceBundleInput: unknown,
  planInput: unknown,
  subjectInput: unknown,
): asserts subjectInput is KerrExternalMappingReviewSubject {
  assertKerrComparisonPlainDataTree(
    subjectInput,
    "Kerr external mapping-review subject",
  );
  assertKerrExternalMappingReviewSubjectSelfIntegrity(subjectInput);
  const subject = KerrExternalMappingReviewSubjectSchema.parse(subjectInput);
  const expected = createKerrExternalMappingReviewSubject({
    admission: admissionInput as VerifiedKerrExternalOutputAdmission,
    referenceBundle:
      referenceBundleInput as VerifiedKerrComparisonReferenceBundle,
    plan: planInput as KerrComparisonPlan,
    frozenAt: subject.frozenAt,
  });
  if (kerrStableStringify(subject) !== kerrStableStringify(expected)) {
    throw new Error(
      "Kerr external mapping-review subject failed exact integrity replay",
    );
  }
}

export const KerrExternalMappingSemanticAssertionsSchema = z
  .object({
    deterministicFullRowTranslationReviewed: z.literal(true),
    noFilteringOmissionDuplicationOrReorderingReviewed: z.literal(true),
    noReferenceAnswerOrToleranceDependentAdjustmentReviewed: z.literal(true),
    unitsCoordinatesAndOrientationReviewed: z.literal(true),
    momentumEnergyAndAngularMomentumSemanticsReviewed: z.literal(true),
    carterQNotKSemanticsReviewed: z.literal(true),
    screenBasisAndRayDirectionReviewed: z.literal(true),
    terminationAndEventSurfaceReviewed: z.literal(true),
    azimuthWrappingAndWindingReviewed: z.literal(true),
    endpointTimeAndAffineParameterReviewed: z.literal(true),
    unresolvedAndNullOutcomeReviewed: z.literal(true),
    integratorInputPreservationReviewed: z.literal(true),
    cameraAndSolverOutputPreservationReviewed: z.literal(true),
    reviewerDeclaresNoReferenceOutcomesTolerancesOrComparisonResults:
      z.literal(true),
    normalizerSourceFrozenBeforeExecutionReviewed: z.literal(true),
    allMappingTransformationsDisclosedReviewed: z.literal(true),
  })
  .strict();
export type KerrExternalMappingSemanticAssertions = z.infer<
  typeof KerrExternalMappingSemanticAssertionsSchema
>;

const MappingReviewEvidenceBindingsSchema = z
  .object({
    normalizerSourceReviewReportSha256: Sha256Schema,
    mappingTestVectorReportSha256: Sha256Schema,
    mappingReviewerNotesSha256: Sha256Schema,
  })
  .strict();

const MappingReviewDecisionStatementChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-external-mapping-review-decision-statement"),
  })
  .strict();

export const KerrExternalMappingReviewDecisionStatementSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("kerr-external-mapping-review-decision-statement"),
    policyVersion: z.literal(KERR_EXTERNAL_MAPPING_REVIEW_POLICY_VERSION),
    statementId: z.string().regex(/^krmapstmt_[a-f0-9]{24}$/),
    subjectId: z.string().regex(/^krmapsubj_[a-f0-9]{24}$/),
    subjectChecksumSha256: Sha256Schema,
    reviewedSubjectCanonicalSha256: Sha256Schema,
    role: z.literal("mapping-semantics"),
    reviewerId: IdentifierSchema,
    roleGrantId: IdentifierSchema,
    keyId: IdentifierSchema,
    decidedAt: CanonicalTimestampSchema,
    expiresAt: CanonicalTimestampSchema,
    decision: z.literal("accepted-for-comparison-review-preparation"),
    evidenceBindings: MappingReviewEvidenceBindingsSchema,
    semanticAssertions: KerrExternalMappingSemanticAssertionsSchema,
    signedPurpose: z.literal(
      "accept-one-frozen-mapping-for-one-receipt-bound-comparison-preparation",
    ),
    statementChecksum: MappingReviewDecisionStatementChecksumSchema,
  })
  .strict();
export type KerrExternalMappingReviewDecisionStatement = z.infer<
  typeof KerrExternalMappingReviewDecisionStatementSchema
>;

export interface CreateKerrExternalMappingReviewDecisionStatementInput {
  readonly subject: KerrExternalMappingReviewSubject;
  readonly reviewerId: unknown;
  readonly roleGrantId: unknown;
  readonly keyId: unknown;
  readonly decidedAt: unknown;
  readonly expiresAt: unknown;
  readonly evidenceBindings: unknown;
  readonly semanticAssertions: unknown;
}

export function createKerrExternalMappingReviewDecisionStatement(
  input: CreateKerrExternalMappingReviewDecisionStatementInput,
): KerrExternalMappingReviewDecisionStatement {
  const subjectInput = ownDataValue(
    input,
    "subject",
    "Kerr mapping-review decision statement input",
  );
  assertKerrComparisonPlainDataTree(
    subjectInput,
    "Kerr mapping-review decision subject",
  );
  assertKerrExternalMappingReviewSubjectSelfIntegrity(subjectInput);
  const subject = KerrExternalMappingReviewSubjectSchema.parse(subjectInput);
  const decidedAt = CanonicalTimestampSchema.parse(
    ownDataValue(
      input,
      "decidedAt",
      "Kerr mapping-review decision statement input",
    ),
  );
  const expiresAt = CanonicalTimestampSchema.parse(
    ownDataValue(
      input,
      "expiresAt",
      "Kerr mapping-review decision statement input",
    ),
  );
  if (
    Date.parse(decidedAt) < Date.parse(subject.frozenAt) ||
    Date.parse(decidedAt) >= Date.parse(subject.executionClaimExpiresAt) ||
    Date.parse(expiresAt) <= Date.parse(decidedAt) ||
    Date.parse(expiresAt) > Date.parse(subject.executionClaimExpiresAt)
  ) {
    throw new Error("Kerr mapping-review decision chronology is invalid");
  }
  const evidenceInput = ownDataValue(
    input,
    "evidenceBindings",
    "Kerr mapping-review decision statement input",
  );
  const assertionsInput = ownDataValue(
    input,
    "semanticAssertions",
    "Kerr mapping-review decision statement input",
  );
  assertKerrComparisonPlainDataTree(
    evidenceInput,
    "Kerr mapping-review evidence bindings",
  );
  assertKerrComparisonPlainDataTree(
    assertionsInput,
    "Kerr mapping semantic assertions",
  );
  const evidenceBindings = MappingReviewEvidenceBindingsSchema.parse(evidenceInput);
  const semanticAssertions =
    KerrExternalMappingSemanticAssertionsSchema.parse(assertionsInput);
  const reviewerId = IdentifierSchema.parse(
    ownDataValue(
      input,
      "reviewerId",
      "Kerr mapping-review decision statement input",
    ),
  );
  const roleGrantId = IdentifierSchema.parse(
    ownDataValue(
      input,
      "roleGrantId",
      "Kerr mapping-review decision statement input",
    ),
  );
  const keyId = IdentifierSchema.parse(
    ownDataValue(
      input,
      "keyId",
      "Kerr mapping-review decision statement input",
    ),
  );
  if (
    reviewerId ===
      subject.receiptDeclaredRunnerIdentityBinding.runnerId ||
    roleGrantId ===
      subject.receiptDeclaredRunnerIdentityBinding.runnerGrantId ||
    keyId === subject.receiptDeclaredRunnerIdentityBinding.runnerKeyId
  ) {
    throw new Error(
      "Kerr mapping reviewer identity, grant, and key must be distinct from the runner",
    );
  }
  if (
    subject.priorSelectionReviewIdentityBindings.approvals.some(
      (approval) =>
        approval.reviewerId === reviewerId ||
        approval.roleGrantId === roleGrantId ||
        approval.keyId === keyId,
    )
  ) {
    throw new Error(
      "Kerr mapping reviewer identity, grant, and key must be distinct from prior selection reviewers",
    );
  }
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "kerr-external-mapping-review-decision-statement" as const,
    policyVersion: KERR_EXTERNAL_MAPPING_REVIEW_POLICY_VERSION,
    subjectId: subject.subjectId,
    subjectChecksumSha256: subject.subjectChecksum.value,
    reviewedSubjectCanonicalSha256:
      kerrExternalMappingReviewSubjectSha256(subject),
    role: "mapping-semantics" as const,
    reviewerId,
    roleGrantId,
    keyId,
    decidedAt,
    expiresAt,
    decision: "accepted-for-comparison-review-preparation" as const,
    evidenceBindings,
    semanticAssertions,
    signedPurpose:
      "accept-one-frozen-mapping-for-one-receipt-bound-comparison-preparation" as const,
  };
  const statementId = `krmapstmt_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const statement = deepFreezeKerr(
    KerrExternalMappingReviewDecisionStatementSchema.parse({
      ...unsigned,
      statementId,
      statementChecksum: checksum(
        "kerr-external-mapping-review-decision-statement",
        { ...unsigned, statementId },
      ),
    }),
  );
  assertCanonicalByteBudget(
    statement,
    "Kerr external mapping-review decision statement",
  );
  return statement;
}

export function assertKerrExternalMappingReviewDecisionStatementSelfIntegrity(
  statementInput: unknown,
): asserts statementInput is KerrExternalMappingReviewDecisionStatement {
  assertKerrComparisonPlainDataTree(
    statementInput,
    "Kerr mapping-review decision statement",
  );
  const statement = KerrExternalMappingReviewDecisionStatementSchema.parse(
    statementInput,
  );
  if (
    kerrStableStringify(statementInput) !== kerrStableStringify(statement)
  ) {
    throw new Error(
      "Kerr mapping-review decision statement must already be canonical",
    );
  }
  const { statementId, statementChecksum, ...unsigned } = statement;
  const expectedStatementId = `krmapstmt_${kerrSha256Hex(
    kerrStableStringify(unsigned),
  ).slice(0, 24)}`;
  const expectedChecksum = checksum(
    "kerr-external-mapping-review-decision-statement",
    { ...unsigned, statementId: expectedStatementId },
  );
  if (
    statementId !== expectedStatementId ||
    kerrStableStringify(statementChecksum) !==
      kerrStableStringify(expectedChecksum)
  ) {
    throw new Error(
      "Kerr mapping-review decision statement failed self-integrity replay",
    );
  }
  assertCanonicalByteBudget(
    statement,
    "Kerr external mapping-review decision statement",
  );
}

export function canonicalKerrExternalMappingReviewDecisionStatementBytes(
  statementInput: unknown,
): Uint8Array {
  assertKerrExternalMappingReviewDecisionStatementSelfIntegrity(statementInput);
  const statement = KerrExternalMappingReviewDecisionStatementSchema.parse(
    statementInput,
  );
  const bytes = new TextEncoder().encode(kerrStableStringify(statement));
  if (bytes.byteLength > KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_CANONICAL_BYTES) {
    throw new RangeError(
      "Kerr mapping-review decision statement exceeds its canonical byte budget",
    );
  }
  return bytes;
}

export function kerrExternalMappingReviewDecisionStatementSha256(
  statementInput: unknown,
): string {
  return kerrSha256Hex(
    canonicalKerrExternalMappingReviewDecisionStatementBytes(statementInput),
  );
}

const MappingReviewDecisionChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-external-mapping-review-decision"),
  })
  .strict();

export const KerrExternalMappingReviewDecisionSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "declared-signed-kerr-external-mapping-review-awaiting-injected-verification",
    ),
    decisionId: z.string().regex(/^krmapdec_[a-f0-9]{24}$/),
    statement: KerrExternalMappingReviewDecisionStatementSchema,
    signedStatementSha256: Sha256Schema,
    signatureEnvelope: SignatureEnvelopeBindingSchema,
    signatureEnvelopeDeclared: z.literal(true),
    signatureVerifiedByPackage: z.literal(false),
    mappingReviewVerified: z.literal(false),
    decisionIsAuthority: z.literal(false),
    injectedMappingVerifierAuthorityAuthenticatedByPackage: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    decisionChecksum: MappingReviewDecisionChecksumSchema,
  })
  .strict();
export type KerrExternalMappingReviewDecision = z.infer<
  typeof KerrExternalMappingReviewDecisionSchema
>;

export interface CreateKerrExternalMappingReviewDecisionInput {
  readonly statement: KerrExternalMappingReviewDecisionStatement;
  readonly signatureEnvelopeBytes: Uint8Array;
}

export function createKerrExternalMappingReviewDecision(
  input: CreateKerrExternalMappingReviewDecisionInput,
): KerrExternalMappingReviewDecision {
  const signatureEnvelopeBytes = exactUint8ArrayCopy(
    ownDataValue(
      input,
      "signatureEnvelopeBytes",
      "Kerr mapping-review decision input",
    ),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
    "Kerr mapping-review signature envelope",
  );
  const statementInput = ownDataValue(
    input,
    "statement",
    "Kerr mapping-review decision input",
  );
  assertKerrExternalMappingReviewDecisionStatementSelfIntegrity(statementInput);
  const statement = KerrExternalMappingReviewDecisionStatementSchema.parse(
    statementInput,
  );
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state:
      "declared-signed-kerr-external-mapping-review-awaiting-injected-verification" as const,
    statement,
    signedStatementSha256:
      kerrExternalMappingReviewDecisionStatementSha256(statement),
    signatureEnvelope: {
      mediaType: "application/octet-stream" as const,
      encoding: "opaque-exact-bytes" as const,
      byteLength: signatureEnvelopeBytes.byteLength,
      sha256: kerrSha256Hex(signatureEnvelopeBytes),
    },
    signatureEnvelopeDeclared: true as const,
    signatureVerifiedByPackage: false as const,
    mappingReviewVerified: false as const,
    decisionIsAuthority: false as const,
    injectedMappingVerifierAuthorityAuthenticatedByPackage: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
  const decisionId = `krmapdec_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const decision = deepFreezeKerr(
    KerrExternalMappingReviewDecisionSchema.parse({
      ...unsigned,
      decisionId,
      decisionChecksum: checksum("kerr-external-mapping-review-decision", {
        ...unsigned,
        decisionId,
      }),
    }),
  );
  assertCanonicalByteBudget(decision, "Kerr external mapping-review decision");
  return decision;
}

export function assertKerrExternalMappingReviewDecisionIntegrity(
  subjectInput: unknown,
  decisionInput: unknown,
  signatureEnvelopeBytesInput: unknown,
): asserts decisionInput is KerrExternalMappingReviewDecision {
  const signatureEnvelopeBytes = exactUint8ArrayCopy(
    signatureEnvelopeBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
    "Kerr mapping-review signature envelope",
  );
  assertKerrComparisonPlainDataTree(
    subjectInput,
    "Kerr mapping-review decision subject",
  );
  assertKerrComparisonPlainDataTree(
    decisionInput,
    "Kerr mapping-review decision",
  );
  assertKerrExternalMappingReviewSubjectSelfIntegrity(subjectInput);
  const subject = KerrExternalMappingReviewSubjectSchema.parse(subjectInput);
  const decision = KerrExternalMappingReviewDecisionSchema.parse(decisionInput);
  assertKerrExternalMappingReviewDecisionStatementSelfIntegrity(
    decision.statement,
  );
  if (
    decision.statement.subjectId !== subject.subjectId ||
    decision.statement.subjectChecksumSha256 !== subject.subjectChecksum.value ||
    decision.statement.reviewedSubjectCanonicalSha256 !==
      kerrExternalMappingReviewSubjectSha256(subject)
  ) {
    throw new Error("Kerr mapping-review decision changed its subject");
  }
  const replayedStatement = createKerrExternalMappingReviewDecisionStatement({
    subject,
    reviewerId: decision.statement.reviewerId,
    roleGrantId: decision.statement.roleGrantId,
    keyId: decision.statement.keyId,
    decidedAt: decision.statement.decidedAt,
    expiresAt: decision.statement.expiresAt,
    evidenceBindings: decision.statement.evidenceBindings,
    semanticAssertions: decision.statement.semanticAssertions,
  });
  const expected = createKerrExternalMappingReviewDecision({
    statement: replayedStatement,
    signatureEnvelopeBytes,
  });
  if (kerrStableStringify(decision) !== kerrStableStringify(expected)) {
    throw new Error(
      "Kerr external mapping-review decision failed exact integrity replay",
    );
  }
}

export const KerrExternalMappingReviewVerifierReceiptSchema = z
  .object({
    accepted: z.literal(true),
    verificationPolicyId: IdentifierSchema,
    subjectId: z.string().regex(/^krmapsubj_[a-f0-9]{24}$/),
    subjectChecksumSha256: Sha256Schema,
    subjectCanonicalSha256: Sha256Schema,
    decisionId: z.string().regex(/^krmapdec_[a-f0-9]{24}$/),
    decisionChecksumSha256: Sha256Schema,
    statementId: z.string().regex(/^krmapstmt_[a-f0-9]{24}$/),
    statementChecksumSha256: Sha256Schema,
    signedStatementSha256: Sha256Schema,
    signatureEnvelopeSha256: Sha256Schema,
    signatureEnvelopeByteLength: z
      .number()
      .int()
      .positive()
      .max(KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES),
    role: z.literal("mapping-semantics"),
    reviewerId: IdentifierSchema,
    roleGrantId: IdentifierSchema,
    reviewerKeyId: IdentifierSchema,
    checkedAt: CanonicalTimestampSchema,
    reviewerSignatureVerified: z.literal(true),
    reviewerRoleGrantValid: z.literal(true),
    reviewerKeyValid: z.literal(true),
    reviewerKeyPurposeVerified: z.literal(true),
    notRevoked: z.literal(true),
    decisionPurposeVerified: z.literal(true),
    exactSubjectBindingVerified: z.literal(true),
    exactAdmissionBindingVerified: z.literal(true),
    frozenMappingBindingVerified: z.literal(true),
    normalizerSourceDigestBindingVerified: z.literal(true),
    exactOutputBindingVerified: z.literal(true),
    orderedRowAssociationBindingVerified: z.literal(true),
    reviewEvidenceDigestBindingsAcceptedByInjectedVerifier: z.literal(true),
    signedSemanticAssertionsVerified: z.literal(true),
    reviewerAnswerBlindingPolicyVerified: z.literal(true),
    reviewerIdDistinctFromRunnerAndSelectionReviewers: z.literal(true),
    roleGrantIdDistinctFromRunnerAndSelectionReviewGrants: z.literal(true),
    reviewerKeyIdDistinctFromRunnerAndSelectionReviewKeys: z.literal(true),
    verifierAssertsReviewNotSynthetic: z.literal(true),
    verifierAssertsReviewNotCallerDeclared: z.literal(true),
  })
  .strict();
export type KerrExternalMappingReviewVerifierReceipt = z.infer<
  typeof KerrExternalMappingReviewVerifierReceiptSchema
>;

export type KerrExternalMappingReviewVerifier = (
  subject: Readonly<KerrExternalMappingReviewSubject>,
  decision: Readonly<KerrExternalMappingReviewDecision>,
  signatureEnvelopeBytes: Uint8Array,
  checkedAt: string,
) => unknown | Promise<unknown>;

function assertMappingReviewerIdentitySeparation(
  context: NonNullable<ReturnType<typeof verifiedOutputAdmissionContexts.get>>,
  decision: KerrExternalMappingReviewDecision,
): void {
  const { reviewerId, roleGrantId, keyId } = decision.statement;
  const runner = context.verifiedExecutionReceipt.receipt.runnerAttestation;
  const runnerGrantId =
    context.verifiedExecutionReceipt.verifierReceipt.runnerGrantId;
  if (
    reviewerId === runner.runnerId ||
    roleGrantId === runnerGrantId ||
    keyId === runner.runnerKeyId
  ) {
    throw new Error(
      "Kerr mapping reviewer identity, grant, and key must be distinct from the receipt-declared runner",
    );
  }
  if (
    context.selectionReviewIdentityBindings.approvals.some(
      (approval) =>
        approval.reviewerId === reviewerId ||
        approval.roleGrantId === roleGrantId ||
        approval.keyId === keyId,
    )
  ) {
    throw new Error(
      "Kerr mapping reviewer identity, grant, and key must be distinct from every prior selection reviewer",
    );
  }
}

function assertMappingReviewVerifierReceiptMatches(
  receipt: KerrExternalMappingReviewVerifierReceipt,
  subject: KerrExternalMappingReviewSubject,
  decision: KerrExternalMappingReviewDecision,
  signatureEnvelopeBytes: Uint8Array,
  checkedAt: string,
): void {
  const statement = decision.statement;
  if (
    receipt.subjectId !== subject.subjectId ||
    receipt.subjectChecksumSha256 !== subject.subjectChecksum.value ||
    receipt.subjectCanonicalSha256 !==
      kerrExternalMappingReviewSubjectSha256(subject) ||
    receipt.decisionId !== decision.decisionId ||
    receipt.decisionChecksumSha256 !== decision.decisionChecksum.value ||
    receipt.statementId !== statement.statementId ||
    receipt.statementChecksumSha256 !== statement.statementChecksum.value ||
    receipt.signedStatementSha256 !== decision.signedStatementSha256 ||
    receipt.signatureEnvelopeSha256 !==
      kerrSha256Hex(signatureEnvelopeBytes) ||
    receipt.signatureEnvelopeByteLength !== signatureEnvelopeBytes.byteLength ||
    receipt.role !== statement.role ||
    receipt.reviewerId !== statement.reviewerId ||
    receipt.roleGrantId !== statement.roleGrantId ||
    receipt.reviewerKeyId !== statement.keyId ||
    receipt.checkedAt !== checkedAt
  ) {
    throw new Error(
      "Injected Kerr mapping-review verifier receipt binding mismatch",
    );
  }
}

const PreparedCandidateRowChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("receipt-bound-kerr-comparison-review-prepared-row"),
  })
  .strict();

const PreparedCandidateRowPayloadSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "receipt-bound-kerr-external-row-prepared-for-comparison-review",
    ),
    planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
    planChecksumSha256: Sha256Schema,
    admissionId: z.string().regex(/^krxadmit_[a-f0-9]{24}$/),
    mappingReviewDecisionId: z.string().regex(/^krmapdec_[a-f0-9]{24}$/),
    caseOrdinal: z.number().int().min(0).max(7),
    rayOrdinal: z
      .number()
      .int()
      .min(0)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
    sourceBlindedRowId: z.string().regex(/^krbnrow_[a-f0-9]{24}$/),
    sourceBlindedRowChecksumSha256: Sha256Schema,
    caseId: z.string().regex(/^krcase_[a-z0-9][a-z0-9-]{2,63}$/),
    scientificRole: KerrComparisonScientificRoleSchema,
    requestId: z.string().regex(/^krreq_[a-f0-9]{24}$/),
    requestChecksum: ReferenceChecksumSchema,
    referenceReportId: z.string().regex(/^krrep_[a-f0-9]{24}$/),
    referenceReportChecksum: ReferenceChecksumSchema,
    planReferenceRayId: z.string().regex(/^krray_[a-f0-9]{24}$/),
    planReferenceRayChecksum: ReferenceChecksumSchema,
    pixelIndex: z
      .number()
      .int()
      .min(0)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
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
    mappingReviewDecisionAcceptedByInjectedBoundary: z.literal(true),
    injectedMappingVerifierAuthorityAuthenticatedByPackage: z.literal(false),
    sourceExecutionEvidenceStatus: z.literal(
      "injected-runner-verifier-asserted-not-package-authenticated",
    ),
    referenceOutcomesIncluded: z.literal(false),
    referenceTolerancesIncluded: z.literal(false),
    comparisonResultsIncluded: z.literal(false),
    comparisonExecuted: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
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
          "Resolved prepared candidate rows require one endpoint and unresolved rows require null",
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
        message:
          "Prepared candidate endpoint event surface does not match termination",
      });
    }
  });

const KerrExternalComparisonReviewPreparedRowSchema =
  PreparedCandidateRowPayloadSchema.extend({
    rowId: z.string().regex(/^krrbcrow_[a-f0-9]{24}$/),
    rowChecksum: PreparedCandidateRowChecksumSchema,
  });
type KerrExternalComparisonReviewPreparedRow = z.infer<
  typeof KerrExternalComparisonReviewPreparedRowSchema
>;

const PreparedCandidateChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("receipt-bound-kerr-comparison-review-prepared-candidate"),
  })
  .strict();

const KerrExternalComparisonReviewPreparedCandidateSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "receipt-bound-kerr-external-candidate-prepared-for-future-comparison-review",
    ),
    candidateId: z.string().regex(/^krrbccand_[a-f0-9]{24}$/),
    policyVersion: z.literal(KERR_EXTERNAL_MAPPING_REVIEW_POLICY_VERSION),
    preparedAt: CanonicalTimestampSchema,
    admissionBinding:
      KerrExternalMappingReviewSubjectSchema.shape.admissionBinding,
    planBinding: KerrExternalMappingReviewSubjectSchema.shape.planBinding,
    externalImplementation:
      KerrComparisonPlanSchema.shape.externalImplementation,
    mapping: KerrComparisonMappingSchema,
    mappingReviewBinding: z
      .object({
        subjectId: z.string().regex(/^krmapsubj_[a-f0-9]{24}$/),
        subjectChecksumSha256: Sha256Schema,
        subjectCanonicalSha256: Sha256Schema,
        decisionId: z.string().regex(/^krmapdec_[a-f0-9]{24}$/),
        decisionChecksumSha256: Sha256Schema,
        statementId: z.string().regex(/^krmapstmt_[a-f0-9]{24}$/),
        signedStatementSha256: Sha256Schema,
        reviewerId: IdentifierSchema,
        roleGrantId: IdentifierSchema,
        reviewerKeyId: IdentifierSchema,
        injectedVerificationPolicyId: IdentifierSchema,
        injectedVerifierReceiptCanonicalSha256: Sha256Schema,
      })
      .strict(),
    admittedOutputBinding:
      VerifiedKerrExternalOutputAdmissionSchema.shape.outputBinding,
    rows: z
      .array(KerrExternalComparisonReviewPreparedRowSchema)
      .min(1)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    rowCoverage: z.literal(
      "exactly-one-receipt-bound-prepared-row-per-plan-ray-in-plan-order",
    ),
    admittedNormalizedOutputBytesArePreparedCandidateBytes: z.literal(false),
    mappingReviewDecisionAcceptedByInjectedBoundary: z.literal(true),
    injectedMappingVerifierAuthorityAuthenticatedByPackage: z.literal(false),
    candidateRowAssociationReconstructedAndCheckedInProcess: z.literal(true),
    referenceOutcomesIncluded: z.literal(false),
    referenceTolerancesIncluded: z.literal(false),
    comparisonResultsIncluded: z.literal(false),
    comparisonExecuted: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    candidateChecksum: PreparedCandidateChecksumSchema,
  })
  .strict();
type KerrExternalComparisonReviewPreparedCandidate = z.infer<
  typeof KerrExternalComparisonReviewPreparedCandidateSchema
>;

function canonicalPreparedCandidateBytes(
  candidateInput: unknown,
): Uint8Array {
  assertKerrComparisonPlainDataTree(
    candidateInput,
    "Receipt-bound Kerr comparison-review prepared candidate",
  );
  const candidate =
    KerrExternalComparisonReviewPreparedCandidateSchema.parse(candidateInput);
  const bytes = new TextEncoder().encode(kerrStableStringify(candidate));
  if (
    bytes.byteLength >
    KERR_RECEIPT_BOUND_PREPARED_CANDIDATE_MAX_CANONICAL_BYTES
  ) {
    throw new RangeError(
      "Receipt-bound Kerr comparison-review prepared candidate exceeds its canonical byte budget",
    );
  }
  return bytes;
}

export const KerrExternalComparisonReviewPreparedRowBindingSchema = z
  .object({
    caseOrdinal: z.number().int().min(0).max(7),
    rayOrdinal: z
      .number()
      .int()
      .min(0)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
    preparedRowId: z.string().regex(/^krrbcrow_[a-f0-9]{24}$/),
    preparedRowChecksumSha256: Sha256Schema,
    sourceBlindedRowId: z.string().regex(/^krbnrow_[a-f0-9]{24}$/),
    sourceBlindedRowChecksumSha256: Sha256Schema,
    caseId: z.string().regex(/^krcase_[a-z0-9][a-z0-9-]{2,63}$/),
    planReferenceRayId: z.string().regex(/^krray_[a-f0-9]{24}$/),
    planReferenceRayChecksumSha256: Sha256Schema,
    pixelIndex: z
      .number()
      .int()
      .min(0)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
    pixelX: z.number().int().min(0).max(24),
    pixelY: z.number().int().min(0).max(24),
  })
  .strict();
export type KerrExternalComparisonReviewPreparedRowBinding = z.infer<
  typeof KerrExternalComparisonReviewPreparedRowBindingSchema
>;

const PreparedComparisonReviewChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("prepared-kerr-external-comparison-review-capability"),
  })
  .strict();

export const PreparedKerrExternalComparisonReviewSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "receipt-bound-kerr-output-prepared-in-process-for-comparison-review",
    ),
    preparationId: z.string().regex(/^krrprep_[a-f0-9]{24}$/),
    preparedAt: CanonicalTimestampSchema,
    admissionBinding:
      KerrExternalMappingReviewSubjectSchema.shape.admissionBinding,
    planBinding: KerrExternalMappingReviewSubjectSchema.shape.planBinding,
    mappingReviewBinding: z
      .object({
        subjectId: z.string().regex(/^krmapsubj_[a-f0-9]{24}$/),
        subjectChecksumSha256: Sha256Schema,
        subjectCanonicalSha256: Sha256Schema,
        decisionId: z.string().regex(/^krmapdec_[a-f0-9]{24}$/),
        decisionChecksumSha256: Sha256Schema,
        statementId: z.string().regex(/^krmapstmt_[a-f0-9]{24}$/),
        signedStatementSha256: Sha256Schema,
        reviewerId: IdentifierSchema,
        roleGrantId: IdentifierSchema,
        reviewerKeyId: IdentifierSchema,
        injectedVerificationPolicyId: IdentifierSchema,
        injectedVerifierReceiptCanonicalSha256: Sha256Schema,
      })
      .strict(),
    admittedOutputBinding:
      VerifiedKerrExternalOutputAdmissionSchema.shape.outputBinding,
    candidateBinding: z
      .object({
        candidateId: z.string().regex(/^krrbccand_[a-f0-9]{24}$/),
        candidateChecksumSha256: Sha256Schema,
        canonicalization: z.literal("kerr-stable-json-v1"),
        canonicalByteLength: z
          .number()
          .int()
          .positive()
          .max(
            KERR_RECEIPT_BOUND_PREPARED_CANDIDATE_MAX_CANONICAL_BYTES,
          ),
        canonicalSha256: Sha256Schema,
        rowCount: z
          .number()
          .int()
          .min(1)
          .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
      })
      .strict(),
    preparedCandidateCanonicalByteCeiling: z.literal(
      KERR_RECEIPT_BOUND_PREPARED_CANDIDATE_MAX_CANONICAL_BYTES,
    ),
    rows: z
      .array(KerrExternalComparisonReviewPreparedRowBindingSchema)
      .min(1)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    rowCoverage: z.literal(
      "exactly-one-receipt-bound-prepared-row-per-plan-ray-in-plan-order",
    ),
    mappingReviewDecisionAcceptedByInjectedBoundary: z.literal(true),
    mappingReviewEvidenceStatus: z.literal(
      "injected-mapping-verifier-asserted-not-package-authenticated",
    ),
    injectedMappingVerifierAuthorityAuthenticatedByPackage: z.literal(false),
    exactAdmissionBytesRechecked: z.literal(true),
    exactSubjectAndDecisionBindingsRechecked: z.literal(true),
    candidateRowAssociationReconstructedAndCheckedInProcess: z.literal(true),
    comparisonReviewPreparationComplete: z.literal(true),
    comparisonReviewCapabilityIssued: z.literal(true),
    comparisonExecuted: z.literal(false),
    admittedNormalizedOutputBytesArePreparedCandidateBytes: z.literal(false),
    quarantinePersistencePerformed: z.literal(false),
    durablePreparationRecorded: z.literal(false),
    realExternalExecutionEstablishedByPackage: z.literal(false),
    sourceAdmissionPreparationAttemptConsumedInProcess: z.literal(true),
    numericComparisonConsumerImplemented: z.literal(true),
    preparationCapabilityConsumedAtIssuance: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    preparationChecksum: PreparedComparisonReviewChecksumSchema,
  })
  .strict();
export type PreparedKerrExternalComparisonReview = z.infer<
  typeof PreparedKerrExternalComparisonReviewSchema
>;

const issuedPreparedKerrExternalComparisonReviews = new WeakSet<object>();
const attemptedPreparedKerrExternalNumericComparisons = new WeakSet<object>();
const preparedKerrExternalComparisonReviewContexts = new WeakMap<
  object,
  {
    readonly admission: VerifiedKerrExternalOutputAdmission;
    readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
    readonly plan: KerrComparisonPlan;
    readonly subject: KerrExternalMappingReviewSubject;
    readonly decision: KerrExternalMappingReviewDecision;
    readonly verifierReceipt: KerrExternalMappingReviewVerifierReceipt;
    readonly candidate: KerrExternalComparisonReviewPreparedCandidate;
    readonly candidateBytes: Uint8Array;
    readonly rawBytes: Uint8Array;
    readonly normalizedBytes: Uint8Array;
    readonly signatureEnvelopeBytes: Uint8Array;
  }
>();

function preparedMappingReviewBinding(
  subject: KerrExternalMappingReviewSubject,
  decision: KerrExternalMappingReviewDecision,
  verifierReceipt: KerrExternalMappingReviewVerifierReceipt,
) {
  return {
    subjectId: subject.subjectId,
    subjectChecksumSha256: subject.subjectChecksum.value,
    subjectCanonicalSha256:
      kerrExternalMappingReviewSubjectSha256(subject),
    decisionId: decision.decisionId,
    decisionChecksumSha256: decision.decisionChecksum.value,
    statementId: decision.statement.statementId,
    signedStatementSha256: decision.signedStatementSha256,
    reviewerId: decision.statement.reviewerId,
    roleGrantId: decision.statement.roleGrantId,
    reviewerKeyId: decision.statement.keyId,
    injectedVerificationPolicyId: verifierReceipt.verificationPolicyId,
    injectedVerifierReceiptCanonicalSha256: kerrSha256Hex(
      kerrStableStringify(verifierReceipt),
    ),
  } as const;
}

function buildReceiptBoundPreparedCandidate(
  admission: VerifiedKerrExternalOutputAdmission,
  context: NonNullable<ReturnType<typeof verifiedOutputAdmissionContexts.get>>,
  plan: KerrComparisonPlan,
  subject: KerrExternalMappingReviewSubject,
  decision: KerrExternalMappingReviewDecision,
  verifierReceipt: KerrExternalMappingReviewVerifierReceipt,
  preparedAt: string,
): KerrExternalComparisonReviewPreparedCandidate {
  const planRows = plan.cases.flatMap((planCase, caseOrdinal) =>
    planCase.rays.map((referenceRay, rayOrdinal) => ({
      planCase,
      referenceRay,
      caseOrdinal,
      rayOrdinal,
    })),
  );
  if (
    planRows.length !== admission.rows.length ||
    planRows.length !== context.normalizedOutput.rows.length
  ) {
    throw new Error(
      "Kerr comparison-review candidate reconstruction requires exact full-plan row coverage",
    );
  }
  const seenSourceRowIds = new Set<string>();
  const seenReferenceRayIds = new Set<string>();
  const rows = context.normalizedOutput.rows.map((sourceRow, index) => {
    const expected = planRows[index]!;
    const admitted = admission.rows[index]!;
    if (
      sourceRow.caseOrdinal !== expected.caseOrdinal ||
      sourceRow.rayOrdinal !== expected.rayOrdinal ||
      sourceRow.rowId !== admitted.candidateRowId ||
      sourceRow.rowChecksum.value !== admitted.candidateRowChecksumSha256 ||
      sourceRow.pixelIndex !== admitted.pixelIndex ||
      sourceRow.pixelX !== admitted.pixelX ||
      sourceRow.pixelY !== admitted.pixelY ||
      admitted.caseOrdinal !== expected.caseOrdinal ||
      admitted.rayOrdinal !== expected.rayOrdinal ||
      admitted.caseId !== expected.planCase.caseId ||
      admitted.scientificRole !== expected.planCase.scientificRole ||
      admitted.requestId !== expected.planCase.request.requestId ||
      kerrStableStringify(admitted.requestChecksum) !==
        kerrStableStringify(expected.planCase.request.requestChecksum) ||
      admitted.referenceReportId !== expected.planCase.report.reportId ||
      kerrStableStringify(admitted.referenceReportChecksum) !==
        kerrStableStringify(expected.planCase.report.reportChecksum) ||
      admitted.referenceRayId !== expected.referenceRay.rayId ||
      kerrStableStringify(admitted.referenceRayChecksum) !==
        kerrStableStringify(expected.referenceRay.rayChecksum) ||
      admitted.pixelIndex !== expected.referenceRay.pixelIndex ||
      admitted.pixelX !== expected.referenceRay.pixelX ||
      admitted.pixelY !== expected.referenceRay.pixelY
    ) {
      throw new Error(
        "Kerr comparison-review candidate row changed its admitted plan association",
      );
    }
    if (
      seenSourceRowIds.has(sourceRow.rowId) ||
      seenReferenceRayIds.has(expected.referenceRay.rayId)
    ) {
      throw new Error(
        "Kerr comparison-review candidate rows must not duplicate source or plan rays",
      );
    }
    seenSourceRowIds.add(sourceRow.rowId);
    seenReferenceRayIds.add(expected.referenceRay.rayId);
    const unsigned = {
      schemaVersion: "1.0.0" as const,
      state:
        "receipt-bound-kerr-external-row-prepared-for-comparison-review" as const,
      planId: plan.planId,
      planChecksumSha256: plan.planChecksum.value,
      admissionId: admission.admissionId,
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
      // Every numeric value below comes exclusively from the parser-owned,
      // receipt-bound runner output. Reference outcomes are never copied here.
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
    return deepFreezeKerr(
      KerrExternalComparisonReviewPreparedRowSchema.parse({
        ...unsigned,
        rowId,
        rowChecksum: checksum(
          "receipt-bound-kerr-comparison-review-prepared-row",
          { ...unsigned, rowId },
        ),
      }),
    );
  });
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state:
      "receipt-bound-kerr-external-candidate-prepared-for-future-comparison-review" as const,
    policyVersion: KERR_EXTERNAL_MAPPING_REVIEW_POLICY_VERSION,
    preparedAt,
    admissionBinding: subject.admissionBinding,
    planBinding: subject.planBinding,
    externalImplementation: plan.externalImplementation,
    mapping: plan.mapping,
    mappingReviewBinding: preparedMappingReviewBinding(
      subject,
      decision,
      verifierReceipt,
    ),
    admittedOutputBinding: admission.outputBinding,
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
  const candidate = deepFreezeKerr(
    KerrExternalComparisonReviewPreparedCandidateSchema.parse({
      ...unsigned,
      candidateId,
      candidateChecksum: checksum(
        "receipt-bound-kerr-comparison-review-prepared-candidate",
        { ...unsigned, candidateId },
      ),
    }),
  );
  canonicalPreparedCandidateBytes(candidate);
  return candidate;
}

export interface PrepareVerifiedKerrExternalOutputForComparisonReviewInput {
  readonly admission: VerifiedKerrExternalOutputAdmission;
  readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
  readonly plan: KerrComparisonPlan;
  readonly subject: KerrExternalMappingReviewSubject;
  readonly decision: KerrExternalMappingReviewDecision;
  readonly rawOutputBytes: Uint8Array;
  readonly normalizedOutputBytes: Uint8Array;
  readonly signatureEnvelopeBytes: Uint8Array;
  readonly preparedAt: unknown;
}

export async function prepareVerifiedKerrExternalOutputForComparisonReview(
  input: PrepareVerifiedKerrExternalOutputForComparisonReviewInput,
  verifyMappingReview: KerrExternalMappingReviewVerifier,
): Promise<PreparedKerrExternalComparisonReview> {
  // Copy caller-owned bytes before traversing any caller-owned structured
  // evidence. These detached copies are the only byte arrays retained.
  const rawBytes = exactUint8ArrayCopy(
    ownDataValue(
      input,
      "rawOutputBytes",
      "Kerr comparison-review preparation",
    ),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES,
    "Kerr comparison-review raw output",
  );
  const normalizedBytes = exactUint8ArrayCopy(
    ownDataValue(
      input,
      "normalizedOutputBytes",
      "Kerr comparison-review preparation",
    ),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES,
    "Kerr comparison-review normalized output",
  );
  const signatureEnvelopeBytes = exactUint8ArrayCopy(
    ownDataValue(
      input,
      "signatureEnvelopeBytes",
      "Kerr comparison-review preparation",
    ),
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
    "Kerr comparison-review mapping signature envelope",
  );
  rejectRecognizedArchiveContainer(rawBytes);
  const admissionInput = ownDataValue(
    input,
    "admission",
    "Kerr comparison-review preparation",
  );
  const referenceBundleInput = ownDataValue(
    input,
    "referenceBundle",
    "Kerr comparison-review preparation",
  );
  const planInput = ownDataValue(
    input,
    "plan",
    "Kerr comparison-review preparation",
  );
  const { admission, context, plan } = exactAdmissionPlanContext(
    admissionInput,
    referenceBundleInput,
    planInput,
  );
  if (attemptedVerifiedOutputAdmissionsForComparisonReview.has(admission)) {
    throw new Error(
      "Verified Kerr output admission already attempted comparison-review preparation",
    );
  }
  if (
    !exactBytesEqual(rawBytes, context.rawBytes) ||
    !exactBytesEqual(normalizedBytes, context.normalizedBytes)
  ) {
    throw new Error(
      "Kerr comparison-review preparation bytes do not match the admitted receipt",
    );
  }
  const subjectInput = ownDataValue(
    input,
    "subject",
    "Kerr comparison-review preparation",
  );
  assertKerrExternalMappingReviewSubjectIntegrity(
    admission,
    referenceBundleInput,
    plan,
    subjectInput,
  );
  const subject = deepFreezeKerr(
    KerrExternalMappingReviewSubjectSchema.parse(subjectInput),
  );
  const decisionInput = ownDataValue(
    input,
    "decision",
    "Kerr comparison-review preparation",
  );
  assertKerrExternalMappingReviewDecisionIntegrity(
    subject,
    decisionInput,
    signatureEnvelopeBytes,
  );
  const decision = deepFreezeKerr(
    KerrExternalMappingReviewDecisionSchema.parse(decisionInput),
  );
  const preparedAt = CanonicalTimestampSchema.parse(
    ownDataValue(
      input,
      "preparedAt",
      "Kerr comparison-review preparation",
    ),
  );
  if (
    Date.parse(preparedAt) < Date.parse(decision.statement.decidedAt) ||
    Date.parse(preparedAt) >= Date.parse(decision.statement.expiresAt) ||
    Date.parse(preparedAt) >= Date.parse(subject.executionClaimExpiresAt)
  ) {
    throw new Error(
      "Kerr comparison-review preparation is outside mapping-review validity",
    );
  }
  assertMappingReviewerIdentitySeparation(context, decision);
  if (typeof verifyMappingReview !== "function") {
    throw new TypeError("Kerr mapping-review verifier must be a function");
  }
  // Burn immediately before the first asynchronous trust-boundary call.
  // Rejection, exception, or a mismatched verifier receipt cannot be retried.
  attemptedVerifiedOutputAdmissionsForComparisonReview.add(admission);
  const verifierReceiptInput = await verifyMappingReview(
    subject,
    decision,
    new Uint8Array(signatureEnvelopeBytes),
    preparedAt,
  );
  assertKerrComparisonPlainDataTree(
    verifierReceiptInput,
    "Injected Kerr mapping-review verifier receipt",
  );
  const verifierReceipt = deepFreezeKerr(
    KerrExternalMappingReviewVerifierReceiptSchema.parse(verifierReceiptInput),
  );
  assertMappingReviewVerifierReceiptMatches(
    verifierReceipt,
    subject,
    decision,
    signatureEnvelopeBytes,
    preparedAt,
  );
  // Recompute separation from private process-owned authorization context;
  // verifier booleans are never the sole authority for this invariant.
  assertMappingReviewerIdentitySeparation(context, decision);
  const candidate = buildReceiptBoundPreparedCandidate(
    admission,
    context,
    plan,
    subject,
    decision,
    verifierReceipt,
    preparedAt,
  );
  const candidateBytes = canonicalPreparedCandidateBytes(candidate);
  const mappingReviewBinding = preparedMappingReviewBinding(
    subject,
    decision,
    verifierReceipt,
  );
  const rows = candidate.rows.map((row) =>
    KerrExternalComparisonReviewPreparedRowBindingSchema.parse({
      caseOrdinal: row.caseOrdinal,
      rayOrdinal: row.rayOrdinal,
      preparedRowId: row.rowId,
      preparedRowChecksumSha256: row.rowChecksum.value,
      sourceBlindedRowId: row.sourceBlindedRowId,
      sourceBlindedRowChecksumSha256:
        row.sourceBlindedRowChecksumSha256,
      caseId: row.caseId,
      planReferenceRayId: row.planReferenceRayId,
      planReferenceRayChecksumSha256:
        row.planReferenceRayChecksum.value,
      pixelIndex: row.pixelIndex,
      pixelX: row.pixelX,
      pixelY: row.pixelY,
    }),
  );
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state:
      "receipt-bound-kerr-output-prepared-in-process-for-comparison-review" as const,
    preparedAt,
    admissionBinding: subject.admissionBinding,
    planBinding: subject.planBinding,
    mappingReviewBinding,
    admittedOutputBinding: admission.outputBinding,
    candidateBinding: {
      candidateId: candidate.candidateId,
      candidateChecksumSha256: candidate.candidateChecksum.value,
      canonicalization: "kerr-stable-json-v1" as const,
      canonicalByteLength: candidateBytes.byteLength,
      canonicalSha256: kerrSha256Hex(candidateBytes),
      rowCount: candidate.rows.length,
    },
    preparedCandidateCanonicalByteCeiling:
      KERR_RECEIPT_BOUND_PREPARED_CANDIDATE_MAX_CANONICAL_BYTES,
    rows,
    rowCoverage:
      "exactly-one-receipt-bound-prepared-row-per-plan-ray-in-plan-order" as const,
    mappingReviewDecisionAcceptedByInjectedBoundary: true as const,
    mappingReviewEvidenceStatus:
      "injected-mapping-verifier-asserted-not-package-authenticated" as const,
    injectedMappingVerifierAuthorityAuthenticatedByPackage: false as const,
    exactAdmissionBytesRechecked: true as const,
    exactSubjectAndDecisionBindingsRechecked: true as const,
    candidateRowAssociationReconstructedAndCheckedInProcess: true as const,
    comparisonReviewPreparationComplete: true as const,
    comparisonReviewCapabilityIssued: true as const,
    comparisonExecuted: false as const,
    admittedNormalizedOutputBytesArePreparedCandidateBytes: false as const,
    quarantinePersistencePerformed: false as const,
    durablePreparationRecorded: false as const,
    realExternalExecutionEstablishedByPackage: false as const,
    sourceAdmissionPreparationAttemptConsumedInProcess: true as const,
    numericComparisonConsumerImplemented: true as const,
    preparationCapabilityConsumedAtIssuance: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
  const preparationId = `krrprep_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const preparation = deepFreezeKerr(
    PreparedKerrExternalComparisonReviewSchema.parse({
      ...unsigned,
      preparationId,
      preparationChecksum: checksum(
        "prepared-kerr-external-comparison-review-capability",
        { ...unsigned, preparationId },
      ),
    }),
  );
  assertCanonicalByteBudget(
    preparation,
    "Prepared Kerr external comparison-review capability",
  );
  issuedPreparedKerrExternalComparisonReviews.add(preparation);
  preparedKerrExternalComparisonReviewContexts.set(preparation, {
    admission,
    referenceBundle: context.referenceBundle,
    plan,
    subject,
    decision,
    verifierReceipt,
    candidate,
    candidateBytes,
    rawBytes,
    normalizedBytes,
    signatureEnvelopeBytes,
  });
  return preparation;
}

export function assertIssuedPreparedKerrExternalComparisonReview(
  input: unknown,
): asserts input is PreparedKerrExternalComparisonReview {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedPreparedKerrExternalComparisonReviews.has(input)
  ) {
    throw new Error(
      "Prepared Kerr external comparison review must be issued in this process; structural copies are rejected",
    );
  }
}

export function assertPreparedKerrExternalComparisonReviewExactBytes(
  preparationInput: unknown,
  rawOutputBytesInput: unknown,
  normalizedOutputBytesInput: unknown,
  signatureEnvelopeBytesInput: unknown,
): void {
  assertIssuedPreparedKerrExternalComparisonReview(preparationInput);
  const context =
    preparedKerrExternalComparisonReviewContexts.get(preparationInput);
  if (context === undefined) {
    throw new Error(
      "Prepared Kerr external comparison-review byte context is unavailable",
    );
  }
  const rawBytes = exactUint8ArrayCopy(
    rawOutputBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_RAW_BYTES,
    "Prepared Kerr comparison-review raw output",
  );
  const normalizedBytes = exactUint8ArrayCopy(
    normalizedOutputBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_NORMALIZED_BYTES,
    "Prepared Kerr comparison-review normalized output",
  );
  const signatureEnvelopeBytes = exactUint8ArrayCopy(
    signatureEnvelopeBytesInput,
    KERR_EXTERNAL_EXECUTION_RECEIPT_MAX_SIGNATURE_ENVELOPE_BYTES,
    "Prepared Kerr comparison-review mapping signature envelope",
  );
  if (
    !exactBytesEqual(rawBytes, context.rawBytes) ||
    !exactBytesEqual(normalizedBytes, context.normalizedBytes) ||
    !exactBytesEqual(signatureEnvelopeBytes, context.signatureEnvelopeBytes)
  ) {
    throw new Error(
      "Prepared Kerr external comparison-review exact bytes do not match",
    );
  }
}

function assertReceiptBoundPreparedCandidateSelfIntegrity(
  candidateInput: unknown,
): asserts candidateInput is KerrExternalComparisonReviewPreparedCandidate {
  assertKerrComparisonPlainDataTree(
    candidateInput,
    "Receipt-bound Kerr comparison-review prepared candidate",
  );
  const candidate =
    KerrExternalComparisonReviewPreparedCandidateSchema.parse(candidateInput);
  if (
    kerrStableStringify(candidateInput) !== kerrStableStringify(candidate)
  ) {
    throw new Error(
      "Receipt-bound Kerr comparison-review prepared candidate must already be canonical",
    );
  }
  for (const row of candidate.rows) {
    const { rowId, rowChecksum, ...rowPayload } = row;
    const expectedRowId = `krrbcrow_${kerrSha256Hex(
      kerrStableStringify(rowPayload),
    ).slice(0, 24)}`;
    const expectedRowChecksum = checksum(
      "receipt-bound-kerr-comparison-review-prepared-row",
      { ...rowPayload, rowId: expectedRowId },
    );
    if (
      rowId !== expectedRowId ||
      kerrStableStringify(rowChecksum) !==
        kerrStableStringify(expectedRowChecksum)
    ) {
      throw new Error(
        "Receipt-bound Kerr comparison-review prepared row failed self-integrity replay",
      );
    }
  }
  const { candidateId, candidateChecksum, ...unsigned } = candidate;
  const expectedCandidateId = `krrbccand_${kerrSha256Hex(
    kerrStableStringify(unsigned),
  ).slice(0, 24)}`;
  const expectedCandidateChecksum = checksum(
    "receipt-bound-kerr-comparison-review-prepared-candidate",
    { ...unsigned, candidateId: expectedCandidateId },
  );
  if (
    candidateId !== expectedCandidateId ||
    kerrStableStringify(candidateChecksum) !==
      kerrStableStringify(expectedCandidateChecksum)
  ) {
    throw new Error(
      "Receipt-bound Kerr comparison-review prepared candidate failed self-integrity replay",
    );
  }
  canonicalPreparedCandidateBytes(candidate);
}

export function assertPreparedKerrExternalComparisonReviewIntegrity(
  preparationInput: unknown,
): asserts preparationInput is PreparedKerrExternalComparisonReview {
  assertIssuedPreparedKerrExternalComparisonReview(preparationInput);
  const context =
    preparedKerrExternalComparisonReviewContexts.get(preparationInput);
  if (context === undefined) {
    throw new Error(
      "Prepared Kerr external comparison-review context is unavailable",
    );
  }
  assertKerrComparisonPlainDataTree(
    preparationInput,
    "Prepared Kerr external comparison-review capability",
  );
  const preparation =
    PreparedKerrExternalComparisonReviewSchema.parse(preparationInput);
  if (
    kerrStableStringify(preparationInput) !==
    kerrStableStringify(preparation)
  ) {
    throw new Error(
      "Prepared Kerr external comparison-review capability must already be canonical",
    );
  }
  const { preparationId, preparationChecksum, ...unsigned } = preparation;
  const expectedPreparationId = `krrprep_${kerrSha256Hex(
    kerrStableStringify(unsigned),
  ).slice(0, 24)}`;
  const expectedPreparationChecksum = checksum(
    "prepared-kerr-external-comparison-review-capability",
    { ...unsigned, preparationId: expectedPreparationId },
  );
  if (
    preparationId !== expectedPreparationId ||
    kerrStableStringify(preparationChecksum) !==
      kerrStableStringify(expectedPreparationChecksum)
  ) {
    throw new Error(
      "Prepared Kerr external comparison-review capability failed self-integrity replay",
    );
  }
  const exact = exactAdmissionPlanContext(
    context.admission,
    context.referenceBundle,
    context.plan,
  );
  assertKerrExternalMappingReviewSubjectIntegrity(
    context.admission,
    context.referenceBundle,
    context.plan,
    context.subject,
  );
  assertKerrExternalMappingReviewDecisionIntegrity(
    context.subject,
    context.decision,
    context.signatureEnvelopeBytes,
  );
  assertMappingReviewVerifierReceiptMatches(
    context.verifierReceipt,
    context.subject,
    context.decision,
    context.signatureEnvelopeBytes,
    preparation.preparedAt,
  );
  assertMappingReviewerIdentitySeparation(exact.context, context.decision);
  assertReceiptBoundPreparedCandidateSelfIntegrity(context.candidate);
  const candidateBytes = canonicalPreparedCandidateBytes(context.candidate);
  const expectedRows = context.candidate.rows.map((row) => ({
    caseOrdinal: row.caseOrdinal,
    rayOrdinal: row.rayOrdinal,
    preparedRowId: row.rowId,
    preparedRowChecksumSha256: row.rowChecksum.value,
    sourceBlindedRowId: row.sourceBlindedRowId,
    sourceBlindedRowChecksumSha256: row.sourceBlindedRowChecksumSha256,
    caseId: row.caseId,
    planReferenceRayId: row.planReferenceRayId,
    planReferenceRayChecksumSha256: row.planReferenceRayChecksum.value,
    pixelIndex: row.pixelIndex,
    pixelX: row.pixelX,
    pixelY: row.pixelY,
  }));
  const expectedCandidateBinding = {
    candidateId: context.candidate.candidateId,
    candidateChecksumSha256: context.candidate.candidateChecksum.value,
    canonicalization: "kerr-stable-json-v1" as const,
    canonicalByteLength: candidateBytes.byteLength,
    canonicalSha256: kerrSha256Hex(candidateBytes),
    rowCount: context.candidate.rows.length,
  };
  if (
    Date.parse(preparation.preparedAt) <
      Date.parse(context.decision.statement.decidedAt) ||
    Date.parse(preparation.preparedAt) >=
      Date.parse(context.decision.statement.expiresAt) ||
    Date.parse(preparation.preparedAt) >=
      Date.parse(context.subject.executionClaimExpiresAt) ||
    !exactBytesEqual(context.rawBytes, exact.context.rawBytes) ||
    !exactBytesEqual(
      context.normalizedBytes,
      exact.context.normalizedBytes,
    ) ||
    !exactBytesEqual(candidateBytes, context.candidateBytes) ||
    kerrStableStringify(preparation.admissionBinding) !==
      kerrStableStringify(context.subject.admissionBinding) ||
    kerrStableStringify(preparation.planBinding) !==
      kerrStableStringify(context.subject.planBinding) ||
    kerrStableStringify(preparation.mappingReviewBinding) !==
      kerrStableStringify(
        preparedMappingReviewBinding(
          context.subject,
          context.decision,
          context.verifierReceipt,
        ),
      ) ||
    kerrStableStringify(preparation.admittedOutputBinding) !==
      kerrStableStringify(context.admission.outputBinding) ||
    kerrStableStringify(preparation.candidateBinding) !==
      kerrStableStringify(expectedCandidateBinding) ||
    kerrStableStringify(preparation.rows) !==
      kerrStableStringify(expectedRows) ||
    context.candidate.preparedAt !== preparation.preparedAt ||
    kerrStableStringify(context.candidate.admissionBinding) !==
      kerrStableStringify(preparation.admissionBinding) ||
    kerrStableStringify(context.candidate.planBinding) !==
      kerrStableStringify(preparation.planBinding) ||
    kerrStableStringify(context.candidate.mappingReviewBinding) !==
      kerrStableStringify(preparation.mappingReviewBinding) ||
    kerrStableStringify(context.candidate.admittedOutputBinding) !==
      kerrStableStringify(preparation.admittedOutputBinding) ||
    kerrStableStringify(context.candidate.externalImplementation) !==
      kerrStableStringify(context.plan.externalImplementation) ||
    kerrStableStringify(context.candidate.mapping) !==
      kerrStableStringify(context.plan.mapping)
  ) {
    throw new Error(
      "Prepared Kerr external comparison-review capability changed its private candidate, plan, review, or evidence binding",
    );
  }
  assertCanonicalByteBudget(
    preparation,
    "Prepared Kerr external comparison-review capability",
  );
}

const ReceiptBoundKerrComparisonNonnegativeSchema = z
  .number()
  .finite()
  .nonnegative()
  .max(2e12);

export const ReceiptBoundKerrExternalNumericComparisonReasonSchema = z.enum([
  "camera-screen-coordinate-delta-not-adjudicated",
  "seed-normalized-momentum-mismatch",
  "seed-xi-mismatch",
  "seed-eta-mismatch",
  "reference-unresolved",
  "candidate-unresolved",
  "resolved-termination-mismatch",
  "phi-winding-mismatch",
  "event-surface-mismatch",
  "event-radius-mismatch",
  "endpoint-direction-mismatch",
  "endpoint-normalized-momentum-mismatch",
]);

export const ReceiptBoundKerrExternalNumericComparisonDispositionSchema =
  z.enum([
    "within-tolerance",
    "disagreed",
    "inconclusive",
    "incompatible-conventions",
  ]);

const ReceiptBoundKerrNumericScreenComparisonSchema = z
  .object({
    referenceScreenX: z.number().finite().min(-32).max(32),
    referenceScreenY: z.number().finite().min(-32).max(32),
    candidateScreenX: z.number().finite().min(-32).max(32),
    candidateScreenY: z.number().finite().min(-32).max(32),
    screenXAbsoluteDelta:
      ReceiptBoundKerrComparisonNonnegativeSchema.max(64),
    screenYAbsoluteDelta:
      ReceiptBoundKerrComparisonNonnegativeSchema.max(64),
    matchesExactly: z.boolean(),
    tolerancePolicy: z.enum([
      "exact-integrator-input",
      "no-pre-registered-camera-screen-tolerance",
    ]),
  })
  .strict();

const ReceiptBoundKerrNumericSeedComparisonSchema = z
  .object({
    maxMomentumOverEnergyAbsoluteDelta:
      ReceiptBoundKerrComparisonNonnegativeSchema,
    xiAbsoluteDelta: ReceiptBoundKerrComparisonNonnegativeSchema,
    etaAbsoluteDelta: ReceiptBoundKerrComparisonNonnegativeSchema,
    etaAllowedDelta: ReceiptBoundKerrComparisonNonnegativeSchema,
    momentumWithinTolerance: z.boolean(),
    xiWithinTolerance: z.boolean(),
    etaWithinTolerance: z.boolean(),
  })
  .strict();

const ReceiptBoundKerrNumericEndpointComparisonSchema = z
  .object({
    referenceEventSurface: z.enum([
      "horizon-guard",
      "finite-escape-domain",
    ]),
    candidateEventSurface: z.enum([
      "horizon-guard",
      "finite-escape-domain",
    ]),
    eventSurfaceMatches: z.boolean(),
    sphereChord: ReceiptBoundKerrComparisonNonnegativeSchema.max(2),
    eventRadiusAbsoluteDeltaRg:
      ReceiptBoundKerrComparisonNonnegativeSchema,
    phiWindingDelta: z.number().int().safe(),
    maxMomentumOverEnergyAbsoluteDelta:
      ReceiptBoundKerrComparisonNonnegativeSchema,
    maxMomentumOverEnergyAllowedDelta:
      ReceiptBoundKerrComparisonNonnegativeSchema,
    directionWithinTolerance: z.boolean(),
    eventRadiusWithinTolerance: z.boolean(),
    phiWindingMatches: z.boolean(),
    momentumWithinTolerance: z.boolean(),
    coordinateTimeAbsoluteDelta:
      ReceiptBoundKerrComparisonNonnegativeSchema,
    energyTimesAffineParameterAbsoluteDelta:
      ReceiptBoundKerrComparisonNonnegativeSchema,
  })
  .strict();

const ReceiptBoundKerrCandidateNumericsSchema = z
  .object({
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
  })
  .strict()
  .superRefine((candidate, context) => {
    const resolved =
      candidate.termination === "captured-horizon-guard" ||
      candidate.termination === "escaped-domain";
    if (resolved !== (candidate.endpoint !== null)) {
      context.addIssue({
        code: "custom",
        path: ["endpoint"],
        message:
          "Resolved compared candidate numerics require one endpoint and unresolved numerics require null",
      });
    }
    if (
      candidate.endpoint !== null &&
      ((candidate.termination === "captured-horizon-guard" &&
        candidate.endpoint.eventSurface !== "horizon-guard") ||
        (candidate.termination === "escaped-domain" &&
          candidate.endpoint.eventSurface !== "finite-escape-domain"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["endpoint", "eventSurface"],
        message:
          "Compared candidate endpoint event surface does not match termination",
      });
    }
  });

const ReceiptBoundKerrNumericComparisonRowChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal(
      "receipt-bound-kerr-external-numeric-comparison-row",
    ),
  })
  .strict();

function orderedReceiptBoundKerrComparisonReasons(
  reasons: ReadonlySet<KerrNumericComparisonReason>,
): KerrNumericComparisonReason[] {
  return KERR_NUMERIC_COMPARISON_REASON_ORDER.filter((reason) =>
    reasons.has(reason),
  );
}

export const ReceiptBoundKerrExternalNumericComparisonRowSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "receipt-bound-kerr-external-row-numerically-compared-needs-scientific-review",
    ),
    rowId: z.string().regex(/^krrbcmprow_[a-f0-9]{24}$/),
    comparisonId: z.string().regex(/^krrbcmp_[a-f0-9]{24}$/),
    preparationId: z.string().regex(/^krrprep_[a-f0-9]{24}$/),
    preparationChecksumSha256: Sha256Schema,
    planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
    planChecksumSha256: Sha256Schema,
    candidateId: z.string().regex(/^krrbccand_[a-f0-9]{24}$/),
    candidateChecksumSha256: Sha256Schema,
    admissionId: z.string().regex(/^krxadmit_[a-f0-9]{24}$/),
    mappingReviewDecisionId: z.string().regex(/^krmapdec_[a-f0-9]{24}$/),
    caseOrdinal: z.number().int().min(0).max(7),
    rayOrdinal: z
      .number()
      .int()
      .min(0)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
    preparedRowId: z.string().regex(/^krrbcrow_[a-f0-9]{24}$/),
    preparedRowChecksumSha256: Sha256Schema,
    sourceBlindedRowId: z.string().regex(/^krbnrow_[a-f0-9]{24}$/),
    sourceBlindedRowChecksumSha256: Sha256Schema,
    caseId: z.string().regex(/^krcase_[a-z0-9][a-z0-9-]{2,63}$/),
    scientificRole: KerrComparisonScientificRoleSchema,
    requestId: z.string().regex(/^krreq_[a-f0-9]{24}$/),
    requestChecksum: ReferenceChecksumSchema,
    referenceReportId: z.string().regex(/^krrep_[a-f0-9]{24}$/),
    referenceReportChecksum: ReferenceChecksumSchema,
    planReferenceRayId: z.string().regex(/^krray_[a-f0-9]{24}$/),
    planReferenceRayChecksum: ReferenceChecksumSchema,
    pixelIndex: z
      .number()
      .int()
      .min(0)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
    pixelX: z.number().int().min(0).max(24),
    pixelY: z.number().int().min(0).max(24),
    comparisonScope: z.enum(["integrator-only", "camera-and-solver"]),
    candidateNumerics: ReceiptBoundKerrCandidateNumericsSchema,
    screenComparison: ReceiptBoundKerrNumericScreenComparisonSchema,
    referenceTermination: z.enum([
      "captured-horizon-guard",
      "escaped-domain",
    ]),
    candidateTermination: CandidateTerminationSchema,
    seedComparison: ReceiptBoundKerrNumericSeedComparisonSchema,
    endpointComparison:
      ReceiptBoundKerrNumericEndpointComparisonSchema.nullable(),
    disposition:
      ReceiptBoundKerrExternalNumericComparisonDispositionSchema,
    reasons: z
      .array(ReceiptBoundKerrExternalNumericComparisonReasonSchema)
      .max(KERR_NUMERIC_COMPARISON_REASON_ORDER.length),
    comparisonExecuted: z.literal(true),
    numericComparisonExecuted: z.literal(true),
    candidateNumericsPreservedFromPrivatePreparedCapability:
      z.literal(true),
    referenceOutcomeValuesCopiedIntoCandidateNumericsByPackage:
      z.literal(false),
    provisionalToleranceAgreementIsValidation: z.literal(false),
    independentReference: z.literal("not-run"),
    ...noAuthorityShape,
    rowChecksum: ReceiptBoundKerrNumericComparisonRowChecksumSchema,
  })
  .strict()
  .superRefine((row, context) => {
    const reasons = row.reasons as KerrNumericComparisonReason[];
    if (
      new Set(reasons).size !== reasons.length ||
      kerrStableStringify(reasons) !==
        kerrStableStringify(
          orderedReceiptBoundKerrComparisonReasons(new Set(reasons)),
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: "Receipt-bound Kerr comparison reasons are not canonical",
      });
    }
    const expectedScreenXDelta = Math.abs(
      row.screenComparison.referenceScreenX -
        row.screenComparison.candidateScreenX,
    );
    const expectedScreenYDelta = Math.abs(
      row.screenComparison.referenceScreenY -
        row.screenComparison.candidateScreenY,
    );
    const screenMatches =
      expectedScreenXDelta === 0 && expectedScreenYDelta === 0;
    if (
      row.candidateNumerics.screenX !==
        row.screenComparison.candidateScreenX ||
      row.candidateNumerics.screenY !==
        row.screenComparison.candidateScreenY ||
      row.screenComparison.screenXAbsoluteDelta !== expectedScreenXDelta ||
      row.screenComparison.screenYAbsoluteDelta !== expectedScreenYDelta ||
      row.screenComparison.matchesExactly !== screenMatches ||
      row.screenComparison.tolerancePolicy !==
        (row.comparisonScope === "integrator-only"
          ? "exact-integrator-input"
          : "no-pre-registered-camera-screen-tolerance") ||
      (row.comparisonScope === "integrator-only" && !screenMatches)
    ) {
      context.addIssue({
        code: "custom",
        path: ["screenComparison"],
        message: "Receipt-bound Kerr screen comparison is inconsistent",
      });
    }
    const seedCompatible =
      row.seedComparison.momentumWithinTolerance &&
      row.seedComparison.xiWithinTolerance &&
      row.seedComparison.etaWithinTolerance;
    if (
      row.seedComparison.momentumWithinTolerance !==
        (row.seedComparison.maxMomentumOverEnergyAbsoluteDelta <=
          KERR_COMPARISON_PROVISIONAL_TOLERANCES
            .initialMomentumOverEnergyMaxAbsolute) ||
      row.seedComparison.xiWithinTolerance !==
        (row.seedComparison.xiAbsoluteDelta <=
          KERR_COMPARISON_PROVISIONAL_TOLERANCES.xiMaxAbsolute) ||
      row.seedComparison.etaWithinTolerance !==
        (row.seedComparison.etaAbsoluteDelta <=
          row.seedComparison.etaAllowedDelta)
    ) {
      context.addIssue({
        code: "custom",
        path: ["seedComparison"],
        message: "Receipt-bound Kerr seed flags are inconsistent",
      });
    }
    const expectedReasons = new Set<KerrNumericComparisonReason>();
    if (!screenMatches) {
      expectedReasons.add(
        "camera-screen-coordinate-delta-not-adjudicated",
      );
    }
    if (!row.seedComparison.momentumWithinTolerance) {
      expectedReasons.add("seed-normalized-momentum-mismatch");
    }
    if (!row.seedComparison.xiWithinTolerance) {
      expectedReasons.add("seed-xi-mismatch");
    }
    if (!row.seedComparison.etaWithinTolerance) {
      expectedReasons.add("seed-eta-mismatch");
    }
    const candidateResolved =
      row.candidateTermination === "captured-horizon-guard" ||
      row.candidateTermination === "escaped-domain";
    let expectedDisposition:
      | "within-tolerance"
      | "disagreed"
      | "inconclusive"
      | "incompatible-conventions";
    if (!seedCompatible) {
      expectedDisposition = "incompatible-conventions";
    } else if (!candidateResolved) {
      expectedReasons.add("candidate-unresolved");
      expectedDisposition = "inconclusive";
    } else if (row.candidateTermination !== row.referenceTermination) {
      expectedReasons.add("resolved-termination-mismatch");
      expectedDisposition = "disagreed";
    } else if (row.endpointComparison === null) {
      expectedDisposition = "disagreed";
    } else {
      if (!row.endpointComparison.phiWindingMatches) {
        expectedReasons.add("phi-winding-mismatch");
      }
      if (!row.endpointComparison.eventSurfaceMatches) {
        expectedReasons.add("event-surface-mismatch");
      }
      if (!row.endpointComparison.eventRadiusWithinTolerance) {
        expectedReasons.add("event-radius-mismatch");
      }
      if (!row.endpointComparison.directionWithinTolerance) {
        expectedReasons.add("endpoint-direction-mismatch");
      }
      if (!row.endpointComparison.momentumWithinTolerance) {
        expectedReasons.add("endpoint-normalized-momentum-mismatch");
      }
      const endpointWithinTolerance =
        row.endpointComparison.phiWindingMatches &&
        row.endpointComparison.eventSurfaceMatches &&
        row.endpointComparison.eventRadiusWithinTolerance &&
        row.endpointComparison.directionWithinTolerance &&
        row.endpointComparison.momentumWithinTolerance;
      expectedDisposition = endpointWithinTolerance
        ? "within-tolerance"
        : "disagreed";
    }
    if (!screenMatches && expectedDisposition === "within-tolerance") {
      expectedDisposition = "inconclusive";
    }
    const endpointExpected =
      seedCompatible &&
      candidateResolved &&
      row.candidateTermination === row.referenceTermination;
    if (
      row.candidateTermination !== row.candidateNumerics.termination ||
      endpointExpected !== (row.endpointComparison !== null) ||
      row.disposition !== expectedDisposition ||
      kerrStableStringify(reasons) !==
        kerrStableStringify(
          orderedReceiptBoundKerrComparisonReasons(expectedReasons),
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["disposition"],
        message:
          "Receipt-bound Kerr disposition, reasons, or endpoint presence is inconsistent",
      });
    }
    if (row.endpointComparison !== null) {
      const endpoint = row.endpointComparison;
      if (
        endpoint.eventSurfaceMatches !==
          (endpoint.referenceEventSurface ===
            endpoint.candidateEventSurface) ||
        endpoint.directionWithinTolerance !==
          (endpoint.sphereChord <=
            KERR_COMPARISON_PROVISIONAL_TOLERANCES
              .endpointSphereChordMaxAbsolute) ||
        endpoint.eventRadiusWithinTolerance !==
          (endpoint.eventRadiusAbsoluteDeltaRg <=
            KERR_COMPARISON_PROVISIONAL_TOLERANCES
              .eventRadiusMaxAbsoluteRg) ||
        endpoint.phiWindingMatches !== (endpoint.phiWindingDelta === 0)
      ) {
        context.addIssue({
          code: "custom",
          path: ["endpointComparison"],
          message: "Receipt-bound Kerr endpoint flags are inconsistent",
        });
      }
    }
  });

export type ReceiptBoundKerrExternalNumericComparisonRow = z.infer<
  typeof ReceiptBoundKerrExternalNumericComparisonRowSchema
>;

const ReceiptBoundKerrNumericComparisonChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("receipt-bound-kerr-external-numeric-comparison"),
  })
  .strict();

const ReceiptBoundKerrDispositionCountsSchema = z
  .object({
    withinTolerance: z
      .number()
      .int()
      .nonnegative()
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    disagreed: z
      .number()
      .int()
      .nonnegative()
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    inconclusive: z
      .number()
      .int()
      .nonnegative()
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    incompatibleConventions: z
      .number()
      .int()
      .nonnegative()
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
  })
  .strict();

const ReceiptBoundKerrNumericComparisonSummarySchema = z
  .object({
    rowCount: z
      .number()
      .int()
      .positive()
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    dispositionCounts: ReceiptBoundKerrDispositionCountsSchema,
    comparableEndpointCount: z
      .number()
      .int()
      .nonnegative()
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    maxScreenXAbsoluteDelta:
      ReceiptBoundKerrComparisonNonnegativeSchema.max(64),
    maxScreenYAbsoluteDelta:
      ReceiptBoundKerrComparisonNonnegativeSchema.max(64),
    screenCoordinateMismatchCount: z
      .number()
      .int()
      .nonnegative()
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    maxSeedMomentumOverEnergyAbsoluteDelta:
      ReceiptBoundKerrComparisonNonnegativeSchema,
    maxXiAbsoluteDelta: ReceiptBoundKerrComparisonNonnegativeSchema,
    maxEtaAbsoluteDelta: ReceiptBoundKerrComparisonNonnegativeSchema,
    maxEndpointSphereChord:
      ReceiptBoundKerrComparisonNonnegativeSchema.max(2).nullable(),
    rmsEndpointSphereChord:
      ReceiptBoundKerrComparisonNonnegativeSchema.max(2).nullable(),
    maxEventRadiusAbsoluteDeltaRg:
      ReceiptBoundKerrComparisonNonnegativeSchema.nullable(),
    maxEndpointMomentumOverEnergyAbsoluteDelta:
      ReceiptBoundKerrComparisonNonnegativeSchema.nullable(),
    numericAgreement: z.enum([
      "within-pre-registered-tolerance",
      "disagreed",
      "inconclusive",
    ]),
  })
  .strict();

const ReceiptBoundKerrScientificReviewIdentitySeparationBindingSchema = z
  .object({
    runner:
      KerrExternalMappingReviewSubjectSchema.shape
        .receiptDeclaredRunnerIdentityBinding,
    selection: KerrExternalSelectionReviewIdentityBindingsSchema,
    mapping: z
      .object({
        reviewerId: IdentifierSchema,
        roleGrantId: IdentifierSchema,
        reviewerKeyId: IdentifierSchema,
      })
      .strict(),
  })
  .strict();

export const ReceiptBoundKerrExternalNumericComparisonSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "receipt-bound-kerr-numeric-comparison-complete-needs-independent-scientific-adjudication",
    ),
    comparisonId: z.string().regex(/^krrbcmp_[a-f0-9]{24}$/),
    comparedAt: CanonicalTimestampSchema,
    preparationBinding: z
      .object({
        preparationId: z.string().regex(/^krrprep_[a-f0-9]{24}$/),
        preparationChecksumSha256: Sha256Schema,
        preparedAt: CanonicalTimestampSchema,
      })
      .strict(),
    admissionBinding:
      PreparedKerrExternalComparisonReviewSchema.shape.admissionBinding,
    planBinding: PreparedKerrExternalComparisonReviewSchema.shape.planBinding,
    mappingReviewBinding:
      PreparedKerrExternalComparisonReviewSchema.shape.mappingReviewBinding,
    scientificReviewIdentitySeparationBinding:
      ReceiptBoundKerrScientificReviewIdentitySeparationBindingSchema,
    admittedOutputBinding:
      PreparedKerrExternalComparisonReviewSchema.shape.admittedOutputBinding,
    candidateBinding:
      PreparedKerrExternalComparisonReviewSchema.shape.candidateBinding,
    referenceBinding: z
      .object({
        caseCount: z.number().int().min(1).max(8),
        rowCount: z
          .number()
          .int()
          .min(1)
          .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
        orderedReferenceAssociationSha256: Sha256Schema,
      })
      .strict(),
    comparisonScope: z.enum(["integrator-only", "camera-and-solver"]),
    tolerances: KerrComparisonPlanSchema.shape.tolerances,
    preparedCandidateCanonicalByteCeiling: z.literal(
      KERR_RECEIPT_BOUND_PREPARED_CANDIDATE_MAX_CANONICAL_BYTES,
    ),
    numericComparisonCanonicalByteCeiling: z.literal(
      KERR_RECEIPT_BOUND_NUMERIC_COMPARISON_MAX_CANONICAL_BYTES,
    ),
    rows: z
      .array(ReceiptBoundKerrExternalNumericComparisonRowSchema)
      .min(1)
      .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    summary: ReceiptBoundKerrNumericComparisonSummarySchema,
    rowCoverage: z.literal(
      "exactly-one-receipt-bound-numeric-comparison-row-per-plan-ray-in-plan-order",
    ),
    comparisonExecuted: z.literal(true),
    numericComparisonExecuted: z.literal(true),
    preparationCapabilityConsumedInProcess: z.literal(true),
    exactPreparedCandidateBindingRechecked: z.literal(true),
    exactRetainedEvidenceBytesRechecked: z.literal(true),
    exactPlanIntegrityRechecked: z.literal(true),
    candidateNumericsPreservedFromPrivatePreparedCapability:
      z.literal(true),
    referenceOutcomesAccessedForNumericComparison: z.literal(true),
    comparisonRecordContainsReferenceDerivedMetrics: z.literal(true),
    comparisonRecordRemainsAnswerBlinded: z.literal(false),
    structuredReferenceOutcomesSentByPackageToRunner: z.literal(false),
    mappingFreeTextAbsenceOfReferenceDataVerifiedByPackage:
      z.literal(false),
    answerBlindingVerifiedByPackage: z.literal(false),
    cameraScreenToleranceInventedAfterExecution: z.literal(false),
    coordinateTimeAndAffineParameterDeltasAreDiagnosticOnly:
      z.literal(true),
    aggregateNumericAgreementAdjudicatesCoordinateTimeOrAffineParameter:
      z.literal(false),
    resultCapabilityIssuedForFutureScientificReview: z.literal(true),
    futureScientificReviewConsumerImplemented: z.literal(true),
    comparisonCapabilityConsumedAtIssuance: z.literal(false),
    durableComparisonRecorded: z.literal(false),
    comparisonTimeAuthenticatedByPackage: z.literal(false),
    declaredComparisonChronologyChecked: z.literal(true),
    mappingReviewEvidenceStatus: z.literal(
      "injected-mapping-verifier-asserted-not-package-authenticated",
    ),
    sourceExecutionEvidenceStatus: z.literal(
      "injected-runner-verifier-asserted-not-package-authenticated",
    ),
    injectedMappingVerifierAuthorityAuthenticatedByPackage:
      z.literal(false),
    realExternalExecutionEstablishedByPackage: z.literal(false),
    provisionalToleranceAgreementIsValidation: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...noAuthorityShape,
    comparisonChecksum: ReceiptBoundKerrNumericComparisonChecksumSchema,
  })
  .strict()
  .superRefine((comparison, context) => {
    if (
      Date.parse(comparison.comparedAt) <
      Date.parse(comparison.preparationBinding.preparedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["comparedAt"],
        message: "Receipt-bound Kerr comparison predates its preparation",
      });
    }
    if (
      comparison.referenceBinding.caseCount !==
        comparison.planBinding.caseCount ||
      comparison.referenceBinding.rowCount !== comparison.rows.length ||
      comparison.planBinding.totalRays !== comparison.rows.length ||
      comparison.candidateBinding.rowCount !== comparison.rows.length ||
      comparison.summary.rowCount !== comparison.rows.length ||
      comparison.planBinding.comparisonScope !== comparison.comparisonScope
    ) {
      context.addIssue({
        code: "custom",
        path: ["rows"],
        message: "Receipt-bound Kerr comparison row counts are inconsistent",
      });
    }
    const seenPreparedRowIds = new Set<string>();
    const seenSourceRowIds = new Set<string>();
    const seenReferenceRayIds = new Set<string>();
    const seenCaseIds = new Set<string>();
    let priorCaseOrdinal = -1;
    let priorRayOrdinal = -1;
    let priorCaseId = "";
    let rowCoverageInvalid = false;
    for (const [index, row] of comparison.rows.entries()) {
      if (
        row.comparisonId !== comparison.comparisonId ||
        row.preparationId !==
          comparison.preparationBinding.preparationId ||
        row.preparationChecksumSha256 !==
          comparison.preparationBinding.preparationChecksumSha256 ||
        row.planId !== comparison.planBinding.planId ||
        row.planChecksumSha256 !==
          comparison.planBinding.planChecksumSha256 ||
        row.candidateId !== comparison.candidateBinding.candidateId ||
        row.candidateChecksumSha256 !==
          comparison.candidateBinding.candidateChecksumSha256 ||
        row.admissionId !== comparison.admissionBinding.admissionId ||
        row.mappingReviewDecisionId !==
          comparison.mappingReviewBinding.decisionId ||
        row.comparisonScope !== comparison.comparisonScope
      ) {
        context.addIssue({
          code: "custom",
          path: ["rows"],
          message:
            "Receipt-bound Kerr comparison row changed a parent binding",
        });
        break;
      }
      const beginsNextCase = row.caseOrdinal === priorCaseOrdinal + 1;
      const continuesCase = row.caseOrdinal === priorCaseOrdinal;
      if (
        seenPreparedRowIds.has(row.preparedRowId) ||
        seenSourceRowIds.has(row.sourceBlindedRowId) ||
        seenReferenceRayIds.has(row.planReferenceRayId) ||
        row.caseOrdinal >= comparison.referenceBinding.caseCount ||
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
      seenPreparedRowIds.add(row.preparedRowId);
      seenSourceRowIds.add(row.sourceBlindedRowId);
      seenReferenceRayIds.add(row.planReferenceRayId);
      priorCaseOrdinal = row.caseOrdinal;
      priorRayOrdinal = row.rayOrdinal;
      priorCaseId = row.caseId;
    }
    if (
      rowCoverageInvalid ||
      priorCaseOrdinal + 1 !== comparison.referenceBinding.caseCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["rows"],
        message:
          "Receipt-bound Kerr comparison rows are not unique exact ordinal coverage",
      });
    }
    const expectedSummary = summarizeKerrNumericRows(
      comparison.rows as readonly KerrNumericComparisonCoreRow[],
    );
    if (
      kerrStableStringify(comparison.summary) !==
      kerrStableStringify(expectedSummary)
    ) {
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Receipt-bound Kerr comparison summary is inconsistent",
      });
    }
  });

export type ReceiptBoundKerrExternalNumericComparison = z.infer<
  typeof ReceiptBoundKerrExternalNumericComparisonSchema
>;

type PreparedKerrComparisonContext = NonNullable<
  ReturnType<typeof preparedKerrExternalComparisonReviewContexts.get>
>;

const issuedReceiptBoundKerrExternalNumericComparisons =
  new WeakSet<object>();
const receiptBoundKerrExternalNumericComparisonContexts = new WeakMap<
  object,
  {
    readonly preparation: PreparedKerrExternalComparisonReview;
    readonly preparationContext: PreparedKerrComparisonContext;
  }
>();

function receiptBoundKerrNumericComparisonId(input: {
  readonly preparationId: string;
  readonly preparationChecksumSha256: string;
  readonly candidateId: string;
  readonly candidateChecksumSha256: string;
  readonly planId: string;
  readonly planChecksumSha256: string;
  readonly comparedAt: string;
}): string {
  return `krrbcmp_${kerrSha256Hex(kerrStableStringify(input)).slice(0, 24)}`;
}

function orderedReferenceAssociationSha256(plan: KerrComparisonPlan): string {
  return kerrSha256Hex(
    kerrStableStringify(
      plan.cases.map((planCase, caseOrdinal) => ({
        caseOrdinal,
        caseId: planCase.caseId,
        scientificRole: planCase.scientificRole,
        requestId: planCase.request.requestId,
        requestChecksum: planCase.request.requestChecksum,
        referenceReportId: planCase.report.reportId,
        referenceReportChecksum: planCase.report.reportChecksum,
        rays: planCase.rays.map((referenceRay, rayOrdinal) => ({
          rayOrdinal,
          planReferenceRayId: referenceRay.rayId,
          planReferenceRayChecksum: referenceRay.rayChecksum,
          pixelIndex: referenceRay.pixelIndex,
          pixelX: referenceRay.pixelX,
          pixelY: referenceRay.pixelY,
        })),
      })),
    ),
  );
}

function receiptBoundKerrNumericComparisonRows(
  comparisonId: string,
  preparation: PreparedKerrExternalComparisonReview,
  context: PreparedKerrComparisonContext,
): {
  readonly rows: readonly ReceiptBoundKerrExternalNumericComparisonRow[];
  readonly numericRows: readonly KerrNumericComparisonCoreRow[];
} {
  const planRows = context.plan.cases.flatMap(
    (planCase, caseOrdinal) =>
      planCase.rays.map((referenceRay, rayOrdinal) => ({
        planCase,
        referenceRay,
        caseOrdinal,
        rayOrdinal,
      })),
  );
  if (
    planRows.length === 0 ||
    planRows.length !== context.candidate.rows.length ||
    planRows.length !== preparation.rows.length
  ) {
    throw new Error(
      "Receipt-bound Kerr numeric comparison requires exact nonempty plan coverage",
    );
  }
  const rows: ReceiptBoundKerrExternalNumericComparisonRow[] = [];
  const numericRows: KerrNumericComparisonCoreRow[] = [];
  const seenPreparedRows = new Set<string>();
  const seenReferenceRays = new Set<string>();
  for (let index = 0; index < planRows.length; index += 1) {
    const expected = planRows[index]!;
    const candidate = context.candidate.rows[index]!;
    const preparedBinding = preparation.rows[index]!;
    if (
      candidate.planId !== context.plan.planId ||
      candidate.planChecksumSha256 !== context.plan.planChecksum.value ||
      candidate.admissionId !== context.admission.admissionId ||
      candidate.mappingReviewDecisionId !== context.decision.decisionId ||
      candidate.caseOrdinal !== expected.caseOrdinal ||
      candidate.rayOrdinal !== expected.rayOrdinal ||
      candidate.caseId !== expected.planCase.caseId ||
      candidate.scientificRole !== expected.planCase.scientificRole ||
      candidate.requestId !== expected.planCase.request.requestId ||
      kerrStableStringify(candidate.requestChecksum) !==
        kerrStableStringify(expected.planCase.request.requestChecksum) ||
      candidate.referenceReportId !== expected.planCase.report.reportId ||
      kerrStableStringify(candidate.referenceReportChecksum) !==
        kerrStableStringify(expected.planCase.report.reportChecksum) ||
      candidate.planReferenceRayId !== expected.referenceRay.rayId ||
      kerrStableStringify(candidate.planReferenceRayChecksum) !==
        kerrStableStringify(expected.referenceRay.rayChecksum) ||
      candidate.pixelIndex !== expected.referenceRay.pixelIndex ||
      candidate.pixelX !== expected.referenceRay.pixelX ||
      candidate.pixelY !== expected.referenceRay.pixelY ||
      preparedBinding.caseOrdinal !== expected.caseOrdinal ||
      preparedBinding.rayOrdinal !== expected.rayOrdinal ||
      preparedBinding.preparedRowId !== candidate.rowId ||
      preparedBinding.preparedRowChecksumSha256 !==
        candidate.rowChecksum.value ||
      preparedBinding.sourceBlindedRowId !==
        candidate.sourceBlindedRowId ||
      preparedBinding.sourceBlindedRowChecksumSha256 !==
        candidate.sourceBlindedRowChecksumSha256 ||
      preparedBinding.caseId !== expected.planCase.caseId ||
      preparedBinding.planReferenceRayId !== expected.referenceRay.rayId ||
      preparedBinding.planReferenceRayChecksumSha256 !==
        expected.referenceRay.rayChecksum.value ||
      preparedBinding.pixelIndex !== expected.referenceRay.pixelIndex ||
      preparedBinding.pixelX !== expected.referenceRay.pixelX ||
      preparedBinding.pixelY !== expected.referenceRay.pixelY
    ) {
      throw new Error(
        "Receipt-bound Kerr numeric comparison row changed its exact prepared plan association",
      );
    }
    if (
      seenPreparedRows.has(candidate.rowId) ||
      seenReferenceRays.has(expected.referenceRay.rayId)
    ) {
      throw new Error(
        "Receipt-bound Kerr numeric comparison rows must not duplicate prepared rows or reference rays",
      );
    }
    seenPreparedRows.add(candidate.rowId);
    seenReferenceRays.add(expected.referenceRay.rayId);
    const numeric = compareKerrNumericRow(
      context.plan,
      expected.referenceRay,
      candidate,
    );
    numericRows.push(numeric);
    const candidateNumerics = {
      screenX: candidate.screenX,
      screenY: candidate.screenY,
      termination: candidate.termination,
      initialMomentum: candidate.initialMomentum,
      constants: candidate.constants,
      endpoint: candidate.endpoint,
    };
    const payload = {
      schemaVersion: "1.0.0" as const,
      state:
        "receipt-bound-kerr-external-row-numerically-compared-needs-scientific-review" as const,
      comparisonId,
      preparationId: preparation.preparationId,
      preparationChecksumSha256: preparation.preparationChecksum.value,
      planId: context.plan.planId,
      planChecksumSha256: context.plan.planChecksum.value,
      candidateId: context.candidate.candidateId,
      candidateChecksumSha256: context.candidate.candidateChecksum.value,
      admissionId: context.admission.admissionId,
      mappingReviewDecisionId: context.decision.decisionId,
      caseOrdinal: expected.caseOrdinal,
      rayOrdinal: expected.rayOrdinal,
      preparedRowId: candidate.rowId,
      preparedRowChecksumSha256: candidate.rowChecksum.value,
      sourceBlindedRowId: candidate.sourceBlindedRowId,
      sourceBlindedRowChecksumSha256:
        candidate.sourceBlindedRowChecksumSha256,
      caseId: expected.planCase.caseId,
      scientificRole: expected.planCase.scientificRole,
      requestId: expected.planCase.request.requestId,
      requestChecksum: expected.planCase.request.requestChecksum,
      referenceReportId: expected.planCase.report.reportId,
      referenceReportChecksum: expected.planCase.report.reportChecksum,
      planReferenceRayId: expected.referenceRay.rayId,
      planReferenceRayChecksum: expected.referenceRay.rayChecksum,
      pixelIndex: expected.referenceRay.pixelIndex,
      pixelX: expected.referenceRay.pixelX,
      pixelY: expected.referenceRay.pixelY,
      comparisonScope: context.plan.comparisonScope,
      candidateNumerics,
      screenComparison: numeric.screenComparison,
      referenceTermination: numeric.referenceTermination,
      candidateTermination: numeric.candidateTermination,
      seedComparison: numeric.seedComparison,
      endpointComparison: numeric.endpointComparison,
      disposition: numeric.disposition,
      reasons: numeric.reasons,
      comparisonExecuted: true as const,
      numericComparisonExecuted: true as const,
      candidateNumericsPreservedFromPrivatePreparedCapability:
        true as const,
      referenceOutcomeValuesCopiedIntoCandidateNumericsByPackage:
        false as const,
      provisionalToleranceAgreementIsValidation: false as const,
      independentReference: "not-run" as const,
      ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
    };
    const rowId = `krrbcmprow_${kerrSha256Hex(
      kerrStableStringify(payload),
    ).slice(0, 24)}`;
    rows.push(
      ReceiptBoundKerrExternalNumericComparisonRowSchema.parse({
        ...payload,
        rowId,
        rowChecksum: checksum(
          "receipt-bound-kerr-external-numeric-comparison-row",
          { ...payload, rowId },
        ),
      }),
    );
  }
  return { rows, numericRows };
}

function buildReceiptBoundKerrExternalNumericComparison(
  preparation: PreparedKerrExternalComparisonReview,
  context: PreparedKerrComparisonContext,
  comparedAt: string,
): ReceiptBoundKerrExternalNumericComparison {
  const comparisonId = receiptBoundKerrNumericComparisonId({
    preparationId: preparation.preparationId,
    preparationChecksumSha256: preparation.preparationChecksum.value,
    candidateId: context.candidate.candidateId,
    candidateChecksumSha256: context.candidate.candidateChecksum.value,
    planId: context.plan.planId,
    planChecksumSha256: context.plan.planChecksum.value,
    comparedAt,
  });
  const { rows, numericRows } = receiptBoundKerrNumericComparisonRows(
    comparisonId,
    preparation,
    context,
  );
  const summary = summarizeKerrNumericRows(numericRows);
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state:
      "receipt-bound-kerr-numeric-comparison-complete-needs-independent-scientific-adjudication" as const,
    comparisonId,
    comparedAt,
    preparationBinding: {
      preparationId: preparation.preparationId,
      preparationChecksumSha256: preparation.preparationChecksum.value,
      preparedAt: preparation.preparedAt,
    },
    admissionBinding: preparation.admissionBinding,
    planBinding: preparation.planBinding,
    mappingReviewBinding: preparation.mappingReviewBinding,
    scientificReviewIdentitySeparationBinding: {
      runner: context.subject.receiptDeclaredRunnerIdentityBinding,
      selection: context.subject.priorSelectionReviewIdentityBindings,
      mapping: {
        reviewerId: context.decision.statement.reviewerId,
        roleGrantId: context.decision.statement.roleGrantId,
        reviewerKeyId: context.decision.statement.keyId,
      },
    },
    admittedOutputBinding: preparation.admittedOutputBinding,
    candidateBinding: preparation.candidateBinding,
    referenceBinding: {
      caseCount: context.plan.cases.length,
      rowCount: rows.length,
      orderedReferenceAssociationSha256:
        orderedReferenceAssociationSha256(context.plan),
    },
    comparisonScope: context.plan.comparisonScope,
    tolerances: KERR_COMPARISON_PROVISIONAL_TOLERANCES,
    preparedCandidateCanonicalByteCeiling:
      KERR_RECEIPT_BOUND_PREPARED_CANDIDATE_MAX_CANONICAL_BYTES,
    numericComparisonCanonicalByteCeiling:
      KERR_RECEIPT_BOUND_NUMERIC_COMPARISON_MAX_CANONICAL_BYTES,
    rows,
    summary,
    rowCoverage:
      "exactly-one-receipt-bound-numeric-comparison-row-per-plan-ray-in-plan-order" as const,
    comparisonExecuted: true as const,
    numericComparisonExecuted: true as const,
    preparationCapabilityConsumedInProcess: true as const,
    exactPreparedCandidateBindingRechecked: true as const,
    exactRetainedEvidenceBytesRechecked: true as const,
    exactPlanIntegrityRechecked: true as const,
    candidateNumericsPreservedFromPrivatePreparedCapability:
      true as const,
    referenceOutcomesAccessedForNumericComparison: true as const,
    comparisonRecordContainsReferenceDerivedMetrics: true as const,
    comparisonRecordRemainsAnswerBlinded: false as const,
    structuredReferenceOutcomesSentByPackageToRunner: false as const,
    mappingFreeTextAbsenceOfReferenceDataVerifiedByPackage:
      false as const,
    answerBlindingVerifiedByPackage: false as const,
    cameraScreenToleranceInventedAfterExecution: false as const,
    coordinateTimeAndAffineParameterDeltasAreDiagnosticOnly:
      true as const,
    aggregateNumericAgreementAdjudicatesCoordinateTimeOrAffineParameter:
      false as const,
    resultCapabilityIssuedForFutureScientificReview: true as const,
    futureScientificReviewConsumerImplemented: true as const,
    comparisonCapabilityConsumedAtIssuance: false as const,
    durableComparisonRecorded: false as const,
    comparisonTimeAuthenticatedByPackage: false as const,
    declaredComparisonChronologyChecked: true as const,
    mappingReviewEvidenceStatus:
      "injected-mapping-verifier-asserted-not-package-authenticated" as const,
    sourceExecutionEvidenceStatus:
      "injected-runner-verifier-asserted-not-package-authenticated" as const,
    injectedMappingVerifierAuthorityAuthenticatedByPackage:
      false as const,
    realExternalExecutionEstablishedByPackage: false as const,
    provisionalToleranceAgreementIsValidation: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_EXECUTION_RECEIPT_NO_AUTHORITY,
  };
  const comparison = deepFreezeKerr(
    ReceiptBoundKerrExternalNumericComparisonSchema.parse({
      ...unsigned,
      comparisonChecksum: checksum(
        "receipt-bound-kerr-external-numeric-comparison",
        unsigned,
      ),
    }),
  );
  assertReceiptBoundNumericComparisonByteBudget(comparison);
  return comparison;
}

export interface ConsumePreparedKerrExternalComparisonReviewInput {
  readonly preparation: PreparedKerrExternalComparisonReview;
  readonly comparedAt: unknown;
}

export function consumePreparedKerrExternalComparisonReview(
  input: ConsumePreparedKerrExternalComparisonReviewInput,
): ReceiptBoundKerrExternalNumericComparison {
  const preparationInput = ownDataValue(
    input,
    "preparation",
    "Prepared Kerr external comparison-review consumption",
  );
  assertIssuedPreparedKerrExternalComparisonReview(preparationInput);
  if (attemptedPreparedKerrExternalNumericComparisons.has(preparationInput)) {
    throw new Error(
      "Prepared Kerr external comparison review already attempted numeric comparison",
    );
  }
  assertPreparedKerrExternalComparisonReviewIntegrity(preparationInput);
  const context =
    preparedKerrExternalComparisonReviewContexts.get(preparationInput);
  if (context === undefined) {
    throw new Error(
      "Prepared Kerr external comparison-review context is unavailable",
    );
  }
  const comparedAt = CanonicalTimestampSchema.parse(
    ownDataValue(
      input,
      "comparedAt",
      "Prepared Kerr external comparison-review consumption",
    ),
  );
  if (
    Date.parse(comparedAt) < Date.parse(preparationInput.preparedAt) ||
    Date.parse(comparedAt) >=
      Date.parse(context.decision.statement.expiresAt) ||
    Date.parse(comparedAt) >=
      Date.parse(context.subject.executionClaimExpiresAt)
  ) {
    throw new Error(
      "Receipt-bound Kerr numeric comparison is outside the declared mapping-review chronology",
    );
  }
  // Every caller-controlled value and private capability binding is checked
  // above. Burn immediately before the synchronous, callback-free numeric
  // boundary. Any arithmetic/invariant failure from this point is permanent.
  // The repeated check closes reentrancy through caller-owned input proxies or
  // mutable host intrinsics used during preflight chronology parsing.
  if (attemptedPreparedKerrExternalNumericComparisons.has(preparationInput)) {
    throw new Error(
      "Prepared Kerr external comparison review already attempted numeric comparison",
    );
  }
  attemptedPreparedKerrExternalNumericComparisons.add(preparationInput);
  const comparison = buildReceiptBoundKerrExternalNumericComparison(
    preparationInput,
    context,
    comparedAt,
  );
  issuedReceiptBoundKerrExternalNumericComparisons.add(comparison);
  receiptBoundKerrExternalNumericComparisonContexts.set(comparison, {
    preparation: preparationInput,
    preparationContext: context,
  });
  return comparison;
}

export function assertReceiptBoundKerrExternalNumericComparisonSelfIntegrity(
  comparisonInput: unknown,
): asserts comparisonInput is ReceiptBoundKerrExternalNumericComparison {
  assertKerrComparisonPlainDataTree(
    comparisonInput,
    "Receipt-bound Kerr external numeric comparison",
  );
  const comparison =
    ReceiptBoundKerrExternalNumericComparisonSchema.parse(comparisonInput);
  if (
    kerrStableStringify(comparisonInput) !==
    kerrStableStringify(comparison)
  ) {
    throw new Error(
      "Receipt-bound Kerr external numeric comparison must already be canonical",
    );
  }
  const expectedComparisonId = receiptBoundKerrNumericComparisonId({
    preparationId: comparison.preparationBinding.preparationId,
    preparationChecksumSha256:
      comparison.preparationBinding.preparationChecksumSha256,
    candidateId: comparison.candidateBinding.candidateId,
    candidateChecksumSha256:
      comparison.candidateBinding.candidateChecksumSha256,
    planId: comparison.planBinding.planId,
    planChecksumSha256: comparison.planBinding.planChecksumSha256,
    comparedAt: comparison.comparedAt,
  });
  for (const row of comparison.rows) {
    const { rowId, rowChecksum, ...rowPayload } = row;
    const expectedRowId = `krrbcmprow_${kerrSha256Hex(
      kerrStableStringify(rowPayload),
    ).slice(0, 24)}`;
    const expectedRowChecksum = checksum(
      "receipt-bound-kerr-external-numeric-comparison-row",
      { ...rowPayload, rowId: expectedRowId },
    );
    if (
      rowId !== expectedRowId ||
      kerrStableStringify(rowChecksum) !==
        kerrStableStringify(expectedRowChecksum)
    ) {
      throw new Error(
        "Receipt-bound Kerr numeric comparison row failed self-integrity replay",
      );
    }
  }
  const { comparisonChecksum, ...unsigned } = comparison;
  const expectedComparisonChecksum = checksum(
    "receipt-bound-kerr-external-numeric-comparison",
    unsigned,
  );
  if (
    comparison.comparisonId !== expectedComparisonId ||
    kerrStableStringify(comparisonChecksum) !==
      kerrStableStringify(expectedComparisonChecksum)
  ) {
    throw new Error(
      "Receipt-bound Kerr external numeric comparison failed self-integrity replay",
    );
  }
  assertReceiptBoundNumericComparisonByteBudget(comparison);
}

export function assertIssuedReceiptBoundKerrExternalNumericComparison(
  input: unknown,
): asserts input is ReceiptBoundKerrExternalNumericComparison {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedReceiptBoundKerrExternalNumericComparisons.has(input)
  ) {
    throw new Error(
      "Receipt-bound Kerr external numeric comparison must be issued in this process; structural copies are rejected",
    );
  }
}

export function assertReceiptBoundKerrExternalNumericComparisonIntegrity(
  comparisonInput: unknown,
): asserts comparisonInput is ReceiptBoundKerrExternalNumericComparison {
  assertIssuedReceiptBoundKerrExternalNumericComparison(comparisonInput);
  assertReceiptBoundKerrExternalNumericComparisonSelfIntegrity(
    comparisonInput,
  );
  const context =
    receiptBoundKerrExternalNumericComparisonContexts.get(comparisonInput);
  if (context === undefined) {
    throw new Error(
      "Receipt-bound Kerr external numeric comparison context is unavailable",
    );
  }
  assertPreparedKerrExternalComparisonReviewIntegrity(context.preparation);
  if (
    Date.parse(comparisonInput.comparedAt) <
      Date.parse(context.preparation.preparedAt) ||
    Date.parse(comparisonInput.comparedAt) >=
      Date.parse(context.preparationContext.decision.statement.expiresAt) ||
    Date.parse(comparisonInput.comparedAt) >=
      Date.parse(
        context.preparationContext.subject.executionClaimExpiresAt,
      )
  ) {
    throw new Error(
      "Receipt-bound Kerr external numeric comparison failed chronology replay",
    );
  }
  const expected = buildReceiptBoundKerrExternalNumericComparison(
    context.preparation,
    context.preparationContext,
    comparisonInput.comparedAt,
  );
  if (
    kerrStableStringify(comparisonInput) !== kerrStableStringify(expected)
  ) {
    throw new Error(
      "Receipt-bound Kerr external numeric comparison failed exact private-context integrity replay",
    );
  }
}

export function canUseReceiptBoundKerrExternalNumericComparisonForRender(
  _input: unknown,
): false {
  return false;
}

export function canUsePreparedKerrExternalComparisonReviewForRender(
  _input: unknown,
): false {
  return false;
}

export function canUseVerifiedKerrExternalOutputForRender(_input: unknown): false {
  return false;
}
