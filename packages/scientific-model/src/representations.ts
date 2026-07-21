import { z } from "zod";

import { EvidenceClassSchema } from "./assertions";
import {
  AssetIdSchema,
  EntityIdSchema,
  RepresentationIdSchema,
  RightsIdSchema,
  SourceIdSchema,
} from "./ids";
import { ScientificTimeSchema } from "./time";

export const TimeStateSchema = z.enum([
  "observed-at-stated-time",
  "reconstructed-historical-state",
  "latest-published-estimate",
  "interpolated-state",
  "predicted-state",
  "timeless-conceptual",
]);

export const AppearanceClassSchema = z.enum([
  "calibrated-radiometric",
  "natural-color",
  "approximate-natural-color",
  "representative-false-color",
  "colorized-scalar-measurement",
  "procedural-scientific-shading",
  "cinematic-aesthetic-treatment",
  "artist-texture",
]);

export const GeometryClassSchema = z.enum([
  "true-scale-within-stated-accuracy",
  "logarithmic-scale",
  "exaggerated-size",
  "exaggerated-elevation",
  "display-offset-to-prevent-overlap",
  "not-to-scale",
]);

export const AIInvolvementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none-declared") }).strict(),
  z
    .object({
      kind: z.literal("assistive-processing"),
      tool: z.string().trim().min(1),
      modelVersion: z.string().trim().min(1),
      processDisclosure: z.string().trim().min(1),
      humanValidation: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("generative-output"),
      tool: z.string().trim().min(1),
      modelVersion: z.string().trim().min(1),
      processDisclosure: z.string().trim().min(1),
      promptDisclosure: z.string().trim().min(1),
      humanReview: z.string().trim().min(1),
    })
    .strict(),
]);
export type AIInvolvement = z.infer<typeof AIInvolvementSchema>;

export const RepresentationMethodSchema = z
  .object({
    name: z.string().trim().min(1),
    version: z.string().trim().min(1).optional(),
    parametersDisclosure: z.string().trim().min(1),
    initialConditionsDisclosure: z.string().trim().min(1).optional(),
    codeReference: z.string().trim().min(1).optional(),
  })
  .strict();

export const RepresentationLabelSchema = z
  .object({
    evidenceClass: EvidenceClassSchema,
    timeState: TimeStateSchema,
    appearanceClass: AppearanceClassSchema,
    geometryClass: GeometryClassSchema,
    aiInvolvement: AIInvolvementSchema,
    publicLabel: z.string().trim().min(3),
    uncertaintyDisclosure: z.string().trim().min(1),
    displayTransformDisclosure: z.string().trim().min(1).optional(),
    method: RepresentationMethodSchema.optional(),
    sourceIds: z.array(SourceIdSchema),
  })
  .strict();
export type RepresentationLabel = z.infer<typeof RepresentationLabelSchema>;

export const RepresentationKindSchema = z.enum([
  "image",
  "video",
  "panorama",
  "terrain",
  "mesh",
  "point-cloud",
  "catalog-layer",
  "trajectory",
  "volume",
  "scene-component",
]);

export const RepresentationSchema = z
  .object({
    representationId: RepresentationIdSchema,
    entityId: EntityIdSchema,
    componentPath: z.string().trim().min(1),
    kind: RepresentationKindSchema,
    label: RepresentationLabelSchema,
    assetIds: z.array(AssetIdSchema).default([]),
    rightsStatementIds: z.array(RightsIdSchema).default([]),
    validAt: ScientificTimeSchema.optional(),
  })
  .strict();
export type Representation = z.infer<typeof RepresentationSchema>;

export type ValidationIssue = {
  path: readonly (string | number)[];
  message: string;
};

/** Product-level publication checks that intentionally permit incomplete drafts. */
export function validatePublishableRepresentation(
  representation: Representation,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { label } = representation;

  if (label.sourceIds.length === 0) {
    issues.push({
      path: ["label", "sourceIds"],
      message: "A publishable representation must cite at least one source",
    });
  }

  if (
    [
      "derived-result",
      "scientific-reconstruction",
      "physics-simulation",
    ].includes(label.evidenceClass) &&
    !label.method
  ) {
    issues.push({
      path: ["label", "method"],
      message: `${label.evidenceClass} requires a disclosed method`,
    });
  }

  if (
    label.evidenceClass === "physics-simulation" &&
    !label.method?.initialConditionsDisclosure
  ) {
    issues.push({
      path: ["label", "method", "initialConditionsDisclosure"],
      message: "A physics simulation must disclose its initial conditions",
    });
  }

  if (
    label.aiInvolvement.kind === "generative-output" &&
    label.evidenceClass !== "artist-interpretation"
  ) {
    issues.push({
      path: ["label", "evidenceClass"],
      message:
        "Generative output must be labeled artist interpretation, not observation, reconstruction, or simulation",
    });
  }

  if (
    representation.assetIds.length > 0 &&
    representation.rightsStatementIds.length === 0
  ) {
    issues.push({
      path: ["rightsStatementIds"],
      message: "Every representation with assets needs a rights determination",
    });
  }

  return issues;
}

export const PublishableRepresentationSchema = RepresentationSchema.superRefine(
  (representation, context) => {
    for (const issue of validatePublishableRepresentation(representation)) {
      context.addIssue({
        code: "custom",
        path: [...issue.path],
        message: issue.message,
      });
    }
  },
);
