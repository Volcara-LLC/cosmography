import { z } from "zod";

import { EntityIdSchema, SourceIdSchema } from "./ids";

export const TimeScaleSchema = z.enum([
  "UTC",
  "TAI",
  "TT",
  "TDB",
  "TCB",
  "UT1",
]);
export type TimeScale = z.infer<typeof TimeScaleSchema>;

export const ScientificTimeRoleSchema = z.enum([
  "event",
  "observation",
  "validity",
  "source-publication",
  "ingestion",
  "cosmography-publication",
]);

const TimeUncertaintySchema = z
  .object({
    seconds: z.number().finite().nonnegative(),
    confidenceLevel: z.number().finite().min(0).max(1).optional(),
    method: z.string().trim().min(1).optional(),
  })
  .strict();

/**
 * A two-part Julian date avoids presenting one binary float as high precision.
 * `dayFraction` is always [0, 1); callers normalize before publication.
 */
export const JulianInstantSchema = z
  .object({
    kind: z.literal("julian-instant"),
    dayNumber: z.number().int(),
    dayFraction: z.number().finite().min(0).lt(1),
    scale: TimeScaleSchema,
    displayIso8601: z.string().trim().min(1).optional(),
    rawLexical: z.string().trim().min(1).optional(),
    uncertainty: TimeUncertaintySchema.optional(),
  })
  .strict();
export type JulianInstant = z.infer<typeof JulianInstantSchema>;

/** SCLK values stay uncorrelated until a cited clock-correlation product exists. */
export const SpacecraftClockInstantSchema = z
  .object({
    kind: z.literal("spacecraft-clock"),
    spacecraftId: EntityIdSchema,
    rawClock: z.string().trim().min(1),
    partition: z.number().int().nonnegative().optional(),
    correlationSourceIds: z.array(SourceIdSchema),
    uncertainty: TimeUncertaintySchema.optional(),
  })
  .strict();
export type SpacecraftClockInstant = z.infer<
  typeof SpacecraftClockInstantSchema
>;

export const ScientificInstantSchema = z.discriminatedUnion("kind", [
  JulianInstantSchema,
  SpacecraftClockInstantSchema,
]);
export type ScientificInstant = z.infer<typeof ScientificInstantSchema>;

export const ScientificIntervalSchema = z
  .object({
    kind: z.literal("interval"),
    start: ScientificInstantSchema,
    end: ScientificInstantSchema,
    startInclusive: z.boolean().default(true),
    endInclusive: z.boolean().default(true),
  })
  .strict()
  .superRefine((interval, context) => {
    if (
      interval.start.kind === "julian-instant" &&
      interval.end.kind === "julian-instant" &&
      interval.start.scale === interval.end.scale
    ) {
      const start = interval.start.dayNumber + interval.start.dayFraction;
      const end = interval.end.dayNumber + interval.end.dayFraction;
      if (end < start) {
        context.addIssue({
          code: "custom",
          path: ["end"],
          message: "Interval end precedes start in the same time scale",
        });
      }
    }
  });
export type ScientificInterval = z.infer<typeof ScientificIntervalSchema>;

export const ScientificTimeSchema = z.union([
  ScientificInstantSchema,
  ScientificIntervalSchema,
]);
export type ScientificTime = z.infer<typeof ScientificTimeSchema>;

export const DatedScientificTimeSchema = z
  .object({
    role: ScientificTimeRoleSchema,
    value: ScientificTimeSchema,
  })
  .strict();
export type DatedScientificTime = z.infer<typeof DatedScientificTimeSchema>;
