export const RECORDED_ENCOUNTERS_SCHEMA_ID =
  "cosmography.user-recorded-encounters" as const;
export const RECORDED_ENCOUNTERS_SCHEMA_VERSION = "1.0.0" as const;
export const MANUAL_ENCOUNTER_METHOD = "manual-atlas-record" as const;
export const FOUNDATION_RECORDED_ENCOUNTER_RELEASE_ID =
  "rel_landing_atlas_v0_1_0" as const;

const RECORDED_ENCOUNTER_ENTITY_IDS = new Set([
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
]);

export interface RecordedEncounter {
  entity: {
    id: string;
    name: string;
    slug: string;
    kind: string;
    domain: string;
    href: string;
  };
  firstRecordedAtMs: number;
  lastRecordedAtMs: number;
  recordCount: number;
  method: typeof MANUAL_ENCOUNTER_METHOD;
  firstReleaseId: string;
  truth: {
    userConfirmed: true;
    passiveNavigation: false;
    completionClaim: false;
    achievementClaim: false;
    scientificDiscoveryClaim: false;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(value: unknown, maximum = 180): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function isSafeTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 8_640_000_000_000_000
  );
}

function isEncounterEntity(value: unknown): value is RecordedEncounter["entity"] {
  if (!isObject(value) || Object.keys(value).length !== 6) return false;
  return (
    isBoundedString(value.id, 120) &&
    RECORDED_ENCOUNTER_ENTITY_IDS.has(value.id) &&
    isBoundedString(value.name, 180) &&
    isBoundedString(value.slug, 180) &&
    isBoundedString(value.kind, 80) &&
    isBoundedString(value.domain, 80) &&
    isBoundedString(value.href, 600) &&
    value.href.startsWith("/") &&
    !value.href.startsWith("//")
  );
}

function isEncounterTruth(value: unknown): value is RecordedEncounter["truth"] {
  if (!isObject(value) || Object.keys(value).length !== 5) return false;
  return (
    value.userConfirmed === true &&
    value.passiveNavigation === false &&
    value.completionClaim === false &&
    value.achievementClaim === false &&
    value.scientificDiscoveryClaim === false
  );
}

export function isRecordedEncounter(value: unknown): value is RecordedEncounter {
  if (!isObject(value) || Object.keys(value).length !== 7) return false;
  return (
    isEncounterEntity(value.entity) &&
    isSafeTimestamp(value.firstRecordedAtMs) &&
    isSafeTimestamp(value.lastRecordedAtMs) &&
    value.lastRecordedAtMs >= value.firstRecordedAtMs &&
    typeof value.recordCount === "number" &&
    Number.isSafeInteger(value.recordCount) &&
    value.recordCount > 0 &&
    value.recordCount <= Number.MAX_SAFE_INTEGER &&
    value.method === MANUAL_ENCOUNTER_METHOD &&
    value.firstReleaseId === FOUNDATION_RECORDED_ENCOUNTER_RELEASE_ID &&
    isEncounterTruth(value.truth)
  );
}

export function recordedEncountersFromEnvelope(
  payload: unknown,
): RecordedEncounter[] | null {
  if (
    !isObject(payload) ||
    Object.keys(payload).length !== 3 ||
    payload.schemaId !== RECORDED_ENCOUNTERS_SCHEMA_ID ||
    payload.schemaVersion !== RECORDED_ENCOUNTERS_SCHEMA_VERSION
  ) {
    return null;
  }
  const records = Array.isArray(payload.records) ? payload.records : [payload.records];
  return records.every(isRecordedEncounter) ? records : null;
}

function hasRecordedEncounterEnvelopeHeader(
  payload: unknown,
): payload is Record<string, unknown> {
  return (
    isObject(payload) &&
    Object.keys(payload).length === 3 &&
    payload.schemaId === RECORDED_ENCOUNTERS_SCHEMA_ID &&
    payload.schemaVersion === RECORDED_ENCOUNTERS_SCHEMA_VERSION
  );
}

export function isRecordedEncounterDeleteAcknowledgement(
  payload: unknown,
  entityId: string,
): boolean {
  if (!hasRecordedEncounterEnvelopeHeader(payload)) return false;
  const records = payload.records;
  return (
    isObject(records) &&
    Object.keys(records).length === 1 &&
    records.entityId === entityId
  );
}

export function isRecordedEncounterClearAcknowledgement(
  payload: unknown,
): boolean {
  if (!hasRecordedEncounterEnvelopeHeader(payload)) return false;
  const records = payload.records;
  return (
    isObject(records) &&
    Object.keys(records).length === 1 &&
    typeof records.deletedCount === "number" &&
    Number.isSafeInteger(records.deletedCount) &&
    records.deletedCount >= 0
  );
}

export async function readResponsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function privateSignInHref(returnTo: string): string {
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
}
