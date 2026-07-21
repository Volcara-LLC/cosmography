import { z } from "zod";

import {
  AIInvolvementSchema,
  AppearanceClassSchema,
  GeometryClassSchema,
  TimeStateSchema,
} from "./representations";
import { EvidenceClassSchema } from "./assertions";
import {
  AssetIdSchema,
  CaptureContextIdSchema,
  SemVerSchema,
  Sha256Schema,
  SurfaceProductIdSchema,
  SurfaceProductRequirementIdSchema,
  SurfaceValidationIdSchema,
} from "./ids";
import { RightsStatementSchema } from "./rights";

const LocalReferenceIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const StrictHttpsUrlSchema = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      url.search === "" &&
      url.hash === ""
    );
  }, "Surface provenance URLs must use credential-free HTTPS on the default port without query or fragment state");

const ArchiveIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(1024)
  .refine(
    (value) => /^[\x20-\x7e]+$/.test(value),
    "Archive identifiers must use printable ASCII without control characters",
  );

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
  .refine((value) => !/[. ]$/.test(value), "Filename cannot end with a dot or space")
  .refine(
    (value) =>
      !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value),
    "Filename cannot use a Windows reserved device name",
  )
  .refine(
    (value) =>
      !/\.(?:bat|cmd|com|cpl|dll|exe|js|lnk|msi|ps1|scr|vbs)$/i.test(value),
    "Surface artifacts cannot use executable or script filename extensions",
  )
  .refine(
    (value) => !/(?:^|[._-])(?:latest|current|mutable)(?:[._-]|$)/i.test(value),
    "Frozen products cannot use mutable filename aliases",
  );

const ImmutableSurfaceObjectKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(1024)
  .refine((value) => value.startsWith("surface/"), "Surface objects belong below surface/")
  .refine((value) => !value.includes("\\"), "Object keys must use forward slashes")
  .refine(
    (value) =>
      value
        .split("/")
        .every((segment) => segment !== "" && segment !== "." && segment !== ".."),
    "Object keys must be canonical and cannot contain empty or traversal segments",
  )
  .refine((value) => /^[a-z0-9][a-z0-9/_\-.]+$/.test(value), {
    message: "Object keys must use canonical lowercase storage characters",
  });

export const SurfaceBodySchema = z.enum(["Mars", "Moon"]);

export const SurfaceProductKindSchema = z.enum([
  "orthomosaic",
  "elevation-model",
  "confidence-mask",
  "terrain-mesh",
  "source-frame-set",
  "panorama-derivative",
  "localization",
  "camera-calibration",
  "traverse-vector",
]);

const SurfaceIntendedUseSchema = z
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

const PendingProductIdentitySchema = z
  .object({
    state: z.literal("selection-pending"),
    reason: z.string().trim().min(1),
  })
  .strict();

const ExactProductIdentitySchema = z
  .object({
    state: z.literal("exact-record-identified"),
    namespace: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
    identifier: ArchiveIdentifierSchema,
    version: ArchiveIdentifierSchema.max(255),
  })
  .strict()
  .superRefine((identity, context) => {
    for (const [field, value] of [
      ["identifier", identity.identifier],
      ["version", identity.version],
    ] as const) {
      if (/(?:^|[._:/\s-])(?:latest|current|mutable)(?:$|[._:/\s-])/i.test(value)) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Frozen product identity cannot use a mutable alias",
        });
      }
    }
  });

export const ReferenceOnlySurfaceProductSchema = z
  .object({
    schemaVersion: SemVerSchema,
    requirementId: SurfaceProductRequirementIdSchema,
    experienceId: LocalReferenceIdSchema,
    body: SurfaceBodySchema,
    state: z.literal("reference-only-pending-artifact-review"),
    title: z.string().trim().min(1),
    productKind: SurfaceProductKindSchema,
    intendedEvidenceClass: EvidenceClassSchema,
    authority: z.string().trim().min(1),
    sourceRelease: z.string().trim().min(1),
    officialRecordUrl: StrictHttpsUrlSchema,
    productIdentity: z.discriminatedUnion("state", [
      PendingProductIdentitySchema,
      ExactProductIdentitySchema,
    ]),
    sourceReferenceIds: z.array(LocalReferenceIdSchema).min(1),
    requiredForEvidenceIds: z.array(LocalReferenceIdSchema).min(1),
    requiredForCaptureNodeIds: z.array(LocalReferenceIdSchema),
    checkedAt: z.iso.datetime({ offset: true }),
    intendedUse: SurfaceIntendedUseSchema,
    assetBytesPresent: z.literal(false),
    renderAllowed: z.literal(false),
    releaseEligible: z.literal(false),
    blockedReasons: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()
  .superRefine((record, context) => {
    for (const [field, values] of [
      ["sourceReferenceIds", record.sourceReferenceIds],
      ["requiredForEvidenceIds", record.requiredForEvidenceIds],
      ["requiredForCaptureNodeIds", record.requiredForCaptureNodeIds],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Surface reference lists cannot contain duplicates",
        });
      }
    }
    if (
      !record.intendedUse.metadataDisplay ||
      !record.intendedUse.externalLink ||
      record.intendedUse.embedBytes ||
      record.intendedUse.redistribute ||
      record.intendedUse.modify ||
      record.intendedUse.commercialUse ||
      record.intendedUse.offlinePackaging ||
      record.intendedUse.derivativeGeneration
    ) {
      context.addIssue({
        code: "custom",
        path: ["intendedUse"],
        message: "Reference-only surface products may expose metadata and links only",
      });
    }
  });

export type ReferenceOnlySurfaceProduct = z.infer<
  typeof ReferenceOnlySurfaceProductSchema
>;

const SurfaceProductSelectionReviewSchema = z
  .object({
    reviewedAt: z.iso.datetime({ offset: true }),
    reviewerId: LocalReferenceIdSchema,
    approvalReference: z.string().trim().min(1),
    selectedProductIdentity: ExactProductIdentitySchema,
    approvedIntendedUse: SurfaceIntendedUseSchema,
  })
  .strict()
  .superRefine((review, context) => {
    if (
      !review.approvedIntendedUse.metadataDisplay ||
      !review.approvedIntendedUse.embedBytes
    ) {
      context.addIssue({
        code: "custom",
        path: ["approvedIntendedUse"],
        message:
          "A reviewed frozen-product selection must approve metadata display and exact-byte verification",
      });
    }
  });

export type SurfaceProductSelectionReview = z.infer<
  typeof SurfaceProductSelectionReviewSchema
>;

export type ReviewedSurfaceProductSelection = Readonly<{
  state: "surface-product-selection-reviewed";
  requirement: ReferenceOnlySurfaceProduct;
  review: Readonly<SurfaceProductSelectionReview>;
  artifactVerificationAllowed: true;
  runtimeUseAllowed: false;
  capturePlacementAllowed: false;
  releaseEligible: false;
}>;

export type SurfaceProductSelectionAuthorizer = (
  requirement: Readonly<ReferenceOnlySurfaceProduct>,
  review: Readonly<SurfaceProductSelectionReview>,
) => boolean | Promise<boolean>;

const issuedReviewedSurfaceProductSelections = new WeakSet<object>();

export async function reviewSurfaceProductSelection(
  requirementInput: unknown,
  reviewInput: unknown,
  authorizeReview: SurfaceProductSelectionAuthorizer,
): Promise<ReviewedSurfaceProductSelection> {
  const requirement = freezeRecursively(
    ReferenceOnlySurfaceProductSchema.parse(requirementInput),
  );
  const review = freezeRecursively(
    SurfaceProductSelectionReviewSchema.parse(reviewInput),
  );
  if (Date.parse(review.reviewedAt) < Date.parse(requirement.checkedAt)) {
    throw new Error("Surface product selection review cannot predate its source check");
  }
  if (
    requirement.productIdentity.state === "exact-record-identified" &&
    JSON.stringify(requirement.productIdentity) !==
      JSON.stringify(review.selectedProductIdentity)
  ) {
    throw new Error(
      "Surface product selection review changed an already identified exact record",
    );
  }
  if (!(await authorizeReview(requirement, review))) {
    throw new Error("Surface product selection authorizer rejected the review");
  }
  const reviewed = freezeRecursively({
    state: "surface-product-selection-reviewed" as const,
    requirement,
    review,
    artifactVerificationAllowed: true as const,
    runtimeUseAllowed: false as const,
    capturePlacementAllowed: false as const,
    releaseEligible: false as const,
  });
  issuedReviewedSurfaceProductSelections.add(reviewed);
  return reviewed;
}

function assertIssuedReviewedSurfaceProductSelection(
  input: ReviewedSurfaceProductSelection,
): void {
  if (!issuedReviewedSurfaceProductSelections.has(input)) {
    throw new Error(
      "Surface runtime verification requires an in-process reviewed product selection",
    );
  }
}

const SurfaceAssetMediaTypeSchema = z.enum([
  "application/json",
  "application/octet-stream",
  "application/xml",
  "image/jpeg",
  "image/jp2",
  "image/png",
  "image/tiff",
  "model/gltf-binary",
  "text/csv",
  "text/plain",
]);

const SurfaceAssetRoleSchema = z.enum([
  "primary-data",
  "source-label",
  "projection-definition",
  "metadata",
  "browse",
  "confidence",
  "calibration",
]);

const SurfaceAssetLineageSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("source-original"),
      sourceProductIdentifier: ArchiveIdentifierSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("derived"),
      parentAssetIds: z.array(AssetIdSchema).min(1),
      transformation: z.string().trim().min(1),
      software: z.string().trim().min(1),
      createdAt: z.iso.datetime({ offset: true }),
    })
    .strict()
    .superRefine((lineage, context) => {
      if (new Set(lineage.parentAssetIds).size !== lineage.parentAssetIds.length) {
        context.addIssue({
          code: "custom",
          path: ["parentAssetIds"],
          message: "Derivative parent assets must be unique",
        });
      }
    }),
]);

const FrozenSurfaceAssetSchema = z
  .object({
    assetId: AssetIdSchema,
    role: SurfaceAssetRoleSchema,
    filename: SafeFilenameSchema,
    sourceUrl: StrictHttpsUrlSchema,
    mediaType: SurfaceAssetMediaTypeSchema,
    byteLength: z.number().int().positive(),
    sha256: Sha256Schema,
    immutableObjectKey: ImmutableSurfaceObjectKeySchema,
    capturedAt: z.iso.datetime({ offset: true }),
    lineage: SurfaceAssetLineageSchema,
    rights: RightsStatementSchema,
  })
  .strict()
  .superRefine((asset, context) => {
    const basename = asset.immutableObjectKey.split("/").at(-1);
    if (basename !== asset.filename.toLowerCase()) {
      context.addIssue({
        code: "custom",
        path: ["immutableObjectKey"],
        message: "Surface object basename must match the lowercase retained filename",
      });
    }
    let sourceBasename: string | undefined;
    try {
      sourceBasename = decodeURIComponent(
        new URL(asset.sourceUrl).pathname.split("/").at(-1) ?? "",
      );
    } catch {
      sourceBasename = undefined;
    }
    if (sourceBasename !== asset.filename) {
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Surface source URL must name the exact retained filename",
      });
    }
    const extensionByMediaType: Partial<
      Record<z.infer<typeof SurfaceAssetMediaTypeSchema>, readonly string[]>
    > = {
      "application/json": [".json"],
      "application/xml": [".xml"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/jp2": [".jp2"],
      "image/png": [".png"],
      "image/tiff": [".tif", ".tiff"],
      "model/gltf-binary": [".glb"],
      "text/csv": [".csv"],
      "text/plain": [".txt", ".lbl", ".tab"],
    };
    const allowedExtensions = extensionByMediaType[asset.mediaType];
    if (
      allowedExtensions &&
      !allowedExtensions.some((extension) => asset.filename.toLowerCase().endsWith(extension))
    ) {
      context.addIssue({
        code: "custom",
        path: ["filename"],
        message: "Surface asset extension must match its media type",
      });
    }
    if (
      asset.rights.target.kind !== "asset" ||
      asset.rights.target.assetId !== asset.assetId
    ) {
      context.addIssue({
        code: "custom",
        path: ["rights", "target"],
        message: "Surface rights must target the exact retained asset",
      });
    }
    const rightsUrls: readonly (readonly [string, string])[] = [
      ...(asset.rights.sourceTermsUrl
        ? [["sourceTermsUrl", asset.rights.sourceTermsUrl] as const]
        : []),
      ...(asset.rights.basis.kind === "spdx"
        ? [["basis.licenseUrl", asset.rights.basis.licenseUrl] as const]
        : []),
      ...(asset.rights.basis.kind === "custom-terms"
        ? [["basis.termsUrl", asset.rights.basis.termsUrl] as const]
        : []),
    ];
    for (const [field, url] of rightsUrls) {
      if (!StrictHttpsUrlSchema.safeParse(url).success) {
        context.addIssue({
          code: "custom",
          path: ["rights", ...field.split(".")],
          message: "Retained surface rights URLs must use credential-free HTTPS",
        });
      }
    }
  });

const AccuracySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("declared"),
      metres: z.number().finite().nonnegative(),
      basis: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("not-provided"),
      reason: z.string().trim().min(1),
    })
    .strict(),
]);

const VerticalDatumSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("declared"),
      name: z.string().trim().min(1),
      unit: z.literal("metre"),
      radiusOrReferenceDisclosure: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("not-applicable"),
      reason: z.string().trim().min(1),
    })
    .strict(),
]);

const NoDataSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("declared"),
      values: z.array(z.number().finite()).min(1),
      gapDisclosure: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("none-declared"),
      basis: z.string().trim().min(1),
      gapDisclosure: z.string().trim().min(1),
    })
    .strict(),
]);

const CartographicSurfaceMetadataSchema = z
  .object({
    domain: z.literal("cartographic"),
    coordinateSystem: z.literal("planetocentric"),
    longitudeDirection: z.literal("positive-east"),
    longitudeDomain: z.enum(["0-to-360", "minus-180-to-180"]),
    bodyFixedFrame: z.string().trim().min(1),
    projectionName: z.string().trim().min(1),
    projectionDefinitionSha256: Sha256Schema,
    horizontalDatum: z.string().trim().min(1),
    verticalDatum: VerticalDatumSchema,
    extent: z
      .object({
        southLatitudeDegrees: z.number().finite().min(-90).max(90),
        northLatitudeDegrees: z.number().finite().min(-90).max(90),
        westLongitudeDegrees: z.number().finite(),
        eastLongitudeDegrees: z.number().finite(),
        crossesAntimeridian: z.boolean(),
      })
      .strict(),
    resolution: z
      .object({
        x: z.number().finite().positive(),
        y: z.number().finite().positive(),
        unit: z.enum(["metres-per-pixel", "metres-per-post"]),
        basis: z.string().trim().min(1),
      })
      .strict(),
    horizontalAccuracy: AccuracySchema,
    verticalAccuracy: AccuracySchema,
    noData: NoDataSchema,
    seamDisclosure: z.string().trim().min(1),
    defaultElevationExaggeration: z.literal(1),
  })
  .strict()
  .superRefine((metadata, context) => {
    if (/WGS\s*84|EPSG\s*:?\s*\d+|ITRF|NAD\s*83|\bEARTH\b/i.test(
      `${metadata.bodyFixedFrame} ${metadata.horizontalDatum} ${metadata.projectionName}`,
    )) {
      context.addIssue({
        code: "custom",
        path: ["horizontalDatum"],
        message: "Planetary surface products cannot inherit an Earth CRS",
      });
    }
    if (metadata.extent.southLatitudeDegrees >= metadata.extent.northLatitudeDegrees) {
      context.addIssue({
        code: "custom",
        path: ["extent"],
        message: "Surface latitude extent must increase from south to north",
      });
    }
    const longitudeBounds =
      metadata.longitudeDomain === "0-to-360"
        ? { minimum: 0, maximum: 360 }
        : { minimum: -180, maximum: 180 };
    for (const [field, value] of [
      ["westLongitudeDegrees", metadata.extent.westLongitudeDegrees],
      ["eastLongitudeDegrees", metadata.extent.eastLongitudeDegrees],
    ] as const) {
      if (value < longitudeBounds.minimum || value > longitudeBounds.maximum) {
        context.addIssue({
          code: "custom",
          path: ["extent", field],
          message: "Longitude lies outside the declared domain",
        });
      }
    }
    if (
      metadata.extent.crossesAntimeridian ===
      (metadata.extent.westLongitudeDegrees < metadata.extent.eastLongitudeDegrees)
    ) {
      context.addIssue({
        code: "custom",
        path: ["extent", "crossesAntimeridian"],
        message: "Antimeridian flag must agree with longitude ordering",
      });
    }
  });

const CaptureTimeSchema = z.discriminatedUnion("precision", [
  z.object({ precision: z.literal("date"), value: z.iso.date() }).strict(),
  z
    .object({
      precision: z.literal("second"),
      value: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      precision: z.literal("source-frame-specific"),
      value: z.string().trim().min(1),
      disclosure: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      precision: z.literal("sequence-anchor"),
      value: z.string().trim().min(1),
      disclosure: z.string().trim().min(1),
    })
    .strict(),
]);

const RecordedMediaSurfaceMetadataSchema = z
  .object({
    domain: z.literal("recorded-media"),
    captureTime: CaptureTimeSchema,
    missionClock: z.string().trim().min(1),
    instrument: z.string().trim().min(1),
    sourceFrameIds: z.array(z.string().trim().min(1)).min(1),
    dimensionsDisclosure: z.string().trim().min(1),
    colorTreatment: z.string().trim().min(1),
    stitchDisclosure: z.string().trim().min(1).optional(),
    placementState: z.literal("withheld-until-capture-context-verified"),
  })
  .strict()
  .superRefine((metadata, context) => {
    if (new Set(metadata.sourceFrameIds).size !== metadata.sourceFrameIds.length) {
      context.addIssue({
        code: "custom",
        path: ["sourceFrameIds"],
        message: "Source frame identifiers must be unique",
      });
    }
  });

const GeometryUncertaintySchema = z
  .object({
    position: AccuracySchema,
    orientationDegrees: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("declared"),
          degrees: z.number().finite().nonnegative(),
          basis: z.string().trim().min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal("not-provided"),
          reason: z.string().trim().min(1),
        })
        .strict(),
    ]),
  })
  .strict();

const GeometrySurfaceMetadataSchema = z
  .object({
    domain: z.literal("geometry"),
    frameChain: z.array(z.string().trim().min(1)).min(2),
    coordinateConvention: z.string().trim().min(1),
    validTime: CaptureTimeSchema,
    units: z.string().trim().min(1),
    uncertainty: GeometryUncertaintySchema,
    defaultEarthCrsAssumed: z.literal(false),
    coverageDisclosure: z.string().trim().min(1),
  })
  .strict();

const SurfaceProductMetadataSchema = z.discriminatedUnion("domain", [
  CartographicSurfaceMetadataSchema,
  RecordedMediaSurfaceMetadataSchema,
  GeometrySurfaceMetadataSchema,
]);

const SurfaceProcessingLineageSchema = z
  .object({
    level: z.enum([
      "source-native",
      "calibrated",
      "orthorectified",
      "stereo-derived",
      "mosaic",
      "stitched",
      "registered",
      "solved",
    ]),
    sourceProductIdentifiers: z.array(ArchiveIdentifierSchema).min(1),
    methodDisclosure: z.string().trim().min(1),
    software: z.string().trim().min(1).optional(),
    parametersDisclosure: z.string().trim().min(1),
    processedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine((lineage, context) => {
    if (
      new Set(lineage.sourceProductIdentifiers).size !==
      lineage.sourceProductIdentifiers.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceProductIdentifiers"],
        message: "Processing source product identifiers must be unique",
      });
    }
  });

const SurfaceValidationCheckSchema = z.enum([
  "asset-bytes",
  "source-label-binding",
  "rights",
  "processing-lineage",
  "spatial-reference",
  "coverage",
  "resolution-vs-accuracy",
  "nodata-and-gaps",
  "capture-time-precision",
  "frame-inventory",
  "frame-chain",
  "uncertainty",
]);

const SurfaceValidationReportSchema = z
  .object({
    validationId: SurfaceValidationIdSchema,
    filename: SafeFilenameSchema,
    mediaType: z.literal("application/json"),
    byteLength: z.number().int().positive(),
    sha256: Sha256Schema,
    immutableObjectKey: ImmutableSurfaceObjectKeySchema,
    generatedAt: z.iso.datetime({ offset: true }),
    capturedAt: z.iso.datetime({ offset: true }),
    validatorCodeCommit: z.string().regex(/^[a-f0-9]{7,64}$/),
    status: z.literal("passed"),
    inputAssetSha256s: z.array(Sha256Schema).min(1),
    checks: z.array(SurfaceValidationCheckSchema).min(1),
  })
  .strict()
  .superRefine((report, context) => {
    if (!report.filename.endsWith(".json")) {
      context.addIssue({
        code: "custom",
        path: ["filename"],
        message: "Surface validation reports must be JSON",
      });
    }
    if (report.immutableObjectKey.split("/").at(-1) !== report.filename.toLowerCase()) {
      context.addIssue({
        code: "custom",
        path: ["immutableObjectKey"],
        message: "Validation object basename must match its lowercase filename",
      });
    }
    if (new Set(report.inputAssetSha256s).size !== report.inputAssetSha256s.length) {
      context.addIssue({
        code: "custom",
        path: ["inputAssetSha256s"],
        message: "Validation report input digests must be unique",
      });
    }
    if (new Set(report.checks).size !== report.checks.length) {
      context.addIssue({
        code: "custom",
        path: ["checks"],
        message: "Validation checks must be unique",
      });
    }
    if (Date.parse(report.capturedAt) < Date.parse(report.generatedAt)) {
      context.addIssue({
        code: "custom",
        path: ["capturedAt"],
        message: "Validation report cannot be retained before it is generated",
      });
    }
  });

const SurfaceRepresentationSchema = z
  .object({
    evidenceClass: EvidenceClassSchema,
    appearanceClass: AppearanceClassSchema,
    geometryClass: GeometryClassSchema,
    timeState: TimeStateSchema,
    aiInvolvement: AIInvolvementSchema,
    publicLabel: z.string().trim().min(3),
    uncertaintyDisclosure: z.string().trim().min(1),
    processingDisclosure: z.string().trim().min(1),
  })
  .strict()
  .superRefine((representation, context) => {
    if (
      representation.aiInvolvement.kind === "generative-output" &&
      representation.evidenceClass !== "artist-interpretation"
    ) {
      context.addIssue({
        code: "custom",
        path: ["evidenceClass"],
        message:
          "Generative surface output must be labeled artist interpretation",
      });
    }
  });

const SurfaceAssetVerificationReceiptSchema = z
  .object({
    state: z.literal("surface-asset-bytes-verified"),
    assetId: AssetIdSchema,
    byteLength: z.number().int().positive(),
    sha256: Sha256Schema,
    immutableObjectKey: ImmutableSurfaceObjectKeySchema,
    verifiedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const SurfaceValidationPayloadSchema = z
  .object({
    schemaVersion: SemVerSchema,
    validationId: SurfaceValidationIdSchema,
    surfaceProductId: SurfaceProductIdSchema,
    requirementId: SurfaceProductRequirementIdSchema,
    experienceId: LocalReferenceIdSchema,
    body: SurfaceBodySchema,
    productKind: SurfaceProductKindSchema,
    productIdentity: ExactProductIdentitySchema,
    title: z.string().trim().min(1),
    authority: z.string().trim().min(1),
    sourceRelease: z.string().trim().min(1),
    officialRecordUrl: StrictHttpsUrlSchema,
    sourceReferenceIds: z.array(LocalReferenceIdSchema).min(1),
    retrievedAt: z.iso.datetime({ offset: true }),
    admittedAt: z.iso.datetime({ offset: true }),
    intendedUse: SurfaceIntendedUseSchema,
    representation: SurfaceRepresentationSchema,
    assets: z.array(FrozenSurfaceAssetSchema).min(2),
    metadata: SurfaceProductMetadataSchema,
    processing: SurfaceProcessingLineageSchema,
    status: z.literal("passed"),
    generatedAt: z.iso.datetime({ offset: true }),
    validatorCodeCommit: z.string().regex(/^[a-f0-9]{7,64}$/),
    passedChecks: z.array(SurfaceValidationCheckSchema).min(1),
  })
  .strict();

const SurfaceValidationVerificationReceiptSchema = z
  .object({
    state: z.literal("surface-validation-report-verified"),
    validationId: SurfaceValidationIdSchema,
    filename: SafeFilenameSchema,
    byteLength: z.number().int().positive(),
    sha256: Sha256Schema,
    immutableObjectKey: ImmutableSurfaceObjectKeySchema,
    verifiedAt: z.iso.datetime({ offset: true }),
    parsedPayload: SurfaceValidationPayloadSchema,
  })
  .strict();

export type SurfaceAssetVerificationReceipt = z.infer<
  typeof SurfaceAssetVerificationReceiptSchema
>;
export type SurfaceValidationVerificationReceipt = z.infer<
  typeof SurfaceValidationVerificationReceiptSchema
>;

function requiredValidationChecks(
  metadata: z.infer<typeof SurfaceProductMetadataSchema>,
): readonly z.infer<typeof SurfaceValidationCheckSchema>[] {
  const common = [
    "asset-bytes",
    "source-label-binding",
    "rights",
    "processing-lineage",
  ] as const;
  if (metadata.domain === "cartographic") {
    return [
      ...common,
      "spatial-reference",
      "coverage",
      "resolution-vs-accuracy",
      "nodata-and-gaps",
    ];
  }
  if (metadata.domain === "recorded-media") {
    return [...common, "capture-time-precision", "frame-inventory"];
  }
  return [...common, "frame-chain", "uncertainty"];
}

function rightsFailureReasons(
  manifest: {
    admittedAt: string;
    intendedUse: z.infer<typeof SurfaceIntendedUseSchema>;
    assets: readonly z.infer<typeof FrozenSurfaceAssetSchema>[];
  },
  evaluatedAt: string,
): string[] {
  const reasons: string[] = [];
  const evaluatedAtMs = Date.parse(evaluatedAt);
  if (!Number.isFinite(evaluatedAtMs)) {
    return ["Surface product evaluation time is invalid"];
  }
  if (evaluatedAtMs < Date.parse(manifest.admittedAt)) {
    reasons.push("Surface product runtime use cannot predate admission");
  }
  for (const asset of manifest.assets) {
    const rights = asset.rights;
    if (
      rights.reviewStatus !== "reviewed" ||
      !rights.reviewedBy ||
      !rights.reviewedAt
    ) {
      reasons.push(`${asset.assetId}: rights need a named, timestamped review`);
    }
    if (rights.basis.kind === "unknown" || rights.basis.kind === "restricted") {
      reasons.push(`${asset.assetId}: unknown or restricted rights cannot authorize runtime use`);
    }
    if (rights.useProfile.display !== "allowed") {
      reasons.push(`${asset.assetId}: display is not explicitly allowed`);
    }
    if (
      (manifest.intendedUse.embedBytes ||
        manifest.intendedUse.redistribute ||
        manifest.intendedUse.offlinePackaging) &&
      rights.useProfile.redistribute !== "allowed"
    ) {
      reasons.push(`${asset.assetId}: byte delivery needs allowed redistribution`);
    }
    if (
      (manifest.intendedUse.modify || manifest.intendedUse.derivativeGeneration) &&
      rights.useProfile.modify !== "allowed"
    ) {
      reasons.push(`${asset.assetId}: modification is not explicitly allowed`);
    }
    if (
      manifest.intendedUse.commercialUse &&
      rights.useProfile.commercialUse !== "allowed"
    ) {
      reasons.push(`${asset.assetId}: commercial use is not explicitly allowed`);
    }
    if (Date.parse(rights.capturedAt) > evaluatedAtMs) {
      reasons.push(`${asset.assetId}: evaluation predates retained terms evidence`);
    }
    if (rights.reviewedAt && Date.parse(rights.reviewedAt) > evaluatedAtMs) {
      reasons.push(`${asset.assetId}: evaluation predates rights review`);
    }
    if (
      rights.reviewedAt &&
      Date.parse(rights.capturedAt) > Date.parse(rights.reviewedAt)
    ) {
      reasons.push(`${asset.assetId}: rights review predates retained terms evidence`);
    }
    if (
      rights.reviewExpiresAt &&
      Date.parse(rights.reviewExpiresAt) <= evaluatedAtMs
    ) {
      reasons.push(`${asset.assetId}: rights review is expired`);
    }
  }
  return reasons;
}

export const FrozenSurfaceProductManifestSchema = z
  .object({
    schemaVersion: SemVerSchema,
    surfaceProductId: SurfaceProductIdSchema,
    requirementId: SurfaceProductRequirementIdSchema,
    experienceId: LocalReferenceIdSchema,
    body: SurfaceBodySchema,
    state: z.literal("frozen-artifact-reviewed"),
    productKind: SurfaceProductKindSchema,
    productIdentity: ExactProductIdentitySchema,
    title: z.string().trim().min(1),
    authority: z.string().trim().min(1),
    sourceRelease: z.string().trim().min(1),
    officialRecordUrl: StrictHttpsUrlSchema,
    sourceReferenceIds: z.array(LocalReferenceIdSchema).min(1),
    retrievedAt: z.iso.datetime({ offset: true }),
    admittedAt: z.iso.datetime({ offset: true }),
    intendedUse: SurfaceIntendedUseSchema,
    representation: SurfaceRepresentationSchema,
    assets: z.array(FrozenSurfaceAssetSchema).min(2),
    metadata: SurfaceProductMetadataSchema,
    processing: SurfaceProcessingLineageSchema,
    validationReport: SurfaceValidationReportSchema,
    manifestCanonicalization: z.literal("cosmography-surface-product-json-v1"),
    manifestSha256: Sha256Schema,
    runtimeUseAllowed: z.literal(false),
    capturePlacementAllowed: z.literal(false),
    releaseEligible: z.literal(false),
  })
  .strict()
  .superRefine((manifest, context) => {
    if (!manifest.intendedUse.embedBytes || !manifest.intendedUse.metadataDisplay) {
      context.addIssue({
        code: "custom",
        path: ["intendedUse"],
        message: "A frozen runtime product must declare metadata display and embedded bytes",
      });
    }
    if (new Set(manifest.sourceReferenceIds).size !== manifest.sourceReferenceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["sourceReferenceIds"],
        message: "Surface source references must be unique",
      });
    }
    const assetIds = manifest.assets.map((asset) => asset.assetId);
    const filenames = manifest.assets.map((asset) => asset.filename.toLowerCase());
    const objectKeys = [
      ...manifest.assets.map((asset) => asset.immutableObjectKey),
      manifest.validationReport.immutableObjectKey,
    ];
    const rightsIds = manifest.assets.map((asset) => asset.rights.rightsId);
    const assetDigests = manifest.assets.map((asset) => asset.sha256);
    for (const [field, values] of [
      ["assetId", assetIds],
      ["filename", filenames],
      ["immutableObjectKey", objectKeys],
      ["rightsId", rightsIds],
      ["sha256", assetDigests],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          path: ["assets"],
          message: `Frozen surface ${field} values must be unique`,
        });
      }
    }
    if (!manifest.assets.some((asset) => asset.role === "primary-data")) {
      context.addIssue({
        code: "custom",
        path: ["assets"],
        message: "Frozen surface products need a primary data asset",
      });
    }
    if (!manifest.assets.some((asset) => asset.role === "source-label")) {
      context.addIssue({
        code: "custom",
        path: ["assets"],
        message: "Frozen surface products need an exact source-label asset",
      });
    }
    if (
      !manifest.assets.some(
        (asset) =>
          asset.role === "primary-data" &&
          asset.lineage.kind === "source-original",
      ) ||
      !manifest.assets.some(
        (asset) =>
          asset.role === "source-label" &&
          asset.lineage.kind === "source-original",
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["assets"],
        message:
          "Primary data and the exact source label must include source-original assets",
      });
    }
    if (manifest.metadata.domain === "cartographic") {
      const projectionAssets = manifest.assets.filter(
        (asset) => asset.role === "projection-definition",
      );
      if (
        projectionAssets.length !== 1 ||
        projectionAssets[0]?.sha256 !==
          manifest.metadata.projectionDefinitionSha256
      ) {
        context.addIssue({
          code: "custom",
          path: ["assets"],
          message:
            "Cartographic products require one retained projection-definition asset bound to the declared projection digest",
        });
      }
      const descriptor = `${manifest.metadata.bodyFixedFrame} ${manifest.metadata.horizontalDatum} ${manifest.metadata.projectionName}`;
      const expectedBody = manifest.body === "Mars" ? /MARS/i : /MOON|LUNAR/i;
      const wrongBody = manifest.body === "Mars" ? /MOON|LUNAR/i : /MARS/i;
      if (!expectedBody.test(descriptor) || wrongBody.test(descriptor)) {
        context.addIssue({
          code: "custom",
          path: ["metadata", "bodyFixedFrame"],
          message:
            "Cartographic frame, datum, and projection must bind the manifest body",
        });
      }
    }
    if (manifest.metadata.domain === "geometry") {
      const frameChain = manifest.metadata.frameChain.join(" ");
      const expectedBody = manifest.body === "Mars" ? /MARS/i : /MOON|LUNAR/i;
      const wrongBody = manifest.body === "Mars" ? /MOON|LUNAR/i : /MARS/i;
      if (!expectedBody.test(frameChain) || wrongBody.test(frameChain)) {
        context.addIssue({
          code: "custom",
          path: ["metadata", "frameChain"],
          message: "Geometry frame chain must bind the manifest body",
        });
      }
    }
    for (const [assetIndex, asset] of manifest.assets.entries()) {
      if (
        asset.lineage.kind === "source-original" &&
        asset.lineage.sourceProductIdentifier !== manifest.productIdentity.identifier
      ) {
        context.addIssue({
          code: "custom",
          path: ["assets", assetIndex, "lineage", "sourceProductIdentifier"],
          message:
            "Source-original asset lineage must bind the manifest's exact source product identity",
        });
      }
    }
    if (
      !manifest.processing.sourceProductIdentifiers.includes(
        manifest.productIdentity.identifier,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["processing", "sourceProductIdentifiers"],
        message:
          "Processing lineage must bind the manifest's exact source product identity",
      });
    }

    const assetsById = new Map<string, (typeof manifest.assets)[number]>(
      manifest.assets.map((asset) => [asset.assetId, asset]),
    );
    for (const asset of manifest.assets) {
      if (asset.lineage.kind !== "derived") {
        continue;
      }
      for (const parentId of asset.lineage.parentAssetIds) {
        const parent = assetsById.get(parentId);
        if (!parent || parent.assetId === asset.assetId) {
          context.addIssue({
            code: "custom",
            path: ["assets"],
            message: "Derivative lineage must reference a distinct retained parent asset",
          });
        } else if (Date.parse(parent.capturedAt) > Date.parse(asset.lineage.createdAt)) {
          context.addIssue({
            code: "custom",
            path: ["assets"],
            message: "Derivative creation cannot predate a retained parent asset",
          });
        }
      }
      if (Date.parse(asset.capturedAt) < Date.parse(asset.lineage.createdAt)) {
        context.addIssue({
          code: "custom",
          path: ["assets"],
          message: "Derived asset cannot be retained before it is created",
        });
      }
    }
    const visit = (assetId: string, path: Set<string>): boolean => {
      if (path.has(assetId)) return true;
      const asset = assetsById.get(assetId);
      if (!asset || asset.lineage.kind !== "derived") return false;
      const nextPath = new Set(path).add(assetId);
      return asset.lineage.parentAssetIds.some((parentId) => visit(parentId, nextPath));
    };
    if (assetIds.some((assetId) => visit(assetId, new Set()))) {
      context.addIssue({
        code: "custom",
        path: ["assets"],
        message: "Surface derivative lineage cannot contain a cycle",
      });
    }

    const expectedDomain: Record<
      z.infer<typeof SurfaceProductKindSchema>,
      z.infer<typeof SurfaceProductMetadataSchema>["domain"]
    > = {
      orthomosaic: "cartographic",
      "elevation-model": "cartographic",
      "confidence-mask": "cartographic",
      "terrain-mesh": "geometry",
      "source-frame-set": "recorded-media",
      "panorama-derivative": "recorded-media",
      localization: "geometry",
      "camera-calibration": "geometry",
      "traverse-vector": "geometry",
    };
    if (manifest.metadata.domain !== expectedDomain[manifest.productKind]) {
      context.addIssue({
        code: "custom",
        path: ["metadata", "domain"],
        message: "Surface product kind does not match its metadata domain",
      });
    }
    if (manifest.metadata.domain === "cartographic") {
      if (
        manifest.productKind === "elevation-model" &&
        manifest.metadata.verticalDatum.kind !== "declared"
      ) {
        context.addIssue({
          code: "custom",
          path: ["metadata", "verticalDatum"],
          message: "Elevation models require a declared vertical datum",
        });
      }
      const expectedResolutionUnit =
        manifest.productKind === "elevation-model"
          ? "metres-per-post"
          : "metres-per-pixel";
      if (manifest.metadata.resolution.unit !== expectedResolutionUnit) {
        context.addIssue({
          code: "custom",
          path: ["metadata", "resolution", "unit"],
          message: "Raster resolution unit does not match the surface product kind",
        });
      }
    }
    if (
      manifest.productKind === "panorama-derivative" &&
      manifest.metadata.domain === "recorded-media" &&
      !manifest.metadata.stitchDisclosure
    ) {
      context.addIssue({
        code: "custom",
        path: ["metadata", "stitchDisclosure"],
        message: "Panorama derivatives require an explicit stitch disclosure",
      });
    }
    const observedKinds = new Set(["orthomosaic", "source-frame-set"]);
    if (
      observedKinds.has(manifest.productKind) &&
      !["direct-observation", "calibrated-observation", "derived-result"].includes(
        manifest.representation.evidenceClass,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["representation", "evidenceClass"],
        message: "Observed imagery cannot be relabeled as reconstructed geometry",
      });
    }
    if (
      !observedKinds.has(manifest.productKind) &&
      ["direct-observation", "calibrated-observation"].includes(
        manifest.representation.evidenceClass,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["representation", "evidenceClass"],
        message: "Derived surface products cannot masquerade as observed pixels",
      });
    }
    const suppliedChecks = new Set(manifest.validationReport.checks);
    for (const requiredCheck of requiredValidationChecks(manifest.metadata)) {
      if (!suppliedChecks.has(requiredCheck)) {
        context.addIssue({
          code: "custom",
          path: ["validationReport", "checks"],
          message: `Surface validation report is missing ${requiredCheck}`,
        });
      }
    }
    const expectedDigests = new Set(manifest.assets.map((asset) => asset.sha256));
    const reportedDigests = new Set(manifest.validationReport.inputAssetSha256s);
    if (
      expectedDigests.size !== reportedDigests.size ||
      [...expectedDigests].some((digest) => !reportedDigests.has(digest))
    ) {
      context.addIssue({
        code: "custom",
        path: ["validationReport", "inputAssetSha256s"],
        message: "Validation report must bind every retained surface asset digest exactly",
      });
    }
    const retrievedAt = Date.parse(manifest.retrievedAt);
    const admittedAt = Date.parse(manifest.admittedAt);
    if (
      manifest.processing.processedAt &&
      Date.parse(manifest.processing.processedAt) > retrievedAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["processing", "processedAt"],
        message: "Declared surface processing cannot postdate product retrieval",
      });
    }
    for (const asset of manifest.assets) {
      if (Date.parse(asset.capturedAt) < retrievedAt) {
        context.addIssue({
          code: "custom",
          path: ["assets"],
          message: "Retained asset evidence cannot predate product retrieval",
        });
      }
      if (Date.parse(asset.capturedAt) > admittedAt) {
        context.addIssue({
          code: "custom",
          path: ["admittedAt"],
          message: "Surface admission cannot predate retained asset evidence",
        });
      }
    }
    const latestAssetCapture = Math.max(
      ...manifest.assets.map((asset) => Date.parse(asset.capturedAt)),
    );
    if (Date.parse(manifest.validationReport.generatedAt) < latestAssetCapture) {
      context.addIssue({
        code: "custom",
        path: ["validationReport", "generatedAt"],
        message: "Surface validation cannot predate retained asset inputs",
      });
    }
    const latestRightsEvidence = Math.max(
      ...manifest.assets.flatMap((asset) => [
        Date.parse(asset.rights.capturedAt),
        ...(asset.rights.reviewedAt
          ? [Date.parse(asset.rights.reviewedAt)]
          : []),
      ]),
    );
    if (Date.parse(manifest.validationReport.generatedAt) < latestRightsEvidence) {
      context.addIssue({
        code: "custom",
        path: ["validationReport", "generatedAt"],
        message:
          "Surface validation cannot predate retained terms evidence or its rights review",
      });
    }
    if (Date.parse(manifest.validationReport.capturedAt) > admittedAt) {
      context.addIssue({
        code: "custom",
        path: ["admittedAt"],
        message: "Surface admission cannot predate its validation report",
      });
    }
    for (const reason of rightsFailureReasons(manifest, manifest.admittedAt)) {
      context.addIssue({ code: "custom", path: ["assets"], message: reason });
    }
  });

export type FrozenSurfaceProductManifest = z.infer<
  typeof FrozenSurfaceProductManifestSchema
>;

function surfaceSelectionBinding(
  requirement: ReferenceOnlySurfaceProduct,
): unknown {
  return {
    requirementId: requirement.requirementId,
    experienceId: requirement.experienceId,
    body: requirement.body,
    productKind: requirement.productKind,
    intendedEvidenceClass: requirement.intendedEvidenceClass,
    title: requirement.title,
    authority: requirement.authority,
    sourceRelease: requirement.sourceRelease,
    officialRecordUrl: requirement.officialRecordUrl,
    sourceReferenceIds: [...requirement.sourceReferenceIds].sort(),
  };
}

function manifestSelectionBinding(
  manifest: FrozenSurfaceProductManifest,
): unknown {
  return {
    requirementId: manifest.requirementId,
    experienceId: manifest.experienceId,
    body: manifest.body,
    productKind: manifest.productKind,
    intendedEvidenceClass: manifest.representation.evidenceClass,
    title: manifest.title,
    authority: manifest.authority,
    sourceRelease: manifest.sourceRelease,
    officialRecordUrl: manifest.officialRecordUrl,
    sourceReferenceIds: [...manifest.sourceReferenceIds].sort(),
  };
}

type SurfaceValidationPayload = z.infer<
  typeof SurfaceValidationPayloadSchema
>;
type SurfaceProductVerificationContext = Pick<
  SurfaceValidationPayload,
  | "surfaceProductId"
  | "requirementId"
  | "experienceId"
  | "body"
  | "productKind"
  | "productIdentity"
  | "title"
  | "authority"
  | "sourceRelease"
  | "officialRecordUrl"
  | "sourceReferenceIds"
  | "retrievedAt"
  | "admittedAt"
>;

function surfaceProductVerificationContext(
  manifest: FrozenSurfaceProductManifest,
): SurfaceProductVerificationContext {
  return {
    surfaceProductId: manifest.surfaceProductId,
    requirementId: manifest.requirementId,
    experienceId: manifest.experienceId,
    body: manifest.body,
    productKind: manifest.productKind,
    productIdentity: manifest.productIdentity,
    title: manifest.title,
    authority: manifest.authority,
    sourceRelease: manifest.sourceRelease,
    officialRecordUrl: manifest.officialRecordUrl,
    sourceReferenceIds: manifest.sourceReferenceIds,
    retrievedAt: manifest.retrievedAt,
    admittedAt: manifest.admittedAt,
  };
}

function surfaceValidationPayload(
  manifest: FrozenSurfaceProductManifest,
): SurfaceValidationPayload {
  return SurfaceValidationPayloadSchema.parse({
    schemaVersion: manifest.schemaVersion,
    validationId: manifest.validationReport.validationId,
    ...surfaceProductVerificationContext(manifest),
    intendedUse: manifest.intendedUse,
    representation: manifest.representation,
    assets: manifest.assets,
    metadata: manifest.metadata,
    processing: manifest.processing,
    status: manifest.validationReport.status,
    generatedAt: manifest.validationReport.generatedAt,
    validatorCodeCommit: manifest.validationReport.validatorCodeCommit,
    passedChecks: manifest.validationReport.checks,
  });
}

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
      throw new TypeError("Surface canonical JSON rejects non-finite numbers");
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
  throw new TypeError(`Surface canonical JSON rejects ${typeof value}`);
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

export async function calculateSurfaceProductManifestSha256(
  input: unknown,
): Promise<string> {
  const manifest = FrozenSurfaceProductManifestSchema.parse(input);
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

export type SurfaceProductEvidence =
  | Readonly<{
      kind: "surface-asset";
      productContext: Readonly<SurfaceProductVerificationContext>;
      asset: z.infer<typeof FrozenSurfaceAssetSchema>;
      intendedUse: z.infer<typeof SurfaceIntendedUseSchema>;
    }>
  | Readonly<{
      kind: "surface-validation-report";
      productContext: Readonly<SurfaceProductVerificationContext>;
      report: z.infer<typeof SurfaceValidationReportSchema>;
      expectedPayload: Readonly<SurfaceValidationPayload>;
    }>;

export type SurfaceProductEvidenceVerifier = (
  evidence: SurfaceProductEvidence,
) => unknown | Promise<unknown>;

export type VerifiedSurfaceProductRuntimeToken = Readonly<{
  state: "surface-product-evidence-verified";
  manifest: FrozenSurfaceProductManifest;
  verifiedAt: string;
  runtimeUseAllowed: true;
  capturePlacementAllowed: false;
  releaseEligible: false;
}>;

const issuedSurfaceProductRuntimeTokens = new WeakSet<object>();

export async function verifySurfaceProductForRuntime(
  input: unknown,
  reviewedSelection: ReviewedSurfaceProductSelection,
  evaluatedAtInput: unknown,
  verifyEvidence: SurfaceProductEvidenceVerifier,
): Promise<VerifiedSurfaceProductRuntimeToken> {
  assertIssuedReviewedSurfaceProductSelection(reviewedSelection);
  const manifest = freezeRecursively(
    FrozenSurfaceProductManifestSchema.parse(input),
  );
  const evaluatedAt = z.iso.datetime({ offset: true }).parse(evaluatedAtInput);
  if (
    JSON.stringify(normalizeCanonicalJson(manifestSelectionBinding(manifest))) !==
    JSON.stringify(
      normalizeCanonicalJson(
        surfaceSelectionBinding(reviewedSelection.requirement),
      ),
    )
  ) {
    throw new Error(
      "Frozen surface product does not match its in-process reviewed requirement",
    );
  }
  if (
    JSON.stringify(normalizeCanonicalJson(manifest.productIdentity)) !==
      JSON.stringify(
        normalizeCanonicalJson(
          reviewedSelection.review.selectedProductIdentity,
        ),
      ) ||
    JSON.stringify(normalizeCanonicalJson(manifest.intendedUse)) !==
      JSON.stringify(
        normalizeCanonicalJson(
          reviewedSelection.review.approvedIntendedUse,
        ),
      )
  ) {
    throw new Error(
      "Frozen surface product identity or intended use differs from its reviewed selection",
    );
  }
  if (
    Date.parse(manifest.admittedAt) <
    Date.parse(reviewedSelection.review.reviewedAt)
  ) {
    throw new Error("Surface product admission cannot predate selection review");
  }
  const actualDigest = await calculateSurfaceProductManifestSha256(manifest);
  if (actualDigest !== manifest.manifestSha256) {
    throw new Error("Surface product does not match its canonical manifest SHA-256");
  }
  const rightsReasons = rightsFailureReasons(manifest, evaluatedAt);
  if (rightsReasons.length > 0) {
    throw new Error(`Surface product runtime use is blocked: ${rightsReasons.join("; ")}`);
  }
  const productContext = surfaceProductVerificationContext(manifest);
  const evidence: SurfaceProductEvidence[] = [
    ...manifest.assets.map((asset) => ({
      kind: "surface-asset" as const,
      productContext,
      asset,
      intendedUse: manifest.intendedUse,
    })),
    {
      kind: "surface-validation-report" as const,
      productContext,
      report: manifest.validationReport,
      expectedPayload: surfaceValidationPayload(manifest),
    },
  ];
  for (const item of freezeRecursively(evidence)) {
    const result = await verifyEvidence(item);
    if (item.kind === "surface-asset") {
      const receipt = SurfaceAssetVerificationReceiptSchema.parse(result);
      const expected = {
        assetId: item.asset.assetId,
        byteLength: item.asset.byteLength,
        sha256: item.asset.sha256,
        immutableObjectKey: item.asset.immutableObjectKey,
      };
      const actual = {
        assetId: receipt.assetId,
        byteLength: receipt.byteLength,
        sha256: receipt.sha256,
        immutableObjectKey: receipt.immutableObjectKey,
      };
      if (
        JSON.stringify(actual) !== JSON.stringify(expected) ||
        Date.parse(receipt.verifiedAt) < Date.parse(item.asset.capturedAt) ||
        Date.parse(receipt.verifiedAt) < Date.parse(manifest.admittedAt) ||
        Date.parse(receipt.verifiedAt) <
          Date.parse(reviewedSelection.review.reviewedAt) ||
        Date.parse(receipt.verifiedAt) > Date.parse(evaluatedAt)
      ) {
        throw new Error(
          `Surface asset verifier returned a drifted or non-causal receipt for ${item.asset.assetId}`,
        );
      }
      continue;
    }
    const receipt = SurfaceValidationVerificationReceiptSchema.parse(result);
    const report = item.report;
    const exactReportArtifact =
      receipt.validationId === report.validationId &&
      receipt.filename === report.filename &&
      receipt.byteLength === report.byteLength &&
      receipt.sha256 === report.sha256 &&
      receipt.immutableObjectKey === report.immutableObjectKey;
    const exactPayload =
      JSON.stringify(normalizeCanonicalJson(receipt.parsedPayload)) ===
      JSON.stringify(normalizeCanonicalJson(item.expectedPayload));
    if (
      !exactReportArtifact ||
      !exactPayload ||
      Date.parse(receipt.verifiedAt) < Date.parse(report.capturedAt) ||
      Date.parse(receipt.verifiedAt) < Date.parse(manifest.admittedAt) ||
      Date.parse(receipt.verifiedAt) <
        Date.parse(reviewedSelection.review.reviewedAt) ||
      Date.parse(receipt.verifiedAt) > Date.parse(evaluatedAt)
    ) {
      throw new Error(
        "Surface validation verifier returned a drifted, failed, or non-causal report receipt",
      );
    }
  }
  const token = freezeRecursively({
    state: "surface-product-evidence-verified" as const,
    manifest,
    verifiedAt: evaluatedAt,
    runtimeUseAllowed: true as const,
    capturePlacementAllowed: false as const,
    releaseEligible: false as const,
  });
  issuedSurfaceProductRuntimeTokens.add(token);
  return token;
}

export function canUseSurfaceProductAtRuntime(
  input: unknown,
  evaluatedAtInput?: unknown,
): boolean {
  if (
    typeof input !== "object" ||
    input === null ||
    !issuedSurfaceProductRuntimeTokens.has(input)
  ) {
    return false;
  }
  const evaluatedAt = z.iso.datetime({ offset: true }).safeParse(evaluatedAtInput);
  if (!evaluatedAt.success) {
    return false;
  }
  const token = input as VerifiedSurfaceProductRuntimeToken;
  return (
    Date.parse(evaluatedAt.data) >= Date.parse(token.verifiedAt) &&
    rightsFailureReasons(token.manifest, evaluatedAt.data).length === 0
  );
}

const WithheldSurfaceCoordinateSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("approximate-display-anchor"),
      latitudeDegrees: z.number().finite().min(-90).max(90),
      longitudeDegreesEast: z.number().finite().min(-180).max(360),
      frame: z.string().trim().min(1),
      precisionDisclosure: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      state: z.literal("unresolved"),
      reason: z.string().trim().min(1),
    })
    .strict(),
]);

export const WithheldSurfaceCaptureContextSchema = z
  .object({
    schemaVersion: SemVerSchema,
    captureContextId: CaptureContextIdSchema,
    experienceId: LocalReferenceIdSchema,
    captureNodeId: LocalReferenceIdSchema,
    body: SurfaceBodySchema,
    state: z.literal("withheld-incomplete-surface-capture"),
    reportedTime: CaptureTimeSchema,
    missionClock: z.string().trim().min(1),
    coordinate: WithheldSurfaceCoordinateSchema,
    requiredProductRequirementIds: z
      .array(SurfaceProductRequirementIdSchema)
      .min(1),
    sourceReferenceIds: z.array(LocalReferenceIdSchema).min(1),
    continuousFootageAvailable: z.literal(false),
    mediaRuntimeTokenAvailable: z.literal(false),
    localizationRuntimeTokenAvailable: z.literal(false),
    cameraCalibrationRuntimeTokenAvailable: z.literal(false),
    opticalCenterAvailable: z.literal(false),
    orientationAvailable: z.literal(false),
    terrainFrameBindingAvailable: z.literal(false),
    uncertaintyAvailable: z.literal(false),
    renderableCameraPose: z.literal(false),
    renderAllowed: z.literal(false),
    releaseEligible: z.literal(false),
    blockedReasons: z.array(z.string().trim().min(1)).min(1),
  })
  .strict()
  .superRefine((capture, context) => {
    for (const [field, values] of [
      ["requiredProductRequirementIds", capture.requiredProductRequirementIds],
      ["sourceReferenceIds", capture.sourceReferenceIds],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Withheld capture references must be unique",
        });
      }
    }
  });

export type WithheldSurfaceCaptureContext = z.infer<
  typeof WithheldSurfaceCaptureContextSchema
>;

export const SurfacePreIngestLedgerSchema = z
  .object({
    schemaVersion: SemVerSchema,
    experienceId: LocalReferenceIdSchema,
    body: SurfaceBodySchema,
    verifiedAt: z.iso.datetime({ offset: true }),
    productRequirements: z.array(ReferenceOnlySurfaceProductSchema).min(1),
    captureContexts: z.array(WithheldSurfaceCaptureContextSchema).min(1),
  })
  .strict()
  .superRefine((ledger, context) => {
    const requirementIds = ledger.productRequirements.map(
      (requirement) => requirement.requirementId,
    );
    const captureIds = ledger.captureContexts.map(
      (capture) => capture.captureContextId,
    );
    const captureNodeIds = ledger.captureContexts.map(
      (capture) => capture.captureNodeId,
    );
    for (const [field, values] of [
      ["productRequirements", requirementIds],
      ["captureContexts", captureIds],
      ["captureNodeIds", captureNodeIds],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Surface pre-ingest ledger identities must be unique",
        });
      }
    }
    const requirementIdSet = new Set(requirementIds);
    const requirementsById = new Map(
      ledger.productRequirements.map((requirement) => [
        requirement.requirementId,
        requirement,
      ]),
    );
    const capturesByNodeId = new Map(
      ledger.captureContexts.map((capture) => [capture.captureNodeId, capture]),
    );
    for (const requirement of ledger.productRequirements) {
      if (
        requirement.experienceId !== ledger.experienceId ||
        requirement.body !== ledger.body
      ) {
        context.addIssue({
          code: "custom",
          path: ["productRequirements"],
          message: "Surface requirement does not belong to its ledger",
        });
      }
      if (Date.parse(requirement.checkedAt) > Date.parse(ledger.verifiedAt)) {
        context.addIssue({
          code: "custom",
          path: ["verifiedAt"],
          message: "Surface ledger verification cannot predate source checks",
        });
      }
      for (const captureNodeId of requirement.requiredForCaptureNodeIds) {
        const capture = capturesByNodeId.get(captureNodeId);
        if (
          !capture ||
          !capture.requiredProductRequirementIds.includes(
            requirement.requirementId,
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["productRequirements"],
            message:
              "Surface requirement capture dependencies must be reciprocal",
          });
        }
      }
    }
    for (const capture of ledger.captureContexts) {
      if (capture.experienceId !== ledger.experienceId || capture.body !== ledger.body) {
        context.addIssue({
          code: "custom",
          path: ["captureContexts"],
          message: "Surface capture does not belong to its ledger",
        });
      }
      for (const requirementId of capture.requiredProductRequirementIds) {
        const requirement = requirementsById.get(requirementId);
        if (!requirementIdSet.has(requirementId) || !requirement) {
          context.addIssue({
            code: "custom",
            path: ["captureContexts"],
            message: "Surface capture references an unknown product requirement",
          });
        } else if (
          !requirement.requiredForCaptureNodeIds.includes(capture.captureNodeId)
        ) {
          context.addIssue({
            code: "custom",
            path: ["captureContexts"],
            message:
              "Surface capture product dependencies must be reciprocal",
          });
        }
      }
    }
  });

export type SurfacePreIngestLedger = z.infer<
  typeof SurfacePreIngestLedgerSchema
>;
