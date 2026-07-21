import { createHash } from "node:crypto";

import { z } from "zod";

import { outerHorizonRadiusRg } from "./kerr.js";
import {
  KERR_REFERENCE_EVENT_LOCALIZATION_ITERATIONS,
  createKerrZamoScreenRay,
  kerrConstantsOfMotion,
  kerrMetricContravariant,
  traceKerrNullGeodesic,
} from "./null-geodesic.js";

export const KERR_REFERENCE_TRACE_POLICY_VERSION = "1.0.0" as const;
export const KERR_REFERENCE_TRACE_MAX_WIDTH = 25;
export const KERR_REFERENCE_TRACE_MAX_HEIGHT = 25;
export const KERR_REFERENCE_TRACE_MAX_PIXELS = 625;
export const KERR_REFERENCE_TRACE_MAX_STEPS_PER_RAY = 12_000;
export const KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS = 2_000_000;
export const KERR_REFERENCE_TRACE_INTEGRITY_REPLAY_PASSES = 2;
export const KERR_REFERENCE_TRACE_MAX_TOTAL_SOLVER_PASSES = 3;
export const KERR_REFERENCE_TRACE_EVENT_LOCALIZATION_ITERATIONS =
  KERR_REFERENCE_EVENT_LOCALIZATION_ITERATIONS;
export const KERR_REFERENCE_TRACE_RADIAL_EVENT_LOCALIZATION =
  `fixed-${KERR_REFERENCE_TRACE_EVENT_LOCALIZATION_ITERATIONS}-iteration-rk4-bisection-at-horizon-and-escape-guards` as const;
export const KERR_REFERENCE_TRACE_MAX_EVENT_LOCALIZATION_RK4_EVALUATIONS_PER_PASS =
  KERR_REFERENCE_TRACE_MAX_PIXELS *
  KERR_REFERENCE_TRACE_EVENT_LOCALIZATION_ITERATIONS;
export const KERR_REFERENCE_TRACE_MAX_RK4_EVALUATIONS_PER_PASS =
  KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS +
  KERR_REFERENCE_TRACE_MAX_EVENT_LOCALIZATION_RK4_EVALUATIONS_PER_PASS;
export const KERR_REFERENCE_TRACE_MAX_TOTAL_CONFIGURED_ACCEPTED_STEPS =
  KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS *
  KERR_REFERENCE_TRACE_MAX_TOTAL_SOLVER_PASSES;
export const KERR_REFERENCE_TRACE_MAX_TOTAL_EVENT_LOCALIZATION_RK4_EVALUATIONS =
  KERR_REFERENCE_TRACE_MAX_EVENT_LOCALIZATION_RK4_EVALUATIONS_PER_PASS *
  KERR_REFERENCE_TRACE_MAX_TOTAL_SOLVER_PASSES;
export const KERR_REFERENCE_TRACE_MAX_TOTAL_RK4_EVALUATIONS =
  KERR_REFERENCE_TRACE_MAX_RK4_EVALUATIONS_PER_PASS *
  KERR_REFERENCE_TRACE_MAX_TOTAL_SOLVER_PASSES;
export const KERR_REFERENCE_TRACE_MIN_STEP = 0.005;
export const KERR_REFERENCE_TRACE_MAX_STEP = 0.05;
export const KERR_REFERENCE_TRACE_MAX_ABSOLUTE_STATE_VALUE = 1e12;
export const KERR_REFERENCE_TRACE_MAX_ABSOLUTE_DIAGNOSTIC = 1e12;
export const KERR_REFERENCE_TRACE_MAX_SCREEN_COORDINATE = 32;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const CommitSchema = z.string().regex(/^[a-f0-9]{7,64}$/);
const FiniteSchema = z.number().finite();
const NonnegativeFiniteSchema = FiniteSchema.nonnegative();
const BoundedFiniteSchema = FiniteSchema.min(
  -KERR_REFERENCE_TRACE_MAX_ABSOLUTE_STATE_VALUE,
).max(KERR_REFERENCE_TRACE_MAX_ABSOLUTE_STATE_VALUE);
const BoundedNonnegativeDiagnosticSchema = NonnegativeFiniteSchema.max(
  KERR_REFERENCE_TRACE_MAX_ABSOLUTE_DIAGNOSTIC,
);
const CanonicalTimestampSchema = z.iso.datetime({
  offset: false,
  precision: 0,
});

function normalizeCanonical(
  value: unknown,
  ancestors: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical Kerr JSON requires finite numbers.");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError("Canonical Kerr JSON does not permit cyclic values.");
    }
    ancestors.add(value);
    try {
      return value.map((child) => normalizeCanonical(child, ancestors));
    } finally {
      ancestors.delete(value);
    }
  }
  if (typeof value === "object") {
    if (ancestors.has(value)) {
      throw new TypeError("Canonical Kerr JSON does not permit cyclic values.");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(
        "Canonical Kerr JSON accepts only plain objects and arrays.",
      );
    }
    ancestors.add(value);
    try {
      const output: Record<string, unknown> = Object.create(null) as Record<
        string,
        unknown
      >;
      for (const key of Object.keys(value).sort()) {
        const child = (value as Record<string, unknown>)[key];
        if (child === undefined) {
          throw new TypeError(
            "Canonical Kerr JSON does not permit undefined values.",
          );
        }
        output[key] = normalizeCanonical(child, ancestors);
      }
      return output;
    } finally {
      ancestors.delete(value);
    }
  }
  throw new TypeError(`Unsupported canonical Kerr JSON value: ${typeof value}`);
}

export function kerrStableStringify(value: unknown): string {
  return JSON.stringify(normalizeCanonical(value));
}

/** Internal consistency digest only; it is not a signature or authenticity proof. */
export function kerrSha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function deepFreezeKerr<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreezeKerr(child);
  return Object.freeze(value);
}

const noAuthorityShape = {
  scientificValidationPassed: z.literal(false),
  independentValidationPassed: z.literal(false),
  implementationProvenanceVerified: z.literal(false),
  checksumAuthenticatesRecord: z.literal(false),
  renderAllowed: z.literal(false),
  productionUseAllowed: z.literal(false),
  placeholderReplacementAllowed: z.literal(false),
  releaseEligible: z.literal(false),
  publicationAllowed: z.literal(false),
  activationAllowed: z.literal(false),
} as const;

const noAuthority = {
  scientificValidationPassed: false,
  independentValidationPassed: false,
  implementationProvenanceVerified: false,
  checksumAuthenticatesRecord: false,
  renderAllowed: false,
  productionUseAllowed: false,
  placeholderReplacementAllowed: false,
  releaseEligible: false,
  publicationAllowed: false,
  activationAllowed: false,
} as const;

const RequestChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-reference-trace-request"),
  })
  .strict();

const KerrTraceLimitsSchema = z
  .object({
    maxWidth: z.literal(KERR_REFERENCE_TRACE_MAX_WIDTH),
    maxHeight: z.literal(KERR_REFERENCE_TRACE_MAX_HEIGHT),
    maxPixels: z.literal(KERR_REFERENCE_TRACE_MAX_PIXELS),
    maxStepsPerRay: z.literal(KERR_REFERENCE_TRACE_MAX_STEPS_PER_RAY),
    maxAggregateStepsPerSolverPass: z.literal(
      KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS,
    ),
    integrityReplayPasses: z.literal(
      KERR_REFERENCE_TRACE_INTEGRITY_REPLAY_PASSES,
    ),
    maxTotalSolverPasses: z.literal(
      KERR_REFERENCE_TRACE_MAX_TOTAL_SOLVER_PASSES,
    ),
    eventLocalizationIterations: z.literal(
      KERR_REFERENCE_TRACE_EVENT_LOCALIZATION_ITERATIONS,
    ),
    maxEventLocalizationRk4EvaluationsPerSolverPass: z.literal(
      KERR_REFERENCE_TRACE_MAX_EVENT_LOCALIZATION_RK4_EVALUATIONS_PER_PASS,
    ),
    maxRk4EvaluationsPerSolverPass: z.literal(
      KERR_REFERENCE_TRACE_MAX_RK4_EVALUATIONS_PER_PASS,
    ),
    maxTotalConfiguredAcceptedSteps: z.literal(
      KERR_REFERENCE_TRACE_MAX_TOTAL_CONFIGURED_ACCEPTED_STEPS,
    ),
    maxTotalEventLocalizationRk4Evaluations: z.literal(
      KERR_REFERENCE_TRACE_MAX_TOTAL_EVENT_LOCALIZATION_RK4_EVALUATIONS,
    ),
    maxTotalRk4Evaluations: z.literal(
      KERR_REFERENCE_TRACE_MAX_TOTAL_RK4_EVALUATIONS,
    ),
    minStep: z.literal(KERR_REFERENCE_TRACE_MIN_STEP),
    maxStep: z.literal(KERR_REFERENCE_TRACE_MAX_STEP),
    maxAbsoluteStateValue: z.literal(
      KERR_REFERENCE_TRACE_MAX_ABSOLUTE_STATE_VALUE,
    ),
    maxAbsoluteDiagnostic: z.literal(
      KERR_REFERENCE_TRACE_MAX_ABSOLUTE_DIAGNOSTIC,
    ),
    maxScreenCoordinate: z.literal(
      KERR_REFERENCE_TRACE_MAX_SCREEN_COORDINATE,
    ),
  })
  .strict();

export const KERR_REFERENCE_TRACE_LIMITS = deepFreezeKerr({
  maxWidth: KERR_REFERENCE_TRACE_MAX_WIDTH,
  maxHeight: KERR_REFERENCE_TRACE_MAX_HEIGHT,
  maxPixels: KERR_REFERENCE_TRACE_MAX_PIXELS,
  maxStepsPerRay: KERR_REFERENCE_TRACE_MAX_STEPS_PER_RAY,
  maxAggregateStepsPerSolverPass: KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS,
  integrityReplayPasses: KERR_REFERENCE_TRACE_INTEGRITY_REPLAY_PASSES,
  maxTotalSolverPasses: KERR_REFERENCE_TRACE_MAX_TOTAL_SOLVER_PASSES,
  eventLocalizationIterations:
    KERR_REFERENCE_TRACE_EVENT_LOCALIZATION_ITERATIONS,
  maxEventLocalizationRk4EvaluationsPerSolverPass:
    KERR_REFERENCE_TRACE_MAX_EVENT_LOCALIZATION_RK4_EVALUATIONS_PER_PASS,
  maxRk4EvaluationsPerSolverPass:
    KERR_REFERENCE_TRACE_MAX_RK4_EVALUATIONS_PER_PASS,
  maxTotalConfiguredAcceptedSteps:
    KERR_REFERENCE_TRACE_MAX_TOTAL_CONFIGURED_ACCEPTED_STEPS,
  maxTotalEventLocalizationRk4Evaluations:
    KERR_REFERENCE_TRACE_MAX_TOTAL_EVENT_LOCALIZATION_RK4_EVALUATIONS,
  maxTotalRk4Evaluations:
    KERR_REFERENCE_TRACE_MAX_TOTAL_RK4_EVALUATIONS,
  minStep: KERR_REFERENCE_TRACE_MIN_STEP,
  maxStep: KERR_REFERENCE_TRACE_MAX_STEP,
  maxAbsoluteStateValue: KERR_REFERENCE_TRACE_MAX_ABSOLUTE_STATE_VALUE,
  maxAbsoluteDiagnostic: KERR_REFERENCE_TRACE_MAX_ABSOLUTE_DIAGNOSTIC,
  maxScreenCoordinate: KERR_REFERENCE_TRACE_MAX_SCREEN_COORDINATE,
});

const KerrCameraSchema = z
  .object({
    observer: z.literal("zamo"),
    radiusRg: FiniteSchema.min(6).max(500),
    inclinationDegrees: FiniteSchema.min(5).max(175),
    azimuthDegrees: FiniteSchema.min(-360).max(360),
    verticalFieldOfViewDegrees: FiniteSchema.min(1).max(90),
    tetrad: z.literal("orthonormal-zamo-v1"),
  })
  .strict();

const OddGridDimensionSchema = z
  .number()
  .int()
  .positive()
  .refine((value) => value % 2 === 1, "Reference grids require an odd dimension");

const KerrGridSchema = z
  .object({
    width: OddGridDimensionSchema.max(KERR_REFERENCE_TRACE_MAX_WIDTH),
    height: OddGridDimensionSchema.max(KERR_REFERENCE_TRACE_MAX_HEIGHT),
    sampling: z.literal("pixel-centers-row-major"),
  })
  .strict();

const KerrIntegrationSchema = z
  .object({
    method: z.literal("bounded-event-guarded-rk4-hamiltonian"),
    derivativeMethod: z.literal("analytic-inverse-metric-derivatives"),
    stepSize: FiniteSchema.min(KERR_REFERENCE_TRACE_MIN_STEP).max(
      KERR_REFERENCE_TRACE_MAX_STEP,
    ),
    maxSteps: z
      .number()
      .int()
      .min(100)
      .max(KERR_REFERENCE_TRACE_MAX_STEPS_PER_RAY),
    maxAffineParameter: FiniteSchema.min(1).max(1_000),
    horizonGuardRg: FiniteSchema.min(0.25).max(2),
    escapeRadiusRg: FiniteSchema.min(10).max(1_000),
    thetaGuardRadians: FiniteSchema.min(1e-4).max(0.05),
  })
  .strict();

export const KerrReferenceTraceRequestSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("unvalidated-offline-kerr-reference-request"),
    requestId: z.string().regex(/^krreq_[a-f0-9]{24}$/),
    policyVersion: z.literal(KERR_REFERENCE_TRACE_POLICY_VERSION),
    frozenAt: CanonicalTimestampSchema,
    conventions: z
      .object({
        units: z.literal("G=M=c=1"),
        massScale: z.literal("black-hole-mass"),
        metric: z.literal("Kerr"),
        coordinates: z.literal("Boyer-Lindquist"),
        signature: z.literal("-+++"),
        thetaMeaning: z.literal("colatitude-radians"),
        spinMeaning: z.literal("signed-a-over-M"),
        rayOrientation: z.literal("future-directed-camera-emitted-inward"),
        inclinationMeaning: z.literal(
          "Boyer-Lindquist-colatitude-from-positive-spin-axis",
        ),
        azimuthMeaning: z.literal("Boyer-Lindquist-phi-increasing"),
        fieldOfViewMeaning: z.literal("vertical-tangent-plane-full-angle"),
        screenBasis: z.literal("screen-x=+e-phi;screen-y=-e-theta;inward=-e-r"),
        integrityReplay: z.literal(
          "ray-factory-replay-plus-report-integrity-replay",
        ),
        radialEventLocalization: z.literal(
          KERR_REFERENCE_TRACE_RADIAL_EVENT_LOCALIZATION,
        ),
      })
      .strict(),
    spin: FiniteSchema.min(-0.999).max(0.999),
    camera: KerrCameraSchema,
    grid: KerrGridSchema,
    integration: KerrIntegrationSchema,
    outputKind: z.literal("neutral-lens-coordinate-and-horizon-guard-mask"),
    emissionModelIncluded: z.literal(false),
    radiativeTransferIncluded: z.literal(false),
    imagePixelsProduced: z.literal(false),
    independentReference: z.literal("not-run"),
    referenceContractOnly: z.literal(true),
    limits: KerrTraceLimitsSchema,
    ...noAuthorityShape,
    requestChecksum: RequestChecksumSchema,
  })
  .strict()
  .superRefine((request, context) => {
    const pixels = request.grid.width * request.grid.height;
    const work = pixels * request.integration.maxSteps;
    if (
      pixels > KERR_REFERENCE_TRACE_MAX_PIXELS ||
      work > KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS
    ) {
      context.addIssue({
        code: "custom",
        path: ["grid"],
        message:
          "Kerr reference grid exceeds the per-solver-pass aggregate work budget",
      });
    }
    if (request.integration.escapeRadiusRg <= request.camera.radiusRg + 5) {
      context.addIssue({
        code: "custom",
        path: ["integration", "escapeRadiusRg"],
        message: "Escape domain must remain beyond the camera by at least 5 r_g",
      });
    }
    if (
      request.integration.maxAffineParameter >
      request.integration.stepSize * request.integration.maxSteps
    ) {
      context.addIssue({
        code: "custom",
        path: ["integration", "maxAffineParameter"],
        message: "Affine limit cannot exceed the configured RK4 step budget",
      });
    }
    const theta = (request.camera.inclinationDegrees * Math.PI) / 180;
    const staticLimit =
      1 +
      Math.sqrt(
        Math.max(0, 1 - request.spin ** 2 * Math.cos(theta) ** 2),
      );
    if (request.camera.radiusRg <= staticLimit + 1) {
      context.addIssue({
        code: "custom",
        path: ["camera", "radiusRg"],
        message: "First reference ZAMO camera requires a 1 r_g static-limit margin",
      });
    }
    const horizonStop =
      outerHorizonRadiusRg(request.spin) +
      request.integration.horizonGuardRg;
    if (request.camera.radiusRg <= horizonStop + 1) {
      context.addIssue({
        code: "custom",
        path: ["camera", "radiusRg"],
        message: "Camera must remain separated from the horizon guard",
      });
    }
  });
export type KerrReferenceTraceRequest = z.infer<
  typeof KerrReferenceTraceRequestSchema
>;

const CreateRequestInputSchema = z
  .object({
    frozenAt: CanonicalTimestampSchema,
    spin: FiniteSchema.min(-0.999).max(0.999),
    camera: KerrCameraSchema,
    grid: KerrGridSchema,
    integration: KerrIntegrationSchema,
  })
  .strict();

export interface CreateKerrReferenceTraceRequestInput {
  readonly frozenAt: unknown;
  readonly spin: unknown;
  readonly camera: unknown;
  readonly grid: unknown;
  readonly integration: unknown;
}

export function createKerrReferenceTraceRequest(
  input: CreateKerrReferenceTraceRequestInput,
): KerrReferenceTraceRequest {
  const parsed = CreateRequestInputSchema.parse(input);
  const identity = {
    policyVersion: KERR_REFERENCE_TRACE_POLICY_VERSION,
    frozenAt: parsed.frozenAt,
    spin: parsed.spin,
    camera: parsed.camera,
    grid: parsed.grid,
    integration: parsed.integration,
  };
  const requestId = `krreq_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "unvalidated-offline-kerr-reference-request" as const,
    requestId,
    policyVersion: KERR_REFERENCE_TRACE_POLICY_VERSION,
    frozenAt: parsed.frozenAt,
    conventions: {
      units: "G=M=c=1" as const,
      massScale: "black-hole-mass" as const,
      metric: "Kerr" as const,
      coordinates: "Boyer-Lindquist" as const,
      signature: "-+++" as const,
      thetaMeaning: "colatitude-radians" as const,
      spinMeaning: "signed-a-over-M" as const,
      rayOrientation: "future-directed-camera-emitted-inward" as const,
      inclinationMeaning:
        "Boyer-Lindquist-colatitude-from-positive-spin-axis" as const,
      azimuthMeaning: "Boyer-Lindquist-phi-increasing" as const,
      fieldOfViewMeaning: "vertical-tangent-plane-full-angle" as const,
      screenBasis:
        "screen-x=+e-phi;screen-y=-e-theta;inward=-e-r" as const,
      integrityReplay:
        "ray-factory-replay-plus-report-integrity-replay" as const,
      radialEventLocalization:
        KERR_REFERENCE_TRACE_RADIAL_EVENT_LOCALIZATION,
    },
    spin: parsed.spin,
    camera: parsed.camera,
    grid: parsed.grid,
    integration: parsed.integration,
    outputKind: "neutral-lens-coordinate-and-horizon-guard-mask" as const,
    emissionModelIncluded: false as const,
    radiativeTransferIncluded: false as const,
    imagePixelsProduced: false as const,
    independentReference: "not-run" as const,
    referenceContractOnly: true as const,
    limits: KERR_REFERENCE_TRACE_LIMITS,
    ...noAuthority,
  };
  const request = KerrReferenceTraceRequestSchema.parse({
    ...unsigned,
    requestChecksum: {
      algorithm: "sha256",
      value: kerrSha256Hex(kerrStableStringify(unsigned)),
      scope: "kerr-reference-trace-request",
    },
  });
  assertKerrReferenceTraceRequestIntegrity(request);
  return deepFreezeKerr(request);
}

export function assertKerrReferenceTraceRequestIntegrity(
  input: unknown,
): asserts input is KerrReferenceTraceRequest {
  const request = KerrReferenceTraceRequestSchema.parse(input);
  const identity = {
    policyVersion: request.policyVersion,
    frozenAt: request.frozenAt,
    spin: request.spin,
    camera: request.camera,
    grid: request.grid,
    integration: request.integration,
  };
  const expectedId = `krreq_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  if (request.requestId !== expectedId) {
    throw new Error("Kerr reference request identity mismatch");
  }
  const { requestChecksum, ...unsigned } = request;
  if (
    requestChecksum.value !== kerrSha256Hex(kerrStableStringify(unsigned))
  ) {
    throw new Error("Kerr reference request checksum mismatch");
  }
}

export const KerrRayTerminationSchema = z.enum([
  "captured-horizon-guard",
  "escaped-domain",
  "coordinate-domain-exit",
  "indeterminate-limit",
  "numerical-failure",
]);

export const KerrRayTerminationReasonSchema = z.enum([
  "horizon-guard-reached",
  "finite-escape-domain-reached",
  "polar-coordinate-guard-reached",
  "affine-parameter-limit-reached",
  "step-limit-reached",
  "non-finite-state",
  "metric-domain-exit",
  "event-step-underflow",
  "rk4-domain-exit",
  "invariant-diagnostic-domain-exit",
  "invariant-tolerance-exceeded",
  "time-orientation-violation",
]);
export type KerrRayTerminationReason = z.infer<
  typeof KerrRayTerminationReasonSchema
>;

function canonicalTerminationReason(input: unknown): KerrRayTerminationReason {
  return KerrRayTerminationReasonSchema.parse(input);
}

const allowedTerminationReasons: Readonly<
  Record<
    z.infer<typeof KerrRayTerminationSchema>,
    readonly KerrRayTerminationReason[]
  >
> = deepFreezeKerr({
  "captured-horizon-guard": ["horizon-guard-reached"],
  "escaped-domain": ["finite-escape-domain-reached"],
  "coordinate-domain-exit": ["polar-coordinate-guard-reached"],
  "indeterminate-limit": [
    "affine-parameter-limit-reached",
    "step-limit-reached",
  ],
  "numerical-failure": [
    "non-finite-state",
    "metric-domain-exit",
    "event-step-underflow",
    "rk4-domain-exit",
    "invariant-diagnostic-domain-exit",
    "invariant-tolerance-exceeded",
    "time-orientation-violation",
  ],
});

const KerrRayStateSchema = z
  .object({
    t: BoundedFiniteSchema,
    r: FiniteSchema.positive().max(
      KERR_REFERENCE_TRACE_MAX_ABSOLUTE_STATE_VALUE,
    ),
    theta: FiniteSchema.min(0).max(Math.PI),
    phi: BoundedFiniteSchema,
    pT: BoundedFiniteSchema,
    pR: BoundedFiniteSchema,
    pTheta: BoundedFiniteSchema,
    pPhi: BoundedFiniteSchema,
  })
  .strict();

const KerrConstantsSchema = z
  .object({
    energy: FiniteSchema.positive().max(
      KERR_REFERENCE_TRACE_MAX_ABSOLUTE_STATE_VALUE,
    ),
    angularMomentumZ: BoundedFiniteSchema,
    carterQ: BoundedFiniteSchema,
    hamiltonian: BoundedFiniteSchema,
  })
  .strict();

const KerrDiagnosticsSchema = z
  .object({
    maxAbsoluteHamiltonian: BoundedNonnegativeDiagnosticSchema,
    maxNormalizedNullResidual: BoundedNonnegativeDiagnosticSchema,
    maxRelativeEnergyDrift: BoundedNonnegativeDiagnosticSchema,
    maxRelativeAngularMomentumDrift: BoundedNonnegativeDiagnosticSchema,
    maxRelativeCarterDrift: BoundedNonnegativeDiagnosticSchema,
    maxNormalizedRadialPotentialResidual: BoundedNonnegativeDiagnosticSchema,
    maxNormalizedPolarPotentialResidual: BoundedNonnegativeDiagnosticSchema,
    minRadiusRg: FiniteSchema.positive().max(
      KERR_REFERENCE_TRACE_MAX_ABSOLUTE_STATE_VALUE,
    ),
    maxRadiusRg: FiniteSchema.positive().max(
      KERR_REFERENCE_TRACE_MAX_ABSOLUTE_STATE_VALUE,
    ),
    minThetaRadians: FiniteSchema.min(0).max(Math.PI),
    maxThetaRadians: FiniteSchema.min(0).max(Math.PI),
    minStep: NonnegativeFiniteSchema.max(KERR_REFERENCE_TRACE_MAX_STEP),
    maxStep: NonnegativeFiniteSchema.max(KERR_REFERENCE_TRACE_MAX_STEP),
  })
  .strict()
  .superRefine((diagnostics, context) => {
    if (
      diagnostics.minRadiusRg > diagnostics.maxRadiusRg ||
      diagnostics.minThetaRadians > diagnostics.maxThetaRadians ||
      diagnostics.minStep > diagnostics.maxStep
    ) {
      context.addIssue({
        code: "custom",
        message: "Kerr diagnostic extrema are reversed",
      });
    }
  });

const KerrLensCoordinateSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("horizon-guard-coordinate"),
      thetaRadians: FiniteSchema.min(0).max(Math.PI),
      phiRadians: FiniteSchema.min(0).max(2 * Math.PI),
    })
    .strict(),
  z
    .object({
      kind: z.literal("finite-escape-domain-coordinate"),
      thetaRadians: FiniteSchema.min(0).max(Math.PI),
      phiRadians: FiniteSchema.min(0).max(2 * Math.PI),
    })
    .strict(),
  z.object({ kind: z.literal("unresolved") }).strict(),
]);

const RayChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-reference-ray-record"),
  })
  .strict();

const KerrReferenceRayPayloadSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("unvalidated-kerr-vacuum-ray"),
    requestId: z.string().regex(/^krreq_[a-f0-9]{24}$/),
    requestChecksum: RequestChecksumSchema,
    pixelIndex: z
      .number()
      .int()
      .min(0)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS - 1),
    pixelX: z
      .number()
      .int()
      .min(0)
      .max(KERR_REFERENCE_TRACE_MAX_WIDTH - 1),
    pixelY: z
      .number()
      .int()
      .min(0)
      .max(KERR_REFERENCE_TRACE_MAX_HEIGHT - 1),
    screenX: FiniteSchema.min(-KERR_REFERENCE_TRACE_MAX_SCREEN_COORDINATE).max(
      KERR_REFERENCE_TRACE_MAX_SCREEN_COORDINATE,
    ),
    screenY: FiniteSchema.min(-KERR_REFERENCE_TRACE_MAX_SCREEN_COORDINATE).max(
      KERR_REFERENCE_TRACE_MAX_SCREEN_COORDINATE,
    ),
    termination: KerrRayTerminationSchema,
    terminationReason: KerrRayTerminationReasonSchema,
    steps: z
      .number()
      .int()
      .min(0)
      .max(KERR_REFERENCE_TRACE_MAX_STEPS_PER_RAY),
    affineParameter: NonnegativeFiniteSchema.max(1_000),
    initialState: KerrRayStateSchema,
    finalState: KerrRayStateSchema,
    constants: KerrConstantsSchema,
    diagnostics: KerrDiagnosticsSchema,
    lensCoordinate: KerrLensCoordinateSchema,
    independentReference: z.literal("not-run"),
    referenceContractOnly: z.literal(true),
    ...noAuthorityShape,
  })
  .strict();

const KerrReferenceRayWithIdentitySchema = KerrReferenceRayPayloadSchema.extend({
  rayId: z.string().regex(/^krray_[a-f0-9]{24}$/),
});

export const KerrReferenceRayRecordSchema =
  KerrReferenceRayWithIdentitySchema.extend({
    rayChecksum: RayChecksumSchema,
  })
  .superRefine((ray, context) => {
    const expectedKind =
      ray.termination === "captured-horizon-guard"
        ? "horizon-guard-coordinate"
        : ray.termination === "escaped-domain"
          ? "finite-escape-domain-coordinate"
          : "unresolved";
    if (ray.lensCoordinate.kind !== expectedKind) {
      context.addIssue({
        code: "custom",
        path: ["lensCoordinate"],
        message: "Lens coordinate kind does not match ray termination",
      });
    }
    if (
      !allowedTerminationReasons[ray.termination].includes(
        ray.terminationReason,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["terminationReason"],
        message: "Termination reason does not match the ray outcome",
      });
    }
  });
export type KerrReferenceRayRecord = z.infer<
  typeof KerrReferenceRayRecordSchema
>;

export interface CreateKerrReferenceRayRecordInput {
  readonly request: unknown;
  readonly pixelIndex: unknown;
  readonly pixelX: unknown;
  readonly pixelY: unknown;
  readonly screenX: unknown;
  readonly screenY: unknown;
  readonly termination: unknown;
  readonly terminationReason: unknown;
  readonly steps: unknown;
  readonly affineParameter: unknown;
  readonly initialState: unknown;
  readonly finalState: unknown;
  readonly constants: unknown;
  readonly diagnostics: unknown;
  readonly lensCoordinate: unknown;
}

export function createKerrReferenceRayRecord(
  input: CreateKerrReferenceRayRecordInput,
): KerrReferenceRayRecord {
  const request = KerrReferenceTraceRequestSchema.parse(input.request);
  assertKerrReferenceTraceRequestIntegrity(request);
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "unvalidated-kerr-vacuum-ray" as const,
    requestId: request.requestId,
    requestChecksum: request.requestChecksum,
    pixelIndex: input.pixelIndex,
    pixelX: input.pixelX,
    pixelY: input.pixelY,
    screenX: input.screenX,
    screenY: input.screenY,
    termination: input.termination,
    terminationReason: canonicalTerminationReason(input.terminationReason),
    steps: input.steps,
    affineParameter: input.affineParameter,
    initialState: input.initialState,
    finalState: input.finalState,
    constants: input.constants,
    diagnostics: input.diagnostics,
    lensCoordinate: input.lensCoordinate,
    independentReference: "not-run" as const,
    referenceContractOnly: true as const,
    ...noAuthority,
  };
  const parsedUnsigned = KerrReferenceRayPayloadSchema.parse(unsigned);
  const identity = {
    requestId: request.requestId,
    requestChecksum: request.requestChecksum,
    pixelIndex: parsedUnsigned.pixelIndex,
    payloadSha256: kerrSha256Hex(kerrStableStringify(parsedUnsigned)),
  };
  const rayId = `krray_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const rayUnsigned = { ...parsedUnsigned, rayId };
  const ray = KerrReferenceRayRecordSchema.parse({
    ...rayUnsigned,
    rayChecksum: {
      algorithm: "sha256",
      value: kerrSha256Hex(kerrStableStringify(rayUnsigned)),
      scope: "kerr-reference-ray-record",
    },
  });
  assertKerrReferenceRayRecordIntegrity(request, ray);
  return deepFreezeKerr(ray);
}

function normalizedAzimuthRadians(value: number): number {
  const wrapped = ((value % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function expectedLensCoordinateForTrace(trace: {
  readonly termination: z.infer<typeof KerrRayTerminationSchema>;
  readonly finalState: z.infer<typeof KerrRayStateSchema>;
}): z.infer<typeof KerrLensCoordinateSchema> {
  if (trace.termination === "captured-horizon-guard") {
    return {
      kind: "horizon-guard-coordinate",
      thetaRadians: trace.finalState.theta,
      phiRadians: normalizedAzimuthRadians(trace.finalState.phi),
    };
  }
  if (trace.termination === "escaped-domain") {
    return {
      kind: "finite-escape-domain-coordinate",
      thetaRadians: trace.finalState.theta,
      phiRadians: normalizedAzimuthRadians(trace.finalState.phi),
    };
  }
  return { kind: "unresolved" };
}

function assertCanonicalKerrValue(
  label: string,
  actual: unknown,
  expected: unknown,
): void {
  if (kerrStableStringify(actual) !== kerrStableStringify(expected)) {
    throw new Error(`${label} does not match the deterministic reference trace`);
  }
}

export function assertKerrReferenceRayRecordIntegrity(
  requestInput: unknown,
  rayInput: unknown,
): asserts rayInput is KerrReferenceRayRecord {
  const request = KerrReferenceTraceRequestSchema.parse(requestInput);
  assertKerrReferenceTraceRequestIntegrity(request);
  const ray = KerrReferenceRayRecordSchema.parse(rayInput);
  if (
    ray.requestId !== request.requestId ||
    ray.requestChecksum.value !== request.requestChecksum.value
  ) {
    throw new Error("Kerr ray is not bound to its request");
  }
  const { rayId: _rayId, rayChecksum: _rayChecksum, ...payload } = ray;
  const identity = {
    requestId: request.requestId,
    requestChecksum: request.requestChecksum,
    pixelIndex: ray.pixelIndex,
    payloadSha256: kerrSha256Hex(kerrStableStringify(payload)),
  };
  const expectedId = `krray_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  if (ray.rayId !== expectedId) throw new Error("Kerr ray identity mismatch");
  const { rayChecksum, ...unsigned } = ray;
  if (rayChecksum.value !== kerrSha256Hex(kerrStableStringify(unsigned))) {
    throw new Error("Kerr ray checksum mismatch");
  }

  const expectedPixelIndex = ray.pixelY * request.grid.width + ray.pixelX;
  const expected = expectedScreen(request, ray.pixelX, ray.pixelY);
  if (
    ray.pixelX >= request.grid.width ||
    ray.pixelY >= request.grid.height ||
    ray.pixelIndex !== expectedPixelIndex ||
    ray.screenX !== expected.screenX ||
    ray.screenY !== expected.screenY ||
    ray.steps > request.integration.maxSteps ||
    ray.affineParameter > request.integration.maxAffineParameter
  ) {
    throw new Error(
      "Kerr ray violates its request-relative pixel or work bounds",
    );
  }

  const theta = (request.camera.inclinationDegrees * Math.PI) / 180;
  const phi = (request.camera.azimuthDegrees * Math.PI) / 180;
  const expectedInitialState = createKerrZamoScreenRay({
    spin: request.spin,
    radiusRg: request.camera.radiusRg,
    thetaRadians: theta,
    phiRadians: phi,
    screenX: expected.screenX,
    screenY: expected.screenY,
  });
  assertCanonicalKerrValue(
    "Kerr ray initial ZAMO state",
    ray.initialState,
    expectedInitialState,
  );
  assertCanonicalKerrValue(
    "Kerr ray constants",
    ray.constants,
    kerrConstantsOfMotion(request.spin, expectedInitialState),
  );

  const expectedTrace = traceKerrNullGeodesic(expectedInitialState, {
    spin: request.spin,
    stepSize: request.integration.stepSize,
    maxSteps: request.integration.maxSteps,
    maxAffineParameter: request.integration.maxAffineParameter,
    horizonGuardRg: request.integration.horizonGuardRg,
    escapeRadiusRg: request.integration.escapeRadiusRg,
    thetaGuardRadians: request.integration.thetaGuardRadians,
  });
  if (
    ray.termination !== expectedTrace.termination ||
    ray.terminationReason !==
      canonicalTerminationReason(expectedTrace.terminationReason) ||
    ray.steps !== expectedTrace.steps ||
    ray.affineParameter !== expectedTrace.affineParameter
  ) {
    throw new Error(
      "Kerr ray outcome does not match the bounded deterministic replay",
    );
  }
  assertCanonicalKerrValue(
    "Kerr ray replay initial state",
    ray.initialState,
    expectedTrace.initialState,
  );
  assertCanonicalKerrValue(
    "Kerr ray final state",
    ray.finalState,
    expectedTrace.finalState,
  );
  assertCanonicalKerrValue(
    "Kerr ray replay constants",
    ray.constants,
    expectedTrace.constants,
  );
  assertCanonicalKerrValue(
    "Kerr ray diagnostics",
    ray.diagnostics,
    expectedTrace.diagnostics,
  );
  assertCanonicalKerrValue(
    "Kerr ray lens coordinate",
    ray.lensCoordinate,
    expectedLensCoordinateForTrace(expectedTrace),
  );

  const endpointRadiusMinimum = Math.min(
    ray.initialState.r,
    ray.finalState.r,
  );
  const endpointRadiusMaximum = Math.max(
    ray.initialState.r,
    ray.finalState.r,
  );
  const endpointThetaMinimum = Math.min(
    ray.initialState.theta,
    ray.finalState.theta,
  );
  const endpointThetaMaximum = Math.max(
    ray.initialState.theta,
    ray.finalState.theta,
  );
  if (
    ray.diagnostics.minRadiusRg > endpointRadiusMinimum ||
    ray.diagnostics.maxRadiusRg < endpointRadiusMaximum ||
    ray.diagnostics.minThetaRadians > endpointThetaMinimum ||
    ray.diagnostics.maxThetaRadians < endpointThetaMaximum ||
    ray.diagnostics.maxStep > request.integration.stepSize ||
    ray.diagnostics.maxAbsoluteHamiltonian < Math.abs(ray.constants.hamiltonian)
  ) {
    throw new Error(
      "Kerr ray diagnostics are inconsistent with its endpoints or request",
    );
  }
  const affineTolerance =
    Number.EPSILON *
    64 *
    Math.max(1, ray.affineParameter, ray.steps * request.integration.stepSize);
  if (
    ray.affineParameter >
    ray.steps * request.integration.stepSize + affineTolerance
  ) {
    throw new Error("Kerr ray affine parameter exceeds its accepted-step budget");
  }
  if (ray.steps === 0) {
    if (
      ray.affineParameter !== 0 ||
      ray.diagnostics.minStep !== 0 ||
      ray.diagnostics.maxStep !== 0
    ) {
      throw new Error(
        "A zero-step Kerr ray cannot advance affine parameter or step diagnostics",
      );
    }
    assertCanonicalKerrValue(
      "Zero-step Kerr ray final state",
      ray.finalState,
      ray.initialState,
    );
  } else if (
    ray.affineParameter <= 0 ||
    ray.diagnostics.minStep <= 0 ||
    ray.diagnostics.maxStep <= 0
  ) {
    throw new Error(
      "A progressed Kerr ray requires positive affine and step diagnostics",
    );
  }

  const horizon = outerHorizonRadiusRg(request.spin);
  const horizonStop = horizon + request.integration.horizonGuardRg;
  const horizonTolerance = Math.max(
    1e-11,
    request.integration.horizonGuardRg * 1e-6,
  );
  if (ray.termination === "captured-horizon-guard") {
    if (
      ray.finalState.r <= horizon ||
      ray.finalState.r > horizonStop + horizonTolerance
    ) {
      throw new Error(
        "Captured Kerr ray is outside the exterior horizon-guard region",
      );
    }
  } else if (ray.termination === "escaped-domain") {
    const inverse = kerrMetricContravariant(
      request.spin,
      ray.finalState.r,
      ray.finalState.theta,
    );
    const outwardRadialDerivative = inverse[1][1] * ray.finalState.pR;
    if (
      ray.finalState.r < request.integration.escapeRadiusRg ||
      outwardRadialDerivative <= 0
    ) {
      throw new Error("Escaped Kerr ray did not leave the finite domain outward");
    }
  } else if (ray.termination === "coordinate-domain-exit") {
    const polarGuardDistance = Math.min(
      Math.abs(ray.finalState.theta - request.integration.thetaGuardRadians),
      Math.abs(
        ray.finalState.theta -
          (Math.PI - request.integration.thetaGuardRadians),
      ),
    );
    if (polarGuardDistance > 1e-9) {
      throw new Error("Coordinate-domain Kerr ray did not reach the polar guard");
    }
  } else if (
    ray.termination === "indeterminate-limit" &&
    !(
      (ray.terminationReason === "step-limit-reached" &&
        ray.steps === request.integration.maxSteps) ||
      (ray.terminationReason === "affine-parameter-limit-reached" &&
        ray.affineParameter >=
          request.integration.maxAffineParameter - affineTolerance)
    )
  ) {
    throw new Error(
      "Indeterminate Kerr ray does not match a configured finite limit",
    );
  }
}

const TerminationCountsSchema = z
  .object({
    capturedHorizonGuard: z
      .number()
      .int()
      .min(0)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
    escapedDomain: z
      .number()
      .int()
      .min(0)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
    coordinateDomainExit: z
      .number()
      .int()
      .min(0)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
    indeterminateLimit: z
      .number()
      .int()
      .min(0)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
    numericalFailure: z
      .number()
      .int()
      .min(0)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
  })
  .strict();

const ReportChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-reference-trace-report"),
  })
  .strict();

export const KerrReferenceTraceReportSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("unvalidated-offline-kerr-reference-trace"),
    reportId: z.string().regex(/^krrep_[a-f0-9]{24}$/),
    requestId: z.string().regex(/^krreq_[a-f0-9]{24}$/),
    requestChecksum: RequestChecksumSchema,
    generatedAt: CanonicalTimestampSchema,
    implementation: z
      .object({
        implementationId: z.literal("cosmography-kerr-vacuum-reference"),
        implementationVersion: z.literal("0.1.0"),
        declaredCodeCommit: CommitSchema,
        provenance: z.literal("caller-declared-unverified"),
        arithmetic: z.literal("javascript-number-float64"),
      })
      .strict(),
    outputKind: z.literal("neutral-lens-coordinate-and-horizon-guard-mask"),
    rays: z
      .array(KerrReferenceRayRecordSchema)
      .min(1)
      .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
    summary: z
      .object({
        rayCount: z
          .number()
          .int()
          .positive()
          .max(KERR_REFERENCE_TRACE_MAX_PIXELS),
        terminationCounts: TerminationCountsSchema,
        maxAbsoluteHamiltonian: BoundedNonnegativeDiagnosticSchema,
        maxNormalizedNullResidual: BoundedNonnegativeDiagnosticSchema,
        maxRelativeCarterDrift: BoundedNonnegativeDiagnosticSchema,
        maxNormalizedRadialPotentialResidual: BoundedNonnegativeDiagnosticSchema,
        maxNormalizedPolarPotentialResidual: BoundedNonnegativeDiagnosticSchema,
      })
      .strict(),
    emissionModelIncluded: z.literal(false),
    radiativeTransferIncluded: z.literal(false),
    imagePixelsProduced: z.literal(false),
    independentReference: z.literal("not-run"),
    referenceContractOnly: z.literal(true),
    ...noAuthorityShape,
    reportChecksum: ReportChecksumSchema,
  })
  .strict();
export type KerrReferenceTraceReport = z.infer<
  typeof KerrReferenceTraceReportSchema
>;

function terminationCounts(rays: readonly KerrReferenceRayRecord[]) {
  const counts = {
    capturedHorizonGuard: 0,
    escapedDomain: 0,
    coordinateDomainExit: 0,
    indeterminateLimit: 0,
    numericalFailure: 0,
  };
  for (const ray of rays) {
    if (ray.termination === "captured-horizon-guard") {
      counts.capturedHorizonGuard += 1;
    } else if (ray.termination === "escaped-domain") {
      counts.escapedDomain += 1;
    } else if (ray.termination === "coordinate-domain-exit") {
      counts.coordinateDomainExit += 1;
    } else if (ray.termination === "indeterminate-limit") {
      counts.indeterminateLimit += 1;
    } else {
      counts.numericalFailure += 1;
    }
  }
  return counts;
}

function reportSummary(rays: readonly KerrReferenceRayRecord[]) {
  return {
    rayCount: rays.length,
    terminationCounts: terminationCounts(rays),
    maxAbsoluteHamiltonian: Math.max(
      ...rays.map(({ diagnostics }) => diagnostics.maxAbsoluteHamiltonian),
    ),
    maxNormalizedNullResidual: Math.max(
      ...rays.map(({ diagnostics }) => diagnostics.maxNormalizedNullResidual),
    ),
    maxRelativeCarterDrift: Math.max(
      ...rays.map(({ diagnostics }) => diagnostics.maxRelativeCarterDrift),
    ),
    maxNormalizedRadialPotentialResidual: Math.max(
      ...rays.map(
        ({ diagnostics }) => diagnostics.maxNormalizedRadialPotentialResidual,
      ),
    ),
    maxNormalizedPolarPotentialResidual: Math.max(
      ...rays.map(
        ({ diagnostics }) => diagnostics.maxNormalizedPolarPotentialResidual,
      ),
    ),
  };
}

export interface CreateKerrReferenceTraceReportInput {
  readonly request: unknown;
  readonly generatedAt: unknown;
  readonly declaredCodeCommit: unknown;
  readonly rays: readonly unknown[];
}

export function createKerrReferenceTraceReport(
  input: CreateKerrReferenceTraceReportInput,
): KerrReferenceTraceReport {
  const request = KerrReferenceTraceRequestSchema.parse(input.request);
  assertKerrReferenceTraceRequestIntegrity(request);
  const generatedAt = CanonicalTimestampSchema.parse(input.generatedAt);
  if (generatedAt < request.frozenAt) {
    throw new Error("Kerr trace report cannot precede its frozen request");
  }
  const declaredCodeCommit = CommitSchema.parse(input.declaredCodeCommit);
  const expectedRayCount = request.grid.width * request.grid.height;
  if (!Array.isArray(input.rays) || input.rays.length !== expectedRayCount) {
    throw new Error(
      "Kerr trace report input must contain exactly one bounded ray per requested pixel",
    );
  }
  const rays: KerrReferenceRayRecord[] = [];
  for (let index = 0; index < expectedRayCount; index += 1) {
    rays.push(KerrReferenceRayRecordSchema.parse(input.rays[index]));
  }
  rays.sort((left, right) => left.pixelIndex - right.pixelIndex);
  const summary = reportSummary(rays);
  const identity = {
    requestId: request.requestId,
    requestChecksum: request.requestChecksum,
    generatedAt,
    declaredCodeCommit,
    rayChecksums: rays.map(({ rayChecksum }) => rayChecksum),
  };
  const reportId = `krrep_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "unvalidated-offline-kerr-reference-trace" as const,
    reportId,
    requestId: request.requestId,
    requestChecksum: request.requestChecksum,
    generatedAt,
    implementation: {
      implementationId: "cosmography-kerr-vacuum-reference" as const,
      implementationVersion: "0.1.0" as const,
      declaredCodeCommit,
      provenance: "caller-declared-unverified" as const,
      arithmetic: "javascript-number-float64" as const,
    },
    outputKind: "neutral-lens-coordinate-and-horizon-guard-mask" as const,
    rays,
    summary,
    emissionModelIncluded: false as const,
    radiativeTransferIncluded: false as const,
    imagePixelsProduced: false as const,
    independentReference: "not-run" as const,
    referenceContractOnly: true as const,
    ...noAuthority,
  };
  const report = KerrReferenceTraceReportSchema.parse({
    ...unsigned,
    reportChecksum: {
      algorithm: "sha256",
      value: kerrSha256Hex(kerrStableStringify(unsigned)),
      scope: "kerr-reference-trace-report",
    },
  });
  assertKerrReferenceTraceReportIntegrity(request, report);
  return deepFreezeKerr(report);
}

function expectedScreen(
  request: KerrReferenceTraceRequest,
  pixelX: number,
  pixelY: number,
): { screenX: number; screenY: number } {
  const unitX = (2 * (pixelX + 0.5)) / request.grid.width - 1;
  const unitY = 1 - (2 * (pixelY + 0.5)) / request.grid.height;
  const tangent = Math.tan(
    (request.camera.verticalFieldOfViewDegrees * Math.PI) / 360,
  );
  return {
    screenX: unitX * (request.grid.width / request.grid.height) * tangent,
    screenY: unitY * tangent,
  };
}

function preflightReportRayArray(
  reportInput: unknown,
  expectedRayCount: number,
): void {
  if (typeof reportInput !== "object" || reportInput === null) {
    throw new Error("Kerr trace report input must be a plain object");
  }
  const prototype = Object.getPrototypeOf(reportInput);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Kerr trace report input must be a plain object");
  }
  const raysDescriptor = Object.getOwnPropertyDescriptor(reportInput, "rays");
  if (raysDescriptor === undefined || !("value" in raysDescriptor)) {
    throw new Error("Kerr trace report rays must be an own data property");
  }
  const rays = raysDescriptor.value;
  if (!Array.isArray(rays)) {
    throw new Error("Kerr trace report rays must be an array");
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(rays, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.value !== expectedRayCount
  ) {
    throw new Error(
      "Kerr trace report must preflight exactly one bounded ray per requested pixel",
    );
  }
}

export function assertKerrReferenceTraceReportIntegrity(
  requestInput: unknown,
  reportInput: unknown,
): asserts reportInput is KerrReferenceTraceReport {
  const request = KerrReferenceTraceRequestSchema.parse(requestInput);
  assertKerrReferenceTraceRequestIntegrity(request);
  const expectedRayCount = request.grid.width * request.grid.height;
  preflightReportRayArray(reportInput, expectedRayCount);
  const report = KerrReferenceTraceReportSchema.parse(reportInput);
  if (
    report.requestId !== request.requestId ||
    report.requestChecksum.value !== request.requestChecksum.value ||
    report.generatedAt < request.frozenAt
  ) {
    throw new Error("Kerr trace report is not causally bound to its request");
  }
  if (report.rays.length !== expectedRayCount) {
    throw new Error("Kerr trace report does not contain the complete pixel grid");
  }
  const rayIds = new Set<string>();
  for (const [index, ray] of report.rays.entries()) {
    assertKerrReferenceRayRecordIntegrity(request, ray);
    const pixelX = index % request.grid.width;
    const pixelY = Math.floor(index / request.grid.width);
    const expected = expectedScreen(request, pixelX, pixelY);
    if (
      ray.pixelIndex !== index ||
      ray.pixelX !== pixelX ||
      ray.pixelY !== pixelY ||
      ray.screenX !== expected.screenX ||
      ray.screenY !== expected.screenY ||
      ray.steps > request.integration.maxSteps ||
      ray.affineParameter > request.integration.maxAffineParameter ||
      rayIds.has(ray.rayId)
    ) {
      throw new Error("Kerr ray grid order or request bounds were violated");
    }
    rayIds.add(ray.rayId);
    if (
      ray.termination === "captured-horizon-guard" &&
      ray.finalState.r >
        outerHorizonRadiusRg(request.spin) +
          request.integration.horizonGuardRg +
          1e-5
    ) {
      throw new Error("Captured Kerr ray did not reach the declared horizon guard");
    }
    if (
      ray.termination === "escaped-domain" &&
      ray.finalState.r < request.integration.escapeRadiusRg
    ) {
      throw new Error("Escaped Kerr ray did not reach the finite escape domain");
    }
  }
  if (
    kerrStableStringify(report.summary) !==
    kerrStableStringify(reportSummary(report.rays))
  ) {
    throw new Error("Kerr trace report summary mismatch");
  }
  const actualAggregateSteps = report.rays.reduce(
    (total, ray) => total + ray.steps,
    0,
  );
  if (actualAggregateSteps > KERR_REFERENCE_TRACE_MAX_AGGREGATE_STEPS) {
    throw new Error(
      "Kerr trace report exceeds the per-solver-pass aggregate step budget",
    );
  }
  const identity = {
    requestId: request.requestId,
    requestChecksum: request.requestChecksum,
    generatedAt: report.generatedAt,
    declaredCodeCommit: report.implementation.declaredCodeCommit,
    rayChecksums: report.rays.map(({ rayChecksum }) => rayChecksum),
  };
  const expectedId = `krrep_${kerrSha256Hex(kerrStableStringify(identity)).slice(0, 24)}`;
  if (report.reportId !== expectedId) {
    throw new Error("Kerr trace report identity mismatch");
  }
  const { reportChecksum, ...unsigned } = report;
  if (reportChecksum.value !== kerrSha256Hex(kerrStableStringify(unsigned))) {
    throw new Error("Kerr trace report checksum mismatch");
  }
}

/** No object in this offline reference slice can authorize renderer use. */
export function canUseKerrReferenceTraceForRender(_input: unknown): false {
  return false;
}
