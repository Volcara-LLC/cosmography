import { z } from "zod";

import {
  deepFreezeGovernanceRecord,
  stableJsonSha256,
  stableJsonStringify,
} from "./canonical";
import { ReleaseIdSchema, Sha256Schema } from "./ids";

export const COVERAGE_PACK_SCHEMA_VERSION = "1.0.0" as const;
export const COVERAGE_PACK_PROJECTION_VERSION = "coverage-pack-v1" as const;
export const COVERAGE_PACK_CANONICALIZATION =
  "cosmography-release-scoped-coverage-pack-json-v1" as const;
export const COVERAGE_PACK_SET_CANONICALIZATION =
  "cosmography-release-scoped-coverage-set-json-v1" as const;

export const COVERAGE_DIMENSION_ORDER = Object.freeze([
  "geometry",
  "terrain",
  "observations",
  "media",
  "timeline-completeness",
  "update-cadence",
  "rights",
  "validation-tier",
] as const);

export const CoverageDimensionIdSchema = z.enum(COVERAGE_DIMENSION_ORDER);
export type CoverageDimensionId = z.infer<typeof CoverageDimensionIdSchema>;

export const CoverageDimensionStateSchema = z.enum([
  "out-of-scope",
  "absent",
  "reference-records-only",
  "frozen-records-only",
  "validated-artifact-evidence",
]);
export type CoverageDimensionState = z.infer<
  typeof CoverageDimensionStateSchema
>;

const opaqueCoverageSuffix = "[a-z0-9][a-z0-9_-]{5,126}";
const prefixedId = (prefix: string): RegExp =>
  new RegExp(`^${prefix}_${opaqueCoverageSuffix}$`);

export const CoveragePackIdSchema = z
  .string()
  .regex(prefixedId("covp"), "Expected an opaque covp_ identifier");
export const CoveragePackSetIdSchema = z
  .string()
  .regex(prefixedId("covset"), "Expected an opaque covset_ identifier");
export const CoverageSourceBindingIdSchema = z
  .string()
  .regex(prefixedId("covsrc"), "Expected an opaque covsrc_ identifier");
export const CoverageCountIdSchema = z
  .string()
  .regex(prefixedId("covm"), "Expected an opaque covm_ identifier");
export const CoverageGapIdSchema = z
  .string()
  .regex(prefixedId("covgap"), "Expected an opaque covgap_ identifier");
export const CoverageRequirementIdSchema = z
  .string()
  .regex(prefixedId("covreq"), "Expected an opaque covreq_ identifier");

export const CoveragePackKeySchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,119}$/);
export type CoveragePackKey = z.infer<typeof CoveragePackKeySchema>;

export const CoverageAtlasRecordIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,119}$/);
export const CoverageReferenceRecordIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._:-]{1,126}$/);

const CanonicalTimestampSchema = z.iso.datetime({ offset: true });
const BoundedTextSchema = z.string().trim().min(1).max(4_096);
const ShortTextSchema = z.string().trim().min(1).max(240);

const MutableAliasPattern =
  /(?:^|[._:/\s-])(?:head|main|master|tip|trunk|stable|production|latest|current|mutable|rolling|live)(?:$|[._:/\s-])/i;

function containsMutableAlias(value: string): boolean {
  return MutableAliasPattern.test(value);
}

const RepositoryPathSchema = z
  .string()
  .trim()
  .min(3)
  .max(1_024)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !/^[A-Za-z]:/.test(value) &&
      !value.includes("\\") &&
      !/[\r\n\0]/.test(value),
    "Coverage source paths must be safe repository-relative POSIX paths",
  )
  .refine(
    (value) =>
      value
        .split("/")
        .every(
          (segment) =>
            segment !== "" && segment !== "." && segment !== "..",
        ),
    "Coverage source paths cannot contain empty or traversal segments",
  )
  .refine(
    (value) => /^[A-Za-z0-9][A-Za-z0-9._/+@-]*$/.test(value),
    "Coverage source paths contain unsupported characters",
  )
  .refine(
    (value) => !containsMutableAlias(value),
    "Coverage source paths cannot use mutable aliases",
  );

const ImmutableRecordVersionSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (value) => !containsMutableAlias(value),
    "Coverage source versions cannot use mutable aliases",
  );

const ExportNameSchema = z
  .string()
  .regex(/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/);

const JsonPointerSchema = z
  .string()
  .min(1)
  .max(1_024)
  .regex(
    /^(?:\/(?:[^~/]|~0|~1)*)+$/,
    "Expected an RFC 6901 JSON pointer",
  );

const CoverageAuthorityShape = {
  sourceAuthenticityEstablished: z.literal(false),
  scientificValidationEstablished: z.literal(false),
  independentValidationEstablished: z.literal(false),
  completenessEstablished: z.literal(false),
  rightsClearanceEstablished: z.literal(false),
  runtimeUseAllowed: z.literal(false),
  renderAllowed: z.literal(false),
  publicationAllowed: z.literal(false),
  releaseEligible: z.literal(false),
  activationAllowed: z.literal(false),
} as const;

export const COVERAGE_NO_AUTHORITY = deepFreezeGovernanceRecord({
  sourceAuthenticityEstablished: false,
  scientificValidationEstablished: false,
  independentValidationEstablished: false,
  completenessEstablished: false,
  rightsClearanceEstablished: false,
  runtimeUseAllowed: false,
  renderAllowed: false,
  publicationAllowed: false,
  releaseEligible: false,
  activationAllowed: false,
} as const);

export const CoverageReleaseBindingSchema = z
  .object({
    releaseId: ReleaseIdSchema,
    releaseGeneratedAt: CanonicalTimestampSchema,
    releaseManifestSha256: Sha256Schema,
    releaseContentSha256: Sha256Schema,
  })
  .strict();
export type CoverageReleaseBinding = z.infer<
  typeof CoverageReleaseBindingSchema
>;

const CoverageSourceBindingBaseSchema = z
  .object({
    bindingId: CoverageSourceBindingIdSchema,
    repositoryPath: RepositoryPathSchema,
    recordId: CoverageReferenceRecordIdSchema,
    version: ImmutableRecordVersionSchema,
    sha256: Sha256Schema,
    frozenAt: CanonicalTimestampSchema,
    referenceRecordIds: z
      .array(CoverageReferenceRecordIdSchema)
      .min(1)
      .max(1_024),
  })
  .strict();

export const CoverageSourceBindingSchema = z.discriminatedUnion("kind", [
  CoverageSourceBindingBaseSchema.extend({
    kind: z.literal("repository-record"),
    exportName: ExportNameSchema,
    canonicalization: z.literal("cosmography-stable-json-v1"),
  }).strict(),
  CoverageSourceBindingBaseSchema.extend({
    kind: z.literal("retained-artifact"),
    byteLength: z.number().int().positive(),
    canonicalization: z.literal("raw-bytes-sha256"),
  }).strict(),
]);
export type CoverageSourceBinding = z.infer<
  typeof CoverageSourceBindingSchema
>;

const CoverageDimensionBaseSchema = z
  .object({
    status: CoverageDimensionStateSchema,
    summary: BoundedTextSchema,
    scopeBoundary: BoundedTextSchema,
    countIds: z.array(CoverageCountIdSchema).max(128),
    sourceBindingIds: z.array(CoverageSourceBindingIdSchema).max(128),
    sourceReferenceIds: z
      .array(CoverageReferenceRecordIdSchema)
      .max(1_024),
    knownGapIds: z.array(CoverageGapIdSchema).max(256),
    nextEvidenceRequirementIds: z
      .array(CoverageRequirementIdSchema)
      .max(256),
  })
  .strict();

function dimensionSchema<
  const Id extends CoverageDimensionId,
  const Label extends string,
  const Ordinal extends number,
>(dimensionId: Id, label: Label, ordinal: Ordinal) {
  return CoverageDimensionBaseSchema.extend({
    dimensionId: z.literal(dimensionId),
    ordinal: z.literal(ordinal),
    label: z.literal(label),
  }).strict();
}

const GeometryDimensionSchema = dimensionSchema("geometry", "Geometry", 1);
const TerrainDimensionSchema = dimensionSchema("terrain", "Terrain", 2);
const ObservationsDimensionSchema = dimensionSchema(
  "observations",
  "Observations",
  3,
);
const MediaDimensionSchema = dimensionSchema("media", "Media", 4);
const TimelineDimensionSchema = dimensionSchema(
  "timeline-completeness",
  "Timeline completeness",
  5,
);
const CadenceDimensionSchema = dimensionSchema(
  "update-cadence",
  "Update cadence",
  6,
);
const RightsDimensionSchema = dimensionSchema("rights", "Rights", 7);
const ValidationDimensionSchema = dimensionSchema(
  "validation-tier",
  "Validation tier",
  8,
);

export const CoverageDimensionSchema = z.discriminatedUnion("dimensionId", [
  GeometryDimensionSchema,
  TerrainDimensionSchema,
  ObservationsDimensionSchema,
  MediaDimensionSchema,
  TimelineDimensionSchema,
  CadenceDimensionSchema,
  RightsDimensionSchema,
  ValidationDimensionSchema,
]);
export type CoverageDimension = z.infer<typeof CoverageDimensionSchema>;

export const CoverageCountSchema = z
  .object({
    countId: CoverageCountIdSchema,
    label: z.string().trim().min(1).max(160),
    value: z.number().int().nonnegative(),
    total: z.number().int().positive().optional(),
    unit: z.enum([
      "records",
      "requirements",
      "artifacts",
      "tokens",
      "contexts",
      "poses",
      "epochs",
      "sites",
      "sources",
      "organizations",
      "gaps",
    ]),
    basis: z.string().trim().min(1).max(1_024),
    dimensionIds: z.array(CoverageDimensionIdSchema).min(1).max(8),
    sourceBindingIds: z
      .array(CoverageSourceBindingIdSchema)
      .min(1)
      .max(128),
  })
  .strict()
  .superRefine((count, context) => {
    if (count.total !== undefined && count.value > count.total) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Coverage count value cannot exceed its declared total",
      });
    }
    if (!isCanonicalDimensionList(count.dimensionIds)) {
      context.addIssue({
        code: "custom",
        path: ["dimensionIds"],
        message: "Coverage count dimensions must be unique and canonically ordered",
      });
    }
    if (!isCanonicalUnique(count.sourceBindingIds)) {
      context.addIssue({
        code: "custom",
        path: ["sourceBindingIds"],
        message: "Coverage count bindings must be unique and canonically ordered",
      });
    }
  });
export type CoverageCount = z.infer<typeof CoverageCountSchema>;

export const CoverageOriginSchema = z
  .object({
    sourceBindingId: CoverageSourceBindingIdSchema,
    jsonPointer: JsonPointerSchema,
  })
  .strict();
export type CoverageOrigin = z.infer<typeof CoverageOriginSchema>;

export const CoverageGapSchema = z
  .object({
    gapId: CoverageGapIdSchema,
    severity: z.enum(["unranked", "known", "material", "critical"]),
    summary: BoundedTextSchema,
    safeguard: BoundedTextSchema,
    dimensionIds: z.array(CoverageDimensionIdSchema).min(1).max(8),
    sourceBindingIds: z
      .array(CoverageSourceBindingIdSchema)
      .min(1)
      .max(128),
    sourceReferenceIds: z
      .array(CoverageReferenceRecordIdSchema)
      .min(1)
      .max(1_024),
    nextEvidenceRequirementIds: z
      .array(CoverageRequirementIdSchema)
      .min(1)
      .max(256),
    origins: z.array(CoverageOriginSchema).min(1).max(128),
  })
  .strict()
  .superRefine((gap, context) => {
    validateLinkedRecordLists(gap, context);
  });
export type CoverageGap = z.infer<typeof CoverageGapSchema>;

export const CoverageNextEvidenceRequirementSchema = z
  .object({
    requirementId: CoverageRequirementIdSchema,
    title: ShortTextSchema,
    state: z.literal("pending"),
    detail: BoundedTextSchema,
    dimensionIds: z.array(CoverageDimensionIdSchema).min(1).max(8),
    sourceBindingIds: z
      .array(CoverageSourceBindingIdSchema)
      .min(1)
      .max(128),
    sourceReferenceIds: z
      .array(CoverageReferenceRecordIdSchema)
      .min(1)
      .max(1_024),
    knownGapIds: z.array(CoverageGapIdSchema).min(1).max(256),
    origins: z.array(CoverageOriginSchema).min(1).max(128),
  })
  .strict()
  .superRefine((requirement, context) => {
    validateLinkedRecordLists(requirement, context);
  });
export type CoverageNextEvidenceRequirement = z.infer<
  typeof CoverageNextEvidenceRequirementSchema
>;

const InitialCorrectionLineageSchema = z
  .object({
    kind: z.literal("initial-release-snapshot"),
    revision: z.literal(1),
  })
  .strict();

const SupersedingCorrectionLineageSchema = z
  .object({
    kind: z.literal("superseding-correction"),
    revision: z.number().int().min(2).max(1_000_000),
    previous: z
      .object({
        packId: CoveragePackIdSchema,
        releaseId: ReleaseIdSchema,
        packSha256: Sha256Schema,
      })
      .strict(),
    issuedAt: CanonicalTimestampSchema,
    reason: BoundedTextSchema,
    affectedDimensionIds: z
      .array(CoverageDimensionIdSchema)
      .min(1)
      .max(8),
  })
  .strict()
  .superRefine((lineage, context) => {
    if (!isCanonicalDimensionList(lineage.affectedDimensionIds)) {
      context.addIssue({
        code: "custom",
        path: ["affectedDimensionIds"],
        message:
          "Correction dimensions must be unique and canonically ordered",
      });
    }
  });

export const CoverageCorrectionLineageSchema = z.discriminatedUnion("kind", [
  InitialCorrectionLineageSchema,
  SupersedingCorrectionLineageSchema,
]);
export type CoverageCorrectionLineage = z.infer<
  typeof CoverageCorrectionLineageSchema
>;

const CoveragePackPayloadSchema = z
  .object({
    schemaVersion: z.literal(COVERAGE_PACK_SCHEMA_VERSION),
    packId: CoveragePackIdSchema,
    coverageKey: CoveragePackKeySchema,
    title: ShortTextSchema,
    summary: BoundedTextSchema,
    generatedAt: CanonicalTimestampSchema,
    state: z.literal(
      "release-scoped-coverage-summary-non-authoritative",
    ),
    releaseBinding: CoverageReleaseBindingSchema,
    scope: z
      .object({
        kind: z.enum(["mission", "surface-experience", "earth-network"]),
        recordId: CoverageReferenceRecordIdSchema,
        navigationRecordIds: z
          .array(CoverageAtlasRecordIdSchema)
          .min(1)
          .max(32),
      })
      .strict(),
    sourceBindings: z
      .array(CoverageSourceBindingSchema)
      .min(1)
      .max(128),
    sourceReferenceIds: z
      .array(CoverageReferenceRecordIdSchema)
      .min(1)
      .max(2_048),
    dimensions: z.tuple([
      GeometryDimensionSchema,
      TerrainDimensionSchema,
      ObservationsDimensionSchema,
      MediaDimensionSchema,
      TimelineDimensionSchema,
      CadenceDimensionSchema,
      RightsDimensionSchema,
      ValidationDimensionSchema,
    ]),
    counts: z.array(CoverageCountSchema).min(1).max(256),
    knownGaps: z.array(CoverageGapSchema).min(1).max(512),
    nextEvidenceRequirements: z
      .array(CoverageNextEvidenceRequirementSchema)
      .min(1)
      .max(512),
    correctionLineage: CoverageCorrectionLineageSchema,
    ...CoverageAuthorityShape,
  })
  .strict()
  .superRefine((pack, context) => {
    validateCoveragePackPayload(pack, context);
  });

export type CoveragePackInput = z.input<typeof CoveragePackPayloadSchema>;
export type CoverageCorrectionPackInput = Omit<
  CoveragePackInput,
  "packId" | "coverageKey" | "scope" | "correctionLineage"
> & {
  issuedAt: string;
  reason: string;
};

export const CoveragePackSchema = CoveragePackPayloadSchema.safeExtend({
  canonicalization: z.literal(COVERAGE_PACK_CANONICALIZATION),
  packSha256: Sha256Schema,
  etag: z.string().regex(/^"cpack-sha256-[a-f0-9]{64}"$/),
})
  .strict()
  .superRefine((pack, context) => {
    const payload = coveragePackPayload(pack);
    const expectedDigest = stableJsonSha256(payload);
    if (pack.packSha256 !== expectedDigest) {
      context.addIssue({
        code: "custom",
        path: ["packSha256"],
        message:
          "Coverage pack digest does not match its canonical release-scoped payload",
      });
    }
    if (pack.etag !== formatCoveragePackEtag(pack.packSha256)) {
      context.addIssue({
        code: "custom",
        path: ["etag"],
        message: "Coverage pack ETag must derive exactly from its digest",
      });
    }
    if (
      pack.correctionLineage.kind === "superseding-correction" &&
      pack.correctionLineage.previous.packSha256 === pack.packSha256
    ) {
      context.addIssue({
        code: "custom",
        path: ["correctionLineage", "previous", "packSha256"],
        message: "A correction cannot supersede its own canonical payload",
      });
    }
  })
  .transform((pack) => deepFreezeGovernanceRecord(pack));
export type CoveragePack = z.infer<typeof CoveragePackSchema>;

const CoveragePackSetPayloadSchema = z
  .object({
    schemaVersion: z.literal(COVERAGE_PACK_SCHEMA_VERSION),
    coverageSetId: CoveragePackSetIdSchema,
    projectionVersion: z.literal(COVERAGE_PACK_PROJECTION_VERSION),
    generatedAt: CanonicalTimestampSchema,
    state: z.literal("release-scoped-coverage-projection-non-authoritative"),
    releaseBinding: CoverageReleaseBindingSchema,
    packs: z.array(CoveragePackSchema).min(1).max(256),
    ...CoverageAuthorityShape,
  })
  .strict()
  .superRefine((set, context) => {
    const packIds = set.packs.map((pack) => pack.packId);
    const coverageKeys = set.packs.map((pack) => pack.coverageKey);
    if (!isCanonicalUnique(packIds) || !isCanonicalUnique(coverageKeys)) {
      context.addIssue({
        code: "custom",
        path: ["packs"],
        message:
          "Coverage set pack IDs and keys must be unique and canonically ordered",
      });
    }
    if (Date.parse(set.generatedAt) < Date.parse(set.releaseBinding.releaseGeneratedAt)) {
      context.addIssue({
        code: "custom",
        path: ["generatedAt"],
        message: "Coverage set cannot predate its exact release",
      });
    }
    for (const pack of set.packs) {
      if (
        stableJsonStringify(pack.releaseBinding) !==
        stableJsonStringify(set.releaseBinding)
      ) {
        context.addIssue({
          code: "custom",
          path: ["packs"],
          message: "Every coverage pack must bind the set's exact release",
        });
      }
      if (Date.parse(pack.generatedAt) > Date.parse(set.generatedAt)) {
        context.addIssue({
          code: "custom",
          path: ["generatedAt"],
          message: "Coverage set cannot predate a contained pack",
        });
      }
    }
  });

export type CoveragePackSetInput = z.input<
  typeof CoveragePackSetPayloadSchema
>;

export const CoveragePackSetSchema = CoveragePackSetPayloadSchema.safeExtend({
  canonicalization: z.literal(COVERAGE_PACK_SET_CANONICALIZATION),
  setSha256: Sha256Schema,
  etag: z.string().regex(/^"cpack-set-sha256-[a-f0-9]{64}"$/),
})
  .strict()
  .superRefine((set, context) => {
    const payload = coveragePackSetPayload(set);
    const expectedDigest = stableJsonSha256(payload);
    if (set.setSha256 !== expectedDigest) {
      context.addIssue({
        code: "custom",
        path: ["setSha256"],
        message: "Coverage set digest does not match its canonical payload",
      });
    }
    if (set.etag !== formatCoveragePackSetEtag(set.setSha256)) {
      context.addIssue({
        code: "custom",
        path: ["etag"],
        message: "Coverage set ETag must derive exactly from its digest",
      });
    }
  })
  .transform((set) => deepFreezeGovernanceRecord(set));
export type CoveragePackSet = z.infer<typeof CoveragePackSetSchema>;

export function calculateCoveragePackSha256(input: CoveragePackInput): string {
  return stableJsonSha256(CoveragePackPayloadSchema.parse(input));
}

export function formatCoveragePackEtag(sha256: string): string {
  const digest = Sha256Schema.parse(sha256);
  return `"cpack-sha256-${digest}"`;
}

export function createCoveragePack(input: CoveragePackInput): CoveragePack {
  if (input.correctionLineage.kind !== "initial-release-snapshot") {
    throw new Error(
      "Superseding Coverage Packs must be derived from an exact predecessor with createCoverageCorrectionPack",
    );
  }
  return createCoveragePackRecord(input);
}

export function createCoverageCorrectionPack(
  previousInput: unknown,
  input: CoverageCorrectionPackInput,
): CoveragePack {
  const previous = parseCoveragePack(previousInput);
  const { issuedAt, reason, ...next } = input;
  const revision = previous.correctionLineage.revision + 1;
  if (revision > 1_000_000) {
    throw new Error("Coverage correction revision exceeds the v1 bound");
  }
  const correctionBase = {
    ...next,
    packId: previous.packId,
    coverageKey: previous.coverageKey,
    scope: previous.scope,
    correctionLineage: {
      kind: "superseding-correction" as const,
      revision,
      previous: {
        packId: previous.packId,
        releaseId: previous.releaseBinding.releaseId,
        packSha256: previous.packSha256,
      },
      issuedAt,
      reason,
      affectedDimensionIds: [...COVERAGE_DIMENSION_ORDER],
    },
  } satisfies CoveragePackInput;
  const comparisonCandidate = createCoveragePackRecord(correctionBase);
  const affectedDimensionIds = deriveAffectedDimensionIds(
    previous,
    comparisonCandidate,
  );
  if (affectedDimensionIds.length === 0) {
    throw new Error(
      "A Coverage Pack correction must change descriptive or dimension-linked evidence",
    );
  }
  const correction = createCoveragePackRecord({
    ...correctionBase,
    correctionLineage: {
      ...correctionBase.correctionLineage,
      affectedDimensionIds,
    },
  });
  assertCoverageCorrectionPair(previous, correction);
  return correction;
}

function createCoveragePackRecord(input: CoveragePackInput): CoveragePack {
  const payload = CoveragePackPayloadSchema.parse(input);
  const packSha256 = stableJsonSha256(payload);
  return deepFreezeGovernanceRecord(
    CoveragePackSchema.parse({
      ...payload,
      canonicalization: COVERAGE_PACK_CANONICALIZATION,
      packSha256,
      etag: formatCoveragePackEtag(packSha256),
    }),
  );
}

export function parseCoveragePack(input: unknown): CoveragePack {
  return deepFreezeGovernanceRecord(CoveragePackSchema.parse(input));
}

export function assertCoveragePackIntegrity(
  input: unknown,
): asserts input is CoveragePack {
  const parsed = parseCoveragePack(input);
  if (stableJsonStringify(input) !== stableJsonStringify(parsed)) {
    throw new Error("Coverage pack must already be canonical");
  }
  deepFreezeGovernanceRecord(input);
}

export function assertCoverageCorrectionPair(
  previousInput: unknown,
  currentInput: unknown,
): asserts currentInput is CoveragePack {
  assertCoveragePackIntegrity(previousInput);
  assertCoveragePackIntegrity(currentInput);
  const lineage = currentInput.correctionLineage;
  if (lineage.kind !== "superseding-correction") {
    throw new Error(
      "Coverage correction pair requires a superseding-correction declaration",
    );
  }
  if (
    lineage.previous.packId !== previousInput.packId ||
    lineage.previous.releaseId !== previousInput.releaseBinding.releaseId ||
    lineage.previous.packSha256 !== previousInput.packSha256
  ) {
    throw new Error(
      "Coverage correction declaration does not bind the exact predecessor",
    );
  }
  if (lineage.revision !== previousInput.correctionLineage.revision + 1) {
    throw new Error(
      "Coverage correction revision must immediately follow its predecessor",
    );
  }
  if (
    currentInput.packId !== previousInput.packId ||
    currentInput.coverageKey !== previousInput.coverageKey ||
    stableJsonStringify(currentInput.scope) !==
      stableJsonStringify(previousInput.scope)
  ) {
    throw new Error(
      "Coverage correction must retain its stable logical identity and scope",
    );
  }
  if (
    currentInput.releaseBinding.releaseId ===
    previousInput.releaseBinding.releaseId
  ) {
    throw new Error(
      "Coverage correction must belong to a distinct exact release",
    );
  }
  const issuedAt = Date.parse(lineage.issuedAt);
  if (
    issuedAt < Date.parse(previousInput.generatedAt) ||
    issuedAt < Date.parse(currentInput.releaseBinding.releaseGeneratedAt) ||
    issuedAt > Date.parse(currentInput.generatedAt)
  ) {
    throw new Error(
      "Coverage correction issuance must follow its predecessor and current release and cannot postdate the corrected pack",
    );
  }
  const affectedDimensionIds = deriveAffectedDimensionIds(
    previousInput,
    currentInput,
  );
  if (
    affectedDimensionIds.length === 0 ||
    !sameStrings(affectedDimensionIds, lineage.affectedDimensionIds)
  ) {
    throw new Error(
      "Coverage correction affected dimensions must equal the exact pair-derived change set",
    );
  }
}

export function calculateCoveragePackSetSha256(
  input: CoveragePackSetInput,
): string {
  return stableJsonSha256(CoveragePackSetPayloadSchema.parse(input));
}

export function formatCoveragePackSetEtag(sha256: string): string {
  const digest = Sha256Schema.parse(sha256);
  return `"cpack-set-sha256-${digest}"`;
}

export function createCoveragePackSet(
  input: CoveragePackSetInput,
): CoveragePackSet {
  const payload = CoveragePackSetPayloadSchema.parse(input);
  const setSha256 = stableJsonSha256(payload);
  return deepFreezeGovernanceRecord(
    CoveragePackSetSchema.parse({
      ...payload,
      canonicalization: COVERAGE_PACK_SET_CANONICALIZATION,
      setSha256,
      etag: formatCoveragePackSetEtag(setSha256),
    }),
  );
}

export function parseCoveragePackSet(input: unknown): CoveragePackSet {
  return deepFreezeGovernanceRecord(CoveragePackSetSchema.parse(input));
}

export function assertCoveragePackSetIntegrity(
  input: unknown,
): asserts input is CoveragePackSet {
  const parsed = parseCoveragePackSet(input);
  if (stableJsonStringify(input) !== stableJsonStringify(parsed)) {
    throw new Error("Coverage pack set must already be canonical");
  }
  deepFreezeGovernanceRecord(input);
}

export function currentCoveragePacks(
  setInput: unknown,
): readonly CoveragePack[] {
  assertCoveragePackSetIntegrity(setInput);
  return setInput.packs;
}

type PackPayload = z.infer<typeof CoveragePackPayloadSchema>;

function coveragePackPayload(pack: z.infer<typeof CoveragePackSchema>): PackPayload {
  const {
    canonicalization: _canonicalization,
    packSha256: _packSha256,
    etag: _etag,
    ...payload
  } = pack;
  return CoveragePackPayloadSchema.parse(payload);
}

type PackSetPayload = z.infer<typeof CoveragePackSetPayloadSchema>;

function coveragePackSetPayload(
  set: z.infer<typeof CoveragePackSetSchema>,
): PackSetPayload {
  const {
    canonicalization: _canonicalization,
    setSha256: _setSha256,
    etag: _etag,
    ...payload
  } = set;
  return CoveragePackSetPayloadSchema.parse(payload);
}

function deriveAffectedDimensionIds(
  previous: CoveragePack,
  current: CoveragePack,
): CoverageDimensionId[] {
  if (
    previous.title !== current.title ||
    previous.summary !== current.summary
  ) {
    return [...COVERAGE_DIMENSION_ORDER];
  }

  const affected = new Set<CoverageDimensionId>();
  for (const dimensionId of COVERAGE_DIMENSION_ORDER) {
    const previousDimension = previous.dimensions.find(
      (dimension) => dimension.dimensionId === dimensionId,
    );
    const currentDimension = current.dimensions.find(
      (dimension) => dimension.dimensionId === dimensionId,
    );
    if (
      stableJsonStringify(previousDimension) !==
      stableJsonStringify(currentDimension)
    ) {
      affected.add(dimensionId);
    }
  }

  markChangedLinkedRecords(
    previous.counts,
    current.counts,
    (record) => record.countId,
    affected,
  );
  markChangedLinkedRecords(
    previous.knownGaps,
    current.knownGaps,
    (record) => record.gapId,
    affected,
  );
  markChangedLinkedRecords(
    previous.nextEvidenceRequirements,
    current.nextEvidenceRequirements,
    (record) => record.requirementId,
    affected,
  );

  const changedBindingIds = changedRecordIds(
    previous.sourceBindings,
    current.sourceBindings,
    (binding) => binding.bindingId,
  );
  for (const bindingId of changedBindingIds) {
    markBindingAffectedDimensions(previous, bindingId, affected);
    markBindingAffectedDimensions(current, bindingId, affected);
  }

  return COVERAGE_DIMENSION_ORDER.filter((dimensionId) =>
    affected.has(dimensionId),
  );
}

type DimensionLinkedCoverageRecord = {
  readonly dimensionIds: readonly CoverageDimensionId[];
};

function markChangedLinkedRecords<
  RecordType extends DimensionLinkedCoverageRecord,
>(
  previous: readonly RecordType[],
  current: readonly RecordType[],
  idOf: (record: RecordType) => string,
  affected: Set<CoverageDimensionId>,
): void {
  const previousById = new Map(previous.map((record) => [idOf(record), record]));
  const currentById = new Map(current.map((record) => [idOf(record), record]));
  for (const recordId of canonicalUnion([
    ...previousById.keys(),
    ...currentById.keys(),
  ])) {
    const previousRecord = previousById.get(recordId);
    const currentRecord = currentById.get(recordId);
    if (
      stableJsonStringify(previousRecord) === stableJsonStringify(currentRecord)
    ) {
      continue;
    }
    for (const dimensionId of [
      ...(previousRecord?.dimensionIds ?? []),
      ...(currentRecord?.dimensionIds ?? []),
    ]) {
      affected.add(dimensionId);
    }
  }
}

function changedRecordIds<RecordType>(
  previous: readonly RecordType[],
  current: readonly RecordType[],
  idOf: (record: RecordType) => string,
): string[] {
  const previousById = new Map(previous.map((record) => [idOf(record), record]));
  const currentById = new Map(current.map((record) => [idOf(record), record]));
  return canonicalUnion([
    ...previousById.keys(),
    ...currentById.keys(),
  ]).filter(
    (recordId) =>
      stableJsonStringify(previousById.get(recordId)) !==
      stableJsonStringify(currentById.get(recordId)),
  );
}

function markBindingAffectedDimensions(
  pack: CoveragePack,
  bindingId: string,
  affected: Set<CoverageDimensionId>,
): void {
  for (const dimension of pack.dimensions) {
    if (dimension.sourceBindingIds.includes(bindingId)) {
      affected.add(dimension.dimensionId);
    }
  }
  for (const record of [
    ...pack.counts,
    ...pack.knownGaps,
    ...pack.nextEvidenceRequirements,
  ]) {
    if (record.sourceBindingIds.includes(bindingId)) {
      for (const dimensionId of record.dimensionIds) {
        affected.add(dimensionId);
      }
    }
  }
}

function validateCoveragePackPayload(
  pack: PackPayload,
  context: z.RefinementCtx,
): void {
  if (Date.parse(pack.generatedAt) < Date.parse(pack.releaseBinding.releaseGeneratedAt)) {
    context.addIssue({
      code: "custom",
      path: ["generatedAt"],
      message: "Coverage pack cannot predate its exact release",
    });
  }
  if (!isCanonicalUnique(pack.scope.navigationRecordIds)) {
    context.addIssue({
      code: "custom",
      path: ["scope", "navigationRecordIds"],
      message: "Coverage navigation IDs must be unique and canonically ordered",
    });
  }

  const bindingIds = pack.sourceBindings.map((binding) => binding.bindingId);
  const bindingLocations = pack.sourceBindings.map((binding) =>
    binding.kind === "repository-record"
      ? `${binding.repositoryPath}#${binding.exportName}`
      : binding.repositoryPath,
  );
  if (
    !isCanonicalUnique(bindingIds) ||
    new Set(bindingLocations).size !== bindingLocations.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceBindings"],
      message:
        "Coverage source bindings must have unique ordered IDs and unique locations",
    });
  }
  for (const [index, binding] of pack.sourceBindings.entries()) {
    if (!isCanonicalUnique(binding.referenceRecordIds)) {
      context.addIssue({
        code: "custom",
        path: ["sourceBindings", index, "referenceRecordIds"],
        message:
          "Coverage binding references must be unique and canonically ordered",
      });
    }
    if (Date.parse(binding.frozenAt) > Date.parse(pack.generatedAt)) {
      context.addIssue({
        code: "custom",
        path: ["sourceBindings", index, "frozenAt"],
        message: "Coverage pack cannot predate a bound frozen record",
      });
    }
  }
  if (!isCanonicalUnique(pack.sourceReferenceIds)) {
    context.addIssue({
      code: "custom",
      path: ["sourceReferenceIds"],
      message:
        "Coverage source references must be unique and canonically ordered",
    });
  }
  const boundReferences = canonicalUnion(
    pack.sourceBindings.flatMap((binding) => binding.referenceRecordIds),
  );
  if (!sameStrings(boundReferences, pack.sourceReferenceIds)) {
    context.addIssue({
      code: "custom",
      path: ["sourceReferenceIds"],
      message:
        "Coverage source references must equal the exact union of bound references",
    });
  }
  const scopeBinding = pack.sourceBindings.find(
    (binding) =>
      binding.recordId === pack.scope.recordId &&
      binding.referenceRecordIds.includes(pack.scope.recordId),
  );
  if (
    scopeBinding === undefined ||
    !pack.sourceReferenceIds.includes(pack.scope.recordId)
  ) {
    context.addIssue({
      code: "custom",
      path: ["scope", "recordId"],
      message:
        "Coverage scope must resolve to the same record in a source binding, that binding's references, and the top-level reference union",
    });
  }

  const countIds = pack.counts.map((count) => count.countId);
  const gapIds = pack.knownGaps.map((gap) => gap.gapId);
  const requirementIds = pack.nextEvidenceRequirements.map(
    (requirement) => requirement.requirementId,
  );
  for (const [values, path] of [
    [countIds, ["counts"]],
    [gapIds, ["knownGaps"]],
    [requirementIds, ["nextEvidenceRequirements"]],
  ] as const) {
    if (!isCanonicalUnique(values)) {
      context.addIssue({
        code: "custom",
        path: [...path],
        message: "Coverage records must use unique canonically ordered IDs",
      });
    }
  }

  const bindingsById = new Map(
    pack.sourceBindings.map((binding) => [binding.bindingId, binding]),
  );
  const sourceReferences = new Set(pack.sourceReferenceIds);
  const countsById = new Map(pack.counts.map((count) => [count.countId, count]));
  const gapsById = new Map(pack.knownGaps.map((gap) => [gap.gapId, gap]));
  const requirementsById = new Map(
    pack.nextEvidenceRequirements.map((requirement) => [
      requirement.requirementId,
      requirement,
    ]),
  );
  const dimensionsById = new Map(
    pack.dimensions.map((dimension) => [dimension.dimensionId, dimension]),
  );
  const usedBindingIds = new Set<string>();
  const usedReferenceIds = new Set<string>();

  for (const [index, dimension] of pack.dimensions.entries()) {
    for (const [values, path] of [
      [dimension.countIds, ["dimensions", index, "countIds"]],
      [dimension.sourceBindingIds, ["dimensions", index, "sourceBindingIds"]],
      [dimension.sourceReferenceIds, ["dimensions", index, "sourceReferenceIds"]],
      [dimension.knownGapIds, ["dimensions", index, "knownGapIds"]],
      [
        dimension.nextEvidenceRequirementIds,
        ["dimensions", index, "nextEvidenceRequirementIds"],
      ],
    ] as const) {
      if (!isCanonicalUnique(values)) {
        context.addIssue({
          code: "custom",
          path: [...path],
          message:
            "Coverage dimension links must be unique and canonically ordered",
        });
      }
    }
    if (
      dimension.status !== "out-of-scope" &&
      (dimension.sourceBindingIds.length === 0 ||
        dimension.sourceReferenceIds.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["dimensions", index, "status"],
        message:
          "Every in-scope coverage status requires linked source bindings and references",
      });
    }
    if (dimension.status === "validated-artifact-evidence") {
      context.addIssue({
        code: "custom",
        path: ["dimensions", index, "status"],
        message:
          "Validated artifact evidence is reserved in Coverage Pack v1 until verifier-bound validation evidence exists",
      });
    }
    if (
      dimension.status === "out-of-scope" &&
      (dimension.knownGapIds.length > 0 ||
        dimension.nextEvidenceRequirementIds.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["dimensions", index, "status"],
        message: "Out-of-scope coverage cannot claim in-scope gaps or requirements",
      });
    }
    if (
      dimension.status === "absent" &&
      (dimension.knownGapIds.length === 0 ||
        dimension.nextEvidenceRequirementIds.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["dimensions", index, "status"],
        message: "Absent in-scope coverage must retain a gap and next evidence",
      });
    }
    validateBindingAndReferenceLinks(
      dimension.sourceBindingIds,
      dimension.sourceReferenceIds,
      bindingsById,
      sourceReferences,
      usedBindingIds,
      usedReferenceIds,
      context,
      ["dimensions", index],
    );
    for (const countId of dimension.countIds) {
      if (!countsById.get(countId)?.dimensionIds.includes(dimension.dimensionId)) {
        addReciprocityIssue(context, ["dimensions", index, "countIds"]);
      }
    }
    for (const gapId of dimension.knownGapIds) {
      if (!gapsById.get(gapId)?.dimensionIds.includes(dimension.dimensionId)) {
        addReciprocityIssue(context, ["dimensions", index, "knownGapIds"]);
      }
    }
    for (const requirementId of dimension.nextEvidenceRequirementIds) {
      if (
        !requirementsById
          .get(requirementId)
          ?.dimensionIds.includes(dimension.dimensionId)
      ) {
        addReciprocityIssue(context, [
          "dimensions",
          index,
          "nextEvidenceRequirementIds",
        ]);
      }
    }
  }

  for (const [index, count] of pack.counts.entries()) {
    validateBindingAndReferenceLinks(
      count.sourceBindingIds,
      canonicalUnion(
        count.sourceBindingIds.flatMap(
          (bindingId) => bindingsById.get(bindingId)?.referenceRecordIds ?? [],
        ),
      ),
      bindingsById,
      sourceReferences,
      usedBindingIds,
      usedReferenceIds,
      context,
      ["counts", index],
    );
    for (const dimensionId of count.dimensionIds) {
      if (!dimensionsById.get(dimensionId)?.countIds.includes(count.countId)) {
        addReciprocityIssue(context, ["counts", index, "dimensionIds"]);
      }
    }
  }

  for (const [index, gap] of pack.knownGaps.entries()) {
    validateBindingAndReferenceLinks(
      gap.sourceBindingIds,
      gap.sourceReferenceIds,
      bindingsById,
      sourceReferences,
      usedBindingIds,
      usedReferenceIds,
      context,
      ["knownGaps", index],
    );
    validateOrigins(gap.origins, gap.sourceBindingIds, bindingsById, context, [
      "knownGaps",
      index,
      "origins",
    ]);
    for (const dimensionId of gap.dimensionIds) {
      if (!dimensionsById.get(dimensionId)?.knownGapIds.includes(gap.gapId)) {
        addReciprocityIssue(context, ["knownGaps", index, "dimensionIds"]);
      }
    }
    for (const requirementId of gap.nextEvidenceRequirementIds) {
      if (!requirementsById.get(requirementId)?.knownGapIds.includes(gap.gapId)) {
        addReciprocityIssue(context, [
          "knownGaps",
          index,
          "nextEvidenceRequirementIds",
        ]);
      }
    }
  }

  for (const [index, requirement] of pack.nextEvidenceRequirements.entries()) {
    validateBindingAndReferenceLinks(
      requirement.sourceBindingIds,
      requirement.sourceReferenceIds,
      bindingsById,
      sourceReferences,
      usedBindingIds,
      usedReferenceIds,
      context,
      ["nextEvidenceRequirements", index],
    );
    validateOrigins(
      requirement.origins,
      requirement.sourceBindingIds,
      bindingsById,
      context,
      ["nextEvidenceRequirements", index, "origins"],
    );
    for (const dimensionId of requirement.dimensionIds) {
      if (
        !dimensionsById
          .get(dimensionId)
          ?.nextEvidenceRequirementIds.includes(requirement.requirementId)
      ) {
        addReciprocityIssue(context, [
          "nextEvidenceRequirements",
          index,
          "dimensionIds",
        ]);
      }
    }
    for (const gapId of requirement.knownGapIds) {
      if (
        !gapsById
          .get(gapId)
          ?.nextEvidenceRequirementIds.includes(requirement.requirementId)
      ) {
        addReciprocityIssue(context, [
          "nextEvidenceRequirements",
          index,
          "knownGapIds",
        ]);
      }
    }
  }

  if (
    !sameStrings([...usedBindingIds].sort(compareCanonicalText), bindingIds) ||
    !sameStrings(
      [...usedReferenceIds].sort(compareCanonicalText),
      pack.sourceReferenceIds,
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceBindings"],
      message:
        "Every bound source and reference must support at least one coverage record",
    });
  }

  const lineage = pack.correctionLineage;
  if (lineage.kind === "superseding-correction") {
    if (lineage.previous.packId !== pack.packId) {
      context.addIssue({
        code: "custom",
        path: ["correctionLineage", "previous", "packId"],
        message: "A correction must retain the same stable logical pack ID",
      });
    }
    if (lineage.previous.releaseId === pack.releaseBinding.releaseId) {
      context.addIssue({
        code: "custom",
        path: ["correctionLineage", "previous", "releaseId"],
        message:
          "Immutable coverage corrections must supersede a distinct release",
      });
    }
    if (Date.parse(lineage.issuedAt) > Date.parse(pack.generatedAt)) {
      context.addIssue({
        code: "custom",
        path: ["correctionLineage", "issuedAt"],
        message: "Coverage correction cannot postdate the corrected pack",
      });
    }
  }
}

function validateLinkedRecordLists(
  record: {
    dimensionIds: readonly CoverageDimensionId[];
    sourceBindingIds: readonly string[];
    sourceReferenceIds: readonly string[];
    origins: readonly CoverageOrigin[];
  },
  context: z.RefinementCtx,
): void {
  if (!isCanonicalDimensionList(record.dimensionIds)) {
    context.addIssue({
      code: "custom",
      path: ["dimensionIds"],
      message: "Coverage dimensions must be unique and canonically ordered",
    });
  }
  for (const [values, path] of [
    [record.sourceBindingIds, ["sourceBindingIds"]],
    [record.sourceReferenceIds, ["sourceReferenceIds"]],
  ] as const) {
    if (!isCanonicalUnique(values)) {
      context.addIssue({
        code: "custom",
        path: [...path],
        message: "Coverage links must be unique and canonically ordered",
      });
    }
  }
  if (!isCanonicalOrigins(record.origins)) {
    context.addIssue({
      code: "custom",
      path: ["origins"],
      message: "Coverage origins must be unique and canonically ordered",
    });
  }
}

function validateBindingAndReferenceLinks(
  bindingIds: readonly string[],
  referenceIds: readonly string[],
  bindingsById: ReadonlyMap<string, CoverageSourceBinding>,
  sourceReferences: ReadonlySet<string>,
  usedBindingIds: Set<string>,
  usedReferenceIds: Set<string>,
  context: z.RefinementCtx,
  path: (string | number)[],
): void {
  const coveredReferences = new Set<string>();
  for (const bindingId of bindingIds) {
    const binding = bindingsById.get(bindingId);
    if (binding === undefined) {
      context.addIssue({
        code: "custom",
        path: [...path, "sourceBindingIds"],
        message: "Coverage link references an unknown source binding",
      });
      continue;
    }
    usedBindingIds.add(bindingId);
    for (const referenceId of binding.referenceRecordIds) {
      coveredReferences.add(referenceId);
    }
  }
  for (const referenceId of referenceIds) {
    if (!sourceReferences.has(referenceId) || !coveredReferences.has(referenceId)) {
      context.addIssue({
        code: "custom",
        path: [...path, "sourceReferenceIds"],
        message:
          "Coverage references must resolve through one of the linked source bindings",
      });
    }
    usedReferenceIds.add(referenceId);
  }
}

function validateOrigins(
  origins: readonly CoverageOrigin[],
  bindingIds: readonly string[],
  bindingsById: ReadonlyMap<string, CoverageSourceBinding>,
  context: z.RefinementCtx,
  path: (string | number)[],
): void {
  const allowed = new Set(bindingIds);
  for (const origin of origins) {
    if (
      !allowed.has(origin.sourceBindingId) ||
      !bindingsById.has(origin.sourceBindingId)
    ) {
      context.addIssue({
        code: "custom",
        path,
        message: "Coverage origin must resolve through its record's source binding",
      });
    }
  }
}

function addReciprocityIssue(
  context: z.RefinementCtx,
  path: (string | number)[],
): void {
  context.addIssue({
    code: "custom",
    path,
    message: "Coverage dimension, gap, count, and requirement links must be reciprocal",
  });
}

function compareCanonicalText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isCanonicalUnique(values: readonly string[]): boolean {
  return (
    new Set(values).size === values.length &&
    values.every(
      (value, index) =>
        index === 0 ||
        compareCanonicalText(values[index - 1]!, value) < 0,
    )
  );
}

function isCanonicalDimensionList(
  values: readonly CoverageDimensionId[],
): boolean {
  const positions = new Map(
    COVERAGE_DIMENSION_ORDER.map((dimensionId, index) => [dimensionId, index]),
  );
  return (
    new Set(values).size === values.length &&
    values.every(
      (value, index) =>
        index === 0 ||
        positions.get(values[index - 1]!)! < positions.get(value)!,
    )
  );
}

function isCanonicalOrigins(origins: readonly CoverageOrigin[]): boolean {
  const identities = origins.map(
    (origin) => `${origin.sourceBindingId}\0${origin.jsonPointer}`,
  );
  return isCanonicalUnique(identities);
}

function canonicalUnion(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCanonicalText);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return stableJsonStringify(left) === stableJsonStringify(right);
}
