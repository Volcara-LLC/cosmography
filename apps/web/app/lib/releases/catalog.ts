import { z } from "zod";

import {
  atlasEntities,
  atlasRelease,
  missionAgencies,
  sources,
} from "@/app/data/atlas";
import {
  AtlasEntitySchema,
  AtlasKindSchema,
  AtlasSectionSchema,
  EvidenceClassSchema,
  MissionAgencySchema,
  ScaleDomainSchema,
  SourceReferenceSchema,
  type AtlasEntity,
  type SourceReference,
} from "@/app/lib/science/scene";
import {
  FOUNDATION_BUNDLE_SHA256,
  FOUNDATION_MANIFEST_SHA256,
} from "@/app/lib/releases/foundation-identity";
import foundationReleaseManifestJson from "@/db/foundation-release-manifest.json";

export {
  FOUNDATION_BUNDLE_SHA256,
  FOUNDATION_MANIFEST_SHA256,
} from "@/app/lib/releases/foundation-identity";

export const RELEASE_API_VERSION = "v1" as const;
export const RELEASE_BUNDLE_CANONICALIZATION =
  "cosmography-navigation-bundle-json-v1" as const;
export const RELEASE_REGISTRY_PROJECTION_VERSION =
  "foundation-navigation-registry-v1" as const;
export const RELEASE_SEARCH_RANKER_VERSION =
  "foundation-search-ranker-v1" as const;

export const ReleaseIdSchema = z
  .string()
  .regex(/^rel_[a-z0-9][a-z0-9_-]{5,126}$/);
export const SchemaVersionSchema = z
  .string()
  .regex(
    /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/,
  );

const FoundationReleaseManifestSchema = z
  .object({
    releaseId: ReleaseIdSchema,
    version: z.string().min(1),
    schemaVersion: SchemaVersionSchema,
    representation: z.literal("embedded-foundation-fixture"),
    sourcePath: z.literal("app/data/atlas.ts"),
    generatedAt: z.string().datetime(),
    status: z.literal("foundation"),
    content: z
      .object({
        canonicalization: z.literal(RELEASE_BUNDLE_CANONICALIZATION),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict(),
    derivatives: z
      .object({
        registryProjectionVersion: z.literal(
          RELEASE_REGISTRY_PROJECTION_VERSION,
        ),
        searchRankerVersion: z.literal(RELEASE_SEARCH_RANKER_VERSION),
      })
      .strict(),
    counts: z
      .object({
        entities: z.number().int().nonnegative(),
        sources: z.number().int().nonnegative(),
        agencies: z.number().int().nonnegative(),
      })
      .strict(),
    warning: z.string().min(1),
  })
  .strict();

export const RegistryFilterSchema = z
  .object({
    section: AtlasSectionSchema.optional(),
    domain: ScaleDomainSchema.optional(),
    kind: AtlasKindSchema.optional(),
    evidence: EvidenceClassSchema.optional(),
  })
  .strict();

export type RegistryFilters = z.infer<typeof RegistryFilterSchema>;

export const ReleaseRegistryRecordSchema = AtlasEntitySchema.omit({
  color: true,
  visualAnchor: true,
  sources: true,
})
  .extend({
    sourceIds: z.array(z.string().min(1)).min(1),
    links: z
      .object({
        self: z.string().startsWith("/api/"),
        scene: z.string().startsWith("/"),
      })
      .strict(),
  })
  .strict();

export type ReleaseRegistryRecord = z.infer<
  typeof ReleaseRegistryRecordSchema
>;

const FacetValueSchema = z
  .object({ value: z.string().min(1), count: z.number().int().positive() })
  .strict();

export const ReleaseDescriptorSchema = z
  .object({
    apiVersion: z.literal(RELEASE_API_VERSION),
    releaseId: ReleaseIdSchema,
    contentVersion: z.string().min(1),
    schemaVersion: SchemaVersionSchema,
    generatedAt: z.string().datetime(),
    servingMode: z.literal("embedded-foundation-fixture"),
    fixtureStatus: z.literal("foundation"),
    manifest: z
      .object({ sha256: z.string().regex(/^[0-9a-f]{64}$/) })
      .strict(),
    content: z
      .object({
        canonicalization: z.literal(RELEASE_BUNDLE_CANONICALIZATION),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict(),
    derivatives: z
      .object({
        registryProjectionVersion: z.literal(
          RELEASE_REGISTRY_PROJECTION_VERSION,
        ),
        searchRankerVersion: z.literal(RELEASE_SEARCH_RANKER_VERSION),
      })
      .strict(),
    counts: z
      .object({
        entities: z.number().int().nonnegative(),
        sources: z.number().int().nonnegative(),
        agencies: z.number().int().nonnegative(),
      })
      .strict(),
    facets: z
      .object({
        sections: z.array(FacetValueSchema),
        domains: z.array(FacetValueSchema),
        kinds: z.array(FacetValueSchema),
        evidence: z.array(FacetValueSchema),
      })
      .strict(),
    sources: z.array(SourceReferenceSchema),
    agencies: z.array(MissionAgencySchema),
    warning: z.string().min(1),
    links: z
      .object({
        self: z.string().startsWith("/api/"),
        registry: z.string().startsWith("/api/"),
        search: z.string().startsWith("/api/"),
      })
      .strict(),
  })
  .strict();

export type ReleaseDescriptor = z.infer<typeof ReleaseDescriptorSchema>;

export class ReleaseRegistryQueryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ReleaseRegistryQueryError";
    this.code = code;
  }
}

const CursorSchema = z
  .object({
    version: z.literal(1),
    releaseId: ReleaseIdSchema,
    mode: z.enum(["registry", "search"]),
    query: z.string().nullable(),
    filters: z
      .object({
        section: AtlasSectionSchema.nullable(),
        domain: ScaleDomainSchema.nullable(),
        kind: AtlasKindSchema.nullable(),
        evidence: EvidenceClassSchema.nullable(),
      })
      .strict(),
    registryProjectionVersion: z.literal(RELEASE_REGISTRY_PROJECTION_VERSION),
    searchRankerVersion: z.literal(RELEASE_SEARCH_RANKER_VERSION),
    offset: z.number().int().positive(),
  })
  .strict();

type CursorPayload = z.infer<typeof CursorSchema>;

type CursorBinding = Omit<CursorPayload, "version" | "offset">;

type ReleaseSnapshot = Readonly<{
  descriptor: ReleaseDescriptor;
  records: readonly ReleaseRegistryRecord[];
  recordsById: ReadonlyMap<string, ReleaseRegistryRecord>;
  bundleCanonicalJson: string;
}>;

export type RegistryPage = Readonly<{
  records: readonly ReleaseRegistryRecord[];
  count: number;
  total: number;
  nextCursor: string | null;
}>;

export type ReleaseSearchResult = Readonly<
  ReleaseRegistryRecord & {
    relevance: Readonly<{
      score: number;
      matchedFields: readonly string[];
    }>;
  }
>;

export type SearchPage = Readonly<{
  query: string;
  records: readonly ReleaseSearchResult[];
  count: number;
  total: number;
  nextCursor: string | null;
}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function compareText(left: string, right: string): number {
  const leftKey = left.normalize("NFKC").toLowerCase();
  const rightKey = right.normalize("NFKC").toLowerCase();
  if (leftKey < rightKey) return -1;
  if (leftKey > rightKey) return 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalNavigationBundleJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Release bundles cannot contain non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value
      .map((entry) => canonicalNavigationBundleJson(entry))
      .join(",")}]`;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .filter((key) => object[key] !== undefined)
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalNavigationBundleJson(object[key])}`,
      )
      .join(",")}}`;
  }
  throw new Error("Release bundles must contain only JSON values");
}

function facet(
  records: readonly ReleaseRegistryRecord[],
  select: (record: ReleaseRegistryRecord) => string,
) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const value = select(record);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .sort(([left], [right]) => compareText(left, right))
    .map(([value, count]) => ({ value, count }));
}

function registryRecord(entity: AtlasEntity): ReleaseRegistryRecord {
  const releaseId = atlasRelease.id;
  return ReleaseRegistryRecordSchema.parse({
    id: entity.id,
    slug: entity.slug,
    name: entity.name,
    subtitle: entity.subtitle,
    summary: entity.summary,
    kind: entity.kind,
    domain: entity.domain,
    section: entity.section,
    breadcrumb: [...entity.breadcrumb],
    distanceLabel: entity.distanceLabel,
    scaleLabel: entity.scaleLabel,
    ...(entity.routeDistanceFromSunLy === undefined
      ? {}
      : { routeDistanceFromSunLy: entity.routeDistanceFromSunLy }),
    tags: [...entity.tags],
    facts: entity.facts.map((fact) => ({ ...fact })),
    representation: { ...entity.representation },
    sourceIds: entity.sources.map((source) => source.id).sort(compareText),
    links: {
      self: `/api/v1/releases/${releaseId}/registry/${encodeURIComponent(entity.id)}`,
      scene: `/?focus=${encodeURIComponent(entity.slug)}&release=${releaseId}`,
    },
  });
}

export function parseFoundationReleaseFixture(input: {
  entities: unknown;
  sources: unknown;
  agencies: unknown;
}) {
  return {
    parsedEntities: AtlasEntitySchema.array().parse(input.entities),
    registeredSources: SourceReferenceSchema.array().parse(input.sources),
    registeredAgencies: MissionAgencySchema.array().parse(input.agencies),
  };
}

function createFoundationSnapshot(): ReleaseSnapshot {
  const manifest = FoundationReleaseManifestSchema.parse(
    foundationReleaseManifestJson,
  );
  if (
    manifest.releaseId !== atlasRelease.id ||
    manifest.generatedAt !== atlasRelease.generatedAt ||
    manifest.status !== atlasRelease.status
  ) {
    throw new Error("Foundation release manifest and atlas metadata have drifted");
  }

  const { parsedEntities, registeredSources, registeredAgencies } =
    parseFoundationReleaseFixture({
      entities: atlasEntities,
      sources: Object.values(sources),
      agencies: missionAgencies,
    });
  const sourceIds = new Set(registeredSources.map((source) => source.id));
  if (sourceIds.size !== registeredSources.length) {
    throw new Error("Foundation source identifiers must be unique");
  }
  if (
    new Set(registeredAgencies.map((agency) => agency.id)).size !==
    registeredAgencies.length
  ) {
    throw new Error("Foundation agency identifiers must be unique");
  }

  const canonicalSources = new Map(
    registeredSources.map((source) => [
      source.id,
      canonicalNavigationBundleJson(source),
    ]),
  );
  const referencedSourceIds = new Set<string>();
  for (const entity of parsedEntities) {
    const entitySourceIds = new Set<string>();
    for (const source of entity.sources) {
      if (entitySourceIds.has(source.id)) {
        throw new Error(
          `Foundation entity ${entity.id} contains duplicate source ${source.id}`,
        );
      }
      entitySourceIds.add(source.id);
      referencedSourceIds.add(source.id);
      const canonicalSource = canonicalSources.get(source.id);
      if (!canonicalSource) {
        throw new Error(
          `Foundation entity ${entity.id} references unknown source ${source.id}`,
        );
      }
      if (canonicalSource !== canonicalNavigationBundleJson(source)) {
        throw new Error(
          `Foundation entity ${entity.id} has drifted metadata for source ${source.id}`,
        );
      }
    }
  }
  if (referencedSourceIds.size !== registeredSources.length) {
    throw new Error(
      "Every published foundation source must be referenced by an entity",
    );
  }

  const records = parsedEntities
    .map(registryRecord)
    .sort(
      (left, right) =>
        compareText(left.name, right.name) || compareText(left.id, right.id),
    );
  const recordIds = new Set(records.map((record) => record.id));
  const slugs = new Set(records.map((record) => record.slug));
  const representationIds = new Set(
    records.map((record) => record.representation.id),
  );
  if (
    recordIds.size !== records.length ||
    slugs.size !== records.length ||
    representationIds.size !== records.length
  ) {
    throw new Error(
      "Foundation entity, slug, and representation identifiers must be unique",
    );
  }
  for (const record of records) {
    for (const sourceId of record.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        throw new Error(
          `Foundation entity ${record.id} references unknown source ${sourceId}`,
        );
      }
    }
  }
  if (
    atlasRelease.entityCount !== records.length ||
    atlasRelease.sourceCount !== registeredSources.length ||
    manifest.counts.entities !== records.length ||
    manifest.counts.sources !== registeredSources.length ||
    manifest.counts.agencies !== registeredAgencies.length ||
    manifest.content.sha256 !== FOUNDATION_BUNDLE_SHA256
  ) {
    throw new Error("Foundation release counts have drifted from the registry");
  }

  const basePath = `/api/v1/releases/${atlasRelease.id}`;
  const bundleCanonicalJson = canonicalNavigationBundleJson({
    format: "cosmography-embedded-release-bundle-v1",
    release: {
      releaseId: manifest.releaseId,
      contentVersion: manifest.version,
      schemaVersion: manifest.schemaVersion,
      generatedAt: manifest.generatedAt,
      warning: atlasRelease.warning,
      derivatives: manifest.derivatives,
    },
    entities: [...parsedEntities].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    sources: [...registeredSources].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    agencies: [...registeredAgencies].sort((left, right) =>
      compareText(left.id, right.id),
    ),
  });
  const descriptor = ReleaseDescriptorSchema.parse({
    apiVersion: RELEASE_API_VERSION,
    releaseId: atlasRelease.id,
    contentVersion: manifest.version,
    schemaVersion: manifest.schemaVersion,
    generatedAt: manifest.generatedAt,
    servingMode: manifest.representation,
    fixtureStatus: manifest.status,
    manifest: { sha256: FOUNDATION_MANIFEST_SHA256 },
    content: {
      canonicalization: RELEASE_BUNDLE_CANONICALIZATION,
      sha256: manifest.content.sha256,
    },
    derivatives: manifest.derivatives,
    counts: {
      entities: records.length,
      sources: registeredSources.length,
      agencies: registeredAgencies.length,
    },
    facets: {
      sections: facet(records, (record) => record.section),
      domains: facet(records, (record) => record.domain),
      kinds: facet(records, (record) => record.kind),
      evidence: facet(records, (record) => record.representation.evidence),
    },
    sources: [...registeredSources].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    agencies: [...registeredAgencies].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    warning: manifest.warning,
    links: {
      self: basePath,
      registry: `${basePath}/registry`,
      search: `${basePath}/search{?q,section,domain,kind,evidence,limit,cursor}`,
    },
  });

  deepFreeze(records);
  deepFreeze(descriptor);
  deepFreeze(registeredAgencies);
  return Object.freeze({
    descriptor,
    records,
    recordsById: new Map(records.map((record) => [record.id, record])),
    bundleCanonicalJson,
  });
}

const foundationSnapshot = createFoundationSnapshot();
const snapshots = new Map<string, ReleaseSnapshot>([
  [foundationSnapshot.descriptor.releaseId, foundationSnapshot],
]);

export function getReleaseSnapshot(
  releaseId: string,
): Readonly<Pick<ReleaseSnapshot, "descriptor" | "records">> | undefined {
  const snapshot = snapshots.get(releaseId);
  if (!snapshot) return undefined;
  return Object.freeze({
    descriptor: snapshot.descriptor,
    records: snapshot.records,
  });
}

export function getReleaseRegistryRecord(
  releaseId: string,
  entityId: string,
): ReleaseRegistryRecord | undefined {
  return snapshots.get(releaseId)?.recordsById.get(entityId);
}

function digestHex(bytes: Uint8Array): string {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function calculateReleaseBundleSha256(
  releaseId: string,
): Promise<string> {
  const snapshot = snapshotOrThrow(releaseId);
  return digestHex(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(snapshot.bundleCanonicalJson),
      ),
    ),
  );
}

const integrityChecks = new Map<string, Promise<void>>();

export function assertReleaseBundleIntegrity(releaseId: string): Promise<void> {
  const existing = integrityChecks.get(releaseId);
  if (existing) return existing;
  const check = calculateReleaseBundleSha256(releaseId).then((actual) => {
    const expected = snapshots.get(releaseId)?.descriptor.content.sha256;
    if (!expected || actual !== expected) {
      throw new Error(
        `Embedded release bundle ${releaseId} does not match its pinned content digest`,
      );
    }
  });
  integrityChecks.set(releaseId, check);
  return check;
}

function canonicalFilters(filters: RegistryFilters): CursorPayload["filters"] {
  const parsed = RegistryFilterSchema.parse(filters);
  return {
    section: parsed.section ?? null,
    domain: parsed.domain ?? null,
    kind: parsed.kind ?? null,
    evidence: parsed.evidence ?? null,
  };
}

function matchesFilters(
  record: ReleaseRegistryRecord,
  filters: RegistryFilters,
): boolean {
  return (
    (!filters.section || record.section === filters.section) &&
    (!filters.domain || record.domain === filters.domain) &&
    (!filters.kind || record.kind === filters.kind) &&
    (!filters.evidence || record.representation.evidence === filters.evidence)
  );
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,2048}$/u.test(value)) {
    throw new ReleaseRegistryQueryError(
      "invalid_cursor",
      "The pagination cursor is malformed.",
    );
  }
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ReleaseRegistryQueryError(
      "invalid_cursor",
      "The pagination cursor is malformed.",
    );
  }
}

function cursorOffset(cursor: string | undefined, binding: CursorBinding): number {
  if (!cursor) return 0;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(decodeBase64Url(cursor));
  } catch (error) {
    if (error instanceof ReleaseRegistryQueryError) throw error;
    throw new ReleaseRegistryQueryError(
      "invalid_cursor",
      "The pagination cursor is malformed.",
    );
  }
  const parsed = CursorSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new ReleaseRegistryQueryError(
      "invalid_cursor",
      "The pagination cursor is malformed.",
    );
  }
  const expectedBinding = JSON.stringify(binding);
  const actualBinding = JSON.stringify({
    releaseId: parsed.data.releaseId,
    mode: parsed.data.mode,
    query: parsed.data.query,
    filters: parsed.data.filters,
    registryProjectionVersion: parsed.data.registryProjectionVersion,
    searchRankerVersion: parsed.data.searchRankerVersion,
  });
  if (actualBinding !== expectedBinding) {
    throw new ReleaseRegistryQueryError(
      "cursor_context_mismatch",
      "The pagination cursor belongs to a different release or query.",
    );
  }
  return parsed.data.offset;
}

function nextCursor(
  binding: CursorBinding,
  offset: number,
  total: number,
): string | null {
  if (offset >= total) return null;
  return encodeBase64Url(
    JSON.stringify(CursorSchema.parse({ version: 1, ...binding, offset })),
  );
}

function validateLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ReleaseRegistryQueryError(
      "invalid_limit",
      "The page limit must be an integer from 1 through 50.",
    );
  }
}

function snapshotOrThrow(releaseId: string): ReleaseSnapshot {
  const snapshot = snapshots.get(releaseId);
  if (!snapshot) {
    throw new ReleaseRegistryQueryError(
      "release_not_found",
      "The requested immutable release is not available.",
    );
  }
  return snapshot;
}

export function listReleaseRegistry(input: {
  releaseId: string;
  filters?: RegistryFilters;
  limit?: number;
  cursor?: string;
}): RegistryPage {
  const snapshot = snapshotOrThrow(input.releaseId);
  const filters = RegistryFilterSchema.parse(input.filters ?? {});
  const limit = input.limit ?? 20;
  validateLimit(limit);
  const binding: CursorBinding = {
    releaseId: input.releaseId,
    mode: "registry",
    query: null,
    filters: canonicalFilters(filters),
    registryProjectionVersion: RELEASE_REGISTRY_PROJECTION_VERSION,
    searchRankerVersion: RELEASE_SEARCH_RANKER_VERSION,
  };
  const offset = cursorOffset(input.cursor, binding);
  const matches = snapshot.records.filter((record) =>
    matchesFilters(record, filters),
  );
  if (offset > matches.length) {
    throw new ReleaseRegistryQueryError(
      "invalid_cursor",
      "The pagination cursor is outside this immutable result set.",
    );
  }
  const records = matches.slice(offset, offset + limit);
  return deepFreeze({
    records,
    count: records.length,
    total: matches.length,
    nextCursor: nextCursor(binding, offset + records.length, matches.length),
  });
}

export function normalizeSearchQuery(value: string): string {
  const query = value.normalize("NFKC").replace(/\s+/gu, " ").trim();
  if (
    query.length === 0 ||
    [...query].length > 160 ||
    /\p{C}/u.test(query) ||
    !/[\p{L}\p{N}\p{P}\p{S}]/u.test(query)
  ) {
    throw new ReleaseRegistryQueryError(
      "invalid_query",
      "Search text must contain 1 through 160 visible characters.",
    );
  }
  return query.toLowerCase();
}

const searchFieldWeights = {
  name: 120,
  id: 110,
  slug: 110,
  tags: 85,
  subtitle: 70,
  breadcrumb: 60,
  kind: 50,
  section: 45,
  domain: 45,
  evidence: 45,
  facts: 35,
  summary: 25,
  sources: 20,
} as const;

type SearchFieldName = keyof typeof searchFieldWeights;
type NormalizedSearchField = readonly [SearchFieldName, string];

const sourceLookupCache = new WeakMap<
  ReleaseDescriptor,
  ReadonlyMap<string, SourceReference>
>();
const normalizedSearchFieldCache = new WeakMap<
  ReleaseRegistryRecord,
  readonly NormalizedSearchField[]
>();

function sourceLookup(descriptor: ReleaseDescriptor) {
  const existing = sourceLookupCache.get(descriptor);
  if (existing) return existing;
  const lookup = new Map(
    descriptor.sources.map((source) => [source.id, source]),
  );
  sourceLookupCache.set(descriptor, lookup);
  return lookup;
}

function searchableFields(
  record: ReleaseRegistryRecord,
  descriptor: ReleaseDescriptor,
) {
  const sourceById = sourceLookup(descriptor);
  return {
    name: record.name,
    id: record.id,
    slug: record.slug,
    tags: record.tags.join(" "),
    subtitle: record.subtitle,
    breadcrumb: record.breadcrumb.join(" "),
    kind: record.kind,
    section: record.section,
    domain: record.domain,
    evidence: record.representation.evidence,
    facts: record.facts.map((fact) => `${fact.label} ${fact.value}`).join(" "),
    summary: record.summary,
    sources: record.sourceIds
      .map((sourceId) => {
        const source = sourceById.get(sourceId);
        return source
          ? `${source.id} ${source.title} ${source.publisher} ${source.release}`
          : sourceId;
      })
      .join(" "),
  } satisfies Record<keyof typeof searchFieldWeights, string>;
}

function normalizedSearchFields(
  record: ReleaseRegistryRecord,
  descriptor: ReleaseDescriptor,
): readonly NormalizedSearchField[] {
  const existing = normalizedSearchFieldCache.get(record);
  if (existing) return existing;
  const fields = Object.entries(searchableFields(record, descriptor)).map(
    ([name, value]) =>
      [
        name as SearchFieldName,
        value.normalize("NFKC").toLowerCase(),
      ] as const,
  );
  deepFreeze(fields);
  normalizedSearchFieldCache.set(record, fields);
  return fields;
}

function scoreRecord(
  record: ReleaseRegistryRecord,
  descriptor: ReleaseDescriptor,
  query: string,
): { score: number; matchedFields: string[] } | null {
  const terms = query.split(" ");
  const fields = normalizedSearchFields(record, descriptor);
  if (!terms.every((term) => fields.some(([, value]) => value.includes(term)))) {
    return null;
  }

  let score = 0;
  const matchedFields: string[] = [];
  for (const [name, value] of fields) {
    const weight = searchFieldWeights[name];
    const words = value.split(/[^\p{L}\p{N}*._-]+/u).filter(Boolean);
    if (terms.some((term) => value.includes(term))) matchedFields.push(name);
    if (value === query) score += weight * 12;
    else if (value.startsWith(query)) score += weight * 8;
    else if (words.includes(query)) score += weight * 7;
    else if (words.some((word) => word.startsWith(query))) score += weight * 5;
    else if (value.includes(query)) score += weight * 3;

    for (const term of terms) {
      if (words.includes(term)) score += weight * 2;
      else if (words.some((word) => word.startsWith(term))) score += weight;
      else if (value.includes(term)) score += Math.max(1, Math.floor(weight / 3));
    }
  }
  return { score, matchedFields };
}

export function searchReleaseRegistry(input: {
  releaseId: string;
  query: string;
  filters?: RegistryFilters;
  limit?: number;
  cursor?: string;
}): SearchPage {
  const snapshot = snapshotOrThrow(input.releaseId);
  const filters = RegistryFilterSchema.parse(input.filters ?? {});
  const limit = input.limit ?? 20;
  validateLimit(limit);
  const query = normalizeSearchQuery(input.query);
  const binding: CursorBinding = {
    releaseId: input.releaseId,
    mode: "search",
    query,
    filters: canonicalFilters(filters),
    registryProjectionVersion: RELEASE_REGISTRY_PROJECTION_VERSION,
    searchRankerVersion: RELEASE_SEARCH_RANKER_VERSION,
  };
  const offset = cursorOffset(input.cursor, binding);
  const matches: ReleaseSearchResult[] = [];
  for (const record of snapshot.records) {
    if (!matchesFilters(record, filters)) continue;
    const relevance = scoreRecord(record, snapshot.descriptor, query);
    if (relevance) matches.push({ ...record, relevance });
  }
  matches.sort(
    (left, right) =>
      right.relevance.score - left.relevance.score ||
      compareText(left.name, right.name) ||
      compareText(left.id, right.id),
  );
  if (offset > matches.length) {
    throw new ReleaseRegistryQueryError(
      "invalid_cursor",
      "The pagination cursor is outside this immutable result set.",
    );
  }
  const records = matches.slice(offset, offset + limit);
  return deepFreeze({
    query,
    records,
    count: records.length,
    total: matches.length,
    nextCursor: nextCursor(binding, offset + records.length, matches.length),
  });
}
