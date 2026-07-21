import { z } from "zod";

import {
  ManifestChecksumSchema,
  RequestChecksumSchema,
  ResponseBytesChecksumSchema,
  Sha256Schema,
  SourceIdSchema,
} from "./contracts";

export const RUNNER_POLICY_VERSION = "1.0.0";

const ReleaseIdSchema = z.string().regex(/^rel_[A-Za-z0-9._-]{1,120}$/);
const SlugSchema = z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
const HeaderNameSchema = z.string().regex(/^[a-z0-9!#$%&'*+.^_`|~-]+$/);
const StoredHeaderValueSchema = z
  .string()
  .max(8_192)
  .refine((value) => !/[\0\r\n]/.test(value), {
    message: "Transport response headers cannot contain control delimiters",
  });

export const RunnerLimitsSchema = z
  .object({
    maxUrlBytes: z.number().int().min(1).max(128 * 1024),
    maxRequestHeaderBytes: z.number().int().min(1).max(64 * 1024),
    maxRequestBodyBytes: z.number().int().min(0).max(2 * 1024 * 1024),
    maxResponseHeaderBytes: z.number().int().min(1).max(128 * 1024),
    maxResponseWireBytes: z.number().int().min(1).max(16 * 1024 * 1024),
    maxDecodedBytes: z.number().int().min(1).max(16 * 1024 * 1024),
    maxCompressionRatio: z.literal(1),
    maxRecords: z.number().int().min(1).max(1_000_000),
    connectTimeoutMs: z.number().int().min(100).max(30_000),
    headerTimeoutMs: z.number().int().min(100).max(60_000),
    totalTimeoutMs: z.number().int().min(100).max(120_000),
    maxAttempts: z.number().int().min(1).max(10),
    maxRedirects: z.literal(0),
  })
  .strict()
  .superRefine((limits, context) => {
    if (limits.maxDecodedBytes < limits.maxResponseWireBytes) {
      context.addIssue({
        code: "custom",
        path: ["maxDecodedBytes"],
        message: "Decoded-byte limit cannot be lower while compression is disabled",
      });
    }
    if (limits.totalTimeoutMs < limits.connectTimeoutMs) {
      context.addIssue({
        code: "custom",
        path: ["totalTimeoutMs"],
        message: "Total timeout must include the connection timeout",
      });
    }
    if (limits.totalTimeoutMs < limits.headerTimeoutMs) {
      context.addIssue({
        code: "custom",
        path: ["totalTimeoutMs"],
        message: "Total timeout must include the response-header timeout",
      });
    }
  });
export type RunnerLimits = z.infer<typeof RunnerLimitsSchema>;

export const DEFAULT_RUNNER_LIMITS: RunnerLimits = Object.freeze({
  maxUrlBytes: 16 * 1024,
  maxRequestHeaderBytes: 16 * 1024,
  maxRequestBodyBytes: 256 * 1024,
  maxResponseHeaderBytes: 32 * 1024,
  maxResponseWireBytes: 8 * 1024 * 1024,
  maxDecodedBytes: 8 * 1024 * 1024,
  maxCompressionRatio: 1,
  maxRecords: 100_000,
  connectTimeoutMs: 5_000,
  headerTimeoutMs: 15_000,
  totalTimeoutMs: 30_000,
  maxAttempts: 3,
  maxRedirects: 0,
});

export const RunnerPolicySchema = z
  .object({
    version: z.literal(RUNNER_POLICY_VERSION),
    requireHttps: z.literal(true),
    requirePublicAddresses: z.literal(true),
    allowCompressedResponses: z.literal(false),
    transportMode: z.literal("injected-sandbox"),
    outputNamespace: z.literal("quarantine"),
    limits: RunnerLimitsSchema,
  })
  .strict();
export type RunnerPolicy = z.infer<typeof RunnerPolicySchema>;

export const DEFAULT_RUNNER_POLICY: RunnerPolicy = Object.freeze({
  version: RUNNER_POLICY_VERSION,
  requireHttps: true,
  requirePublicAddresses: true,
  allowCompressedResponses: false,
  transportMode: "injected-sandbox",
  outputNamespace: "quarantine",
  limits: DEFAULT_RUNNER_LIMITS,
});

export const QuotaLeaseSchema = z
  .object({
    leaseId: z.string().regex(/^lease_[a-f0-9]{24}$/),
    sourceId: SourceIdSchema,
    issuedAt: z.iso.datetime({ offset: true }),
    notBefore: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    maxConcurrency: z.number().int().min(1).max(32),
  })
  .strict()
  .superRefine((lease, context) => {
    if (Date.parse(lease.notBefore) < Date.parse(lease.issuedAt)) {
      context.addIssue({
        code: "custom",
        path: ["notBefore"],
        message: "Quota lease cannot begin before it was issued",
      });
    }
    if (Date.parse(lease.expiresAt) <= Date.parse(lease.notBefore)) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Quota lease must expire after it becomes active",
      });
    }
  });
export type QuotaLease = z.infer<typeof QuotaLeaseSchema>;

export const RunnerAdmissionSchema = z
  .object({
    releaseId: ReleaseIdSchema,
    admittedAt: z.iso.datetime({ offset: true }),
    sourceEnabled: z.boolean(),
    dataRightsApproved: z.boolean(),
    auditedOverrideId: z.string().regex(/^audit_[a-f0-9]{24}$/).optional(),
    quotaLease: QuotaLeaseSchema,
    activeSourceConcurrency: z.number().int().min(0).max(31),
  })
  .strict()
  .superRefine((admission, context) => {
    if (admission.activeSourceConcurrency >= admission.quotaLease.maxConcurrency) {
      context.addIssue({
        code: "custom",
        path: ["activeSourceConcurrency"],
        message: "Quota lease has no remaining concurrency slot",
      });
    }
  });
export type RunnerAdmission = z.infer<typeof RunnerAdmissionSchema>;

const CanonicalHostnameSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .refine((value) => value === value.toLowerCase(), {
    message: "DNS attestation hostnames must be canonical lowercase values",
  });

export const DnsConnectionAttestationSchema = z
  .object({
    hostname: CanonicalHostnameSchema,
    resolvedAddresses: z.array(z.string().trim().min(2).max(64)).min(1).max(16),
    connectedAddress: z.string().trim().min(2).max(64),
    resolvedAt: z.iso.datetime({ offset: true }),
    ttlSeconds: z.number().int().min(0).max(86_400),
    tlsServerName: CanonicalHostnameSchema,
  })
  .strict()
  .superRefine((attestation, context) => {
    if (!attestation.resolvedAddresses.includes(attestation.connectedAddress)) {
      context.addIssue({
        code: "custom",
        path: ["connectedAddress"],
        message: "Connected address must be one of the attested DNS results",
      });
    }
    if (attestation.tlsServerName !== attestation.hostname) {
      context.addIssue({
        code: "custom",
        path: ["tlsServerName"],
        message: "TLS server name must retain the original canonical hostname",
      });
    }
  });
export type DnsConnectionAttestation = z.infer<
  typeof DnsConnectionAttestationSchema
>;

export const TransportResponseMetadataSchema = z
  .object({
    requestedUrl: z.url(),
    finalUrl: z.url(),
    status: z.number().int().min(100).max(599),
    headers: z
      .record(HeaderNameSchema, StoredHeaderValueSchema)
      .superRefine((headers, context) => {
        if (Object.keys(headers).length > 64) {
          context.addIssue({
            code: "custom",
            message: "Transport metadata cannot contain more than 64 headers",
          });
        }
        for (const name of Object.keys(headers)) {
          if (name !== name.toLowerCase()) {
            context.addIssue({
              code: "custom",
              path: [name],
              message: "Transport response headers must be lowercase",
            });
          }
        }
      }),
    redirectChain: z.array(z.url()).max(0),
    dns: DnsConnectionAttestationSchema,
    receivedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type TransportResponseMetadata = z.infer<
  typeof TransportResponseMetadataSchema
>;

/**
 * The core runner receives response bytes only through this injected boundary.
 * A production transport must resolve and connect to the exact attested public
 * address while retaining the original hostname for TLS verification.
 */
export interface SandboxedTransportResponse {
  readonly metadata: TransportResponseMetadata;
  readonly body: AsyncIterable<Uint8Array>;
  abort(reasonCode: string): Promise<void>;
}

export interface SandboxedTransportRequest {
  readonly method: "GET" | "POST" | "HEAD";
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly limits: RunnerLimits;
  readonly redirectMode: "error";
  readonly requirePublicAddresses: true;
  readonly signal: AbortSignal;
}

export interface ConnectorTransport {
  /**
   * Enforce connect, header, and whole-body total deadlines from request.limits.
   * The runner also checks its injected clock between chunks, but a stalled
   * promise can be cancelled only by the transport that owns the socket.
   */
  open(request: SandboxedTransportRequest): Promise<SandboxedTransportResponse>;
}

export type ConnectorTransportErrorCode =
  | "network-error"
  | "connect-timeout"
  | "header-timeout"
  | "total-timeout"
  | "dns-policy"
  | "tls-policy";

export class ConnectorTransportError extends Error {
  readonly code: ConnectorTransportErrorCode;
  readonly retryable: boolean;

  constructor(code: ConnectorTransportErrorCode, retryable: boolean) {
    super(code);
    this.name = "ConnectorTransportError";
    this.code = code;
    this.retryable = retryable;
  }
}

export interface ConnectorSecretResolver {
  resolve(envKey: string): Promise<string | undefined>;
}

export const QuarantineObjectKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(1_024)
  .refine((value) => value.startsWith("quarantine/"), {
    message: "Runner objects must remain in the quarantine namespace",
  })
  .refine(
    (value) =>
      !value.includes("\\") &&
      !value.split("/").some((segment) => segment === ".." || segment === ""),
    { message: "Quarantine object keys must be canonical relative paths" },
  );

export const ImmutableQuarantineObjectSchema = z
  .object({
    store: z.literal("r2"),
    namespace: z.literal("quarantine"),
    key: QuarantineObjectKeySchema,
    contentType: z.string().trim().min(1).max(255),
    byteLength: z.number().int().nonnegative(),
    checksum: ResponseBytesChecksumSchema,
    etag: z.string().trim().min(1).max(256).optional(),
    immutable: z.literal(true),
  })
  .strict();
export type ImmutableQuarantineObject = z.infer<
  typeof ImmutableQuarantineObjectSchema
>;

export const ImmutableQuarantineManifestObjectSchema = z
  .object({
    store: z.literal("r2"),
    namespace: z.literal("quarantine"),
    key: QuarantineObjectKeySchema,
    contentType: z.literal("application/json"),
    byteLength: z.number().int().nonnegative(),
    checksum: z
      .object({
        algorithm: z.literal("sha256"),
        value: Sha256Schema,
        scope: z.literal("record-bytes"),
      })
      .strict(),
    etag: z.string().trim().min(1).max(256).optional(),
    immutable: z.literal(true),
  })
  .strict();
export type ImmutableQuarantineManifestObject = z.infer<
  typeof ImmutableQuarantineManifestObjectSchema
>;

export class ImmutableObjectCollisionError extends Error {
  readonly code = "immutable-object-collision";

  constructor() {
    super("immutable-object-collision");
    this.name = "ImmutableObjectCollisionError";
  }
}

export interface ImmutableQuarantineWriter {
  write(chunk: Uint8Array): Promise<void>;
  commit(input: {
    readonly byteLength: number;
    readonly sha256: string;
    readonly contentType: string;
    readonly metadata: Readonly<Record<string, string>>;
  }): Promise<ImmutableQuarantineObject>;
  abort(reasonCode: string): Promise<void>;
}

export interface ImmutableQuarantineStore {
  begin(input: {
    readonly key: string;
    readonly expectedContentType: string;
    readonly metadata: Readonly<Record<string, string>>;
    readonly ifAbsent: true;
  }): Promise<ImmutableQuarantineWriter>;
  putManifest(input: {
    readonly key: string;
    readonly canonicalJson: string;
    readonly sha256: string;
    readonly ifAbsent: true;
  }): Promise<ImmutableQuarantineManifestObject>;
}

const RecordChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.enum([
      "quarantine-capture",
      "validation-report",
      "connector-run",
    ]),
  })
  .strict();

export const PersistedResponseHeadersSchema = z
  .object({
    contentType: z.string().trim().min(1).max(255).optional(),
    contentLengthRaw: z.string().trim().min(1).max(128).optional(),
    contentLength: z.number().int().nonnegative().optional(),
    contentEncoding: z.string().trim().min(1).max(128).optional(),
    contentRange: z.string().trim().min(1).max(256).optional(),
    etag: z.string().trim().min(1).max(256).optional(),
    lastModified: z.string().trim().min(1).max(256).optional(),
    upstreamDate: z.string().trim().min(1).max(256).optional(),
    retryAfter: z.string().trim().min(1).max(256).optional(),
  })
  .strict();

export const QuarantineCaptureSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    captureId: z.string().regex(/^qcap_[a-f0-9]{24}$/),
    releaseId: ReleaseIdSchema,
    admittedAt: z.iso.datetime({ offset: true }),
    quotaLeaseId: z.string().regex(/^lease_[a-f0-9]{24}$/),
    manifestId: z.string().regex(/^frm_[a-f0-9]{24}$/),
    sourceId: SourceIdSchema,
    releaseLabel: z.string().trim().min(1),
    policyVersion: z.literal(RUNNER_POLICY_VERSION),
    attempt: z.number().int().min(1).max(10),
    transportReceivedAt: z.iso.datetime({ offset: true }),
    capturedAt: z.iso.datetime({ offset: true }),
    requestChecksum: RequestChecksumSchema,
    manifestChecksum: ManifestChecksumSchema,
    httpStatus: z.number().int().min(100).max(599),
    requestedUrl: z.url(),
    finalUrl: z.url(),
    dns: DnsConnectionAttestationSchema,
    redirectChain: z.array(z.url()).max(0),
    responseHeaders: PersistedResponseHeadersSchema,
    responseChecksum: ResponseBytesChecksumSchema,
    wireByteLength: z.number().int().nonnegative(),
    decodedByteLength: z.number().int().nonnegative(),
    rawObject: ImmutableQuarantineObjectSchema,
    captureChecksum: RecordChecksumSchema.refine(
      (checksum) => checksum.scope === "quarantine-capture",
    ),
  })
  .strict()
  .superRefine((capture, context) => {
    if (
      Date.parse(capture.transportReceivedAt) < Date.parse(capture.admittedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["transportReceivedAt"],
        message: "Response receipt cannot precede runner admission",
      });
    }
    if (Date.parse(capture.capturedAt) < Date.parse(capture.transportReceivedAt)) {
      context.addIssue({
        code: "custom",
        path: ["capturedAt"],
        message: "Capture completion cannot precede response receipt",
      });
    }
    if (capture.decodedByteLength !== capture.wireByteLength) {
      context.addIssue({
        code: "custom",
        path: ["decodedByteLength"],
        message: "Decoded and wire lengths must match while compression is disabled",
      });
    }
    const rawLength = capture.responseHeaders.contentLengthRaw;
    const parsedLength = capture.responseHeaders.contentLength;
    if (
      rawLength !== undefined &&
      parsedLength !== undefined &&
      String(parsedLength) !== rawLength
    ) {
      context.addIssue({
        code: "custom",
        path: ["responseHeaders", "contentLength"],
        message: "Parsed content length must exactly match its canonical raw value",
      });
    }
  });
export type QuarantineCapture = z.infer<typeof QuarantineCaptureSchema>;

export const ValidationFindingSchema = z
  .object({
    code: SlugSchema,
    outcome: z.enum(["pass", "fail", "review-required"]),
    severity: z.enum(["blocking", "review"]),
    validator: SlugSchema,
    validatorVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    message: z.string().trim().min(1).max(1_000),
  })
  .strict()
  .superRefine((finding, context) => {
    const validPair =
      (finding.outcome === "pass" && finding.severity === "blocking") ||
      (finding.outcome === "fail" && finding.severity === "blocking") ||
      (finding.outcome === "review-required" && finding.severity === "review");
    if (!validPair) {
      context.addIssue({
        code: "custom",
        path: ["severity"],
        message: "Finding outcome and severity must use the canonical pairing",
      });
    }
  });
export type ValidationFinding = z.infer<typeof ValidationFindingSchema>;

export const QuarantineValidationReportSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    reportId: z.string().regex(/^qval_[a-f0-9]{24}$/),
    releaseId: ReleaseIdSchema,
    manifestId: z.string().regex(/^frm_[a-f0-9]{24}$/),
    captureId: z.string().regex(/^qcap_[a-f0-9]{24}$/),
    sourceId: SourceIdSchema,
    policyVersion: z.literal(RUNNER_POLICY_VERSION),
    validatedAt: z.iso.datetime({ offset: true }),
    state: z.enum(["accepted-basic", "needs-review", "rejected"]),
    findings: z.array(ValidationFindingSchema).min(1).max(128),
    captureChecksum: RecordChecksumSchema.refine(
      (checksum) => checksum.scope === "quarantine-capture",
    ),
    responseChecksum: ResponseBytesChecksumSchema,
    reportChecksum: RecordChecksumSchema.refine(
      (checksum) => checksum.scope === "validation-report",
    ),
  })
  .strict()
  .superRefine((report, context) => {
    const hasFailure = report.findings.some(
      (finding) => finding.outcome === "fail" && finding.severity === "blocking",
    );
    const hasReview = report.findings.some(
      (finding) => finding.outcome === "review-required",
    );
    if (hasFailure !== (report.state === "rejected")) {
      context.addIssue({
        code: "custom",
        path: ["state"],
        message: "Rejected validation state must exactly match blocking failures",
      });
    }
    if (!hasFailure && hasReview !== (report.state === "needs-review")) {
      context.addIssue({
        code: "custom",
        path: ["state"],
        message: "Review state must exactly match unresolved review findings",
      });
    }
    const findingKeys = report.findings.map(
      (finding) => `${finding.validator}:${finding.code}`,
    );
    if (new Set(findingKeys).size !== findingKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["findings"],
        message: "Validation findings must have unique validator/code pairs",
      });
    }
  });
export type QuarantineValidationReport = z.infer<
  typeof QuarantineValidationReportSchema
>;

const CaptureArtifactReferenceSchema = z
  .object({
    id: z.string().regex(/^qcap_[a-f0-9]{24}$/),
    object: ImmutableQuarantineManifestObjectSchema,
  })
  .strict();

const ValidationArtifactReferenceSchema = z
  .object({
    id: z.string().regex(/^qval_[a-f0-9]{24}$/),
    object: ImmutableQuarantineManifestObjectSchema,
  })
  .strict();

export const RunnerAttemptSchema = z.discriminatedUnion("state", [
  z
    .object({
      attempt: z.number().int().min(1).max(10),
      state: z.literal("captured"),
      startedAt: z.iso.datetime({ offset: true }),
      completedAt: z.iso.datetime({ offset: true }),
      httpStatus: z.number().int().min(100).max(599),
      capture: CaptureArtifactReferenceSchema,
      validation: ValidationArtifactReferenceSchema,
      validationState: z.enum(["accepted-basic", "needs-review", "rejected"]),
      retryDelayMs: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      attempt: z.number().int().min(1).max(10),
      state: z.enum(["transport-error", "aborted"]),
      startedAt: z.iso.datetime({ offset: true }),
      completedAt: z.iso.datetime({ offset: true }),
      errorCode: SlugSchema,
      retryDelayMs: z.number().int().nonnegative().optional(),
    })
    .strict(),
]);
export type RunnerAttempt = z.infer<typeof RunnerAttemptSchema>;

const RunBaseSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  runId: z.string().regex(/^run_[a-f0-9]{24}$/),
  releaseId: ReleaseIdSchema,
  manifestId: z.string().regex(/^frm_[a-f0-9]{24}$/),
  sourceId: SourceIdSchema,
  policyVersion: z.literal(RUNNER_POLICY_VERSION),
  admission: z
    .object({
      admittedAt: z.iso.datetime({ offset: true }),
      quotaLeaseId: z.string().regex(/^lease_[a-f0-9]{24}$/),
      sourceEnabled: z.boolean(),
      dataRightsApproved: z.boolean(),
      auditedOverrideId: z.string().regex(/^audit_[a-f0-9]{24}$/).optional(),
    })
    .strict(),
  startedAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }),
  attemptCount: z.number().int().min(0).max(10),
  attempts: z.array(RunnerAttemptSchema).max(10),
  runChecksum: RecordChecksumSchema.refine(
    (checksum) => checksum.scope === "connector-run",
  ),
});

export const ConnectorRunRecordSchema = z
  .discriminatedUnion("state", [
    RunBaseSchema.extend({
      state: z.literal("quarantined"),
      capture: CaptureArtifactReferenceSchema,
      validation: ValidationArtifactReferenceSchema,
      validationState: z.enum(["accepted-basic", "needs-review", "rejected"]),
    }).strict(),
    RunBaseSchema.extend({
      state: z.enum(["manual-required", "killed", "failed"]),
      errorCode: SlugSchema,
    }).strict(),
  ])
  .superRefine((run, context) => {
    if (run.attemptCount !== run.attempts.length) {
      context.addIssue({
        code: "custom",
        path: ["attemptCount"],
        message: "Run attemptCount must match the preserved attempt ledger",
      });
    }
    const ordinals = run.attempts.map(({ attempt }) => attempt);
    if (ordinals.some((attempt, index) => attempt !== index + 1)) {
      context.addIssue({
        code: "custom",
        path: ["attempts"],
        message: "Runner attempts must be complete and monotonically numbered",
      });
    }
    if (Date.parse(run.completedAt) < Date.parse(run.startedAt)) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Run completion cannot precede its start",
      });
    }
    if (
      (run.state === "manual-required" || run.state === "killed") &&
      run.attempts.length !== 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["attempts"],
        message: "Manual and killed runs cannot contain transport attempts",
      });
    }
    if (run.state === "quarantined") {
      const lastAttempt = run.attempts.at(-1);
      if (
        lastAttempt?.state !== "captured" ||
        lastAttempt.capture.id !== run.capture.id ||
        lastAttempt.capture.object.key !== run.capture.object.key ||
        lastAttempt.validation.id !== run.validation.id ||
        lastAttempt.validation.object.key !== run.validation.object.key ||
        lastAttempt.validationState !== run.validationState
      ) {
        context.addIssue({
          code: "custom",
          path: ["state"],
          message: "Quarantined run must expose its final captured attempt",
        });
      }
    }
  });
export type ConnectorRunRecord = z.infer<typeof ConnectorRunRecordSchema>;
