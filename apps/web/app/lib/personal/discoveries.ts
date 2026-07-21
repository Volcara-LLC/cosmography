import { z } from "zod";

import { getReleaseRegistryRecord } from "@/app/lib/releases/catalog";

export const RECORDED_ENCOUNTERS_SCHEMA_ID =
  "cosmography.user-recorded-encounters" as const;
export const RECORDED_ENCOUNTERS_SCHEMA_VERSION = "1.0.0" as const;
export const RECORDED_ENCOUNTER_METHOD = "manual-atlas-record" as const;
export const RECORDED_ENCOUNTER_RELEASE_ID =
  "rel_landing_atlas_v0_1_0" as const;
export const RECORDED_ENCOUNTER_OWNER_LIMIT = 200 as const;
export const RECORDED_ENCOUNTER_BODY_LIMIT_BYTES = 4_096 as const;
export const RECORDED_ENCOUNTER_TIMESTAMP_MAX_MS =
  8_640_000_000_000_000 as const;

export const RECORDED_ENCOUNTER_ENTITY_IDS = [
  "observable-universe",
  "laniakea",
  "local-group",
  "andromeda",
  "milky-way",
  "sagittarius-a-star",
  "proxima-centauri",
  "trappist-1",
  "solar-system",
  "mars",
  "jezero",
  "apollo-17",
  "voyager-1",
  "jwst-deep-fields",
  "earth-exploration-network",
] as const;

export const RecordedEncounterEntityIdSchema = z.enum(
  RECORDED_ENCOUNTER_ENTITY_IDS,
);

export const RecordedEncounterInputSchema = z
  .object({
    entityId: RecordedEncounterEntityIdSchema,
    releaseId: z.literal(RECORDED_ENCOUNTER_RELEASE_ID),
  })
  .strict();

export type RecordedEncounterInput = z.infer<
  typeof RecordedEncounterInputSchema
>;

const RecordedEncounterEntitySchema = z
  .object({
    id: RecordedEncounterEntityIdSchema,
    name: z.string().min(1),
    slug: z.string().min(1),
    kind: z.string().min(1),
    domain: z.string().min(1),
    href: z.string().startsWith("/"),
  })
  .strict();

export const RecordedEncounterTruthSchema = z
  .object({
    userConfirmed: z.literal(true),
    passiveNavigation: z.literal(false),
    completionClaim: z.literal(false),
    achievementClaim: z.literal(false),
    scientificDiscoveryClaim: z.literal(false),
  })
  .strict();

export const PublicRecordedEncounterSchema = z
  .object({
    entity: RecordedEncounterEntitySchema,
    firstRecordedAtMs: z
      .number()
      .int()
      .positive()
      .max(RECORDED_ENCOUNTER_TIMESTAMP_MAX_MS),
    lastRecordedAtMs: z
      .number()
      .int()
      .positive()
      .max(RECORDED_ENCOUNTER_TIMESTAMP_MAX_MS),
    recordCount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    method: z.literal(RECORDED_ENCOUNTER_METHOD),
    firstReleaseId: z.literal(RECORDED_ENCOUNTER_RELEASE_ID),
    truth: RecordedEncounterTruthSchema,
  })
  .strict();

export type PublicRecordedEncounter = z.infer<
  typeof PublicRecordedEncounterSchema
>;

const StoredRecordedEncounterRowSchema = z
  .object({
    entityId: z.string(),
    firstSeenAtMs: z.number(),
    lastSeenAtMs: z.number(),
    visitCount: z.number(),
    discoveryMethod: z.string(),
    releaseId: z.string(),
  })
  .strict();

export type StoredRecordedEncounterRow = z.input<
  typeof StoredRecordedEncounterRowSchema
>;

export class RecordedEncounterContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordedEncounterContractError";
  }
}

export class RecordedEncounterRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RecordedEncounterRequestError";
  }
}

const RECORDED_ENCOUNTER_TRUTH = Object.freeze({
  userConfirmed: true,
  passiveNavigation: false,
  completionClaim: false,
  achievementClaim: false,
  scientificDiscoveryClaim: false,
} as const);

export function parseStoredRecordedEncounterRow(
  value: unknown,
): PublicRecordedEncounter {
  const rowResult = StoredRecordedEncounterRowSchema.safeParse(value);
  if (!rowResult.success) {
    throw new RecordedEncounterContractError(
      "Stored recorded encounter row is invalid",
    );
  }
  const row = rowResult.data;
  const entityIdResult = RecordedEncounterEntityIdSchema.safeParse(row.entityId);
  if (
    !entityIdResult.success ||
    !Number.isSafeInteger(row.firstSeenAtMs) ||
    row.firstSeenAtMs <= 0 ||
    row.firstSeenAtMs > RECORDED_ENCOUNTER_TIMESTAMP_MAX_MS ||
    !Number.isSafeInteger(row.lastSeenAtMs) ||
    row.lastSeenAtMs < row.firstSeenAtMs ||
    row.lastSeenAtMs > RECORDED_ENCOUNTER_TIMESTAMP_MAX_MS ||
    !Number.isSafeInteger(row.visitCount) ||
    row.visitCount <= 0 ||
    row.discoveryMethod !== RECORDED_ENCOUNTER_METHOD ||
    row.releaseId !== RECORDED_ENCOUNTER_RELEASE_ID
  ) {
    throw new RecordedEncounterContractError(
      "Stored recorded encounter contract has drifted",
    );
  }

  const entity = getReleaseRegistryRecord(
    RECORDED_ENCOUNTER_RELEASE_ID,
    entityIdResult.data,
  );
  if (!entity || entity.id !== entityIdResult.data) {
    throw new RecordedEncounterContractError(
      "Stored recorded encounter entity is unavailable",
    );
  }

  return PublicRecordedEncounterSchema.parse({
    entity: {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      kind: entity.kind,
      domain: entity.domain,
      href: entity.links.scene,
    },
    firstRecordedAtMs: row.firstSeenAtMs,
    lastRecordedAtMs: row.lastSeenAtMs,
    recordCount: row.visitCount,
    method: row.discoveryMethod,
    firstReleaseId: row.releaseId,
    truth: RECORDED_ENCOUNTER_TRUTH,
  });
}

export function recordedEncounterEnvelope<T>(records: T) {
  return {
    schemaId: RECORDED_ENCOUNTERS_SCHEMA_ID,
    schemaVersion: RECORDED_ENCOUNTERS_SCHEMA_VERSION,
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
    throw new RecordedEncounterRequestError(
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
      Number(declaredLength) > RECORDED_ENCOUNTER_BODY_LIMIT_BYTES)
  ) {
    throw new RecordedEncounterRequestError(
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
    if (byteLength > RECORDED_ENCOUNTER_BODY_LIMIT_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new RecordedEncounterRequestError(
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

export async function readRecordedEncounterJson(
  request: Request,
): Promise<unknown> {
  validateJsonContentType(request);
  const bytes = await readBodyBytes(request);
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new RecordedEncounterRequestError(
      400,
      "invalid_json",
      "The request body must contain valid UTF-8 JSON.",
    );
  }
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new RecordedEncounterRequestError(
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

export function isRecordedEncounterExistingError(error: unknown): boolean {
  return nestedErrorIncludes(error, "recorded encounter already exists");
}

export function isRecordedEncounterQuotaError(error: unknown): boolean {
  return nestedErrorIncludes(error, "recorded encounter owner quota exceeded");
}
