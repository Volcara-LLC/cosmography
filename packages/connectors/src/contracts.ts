import { z } from "zod";

export const SourceIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type SourceId = z.infer<typeof SourceIdSchema>;

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const ProtocolSchema = z.enum([
  "http-artifact",
  "horizons",
  "pds-search",
  "pdap",
  "tap",
  "mast-invoke",
  "ned-rest",
  "manual-review",
]);

export const SourceLifecycleSchema = z.enum([
  "active",
  "access-restricted",
  "manual-only",
  "scheduled",
  "deprecated",
]);

export const DocumentationLinkSchema = z
  .object({
    title: z.string().trim().min(1),
    url: z.url(),
    role: z.enum([
      "service-docs",
      "data-model",
      "rights",
      "status",
      "citation",
      "landing-page",
    ]),
  })
  .strict();

export const EndpointSchema = z
  .object({
    id: z.string().trim().min(1),
    protocol: ProtocolSchema,
    baseUrl: z.url(),
    readOnly: z.literal(true),
    browserSafe: z.boolean(),
    notes: z.string().trim().min(1).optional(),
  })
  .strict();

export const SyncCadenceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("interval"),
      every: z.iso.duration(),
      basis: z.literal("cosmography-policy"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("release-driven"),
      pollEvery: z.iso.duration(),
      basis: z.literal("cosmography-policy"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("on-demand"),
      basis: z.literal("cosmography-policy"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("manual"),
      reviewEvery: z.iso.duration(),
      basis: z.literal("cosmography-policy"),
    })
    .strict(),
]);

export const SyncPolicySchema = z
  .object({
    mode: z.enum([
      "on-demand",
      "incremental",
      "release-snapshot",
      "append-only",
      "manual-snapshot",
    ]),
    cadence: SyncCadenceSchema,
    cursorKinds: z.array(
      z.enum([
        "none",
        "search-after",
        "offset",
        "time-watermark",
        "tap-uws",
        "opaque",
        "release",
      ]),
    ),
    immutableReleaseSnapshots: z.boolean(),
  })
  .strict();

export const AuthPolicySchema = z
  .object({
    mode: z.enum([
      "none",
      "optional-account",
      "interactive-account",
      "bearer-token",
    ]),
    secretEnv: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .optional(),
    dataRightsRequired: z.boolean(),
    notes: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((auth, context) => {
    if (auth.mode === "bearer-token" && !auth.secretEnv) {
      context.addIssue({
        code: "custom",
        path: ["secretEnv"],
        message: "Bearer-token authentication requires an environment reference",
      });
    }
    if (auth.mode === "none" && auth.secretEnv) {
      context.addIssue({
        code: "custom",
        path: ["secretEnv"],
        message: "Anonymous sources cannot name a secret",
      });
    }
  });

export const QuotaPolicySchema = z
  .object({
    publicationStatus: z.enum([
      "published",
      "partially-published",
      "not-published",
    ]),
    sourceLimitNotes: z.string().trim().min(1),
    localMaxConcurrency: z.number().int().min(1).max(32),
    localMinDelayMs: z.number().int().nonnegative(),
    localMaxRowsPerRequest: z.number().int().positive().optional(),
    prohibitUnboundedQueries: z.literal(true),
  })
  .strict();

export const RightsPolicySchema = z
  .object({
    publicMetadataAccess: z.boolean(),
    dataUse: z.enum([
      "public-with-attribution",
      "source-specific",
      "account-gated",
      "data-rights-gated",
      "unknown-review-required",
    ]),
    redistribution: z.enum([
      "permitted-with-attribution",
      "source-specific-review",
      "permission-required",
      "unknown-review-required",
    ]),
    termsUrl: z.url(),
    acknowledgement: z.string().trim().min(1),
    reviewBeforePublication: z.boolean(),
  })
  .strict();

export const FreshnessPolicySchema = z
  .object({
    targetLag: z.iso.duration(),
    staleAfter: z.iso.duration(),
    upstreamTimestampField: z.string().trim().min(1).optional(),
    clock: z.literal("UTC"),
  })
  .strict();

export const RetryPolicySchema = z
  .object({
    maxAttempts: z.number().int().min(1).max(10),
    strategy: z.enum(["none", "exponential"]),
    initialDelayMs: z.number().int().nonnegative(),
    maxDelayMs: z.number().int().nonnegative(),
    jitter: z.enum(["none", "full"]),
    retryHttpStatuses: z.array(z.number().int().min(400).max(599)),
    retryNetworkErrors: z.boolean(),
    honorRetryAfter: z.boolean(),
  })
  .strict()
  .superRefine((policy, context) => {
    if (policy.maxDelayMs < policy.initialDelayMs) {
      context.addIssue({
        code: "custom",
        path: ["maxDelayMs"],
        message: "maxDelayMs must be at least initialDelayMs",
      });
    }
  });

export const KillSwitchPolicySchema = z
  .object({
    envKey: z.string().regex(/^COSMOGRAPHY_SOURCE_[A-Z0-9_]+_ENABLED$/),
    defaultEnabled: z.boolean(),
    circuitBreakerFailures: z.number().int().positive(),
    cooldown: z.iso.duration(),
    manualOverrideAudited: z.literal(true),
  })
  .strict();

/**
 * D1 is the small control plane only. The literal false makes it impossible for
 * a valid passport to declare D1 as a bulk-payload destination.
 */
export const StoragePolicySchema = z
  .object({
    controlPlaneStore: z.literal("d1"),
    controlPlaneMayContain: z.array(
      z.enum([
        "source-passport",
        "cursor",
        "run-status",
        "checksum",
        "object-pointer",
        "normalized-small-metadata",
      ]),
    ),
    bulkScienceDataInD1: z.literal(false),
    bulkPayloadStores: z
      .array(z.enum(["r2", "external-authority", "specialized-service"]))
      .min(1),
  })
  .strict();

export const ReleaseStateSchema = z
  .object({
    label: z.string().trim().min(1),
    state: z.enum([
      "current",
      "preview",
      "scheduled",
      "superseded",
      "not-applicable",
    ]),
    effectiveAt: z.iso.datetime({ offset: true }).optional(),
    notes: z.string().trim().min(1),
  })
  .strict();

export const SourcePassportSchema = z
  .object({
    sourceId: SourceIdSchema,
    displayName: z.string().trim().min(1),
    authority: z.string().trim().min(1),
    agencyNeutralGroup: z.enum([
      "planetary-geometry",
      "planetary-archive",
      "astronomy-catalog",
      "mission-registry",
    ]),
    registryTier: z.enum(["core", "optional"]),
    lifecycle: SourceLifecycleSchema,
    checkedOn: z.iso.date(),
    endpoints: z.array(EndpointSchema).min(1),
    documentation: z.array(DocumentationLinkSchema).min(1),
    sync: SyncPolicySchema,
    auth: AuthPolicySchema,
    quota: QuotaPolicySchema,
    rights: RightsPolicySchema,
    freshness: FreshnessPolicySchema,
    retry: RetryPolicySchema,
    killSwitch: KillSwitchPolicySchema,
    storage: StoragePolicySchema,
    releaseState: z.array(ReleaseStateSchema).default([]),
    operationalNotes: z.array(z.string().trim().min(1)).default([]),
  })
  .strict()
  .superRefine((passport, context) => {
    if (
      ["access-restricted", "manual-only", "scheduled"].includes(
        passport.lifecycle,
      ) &&
      passport.killSwitch.defaultEnabled
    ) {
      context.addIssue({
        code: "custom",
        path: ["killSwitch", "defaultEnabled"],
        message: "Restricted, manual, and scheduled sources must default off",
      });
    }
    const endpointIds = passport.endpoints.map((endpoint) => endpoint.id);
    if (new Set(endpointIds).size !== endpointIds.length) {
      context.addIssue({
        code: "custom",
        path: ["endpoints"],
        message: "Endpoint ids must be unique within a passport",
      });
    }
  });
export type SourcePassport = z.infer<typeof SourcePassportSchema>;

export const CursorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z
    .object({
      kind: z.literal("search-after"),
      sortFields: z.array(z.string().trim().min(1)).min(1),
      value: z.array(z.union([z.string(), z.number()])),
    })
    .strict(),
  z
    .object({ kind: z.literal("offset"), offset: z.number().int().nonnegative() })
    .strict(),
  z
    .object({
      kind: z.literal("time-watermark"),
      value: z.iso.datetime({ offset: true }),
      inclusive: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("tap-uws"),
      jobUrl: z.url(),
      phase: z.enum([
        "PENDING",
        "QUEUED",
        "EXECUTING",
        "COMPLETED",
        "ERROR",
        "ABORTED",
      ]),
    })
    .strict(),
  z
    .object({ kind: z.literal("opaque"), value: z.string().min(1) })
    .strict(),
  z
    .object({ kind: z.literal("release"), label: z.string().trim().min(1) })
    .strict(),
]);
export type Cursor = z.infer<typeof CursorSchema>;

const SecretHeaderNames = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "x-api-key",
]);

export const SafeHeadersSchema = z
  .record(z.string().trim().min(1), z.string())
  .superRefine((headers, context) => {
    for (const name of Object.keys(headers)) {
      if (SecretHeaderNames.has(name.toLowerCase())) {
        context.addIssue({
          code: "custom",
          path: [name],
          message: "Frozen manifests cannot contain credential-bearing headers",
        });
      }
    }
  });

export const AuthReferenceSchema = z
  .object({
    mode: z.enum(["none", "interactive-account", "bearer-env"]),
    envKey: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .optional(),
  })
  .strict()
  .superRefine((auth, context) => {
    if (auth.mode === "bearer-env" && !auth.envKey) {
      context.addIssue({
        code: "custom",
        path: ["envKey"],
        message: "A bearer reference must identify its environment variable",
      });
    }
    if (auth.mode !== "bearer-env" && auth.envKey) {
      context.addIssue({
        code: "custom",
        path: ["envKey"],
        message: "Only bearer references may identify a secret environment variable",
      });
    }
  });

const ExpectedMediaTypeSchema = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .refine((value) => value.split(";", 1)[0]?.trim() !== "*/*", {
    message: "Frozen response media types cannot use an unconstrained wildcard",
  });

export const HttpRequestSchema = z
  .object({
    kind: z.literal("http"),
    method: z.enum(["GET", "POST", "HEAD"]),
    url: z.url(),
    headers: SafeHeadersSchema,
    body: z.string().optional(),
    auth: AuthReferenceSchema,
    expectedMediaTypes: z.array(ExpectedMediaTypeSchema).min(1),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.method === "GET" && request.body !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["body"],
        message: "GET manifests cannot include a body",
      });
    }
  });

export const ManualRequestSchema = z
  .object({
    kind: z.literal("manual"),
    reviewUrl: z.url(),
    instructions: z.string().trim().min(1),
    auth: AuthReferenceSchema,
    expectedCapture: z.enum([
      "document-index",
      "release-metadata",
      "account-export",
    ]),
  })
  .strict();

export const FrozenRequestSchema = z.discriminatedUnion("kind", [
  HttpRequestSchema,
  ManualRequestSchema,
]);

const checksumFields = {
  algorithm: z.literal("sha256"),
  value: Sha256Schema,
} as const;

export const RequestChecksumSchema = z
  .object({ ...checksumFields, scope: z.literal("request") })
  .strict();
export const ManifestChecksumSchema = z
  .object({ ...checksumFields, scope: z.literal("manifest") })
  .strict();
export const ResponseBytesChecksumSchema = z
  .object({ ...checksumFields, scope: z.literal("response-bytes") })
  .strict();
export const UncompressedPayloadChecksumSchema = z
  .object({ ...checksumFields, scope: z.literal("uncompressed-payload") })
  .strict();

export const ChecksumSchema = z.discriminatedUnion("scope", [
  RequestChecksumSchema,
  ManifestChecksumSchema,
  ResponseBytesChecksumSchema,
  UncompressedPayloadChecksumSchema,
]);

export const PayloadDestinationSchema = z
  .object({
    payloadClass: z.enum([
      "control-metadata",
      "normalized-small-metadata",
      "bulk-science",
      "binary-media",
    ]),
    payloadStore: z.enum([
      "d1",
      "r2",
      "external-authority",
      "specialized-service",
    ]),
    controlPointerStore: z.literal("d1"),
    objectKey: z.string().trim().min(1).max(1024).optional(),
  })
  .strict()
  .superRefine((destination, context) => {
    if (
      ["bulk-science", "binary-media"].includes(destination.payloadClass) &&
      destination.payloadStore === "d1"
    ) {
      context.addIssue({
        code: "custom",
        path: ["payloadStore"],
        message: "Bulk science data and media must never be stored in D1",
      });
    }
    if (destination.payloadStore === "r2" && !destination.objectKey) {
      context.addIssue({
        code: "custom",
        path: ["objectKey"],
        message: "R2 destinations require an object key",
      });
    }
  });

export const FrozenRequestManifestSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    manifestId: z.string().regex(/^frm_[a-f0-9]{24}$/),
    sourceId: SourceIdSchema,
    adapterVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    releaseLabel: z.string().trim().min(1),
    frozenAt: z.iso.datetime({ offset: true }),
    intent: z.record(z.string(), z.unknown()),
    request: FrozenRequestSchema,
    cursorIn: CursorSchema,
    destination: PayloadDestinationSchema,
    retry: RetryPolicySchema,
    freshness: FreshnessPolicySchema,
    requestChecksum: RequestChecksumSchema,
    expectedResponseChecksum: ResponseBytesChecksumSchema.optional(),
    manifestChecksum: ManifestChecksumSchema,
  })
  .strict();
export type FrozenRequestManifest = z.infer<
  typeof FrozenRequestManifestSchema
>;

export const FreezeContextSchema = z
  .object({
    frozenAt: z.iso.datetime({ offset: true }),
    releaseLabel: z.string().trim().min(1),
    cursorIn: CursorSchema.default({ kind: "none" }),
    destination: PayloadDestinationSchema,
  })
  .strict();
export type FreezeContext = z.input<typeof FreezeContextSchema>;

export const IngestionReceiptSchema = z
  .object({
    manifestId: z.string().regex(/^frm_[a-f0-9]{24}$/),
    sourceId: SourceIdSchema,
    startedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }),
    status: z.enum(["succeeded", "empty", "failed", "killed"]),
    responseChecksum: ResponseBytesChecksumSchema.optional(),
    byteLength: z.number().int().nonnegative().optional(),
    recordCount: z.number().int().nonnegative().optional(),
    cursorOut: CursorSchema.optional(),
    payloadPointer: z
      .object({
        store: z.enum(["r2", "external-authority", "specialized-service"]),
        keyOrUrl: z.string().trim().min(1),
      })
      .strict()
      .optional(),
    errorCode: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((receipt, context) => {
    if (Date.parse(receipt.completedAt) < Date.parse(receipt.startedAt)) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "completedAt cannot be earlier than startedAt",
      });
    }
    if (receipt.status === "failed" && !receipt.errorCode) {
      context.addIssue({
        code: "custom",
        path: ["errorCode"],
        message: "Failed ingestion receipts require an error code",
      });
    }
    if (
      ["succeeded", "empty"].includes(receipt.status) &&
      !receipt.responseChecksum
    ) {
      context.addIssue({
        code: "custom",
        path: ["responseChecksum"],
        message:
          "Succeeded and empty ingestion receipts require a response-bytes checksum",
      });
    }
  });
export type IngestionReceipt = z.infer<typeof IngestionReceiptSchema>;
