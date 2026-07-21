import type { AtlasEntity } from "@/app/lib/science/scene";

export type AtlasNamingBasis =
  | "accepted-astronomical-term"
  | "published-structure-name"
  | "catalog-designation"
  | "official-feature-name"
  | "mission-name"
  | "descriptive-release-label"
  | "release-label";

export interface AtlasScientificPresentation {
  readonly name: string;
  readonly classification: string;
  readonly namingBasis: AtlasNamingBasis;
  readonly scopeNote: string | null;
}

const presentations: Readonly<Record<string, AtlasScientificPresentation>> =
  Object.freeze({
    "observable-universe": Object.freeze({
      name: "Observable Universe",
      classification: "Observer-centered observable region",
      namingBasis: "accepted-astronomical-term",
      scopeNote:
        "Observable from our present location—not a physical center or a claim about everything that may exist beyond the cosmic horizon.",
    }),
    laniakea: Object.freeze({
      name: "Laniakea Supercluster",
      classification: "Flow-defined supercluster · reconstructed boundary",
      namingBasis: "published-structure-name",
      scopeNote:
        "Its boundary is inferred from galaxy motions and a reconstruction model, not observed as a bright physical edge.",
    }),
    "local-group": Object.freeze({
      name: "Local Group",
      classification: "Galaxy group",
      namingBasis: "accepted-astronomical-term",
      scopeNote: null,
    }),
    andromeda: Object.freeze({
      name: "Andromeda Galaxy",
      classification: "Spiral galaxy",
      namingBasis: "accepted-astronomical-term",
      scopeNote: null,
    }),
    "milky-way": Object.freeze({
      name: "Milky Way Galaxy",
      classification: "Our home galaxy",
      namingBasis: "accepted-astronomical-term",
      scopeNote: null,
    }),
    "sagittarius-a-star": Object.freeze({
      name: "Sagittarius A*",
      classification: "Milky Way central black hole",
      namingBasis: "catalog-designation",
      scopeNote: null,
    }),
    "proxima-centauri": Object.freeze({
      name: "Proxima Centauri",
      classification: "Red dwarf star",
      namingBasis: "accepted-astronomical-term",
      scopeNote: null,
    }),
    "trappist-1": Object.freeze({
      name: "TRAPPIST-1",
      classification: "Seven-planet system",
      namingBasis: "catalog-designation",
      scopeNote: null,
    }),
    "solar-system": Object.freeze({
      name: "Solar System",
      classification: "The Sun and its planetary system",
      namingBasis: "accepted-astronomical-term",
      scopeNote: null,
    }),
    mars: Object.freeze({
      name: "Mars",
      classification: "Terrestrial planet",
      namingBasis: "accepted-astronomical-term",
      scopeNote: null,
    }),
    jezero: Object.freeze({
      name: "Jezero Crater",
      classification: "Martian impact crater · Perseverance landing region",
      namingBasis: "official-feature-name",
      scopeNote: null,
    }),
    "apollo-17": Object.freeze({
      name: "Apollo 17 · Taurus–Littrow",
      classification: "Lunar valley and mission site",
      namingBasis: "mission-name",
      scopeNote: null,
    }),
    "voyager-1": Object.freeze({
      name: "Voyager 1",
      classification: "Interstellar spacecraft",
      namingBasis: "mission-name",
      scopeNote: null,
    }),
    "jwst-deep-fields": Object.freeze({
      name: "Webb Deep Fields",
      classification: "Deep-field observations",
      namingBasis: "descriptive-release-label",
      scopeNote: null,
    }),
    "earth-exploration-network": Object.freeze({
      name: "Earth Exploration Network",
      classification: "Space-exploration sites and institutions",
      namingBasis: "descriptive-release-label",
      scopeNote: null,
    }),
  });

const breadcrumbLabels: Readonly<Record<string, string>> = Object.freeze({
  "Known Universe": "Observable Universe",
  Laniakea: "Laniakea Supercluster",
  "Milky Way": "Milky Way Galaxy",
});

export const atlasScientificPresentationIds = Object.freeze(
  Object.keys(presentations),
);

export function atlasScientificPresentationFor(
  entity: Pick<AtlasEntity, "id" | "name" | "kind">,
): AtlasScientificPresentation {
  return (
    presentations[entity.id] ??
    Object.freeze({
      name: entity.name,
      classification: entity.kind.replaceAll("-", " "),
      namingBasis: "release-label" as const,
      scopeNote:
        "No separately reviewed public astronomical name is registered for this release identity.",
    })
  );
}

export function atlasScientificNameFor(
  entityId: string,
  releaseName: string,
): string {
  return presentations[entityId]?.name ?? releaseName;
}

export function atlasScientificBreadcrumbLabel(label: string): string {
  return breadcrumbLabels[label] ?? label;
}
