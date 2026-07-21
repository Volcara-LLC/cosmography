import type { AtlasKind, ScaleDomain } from "@/app/lib/science/scene";
import { FOUNDATION_RELEASE_ID } from "@/app/lib/releases/foundation-identity";

export const SAVED_PLACES_SCHEMA_ID =
  "cosmography.user-saved-places" as const;
export const SAVED_PLACES_SCHEMA_VERSION = "1.0.0" as const;
export const SAVED_PLACE_RELEASE_ID = FOUNDATION_RELEASE_ID;
export const SAVED_PLACE_TIMELINE_YEAR = 2026 as const;
export const SAVED_PLACE_METHOD = "manual-save-place" as const;
export const SAVED_PLACE_OWNER_LIMIT = 15 as const;
export const SAVED_PLACE_BODY_LIMIT_BYTES = 4_096 as const;
export const SAVED_PLACE_TIMESTAMP_MAX_MS =
  8_640_000_000_000_000 as const;

export const SAVED_PLACE_APPEARANCES = ["scientific", "immersive"] as const;
export type SavedPlaceAppearance = (typeof SAVED_PLACE_APPEARANCES)[number];

export const SAVED_PLACE_ENTITY_IDS = [
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

export type SavedPlaceEntityId = (typeof SAVED_PLACE_ENTITY_IDS)[number];

export interface SavedPlaceFoundationIdentity {
  readonly id: SavedPlaceEntityId;
  readonly name: string;
  readonly slug: string;
  readonly kind: AtlasKind;
  readonly domain: ScaleDomain;
}

const savedPlaceEntityIdentityInput = [
  { id: "observable-universe", name: "Known Universe", slug: "observable-universe", kind: "universe", domain: "lightcone" },
  { id: "laniakea", name: "Laniakea", slug: "laniakea-supercluster", kind: "structure", domain: "extragalactic" },
  { id: "local-group", name: "Local Group", slug: "local-group", kind: "structure", domain: "extragalactic" },
  { id: "andromeda", name: "Andromeda Galaxy", slug: "andromeda-galaxy", kind: "galaxy", domain: "extragalactic" },
  { id: "milky-way", name: "Milky Way", slug: "milky-way", kind: "galaxy", domain: "galactic" },
  { id: "sagittarius-a-star", name: "Sagittarius A*", slug: "sagittarius-a-star", kind: "black-hole", domain: "simulation" },
  { id: "proxima-centauri", name: "Proxima Centauri", slug: "proxima-centauri", kind: "star", domain: "galactic" },
  { id: "trappist-1", name: "TRAPPIST-1", slug: "trappist-1", kind: "system", domain: "system" },
  { id: "solar-system", name: "Solar System", slug: "solar-system", kind: "system", domain: "system" },
  { id: "mars", name: "Mars", slug: "mars", kind: "world", domain: "globe" },
  { id: "jezero", name: "Jezero Crater", slug: "jezero-crater", kind: "surface-place", domain: "surface" },
  { id: "apollo-17", name: "Apollo 17 · Taurus–Littrow", slug: "apollo-17-taurus-littrow", kind: "surface-place", domain: "surface" },
  { id: "voyager-1", name: "Voyager 1", slug: "voyager-1", kind: "spacecraft", domain: "system" },
  { id: "jwst-deep-fields", name: "Webb Deep Fields", slug: "jwst-deep-fields", kind: "observation", domain: "lightcone" },
  { id: "earth-exploration-network", name: "Earth Exploration Network", slug: "earth-space-exploration-network", kind: "exploration-network", domain: "globe" },
] as const satisfies readonly SavedPlaceFoundationIdentity[];

export const SAVED_PLACE_ENTITY_IDENTITIES: readonly SavedPlaceFoundationIdentity[] =
  Object.freeze(
    savedPlaceEntityIdentityInput.map((identity) => Object.freeze({ ...identity })),
  );

const savedPlaceIdentityById = new Map(
  SAVED_PLACE_ENTITY_IDENTITIES.map((identity) => [identity.id, identity]),
);

export function savedPlaceIdentityFor(
  entityId: string,
): SavedPlaceFoundationIdentity | undefined {
  return savedPlaceIdentityById.get(entityId as SavedPlaceEntityId);
}

export const SAVED_PLACE_TRUTH = Object.freeze({
  userConfirmed: true,
  passiveNavigation: false,
  navigationAidOnly: true,
  physicalCameraPose: false,
  observationClaim: false,
  encounterClaim: false,
  routeClaim: false,
  progressClaim: false,
  completionClaim: false,
  masteryClaim: false,
  achievementClaim: false,
  scientificDiscoveryClaim: false,
  shared: false,
} as const);

export interface SavedPlaceRecord {
  id: string;
  entity: {
    id: SavedPlaceEntityId;
    name: string;
    slug: string;
    kind: AtlasKind;
    domain: ScaleDomain;
  };
  scene: {
    focusId: SavedPlaceEntityId;
    appearance: SavedPlaceAppearance;
    timelineYear: typeof SAVED_PLACE_TIMELINE_YEAR;
    releaseId: typeof SAVED_PLACE_RELEASE_ID;
  };
  href: string;
  savedAtMs: number;
  method: typeof SAVED_PLACE_METHOD;
  truth: typeof SAVED_PLACE_TRUTH;
}

export interface SavedPlaceEnvelope<Records> {
  schemaId: typeof SAVED_PLACES_SCHEMA_ID;
  schemaVersion: typeof SAVED_PLACES_SCHEMA_VERSION;
  releaseId: typeof SAVED_PLACE_RELEASE_ID;
  records: Records;
}

export function isSavedPlaceAppearance(
  value: unknown,
): value is SavedPlaceAppearance {
  return value === "scientific" || value === "immersive";
}

export function createSavedPlaceHref(
  slug: string,
  appearance: SavedPlaceAppearance,
): string {
  const parameters = new URLSearchParams();
  parameters.set("appearance", appearance);
  parameters.set("focus", slug);
  parameters.set("release", SAVED_PLACE_RELEASE_ID);
  return `/?${parameters.toString()}`;
}
