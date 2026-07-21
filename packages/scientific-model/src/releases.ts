import { z } from "zod";

import {
  ReleaseIdSchema,
  SemVerSchema,
  Sha256Schema,
  SourceIdSchema,
} from "./ids";
import { stableJsonSha256, stableJsonStringify } from "./canonical";

export const RELEASE_CANONICALIZATION = "cosmography-stable-json-v1";

export const ReleaseStageSchema = z.enum([
  "draft",
  "validating",
  "ready",
  "published",
  "superseded",
  "withdrawn",
]);

export const ReleaseContentPointerSchema = z.discriminatedUnion("storage", [
  z
    .object({
      storage: z.literal("r2"),
      objectKey: z.string().trim().min(1).max(1024),
      sha256: Sha256Schema,
      byteLength: z.number().int().nonnegative(),
      mediaType: z.string().trim().min(1),
      recordCount: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      storage: z.literal("external-authority"),
      url: z.url(),
      authorityVersion: z.string().trim().min(1),
      sha256: Sha256Schema.optional(),
      byteLength: z.number().int().nonnegative().optional(),
      mediaType: z.string().trim().min(1).optional(),
    })
    .strict(),
]);
export type ReleaseContentPointer = z.infer<
  typeof ReleaseContentPointerSchema
>;

export const SourceSnapshotSchema = z
  .object({
    sourceId: SourceIdSchema,
    authorityVersion: z.string().trim().min(1),
    retrievedAt: z.iso.datetime({ offset: true }),
    requestOrManifestSha256: Sha256Schema,
    upstreamPublishedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export const ValidationResultSchema = z
  .object({
    validator: z.string().trim().min(1),
    validatorVersion: z.string().trim().min(1),
    status: z.enum(["passed", "failed", "waived"]),
    report: ReleaseContentPointerSchema.optional(),
    reviewedBy: z.string().trim().min(1).optional(),
    waiverReason: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.status === "waived" && !result.waiverReason) {
      context.addIssue({
        code: "custom",
        path: ["waiverReason"],
        message: "A waived validator needs a reason",
      });
    }
  });

export const ReleaseSignatureSchema = z
  .object({
    algorithm: z.enum(["Ed25519", "ECDSA-P256-SHA256"]),
    keyId: z.string().trim().min(1),
    canonicalization: z.literal(RELEASE_CANONICALIZATION),
    signatureBase64: z
      .string()
      .trim()
      .min(4)
      .regex(
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
        "Expected canonical base64 signature bytes",
      ),
  })
  .strict();

/**
 * The release control envelope is intentionally small: it identifies immutable
 * content and validation state; it does not embed catalog rows or media bytes.
 */
export const ReleaseEnvelopeSchema = z
  .object({
    releaseId: ReleaseIdSchema,
    schemaVersion: SemVerSchema,
    contentVersion: z.string().trim().min(1),
    stage: ReleaseStageSchema,
    createdAt: z.iso.datetime({ offset: true }),
    publishedAt: z.iso.datetime({ offset: true }).optional(),
    producer: z.string().trim().min(1),
    codeCommit: z.string().regex(/^[a-f0-9]{7,64}$/),
    parentReleaseIds: z.array(ReleaseIdSchema).default([]),
    rollbackTargetId: ReleaseIdSchema.optional(),
    sourceSnapshots: z.array(SourceSnapshotSchema),
    content: z.array(ReleaseContentPointerSchema).min(1),
    validation: z.array(ValidationResultSchema),
    compatibility: z
      .object({
        minimumClientVersion: SemVerSchema,
        apiVersion: SemVerSchema,
      })
      .strict(),
    signature: ReleaseSignatureSchema.optional(),
  })
  .strict()
  .superRefine((release, context) => {
    if (
      release.publishedAt !== undefined &&
      Date.parse(release.publishedAt) < Date.parse(release.createdAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Release publication cannot predate release creation",
      });
    }
  });
export type ReleaseEnvelope = z.infer<typeof ReleaseEnvelopeSchema>;

export function validateReleasePublicationPreflight(
  release: ReleaseEnvelope,
): string[] {
  if (release.stage !== "published" && release.stage !== "ready") {
    return ["Only ready or published releases can pass the publication gate"];
  }

  const issues: string[] = [];
  if (release.sourceSnapshots.length === 0) {
    issues.push("Release has no source snapshots");
  }
  if (release.validation.length === 0) {
    issues.push("Release has no validator results");
  }
  if (release.validation.some((result) => result.status !== "passed")) {
    issues.push("Release publication preflight requires every validator to pass");
  }
  if (!release.signature) {
    issues.push("Release manifest is not signed");
  }
  if (release.stage === "published" && !release.publishedAt) {
    issues.push("Published release is missing publishedAt");
  }
  return issues;
}

/** Structural preflight only; this schema never verifies signature authenticity. */
export const ReleasePublicationPreflightSchema = ReleaseEnvelopeSchema.superRefine(
  (release, context) => {
    for (const message of validateReleasePublicationPreflight(release)) {
      context.addIssue({ code: "custom", message });
    }
  },
);

export interface ReleaseEnvelopeSignatureVerifier {
  /** Resolve key purpose, validity, and revocation as of checkedAt, then verify. */
  verify(input: {
    readonly payload: string;
    readonly payloadSha256: string;
    readonly signature: z.infer<typeof ReleaseSignatureSchema>;
    readonly checkedAt: string;
  }): boolean;
}

/**
 * Verifies the envelope signature preflight. This still does not authorize an
 * active-pointer change; activation must additionally bind governance evidence.
 */
export function assertVerifiedReleaseEnvelopeSignature(
  value: unknown,
  verifier: ReleaseEnvelopeSignatureVerifier,
  checkedAtValue: string,
): asserts value is ReleaseEnvelope {
  const release = ReleasePublicationPreflightSchema.parse(value);
  const checkedAt = z.iso.datetime({ offset: true }).parse(checkedAtValue);
  if (
    Date.parse(checkedAt) < Date.parse(release.createdAt) ||
    (release.publishedAt !== undefined &&
      Date.parse(checkedAt) < Date.parse(release.publishedAt))
  ) {
    throw new Error("Release signature verification predates the release state");
  }
  const { signature, ...unsigned } = release;
  if (signature === undefined) {
    throw new Error("Release publication preflight is missing its signature");
  }
  const payload = stableJsonStringify(unsigned);
  let verified = false;
  try {
    verified = verifier.verify({
      payload,
      payloadSha256: stableJsonSha256(unsigned),
      signature,
      checkedAt,
    });
  } catch {
    verified = false;
  }
  if (!verified) {
    throw new Error("Release envelope signature is not authorized or valid");
  }
}

/** Small API payloads can be coupled to the exact release that produced them. */
export function releasedPayloadSchema<T extends z.ZodType>(payloadSchema: T) {
  return z
    .object({
      releaseId: ReleaseIdSchema,
      schemaVersion: SemVerSchema,
      payload: payloadSchema,
    })
    .strict();
}
