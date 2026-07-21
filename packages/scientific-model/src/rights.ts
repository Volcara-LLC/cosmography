import { z } from "zod";

import {
  AssetIdSchema,
  RepresentationIdSchema,
  RightsIdSchema,
  SourceIdSchema,
} from "./ids";

export const PermissionDecisionSchema = z.enum([
  "allowed",
  "prohibited",
  "requires-permission",
  "unknown",
]);

export const RightsUseProfileSchema = z
  .object({
    display: PermissionDecisionSchema,
    redistribute: PermissionDecisionSchema,
    modify: PermissionDecisionSchema,
    commercialUse: PermissionDecisionSchema,
  })
  .strict();

export const LicenseBasisSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("public-domain"),
      jurisdiction: z.string().trim().min(1),
      rationale: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("spdx"),
      identifier: z.string().trim().min(1),
      licenseUrl: z.url(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("custom-terms"),
      termsUrl: z.url(),
      termsSnapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
      summary: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("restricted"),
      reason: z.string().trim().min(1),
      permissionContact: z.string().trim().min(1).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("unknown"),
      reason: z.string().trim().min(1),
    })
    .strict(),
]);

export const RightsTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("asset"), assetId: AssetIdSchema }).strict(),
  z
    .object({
      kind: z.literal("representation"),
      representationId: RepresentationIdSchema,
    })
    .strict(),
  z.object({ kind: z.literal("source"), sourceId: SourceIdSchema }).strict(),
]);

/** A reviewed use decision; this schema is not a substitute for legal advice. */
export const RightsStatementSchema = z
  .object({
    rightsId: RightsIdSchema,
    target: RightsTargetSchema,
    basis: LicenseBasisSchema,
    useProfile: RightsUseProfileSchema,
    creator: z.string().trim().min(1).optional(),
    rightsHolder: z.string().trim().min(1).optional(),
    creditLine: z.string().trim().min(1),
    requiredNotices: z.array(z.string().trim().min(1)).default([]),
    sourceTermsUrl: z.url().optional(),
    capturedAt: z.iso.datetime({ offset: true }),
    reviewStatus: z.enum(["unreviewed", "reviewed", "expired", "disputed"]),
    reviewedBy: z.string().trim().min(1).optional(),
    reviewedAt: z.iso.datetime({ offset: true }).optional(),
    reviewExpiresAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine((statement, context) => {
    if (statement.reviewStatus === "reviewed" && !statement.reviewedAt) {
      context.addIssue({
        code: "custom",
        path: ["reviewedAt"],
        message: "A reviewed rights statement needs a review timestamp",
      });
    }
  });
export type RightsStatement = z.infer<typeof RightsStatementSchema>;

export function canPublishAsset(
  statement: RightsStatement,
  options: { commercial: boolean; redistribute: boolean },
): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (statement.reviewStatus !== "reviewed") {
    reasons.push("Rights statement has not passed review");
  }
  if (statement.useProfile.display !== "allowed") {
    reasons.push("Display permission is not explicitly allowed");
  }
  if (
    options.redistribute &&
    statement.useProfile.redistribute !== "allowed"
  ) {
    reasons.push("Redistribution permission is not explicitly allowed");
  }
  if (
    options.commercial &&
    statement.useProfile.commercialUse !== "allowed"
  ) {
    reasons.push("Commercial use is not explicitly allowed");
  }
  return { allowed: reasons.length === 0, reasons };
}
