import { z } from "zod";

import {
  AssertionIdSchema,
  EntityIdSchema,
  RouteIdSchema,
  SourceIdSchema,
  TrajectoryIdSchema,
} from "./ids";
import { JulianInstantSchema } from "./time";

const DistanceUncertaintySchema = z
  .object({
    minus: z.number().finite().nonnegative(),
    plus: z.number().finite().nonnegative(),
    confidenceLevel: z.number().finite().min(0).max(1).optional(),
  })
  .strict();

export const MetricDistanceSchema = z
  .object({
    kind: z.literal("metric-distance"),
    value: z.number().finite().nonnegative(),
    unit: z.enum(["m", "km", "au", "ly", "pc", "kpc", "Mpc", "Gpc"]),
    semanticMeasure: z.enum([
      "euclidean-separation",
      "path-length",
      "light-travel-distance",
    ]),
    frameId: z.string().trim().min(1),
    centerId: EntityIdSchema.optional(),
    epoch: JulianInstantSchema,
    uncertainty: DistanceUncertaintySchema,
    sourceAssertionIds: z.array(AssertionIdSchema).min(1),
  })
  .strict();

export const CosmologyModelSchema = z
  .object({
    name: z.string().trim().min(1),
    hubbleKmPerSecondPerMpc: z.number().finite().positive(),
    omegaMatter: z.number().finite().nonnegative(),
    omegaLambda: z.number().finite().nonnegative(),
    omegaRadiation: z.number().finite().nonnegative().optional(),
    referenceSourceIds: z.array(SourceIdSchema).min(1),
  })
  .strict();

export const CosmologicalDistanceSchema = z
  .object({
    kind: z.literal("cosmological-distance"),
    measure: z.enum([
      "comoving-radial",
      "proper-at-epoch",
      "luminosity",
      "angular-diameter",
      "lookback-light-travel",
    ]),
    valueMpc: z.number().finite().nonnegative(),
    redshift: z.number().finite().nonnegative().optional(),
    model: CosmologyModelSchema,
    uncertainty: DistanceUncertaintySchema,
    sourceAssertionIds: z.array(AssertionIdSchema).min(1),
  })
  .strict();

export const DistanceDefinitionSchema = z.discriminatedUnion("kind", [
  MetricDistanceSchema,
  CosmologicalDistanceSchema,
]);
export type DistanceDefinition = z.infer<typeof DistanceDefinitionSchema>;

const ScientificTravelSchema = z
  .object({
    domain: z.literal("scientific"),
    mechanism: z.enum([
      "photon",
      "chemical-propulsion",
      "electric-propulsion",
      "solar-sail",
      "nuclear-propulsion-scenario",
      "measured-spacecraft-trajectory",
    ]),
    scenarioBasis: z.enum([
      "physical-limit",
      "measured-history",
      "published-mission-plan",
      "declared-physical-scenario",
    ]),
    cruiseFractionOfC: z.number().finite().positive().max(1).optional(),
    trajectoryId: TrajectoryIdSchema.optional(),
    sourceIds: z.array(SourceIdSchema),
    assumptions: z.array(z.string().trim().min(1)).min(1),
    publicLabel: z.string().trim().min(3),
  })
  .strict();

const FictionalWarpTravelSchema = z
  .object({
    domain: z.literal("fictional"),
    mechanism: z.literal("warp"),
    scientificClaim: z.literal(false),
    gameplayLightYearsPerSecond: z.number().finite().positive(),
    publicLabel: z.string().trim().min(3),
    disclaimer: z.string().trim().min(10),
  })
  .strict();

const NavigationJumpSchema = z
  .object({
    domain: z.literal("navigation"),
    mechanism: z.literal("instant-map-jump"),
    scientificClaim: z.literal(false),
    publicLabel: z.string().trim().min(3),
    disclaimer: z.string().trim().min(10),
  })
  .strict();

export const TravelDefinitionSchema = z.discriminatedUnion("domain", [
  ScientificTravelSchema,
  FictionalWarpTravelSchema,
  NavigationJumpSchema,
]);
export type TravelDefinition = z.infer<typeof TravelDefinitionSchema>;

export const TravelDurationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("scientific-duration"),
      seconds: z.number().finite().nonnegative(),
      uncertaintySeconds: z.number().finite().nonnegative(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("gameplay-duration"),
      seconds: z.number().finite().nonnegative(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("not-computable"),
      reason: z.string().trim().min(1),
    })
    .strict(),
]);

export const RouteDefinitionSchema = z
  .object({
    routeId: RouteIdSchema,
    originId: EntityIdSchema,
    destinationId: EntityIdSchema,
    distance: DistanceDefinitionSchema.optional(),
    travel: TravelDefinitionSchema,
    duration: TravelDurationSchema,
    waypoints: z.array(EntityIdSchema).default([]),
  })
  .strict()
  .superRefine((route, context) => {
    if (
      route.travel.domain === "scientific" &&
      route.duration.kind === "gameplay-duration"
    ) {
      context.addIssue({
        code: "custom",
        path: ["duration"],
        message: "Scientific travel cannot use a gameplay duration",
      });
    }
    if (
      route.travel.domain === "fictional" &&
      route.duration.kind === "scientific-duration"
    ) {
      context.addIssue({
        code: "custom",
        path: ["duration"],
        message: "Fictional warp cannot be presented as a scientific duration",
      });
    }
    if (
      route.travel.domain === "navigation" &&
      route.duration.kind !== "not-computable"
    ) {
      context.addIssue({
        code: "custom",
        path: ["duration"],
        message: "An instant map jump is navigation, not a physical duration",
      });
    }
  });
export type RouteDefinition = z.infer<typeof RouteDefinitionSchema>;

export function validatePublishableTravel(
  travel: TravelDefinition,
): string[] {
  const issues: string[] = [];
  if (travel.domain === "scientific") {
    if (travel.mechanism === "photon" && travel.cruiseFractionOfC !== 1) {
      issues.push("Photon travel must declare cruiseFractionOfC exactly 1");
    }
    if (
      ["measured-history", "published-mission-plan"].includes(
        travel.scenarioBasis,
      ) &&
      travel.sourceIds.length === 0
    ) {
      issues.push("Measured history and mission plans must cite a source");
    }
    if (
      travel.mechanism === "measured-spacecraft-trajectory" &&
      !travel.trajectoryId
    ) {
      issues.push("Measured spacecraft travel requires a trajectory ID");
    }
  } else if (!/fiction|imaginar|map|game/i.test(travel.publicLabel)) {
    issues.push("Non-scientific travel must be plainly labeled for the public");
  }
  return issues;
}

export const PublishableTravelDefinitionSchema =
  TravelDefinitionSchema.superRefine((travel, context) => {
    for (const message of validatePublishableTravel(travel)) {
      context.addIssue({ code: "custom", message });
    }
  });
