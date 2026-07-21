import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { stableJsonSha256 } from "@cosmography/scientific-model";

import {
  COVERAGE_DIMENSION_ORDER,
  COVERAGE_NO_AUTHORITY,
  CoverageReleaseBindingSchema,
  assertCoveragePackIntegrity,
  assertCoveragePackSetIntegrity,
  createCoverageCorrectionPack,
  createCoveragePackSet,
  type CoveragePack,
} from "@cosmography/scientific-model/coverage-pack";

import { earthNetwork } from "../app/data/earth";
import { voyager1 } from "../app/data/missions/voyager-1";
import {
  FOUNDATION_COVERAGE_PACK_IDS,
  FOUNDATION_RELEASE_ID,
  createFoundationCoveragePackSet,
} from "../app/data/coverage/coverage-packs";
import { marsJezeroPreIngestLedger } from "../app/data/surface/mars-jezero-provenance";
import { moonApollo17SurfacePreIngestLedger } from "../app/data/surface/moon-apollo17-provenance";
import {
  FOUNDATION_COVERAGE_MANIFEST_CANONICALIZATION,
  FOUNDATION_COVERAGE_MANIFEST_SHA256,
  ReleaseCoverageIntegrityError,
  assertCoverageManifestMatches,
  getReleaseCoveragePack,
  getReleaseCoverageSet,
  releaseCoverageApiPath,
  releaseCoveragePackApiPath,
  releaseCoverageScenePath,
} from "../app/lib/releases/coverage";
import {
  FOUNDATION_BUNDLE_SHA256,
  FOUNDATION_MANIFEST_SHA256,
} from "../app/lib/releases/catalog";
import foundationCoverageManifest from "../db/foundation-coverage-manifest.json";
import { GET as getCoverageCollection } from "../app/api/v1/releases/[releaseId]/coverage/route";
import { GET as getCoverageDetail } from "../app/api/v1/releases/[releaseId]/coverage/[packId]/route";

function requireFoundationSet() {
  const set = getReleaseCoverageSet(FOUNDATION_RELEASE_ID);
  assert.ok(set);
  return set;
}

function packByKey(coverageKey: string): CoveragePack {
  const pack = requireFoundationSet().packs.find(
    (candidate) => candidate.coverageKey === coverageKey,
  );
  assert.ok(pack, `missing ${coverageKey} Coverage Pack`);
  return pack;
}

function countByLabel(pack: CoveragePack, label: string) {
  const record = pack.counts.find((candidate) => candidate.label === label);
  assert.ok(record, `missing ${label} count in ${pack.coverageKey}`);
  return record;
}

function assertReciprocalEvidence(pack: CoveragePack): void {
  assert.equal(pack.knownGaps.length, pack.nextEvidenceRequirements.length);
  for (const gap of pack.knownGaps) {
    assert.equal(gap.nextEvidenceRequirementIds.length, 1);
    const requirement = pack.nextEvidenceRequirements.find(
      (candidate) => candidate.requirementId === gap.nextEvidenceRequirementIds[0],
    );
    assert.ok(requirement);
    assert.deepEqual(requirement.knownGapIds, [gap.gapId]);
  }
}

test("foundation Coverage Packs are exact-release, hash-pinned, and immutable", async () => {
  const manifestBytes = await readFile(
    new URL("../db/foundation-coverage-manifest.json", import.meta.url),
  );
  const manifestRecord = JSON.parse(manifestBytes.toString("utf8"));
  assert.deepEqual(manifestRecord, foundationCoverageManifest);
  assert.equal(
    manifestRecord.canonicalization,
    FOUNDATION_COVERAGE_MANIFEST_CANONICALIZATION,
  );
  assert.equal(
    stableJsonSha256(manifestRecord),
    FOUNDATION_COVERAGE_MANIFEST_SHA256,
  );

  const set = requireFoundationSet();
  assert.doesNotThrow(() => assertCoveragePackSetIntegrity(set));
  assert.doesNotThrow(() => assertCoverageManifestMatches(set));
  assert.equal(set.releaseBinding.releaseId, FOUNDATION_RELEASE_ID);
  assert.equal(
    set.releaseBinding.releaseManifestSha256,
    FOUNDATION_MANIFEST_SHA256,
  );
  assert.equal(
    set.releaseBinding.releaseContentSha256,
    FOUNDATION_BUNDLE_SHA256,
  );
  assert.equal(set.setSha256, foundationCoverageManifest.coverageSet.sha256);
  assert.equal(set.etag, foundationCoverageManifest.coverageSet.etag);
  assert.equal(Object.isFrozen(set), true);
  assert.equal(Object.isFrozen(set.packs), true);

  assert.deepEqual(
    set.packs.map(({ coverageKey, packId }) => ({ coverageKey, packId })),
    foundationCoverageManifest.packs.map(({ coverageKey, packId }) => ({
      coverageKey,
      packId,
    })),
  );
  assert.deepEqual(
    set.packs.map((pack) => pack.packId),
    Object.values(FOUNDATION_COVERAGE_PACK_IDS),
  );

  for (const [index, pack] of set.packs.entries()) {
    const pin = foundationCoverageManifest.packs[index];
    assert.ok(pin);
    assert.doesNotThrow(() => assertCoveragePackIntegrity(pack));
    assert.equal(pack.packSha256, pin.sha256);
    assert.equal(pack.etag, pin.etag);
    assert.equal(pack.correctionLineage.kind, "initial-release-snapshot");
    assert.equal(Object.isFrozen(pack), true);
    assert.equal(Object.isFrozen(pack.dimensions), true);
    assert.equal(Object.isFrozen(pack.sourceBindings), true);
    assert.equal(Object.isFrozen(pack.sourceBindings[0]), true);
    assert.equal(Object.isFrozen(pack.sourceBindings[0]?.referenceRecordIds), true);

    for (const [flag, expected] of Object.entries(COVERAGE_NO_AUTHORITY)) {
      assert.equal(pack[flag as keyof CoveragePack], expected, flag);
      assert.equal(set[flag as keyof typeof set], expected, flag);
    }
    assert.equal(
      pack.dimensions.some(
        (dimension) => dimension.status === "validated-artifact-evidence",
      ),
      false,
    );
    for (const dimension of pack.dimensions) {
      if (dimension.status !== "out-of-scope") {
        assert.ok(dimension.sourceBindingIds.length > 0);
        assert.ok(dimension.sourceReferenceIds.length > 0);
      }
    }

    const bindingReferenceUnion = [
      ...new Set(
        pack.sourceBindings.flatMap((binding) => binding.referenceRecordIds),
      ),
    ].sort();
    assert.deepEqual(pack.sourceReferenceIds, bindingReferenceUnion);
    assert.ok(
      pack.sourceBindings.some(
        (binding) =>
          binding.recordId === pack.scope.recordId &&
          binding.referenceRecordIds.includes(pack.scope.recordId),
      ),
    );
  }

  assert.equal(JSON.stringify(set).includes('"latest"'), false);
});

test("Coverage Pack manifest comparison is key-order independent and fails closed on drift", () => {
  const set = requireFoundationSet();
  const reordered = structuredClone(foundationCoverageManifest) as typeof foundationCoverageManifest;
  reordered.releaseBinding = {
    releaseContentSha256: foundationCoverageManifest.releaseBinding.releaseContentSha256,
    releaseManifestSha256: foundationCoverageManifest.releaseBinding.releaseManifestSha256,
    releaseGeneratedAt: foundationCoverageManifest.releaseBinding.releaseGeneratedAt,
    releaseId: foundationCoverageManifest.releaseBinding.releaseId,
  };
  assert.doesNotThrow(() => assertCoverageManifestMatches(set, reordered));

  const drifted = structuredClone(foundationCoverageManifest) as unknown as {
    coverageSet: { sha256: string };
  };
  drifted.coverageSet.sha256 = "0".repeat(64);
  assert.throws(
    () => assertCoverageManifestMatches(set, drifted),
    (error) =>
      error instanceof ReleaseCoverageIntegrityError &&
      /manifest/i.test(error.message),
  );

  const warningDrift = structuredClone(
    foundationCoverageManifest,
  ) as unknown as { warning: string };
  warningDrift.warning = `${warningDrift.warning} Altered after pinning.`;
  assert.throws(
    () => assertCoverageManifestMatches(set, warningDrift),
    (error) =>
      error instanceof ReleaseCoverageIntegrityError &&
      /canonical semantic digest/i.test(error.message),
  );

  assert.throws(
    () => {
      const alternateRelease = CoverageReleaseBindingSchema.parse({
        ...set.releaseBinding,
        releaseId: "rel_another_release",
      });
      createFoundationCoveragePackSet(alternateRelease);
    },
    /exact foundation release/i,
  );
});

test("web integrity rejects standalone correction packs without their exact predecessor", () => {
  const foundationSet = requireFoundationSet();
  const initial = foundationSet.packs[0]!;
  const {
    canonicalization: _canonicalization,
    packSha256: _packSha256,
    etag: _etag,
    packId: _packId,
    coverageKey: _coverageKey,
    scope: _scope,
    correctionLineage: _correctionLineage,
    ...next
  } = structuredClone(initial);
  void [
    _canonicalization,
    _packSha256,
    _etag,
    _packId,
    _coverageKey,
    _scope,
    _correctionLineage,
  ];
  const releaseBinding = CoverageReleaseBindingSchema.parse({
    releaseId: "rel_coverage_correction_002",
    releaseGeneratedAt: "2026-07-20T00:00:00Z",
    releaseManifestSha256: "1".repeat(64),
    releaseContentSha256: "2".repeat(64),
  });
  const correction = createCoverageCorrectionPack(initial, {
    ...next,
    generatedAt: "2026-07-20T00:10:00Z",
    releaseBinding,
    summary: `${next.summary} Corrected in a later exact release.`,
    issuedAt: "2026-07-20T00:05:00Z",
    reason: "Exercise the web predecessor-pair serving boundary.",
  });
  const correctionSet = createCoveragePackSet({
    schemaVersion: foundationSet.schemaVersion,
    coverageSetId: "covset_correction_rejection_v1",
    projectionVersion: foundationSet.projectionVersion,
    generatedAt: correction.generatedAt,
    state: foundationSet.state,
    releaseBinding,
    packs: [correction],
    ...COVERAGE_NO_AUTHORITY,
  });

  assert.throws(
    () => assertCoverageManifestMatches(correctionSet),
    (error) =>
      error instanceof ReleaseCoverageIntegrityError &&
      /cannot serve a superseding correction.*exact predecessor pair/i.test(
        error.message,
      ),
  );
});

test("surface, mission, and Earth counts preserve the frozen evidence boundary", () => {
  const apollo = packByKey("apollo-17");
  const mars = packByKey("mars-jezero");
  const voyager = packByKey("voyager-1");
  const earth = packByKey("earth-network");

  for (const [pack, expected, ledger] of [
    [
      apollo,
      { sources: 8, evidence: 8, requirements: 9 },
      moonApollo17SurfacePreIngestLedger,
    ],
    [
      mars,
      { sources: 12, evidence: 10, requirements: 12 },
      marsJezeroPreIngestLedger,
    ],
  ] as const) {
    assert.deepEqual(
      {
        admitted: [
          countByLabel(pack, "Admitted artifacts").value,
          countByLabel(pack, "Admitted artifacts").total,
        ],
        poses: [
          countByLabel(pack, "Renderable poses").value,
          countByLabel(pack, "Renderable poses").total,
        ],
        contexts: countByLabel(pack, "Withheld capture contexts").value,
        evidence: countByLabel(pack, "Evidence records").value,
        requirements: countByLabel(
          pack,
          "Reference-only product requirements",
        ).value,
        sources: countByLabel(pack, "Source records").value,
        stages: countByLabel(pack, "Semantic surface stages").value,
      },
      {
        admitted: [0, expected.requirements],
        poses: [0, 3],
        contexts: 3,
        evidence: expected.evidence,
        requirements: expected.requirements,
        sources: expected.sources,
        stages: 4,
      },
    );
    assert.equal(pack.sourceBindings.length, 2);
    assert.ok(
      pack.sourceBindings.every(
        (binding) => binding.kind === "repository-record",
      ),
    );
    assert.equal(
      pack.knownGaps.length,
      ledger.productRequirements.length + ledger.captureContexts.length,
    );
    assertReciprocalEvidence(pack);
    for (const [index, record] of ledger.productRequirements.entries()) {
      const gap = pack.knownGaps.find(
        (candidate) =>
          candidate.gapId ===
          `covgap_${pack.coverageKey.replaceAll("-", "_")}_product_${record.requirementId.replaceAll("-", "_")}`,
      );
      assert.ok(gap);
      assert.equal(gap.severity, "unranked");
      const disclosedText = `${gap.summary} ${gap.safeguard}`;
      for (const [reasonIndex, reason] of record.blockedReasons.entries()) {
        assert.ok(disclosedText.includes(reason));
        assert.ok(
          gap.origins.some(
            (origin) =>
              origin.jsonPointer ===
              `/productRequirements/${index}/blockedReasons/${reasonIndex}`,
          ),
        );
      }
      assert.match(gap.safeguard, /assetBytesPresent=false/);
      assert.match(gap.safeguard, /renderAllowed=false/);
      assert.match(gap.safeguard, /releaseEligible=false/);
    }
    for (const [index, record] of ledger.captureContexts.entries()) {
      const gap = pack.knownGaps.find(
        (candidate) =>
          candidate.gapId ===
          `covgap_${pack.coverageKey.replaceAll("-", "_")}_capture_${record.captureContextId.replaceAll("-", "_")}`,
      );
      assert.ok(gap);
      assert.equal(gap.severity, "unranked");
      const disclosedText = `${gap.summary} ${gap.safeguard}`;
      for (const [reasonIndex, reason] of record.blockedReasons.entries()) {
        assert.ok(disclosedText.includes(reason));
        assert.ok(
          gap.origins.some(
            (origin) =>
              origin.jsonPointer ===
              `/captureContexts/${index}/blockedReasons/${reasonIndex}`,
          ),
        );
      }
      assert.match(gap.safeguard, /renderableCameraPose=false/);
      assert.match(gap.safeguard, /renderAllowed=false/);
      assert.match(gap.safeguard, /releaseEligible=false/);
    }
  }

  assert.deepEqual(
    Object.fromEntries(voyager.counts.map((record) => [record.label, record.value])),
    {
      "Mission events": 10,
      "Executable kernel artifacts": 0,
      "Frozen trajectory epochs": 7,
      "Proposed kernel references": 5,
      "Reference-only media": 5,
      "Renderable capture contexts": 0,
      "Retained raw artifacts": 1,
      "Source records": 21,
      "Withheld capture contexts": 2,
    },
  );
  const retainedArtifact = voyager.sourceBindings.find(
    (binding) => binding.kind === "retained-artifact",
  );
  assert.ok(retainedArtifact);
  assert.equal(
    retainedArtifact.repositoryPath,
    "apps/web/tests/fixtures/horizons/voyager-1-vectors-2026-07-19.txt",
  );
  assert.equal(retainedArtifact.byteLength, 8_983);
  assert.equal(
    retainedArtifact.sha256,
    "d5fb20227607ff652e109977a068f28aff0a13cf8bf1cbc55a8bf40cfdca1252",
  );
  assert.equal(voyager.knownGaps.length, 4);
  assertReciprocalEvidence(voyager);
  assert.deepEqual(
    voyager.knownGaps.map((gap) => gap.gapId),
    [
      "covgap_voyager_1_capture_contexts",
      "covgap_voyager_1_independent_validation",
      "covgap_voyager_1_kernel_artifacts",
      "covgap_voyager_1_media_admissions",
    ],
  );
  assert.ok(voyager.knownGaps.every((gap) => gap.severity === "unranked"));
  const kernelSet = voyager1.provenance.kernelSet;
  assert.ok("missingEvidence" in kernelSet);
  const voyagerDisclosure = voyager.knownGaps
    .map((gap) => `${gap.summary} ${gap.safeguard}`)
    .join(" ");
  for (const reason of kernelSet.missingEvidence) {
    assert.ok(voyagerDisclosure.includes(reason));
  }
  assert.ok(
    voyagerDisclosure.includes(voyager1.provenance.horizonsValidation.blockedReason),
  );
  for (const record of voyager1.provenance.mediaAdmissions.filter(
    (candidate) => candidate.state === "reference-only-pending-asset-review",
  )) {
    assert.ok(voyagerDisclosure.includes(record.blockedReason));
  }
  for (const record of voyager1.provenance.captureContexts) {
    for (const reason of record.blockedReasons) {
      assert.ok(voyagerDisclosure.includes(reason));
    }
  }

  assert.deepEqual(
    Object.fromEntries(earth.counts.map((record) => [record.label, record.value])),
    {
      "Known coverage gaps": 8,
      "Organization records": 28,
      "Indexed sites": 35,
      "Source records": 35,
    },
  );
  assert.equal(earth.knownGaps.length, earthNetwork.gaps.length);
  assert.equal(
    earth.nextEvidenceRequirements.length,
    earthNetwork.gaps.length,
  );
  assert.deepEqual(
    earth.nextEvidenceRequirements.map((record) => record.detail).sort(),
    earthNetwork.gaps.map((record) => record.nextEvidence).sort(),
  );
  assertReciprocalEvidence(earth);
});

test("Coverage Pack selectors use exact opaque release and pack identities", () => {
  assert.equal(getReleaseCoverageSet("latest"), undefined);
  assert.equal(getReleaseCoverageSet("rel_unknown_release"), undefined);
  assert.equal(
    getReleaseCoveragePack(FOUNDATION_RELEASE_ID, "apollo-17"),
    undefined,
  );
  assert.equal(
    getReleaseCoveragePack(
      FOUNDATION_RELEASE_ID,
      FOUNDATION_COVERAGE_PACK_IDS["apollo-17"],
    )?.coverageKey,
    "apollo-17",
  );
  assert.equal(
    releaseCoverageApiPath(FOUNDATION_RELEASE_ID),
    `/api/v1/releases/${FOUNDATION_RELEASE_ID}/coverage`,
  );
  assert.equal(
    releaseCoveragePackApiPath(
      FOUNDATION_RELEASE_ID,
      FOUNDATION_COVERAGE_PACK_IDS["voyager-1"],
    ),
    `/api/v1/releases/${FOUNDATION_RELEASE_ID}/coverage/${FOUNDATION_COVERAGE_PACK_IDS["voyager-1"]}`,
  );
  assert.deepEqual(
    Object.fromEntries(
      COVERAGE_DIMENSION_ORDER.map((dimensionId) => [
        dimensionId,
        requireFoundationSet().packs.every((pack) =>
          pack.dimensions.some(
            (dimension) => dimension.dimensionId === dimensionId,
          ),
        ),
      ]),
    ),
    Object.fromEntries(COVERAGE_DIMENSION_ORDER.map((dimensionId) => [dimensionId, true])),
  );
  assert.equal(releaseCoverageScenePath("apollo-17"), "/worlds/moon");
  assert.equal(releaseCoverageScenePath("earth-network"), "/earth");
  assert.equal(releaseCoverageScenePath("mars-jezero"), "/worlds/mars");
  assert.equal(releaseCoverageScenePath("voyager-1"), "/missions/voyager-1");
});

test("Coverage Pack routes return 503 when their independent manifest pin drifts", async () => {
  const mutableManifest = foundationCoverageManifest as unknown as {
    coverageSet: { sha256: string };
  };
  const originalSha256 = mutableManifest.coverageSet.sha256;
  mutableManifest.coverageSet.sha256 = "0".repeat(64);
  try {
    const collection = await getCoverageCollection(
      new Request(
        `http://localhost/api/v1/releases/${FOUNDATION_RELEASE_ID}/coverage`,
      ),
      { params: Promise.resolve({ releaseId: FOUNDATION_RELEASE_ID }) },
    );
    assert.ok(collection);
    assert.equal(collection.status, 503);
    assert.equal(
      (await collection.json()).error.code,
      "coverage_integrity_failed",
    );
    assert.match(collection.headers.get("cache-control") ?? "", /no-store/);

    const detail = await getCoverageDetail(
      new Request(
        `http://localhost/api/v1/releases/${FOUNDATION_RELEASE_ID}/coverage/${FOUNDATION_COVERAGE_PACK_IDS["voyager-1"]}`,
      ),
      {
        params: Promise.resolve({
          releaseId: FOUNDATION_RELEASE_ID,
          packId: FOUNDATION_COVERAGE_PACK_IDS["voyager-1"],
        }),
      },
    );
    assert.ok(detail);
    assert.equal(detail.status, 503);
    assert.equal((await detail.json()).error.code, "coverage_integrity_failed");
    assert.match(detail.headers.get("cache-control") ?? "", /no-store/);
  } finally {
    mutableManifest.coverageSet.sha256 = originalSha256;
  }
  assert.doesNotThrow(() => assertCoverageManifestMatches(requireFoundationSet()));
});
