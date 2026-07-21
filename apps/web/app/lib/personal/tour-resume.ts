import { z } from "zod";

import { sevenScalesToJezeroTour } from "@/app/data/tours/seven-scales-to-jezero";
import { createGuidedTourLocationSearch } from "@/app/lib/education/guided-tour";

export const TOUR_RESUME_SCHEMA_ID = "cosmography.user-tour-resume" as const;
export const TOUR_RESUME_SCHEMA_VERSION = "1.0.0" as const;
export const TOUR_RESUME_TOUR_ID =
  "tour_seven_scales_to_jezero_v1" as const;
export const TOUR_RESUME_TOUR_SLUG = "seven-scales-to-jezero" as const;
export const TOUR_RESUME_RELEASE_ID = "rel_landing_atlas_v0_1_0" as const;
export const TOUR_RESUME_SCOPE_ENTITY_ID = TOUR_RESUME_TOUR_ID;
export const TOUR_RESUME_METRIC_CODE = "manual-resume-point-v1" as const;
export const TOUR_RESUME_METHOD = "manual-save-resume-point" as const;
export const TOUR_RESUME_BODY_LIMIT_BYTES = 4_096 as const;
export const TOUR_RESUME_TIMESTAMP_MAX_MS = 8_640_000_000_000_000 as const;

const TourResumeTimestampSchema = z
  .number()
  .int()
  .positive()
  .max(TOUR_RESUME_TIMESTAMP_MAX_MS);

const TourResumeOrdinalSchema = z.number().int().min(1).max(7);

const TourResumeBaseInputSchema = z
  .object({
    tourId: z.literal(TOUR_RESUME_TOUR_ID),
    releaseId: z.literal(TOUR_RESUME_RELEASE_ID),
    resumeOrdinal: TourResumeOrdinalSchema,
  })
  .strict();

export const TourResumePutInputSchema = z.union([
  TourResumeBaseInputSchema.extend({ expectedSavedAtMs: z.null() }).strict(),
  TourResumeBaseInputSchema.extend({
    expectedSavedAtMs: TourResumeTimestampSchema,
  }).strict(),
]);

export const TourResumeDeleteInputSchema = z
  .object({ expectedSavedAtMs: TourResumeTimestampSchema })
  .strict();

export type TourResumePutInput = z.infer<typeof TourResumePutInputSchema>;

export const TourResumeTruthSchema = z
  .object({
    userConfirmed: z.literal(true),
    passiveNavigation: z.literal(false),
    resumeStateOnly: z.literal(true),
    storedStateDefinesTour: z.literal(false),
    completionClaim: z.literal(false),
    achievementClaim: z.literal(false),
    scientificDiscoveryClaim: z.literal(false),
  })
  .strict();

const PublicTourResumeSchema = z
  .object({
    tour: z
      .object({
        id: z.literal(TOUR_RESUME_TOUR_ID),
        slug: z.literal(TOUR_RESUME_TOUR_SLUG),
        title: z.literal("Seven Scales to Jezero"),
        releaseId: z.literal(TOUR_RESUME_RELEASE_ID),
      })
      .strict(),
    resume: z
      .object({
        ordinal: TourResumeOrdinalSchema,
        stopId: z.string().min(1),
        stopTitle: z.string().min(1),
        targetEntityId: z.string().min(1),
        href: z.string().startsWith("/?"),
      })
      .strict(),
    savedAtMs: TourResumeTimestampSchema,
    method: z.literal(TOUR_RESUME_METHOD),
    truth: TourResumeTruthSchema,
  })
  .strict();

export type PublicTourResume = z.infer<typeof PublicTourResumeSchema>;

const StoredTourResumeJsonSchema = z
  .object({
    schemaId: z.literal(TOUR_RESUME_SCHEMA_ID),
    schemaVersion: z.literal(TOUR_RESUME_SCHEMA_VERSION),
    tourId: z.literal(TOUR_RESUME_TOUR_ID),
    tourSlug: z.literal(TOUR_RESUME_TOUR_SLUG),
    releaseId: z.literal(TOUR_RESUME_RELEASE_ID),
    resumeOrdinal: TourResumeOrdinalSchema,
    stopId: z.string().min(1),
    targetEntityId: z.string().min(1),
    savedAtMs: TourResumeTimestampSchema,
    method: z.literal(TOUR_RESUME_METHOD),
    truth: TourResumeTruthSchema,
  })
  .strict();

const StoredTourResumeRowSchema = z
  .object({
    valueNumeric: z.number().int().min(1).max(7).nullable(),
    valueJson: z.string().min(2).max(4_096).nullable(),
    updatedAtMs: TourResumeTimestampSchema,
  })
  .strict();

export type StoredTourResumeRow = z.input<typeof StoredTourResumeRowSchema>;

export class TourResumeContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TourResumeContractError";
  }
}

export class TourResumeRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TourResumeRequestError";
  }
}

const TOUR_RESUME_TRUTH = Object.freeze({
  userConfirmed: true,
  passiveNavigation: false,
  resumeStateOnly: true,
  storedStateDefinesTour: false,
  completionClaim: false,
  achievementClaim: false,
  scientificDiscoveryClaim: false,
} as const);

const TOUR_RESUME_STOP_CONTRACTS = Object.freeze([
  Object.freeze({
    ordinal: 1,
    id: "scale-observable-universe",
    title: "Known Universe",
    targetEntityId: "observable-universe",
  }),
  Object.freeze({
    ordinal: 2,
    id: "scale-laniakea",
    title: "Laniakea",
    targetEntityId: "laniakea",
  }),
  Object.freeze({
    ordinal: 3,
    id: "scale-local-group",
    title: "Local Group",
    targetEntityId: "local-group",
  }),
  Object.freeze({
    ordinal: 4,
    id: "scale-milky-way",
    title: "Milky Way",
    targetEntityId: "milky-way",
  }),
  Object.freeze({
    ordinal: 5,
    id: "scale-solar-system",
    title: "Solar System",
    targetEntityId: "solar-system",
  }),
  Object.freeze({
    ordinal: 6,
    id: "scale-mars",
    title: "Mars",
    targetEntityId: "mars",
  }),
  Object.freeze({
    ordinal: 7,
    id: "scale-jezero",
    title: "Jezero Crater",
    targetEntityId: "jezero",
  }),
] as const);

type TourResumeTourContractCandidate = Readonly<{
  id: string;
  slug: string;
  title: string;
  releaseId: string;
  stops: readonly Readonly<{
    ordinal: number;
    id: string;
    title: string;
    targetEntityId: string;
  }>[];
}>;

export function assertTourResumeTourContract(
  tour: TourResumeTourContractCandidate,
): void {
  const stopsHaveDrifted = TOUR_RESUME_STOP_CONTRACTS.some(
    (expected, index) => {
      const stop = tour.stops[index];
      return (
        !stop ||
        stop.ordinal !== expected.ordinal ||
        stop.id !== expected.id ||
        stop.title !== expected.title ||
        stop.targetEntityId !== expected.targetEntityId
      );
    },
  );
  if (
    tour.id !== TOUR_RESUME_TOUR_ID ||
    tour.slug !== TOUR_RESUME_TOUR_SLUG ||
    tour.title !== "Seven Scales to Jezero" ||
    tour.releaseId !== TOUR_RESUME_RELEASE_ID ||
    tour.stops.length !== TOUR_RESUME_STOP_CONTRACTS.length ||
    stopsHaveDrifted
  ) {
    throw new TourResumeContractError(
      "The release-bound Seven Scales tour contract has drifted",
    );
  }
}

function tourStopForOrdinal(ordinal: number) {
  assertTourResumeTourContract(sevenScalesToJezeroTour);
  const expected = TOUR_RESUME_STOP_CONTRACTS[ordinal - 1];
  const stop = sevenScalesToJezeroTour.stops[ordinal - 1];
  if (
    !Number.isSafeInteger(ordinal) ||
    !expected ||
    !stop ||
    stop.ordinal !== ordinal
  ) {
    throw new TourResumeContractError(
      "The release-bound Seven Scales tour contract has drifted",
    );
  }
  return stop;
}

export function createStoredTourResumeJson(
  ordinal: number,
  savedAtMs: number,
): string {
  const stop = tourStopForOrdinal(ordinal);
  const result = StoredTourResumeJsonSchema.safeParse({
    schemaId: TOUR_RESUME_SCHEMA_ID,
    schemaVersion: TOUR_RESUME_SCHEMA_VERSION,
    tourId: TOUR_RESUME_TOUR_ID,
    tourSlug: TOUR_RESUME_TOUR_SLUG,
    releaseId: TOUR_RESUME_RELEASE_ID,
    resumeOrdinal: ordinal,
    stopId: stop.id,
    targetEntityId: stop.targetEntityId,
    savedAtMs,
    method: TOUR_RESUME_METHOD,
    truth: TOUR_RESUME_TRUTH,
  });
  if (!result.success) {
    throw new TourResumeContractError(
      "A stored Seven Scales resume point could not be created",
    );
  }
  return JSON.stringify(result.data);
}

function parseStoredJson(source: string): unknown {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new TourResumeContractError(
      "Stored Seven Scales resume JSON is invalid",
    );
  }
}

export function parseStoredTourResumeRow(value: unknown): PublicTourResume {
  const rowResult = StoredTourResumeRowSchema.safeParse(value);
  if (!rowResult.success) {
    throw new TourResumeContractError(
      "Stored Seven Scales resume row is invalid",
    );
  }
  const row = rowResult.data;
  if (row.valueNumeric === null || row.valueJson === null) {
    throw new TourResumeContractError(
      "Stored Seven Scales resume fields are missing",
    );
  }
  const storedResult = StoredTourResumeJsonSchema.safeParse(
    parseStoredJson(row.valueJson),
  );
  if (!storedResult.success) {
    throw new TourResumeContractError(
      "Stored Seven Scales resume contract has drifted",
    );
  }
  const stored = storedResult.data;
  const stop = tourStopForOrdinal(row.valueNumeric);
  if (
    stored.resumeOrdinal !== row.valueNumeric ||
    stored.savedAtMs !== row.updatedAtMs ||
    stored.stopId !== stop.id ||
    stored.targetEntityId !== stop.targetEntityId ||
    row.valueJson !== createStoredTourResumeJson(row.valueNumeric, row.updatedAtMs)
  ) {
    throw new TourResumeContractError(
      "Stored Seven Scales resume mapping has drifted",
    );
  }

  return PublicTourResumeSchema.parse({
    tour: {
      id: sevenScalesToJezeroTour.id,
      slug: sevenScalesToJezeroTour.slug,
      title: sevenScalesToJezeroTour.title,
      releaseId: sevenScalesToJezeroTour.releaseId,
    },
    resume: {
      ordinal: stop.ordinal,
      stopId: stop.id,
      stopTitle: stop.title,
      targetEntityId: stop.targetEntityId,
      href: `/?${createGuidedTourLocationSearch(
        sevenScalesToJezeroTour,
        stop.ordinal,
      )}`,
    },
    savedAtMs: row.updatedAtMs,
    method: TOUR_RESUME_METHOD,
    truth: TOUR_RESUME_TRUTH,
  });
}

export function tourResumeEnvelope(record: PublicTourResume | null) {
  return {
    schemaId: TOUR_RESUME_SCHEMA_ID,
    schemaVersion: TOUR_RESUME_SCHEMA_VERSION,
    record,
  };
}

function validateJsonContentType(request: Request): void {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    throw new TourResumeRequestError(
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
      Number(declaredLength) > TOUR_RESUME_BODY_LIMIT_BYTES)
  ) {
    throw new TourResumeRequestError(
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
    if (byteLength > TOUR_RESUME_BODY_LIMIT_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new TourResumeRequestError(
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

export async function readTourResumeJson(request: Request): Promise<unknown> {
  validateJsonContentType(request);
  const bytes = await readBodyBytes(request);
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new TourResumeRequestError(
      400,
      "invalid_json",
      "The request body must contain valid UTF-8 JSON.",
    );
  }
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new TourResumeRequestError(
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

export function isTourResumeExistingError(error: unknown): boolean {
  return nestedErrorIncludes(error, "Seven Scales resume point already exists");
}
