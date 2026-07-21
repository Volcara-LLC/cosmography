export const TOUR_RESUME_API_PATH =
  "/api/v1/me/tours/seven-scales-to-jezero/resume" as const;
export const TOUR_RESUME_SCHEMA_ID = "cosmography.user-tour-resume" as const;
export const TOUR_RESUME_SCHEMA_VERSION = "1.0.0" as const;
export const SEVEN_SCALES_TOUR_ID =
  "tour_seven_scales_to_jezero_v1" as const;
export const SEVEN_SCALES_TOUR_SLUG = "seven-scales-to-jezero" as const;
export const FOUNDATION_TOUR_RESUME_RELEASE_ID =
  "rel_landing_atlas_v0_1_0" as const;
export const MANUAL_TOUR_RESUME_METHOD =
  "manual-save-resume-point" as const;
export const TOUR_RESUME_STOP_COUNT = 7 as const;

const MAXIMUM_DATE_TIMESTAMP_MS = 8_640_000_000_000_000;

const TOUR_RESUME_STOPS = Object.freeze([
  Object.freeze({
    ordinal: 1,
    stopId: "scale-observable-universe",
    stopTitle: "Known Universe",
    targetEntityId: "observable-universe",
  }),
  Object.freeze({
    ordinal: 2,
    stopId: "scale-laniakea",
    stopTitle: "Laniakea",
    targetEntityId: "laniakea",
  }),
  Object.freeze({
    ordinal: 3,
    stopId: "scale-local-group",
    stopTitle: "Local Group",
    targetEntityId: "local-group",
  }),
  Object.freeze({
    ordinal: 4,
    stopId: "scale-milky-way",
    stopTitle: "Milky Way",
    targetEntityId: "milky-way",
  }),
  Object.freeze({
    ordinal: 5,
    stopId: "scale-solar-system",
    stopTitle: "Solar System",
    targetEntityId: "solar-system",
  }),
  Object.freeze({
    ordinal: 6,
    stopId: "scale-mars",
    stopTitle: "Mars",
    targetEntityId: "mars",
  }),
  Object.freeze({
    ordinal: 7,
    stopId: "scale-jezero",
    stopTitle: "Jezero Crater",
    targetEntityId: "jezero",
  }),
] as const);

export interface TourResumeRecord {
  tour: {
    id: typeof SEVEN_SCALES_TOUR_ID;
    slug: typeof SEVEN_SCALES_TOUR_SLUG;
    title: "Seven Scales to Jezero";
    releaseId: typeof FOUNDATION_TOUR_RESUME_RELEASE_ID;
  };
  resume: {
    ordinal: number;
    stopId: string;
    stopTitle: string;
    targetEntityId: string;
    href: string;
  };
  savedAtMs: number;
  method: typeof MANUAL_TOUR_RESUME_METHOD;
  truth: {
    userConfirmed: true;
    passiveNavigation: false;
    resumeStateOnly: true;
    storedStateDefinesTour: false;
    completionClaim: false;
    achievementClaim: false;
    scientificDiscoveryClaim: false;
  };
}

export type TourResumeEnvelopeResult =
  | Readonly<{ valid: true; record: TourResumeRecord | null }>
  | Readonly<{ valid: false; record: null }>;

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
    value <= MAXIMUM_DATE_TIMESTAMP_MS
  );
}

function expectedStop(ordinal: unknown) {
  return typeof ordinal === "number" &&
    Number.isSafeInteger(ordinal) &&
    ordinal >= 1 &&
    ordinal <= TOUR_RESUME_STOPS.length
    ? TOUR_RESUME_STOPS[ordinal - 1]
    : undefined;
}

export function canonicalTourResumeHref(ordinal: number): string {
  const stop = expectedStop(ordinal);
  if (!stop) throw new RangeError("Tour resume ordinal must be from 1 through 7");
  return `/?tour=${SEVEN_SCALES_TOUR_SLUG}&step=${stop.ordinal}&focus=${stop.targetEntityId}&release=${FOUNDATION_TOUR_RESUME_RELEASE_ID}`;
}

function isTour(value: unknown): value is TourResumeRecord["tour"] {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ["id", "slug", "title", "releaseId"])
  ) {
    return false;
  }
  return (
    value.id === SEVEN_SCALES_TOUR_ID &&
    value.slug === SEVEN_SCALES_TOUR_SLUG &&
    value.title === "Seven Scales to Jezero" &&
    value.releaseId === FOUNDATION_TOUR_RESUME_RELEASE_ID
  );
}

function isResume(value: unknown): value is TourResumeRecord["resume"] {
  if (
    !isObject(value) ||
    !hasExactKeys(value, [
      "ordinal",
      "stopId",
      "stopTitle",
      "targetEntityId",
      "href",
    ])
  ) {
    return false;
  }
  const stop = expectedStop(value.ordinal);
  return Boolean(
    stop &&
      value.stopId === stop.stopId &&
      value.stopTitle === stop.stopTitle &&
      value.targetEntityId === stop.targetEntityId &&
      typeof value.href === "string" &&
      value.href.startsWith("/") &&
      !value.href.startsWith("//") &&
      value.href === canonicalTourResumeHref(stop.ordinal),
  );
}

function isTruth(value: unknown): value is TourResumeRecord["truth"] {
  if (
    !isObject(value) ||
    !hasExactKeys(value, [
      "userConfirmed",
      "passiveNavigation",
      "resumeStateOnly",
      "storedStateDefinesTour",
      "completionClaim",
      "achievementClaim",
      "scientificDiscoveryClaim",
    ])
  ) {
    return false;
  }
  return (
    value.userConfirmed === true &&
    value.passiveNavigation === false &&
    value.resumeStateOnly === true &&
    value.storedStateDefinesTour === false &&
    value.completionClaim === false &&
    value.achievementClaim === false &&
    value.scientificDiscoveryClaim === false
  );
}

export function isTourResumeRecord(value: unknown): value is TourResumeRecord {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ["tour", "resume", "savedAtMs", "method", "truth"])
  ) {
    return false;
  }
  return (
    isTour(value.tour) &&
    isResume(value.resume) &&
    isSafeTimestamp(value.savedAtMs) &&
    value.method === MANUAL_TOUR_RESUME_METHOD &&
    isTruth(value.truth)
  );
}

export function parseTourResumeEnvelope(
  payload: unknown,
): TourResumeEnvelopeResult {
  if (
    !isObject(payload) ||
    !hasExactKeys(payload, ["schemaId", "schemaVersion", "record"]) ||
    payload.schemaId !== TOUR_RESUME_SCHEMA_ID ||
    payload.schemaVersion !== TOUR_RESUME_SCHEMA_VERSION ||
    (payload.record !== null && !isTourResumeRecord(payload.record))
  ) {
    return { valid: false, record: null };
  }
  return { valid: true, record: payload.record };
}

export async function readTourResumeResponse(
  response: Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function tourResumeSignInHref(returnTo: string): string {
  return `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
}
