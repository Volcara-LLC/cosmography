import { z } from "zod";

import {
  AssetIdSchema,
  CaptureContextIdSchema,
  GeometryValidationIdSchema,
  KernelArtifactIdSchema,
  KernelSetIdSchema,
  SemVerSchema,
  Sha256Schema,
} from "./ids";
import { RightsStatementSchema } from "./rights";

const LocalReferenceIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const SafeFilenameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (value) =>
      !/[\r\n\0]/.test(value) &&
      /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value),
    "Filename contains characters outside the reviewed archive-safe set",
  )
  .refine((value) => !/[\\/]/.test(value), "Filename cannot contain a path separator")
  .refine((value) => !value.includes(".."), "Filename cannot contain traversal segments")
  .refine((value) => !/[?*\[\]]/.test(value), "Filename cannot contain wildcard syntax")
  .refine((value) => !/(?:^|[._-])latest(?:[._-]|$)/i.test(value), {
    message: "Kernel selections cannot use a mutable latest alias",
  });

const NaifArtifactUrlSchema = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "naif.jpl.nasa.gov" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      url.pathname.startsWith("/pub/naif/") &&
      url.search === "" &&
      url.hash === ""
    );
  }, "Kernel artifacts must use an exact HTTPS URL below the official NAIF archive");

const HttpsUrlSchema = z
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "Mission provenance URLs must use HTTPS",
  });

const ImmutableObjectKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(1024)
  .refine((value) => !value.includes("\\"), "Object keys must use forward slashes")
  .refine(
    (value) => value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    "Object keys must be canonical and cannot contain empty or traversal segments",
  )
  .refine((value) => /^[a-z0-9][a-z0-9/_\-.]+$/.test(value), {
    message: "Object keys must use canonical lowercase storage characters",
  });

export const SpiceKernelTypeSchema = z.enum([
  "SPK",
  "CK",
  "SCLK",
  "LSK",
  "FK",
  "IK",
  "PCK",
  "DSK",
]);

export const SpiceKernelQualitySchema = z.enum([
  "generic-time-system",
  "planetary-ephemeris",
  "mission-design-reconstruction",
  "encounter-reconstruction",
  "mixed-reconstruction-and-prediction",
  "tracking-refit-reconstruction-and-prediction",
  "attitude-reconstruction",
  "attitude-prediction",
  "frame-definition",
  "instrument-model",
  "body-model",
]);

const KernelCoverageSchema = z
  .object({
    targetNaifId: z.number().int(),
    centerNaifId: z.number().int().optional(),
    startEtLabel: z.string().trim().min(1),
    endEtLabel: z.string().trim().min(1),
    source: z.string().trim().min(1),
  })
  .strict();

export const SelectedKernelArtifactSchema = z
  .object({
    artifactId: KernelArtifactIdSchema,
    kernelType: SpiceKernelTypeSchema,
    role: z.string().trim().min(1),
    filename: SafeFilenameSchema,
    officialUrl: NaifArtifactUrlSchema,
    loadOrder: z.number().int().positive(),
    quality: SpiceKernelQualitySchema,
    sourceModifiedAt: z.iso.datetime({ offset: true }).optional(),
    directorySizeLabel: z.string().trim().min(1).optional(),
    coverage: z.array(KernelCoverageSchema).min(1),
    selectionBasis: z.string().trim().min(1),
    sourceReferenceIds: z.array(LocalReferenceIdSchema).min(1),
  })
  .strict()
  .superRefine((artifact, context) => {
    let urlFilename = "";
    try {
      urlFilename = decodeURIComponent(
        new URL(artifact.officialUrl).pathname.split("/").at(-1) ?? "",
      );
    } catch {
      context.addIssue({
        code: "custom",
        path: ["officialUrl"],
        message: "Kernel URL basename must use valid percent encoding",
      });
      return;
    }
    if (urlFilename !== artifact.filename) {
      context.addIssue({
        code: "custom",
        path: ["officialUrl"],
        message: "Kernel URL basename must exactly match the selected filename",
      });
    }
    const allowedExtensions: Record<z.infer<typeof SpiceKernelTypeSchema>, readonly string[]> = {
      SPK: [".bsp"],
      CK: [".bc"],
      SCLK: [".tsc"],
      LSK: [".tls"],
      FK: [".tf"],
      IK: [".ti"],
      PCK: [".tpc", ".bpc"],
      DSK: [".bds"],
    };
    if (!allowedExtensions[artifact.kernelType].some((extension) => artifact.filename.endsWith(extension))) {
      context.addIssue({
        code: "custom",
        path: ["filename"],
        message: `Kernel filename extension does not match ${artifact.kernelType}`,
      });
    }
    const allowedQualities: Record<
      z.infer<typeof SpiceKernelTypeSchema>,
      readonly z.infer<typeof SpiceKernelQualitySchema>[]
    > = {
      SPK: [
        "planetary-ephemeris",
        "mission-design-reconstruction",
        "encounter-reconstruction",
        "mixed-reconstruction-and-prediction",
        "tracking-refit-reconstruction-and-prediction",
      ],
      CK: ["attitude-reconstruction", "attitude-prediction"],
      SCLK: ["generic-time-system"],
      LSK: ["generic-time-system"],
      FK: ["frame-definition"],
      IK: ["instrument-model"],
      PCK: ["body-model"],
      DSK: ["body-model"],
    };
    if (!allowedQualities[artifact.kernelType].includes(artifact.quality)) {
      context.addIssue({
        code: "custom",
        path: ["quality"],
        message: `Kernel quality does not match ${artifact.kernelType}`,
      });
    }
  });

const VerifiedKernelArtifactSchema = SelectedKernelArtifactSchema.safeExtend({
  byteLength: z.number().int().positive(),
  sha256: Sha256Schema,
  capturedAt: z.iso.datetime({ offset: true }),
  immutableObjectKey: z
    .string()
    .pipe(ImmutableObjectKeySchema)
    .refine((value) => value.startsWith("kernels/"), "Kernel objects belong below kernels/"),
}).strict();

const SpiceQueryContextSchema = z
  .object({
    targetNaifId: z.number().int(),
    centerNaifId: z.number().int(),
    frame: z.string().trim().min(1),
    referenceSystem: z.string().trim().min(1),
    timeScale: z.literal("TDB"),
    units: z.literal("AU and AU/day"),
    aberrationCorrection: z.literal("NONE (geometric)"),
  })
  .strict()
  .refine(
    (context) => context.targetNaifId !== context.centerNaifId,
    { path: ["centerNaifId"], message: "SPICE query target and center must differ" },
  );

const KernelSetCommonSchema = z
  .object({
    schemaVersion: SemVerSchema,
    kernelSetId: KernelSetIdSchema,
    missionId: LocalReferenceIdSchema,
    sourceId: z.literal("naif-spice"),
    purpose: z.enum(["trajectory", "capture-context"]),
    selectedAt: z.iso.datetime({ offset: true }),
    queryContext: SpiceQueryContextSchema,
    sourceReferenceIds: z.array(LocalReferenceIdSchema).min(1),
    caveats: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

function validateArtifactOrder(
  artifacts: readonly { artifactId: string; filename: string; loadOrder: number }[],
  context: z.RefinementCtx,
) {
  const ids = artifacts.map((artifact) => artifact.artifactId);
  const filenames = artifacts.map((artifact) => artifact.filename.toLowerCase());
  const orders = artifacts.map((artifact) => artifact.loadOrder).sort((a, b) => a - b);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "Kernel artifact IDs must be unique" });
  }
  if (new Set(filenames).size !== filenames.length) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "Kernel filenames must be unique" });
  }
  if (orders.some((order, index) => order !== index + 1)) {
    context.addIssue({
      code: "custom",
      path: ["artifacts"],
      message: "Kernel load order must be contiguous and start at one",
    });
  }
}

function validateSpkCenterClosure(
  selection: {
    purpose: "trajectory" | "capture-context";
    queryContext: { targetNaifId: number; centerNaifId: number };
    artifacts: readonly {
      kernelType: z.infer<typeof SpiceKernelTypeSchema>;
      quality: z.infer<typeof SpiceKernelQualitySchema>;
      coverage: readonly {
        targetNaifId: number;
        centerNaifId?: number | undefined;
      }[];
    }[];
  },
  context: z.RefinementCtx,
) {
  const queryTargetCenters = new Set<number>();
  const centerGraph = new Map<number, Set<number>>();
  const connect = (left: number, right: number) => {
    const leftEdges = centerGraph.get(left) ?? new Set<number>();
    leftEdges.add(right);
    centerGraph.set(left, leftEdges);
    const rightEdges = centerGraph.get(right) ?? new Set<number>();
    rightEdges.add(left);
    centerGraph.set(right, rightEdges);
  };
  for (const artifact of selection.artifacts) {
    if (artifact.kernelType !== "SPK") {
      continue;
    }
    for (const coverage of artifact.coverage) {
      if (coverage.centerNaifId === undefined) {
        continue;
      }
      if (coverage.targetNaifId === selection.queryContext.targetNaifId) {
        queryTargetCenters.add(coverage.centerNaifId);
      } else {
        connect(coverage.targetNaifId, coverage.centerNaifId);
      }
    }
  }

  if (queryTargetCenters.size === 0) {
    context.addIssue({
      code: "custom",
      path: ["artifacts"],
      message: `SPK coverage must declare query target ${selection.queryContext.targetNaifId}`,
    });
    return;
  }

  const reachesQueryCenter = (start: number): boolean => {
    const visited = new Set<number>([start]);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === selection.queryContext.centerNaifId) {
        return true;
      }
      for (const next of centerGraph.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  };

  for (const center of queryTargetCenters) {
    if (center !== selection.queryContext.centerNaifId && !reachesQueryCenter(center)) {
      context.addIssue({
        code: "custom",
        path: ["artifacts"],
        message:
          `SPK target ${selection.queryContext.targetNaifId} center ${center} needs a declared center chain to query center ${selection.queryContext.centerNaifId}`,
      });
    }
  }
}

export const BlockedKernelSelectionSchema = KernelSetCommonSchema.extend({
  state: z.literal("blocked-missing-artifacts"),
  artifacts: z.array(SelectedKernelArtifactSchema).min(1),
  executionAllowed: z.literal(false),
  releaseEligible: z.literal(false),
  missingEvidence: z.array(z.string().trim().min(1)).min(1),
}).superRefine((selection, context) => {
  validateArtifactOrder(selection.artifacts, context);
  validateSpkCenterClosure(selection, context);
  if (!selection.artifacts.some((artifact) => artifact.kernelType === "SPK")) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "Trajectory selection needs an SPK" });
  }
  if (!selection.artifacts.some((artifact) => artifact.kernelType === "LSK")) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "Trajectory selection needs an LSK" });
  }
});

const VerifiedSupportingArtifactSchema = z
  .object({
    kind: z.enum(["meta-kernel", "coverage-report"]),
    filename: SafeFilenameSchema,
    byteLength: z.number().int().positive(),
    sha256: Sha256Schema,
    capturedAt: z.iso.datetime({ offset: true }),
    immutableObjectKey: z
      .string()
      .pipe(ImmutableObjectKeySchema)
      .refine(
        (value) => value.startsWith("kernels/") || value.startsWith("validation/"),
        "Supporting kernel evidence belongs below kernels/ or validation/",
      ),
  })
  .strict()
  .superRefine((artifact, context) => {
    const requiredExtension =
      artifact.kind === "meta-kernel" ? ".tm" : ".json";
    if (!artifact.filename.endsWith(requiredExtension)) {
      context.addIssue({
        code: "custom",
        path: ["filename"],
        message: `${artifact.kind} evidence must use ${requiredExtension}`,
      });
    }
  });

export const CompleteKernelSetManifestSchema = KernelSetCommonSchema.extend({
  state: z.literal("artifact-evidence-complete"),
  artifacts: z.array(VerifiedKernelArtifactSchema).min(1),
  toolkitVersion: z.string().trim().min(1),
  metaKernel: VerifiedSupportingArtifactSchema.safeExtend({
    kind: z.literal("meta-kernel"),
  }).strict(),
  coverageReport: VerifiedSupportingArtifactSchema.safeExtend({
    kind: z.literal("coverage-report"),
  }).strict(),
  coverageValidatedAt: z.iso.datetime({ offset: true }),
  validatorCodeCommit: z.string().regex(/^[a-f0-9]{7,64}$/),
  approvedStateGeneratorCodeCommit: z.string().regex(/^[a-f0-9]{7,64}$/),
  approvedStateParserCodeCommit: z.string().regex(/^[a-f0-9]{7,64}$/),
  manifestCanonicalization: z.literal("cosmography-spice-kernel-set-json-v1"),
  manifestSha256: Sha256Schema,
  executionAllowed: z.literal(false),
  releaseEligible: z.literal(false),
}).superRefine((selection, context) => {
  validateArtifactOrder(selection.artifacts, context);
  validateSpkCenterClosure(selection, context);
  if (!selection.artifacts.some((artifact) => artifact.kernelType === "SPK")) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "Complete kernel evidence needs an SPK" });
  }
  if (!selection.artifacts.some((artifact) => artifact.kernelType === "LSK")) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "Complete kernel evidence needs an LSK" });
  }
  if (selection.purpose === "capture-context") {
    for (const requiredType of ["CK", "SCLK", "FK", "IK"] as const) {
      if (!selection.artifacts.some((artifact) => artifact.kernelType === requiredType)) {
        context.addIssue({
          code: "custom",
          path: ["artifacts"],
          message: `Capture-context kernel evidence needs a ${requiredType}`,
        });
      }
    }
  }
  const retainedObjectKeys = [
    ...selection.artifacts.map((artifact) => artifact.immutableObjectKey),
    selection.metaKernel.immutableObjectKey,
    selection.coverageReport.immutableObjectKey,
  ];
  if (new Set(retainedObjectKeys).size !== retainedObjectKeys.length) {
    context.addIssue({
      code: "custom",
      path: ["artifacts"],
      message: "Every retained kernel/supporting artifact needs a unique immutable object key",
    });
  }
  const selectedAt = Date.parse(selection.selectedAt);
  const coverageValidatedAt = Date.parse(selection.coverageValidatedAt);
  const capturedEvidence = [
    ...selection.artifacts.map((artifact) => ({
      path: ["artifacts"] as (string | number)[],
      capturedAt: artifact.capturedAt,
    })),
    { path: ["metaKernel"], capturedAt: selection.metaKernel.capturedAt },
    {
      path: ["coverageReport"],
      capturedAt: selection.coverageReport.capturedAt,
    },
  ];
  for (const evidence of capturedEvidence) {
    const capturedAt = Date.parse(evidence.capturedAt);
    if (capturedAt < selectedAt) {
      context.addIssue({
        code: "custom",
        path: evidence.path,
        message: "Kernel evidence cannot predate the reviewed selection",
      });
    }
    if (capturedAt > coverageValidatedAt) {
      context.addIssue({
        code: "custom",
        path: evidence.path,
        message: "Coverage validation cannot predate retained kernel evidence",
      });
    }
  }
  const coverageCapturedAt = Date.parse(selection.coverageReport.capturedAt);
  const latestCoverageInput = Math.max(
    Date.parse(selection.metaKernel.capturedAt),
    ...selection.artifacts.map((artifact) => Date.parse(artifact.capturedAt)),
  );
  if (coverageCapturedAt < latestCoverageInput) {
    context.addIssue({
      code: "custom",
      path: ["coverageReport", "capturedAt"],
      message: "Coverage report cannot predate any retained kernel or meta-kernel input",
    });
  }
});

export const SpiceKernelSetSchema = z.discriminatedUnion("state", [
  BlockedKernelSelectionSchema,
  CompleteKernelSetManifestSchema,
]);
export type SpiceKernelSet = z.infer<typeof SpiceKernelSetSchema>;
export type CompleteKernelSetManifest = z.infer<
  typeof CompleteKernelSetManifestSchema
>;

const KernelSelectionReviewSchema = z
  .object({
    reviewedAt: z.iso.datetime({ offset: true }),
    reviewerId: LocalReferenceIdSchema,
    approvalReference: z.string().trim().min(1),
  })
  .strict();
export type KernelSelectionReview = z.infer<
  typeof KernelSelectionReviewSchema
>;

export type ReviewedKernelSelection = Readonly<{
  state: "selection-reviewed-for-artifact-verification";
  selection: z.infer<typeof BlockedKernelSelectionSchema>;
  review: Readonly<KernelSelectionReview>;
  executionAllowed: false;
  releaseEligible: false;
}>;

export type KernelSelectionAuthorizer = (
  selection: Readonly<z.infer<typeof BlockedKernelSelectionSchema>>,
  review: Readonly<KernelSelectionReview>,
) => boolean | Promise<boolean>;

const issuedReviewedKernelSelections = new WeakSet<object>();

export async function reviewKernelSelection(
  input: unknown,
  reviewInput: unknown,
  authorizeReview: KernelSelectionAuthorizer,
): Promise<ReviewedKernelSelection> {
  const selection = freezeRecursively(
    BlockedKernelSelectionSchema.parse(input),
  );
  const review = freezeRecursively(KernelSelectionReviewSchema.parse(reviewInput));
  if (Date.parse(review.reviewedAt) < Date.parse(selection.selectedAt)) {
    throw new Error("Kernel selection review cannot predate the selection");
  }
  if (!(await authorizeReview(selection, review))) {
    throw new Error("Kernel selection authorizer rejected the reviewed selection");
  }
  const reviewed = freezeRecursively({
    state: "selection-reviewed-for-artifact-verification" as const,
    selection,
    review,
    executionAllowed: false as const,
    releaseEligible: false as const,
  });
  issuedReviewedKernelSelections.add(reviewed);
  return reviewed;
}

function assertIssuedReviewedKernelSelection(
  input: ReviewedKernelSelection,
): void {
  if (!issuedReviewedKernelSelections.has(input)) {
    throw new Error(
      "Kernel execution verification requires an in-process reviewed selection token",
    );
  }
}

function kernelSelectionBinding(
  selection:
    | z.infer<typeof BlockedKernelSelectionSchema>
    | CompleteKernelSetManifest,
): unknown {
  return {
    schemaVersion: selection.schemaVersion,
    kernelSetId: selection.kernelSetId,
    missionId: selection.missionId,
    sourceId: selection.sourceId,
    purpose: selection.purpose,
    selectedAt: selection.selectedAt,
    queryContext: selection.queryContext,
    sourceReferenceIds: selection.sourceReferenceIds,
    caveats: selection.caveats,
    artifacts: selection.artifacts.map((artifact) => ({
      artifactId: artifact.artifactId,
      kernelType: artifact.kernelType,
      role: artifact.role,
      filename: artifact.filename,
      officialUrl: artifact.officialUrl,
      loadOrder: artifact.loadOrder,
      quality: artifact.quality,
      ...(artifact.sourceModifiedAt === undefined
        ? {}
        : { sourceModifiedAt: artifact.sourceModifiedAt }),
      ...(artifact.directorySizeLabel === undefined
        ? {}
        : { directorySizeLabel: artifact.directorySizeLabel }),
      coverage: artifact.coverage,
      selectionBasis: artifact.selectionBasis,
      sourceReferenceIds: artifact.sourceReferenceIds,
    })),
  };
}

type KernelEvidenceBase = Readonly<{
  filename: string;
  byteLength: number;
  sha256: string;
  immutableObjectKey: string;
  capturedAt: string;
}>;

export type KernelEvidence =
  | (KernelEvidenceBase & Readonly<{ kind: "kernel-artifact" }>)
  | (KernelEvidenceBase &
      Readonly<{
        kind: "meta-kernel";
        expectedLoadOrder: readonly string[];
      }>)
  | (KernelEvidenceBase &
      Readonly<{
        kind: "coverage-report";
        expectedKernelDigests: readonly string[];
        expectedQueryContext: z.infer<typeof SpiceQueryContextSchema>;
      }>);

export type KernelEvidenceVerifier = (
  evidence: KernelEvidence,
) => boolean | Promise<boolean>;

export type VerifiedExecutableKernelSet = Readonly<{
  state: "integrity-verified-for-execution";
  kernelSetId: string;
  manifestSha256: string;
  toolkitVersion: string;
  manifest: CompleteKernelSetManifest;
  executionAllowed: true;
  releaseEligible: false;
}>;

const issuedExecutableKernelSets = new WeakSet<object>();

function normalizeCanonicalJson(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Kernel manifest canonical JSON rejects non-finite numbers");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeCanonicalJson);
  }
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(input)
        .sort()
        .filter((key) => input[key] !== undefined)
        .map((key) => [key, normalizeCanonicalJson(input[key])]),
    );
  }
  throw new TypeError(`Kernel manifest canonical JSON rejects ${typeof value}`);
}

function freezeRecursively<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    freezeRecursively(child);
  }
  return Object.freeze(value);
}

export async function calculateKernelManifestSha256(
  input: unknown,
): Promise<string> {
  const manifest = CompleteKernelSetManifestSchema.parse(input);
  const { manifestSha256: _excludedDigest, ...payload } = manifest;
  const canonical = JSON.stringify(normalizeCanonicalJson(payload));
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyExecutableKernelSet(
  input: unknown,
  reviewedSelection: ReviewedKernelSelection,
  verifyEvidence: KernelEvidenceVerifier,
): Promise<VerifiedExecutableKernelSet> {
  assertIssuedReviewedKernelSelection(reviewedSelection);
  const manifest = freezeRecursively(
    CompleteKernelSetManifestSchema.parse(input),
  );
  if (
    JSON.stringify(normalizeCanonicalJson(kernelSelectionBinding(manifest))) !==
    JSON.stringify(
      normalizeCanonicalJson(
        kernelSelectionBinding(reviewedSelection.selection),
      ),
    )
  ) {
    throw new Error(
      "Complete kernel manifest does not match the in-process reviewed selection",
    );
  }
  if (
    Date.parse(manifest.coverageValidatedAt) <
    Date.parse(reviewedSelection.review.reviewedAt)
  ) {
    throw new Error(
      "Kernel coverage validation cannot predate selection review authorization",
    );
  }
  const actualManifestSha256 = await calculateKernelManifestSha256(manifest);
  if (actualManifestSha256 !== manifest.manifestSha256) {
    throw new Error("Kernel manifest content does not match its canonical SHA-256");
  }

  const evidence: KernelEvidence[] = [
    ...manifest.artifacts.map((artifact) => ({
      kind: "kernel-artifact" as const,
      filename: artifact.filename,
      byteLength: artifact.byteLength,
      sha256: artifact.sha256,
      immutableObjectKey: artifact.immutableObjectKey,
      capturedAt: artifact.capturedAt,
    })),
    {
      ...manifest.metaKernel,
      expectedLoadOrder: [...manifest.artifacts]
        .sort((left, right) => left.loadOrder - right.loadOrder)
        .map((artifact) => artifact.filename),
    },
    {
      ...manifest.coverageReport,
      expectedKernelDigests: [...manifest.artifacts]
        .sort((left, right) => left.loadOrder - right.loadOrder)
        .map((artifact) => artifact.sha256),
      expectedQueryContext: manifest.queryContext,
    },
  ];
  for (const item of evidence) {
    if (!(await verifyEvidence(item))) {
      throw new Error(`Kernel evidence verifier rejected ${item.kind} ${item.filename}`);
    }
  }

  const verified = freezeRecursively({
    state: "integrity-verified-for-execution" as const,
    kernelSetId: manifest.kernelSetId,
    manifestSha256: manifest.manifestSha256,
    toolkitVersion: manifest.toolkitVersion,
    manifest,
    executionAllowed: true as const,
    releaseEligible: false as const,
  });
  issuedExecutableKernelSets.add(verified);
  return verified;
}

function assertIssuedExecutableKernelSet(
  input: VerifiedExecutableKernelSet,
): void {
  if (!issuedExecutableKernelSets.has(input)) {
    throw new Error("SPICE execution requires an in-process verified kernel-set token");
  }
}

const StateVectorSchema = z
  .object({
    epochId: LocalReferenceIdSchema,
    epochTdb: z.string().trim().min(1),
    julianDateTdb: z.number().finite(),
    positionAu: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
    velocityAuPerDay: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  })
  .strict();

const GoldenStateVectorSchema = StateVectorSchema.extend({
  comparisonMode: z.enum([
    "same-solution-parity",
    "cross-solution-diagnostic",
  ]),
  lineageDisclosure: z.string().trim().min(1),
}).strict();

export const HorizonsGoldenValidationPlanSchema = z
  .object({
    schemaVersion: SemVerSchema,
    validationId: GeometryValidationIdSchema,
    state: z.literal("awaiting-independent-spice-run"),
    referenceProducer: z.literal("jpl-horizons"),
    referenceArtifactSha256: Sha256Schema,
    referenceArtifactPath: z.string().trim().min(1),
    requiredKernelSetId: KernelSetIdSchema,
    queryContext: SpiceQueryContextSchema,
    tolerances: z
      .object({
        positionVectorAu: z.number().finite().positive(),
        velocityVectorAuPerDay: z.number().finite().positive(),
        basis: z.string().trim().min(1),
      })
      .strict(),
    goldenEpochs: z.array(GoldenStateVectorSchema).min(2),
    blockedReason: z.string().trim().min(1),
  })
  .strict()
  .superRefine((plan, context) => {
    const epochs = plan.goldenEpochs.map((epoch) => epoch.julianDateTdb);
    const epochIds = plan.goldenEpochs.map((epoch) => epoch.epochId);
    if (new Set(epochIds).size !== epochIds.length) {
      context.addIssue({
        code: "custom",
        path: ["goldenEpochs"],
        message: "Golden epoch IDs must be unique",
      });
    }
    if (epochs.some((epoch, index) => index > 0 && epoch <= epochs[index - 1]!)) {
      context.addIssue({ code: "custom", path: ["goldenEpochs"], message: "Golden epochs must be strictly chronological" });
    }
  });
export type HorizonsGoldenValidationPlan = z.infer<
  typeof HorizonsGoldenValidationPlanSchema
>;

export const IndependentSpiceStateSetSchema = z
  .object({
    producer: z.literal("spice-toolkit"),
    toolkitVersion: z.string().trim().min(1),
    kernelSetId: KernelSetIdSchema,
    kernelManifestSha256: Sha256Schema,
    generatedAt: z.iso.datetime({ offset: true }),
    generatorCodeCommit: z.string().regex(/^[a-f0-9]{7,64}$/),
    stateArtifact: z
      .object({
        filename: SafeFilenameSchema,
        mediaType: z.enum(["application/json", "text/csv"]),
        byteLength: z.number().int().positive(),
        sha256: Sha256Schema,
        immutableObjectKey: z
          .string()
          .pipe(ImmutableObjectKeySchema)
          .refine(
            (value) => value.startsWith("validation/"),
            "SPICE state artifacts belong below validation/",
          ),
        capturedAt: z.iso.datetime({ offset: true }),
      })
      .strict(),
    parserCodeCommit: z.string().regex(/^[a-f0-9]{7,64}$/),
    parsedStateCanonicalization: z.literal(
      "cosmography-spice-state-set-json-v1",
    ),
    parsedStateSetSha256: Sha256Schema,
    queryContext: SpiceQueryContextSchema,
    states: z.array(StateVectorSchema).min(2),
  })
  .strict()
  .superRefine((candidate, context) => {
    const epochIds = candidate.states.map((state) => state.epochId);
    const epochs = candidate.states.map((state) => state.julianDateTdb);
    if (new Set(epochIds).size !== epochIds.length) {
      context.addIssue({
        code: "custom",
        path: ["states"],
        message: "SPICE state epoch IDs must be unique",
      });
    }
    if (epochs.some((epoch, index) => index > 0 && epoch <= epochs[index - 1]!)) {
      context.addIssue({
        code: "custom",
        path: ["states"],
        message: "SPICE state epochs must be strictly chronological",
      });
    }
    if (Date.parse(candidate.stateArtifact.capturedAt) < Date.parse(candidate.generatedAt)) {
      context.addIssue({
        code: "custom",
        path: ["stateArtifact", "capturedAt"],
        message: "SPICE state artifact cannot be captured before it is generated",
      });
    }
    const expectedExtension =
      candidate.stateArtifact.mediaType === "application/json" ? ".json" : ".csv";
    if (!candidate.stateArtifact.filename.endsWith(expectedExtension)) {
      context.addIssue({
        code: "custom",
        path: ["stateArtifact", "filename"],
        message: "SPICE state artifact extension must match its media type",
      });
    }
    if (
      candidate.stateArtifact.immutableObjectKey.split("/").at(-1) !==
      candidate.stateArtifact.filename
    ) {
      context.addIssue({
        code: "custom",
        path: ["stateArtifact", "immutableObjectKey"],
        message: "SPICE state object basename must match its retained filename",
      });
    }
  });
export type IndependentSpiceStateSet = z.infer<
  typeof IndependentSpiceStateSetSchema
>;

export type VerifiedIndependentSpiceStateSet = Readonly<{
  state: "independent-state-artifact-verified";
  candidate: IndependentSpiceStateSet;
}>;

const ParsedSpiceStatePayloadSchema = z
  .object({
    parserCodeCommit: z.string().regex(/^[a-f0-9]{7,64}$/),
    parsedStateCanonicalization: z.literal(
      "cosmography-spice-state-set-json-v1",
    ),
    queryContext: SpiceQueryContextSchema,
    states: z.array(StateVectorSchema).min(2),
  })
  .strict();
export type ParsedSpiceStatePayload = z.infer<
  typeof ParsedSpiceStatePayloadSchema
>;

function parsedSpiceStatePayload(
  candidate: IndependentSpiceStateSet,
): ParsedSpiceStatePayload {
  return ParsedSpiceStatePayloadSchema.parse({
    parserCodeCommit: candidate.parserCodeCommit,
    parsedStateCanonicalization: candidate.parsedStateCanonicalization,
    queryContext: candidate.queryContext,
    states: candidate.states,
  });
}

export type StateArtifactVerifier = (
  evidence: Readonly<IndependentSpiceStateSet["stateArtifact"]>,
  expectations: Readonly<{
    parsedStateSetSha256: string;
    parserCodeCommit: string;
    parsedStateCanonicalization: "cosmography-spice-state-set-json-v1";
    queryContext: IndependentSpiceStateSet["queryContext"];
    epochIds: readonly string[];
  }>,
) => unknown | Promise<unknown>;

const issuedIndependentStateSets = new WeakSet<object>();

export async function calculateParsedSpiceStateSetSha256(
  input: unknown,
): Promise<string> {
  const candidate = IndependentSpiceStateSetSchema.parse(input);
  const payload = parsedSpiceStatePayload(candidate);
  const canonical = JSON.stringify(normalizeCanonicalJson(payload));
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyIndependentSpiceStateSet(
  input: unknown,
  kernelSet: VerifiedExecutableKernelSet,
  verifyArtifact: StateArtifactVerifier,
): Promise<VerifiedIndependentSpiceStateSet> {
  assertIssuedExecutableKernelSet(kernelSet);
  const candidate = freezeRecursively(
    IndependentSpiceStateSetSchema.parse(input),
  );
  if (
    candidate.kernelSetId !== kernelSet.kernelSetId ||
    candidate.kernelManifestSha256 !== kernelSet.manifestSha256 ||
    candidate.toolkitVersion !== kernelSet.toolkitVersion ||
    candidate.generatorCodeCommit !==
      kernelSet.manifest.approvedStateGeneratorCodeCommit ||
    candidate.parserCodeCommit !==
      kernelSet.manifest.approvedStateParserCodeCommit ||
    JSON.stringify(candidate.queryContext) !==
      JSON.stringify(kernelSet.manifest.queryContext)
  ) {
    throw new Error(
      "SPICE state artifact does not match its verified kernel set and approved generator",
    );
  }
  if (
    Date.parse(candidate.generatedAt) <
    Date.parse(kernelSet.manifest.coverageValidatedAt)
  ) {
    throw new Error("SPICE states cannot predate kernel coverage validation");
  }
  const actualParsedSha256 = await calculateParsedSpiceStateSetSha256(candidate);
  if (actualParsedSha256 !== candidate.parsedStateSetSha256) {
    throw new Error("Parsed SPICE state set does not match its canonical SHA-256");
  }
  const parsedArtifactPayload = ParsedSpiceStatePayloadSchema.parse(
    await verifyArtifact(candidate.stateArtifact, {
      parsedStateSetSha256: candidate.parsedStateSetSha256,
      parserCodeCommit: candidate.parserCodeCommit,
      parsedStateCanonicalization: candidate.parsedStateCanonicalization,
      queryContext: candidate.queryContext,
      epochIds: candidate.states.map((state) => state.epochId),
    }),
  );
  if (
    JSON.stringify(normalizeCanonicalJson(parsedArtifactPayload)) !==
    JSON.stringify(
      normalizeCanonicalJson(parsedSpiceStatePayload(candidate)),
    )
  ) {
    throw new Error(
      "SPICE state artifact parser output does not match the candidate state vectors",
    );
  }
  const verified = freezeRecursively({
    state: "independent-state-artifact-verified" as const,
    candidate,
  });
  issuedIndependentStateSets.add(verified);
  return verified;
}

function vectorDelta(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(...a.map((value, index) => value - b[index]!));
}

export type GoldenValidationResult = {
  status: "passed" | "failed" | "review-required";
  passed: boolean;
  strictParityPassed: boolean;
  reasons: string[];
  epochs: Array<{
    epochId: string;
    positionDeltaAu: number | null;
    velocityDeltaAuPerDay: number | null;
    outcome: "passed" | "failed" | "review-required";
  }>;
};

export function compareIndependentSpiceStates(
  planInput: unknown,
  verifiedCandidate: VerifiedIndependentSpiceStateSet,
  kernelSet: VerifiedExecutableKernelSet,
): GoldenValidationResult {
  const plan = HorizonsGoldenValidationPlanSchema.parse(planInput);
  assertIssuedExecutableKernelSet(kernelSet);
  if (!issuedIndependentStateSets.has(verifiedCandidate)) {
    throw new Error(
      "Horizons comparison requires an in-process verified SPICE state artifact",
    );
  }
  const candidate = verifiedCandidate.candidate;

  const reasons: string[] = [];
  if (candidate.kernelSetId !== plan.requiredKernelSetId) {
    reasons.push("Candidate kernel set does not match the frozen validation plan");
  }
  if (candidate.kernelSetId !== kernelSet.kernelSetId) {
    reasons.push("Candidate kernel set does not match the supplied executable manifest");
  }
  if (candidate.kernelManifestSha256 !== kernelSet.manifestSha256) {
    reasons.push("Candidate kernel manifest digest does not match the executable manifest");
  }
  if (
    JSON.stringify(candidate.queryContext) !== JSON.stringify(plan.queryContext) ||
    JSON.stringify(kernelSet.manifest.queryContext) !==
      JSON.stringify(plan.queryContext)
  ) {
    reasons.push("Candidate frame, center, units, time scale, or correction mode differs from Horizons");
  }
  if (candidate.states.length !== plan.goldenEpochs.length) {
    reasons.push("Candidate epoch count differs from the golden plan");
  }

  const epochs = plan.goldenEpochs.map((reference, index) => {
    const candidateState = candidate.states[index];
    if (
      !candidateState ||
      candidateState.epochId !== reference.epochId ||
      candidateState.epochTdb !== reference.epochTdb ||
      candidateState.julianDateTdb !== reference.julianDateTdb
    ) {
      reasons.push(`Candidate epoch ${index + 1} does not match the golden epoch identity`);
      return {
        epochId: reference.epochId,
        positionDeltaAu: null,
        velocityDeltaAuPerDay: null,
        outcome: "failed" as const,
      };
    }
    const positionDeltaAu = vectorDelta(reference.positionAu, candidateState.positionAu);
    const velocityDeltaAuPerDay = vectorDelta(
      reference.velocityAuPerDay,
      candidateState.velocityAuPerDay,
    );
    const withinTolerance =
      positionDeltaAu <= plan.tolerances.positionVectorAu &&
      velocityDeltaAuPerDay <= plan.tolerances.velocityVectorAuPerDay;
    const outcome: "passed" | "failed" | "review-required" =
      reference.comparisonMode === "cross-solution-diagnostic"
        ? "review-required"
        : withinTolerance
          ? "passed"
          : "failed";
    if (reference.comparisonMode === "same-solution-parity" && !withinTolerance) {
      reasons.push(`Candidate state exceeds tolerance at ${reference.epochId}`);
    }
    return {
      epochId: reference.epochId,
      positionDeltaAu,
      velocityDeltaAuPerDay,
      outcome,
    };
  });

  const strictParityPassed =
    reasons.length === 0 &&
    epochs.every((epoch, index) => {
      const reference = plan.goldenEpochs[index];
      return (
        reference?.comparisonMode === "cross-solution-diagnostic" ||
        epoch.outcome === "passed"
      );
    });
  const diagnosticsRequireReview = epochs.some(
    (epoch) => epoch.outcome === "review-required",
  );
  if (diagnosticsRequireReview) {
    reasons.push(
      "Cross-solution diagnostic epochs require scientific review and cannot pass the same-solution parity gate",
    );
  }
  const status = !strictParityPassed
    ? "failed"
    : diagnosticsRequireReview
      ? "review-required"
      : "passed";
  return {
    status,
    passed: status === "passed",
    strictParityPassed,
    reasons,
    epochs,
  };
}

const GoldenValidationEpochResultSchema = z
  .object({
    epochId: LocalReferenceIdSchema,
    comparisonMode: z.enum([
      "same-solution-parity",
      "cross-solution-diagnostic",
    ]),
    positionDeltaAu: z.number().finite().nonnegative().nullable(),
    velocityDeltaAuPerDay: z.number().finite().nonnegative().nullable(),
    outcome: z.enum(["passed", "failed", "review-required"]),
  })
  .strict();

export const GeometryValidationReportSchema = z
  .object({
    schemaVersion: SemVerSchema,
    validationId: GeometryValidationIdSchema,
    comparatorVersion: z.literal("voyager-horizons-spice-parity-v1"),
    generatedAt: z.iso.datetime({ offset: true }),
    referenceArtifactSha256: Sha256Schema,
    kernelSetId: KernelSetIdSchema,
    kernelManifestSha256: Sha256Schema,
    spiceStateArtifactSha256: Sha256Schema,
    parsedStateSetSha256: Sha256Schema,
    status: z.enum(["passed", "failed", "review-required"]),
    strictParityPassed: z.boolean(),
    reasons: z.array(z.string().trim().min(1)),
    epochs: z.array(GoldenValidationEpochResultSchema).min(2),
    reportCanonicalization: z.literal(
      "cosmography-geometry-validation-report-json-v1",
    ),
    reportSha256: Sha256Schema,
    releaseEligible: z.literal(false),
  })
  .strict()
  .superRefine((report, context) => {
    const epochIds = report.epochs.map((epoch) => epoch.epochId);
    if (new Set(epochIds).size !== epochIds.length) {
      context.addIssue({
        code: "custom",
        path: ["epochs"],
        message: "Validation report epoch IDs must be unique",
      });
    }
    if (report.status === "passed" && !report.strictParityPassed) {
      context.addIssue({
        code: "custom",
        path: ["strictParityPassed"],
        message: "A passed report requires strict parity to pass",
      });
    }
    if (
      report.status === "review-required" &&
      (!report.strictParityPassed ||
        !report.epochs.some((epoch) => epoch.outcome === "review-required"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Review-required status needs passed strict parity and a diagnostic epoch",
      });
    }
  });
export type GeometryValidationReport = z.infer<
  typeof GeometryValidationReportSchema
>;

export async function calculateGeometryValidationReportSha256(
  input: unknown,
): Promise<string> {
  const report = GeometryValidationReportSchema.parse(input);
  const { reportSha256: _excludedDigest, ...payload } = report;
  const canonical = JSON.stringify(normalizeCanonicalJson(payload));
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createGeometryValidationReport(
  planInput: unknown,
  verifiedCandidate: VerifiedIndependentSpiceStateSet,
  kernelSet: VerifiedExecutableKernelSet,
  generatedAt: string,
): Promise<GeometryValidationReport> {
  const plan = HorizonsGoldenValidationPlanSchema.parse(planInput);
  if (
    Date.parse(generatedAt) <
    Date.parse(verifiedCandidate.candidate.stateArtifact.capturedAt)
  ) {
    throw new Error("Geometry validation report cannot predate its SPICE state artifact");
  }
  const result = compareIndependentSpiceStates(
    plan,
    verifiedCandidate,
    kernelSet,
  );
  const reportWithoutDigest = {
    schemaVersion: "1.0.0",
    validationId: plan.validationId,
    comparatorVersion: "voyager-horizons-spice-parity-v1",
    generatedAt,
    referenceArtifactSha256: plan.referenceArtifactSha256,
    kernelSetId: kernelSet.kernelSetId,
    kernelManifestSha256: kernelSet.manifestSha256,
    spiceStateArtifactSha256:
      verifiedCandidate.candidate.stateArtifact.sha256,
    parsedStateSetSha256: verifiedCandidate.candidate.parsedStateSetSha256,
    status: result.status,
    strictParityPassed: result.strictParityPassed,
    reasons: result.reasons,
    epochs: result.epochs.map((epoch, index) => ({
      ...epoch,
      comparisonMode: plan.goldenEpochs[index]!.comparisonMode,
    })),
    reportCanonicalization:
      "cosmography-geometry-validation-report-json-v1",
    reportSha256: "0".repeat(64),
    releaseEligible: false,
  } as const;
  const reportSha256 = await calculateGeometryValidationReportSha256(
    reportWithoutDigest,
  );
  return freezeRecursively(
    GeometryValidationReportSchema.parse({
      ...reportWithoutDigest,
      reportSha256,
    }),
  );
}

const IntendedMediaUseSchema = z
  .object({
    metadataDisplay: z.boolean(),
    externalLink: z.boolean(),
    embedBytes: z.boolean(),
    redistribute: z.boolean(),
    modify: z.boolean(),
    commercialUse: z.boolean(),
    offlinePackaging: z.boolean(),
    derivativeGeneration: z.boolean(),
  })
  .strict();

const ReferenceOnlyMediaSchema = z
  .object({
    mediaId: LocalReferenceIdSchema,
    state: z.literal("reference-only-pending-asset-review"),
    sourceProductId: z.string().trim().min(1).optional(),
    officialRecordUrl: HttpsUrlSchema,
    sourceReferenceIds: z.array(LocalReferenceIdSchema).min(1),
    requiredCreditLine: z.string().trim().min(1),
    policyUrls: z.array(HttpsUrlSchema).min(1),
    policyCheckedAt: z.iso.datetime({ offset: true }),
    intendedUse: IntendedMediaUseSchema.extend({
      metadataDisplay: z.literal(true),
      externalLink: z.literal(true),
      embedBytes: z.literal(false),
      redistribute: z.literal(false),
      modify: z.literal(false),
      commercialUse: z.literal(false),
      offlinePackaging: z.literal(false),
      derivativeGeneration: z.literal(false),
    }),
    assetBytesPresent: z.literal(false),
    renderAllowed: z.literal(false),
    blockedReason: z.string().trim().min(1),
  })
  .strict();

const FrozenMediaAssetSchema = z
  .object({
    assetId: AssetIdSchema,
    sourceProductId: z.string().trim().min(1),
    sourceUrl: HttpsUrlSchema,
    mediaType: z.string().regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i),
    byteLength: z.number().int().positive(),
    sha256: Sha256Schema,
    immutableObjectKey: z
      .string()
      .pipe(ImmutableObjectKeySchema)
      .refine((value) => value.startsWith("media/"), "Media objects belong below media/"),
    capturedAt: z.iso.datetime({ offset: true }),
    derivativeOfAssetId: AssetIdSchema.optional(),
    transformation: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((asset, context) => {
    if ((asset.derivativeOfAssetId === undefined) !== (asset.transformation === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["derivativeOfAssetId"],
        message: "Derivative parent and transformation disclosure must appear together",
      });
    }
  });

const AdmittedMediaSchema = z
  .object({
    mediaId: LocalReferenceIdSchema,
    state: z.literal("frozen-asset-reviewed"),
    sourceReferenceIds: z.array(LocalReferenceIdSchema).min(1),
    intendedUse: IntendedMediaUseSchema,
    asset: FrozenMediaAssetSchema,
    rights: RightsStatementSchema,
    admittedAt: z.iso.datetime({ offset: true }),
    assetBytesPresent: z.literal(true),
    renderAllowed: z.literal(false),
    releaseEligible: z.literal(false),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.rights.target.kind !== "asset" || record.rights.target.assetId !== record.asset.assetId) {
      context.addIssue({
        code: "custom",
        path: ["rights", "target"],
        message: "Media admission requires an asset-target rights statement for the exact asset",
      });
    }
    if (record.rights.reviewStatus !== "reviewed") {
      context.addIssue({
        code: "custom",
        path: ["rights", "reviewStatus"],
        message: "Renderable media requires reviewed rights",
      });
    }
    const reasons = mediaRightsFailureReasons(record, record.admittedAt);
    for (const reason of reasons) {
      context.addIssue({
        code: "custom",
        path: ["rights"],
        message: reason,
      });
    }
    if (Date.parse(record.asset.capturedAt) > Date.parse(record.admittedAt)) {
      context.addIssue({
        code: "custom",
        path: ["admittedAt"],
        message: "Media cannot be admitted before its frozen asset is captured",
      });
    }
  });

export const MissionMediaAdmissionSchema = z.discriminatedUnion("state", [
  ReferenceOnlyMediaSchema,
  AdmittedMediaSchema,
]);
export type MissionMediaAdmission = z.infer<typeof MissionMediaAdmissionSchema>;

function mediaRightsFailureReasons(
  record: {
    rights: z.infer<typeof RightsStatementSchema>;
    intendedUse: z.infer<typeof IntendedMediaUseSchema>;
    admittedAt: string;
  },
  evaluatedAt: string,
): string[] {
  const reasons: string[] = [];
  const { rights, intendedUse } = record;
  if (rights.reviewStatus !== "reviewed" || !rights.reviewedBy || !rights.reviewedAt) {
    reasons.push("Renderable media needs a named, timestamped rights review");
  }
  if (rights.basis.kind === "unknown" || rights.basis.kind === "restricted") {
    reasons.push("Unknown or restricted rights basis cannot authorize rendering");
  }
  if (!intendedUse.embedBytes) {
    reasons.push("A frozen render admission must explicitly request embedded bytes");
  }
  if (rights.useProfile.display !== "allowed") {
    reasons.push("Display permission is not explicitly allowed");
  }
  if (
    (intendedUse.embedBytes ||
      intendedUse.redistribute ||
      intendedUse.offlinePackaging) &&
    rights.useProfile.redistribute !== "allowed"
  ) {
    reasons.push("Byte delivery requires explicitly allowed redistribution");
  }
  if (
    (intendedUse.modify || intendedUse.derivativeGeneration) &&
    rights.useProfile.modify !== "allowed"
  ) {
    reasons.push("Modification or derivative generation is not explicitly allowed");
  }
  if (
    intendedUse.commercialUse &&
    rights.useProfile.commercialUse !== "allowed"
  ) {
    reasons.push("Commercial use is not explicitly allowed");
  }
  const evaluatedAtMs = Date.parse(evaluatedAt);
  if (!Number.isFinite(evaluatedAtMs)) {
    reasons.push("Rights evaluation time is invalid");
  }
  if (evaluatedAtMs < Date.parse(record.admittedAt)) {
    reasons.push("Media rendering cannot predate asset admission");
  }
  if (rights.reviewedAt && Date.parse(rights.reviewedAt) > evaluatedAtMs) {
    reasons.push("Rights evaluation cannot predate the review");
  }
  if (Date.parse(rights.capturedAt) > evaluatedAtMs) {
    reasons.push("Rights evaluation cannot predate the retained terms evidence");
  }
  if (
    rights.reviewedAt &&
    Date.parse(rights.capturedAt) > Date.parse(rights.reviewedAt)
  ) {
    reasons.push("Rights review cannot predate the retained terms evidence");
  }
  if (
    rights.reviewExpiresAt &&
    Date.parse(rights.reviewExpiresAt) <= evaluatedAtMs
  ) {
    reasons.push("Rights review is expired at the evaluation time");
  }
  return reasons;
}

export type MissionMediaRenderEvidence = Readonly<{
  asset: Readonly<z.infer<typeof FrozenMediaAssetSchema>>;
  rights: Readonly<z.infer<typeof RightsStatementSchema>>;
  intendedUse: Readonly<z.infer<typeof IntendedMediaUseSchema>>;
  admittedAt: string;
  evaluatedAt: string;
}>;

export type MissionMediaEvidenceVerifier = (
  evidence: MissionMediaRenderEvidence,
) => boolean | Promise<boolean>;

export type VerifiedRenderableMissionMedia = Readonly<{
  state: "asset-evidence-verified-for-rendering";
  admission: z.infer<typeof AdmittedMediaSchema>;
  verifiedAt: string;
  renderAllowed: true;
  releaseEligible: false;
}>;

const issuedRenderableMissionMedia = new WeakSet<object>();

export async function verifyMissionMediaForRendering(
  input: unknown,
  evaluatedAtInput: unknown,
  verifyEvidence: MissionMediaEvidenceVerifier,
): Promise<VerifiedRenderableMissionMedia> {
  const admission = freezeRecursively(AdmittedMediaSchema.parse(input));
  const evaluatedAt = z.iso.datetime({ offset: true }).parse(evaluatedAtInput);
  const reasons = mediaRightsFailureReasons(admission, evaluatedAt);
  if (reasons.length > 0) {
    throw new Error(`Mission media rendering is blocked: ${reasons.join("; ")}`);
  }
  if (
    !(await verifyEvidence({
      asset: admission.asset,
      rights: admission.rights,
      intendedUse: admission.intendedUse,
      admittedAt: admission.admittedAt,
      evaluatedAt,
    }))
  ) {
    throw new Error(
      "Mission media evidence verifier rejected the asset bytes or rights evidence",
    );
  }
  const verified = freezeRecursively({
    state: "asset-evidence-verified-for-rendering" as const,
    admission,
    verifiedAt: evaluatedAt,
    renderAllowed: true as const,
    releaseEligible: false as const,
  });
  issuedRenderableMissionMedia.add(verified);
  return verified;
}

export function canRenderMissionMedia(
  input: unknown,
  evaluatedAt?: string,
): boolean {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedRenderableMissionMedia.has(input) ||
    evaluatedAt === undefined
  ) {
    return false;
  }
  const verified = input as VerifiedRenderableMissionMedia;
  const evaluatedAtResult = z.iso.datetime({ offset: true }).safeParse(evaluatedAt);
  return (
    evaluatedAtResult.success &&
    Date.parse(evaluatedAtResult.data) >= Date.parse(verified.verifiedAt) &&
    mediaRightsFailureReasons(
      verified.admission,
      evaluatedAtResult.data,
    ).length === 0
  );
}

const WithheldCaptureContextSchema = z
  .object({
    captureContextId: CaptureContextIdSchema,
    mediaId: LocalReferenceIdSchema,
    state: z.literal("withheld-incomplete-geometry"),
    capturedAtUtc: z
      .iso.datetime({ offset: true })
      .refine((value) => value.endsWith("Z"), {
        message: "UTC capture timestamps must use the canonical Z suffix",
      }),
    timePrecision: z.enum(["minute", "second", "subsecond"]),
    reportedTimeLabel: z.string().trim().min(1),
    observerNaifId: z.number().int(),
    targetNaifId: z.number().int(),
    instrument: z.string().trim().min(1),
    requiredKernelTypes: z.array(SpiceKernelTypeSchema).min(1),
    sourceReferenceIds: z.array(LocalReferenceIdSchema).min(1),
    exactEpochStateAvailable: z.literal(false),
    verifiedAttitudeAvailable: z.literal(false),
    renderableCameraPose: z.literal(false),
    blockedReasons: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()
  .superRefine((capture, context) => {
    if (new Set(capture.requiredKernelTypes).size !== capture.requiredKernelTypes.length) {
      context.addIssue({
        code: "custom",
        path: ["requiredKernelTypes"],
        message: "Required capture kernel types must be unique",
      });
    }
  });

// A renderable branch is intentionally absent. It will be introduced only with
// a dedicated gate binding an admitted asset to exact clock, state, attitude,
// instrument/FOV, target-shape, transform, uncertainty, and validation evidence.
export const CaptureContextSchema = WithheldCaptureContextSchema;
export type CaptureContext = z.infer<typeof CaptureContextSchema>;

export const MissionProvenanceSchema = z
  .object({
    schemaVersion: SemVerSchema,
    missionId: LocalReferenceIdSchema,
    kernelSet: SpiceKernelSetSchema,
    horizonsValidation: HorizonsGoldenValidationPlanSchema,
    mediaAdmissions: z.array(MissionMediaAdmissionSchema).min(1),
    captureContexts: z.array(CaptureContextSchema),
  })
  .strict()
  .superRefine((provenance, context) => {
    const mediaIds = provenance.mediaAdmissions.map((record) => record.mediaId);
    const captureIds = provenance.captureContexts.map((record) => record.captureContextId);
    if (new Set(mediaIds).size !== mediaIds.length) {
      context.addIssue({ code: "custom", path: ["mediaAdmissions"], message: "Media admissions must be unique by media ID" });
    }
    if (provenance.kernelSet.missionId !== provenance.missionId) {
      context.addIssue({
        code: "custom",
        path: ["kernelSet", "missionId"],
        message: "Kernel set mission ID must match the mission provenance ledger",
      });
    }
    if (new Set(captureIds).size !== captureIds.length) {
      context.addIssue({ code: "custom", path: ["captureContexts"], message: "Capture contexts must have unique IDs" });
    }
    for (const capture of provenance.captureContexts) {
      if (!mediaIds.includes(capture.mediaId)) {
        context.addIssue({
          code: "custom",
          path: ["captureContexts"],
          message: `Capture context references media without an admission record: ${capture.mediaId}`,
        });
      }
    }
    if (provenance.horizonsValidation.requiredKernelSetId !== provenance.kernelSet.kernelSetId) {
      context.addIssue({
        code: "custom",
        path: ["horizonsValidation", "requiredKernelSetId"],
        message: "Horizons validation must bind the selected kernel set",
      });
    }
    if (
      JSON.stringify(provenance.horizonsValidation.queryContext) !==
      JSON.stringify(provenance.kernelSet.queryContext)
    ) {
      context.addIssue({
        code: "custom",
        path: ["kernelSet", "queryContext"],
        message: "Kernel and Horizons validation query contexts must match exactly",
      });
    }
  });
export type MissionProvenance = z.infer<typeof MissionProvenanceSchema>;
