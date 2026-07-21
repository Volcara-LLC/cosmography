import { z } from "zod";

export const BlackHoleEvidenceSchema = z.enum([
  "direct-observation",
  "processed-observation",
  "interferometric-reconstruction",
  "catalog-measurement",
  "derived-result",
  "physics-simulation",
  "artist-interpretation",
]);

export const SourceCitationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  doi: z.string().optional(),
  release: z.string().min(1),
  retrievedAt: z.string().date(),
});

export const BlackHoleObjectSchema = z.object({
  id: z.string().regex(/^bh_[a-z0-9_]+$/),
  name: z.string().min(1),
  massSolar: z.number().positive(),
  massUncertaintySolar: z.number().nonnegative().optional(),
  distanceParsecs: z.number().positive(),
  distanceUncertaintyParsecs: z.number().nonnegative().optional(),
  dimensionlessSpin: z.number().min(-1).max(1).nullable(),
  inclinationDegrees: z.number().min(0).max(180).nullable(),
  parameterEvidence: BlackHoleEvidenceSchema,
  sources: z.array(SourceCitationSchema).min(1),
});

export const AccretionEmissionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("none"),
    statement: z.string().min(1),
  }),
  z.object({
    kind: z.literal("thin-disk-demonstration"),
    innerRadiusRg: z.number().positive(),
    outerRadiusRg: z.number().positive(),
    temperatureModel: z.string().min(1),
    opticalDepthModel: z.string().min(1),
    evidence: z.literal("physics-simulation"),
  }).refine((value) => value.outerRadiusRg > value.innerRadiusRg, {
    message: "The disk outer radius must exceed its inner radius.",
  }),
  z.object({
    kind: z.literal("grmhd-snapshot"),
    simulationCode: z.string().min(1),
    snapshotManifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
    radiativeTransferCode: z.string().min(1),
    observingFrequencyHz: z.number().positive(),
    evidence: z.literal("physics-simulation"),
  }),
]);

export type BlackHoleObject = z.infer<typeof BlackHoleObjectSchema>;
export type AccretionEmission = z.infer<typeof AccretionEmissionSchema>;
