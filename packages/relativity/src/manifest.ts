import { z } from "zod";
import { AccretionEmissionSchema, BlackHoleObjectSchema, SourceCitationSchema } from "./models.js";

const RepresentationLabelSchema = z.object({
  evidence: z.literal("physics-simulation"),
  appearance: z.enum(["radiative-transfer", "representative-color", "cinematic"]),
  geometry: z.literal("kerr-spacetime"),
  timeState: z.enum(["parameter-snapshot", "simulation-time", "conceptual"]),
  aiInvolvement: z.enum(["none-declared", "assistive-processing", "generative-output"]),
});

export const BlackHoleRenderManifestSchema = z
  .object({
    id: z.string().regex(/^bhr_[a-z0-9_]+$/),
    schemaVersion: z.literal("0.1.0"),
    object: BlackHoleObjectSchema,
    camera: z.object({
      radiusRg: z.number().positive(),
      inclinationDegrees: z.number().min(0).max(180),
      azimuthDegrees: z.number(),
      fieldOfViewDegrees: z.number().positive().max(170),
      tetradDefinition: z.string().min(1),
      motionModel: z.string().min(1),
    }),
    integrator: z.object({
      metric: z.literal("Kerr"),
      coordinateSystem: z.literal("Boyer-Lindquist"),
      method: z.string().min(1),
      codeCommit: z.string().min(7),
      absoluteTolerance: z.number().positive(),
      relativeTolerance: z.number().positive(),
      maxSteps: z.number().int().positive(),
      rayBundleMode: z.enum(["single-ray", "elliptical-bundle"]),
    }),
    emission: AccretionEmissionSchema,
    backgroundManifestSha256: z.string().regex(/^[0-9a-f]{64}$/),
    label: RepresentationLabelSchema,
    references: z.array(SourceCitationSchema).min(1),
    validation: z.object({
      schwarzschildDeflection: z.literal("passed"),
      criticalCurve: z.literal("passed"),
      conservationConstants: z.literal("passed"),
      stepConvergence: z.literal("passed"),
      independentReference: z.literal("passed"),
      reportSha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  })
  .superRefine((value, context) => {
    const spin = value.object.dimensionlessSpin;
    if (spin === null) {
      context.addIssue({
        code: "custom",
        path: ["object", "dimensionlessSpin"],
        message: "A Kerr render requires an explicit spin assumption, even when it is only a scenario parameter.",
      });
    }
    if (value.label.aiInvolvement === "generative-output") {
      context.addIssue({
        code: "custom",
        path: ["label", "aiInvolvement"],
        message: "Generative pixels cannot be published as a validated Kerr physics simulation.",
      });
    }
    if (value.label.appearance === "cinematic" && value.emission.kind === "grmhd-snapshot") {
      context.addIssue({
        code: "custom",
        path: ["label", "appearance"],
        message: "A cinematic grade must remain a separate display derivative from the radiative-transfer reference output.",
      });
    }
  });

export type BlackHoleRenderManifest = z.infer<typeof BlackHoleRenderManifestSchema>;
