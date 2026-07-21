import assert from "node:assert/strict";
import test from "node:test";

import {
  COVERAGE_DIMENSION_ORDER,
  COVERAGE_NO_AUTHORITY,
  COVERAGE_PACK_CANONICALIZATION,
  COVERAGE_PACK_PROJECTION_VERSION,
  COVERAGE_PACK_SCHEMA_VERSION,
  CoveragePackSchema,
  CoveragePackSetSchema,
  assertCoverageCorrectionPair,
  assertCoveragePackIntegrity,
  assertCoveragePackSetIntegrity,
  calculateCoveragePackSha256,
  createCoverageCorrectionPack,
  createCoveragePack,
  createCoveragePackSet,
  currentCoveragePacks,
  formatCoveragePackEtag,
  parseCoveragePack,
  parseCoveragePackSet,
  type CoverageCorrectionPackInput,
  type CoverageDimension,
  type CoveragePack,
  type CoveragePackInput,
} from "../src/coverage-pack";

const sha = (character: string): string => character.repeat(64);

const bindingId = "covsrc_voyager_main";
const sourceReferenceId = "voyager-1-main";
const countId = "covm_geometry_records";
const gapId = "covgap_media_bytes";
const requirementId = "covreq_media_admission";

function dimension<
  const DimensionId extends (typeof COVERAGE_DIMENSION_ORDER)[number],
>(
  dimensionId: DimensionId,
  ordinal: number,
  label: string,
): Extract<CoverageDimension, { dimensionId: DimensionId }> {
  const media = dimensionId === "media";
  return {
    dimensionId,
    ordinal,
    label,
    status:
      dimensionId === "terrain"
        ? "out-of-scope"
        : dimensionId === "media"
          ? "absent"
          : "frozen-records-only",
    summary: `${label} coverage is bounded to the frozen fixture.`,
    scopeBoundary: `${label} is not a completeness or validation claim.`,
    countIds: dimensionId === "geometry" ? [countId] : [],
    sourceBindingIds: [bindingId],
    sourceReferenceIds: [sourceReferenceId],
    knownGapIds: media ? [gapId] : [],
    nextEvidenceRequirementIds: media ? [requirementId] : [],
  } as Extract<CoverageDimension, { dimensionId: DimensionId }>;
}

function validPackInput(): CoveragePackInput {
  return {
    schemaVersion: COVERAGE_PACK_SCHEMA_VERSION,
    packId: "covp_voyager_coverage",
    coverageKey: "voyager-1",
    title: "Voyager 1 frozen-record coverage",
    summary:
      "A release-bound summary of what the retained Voyager fixture does and does not establish.",
    generatedAt: "2026-07-19T10:10:00Z",
    state: "release-scoped-coverage-summary-non-authoritative",
    releaseBinding: {
      releaseId: "rel_foundation_001",
      releaseGeneratedAt: "2026-07-19T10:00:00Z",
      releaseManifestSha256: sha("1"),
      releaseContentSha256: sha("2"),
    },
    scope: {
      kind: "mission",
      recordId: "voyager-1-main",
      navigationRecordIds: ["voyager-1"],
    },
    sourceBindings: [
      {
        bindingId,
        kind: "repository-record",
        repositoryPath: "apps/web/app/data/voyager-1.ts",
        exportName: "voyagerOneMission",
        canonicalization: "cosmography-stable-json-v1",
        recordId: "voyager-1-main",
        version: "fixture-2026-07-19-v1",
        sha256: sha("3"),
        frozenAt: "2026-07-19T09:50:00Z",
        referenceRecordIds: [sourceReferenceId],
      },
    ],
    sourceReferenceIds: [sourceReferenceId],
    dimensions: [
      dimension("geometry", 1, "Geometry"),
      dimension("terrain", 2, "Terrain"),
      dimension("observations", 3, "Observations"),
      dimension("media", 4, "Media"),
      dimension("timeline-completeness", 5, "Timeline completeness"),
      dimension("update-cadence", 6, "Update cadence"),
      dimension("rights", 7, "Rights"),
      dimension("validation-tier", 8, "Validation tier"),
    ],
    counts: [
      {
        countId,
        label: "Frozen trajectory records",
        value: 1,
        total: 1,
        unit: "records",
        basis: "Counted from the exact bound repository record.",
        dimensionIds: ["geometry"],
        sourceBindingIds: [bindingId],
      },
    ],
    knownGaps: [
      {
        gapId,
        severity: "material",
        summary: "No admitted media bytes are present in the bound record.",
        safeguard: "Keep media metadata reference-only and render no asset bytes.",
        dimensionIds: ["media"],
        sourceBindingIds: [bindingId],
        sourceReferenceIds: [sourceReferenceId],
        nextEvidenceRequirementIds: [requirementId],
        origins: [{ sourceBindingId: bindingId, jsonPointer: "/media/0" }],
      },
    ],
    nextEvidenceRequirements: [
      {
        requirementId,
        title: "Admit exact media bytes",
        state: "pending",
        detail:
          "Retain exact bytes, bind a digest, and complete an asset-target rights review.",
        dimensionIds: ["media"],
        sourceBindingIds: [bindingId],
        sourceReferenceIds: [sourceReferenceId],
        knownGapIds: [gapId],
        origins: [{ sourceBindingId: bindingId, jsonPointer: "/media/0" }],
      },
    ],
    correctionLineage: {
      kind: "initial-release-snapshot",
      revision: 1,
    },
    ...COVERAGE_NO_AUTHORITY,
  };
}

function validatedArtifactPackInput(): CoveragePackInput {
  const input = structuredClone(validPackInput());
  input.sourceBindings = [
    {
      bindingId,
      kind: "retained-artifact",
      repositoryPath: "fixtures/voyager-1/frozen-trajectory.json",
      byteLength: 4_096,
      canonicalization: "raw-bytes-sha256",
      recordId: "voyager-1-main",
      version: "fixture-2026-07-19-v1",
      sha256: sha("3"),
      frozenAt: "2026-07-19T09:50:00Z",
      referenceRecordIds: [sourceReferenceId],
    },
  ];
  input.dimensions[0].status = "validated-artifact-evidence";
  input.counts[0]!.unit = "artifacts";
  return input;
}

function packPayload(pack: CoveragePack): CoveragePackInput {
  const {
    canonicalization: _canonicalization,
    packSha256: _packSha256,
    etag: _etag,
    ...payload
  } = structuredClone(pack);
  return payload;
}

function parseStandaloneDeclaration(input: CoveragePackInput): CoveragePack {
  const packSha256 = calculateCoveragePackSha256(input);
  return CoveragePackSchema.parse({
    ...input,
    canonicalization: COVERAGE_PACK_CANONICALIZATION,
    packSha256,
    etag: formatCoveragePackEtag(packSha256),
  });
}

function assertDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

test("coverage packs have deterministic canonical digests, ETags, and deep immutability", () => {
  const first = createCoveragePack(validPackInput());
  const second = createCoveragePack(structuredClone(validPackInput()));

  assert.equal(first.packSha256, second.packSha256);
  assert.equal(first.packSha256, calculateCoveragePackSha256(validPackInput()));
  assert.equal(first.etag, formatCoveragePackEtag(first.packSha256));
  assert.match(first.etag, /^"cpack-sha256-[a-f0-9]{64}"$/);
  assert.doesNotThrow(() => assertCoveragePackIntegrity(first));
  assertDeepFrozen(first);

  const schemaParsed = CoveragePackSchema.parse(JSON.parse(JSON.stringify(first)));
  assertDeepFrozen(schemaParsed);

  const parsedCopy = parseCoveragePack(JSON.parse(JSON.stringify(first)));
  assertDeepFrozen(parsedCopy);

  const assertedCopy: unknown = JSON.parse(JSON.stringify(first));
  assert.doesNotThrow(() => assertCoveragePackIntegrity(assertedCopy));
  assertDeepFrozen(assertedCopy);
  assert.equal(
    Reflect.set(assertedCopy as Record<string, unknown>, "title", "Tampered"),
    false,
  );
});

test("the dimension tuple fixes all eight IDs, labels, ordinals, and statuses", () => {
  const pack = createCoveragePack(validPackInput());
  assert.deepEqual(
    pack.dimensions.map((entry) => entry.dimensionId),
    COVERAGE_DIMENSION_ORDER,
  );
  assert.deepEqual(
    pack.dimensions.map((entry) => entry.ordinal),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );

  const reversed = structuredClone(validPackInput());
  reversed.dimensions.reverse();
  assert.throws(() => createCoveragePack(reversed));

  const relabeled = structuredClone(validPackInput());
  assert.equal(Reflect.set(relabeled.dimensions[0], "label", "Shape"), true);
  assert.throws(() => createCoveragePack(relabeled));

  assert.throws(() =>
    CoveragePackSchema.parse({ ...pack, unsupportedAuthority: true }),
  );
});

test("in-scope statuses require evidence and v1 reserves validated-artifact status", () => {
  const noEvidence = structuredClone(validPackInput());
  noEvidence.dimensions[2].sourceBindingIds = [];
  noEvidence.dimensions[2].sourceReferenceIds = [];
  assert.throws(() => createCoveragePack(noEvidence), /in-scope coverage status/);

  assert.throws(
    () => createCoveragePack(validatedArtifactPackInput()),
    /reserved in Coverage Pack v1/,
  );
});

test("source bindings reject unsafe paths, mutable versions, and weak identity", () => {
  for (const repositoryPath of [
    "/apps/web/data.ts",
    "../apps/web/data.ts",
    "apps\\web\\data.ts",
    "C:/apps/web/data.ts",
    "apps/web/data/latest/voyager.ts",
    "apps/web/data/HEAD/voyager.ts",
    "apps/web/data/production-voyager.ts",
  ]) {
    const candidate = structuredClone(validPackInput());
    candidate.sourceBindings[0]!.repositoryPath = repositoryPath;
    assert.throws(() => createCoveragePack(candidate));
  }

  for (const version of [
    "latest",
    "fixture-current",
    "rolling/v2",
    "HEAD",
    "main",
    "master-v2",
    "tip",
    "trunk/v2",
    "stable",
    "production-2026",
  ]) {
    const candidate = structuredClone(validPackInput());
    candidate.sourceBindings[0]!.version = version;
    assert.throws(() => createCoveragePack(candidate));
  }

  const duplicateReferences = structuredClone(validPackInput());
  duplicateReferences.sourceBindings[0]!.referenceRecordIds.push(
    sourceReferenceId,
  );
  assert.throws(() => createCoveragePack(duplicateReferences), /unique/);

  const missingDigest = structuredClone(validPackInput());
  missingDigest.sourceBindings[0]!.sha256 = "unknown";
  assert.throws(() => createCoveragePack(missingDigest));
});

test("counts, gaps, requirements, bindings, references, and origins stay reciprocal", () => {
  const mismatchedScope = structuredClone(validPackInput());
  mismatchedScope.scope.recordId = "mars-jezero-main";
  assert.throws(
    () => createCoveragePack(mismatchedScope),
    /Coverage scope must resolve to the same record/,
  );

  const scopeMissingFromBindingReferences = structuredClone(validPackInput());
  scopeMissingFromBindingReferences.sourceBindings[0]!.referenceRecordIds = [
    "voyager-1-secondary",
  ];
  scopeMissingFromBindingReferences.sourceReferenceIds = [
    "voyager-1-secondary",
  ];
  for (const dimension of scopeMissingFromBindingReferences.dimensions) {
    dimension.sourceReferenceIds = ["voyager-1-secondary"];
  }
  scopeMissingFromBindingReferences.knownGaps[0]!.sourceReferenceIds = [
    "voyager-1-secondary",
  ];
  scopeMissingFromBindingReferences.nextEvidenceRequirements[0]!.sourceReferenceIds = [
    "voyager-1-secondary",
  ];
  assert.throws(
    () => createCoveragePack(scopeMissingFromBindingReferences),
    /Coverage scope must resolve to the same record/,
  );

  const missingCountBacklink = structuredClone(validPackInput());
  missingCountBacklink.dimensions[0].countIds = [];
  assert.throws(() => createCoveragePack(missingCountBacklink), /reciprocal/);

  const missingGapBacklink = structuredClone(validPackInput());
  missingGapBacklink.dimensions[3].knownGapIds = [];
  assert.throws(() => createCoveragePack(missingGapBacklink));

  const missingRequirementBacklink = structuredClone(validPackInput());
  missingRequirementBacklink.knownGaps[0]!.nextEvidenceRequirementIds = [];
  assert.throws(() => createCoveragePack(missingRequirementBacklink), /reciprocal/);

  const unknownOrigin = structuredClone(validPackInput());
  unknownOrigin.knownGaps[0]!.origins[0]!.sourceBindingId =
    "covsrc_missing_binding";
  assert.throws(() => createCoveragePack(unknownOrigin));

  const unboundReference = structuredClone(validPackInput());
  unboundReference.dimensions[0].sourceReferenceIds = ["unknown-reference"];
  assert.throws(() => createCoveragePack(unboundReference));

  const unknownBinding = structuredClone(validPackInput());
  unknownBinding.dimensions[0].sourceBindingIds = ["covsrc_missing_binding"];
  assert.throws(() => createCoveragePack(unknownBinding));

  const noncanonicalNavigation = structuredClone(validPackInput());
  noncanonicalNavigation.scope.navigationRecordIds = ["voyager-2", "voyager-1"];
  assert.throws(() => createCoveragePack(noncanonicalNavigation), /ordered/);
});

test("coverage summaries cannot grant authority by boolean mutation", () => {
  for (const field of Object.keys(COVERAGE_NO_AUTHORITY)) {
    assert.throws(() =>
      createCoveragePack({ ...validPackInput(), [field]: true }),
    );
  }
});

test("corrections are derived from and pair-verified against an exact predecessor", () => {
  const initial = createCoveragePack(validPackInput());
  const {
    packId: _packId,
    coverageKey: _coverageKey,
    scope: _scope,
    correctionLineage: _correctionLineage,
    ...next
  } = structuredClone(validPackInput());
  next.generatedAt = "2026-07-19T11:10:00Z";
  next.releaseBinding = {
    releaseId: "rel_foundation_002",
    releaseGeneratedAt: "2026-07-19T11:00:00Z",
    releaseManifestSha256: sha("4"),
    releaseContentSha256: sha("5"),
  };
  next.knownGaps[0]!.summary =
    "No admitted media bytes are present in the corrected exact source record.";

  const corrected = createCoverageCorrectionPack(initial, {
    ...next,
    issuedAt: "2026-07-19T11:05:00Z",
    reason: "The later immutable release corrects the media gap wording.",
  });
  assert.doesNotThrow(() => assertCoverageCorrectionPair(initial, corrected));
  assert.equal(corrected.packId, initial.packId);
  assert.equal(corrected.coverageKey, initial.coverageKey);
  assert.deepEqual(corrected.scope, initial.scope);
  assert.equal(corrected.correctionLineage.revision, 2);
  if (corrected.correctionLineage.kind !== "superseding-correction") {
    throw new TypeError("Expected a correction fixture");
  }
  assert.deepEqual(corrected.correctionLineage.affectedDimensionIds, ["media"]);
  assert.deepEqual(corrected.correctionLineage.previous, {
    packId: initial.packId,
    releaseId: initial.releaseBinding.releaseId,
    packSha256: initial.packSha256,
  });

  assert.throws(
    () => createCoveragePack(packPayload(corrected)),
    /must be derived from an exact predecessor/,
  );

  const forgedPredecessor = packPayload(corrected);
  if (forgedPredecessor.correctionLineage.kind !== "superseding-correction") {
    throw new TypeError("Expected a correction fixture");
  }
  forgedPredecessor.correctionLineage.previous.packSha256 = sha("f");
  assert.throws(
    () =>
      assertCoverageCorrectionPair(
        initial,
        parseStandaloneDeclaration(forgedPredecessor),
      ),
    /exact predecessor/,
  );

  const skippedRevision = packPayload(corrected);
  if (skippedRevision.correctionLineage.kind !== "superseding-correction") {
    throw new TypeError("Expected a correction fixture");
  }
  skippedRevision.correctionLineage.revision = 3;
  assert.throws(
    () =>
      assertCoverageCorrectionPair(
        initial,
        parseStandaloneDeclaration(skippedRevision),
      ),
    /immediately follow/,
  );

  const changedIdentity = packPayload(corrected);
  changedIdentity.coverageKey = "voyager-1-corrected";
  assert.throws(
    () =>
      assertCoverageCorrectionPair(
        initial,
        parseStandaloneDeclaration(changedIdentity),
      ),
    /stable logical identity/,
  );

  const predated = packPayload(corrected);
  if (predated.correctionLineage.kind !== "superseding-correction") {
    throw new TypeError("Expected a correction fixture");
  }
  predated.correctionLineage.issuedAt = "2026-07-19T10:30:00Z";
  assert.throws(
    () =>
      assertCoverageCorrectionPair(
        initial,
        parseStandaloneDeclaration(predated),
      ),
    /must follow its predecessor and current release/,
  );

  const understatedDimensions = packPayload(corrected);
  if (
    understatedDimensions.correctionLineage.kind !== "superseding-correction"
  ) {
    throw new TypeError("Expected a correction fixture");
  }
  understatedDimensions.correctionLineage.affectedDimensionIds = ["geometry"];
  assert.throws(
    () =>
      assertCoverageCorrectionPair(
        initial,
        parseStandaloneDeclaration(understatedDimensions),
      ),
    /pair-derived change set/,
  );

  const noOpNext = structuredClone(next);
  noOpNext.knownGaps[0]!.summary = initial.knownGaps[0]!.summary;
  assert.throws(
    () =>
      createCoverageCorrectionPack(initial, {
        ...noOpNext,
        issuedAt: "2026-07-19T11:05:00Z",
        reason: "A release-only change is not a coverage correction.",
      }),
    /must change descriptive or dimension-linked evidence/,
  );
});

test("top-level descriptive corrections conservatively affect all dimensions", () => {
  const initial = createCoveragePack(validPackInput());
  const {
    packId: _packId,
    coverageKey: _coverageKey,
    scope: _scope,
    correctionLineage: _correctionLineage,
    ...next
  } = structuredClone(validPackInput());
  next.title = "Corrected Voyager 1 frozen-record coverage";
  next.generatedAt = "2026-07-19T11:10:00Z";
  next.releaseBinding = {
    releaseId: "rel_foundation_002",
    releaseGeneratedAt: "2026-07-19T11:00:00Z",
    releaseManifestSha256: sha("4"),
    releaseContentSha256: sha("5"),
  };
  const corrected = createCoverageCorrectionPack(initial, {
    ...next,
    issuedAt: "2026-07-19T11:05:00Z",
    reason: "The title correction affects the full summary presentation.",
  });
  if (corrected.correctionLineage.kind !== "superseding-correction") {
    throw new TypeError("Expected a correction fixture");
  }
  assert.deepEqual(
    corrected.correctionLineage.affectedDimensionIds,
    COVERAGE_DIMENSION_ORDER,
  );
});

test("pair-derived dimensions include direct, linked-record, and source changes", () => {
  const initial = createCoveragePack(validPackInput());

  function correctedAfter(
    mutate: (input: CoverageCorrectionPackInput) => void,
  ): CoveragePack {
    const {
      packId: _packId,
      coverageKey: _coverageKey,
      scope: _scope,
      correctionLineage: _correctionLineage,
      ...next
    } = structuredClone(validPackInput());
    const input: CoverageCorrectionPackInput = {
      ...next,
      generatedAt: "2026-07-19T11:10:00Z",
      releaseBinding: {
        releaseId: "rel_foundation_002",
        releaseGeneratedAt: "2026-07-19T11:00:00Z",
        releaseManifestSha256: sha("4"),
        releaseContentSha256: sha("5"),
      },
      issuedAt: "2026-07-19T11:05:00Z",
      reason: "The exact later release corrects one bound coverage fact.",
    };
    mutate(input);
    return createCoverageCorrectionPack(initial, input);
  }

  const cases: readonly [
    (input: CoverageCorrectionPackInput) => void,
    readonly string[],
  ][] = [
    [
      (input) => {
        input.dimensions[0].summary = "Corrected geometry summary.";
      },
      ["geometry"],
    ],
    [
      (input) => {
        input.counts[0]!.basis = "Corrected exact count basis.";
      },
      ["geometry"],
    ],
    [
      (input) => {
        input.knownGaps[0]!.safeguard = "Corrected media safeguard.";
      },
      ["media"],
    ],
    [
      (input) => {
        input.nextEvidenceRequirements[0]!.detail =
          "Corrected exact next-evidence requirement.";
      },
      ["media"],
    ],
    [
      (input) => {
        input.sourceBindings[0]!.sha256 = sha("6");
      },
      COVERAGE_DIMENSION_ORDER,
    ],
  ];

  for (const [mutate, expected] of cases) {
    const corrected = correctedAfter(mutate);
    if (corrected.correctionLineage.kind !== "superseding-correction") {
      throw new TypeError("Expected a correction fixture");
    }
    assert.deepEqual(corrected.correctionLineage.affectedDimensionIds, expected);
  }
});

test("tampering with a complete pack fails digest and ETag integrity", () => {
  const pack = createCoveragePack(validPackInput());
  assert.throws(() =>
    CoveragePackSchema.parse({ ...pack, title: "Tampered title" }),
  );
  assert.throws(() =>
    CoveragePackSchema.parse({
      ...pack,
      etag: `"cpack-sha256-${sha("f")}"`,
    }),
  );
  assert.throws(() =>
    assertCoveragePackIntegrity({ ...pack, summary: "Tampered summary" }),
  );
});

test("coverage pack sets bind every deeply frozen pack to one exact release", () => {
  const pack = createCoveragePack(validPackInput());
  const set = createCoveragePackSet({
    schemaVersion: COVERAGE_PACK_SCHEMA_VERSION,
    coverageSetId: "covset_foundation_coverage",
    projectionVersion: COVERAGE_PACK_PROJECTION_VERSION,
    generatedAt: "2026-07-19T10:15:00Z",
    state: "release-scoped-coverage-projection-non-authoritative",
    releaseBinding: pack.releaseBinding,
    packs: [pack],
    ...COVERAGE_NO_AUTHORITY,
  });

  assert.deepEqual(currentCoveragePacks(set), [pack]);
  assert.doesNotThrow(() => assertCoveragePackSetIntegrity(set));
  assert.match(set.etag, /^"cpack-set-sha256-[a-f0-9]{64}"$/);
  assertDeepFrozen(set);

  const schemaParsed = CoveragePackSetSchema.parse(
    JSON.parse(JSON.stringify(set)),
  );
  assertDeepFrozen(schemaParsed);

  const parsedCopy = parseCoveragePackSet(JSON.parse(JSON.stringify(set)));
  assertDeepFrozen(parsedCopy);

  const assertedCopy: unknown = JSON.parse(JSON.stringify(set));
  assert.doesNotThrow(() => assertCoveragePackSetIntegrity(assertedCopy));
  assertDeepFrozen(assertedCopy);
  const current = currentCoveragePacks(assertedCopy);
  assert.equal(Object.isFrozen(current), true);
  assert.equal(Reflect.set(current[0]!, "title", "Tampered"), false);

  const otherReleaseInput = structuredClone(validPackInput());
  otherReleaseInput.releaseBinding = {
    ...otherReleaseInput.releaseBinding,
    releaseId: "rel_foundation_002",
    releaseManifestSha256: sha("4"),
    releaseContentSha256: sha("5"),
  };
  const otherRelease = createCoveragePack(otherReleaseInput);
  assert.throws(() =>
    createCoveragePackSet({
      schemaVersion: COVERAGE_PACK_SCHEMA_VERSION,
      coverageSetId: "covset_foundation_coverage",
      projectionVersion: COVERAGE_PACK_PROJECTION_VERSION,
      generatedAt: "2026-07-19T10:15:00Z",
      state: "release-scoped-coverage-projection-non-authoritative",
      releaseBinding: pack.releaseBinding,
      packs: [otherRelease],
      ...COVERAGE_NO_AUTHORITY,
    }),
  );
});

test("coverage pack sets reject noncanonical order and duplicate logical entries", () => {
  const alphaInput = validPackInput();
  alphaInput.packId = "covp_alpha_coverage";
  alphaInput.coverageKey = "alpha-coverage";
  const alpha = createCoveragePack(alphaInput);
  const betaInput = validPackInput();
  betaInput.packId = "covp_beta_coverage";
  betaInput.coverageKey = "beta-coverage";
  const beta = createCoveragePack(betaInput);
  const setBase = {
    schemaVersion: COVERAGE_PACK_SCHEMA_VERSION,
    coverageSetId: "covset_ordering_case",
    projectionVersion: COVERAGE_PACK_PROJECTION_VERSION,
    generatedAt: "2026-07-19T10:15:00Z",
    state: "release-scoped-coverage-projection-non-authoritative" as const,
    releaseBinding: alpha.releaseBinding,
    ...COVERAGE_NO_AUTHORITY,
  };

  assert.doesNotThrow(() => createCoveragePackSet({ ...setBase, packs: [alpha, beta] }));
  assert.throws(
    () => createCoveragePackSet({ ...setBase, packs: [beta, alpha] }),
    /canonically ordered/,
  );
  assert.throws(
    () => createCoveragePackSet({ ...setBase, packs: [alpha, alpha] }),
    /unique/,
  );
});
