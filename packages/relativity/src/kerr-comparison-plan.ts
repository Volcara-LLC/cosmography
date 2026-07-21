import { z } from "zod";

import {
  KERR_REFERENCE_TRACE_EVENT_LOCALIZATION_ITERATIONS,
  KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS,
  KERR_REFERENCE_TRACE_MAX_EVENT_LOCALIZATION_RK4_EVALUATIONS_PER_PASS,
  KERR_REFERENCE_TRACE_MAX_PIXELS,
  KERR_REFERENCE_TRACE_MAX_RK4_EVALUATIONS_PER_PASS,
  type KerrReferenceRayRecord,
  type KerrReferenceTraceReport,
  type KerrReferenceTraceRequest,
  KerrReferenceTraceReportSchema,
  KerrReferenceTraceRequestSchema,
  assertKerrReferenceTraceReportIntegrity,
  assertKerrReferenceTraceRequestIntegrity,
  deepFreezeKerr,
  kerrSha256Hex,
  kerrStableStringify,
} from "./trace-contracts.js";

export const KERR_COMPARISON_POLICY_VERSION = "1.0.0" as const;
export const KERR_COMPARISON_MAX_CASES = 8;
export const KERR_COMPARISON_MAX_TOTAL_PIXELS = KERR_REFERENCE_TRACE_MAX_PIXELS;
export const KERR_COMPARISON_MAX_PLAN_CANONICAL_BYTES = 2 * 1024 * 1024;
export const KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES = 1024 * 1024;
export const KERR_COMPARISON_MAX_CANDIDATE_CANONICAL_BYTES = 2 * 1024 * 1024;
export const KERR_COMPARISON_MAX_REFERENCE_SOLVER_PASSES = 5;
export const KERR_COMPARISON_MAX_TOTAL_CONFIGURED_ACCEPTED_STEPS =
  KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS *
  KERR_COMPARISON_MAX_REFERENCE_SOLVER_PASSES;
export const KERR_COMPARISON_MAX_TOTAL_EVENT_LOCALIZATION_RK4_EVALUATIONS =
  KERR_REFERENCE_TRACE_MAX_EVENT_LOCALIZATION_RK4_EVALUATIONS_PER_PASS *
  KERR_COMPARISON_MAX_REFERENCE_SOLVER_PASSES;
export const KERR_COMPARISON_MAX_TOTAL_RK4_EVALUATIONS =
  KERR_REFERENCE_TRACE_MAX_RK4_EVALUATIONS_PER_PASS *
  KERR_COMPARISON_MAX_REFERENCE_SOLVER_PASSES;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const FullGitCommitSchema = z
  .string()
  .regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
const CanonicalTimestampSchema = z.iso.datetime({
  offset: false,
  precision: 0,
});
const FiniteSchema = z.number().finite();
const BoundedFiniteSchema = FiniteSchema.min(-1e12).max(1e12);
const BoundedNonnegativeFiniteSchema = FiniteSchema.nonnegative().max(1e12);
const BoundedTextSchema = z.string().trim().min(1).max(240);

const KERR_COMPARISON_MAX_PLAIN_DATA_NODES = 100_000;
const KERR_COMPARISON_MAX_PLAIN_DATA_DEPTH = 32;

/**
 * Rejects accessors, sparse/custom arrays, cycles, exotic prototypes, symbol
 * keys, and oversized trees without invoking caller-owned property getters.
 */
export function assertKerrComparisonPlainDataTree(
  input: unknown,
  label: string,
): void {
  const ancestors = new WeakSet<object>();
  let nodes = 0;

  function visit(value: unknown, depth: number): void {
    nodes += 1;
    if (
      nodes > KERR_COMPARISON_MAX_PLAIN_DATA_NODES ||
      depth > KERR_COMPARISON_MAX_PLAIN_DATA_DEPTH
    ) {
      throw new RangeError(`${label} exceeds its plain-data complexity budget`);
    }
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      return;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new TypeError(`${label} contains a non-finite number`);
      }
      return;
    }
    if (typeof value !== "object") {
      throw new TypeError(`${label} must contain only canonical plain data`);
    }
    if (ancestors.has(value)) {
      throw new TypeError(`${label} must not contain cycles`);
    }
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
        const length =
          lengthDescriptor !== undefined && "value" in lengthDescriptor
            ? lengthDescriptor.value
            : undefined;
        if (
          typeof length !== "number" ||
          !Number.isInteger(length) ||
          length < 0 ||
          length > KERR_REFERENCE_TRACE_MAX_PIXELS
        ) {
          throw new RangeError(`${label} contains an oversized array`);
        }
        const keys = Reflect.ownKeys(value);
        if (keys.length !== length + 1 || !keys.includes("length")) {
          throw new TypeError(
            `${label} arrays must be dense and contain no custom properties`,
          );
        }
        for (let index = 0; index < length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(
            value,
            String(index),
          );
          if (
            descriptor === undefined ||
            !("value" in descriptor) ||
            descriptor.enumerable !== true
          ) {
            throw new TypeError(
              `${label} arrays must contain only own enumerable data elements`,
            );
          }
          visit(descriptor.value, depth + 1);
        }
        return;
      }
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(`${label} contains a non-plain object`);
      }
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== "string") {
          throw new TypeError(`${label} contains a symbol key`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (
          descriptor === undefined ||
          !("value" in descriptor) ||
          descriptor.enumerable !== true
        ) {
          throw new TypeError(
            `${label} objects must contain only own enumerable data properties`,
          );
        }
        visit(descriptor.value, depth + 1);
      }
    } finally {
      ancestors.delete(value);
    }
  }

  visit(input, 0);
}

const noAuthorityShape = {
  scientificValidationPassed: z.literal(false),
  independentValidationPassed: z.literal(false),
  implementationProvenanceVerified: z.literal(false),
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

export const KERR_COMPARISON_NO_AUTHORITY = deepFreezeKerr({
  scientificValidationPassed: false,
  independentValidationPassed: false,
  implementationProvenanceVerified: false,
  sourceReviewed: false,
  licenseVerified: false,
  runnerEnvironmentVerified: false,
  checksumAuthenticatesRecord: false,
  renderAllowed: false,
  productionUseAllowed: false,
  placeholderReplacementAllowed: false,
  releaseEligible: false,
  publicationAllowed: false,
  activationAllowed: false,
} as const);

export const KERR_COMPARISON_PROVISIONAL_TOLERANCES = deepFreezeKerr({
  status: "provisional-internal-convergence-derived-not-independently-validated",
  initialMomentumOverEnergyMaxAbsolute: 2e-12,
  xiMaxAbsolute: 2e-12,
  etaMaxAbsolute: 2e-11,
  etaMaxRelative: 2e-12,
  endpointSphereChordMaxAbsolute: 2e-6,
  endpointMomentumOverEnergyMaxAbsolute: 5e-5,
  endpointMomentumOverEnergyMaxRelative: 1e-5,
  eventRadiusMaxAbsoluteRg: 1e-9,
  terminationMustMatchExactly: true,
  azimuthWindingMustMatchExactly: true,
} as const);

export const KERR_COMPARISON_LIMITS = deepFreezeKerr({
  maxCases: KERR_COMPARISON_MAX_CASES,
  maxTotalPixels: KERR_COMPARISON_MAX_TOTAL_PIXELS,
  maxConfiguredAcceptedStepsPerReferenceSolverPass:
    KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS,
  maxPlanCanonicalBytes: KERR_COMPARISON_MAX_PLAN_CANONICAL_BYTES,
  maxCandidateRawBytes: KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
  maxCandidateCanonicalBytes: KERR_COMPARISON_MAX_CANDIDATE_CANONICAL_BYTES,
  maxReferenceSolverPasses: KERR_COMPARISON_MAX_REFERENCE_SOLVER_PASSES,
  eventLocalizationIterations:
    KERR_REFERENCE_TRACE_EVENT_LOCALIZATION_ITERATIONS,
  maxEventLocalizationRk4EvaluationsPerReferenceSolverPass:
    KERR_REFERENCE_TRACE_MAX_EVENT_LOCALIZATION_RK4_EVALUATIONS_PER_PASS,
  maxRk4EvaluationsPerReferenceSolverPass:
    KERR_REFERENCE_TRACE_MAX_RK4_EVALUATIONS_PER_PASS,
  maxTotalConfiguredAcceptedSteps:
    KERR_COMPARISON_MAX_TOTAL_CONFIGURED_ACCEPTED_STEPS,
  maxTotalEventLocalizationRk4Evaluations:
    KERR_COMPARISON_MAX_TOTAL_EVENT_LOCALIZATION_RK4_EVALUATIONS,
  maxTotalRk4Evaluations: KERR_COMPARISON_MAX_TOTAL_RK4_EVALUATIONS,
});

const NoAuthoritySchema = z.object(noAuthorityShape).strict();

export const KerrComparisonScientificRoleSchema = z.enum([
  "schwarzschild-baseline",
  "prograde-spin",
  "retrograde-spin",
  "inclined-observer",
  "high-spin-stress",
  "weak-field",
  "near-critical",
  "equatorial-symmetry",
]);
export type KerrComparisonScientificRole = z.infer<
  typeof KerrComparisonScientificRoleSchema
>;

const CanonicalHttpsRepositorySchema = z
  .url()
  .max(500)
  .superRefine((value, context) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      context.addIssue({ code: "custom", message: "Repository URL is invalid" });
      return;
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.search !== "" ||
      parsed.hash !== "" ||
      parsed.pathname.includes("%") ||
      parsed.hostname !== parsed.hostname.toLowerCase() ||
      parsed.hostname.endsWith(".") ||
      parsed.href !== value
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Repository URL must be canonical credential-free HTTPS without query or fragment",
      });
    }
  });

const GitIdentitySchema = z
  .object({
    system: z.literal("git"),
    commitAlgorithm: z.enum(["sha1", "sha256"]),
    commit: FullGitCommitSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const expectedLength = value.commitAlgorithm === "sha1" ? 40 : 64;
    if (value.commit.length !== expectedLength) {
      context.addIssue({
        code: "custom",
        path: ["commit"],
        message: "Git commit length does not match its declared algorithm",
      });
    }
  });

export const KerrComparisonExternalImplementationSchema = z
  .object({
    implementationId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
    displayName: z.string().trim().min(1).max(120),
    upstreamRepositoryUrl: CanonicalHttpsRepositorySchema,
    version: z.string().trim().min(1).max(64),
    vcs: GitIdentitySchema,
    sourceArchive: z
      .object({
        byteLength: z.number().int().positive().max(8 * 1024 * 1024 * 1024),
        sha256: Sha256Schema,
      })
      .strict(),
    environment: z
      .object({
        language: BoundedTextSchema,
        runtime: BoundedTextSchema,
        compiler: BoundedTextSchema,
        platform: BoundedTextSchema,
        architecture: BoundedTextSchema,
        precision: z.literal("ieee-754-binary64"),
        buildRecipeSha256: Sha256Schema,
        environmentManifestSha256: Sha256Schema,
        runRecipeSha256: Sha256Schema,
      })
      .strict(),
    algorithm: z
      .object({
        geodesicMethod: BoundedTextSchema,
        integrator: BoundedTextSchema,
        errorControl: BoundedTextSchema,
        cameraConstruction: BoundedTextSchema,
      })
      .strict(),
    license: z
      .object({
        spdxExpression: z.string().trim().min(1).max(160),
        licenseTextSha256: Sha256Schema,
        codeReview: z.literal("not-run"),
        outputRightsReview: z.literal("not-run"),
      })
      .strict(),
    provenance: z.literal("caller-declared-unverified"),
    independenceRequirements: z
      .object({
        separateImplementationRequired: z.literal(true),
        noCosmographySolverCodeReuseRequired: z.literal(true),
        noCosmographyGeneratedFixtureReuseRequired: z.literal(true),
        reviewState: z.literal("required-not-reviewed"),
      })
      .strict(),
    ...noAuthorityShape,
  })
  .strict()
  .superRefine((value, context) => {
    const repository = new URL(value.upstreamRepositoryUrl);
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(repository.pathname);
    } catch {
      context.addIssue({
        code: "custom",
        path: ["upstreamRepositoryUrl"],
        message: "Repository path contains invalid percent encoding",
      });
      return;
    }
    const normalizedPath = decodedPath
      .replace(/\/{2,}/g, "/")
      .replace(/\/+$/, "")
      .toLowerCase();
    const pathSegments = normalizedPath.split("/").filter(Boolean);
    const normalizedHost = repository.hostname
      .toLowerCase()
      .replace(/^www\./, "");
    const owner = pathSegments[0];
    const repositoryName = pathSegments[1]?.replace(/\.+git$/i, "");
    if (
      value.implementationId === "cosmography-kerr-vacuum-reference" ||
      (normalizedHost === "github.com" &&
        owner === "volcara" &&
        repositoryName === "cosmography")
    ) {
      context.addIssue({
        code: "custom",
        message:
          "The current Cosmography Kerr reference cannot be declared as the external implementation",
      });
    }
  });
export type KerrComparisonExternalImplementation = z.infer<
  typeof KerrComparisonExternalImplementationSchema
>;

export const KerrComparisonMappingSchema = z
  .object({
    normalizerId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
    version: z.string().trim().min(1).max(64),
    vcs: GitIdentitySchema,
    sourceSha256: Sha256Schema,
    provenance: z.literal("caller-declared-unverified"),
    canonicalization: z.literal(
      "review-required-external-output-to-cosmography-kerr-comparison-v1",
    ),
    sourceOrientationDisclosure: z.string().trim().min(1).max(2_000),
    targetConventions: z
      .object({
        units: z.literal("G=M=c=1"),
        metricSignature: z.literal("-+++"),
        coordinates: z.literal("Boyer-Lindquist"),
        thetaMeaning: z.literal("colatitude-radians"),
        spinMeaning: z.literal("signed-a-over-M"),
        momentumOrder: z.literal("p_t,p_r,p_theta,p_phi"),
        energyMeaning: z.literal("E=-p_t"),
        angularMomentumMeaning: z.literal("L_z=p_phi"),
        carterMeaning: z.literal("Q-not-K"),
        rayOrientation: z.literal("future-directed-camera-emitted-inward"),
        screenBasis: z.literal(
          "screen-x=+e-phi;screen-y=-e-theta;inward=-e-r",
        ),
        azimuthRepresentation: z.literal(
          "wrapped-[0,2pi)-plus-signed-integer-winding",
        ),
      })
      .strict(),
    reviewState: z.literal("not-run"),
    ...noAuthorityShape,
  })
  .strict();
export type KerrComparisonMapping = z.infer<
  typeof KerrComparisonMappingSchema
>;

const CanonicalByteBindingSchema = z
  .object({
    encoding: z.literal("utf-8"),
    canonicalization: z.literal("kerr-stable-json-v1"),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(KERR_COMPARISON_MAX_PLAN_CANONICAL_BYTES),
    sha256: Sha256Schema,
  })
  .strict();

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

const NormalizedMomentumSchema = z
  .object({
    pTOverEnergy: BoundedFiniteSchema,
    pROverEnergy: BoundedFiniteSchema,
    pThetaOverEnergy: BoundedFiniteSchema,
    pPhiOverEnergy: BoundedFiniteSchema,
  })
  .strict();

export const KerrComparisonReferenceRayBindingSchema = z
  .object({
    rayId: z.string().regex(/^krray_[a-f0-9]{24}$/),
    rayChecksum: ReferenceChecksumSchema,
    pixelIndex: z.number().int().min(0).max(KERR_REFERENCE_TRACE_MAX_PIXELS - 1),
    pixelX: z.number().int().min(0).max(24),
    pixelY: z.number().int().min(0).max(24),
    screenX: FiniteSchema.min(-32).max(32),
    screenY: FiniteSchema.min(-32).max(32),
    initialMomentum: NormalizedMomentumSchema,
    constants: z
      .object({
        xiAngularMomentumOverEnergy: BoundedFiniteSchema,
        etaCarterQOverEnergySquared: BoundedFiniteSchema,
      })
      .strict(),
    referenceOutcome: z
      .object({
        termination: z.enum([
          "captured-horizon-guard",
          "escaped-domain",
        ]),
        eventSurface: z.enum([
          "horizon-guard",
          "finite-escape-domain",
        ]),
        endpoint: z
          .object({
            radiusRg: FiniteSchema.positive().max(1e12),
            thetaRadians: FiniteSchema.min(0).max(Math.PI),
            phiWrappedRadians: FiniteSchema.min(0).max(2 * Math.PI),
            phiWinding: z.number().int().safe(),
            momentum: NormalizedMomentumSchema,
            coordinateTime: BoundedFiniteSchema,
            energyTimesAffineParameter: BoundedNonnegativeFiniteSchema,
          })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedSurface =
      value.referenceOutcome.termination === "captured-horizon-guard"
        ? "horizon-guard"
        : "finite-escape-domain";
    if (value.referenceOutcome.eventSurface !== expectedSurface) {
      context.addIssue({
        code: "custom",
        path: ["referenceOutcome", "eventSurface"],
        message: "Reference event surface does not match termination",
      });
    }
  });
export type KerrComparisonReferenceRayBinding = z.infer<
  typeof KerrComparisonReferenceRayBindingSchema
>;

export const KerrComparisonCaseBindingSchema = z
  .object({
    caseId: z.string().regex(/^krcase_[a-z0-9][a-z0-9-]{2,63}$/),
    scientificRole: KerrComparisonScientificRoleSchema,
    request: z
      .object({
        requestId: z.string().regex(/^krreq_[a-f0-9]{24}$/),
        requestChecksum: ReferenceChecksumSchema,
        canonicalBytes: CanonicalByteBindingSchema,
      })
      .strict(),
    report: z
      .object({
        reportId: z.string().regex(/^krrep_[a-f0-9]{24}$/),
        reportChecksum: ReferenceChecksumSchema,
        generatedAt: CanonicalTimestampSchema,
        canonicalBytes: CanonicalByteBindingSchema,
      })
      .strict(),
    spin: FiniteSchema.min(-0.999).max(0.999),
    grid: z
      .object({
        width: z.number().int().positive().max(25),
        height: z.number().int().positive().max(25),
        sampling: z.literal("pixel-centers-row-major"),
      })
      .strict(),
    eventSurfaces: z
      .object({
        horizonGuardRadiusRg: FiniteSchema.positive().max(1e12),
        finiteEscapeDomainRadiusRg: FiniteSchema.positive().max(1e12),
      })
      .strict(),
    rays: z
      .array(KerrComparisonReferenceRayBindingSchema)
      .min(1)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
  })
  .strict();
export type KerrComparisonCaseBinding = z.infer<
  typeof KerrComparisonCaseBindingSchema
>;

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

const LimitsSchema = z
  .object({
    maxCases: z.literal(KERR_COMPARISON_MAX_CASES),
    maxTotalPixels: z.literal(KERR_COMPARISON_MAX_TOTAL_PIXELS),
    maxConfiguredAcceptedStepsPerReferenceSolverPass: z.literal(
      KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS,
    ),
    maxPlanCanonicalBytes: z.literal(
      KERR_COMPARISON_MAX_PLAN_CANONICAL_BYTES,
    ),
    maxCandidateRawBytes: z.literal(KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES),
    maxCandidateCanonicalBytes: z.literal(
      KERR_COMPARISON_MAX_CANDIDATE_CANONICAL_BYTES,
    ),
    maxReferenceSolverPasses: z.literal(
      KERR_COMPARISON_MAX_REFERENCE_SOLVER_PASSES,
    ),
    eventLocalizationIterations: z.literal(
      KERR_REFERENCE_TRACE_EVENT_LOCALIZATION_ITERATIONS,
    ),
    maxEventLocalizationRk4EvaluationsPerReferenceSolverPass: z.literal(
      KERR_REFERENCE_TRACE_MAX_EVENT_LOCALIZATION_RK4_EVALUATIONS_PER_PASS,
    ),
    maxRk4EvaluationsPerReferenceSolverPass: z.literal(
      KERR_REFERENCE_TRACE_MAX_RK4_EVALUATIONS_PER_PASS,
    ),
    maxTotalConfiguredAcceptedSteps: z.literal(
      KERR_COMPARISON_MAX_TOTAL_CONFIGURED_ACCEPTED_STEPS,
    ),
    maxTotalEventLocalizationRk4Evaluations: z.literal(
      KERR_COMPARISON_MAX_TOTAL_EVENT_LOCALIZATION_RK4_EVALUATIONS,
    ),
    maxTotalRk4Evaluations: z.literal(
      KERR_COMPARISON_MAX_TOTAL_RK4_EVALUATIONS,
    ),
  })
  .strict();

const PlanChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-external-output-comparison-plan"),
  })
  .strict();

export const KerrComparisonPlanSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("awaiting-reviewed-independent-fixtures"),
    planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
    policyVersion: z.literal(KERR_COMPARISON_POLICY_VERSION),
    frozenAt: CanonicalTimestampSchema,
    declaredCodeCommit: FullGitCommitSchema,
    comparisonScope: z.enum(["integrator-only", "camera-and-solver"]),
    externalImplementation: KerrComparisonExternalImplementationSchema,
    mapping: KerrComparisonMappingSchema,
    cases: z
      .array(KerrComparisonCaseBindingSchema)
      .min(1)
      .max(KERR_COMPARISON_MAX_CASES),
    tolerances: TolerancesSchema,
    limits: LimitsSchema,
    independentReference: z.literal("not-run"),
    reviewState: z.literal("not-run"),
    comparisonExecuted: z.literal(false),
    comparisonResult: z.literal("not-run"),
    provisionalToleranceAgreementIsValidation: z.literal(false),
    ...noAuthorityShape,
    planChecksum: PlanChecksumSchema,
  })
  .strict();
export type KerrComparisonPlan = z.infer<typeof KerrComparisonPlanSchema>;

export interface KerrComparisonReferenceCase {
  readonly caseId: string;
  readonly scientificRole: KerrComparisonScientificRole;
  readonly request: KerrReferenceTraceRequest;
  readonly report: KerrReferenceTraceReport;
}

export interface VerifiedKerrComparisonReferenceBundle {
  readonly cases: readonly KerrComparisonReferenceCase[];
  readonly totalPixels: number;
  readonly configuredAcceptedStepsPerReferenceSolverPass: number;
  readonly verificationState: "verified-in-process-reference-integrity-only";
}

const verifiedReferenceBundles = new WeakSet<object>();

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

function preflightBoundedArray(
  input: unknown,
  minimum: number,
  maximum: number,
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
    length < minimum ||
    length > maximum
  ) {
    throw new RangeError(`${label} exceeds its bounded length`);
  }
  return input;
}

function boundedArrayDataElement(
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

function utf8ByteBinding(value: unknown) {
  const canonical = kerrStableStringify(value);
  return {
    encoding: "utf-8" as const,
    canonicalization: "kerr-stable-json-v1" as const,
    byteLength: new TextEncoder().encode(canonical).byteLength,
    sha256: kerrSha256Hex(canonical),
  };
}

function splitAzimuth(phi: number): {
  readonly phiWrappedRadians: number;
  readonly phiWinding: number;
} {
  const twoPi = 2 * Math.PI;
  let winding = Math.floor(phi / twoPi);
  let wrapped = phi - winding * twoPi;
  if (wrapped < 0) {
    wrapped += twoPi;
    winding -= 1;
  } else if (wrapped >= twoPi) {
    wrapped -= twoPi;
    winding += 1;
  }
  return {
    phiWrappedRadians: Object.is(wrapped, -0) ? 0 : wrapped,
    phiWinding: winding,
  };
}

function normalizedMomentum(
  rayState: KerrReferenceRayRecord["initialState"],
  energy: number,
) {
  return {
    pTOverEnergy: rayState.pT / energy,
    pROverEnergy: rayState.pR / energy,
    pThetaOverEnergy: rayState.pTheta / energy,
    pPhiOverEnergy: rayState.pPhi / energy,
  };
}

function referenceRayBinding(
  ray: KerrReferenceRayRecord,
): KerrComparisonReferenceRayBinding {
  const energy = ray.constants.energy;
  const azimuth = splitAzimuth(ray.finalState.phi);
  const termination =
    ray.termination === "captured-horizon-guard"
      ? "captured-horizon-guard"
      : "escaped-domain";
  return KerrComparisonReferenceRayBindingSchema.parse({
    rayId: ray.rayId,
    rayChecksum: ray.rayChecksum,
    pixelIndex: ray.pixelIndex,
    pixelX: ray.pixelX,
    pixelY: ray.pixelY,
    screenX: ray.screenX,
    screenY: ray.screenY,
    initialMomentum: normalizedMomentum(ray.initialState, energy),
    constants: {
      xiAngularMomentumOverEnergy: ray.constants.angularMomentumZ / energy,
      etaCarterQOverEnergySquared: ray.constants.carterQ / energy ** 2,
    },
    referenceOutcome: {
      termination,
      eventSurface:
        termination === "captured-horizon-guard"
          ? "horizon-guard"
          : "finite-escape-domain",
      endpoint: {
        radiusRg: ray.finalState.r,
        thetaRadians: ray.finalState.theta,
        ...azimuth,
        momentum: normalizedMomentum(ray.finalState, energy),
        coordinateTime: ray.finalState.t,
        energyTimesAffineParameter: energy * ray.affineParameter,
      },
    },
  });
}

function caseBinding(
  referenceCase: KerrComparisonReferenceCase,
): KerrComparisonCaseBinding {
  const { request, report } = referenceCase;
  return KerrComparisonCaseBindingSchema.parse({
    caseId: referenceCase.caseId,
    scientificRole: referenceCase.scientificRole,
    request: {
      requestId: request.requestId,
      requestChecksum: request.requestChecksum,
      canonicalBytes: utf8ByteBinding(request),
    },
    report: {
      reportId: report.reportId,
      reportChecksum: report.reportChecksum,
      generatedAt: report.generatedAt,
      canonicalBytes: utf8ByteBinding(report),
    },
    spin: request.spin,
    grid: request.grid,
    eventSurfaces: {
      horizonGuardRadiusRg:
        1 + Math.sqrt(1 - request.spin ** 2) +
        request.integration.horizonGuardRg,
      finiteEscapeDomainRadiusRg: request.integration.escapeRadiusRg,
    },
    rays: report.rays.map(referenceRayBinding),
  });
}

export interface VerifyKerrComparisonReferenceBundleInput {
  readonly cases: readonly unknown[];
}

export function verifyKerrComparisonReferenceBundle(
  input: VerifyKerrComparisonReferenceBundleInput,
): VerifiedKerrComparisonReferenceBundle {
  const rawCases = preflightBoundedArray(
    ownDataValue(input, "cases", "Kerr comparison reference bundle"),
    1,
    KERR_COMPARISON_MAX_CASES,
    "Kerr comparison reference cases",
  );
  const caseIds = new Set<string>();
  const requestIds = new Set<string>();
  const reportIds = new Set<string>();
  const cases: KerrComparisonReferenceCase[] = [];
  let totalPixels = 0;
  let configuredAcceptedStepsPerReferenceSolverPass = 0;
  const caseCount = Object.getOwnPropertyDescriptor(rawCases, "length")!
    .value as number;

  for (let index = 0; index < caseCount; index += 1) {
    const rawCase = boundedArrayDataElement(
      rawCases,
      index,
      "Kerr comparison reference cases",
    );
    const label = `Kerr comparison reference case ${index}`;
    const caseId = z
      .string()
      .regex(/^krcase_[a-z0-9][a-z0-9-]{2,63}$/)
      .parse(ownDataValue(rawCase, "caseId", label));
    const scientificRole = KerrComparisonScientificRoleSchema.parse(
      ownDataValue(rawCase, "scientificRole", label),
    );
    const requestInput = ownDataValue(rawCase, "request", label);
    const reportInput = ownDataValue(rawCase, "report", label);
    assertKerrComparisonPlainDataTree(requestInput, `${label} request`);
    assertKerrComparisonPlainDataTree(reportInput, `${label} report`);
    assertKerrReferenceTraceRequestIntegrity(requestInput);
    assertKerrReferenceTraceReportIntegrity(requestInput, reportInput);
    // Retain only Zod-owned plain copies. A verified capability must never keep
    // caller accessors or proxies after the bounded replay has completed.
    const request = KerrReferenceTraceRequestSchema.parse(requestInput);
    const report = KerrReferenceTraceReportSchema.parse(reportInput);
    if (
      caseIds.has(caseId) ||
      requestIds.has(request.requestId) ||
      reportIds.has(report.reportId)
    ) {
      throw new Error(
        "Kerr comparison cases, requests, and reports must be unique",
      );
    }
    if (
      report.rays.some(
        (ray) =>
          ray.termination !== "captured-horizon-guard" &&
          ray.termination !== "escaped-domain",
      )
    ) {
      throw new Error(
        "Kerr comparison reference cases require fully resolved event outcomes",
      );
    }
    caseIds.add(caseId);
    requestIds.add(request.requestId);
    reportIds.add(report.reportId);
    const pixels = request.grid.width * request.grid.height;
    totalPixels += pixels;
    configuredAcceptedStepsPerReferenceSolverPass +=
      pixels * request.integration.maxSteps;
    if (
      totalPixels > KERR_COMPARISON_MAX_TOTAL_PIXELS ||
      configuredAcceptedStepsPerReferenceSolverPass >
        KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS
    ) {
      throw new RangeError(
        "Kerr comparison reference bundle exceeds its aggregate work budget",
      );
    }
    cases.push({ caseId, scientificRole, request, report });
  }

  const verified = deepFreezeKerr({
    cases,
    totalPixels,
    configuredAcceptedStepsPerReferenceSolverPass,
    verificationState: "verified-in-process-reference-integrity-only" as const,
  });
  verifiedReferenceBundles.add(verified);
  return verified;
}

export function assertVerifiedKerrComparisonReferenceBundle(
  input: unknown,
): asserts input is VerifiedKerrComparisonReferenceBundle {
  if (
    typeof input !== "object" ||
    input === null ||
    !verifiedReferenceBundles.has(input)
  ) {
    throw new Error(
      "Kerr comparison reference bundle must be verified in this process; structural copies are rejected",
    );
  }
}

export interface CreateKerrComparisonPlanInput {
  readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
  readonly frozenAt: unknown;
  readonly declaredCodeCommit: unknown;
  readonly comparisonScope: unknown;
  readonly externalImplementation: unknown;
  readonly mapping: unknown;
}

function unsignedPlan(
  bundle: VerifiedKerrComparisonReferenceBundle,
  parsed: {
    readonly frozenAt: string;
    readonly declaredCodeCommit: string;
    readonly comparisonScope: "integrator-only" | "camera-and-solver";
    readonly externalImplementation: KerrComparisonExternalImplementation;
    readonly mapping: KerrComparisonMapping;
  },
) {
  const cases = bundle.cases.map(caseBinding);
  const identity = {
    policyVersion: KERR_COMPARISON_POLICY_VERSION,
    frozenAt: parsed.frozenAt,
    declaredCodeCommit: parsed.declaredCodeCommit,
    comparisonScope: parsed.comparisonScope,
    externalImplementation: parsed.externalImplementation,
    mapping: parsed.mapping,
    cases,
    tolerances: KERR_COMPARISON_PROVISIONAL_TOLERANCES,
  };
  const planId = `krcplan_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  return {
    schemaVersion: "1.0.0" as const,
    state: "awaiting-reviewed-independent-fixtures" as const,
    planId,
    policyVersion: KERR_COMPARISON_POLICY_VERSION,
    frozenAt: parsed.frozenAt,
    declaredCodeCommit: parsed.declaredCodeCommit,
    comparisonScope: parsed.comparisonScope,
    externalImplementation: parsed.externalImplementation,
    mapping: parsed.mapping,
    cases,
    tolerances: KERR_COMPARISON_PROVISIONAL_TOLERANCES,
    limits: KERR_COMPARISON_LIMITS,
    independentReference: "not-run" as const,
    reviewState: "not-run" as const,
    comparisonExecuted: false as const,
    comparisonResult: "not-run" as const,
    provisionalToleranceAgreementIsValidation: false as const,
    ...KERR_COMPARISON_NO_AUTHORITY,
  };
}

export function createKerrComparisonPlan(
  input: CreateKerrComparisonPlanInput,
): KerrComparisonPlan {
  const referenceBundle = ownDataValue(
    input,
    "referenceBundle",
    "Kerr comparison plan input",
  );
  assertVerifiedKerrComparisonReferenceBundle(referenceBundle);
  const parsed = z
    .object({
      frozenAt: CanonicalTimestampSchema,
      declaredCodeCommit: FullGitCommitSchema,
      comparisonScope: z.enum(["integrator-only", "camera-and-solver"]),
      externalImplementation: KerrComparisonExternalImplementationSchema,
      mapping: KerrComparisonMappingSchema,
    })
    .strict()
    .parse((() => {
      const externalImplementation = ownDataValue(
        input,
        "externalImplementation",
        "Kerr comparison plan input",
      );
      const mapping = ownDataValue(
        input,
        "mapping",
        "Kerr comparison plan input",
      );
      assertKerrComparisonPlainDataTree(
        externalImplementation,
        "Kerr comparison external implementation",
      );
      assertKerrComparisonPlainDataTree(mapping, "Kerr comparison mapping");
      return {
      frozenAt: ownDataValue(
        input,
        "frozenAt",
        "Kerr comparison plan input",
      ),
      declaredCodeCommit: ownDataValue(
        input,
        "declaredCodeCommit",
        "Kerr comparison plan input",
      ),
      comparisonScope: ownDataValue(
        input,
        "comparisonScope",
        "Kerr comparison plan input",
      ),
        externalImplementation,
        mapping,
      };
    })());
  if (
    referenceBundle.cases.some(
      ({ request, report }) =>
        parsed.frozenAt < request.frozenAt || parsed.frozenAt < report.generatedAt,
    )
  ) {
    throw new Error(
      "Kerr comparison plan cannot be frozen before its reference evidence",
    );
  }
  const unsigned = unsignedPlan(referenceBundle, parsed);
  const plan = KerrComparisonPlanSchema.parse({
    ...unsigned,
    planChecksum: {
      algorithm: "sha256",
      value: kerrSha256Hex(kerrStableStringify(unsigned)),
      scope: "kerr-external-output-comparison-plan",
    },
  });
  const byteLength = new TextEncoder().encode(kerrStableStringify(plan)).byteLength;
  if (byteLength > KERR_COMPARISON_MAX_PLAN_CANONICAL_BYTES) {
    throw new RangeError("Kerr comparison plan exceeds its canonical byte budget");
  }
  assertKerrComparisonPlanIntegrity(referenceBundle, plan);
  return deepFreezeKerr(plan);
}

export function assertKerrComparisonPlanIntegrity(
  bundleInput: unknown,
  planInput: unknown,
): asserts planInput is KerrComparisonPlan {
  assertVerifiedKerrComparisonReferenceBundle(bundleInput);
  assertKerrComparisonPlainDataTree(planInput, "Kerr comparison plan");
  const plan = KerrComparisonPlanSchema.parse(planInput);
  if (
    bundleInput.cases.some(
      ({ request, report }) =>
        plan.frozenAt < request.frozenAt || plan.frozenAt < report.generatedAt,
    )
  ) {
    throw new Error("Kerr comparison plan chronology mismatch");
  }
  const expectedUnsigned = unsignedPlan(bundleInput, {
    frozenAt: plan.frozenAt,
    declaredCodeCommit: plan.declaredCodeCommit,
    comparisonScope: plan.comparisonScope,
    externalImplementation: plan.externalImplementation,
    mapping: plan.mapping,
  });
  const { planChecksum, ...actualUnsigned } = plan;
  if (
    kerrStableStringify(actualUnsigned) !==
    kerrStableStringify(expectedUnsigned)
  ) {
    throw new Error("Kerr comparison plan does not match its verified reference bundle");
  }
  if (
    planChecksum.value !== kerrSha256Hex(kerrStableStringify(actualUnsigned))
  ) {
    throw new Error("Kerr comparison plan checksum mismatch");
  }
  const byteLength = new TextEncoder().encode(kerrStableStringify(plan)).byteLength;
  if (byteLength > KERR_COMPARISON_MAX_PLAN_CANONICAL_BYTES) {
    throw new RangeError("Kerr comparison plan exceeds its canonical byte budget");
  }
}

/** A comparison plan is only a frozen protocol and can never authorize use. */
export function canUseKerrComparisonPlanForRender(_input: unknown): false {
  return false;
}
