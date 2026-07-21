import { z } from "zod";
import {
  normalizeSpacecraftDisplayName,
  spacecraftDisplayNameIssue,
} from "./spacecraft-display-name";

export const SPACECRAFT_SCHEMA_ID = "cosmography.user-spacecraft" as const;
export const SPACECRAFT_SCHEMA_VERSION = "1.0.0" as const;
export const SPACECRAFT_OWNER_LIMIT = 24;
export const SPACECRAFT_REQUEST_BODY_LIMIT_BYTES = 8 * 1024;

export const SpacecraftIdSchema = z.string().regex(/^ship_[0-9a-f]{32}$/);
export const SpacecraftProfileSchema = z.enum([
  "fusion-0.1c",
  "fictional-warp",
]);
export const SpacecraftAppearanceSchema = z
  .object({
    schemaId: z.literal("cosmography.user-spacecraft.appearance"),
    schemaVersion: z.literal("1.0.0"),
    hullPreset: z.enum([
      "pearl",
      "graphite",
      "mars-copper",
      "lunar-silver",
    ]),
    accentPreset: z.enum(["cyan", "gold", "verdant", "ember"]),
    insignia: z.enum(["none", "orbit", "star", "horizon"]),
  })
  .strict();

export type SpacecraftProfile = z.infer<typeof SpacecraftProfileSchema>;
export type SpacecraftAppearance = z.infer<typeof SpacecraftAppearanceSchema>;

export const SpacecraftDisplayNameSchema = z
  .string()
  .superRefine((value, context) => {
    const issue = spacecraftDisplayNameIssue(value);
    if (issue === "forbidden-characters") {
      context.addIssue({
        code: "custom",
        message: "Display names cannot contain control or bidirectional formatting characters",
      });
    }
    if (issue === "invalid-length") {
      context.addIssue({
        code: "custom",
        message: "Display names must contain between 1 and 80 characters",
      });
    }
  })
  .transform(normalizeSpacecraftDisplayName);

export const SpacecraftCreateInputSchema = z
  .object({
    displayName: SpacecraftDisplayNameSchema,
    profile: SpacecraftProfileSchema,
    appearance: SpacecraftAppearanceSchema,
  })
  .strict();

export const SpacecraftPatchInputSchema = z
  .object({
    expectedUpdatedAtMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    displayName: SpacecraftDisplayNameSchema.optional(),
    appearance: SpacecraftAppearanceSchema.optional(),
  })
  .strict()
  .refine(
    ({ displayName, appearance }) =>
      displayName !== undefined || appearance !== undefined,
    { message: "At least one mutable field is required" },
  );

export type SpacecraftPatchInput = z.output<typeof SpacecraftPatchInputSchema>;

export function spacecraftPatchChangesRecord(
  current: Pick<PublicSpacecraft, "displayName" | "appearance">,
  patch: SpacecraftPatchInput,
): boolean {
  const nextDisplayName = patch.displayName ?? current.displayName;
  const nextAppearance = patch.appearance ?? current.appearance;
  return (
    nextDisplayName !== current.displayName ||
    nextAppearance.schemaId !== current.appearance.schemaId ||
    nextAppearance.schemaVersion !== current.appearance.schemaVersion ||
    nextAppearance.hullPreset !== current.appearance.hullPreset ||
    nextAppearance.accentPreset !== current.appearance.accentPreset ||
    nextAppearance.insignia !== current.appearance.insignia
  );
}

const OmittedPhysicsSchema = z.tuple([
  z.literal("acceleration"),
  z.literal("deceleration"),
  z.literal("energy"),
  z.literal("route-geometry"),
  z.literal("mission-constraints"),
  z.literal("traveler-frame-time"),
  z.literal("relativistic-observer-effects"),
]);

const PropulsionAuthoritySchema = z.object({
  personalConcept: z.literal(true),
  comparisonOnly: z.literal(true),
  availableVehicle: z.literal(false),
  actualJourneyClaim: z.literal(false),
  missionPlan: z.literal(false),
  trajectoryClaim: z.literal(false),
  telemetryClaim: z.literal(false),
  scientificValidation: z.literal(false),
});

const FusionDefinitionSchema = PropulsionAuthoritySchema.extend({
  schemaId: z.literal("cosmography.propulsion-model"),
  schemaVersion: z.literal("1.0.0"),
  profile: z.literal("fusion-0.1c"),
  compatibleTravelMode: z.literal("fusion"),
  truthClass: z.literal("hypothetical-physical"),
  speedFractionOfC: z.literal(0.1),
  fictional: z.literal(false),
  counterfactual: z.literal(true),
  disclosure: z.literal(
    "Hypothetical constant 0.1c comparison only; no available spacecraft or mission is claimed.",
  ),
  omittedPhysics: OmittedPhysicsSchema,
}).strict();

const WarpDefinitionSchema = PropulsionAuthoritySchema.extend({
  schemaId: z.literal("cosmography.propulsion-model"),
  schemaVersion: z.literal("1.0.0"),
  profile: z.literal("fictional-warp"),
  compatibleTravelMode: z.literal("warp"),
  truthClass: z.literal("fictional-only"),
  speedFractionOfC: z.null(),
  fictional: z.literal(true),
  counterfactual: z.literal(false),
  disclosure: z.literal(
    "Fictional story concept only; no scientific duration, available spacecraft, or mission is claimed.",
  ),
  omittedPhysics: OmittedPhysicsSchema,
}).strict();

export const SpacecraftPropulsionDefinitionSchema = z.discriminatedUnion(
  "profile",
  [FusionDefinitionSchema, WarpDefinitionSchema],
);

type PropulsionDefinition = z.infer<
  typeof SpacecraftPropulsionDefinitionSchema
>;

type PropulsionModelContract = {
  id: string;
  code: SpacecraftProfile;
  version: "1.0.0";
  modelClass: "hypothetical-physical" | "fictional-only";
  title: string;
  distanceDefinition: "source-distance-light-years" | "fictional-only";
  evidenceClass: "physics-simulation" | "artist-interpretation";
  citationAssertionId: null;
};

export const SPACECRAFT_PROPULSION_MODELS = {
  "fusion-0.1c": {
    id: "prop_concept_fusion_0_1c_v1",
    code: "fusion-0.1c",
    version: "1.0.0",
    modelClass: "hypothetical-physical",
    title: "Fusion 0.1c concept",
    distanceDefinition: "source-distance-light-years",
    evidenceClass: "physics-simulation",
    citationAssertionId: null,
  },
  "fictional-warp": {
    id: "prop_concept_warp_fiction_v1",
    code: "fictional-warp",
    version: "1.0.0",
    modelClass: "fictional-only",
    title: "Fictional warp concept",
    distanceDefinition: "fictional-only",
    evidenceClass: "artist-interpretation",
    citationAssertionId: null,
  },
} as const satisfies Record<SpacecraftProfile, PropulsionModelContract>;

const StoredPropulsionModelRowSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    version: z.string(),
    modelClass: z.string(),
    title: z.string(),
    distanceDefinition: z.string(),
    definitionJson: z.string().min(2).max(8_192),
    evidenceClass: z.string(),
    citationAssertionId: z.string().nullable(),
  })
  .strict();

export type StoredPropulsionModelRow = z.input<
  typeof StoredPropulsionModelRowSchema
>;

export type VerifiedPropulsionModel = {
  id: string;
  label: string;
  profile: SpacecraftProfile;
  definition: PropulsionDefinition;
};

export class SpacecraftContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpacecraftContractError";
  }
}

function parseJson(value: string, contractName: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new SpacecraftContractError(`${contractName} contains invalid JSON`);
  }
}

export function verifyPropulsionModelRow(
  value: unknown,
): VerifiedPropulsionModel {
  const rowResult = StoredPropulsionModelRowSchema.safeParse(value);
  if (!rowResult.success) {
    throw new SpacecraftContractError("Stored propulsion model row is invalid");
  }
  const row = rowResult.data;
  const definitionResult = SpacecraftPropulsionDefinitionSchema.safeParse(
    parseJson(row.definitionJson, "Stored propulsion model definition"),
  );
  if (!definitionResult.success) {
    throw new SpacecraftContractError("Stored propulsion model definition has drifted");
  }
  const definition = definitionResult.data;
  const expected = SPACECRAFT_PROPULSION_MODELS[definition.profile];
  if (
    row.id !== expected.id ||
    row.code !== expected.code ||
    row.version !== expected.version ||
    row.modelClass !== expected.modelClass ||
    row.title !== expected.title ||
    row.distanceDefinition !== expected.distanceDefinition ||
    row.evidenceClass !== expected.evidenceClass ||
    row.citationAssertionId !== expected.citationAssertionId
  ) {
    throw new SpacecraftContractError("Stored propulsion model metadata has drifted");
  }
  return {
    id: row.id,
    label: row.title,
    profile: definition.profile,
    definition,
  };
}

const StoredSpacecraftRowSchema = z
  .object({
    id: SpacecraftIdSchema,
    displayName: z.string(),
    propulsionModelId: z.string(),
    cosmeticsJson: z.string().min(2).max(2_048),
    createdAtMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    updatedAtMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    modelId: z.string().nullable(),
    modelCode: z.string().nullable(),
    modelVersion: z.string().nullable(),
    modelClass: z.string().nullable(),
    modelTitle: z.string().nullable(),
    modelDistanceDefinition: z.string().nullable(),
    modelDefinitionJson: z.string().nullable(),
    modelEvidenceClass: z.string().nullable(),
    modelCitationAssertionId: z.string().nullable(),
  })
  .strict();

export type StoredSpacecraftRow = z.input<typeof StoredSpacecraftRowSchema>;

export type PublicSpacecraft = {
  id: string;
  displayName: string;
  profile: SpacecraftProfile;
  appearance: SpacecraftAppearance;
  propulsion: {
    id: string;
    label: string;
    truthClass: "hypothetical-physical" | "fictional-only";
    summary: string;
    speedFractionOfC: 0.1 | null;
    fictional: boolean;
    counterfactual: boolean;
    personalConcept: true;
    comparisonOnly: true;
    availableVehicle: false;
    actualJourneyClaim: false;
    missionPlan: false;
    trajectoryClaim: false;
    telemetryClaim: false;
    scientificValidation: false;
  };
  createdAtMs: number;
  updatedAtMs: number;
};

export function parseStoredSpacecraftRow(value: unknown): PublicSpacecraft {
  const rowResult = StoredSpacecraftRowSchema.safeParse(value);
  if (!rowResult.success) {
    throw new SpacecraftContractError("Stored spacecraft row is invalid");
  }
  const row = rowResult.data;
  if (row.createdAtMs > row.updatedAtMs) {
    throw new SpacecraftContractError("Stored spacecraft timestamps are invalid");
  }
  const displayNameResult = SpacecraftDisplayNameSchema.safeParse(row.displayName);
  if (!displayNameResult.success || displayNameResult.data !== row.displayName) {
    throw new SpacecraftContractError("Stored spacecraft display name is invalid");
  }
  const appearanceResult = SpacecraftAppearanceSchema.safeParse(
    parseJson(row.cosmeticsJson, "Stored spacecraft appearance"),
  );
  if (!appearanceResult.success) {
    throw new SpacecraftContractError("Stored spacecraft appearance has drifted");
  }
  const model = verifyPropulsionModelRow({
    id: row.modelId,
    code: row.modelCode,
    version: row.modelVersion,
    modelClass: row.modelClass,
    title: row.modelTitle,
    distanceDefinition: row.modelDistanceDefinition,
    definitionJson: row.modelDefinitionJson,
    evidenceClass: row.modelEvidenceClass,
    citationAssertionId: row.modelCitationAssertionId,
  });
  if (row.propulsionModelId !== model.id) {
    throw new SpacecraftContractError("Stored spacecraft model association is invalid");
  }
  const definition = model.definition;
  return {
    id: row.id,
    displayName: row.displayName,
    profile: model.profile,
    appearance: appearanceResult.data,
    propulsion: {
      id: model.id,
      label: model.label,
      truthClass: definition.truthClass,
      summary: definition.disclosure,
      speedFractionOfC: definition.speedFractionOfC,
      fictional: definition.fictional,
      counterfactual: definition.counterfactual,
      personalConcept: definition.personalConcept,
      comparisonOnly: definition.comparisonOnly,
      availableVehicle: definition.availableVehicle,
      actualJourneyClaim: definition.actualJourneyClaim,
      missionPlan: definition.missionPlan,
      trajectoryClaim: definition.trajectoryClaim,
      telemetryClaim: definition.telemetryClaim,
      scientificValidation: definition.scientificValidation,
    },
    createdAtMs: row.createdAtMs,
    updatedAtMs: row.updatedAtMs,
  };
}

export function spacecraftEnvelope<T>(records: T) {
  return {
    schemaId: SPACECRAFT_SCHEMA_ID,
    schemaVersion: SPACECRAFT_SCHEMA_VERSION,
    records,
  };
}

export class SpacecraftRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SpacecraftRequestError";
  }
}

function validateJsonContentType(request: Request): void {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    throw new SpacecraftRequestError(
      415,
      "json_content_type_required",
      "Content-Type must be application/json.",
    );
  }
}

async function readBodyBytes(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    (/^\d+$/.test(declaredLength) === false ||
      Number(declaredLength) > SPACECRAFT_REQUEST_BODY_LIMIT_BYTES)
  ) {
    throw new SpacecraftRequestError(
      413,
      "request_too_large",
      "The JSON request body must not exceed 8 KiB.",
    );
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > SPACECRAFT_REQUEST_BODY_LIMIT_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new SpacecraftRequestError(
        413,
        "request_too_large",
        "The JSON request body must not exceed 8 KiB.",
      );
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readSpacecraftJson(request: Request): Promise<unknown> {
  validateJsonContentType(request);
  const bytes = await readBodyBytes(request);
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SpacecraftRequestError(
      400,
      "invalid_json",
      "The request body must contain valid UTF-8 JSON.",
    );
  }
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new SpacecraftRequestError(
      400,
      "invalid_json",
      "The request body must contain valid JSON.",
    );
  }
}

export function isSpacecraftQuotaError(error: unknown): boolean {
  const visited = new Set<unknown>();
  let current: unknown = error;
  while (current !== null && current !== undefined && !visited.has(current)) {
    visited.add(current);
    const message = current instanceof Error ? current.message : String(current);
    if (message.includes("durable spacecraft owner quota exceeded")) return true;
    current =
      typeof current === "object" && "cause" in current
        ? (current as { cause?: unknown }).cause
        : undefined;
  }
  return false;
}
