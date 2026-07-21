import {
  SAVED_PLACES_SCHEMA_ID,
  SAVED_PLACES_SCHEMA_VERSION,
  SAVED_PLACE_METHOD,
  SAVED_PLACE_OWNER_LIMIT,
  SAVED_PLACE_RELEASE_ID,
  SAVED_PLACE_TIMESTAMP_MAX_MS,
  SAVED_PLACE_TIMELINE_YEAR,
  SAVED_PLACE_TRUTH,
  createSavedPlaceHref,
  isSavedPlaceAppearance,
  savedPlaceIdentityFor,
  type SavedPlaceAppearance,
  type SavedPlaceRecord,
} from "@/app/lib/personal/saved-place-foundation";

export const SAVED_PLACES_API_PATH = "/api/v1/me/bookmarks" as const;

export interface PrivateSavedPlaceInput {
  entityId: string;
  appearance: SavedPlaceAppearance;
  releaseId: typeof SAVED_PLACE_RELEASE_ID;
}

export type PrivateSavedPlaceSaveResult =
  | Readonly<{ status: "saved"; record: SavedPlaceRecord }>
  | Readonly<{
      status: "signed-out" | "unavailable" | "error";
      record: null;
    }>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isSafeTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= SAVED_PLACE_TIMESTAMP_MAX_MS
  );
}

function isExactTruth(value: unknown): value is SavedPlaceRecord["truth"] {
  if (!isObject(value)) return false;
  const entries = Object.entries(SAVED_PLACE_TRUTH);
  return (
    hasExactKeys(
      value,
      entries.map(([key]) => key),
    ) && entries.every(([key, expected]) => value[key] === expected)
  );
}

export function isSavedPlaceRecord(value: unknown): value is SavedPlaceRecord {
  if (
    !isObject(value) ||
    !hasExactKeys(value, [
      "id",
      "entity",
      "scene",
      "href",
      "savedAtMs",
      "method",
      "truth",
    ]) ||
    typeof value.id !== "string" ||
    !/^bmk_[0-9a-f]{32}$/.test(value.id) ||
    !isObject(value.entity) ||
    !hasExactKeys(value.entity, ["id", "name", "slug", "kind", "domain"]) ||
    typeof value.entity.id !== "string" ||
    !isObject(value.scene) ||
    !hasExactKeys(value.scene, [
      "focusId",
      "appearance",
      "timelineYear",
      "releaseId",
    ])
  ) {
    return false;
  }

  const identity = savedPlaceIdentityFor(value.entity.id);
  if (
    !identity ||
    value.entity.name !== identity.name ||
    value.entity.slug !== identity.slug ||
    value.entity.kind !== identity.kind ||
    value.entity.domain !== identity.domain ||
    value.scene.focusId !== identity.id ||
    !isSavedPlaceAppearance(value.scene.appearance) ||
    value.scene.timelineYear !== SAVED_PLACE_TIMELINE_YEAR ||
    value.scene.releaseId !== SAVED_PLACE_RELEASE_ID ||
    value.href !== createSavedPlaceHref(identity.slug, value.scene.appearance) ||
    !isSafeTimestamp(value.savedAtMs) ||
    value.method !== SAVED_PLACE_METHOD ||
    !isExactTruth(value.truth)
  ) {
    return false;
  }

  return true;
}

function envelopeRecords(payload: unknown): unknown | undefined {
  if (
    !isObject(payload) ||
    !hasExactKeys(payload, [
      "schemaId",
      "schemaVersion",
      "releaseId",
      "records",
    ]) ||
    payload.schemaId !== SAVED_PLACES_SCHEMA_ID ||
    payload.schemaVersion !== SAVED_PLACES_SCHEMA_VERSION ||
    payload.releaseId !== SAVED_PLACE_RELEASE_ID
  ) {
    return undefined;
  }
  return payload.records;
}

export function savedPlacesFromEnvelope(
  payload: unknown,
): SavedPlaceRecord[] | null {
  const records = envelopeRecords(payload);
  if (
    !Array.isArray(records) ||
    records.length > SAVED_PLACE_OWNER_LIMIT ||
    !records.every(isSavedPlaceRecord)
  ) {
    return null;
  }
  const recordIds = new Set<string>();
  const entityIds = new Set<string>();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]!;
    if (recordIds.has(record.id) || entityIds.has(record.entity.id)) return null;
    recordIds.add(record.id);
    entityIds.add(record.entity.id);
    const previous = records[index - 1];
    if (
      previous &&
      (previous.savedAtMs < record.savedAtMs ||
        (previous.savedAtMs === record.savedAtMs && previous.id < record.id))
    ) {
      return null;
    }
  }
  return records;
}

export function savedPlaceFromEnvelope(
  payload: unknown,
): SavedPlaceRecord | null {
  const record = envelopeRecords(payload);
  return isSavedPlaceRecord(record) ? record : null;
}

export function isSavedPlaceDeleteAcknowledgement(
  payload: unknown,
  expectedId: string,
): boolean {
  const records = envelopeRecords(payload);
  return (
    isObject(records) &&
    hasExactKeys(records, ["deletedId"]) &&
    records.deletedId === expectedId
  );
}

export async function readPersonalStorageResponse(
  response: Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function personalStorageSignInHref(returnTo: string): string {
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
}

export async function savePrivatePlace(
  input: PrivateSavedPlaceInput,
): Promise<PrivateSavedPlaceSaveResult> {
  if (
    !savedPlaceIdentityFor(input.entityId) ||
    !isSavedPlaceAppearance(input.appearance) ||
    input.releaseId !== SAVED_PLACE_RELEASE_ID
  ) {
    return { status: "error", record: null };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(SAVED_PLACES_API_PATH, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        entityId: input.entityId,
        appearance: input.appearance,
        releaseId: input.releaseId,
      }),
    });
    if (response.status === 401) {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.assign(personalStorageSignInHref(returnTo));
      return { status: "signed-out", record: null };
    }
    if (response.status === 503) {
      return { status: "unavailable", record: null };
    }
    const record = savedPlaceFromEnvelope(
      await readPersonalStorageResponse(response),
    );
    if (
      ![200, 201].includes(response.status) ||
      !record ||
      record.entity.id !== input.entityId ||
      record.scene.appearance !== input.appearance ||
      record.scene.releaseId !== input.releaseId
    ) {
      return { status: "error", record: null };
    }
    return { status: "saved", record };
  } catch {
    return { status: "error", record: null };
  } finally {
    window.clearTimeout(timeout);
  }
}
