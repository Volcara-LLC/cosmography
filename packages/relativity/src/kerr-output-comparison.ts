import { z } from "zod";

import {
  KerrExternalOutputCandidateSchema,
  type KerrExternalOutputCandidate,
  assertKerrExternalOutputCandidateExactBytes,
  assertKerrExternalOutputCandidateIntegrity,
} from "./external-kerr-output.js";
import {
  KERR_COMPARISON_MAX_CANDIDATE_CANONICAL_BYTES,
  KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
  KERR_COMPARISON_NO_AUTHORITY,
  KERR_COMPARISON_PROVISIONAL_TOLERANCES,
  KerrComparisonPlanSchema,
  type KerrComparisonPlan,
  type KerrComparisonReferenceRayBinding,
  type VerifiedKerrComparisonReferenceBundle,
  assertKerrComparisonPlainDataTree,
  assertKerrComparisonPlanIntegrity,
  assertVerifiedKerrComparisonReferenceBundle,
} from "./kerr-comparison-plan.js";
import {
  KERR_REFERENCE_TRACE_MAX_PIXELS,
  deepFreezeKerr,
  kerrSha256Hex,
  kerrStableStringify,
} from "./trace-contracts.js";
import {
  compareKerrNumericRow,
  kerrWithinInclusiveBoundary,
  summarizeKerrNumericRows,
  type KerrNumericCandidateRowLike,
  type KerrNumericComparisonCoreRow,
} from "./kerr-numeric-comparison-core.js";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const CanonicalTimestampSchema = z.iso.datetime({
  offset: false,
  precision: 0,
});
const BoundedNonnegativeSchema = z.number().finite().nonnegative().max(2e12);
const BoundedFiniteSchema = z.number().finite().min(-1e12).max(1e12);

const ReferenceChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.enum([
      "kerr-reference-trace-request",
      "kerr-reference-trace-report",
      "kerr-reference-ray-record",
    ]),
  })
  .strict();

function exactByteBindingSchema(maxByteLength: number) {
  return z
    .object({
      byteLength: z.number().int().positive().max(maxByteLength),
      sha256: Sha256Schema,
    })
    .strict();
}

const RawExactByteBindingSchema = exactByteBindingSchema(
  KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
);
const NormalizedExactByteBindingSchema = exactByteBindingSchema(
  KERR_COMPARISON_MAX_CANDIDATE_CANONICAL_BYTES,
);

const TolerancesSchema = z
  .object({
    status: z.literal(
      "provisional-internal-convergence-derived-not-independently-validated",
    ),
    initialMomentumOverEnergyMaxAbsolute: z.literal(2e-12),
    xiMaxAbsolute: z.literal(2e-12),
    etaMaxAbsolute: z.literal(2e-11),
    etaMaxRelative: z.literal(2e-12),
    endpointSphereChordMaxAbsolute: z.literal(2e-6),
    endpointMomentumOverEnergyMaxAbsolute: z.literal(5e-5),
    endpointMomentumOverEnergyMaxRelative: z.literal(1e-5),
    eventRadiusMaxAbsoluteRg: z.literal(1e-9),
    terminationMustMatchExactly: z.literal(true),
    azimuthWindingMustMatchExactly: z.literal(true),
  })
  .strict();

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

const noAuthority = {
  ...KERR_COMPARISON_NO_AUTHORITY,
  independenceEstablished: false,
} as const;

export const KerrComparisonDispositionSchema = z.enum([
  "within-tolerance",
  "disagreed",
  "inconclusive",
  "incompatible-conventions",
]);
export type KerrComparisonDisposition = z.infer<
  typeof KerrComparisonDispositionSchema
>;

export const KerrNumericAgreementSchema = z.enum([
  "within-pre-registered-tolerance",
  "disagreed",
  "inconclusive",
]);
export type KerrNumericAgreement = z.infer<
  typeof KerrNumericAgreementSchema
>;

export const KerrComparisonReasonSchema = z.enum([
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
export type KerrComparisonReason = z.infer<
  typeof KerrComparisonReasonSchema
>;

const reasonOrder: readonly KerrComparisonReason[] = Object.freeze([
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

const SeedComparisonSchema = z
  .object({
    maxMomentumOverEnergyAbsoluteDelta: BoundedNonnegativeSchema,
    xiAbsoluteDelta: BoundedNonnegativeSchema,
    etaAbsoluteDelta: BoundedNonnegativeSchema,
    etaAllowedDelta: BoundedNonnegativeSchema,
    momentumWithinTolerance: z.boolean(),
    xiWithinTolerance: z.boolean(),
    etaWithinTolerance: z.boolean(),
  })
  .strict();

const EndpointComparisonSchema = z
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
    sphereChord: BoundedNonnegativeSchema.max(2),
    eventRadiusAbsoluteDeltaRg: BoundedNonnegativeSchema,
    phiWindingDelta: z.number().int().safe(),
    maxMomentumOverEnergyAbsoluteDelta: BoundedNonnegativeSchema,
    maxMomentumOverEnergyAllowedDelta: BoundedNonnegativeSchema,
    directionWithinTolerance: z.boolean(),
    eventRadiusWithinTolerance: z.boolean(),
    phiWindingMatches: z.boolean(),
    momentumWithinTolerance: z.boolean(),
    coordinateTimeAbsoluteDelta: BoundedNonnegativeSchema,
    energyTimesAffineParameterAbsoluteDelta: BoundedNonnegativeSchema,
  })
  .strict();

const ComparisonRowChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-external-output-comparison-row"),
  })
  .strict();

export const KerrExternalOutputComparisonRowSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    rowId: z.string().regex(/^krcrow_[a-f0-9]{24}$/),
    planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
    candidateId: z.string().regex(/^krcand_[a-f0-9]{24}$/),
    caseId: z.string().regex(/^krcase_[a-z0-9][a-z0-9-]{2,63}$/),
    requestId: z.string().regex(/^krreq_[a-f0-9]{24}$/),
    requestChecksum: ReferenceChecksumSchema,
    reportId: z.string().regex(/^krrep_[a-f0-9]{24}$/),
    reportChecksum: ReferenceChecksumSchema,
    referenceRayId: z.string().regex(/^krray_[a-f0-9]{24}$/),
    referenceRayChecksum: ReferenceChecksumSchema,
    candidateRowId: z.string().regex(/^krxrow_[a-f0-9]{24}$/),
    candidateRowChecksum: Sha256Schema,
    pixelIndex: z.number().int().min(0).max(KERR_REFERENCE_TRACE_MAX_PIXELS - 1),
    pixelX: z.number().int().min(0).max(24),
    pixelY: z.number().int().min(0).max(24),
    screenX: BoundedFiniteSchema,
    screenY: BoundedFiniteSchema,
    referenceTermination: z.enum([
      "captured-horizon-guard",
      "escaped-domain",
    ]),
    candidateTermination: z.enum([
      "captured-horizon-guard",
      "escaped-domain",
      "coordinate-domain-exit",
      "indeterminate-limit",
      "numerical-failure",
    ]),
    seedComparison: SeedComparisonSchema,
    endpointComparison: EndpointComparisonSchema.nullable(),
    disposition: KerrComparisonDispositionSchema,
    reasons: z.array(KerrComparisonReasonSchema).max(reasonOrder.length),
    independentReference: z.literal("not-run"),
    ...noAuthorityShape,
    rowChecksum: ComparisonRowChecksumSchema,
  })
  .strict()
  .superRefine((row, context) => {
    if (new Set(row.reasons).size !== row.reasons.length) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: "Kerr comparison row reasons must be unique",
      });
    }
    if (
      kerrStableStringify(row.reasons) !==
      kerrStableStringify(
        orderedReasons(new Set(row.reasons as KerrComparisonReason[])),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: "Kerr comparison row reasons are not canonical",
      });
    }
    const seedCompatible =
      row.seedComparison.momentumWithinTolerance &&
      row.seedComparison.xiWithinTolerance &&
      row.seedComparison.etaWithinTolerance;
    if (
      row.seedComparison.momentumWithinTolerance !==
        kerrWithinInclusiveBoundary(
          row.seedComparison.maxMomentumOverEnergyAbsoluteDelta,
          KERR_COMPARISON_PROVISIONAL_TOLERANCES
            .initialMomentumOverEnergyMaxAbsolute,
        ) ||
      row.seedComparison.xiWithinTolerance !==
        kerrWithinInclusiveBoundary(
          row.seedComparison.xiAbsoluteDelta,
          KERR_COMPARISON_PROVISIONAL_TOLERANCES.xiMaxAbsolute,
        ) ||
      row.seedComparison.etaWithinTolerance !==
        kerrWithinInclusiveBoundary(
          row.seedComparison.etaAbsoluteDelta,
          row.seedComparison.etaAllowedDelta,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["seedComparison"],
        message: "Kerr seed flags are inconsistent with their deltas",
      });
    }
    const expectedReasons = new Set<KerrComparisonReason>();
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
    let expectedDisposition: KerrComparisonDisposition;
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
      expectedDisposition =
        expectedReasons.size === 0 ? "within-tolerance" : "disagreed";
    }
    if (row.disposition !== expectedDisposition) {
      context.addIssue({
        code: "custom",
        path: ["disposition"],
        message: "Kerr comparison disposition is inconsistent with its deltas",
      });
    }
    if (
      (!seedCompatible ||
        !candidateResolved ||
        row.candidateTermination !== row.referenceTermination) ===
      (row.endpointComparison !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["endpointComparison"],
        message:
          "Kerr endpoint comparison presence is inconsistent with aligned resolved outcomes",
      });
    }
    if (
      kerrStableStringify(row.reasons) !==
      kerrStableStringify(orderedReasons(expectedReasons))
    ) {
      context.addIssue({
        code: "custom",
        path: ["reasons"],
        message: "Kerr comparison reasons are inconsistent with its deltas",
      });
    }
    if (row.endpointComparison !== null) {
      const endpoint = row.endpointComparison;
      if (
        endpoint.eventSurfaceMatches !==
          (endpoint.referenceEventSurface === endpoint.candidateEventSurface) ||
        endpoint.directionWithinTolerance !==
          kerrWithinInclusiveBoundary(
            endpoint.sphereChord,
            KERR_COMPARISON_PROVISIONAL_TOLERANCES
              .endpointSphereChordMaxAbsolute,
          ) ||
        endpoint.eventRadiusWithinTolerance !==
          kerrWithinInclusiveBoundary(
            endpoint.eventRadiusAbsoluteDeltaRg,
            KERR_COMPARISON_PROVISIONAL_TOLERANCES
              .eventRadiusMaxAbsoluteRg,
          ) ||
        endpoint.phiWindingMatches !== (endpoint.phiWindingDelta === 0)
      ) {
        context.addIssue({
          code: "custom",
          path: ["endpointComparison"],
          message: "Kerr endpoint flags are inconsistent with their deltas",
        });
      }
    }
  });
export type KerrExternalOutputComparisonRow = z.infer<
  typeof KerrExternalOutputComparisonRowSchema
>;

const ComparisonChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-external-output-comparison"),
  })
  .strict();

const DispositionCountsSchema = z
  .object({
    withinTolerance: z.number().int().nonnegative().max(KERR_REFERENCE_TRACE_MAX_PIXELS),
    disagreed: z.number().int().nonnegative().max(KERR_REFERENCE_TRACE_MAX_PIXELS),
    inconclusive: z.number().int().nonnegative().max(KERR_REFERENCE_TRACE_MAX_PIXELS),
    incompatibleConventions: z
      .number()
      .int()
      .nonnegative()
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
  })
  .strict();

export const KerrExternalOutputComparisonSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "machine-compared-declared-external-output-needs-independence-and-scientific-review",
    ),
    comparisonId: z.string().regex(/^krcmp_[a-f0-9]{24}$/),
    generatedAt: CanonicalTimestampSchema,
    plan: z
      .object({
        planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
        planChecksum: Sha256Schema,
        frozenAt: CanonicalTimestampSchema,
      })
      .strict(),
    reference: z
      .object({
        caseCount: z.number().int().positive().max(8),
        rowCount: z.number().int().positive().max(KERR_REFERENCE_TRACE_MAX_PIXELS),
        bindingSha256: Sha256Schema,
      })
      .strict(),
    candidate: z
      .object({
        candidateId: z.string().regex(/^krcand_[a-f0-9]{24}$/),
        candidateChecksum: Sha256Schema,
        generatedAt: CanonicalTimestampSchema,
        evidenceClass: z.enum([
          "caller-declared-external-run",
          "synthetic-test-fixture",
        ]),
        runStartedAt: CanonicalTimestampSchema,
        runCompletedAt: CanonicalTimestampSchema,
        rawCapturedAt: CanonicalTimestampSchema,
        executionVerified: z.literal(false),
        rawBytes: RawExactByteBindingSchema,
        normalizedBytes: NormalizedExactByteBindingSchema,
      })
      .strict(),
    tolerances: TolerancesSchema,
    rows: z
      .array(KerrExternalOutputComparisonRowSchema)
      .min(1)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
    summary: z
      .object({
        rowCount: z.number().int().positive().max(KERR_REFERENCE_TRACE_MAX_PIXELS),
        dispositionCounts: DispositionCountsSchema,
        comparableEndpointCount: z
          .number()
          .int()
          .nonnegative()
          .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
        maxSeedMomentumOverEnergyAbsoluteDelta: BoundedNonnegativeSchema,
        maxXiAbsoluteDelta: BoundedNonnegativeSchema,
        maxEtaAbsoluteDelta: BoundedNonnegativeSchema,
        maxEndpointSphereChord: BoundedNonnegativeSchema.max(2).nullable(),
        rmsEndpointSphereChord: BoundedNonnegativeSchema.max(2).nullable(),
        maxEventRadiusAbsoluteDeltaRg: BoundedNonnegativeSchema.nullable(),
        maxEndpointMomentumOverEnergyAbsoluteDelta:
          BoundedNonnegativeSchema.nullable(),
        numericAgreement: KerrNumericAgreementSchema,
      })
      .strict(),
    comparisonExecuted: z.literal(true),
    comparisonScope: z.literal(
      "numeric-agreement-only-provenance-and-independence-not-established",
    ),
    independentReference: z.literal("not-run"),
    provisionalToleranceAgreementIsValidation: z.literal(false),
    ...noAuthorityShape,
    comparisonChecksum: ComparisonChecksumSchema,
  })
  .strict()
  .superRefine((comparison, context) => {
    const candidate = comparison.candidate;
    if (
      candidate.runCompletedAt < candidate.runStartedAt ||
      candidate.rawCapturedAt < candidate.runCompletedAt ||
      candidate.generatedAt < candidate.rawCapturedAt ||
      comparison.generatedAt < candidate.generatedAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["candidate"],
        message: "Kerr comparison candidate chronology is reversed",
      });
    }
  });
export type KerrExternalOutputComparison = z.infer<
  typeof KerrExternalOutputComparisonSchema
>;

function orderedReasons(
  reasons: ReadonlySet<KerrComparisonReason>,
): KerrComparisonReason[] {
  return reasonOrder.filter((reason) => reasons.has(reason));
}

interface CandidateRowLike extends KerrNumericCandidateRowLike {
  readonly rowId: string;
  readonly rowChecksum: { readonly value: string };
  readonly caseId: string;
  readonly scientificRole: KerrComparisonPlan["cases"][number]["scientificRole"];
  readonly requestId: string;
  readonly requestChecksum: KerrComparisonPlan["cases"][number]["request"]["requestChecksum"];
  readonly referenceReportId: string;
  readonly referenceReportChecksum: KerrComparisonPlan["cases"][number]["report"]["reportChecksum"];
  readonly referenceRayId: string;
  readonly referenceRayChecksum: KerrComparisonReferenceRayBinding["rayChecksum"];
  readonly pixelIndex: number;
  readonly pixelX: number;
  readonly pixelY: number;
}

interface CandidateLike {
  readonly candidateId: string;
  readonly planId: string;
  readonly planChecksum: { readonly value: string };
  readonly generatedAt: string;
  readonly externalRun: {
    readonly evidenceClass:
      | "caller-declared-external-run"
      | "synthetic-test-fixture";
    readonly startedAt: string;
    readonly completedAt: string;
    readonly rawCapturedAt: string;
    readonly executionVerified: false;
  };
  readonly rawArtifact: {
    readonly byteLength: number;
    readonly sha256: string;
  };
  readonly normalizedArtifact: {
    readonly byteLength: number;
    readonly sha256: string;
  };
  readonly rows: readonly CandidateRowLike[];
  readonly candidateChecksum: { readonly value: string };
}

function assertCandidateRowBinding(
  referenceCase: KerrComparisonPlan["cases"][number],
  reference: KerrComparisonReferenceRayBinding,
  candidate: CandidateRowLike,
): void {
  if (
    candidate.caseId !== referenceCase.caseId ||
    candidate.scientificRole !== referenceCase.scientificRole ||
    candidate.requestId !== referenceCase.request.requestId ||
    kerrStableStringify(candidate.requestChecksum) !==
      kerrStableStringify(referenceCase.request.requestChecksum) ||
    candidate.referenceReportId !== referenceCase.report.reportId ||
    kerrStableStringify(candidate.referenceReportChecksum) !==
      kerrStableStringify(referenceCase.report.reportChecksum) ||
    candidate.referenceRayId !== reference.rayId ||
    kerrStableStringify(candidate.referenceRayChecksum) !==
      kerrStableStringify(reference.rayChecksum) ||
    candidate.pixelIndex !== reference.pixelIndex ||
    candidate.pixelX !== reference.pixelX ||
    candidate.pixelY !== reference.pixelY ||
    candidate.screenX !== reference.screenX ||
    candidate.screenY !== reference.screenY
  ) {
    throw new Error(
      "Kerr candidate row does not match its exact frozen reference binding",
    );
  }
}

function orderedPlanRows(
  plan: KerrComparisonPlan,
  candidate: CandidateLike,
): {
  readonly rows: KerrExternalOutputComparisonRow[];
  readonly numericRows: KerrNumericComparisonCoreRow[];
} {
  const expectedCount = plan.cases.reduce(
    (total, referenceCase) => total + referenceCase.rays.length,
    0,
  );
  if (candidate.rows.length !== expectedCount) {
    throw new Error(
      "Kerr candidate does not contain exactly one row per planned reference ray",
    );
  }
  const rows: KerrExternalOutputComparisonRow[] = [];
  const numericRows: KerrNumericComparisonCoreRow[] = [];
  let index = 0;
  for (const referenceCase of plan.cases) {
    for (const reference of referenceCase.rays) {
      const candidateRow = candidate.rows[index];
      if (candidateRow === undefined) {
        throw new Error("Kerr candidate row is missing");
      }
      assertCandidateRowBinding(referenceCase, reference, candidateRow);
      const compared = comparisonRow(
        plan,
        candidate.candidateId,
        referenceCase,
        reference,
        candidateRow,
      );
      rows.push(compared.row);
      numericRows.push(compared.numeric);
      index += 1;
    }
  }
  return { rows, numericRows };
}

function comparisonRow(
  plan: KerrComparisonPlan,
  candidateId: string,
  referenceCase: KerrComparisonPlan["cases"][number],
  reference: KerrComparisonReferenceRayBinding,
  candidate: CandidateRowLike,
): {
  readonly row: KerrExternalOutputComparisonRow;
  readonly numeric: KerrNumericComparisonCoreRow;
} {
  const numeric = compareKerrNumericRow(plan, reference, candidate);
  const reasons = numeric.reasons.map((reason) =>
    KerrComparisonReasonSchema.parse(reason),
  );
  const payload = {
    schemaVersion: "1.0.0" as const,
    planId: plan.planId,
    candidateId,
    caseId: referenceCase.caseId,
    requestId: referenceCase.request.requestId,
    requestChecksum: referenceCase.request.requestChecksum,
    reportId: referenceCase.report.reportId,
    reportChecksum: referenceCase.report.reportChecksum,
    referenceRayId: reference.rayId,
    referenceRayChecksum: reference.rayChecksum,
    candidateRowId: candidate.rowId,
    candidateRowChecksum: candidate.rowChecksum.value,
    pixelIndex: reference.pixelIndex,
    pixelX: reference.pixelX,
    pixelY: reference.pixelY,
    screenX: reference.screenX,
    screenY: reference.screenY,
    referenceTermination: numeric.referenceTermination,
    candidateTermination: numeric.candidateTermination,
    seedComparison: numeric.seedComparison,
    endpointComparison: numeric.endpointComparison,
    disposition: numeric.disposition,
    reasons,
    independentReference: "not-run" as const,
    ...noAuthority,
  };
  const identity = {
    planId: plan.planId,
    planChecksum: plan.planChecksum,
    candidateId,
    caseId: referenceCase.caseId,
    pixelIndex: reference.pixelIndex,
    payloadSha256: kerrSha256Hex(kerrStableStringify(payload)),
  };
  const rowId = `krcrow_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const unsigned = { ...payload, rowId };
  const row = KerrExternalOutputComparisonRowSchema.parse({
    ...unsigned,
    rowChecksum: {
      algorithm: "sha256",
      value: kerrSha256Hex(kerrStableStringify(unsigned)),
      scope: "kerr-external-output-comparison-row",
    },
  });
  return { row, numeric };
}

function comparisonSummary(
  rows: readonly KerrNumericComparisonCoreRow[],
) {
  const summary = summarizeKerrNumericRows(rows);
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

export const KERR_EXTERNAL_COMPARISON_MAX_CANONICAL_BYTES = 2 * 1024 * 1024;

function preflightComparisonRows(
  comparisonInput: unknown,
  expectedLength: number,
): void {
  if (typeof comparisonInput !== "object" || comparisonInput === null) {
    throw new TypeError("Kerr comparison must be a plain object");
  }
  const prototype = Object.getPrototypeOf(comparisonInput);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Kerr comparison must be a plain object");
  }
  const descriptor = Object.getOwnPropertyDescriptor(comparisonInput, "rows");
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError("Kerr comparison rows must be an own data property");
  }
  const rows = descriptor.value;
  if (!Array.isArray(rows)) {
    throw new TypeError("Kerr comparison rows must be an array");
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(rows, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.value !== expectedLength
  ) {
    throw new RangeError(
      "Kerr comparison must preflight exactly one bounded row per planned ray",
    );
  }
  for (let index = 0; index < expectedLength; index += 1) {
    const elementDescriptor = Object.getOwnPropertyDescriptor(
      rows,
      String(index),
    );
    if (elementDescriptor === undefined || !("value" in elementDescriptor)) {
      throw new TypeError(
        "Kerr comparison rows must contain only own data elements",
      );
    }
  }
}

function referenceBindingSha256(plan: KerrComparisonPlan): string {
  const binding = plan.cases.map((referenceCase) => ({
    caseId: referenceCase.caseId,
    request: referenceCase.request,
    report: referenceCase.report,
    rays: referenceCase.rays.map((ray) => ({
      rayId: ray.rayId,
      rayChecksum: ray.rayChecksum,
      pixelIndex: ray.pixelIndex,
    })),
  }));
  return kerrSha256Hex(kerrStableStringify(binding));
}

function assertComparisonChronology(
  plan: KerrComparisonPlan,
  candidate: CandidateLike,
  generatedAt: string,
): void {
  const latestReferenceAt = plan.cases.reduce(
    (latest, referenceCase) =>
      referenceCase.report.generatedAt > latest
        ? referenceCase.report.generatedAt
        : latest,
    plan.frozenAt,
  );
  if (
    generatedAt < plan.frozenAt ||
    generatedAt < latestReferenceAt ||
    generatedAt < candidate.generatedAt
  ) {
    throw new Error(
      "Kerr external-output comparison cannot predate its frozen evidence",
    );
  }
}

function unsignedComparison(
  plan: KerrComparisonPlan,
  candidate: CandidateLike,
  generatedAt: string,
) {
  if (
    candidate.planId !== plan.planId ||
    candidate.planChecksum.value !== plan.planChecksum.value
  ) {
    throw new Error("Kerr candidate is not bound to the comparison plan");
  }
  assertComparisonChronology(plan, candidate, generatedAt);
  const { rows, numericRows } = orderedPlanRows(plan, candidate);
  const referenceBinding = referenceBindingSha256(plan);
  const summary = comparisonSummary(numericRows);
  const identity = {
    planId: plan.planId,
    planChecksum: plan.planChecksum,
    referenceBindingSha256: referenceBinding,
    candidateId: candidate.candidateId,
    candidateChecksum: candidate.candidateChecksum,
    candidateRawArtifact: candidate.rawArtifact,
    candidateNormalizedArtifact: candidate.normalizedArtifact,
    generatedAt,
    rowChecksums: rows.map(({ rowChecksum }) => rowChecksum),
  };
  const comparisonId = `krcmp_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  return {
    schemaVersion: "1.0.0" as const,
    state:
      "machine-compared-declared-external-output-needs-independence-and-scientific-review" as const,
    comparisonId,
    generatedAt,
    plan: {
      planId: plan.planId,
      planChecksum: plan.planChecksum.value,
      frozenAt: plan.frozenAt,
    },
    reference: {
      caseCount: plan.cases.length,
      rowCount: rows.length,
      bindingSha256: referenceBinding,
    },
    candidate: {
      candidateId: candidate.candidateId,
      candidateChecksum: candidate.candidateChecksum.value,
      generatedAt: candidate.generatedAt,
      evidenceClass: candidate.externalRun.evidenceClass,
      runStartedAt: candidate.externalRun.startedAt,
      runCompletedAt: candidate.externalRun.completedAt,
      rawCapturedAt: candidate.externalRun.rawCapturedAt,
      executionVerified: false as const,
      rawBytes: {
        byteLength: candidate.rawArtifact.byteLength,
        sha256: candidate.rawArtifact.sha256,
      },
      normalizedBytes: {
        byteLength: candidate.normalizedArtifact.byteLength,
        sha256: candidate.normalizedArtifact.sha256,
      },
    },
    tolerances: KERR_COMPARISON_PROVISIONAL_TOLERANCES,
    rows,
    summary,
    comparisonExecuted: true as const,
    comparisonScope:
      "numeric-agreement-only-provenance-and-independence-not-established" as const,
    independentReference: "not-run" as const,
    provisionalToleranceAgreementIsValidation: false as const,
    ...noAuthority,
  };
}

function assertComparisonCanonicalByteCap(input: unknown): void {
  const byteLength = new TextEncoder().encode(kerrStableStringify(input)).byteLength;
  if (byteLength > KERR_EXTERNAL_COMPARISON_MAX_CANONICAL_BYTES) {
    throw new RangeError("Kerr comparison exceeds its canonical byte budget");
  }
}

export interface CompareKerrReferenceToExternalCandidateInput {
  readonly referenceBundle: unknown;
  readonly plan: unknown;
  readonly candidate: unknown;
  readonly candidateRawBytes: Uint8Array;
  readonly candidateNormalizedBytes: Uint8Array;
  readonly generatedAt: unknown;
}

function comparisonInputDataValue(
  input: unknown,
  key: keyof CompareKerrReferenceToExternalCandidateInput,
): unknown {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("Kerr comparison input must be a plain object");
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Kerr comparison input must be a plain object");
  }
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`Kerr comparison input.${key} must be an own data property`);
  }
  return descriptor.value;
}

function verifiedComparisonInputs(
  input: CompareKerrReferenceToExternalCandidateInput,
): {
  readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
  readonly plan: KerrComparisonPlan;
  readonly candidate: KerrExternalOutputCandidate;
  readonly generatedAt: string;
} {
  const referenceBundleInput = comparisonInputDataValue(
    input,
    "referenceBundle",
  );
  const planInput = comparisonInputDataValue(input, "plan");
  const candidateInput = comparisonInputDataValue(input, "candidate");
  const candidateRawBytes = comparisonInputDataValue(
    input,
    "candidateRawBytes",
  );
  const candidateNormalizedBytes = comparisonInputDataValue(
    input,
    "candidateNormalizedBytes",
  );
  const generatedAtInput = comparisonInputDataValue(input, "generatedAt");
  assertVerifiedKerrComparisonReferenceBundle(referenceBundleInput);
  assertKerrComparisonPlainDataTree(planInput, "Kerr comparison plan input");
  const plan = KerrComparisonPlanSchema.parse(planInput);
  assertKerrComparisonPlanIntegrity(referenceBundleInput, plan);
  assertKerrComparisonPlainDataTree(
    candidateInput,
    "Kerr external-output candidate input",
  );
  const candidate = KerrExternalOutputCandidateSchema.parse(candidateInput);
  assertKerrExternalOutputCandidateIntegrity(
    referenceBundleInput,
    plan,
    candidate,
  );
  assertKerrExternalOutputCandidateExactBytes(
    candidate,
    candidateRawBytes,
    candidateNormalizedBytes,
  );
  const generatedAt = CanonicalTimestampSchema.parse(generatedAtInput);
  return {
    referenceBundle: referenceBundleInput,
    plan,
    candidate,
    generatedAt,
  };
}

export function compareKerrReferenceToExternalCandidate(
  input: CompareKerrReferenceToExternalCandidateInput,
): KerrExternalOutputComparison {
  const verified = verifiedComparisonInputs(input);
  const unsigned = unsignedComparison(
    verified.plan,
    verified.candidate,
    verified.generatedAt,
  );
  const comparison = KerrExternalOutputComparisonSchema.parse({
    ...unsigned,
    comparisonChecksum: {
      algorithm: "sha256",
      value: kerrSha256Hex(kerrStableStringify(unsigned)),
      scope: "kerr-external-output-comparison",
    },
  });
  assertComparisonCanonicalByteCap(comparison);
  assertKerrExternalOutputComparisonIntegrity(input, comparison);
  return deepFreezeKerr(comparison);
}

export function assertKerrExternalOutputComparisonIntegrity(
  input: CompareKerrReferenceToExternalCandidateInput,
  comparisonInput: unknown,
): asserts comparisonInput is KerrExternalOutputComparison {
  const verified = verifiedComparisonInputs(input);
  const expectedRowCount = verified.plan.cases.reduce(
    (total, referenceCase) => total + referenceCase.rays.length,
    0,
  );
  preflightComparisonRows(comparisonInput, expectedRowCount);
  assertKerrComparisonPlainDataTree(
    comparisonInput,
    "Kerr external-output comparison",
  );
  const comparison = KerrExternalOutputComparisonSchema.parse(comparisonInput);
  if (comparison.generatedAt !== verified.generatedAt) {
    throw new Error(
      "Kerr external-output comparison timestamp does not match its verification context",
    );
  }
  const expectedUnsigned = unsignedComparison(
    verified.plan,
    verified.candidate,
    verified.generatedAt,
  );
  const { comparisonChecksum, ...actualUnsigned } = comparison;
  if (
    kerrStableStringify(actualUnsigned) !==
    kerrStableStringify(expectedUnsigned)
  ) {
    throw new Error(
      "Kerr external-output comparison does not match deterministic recomputation",
    );
  }
  if (
    comparisonChecksum.value !==
    kerrSha256Hex(kerrStableStringify(actualUnsigned))
  ) {
    throw new Error("Kerr external-output comparison checksum mismatch");
  }
  assertComparisonCanonicalByteCap(comparison);
}

/** No machine comparison in this package can authorize renderer use. */
export function canUseKerrExternalComparisonForRender(_input: unknown): false {
  return false;
}
