import { z } from "zod";

import {
  AssertionIdSchema,
  EntityIdSchema,
  SourceIdSchema,
} from "./ids";
import { ScientificTimeSchema } from "./time";

export const EvidenceClassSchema = z.enum([
  "direct-observation",
  "calibrated-observation",
  "catalog-measurement",
  "derived-result",
  "scientific-reconstruction",
  "physics-simulation",
  "artist-interpretation",
]);
export type EvidenceClass = z.infer<typeof EvidenceClassSchema>;

export const NullReasonSchema = z.enum([
  "not-observed",
  "not-applicable",
  "below-detection-limit",
  "withheld-by-source",
  "invalid-source-value",
  "unknown",
]);

export const NumericUncertaintySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("symmetric"),
      plusMinus: z.number().finite().nonnegative(),
      confidenceLevel: z.number().finite().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("asymmetric"),
      minus: z.number().finite().nonnegative(),
      plus: z.number().finite().nonnegative(),
      confidenceLevel: z.number().finite().min(0).max(1).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("covariance"),
      dimension: z.number().int().min(1).max(12),
      lowerTriangle: z.array(z.number().finite()),
      confidenceLevel: z.number().finite().min(0).max(1).optional(),
    })
    .strict()
    .superRefine((value, context) => {
      const expected = (value.dimension * (value.dimension + 1)) / 2;
      if (value.lowerTriangle.length !== expected) {
        context.addIssue({
          code: "custom",
          path: ["lowerTriangle"],
          message: `Expected ${expected} lower-triangle covariance values`,
        });
      }
    }),
  z
    .object({
      kind: z.literal("not-provided"),
      reason: z.string().trim().min(1),
    })
    .strict(),
]);
export type NumericUncertainty = z.infer<typeof NumericUncertaintySchema>;

const QuantityValueSchema = z
  .object({
    valueKind: z.literal("quantity"),
    value: z.number().finite(),
    unit: z.string().trim().min(1),
    semanticQuantity: z.string().trim().min(1),
    rawLexical: z.string().trim().min(1).optional(),
    sourceUnit: z.string().trim().min(1).optional(),
    uncertainty: NumericUncertaintySchema,
  })
  .strict();

const TextValueSchema = z
  .object({
    valueKind: z.literal("text"),
    value: z.string(),
    language: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).optional(),
  })
  .strict();

const BooleanValueSchema = z
  .object({
    valueKind: z.literal("boolean"),
    value: z.boolean(),
  })
  .strict();

const CategoryValueSchema = z
  .object({
    valueKind: z.literal("category"),
    code: z.string().trim().min(1),
    vocabulary: z.string().trim().min(1),
    label: z.string().trim().min(1).optional(),
  })
  .strict();

const EntityReferenceValueSchema = z
  .object({
    valueKind: z.literal("entity-reference"),
    entityId: EntityIdSchema,
  })
  .strict();

const TimeValueSchema = z
  .object({
    valueKind: z.literal("scientific-time"),
    value: ScientificTimeSchema,
  })
  .strict();

const NullValueSchema = z
  .object({
    valueKind: z.literal("null"),
    reason: NullReasonSchema,
    detail: z.string().trim().min(1).optional(),
  })
  .strict();

/** Strict discriminated variants prevent two incompatible values in one assertion. */
export const AssertionValueSchema = z.discriminatedUnion("valueKind", [
  QuantityValueSchema,
  TextValueSchema,
  BooleanValueSchema,
  CategoryValueSchema,
  EntityReferenceValueSchema,
  TimeValueSchema,
  NullValueSchema,
]);
export type AssertionValue = z.infer<typeof AssertionValueSchema>;

export const AssertionStateSchema = z.enum([
  "proposed",
  "reviewed",
  "published",
  "superseded",
  "withdrawn",
]);

export const ScientificAssertionSchema = z
  .object({
    assertionId: AssertionIdSchema,
    subjectId: EntityIdSchema,
    predicate: z
      .string()
      .regex(/^[a-z][a-z0-9_-]*:[A-Za-z0-9._-]+$/, "Expected a CURIE-like predicate"),
    value: AssertionValueSchema,
    evidenceClass: EvidenceClassSchema,
    method: z.string().trim().min(1),
    sourceIds: z.array(SourceIdSchema).min(1),
    sourceField: z.string().trim().min(1).optional(),
    observedAt: ScientificTimeSchema.optional(),
    validAt: ScientificTimeSchema.optional(),
    qualityFlags: z.array(z.string().trim().min(1)).default([]),
    state: AssertionStateSchema,
    preferredByRule: z.string().trim().min(1).optional(),
    supersedes: z.array(AssertionIdSchema).default([]),
  })
  .strict();
export type ScientificAssertion = z.infer<typeof ScientificAssertionSchema>;
