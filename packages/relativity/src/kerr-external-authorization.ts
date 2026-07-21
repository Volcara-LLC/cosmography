import { z } from "zod";

import {
  KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
  KERR_COMPARISON_MAX_CASES,
  KERR_COMPARISON_MAX_TOTAL_PIXELS,
  assertKerrComparisonPlainDataTree,
  assertKerrComparisonPlanIntegrity,
  assertVerifiedKerrComparisonReferenceBundle,
  type KerrComparisonPlan,
  type VerifiedKerrComparisonReferenceBundle,
} from "./kerr-comparison-plan.js";
import {
  deepFreezeKerr,
  kerrSha256Hex,
  kerrStableStringify,
} from "./trace-contracts.js";

export const KERR_EXTERNAL_AUTHORIZATION_POLICY_VERSION = "1.0.0" as const;
export const KERR_EXTERNAL_AUTHORIZATION_MAX_CANONICAL_BYTES =
  2 * 1024 * 1024;
export const KERR_EXTERNAL_AUTHORIZATION_MAX_ARGV = 32;
export const KERR_EXTERNAL_AUTHORIZATION_MAX_ENVIRONMENT_ENTRIES = 16;
export const KERR_EXTERNAL_AUTHORIZATION_MAX_VALIDITY_SECONDS = 60 * 60;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const CanonicalTimestampSchema = z.iso.datetime({
  offset: false,
  precision: 0,
});
const IdentifierSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,127}$/);

const downstreamNoAuthorityShape = {
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

export const KERR_EXTERNAL_AUTHORIZATION_NO_AUTHORITY = deepFreezeKerr({
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

export const KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION = deepFreezeKerr({
  packageFilesystemAccess: false,
  packageNetworkAccess: false,
  packageDownloaderSupplied: false,
  packageArchiveExtractorSupplied: false,
  packageBuildSystemSupplied: false,
  packageShellSupplied: false,
  packageProcessSpawnerSupplied: false,
  packageWorkerSupplied: false,
  packageNativeLoaderSupplied: false,
  packageSandboxSupplied: false,
  packageRunnerSupplied: false,
  packageExecutionAllowed: false,
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

function canonicalByteLength(value: unknown): number {
  return new TextEncoder().encode(kerrStableStringify(value)).byteLength;
}

function assertCanonicalByteBudget(value: unknown, label: string): void {
  if (canonicalByteLength(value) > KERR_EXTERNAL_AUTHORIZATION_MAX_CANONICAL_BYTES) {
    throw new RangeError(`${label} exceeds its canonical byte budget`);
  }
}

function checksum(scope: string, unsigned: unknown) {
  return {
    algorithm: "sha256" as const,
    value: kerrSha256Hex(kerrStableStringify(unsigned)),
    scope,
  };
}

const KerrStateSchema = z
  .object({
    t: z.number().finite(),
    r: z.number().finite().positive(),
    theta: z.number().finite().min(0).max(Math.PI),
    phi: z.number().finite(),
    pT: z.number().finite(),
    pR: z.number().finite(),
    pTheta: z.number().finite(),
    pPhi: z.number().finite(),
  })
  .strict();

const BlindedRayBaseSchema = z
  .object({
    rayOrdinal: z.number().int().min(0).max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
    pixelIndex: z.number().int().min(0).max(KERR_COMPARISON_MAX_TOTAL_PIXELS - 1),
    pixelX: z.number().int().min(0).max(24),
    pixelY: z.number().int().min(0).max(24),
    screenX: z.number().finite().min(-32).max(32),
    screenY: z.number().finite().min(-32).max(32),
  })
  .strict();

const BlindedCameraAndSolverRaySchema = z
  .object({
    inputKind: z.literal("camera-pixel-coordinate"),
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
  })
  .strict();

const BlindedIntegratorRaySchema = BlindedRayBaseSchema.extend({
  inputKind: z.literal("canonical-initial-state"),
  initialState: KerrStateSchema,
});

const BlindedCaseBaseSchema = z
  .object({
    caseOrdinal: z.number().int().min(0).max(KERR_COMPARISON_MAX_CASES - 1),
    spin: z.number().finite().min(-0.999).max(0.999),
    eventSurfaces: z
      .object({
        horizonGuardRadiusRg: z.number().finite().positive().max(1e12),
        finiteEscapeDomainRadiusRg: z.number().finite().positive().max(1e12),
      })
      .strict(),
    maxAffineParameter: z.number().finite().positive().max(1_000),
  })
  .strict();

const BlindedCameraAndSolverCaseSchema = BlindedCaseBaseSchema.extend({
  inputKind: z.literal("camera-and-solver"),
  camera: z
    .object({
      observer: z.literal("zamo"),
      radiusRg: z.number().finite().min(6).max(500),
      inclinationDegrees: z.number().finite().min(5).max(175),
      azimuthDegrees: z.number().finite().min(-360).max(360),
      verticalFieldOfViewDegrees: z.number().finite().min(1).max(90),
      tetrad: z.literal("orthonormal-zamo-v1"),
    })
    .strict(),
  grid: z
    .object({
      width: z.number().int().positive().max(25),
      height: z.number().int().positive().max(25),
      sampling: z.literal("pixel-centers-row-major"),
    })
    .strict(),
  rays: z
    .array(BlindedCameraAndSolverRaySchema)
    .min(1)
    .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
});

const BlindedIntegratorCaseSchema = BlindedCaseBaseSchema.extend({
  inputKind: z.literal("integrator-only"),
  rays: z
    .array(BlindedIntegratorRaySchema)
    .min(1)
    .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
});

const BlindedInputChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-answer-blinded-external-run-input"),
  })
  .strict();

export const KerrExternalBlindedRunInputSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("answer-blinded-external-kerr-run-input"),
    policyVersion: z.literal(KERR_EXTERNAL_AUTHORIZATION_POLICY_VERSION),
    inputId: z.string().regex(/^krblind_[a-f0-9]{24}$/),
    comparisonScope: z.enum(["integrator-only", "camera-and-solver"]),
    conventions: z
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
        screenBasis: z.literal("screen-x=+e-phi;screen-y=-e-theta;inward=-e-r"),
        azimuthRepresentation: z.literal(
          "wrapped-[0,2pi)-plus-signed-integer-winding",
        ),
      })
      .strict(),
    cases: z
      .array(
        z.union([
          BlindedIntegratorCaseSchema,
          BlindedCameraAndSolverCaseSchema,
        ]),
      )
      .min(1)
      .max(KERR_COMPARISON_MAX_CASES),
    answerBearingFieldsIncluded: z.literal(false),
    referenceIdentifiersIncluded: z.literal(false),
    referenceOutcomesIncluded: z.literal(false),
    referenceChecksumsIncluded: z.literal(false),
    tolerancesIncluded: z.literal(false),
    comparisonResultsIncluded: z.literal(false),
    inputChecksum: BlindedInputChecksumSchema,
  })
  .strict();
export type KerrExternalBlindedRunInput = z.infer<
  typeof KerrExternalBlindedRunInputSchema
>;

function blindedUnsigned(
  bundle: VerifiedKerrComparisonReferenceBundle,
  plan: KerrComparisonPlan,
) {
  const cases = bundle.cases.map((referenceCase, caseOrdinal) => {
    const planCase = plan.cases[caseOrdinal]!;
    const common = {
      caseOrdinal,
      spin: referenceCase.request.spin,
      eventSurfaces: planCase.eventSurfaces,
      maxAffineParameter: referenceCase.request.integration.maxAffineParameter,
    };
    if (plan.comparisonScope === "integrator-only") {
      return {
        ...common,
        inputKind: "integrator-only" as const,
        rays: referenceCase.report.rays.map((ray, rayOrdinal) => ({
          inputKind: "canonical-initial-state" as const,
          rayOrdinal,
          pixelIndex: ray.pixelIndex,
          pixelX: ray.pixelX,
          pixelY: ray.pixelY,
          screenX: ray.screenX,
          screenY: ray.screenY,
          initialState: ray.initialState,
        })),
      };
    }
    return {
      ...common,
      inputKind: "camera-and-solver" as const,
      camera: referenceCase.request.camera,
      grid: referenceCase.request.grid,
      rays: planCase.rays.map((ray, rayOrdinal) => ({
        inputKind: "camera-pixel-coordinate" as const,
        rayOrdinal,
        pixelIndex: ray.pixelIndex,
        pixelX: ray.pixelX,
        pixelY: ray.pixelY,
      })),
    };
  });
  return {
    schemaVersion: "1.0.0" as const,
    state: "answer-blinded-external-kerr-run-input" as const,
    policyVersion: KERR_EXTERNAL_AUTHORIZATION_POLICY_VERSION,
    comparisonScope: plan.comparisonScope,
    conventions: {
      units: "G=M=c=1" as const,
      metricSignature: "-+++" as const,
      coordinates: "Boyer-Lindquist" as const,
      thetaMeaning: "colatitude-radians" as const,
      spinMeaning: "signed-a-over-M" as const,
      momentumOrder: "p_t,p_r,p_theta,p_phi" as const,
      energyMeaning: "E=-p_t" as const,
      angularMomentumMeaning: "L_z=p_phi" as const,
      carterMeaning: "Q-not-K" as const,
      rayOrientation: "future-directed-camera-emitted-inward" as const,
      screenBasis: "screen-x=+e-phi;screen-y=-e-theta;inward=-e-r" as const,
      azimuthRepresentation:
        "wrapped-[0,2pi)-plus-signed-integer-winding" as const,
    },
    cases,
    answerBearingFieldsIncluded: false as const,
    referenceIdentifiersIncluded: false as const,
    referenceOutcomesIncluded: false as const,
    referenceChecksumsIncluded: false as const,
    tolerancesIncluded: false as const,
    comparisonResultsIncluded: false as const,
  };
}

export interface CreateKerrExternalBlindedRunInputInput {
  readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
  readonly plan: KerrComparisonPlan;
}

export function createKerrExternalBlindedRunInput(
  input: CreateKerrExternalBlindedRunInputInput,
): KerrExternalBlindedRunInput {
  const bundle = ownDataValue(
    input,
    "referenceBundle",
    "Kerr blinded input request",
  );
  const plan = ownDataValue(input, "plan", "Kerr blinded input request");
  assertVerifiedKerrComparisonReferenceBundle(bundle);
  assertKerrComparisonPlanIntegrity(bundle, plan);
  const unsigned = blindedUnsigned(bundle, plan);
  const inputId = `krblind_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const blinded = KerrExternalBlindedRunInputSchema.parse({
    ...unsigned,
    inputId,
    inputChecksum: checksum(
      "kerr-answer-blinded-external-run-input",
      { ...unsigned, inputId },
    ),
  });
  assertCanonicalByteBudget(blinded, "Kerr blinded input");
  return deepFreezeKerr(blinded);
}

export function assertKerrExternalBlindedRunInputIntegrity(
  bundleInput: unknown,
  planInput: unknown,
  blindedInput: unknown,
): asserts blindedInput is KerrExternalBlindedRunInput {
  assertVerifiedKerrComparisonReferenceBundle(bundleInput);
  assertKerrComparisonPlanIntegrity(bundleInput, planInput);
  assertKerrComparisonPlainDataTree(blindedInput, "Kerr blinded input");
  const parsed = KerrExternalBlindedRunInputSchema.parse(blindedInput);
  const expected = createKerrExternalBlindedRunInput({
    referenceBundle: bundleInput,
    plan: planInput,
  });
  if (kerrStableStringify(parsed) !== kerrStableStringify(expected)) {
    throw new Error(
      "Kerr blinded input does not match its verified bundle and comparison plan",
    );
  }
}

export function canonicalKerrExternalBlindedRunInputBytes(
  input: unknown,
): Uint8Array {
  assertKerrComparisonPlainDataTree(input, "Kerr blinded input");
  const parsed = KerrExternalBlindedRunInputSchema.parse(input);
  const { inputChecksum, inputId, ...unsignedWithoutId } = parsed;
  const unsignedWithId = { ...unsignedWithoutId, inputId };
  if (
    inputId !==
      `krblind_${kerrSha256Hex(kerrStableStringify(unsignedWithoutId)).slice(0, 24)}` ||
    inputChecksum.value !==
    kerrSha256Hex(kerrStableStringify(unsignedWithId))
  ) {
    throw new Error("Kerr blinded input checksum mismatch");
  }
  const bytes = new TextEncoder().encode(kerrStableStringify(parsed));
  if (bytes.byteLength > KERR_EXTERNAL_AUTHORIZATION_MAX_CANONICAL_BYTES) {
    throw new RangeError("Kerr blinded input exceeds its canonical byte budget");
  }
  return bytes;
}

export const KerrExternalReviewRoleSchema = z.enum([
  "scientific-independence",
  "execution-security",
  "license-output-rights",
]);
export type KerrExternalReviewRole = z.infer<
  typeof KerrExternalReviewRoleSchema
>;

const requiredReviewRoles: readonly KerrExternalReviewRole[] = [
  "scientific-independence",
  "execution-security",
  "license-output-rights",
] as const;

const SafeArgumentSchema = z
  .string()
  .max(500)
  .refine((value) => !value.includes("\0"), "Arguments must not contain NUL");
const SafeExecutablePathSchema = z
  .string()
  .regex(/^\/implementation\/[A-Za-z0-9._/-]{1,300}$/)
  .refine(
    (value) =>
      !value.split("/").includes("..") &&
      !value.includes("//") &&
      !value.endsWith("/"),
    "Executable path must stay in the implementation mount",
  );
const allowedEnvironmentNames = new Set([
  "MKL_NUM_THREADS",
  "NUMEXPR_NUM_THREADS",
  "OMP_NUM_THREADS",
  "OPENBLAS_NUM_THREADS",
  "RAYON_NUM_THREADS",
  "RUST_BACKTRACE",
  "VECLIB_MAXIMUM_THREADS",
]);
const EnvironmentNameSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]{0,63}$/)
  .refine(
    (value) => allowedEnvironmentNames.has(value),
    "Environment variable is not in the code-owned allowlist",
  );

export const KerrExternalReviewedExecutionProfileSchema = z
  .object({
    executableSha256: Sha256Schema,
    invocation: z
      .object({
        executablePath: SafeExecutablePathSchema,
        argv: z.array(SafeArgumentSchema).max(KERR_EXTERNAL_AUTHORIZATION_MAX_ARGV),
        shell: z.literal(false),
        pathLookup: z.literal(false),
        stdin: z.literal("closed"),
        workingDirectory: z.literal("/work"),
      })
      .strict(),
    deterministicEnvironment: z
      .object({
        inheritedEnvironment: z.literal(false),
        locale: z.literal("C"),
        timezone: z.literal("UTC"),
        randomSeed: z.string().regex(/^[0-9]{1,20}$/),
        threadCount: z.number().int().min(1).max(64),
        variables: z
          .array(
            z
              .object({
                name: EnvironmentNameSchema,
                value: z
                  .string()
                  .max(500)
                  .refine(
                    (value) => !value.includes("\0"),
                    "Environment values must not contain NUL",
                  ),
              })
              .strict()
              .superRefine((entry, context) => {
                const allowedValue =
                  entry.name === "RUST_BACKTRACE"
                    ? /^(?:0|1|full)$/.test(entry.value)
                    : /^[1-9][0-9]{0,2}$/.test(entry.value);
                if (!allowedValue) {
                  context.addIssue({
                    code: "custom",
                    path: ["value"],
                    message:
                      "Environment value is outside the code-owned deterministic allowlist",
                  });
                }
              }),
          )
          .max(KERR_EXTERNAL_AUTHORIZATION_MAX_ENVIRONMENT_ENTRIES),
        secretsAvailable: z.literal(false),
        proxyVariablesAllowed: z.literal(false),
        dynamicPreloadAllowed: z.literal(false),
      })
      .strict()
      .superRefine((environment, context) => {
        const names = environment.variables.map(({ name }) => name);
        if (
          new Set(names).size !== names.length ||
          names.some((name, index) => index > 0 && name <= names[index - 1]!)
        ) {
          context.addIssue({
            code: "custom",
            path: ["variables"],
            message: "Environment variables must be unique and sorted",
          });
        }
        for (const [index, entry] of environment.variables.entries()) {
          if (
            entry.name !== "RUST_BACKTRACE" &&
            entry.value !== String(environment.threadCount)
          ) {
            context.addIssue({
              code: "custom",
              path: ["variables", index, "value"],
              message:
                "Thread-control environment values must equal the reviewed thread count",
            });
          }
        }
      }),
    sandbox: z
      .object({
        network: z.literal("disabled"),
        sourceMount: z.literal("read-only-content-addressed"),
        writableArea: z.literal("isolated-empty-temporary-directory"),
        cosmographyRepositoryMounted: z.literal(false),
        comparisonPlanMounted: z.literal(false),
        referenceBundleMounted: z.literal(false),
        referenceOutcomesMounted: z.literal(false),
        referenceHashesMounted: z.literal(false),
        tolerancesMounted: z.literal(false),
      })
      .strict(),
    limits: z
      .object({
        maxCpuMilliseconds: z.number().int().min(1).max(3_600_000),
        maxWallMilliseconds: z.number().int().min(1).max(3_600_000),
        maxMemoryBytes: z.number().int().min(1).max(8 * 1024 * 1024 * 1024),
        maxProcesses: z.number().int().min(1).max(64),
        maxWritableBytes: z.number().int().min(1).max(2 * 1024 * 1024 * 1024),
        maxStderrBytes: z.number().int().min(1).max(1024 * 1024),
      })
      .strict(),
  })
  .strict();
export type KerrExternalReviewedExecutionProfile = z.infer<
  typeof KerrExternalReviewedExecutionProfileSchema
>;

const ReviewEvidenceBindingsSchema = z
  .object({
    sourceTreeSha256: Sha256Schema,
    dependencyManifestSha256: Sha256Schema,
    submoduleManifestSha256: Sha256Schema,
    lfsManifestSha256: Sha256Schema,
    sbomSha256: Sha256Schema,
    independenceReviewPackageSha256: Sha256Schema,
    licenseReviewPackageSha256: Sha256Schema,
    outputRightsReviewPackageSha256: Sha256Schema,
    knownCosmographyTreeMatch: z.literal(false),
    knownCosmographySolverDependencyMatch: z.literal(false),
    knownCosmographyGeneratedFixtureMatch: z.literal(false),
    knownMirrorOrForkLineageMatch: z.literal(false),
  })
  .strict();
export type KerrExternalReviewEvidenceBindings = z.infer<
  typeof ReviewEvidenceBindingsSchema
>;

const SelectionSubjectChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-external-implementation-selection-review-subject"),
  })
  .strict();

export const KerrExternalSelectionReviewSubjectSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("external-implementation-selection-review-subject"),
    policyVersion: z.literal(KERR_EXTERNAL_AUTHORIZATION_POLICY_VERSION),
    subjectId: z.string().regex(/^krrsubject_[a-f0-9]{24}$/),
    subjectFrozenAt: CanonicalTimestampSchema,
    planBinding: z
      .object({
        planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
        planChecksumSha256: Sha256Schema,
      })
      .strict(),
    blindedInputBinding: z
      .object({
        inputId: z.string().regex(/^krblind_[a-f0-9]{24}$/),
        inputChecksumSha256: Sha256Schema,
        caseCount: z.number().int().min(1).max(KERR_COMPARISON_MAX_CASES),
        totalRays: z
          .number()
          .int()
          .min(1)
          .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
      })
      .strict(),
    externalImplementation: z.unknown(),
    mapping: z.unknown(),
    evidenceBindings: ReviewEvidenceBindingsSchema,
    executionProfile: KerrExternalReviewedExecutionProfileSchema,
    intendedUse: z
      .object({
        purpose: z.literal("bounded-offline-independent-comparison-evaluation"),
        sourceAcquisitionAuthorized: z.literal(false),
        buildAuthorized: z.literal(false),
        executionAuthorized: z.literal(false),
        exactRawOutputEvidenceRetentionRequested: z.literal(true),
        redistributionAllowed: z.literal(false),
        publicationAllowed: z.literal(false),
        productUseAllowed: z.literal(false),
      })
      .strict(),
    subjectChecksum: SelectionSubjectChecksumSchema,
  })
  .strict();
export type KerrExternalSelectionReviewSubject = z.infer<
  typeof KerrExternalSelectionReviewSubjectSchema
>;

function selectionSubjectUnsigned(
  plan: KerrComparisonPlan,
  blinded: KerrExternalBlindedRunInput,
  subjectFrozenAt: string,
  evidenceBindings: KerrExternalReviewEvidenceBindings,
  executionProfile: KerrExternalReviewedExecutionProfile,
) {
  return {
    schemaVersion: "1.0.0" as const,
    state: "external-implementation-selection-review-subject" as const,
    policyVersion: KERR_EXTERNAL_AUTHORIZATION_POLICY_VERSION,
    subjectFrozenAt,
    planBinding: {
      planId: plan.planId,
      planChecksumSha256: plan.planChecksum.value,
    },
    blindedInputBinding: {
      inputId: blinded.inputId,
      inputChecksumSha256: blinded.inputChecksum.value,
      caseCount: blinded.cases.length,
      totalRays: blinded.cases.reduce(
        (total, current) => total + current.rays.length,
        0,
      ),
    },
    externalImplementation: plan.externalImplementation,
    mapping: plan.mapping,
    evidenceBindings,
    executionProfile,
    intendedUse: {
      purpose: "bounded-offline-independent-comparison-evaluation" as const,
      sourceAcquisitionAuthorized: false as const,
      buildAuthorized: false as const,
      executionAuthorized: false as const,
      exactRawOutputEvidenceRetentionRequested: true as const,
      redistributionAllowed: false as const,
      publicationAllowed: false as const,
      productUseAllowed: false as const,
    },
  };
}

export interface CreateKerrExternalSelectionReviewSubjectInput {
  readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
  readonly plan: KerrComparisonPlan;
  readonly blindedInput: KerrExternalBlindedRunInput;
  readonly subjectFrozenAt: unknown;
  readonly evidenceBindings: unknown;
  readonly executionProfile: unknown;
}

export function createKerrExternalSelectionReviewSubject(
  input: CreateKerrExternalSelectionReviewSubjectInput,
): KerrExternalSelectionReviewSubject {
  const bundle = ownDataValue(
    input,
    "referenceBundle",
    "Kerr selection subject input",
  );
  const plan = ownDataValue(input, "plan", "Kerr selection subject input");
  const blindedInput = ownDataValue(
    input,
    "blindedInput",
    "Kerr selection subject input",
  );
  assertVerifiedKerrComparisonReferenceBundle(bundle);
  assertKerrComparisonPlanIntegrity(bundle, plan);
  assertKerrExternalBlindedRunInputIntegrity(bundle, plan, blindedInput);
  const subjectFrozenAt = CanonicalTimestampSchema.parse(
    ownDataValue(input, "subjectFrozenAt", "Kerr selection subject input"),
  );
  if (subjectFrozenAt < plan.frozenAt) {
    throw new Error("Kerr selection review subject cannot predate its plan");
  }
  const evidenceInput = ownDataValue(
    input,
    "evidenceBindings",
    "Kerr selection subject input",
  );
  assertKerrComparisonPlainDataTree(
    evidenceInput,
    "Kerr selection review evidence bindings",
  );
  const evidenceBindings = ReviewEvidenceBindingsSchema.parse(evidenceInput);
  const executionProfileInput = ownDataValue(
    input,
    "executionProfile",
    "Kerr selection subject input",
  );
  assertKerrComparisonPlainDataTree(
    executionProfileInput,
    "Kerr reviewed execution profile",
  );
  const executionProfile = KerrExternalReviewedExecutionProfileSchema.parse(
    executionProfileInput,
  );
  const unsigned = selectionSubjectUnsigned(
    plan,
    blindedInput,
    subjectFrozenAt,
    evidenceBindings,
    executionProfile,
  );
  const subjectId = `krrsubject_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const subject = KerrExternalSelectionReviewSubjectSchema.parse({
    ...unsigned,
    subjectId,
    subjectChecksum: checksum(
      "kerr-external-implementation-selection-review-subject",
      { ...unsigned, subjectId },
    ),
  });
  assertCanonicalByteBudget(subject, "Kerr selection review subject");
  return deepFreezeKerr(subject);
}

export function assertKerrExternalSelectionReviewSubjectIntegrity(
  bundleInput: unknown,
  planInput: unknown,
  blindedInput: unknown,
  subjectInput: unknown,
): asserts subjectInput is KerrExternalSelectionReviewSubject {
  assertKerrComparisonPlainDataTree(
    subjectInput,
    "Kerr selection review subject",
  );
  const subject = KerrExternalSelectionReviewSubjectSchema.parse(subjectInput);
  const expected = createKerrExternalSelectionReviewSubject({
    referenceBundle: bundleInput as VerifiedKerrComparisonReferenceBundle,
    plan: planInput as KerrComparisonPlan,
    blindedInput: blindedInput as KerrExternalBlindedRunInput,
    subjectFrozenAt: subject.subjectFrozenAt,
    evidenceBindings: subject.evidenceBindings,
    executionProfile: subject.executionProfile,
  });
  if (kerrStableStringify(subject) !== kerrStableStringify(expected)) {
    throw new Error(
      "Kerr selection review subject does not match its plan and blinded input",
    );
  }
}

export const KerrExternalSelectionApprovalSchema = z
  .object({
    role: KerrExternalReviewRoleSchema,
    reviewerId: IdentifierSchema,
    roleGrantId: IdentifierSchema,
    keyId: IdentifierSchema,
    approvalReference: z.string().trim().min(1).max(500),
    subjectSha256: Sha256Schema,
    decidedAt: CanonicalTimestampSchema,
    expiresAt: CanonicalTimestampSchema,
    decision: z.literal("accepted-for-bounded-evaluation"),
  })
  .strict();
export type KerrExternalSelectionApproval = z.infer<
  typeof KerrExternalSelectionApprovalSchema
>;

export const KerrExternalReviewVerificationReceiptSchema = z
  .object({
    accepted: z.literal(true),
    role: KerrExternalReviewRoleSchema,
    reviewerId: IdentifierSchema,
    roleGrantId: IdentifierSchema,
    keyId: IdentifierSchema,
    subjectSha256: Sha256Schema,
    checkedAt: CanonicalTimestampSchema,
    signatureVerified: z.literal(true),
    roleGrantValid: z.literal(true),
    notRevoked: z.literal(true),
  })
  .strict();
export type KerrExternalReviewVerificationReceipt = z.infer<
  typeof KerrExternalReviewVerificationReceiptSchema
>;

export type KerrExternalSelectionApprovalVerifier = (
  subject: Readonly<KerrExternalSelectionReviewSubject>,
  approval: Readonly<KerrExternalSelectionApproval>,
) => unknown | Promise<unknown>;

const SelectionChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("reviewed-kerr-external-implementation-selection"),
  })
  .strict();

export const ReviewedKerrExternalImplementationSelectionSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("external-implementation-selection-reviewed-in-process"),
    selectionId: z.string().regex(/^krrsel_[a-f0-9]{24}$/),
    reviewedAt: CanonicalTimestampSchema,
    validUntil: CanonicalTimestampSchema,
    subject: KerrExternalSelectionReviewSubjectSchema,
    approvals: z.array(KerrExternalSelectionApprovalSchema).length(3),
    verificationReceipts: z
      .array(KerrExternalReviewVerificationReceiptSchema)
      .length(3),
    artifactEvidenceVerificationAllowed: z.literal(true),
    executionAuthorizationReviewAllowed: z.literal(true),
    externalExecutionAuthorized: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...downstreamNoAuthorityShape,
    selectionChecksum: SelectionChecksumSchema,
  })
  .strict();
export type ReviewedKerrExternalImplementationSelection = z.infer<
  typeof ReviewedKerrExternalImplementationSelectionSchema
>;

const issuedReviewedSelections = new WeakSet<object>();

function assertCanonicalReviewSet(
  approvals: readonly KerrExternalSelectionApproval[],
): void {
  if (
    approvals.some((approval, index) => approval.role !== requiredReviewRoles[index])
  ) {
    throw new Error(
      "Kerr external selection requires the three review roles in canonical order",
    );
  }
  for (const field of ["reviewerId", "roleGrantId", "keyId"] as const) {
    if (new Set(approvals.map((approval) => approval[field])).size !== 3) {
      throw new Error(`Kerr external selection ${field} values must be distinct`);
    }
  }
}

export interface ReviewKerrExternalImplementationSelectionInput {
  readonly referenceBundle: VerifiedKerrComparisonReferenceBundle;
  readonly plan: KerrComparisonPlan;
  readonly blindedInput: KerrExternalBlindedRunInput;
  readonly subject: KerrExternalSelectionReviewSubject;
  readonly approvals: readonly unknown[];
  readonly reviewedAt: unknown;
}

export async function reviewKerrExternalImplementationSelection(
  input: ReviewKerrExternalImplementationSelectionInput,
  verifyApproval: KerrExternalSelectionApprovalVerifier,
): Promise<ReviewedKerrExternalImplementationSelection> {
  const bundle = ownDataValue(input, "referenceBundle", "Kerr selection review");
  const plan = ownDataValue(input, "plan", "Kerr selection review");
  const blindedInput = ownDataValue(
    input,
    "blindedInput",
    "Kerr selection review",
  );
  const subjectInput = ownDataValue(input, "subject", "Kerr selection review");
  assertVerifiedKerrComparisonReferenceBundle(bundle);
  assertKerrComparisonPlanIntegrity(bundle, plan);
  assertKerrExternalBlindedRunInputIntegrity(bundle, plan, blindedInput);
  assertKerrExternalSelectionReviewSubjectIntegrity(
    bundle,
    plan,
    blindedInput,
    subjectInput,
  );
  const reviewedAt = CanonicalTimestampSchema.parse(
    ownDataValue(input, "reviewedAt", "Kerr selection review"),
  );
  const approvalsInput = ownDataValue(input, "approvals", "Kerr selection review");
  assertKerrComparisonPlainDataTree(
    approvalsInput,
    "Kerr selection approvals",
  );
  const approvals = z.array(KerrExternalSelectionApprovalSchema).length(3).parse(
    approvalsInput,
  );
  assertCanonicalReviewSet(approvals);
  if (reviewedAt < subjectInput.subjectFrozenAt) {
    throw new Error("Kerr selection review cannot predate its frozen subject");
  }
  for (const approval of approvals) {
    if (
      approval.subjectSha256 !== subjectInput.subjectChecksum.value ||
      approval.decidedAt < subjectInput.subjectFrozenAt ||
      approval.decidedAt > reviewedAt ||
      approval.expiresAt <= approval.decidedAt ||
      approval.expiresAt <= reviewedAt
    ) {
      throw new Error(
        "Kerr external selection approval has invalid binding or chronology",
      );
    }
  }
  const frozenSubject = deepFreezeKerr(
    KerrExternalSelectionReviewSubjectSchema.parse(subjectInput),
  );
  const frozenApprovals = deepFreezeKerr(
    approvals.map((approval) => KerrExternalSelectionApprovalSchema.parse(approval)),
  );
  const verificationReceipts: KerrExternalReviewVerificationReceipt[] = [];
  for (const approval of frozenApprovals) {
    const receiptInput = await verifyApproval(frozenSubject, approval);
    assertKerrComparisonPlainDataTree(
      receiptInput,
      "Kerr external selection verification receipt",
    );
    const receipt = KerrExternalReviewVerificationReceiptSchema.parse(receiptInput);
    if (
      receipt.role !== approval.role ||
      receipt.reviewerId !== approval.reviewerId ||
      receipt.roleGrantId !== approval.roleGrantId ||
      receipt.keyId !== approval.keyId ||
      receipt.subjectSha256 !== approval.subjectSha256 ||
      receipt.checkedAt < approval.decidedAt ||
      receipt.checkedAt > reviewedAt ||
      receipt.checkedAt >= approval.expiresAt
    ) {
      throw new Error(
        "Kerr external selection verifier receipt does not match its approval",
      );
    }
    verificationReceipts.push(receipt);
  }
  const validUntil = [...frozenApprovals]
    .map((approval) => approval.expiresAt)
    .sort()[0]!;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "external-implementation-selection-reviewed-in-process" as const,
    reviewedAt,
    validUntil,
    subject: frozenSubject,
    approvals: frozenApprovals,
    verificationReceipts,
    artifactEvidenceVerificationAllowed: true as const,
    executionAuthorizationReviewAllowed: true as const,
    externalExecutionAuthorized: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_AUTHORITY,
  };
  const selectionId = `krrsel_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const selection = ReviewedKerrExternalImplementationSelectionSchema.parse({
    ...unsigned,
    selectionId,
    selectionChecksum: checksum(
      "reviewed-kerr-external-implementation-selection",
      { ...unsigned, selectionId },
    ),
  });
  assertCanonicalByteBudget(selection, "Reviewed Kerr external selection");
  const frozen = deepFreezeKerr(selection);
  issuedReviewedSelections.add(frozen);
  return frozen;
}

export function assertIssuedReviewedKerrExternalImplementationSelection(
  input: unknown,
): asserts input is ReviewedKerrExternalImplementationSelection {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedReviewedSelections.has(input)
  ) {
    throw new Error(
      "Kerr external execution authorization requires an in-process reviewed selection capability; structural copies are rejected",
    );
  }
}

export function assertReviewedKerrExternalImplementationSelection(
  input: unknown,
): asserts input is ReviewedKerrExternalImplementationSelection {
  assertIssuedReviewedKerrExternalImplementationSelection(input);
}

const ExecutionRequestChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("kerr-external-execution-request"),
  })
  .strict();

export const KerrExternalExecutionRequestSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("external-kerr-execution-request-not-authorized"),
    requestId: z.string().regex(/^krxreq_[a-f0-9]{24}$/),
    requestedAt: CanonicalTimestampSchema,
    expiresAt: CanonicalTimestampSchema,
    attemptNonce: z.string().regex(/^[a-f0-9]{32}$/),
    audience: z.literal("isolated-external-kerr-runner-v1"),
    purpose: z.literal("produce-one-bounded-comparison-candidate"),
    selectionBinding: z
      .object({
        selectionId: z.string().regex(/^krrsel_[a-f0-9]{24}$/),
        selectionChecksumSha256: Sha256Schema,
      })
      .strict(),
    blindedInputBinding: z
      .object({
        inputId: z.string().regex(/^krblind_[a-f0-9]{24}$/),
        inputChecksumSha256: Sha256Schema,
        caseCount: z.number().int().min(1).max(KERR_COMPARISON_MAX_CASES),
        totalRays: z
          .number()
          .int()
          .min(1)
          .max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
      })
      .strict(),
    artifactBindings: z
      .object({
        sourceArchiveSha256: Sha256Schema,
        sourceTreeSha256: Sha256Schema,
        executableSha256: Sha256Schema,
        buildRecipeSha256: Sha256Schema,
        environmentManifestSha256: Sha256Schema,
        runRecipeSha256: Sha256Schema,
        normalizerSourceSha256: Sha256Schema,
      })
      .strict(),
    invocation: z
      .object({
        executablePath: SafeExecutablePathSchema,
        argv: z.array(SafeArgumentSchema).max(KERR_EXTERNAL_AUTHORIZATION_MAX_ARGV),
        shell: z.literal(false),
        pathLookup: z.literal(false),
        stdin: z.literal("closed"),
        workingDirectory: z.literal("/work"),
      })
      .strict(),
    deterministicEnvironment: z
      .object({
        inheritedEnvironment: z.literal(false),
        locale: z.literal("C"),
        timezone: z.literal("UTC"),
        randomSeed: z.string().regex(/^[0-9]{1,20}$/),
        threadCount: z.number().int().min(1).max(64),
        variables: z
          .array(
            z
              .object({
                name: EnvironmentNameSchema,
                value: z.string().max(500),
              })
              .strict(),
          )
          .max(KERR_EXTERNAL_AUTHORIZATION_MAX_ENVIRONMENT_ENTRIES),
        secretsAvailable: z.literal(false),
        proxyVariablesAllowed: z.literal(false),
        dynamicPreloadAllowed: z.literal(false),
      })
      .strict()
      .superRefine((environment, context) => {
        const names = environment.variables.map(({ name }) => name);
        if (
          new Set(names).size !== names.length ||
          names.some((name, index) => index > 0 && name <= names[index - 1]!)
        ) {
          context.addIssue({
            code: "custom",
            path: ["variables"],
            message: "Environment variables must be unique and sorted",
          });
        }
      }),
    sandbox: z
      .object({
        network: z.literal("disabled"),
        sourceMount: z.literal("read-only-content-addressed"),
        writableArea: z.literal("isolated-empty-temporary-directory"),
        cosmographyRepositoryMounted: z.literal(false),
        comparisonPlanMounted: z.literal(false),
        referenceBundleMounted: z.literal(false),
        referenceOutcomesMounted: z.literal(false),
        referenceHashesMounted: z.literal(false),
        tolerancesMounted: z.literal(false),
      })
      .strict(),
    limits: z
      .object({
        maxExecutions: z.literal(1),
        maxCases: z.number().int().min(1).max(KERR_COMPARISON_MAX_CASES),
        maxRays: z.number().int().min(1).max(KERR_COMPARISON_MAX_TOTAL_PIXELS),
        maxCpuMilliseconds: z.number().int().min(1).max(3_600_000),
        maxWallMilliseconds: z.number().int().min(1).max(3_600_000),
        maxMemoryBytes: z.number().int().min(1).max(8 * 1024 * 1024 * 1024),
        maxProcesses: z.number().int().min(1).max(64),
        maxWritableBytes: z.number().int().min(1).max(2 * 1024 * 1024 * 1024),
        maxStdoutBytes: z.literal(KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES),
        maxStderrBytes: z.number().int().min(1).max(1024 * 1024),
        maxOutputBytes: z.literal(KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES),
      })
      .strict(),
    ...packageNoExecutionShape,
    requestChecksum: ExecutionRequestChecksumSchema,
  })
  .strict();
export type KerrExternalExecutionRequest = z.infer<
  typeof KerrExternalExecutionRequestSchema
>;

export interface CreateKerrExternalExecutionRequestInput {
  readonly selection: ReviewedKerrExternalImplementationSelection;
  readonly blindedInput: KerrExternalBlindedRunInput;
  readonly requestedAt: unknown;
  readonly expiresAt: unknown;
  readonly attemptNonce: unknown;
  readonly executableSha256: unknown;
  readonly executablePath: unknown;
  readonly argv: unknown;
  readonly randomSeed: unknown;
  readonly threadCount: unknown;
  readonly environmentVariables: unknown;
  readonly maxCpuMilliseconds: unknown;
  readonly maxWallMilliseconds: unknown;
  readonly maxMemoryBytes: unknown;
  readonly maxProcesses: unknown;
  readonly maxWritableBytes: unknown;
  readonly maxStderrBytes: unknown;
}

export function createKerrExternalExecutionRequest(
  input: CreateKerrExternalExecutionRequestInput,
): KerrExternalExecutionRequest {
  const selection = ownDataValue(
    input,
    "selection",
    "Kerr external execution request",
  );
  assertIssuedReviewedKerrExternalImplementationSelection(selection);
  const blindedInput = ownDataValue(
    input,
    "blindedInput",
    "Kerr external execution request",
  );
  assertKerrComparisonPlainDataTree(blindedInput, "Kerr blinded input");
  const blinded = KerrExternalBlindedRunInputSchema.parse(blindedInput);
  canonicalKerrExternalBlindedRunInputBytes(blinded);
  if (
    blinded.inputId !== selection.subject.blindedInputBinding.inputId ||
    blinded.inputChecksum.value !==
      selection.subject.blindedInputBinding.inputChecksumSha256
  ) {
    throw new Error("Kerr execution request changed its reviewed blinded input");
  }
  const requestedAt = CanonicalTimestampSchema.parse(
    ownDataValue(input, "requestedAt", "Kerr external execution request"),
  );
  const expiresAt = CanonicalTimestampSchema.parse(
    ownDataValue(input, "expiresAt", "Kerr external execution request"),
  );
  if (
    requestedAt < selection.reviewedAt ||
    requestedAt >= selection.validUntil ||
    expiresAt <= requestedAt ||
    expiresAt > selection.validUntil ||
    Date.parse(expiresAt) - Date.parse(requestedAt) >
      KERR_EXTERNAL_AUTHORIZATION_MAX_VALIDITY_SECONDS * 1_000
  ) {
    throw new Error("Kerr execution request has invalid chronology or validity");
  }
  const argvInput = ownDataValue(input, "argv", "Kerr external execution request");
  const envInput = ownDataValue(
    input,
    "environmentVariables",
    "Kerr external execution request",
  );
  assertKerrComparisonPlainDataTree(argvInput, "Kerr execution argv");
  assertKerrComparisonPlainDataTree(envInput, "Kerr execution environment");
  const subject = selection.subject;
  const executionProfile = KerrExternalReviewedExecutionProfileSchema.parse({
    executableSha256: ownDataValue(
      input,
      "executableSha256",
      "Kerr external execution request",
    ),
    invocation: {
      executablePath: ownDataValue(
        input,
        "executablePath",
        "Kerr external execution request",
      ),
      argv: argvInput,
      shell: false,
      pathLookup: false,
      stdin: "closed",
      workingDirectory: "/work",
    },
    deterministicEnvironment: {
      inheritedEnvironment: false,
      locale: "C",
      timezone: "UTC",
      randomSeed: ownDataValue(
        input,
        "randomSeed",
        "Kerr external execution request",
      ),
      threadCount: ownDataValue(
        input,
        "threadCount",
        "Kerr external execution request",
      ),
      variables: envInput,
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
      maxCpuMilliseconds: ownDataValue(
        input,
        "maxCpuMilliseconds",
        "Kerr external execution request",
      ),
      maxWallMilliseconds: ownDataValue(
        input,
        "maxWallMilliseconds",
        "Kerr external execution request",
      ),
      maxMemoryBytes: ownDataValue(
        input,
        "maxMemoryBytes",
        "Kerr external execution request",
      ),
      maxProcesses: ownDataValue(
        input,
        "maxProcesses",
        "Kerr external execution request",
      ),
      maxWritableBytes: ownDataValue(
        input,
        "maxWritableBytes",
        "Kerr external execution request",
      ),
      maxStderrBytes: ownDataValue(
        input,
        "maxStderrBytes",
        "Kerr external execution request",
      ),
    },
  });
  if (
    kerrStableStringify(executionProfile) !==
    kerrStableStringify(subject.executionProfile)
  ) {
    throw new Error(
      "Kerr execution request changed its reviewed command, environment, sandbox, or limits",
    );
  }
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "external-kerr-execution-request-not-authorized" as const,
    requestedAt,
    expiresAt,
    attemptNonce: ownDataValue(
      input,
      "attemptNonce",
      "Kerr external execution request",
    ),
    audience: "isolated-external-kerr-runner-v1" as const,
    purpose: "produce-one-bounded-comparison-candidate" as const,
    selectionBinding: {
      selectionId: selection.selectionId,
      selectionChecksumSha256: selection.selectionChecksum.value,
    },
    blindedInputBinding: subject.blindedInputBinding,
    artifactBindings: {
      sourceArchiveSha256:
        (subject.externalImplementation as KerrComparisonPlan["externalImplementation"])
          .sourceArchive.sha256,
      sourceTreeSha256: subject.evidenceBindings.sourceTreeSha256,
      executableSha256: executionProfile.executableSha256,
      buildRecipeSha256:
        (subject.externalImplementation as KerrComparisonPlan["externalImplementation"])
          .environment.buildRecipeSha256,
      environmentManifestSha256:
        (subject.externalImplementation as KerrComparisonPlan["externalImplementation"])
          .environment.environmentManifestSha256,
      runRecipeSha256:
        (subject.externalImplementation as KerrComparisonPlan["externalImplementation"])
          .environment.runRecipeSha256,
      normalizerSourceSha256:
        (subject.mapping as KerrComparisonPlan["mapping"]).sourceSha256,
    },
    invocation: executionProfile.invocation,
    deterministicEnvironment: executionProfile.deterministicEnvironment,
    sandbox: executionProfile.sandbox,
    limits: {
      maxExecutions: 1 as const,
      maxCases: blinded.cases.length,
      maxRays: blinded.cases.reduce((total, current) => total + current.rays.length, 0),
      maxCpuMilliseconds: executionProfile.limits.maxCpuMilliseconds,
      maxWallMilliseconds: executionProfile.limits.maxWallMilliseconds,
      maxMemoryBytes: executionProfile.limits.maxMemoryBytes,
      maxProcesses: executionProfile.limits.maxProcesses,
      maxWritableBytes: executionProfile.limits.maxWritableBytes,
      maxStdoutBytes: KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
      maxStderrBytes: executionProfile.limits.maxStderrBytes,
      maxOutputBytes: KERR_COMPARISON_MAX_CANDIDATE_RAW_BYTES,
    },
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
  };
  const parsedUnsigned = KerrExternalExecutionRequestSchema.omit({
    requestId: true,
    requestChecksum: true,
  }).parse(unsigned);
  const requestId = `krxreq_${kerrSha256Hex(kerrStableStringify(parsedUnsigned)).slice(0, 24)}`;
  const request = KerrExternalExecutionRequestSchema.parse({
    ...parsedUnsigned,
    requestId,
    requestChecksum: checksum("kerr-external-execution-request", {
      ...parsedUnsigned,
      requestId,
    }),
  });
  assertCanonicalByteBudget(request, "Kerr external execution request");
  return deepFreezeKerr(request);
}

export function assertKerrExternalExecutionRequestIntegrity(
  selectionInput: unknown,
  requestInput: unknown,
): asserts requestInput is KerrExternalExecutionRequest {
  assertIssuedReviewedKerrExternalImplementationSelection(selectionInput);
  assertKerrComparisonPlainDataTree(
    requestInput,
    "Kerr external execution request",
  );
  const request = KerrExternalExecutionRequestSchema.parse(requestInput);
  const { requestChecksum, requestId, ...unsignedWithoutId } = request;
  const unsignedWithId = { ...unsignedWithoutId, requestId };
  const implementation = selectionInput.subject
    .externalImplementation as KerrComparisonPlan["externalImplementation"];
  const mapping = selectionInput.subject.mapping as KerrComparisonPlan["mapping"];
  const executionProfile = KerrExternalReviewedExecutionProfileSchema.parse({
    executableSha256: request.artifactBindings.executableSha256,
    invocation: request.invocation,
    deterministicEnvironment: request.deterministicEnvironment,
    sandbox: request.sandbox,
    limits: {
      maxCpuMilliseconds: request.limits.maxCpuMilliseconds,
      maxWallMilliseconds: request.limits.maxWallMilliseconds,
      maxMemoryBytes: request.limits.maxMemoryBytes,
      maxProcesses: request.limits.maxProcesses,
      maxWritableBytes: request.limits.maxWritableBytes,
      maxStderrBytes: request.limits.maxStderrBytes,
    },
  });
  if (
    requestId !==
      `krxreq_${kerrSha256Hex(kerrStableStringify(unsignedWithoutId)).slice(0, 24)}` ||
    requestChecksum.value !==
      kerrSha256Hex(kerrStableStringify(unsignedWithId)) ||
    request.selectionBinding.selectionId !== selectionInput.selectionId ||
    request.selectionBinding.selectionChecksumSha256 !==
      selectionInput.selectionChecksum.value ||
    request.blindedInputBinding.inputId !==
      selectionInput.subject.blindedInputBinding.inputId ||
    request.blindedInputBinding.inputChecksumSha256 !==
      selectionInput.subject.blindedInputBinding.inputChecksumSha256 ||
    request.blindedInputBinding.caseCount !==
      selectionInput.subject.blindedInputBinding.caseCount ||
    request.blindedInputBinding.totalRays !==
      selectionInput.subject.blindedInputBinding.totalRays ||
    request.artifactBindings.sourceArchiveSha256 !==
      implementation.sourceArchive.sha256 ||
    request.artifactBindings.sourceTreeSha256 !==
      selectionInput.subject.evidenceBindings.sourceTreeSha256 ||
    request.artifactBindings.buildRecipeSha256 !==
      implementation.environment.buildRecipeSha256 ||
    request.artifactBindings.environmentManifestSha256 !==
      implementation.environment.environmentManifestSha256 ||
    request.artifactBindings.runRecipeSha256 !==
      implementation.environment.runRecipeSha256 ||
    request.artifactBindings.normalizerSourceSha256 !== mapping.sourceSha256 ||
    request.limits.maxCases !==
      selectionInput.subject.blindedInputBinding.caseCount ||
    request.limits.maxRays !==
      selectionInput.subject.blindedInputBinding.totalRays ||
    kerrStableStringify(executionProfile) !==
      kerrStableStringify(selectionInput.subject.executionProfile) ||
    request.requestedAt < selectionInput.reviewedAt ||
    request.requestedAt >= selectionInput.validUntil ||
    request.expiresAt <= request.requestedAt ||
    request.expiresAt > selectionInput.validUntil ||
    Date.parse(request.expiresAt) - Date.parse(request.requestedAt) >
      KERR_EXTERNAL_AUTHORIZATION_MAX_VALIDITY_SECONDS * 1_000
  ) {
    throw new Error(
      "Kerr external execution request does not match its reviewed selection",
    );
  }
  assertCanonicalByteBudget(request, "Kerr external execution request");
}

export const KerrExternalCurrentGrantReceiptSchema = z
  .object({
    accepted: z.literal(true),
    role: KerrExternalReviewRoleSchema,
    reviewerId: IdentifierSchema,
    roleGrantId: IdentifierSchema,
    keyId: IdentifierSchema,
    subjectSha256: Sha256Schema,
    checkedAt: CanonicalTimestampSchema,
    roleGrantValid: z.literal(true),
    keyValid: z.literal(true),
    notRevoked: z.literal(true),
  })
  .strict();
export type KerrExternalCurrentGrantReceipt = z.infer<
  typeof KerrExternalCurrentGrantReceiptSchema
>;

export type KerrExternalCurrentGrantAuthorizer = (
  approval: Readonly<KerrExternalSelectionApproval>,
  context: Readonly<{
    checkedAt: string;
    subjectSha256: string;
    selectionId: string;
    requestId: string;
    authorizationId?: string;
  }>,
) => unknown | Promise<unknown>;

const AuthorizationChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("authorized-kerr-external-execution-request"),
  })
  .strict();

export const AuthorizedKerrExternalExecutionSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("external-execution-request-authorized-not-executed"),
    authorizationId: z.string().regex(/^krxauth_[a-f0-9]{24}$/),
    authorizedAt: CanonicalTimestampSchema,
    expiresAt: CanonicalTimestampSchema,
    selectionId: z.string().regex(/^krrsel_[a-f0-9]{24}$/),
    request: KerrExternalExecutionRequestSchema,
    currentGrantReceipts: z
      .array(KerrExternalCurrentGrantReceiptSchema)
      .length(3),
    externalExecutionAuthorized: z.literal(true),
    oneUse: z.literal(true),
    consumed: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...downstreamNoAuthorityShape,
    authorizationChecksum: AuthorizationChecksumSchema,
  })
  .strict();
export type AuthorizedKerrExternalExecution = z.infer<
  typeof AuthorizedKerrExternalExecutionSchema
>;

const issuedExecutionAuthorizations = new WeakSet<object>();
const consumedExecutionAuthorizations = new WeakSet<object>();
const executionAuthorizationContexts = new WeakMap<
  object,
  Readonly<{
    selection: ReviewedKerrExternalImplementationSelection;
    request: KerrExternalExecutionRequest;
  }>
>();
const issuedAuthorizationIds = new Set<string>();
const authorizedRequestIds = new Set<string>();

function assertGrantReceiptMatches(
  receipt: KerrExternalCurrentGrantReceipt,
  approval: KerrExternalSelectionApproval,
  checkedAt: string,
): void {
  if (
    receipt.role !== approval.role ||
    receipt.reviewerId !== approval.reviewerId ||
    receipt.roleGrantId !== approval.roleGrantId ||
    receipt.keyId !== approval.keyId ||
    receipt.subjectSha256 !== approval.subjectSha256 ||
    receipt.checkedAt !== checkedAt ||
    checkedAt < approval.decidedAt ||
    checkedAt >= approval.expiresAt
  ) {
    throw new Error("Kerr external authorization grant receipt mismatch");
  }
}

async function verifyCurrentGrants(
  selection: ReviewedKerrExternalImplementationSelection,
  request: KerrExternalExecutionRequest,
  checkedAt: string,
  authorizer: KerrExternalCurrentGrantAuthorizer,
  authorizationId?: string,
): Promise<readonly KerrExternalCurrentGrantReceipt[]> {
  const context = deepFreezeKerr({
    checkedAt,
    subjectSha256: selection.subject.subjectChecksum.value,
    selectionId: selection.selectionId,
    requestId: request.requestId,
    ...(authorizationId === undefined ? {} : { authorizationId }),
  });
  const receipts: KerrExternalCurrentGrantReceipt[] = [];
  for (const approval of selection.approvals) {
    const receiptInput = await authorizer(approval, context);
    assertKerrComparisonPlainDataTree(
      receiptInput,
      "Kerr external current grant receipt",
    );
    const receipt = KerrExternalCurrentGrantReceiptSchema.parse(receiptInput);
    assertGrantReceiptMatches(receipt, approval, checkedAt);
    receipts.push(receipt);
  }
  return deepFreezeKerr(receipts);
}

export interface AuthorizeKerrExternalExecutionInput {
  readonly selection: ReviewedKerrExternalImplementationSelection;
  readonly request: KerrExternalExecutionRequest;
  readonly authorizedAt: unknown;
}

export async function authorizeKerrExternalExecution(
  input: AuthorizeKerrExternalExecutionInput,
  authorizeCurrentGrant: KerrExternalCurrentGrantAuthorizer,
): Promise<AuthorizedKerrExternalExecution> {
  const selection = ownDataValue(
    input,
    "selection",
    "Kerr external execution authorization",
  );
  assertIssuedReviewedKerrExternalImplementationSelection(selection);
  const requestInput = ownDataValue(
    input,
    "request",
    "Kerr external execution authorization",
  );
  assertKerrExternalExecutionRequestIntegrity(selection, requestInput);
  const request = KerrExternalExecutionRequestSchema.parse(requestInput);
  const authorizedAt = CanonicalTimestampSchema.parse(
    ownDataValue(input, "authorizedAt", "Kerr external execution authorization"),
  );
  if (
    authorizedAt < request.requestedAt ||
    authorizedAt >= request.expiresAt ||
    authorizedAt >= selection.validUntil
  ) {
    throw new Error("Kerr external execution authorization is outside validity");
  }
  const identitySeed = {
    selectionId: selection.selectionId,
    requestId: request.requestId,
    requestChecksumSha256: request.requestChecksum.value,
    authorizedAt,
  };
  const authorizationId = `krxauth_${kerrSha256Hex(kerrStableStringify(identitySeed)).slice(0, 24)}`;
  if (issuedAuthorizationIds.has(authorizationId)) {
    throw new Error("Kerr external execution intent has already been authorized");
  }
  // Reserve before the first await so concurrent duplicate authorizations fail
  // closed. A rejected or throwing verifier burns this intent in this process.
  issuedAuthorizationIds.add(authorizationId);
  if (authorizedRequestIds.has(request.requestId)) {
    throw new Error("Kerr external execution request has already been authorized");
  }
  authorizedRequestIds.add(request.requestId);
  const currentGrantReceipts = await verifyCurrentGrants(
    selection,
    request,
    authorizedAt,
    authorizeCurrentGrant,
    authorizationId,
  );
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "external-execution-request-authorized-not-executed" as const,
    authorizationId,
    authorizedAt,
    expiresAt: request.expiresAt,
    selectionId: selection.selectionId,
    request,
    currentGrantReceipts,
    externalExecutionAuthorized: true as const,
    oneUse: true as const,
    consumed: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_AUTHORITY,
  };
  const authorization = AuthorizedKerrExternalExecutionSchema.parse({
    ...unsigned,
    authorizationChecksum: checksum(
      "authorized-kerr-external-execution-request",
      unsigned,
    ),
  });
  assertCanonicalByteBudget(authorization, "Kerr external execution authorization");
  const frozen = deepFreezeKerr(authorization);
  issuedExecutionAuthorizations.add(frozen);
  executionAuthorizationContexts.set(
    frozen,
    deepFreezeKerr({ selection, request: frozen.request }),
  );
  return frozen;
}

export function assertIssuedAuthorizedKerrExternalExecution(
  input: unknown,
): asserts input is AuthorizedKerrExternalExecution {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedExecutionAuthorizations.has(input)
  ) {
    throw new Error(
      "Kerr external execution requires an in-process authorization capability; structural copies are rejected",
    );
  }
  if (consumedExecutionAuthorizations.has(input)) {
    throw new Error("Kerr external execution authorization has already been consumed");
  }
}

export function assertAuthorizedKerrExternalExecution(
  input: unknown,
): asserts input is AuthorizedKerrExternalExecution {
  assertIssuedAuthorizedKerrExternalExecution(input);
}

export const KerrExternalRunnerHandoffSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("external-execution-request-released-not-executed"),
    authorizationId: z.string().regex(/^krxauth_[a-f0-9]{24}$/),
    consumedAt: CanonicalTimestampSchema,
    expiresAt: CanonicalTimestampSchema,
    audience: z.literal("isolated-external-kerr-runner-v1"),
    blindedInput: KerrExternalBlindedRunInputSchema,
    artifactBindings: KerrExternalExecutionRequestSchema.shape.artifactBindings,
    invocation: KerrExternalExecutionRequestSchema.shape.invocation,
    deterministicEnvironment:
      KerrExternalExecutionRequestSchema.shape.deterministicEnvironment,
    sandbox: KerrExternalExecutionRequestSchema.shape.sandbox,
    limits: KerrExternalExecutionRequestSchema.shape.limits,
    externalExecutionRequestReleased: z.literal(true),
    externalExecutionAuthorized: z.literal(true),
    executionVerified: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    implementationProvenanceVerified: z.literal(false),
    independenceVerified: z.literal(false),
    licenseVerified: z.literal(false),
    mappingCorrectnessVerified: z.literal(false),
    checksumAuthenticatesRecord: z.literal(false),
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
  })
  .strict();
export type KerrExternalRunnerHandoff = z.infer<
  typeof KerrExternalRunnerHandoffSchema
>;

const ClaimedHandoffChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("claimed-kerr-external-runner-handoff"),
  })
  .strict();

/**
 * Package-side capability issued only after an immediate-use grant recheck.
 * A runner receives `handoff`, never this plan-bound capability.
 */
export const ClaimedKerrExternalRunnerHandoffSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "external-kerr-runner-handoff-claimed-for-receipt-verification",
    ),
    claimId: z.string().regex(/^krxclaim_[a-f0-9]{24}$/),
    claimedAt: CanonicalTimestampSchema,
    expiresAt: CanonicalTimestampSchema,
    handoff: KerrExternalRunnerHandoffSchema,
    selectionBinding: z
      .object({
        selectionId: z.string().regex(/^krrsel_[a-f0-9]{24}$/),
        selectionChecksumSha256: Sha256Schema,
        selectionSubjectSha256: Sha256Schema,
        planId: z.string().regex(/^krcplan_[a-f0-9]{24}$/),
        planChecksumSha256: Sha256Schema,
      })
      .strict(),
    requestBinding: z
      .object({
        requestId: z.string().regex(/^krxreq_[a-f0-9]{24}$/),
        requestChecksumSha256: Sha256Schema,
        attemptNonce: z.string().regex(/^[a-f0-9]{32}$/),
        authorizationId: z.string().regex(/^krxauth_[a-f0-9]{24}$/),
        blindedInputId: z.string().regex(/^krblind_[a-f0-9]{24}$/),
        blindedInputChecksumSha256: Sha256Schema,
      })
      .strict(),
    executionReceiptVerificationAllowed: z.literal(true),
    claimIsExecutionProof: z.literal(false),
    claimChecksumAuthenticatesCapability: z.literal(false),
    independentReference: z.literal("not-run"),
    ...packageNoExecutionShape,
    ...downstreamNoAuthorityShape,
    claimChecksum: ClaimedHandoffChecksumSchema,
  })
  .strict();
export type ClaimedKerrExternalRunnerHandoff = z.infer<
  typeof ClaimedKerrExternalRunnerHandoffSchema
>;

export const KerrExternalSelectionReviewIdentityBindingsSchema = z
  .object({
    selectionId: z.string().regex(/^krrsel_[a-f0-9]{24}$/),
    approvals: z
      .array(
        z
          .object({
            role: KerrExternalReviewRoleSchema,
            reviewerId: IdentifierSchema,
            roleGrantId: IdentifierSchema,
            keyId: IdentifierSchema,
          })
          .strict(),
      )
      .length(3),
  })
  .strict();
export type KerrExternalSelectionReviewIdentityBindings = z.infer<
  typeof KerrExternalSelectionReviewIdentityBindingsSchema
>;

const issuedKerrExternalRunnerHandoffs = new WeakSet<object>();
const claimedKerrExternalRunnerHandoffs = new WeakSet<object>();
const kerrExternalRunnerHandoffContexts = new WeakMap<
  object,
  Readonly<{
    selection: ReviewedKerrExternalImplementationSelection;
    request: KerrExternalExecutionRequest;
  }>
>();
const issuedClaimedKerrExternalRunnerHandoffs = new WeakSet<object>();
const claimedKerrExternalRunnerHandoffContexts = new WeakMap<
  object,
  Readonly<{
    selection: ReviewedKerrExternalImplementationSelection;
    request: KerrExternalExecutionRequest;
    handoff: KerrExternalRunnerHandoff;
  }>
>();

export function assertIssuedKerrExternalRunnerHandoff(
  input: unknown,
): asserts input is KerrExternalRunnerHandoff {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedKerrExternalRunnerHandoffs.has(input)
  ) {
    throw new Error(
      "Kerr external runner handoff must be issued in this process; structural copies are rejected",
    );
  }
}

export function assertIssuedClaimedKerrExternalRunnerHandoff(
  input: unknown,
): asserts input is ClaimedKerrExternalRunnerHandoff {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedClaimedKerrExternalRunnerHandoffs.has(input)
  ) {
    throw new Error(
      "Claimed Kerr external runner handoff must be issued in this process; structural copies are rejected",
    );
  }
}

/**
 * Returns identity bindings only for a process-issued claimed handoff. These
 * bindings grant no authority; downstream review gates use them to prevent a
 * prior selection reviewer, grant, or key from being reused as a mapping
 * reviewer.
 */
export function kerrExternalClaimedHandoffSelectionReviewIdentityBindings(
  claimInput: unknown,
): KerrExternalSelectionReviewIdentityBindings {
  assertIssuedClaimedKerrExternalRunnerHandoff(claimInput);
  const context = claimedKerrExternalRunnerHandoffContexts.get(claimInput);
  if (context === undefined) {
    throw new Error("Claimed Kerr external runner handoff context is unavailable");
  }
  if (claimInput.selectionBinding.selectionId !== context.selection.selectionId) {
    throw new Error("Claimed Kerr handoff selection identity binding changed");
  }
  return deepFreezeKerr(
    KerrExternalSelectionReviewIdentityBindingsSchema.parse({
      selectionId: context.selection.selectionId,
      approvals: context.selection.approvals.map(
        ({ role, reviewerId, roleGrantId, keyId }) => ({
          role,
          reviewerId,
          roleGrantId,
          keyId,
        }),
      ),
    }),
  );
}

export interface ClaimKerrExternalRunnerHandoffInput {
  readonly handoff: KerrExternalRunnerHandoff;
  readonly checkedAt: unknown;
}

/**
 * Claims a process-issued handoff immediately before a future isolated runner
 * uses it. This function performs no execution. It burns the handoff before
 * the first await so concurrent or failed claims cannot be replayed.
 */
export async function claimKerrExternalRunnerHandoffForImmediateUse(
  input: ClaimKerrExternalRunnerHandoffInput,
  recheckCurrentGrant: KerrExternalCurrentGrantAuthorizer,
): Promise<ClaimedKerrExternalRunnerHandoff> {
  const handoff = ownDataValue(
    input,
    "handoff",
    "Kerr external runner handoff claim",
  );
  assertIssuedKerrExternalRunnerHandoff(handoff);
  if (claimedKerrExternalRunnerHandoffs.has(handoff)) {
    throw new Error("Kerr external runner handoff has already been claimed");
  }
  // Burn before the first await so concurrent consumers cannot both pass.
  claimedKerrExternalRunnerHandoffs.add(handoff);
  const checkedAt = CanonicalTimestampSchema.parse(
    ownDataValue(input, "checkedAt", "Kerr external runner handoff claim"),
  );
  const context = kerrExternalRunnerHandoffContexts.get(handoff);
  if (context === undefined) {
    throw new Error("Kerr external runner handoff context is unavailable");
  }
  if (
    checkedAt < handoff.consumedAt ||
    checkedAt >= handoff.expiresAt ||
    checkedAt >= context.selection.validUntil
  ) {
    throw new Error("Kerr external runner handoff is expired or not yet valid");
  }
  await verifyCurrentGrants(
    context.selection,
    context.request,
    checkedAt,
    recheckCurrentGrant,
    handoff.authorizationId,
  );
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state:
      "external-kerr-runner-handoff-claimed-for-receipt-verification" as const,
    claimedAt: checkedAt,
    expiresAt: handoff.expiresAt,
    handoff,
    selectionBinding: {
      selectionId: context.selection.selectionId,
      selectionChecksumSha256: context.selection.selectionChecksum.value,
      selectionSubjectSha256: context.selection.subject.subjectChecksum.value,
      planId: context.selection.subject.planBinding.planId,
      planChecksumSha256:
        context.selection.subject.planBinding.planChecksumSha256,
    },
    requestBinding: {
      requestId: context.request.requestId,
      requestChecksumSha256: context.request.requestChecksum.value,
      attemptNonce: context.request.attemptNonce,
      authorizationId: handoff.authorizationId,
      blindedInputId: handoff.blindedInput.inputId,
      blindedInputChecksumSha256: handoff.blindedInput.inputChecksum.value,
    },
    executionReceiptVerificationAllowed: true as const,
    claimIsExecutionProof: false as const,
    claimChecksumAuthenticatesCapability: false as const,
    independentReference: "not-run" as const,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
    ...KERR_EXTERNAL_AUTHORIZATION_NO_AUTHORITY,
  };
  const claimId = `krxclaim_${kerrSha256Hex(kerrStableStringify(unsigned)).slice(0, 24)}`;
  const claimed = deepFreezeKerr(
    ClaimedKerrExternalRunnerHandoffSchema.parse({
      ...unsigned,
      claimId,
      claimChecksum: checksum("claimed-kerr-external-runner-handoff", {
        ...unsigned,
        claimId,
      }),
    }),
  );
  assertCanonicalByteBudget(claimed, "Claimed Kerr external runner handoff");
  issuedClaimedKerrExternalRunnerHandoffs.add(claimed);
  claimedKerrExternalRunnerHandoffContexts.set(
    claimed,
    deepFreezeKerr({
      selection: context.selection,
      request: context.request,
      handoff: claimed.handoff,
    }),
  );
  return claimed;
}

export function assertClaimedKerrExternalRunnerHandoffPlanBinding(
  claimInput: unknown,
  bundleInput: unknown,
  planInput: unknown,
): void {
  assertIssuedClaimedKerrExternalRunnerHandoff(claimInput);
  assertVerifiedKerrComparisonReferenceBundle(bundleInput);
  assertKerrComparisonPlanIntegrity(bundleInput, planInput);
  const context = claimedKerrExternalRunnerHandoffContexts.get(claimInput);
  if (context === undefined) {
    throw new Error("Claimed Kerr external runner handoff context is unavailable");
  }
  assertKerrExternalExecutionRequestIntegrity(
    context.selection,
    context.request,
  );
  assertKerrExternalBlindedRunInputIntegrity(
    bundleInput,
    planInput,
    claimInput.handoff.blindedInput,
  );
  const plan = planInput as KerrComparisonPlan;
  if (
    claimInput.selectionBinding.selectionId !== context.selection.selectionId ||
    claimInput.selectionBinding.selectionChecksumSha256 !==
      context.selection.selectionChecksum.value ||
    claimInput.selectionBinding.selectionSubjectSha256 !==
      context.selection.subject.subjectChecksum.value ||
    claimInput.selectionBinding.planId !== plan.planId ||
    claimInput.selectionBinding.planChecksumSha256 !== plan.planChecksum.value ||
    claimInput.requestBinding.requestId !== context.request.requestId ||
    claimInput.requestBinding.requestChecksumSha256 !==
      context.request.requestChecksum.value ||
    claimInput.requestBinding.attemptNonce !== context.request.attemptNonce ||
    claimInput.requestBinding.authorizationId !==
      claimInput.handoff.authorizationId ||
    claimInput.requestBinding.blindedInputId !==
      claimInput.handoff.blindedInput.inputId ||
    claimInput.requestBinding.blindedInputChecksumSha256 !==
      claimInput.handoff.blindedInput.inputChecksum.value ||
    context.handoff !== claimInput.handoff
  ) {
    throw new Error(
      "Claimed Kerr external runner handoff does not match its plan, selection, request, or attempt",
    );
  }
}

export async function recheckClaimedKerrExternalRunnerHandoffCurrentGrants(
  claimInput: unknown,
  checkedAtInput: unknown,
  authorizer: KerrExternalCurrentGrantAuthorizer,
): Promise<void> {
  assertIssuedClaimedKerrExternalRunnerHandoff(claimInput);
  const checkedAt = CanonicalTimestampSchema.parse(checkedAtInput);
  const context = claimedKerrExternalRunnerHandoffContexts.get(claimInput);
  if (context === undefined) {
    throw new Error("Claimed Kerr external runner handoff context is unavailable");
  }
  if (
    checkedAt < claimInput.claimedAt ||
    checkedAt >= claimInput.expiresAt ||
    checkedAt >= context.selection.validUntil
  ) {
    throw new Error(
      "Claimed Kerr external runner handoff is expired or not yet valid",
    );
  }
  await verifyCurrentGrants(
    context.selection,
    context.request,
    checkedAt,
    authorizer,
    claimInput.handoff.authorizationId,
  );
}

export interface ConsumeKerrExternalExecutionAuthorizationInput {
  readonly authorization: AuthorizedKerrExternalExecution;
  readonly selection: ReviewedKerrExternalImplementationSelection;
  readonly blindedInput: KerrExternalBlindedRunInput;
  readonly consumedAt: unknown;
}

export async function consumeKerrExternalExecutionAuthorization(
  input: ConsumeKerrExternalExecutionAuthorizationInput,
  recheckCurrentGrant: KerrExternalCurrentGrantAuthorizer,
): Promise<KerrExternalRunnerHandoff> {
  const authorization = ownDataValue(
    input,
    "authorization",
    "Kerr external execution consumption",
  );
  assertIssuedAuthorizedKerrExternalExecution(authorization);
  // Burn before the first await so concurrent consumers cannot both pass.
  consumedExecutionAuthorizations.add(authorization);
  const selection = ownDataValue(
    input,
    "selection",
    "Kerr external execution consumption",
  );
  assertIssuedReviewedKerrExternalImplementationSelection(selection);
  const authorizationContext = executionAuthorizationContexts.get(authorization);
  if (
    authorizationContext === undefined ||
    authorizationContext.selection !== selection ||
    authorizationContext.request !== authorization.request ||
    selection.selectionId !== authorization.selectionId ||
    selection.selectionChecksum.value !==
      authorization.request.selectionBinding.selectionChecksumSha256
  ) {
    throw new Error("Kerr execution authorization changed its selection");
  }
  assertKerrExternalExecutionRequestIntegrity(selection, authorization.request);
  const blindedInput = ownDataValue(
    input,
    "blindedInput",
    "Kerr external execution consumption",
  );
  assertKerrComparisonPlainDataTree(blindedInput, "Kerr blinded runner input");
  const blinded = KerrExternalBlindedRunInputSchema.parse(blindedInput);
  canonicalKerrExternalBlindedRunInputBytes(blinded);
  if (
    blinded.inputId !== authorization.request.blindedInputBinding.inputId ||
    blinded.inputChecksum.value !==
      authorization.request.blindedInputBinding.inputChecksumSha256
  ) {
    throw new Error("Kerr runner handoff changed its blinded input");
  }
  const consumedAt = CanonicalTimestampSchema.parse(
    ownDataValue(input, "consumedAt", "Kerr external execution consumption"),
  );
  if (
    consumedAt < authorization.authorizedAt ||
    consumedAt >= authorization.expiresAt ||
    consumedAt >= selection.validUntil
  ) {
    throw new Error("Kerr execution authorization is expired or not yet valid");
  }
  await verifyCurrentGrants(
    selection,
    authorization.request,
    consumedAt,
    recheckCurrentGrant,
    authorization.authorizationId,
  );
  const handoff = deepFreezeKerr(
    KerrExternalRunnerHandoffSchema.parse({
      schemaVersion: "1.0.0",
      state: "external-execution-request-released-not-executed",
      authorizationId: authorization.authorizationId,
      consumedAt,
      expiresAt: authorization.expiresAt,
      audience: authorization.request.audience,
      blindedInput: blinded,
      artifactBindings: authorization.request.artifactBindings,
      invocation: authorization.request.invocation,
      deterministicEnvironment: authorization.request.deterministicEnvironment,
      sandbox: authorization.request.sandbox,
      limits: authorization.request.limits,
      externalExecutionRequestReleased: true,
      externalExecutionAuthorized: true,
      executionVerified: false,
      independentReference: "not-run",
      ...KERR_EXTERNAL_AUTHORIZATION_NO_PACKAGE_EXECUTION,
      implementationProvenanceVerified: false,
      independenceVerified: false,
      licenseVerified: false,
      mappingCorrectnessVerified: false,
      checksumAuthenticatesRecord: false,
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
    }),
  );
  issuedKerrExternalRunnerHandoffs.add(handoff);
  kerrExternalRunnerHandoffContexts.set(
    handoff,
    deepFreezeKerr({ selection, request: authorization.request }),
  );
  return handoff;
}

export function canUseKerrExternalAuthorizationForRender(_input: unknown): false {
  return false;
}
