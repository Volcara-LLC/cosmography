import { createHash } from "node:crypto";

import {
  ReferenceOnlySurfaceProductSchema,
  type ReferenceOnlySurfaceProduct,
} from "@cosmography/scientific-model/surface-provenance";
import { z } from "zod";

import { deepFreeze, sha256Hex, stableStringify } from "./canonical";

export const SURFACE_QUARANTINE_POLICY_VERSION = "1.0.0" as const;
export const SURFACE_QUARANTINE_MAX_ARTIFACTS = 16;
export const SURFACE_QUARANTINE_MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;
export const SURFACE_QUARANTINE_MAX_LABEL_BYTES = 4 * 1024 * 1024;
export const SURFACE_QUARANTINE_MAX_TOTAL_BYTES = 32 * 1024 * 1024;

export const SURFACE_QUARANTINE_LIMITS = deepFreeze({
  maxArtifacts: SURFACE_QUARANTINE_MAX_ARTIFACTS,
  maxArtifactBytes: SURFACE_QUARANTINE_MAX_ARTIFACT_BYTES,
  maxLabelBytes: SURFACE_QUARANTINE_MAX_LABEL_BYTES,
  maxTotalBytes: SURFACE_QUARANTINE_MAX_TOTAL_BYTES,
});

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const SemVerSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const ArtifactIdSchema = z
  .string()
  .regex(/^sart_[a-z0-9][a-z0-9_-]{5,126}$/);

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const authorityFlagShape = {
  selectionReviewed: z.literal(false),
  selectionAuthorized: z.literal(false),
  artifactVerificationAllowed: z.literal(false),
  rightsReviewed: z.literal(false),
  scientificValidationPassed: z.literal(false),
  scienceValidated: z.literal(false),
  runtimeUseAllowed: z.literal(false),
  renderAllowed: z.literal(false),
  capturePlacementAllowed: z.literal(false),
  releaseEligible: z.literal(false),
  publicationAllowed: z.literal(false),
  activationAllowed: z.literal(false),
  sourceAuthenticityVerified: z.literal(false),
  dependencyProvenanceAttested: z.literal(false),
  ambientNetworkFetchPerformedByModule: z.literal(false),
} as const;

const noAuthority = {
  selectionReviewed: false,
  selectionAuthorized: false,
  artifactVerificationAllowed: false,
  rightsReviewed: false,
  scientificValidationPassed: false,
  scienceValidated: false,
  runtimeUseAllowed: false,
  renderAllowed: false,
  capturePlacementAllowed: false,
  releaseEligible: false,
  publicationAllowed: false,
  activationAllowed: false,
  sourceAuthenticityVerified: false,
  dependencyProvenanceAttested: false,
  ambientNetworkFetchPerformedByModule: false,
} as const;

export const SurfaceCandidateProductIdentitySchema = z
  .object({
    state: z.literal("exact-record-identified"),
    namespace: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
    identifier: z
      .string()
      .min(1)
      .max(1_024)
      .refine((value) => value === value.trim())
      .refine((value) => /^[\x20-\x7e]+$/.test(value))
      .refine(
        (value) =>
          !/(?:^|[._:/\s-])(?:latest|current|mutable)(?:$|[._:/\s-])/i.test(
            value,
          ),
      ),
    version: z
      .string()
      .min(1)
      .max(255)
      .refine((value) => value === value.trim())
      .refine((value) => /^[\x20-\x7e]+$/.test(value))
      .refine(
        (value) =>
          !/(?:^|[._:/\s-])(?:latest|current|mutable)(?:$|[._:/\s-])/i.test(
            value,
          ),
      ),
  })
  .strict();
export type SurfaceCandidateProductIdentity = z.infer<
  typeof SurfaceCandidateProductIdentitySchema
>;

export const SurfaceQuarantineArtifactRoleSchema = z.enum([
  "primary-data",
  "source-label",
  "projection-definition",
  "metadata",
  "browse",
  "confidence",
  "calibration",
]);

export const SurfaceQuarantineMediaTypeSchema = z.enum([
  "application/json",
  "application/octet-stream",
  "application/xml",
  "image/jpeg",
  "image/jp2",
  "image/png",
  "image/tiff",
  "model/gltf-binary",
  "text/csv",
  "text/plain",
]);

export const SurfaceQuarantineFilenameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => value === value.trim())
  .refine((value) => /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value))
  .refine((value) => !value.includes(".."))
  .refine((value) => !/[. ]$/.test(value))
  .refine(
    (value) =>
      !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value),
  )
  .refine(
    (value) =>
      !/\.(?:7z|bz2|cab|gz|iso|rar|tar|tbz2|tgz|txz|xz|zip|zst)$/i.test(
        value,
      ),
  )
  .refine(
    (value) =>
      !/\.(?:apk|app|appx|appxbundle|bash|bat|cgi|chm|class|cmd|com|command|cpl|deb|dll|dmg|exe|hta|jar|js|lnk|mjs|msi|ps1|py|pyc|rb|rpm|scr|sh|so|sys|vb|vbs|wasm|wsf)$/i.test(
        value,
      ),
  )
  .refine(
    (value) => !/(?:^|[._-])(?:latest|current|mutable)(?:[._-]|$)/i.test(value),
  );

export const SurfaceQuarantineExactUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.toString() !== value
  ) {
    return false;
  }
  const rawSegments = url.pathname.split("/").slice(1);
  if (rawSegments.length === 0 || rawSegments.some((segment) => segment === "")) {
    return false;
  }
  try {
    return rawSegments.every((segment) => {
      const decoded = decodeURIComponent(segment);
      return (
        decoded !== "." &&
        decoded !== ".." &&
        !/[\u0000-\u001f\u007f]/.test(decoded) &&
        !/[\\/]/.test(decoded)
      );
    });
  } catch {
    return false;
  }
});

export const SurfaceQuarantineArtifactSchema = z
  .object({
    artifactId: ArtifactIdSchema,
    role: SurfaceQuarantineArtifactRoleSchema,
    filename: SurfaceQuarantineFilenameSchema,
    sourceUrl: SurfaceQuarantineExactUrlSchema,
    mediaType: SurfaceQuarantineMediaTypeSchema,
    byteLength: z.number().int().positive(),
    sha256: Sha256Schema,
    pairedArtifactIds: z.array(ArtifactIdSchema),
  })
  .strict()
  .superRefine((artifact, context) => {
    let sourceFilename: string | undefined;
    try {
      sourceFilename = decodeURIComponent(
        new URL(artifact.sourceUrl).pathname.split("/").at(-1) ?? "",
      );
    } catch {
      sourceFilename = undefined;
    }
    if (sourceFilename !== artifact.filename) {
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Surface source URL must name the exact candidate filename",
      });
    }
    const allowedExtensions: Partial<
      Record<z.infer<typeof SurfaceQuarantineMediaTypeSchema>, readonly string[]>
    > = {
      "application/json": [".json"],
      "application/xml": [".xml"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/jp2": [".jp2"],
      "image/png": [".png"],
      "image/tiff": [".tif", ".tiff"],
      "model/gltf-binary": [".glb"],
      "text/csv": [".csv"],
      "text/plain": [".txt", ".lbl", ".tab"],
    };
    const extensions = allowedExtensions[artifact.mediaType];
    if (
      extensions &&
      !extensions.some((extension) =>
        artifact.filename.toLowerCase().endsWith(extension),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["filename"],
        message: "Surface candidate filename extension must match its media type",
      });
    }
    if (
      artifact.role === "source-label" &&
      ![
        "application/json",
        "application/xml",
        "text/plain",
      ].includes(artifact.mediaType)
    ) {
      context.addIssue({
        code: "custom",
        path: ["mediaType"],
        message: "Surface source labels must use a bounded textual media type",
      });
    }
    if (
      artifact.role === "projection-definition" &&
      ![
        "application/json",
        "application/xml",
        "text/plain",
      ].includes(artifact.mediaType)
    ) {
      context.addIssue({
        code: "custom",
        path: ["mediaType"],
        message: "Surface projection definitions must be textual",
      });
    }
    const labelSized =
      artifact.role === "source-label" || artifact.role === "metadata";
    const maximum = labelSized
      ? SURFACE_QUARANTINE_MAX_LABEL_BYTES
      : SURFACE_QUARANTINE_MAX_ARTIFACT_BYTES;
    if (artifact.byteLength > maximum) {
      context.addIssue({
        code: "custom",
        path: ["byteLength"],
        message: "Surface candidate artifact exceeds its code-owned byte limit",
      });
    }
    if (new Set(artifact.pairedArtifactIds).size !== artifact.pairedArtifactIds.length) {
      context.addIssue({
        code: "custom",
        path: ["pairedArtifactIds"],
        message: "Surface artifact pairings must be unique",
      });
    }
  });
export type SurfaceQuarantineArtifact = z.infer<
  typeof SurfaceQuarantineArtifactSchema
>;

const LimitsSchema = z
  .object({
    maxArtifacts: z.literal(SURFACE_QUARANTINE_MAX_ARTIFACTS),
    maxArtifactBytes: z.literal(SURFACE_QUARANTINE_MAX_ARTIFACT_BYTES),
    maxLabelBytes: z.literal(SURFACE_QUARANTINE_MAX_LABEL_BYTES),
    maxTotalBytes: z.literal(SURFACE_QUARANTINE_MAX_TOTAL_BYTES),
  })
  .strict();

const ReferenceChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("surface-reference-record"),
  })
  .strict();

const ProposalChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("surface-quarantine-proposal"),
  })
  .strict();

const cartographicKinds = new Set([
  "orthomosaic",
  "elevation-model",
  "confidence-mask",
]);

export const SurfaceQuarantineProposalSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("unreviewed-offline-surface-candidate"),
    proposalId: z.string().regex(/^sqprop_[a-f0-9]{24}$/),
    policyVersion: z.literal(SURFACE_QUARANTINE_POLICY_VERSION),
    frozenAt: z.iso.datetime({ offset: true }),
    reference: ReferenceOnlySurfaceProductSchema,
    referenceChecksum: ReferenceChecksumSchema,
    candidateProductIdentity: SurfaceCandidateProductIdentitySchema,
    artifacts: z
      .array(SurfaceQuarantineArtifactSchema)
      .min(2)
      .max(SURFACE_QUARANTINE_MAX_ARTIFACTS),
    limits: LimitsSchema,
    fixtureContractOnly: z.literal(true),
    ...authorityFlagShape,
    proposalChecksum: ProposalChecksumSchema,
  })
  .strict()
  .superRefine((proposal, context) => {
    if (Date.parse(proposal.frozenAt) < Date.parse(proposal.reference.checkedAt)) {
      context.addIssue({
        code: "custom",
        path: ["frozenAt"],
        message: "Surface quarantine proposal cannot predate its reference check",
      });
    }
    if (
      proposal.reference.productIdentity.state === "exact-record-identified" &&
      stableStringify(proposal.reference.productIdentity) !==
        stableStringify(proposal.candidateProductIdentity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["candidateProductIdentity"],
        message: "Candidate identity differs from the exact frozen reference",
      });
    }
    const ids = proposal.artifacts.map(({ artifactId }) => artifactId);
    const filenames = proposal.artifacts.map(({ filename }) =>
      filename.toLowerCase(),
    );
    const urls = proposal.artifacts.map(({ sourceUrl }) => sourceUrl);
    for (const [field, values] of [
      ["artifactId", ids],
      ["filename", filenames],
      ["sourceUrl", urls],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          path: ["artifacts"],
          message: `Surface candidate ${field} values must be unique`,
        });
      }
    }
    if (
      stableStringify(ids) !==
      stableStringify([...ids].sort(compareCodeUnits))
    ) {
      context.addIssue({
        code: "custom",
        path: ["artifacts"],
        message: "Surface candidate artifacts must use canonical artifact-id order",
      });
    }
    for (const artifact of proposal.artifacts) {
      if (
        stableStringify(artifact.pairedArtifactIds) !==
        stableStringify(
          [...artifact.pairedArtifactIds].sort(compareCodeUnits),
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["artifacts"],
          message: "Surface candidate pairings must use canonical artifact-id order",
        });
      }
    }
    const byId = new Map(
      proposal.artifacts.map((artifact) => [artifact.artifactId, artifact]),
    );
    const primary = proposal.artifacts.filter(
      ({ role }) => role === "primary-data",
    );
    const labels = proposal.artifacts.filter(({ role }) => role === "source-label");
    if (primary.length === 0 || labels.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["artifacts"],
        message: "Surface candidates require primary data and source labels",
      });
    }
    for (const artifact of proposal.artifacts) {
      const isPairable =
        artifact.role === "primary-data" || artifact.role === "source-label";
      if (isPairable && artifact.pairedArtifactIds.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["artifacts"],
          message: "Primary data and source labels require reciprocal pairings",
        });
      }
      if (!isPairable && artifact.pairedArtifactIds.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["artifacts"],
          message: "Only primary data and source labels may declare pairings",
        });
      }
      for (const pairedId of artifact.pairedArtifactIds) {
        const paired = byId.get(pairedId);
        const expectedRole =
          artifact.role === "primary-data" ? "source-label" : "primary-data";
        if (
          !paired ||
          paired.role !== expectedRole ||
          !paired.pairedArtifactIds.includes(artifact.artifactId)
        ) {
          context.addIssue({
            code: "custom",
            path: ["artifacts"],
            message: "Surface primary/label pairings must be reciprocal",
          });
        }
      }
    }
    const projectionCount = proposal.artifacts.filter(
      ({ role }) => role === "projection-definition",
    ).length;
    if (
      cartographicKinds.has(proposal.reference.productKind) &&
      projectionCount !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["artifacts"],
        message: "Cartographic candidates require exactly one projection definition",
      });
    }
    const totalBytes = proposal.artifacts.reduce(
      (total, artifact) => total + artifact.byteLength,
      0,
    );
    if (totalBytes > SURFACE_QUARANTINE_MAX_TOTAL_BYTES) {
      context.addIssue({
        code: "custom",
        path: ["artifacts"],
        message: "Surface candidate exceeds the aggregate byte limit",
      });
    }
  });
export type SurfaceQuarantineProposal = z.infer<
  typeof SurfaceQuarantineProposalSchema
>;

export interface CreateSurfaceQuarantineProposalInput {
  readonly reference: unknown;
  readonly candidateProductIdentity: unknown;
  readonly frozenAt: unknown;
  readonly artifacts: readonly unknown[];
}

export function createSurfaceQuarantineProposal(
  input: CreateSurfaceQuarantineProposalInput,
): SurfaceQuarantineProposal {
  const reference = ReferenceOnlySurfaceProductSchema.parse(input.reference);
  const candidateProductIdentity = SurfaceCandidateProductIdentitySchema.parse(
    input.candidateProductIdentity,
  );
  const frozenAt = z.iso.datetime({ offset: true }).parse(input.frozenAt);
  const artifacts = input.artifacts
    .map((artifact) => SurfaceQuarantineArtifactSchema.parse(artifact))
    .map((artifact) => ({
      ...artifact,
      pairedArtifactIds: [...artifact.pairedArtifactIds].sort(compareCodeUnits),
    }))
    .sort((left, right) =>
      compareCodeUnits(left.artifactId, right.artifactId),
    );
  const referenceChecksum = {
    algorithm: "sha256" as const,
    value: sha256Hex(stableStringify(reference)),
    scope: "surface-reference-record" as const,
  };
  const identity = {
    policyVersion: SURFACE_QUARANTINE_POLICY_VERSION,
    frozenAt,
    referenceChecksum,
    candidateProductIdentity,
    artifacts,
  };
  const proposalId = `sqprop_${sha256Hex(stableStringify(identity)).slice(0, 24)}`;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "unreviewed-offline-surface-candidate" as const,
    proposalId,
    policyVersion: SURFACE_QUARANTINE_POLICY_VERSION,
    frozenAt,
    reference,
    referenceChecksum,
    candidateProductIdentity,
    artifacts,
    limits: SURFACE_QUARANTINE_LIMITS,
    fixtureContractOnly: true as const,
    ...noAuthority,
  };
  const proposal = SurfaceQuarantineProposalSchema.parse({
    ...unsigned,
    proposalChecksum: {
      algorithm: "sha256",
      value: sha256Hex(stableStringify(unsigned)),
      scope: "surface-quarantine-proposal",
    },
  });
  assertSurfaceQuarantineProposalIntegrity(proposal);
  return deepFreeze(proposal);
}

export function assertSurfaceQuarantineProposalIntegrity(
  input: unknown,
): asserts input is SurfaceQuarantineProposal {
  const proposal = SurfaceQuarantineProposalSchema.parse(input);
  const expectedReference = sha256Hex(stableStringify(proposal.reference));
  if (proposal.referenceChecksum.value !== expectedReference) {
    throw new Error("Surface proposal reference checksum mismatch");
  }
  const identity = {
    policyVersion: proposal.policyVersion,
    frozenAt: proposal.frozenAt,
    referenceChecksum: proposal.referenceChecksum,
    candidateProductIdentity: proposal.candidateProductIdentity,
    artifacts: proposal.artifacts,
  };
  const expectedId = `sqprop_${sha256Hex(stableStringify(identity)).slice(0, 24)}`;
  if (proposal.proposalId !== expectedId) {
    throw new Error("Surface proposal identity mismatch");
  }
  const { proposalChecksum, ...unsigned } = proposal;
  if (proposalChecksum.value !== sha256Hex(stableStringify(unsigned))) {
    throw new Error("Surface proposal checksum mismatch");
  }
}

const SurfaceArtifactBytesChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("surface-artifact-bytes"),
  })
  .strict();

export const SurfaceQuarantineObjectSchema = z
  .object({
    store: z.literal("r2"),
    namespace: z.literal("quarantine/surface"),
    key: z
      .string()
      .min(1)
      .max(1_024)
      .refine((value) => value.startsWith("quarantine/surface/"))
      .refine(
        (value) =>
          !value.includes("\\") &&
          !value
            .split("/")
            .some(
              (segment) => !segment || segment === "." || segment === "..",
            ),
      )
      .refine((value) => /^[a-z0-9][a-z0-9/_+\-.]+$/.test(value)),
    contentType: SurfaceQuarantineMediaTypeSchema,
    byteLength: z.number().int().positive(),
    checksum: SurfaceArtifactBytesChecksumSchema,
    immutable: z.literal(true),
  })
  .strict();
export type SurfaceQuarantineObject = z.infer<
  typeof SurfaceQuarantineObjectSchema
>;

const CaptureChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("surface-quarantine-capture"),
  })
  .strict();

export const SurfaceQuarantineCaptureReceiptSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("surface-artifact-quarantined-unreviewed"),
    captureId: z.string().regex(/^sqcap_[a-f0-9]{24}$/),
    proposalId: z.string().regex(/^sqprop_[a-f0-9]{24}$/),
    proposalChecksum: ProposalChecksumSchema,
    referenceChecksum: ReferenceChecksumSchema,
    artifactId: ArtifactIdSchema,
    filename: SurfaceQuarantineFilenameSchema,
    role: SurfaceQuarantineArtifactRoleSchema,
    mediaType: SurfaceQuarantineMediaTypeSchema,
    byteLength: z.number().int().positive(),
    sha256: Sha256Schema,
    capturedAt: z.iso.datetime({ offset: true }),
    object: SurfaceQuarantineObjectSchema,
    fixtureContractOnly: z.literal(true),
    ...authorityFlagShape,
    captureChecksum: CaptureChecksumSchema,
  })
  .strict();
export type SurfaceQuarantineCaptureReceipt = z.infer<
  typeof SurfaceQuarantineCaptureReceiptSchema
>;

const ParserDescriptorSchema = z
  .object({
    parserId: SlugSchema,
    parserVersion: SemVerSchema,
    parserCodeCommit: z.string().regex(/^[a-f0-9]{7,64}$/),
  })
  .strict();

const SurfaceInspectedFileSchema = z
  .object({
    artifactId: ArtifactIdSchema,
    filename: SurfaceQuarantineFilenameSchema,
    role: SurfaceQuarantineArtifactRoleSchema,
    byteLength: z.number().int().positive(),
    sha256: Sha256Schema,
  })
  .strict();

export const SurfaceLabelInspectionBindingSchema = z
  .object({
    proposalId: z.string().regex(/^sqprop_[a-f0-9]{24}$/),
    proposalChecksum: ProposalChecksumSchema,
    referenceChecksum: ReferenceChecksumSchema,
    candidateProductIdentity: SurfaceCandidateProductIdentitySchema,
    body: z.enum(["Mars", "Moon"]),
    productKind: z.enum([
      "orthomosaic",
      "elevation-model",
      "confidence-mask",
      "terrain-mesh",
      "source-frame-set",
      "panorama-derivative",
      "localization",
      "camera-calibration",
      "traverse-vector",
    ]),
    sourceRelease: z.string().min(1),
    labelArtifactId: ArtifactIdSchema,
    labelFilename: SurfaceQuarantineFilenameSchema,
    labelByteLength: z.number().int().positive(),
    labelSha256: Sha256Schema,
    files: z.array(SurfaceInspectedFileSchema).min(2).max(16),
  })
  .strict()
  .superRefine((binding, context) => {
    const artifactIds = binding.files.map(({ artifactId }) => artifactId);
    const filenames = binding.files.map(({ filename }) => filename.toLowerCase());
    if (new Set(artifactIds).size !== artifactIds.length) {
      context.addIssue({
        code: "custom",
        path: ["files"],
        message: "Surface label bindings require unique artifact IDs",
      });
    }
    if (new Set(filenames).size !== filenames.length) {
      context.addIssue({
        code: "custom",
        path: ["files"],
        message: "Surface label bindings require unique filenames",
      });
    }
    if (
      stableStringify(artifactIds) !==
      stableStringify([...artifactIds].sort(compareCodeUnits))
    ) {
      context.addIssue({
        code: "custom",
        path: ["files"],
        message: "Surface label binding files must use canonical artifact-id order",
      });
    }
    const boundLabels = binding.files.filter(
      ({ artifactId }) => artifactId === binding.labelArtifactId,
    );
    if (
      boundLabels.length !== 1 ||
      boundLabels[0]?.role !== "source-label" ||
      boundLabels[0]?.filename !== binding.labelFilename ||
      boundLabels[0]?.byteLength !== binding.labelByteLength ||
      boundLabels[0]?.sha256 !== binding.labelSha256
    ) {
      context.addIssue({
        code: "custom",
        path: ["labelArtifactId"],
        message: "Surface label binding must identify its exact source-label file",
      });
    }
  });
export type SurfaceLabelInspectionBinding = z.infer<
  typeof SurfaceLabelInspectionBindingSchema
>;

const ParserPayloadChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("surface-label-parser-payload"),
  })
  .strict();

export const SurfaceLabelParserPayloadSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal("surface-label-machine-inspected"),
    parser: ParserDescriptorSchema,
    binding: SurfaceLabelInspectionBindingSchema,
    checks: z
      .object({
        syntaxRecognized: z.literal(true),
        identityBound: z.literal(true),
        bodyBound: z.literal(true),
        productKindBound: z.literal(true),
        sourceReleaseBound: z.literal(true),
        filesBound: z.literal(true),
      })
      .strict(),
    payloadChecksum: ParserPayloadChecksumSchema,
  })
  .strict();
export type SurfaceLabelParserPayload = z.infer<
  typeof SurfaceLabelParserPayloadSchema
>;

export interface CreateSurfaceLabelParserPayloadInput {
  readonly parserId: string;
  readonly parserVersion: string;
  readonly parserCodeCommit: string;
  readonly binding: unknown;
}

export function createSurfaceLabelParserPayload(
  input: CreateSurfaceLabelParserPayloadInput,
): SurfaceLabelParserPayload {
  const parser = ParserDescriptorSchema.parse({
    parserId: input.parserId,
    parserVersion: input.parserVersion,
    parserCodeCommit: input.parserCodeCommit,
  });
  const binding = SurfaceLabelInspectionBindingSchema.parse(input.binding);
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "surface-label-machine-inspected" as const,
    parser,
    binding,
    checks: {
      syntaxRecognized: true as const,
      identityBound: true as const,
      bodyBound: true as const,
      productKindBound: true as const,
      sourceReleaseBound: true as const,
      filesBound: true as const,
    },
  };
  return deepFreeze(
    SurfaceLabelParserPayloadSchema.parse({
      ...unsigned,
      payloadChecksum: {
        algorithm: "sha256",
        value: sha256Hex(stableStringify(unsigned)),
        scope: "surface-label-parser-payload",
      },
    }),
  );
}

const ReportChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("surface-quarantine-inspection-report"),
  })
  .strict();

export const SurfaceCandidateInspectionReportSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    state: z.literal(
      "machine-inspected-needs-selection-and-rights-review",
    ),
    reportId: z.string().regex(/^sqins_[a-f0-9]{24}$/),
    proposalId: z.string().regex(/^sqprop_[a-f0-9]{24}$/),
    proposalChecksum: ProposalChecksumSchema,
    referenceChecksum: ReferenceChecksumSchema,
    candidateProductIdentity: SurfaceCandidateProductIdentitySchema,
    inspectedAt: z.iso.datetime({ offset: true }),
    captures: z
      .array(SurfaceQuarantineCaptureReceiptSchema)
      .min(2)
      .max(SURFACE_QUARANTINE_MAX_ARTIFACTS),
    labelInspections: z.array(SurfaceLabelParserPayloadSchema).min(1).max(16),
    fixtureContractOnly: z.literal(true),
    ...authorityFlagShape,
    reportChecksum: ReportChecksumSchema,
  })
  .strict();
export type SurfaceCandidateInspectionReport = z.infer<
  typeof SurfaceCandidateInspectionReportSchema
>;

export interface SurfaceFixtureByteSource {
  read(
    proposal: Readonly<SurfaceQuarantineProposal>,
    artifact: Readonly<SurfaceQuarantineArtifact>,
  ): Promise<Uint8Array>;
}

export interface SurfaceImmutableQuarantineStore {
  put(input: {
    readonly key: string;
    readonly bytes: Uint8Array;
    readonly contentType: z.infer<typeof SurfaceQuarantineMediaTypeSchema>;
    readonly sha256: string;
    readonly ifAbsent: true;
  }): Promise<unknown>;
}

export interface SurfaceImmutableQuarantineReader {
  read(object: Readonly<SurfaceQuarantineObject>): Promise<Uint8Array>;
}

export interface SurfaceLabelParserInput {
  readonly proposal: Readonly<SurfaceQuarantineProposal>;
  readonly labelArtifact: Readonly<SurfaceQuarantineArtifact>;
  readonly labelBytes: Uint8Array;
  readonly expectedBinding: Readonly<SurfaceLabelInspectionBinding>;
}

export interface SurfaceLabelParser {
  readonly parserId: string;
  readonly parserVersion: string;
  readonly parserCodeCommit: string;
  inspect(input: SurfaceLabelParserInput): Promise<unknown>;
}

export interface SurfaceQuarantineClock {
  now(): string;
}

export interface SurfaceQuarantineDependencies {
  readonly source: SurfaceFixtureByteSource;
  readonly store: SurfaceImmutableQuarantineStore;
  readonly reader: SurfaceImmutableQuarantineReader;
  readonly parser: SurfaceLabelParser;
  readonly clock: SurfaceQuarantineClock;
}

function artifactLimit(artifact: SurfaceQuarantineArtifact): number {
  return artifact.role === "source-label" || artifact.role === "metadata"
    ? SURFACE_QUARANTINE_MAX_LABEL_BYTES
    : SURFACE_QUARANTINE_MAX_ARTIFACT_BYTES;
}

function hasArchiveMagic(bytes: Uint8Array): boolean {
  const starts = (...values: number[]) =>
    values.every((value, index) => bytes[index] === value);
  if (
    starts(0x50, 0x4b, 0x03, 0x04) ||
    starts(0x50, 0x4b, 0x01, 0x02) ||
    starts(0x50, 0x4b, 0x05, 0x06) ||
    starts(0x50, 0x4b, 0x07, 0x08) ||
    starts(0x1f, 0x8b) ||
    starts(0x42, 0x5a, 0x68) ||
    starts(0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00) ||
    starts(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c) ||
    starts(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07) ||
    starts(0x28, 0xb5, 0x2f, 0xfd) ||
    (bytes[0] !== undefined &&
      bytes[0] >= 0x50 &&
      bytes[0] <= 0x5f &&
      starts(bytes[0], 0x2a, 0x4d, 0x18)) ||
    starts(0x4d, 0x53, 0x43, 0x46) ||
    starts(0x21, 0x3c, 0x61, 0x72, 0x63, 0x68, 0x3e, 0x0a) ||
    starts(0x30, 0x37, 0x30, 0x37, 0x30, 0x31) ||
    starts(0x30, 0x37, 0x30, 0x37, 0x30, 0x32) ||
    starts(0x30, 0x37, 0x30, 0x37, 0x30, 0x37)
  ) {
    return true;
  }
  const decoder = new TextDecoder("ascii");
  return (
    (bytes.byteLength >= 262 &&
      decoder.decode(bytes.subarray(257, 262)) === "ustar") ||
    (bytes.byteLength >= 32_774 &&
      decoder.decode(bytes.subarray(32_769, 32_774)) === "CD001")
  );
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function quarantineKey(
  proposal: SurfaceQuarantineProposal,
  artifact: SurfaceQuarantineArtifact,
): string {
  return [
    "quarantine",
    "surface",
    proposal.reference.body.toLowerCase(),
    proposal.reference.requirementId,
    proposal.proposalId,
    artifact.artifactId,
    artifact.filename.toLowerCase(),
  ].join("/");
}

function captureReceipt(
  proposal: SurfaceQuarantineProposal,
  artifact: SurfaceQuarantineArtifact,
  object: SurfaceQuarantineObject,
  capturedAt: string,
): SurfaceQuarantineCaptureReceipt {
  const identity = {
    proposalId: proposal.proposalId,
    proposalChecksum: proposal.proposalChecksum,
    artifactId: artifact.artifactId,
    capturedAt,
    object,
  };
  const captureId = `sqcap_${sha256Hex(stableStringify(identity)).slice(0, 24)}`;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "surface-artifact-quarantined-unreviewed" as const,
    captureId,
    proposalId: proposal.proposalId,
    proposalChecksum: proposal.proposalChecksum,
    referenceChecksum: proposal.referenceChecksum,
    artifactId: artifact.artifactId,
    filename: artifact.filename,
    role: artifact.role,
    mediaType: artifact.mediaType,
    byteLength: artifact.byteLength,
    sha256: artifact.sha256,
    capturedAt,
    object,
    fixtureContractOnly: true as const,
    ...noAuthority,
  };
  const receipt = SurfaceQuarantineCaptureReceiptSchema.parse({
    ...unsigned,
    captureChecksum: {
      algorithm: "sha256",
      value: sha256Hex(stableStringify(unsigned)),
      scope: "surface-quarantine-capture",
    },
  });
  assertSurfaceQuarantineCaptureReceiptIntegrity(proposal, receipt);
  return receipt;
}

export function assertSurfaceQuarantineCaptureReceiptIntegrity(
  proposalInput: unknown,
  receiptInput: unknown,
): asserts receiptInput is SurfaceQuarantineCaptureReceipt {
  const proposal = SurfaceQuarantineProposalSchema.parse(proposalInput);
  assertSurfaceQuarantineProposalIntegrity(proposal);
  const receipt = SurfaceQuarantineCaptureReceiptSchema.parse(receiptInput);
  const artifact = proposal.artifacts.find(
    ({ artifactId }) => artifactId === receipt.artifactId,
  );
  if (
    !artifact ||
    Date.parse(receipt.capturedAt) < Date.parse(proposal.frozenAt) ||
    receipt.proposalId !== proposal.proposalId ||
    receipt.proposalChecksum.value !== proposal.proposalChecksum.value ||
    receipt.referenceChecksum.value !== proposal.referenceChecksum.value ||
    receipt.filename !== artifact.filename ||
    receipt.role !== artifact.role ||
    receipt.mediaType !== artifact.mediaType ||
    receipt.byteLength !== artifact.byteLength ||
    receipt.sha256 !== artifact.sha256 ||
    receipt.object.key !== quarantineKey(proposal, artifact) ||
    receipt.object.contentType !== artifact.mediaType ||
    receipt.object.byteLength !== artifact.byteLength ||
    receipt.object.checksum.value !== artifact.sha256
  ) {
    throw new Error("Surface quarantine capture is not bound to its proposal");
  }
  const identity = {
    proposalId: proposal.proposalId,
    proposalChecksum: proposal.proposalChecksum,
    artifactId: artifact.artifactId,
    capturedAt: receipt.capturedAt,
    object: receipt.object,
  };
  const expectedId = `sqcap_${sha256Hex(stableStringify(identity)).slice(0, 24)}`;
  if (receipt.captureId !== expectedId) {
    throw new Error("Surface quarantine capture identity mismatch");
  }
  const { captureChecksum, ...unsigned } = receipt;
  if (captureChecksum.value !== sha256Hex(stableStringify(unsigned))) {
    throw new Error("Surface quarantine capture checksum mismatch");
  }
}

export function assertSurfaceLabelParserPayloadIntegrity(
  payloadInput: unknown,
): asserts payloadInput is SurfaceLabelParserPayload {
  const payload = SurfaceLabelParserPayloadSchema.parse(payloadInput);
  const { payloadChecksum, ...unsigned } = payload;
  if (payloadChecksum.value !== sha256Hex(stableStringify(unsigned))) {
    throw new Error("Surface label parser payload checksum mismatch");
  }
}

export async function quarantineAndInspectSurfaceCandidate(
  proposalInput: unknown,
  dependencies: SurfaceQuarantineDependencies,
): Promise<SurfaceCandidateInspectionReport> {
  const proposal = deepFreeze(SurfaceQuarantineProposalSchema.parse(proposalInput));
  assertSurfaceQuarantineProposalIntegrity(proposal);
  const captures: SurfaceQuarantineCaptureReceipt[] = [];
  let totalBytes = 0;
  let latestCaptureMs = Date.parse(proposal.frozenAt);

  for (const artifact of proposal.artifacts) {
    const sourceBytes = await dependencies.source.read(proposal, artifact);
    if (!(sourceBytes instanceof Uint8Array)) {
      throw new Error("Surface fixture source must return Uint8Array bytes");
    }
    const nextTotalBytes = totalBytes + sourceBytes.byteLength;
    if (
      sourceBytes.byteLength !== artifact.byteLength ||
      sourceBytes.byteLength > artifactLimit(artifact) ||
      nextTotalBytes > SURFACE_QUARANTINE_MAX_TOTAL_BYTES
    ) {
      throw new Error("Surface fixture byte length violates the frozen proposal");
    }
    totalBytes = nextTotalBytes;
    const bytes = sourceBytes.slice();
    if (hasArchiveMagic(bytes)) {
      throw new Error("Surface fixture archives and compressed containers are rejected");
    }
    const actualSha256 = sha256Bytes(bytes);
    if (actualSha256 !== artifact.sha256) {
      throw new Error("Surface fixture bytes do not match the frozen SHA-256");
    }
    const key = quarantineKey(proposal, artifact);
    const object = SurfaceQuarantineObjectSchema.parse(
      await dependencies.store.put({
        key,
        bytes: bytes.slice(),
        contentType: artifact.mediaType,
        sha256: actualSha256,
        ifAbsent: true,
      }),
    );
    if (
      object.key !== key ||
      object.contentType !== artifact.mediaType ||
      object.byteLength !== artifact.byteLength ||
      object.checksum.value !== artifact.sha256
    ) {
      throw new Error("Surface quarantine store returned a drifted immutable object");
    }
    const capturedAt = z.iso.datetime({ offset: true }).parse(dependencies.clock.now());
    const capturedAtMs = Date.parse(capturedAt);
    if (capturedAtMs < latestCaptureMs) {
      throw new Error(
        "Surface quarantine capture clock must be causal and nondecreasing",
      );
    }
    latestCaptureMs = capturedAtMs;
    captures.push(captureReceipt(proposal, artifact, object, capturedAt));
  }

  const replayed = new Map<string, Uint8Array>();
  for (const capture of captures) {
    const replayBytes = await dependencies.reader.read(capture.object);
    if (
      !(replayBytes instanceof Uint8Array) ||
      replayBytes.byteLength !== capture.byteLength
    ) {
      throw new Error("Surface quarantine replay differs from captured exact bytes");
    }
    const bytes = replayBytes.slice();
    if (sha256Bytes(bytes) !== capture.sha256 || hasArchiveMagic(bytes)) {
      throw new Error("Surface quarantine replay differs from captured exact bytes");
    }
    replayed.set(capture.artifactId, bytes);
  }

  const parserDescriptor = ParserDescriptorSchema.parse({
    parserId: dependencies.parser.parserId,
    parserVersion: dependencies.parser.parserVersion,
    parserCodeCommit: dependencies.parser.parserCodeCommit,
  });
  const files = captures
    .map((capture) => ({
      artifactId: capture.artifactId,
      filename: capture.filename,
      role: capture.role,
      byteLength: capture.byteLength,
      sha256: capture.sha256,
    }))
    .sort((left, right) =>
      compareCodeUnits(left.artifactId, right.artifactId),
    );
  const labelInspections: SurfaceLabelParserPayload[] = [];
  for (const labelArtifact of proposal.artifacts.filter(
    ({ role }) => role === "source-label",
  )) {
    const labelBytes = replayed.get(labelArtifact.artifactId);
    if (!labelBytes) {
      throw new Error("Surface label bytes are missing from quarantine replay");
    }
    const binding = deepFreeze(
      SurfaceLabelInspectionBindingSchema.parse({
        proposalId: proposal.proposalId,
        proposalChecksum: proposal.proposalChecksum,
        referenceChecksum: proposal.referenceChecksum,
        candidateProductIdentity: proposal.candidateProductIdentity,
        body: proposal.reference.body,
        productKind: proposal.reference.productKind,
        sourceRelease: proposal.reference.sourceRelease,
        labelArtifactId: labelArtifact.artifactId,
        labelFilename: labelArtifact.filename,
        labelByteLength: labelArtifact.byteLength,
        labelSha256: labelArtifact.sha256,
        files,
      }),
    );
    const payload = SurfaceLabelParserPayloadSchema.parse(
      await dependencies.parser.inspect({
        proposal,
        labelArtifact,
        labelBytes: labelBytes.slice(),
        expectedBinding: binding,
      }),
    );
    assertSurfaceLabelParserPayloadIntegrity(payload);
    if (
      stableStringify(payload.parser) !== stableStringify(parserDescriptor) ||
      stableStringify(payload.binding) !== stableStringify(binding)
    ) {
      throw new Error("Surface label parser payload drifted from exact context");
    }
    labelInspections.push(payload);
  }

  const inspectedAt = z.iso.datetime({ offset: true }).parse(dependencies.clock.now());
  if (Date.parse(inspectedAt) < latestCaptureMs) {
    throw new Error("Surface inspection cannot predate quarantine capture");
  }
  const sortedCaptures = [...captures].sort((left, right) =>
    compareCodeUnits(left.artifactId, right.artifactId),
  );
  const sortedInspections = [...labelInspections].sort((left, right) =>
    compareCodeUnits(
      left.binding.labelArtifactId,
      right.binding.labelArtifactId,
    ),
  );
  const reportIdentity = {
    proposalId: proposal.proposalId,
    proposalChecksum: proposal.proposalChecksum,
    inspectedAt,
    captureChecksums: sortedCaptures.map(({ captureChecksum }) => captureChecksum),
    parserPayloadChecksums: sortedInspections.map(
      ({ payloadChecksum }) => payloadChecksum,
    ),
  };
  const reportId = `sqins_${sha256Hex(stableStringify(reportIdentity)).slice(0, 24)}`;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    state: "machine-inspected-needs-selection-and-rights-review" as const,
    reportId,
    proposalId: proposal.proposalId,
    proposalChecksum: proposal.proposalChecksum,
    referenceChecksum: proposal.referenceChecksum,
    candidateProductIdentity: proposal.candidateProductIdentity,
    inspectedAt,
    captures: sortedCaptures,
    labelInspections: sortedInspections,
    fixtureContractOnly: true as const,
    ...noAuthority,
  };
  const report = SurfaceCandidateInspectionReportSchema.parse({
    ...unsigned,
    reportChecksum: {
      algorithm: "sha256",
      value: sha256Hex(stableStringify(unsigned)),
      scope: "surface-quarantine-inspection-report",
    },
  });
  assertSurfaceCandidateInspectionReportIntegrity(proposal, report);
  return deepFreeze(report);
}

export function assertSurfaceCandidateInspectionReportIntegrity(
  proposalInput: unknown,
  reportInput: unknown,
): asserts reportInput is SurfaceCandidateInspectionReport {
  const proposal = SurfaceQuarantineProposalSchema.parse(proposalInput);
  assertSurfaceQuarantineProposalIntegrity(proposal);
  const report = SurfaceCandidateInspectionReportSchema.parse(reportInput);
  if (
    report.proposalId !== proposal.proposalId ||
    report.proposalChecksum.value !== proposal.proposalChecksum.value ||
    report.referenceChecksum.value !== proposal.referenceChecksum.value ||
    stableStringify(report.candidateProductIdentity) !==
      stableStringify(proposal.candidateProductIdentity)
  ) {
    throw new Error("Surface inspection report is not bound to its proposal");
  }
  if (report.captures.length !== proposal.artifacts.length) {
    throw new Error("Surface inspection report does not contain every artifact capture");
  }
  const expectedCaptureOrder = proposal.artifacts.map(
    ({ artifactId }) => artifactId,
  );
  const actualCaptureOrder = report.captures.map(({ artifactId }) => artifactId);
  if (
    stableStringify(actualCaptureOrder) !==
    stableStringify(expectedCaptureOrder)
  ) {
    throw new Error("Surface inspection captures are not in canonical artifact order");
  }
  const captureIds = new Set<string>();
  let previousCaptureMs = Date.parse(proposal.frozenAt);
  for (const capture of report.captures) {
    if (captureIds.has(capture.artifactId)) {
      throw new Error("Surface inspection report repeats an artifact capture");
    }
    captureIds.add(capture.artifactId);
    assertSurfaceQuarantineCaptureReceiptIntegrity(proposal, capture);
    const captureMs = Date.parse(capture.capturedAt);
    if (
      captureMs < previousCaptureMs ||
      captureMs > Date.parse(report.inspectedAt)
    ) {
      throw new Error("Surface inspection report predates an artifact capture");
    }
    previousCaptureMs = captureMs;
  }
  const expectedLabels = proposal.artifacts
    .filter(({ role }) => role === "source-label")
    .map(({ artifactId }) => artifactId)
    .sort(compareCodeUnits);
  const actualLabels = report.labelInspections
    .map(({ binding }) => binding.labelArtifactId);
  if (stableStringify(actualLabels) !== stableStringify(expectedLabels)) {
    throw new Error("Surface inspection report does not inspect every source label");
  }
  const expectedFiles = report.captures.map((capture) => ({
    artifactId: capture.artifactId,
    filename: capture.filename,
    role: capture.role,
    byteLength: capture.byteLength,
    sha256: capture.sha256,
  }));
  const expectedParser = report.labelInspections[0]?.parser;
  for (const payload of report.labelInspections) {
    assertSurfaceLabelParserPayloadIntegrity(payload);
    const labelCapture = report.captures.find(
      ({ artifactId }) => artifactId === payload.binding.labelArtifactId,
    );
    if (
      !labelCapture ||
      labelCapture.role !== "source-label" ||
      payload.binding.labelFilename !== labelCapture.filename ||
      payload.binding.labelByteLength !== labelCapture.byteLength ||
      payload.binding.labelSha256 !== labelCapture.sha256 ||
      stableStringify(payload.binding.files) !== stableStringify(expectedFiles) ||
      payload.binding.proposalId !== proposal.proposalId ||
      payload.binding.proposalChecksum.value !== proposal.proposalChecksum.value ||
      payload.binding.referenceChecksum.value !== proposal.referenceChecksum.value ||
      stableStringify(payload.binding.candidateProductIdentity) !==
        stableStringify(proposal.candidateProductIdentity) ||
      payload.binding.body !== proposal.reference.body ||
      payload.binding.productKind !== proposal.reference.productKind ||
      payload.binding.sourceRelease !== proposal.reference.sourceRelease
    ) {
      throw new Error("Surface label payload is not bound to its proposal context");
    }
    if (
      !expectedParser ||
      stableStringify(payload.parser) !== stableStringify(expectedParser)
    ) {
      throw new Error("Surface inspection report mixes parser implementations");
    }
  }
  const reportIdentity = {
    proposalId: proposal.proposalId,
    proposalChecksum: proposal.proposalChecksum,
    inspectedAt: report.inspectedAt,
    captureChecksums: report.captures.map(({ captureChecksum }) => captureChecksum),
    parserPayloadChecksums: report.labelInspections.map(
      ({ payloadChecksum }) => payloadChecksum,
    ),
  };
  const expectedId = `sqins_${sha256Hex(stableStringify(reportIdentity)).slice(0, 24)}`;
  if (report.reportId !== expectedId) {
    throw new Error("Surface inspection report identity mismatch");
  }
  const { reportChecksum, ...unsigned } = report;
  if (reportChecksum.value !== sha256Hex(stableStringify(unsigned))) {
    throw new Error("Surface inspection report checksum mismatch");
  }
}

export type SurfaceReferenceRequirement = ReferenceOnlySurfaceProduct;
