import { z } from "zod";

import {
  AtlasNavigationIdSchema,
  EvidenceClassSchema,
  ScaleDomainSchema,
  type AtlasEntity,
} from "@/app/lib/science/scene";

export const GUIDED_TOUR_SCHEMA_VERSION = "1.0.0" as const;
export const GUIDED_TOUR_NAVIGATION_MODE = "semantic-navigation" as const;
export const GUIDED_TOUR_ADVANCE_MODE = "manual" as const;
export const GUIDED_TOUR_VIEWPORT_REPRESENTATION =
  "procedural-scientific-display-context" as const;

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

const ReleaseIdSchema = z
  .string()
  .regex(/^rel_[a-z0-9][a-z0-9_-]{5,126}$/);
const TourIdSchema = z
  .string()
  .regex(/^tour_[a-z0-9][a-z0-9_]{5,126}$/);
const RepresentationIdSchema = z
  .string()
  .regex(/^rep-[a-z0-9][a-z0-9-]{1,118}$/);
const SourceIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,119}$/);

export const GuidedTourAuthoritySchema = z
  .object({
    artifactBytesAdmitted: z.literal(false),
    poseAuthorityEstablished: z.literal(false),
    sourceAuthenticityEstablished: z.literal(false),
    rightsClearanceEstablished: z.literal(false),
    scientificValidationEstablished: z.literal(false),
    independentValidationEstablished: z.literal(false),
    completenessEstablished: z.literal(false),
    runtimeUseAllowed: z.literal(false),
    renderAllowed: z.literal(false),
    publicationAllowed: z.literal(false),
    releaseEligible: z.literal(false),
    activationAllowed: z.literal(false),
  })
  .strict();

export const GUIDED_TOUR_NO_AUTHORITY = deepFreeze({
  artifactBytesAdmitted: false,
  poseAuthorityEstablished: false,
  sourceAuthenticityEstablished: false,
  rightsClearanceEstablished: false,
  scientificValidationEstablished: false,
  independentValidationEstablished: false,
  completenessEstablished: false,
  runtimeUseAllowed: false,
  renderAllowed: false,
  publicationAllowed: false,
  releaseEligible: false,
  activationAllowed: false,
} as const);

export const GuidedTourStopSchema = z
  .object({
    ordinal: z.number().int().positive(),
    id: AtlasNavigationIdSchema,
    title: z.string().trim().min(1).max(120),
    scaleLabel: z.string().trim().min(1).max(160),
    targetEntityId: AtlasNavigationIdSchema,
    domain: ScaleDomainSchema,
    representationId: RepresentationIdSchema,
    sourceIds: z.array(SourceIdSchema).min(1),
    evidenceClass: EvidenceClassSchema,
    narrative: z.string().trim().min(1).max(1_200),
    learningPrompt: z.string().trim().min(1).max(500),
    boundaryStatement: z.string().trim().min(1).max(800),
  })
  .strict()
  .superRefine((stop, context) => {
    if (new Set(stop.sourceIds).size !== stop.sourceIds.length) {
      context.addIssue({
        code: "custom",
        message: "A guided-tour stop cannot bind the same source twice",
        path: ["sourceIds"],
      });
    }
  });

export const GuidedTourSchema = z
  .object({
    schemaVersion: z.literal(GUIDED_TOUR_SCHEMA_VERSION),
    id: TourIdSchema,
    slug: AtlasNavigationIdSchema,
    title: z.string().trim().min(1).max(160),
    subtitle: z.string().trim().min(1).max(240),
    summary: z.string().trim().min(1).max(1_200),
    releaseId: ReleaseIdSchema,
    navigationMode: z.literal(GUIDED_TOUR_NAVIGATION_MODE),
    advanceMode: z.literal(GUIDED_TOUR_ADVANCE_MODE),
    physicalJourneyClaim: z.literal(false),
    autoAdvance: z.literal(false),
    viewportRepresentation: z.literal(
      GUIDED_TOUR_VIEWPORT_REPRESENTATION,
    ),
    authority: GuidedTourAuthoritySchema,
    stops: z.array(GuidedTourStopSchema).min(1).max(32),
  })
  .strict()
  .superRefine((tour, context) => {
    const stopIds = new Set<string>();
    const targetEntityIds = new Set<string>();

    for (const [index, stop] of tour.stops.entries()) {
      const expectedOrdinal = index + 1;
      if (stop.ordinal !== expectedOrdinal) {
        context.addIssue({
          code: "custom",
          message: `Stop ordinal must be ${expectedOrdinal} at this position`,
          path: ["stops", index, "ordinal"],
        });
      }
      if (stopIds.has(stop.id)) {
        context.addIssue({
          code: "custom",
          message: "Guided-tour stop identifiers must be unique",
          path: ["stops", index, "id"],
        });
      }
      if (targetEntityIds.has(stop.targetEntityId)) {
        context.addIssue({
          code: "custom",
          message: "A release-bound tour cannot repeat a target entity",
          path: ["stops", index, "targetEntityId"],
        });
      }
      stopIds.add(stop.id);
      targetEntityIds.add(stop.targetEntityId);
    }
  });

export type GuidedTourStop = z.infer<typeof GuidedTourStopSchema>;
export type GuidedTour = z.infer<typeof GuidedTourSchema>;
export type GuidedTourInput = z.input<typeof GuidedTourSchema>;

export type GuidedTourAtlasBinding = Readonly<{
  releaseId: string;
  entities: readonly AtlasEntity[];
}>;

export class GuidedTourContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuidedTourContractError";
  }
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

export function assertGuidedTourAtlasBindings(
  tour: GuidedTour,
  binding: GuidedTourAtlasBinding,
): void {
  if (tour.releaseId !== binding.releaseId) {
    throw new GuidedTourContractError(
      `Guided tour ${tour.id} is not bound to release ${binding.releaseId}`,
    );
  }

  const entitiesById = new Map<string, AtlasEntity>();
  for (const entity of binding.entities) {
    if (entitiesById.has(entity.id)) {
      throw new GuidedTourContractError(
        `Release ${binding.releaseId} contains duplicate entity ${entity.id}`,
      );
    }
    entitiesById.set(entity.id, entity);
  }

  for (const stop of tour.stops) {
    const entity = entitiesById.get(stop.targetEntityId);
    if (!entity) {
      throw new GuidedTourContractError(
        `Guided-tour stop ${stop.id} targets an entity absent from release ${binding.releaseId}`,
      );
    }
    if (stop.domain !== entity.domain) {
      throw new GuidedTourContractError(
        `Guided-tour stop ${stop.id} has drifted from entity domain ${entity.domain}`,
      );
    }
    if (stop.representationId !== entity.representation.id) {
      throw new GuidedTourContractError(
        `Guided-tour stop ${stop.id} has drifted from representation ${entity.representation.id}`,
      );
    }
    if (stop.evidenceClass !== entity.representation.evidence) {
      throw new GuidedTourContractError(
        `Guided-tour stop ${stop.id} has drifted from evidence class ${entity.representation.evidence}`,
      );
    }

    const currentSourceIds = entity.sources.map((source) => source.id);
    if (!sameOrderedValues(stop.sourceIds, currentSourceIds)) {
      throw new GuidedTourContractError(
        `Guided-tour stop ${stop.id} has drifted from its ordered release source bindings`,
      );
    }
  }
}

export function createGuidedTour(
  input: unknown,
  binding: GuidedTourAtlasBinding,
): GuidedTour {
  const parsed = GuidedTourSchema.parse(input);
  assertGuidedTourAtlasBindings(parsed, binding);
  return deepFreeze(parsed);
}

export class GuidedTourOrdinalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuidedTourOrdinalError";
  }
}

export function parseGuidedTourOrdinal(
  value: unknown,
  stopCount: number,
): number {
  if (!Number.isSafeInteger(stopCount) || stopCount < 1) {
    throw new GuidedTourOrdinalError(
      "Guided-tour stop count must be a positive safe integer",
    );
  }
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    throw new GuidedTourOrdinalError(
      "Guided-tour ordinal must be a canonical positive integer string",
    );
  }

  const ordinal = Number(value);
  if (!Number.isSafeInteger(ordinal) || ordinal > stopCount) {
    throw new GuidedTourOrdinalError(
      "Guided-tour ordinal is outside the release-bound stop range",
    );
  }
  return ordinal;
}

export function createGuidedTourLocationSearch(
  tour: GuidedTour,
  ordinal: number,
  currentSearch = "",
): string {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > tour.stops.length) {
    throw new GuidedTourOrdinalError(
      "Cannot create a guided-tour location for an out-of-range stop",
    );
  }
  const stop = tour.stops[ordinal - 1];
  const current = new URLSearchParams(currentSearch);
  const params = new URLSearchParams();
  const appearance = current.get("appearance");
  if (appearance === "scientific" || appearance === "immersive") {
    params.set("appearance", appearance);
  }
  params.set("tour", tour.slug);
  params.set("step", String(ordinal));
  params.set("focus", stop.targetEntityId);
  params.set("release", tour.releaseId);
  return params.toString();
}
