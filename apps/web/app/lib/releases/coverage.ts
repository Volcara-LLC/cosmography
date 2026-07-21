import { z } from "zod";

import {
  stableJsonSha256,
  stableJsonStringify,
} from "@cosmography/scientific-model";

import {
  COVERAGE_PACK_CANONICALIZATION,
  COVERAGE_PACK_PROJECTION_VERSION,
  COVERAGE_PACK_SCHEMA_VERSION,
  COVERAGE_PACK_SET_CANONICALIZATION,
  CoveragePackIdSchema,
  CoveragePackKeySchema,
  CoverageReleaseBindingSchema,
  assertCoveragePackIntegrity,
  assertCoveragePackSetIntegrity,
  type CoveragePack,
  type CoveragePackKey,
  type CoveragePackSet,
} from "@cosmography/scientific-model/coverage-pack";

import {
  FOUNDATION_COVERAGE_GENERATED_AT,
  FOUNDATION_COVERAGE_PACK_IDS,
  FOUNDATION_RELEASE_ID,
  createFoundationCoveragePackSet,
} from "@/app/data/coverage/coverage-packs";
import {
  FOUNDATION_BUNDLE_SHA256,
  FOUNDATION_MANIFEST_SHA256,
} from "@/app/lib/releases/catalog";
import foundationCoverageManifestJson from "@/db/foundation-coverage-manifest.json";

export {
  FOUNDATION_COVERAGE_PACK_IDS,
  FOUNDATION_RELEASE_ID,
};

export const FOUNDATION_COVERAGE_MANIFEST_CANONICALIZATION =
  "cosmography-foundation-coverage-manifest-stable-json-v1" as const;
export const FOUNDATION_COVERAGE_MANIFEST_SHA256 =
  "8a2733bf5298f73bfa90006e71059737091bedcfc9e3d6f192dd08ef179d6326" as const;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const CoverageManifestPackSchema = z
  .object({
    coverageKey: CoveragePackKeySchema,
    packId: CoveragePackIdSchema,
    canonicalization: z.literal(COVERAGE_PACK_CANONICALIZATION),
    sha256: Sha256Schema,
    etag: z.string().regex(/^"cpack-sha256-[a-f0-9]{64}"$/),
  })
  .strict();

const FoundationCoverageManifestSchema = z
  .object({
    format: z.literal("cosmography-foundation-coverage-manifest-v1"),
    canonicalization: z.literal(
      FOUNDATION_COVERAGE_MANIFEST_CANONICALIZATION,
    ),
    schemaVersion: z.literal(COVERAGE_PACK_SCHEMA_VERSION),
    generatedAt: z.literal(FOUNDATION_COVERAGE_GENERATED_AT),
    sourceReleaseIncludesCoverageProjection: z.literal(false),
    coverageProjectionIsCompletenessClaim: z.literal(false),
    warning: z.string().trim().min(1),
    authority: z
      .object({
        sourceAuthenticityEstablished: z.literal(false),
        scientificValidationEstablished: z.literal(false),
        independentValidationEstablished: z.literal(false),
        completenessEstablished: z.literal(false),
        rightsClearanceEstablished: z.literal(false),
        runtimeUseAllowed: z.literal(false),
        renderAllowed: z.literal(false),
        publicationAllowed: z.literal(false),
        releaseEligible: z.literal(false),
        activationAllowed: z.literal(false),
      })
      .strict(),
    releaseBinding: CoverageReleaseBindingSchema,
    coverageSet: z
      .object({
        coverageSetId: z.literal("covset_foundation_coverage_v1"),
        projectionVersion: z.literal(COVERAGE_PACK_PROJECTION_VERSION),
        canonicalization: z.literal(COVERAGE_PACK_SET_CANONICALIZATION),
        sha256: Sha256Schema,
        etag: z.string().regex(/^"cpack-set-sha256-[a-f0-9]{64}"$/),
      })
      .strict(),
    packs: z.array(CoverageManifestPackSchema).length(4),
  })
  .strict();

const foundationReleaseBinding = Object.freeze(CoverageReleaseBindingSchema.parse({
  releaseId: FOUNDATION_RELEASE_ID,
  releaseGeneratedAt: "2026-07-19T00:00:00Z",
  releaseManifestSha256: FOUNDATION_MANIFEST_SHA256,
  releaseContentSha256: FOUNDATION_BUNDLE_SHA256,
}));

type CoverageSnapshot = Readonly<{
  set: CoveragePackSet;
  packsById: ReadonlyMap<string, CoveragePack>;
}>;

let cachedSnapshot: CoverageSnapshot | undefined;

function foundationCoverageSnapshot(): CoverageSnapshot {
  if (cachedSnapshot) return cachedSnapshot;
  const set = createFoundationCoveragePackSet(foundationReleaseBinding);
  cachedSnapshot = Object.freeze({
    set,
    packsById: new Map(set.packs.map((pack) => [pack.packId, pack])),
  });
  return cachedSnapshot;
}

export class ReleaseCoverageIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseCoverageIntegrityError";
  }
}

export function assertCoverageManifestMatches(
  setInput: unknown,
  manifestInput: unknown = foundationCoverageManifestJson,
): asserts setInput is CoveragePackSet {
  try {
    assertCoveragePackSetIntegrity(setInput);
    const set = setInput;
    if (
      set.packs.some(
        (pack) => pack.correctionLineage.kind === "superseding-correction",
      )
    ) {
      throw new Error(
        "Web Coverage Pack v1 cannot serve a superseding correction without loading and verifying its exact predecessor pair",
      );
    }
    const manifest = FoundationCoverageManifestSchema.parse(manifestInput);
    if (
      stableJsonStringify(manifestInput) !== stableJsonStringify(manifest) ||
      stableJsonSha256(manifest) !== FOUNDATION_COVERAGE_MANIFEST_SHA256
    ) {
      throw new Error(
        "Coverage manifest does not match its pinned canonical semantic digest",
      );
    }
    if (
      stableJsonStringify(manifest.releaseBinding) !==
        stableJsonStringify(set.releaseBinding) ||
      manifest.coverageSet.coverageSetId !== set.coverageSetId ||
      manifest.coverageSet.sha256 !== set.setSha256 ||
      manifest.coverageSet.etag !== set.etag ||
      manifest.coverageSet.canonicalization !== set.canonicalization
    ) {
      throw new Error("Coverage set does not match its pinned manifest");
    }
    const expectedPacks = manifest.packs;
    if (expectedPacks.length !== set.packs.length) {
      throw new Error("Coverage manifest and set pack counts differ");
    }
    for (const [index, pack] of set.packs.entries()) {
      assertCoveragePackIntegrity(pack);
      const expected = expectedPacks[index];
      if (
        !expected ||
        expected.coverageKey !== pack.coverageKey ||
        expected.packId !== pack.packId ||
        expected.sha256 !== pack.packSha256 ||
        expected.etag !== pack.etag ||
        expected.canonicalization !== pack.canonicalization
      ) {
        throw new Error("Coverage pack does not match its pinned manifest");
      }
    }
  } catch (error) {
    throw new ReleaseCoverageIntegrityError(
      error instanceof Error
        ? error.message
        : "Coverage projection integrity failed",
    );
  }
}

export function assertReleaseCoverageIntegrity(
  releaseId: string,
): CoveragePackSet {
  if (releaseId !== FOUNDATION_RELEASE_ID) {
    throw new ReleaseCoverageIntegrityError(
      "No pinned Coverage Pack manifest exists for this release",
    );
  }
  const set = foundationCoverageSnapshot().set;
  assertCoverageManifestMatches(set);
  return set;
}

export function getReleaseCoverageSet(
  releaseId: string,
): CoveragePackSet | undefined {
  if (releaseId !== FOUNDATION_RELEASE_ID) return undefined;
  return assertReleaseCoverageIntegrity(releaseId);
}

export function getReleaseCoveragePack(
  releaseId: string,
  packId: string,
): CoveragePack | undefined {
  if (releaseId !== FOUNDATION_RELEASE_ID) return undefined;
  assertReleaseCoverageIntegrity(releaseId);
  return foundationCoverageSnapshot().packsById.get(packId);
}

export function releaseCoverageApiPath(releaseId: string): string {
  return `/api/v1/releases/${encodeURIComponent(releaseId)}/coverage`;
}

export function releaseCoveragePackApiPath(
  releaseId: string,
  packId: string,
): string {
  return `${releaseCoverageApiPath(releaseId)}/${encodeURIComponent(packId)}`;
}

const scenePaths: Readonly<Record<CoveragePackKey, string>> = Object.freeze({
  "apollo-17": "/worlds/moon",
  "earth-network": "/earth",
  "mars-jezero": "/worlds/mars",
  "voyager-1": "/missions/voyager-1",
});

export function releaseCoverageScenePath(coverageKey: CoveragePackKey): string {
  return scenePaths[coverageKey];
}
