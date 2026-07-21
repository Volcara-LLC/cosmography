import { z } from "zod";

import { atlasEntities, atlasRelease } from "@/app/data/atlas";
import {
  FOUNDATION_BUNDLE_SHA256,
  FOUNDATION_MANIFEST_SHA256,
  FOUNDATION_RELEASE_ID,
} from "@/app/lib/releases/foundation-identity";
import { AtlasNavigationIdSchema } from "@/app/lib/science/scene";

export const FLIGHT_DECK_DISTANCE_PROJECTION_VERSION =
  "foundation-flight-deck-distance-v1" as const;

const SOURCE_DISTANCE_MEANING =
  "The frozen input is copied from this foundation destination record and linked to its named record sources. Field-level ingestion lineage is not yet available; this is a source-distance comparison input, not a route length.";
const OBSERVER_ORIGIN_MEANING =
  "The Solar System is the Flight Deck observer origin, so its frozen comparison input is 0 light-years. This coordinate definition is not a physical route or elapsed journey.";

const SourceIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,119}$/);

export const FlightDeckDistanceBindingSchema = z
  .object({
    projectionVersion: z.literal(FLIGHT_DECK_DISTANCE_PROJECTION_VERSION),
    releaseId: z.literal(FOUNDATION_RELEASE_ID),
    releaseManifestSha256: z.literal(FOUNDATION_MANIFEST_SHA256),
    releaseContentSha256: z.literal(FOUNDATION_BUNDLE_SHA256),
    entityId: AtlasNavigationIdSchema,
    distanceLightYears: z.number().finite().nonnegative(),
    distanceLabel: z.string().trim().min(1),
    basis: z.enum([
      "foundation-destination-record",
      "observer-origin-definition",
    ]),
    recordSourceIds: z.array(SourceIdSchema),
    fieldLevelIngestionLineageAvailable: z.literal(false),
    straightLineRouteClaim: z.literal(false),
    scientificMeaning: z.string(),
  })
  .strict()
  .superRefine((binding, context) => {
    const isOrigin = binding.basis === "observer-origin-definition";
    const expectedMeaning = isOrigin
      ? OBSERVER_ORIGIN_MEANING
      : SOURCE_DISTANCE_MEANING;
    if (isOrigin !== (binding.distanceLightYears === 0)) {
      context.addIssue({
        code: "custom",
        path: ["basis"],
        message: "Only the zero-distance observer origin may use the origin definition",
      });
    }
    if (!isOrigin && binding.recordSourceIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["recordSourceIds"],
        message: "A non-origin distance input needs destination-record sources",
      });
    }
    if (new Set(binding.recordSourceIds).size !== binding.recordSourceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["recordSourceIds"],
        message: "Destination-record source identifiers must be unique",
      });
    }
    if (binding.scientificMeaning !== expectedMeaning) {
      context.addIssue({
        code: "custom",
        path: ["scientificMeaning"],
        message: "Scientific meaning must preserve the canonical authority boundary",
      });
    }
  });

export type FlightDeckDistanceBinding = Readonly<
  z.infer<typeof FlightDeckDistanceBindingSchema>
>;

export class FlightDeckDistanceContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlightDeckDistanceContractError";
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function sameOrderedValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function createFlightDeckDistanceProjection(
  value: unknown,
): readonly FlightDeckDistanceBinding[] {
  const parsed = FlightDeckDistanceBindingSchema.array().parse(value);
  const expectedEntities = atlasEntities.filter(
    (entity) => entity.routeDistanceFromSunLy !== undefined,
  );
  if (
    parsed.length !== expectedEntities.length ||
    new Set(parsed.map((binding) => binding.entityId)).size !== parsed.length
  ) {
    throw new FlightDeckDistanceContractError(
      "Flight Deck distance projection must cover every numeric destination exactly once",
    );
  }

  const expectedById = new Map(
    expectedEntities.map((entity) => [entity.id, entity]),
  );
  for (const binding of parsed) {
    const entity = expectedById.get(binding.entityId);
    if (!entity || entity.routeDistanceFromSunLy === undefined) {
      throw new FlightDeckDistanceContractError(
        `Flight Deck distance projection contains unknown destination ${binding.entityId}`,
      );
    }
    const expectedBasis =
      entity.routeDistanceFromSunLy === 0
        ? "observer-origin-definition"
        : "foundation-destination-record";
    if (
      binding.releaseId !== atlasRelease.id ||
      binding.distanceLightYears !== entity.routeDistanceFromSunLy ||
      binding.distanceLabel !== entity.distanceLabel ||
      binding.basis !== expectedBasis ||
      !sameOrderedValues(
        binding.recordSourceIds,
        entity.sources.map((source) => source.id),
      )
    ) {
      throw new FlightDeckDistanceContractError(
        `Flight Deck distance binding for ${binding.entityId} has drifted from release ${atlasRelease.id}`,
      );
    }
  }

  return deepFreeze(parsed);
}

const input = atlasEntities
  .filter(
    (entity): entity is typeof entity & { routeDistanceFromSunLy: number } =>
      entity.routeDistanceFromSunLy !== undefined,
  )
  .map((entity) => ({
    projectionVersion: FLIGHT_DECK_DISTANCE_PROJECTION_VERSION,
    releaseId: atlasRelease.id,
    releaseManifestSha256: FOUNDATION_MANIFEST_SHA256,
    releaseContentSha256: FOUNDATION_BUNDLE_SHA256,
    entityId: entity.id,
    distanceLightYears: entity.routeDistanceFromSunLy,
    distanceLabel: entity.distanceLabel,
    basis:
      entity.routeDistanceFromSunLy === 0
        ? ("observer-origin-definition" as const)
        : ("foundation-destination-record" as const),
    recordSourceIds: entity.sources.map((source) => source.id),
    fieldLevelIngestionLineageAvailable: false as const,
    straightLineRouteClaim: false as const,
    scientificMeaning:
      entity.routeDistanceFromSunLy === 0
        ? OBSERVER_ORIGIN_MEANING
        : SOURCE_DISTANCE_MEANING,
  }));

if (atlasRelease.id !== FOUNDATION_RELEASE_ID) {
  throw new Error("Flight Deck distance projection is bound to a different release");
}

export const flightDeckDistanceBindings: readonly FlightDeckDistanceBinding[] =
  createFlightDeckDistanceProjection(input);

const flightDeckDistanceByEntityId = new Map(
  flightDeckDistanceBindings.map((binding) => [binding.entityId, binding]),
);

export function getFlightDeckDistanceBinding(
  entityId: string,
): FlightDeckDistanceBinding | undefined {
  return flightDeckDistanceByEntityId.get(entityId);
}
