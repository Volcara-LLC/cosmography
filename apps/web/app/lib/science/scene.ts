import { z } from "zod";

export const scaleDomains = [
  "lightcone",
  "extragalactic",
  "galactic",
  "system",
  "globe",
  "surface",
  "panorama",
  "simulation",
] as const;

export const ScaleDomainSchema = z.enum(scaleDomains);
export type ScaleDomain = z.infer<typeof ScaleDomainSchema>;

export const atlasKinds = [
  "universe",
  "structure",
  "galaxy",
  "black-hole",
  "star",
  "system",
  "world",
  "surface-place",
  "spacecraft",
  "observation",
  "exploration-network",
] as const;

export const AtlasKindSchema = z.enum(atlasKinds);
export type AtlasKind = z.infer<typeof AtlasKindSchema>;

export const atlasSections = [
  "cosmology",
  "galaxies",
  "stars",
  "systems",
  "worlds",
  "missions",
  "earth",
] as const;

export const AtlasSectionSchema = z.enum(atlasSections);
export type AtlasSection = z.infer<typeof AtlasSectionSchema>;

export const AtlasNavigationIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,119}$/);

export const evidenceClasses = [
  "direct-observation",
  "calibrated-observation",
  "catalog-measurement",
  "derived-result",
  "scientific-reconstruction",
  "physics-simulation",
  "artist-interpretation",
] as const;

export const EvidenceClassSchema = z.enum(evidenceClasses);
export type EvidenceClass = z.infer<typeof EvidenceClassSchema>;

export const AppearanceClassSchema = z.enum([
  "calibrated-radiometric",
  "natural-color",
  "approximate-natural-color",
  "representative-color",
  "colorized-measurement",
  "procedural-scientific",
  "cinematic",
  "artist-texture",
]);

export const GeometryClassSchema = z.enum([
  "true-scale",
  "logarithmic-scale",
  "exaggerated-size",
  "exaggerated-elevation",
  "display-offset",
  "not-to-scale",
]);

export const TimeStateSchema = z.enum([
  "observed",
  "reconstructed-historical",
  "latest-published-estimate",
  "interpolated",
  "predicted",
  "conceptual",
]);

export const AiInvolvementSchema = z.enum([
  "none-declared",
  "assistive-processing",
  "generative-output",
]);

export const SourceReferenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  release: z.string().min(1),
  retrievedAt: z.string().date(),
  licenseStatus: z.enum([
    "public-domain-review-required",
    "open-with-attribution",
    "collection-specific",
    "link-only",
  ]),
  credit: z.string().min(1),
});

export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const RepresentationSchema = z.object({
  id: z.string().min(1),
  evidence: EvidenceClassSchema,
  appearance: AppearanceClassSchema,
  geometry: GeometryClassSchema,
  timeState: TimeStateSchema,
  aiInvolvement: AiInvolvementSchema,
  sourceRelease: z.string().min(1),
  frame: z.string().min(1),
  epoch: z.string().min(1),
  uncertainty: z.string().min(1),
  processing: z.string().min(1),
  displayTransform: z.string().min(1),
});

export type Representation = z.infer<typeof RepresentationSchema>;

export const AtlasEntitySchema = z.object({
  id: AtlasNavigationIdSchema,
  slug: AtlasNavigationIdSchema,
  name: z.string().min(1),
  subtitle: z.string().min(1),
  summary: z.string().min(1),
  kind: AtlasKindSchema,
  domain: ScaleDomainSchema,
  section: AtlasSectionSchema,
  breadcrumb: z.array(z.string().min(1)).min(1),
  distanceLabel: z.string().min(1),
  scaleLabel: z.string().min(1),
  routeDistanceFromSunLy: z.number().nonnegative().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  visualAnchor: z.tuple([z.number(), z.number(), z.number()]),
  tags: z.array(z.string().min(1)),
  facts: z.array(
    z.object({
      label: z.string().min(1),
      value: z.string().min(1),
    }),
  ),
  representation: RepresentationSchema,
  sources: z.array(SourceReferenceSchema).min(1),
});

export type AtlasEntity = z.infer<typeof AtlasEntitySchema>;

export const MissionAgencySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  countryOrRegion: z.string().min(1),
  scope: z.string().min(1),
  status: z.enum(["indexed", "connector-planned", "rights-review"]),
  sourceUrl: z.string().url(),
});

export type MissionAgency = z.infer<typeof MissionAgencySchema>;

export const SceneStateSchema = z.object({
  releaseId: z.string().min(1),
  domain: ScaleDomainSchema,
  focusId: z.string().min(1),
  camera: z.object({
    orientation: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    fovRadians: z.number().positive(),
    logRange: z.number().nonnegative(),
    localOffset: z.tuple([z.number(), z.number(), z.number()]).optional(),
  }),
  time: z.object({
    wholeDay: z.number().int(),
    dayFraction: z.number().min(0).max(1),
    scale: z.enum(["UTC", "TT", "TDB", "TCB"]),
    view: z.enum(["observer", "geometric", "catalog"]),
  }),
  observerId: z.string().min(1),
  layers: z.array(z.string().min(1)),
  appearance: z.enum(["scientific", "immersive"]),
  paused: z.boolean(),
});

export type SceneState = z.infer<typeof SceneStateSchema>;

export function assertPublishableRepresentation(
  value: unknown,
): Representation {
  return RepresentationSchema.parse(value);
}
