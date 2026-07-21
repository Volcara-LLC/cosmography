import { stableJsonSha256 } from "@cosmography/scientific-model";
import {
  COVERAGE_DIMENSION_ORDER,
  COVERAGE_NO_AUTHORITY,
  COVERAGE_PACK_PROJECTION_VERSION,
  COVERAGE_PACK_SCHEMA_VERSION,
  createCoveragePack,
  createCoveragePackSet,
  type CoverageDimensionId,
  type CoverageDimensionState,
  type CoveragePack,
  type CoveragePackInput,
  type CoveragePackSet,
  type CoverageReleaseBinding,
} from "@cosmography/scientific-model/coverage-pack";

import { earthNetwork } from "@/app/data/earth";
import { voyager1 } from "@/app/data/missions/voyager-1";
import { marsJezeroPreIngestLedger } from "@/app/data/surface/mars-jezero-provenance";
import { moonApollo17SurfacePreIngestLedger } from "@/app/data/surface/moon-apollo17-provenance";
import {
  marsJezeroSurface,
  moonApollo17Surface,
} from "@/app/data/surface/surface-fixtures";

export const FOUNDATION_RELEASE_ID = "rel_landing_atlas_v0_1_0" as const;
export const FOUNDATION_COVERAGE_GENERATED_AT =
  "2026-07-19T18:00:00Z" as const;

export const FOUNDATION_COVERAGE_PACK_IDS = Object.freeze({
  "apollo-17": "covp_apollo_17_foundation_v1",
  "earth-network": "covp_earth_network_foundation_v1",
  "mars-jezero": "covp_mars_jezero_foundation_v1",
  "voyager-1": "covp_voyager_1_foundation_v1",
} as const);

type SourceBindingInput = CoveragePackInput["sourceBindings"][number];
type CountInput = CoveragePackInput["counts"][number];
type GapInput = CoveragePackInput["knownGaps"][number];
type RequirementInput = CoveragePackInput["nextEvidenceRequirements"][number];

const dimensionMetadata = {
  geometry: { ordinal: 1, label: "Geometry" },
  terrain: { ordinal: 2, label: "Terrain" },
  observations: { ordinal: 3, label: "Observations" },
  media: { ordinal: 4, label: "Media" },
  "timeline-completeness": { ordinal: 5, label: "Timeline completeness" },
  "update-cadence": { ordinal: 6, label: "Update cadence" },
  rights: { ordinal: 7, label: "Rights" },
  "validation-tier": { ordinal: 8, label: "Validation tier" },
} as const;

function canonical(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function canonicalDimensions(
  values: readonly CoverageDimensionId[],
): CoverageDimensionId[] {
  const selected = new Set(values);
  return COVERAGE_DIMENSION_ORDER.filter((dimensionId) =>
    selected.has(dimensionId),
  );
}

function canonicalOrigins(
  sourceBindingId: string,
  jsonPointers: readonly string[],
): GapInput["origins"] {
  return canonical(jsonPointers).map((jsonPointer) => ({
    sourceBindingId,
    jsonPointer,
  }));
}

function blockedEvidenceText(
  blockedReasons: readonly string[],
  literalFalseSafeguard: string,
): Readonly<{ summary: string; safeguard: string }> {
  const [summary, ...remaining] = blockedReasons;
  if (!summary) throw new Error("Coverage evidence requires a source blocker");
  return {
    summary,
    safeguard: [...remaining, literalFalseSafeguard].join(" "),
  };
}

function repositoryBinding(input: {
  bindingId: string;
  repositoryPath: string;
  exportName: string;
  recordId: string;
  version: string;
  frozenAt: string;
  record: unknown;
  referenceRecordIds: readonly string[];
}): SourceBindingInput {
  return {
    kind: "repository-record",
    bindingId: input.bindingId,
    repositoryPath: input.repositoryPath,
    exportName: input.exportName,
    recordId: input.recordId,
    version: input.version,
    sha256: stableJsonSha256(input.record),
    frozenAt: input.frozenAt,
    canonicalization: "cosmography-stable-json-v1",
    referenceRecordIds: canonical(input.referenceRecordIds),
  };
}

function retainedArtifactBinding(input: {
  bindingId: string;
  repositoryPath: string;
  recordId: string;
  version: string;
  frozenAt: string;
  sha256: string;
  byteLength: number;
  referenceRecordIds: readonly string[];
}): SourceBindingInput {
  return {
    kind: "retained-artifact",
    bindingId: input.bindingId,
    repositoryPath: input.repositoryPath,
    recordId: input.recordId,
    version: input.version,
    sha256: input.sha256,
    byteLength: input.byteLength,
    frozenAt: input.frozenAt,
    canonicalization: "raw-bytes-sha256",
    referenceRecordIds: canonical(input.referenceRecordIds),
  };
}

function count(input: Omit<CountInput, "dimensionIds" | "sourceBindingIds"> & {
  dimensionIds: readonly CoverageDimensionId[];
  sourceBindingIds: readonly string[];
}): CountInput {
  return {
    ...input,
    dimensionIds: canonicalDimensions(input.dimensionIds),
    sourceBindingIds: canonical(input.sourceBindingIds),
  };
}

type PackDefinition = Readonly<{
  packId: string;
  coverageKey: string;
  title: string;
  summary: string;
  scope: CoveragePackInput["scope"];
  sourceBindings: readonly SourceBindingInput[];
  statuses: Readonly<Record<CoverageDimensionId, CoverageDimensionState>>;
  dimensionSummaries: Readonly<Record<CoverageDimensionId, string>>;
  dimensionBoundaries: Readonly<Record<CoverageDimensionId, string>>;
  counts: readonly CountInput[];
  evidence: readonly Readonly<{
    sourceBindingIds: readonly string[];
    sourceReferenceIds: readonly string[];
    gap: Omit<GapInput, "sourceBindingIds" | "sourceReferenceIds" | "nextEvidenceRequirementIds">;
    requirement: Omit<RequirementInput, "sourceBindingIds" | "sourceReferenceIds" | "knownGapIds">;
  }>[];
}>;

function buildPack(
  releaseBinding: CoverageReleaseBinding,
  definition: PackDefinition,
): CoveragePack {
  const sourceBindings = [...definition.sourceBindings].sort((left, right) =>
    left.bindingId < right.bindingId ? -1 : left.bindingId > right.bindingId ? 1 : 0,
  );
  const bindingIds = sourceBindings.map((binding) => binding.bindingId);
  const referenceIds = canonical(
    sourceBindings.flatMap((binding) => binding.referenceRecordIds),
  );
  const gaps: GapInput[] = definition.evidence
    .map((record) => ({
      ...record.gap,
      sourceBindingIds: canonical(record.sourceBindingIds),
      sourceReferenceIds: canonical(record.sourceReferenceIds),
      nextEvidenceRequirementIds: [record.requirement.requirementId],
    }))
    .sort((left, right) =>
      left.gapId < right.gapId ? -1 : left.gapId > right.gapId ? 1 : 0,
    );
  const requirements: RequirementInput[] = definition.evidence
    .map((record) => ({
      ...record.requirement,
      sourceBindingIds: canonical(record.sourceBindingIds),
      sourceReferenceIds: canonical(record.sourceReferenceIds),
      knownGapIds: [record.gap.gapId],
    }))
    .sort((left, right) =>
      left.requirementId < right.requirementId
        ? -1
        : left.requirementId > right.requirementId
          ? 1
          : 0,
    );
  const dimensions = COVERAGE_DIMENSION_ORDER.map((dimensionId) => {
    const status = definition.statuses[dimensionId];
    const inScope = status !== "out-of-scope";
    const countIds = definition.counts
      .filter((record) => record.dimensionIds.includes(dimensionId))
      .map((record) => record.countId);
    return {
      dimensionId,
      ...dimensionMetadata[dimensionId],
      status,
      summary: definition.dimensionSummaries[dimensionId],
      scopeBoundary: definition.dimensionBoundaries[dimensionId],
      countIds: canonical(countIds),
      sourceBindingIds: inScope ? bindingIds : [],
      sourceReferenceIds: inScope ? referenceIds : [],
      knownGapIds: gaps
        .filter((record) => record.dimensionIds.includes(dimensionId))
        .map((record) => record.gapId),
      nextEvidenceRequirementIds: requirements
        .filter((record) => record.dimensionIds.includes(dimensionId))
        .map((record) => record.requirementId),
    };
  }) as CoveragePackInput["dimensions"];

  return createCoveragePack({
    schemaVersion: COVERAGE_PACK_SCHEMA_VERSION,
    packId: definition.packId,
    coverageKey: definition.coverageKey,
    title: definition.title,
    summary: definition.summary,
    generatedAt: FOUNDATION_COVERAGE_GENERATED_AT,
    state: "release-scoped-coverage-summary-non-authoritative",
    releaseBinding,
    scope: definition.scope,
    sourceBindings,
    sourceReferenceIds: referenceIds,
    dimensions,
    counts: [...definition.counts].sort((left, right) =>
      left.countId < right.countId ? -1 : left.countId > right.countId ? 1 : 0,
    ),
    knownGaps: gaps,
    nextEvidenceRequirements: requirements,
    correctionLineage: { kind: "initial-release-snapshot", revision: 1 },
    ...COVERAGE_NO_AUTHORITY,
  });
}

const sharedBoundary = {
  geometry: "Only geometry declarations present in the bound frozen record are summarized.",
  terrain: "No terrain completeness or runtime suitability is inferred.",
  observations: "Record counts do not establish observational completeness or authenticity.",
  media: "References and metadata do not admit, redistribute, or render media bytes.",
  "timeline-completeness": "A bounded chronology is not a complete historical timeline.",
  "update-cadence": "This release-scoped snapshot is not a live or rolling feed.",
  rights: "Source links and credits do not establish asset-level rights clearance.",
  "validation-tier": "No Coverage Pack field grants scientific, runtime, render, or release authority.",
} as const;

function surfacePack(input: {
  releaseBinding: CoverageReleaseBinding;
  key: "apollo-17" | "mars-jezero";
  title: string;
  summary: string;
  navigationRecordIds: string[];
  ledger:
    | typeof marsJezeroPreIngestLedger
    | typeof moonApollo17SurfacePreIngestLedger;
  surface: typeof marsJezeroSurface | typeof moonApollo17Surface;
  repositoryPath: string;
  exportName: string;
  bindingId: string;
  surfaceBindingId: string;
}): CoveragePack {
  const ledger = input.ledger;
  const ledgerBinding = repositoryBinding({
    bindingId: input.bindingId,
    repositoryPath: input.repositoryPath,
    exportName: input.exportName,
    recordId: ledger.experienceId,
    version: `surface-pre-ingest-${ledger.schemaVersion}`,
    frozenAt: ledger.verifiedAt,
    record: ledger,
    referenceRecordIds: [
      ledger.experienceId,
      ...ledger.productRequirements.flatMap((record) => [
        record.requirementId,
        ...record.sourceReferenceIds,
        ...record.requiredForEvidenceIds,
        ...record.requiredForCaptureNodeIds,
      ]),
      ...ledger.captureContexts.flatMap((record) => [
        record.captureContextId,
        record.captureNodeId,
        ...record.sourceReferenceIds,
        ...record.requiredProductRequirementIds,
      ]),
    ],
  });
  const surfaceBinding = repositoryBinding({
    bindingId: input.surfaceBindingId,
    repositoryPath: "apps/web/app/data/surface/surface-fixtures.ts",
    exportName:
      input.key === "mars-jezero" ? "marsJezeroSurface" : "moonApollo17Surface",
    recordId: input.surface.id,
    version: input.surface.release,
    frozenAt: "2026-07-19T00:00:00Z",
    record: input.surface,
    referenceRecordIds: [
      input.surface.id,
      ...input.surface.sources.map((record) => record.id),
      ...input.surface.evidence.map((record) => record.id),
      ...input.surface.stages.map((record) => record.id),
      ...input.surface.captureNodes.map((record) => record.id),
    ],
  });
  const allDimensions = [...COVERAGE_DIMENSION_ORDER];
  const prefix = input.key.replaceAll("-", "_");
  const productEvidence = ledger.productRequirements.map((record, index) => {
    const recordSuffix = record.requirementId.replaceAll("-", "_");
    const sourceReferenceIds = canonical([
      record.requirementId,
      ...record.sourceReferenceIds,
      ...record.requiredForEvidenceIds,
      ...record.requiredForCaptureNodeIds,
    ]);
    const text = blockedEvidenceText(
      record.blockedReasons,
      "The bound product requirement records assetBytesPresent=false, renderAllowed=false, and releaseEligible=false.",
    );
    const requirementDetail =
      record.productIdentity.state === "selection-pending"
        ? record.productIdentity.reason
        : record.blockedReasons[0]!;
    return {
      sourceBindingIds: [ledgerBinding.bindingId],
      sourceReferenceIds,
      gap: {
        gapId: `covgap_${prefix}_product_${recordSuffix}`,
        severity: "unranked" as const,
        ...text,
        dimensionIds: allDimensions,
        origins: canonicalOrigins(ledgerBinding.bindingId, [
          `/productRequirements/${index}/assetBytesPresent`,
          ...record.blockedReasons.map(
            (_reason, reasonIndex) =>
              `/productRequirements/${index}/blockedReasons/${reasonIndex}`,
          ),
          `/productRequirements/${index}/releaseEligible`,
          `/productRequirements/${index}/renderAllowed`,
        ]),
      },
      requirement: {
        requirementId: `covreq_${prefix}_product_${recordSuffix}`,
        title: `Resolve ${record.title}`,
        state: "pending" as const,
        detail: requirementDetail,
        dimensionIds: allDimensions,
        origins: canonicalOrigins(ledgerBinding.bindingId, [
          record.productIdentity.state === "selection-pending"
            ? `/productRequirements/${index}/productIdentity/reason`
            : `/productRequirements/${index}/blockedReasons/0`,
        ]),
      },
    };
  });
  const captureEvidence = ledger.captureContexts.map((record, index) => {
    const recordSuffix = record.captureContextId.replaceAll("-", "_");
    const sourceReferenceIds = canonical([
      record.captureContextId,
      record.captureNodeId,
      ...record.sourceReferenceIds,
      ...record.requiredProductRequirementIds,
    ]);
    const text = blockedEvidenceText(
      record.blockedReasons,
      "The bound capture context records renderableCameraPose=false, renderAllowed=false, and releaseEligible=false.",
    );
    return {
      sourceBindingIds: [ledgerBinding.bindingId],
      sourceReferenceIds,
      gap: {
        gapId: `covgap_${prefix}_capture_${recordSuffix}`,
        severity: "unranked" as const,
        ...text,
        dimensionIds: allDimensions,
        origins: canonicalOrigins(ledgerBinding.bindingId, [
          ...record.blockedReasons.map(
            (_reason, reasonIndex) =>
              `/captureContexts/${index}/blockedReasons/${reasonIndex}`,
          ),
          `/captureContexts/${index}/releaseEligible`,
          `/captureContexts/${index}/renderAllowed`,
          `/captureContexts/${index}/renderableCameraPose`,
        ]),
      },
      requirement: {
        requirementId: `covreq_${prefix}_capture_${recordSuffix}`,
        title: `Resolve physical pose for ${record.captureNodeId}`,
        state: "pending" as const,
        detail: record.blockedReasons[0]!,
        dimensionIds: allDimensions,
        origins: canonicalOrigins(ledgerBinding.bindingId, [
          `/captureContexts/${index}/blockedReasons/0`,
        ]),
      },
    };
  });
  return buildPack(input.releaseBinding, {
    packId: FOUNDATION_COVERAGE_PACK_IDS[input.key],
    coverageKey: input.key,
    title: input.title,
    summary: input.summary,
    scope: {
      kind: "surface-experience",
      recordId: ledger.experienceId,
      navigationRecordIds: canonical(input.navigationRecordIds),
    },
    sourceBindings: [ledgerBinding, surfaceBinding],
    statuses: {
      geometry: "reference-records-only",
      terrain: "reference-records-only",
      observations: "reference-records-only",
      media: "reference-records-only",
      "timeline-completeness": "reference-records-only",
      "update-cadence": "frozen-records-only",
      rights: "reference-records-only",
      "validation-tier": "reference-records-only",
    },
    dimensionSummaries: {
      geometry: `${ledger.captureContexts.length} capture contexts remain withheld without renderable poses.`,
      terrain: `${ledger.productRequirements.length} product requirements remain reference-only pending artifact review.`,
      observations: "The ledger binds evidence requirements but contains no admitted source-product bytes.",
      media: "Recorded-view requirements remain references with rendering withheld.",
      "timeline-completeness": "Discrete capture contexts do not establish continuous recorded coverage.",
      "update-cadence": `The bound ledger was verified at ${ledger.verifiedAt}.`,
      rights: "Every product requirement remains release-ineligible and asset-level rights are unresolved.",
      "validation-tier": "The pre-ingest ledger is a non-authoritative evidence boundary, not scientific validation.",
    },
    dimensionBoundaries: sharedBoundary,
    counts: [
      count({
        countId: `covm_${prefix}_admitted_artifacts`,
        label: "Admitted artifacts",
        value: ledger.productRequirements.filter((record) => record.assetBytesPresent)
          .length,
        total: ledger.productRequirements.length,
        unit: "artifacts",
        basis: "Derived from literal assetBytesPresent fields in the bound pre-ingest ledger.",
        dimensionIds: ["terrain", "observations", "media", "validation-tier"],
        sourceBindingIds: [ledgerBinding.bindingId],
      }),
      count({
        countId: `covm_${prefix}_capture_contexts`,
        label: "Withheld capture contexts",
        value: ledger.captureContexts.length,
        unit: "contexts",
        basis: "Exact capture-context records in the bound pre-ingest ledger.",
        dimensionIds: ["geometry", "media", "timeline-completeness"],
        sourceBindingIds: [ledgerBinding.bindingId],
      }),
      count({
        countId: `covm_${prefix}_evidence_records`,
        label: "Evidence records",
        value: input.surface.evidence.length,
        unit: "records",
        basis: "Exact evidence-record count in the bound surface fixture.",
        dimensionIds: ["terrain", "observations", "media", "validation-tier"],
        sourceBindingIds: [surfaceBinding.bindingId],
      }),
      count({
        countId: `covm_${prefix}_product_requirements`,
        label: "Reference-only product requirements",
        value: ledger.productRequirements.length,
        unit: "requirements",
        basis: "Exact product-requirement records in the bound pre-ingest ledger.",
        dimensionIds: ["terrain", "observations", "media", "rights"],
        sourceBindingIds: [ledgerBinding.bindingId],
      }),
      count({
        countId: `covm_${prefix}_renderable_poses`,
        label: "Renderable poses",
        value: ledger.captureContexts.filter((record) => record.renderableCameraPose)
          .length,
        total: ledger.captureContexts.length,
        unit: "poses",
        basis: "Derived from literal renderableCameraPose fields in the bound capture contexts.",
        dimensionIds: ["geometry", "media", "validation-tier"],
        sourceBindingIds: [ledgerBinding.bindingId],
      }),
      count({
        countId: `covm_${prefix}_source_records`,
        label: "Source records",
        value: input.surface.sources.length,
        unit: "sources",
        basis: "Exact source-record count in the bound surface fixture.",
        dimensionIds: ["observations", "media", "update-cadence", "rights"],
        sourceBindingIds: [surfaceBinding.bindingId],
      }),
      count({
        countId: `covm_${prefix}_stages`,
        label: "Semantic surface stages",
        value: input.surface.stages.length,
        unit: "records",
        basis: "Exact semantic-stage count in the bound surface fixture.",
        dimensionIds: ["geometry", "terrain", "observations", "media"],
        sourceBindingIds: [surfaceBinding.bindingId],
      }),
    ],
    evidence: [...productEvidence, ...captureEvidence],
  });
}

function voyagerPack(releaseBinding: CoverageReleaseBinding): CoveragePack {
  const kernelSet = voyager1.provenance.kernelSet;
  if (!("missingEvidence" in kernelSet)) {
    throw new Error("Voyager Coverage Pack requires the frozen blocked kernel selection");
  }
  const pendingMediaAdmissions = voyager1.provenance.mediaAdmissions.flatMap(
    (record, index) =>
      record.state === "reference-only-pending-asset-review"
        ? [{ record, index }]
        : [],
  );
  if (pendingMediaAdmissions.length === 0) {
    throw new Error("Voyager Coverage Pack requires reference-only media admissions");
  }
  const fixtureBinding = repositoryBinding({
    bindingId: "covsrc_voyager_1_fixture",
    repositoryPath: "apps/web/app/data/missions/voyager-1.ts",
    exportName: "voyager1",
    recordId: voyager1.id,
    version: "voyager-foundation-2026-07-19",
    frozenAt: voyager1.verifiedAt,
    record: voyager1,
    referenceRecordIds: [
      voyager1.id,
      voyager1.trajectory.id,
      ...voyager1.sources.map((record) => record.id),
      ...voyager1.events.map((record) => record.id),
      ...voyager1.trajectory.points.map((record) => record.id),
      ...voyager1.media.map((record) => record.id),
      ...voyager1.organizations.map((record) => record.id),
      ...voyager1.instruments.map((record) => record.id),
      voyager1.provenance.horizonsValidation.validationId,
      kernelSet.kernelSetId,
      ...kernelSet.artifacts.map((record) => record.artifactId),
      ...kernelSet.artifacts.flatMap((record) => record.sourceReferenceIds),
      ...pendingMediaAdmissions.flatMap(({ record }) => [
        record.mediaId,
        ...record.sourceReferenceIds,
      ]),
      ...voyager1.provenance.captureContexts.flatMap((record) => [
        record.captureContextId,
        record.mediaId,
        ...record.sourceReferenceIds,
      ]),
    ],
  });
  const artifactBinding = retainedArtifactBinding({
    bindingId: "covsrc_voyager_1_horizons_artifact",
    repositoryPath: voyager1.trajectory.responseArtifact.repositoryPath,
    recordId: voyager1.trajectory.id,
    version: "horizons-vectors-2026-07-19",
    frozenAt: voyager1.trajectory.responseArtifact.retrievedAt,
    sha256: voyager1.trajectory.responseArtifact.sha256,
    byteLength: voyager1.trajectory.responseArtifact.byteLength,
    referenceRecordIds: [
      voyager1.trajectory.id,
      voyager1.provenance.horizonsValidation.validationId,
      ...voyager1.trajectory.points.map((record) => record.id),
    ],
  });
  const kernelReferenceIds = canonical([
    kernelSet.kernelSetId,
    ...kernelSet.artifacts.flatMap((record) => [
      record.artifactId,
      ...record.sourceReferenceIds,
    ]),
  ]);
  const validationReferenceIds = canonical([
    kernelSet.kernelSetId,
    voyager1.provenance.horizonsValidation.validationId,
    voyager1.trajectory.id,
    ...voyager1.trajectory.points.map((record) => record.id),
  ]);
  const mediaReferenceIds = canonical(
    pendingMediaAdmissions.flatMap(({ record }) => [
      record.mediaId,
      ...record.sourceReferenceIds,
    ]),
  );
  const captureReferenceIds = canonical([
    kernelSet.kernelSetId,
    ...voyager1.provenance.captureContexts.flatMap((record) => [
      record.captureContextId,
      record.mediaId,
      ...record.sourceReferenceIds,
    ]),
  ]);
  const kernelText = blockedEvidenceText(
    kernelSet.missingEvidence.slice(0, 2),
    "The bound kernel selection records executionAllowed=false and releaseEligible=false.",
  );
  const validationText = blockedEvidenceText(
    [
      kernelSet.missingEvidence[2]!,
      voyager1.provenance.horizonsValidation.blockedReason,
    ],
    "The validation record remains awaiting-independent-spice-run.",
  );
  const mediaText = blockedEvidenceText(
    pendingMediaAdmissions.map(({ record }) => record.blockedReason),
    "Every bound media admission records assetBytesPresent=false and renderAllowed=false.",
  );
  const captureText = blockedEvidenceText(
    [
      kernelSet.missingEvidence[3]!,
      ...voyager1.provenance.captureContexts.flatMap(
        (record) => record.blockedReasons,
      ),
    ],
    "Every bound capture context records exactEpochStateAvailable=false, verifiedAttitudeAvailable=false, and renderableCameraPose=false.",
  );
  return buildPack(releaseBinding, {
    packId: FOUNDATION_COVERAGE_PACK_IDS["voyager-1"],
    coverageKey: "voyager-1",
    title: "Voyager 1 coverage pack",
    summary: voyager1.publicDataCaveat,
    scope: {
      kind: "mission",
      recordId: voyager1.id,
      navigationRecordIds: ["voyager-1"],
    },
    sourceBindings: [fixtureBinding, artifactBinding],
    statuses: {
      geometry: "frozen-records-only",
      terrain: "out-of-scope",
      observations: "frozen-records-only",
      media: "reference-records-only",
      "timeline-completeness": "frozen-records-only",
      "update-cadence": "frozen-records-only",
      rights: "reference-records-only",
      "validation-tier": "frozen-records-only",
    },
    dimensionSummaries: {
      geometry: "A proposed kernel selection and frozen Horizons vectors exist without an executed CSPICE artifact.",
      terrain: "Terrain coverage is outside this mission pack.",
      observations: `${voyager1.trajectory.points.length} frozen Horizons trajectory epochs are retained as ephemeris, not telemetry.`,
      media: `${pendingMediaAdmissions.length} media records remain reference-only pending asset review.`,
      "timeline-completeness": `${voyager1.events.length} bounded mission events do not claim a complete mission history.`,
      "update-cadence": `The mission fixture was verified at ${voyager1.verifiedAt}.`,
      rights: "Media references do not establish asset-level embedding or redistribution rights.",
      "validation-tier": "The frozen Horizons oracle has no independently generated CSPICE comparison artifact.",
    },
    dimensionBoundaries: sharedBoundary,
    counts: [
      count({
        countId: "covm_voyager_1_events",
        label: "Mission events",
        value: voyager1.events.length,
        unit: "records",
        basis: "Exact event-record count in the bound mission fixture.",
        dimensionIds: ["observations", "timeline-completeness", "update-cadence"],
        sourceBindingIds: [fixtureBinding.bindingId],
      }),
      count({
        countId: "covm_voyager_1_executable_kernels",
        label: "Executable kernel artifacts",
        value: kernelSet.executionAllowed ? kernelSet.artifacts.length : 0,
        total: kernelSet.artifacts.length,
        unit: "artifacts",
        basis: "Derived from the literal executionAllowed state of the frozen kernel selection.",
        dimensionIds: ["geometry", "validation-tier"],
        sourceBindingIds: [fixtureBinding.bindingId],
      }),
      count({
        countId: "covm_voyager_1_frozen_epochs",
        label: "Frozen trajectory epochs",
        value: voyager1.trajectory.points.length,
        unit: "epochs",
        basis: "Exact point count in the strictly parsed frozen Horizons trajectory.",
        dimensionIds: ["geometry", "observations", "timeline-completeness"],
        sourceBindingIds: [artifactBinding.bindingId, fixtureBinding.bindingId],
      }),
      count({
        countId: "covm_voyager_1_kernel_references",
        label: "Proposed kernel references",
        value: kernelSet.artifacts.length,
        unit: "records",
        basis: "Exact artifact-reference count in the blocked frozen kernel selection.",
        dimensionIds: ["geometry", "validation-tier"],
        sourceBindingIds: [fixtureBinding.bindingId],
      }),
      count({
        countId: "covm_voyager_1_reference_media",
        label: "Reference-only media",
        value: pendingMediaAdmissions.length,
        unit: "records",
        basis: "Exact reference-only media-admission records in the bound mission fixture.",
        dimensionIds: ["media", "rights", "validation-tier"],
        sourceBindingIds: [fixtureBinding.bindingId],
      }),
      count({
        countId: "covm_voyager_1_renderable_captures",
        label: "Renderable capture contexts",
        value: voyager1.provenance.captureContexts.filter(
          (record) => record.renderableCameraPose,
        ).length,
        total: voyager1.provenance.captureContexts.length,
        unit: "contexts",
        basis: "Derived from literal renderableCameraPose fields in the frozen capture contexts.",
        dimensionIds: ["geometry", "media", "validation-tier"],
        sourceBindingIds: [fixtureBinding.bindingId],
      }),
      count({
        countId: "covm_voyager_1_retained_artifacts",
        label: "Retained raw artifacts",
        value: 1,
        unit: "artifacts",
        basis: "One exact raw Horizons response is retained with byte length and SHA-256.",
        dimensionIds: ["observations", "validation-tier"],
        sourceBindingIds: [artifactBinding.bindingId],
      }),
      count({
        countId: "covm_voyager_1_sources",
        label: "Source records",
        value: voyager1.sources.length,
        unit: "sources",
        basis: "Exact source-record count in the bound mission fixture.",
        dimensionIds: ["observations", "media", "update-cadence", "rights"],
        sourceBindingIds: [fixtureBinding.bindingId],
      }),
      count({
        countId: "covm_voyager_1_withheld_captures",
        label: "Withheld capture contexts",
        value: voyager1.provenance.captureContexts.length,
        unit: "contexts",
        basis: "Exact withheld capture-context count in the bound mission fixture.",
        dimensionIds: ["geometry", "media", "timeline-completeness"],
        sourceBindingIds: [fixtureBinding.bindingId],
      }),
    ],
    evidence: [
      {
        sourceBindingIds: [fixtureBinding.bindingId],
        sourceReferenceIds: kernelReferenceIds,
        gap: {
          gapId: "covgap_voyager_1_kernel_artifacts",
          severity: "unranked",
          ...kernelText,
          dimensionIds: ["geometry", "validation-tier"],
          origins: canonicalOrigins(fixtureBinding.bindingId, [
            "/provenance/kernelSet/executionAllowed",
            "/provenance/kernelSet/missingEvidence/0",
            "/provenance/kernelSet/missingEvidence/1",
            "/provenance/kernelSet/releaseEligible",
          ]),
        },
        requirement: {
          requirementId: "covreq_voyager_1_kernel_artifacts",
          title: "Retain and execute the exact Voyager kernel set",
          state: "pending",
          detail: kernelSet.missingEvidence[0]!,
          dimensionIds: ["geometry", "validation-tier"],
          origins: canonicalOrigins(fixtureBinding.bindingId, [
            "/provenance/kernelSet/missingEvidence/0",
          ]),
        },
      },
      {
        sourceBindingIds: [fixtureBinding.bindingId],
        sourceReferenceIds: validationReferenceIds,
        gap: {
          gapId: "covgap_voyager_1_independent_validation",
          severity: "unranked",
          ...validationText,
          dimensionIds: ["geometry", "observations", "validation-tier"],
          origins: canonicalOrigins(fixtureBinding.bindingId, [
            "/provenance/horizonsValidation/blockedReason",
            "/provenance/kernelSet/missingEvidence/2",
          ]),
        },
        requirement: {
          requirementId: "covreq_voyager_1_independent_validation",
          title: "Generate an independent CSPICE comparison artifact",
          state: "pending",
          detail: voyager1.provenance.horizonsValidation.blockedReason,
          dimensionIds: ["geometry", "observations", "validation-tier"],
          origins: canonicalOrigins(fixtureBinding.bindingId, [
            "/provenance/horizonsValidation/blockedReason",
          ]),
        },
      },
      {
        sourceBindingIds: [fixtureBinding.bindingId],
        sourceReferenceIds: mediaReferenceIds,
        gap: {
          gapId: "covgap_voyager_1_media_admissions",
          severity: "unranked",
          ...mediaText,
          dimensionIds: ["media", "rights", "validation-tier"],
          origins: canonicalOrigins(
            fixtureBinding.bindingId,
            pendingMediaAdmissions.flatMap(({ index }) => [
              `/provenance/mediaAdmissions/${index}/assetBytesPresent`,
              `/provenance/mediaAdmissions/${index}/blockedReason`,
              `/provenance/mediaAdmissions/${index}/renderAllowed`,
            ]),
          ),
        },
        requirement: {
          requirementId: "covreq_voyager_1_media_admissions",
          title: "Admit exact reviewed Voyager media assets",
          state: "pending",
          detail: pendingMediaAdmissions[0]!.record.blockedReason,
          dimensionIds: ["media", "rights", "validation-tier"],
          origins: canonicalOrigins(fixtureBinding.bindingId, [
            `/provenance/mediaAdmissions/${pendingMediaAdmissions[0]!.index}/blockedReason`,
          ]),
        },
      },
      {
        sourceBindingIds: [fixtureBinding.bindingId],
        sourceReferenceIds: captureReferenceIds,
        gap: {
          gapId: "covgap_voyager_1_capture_contexts",
          severity: "unranked",
          ...captureText,
          dimensionIds: [
            "geometry",
            "media",
            "timeline-completeness",
            "validation-tier",
          ],
          origins: canonicalOrigins(fixtureBinding.bindingId, [
            "/provenance/kernelSet/missingEvidence/3",
            ...voyager1.provenance.captureContexts.flatMap((_record, index) => [
              `/provenance/captureContexts/${index}/blockedReasons/0`,
              ..._record.blockedReasons.slice(1).map(
                (_reason, reasonIndex) =>
                  `/provenance/captureContexts/${index}/blockedReasons/${reasonIndex + 1}`,
              ),
              `/provenance/captureContexts/${index}/exactEpochStateAvailable`,
              `/provenance/captureContexts/${index}/renderableCameraPose`,
              `/provenance/captureContexts/${index}/verifiedAttitudeAvailable`,
            ]),
          ]),
        },
        requirement: {
          requirementId: "covreq_voyager_1_capture_contexts",
          title: "Resolve exact physical Voyager capture poses",
          state: "pending",
          detail: kernelSet.missingEvidence[3]!,
          dimensionIds: [
            "geometry",
            "media",
            "timeline-completeness",
            "validation-tier",
          ],
          origins: canonicalOrigins(fixtureBinding.bindingId, [
            "/provenance/kernelSet/missingEvidence/3",
          ]),
        },
      },
    ],
  });
}

function earthPack(releaseBinding: CoverageReleaseBinding): CoveragePack {
  const binding = repositoryBinding({
    bindingId: "covsrc_earth_network_fixture",
    repositoryPath: "apps/web/app/data/earth/index.ts",
    exportName: "earthNetwork",
    recordId: earthNetwork.releaseId,
    version: earthNetwork.releaseId,
    frozenAt: earthNetwork.generatedAt,
    record: earthNetwork,
    referenceRecordIds: [
      earthNetwork.releaseId,
      ...earthNetwork.sources.map((record) => record.id),
      ...earthNetwork.organizations.map((record) => record.id),
      ...earthNetwork.sites.map((record) => record.id),
      ...earthNetwork.gaps.map((record) => record.id),
    ],
  });
  const gapRecord = earthNetwork.gaps[0]!;
  return buildPack(releaseBinding, {
    packId: FOUNDATION_COVERAGE_PACK_IDS["earth-network"],
    coverageKey: "earth-network",
    title: "Earth exploration network coverage pack",
    summary: gapRecord.gap,
    scope: {
      kind: "earth-network",
      recordId: earthNetwork.releaseId,
      navigationRecordIds: ["earth-exploration-network"],
    },
    sourceBindings: [binding],
    statuses: {
      geometry: "frozen-records-only",
      terrain: "out-of-scope",
      observations: "frozen-records-only",
      media: "absent",
      "timeline-completeness": "out-of-scope",
      "update-cadence": "frozen-records-only",
      rights: "reference-records-only",
      "validation-tier": "frozen-records-only",
    },
    dimensionSummaries: {
      geometry: "Site coordinates retain datum, precision, uncertainty, and source fields.",
      terrain: "Terrain products are outside this institutional network pack.",
      observations: `${earthNetwork.sites.length} representative site records are frozen without a completeness claim.`,
      media: "No media bytes are admitted by the Earth network fixture.",
      "timeline-completeness": "A historical timeline is outside this institutional network pack.",
      "update-cadence": `The representative network snapshot was generated at ${earthNetwork.generatedAt}.`,
      rights: "The source ledger retains rights statuses while asset ingestion remains blocked.",
      "validation-tier": "Fixture validation establishes record coherence, not global completeness or scientific validation.",
    },
    dimensionBoundaries: sharedBoundary,
    counts: [
      count({
        countId: "covm_earth_network_gaps",
        label: "Known coverage gaps",
        value: earthNetwork.gaps.length,
        unit: "gaps",
        basis: "Exact gap-record count in the bound Earth network fixture.",
        dimensionIds: ["geometry", "observations", "media", "update-cadence", "rights", "validation-tier"],
        sourceBindingIds: [binding.bindingId],
      }),
      count({
        countId: "covm_earth_network_organizations",
        label: "Organization records",
        value: earthNetwork.organizations.length,
        unit: "organizations",
        basis: "Exact organization-record count in the bound Earth network fixture.",
        dimensionIds: ["observations", "update-cadence", "validation-tier"],
        sourceBindingIds: [binding.bindingId],
      }),
      count({
        countId: "covm_earth_network_sites",
        label: "Indexed sites",
        value: earthNetwork.sites.length,
        unit: "sites",
        basis: "Exact site-record count in the representative incomplete fixture.",
        dimensionIds: ["geometry", "observations", "update-cadence", "validation-tier"],
        sourceBindingIds: [binding.bindingId],
      }),
      count({
        countId: "covm_earth_network_sources",
        label: "Source records",
        value: earthNetwork.sources.length,
        unit: "sources",
        basis: "Exact source-record count in the bound Earth network fixture.",
        dimensionIds: ["geometry", "observations", "update-cadence", "rights", "validation-tier"],
        sourceBindingIds: [binding.bindingId],
      }),
    ],
    evidence: earthNetwork.gaps.map((record, index) => {
      const suffix = record.id.replaceAll("-", "_");
      const dimensionIds = earthGapDimensions(record.id);
      return {
        sourceBindingIds: [binding.bindingId],
        sourceReferenceIds: [record.id],
        gap: {
          gapId: `covgap_earth_network_${suffix}`,
          severity: record.severity,
          summary: record.gap,
          safeguard: record.safeguard,
          dimensionIds,
          origins: [
            {
              sourceBindingId: binding.bindingId,
              jsonPointer: `/gaps/${index}/gap`,
            },
          ],
        },
        requirement: {
          requirementId: `covreq_earth_network_${suffix}`,
          title: `Next evidence for ${record.scope}`,
          state: "pending" as const,
          detail: record.nextEvidence,
          dimensionIds,
          origins: [
            {
              sourceBindingId: binding.bindingId,
              jsonPointer: `/gaps/${index}/nextEvidence`,
            },
          ],
        },
      };
    }),
  });
}

function earthGapDimensions(gapId: string): CoverageDimensionId[] {
  switch (gapId) {
    case "coordinate-authority":
      return ["geometry", "observations", "validation-tier"];
    case "public-access-freshness":
      return ["observations", "update-cadence", "validation-tier"];
    case "rights-assets":
      return ["media", "rights", "validation-tier"];
    default:
      return ["observations", "validation-tier"];
  }
}

export function createFoundationCoveragePackSet(
  releaseBinding: CoverageReleaseBinding,
): CoveragePackSet {
  if (releaseBinding.releaseId !== FOUNDATION_RELEASE_ID) {
    throw new Error("Foundation Coverage Packs require the exact foundation release");
  }
  const packs = [
    surfacePack({
      releaseBinding,
      key: "apollo-17",
      title: "Apollo 17 coverage pack",
      summary:
        "Reference-only Apollo 17 terrain, traverse, camera, and panorama requirements with all artifact and pose authority withheld.",
      navigationRecordIds: ["apollo-17"],
      ledger: moonApollo17SurfacePreIngestLedger,
      surface: moonApollo17Surface,
      repositoryPath: "apps/web/app/data/surface/moon-apollo17-provenance.ts",
      exportName: "moonApollo17SurfacePreIngestLedger",
      bindingId: "covsrc_apollo_17_pre_ingest_ledger",
      surfaceBindingId: "covsrc_apollo_17_surface_fixture",
    }),
    earthPack(releaseBinding),
    surfacePack({
      releaseBinding,
      key: "mars-jezero",
      title: "Mars Jezero coverage pack",
      summary:
        "Reference-only Jezero terrain, localization, camera, and panorama requirements with all artifact and pose authority withheld.",
      navigationRecordIds: ["jezero", "mars"],
      ledger: marsJezeroPreIngestLedger,
      surface: marsJezeroSurface,
      repositoryPath: "apps/web/app/data/surface/mars-jezero-provenance.ts",
      exportName: "marsJezeroPreIngestLedger",
      bindingId: "covsrc_mars_jezero_pre_ingest_ledger",
      surfaceBindingId: "covsrc_mars_jezero_surface_fixture",
    }),
    voyagerPack(releaseBinding),
  ];
  return createCoveragePackSet({
    schemaVersion: COVERAGE_PACK_SCHEMA_VERSION,
    coverageSetId: "covset_foundation_coverage_v1",
    projectionVersion: COVERAGE_PACK_PROJECTION_VERSION,
    generatedAt: FOUNDATION_COVERAGE_GENERATED_AT,
    state: "release-scoped-coverage-projection-non-authoritative",
    releaseBinding,
    packs,
    ...COVERAGE_NO_AUTHORITY,
  });
}
