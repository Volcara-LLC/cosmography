import assert from "node:assert/strict";
import test from "node:test";

import {
  AssertionValueSchema,
  EntityIdSchema,
  RELEASE_CANONICALIZATION,
  ReleasePublicationPreflightSchema,
  PublishableRepresentationSchema,
  PublishableTravelDefinitionSchema,
  RightsStatementSchema,
  RouteDefinitionSchema,
  ScientificIntervalSchema,
  canPublishAsset,
  assertVerifiedReleaseEnvelopeSignature,
  stableJsonSha256,
} from "../src/index";

const sha256 = "a".repeat(64);

test("opaque IDs are kind-branded at runtime", () => {
  assert.equal(EntityIdSchema.safeParse("ent_mars001").success, true);
  assert.equal(EntityIdSchema.safeParse("src_mars001").success, false);
  assert.equal(EntityIdSchema.safeParse("Mars").success, false);
});

test("assertion values are exclusive strict variants", () => {
  assert.equal(
    AssertionValueSchema.safeParse({
      valueKind: "quantity",
      value: 1,
      unit: "au",
      semanticQuantity: "orbital semi-major axis",
      uncertainty: { kind: "symmetric", plusMinus: 0.001 },
    }).success,
    true,
  );

  const mixedVariant = AssertionValueSchema.safeParse({
    valueKind: "quantity",
    value: 1,
    unit: "au",
    semanticQuantity: "orbital semi-major axis",
    uncertainty: { kind: "not-provided", reason: "Source omitted it" },
    code: "terrestrial-planet",
  });
  assert.equal(mixedVariant.success, false);
});

test("scientific intervals reject reversed endpoints in one scale", () => {
  const interval = ScientificIntervalSchema.safeParse({
    kind: "interval",
    start: {
      kind: "julian-instant",
      dayNumber: 2_460_001,
      dayFraction: 0.5,
      scale: "TDB",
    },
    end: {
      kind: "julian-instant",
      dayNumber: 2_460_000,
      dayFraction: 0.5,
      scale: "TDB",
    },
  });
  assert.equal(interval.success, false);
});

test("publication rejects generative imagery presented as observation", () => {
  const result = PublishableRepresentationSchema.safeParse({
    representationId: "rep_marsview",
    entityId: "ent_mars001",
    componentPath: "surface.sky",
    kind: "image",
    label: {
      evidenceClass: "direct-observation",
      timeState: "timeless-conceptual",
      appearanceClass: "artist-texture",
      geometryClass: "not-to-scale",
      aiInvolvement: {
        kind: "generative-output",
        tool: "example-model",
        modelVersion: "1",
        processDisclosure: "Text-to-image generation",
        promptDisclosure: "Prompt retained with activity record",
        humanReview: "Editorial visual review",
      },
      publicLabel: "Direct observation",
      uncertaintyDisclosure: "Not observationally constrained",
      sourceIds: ["src_marsdata"],
    },
    assetIds: ["asset_marsview"],
    rightsStatementIds: ["rgt_marsview"],
  });
  assert.equal(result.success, false);
  assert.match(
    result.error?.issues.map((issue) => issue.message).join(" ") ?? "",
    /artist interpretation/i,
  );
});

test("publication accepts a source-backed, rights-backed representation", () => {
  const result = PublishableRepresentationSchema.safeParse({
    representationId: "rep_marsview",
    entityId: "ent_mars001",
    componentPath: "surface.camera.raw-frame",
    kind: "image",
    label: {
      evidenceClass: "calibrated-observation",
      timeState: "observed-at-stated-time",
      appearanceClass: "calibrated-radiometric",
      geometryClass: "true-scale-within-stated-accuracy",
      aiInvolvement: { kind: "none-declared" },
      publicLabel: "Calibrated rover observation",
      uncertaintyDisclosure: "Calibration uncertainty is in the source product",
      sourceIds: ["src_marsdata"],
    },
    assetIds: ["asset_marsview"],
    rightsStatementIds: ["rgt_marsview"],
  });
  assert.equal(result.success, true);
});

test("warp and map jumps cannot masquerade as scientific travel", () => {
  const badRoute = RouteDefinitionSchema.safeParse({
    routeId: "route_mars001",
    originId: "ent_earth01",
    destinationId: "ent_mars001",
    travel: {
      domain: "fictional",
      mechanism: "warp",
      scientificClaim: false,
      gameplayLightYearsPerSecond: 2,
      publicLabel: "Fictional warp",
      disclaimer: "A fictional travel mode for exploration gameplay.",
    },
    duration: {
      kind: "scientific-duration",
      seconds: 1,
      uncertaintySeconds: 0,
    },
  });
  assert.equal(badRoute.success, false);

  const mislabeledWarp = PublishableTravelDefinitionSchema.safeParse({
    domain: "fictional",
    mechanism: "warp",
    scientificClaim: false,
    gameplayLightYearsPerSecond: 2,
    publicLabel: "Hyperdrive",
    disclaimer: "A fictional travel mode for exploration gameplay.",
  });
  assert.equal(mislabeledWarp.success, false);
});

test("rights checks fail closed for unknown commercial use", () => {
  const statement = RightsStatementSchema.parse({
    rightsId: "rgt_marsview",
    target: { kind: "asset", assetId: "asset_marsview" },
    basis: {
      kind: "custom-terms",
      termsUrl: "https://example.test/terms",
      termsSnapshotSha256: sha256,
      summary: "Display allowed with attribution; other uses need review.",
    },
    useProfile: {
      display: "allowed",
      redistribute: "allowed",
      modify: "unknown",
      commercialUse: "unknown",
    },
    creditLine: "Example Observatory",
    capturedAt: "2026-07-19T10:00:00Z",
    reviewStatus: "reviewed",
    reviewedBy: "rights-reviewer",
    reviewedAt: "2026-07-19T11:00:00Z",
  });

  const decision = canPublishAsset(statement, {
    commercial: true,
    redistribute: true,
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(" "), /commercial/i);
});

test("release publication preflight requires passed validators and a verifiable signature", () => {
  const base = {
    releaseId: "rel_atlas001",
    schemaVersion: "0.1.0",
    contentVersion: "landing-atlas-v0.1.0",
    stage: "published",
    createdAt: "2026-07-19T10:00:00Z",
    publishedAt: "2026-07-19T11:00:00Z",
    producer: "Cosmography",
    codeCommit: "abc1234",
    sourceSnapshots: [
      {
        sourceId: "src_gaia_dr3",
        authorityVersion: "Gaia DR3",
        retrievedAt: "2026-07-19T09:00:00Z",
        requestOrManifestSha256: sha256,
      },
    ],
    content: [
      {
        storage: "r2",
        objectKey: "releases/rel_atlas001/manifest.json",
        sha256,
        byteLength: 1024,
        mediaType: "application/json",
      },
    ],
    validation: [
      {
        validator: "scientific-model",
        validatorVersion: "0.1.0",
        status: "passed",
      },
    ],
    compatibility: {
      minimumClientVersion: "0.1.0",
      apiVersion: "0.1.0",
    },
  } as const;

  assert.equal(ReleasePublicationPreflightSchema.safeParse(base).success, false);
  const structurallySigned = {
      ...base,
      signature: {
        algorithm: "Ed25519",
        keyId: "release-key-2026-01",
        canonicalization: RELEASE_CANONICALIZATION,
        signatureBase64: "ZXhhbXBsZQ==",
      },
    } as const;
  assert.equal(
    ReleasePublicationPreflightSchema.safeParse(structurallySigned).success,
    true,
  );
  assert.throws(() =>
    assertVerifiedReleaseEnvelopeSignature(
      structurallySigned,
      { verify: () => false },
      "2026-07-19T11:01:00Z",
    ),
  );
  assert.throws(
    () =>
      assertVerifiedReleaseEnvelopeSignature(
        structurallySigned,
        { verify: () => true },
        "2026-07-19T10:59:59Z",
      ),
    /predates the release state/i,
  );
  assert.doesNotThrow(() =>
    assertVerifiedReleaseEnvelopeSignature(
      structurallySigned,
      {
        verify: ({ payload, payloadSha256, signature, checkedAt }) =>
          payloadSha256 ===
            stableJsonSha256(JSON.parse(payload) as unknown) &&
          signature.keyId === "release-key-2026-01" &&
          checkedAt === "2026-07-19T11:01:00Z",
      },
      "2026-07-19T11:01:00Z",
    ),
  );
  assert.equal(
    ReleasePublicationPreflightSchema.safeParse({
      ...structurallySigned,
      validation: [
        {
          validator: "scientific-model",
          validatorVersion: "0.1.0",
          status: "waived",
          waiverReason: "Not sufficient for publication.",
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    ReleasePublicationPreflightSchema.safeParse({
      ...structurallySigned,
      publishedAt: "2026-07-19T09:59:59Z",
    }).success,
    false,
  );
});
