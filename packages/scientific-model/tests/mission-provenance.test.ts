import assert from "node:assert/strict";
import test from "node:test";

import {
  BlockedKernelSelectionSchema,
  CaptureContextSchema,
  CompleteKernelSetManifestSchema,
  HorizonsGoldenValidationPlanSchema,
  IndependentSpiceStateSetSchema,
  MissionMediaAdmissionSchema,
  MissionProvenanceSchema,
  calculateGeometryValidationReportSha256,
  calculateKernelManifestSha256,
  calculateParsedSpiceStateSetSha256,
  canRenderMissionMedia,
  compareIndependentSpiceStates,
  createGeometryValidationReport,
  reviewKernelSelection,
  verifyExecutableKernelSet,
  verifyIndependentSpiceStateSet,
  verifyMissionMediaForRendering,
  type CompleteKernelSetManifest,
  type IndependentSpiceStateSet,
  type KernelEvidence,
  type ReviewedKernelSelection,
  type VerifiedExecutableKernelSet,
  type VerifiedIndependentSpiceStateSet,
} from "../src/mission-provenance";

const sha = (character: string) => character.repeat(64);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError("Expected an object fixture");
  }
  return value;
}

function requireArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Expected an array fixture");
  }
  return value;
}

function field(record: unknown, key: string): unknown {
  return requireRecord(record)[key];
}

function recordField(record: unknown, key: string): Record<string, unknown> {
  return requireRecord(field(record, key));
}

function arrayField(record: unknown, key: string): unknown[] {
  return requireArray(field(record, key));
}

function setField(record: unknown, key: string, value: unknown): void {
  assert.equal(Reflect.set(requireRecord(record), key, value), true);
}

function deleteField(record: unknown, key: string): void {
  assert.equal(Reflect.deleteProperty(requireRecord(record), key), true);
}

function first(array: unknown[]): unknown {
  const value = array[0];
  if (value === undefined) {
    throw new TypeError("Expected a non-empty fixture array");
  }
  return value;
}

function second(array: unknown[]): unknown {
  const value = array[1];
  if (value === undefined) {
    throw new TypeError("Expected at least two fixture entries");
  }
  return value;
}

const queryContext = {
  targetNaifId: -31,
  centerNaifId: 10,
  frame: "ECLIPJ2000",
  referenceSystem: "ICRF",
  timeScale: "TDB",
  units: "AU and AU/day",
  aberrationCorrection: "NONE (geometric)",
} as const;

const selectedArtifacts = [
  {
    artifactId: "kart_voyager1_trajectory_spk",
    kernelType: "SPK",
    role: "Voyager 1 heliocentric trajectory",
    filename: "vgr1.x2100.bsp",
    officialUrl:
      "https://naif.jpl.nasa.gov/pub/naif/VOYAGER/kernels/spk/vgr1.x2100.bsp",
    loadOrder: 1,
    quality: "tracking-refit-reconstruction-and-prediction",
    coverage: [
      {
        targetNaifId: -31,
        centerNaifId: 10,
        startEtLabel: "1981 JAN 01 00:00:00.000",
        endEtLabel: "2100 JAN 01 00:00:00.000",
        source: "NAIF brief summary",
      },
    ],
    selectionBasis: "Official Voyager kernel status identifies the 2022 extension.",
    sourceReferenceIds: ["naif-voyager-kernel-status"],
  },
  {
    artifactId: "kart_naif_leapseconds_0012",
    kernelType: "LSK",
    role: "UTC and ephemeris-time conversion",
    filename: "naif0012.tls",
    officialUrl:
      "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
    loadOrder: 2,
    quality: "generic-time-system",
    coverage: [
      {
        targetNaifId: 0,
        startEtLabel: "NAIF0012 declared leap-second table",
        endEtLabel: "Until superseded by a separately reviewed kernel set",
        source: "NAIF generic LSK archive",
      },
    ],
    selectionBasis: "A named leap-second kernel is required instead of a mutable alias.",
    sourceReferenceIds: ["naif-generic-lsk-index"],
  },
] as const;

const blockedSelection = {
  schemaVersion: "1.0.0",
  kernelSetId: "kset_voyager1_foundation_v1",
  missionId: "voyager-1",
  sourceId: "naif-spice",
  purpose: "trajectory",
  selectedAt: "2026-07-19T16:30:00Z",
  queryContext,
  sourceReferenceIds: ["naif-voyager-kernel-status"],
  caveats: ["Selected metadata is not executable evidence."],
  state: "blocked-missing-artifacts",
  artifacts: selectedArtifacts,
  executionAllowed: false,
  releaseEligible: false,
  missingEvidence: ["Exact bytes, SHA-256 digests, and coverage validation are absent."],
} as const;

const sameSolutionPlan = {
  schemaVersion: "1.0.0",
  validationId: "gval_voyager1_horizons_v1",
  state: "awaiting-independent-spice-run",
  referenceProducer: "jpl-horizons",
  referenceArtifactSha256: sha("a"),
  referenceArtifactPath: "fixtures/horizons/voyager-1.txt",
  requiredKernelSetId: blockedSelection.kernelSetId,
  queryContext,
  tolerances: {
    positionVectorAu: 1e-8,
    velocityVectorAuPerDay: 1e-9,
    basis: "Cross-implementation parity for the same disclosed orbit solution.",
  },
  goldenEpochs: [
    {
      epochId: "horizons-1990-02-14",
      epochTdb: "1990-02-14 00:00:00.0000 TDB",
      julianDateTdb: 2447936.5,
      positionAu: [-15.7, -30.1, 21.9],
      velocityAuPerDay: [-0.0013, -0.0083, 0.006],
      comparisonMode: "same-solution-parity",
      lineageDisclosure: "Horizons and SPICE use the same disclosed orbit solution.",
    },
    {
      epochId: "horizons-2026-07-19",
      epochTdb: "2026-07-19 00:00:00.0000 TDB",
      julianDateTdb: 2461240.5,
      positionAu: [-32.1, -136.2, 98.6],
      velocityAuPerDay: [-0.0012, -0.0079, 0.0057],
      comparisonMode: "same-solution-parity",
      lineageDisclosure: "Horizons and SPICE use the same disclosed orbit solution.",
    },
  ],
  blockedReason: "No verified executable SPICE result exists.",
} as const;

const completeKernelManifestTemplate = {
  schemaVersion: "1.0.0",
  kernelSetId: blockedSelection.kernelSetId,
  missionId: blockedSelection.missionId,
  sourceId: "naif-spice",
  purpose: "trajectory",
  selectedAt: blockedSelection.selectedAt,
  queryContext,
  sourceReferenceIds: ["naif-voyager-kernel-status"],
  caveats: blockedSelection.caveats,
  state: "artifact-evidence-complete",
  artifacts: selectedArtifacts.map((artifact, index) => ({
    ...artifact,
    byteLength: 1_000 + index,
    sha256: index === 0 ? sha("1") : sha("2"),
    capturedAt: "2026-07-19T17:00:00Z",
    immutableObjectKey: `kernels/voyager-1/${artifact.filename}`,
  })),
  toolkitVersion: "N0067",
  metaKernel: {
    kind: "meta-kernel",
    filename: "voyager-1-trajectory.tm",
    byteLength: 640,
    sha256: sha("3"),
    capturedAt: "2026-07-19T17:01:00Z",
    immutableObjectKey: "kernels/voyager-1/voyager-1-trajectory.tm",
  },
  coverageReport: {
    kind: "coverage-report",
    filename: "voyager-1-coverage.json",
    byteLength: 2_048,
    sha256: sha("4"),
    capturedAt: "2026-07-19T17:02:00Z",
    immutableObjectKey: "validation/voyager-1/voyager-1-coverage.json",
  },
  coverageValidatedAt: "2026-07-19T17:10:00Z",
  validatorCodeCommit: "abcdef1",
  approvedStateGeneratorCodeCommit: "abcdef2",
  approvedStateParserCodeCommit: "abcdef3",
  manifestCanonicalization: "cosmography-spice-kernel-set-json-v1",
  manifestSha256: sha("0"),
  executionAllowed: false,
  releaseEligible: false,
} as const;

const referenceOnlyMedia = {
  mediaId: "pale-blue-dot-original",
  state: "reference-only-pending-asset-review",
  sourceProductId: "PIA00452",
  officialRecordUrl: "https://science.nasa.gov/photojournal/example/",
  sourceReferenceIds: ["nasa-photojournal-pia00452"],
  requiredCreditLine: "NASA/JPL-Caltech",
  policyUrls: ["https://www.jpl.nasa.gov/jpl-image-use-policy/"],
  policyCheckedAt: "2026-07-19T16:30:00Z",
  intendedUse: {
    metadataDisplay: true,
    externalLink: true,
    embedBytes: false,
    redistribute: false,
    modify: false,
    commercialUse: false,
    offlinePackaging: false,
    derivativeGeneration: false,
  },
  assetBytesPresent: false,
  renderAllowed: false,
  blockedReason: "No exact admitted asset bytes or asset-target rights review.",
} as const;

const admittedMedia = {
  mediaId: "pale-blue-dot-revisited",
  state: "frozen-asset-reviewed",
  sourceReferenceIds: ["nasa-photojournal-pia23645"],
  intendedUse: {
    metadataDisplay: true,
    externalLink: true,
    embedBytes: true,
    redistribute: true,
    modify: false,
    commercialUse: false,
    offlinePackaging: false,
    derivativeGeneration: false,
  },
  asset: {
    assetId: "asset_pale_blue_dot_2020",
    sourceProductId: "PIA23645",
    sourceUrl: "https://assets.science.nasa.gov/example.tif",
    mediaType: "image/tiff",
    byteLength: 31_000_000,
    sha256: sha("6"),
    immutableObjectKey: "media/voyager-1/pia23645.tif",
    capturedAt: "2026-07-19T17:00:00Z",
    derivativeOfAssetId: "asset_pale_blue_dot_1990",
    transformation: "NASA/JPL-Caltech 2020 reprocessing",
  },
  rights: {
    rightsId: "rgt_pale_blue_dot_2020",
    target: { kind: "asset", assetId: "asset_pale_blue_dot_2020" },
    basis: {
      kind: "custom-terms",
      termsUrl: "https://www.jpl.nasa.gov/jpl-image-use-policy/",
      termsSnapshotSha256: sha("7"),
      summary: "Reviewed item and policy terms.",
    },
    useProfile: {
      display: "allowed",
      redistribute: "allowed",
      modify: "prohibited",
      commercialUse: "unknown",
    },
    creditLine: "NASA/JPL-Caltech",
    requiredNotices: ["Do not imply endorsement."],
    capturedAt: "2026-07-19T17:05:00Z",
    reviewStatus: "reviewed",
    reviewedBy: "reviewer-example",
    reviewedAt: "2026-07-19T17:10:00Z",
    reviewExpiresAt: "2027-07-19T17:10:00Z",
  },
  admittedAt: "2026-07-19T17:20:00Z",
  assetBytesPresent: true,
  renderAllowed: false,
  releaseEligible: false,
} as const;

const withheldCapture = {
  captureContextId: "cctx_pale_blue_dot_1990",
  mediaId: referenceOnlyMedia.mediaId,
  state: "withheld-incomplete-geometry",
  capturedAtUtc: "1990-02-14T04:48:00Z",
  timePrecision: "minute",
  reportedTimeLabel: "Approximately 04:48 UTC",
  observerNaifId: -31,
  targetNaifId: 399,
  instrument: "Voyager 1 ISS Narrow Angle Camera",
  requiredKernelTypes: ["SPK", "CK", "SCLK", "LSK", "FK", "IK"],
  sourceReferenceIds: ["nasa-photojournal-pia00452"],
  exactEpochStateAvailable: false,
  verifiedAttitudeAvailable: false,
  renderableCameraPose: false,
  blockedReasons: ["No exact capture-epoch state or reviewed scan-platform attitude set."],
} as const;

async function buildCompleteKernelManifest(): Promise<CompleteKernelSetManifest> {
  const manifest: unknown = structuredClone(completeKernelManifestTemplate);
  setField(
    manifest,
    "manifestSha256",
    await calculateKernelManifestSha256(manifest),
  );
  return CompleteKernelSetManifestSchema.parse(manifest);
}

async function issueReviewedKernelSelectionFixture(): Promise<ReviewedKernelSelection> {
  return reviewKernelSelection(
    blockedSelection,
    {
      reviewedAt: "2026-07-19T16:45:00Z",
      reviewerId: "science-reviewer",
      approvalReference: "review/voyager-1/kernel-selection/v1",
    },
    (selection, review) => {
      assert.equal(selection.kernelSetId, blockedSelection.kernelSetId);
      assert.equal(review.reviewerId, "science-reviewer");
      return true;
    },
  );
}

async function issueExecutableKernelFixture(
  manifest: CompleteKernelSetManifest,
): Promise<VerifiedExecutableKernelSet> {
  const seen: string[] = [];
  const reviewedSelection = await issueReviewedKernelSelectionFixture();
  const verified = await verifyExecutableKernelSet(manifest, reviewedSelection, (evidence) => {
    seen.push(`${evidence.kind}:${evidence.filename}`);
    const commonMatch =
      evidence.byteLength > 0 &&
      evidence.sha256.length === 64 &&
      Date.parse(evidence.capturedAt) >= Date.parse(manifest.selectedAt);
    if (evidence.kind === "kernel-artifact") {
      const artifact = manifest.artifacts.find(
        (entry) => entry.filename === evidence.filename,
      );
      return (
        commonMatch &&
        artifact !== undefined &&
        artifact.byteLength === evidence.byteLength &&
        artifact.sha256 === evidence.sha256 &&
        artifact.immutableObjectKey === evidence.immutableObjectKey
      );
    }
    if (evidence.kind === "meta-kernel") {
      assert.deepEqual(
        evidence.expectedLoadOrder,
        manifest.artifacts.map((artifact) => artifact.filename),
      );
      return commonMatch && evidence.sha256 === manifest.metaKernel.sha256;
    }
    assert.deepEqual(
      evidence.expectedKernelDigests,
      manifest.artifacts.map((artifact) => artifact.sha256),
    );
    assert.deepEqual(evidence.expectedQueryContext, manifest.queryContext);
    return commonMatch && evidence.sha256 === manifest.coverageReport.sha256;
  });
  assert.deepEqual(seen, [
    "kernel-artifact:vgr1.x2100.bsp",
    "kernel-artifact:naif0012.tls",
    "meta-kernel:voyager-1-trajectory.tm",
    "coverage-report:voyager-1-coverage.json",
  ]);
  return verified;
}

function independentStateTemplate(manifest: CompleteKernelSetManifest): unknown {
  return {
    producer: "spice-toolkit",
    toolkitVersion: manifest.toolkitVersion,
    kernelSetId: manifest.kernelSetId,
    kernelManifestSha256: manifest.manifestSha256,
    generatedAt: "2026-07-19T17:20:00Z",
    generatorCodeCommit: manifest.approvedStateGeneratorCodeCommit,
    stateArtifact: {
      filename: "voyager-1-states.json",
      mediaType: "application/json",
      byteLength: 4_096,
      sha256: sha("8"),
      immutableObjectKey: "validation/voyager-1/voyager-1-states.json",
      capturedAt: "2026-07-19T17:21:00Z",
    },
    parserCodeCommit: manifest.approvedStateParserCodeCommit,
    parsedStateCanonicalization: "cosmography-spice-state-set-json-v1",
    parsedStateSetSha256: sha("0"),
    queryContext,
    states: sameSolutionPlan.goldenEpochs.map((epoch) => ({
      epochId: epoch.epochId,
      epochTdb: epoch.epochTdb,
      julianDateTdb: epoch.julianDateTdb,
      positionAu: [...epoch.positionAu],
      velocityAuPerDay: [...epoch.velocityAuPerDay],
    })),
  };
}

async function buildIndependentStateSet(
  manifest: CompleteKernelSetManifest,
): Promise<IndependentSpiceStateSet> {
  const candidate = independentStateTemplate(manifest);
  setField(
    candidate,
    "parsedStateSetSha256",
    await calculateParsedSpiceStateSetSha256(candidate),
  );
  return IndependentSpiceStateSetSchema.parse(candidate);
}

function parsedStatePayloadFrom(candidate: IndependentSpiceStateSet) {
  return {
    parserCodeCommit: candidate.parserCodeCommit,
    parsedStateCanonicalization: candidate.parsedStateCanonicalization,
    queryContext: candidate.queryContext,
    states: candidate.states,
  } as const;
}

async function issueIndependentStateFixture(
  candidate: IndependentSpiceStateSet,
  kernelSet: VerifiedExecutableKernelSet,
): Promise<VerifiedIndependentSpiceStateSet> {
  return verifyIndependentSpiceStateSet(
    candidate,
    kernelSet,
    (artifact, expectations) => {
      assert.deepEqual(artifact, candidate.stateArtifact);
      assert.equal(expectations.parsedStateSetSha256, candidate.parsedStateSetSha256);
      assert.equal(expectations.parserCodeCommit, candidate.parserCodeCommit);
      assert.equal(
        expectations.parsedStateCanonicalization,
        candidate.parsedStateCanonicalization,
      );
      assert.deepEqual(expectations.queryContext, candidate.queryContext);
      assert.deepEqual(
        expectations.epochIds,
        candidate.states.map((state) => state.epochId),
      );
      assert.equal(artifact.sha256, sha("8"));
      return parsedStatePayloadFrom(candidate);
    },
  );
}

test("blocked kernel selections remain non-executable metadata", () => {
  const selection = BlockedKernelSelectionSchema.parse(blockedSelection);
  assert.equal(selection.executionAllowed, false);
  assert.equal(selection.releaseEligible, false);
  assert.throws(() => CompleteKernelSetManifestSchema.parse(selection));
});

test("kernel filenames reject aliases and paths", () => {
  for (const filename of [
    "latest.bsp",
    "../vgr1.bsp",
    "vgr*.bsp",
    "folder/vgr1.bsp",
  ]) {
    const invalid: unknown = structuredClone(blockedSelection);
    setField(first(arrayField(invalid, "artifacts")), "filename", filename);
    assert.throws(() => BlockedKernelSelectionSchema.parse(invalid));
  }
});

test("kernel URLs and extensions must identify the exact official artifact", () => {
  const invalidUrls = [
    "http://naif.jpl.nasa.gov/pub/naif/VOYAGER/kernels/spk/vgr1.x2100.bsp",
    "https://example.test/pub/naif/VOYAGER/kernels/spk/vgr1.x2100.bsp",
    "https://naif.jpl.nasa.gov/pub/naif/VOYAGER/kernels/spk/vgr1.x2100.bsp?download=1",
    "https://naif.jpl.nasa.gov/pub/naif/VOYAGER/kernels/spk/other.bsp",
    "https://user:secret@naif.jpl.nasa.gov/pub/naif/VOYAGER/kernels/spk/vgr1.x2100.bsp",
    "https://naif.jpl.nasa.gov:444/pub/naif/VOYAGER/kernels/spk/vgr1.x2100.bsp",
    "https://naif.jpl.nasa.gov/pub/naif/VOYAGER/kernels/spk/vgr1%ZZ.x2100.bsp",
  ];
  for (const officialUrl of invalidUrls) {
    const invalid: unknown = structuredClone(blockedSelection);
    setField(first(arrayField(invalid, "artifacts")), "officialUrl", officialUrl);
    assert.throws(() => BlockedKernelSelectionSchema.parse(invalid));
  }

  const wrongExtension: unknown = structuredClone(blockedSelection);
  const artifact = first(arrayField(wrongExtension, "artifacts"));
  setField(artifact, "filename", "vgr1.x2100.bc");
  setField(
    artifact,
    "officialUrl",
    "https://naif.jpl.nasa.gov/pub/naif/VOYAGER/kernels/spk/vgr1.x2100.bc",
  );
  assert.throws(
    () => BlockedKernelSelectionSchema.parse(wrongExtension),
    /extension does not match SPK/,
  );

  const controlCharacter: unknown = structuredClone(blockedSelection);
  const controlArtifact = first(arrayField(controlCharacter, "artifacts"));
  setField(controlArtifact, "filename", "evil\n.bsp");
  setField(
    controlArtifact,
    "officialUrl",
    "https://naif.jpl.nasa.gov/pub/naif/VOYAGER/kernels/spk/evil%0A.bsp",
  );
  assert.throws(() => BlockedKernelSelectionSchema.parse(controlCharacter));

  const qualityMismatch: unknown = structuredClone(blockedSelection);
  setField(first(arrayField(qualityMismatch, "artifacts")), "quality", "body-model");
  assert.throws(
    () => BlockedKernelSelectionSchema.parse(qualityMismatch),
    /quality does not match SPK/,
  );
});

test("kernel order, identity, and SPK query-center closure are fail-closed", () => {
  const duplicate: unknown = structuredClone(blockedSelection);
  const duplicateArtifacts = arrayField(duplicate, "artifacts");
  setField(
    second(duplicateArtifacts),
    "artifactId",
    field(first(duplicateArtifacts), "artifactId"),
  );
  assert.throws(() => BlockedKernelSelectionSchema.parse(duplicate), /unique/);

  const gap: unknown = structuredClone(blockedSelection);
  setField(second(arrayField(gap, "artifacts")), "loadOrder", 3);
  assert.throws(() => BlockedKernelSelectionSchema.parse(gap), /contiguous/);

  const foreignCenter: unknown = structuredClone(blockedSelection);
  const spk = first(arrayField(foreignCenter, "artifacts"));
  setField(first(arrayField(spk, "coverage")), "centerNaifId", 0);
  assert.throws(
    () => BlockedKernelSelectionSchema.parse(foreignCenter),
    /declared center chain/,
  );

  const mislabeledQueryTarget: unknown = structuredClone(foreignCenter);
  setField(
    first(arrayField(mislabeledQueryTarget, "artifacts")),
    "quality",
    "planetary-ephemeris",
  );
  assert.throws(
    () => BlockedKernelSelectionSchema.parse(mislabeledQueryTarget),
    /declared center chain/,
  );

  const absentQueryTarget: unknown = structuredClone(blockedSelection);
  setField(
    first(arrayField(first(arrayField(absentQueryTarget, "artifacts")), "coverage")),
    "targetNaifId",
    999,
  );
  assert.throws(
    () => BlockedKernelSelectionSchema.parse(absentQueryTarget),
    /must declare query target/,
  );

  const captureContextWithoutClosure: unknown = structuredClone(absentQueryTarget);
  setField(captureContextWithoutClosure, "purpose", "capture-context");
  assert.throws(
    () => BlockedKernelSelectionSchema.parse(captureContextWithoutClosure),
    /must declare query target/,
  );

  const selfCenteredQuery: unknown = structuredClone(blockedSelection);
  setField(recordField(selfCenteredQuery, "queryContext"), "centerNaifId", -31);
  assert.throws(
    () => BlockedKernelSelectionSchema.parse(selfCenteredQuery),
    /target and center must differ/,
  );

  const unrelatedBridge: unknown = structuredClone(foreignCenter);
  arrayField(unrelatedBridge, "artifacts").push({
    artifactId: "kart_unrelated_planetary_spk",
    kernelType: "SPK",
    role: "Unrelated planetary ephemeris",
    filename: "de999.bsp",
    officialUrl:
      "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de999.bsp",
    loadOrder: 3,
    quality: "planetary-ephemeris",
    coverage: [
      {
        targetNaifId: 999,
        centerNaifId: 888,
        startEtLabel: "2000 JAN 01 00:00:00.000",
        endEtLabel: "2030 JAN 01 00:00:00.000",
        source: "Adversarial unrelated segment",
      },
    ],
    selectionBasis: "Proves that a quality label cannot establish graph closure.",
    sourceReferenceIds: ["naif-voyager-kernel-status"],
  });
  assert.throws(
    () => BlockedKernelSelectionSchema.parse(unrelatedBridge),
    /declared center chain/,
  );

  const closedBridge: unknown = structuredClone(unrelatedBridge);
  const bridgeArtifact = first(arrayField(closedBridge, "artifacts").slice(2));
  const bridgeCoverage = first(arrayField(bridgeArtifact, "coverage"));
  setField(bridgeCoverage, "targetNaifId", 10);
  setField(bridgeCoverage, "centerNaifId", 0);
  assert.doesNotThrow(() => BlockedKernelSelectionSchema.parse(closedBridge));
});

test("complete manifest canonical digest is deterministic and exact evidence is verified", async () => {
  const manifest = await buildCompleteKernelManifest();
  assert.equal(
    await calculateKernelManifestSha256(manifest),
    manifest.manifestSha256,
  );

  const reordered: unknown = Object.fromEntries(
    Object.entries(structuredClone(manifest)).reverse(),
  );
  assert.equal(
    await calculateKernelManifestSha256(reordered),
    manifest.manifestSha256,
  );

  const kernelSet = await issueExecutableKernelFixture(manifest);
  assert.equal(kernelSet.state, "integrity-verified-for-execution");
  assert.equal(kernelSet.executionAllowed, true);
  assert.equal(kernelSet.releaseEligible, false);
  assert.equal(Object.isFrozen(kernelSet.manifest.artifacts[0]), true);
});

test("complete manifests reject noncanonical storage paths and evidence extensions", async () => {
  const manifest = await buildCompleteKernelManifest();
  for (const objectKey of [
    "Kernels/voyager-1/vgr1.x2100.bsp",
    "kernels//vgr1.x2100.bsp",
    "kernels/../vgr1.x2100.bsp",
    "media/voyager-1/vgr1.x2100.bsp",
  ]) {
    const invalid: unknown = structuredClone(manifest);
    setField(
      first(arrayField(invalid, "artifacts")),
      "immutableObjectKey",
      objectKey,
    );
    assert.throws(() => CompleteKernelSetManifestSchema.parse(invalid));
  }

  const invalidMetaKernel: unknown = structuredClone(manifest);
  setField(recordField(invalidMetaKernel, "metaKernel"), "filename", "voyager-1.json");
  assert.throws(
    () => CompleteKernelSetManifestSchema.parse(invalidMetaKernel),
    /must use \.tm/,
  );

  const duplicateObjectKey: unknown = structuredClone(manifest);
  setField(
    recordField(duplicateObjectKey, "coverageReport"),
    "immutableObjectKey",
    field(first(arrayField(duplicateObjectKey, "artifacts")), "immutableObjectKey"),
  );
  assert.throws(
    () => CompleteKernelSetManifestSchema.parse(duplicateObjectKey),
    /unique immutable object key/,
  );

  const prematureCoverage: unknown = structuredClone(manifest);
  setField(
    recordField(prematureCoverage, "coverageReport"),
    "capturedAt",
    "2026-07-19T17:00:30Z",
  );
  assert.throws(
    () => CompleteKernelSetManifestSchema.parse(prematureCoverage),
    /cannot predate any retained kernel or meta-kernel input/,
  );
});

test("manifest tampering and rejected evidence cannot issue execution tokens", async () => {
  const manifest = await buildCompleteKernelManifest();
  const reviewedSelection = await issueReviewedKernelSelectionFixture();
  const tampered: unknown = structuredClone(manifest);
  setField(tampered, "toolkitVersion", "N0066");
  await assert.rejects(
    verifyExecutableKernelSet(tampered, reviewedSelection, () => true),
    /canonical SHA-256/,
  );

  await assert.rejects(
    verifyExecutableKernelSet(
      manifest,
      reviewedSelection,
      (evidence: KernelEvidence) => evidence.kind !== "meta-kernel",
    ),
    /verifier rejected meta-kernel/,
  );

  const selectionDrift: unknown = structuredClone(manifest);
  setField(
    first(arrayField(selectionDrift, "artifacts")),
    "role",
    "Unreviewed replacement role",
  );
  setField(
    selectionDrift,
    "manifestSha256",
    await calculateKernelManifestSha256(selectionDrift),
  );
  await assert.rejects(
    verifyExecutableKernelSet(selectionDrift, reviewedSelection, () => true),
    /does not match the in-process reviewed selection/,
  );

  await assert.rejects(
    reviewKernelSelection(
      blockedSelection,
      {
        reviewedAt: "2026-07-19T16:45:00Z",
        reviewerId: "science-reviewer",
        approvalReference: "review/voyager-1/kernel-selection/rejected",
      },
      () => false,
    ),
    /authorizer rejected/,
  );

  const unissuedReview = structuredClone(reviewedSelection);
  await assert.rejects(
    verifyExecutableKernelSet(manifest, unissuedReview, () => true),
    /in-process reviewed selection token/,
  );
});

test("retained SPICE state bytes and parsed state digest are both verified", async () => {
  const manifest = await buildCompleteKernelManifest();
  const kernelSet = await issueExecutableKernelFixture(manifest);
  const candidate = await buildIndependentStateSet(manifest);
  assert.equal(
    await calculateParsedSpiceStateSetSha256(candidate),
    candidate.parsedStateSetSha256,
  );

  const verified = await issueIndependentStateFixture(candidate, kernelSet);
  assert.equal(verified.state, "independent-state-artifact-verified");
  assert.equal(Object.isFrozen(verified.candidate.states[0]), true);
});

test("state evidence rejects artifact path, extension, digest, and code drift", async () => {
  const manifest = await buildCompleteKernelManifest();
  const kernelSet = await issueExecutableKernelFixture(manifest);

  const extensionMismatch = independentStateTemplate(manifest);
  setField(recordField(extensionMismatch, "stateArtifact"), "filename", "voyager-1-states.csv");
  assert.throws(() => IndependentSpiceStateSetSchema.parse(extensionMismatch), /extension/);

  const basenameMismatch = independentStateTemplate(manifest);
  setField(
    recordField(basenameMismatch, "stateArtifact"),
    "immutableObjectKey",
    "validation/voyager-1/different.json",
  );
  assert.throws(() => IndependentSpiceStateSetSchema.parse(basenameMismatch), /basename/);

  const candidate = await buildIndependentStateSet(manifest);
  const tampered: unknown = structuredClone(candidate);
  const firstState = first(arrayField(tampered, "states"));
  const position = requireArray(field(firstState, "positionAu"));
  position[0] = Number(position[0]) + 1e-6;
  await assert.rejects(
    verifyIndependentSpiceStateSet(tampered, kernelSet, () => true),
    /canonical SHA-256/,
  );

  const parserDrift: unknown = structuredClone(candidate);
  setField(parserDrift, "parserCodeCommit", "deadbee");
  setField(
    parserDrift,
    "parsedStateSetSha256",
    await calculateParsedSpiceStateSetSha256(parserDrift),
  );
  await assert.rejects(
    verifyIndependentSpiceStateSet(parserDrift, kernelSet, () => true),
    /approved generator/,
  );

  const bytesBoundCandidate = await buildIndependentStateSet(manifest);
  const retainedParsedPayload = structuredClone(
    parsedStatePayloadFrom(bytesBoundCandidate),
  );
  const valuesDrift: unknown = structuredClone(bytesBoundCandidate);
  const driftState = first(arrayField(valuesDrift, "states"));
  const driftPosition = requireArray(field(driftState, "positionAu"));
  driftPosition[0] = Number(driftPosition[0]) + 1e-7;
  setField(
    valuesDrift,
    "parsedStateSetSha256",
    await calculateParsedSpiceStateSetSha256(valuesDrift),
  );
  await assert.rejects(
    verifyIndependentSpiceStateSet(
      valuesDrift,
      kernelSet,
      () => retainedParsedPayload,
    ),
    /parser output does not match the candidate state vectors/,
  );
});

test("unissued structural copies cannot cross kernel or state trust boundaries", async () => {
  const manifest = await buildCompleteKernelManifest();
  const kernelSet = await issueExecutableKernelFixture(manifest);
  const candidate = await buildIndependentStateSet(manifest);
  const unissuedKernelSet = structuredClone(kernelSet);
  await assert.rejects(
    verifyIndependentSpiceStateSet(candidate, unissuedKernelSet, () => true),
    /in-process verified kernel-set token/,
  );

  const verifiedCandidate = await issueIndependentStateFixture(candidate, kernelSet);
  const unissuedCandidate = structuredClone(verifiedCandidate);
  assert.throws(
    () => compareIndependentSpiceStates(sameSolutionPlan, unissuedCandidate, kernelSet),
    /in-process verified SPICE state artifact/,
  );
});

test("same-solution parity passes only after both evidence tokens are issued", async () => {
  const manifest = await buildCompleteKernelManifest();
  const kernelSet = await issueExecutableKernelFixture(manifest);
  const candidate = await buildIndependentStateSet(manifest);
  const verifiedCandidate = await issueIndependentStateFixture(candidate, kernelSet);
  const result = compareIndependentSpiceStates(
    sameSolutionPlan,
    verifiedCandidate,
    kernelSet,
  );

  assert.equal(result.status, "passed");
  assert.equal(result.passed, true);
  assert.equal(result.strictParityPassed, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.epochs.every((epoch) => epoch.outcome === "passed"), true);
});

test("cross-solution agreement remains review-required instead of passing parity", async () => {
  const manifest = await buildCompleteKernelManifest();
  const kernelSet = await issueExecutableKernelFixture(manifest);
  const candidate = await buildIndependentStateSet(manifest);
  const verifiedCandidate = await issueIndependentStateFixture(candidate, kernelSet);
  const crossSolutionPlan: unknown = structuredClone(sameSolutionPlan);
  setField(
    second(arrayField(crossSolutionPlan, "goldenEpochs")),
    "comparisonMode",
    "cross-solution-diagnostic",
  );
  setField(
    second(arrayField(crossSolutionPlan, "goldenEpochs")),
    "lineageDisclosure",
    "Horizons and SPICE use different disclosed orbit solutions.",
  );

  const result = compareIndependentSpiceStates(
    crossSolutionPlan,
    verifiedCandidate,
    kernelSet,
  );
  assert.equal(result.status, "review-required");
  assert.equal(result.passed, false);
  assert.equal(result.strictParityPassed, true);
  assert.equal(result.epochs[1]?.outcome, "review-required");
  assert.match(result.reasons.join(" "), /scientific review/);
});

test("mixed-lineage validation produces a frozen, non-release report", async () => {
  const manifest = await buildCompleteKernelManifest();
  const kernelSet = await issueExecutableKernelFixture(manifest);
  const candidate = await buildIndependentStateSet(manifest);
  const verifiedCandidate = await issueIndependentStateFixture(candidate, kernelSet);
  const crossSolutionPlan: unknown = structuredClone(sameSolutionPlan);
  setField(
    second(arrayField(crossSolutionPlan, "goldenEpochs")),
    "comparisonMode",
    "cross-solution-diagnostic",
  );
  setField(
    second(arrayField(crossSolutionPlan, "goldenEpochs")),
    "lineageDisclosure",
    "Horizons and SPICE use different disclosed orbit solutions.",
  );

  await assert.rejects(
    createGeometryValidationReport(
      crossSolutionPlan,
      verifiedCandidate,
      kernelSet,
      "2026-07-19T17:20:30Z",
    ),
    /cannot predate its SPICE state artifact/,
  );

  const report = await createGeometryValidationReport(
    crossSolutionPlan,
    verifiedCandidate,
    kernelSet,
    "2026-07-19T17:22:00Z",
  );
  assert.equal(report.status, "review-required");
  assert.equal(report.strictParityPassed, true);
  assert.equal(report.releaseEligible, false);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(
    await calculateGeometryValidationReportSha256(report),
    report.reportSha256,
  );
});

test("Horizons records cannot masquerade as independent SPICE evidence", async () => {
  const manifest = await buildCompleteKernelManifest();
  const selfValidation = independentStateTemplate(manifest);
  setField(selfValidation, "producer", "jpl-horizons");
  assert.throws(() => IndependentSpiceStateSetSchema.parse(selfValidation));
  assert.doesNotThrow(() => HorizonsGoldenValidationPlanSchema.parse(sameSolutionPlan));
});

test("reference-only media remains metadata and never render authority", () => {
  const record = MissionMediaAdmissionSchema.parse(referenceOnlyMedia);
  assert.equal(canRenderMissionMedia(record, "2026-07-19T17:20:00Z"), false);

  const laundering: unknown = structuredClone(record);
  setField(laundering, "renderAllowed", true);
  assert.throws(() => MissionMediaAdmissionSchema.parse(laundering));

  const insecureRecord: unknown = structuredClone(referenceOnlyMedia);
  setField(insecureRecord, "officialRecordUrl", "http://science.nasa.gov/example/");
  assert.throws(
    () => MissionMediaAdmissionSchema.parse(insecureRecord),
    /must use HTTPS/,
  );
});

test("reviewed media requires issued byte evidence, exact rights, and evaluation time", async () => {
  const record = MissionMediaAdmissionSchema.parse(admittedMedia);
  assert.equal(record.state, "frozen-asset-reviewed");
  if (record.state !== "frozen-asset-reviewed") {
    throw new TypeError("Expected an admitted media fixture");
  }
  assert.equal(canRenderMissionMedia(record), false);
  assert.equal(canRenderMissionMedia(record, admittedMedia.admittedAt), false);

  await assert.rejects(
    verifyMissionMediaForRendering(
      record,
      "2026-07-19T17:19:59Z",
      () => true,
    ),
    /cannot predate asset admission/,
  );
  await assert.rejects(
    verifyMissionMediaForRendering(record, admittedMedia.admittedAt, () => false),
    /evidence verifier rejected/,
  );

  const verified = await verifyMissionMediaForRendering(
    record,
    admittedMedia.admittedAt,
    (evidence) => {
      assert.deepEqual(evidence.asset, record.asset);
      assert.deepEqual(evidence.rights, record.rights);
      assert.deepEqual(evidence.intendedUse, record.intendedUse);
      assert.equal(evidence.admittedAt, record.admittedAt);
      assert.equal(evidence.evaluatedAt, admittedMedia.admittedAt);
      return evidence.asset.sha256 === sha("6");
    },
  );
  assert.equal(canRenderMissionMedia(verified, admittedMedia.admittedAt), true);
  assert.equal(canRenderMissionMedia(verified, "2026-07-19T17:19:59Z"), false);
  assert.equal(canRenderMissionMedia(verified, "2028-01-01T00:00:00Z"), false);
  assert.equal(
    canRenderMissionMedia(structuredClone(verified), admittedMedia.admittedAt),
    false,
  );

  const missingLineage: unknown = structuredClone(admittedMedia);
  deleteField(recordField(missingLineage, "asset"), "transformation");
  assert.throws(
    () => MissionMediaAdmissionSchema.parse(missingLineage),
    /appear together/,
  );

  const insecureAsset: unknown = structuredClone(admittedMedia);
  setField(
    recordField(insecureAsset, "asset"),
    "sourceUrl",
    "http://assets.science.nasa.gov/example.tif",
  );
  assert.throws(
    () => MissionMediaAdmissionSchema.parse(insecureAsset),
    /must use HTTPS/,
  );

  const wrongTarget: unknown = structuredClone(admittedMedia);
  setField(recordField(wrongTarget, "rights"), "target", {
    kind: "source",
    sourceId: "src_naif_spice",
  });
  assert.throws(
    () => MissionMediaAdmissionSchema.parse(wrongTarget),
    /asset-target/,
  );
  await assert.rejects(
    verifyMissionMediaForRendering(
      wrongTarget,
      admittedMedia.admittedAt,
      () => true,
    ),
    /asset-target/,
  );
});

test("restricted, prohibited, expired, and anonymous reviews cannot launder media rights", () => {
  const restricted: unknown = structuredClone(admittedMedia);
  setField(recordField(restricted, "rights"), "basis", {
    kind: "restricted",
    reason: "Separate written permission is required.",
    permissionContact: "rights@example.test",
  });
  assert.throws(
    () => MissionMediaAdmissionSchema.parse(restricted),
    /restricted rights basis/,
  );

  const prohibited: unknown = structuredClone(admittedMedia);
  setField(
    recordField(recordField(prohibited, "rights"), "useProfile"),
    "display",
    "prohibited",
  );
  assert.throws(
    () => MissionMediaAdmissionSchema.parse(prohibited),
    /Display permission/,
  );

  const expired: unknown = structuredClone(admittedMedia);
  setField(
    recordField(expired, "rights"),
    "reviewExpiresAt",
    admittedMedia.admittedAt,
  );
  assert.throws(() => MissionMediaAdmissionSchema.parse(expired), /expired/);

  const missingReviewer: unknown = structuredClone(admittedMedia);
  deleteField(recordField(missingReviewer, "rights"), "reviewedBy");
  assert.throws(
    () => MissionMediaAdmissionSchema.parse(missingReviewer),
    /named, timestamped rights review/,
  );
});

test("media intended use cannot exceed its reviewed permission profile", () => {
  const embedMismatch: unknown = structuredClone(admittedMedia);
  setField(recordField(embedMismatch, "intendedUse"), "embedBytes", false);
  assert.throws(
    () => MissionMediaAdmissionSchema.parse(embedMismatch),
    /explicitly request embedded bytes/,
  );

  const modificationMismatch: unknown = structuredClone(admittedMedia);
  setField(recordField(modificationMismatch, "intendedUse"), "modify", true);
  assert.throws(
    () => MissionMediaAdmissionSchema.parse(modificationMismatch),
    /Modification or derivative generation/,
  );

  const commercialMismatch: unknown = structuredClone(admittedMedia);
  setField(recordField(commercialMismatch, "intendedUse"), "commercialUse", true);
  assert.throws(
    () => MissionMediaAdmissionSchema.parse(commercialMismatch),
    /Commercial use/,
  );

  const redistributionMismatch: unknown = structuredClone(admittedMedia);
  setField(
    recordField(recordField(redistributionMismatch, "rights"), "useProfile"),
    "redistribute",
    "prohibited",
  );
  assert.throws(
    () => MissionMediaAdmissionSchema.parse(redistributionMismatch),
    /Byte delivery/,
  );
});

test("capture context admits only a non-renderable withheld state", () => {
  const withheld = CaptureContextSchema.parse(withheldCapture);
  assert.equal(withheld.renderableCameraPose, false);
  assert.equal(withheld.timePrecision, "minute");

  const renderableState: unknown = structuredClone(withheldCapture);
  setField(renderableState, "state", "verified-renderable-camera-pose");
  assert.throws(() => CaptureContextSchema.parse(renderableState));

  const pretendPose: unknown = structuredClone(withheldCapture);
  setField(pretendPose, "exactEpochStateAvailable", true);
  setField(pretendPose, "verifiedAttitudeAvailable", true);
  setField(pretendPose, "renderableCameraPose", true);
  assert.throws(() => CaptureContextSchema.parse(pretendPose));

  const duplicateKernelType: unknown = structuredClone(withheldCapture);
  arrayField(duplicateKernelType, "requiredKernelTypes").push("SPK");
  assert.throws(
    () => CaptureContextSchema.parse(duplicateKernelType),
    /must be unique/,
  );

  const noncanonicalUtc: unknown = structuredClone(withheldCapture);
  setField(noncanonicalUtc, "capturedAtUtc", "1990-02-13T18:48:00-10:00");
  assert.throws(
    () => CaptureContextSchema.parse(noncanonicalUtc),
    /canonical Z suffix/,
  );
});

test("mission provenance binds mission, validation, media, and capture ledgers", () => {
  const provenance = {
    schemaVersion: "1.0.0",
    missionId: blockedSelection.missionId,
    kernelSet: blockedSelection,
    horizonsValidation: sameSolutionPlan,
    mediaAdmissions: [referenceOnlyMedia],
    captureContexts: [withheldCapture],
  } as const;
  assert.doesNotThrow(() => MissionProvenanceSchema.parse(provenance));

  const unknownMedia: unknown = structuredClone(provenance);
  setField(
    first(arrayField(unknownMedia, "captureContexts")),
    "mediaId",
    "unknown-media",
  );
  assert.throws(
    () => MissionProvenanceSchema.parse(unknownMedia),
    /without an admission record/,
  );

  const wrongMission: unknown = structuredClone(provenance);
  setField(wrongMission, "missionId", "voyager-2");
  assert.throws(
    () => MissionProvenanceSchema.parse(wrongMission),
    /mission ID must match/,
  );
});
