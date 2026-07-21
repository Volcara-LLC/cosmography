import { z } from "zod";

import {
  createSavedPlaceHref,
  SAVED_PLACE_APPEARANCES,
  SAVED_PLACE_BODY_LIMIT_BYTES,
  SAVED_PLACE_ENTITY_IDENTITIES,
  SAVED_PLACE_ENTITY_IDS,
  SAVED_PLACE_METHOD,
  SAVED_PLACE_OWNER_LIMIT,
  SAVED_PLACE_RELEASE_ID,
  SAVED_PLACE_TIMELINE_YEAR,
  SAVED_PLACE_TIMESTAMP_MAX_MS,
  SAVED_PLACE_TRUTH,
  SAVED_PLACES_SCHEMA_ID,
  SAVED_PLACES_SCHEMA_VERSION,
  type SavedPlaceAppearance,
  type SavedPlaceEntityId,
  type SavedPlaceEnvelope,
  type SavedPlaceRecord,
} from "@/app/lib/personal/saved-place-foundation";
import {
  getReleaseRegistryRecord,
  getReleaseSnapshot,
  type ReleaseRegistryRecord,
} from "@/app/lib/releases/catalog";

export {
  SAVED_PLACE_BODY_LIMIT_BYTES,
  SAVED_PLACE_OWNER_LIMIT,
  SAVED_PLACE_RELEASE_ID,
  SAVED_PLACE_TIMESTAMP_MAX_MS,
};

export const SavedPlaceEntityIdSchema = z.enum(SAVED_PLACE_ENTITY_IDS);
export const SavedPlaceAppearanceSchema = z.enum(SAVED_PLACE_APPEARANCES);
export const SavedPlaceIdSchema = z
  .string()
  .regex(/^bmk_[0-9a-f]{32}$/u);

const SavedPlaceTimestampSchema = z
  .number()
  .int()
  .positive()
  .max(SAVED_PLACE_TIMESTAMP_MAX_MS);

export const SavedPlaceInputSchema = z
  .object({
    entityId: SavedPlaceEntityIdSchema,
    appearance: SavedPlaceAppearanceSchema,
    releaseId: z.literal(SAVED_PLACE_RELEASE_ID),
  })
  .strict();

export const SavedPlaceDeleteInputSchema = z
  .object({
    id: SavedPlaceIdSchema,
    expectedSavedAtMs: SavedPlaceTimestampSchema,
  })
  .strict();

export type SavedPlaceInput = z.infer<typeof SavedPlaceInputSchema>;
export type SavedPlaceDeleteInput = z.infer<
  typeof SavedPlaceDeleteInputSchema
>;

export const SavedPlaceSceneSchema = z
  .object({
    focusId: SavedPlaceEntityIdSchema,
    appearance: SavedPlaceAppearanceSchema,
    timelineYear: z.literal(SAVED_PLACE_TIMELINE_YEAR),
    releaseId: z.literal(SAVED_PLACE_RELEASE_ID),
  })
  .strict();

export const StoredSavedPlacePayloadSchema = z
  .object({
    schemaId: z.literal(SAVED_PLACES_SCHEMA_ID),
    schemaVersion: z.literal(SAVED_PLACES_SCHEMA_VERSION),
    entityId: SavedPlaceEntityIdSchema,
    domain: z.string().min(1).max(80),
    focusId: SavedPlaceEntityIdSchema,
    appearance: SavedPlaceAppearanceSchema,
    timelineYear: z.literal(SAVED_PLACE_TIMELINE_YEAR),
    releaseId: z.literal(SAVED_PLACE_RELEASE_ID),
    savedAtMs: SavedPlaceTimestampSchema,
    method: z.literal(SAVED_PLACE_METHOD),
    truth: z
      .object({
        userConfirmed: z.literal(true),
        passiveNavigation: z.literal(false),
        navigationAidOnly: z.literal(true),
        physicalCameraPose: z.literal(false),
        observationClaim: z.literal(false),
        encounterClaim: z.literal(false),
        routeClaim: z.literal(false),
        progressClaim: z.literal(false),
        completionClaim: z.literal(false),
        masteryClaim: z.literal(false),
        achievementClaim: z.literal(false),
        scientificDiscoveryClaim: z.literal(false),
        shared: z.literal(false),
      })
      .strict(),
  })
  .strict();

const SavedPlaceEntitySchema = z
  .object({
    id: SavedPlaceEntityIdSchema,
    name: z.string().min(1).max(180),
    slug: z.string().min(1).max(120),
    kind: z.string().min(1).max(80),
    domain: z.string().min(1).max(80),
  })
  .strict();

const SavedPlaceTruthSchema = z
  .object({
    userConfirmed: z.literal(true),
    passiveNavigation: z.literal(false),
    navigationAidOnly: z.literal(true),
    physicalCameraPose: z.literal(false),
    observationClaim: z.literal(false),
    encounterClaim: z.literal(false),
    routeClaim: z.literal(false),
    progressClaim: z.literal(false),
    completionClaim: z.literal(false),
    masteryClaim: z.literal(false),
    achievementClaim: z.literal(false),
    scientificDiscoveryClaim: z.literal(false),
    shared: z.literal(false),
  })
  .strict();

export const PublicSavedPlaceSchema = z
  .object({
    id: SavedPlaceIdSchema,
    entity: SavedPlaceEntitySchema,
    scene: SavedPlaceSceneSchema,
    href: z.string().startsWith("/?").max(600),
    savedAtMs: SavedPlaceTimestampSchema,
    method: z.literal(SAVED_PLACE_METHOD),
    truth: SavedPlaceTruthSchema,
  })
  .strict();

const StoredSavedPlaceRowSchema = z
  .object({
    id: z.string(),
    contractVersion: z.literal(SAVED_PLACES_SCHEMA_VERSION),
    entityId: z.string(),
    navigationTargetId: z.string().nullable(),
    releaseId: z.string(),
    label: z.string(),
    sceneJson: z.string(),
    sceneR2Key: z.string().nullable(),
    createdAtMs: z.number(),
  })
  .strict();

export type StoredSavedPlaceRow = z.input<typeof StoredSavedPlaceRowSchema>;

export class SavedPlaceContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavedPlaceContractError";
  }
}

export class SavedPlaceRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SavedPlaceRequestError";
  }
}

function assertFoundationIdentity(
  expected: (typeof SAVED_PLACE_ENTITY_IDENTITIES)[number],
  record: ReleaseRegistryRecord | undefined,
): asserts record is ReleaseRegistryRecord {
  if (
    !record ||
    record.id !== expected.id ||
    record.name !== expected.name ||
    record.slug !== expected.slug ||
    record.kind !== expected.kind ||
    record.domain !== expected.domain
  ) {
    throw new SavedPlaceContractError(
      `Saved-place foundation identity ${expected.id} has drifted`,
    );
  }
}

export function assertSavedPlaceFoundationContract(): void {
  const snapshot = getReleaseSnapshot(SAVED_PLACE_RELEASE_ID);
  if (
    !snapshot ||
    snapshot.records.length !== SAVED_PLACE_OWNER_LIMIT ||
    SAVED_PLACE_ENTITY_IDENTITIES.length !== SAVED_PLACE_OWNER_LIMIT
  ) {
    throw new SavedPlaceContractError(
      "Saved-place foundation release has drifted",
    );
  }

  const expectedIds = new Set<string>();
  for (const identity of SAVED_PLACE_ENTITY_IDENTITIES) {
    if (expectedIds.has(identity.id)) {
      throw new SavedPlaceContractError(
        "Saved-place foundation identities must be unique",
      );
    }
    expectedIds.add(identity.id);
    assertFoundationIdentity(
      identity,
      getReleaseRegistryRecord(SAVED_PLACE_RELEASE_ID, identity.id),
    );
  }
  if (
    snapshot.records.some((record) => !expectedIds.has(record.id))
  ) {
    throw new SavedPlaceContractError(
      "Saved-place foundation release contains an unbound identity",
    );
  }
}

assertSavedPlaceFoundationContract();

export function resolveSavedPlaceEntity(
  entityId: SavedPlaceEntityId,
): ReleaseRegistryRecord {
  const record = getReleaseRegistryRecord(SAVED_PLACE_RELEASE_ID, entityId);
  const expected = SAVED_PLACE_ENTITY_IDENTITIES.find(
    (identity) => identity.id === entityId,
  );
  if (!expected) {
    throw new SavedPlaceContractError(
      `Saved-place foundation identity ${entityId} is unavailable`,
    );
  }
  assertFoundationIdentity(expected, record);
  return record;
}

export function createSavedPlaceScene(
  entityId: SavedPlaceEntityId,
  appearance: SavedPlaceAppearance,
): SavedPlaceRecord["scene"] {
  return {
    focusId: entityId,
    appearance,
    timelineYear: SAVED_PLACE_TIMELINE_YEAR,
    releaseId: SAVED_PLACE_RELEASE_ID,
  };
}

export function createSavedPlaceSceneJson(
  entityId: SavedPlaceEntityId,
  appearance: SavedPlaceAppearance,
  savedAtMs: number,
): string {
  const entity = resolveSavedPlaceEntity(entityId);
  return JSON.stringify({
    schemaId: SAVED_PLACES_SCHEMA_ID,
    schemaVersion: SAVED_PLACES_SCHEMA_VERSION,
    entityId,
    domain: entity.domain,
    focusId: entityId,
    appearance,
    timelineYear: SAVED_PLACE_TIMELINE_YEAR,
    releaseId: SAVED_PLACE_RELEASE_ID,
    savedAtMs,
    method: SAVED_PLACE_METHOD,
    truth: SAVED_PLACE_TRUTH,
  });
}

export function savedPlaceStorageValues(input: SavedPlaceInput) {
  const entity = resolveSavedPlaceEntity(input.entityId);
  return {
    entity,
    contractVersion: SAVED_PLACES_SCHEMA_VERSION,
    entityId: entity.id as SavedPlaceEntityId,
    navigationTargetId: entity.id,
    releaseId: SAVED_PLACE_RELEASE_ID,
    label: entity.name,
    sceneR2Key: null,
  } as const;
}

export function parseStoredSavedPlaceRow(
  value: unknown,
): SavedPlaceRecord {
  const rowResult = StoredSavedPlaceRowSchema.safeParse(value);
  if (!rowResult.success) {
    throw new SavedPlaceContractError("Stored saved-place row is invalid");
  }
  const row = rowResult.data;
  const idResult = SavedPlaceIdSchema.safeParse(row.id);
  const entityIdResult = SavedPlaceEntityIdSchema.safeParse(row.entityId);
  if (
    !idResult.success ||
    !entityIdResult.success ||
    row.releaseId !== SAVED_PLACE_RELEASE_ID ||
    row.sceneR2Key !== null ||
    !Number.isSafeInteger(row.createdAtMs) ||
    row.createdAtMs <= 0 ||
    row.createdAtMs > SAVED_PLACE_TIMESTAMP_MAX_MS
  ) {
    throw new SavedPlaceContractError(
      "Stored saved-place contract has drifted",
    );
  }

  const entity = resolveSavedPlaceEntity(entityIdResult.data);
  if (
    row.navigationTargetId !== entity.id ||
    row.label !== entity.name
  ) {
    throw new SavedPlaceContractError(
      "Stored saved-place navigation identity has drifted",
    );
  }

  let sceneInput: unknown;
  try {
    sceneInput = JSON.parse(row.sceneJson) as unknown;
  } catch {
    throw new SavedPlaceContractError("Stored saved-place scene is invalid");
  }
  const storedPayloadResult = StoredSavedPlacePayloadSchema.safeParse(sceneInput);
  if (
    !storedPayloadResult.success ||
    storedPayloadResult.data.entityId !== entity.id ||
    storedPayloadResult.data.domain !== entity.domain ||
    storedPayloadResult.data.focusId !== entity.id ||
    storedPayloadResult.data.savedAtMs !== row.createdAtMs ||
    row.sceneJson !==
      createSavedPlaceSceneJson(
        entityIdResult.data,
        storedPayloadResult.success
          ? storedPayloadResult.data.appearance
          : "scientific",
        row.createdAtMs,
      )
  ) {
    throw new SavedPlaceContractError(
      "Stored saved-place scene has drifted",
    );
  }

  return PublicSavedPlaceSchema.parse({
    id: idResult.data,
    entity: {
      id: entityIdResult.data,
      name: entity.name,
      slug: entity.slug,
      kind: entity.kind,
      domain: entity.domain,
    },
    scene: createSavedPlaceScene(
      entityIdResult.data,
      storedPayloadResult.data.appearance,
    ),
    href: createSavedPlaceHref(
      entity.slug,
      storedPayloadResult.data.appearance,
    ),
    savedAtMs: row.createdAtMs,
    method: SAVED_PLACE_METHOD,
    truth: SAVED_PLACE_TRUTH,
  }) as SavedPlaceRecord;
}

export function savedPlaceEnvelope<Records>(
  records: Records,
): SavedPlaceEnvelope<Records> {
  return {
    schemaId: SAVED_PLACES_SCHEMA_ID,
    schemaVersion: SAVED_PLACES_SCHEMA_VERSION,
    releaseId: SAVED_PLACE_RELEASE_ID,
    records,
  };
}

function validateJsonContentType(request: Request): void {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    throw new SavedPlaceRequestError(
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
    (/^\d+$/u.test(declaredLength) === false ||
      Number(declaredLength) > SAVED_PLACE_BODY_LIMIT_BYTES)
  ) {
    throw new SavedPlaceRequestError(
      413,
      "request_too_large",
      "The JSON request body must not exceed 4 KiB.",
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
    if (byteLength > SAVED_PLACE_BODY_LIMIT_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new SavedPlaceRequestError(
        413,
        "request_too_large",
        "The JSON request body must not exceed 4 KiB.",
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

export async function readSavedPlaceJson(request: Request): Promise<unknown> {
  validateJsonContentType(request);
  const bytes = await readBodyBytes(request);
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SavedPlaceRequestError(
      400,
      "invalid_json",
      "The request body must contain valid UTF-8 JSON.",
    );
  }
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new SavedPlaceRequestError(
      400,
      "invalid_json",
      "The request body must contain valid JSON.",
    );
  }
}

function nestedErrorIncludes(error: unknown, expected: string): boolean {
  const visited = new Set<unknown>();
  let current: unknown = error;
  while (current !== null && current !== undefined && !visited.has(current)) {
    visited.add(current);
    const message = current instanceof Error ? current.message : String(current);
    if (message.includes(expected)) return true;
    current =
      typeof current === "object" && "cause" in current
        ? (current as { cause?: unknown }).cause
        : undefined;
  }
  return false;
}

export function isSavedPlaceExistingError(error: unknown): boolean {
  return nestedErrorIncludes(error, "saved place already exists");
}
