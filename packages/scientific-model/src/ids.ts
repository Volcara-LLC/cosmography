import { z } from "zod";

const opaqueSuffix = "[a-z0-9][a-z0-9_-]{5,126}";

function idPattern(prefix: string): RegExp {
  return new RegExp(`^${prefix}_${opaqueSuffix}$`);
}

/** Cosmography IDs are opaque. A prefix prevents accidental cross-kind joins. */
export const EntityIdSchema = z
  .string()
  .regex(idPattern("ent"), "Expected an opaque ent_ identifier")
  .brand<"EntityId">();
export type EntityId = z.infer<typeof EntityIdSchema>;

export const AssertionIdSchema = z
  .string()
  .regex(idPattern("asr"), "Expected an opaque asr_ identifier")
  .brand<"AssertionId">();
export type AssertionId = z.infer<typeof AssertionIdSchema>;

export const RepresentationIdSchema = z
  .string()
  .regex(idPattern("rep"), "Expected an opaque rep_ identifier")
  .brand<"RepresentationId">();
export type RepresentationId = z.infer<typeof RepresentationIdSchema>;

export const SourceIdSchema = z
  .string()
  .regex(idPattern("src"), "Expected an opaque src_ identifier")
  .brand<"SourceId">();
export type SourceId = z.infer<typeof SourceIdSchema>;

export const RightsIdSchema = z
  .string()
  .regex(idPattern("rgt"), "Expected an opaque rgt_ identifier")
  .brand<"RightsId">();
export type RightsId = z.infer<typeof RightsIdSchema>;

export const AssetIdSchema = z
  .string()
  .regex(idPattern("asset"), "Expected an opaque asset_ identifier")
  .brand<"AssetId">();
export type AssetId = z.infer<typeof AssetIdSchema>;

export const ReleaseIdSchema = z
  .string()
  .regex(idPattern("rel"), "Expected an opaque rel_ identifier")
  .brand<"ReleaseId">();
export type ReleaseId = z.infer<typeof ReleaseIdSchema>;

export const RouteIdSchema = z
  .string()
  .regex(idPattern("route"), "Expected an opaque route_ identifier")
  .brand<"RouteId">();
export type RouteId = z.infer<typeof RouteIdSchema>;

export const TrajectoryIdSchema = z
  .string()
  .regex(idPattern("traj"), "Expected an opaque traj_ identifier")
  .brand<"TrajectoryId">();
export type TrajectoryId = z.infer<typeof TrajectoryIdSchema>;

export const KernelSetIdSchema = z
  .string()
  .regex(idPattern("kset"), "Expected an opaque kset_ identifier")
  .brand<"KernelSetId">();
export type KernelSetId = z.infer<typeof KernelSetIdSchema>;

export const KernelArtifactIdSchema = z
  .string()
  .regex(idPattern("kart"), "Expected an opaque kart_ identifier")
  .brand<"KernelArtifactId">();
export type KernelArtifactId = z.infer<typeof KernelArtifactIdSchema>;

export const GeometryValidationIdSchema = z
  .string()
  .regex(idPattern("gval"), "Expected an opaque gval_ identifier")
  .brand<"GeometryValidationId">();
export type GeometryValidationId = z.infer<typeof GeometryValidationIdSchema>;

export const CaptureContextIdSchema = z
  .string()
  .regex(idPattern("cctx"), "Expected an opaque cctx_ identifier")
  .brand<"CaptureContextId">();
export type CaptureContextId = z.infer<typeof CaptureContextIdSchema>;

export const SurfaceProductRequirementIdSchema = z
  .string()
  .regex(idPattern("sreq"), "Expected an opaque sreq_ identifier")
  .brand<"SurfaceProductRequirementId">();
export type SurfaceProductRequirementId = z.infer<
  typeof SurfaceProductRequirementIdSchema
>;

export const SurfaceProductIdSchema = z
  .string()
  .regex(idPattern("sprod"), "Expected an opaque sprod_ identifier")
  .brand<"SurfaceProductId">();
export type SurfaceProductId = z.infer<typeof SurfaceProductIdSchema>;

export const SurfaceValidationIdSchema = z
  .string()
  .regex(idPattern("sval"), "Expected an opaque sval_ identifier")
  .brand<"SurfaceValidationId">();
export type SurfaceValidationId = z.infer<typeof SurfaceValidationIdSchema>;

export const SemVerSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
    "Expected a semantic version",
  );

export const Sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Expected a lowercase SHA-256 digest");
