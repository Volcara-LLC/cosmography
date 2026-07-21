import { atlasEntities, atlasRelease } from "@/app/data/atlas";
import type { AtlasSection, ScaleDomain } from "@/app/lib/science/scene";
import {
  atlasScientificPresentationFor,
  type AtlasNamingBasis,
} from "@/app/lib/presentation/atlas-scientific-labels";
import {
  FOUNDATION_BUNDLE_SHA256,
  FOUNDATION_MANIFEST_SHA256,
  FOUNDATION_RELEASE_ID,
} from "@/app/lib/releases/foundation-identity";

export const FOUNDATION_LABEL_RELEASE_ID = FOUNDATION_RELEASE_ID;
export const FOUNDATION_LABEL_MANIFEST_SHA256 = FOUNDATION_MANIFEST_SHA256;
export const FOUNDATION_LABEL_BUNDLE_SHA256 = FOUNDATION_BUNDLE_SHA256;
export const FOUNDATION_PROJECTED_LABEL_SET_SHA256 =
  "6d7e25a2c2d75310e6dc9a1d6f29ca2029f30e7c1c48799cc818d7125235fb8d" as const;

export const foundationProjectedLabelTruth = Object.freeze({
  releaseEntityIdentityBound: true,
  releaseRecordMutated: false,
  scientificPresentationLabel: true,
  semanticDisplayPlacement: true,
  scientificPositionClaim: false,
  physicalProximityClaim: false,
  catalogCompletenessClaim: false,
  externalCatalogStreamingActive: false,
  proceduralParticleIdentityClaim: false,
});

export interface FoundationProjectedLabel {
  readonly releaseId: typeof FOUNDATION_LABEL_RELEASE_ID;
  readonly manifestSha256: typeof FOUNDATION_LABEL_MANIFEST_SHA256;
  readonly bundleSha256: typeof FOUNDATION_LABEL_BUNDLE_SHA256;
  readonly id: string;
  readonly releaseName: string;
  readonly name: string;
  readonly designation: string | null;
  readonly kindLabel: string;
  readonly namingBasis: AtlasNamingBasis;
  readonly scopeNote: string | null;
  readonly domain: ScaleDomain;
  readonly section: AtlasSection;
  readonly color: string;
  readonly visualAnchor: readonly [number, number, number];
  readonly sourceIds: readonly string[];
  readonly priority: number;
  readonly truth: typeof foundationProjectedLabelTruth;
}

const exactFoundationEntityIds = Object.freeze([
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
] as const);

const designationById: Readonly<Record<string, string>> = Object.freeze({
  andromeda: "M31",
});

if (
  atlasRelease.id !== FOUNDATION_LABEL_RELEASE_ID ||
  atlasEntities.length !== exactFoundationEntityIds.length ||
  atlasEntities.some((entity, index) => entity.id !== exactFoundationEntityIds[index])
) {
  throw new Error("Projected foundation labels do not match the frozen atlas release");
}

export const foundationProjectedLabels: readonly FoundationProjectedLabel[] =
  Object.freeze(
    atlasEntities.map((entity, index) => {
      const presentation = atlasScientificPresentationFor(entity);
      return Object.freeze({
        releaseId: FOUNDATION_LABEL_RELEASE_ID,
        manifestSha256: FOUNDATION_LABEL_MANIFEST_SHA256,
        bundleSha256: FOUNDATION_LABEL_BUNDLE_SHA256,
        id: entity.id,
        releaseName: entity.name,
        name: presentation.name,
        designation: designationById[entity.id] ?? null,
        kindLabel: presentation.classification,
        namingBasis: presentation.namingBasis,
        scopeNote: presentation.scopeNote,
        domain: entity.domain,
        section: entity.section,
        color: entity.color,
        visualAnchor: Object.freeze([...entity.visualAnchor]) as readonly [
          number,
          number,
          number,
        ],
        sourceIds: Object.freeze(entity.sources.map((source) => source.id)),
        priority: exactFoundationEntityIds.length - index,
        truth: foundationProjectedLabelTruth,
      });
    }),
  );

const labelById = new Map(
  foundationProjectedLabels.map((label) => [label.id, label] as const),
);

export function foundationProjectedLabelFor(
  entityId: string,
): FoundationProjectedLabel | undefined {
  return labelById.get(entityId);
}

// These are same-renderer semantic peers, not physical-nearness edges. Cross-domain
// parent/child navigation stays in the atlas shell because its coordinates are not
// valid inside the selected renderer's camera space.
export const foundationLabelDisplayPeers: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    "observable-universe": Object.freeze(["jwst-deep-fields"]),
    laniakea: Object.freeze(["local-group", "andromeda"]),
    "local-group": Object.freeze(["laniakea", "andromeda"]),
    andromeda: Object.freeze(["local-group", "laniakea"]),
    "milky-way": Object.freeze(["proxima-centauri"]),
    "sagittarius-a-star": Object.freeze([]),
    "proxima-centauri": Object.freeze(["milky-way"]),
    "trappist-1": Object.freeze(["solar-system"]),
    "solar-system": Object.freeze(["trappist-1"]),
    mars: Object.freeze([]),
    jezero: Object.freeze([]),
    "apollo-17": Object.freeze([]),
    "voyager-1": Object.freeze([]),
    "jwst-deep-fields": Object.freeze(["observable-universe"]),
    "earth-exploration-network": Object.freeze([]),
  });

export function foundationProjectedLabelsForSelection(
  selectedId: string,
): readonly FoundationProjectedLabel[] {
  const selected = labelById.get(selectedId);
  if (!selected) return Object.freeze([]);
  const includedIds = new Set([
    selectedId,
    ...(foundationLabelDisplayPeers[selectedId] ?? []),
  ]);
  return Object.freeze(
    foundationProjectedLabels.filter((label) => includedIds.has(label.id)),
  );
}

export function canonicalFoundationProjectedLabelSet(): string {
  return JSON.stringify(
    {
      labels: foundationProjectedLabels.map((label) => ({
        releaseId: label.releaseId,
        manifestSha256: label.manifestSha256,
        bundleSha256: label.bundleSha256,
        id: label.id,
        releaseName: label.releaseName,
        name: label.name,
        designation: label.designation,
        kindLabel: label.kindLabel,
        namingBasis: label.namingBasis,
        scopeNote: label.scopeNote,
        domain: label.domain,
        section: label.section,
        color: label.color,
        visualAnchor: label.visualAnchor,
        sourceIds: label.sourceIds,
        priority: label.priority,
        truth: label.truth,
      })),
      displayPeers: exactFoundationEntityIds.map((id) => ({
        id,
        peers: foundationLabelDisplayPeers[id] ?? [],
      })),
    },
  );
}
