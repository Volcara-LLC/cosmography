import assert from "node:assert/strict";
import test from "node:test";

import {
  FrozenSurfaceProductManifestSchema,
  ReferenceOnlySurfaceProductSchema,
  SurfacePreIngestLedgerSchema,
  WithheldSurfaceCaptureContextSchema,
  calculateSurfaceProductManifestSha256,
  canUseSurfaceProductAtRuntime,
  reviewSurfaceProductSelection,
  verifySurfaceProductForRuntime,
  type FrozenSurfaceProductManifest,
  type ReviewedSurfaceProductSelection,
  type SurfaceProductEvidence,
} from "../src/surface-provenance";

const sha = (character: string) => character.repeat(64);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError("Expected an object fixture");
  return value;
}

function requireArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError("Expected an array fixture");
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
  if (value === undefined) throw new TypeError("Expected a non-empty fixture array");
  return value;
}

function second(array: unknown[]): unknown {
  const value = array[1];
  if (value === undefined) throw new TypeError("Expected at least two fixture entries");
  return value;
}

function assetRights(
  assetId: string,
  rightsId: string,
  termsDigest: string,
): Record<string, unknown> {
  return {
    rightsId,
    target: { kind: "asset", assetId },
    basis: {
      kind: "custom-terms",
      termsUrl: "https://astrogeology.usgs.gov/about/policies/",
      termsSnapshotSha256: termsDigest,
      summary: "Retained terms permit offline redistribution with credit.",
    },
    useProfile: {
      display: "allowed",
      redistribute: "allowed",
      modify: "prohibited",
      commercialUse: "unknown",
    },
    creator: "USGS Astrogeology Science Center",
    rightsHolder: "United States Geological Survey",
    creditLine: "USGS Astrogeology Science Center; NASA/JPL-Caltech",
    requiredNotices: ["Preserve the product citation and processing disclosure."],
    sourceTermsUrl: "https://astrogeology.usgs.gov/about/policies/",
    capturedAt: "2026-07-19T17:10:00Z",
    reviewStatus: "reviewed",
    reviewedBy: "surface-rights-reviewer",
    reviewedAt: "2026-07-19T17:15:00Z",
    reviewExpiresAt: "2027-07-19T17:15:00Z",
  };
}

const referenceOnlyProduct = {
  schemaVersion: "1.0.0",
  requirementId: "sreq_jezero_elevation",
  experienceId: "mars-jezero",
  body: "Mars",
  state: "reference-only-pending-artifact-review",
  title: "Jezero controlled elevation model",
  productKind: "elevation-model",
  intendedEvidenceClass: "scientific-reconstruction",
  authority: "USGS Astrogeology Science Center",
  sourceRelease: "2021-10-14 product release",
  officialRecordUrl: "https://astrogeology.usgs.gov/search/map/jezero-dem-v1",
  productIdentity: {
    state: "exact-record-identified",
    namespace: "usgs.product",
    identifier: "Mars_Jezero_CTX_DEM_Mosaic",
    version: "2021-10-14",
  },
  sourceReferenceIds: ["usgs-jezero-ctx"],
  requiredForEvidenceIds: ["jezero-ctx-elevation"],
  requiredForCaptureNodeIds: ["perseverance-landing-sol-4"],
  checkedAt: "2026-07-19T16:00:00Z",
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
  releaseEligible: false,
  blockedReasons: [
    "Exact retained product and label bytes have not passed artifact and rights review.",
  ],
} as const;

function frozenElevationTemplate(): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    surfaceProductId: "sprod_jezero_elevation_v1",
    requirementId: referenceOnlyProduct.requirementId,
    experienceId: referenceOnlyProduct.experienceId,
    body: "Mars",
    state: "frozen-artifact-reviewed",
    productKind: "elevation-model",
    productIdentity: {
      state: "exact-record-identified",
      namespace: "usgs.product",
      identifier: "Mars_Jezero_CTX_DEM_Mosaic",
      version: "2021-10-14",
    },
    title: "Jezero controlled elevation model",
    authority: "USGS Astrogeology Science Center",
    sourceRelease: "2021-10-14 product release",
    officialRecordUrl: "https://astrogeology.usgs.gov/search/map/jezero-dem-v1",
    sourceReferenceIds: ["usgs-jezero-ctx"],
    retrievedAt: "2026-07-19T17:00:00Z",
    admittedAt: "2026-07-19T17:30:00Z",
    intendedUse: {
      metadataDisplay: true,
      externalLink: true,
      embedBytes: true,
      redistribute: true,
      modify: false,
      commercialUse: false,
      offlinePackaging: true,
      derivativeGeneration: false,
    },
    representation: {
      evidenceClass: "scientific-reconstruction",
      appearanceClass: "colorized-scalar-measurement",
      geometryClass: "true-scale-within-stated-accuracy",
      timeState: "latest-published-estimate",
      aiInvolvement: { kind: "none-declared" },
      publicLabel: "Stereo-derived controlled elevation",
      uncertaintyDisclosure: "Horizontal and vertical accuracy remain product-specific.",
      processingDisclosure: "Photogrammetric stereo DEM localized to the declared Mars datum.",
    },
    assets: [
      {
        assetId: "asset_jezero_dem_primary",
        role: "primary-data",
        filename: "jezero_dem_v1.tif",
        sourceUrl: "https://astrogeology.usgs.gov/downloads/jezero_dem_v1.tif",
        mediaType: "image/tiff",
        byteLength: 12_345_678,
        sha256: sha("1"),
        immutableObjectKey: "surface/mars/jezero/jezero_dem_v1.tif",
        capturedAt: "2026-07-19T17:05:00Z",
        lineage: {
          kind: "source-original",
          sourceProductIdentifier: "Mars_Jezero_CTX_DEM_Mosaic",
        },
        rights: assetRights(
          "asset_jezero_dem_primary",
          "rgt_jezero_dem_primary",
          sha("a"),
        ),
      },
      {
        assetId: "asset_jezero_dem_label",
        role: "source-label",
        filename: "jezero_dem_v1.xml",
        sourceUrl: "https://astrogeology.usgs.gov/downloads/jezero_dem_v1.xml",
        mediaType: "application/xml",
        byteLength: 45_678,
        sha256: sha("2"),
        immutableObjectKey: "surface/mars/jezero/jezero_dem_v1.xml",
        capturedAt: "2026-07-19T17:06:00Z",
        lineage: {
          kind: "source-original",
          sourceProductIdentifier: "Mars_Jezero_CTX_DEM_Mosaic",
        },
        rights: assetRights(
          "asset_jezero_dem_label",
          "rgt_jezero_dem_label",
          sha("b"),
        ),
      },
      {
        assetId: "asset_jezero_projection_definition",
        role: "projection-definition",
        filename: "jezero_projection_v1.json",
        sourceUrl:
          "https://astrogeology.usgs.gov/downloads/jezero_projection_v1.json",
        mediaType: "application/json",
        byteLength: 2_048,
        sha256: sha("3"),
        immutableObjectKey:
          "surface/mars/jezero/jezero_projection_v1.json",
        capturedAt: "2026-07-19T17:07:00Z",
        lineage: {
          kind: "source-original",
          sourceProductIdentifier: "Mars_Jezero_CTX_DEM_Mosaic",
        },
        rights: assetRights(
          "asset_jezero_projection_definition",
          "rgt_jezero_projection_definition",
          sha("e"),
        ),
      },
    ],
    metadata: {
      domain: "cartographic",
      coordinateSystem: "planetocentric",
      longitudeDirection: "positive-east",
      longitudeDomain: "0-to-360",
      bodyFixedFrame: "IAU_MARS",
      projectionName: "Mars equirectangular, standard parallel 18 degrees north",
      projectionDefinitionSha256: sha("3"),
      horizontalDatum: "Mars 2000 sphere, source-defined radius",
      verticalDatum: {
        kind: "declared",
        name: "MOLA areoid-aligned source datum",
        unit: "metre",
        radiusOrReferenceDisclosure: "Vertical control follows the source product label.",
      },
      extent: {
        southLatitudeDegrees: 18,
        northLatitudeDegrees: 19,
        westLongitudeDegrees: 77,
        eastLongitudeDegrees: 78,
        crossesAntimeridian: false,
      },
      resolution: {
        x: 20,
        y: 20,
        unit: "metres-per-post",
        basis: "Pixel scale and map label retained with the product.",
      },
      horizontalAccuracy: {
        kind: "declared",
        metres: 15,
        basis: "Source control report.",
      },
      verticalAccuracy: {
        kind: "declared",
        metres: 10,
        basis: "Source stereo validation report.",
      },
      noData: {
        kind: "declared",
        values: [-32768],
        gapDisclosure: "No-data posts remain holes and are never filled silently.",
      },
      seamDisclosure: "Mosaic seams and edge confidence remain inspectable.",
      defaultElevationExaggeration: 1,
    },
    processing: {
      level: "stereo-derived",
      sourceProductIdentifiers: ["Mars_Jezero_CTX_DEM_Mosaic"],
      methodDisclosure: "Controlled stereo photogrammetry.",
      software: "USGS ISIS and source-declared stereo workflow",
      parametersDisclosure: "Exact parameters are retained in the source label and validation report.",
      processedAt: "2021-10-14T00:00:00Z",
    },
    validationReport: {
      validationId: "sval_jezero_elevation_v1",
      filename: "jezero_dem_validation.json",
      mediaType: "application/json",
      byteLength: 8_192,
      sha256: sha("4"),
      immutableObjectKey: "surface/mars/jezero/validation/jezero_dem_validation.json",
      generatedAt: "2026-07-19T17:20:00Z",
      capturedAt: "2026-07-19T17:21:00Z",
      validatorCodeCommit: "abc1234",
      status: "passed",
      inputAssetSha256s: [sha("1"), sha("2"), sha("3")],
      checks: [
        "asset-bytes",
        "source-label-binding",
        "rights",
        "processing-lineage",
        "spatial-reference",
        "coverage",
        "resolution-vs-accuracy",
        "nodata-and-gaps",
      ],
    },
    manifestCanonicalization: "cosmography-surface-product-json-v1",
    manifestSha256: sha("f"),
    runtimeUseAllowed: false,
    capturePlacementAllowed: false,
    releaseEligible: false,
  };
}

async function buildFrozenElevationManifest(): Promise<FrozenSurfaceProductManifest> {
  const manifest = frozenElevationTemplate();
  manifest.manifestSha256 = await calculateSurfaceProductManifestSha256(manifest);
  return FrozenSurfaceProductManifestSchema.parse(manifest);
}

async function reviewedSelectionFor(
  requirementInput: unknown,
  manifest: FrozenSurfaceProductManifest,
): Promise<ReviewedSurfaceProductSelection> {
  return reviewSurfaceProductSelection(
    requirementInput,
    {
      reviewedAt: "2026-07-19T16:30:00Z",
      reviewerId: "surface-selection-reviewer",
      approvalReference: "surface-selection-review-fixture",
      selectedProductIdentity: manifest.productIdentity,
      approvedIntendedUse: manifest.intendedUse,
    },
    () => true,
  );
}

function acceptedEvidenceReceipt(
  evidence: SurfaceProductEvidence,
  verifiedAt: string,
): unknown {
  if (evidence.kind === "surface-asset") {
    return {
      state: "surface-asset-bytes-verified",
      assetId: evidence.asset.assetId,
      byteLength: evidence.asset.byteLength,
      sha256: evidence.asset.sha256,
      immutableObjectKey: evidence.asset.immutableObjectKey,
      verifiedAt,
    };
  }
  return {
    state: "surface-validation-report-verified",
    validationId: evidence.report.validationId,
    filename: evidence.report.filename,
    byteLength: evidence.report.byteLength,
    sha256: evidence.report.sha256,
    immutableObjectKey: evidence.report.immutableObjectKey,
    verifiedAt,
    parsedPayload: structuredClone(evidence.expectedPayload),
  };
}

function frozenPanoramaTemplate(): Record<string, unknown> {
  const manifest = frozenElevationTemplate();
  manifest.surfaceProductId = "sprod_perseverance_panorama";
  manifest.requirementId = "sreq_perseverance_panorama";
  manifest.productKind = "panorama-derivative";
  manifest.productIdentity = {
    state: "exact-record-identified",
    namespace: "nasa.pds.lidvid",
    identifier: "urn:nasa:pds:mars2020_mastcamz:document:sol4-panorama",
    version: "1.0",
  };
  manifest.title = "Perseverance Sol 4 panorama";
  manifest.authority = "NASA/JPL-Caltech/ASU/MSSS";
  manifest.sourceRelease = "PIA23727 · Sol 4";
  manifest.officialRecordUrl =
    "https://www.jpl.nasa.gov/images/pia23727-perseverances-mastcam-z-first-high-resolution-panorama/";
  manifest.sourceReferenceIds = ["jpl-sol-4-panorama"];
  manifest.assets = [
    {
      assetId: "asset_sol4_panorama_primary",
      role: "primary-data",
      filename: "sol4_panorama.jpg",
      sourceUrl: "https://pds-imaging.jpl.nasa.gov/data/sol4_panorama.jpg",
      mediaType: "image/jpeg",
      byteLength: 5_000_000,
      sha256: sha("5"),
      immutableObjectKey: "surface/mars/jezero/sol4_panorama.jpg",
      capturedAt: "2026-07-19T17:05:00Z",
      lineage: {
        kind: "source-original",
        sourceProductIdentifier: "urn:nasa:pds:mars2020_mastcamz:document:sol4-panorama",
      },
      rights: assetRights(
        "asset_sol4_panorama_primary",
        "rgt_sol4_panorama_primary",
        sha("c"),
      ),
    },
    {
      assetId: "asset_sol4_panorama_label",
      role: "source-label",
      filename: "sol4_panorama.xml",
      sourceUrl: "https://pds-imaging.jpl.nasa.gov/data/sol4_panorama.xml",
      mediaType: "application/xml",
      byteLength: 50_000,
      sha256: sha("6"),
      immutableObjectKey: "surface/mars/jezero/sol4_panorama.xml",
      capturedAt: "2026-07-19T17:06:00Z",
      lineage: {
        kind: "source-original",
        sourceProductIdentifier: "urn:nasa:pds:mars2020_mastcamz:document:sol4-panorama",
      },
      rights: assetRights(
        "asset_sol4_panorama_label",
        "rgt_sol4_panorama_label",
        sha("d"),
      ),
    },
  ];
  manifest.metadata = {
    domain: "recorded-media",
    captureTime: {
      precision: "source-frame-specific",
      value: "Mars 2020 Sol 4 Mastcam-Z frame set",
      disclosure: "Each constituent still retains its own acquisition time.",
    },
    missionClock: "Sol 4; frame-specific acquisition times",
    instrument: "Mastcam-Z right eye",
    sourceFrameIds: ["NLEFT_SOL4_0001", "NLEFT_SOL4_0002"],
    dimensionsDisclosure: "Published stitch is 93,355 by 2,127 pixels.",
    colorTreatment: "Preliminary calibrated natural-color composite.",
    stitchDisclosure: "A documented stitch of discrete still frames; not continuous footage.",
    placementState: "withheld-until-capture-context-verified",
  };
  manifest.processing = {
    level: "stitched",
    sourceProductIdentifiers: [
      "urn:nasa:pds:mars2020_mastcamz:document:sol4-panorama",
      "NLEFT_SOL4_0001",
      "NLEFT_SOL4_0002",
    ],
    methodDisclosure: "Mission-produced still-frame panorama stitch.",
    software: "Source-declared mission pipeline",
    parametersDisclosure: "Constituent frame list and stitch metadata retained.",
    processedAt: "2021-02-23T00:00:00Z",
  };
  manifest.representation = {
    evidenceClass: "derived-result",
    appearanceClass: "approximate-natural-color",
    geometryClass: "not-to-scale",
    timeState: "observed-at-stated-time",
    aiInvolvement: { kind: "none-declared" },
    publicLabel: "Stitched recorded still panorama",
    uncertaintyDisclosure: "Camera placement remains withheld pending geometry validation.",
    processingDisclosure: "Discrete stills stitched into a panorama; no intermediate video frames.",
  };
  const validation = requireRecord(manifest.validationReport);
  validation.inputAssetSha256s = [sha("5"), sha("6")];
  validation.checks = [
    "asset-bytes",
    "source-label-binding",
    "rights",
    "processing-lineage",
    "capture-time-precision",
    "frame-inventory",
  ];
  return manifest;
}

const withheldCapture = {
  schemaVersion: "1.0.0",
  captureContextId: "cctx_perseverance_sol4",
  experienceId: "mars-jezero",
  captureNodeId: "perseverance-landing-sol-4",
  body: "Mars",
  state: "withheld-incomplete-surface-capture",
  reportedTime: {
    precision: "source-frame-specific",
    value: "Mars 2020 Sol 4 Mastcam-Z frame set",
    disclosure: "Exact acquisition time belongs to each source frame.",
  },
  missionClock: "Sol 4; frame-specific acquisition times",
  coordinate: {
    state: "approximate-display-anchor",
    latitudeDegrees: 18.4447,
    longitudeDegreesEast: 77.4508,
    frame: "IAU_MARS approximate landing-site display anchor",
    precisionDisclosure: "Not a solved optical-center pose.",
  },
  requiredProductRequirementIds: [
    "sreq_jezero_elevation",
    "sreq_perseverance_panorama",
  ],
  sourceReferenceIds: ["mars-places-release-15", "mars-camera-archive-sis"],
  continuousFootageAvailable: false,
  mediaRuntimeTokenAvailable: false,
  localizationRuntimeTokenAvailable: false,
  cameraCalibrationRuntimeTokenAvailable: false,
  opticalCenterAvailable: false,
  orientationAvailable: false,
  terrainFrameBindingAvailable: false,
  uncertaintyAvailable: false,
  renderableCameraPose: false,
  renderAllowed: false,
  releaseEligible: false,
  blockedReasons: [
    "Exact media, localization, camera calibration, terrain binding, and uncertainty tokens are unavailable.",
  ],
} as const;

const panoramaRequirement = {
  ...referenceOnlyProduct,
  requirementId: "sreq_perseverance_panorama",
  title: "Perseverance Sol 4 panorama",
  productKind: "panorama-derivative",
  intendedEvidenceClass: "derived-result",
  authority: "NASA/JPL-Caltech/ASU/MSSS",
  sourceRelease: "PIA23727 · Sol 4",
  officialRecordUrl:
    "https://www.jpl.nasa.gov/images/pia23727-perseverances-mastcam-z-first-high-resolution-panorama/",
  sourceReferenceIds: ["jpl-sol-4-panorama"],
  productIdentity: {
    state: "selection-pending",
    reason: "Resolve the exact PDS frame inventory and panorama product version.",
  },
  requiredForEvidenceIds: ["perseverance-recorded-panoramas"],
  requiredForCaptureNodeIds: ["perseverance-landing-sol-4"],
} as const;

const preIngestLedger = {
  schemaVersion: "1.0.0",
  experienceId: "mars-jezero",
  body: "Mars",
  verifiedAt: "2026-07-19T16:30:00Z",
  productRequirements: [referenceOnlyProduct, panoramaRequirement],
  captureContexts: [withheldCapture],
} as const;

test("reference-only products expose metadata and links but cannot launder bytes or runtime authority", () => {
  const record = ReferenceOnlySurfaceProductSchema.parse(referenceOnlyProduct);
  assert.equal(record.assetBytesPresent, false);
  assert.equal(record.renderAllowed, false);
  assert.equal(record.releaseEligible, false);
  assert.equal(canUseSurfaceProductAtRuntime(record, record.checkedAt), false);

  for (const mutation of [
    (value: unknown) => setField(recordField(value, "intendedUse"), "embedBytes", true),
    (value: unknown) => setField(value, "assetBytesPresent", true),
    (value: unknown) => setField(value, "renderAllowed", true),
    (value: unknown) => setField(value, "releaseEligible", true),
  ]) {
    const invalid: unknown = structuredClone(referenceOnlyProduct);
    mutation(invalid);
    assert.throws(() => ReferenceOnlySurfaceProductSchema.parse(invalid));
  }
});

test("surface product identity is exact, immutable, and never a mutable alias", () => {
  const mutableIdentity: unknown = structuredClone(referenceOnlyProduct);
  setField(recordField(mutableIdentity, "productIdentity"), "version", "latest");
  assert.throws(
    () => ReferenceOnlySurfaceProductSchema.parse(mutableIdentity),
    /mutable alias/,
  );

  const invalidNamespace: unknown = structuredClone(referenceOnlyProduct);
  setField(recordField(invalidNamespace, "productIdentity"), "namespace", "USGS product latest!");
  assert.throws(() => ReferenceOnlySurfaceProductSchema.parse(invalidNamespace));

  const controlCharacter: unknown = structuredClone(referenceOnlyProduct);
  setField(recordField(controlCharacter, "productIdentity"), "identifier", "product\nsubstitution");
  assert.throws(
    () => ReferenceOnlySurfaceProductSchema.parse(controlCharacter),
    /printable ASCII/,
  );
});

test("surface selection review is causal, independently authorized, and exact", async () => {
  const manifest = await buildFrozenElevationManifest();
  await assert.rejects(
    reviewSurfaceProductSelection(
      referenceOnlyProduct,
      {
        reviewedAt: "2026-07-19T15:59:59Z",
        reviewerId: "surface-selection-reviewer",
        approvalReference: "premature-review",
        selectedProductIdentity: manifest.productIdentity,
        approvedIntendedUse: manifest.intendedUse,
      },
      () => true,
    ),
    /cannot predate its source check/,
  );

  await assert.rejects(
    reviewSurfaceProductSelection(
      referenceOnlyProduct,
      {
        reviewedAt: "2026-07-19T16:30:00Z",
        reviewerId: "surface-selection-reviewer",
        approvalReference: "identity-substitution",
        selectedProductIdentity: {
          ...manifest.productIdentity,
          version: "substituted-version",
        },
        approvedIntendedUse: manifest.intendedUse,
      },
      () => true,
    ),
    /changed an already identified exact record/,
  );

  await assert.rejects(
    reviewSurfaceProductSelection(
      referenceOnlyProduct,
      {
        reviewedAt: "2026-07-19T16:30:00Z",
        reviewerId: "surface-selection-reviewer",
        approvalReference: "rejected-review",
        selectedProductIdentity: manifest.productIdentity,
        approvedIntendedUse: manifest.intendedUse,
      },
      () => false,
    ),
    /authorizer rejected/,
  );
});

test("frozen elevation manifest has a deterministic canonical digest and remains raw non-authority", async () => {
  const manifest = await buildFrozenElevationManifest();
  assert.equal(await calculateSurfaceProductManifestSha256(manifest), manifest.manifestSha256);
  assert.equal(manifest.runtimeUseAllowed, false);
  assert.equal(manifest.capturePlacementAllowed, false);
  assert.equal(manifest.releaseEligible, false);
  assert.equal(canUseSurfaceProductAtRuntime(manifest, manifest.admittedAt), false);

  const reordered = Object.fromEntries(Object.entries(manifest).reverse());
  assert.equal(
    await calculateSurfaceProductManifestSha256(reordered),
    manifest.manifestSha256,
  );
});

test("runtime use requires reviewed selection, exact receipts, and an issued WeakSet token", async () => {
  const manifest = await buildFrozenElevationManifest();
  const reviewedSelection = await reviewedSelectionFor(
    referenceOnlyProduct,
    manifest,
  );
  const seen: SurfaceProductEvidence[] = [];
  const token = await verifySurfaceProductForRuntime(
    manifest,
    reviewedSelection,
    manifest.admittedAt,
    (evidence) => {
      seen.push(evidence);
      assert.equal(Object.isFrozen(evidence), true);
      assert.deepEqual(
        evidence.productContext.productIdentity,
        manifest.productIdentity,
      );
      assert.equal(evidence.productContext.body, manifest.body);
      assert.equal(evidence.productContext.authority, manifest.authority);
      if (evidence.kind === "surface-validation-report") {
        assert.deepEqual(evidence.expectedPayload.metadata, manifest.metadata);
        assert.deepEqual(evidence.expectedPayload.assets, manifest.assets);
      }
      return acceptedEvidenceReceipt(evidence, manifest.admittedAt);
    },
  );

  assert.equal(seen.length, manifest.assets.length + 1);
  assert.equal(token.runtimeUseAllowed, true);
  assert.equal(token.capturePlacementAllowed, false);
  assert.equal(token.releaseEligible, false);
  assert.equal(Object.isFrozen(token.manifest.assets[0]), true);
  assert.equal(canUseSurfaceProductAtRuntime(token, manifest.admittedAt), true);
  assert.equal(
    canUseSurfaceProductAtRuntime(structuredClone(token), manifest.admittedAt),
    false,
  );
  assert.equal(canUseSurfaceProductAtRuntime(token, "2026-07-19T17:29:59Z"), false);
  assert.equal(canUseSurfaceProductAtRuntime(token, "2028-01-01T00:00:00Z"), false);

  await assert.rejects(
    verifySurfaceProductForRuntime(
      manifest,
      structuredClone(reviewedSelection),
      manifest.admittedAt,
      (evidence) => acceptedEvidenceReceipt(evidence, manifest.admittedAt),
    ),
    /in-process reviewed product selection/,
  );
});

test("verifier rejection and post-digest manifest tampering cannot issue a runtime token", async () => {
  const manifest = await buildFrozenElevationManifest();
  const reviewedSelection = await reviewedSelectionFor(
    referenceOnlyProduct,
    manifest,
  );
  await assert.rejects(
    verifySurfaceProductForRuntime(
      manifest,
      reviewedSelection,
      manifest.admittedAt,
      () => {
        throw new Error("Exact-byte evidence rejected");
      },
    ),
    /Exact-byte evidence rejected/,
  );

  const substitutedSelection: unknown = structuredClone(manifest);
  setField(substitutedSelection, "title", "Substituted elevation product");
  await assert.rejects(
    verifySurfaceProductForRuntime(
      substitutedSelection,
      reviewedSelection,
      manifest.admittedAt,
      () => ({}),
    ),
    /does not match its in-process reviewed requirement/,
  );

  const useDrift: unknown = structuredClone(manifest);
  setField(recordField(useDrift, "intendedUse"), "externalLink", false);
  await assert.rejects(
    verifySurfaceProductForRuntime(
      useDrift,
      reviewedSelection,
      manifest.admittedAt,
      () => ({}),
    ),
    /identity or intended use differs/,
  );

  const tampered: unknown = structuredClone(manifest);
  setField(recordField(tampered, "metadata"), "seamDisclosure", "Substituted seam claim");
  await assert.rejects(
    verifySurfaceProductForRuntime(
      tampered,
      reviewedSelection,
      manifest.admittedAt,
      () => ({}),
    ),
    /canonical manifest SHA-256/,
  );
});

test("runtime receipts must bind exact bytes, parsed validation, and evaluation time", async () => {
  const manifest = await buildFrozenElevationManifest();
  const reviewedSelection = await reviewedSelectionFor(
    referenceOnlyProduct,
    manifest,
  );

  await assert.rejects(
    verifySurfaceProductForRuntime(
      manifest,
      reviewedSelection,
      manifest.admittedAt,
      (evidence) => {
        const receipt = acceptedEvidenceReceipt(evidence, manifest.admittedAt);
        if (evidence.kind === "surface-asset") {
          setField(receipt, "sha256", sha("9"));
        }
        return receipt;
      },
    ),
    /drifted or non-causal receipt/,
  );

  await assert.rejects(
    verifySurfaceProductForRuntime(
      manifest,
      reviewedSelection,
      manifest.admittedAt,
      (evidence) => {
        const receipt = acceptedEvidenceReceipt(evidence, manifest.admittedAt);
        if (evidence.kind === "surface-validation-report") {
          setField(recordField(receipt, "parsedPayload"), "body", "Moon");
        }
        return receipt;
      },
    ),
    /drifted, failed, or non-causal report receipt/,
  );

  await assert.rejects(
    verifySurfaceProductForRuntime(
      manifest,
      reviewedSelection,
      manifest.admittedAt,
      (evidence) =>
        acceptedEvidenceReceipt(evidence, "2026-07-19T17:30:01Z"),
    ),
    /drifted or non-causal receipt/,
  );
});

test("asset rights are exact, reviewed, current, chronological, and sufficient for offline use", async () => {
  const manifest = await buildFrozenElevationManifest();

  const wrongTarget: unknown = structuredClone(manifest);
  setField(recordField(recordField(first(arrayField(wrongTarget, "assets")), "rights"), "target"), "assetId", "asset_foreign_product");
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(wrongTarget), /exact retained asset/);

  const unreviewed: unknown = structuredClone(manifest);
  setField(recordField(first(arrayField(unreviewed, "assets")), "rights"), "reviewStatus", "unreviewed");
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(unreviewed), /named, timestamped review/);

  const expired: unknown = structuredClone(manifest);
  setField(recordField(first(arrayField(expired, "assets")), "rights"), "reviewExpiresAt", manifest.admittedAt);
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(expired), /expired/);

  const reviewBeforeTerms: unknown = structuredClone(manifest);
  const chronologicalRights = recordField(first(arrayField(reviewBeforeTerms, "assets")), "rights");
  setField(chronologicalRights, "capturedAt", "2026-07-19T17:16:00Z");
  setField(chronologicalRights, "reviewedAt", "2026-07-19T17:15:00Z");
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(reviewBeforeTerms), /predates retained terms/);

  const lateReview: unknown = structuredClone(manifest);
  setField(recordField(first(arrayField(lateReview, "assets")), "rights"), "reviewedAt", "2026-07-19T17:31:00Z");
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(lateReview), /predates rights review/);

  const validationBeforeRightsReview: unknown = structuredClone(manifest);
  setField(
    recordField(
      first(arrayField(validationBeforeRightsReview, "assets")),
      "rights",
    ),
    "reviewedAt",
    "2026-07-19T17:20:30Z",
  );
  assert.throws(
    () => FrozenSurfaceProductManifestSchema.parse(validationBeforeRightsReview),
    /validation cannot predate.*rights review/i,
  );

  const redistributionDenied: unknown = structuredClone(manifest);
  setField(
    recordField(recordField(first(arrayField(redistributionDenied, "assets")), "rights"), "useProfile"),
    "redistribute",
    "prohibited",
  );
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(redistributionDenied), /byte delivery/);

  const modificationDenied: unknown = structuredClone(manifest);
  setField(recordField(modificationDenied, "intendedUse"), "modify", true);
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(modificationDenied), /modification/);
});

test("surface URLs, filenames, media extensions, and object keys fail closed", async () => {
  const manifest = await buildFrozenElevationManifest();
  const mutations: Array<(value: unknown) => void> = [
    (value) => setField(value, "officialRecordUrl", "http://astrogeology.usgs.gov/product"),
    (value) => setField(value, "officialRecordUrl", "https://user:pass@astrogeology.usgs.gov/product"),
    (value) => setField(value, "officialRecordUrl", "https://astrogeology.usgs.gov:8443/product"),
    (value) => setField(value, "officialRecordUrl", "https://astrogeology.usgs.gov/product?token=public"),
    (value) => setField(value, "officialRecordUrl", "https://astrogeology.usgs.gov/product#mutable-view"),
    (value) => setField(first(arrayField(value, "assets")), "sourceUrl", "http://example.test/dem.tif"),
    (value) => setField(first(arrayField(value, "assets")), "sourceUrl", "https://astrogeology.usgs.gov/downloads/other_dem.tif"),
    (value) => setField(recordField(first(arrayField(value, "assets")), "rights"), "sourceTermsUrl", "http://example.test/terms"),
    (value) => setField(first(arrayField(value, "assets")), "filename", "../dem.tif"),
    (value) => setField(first(arrayField(value, "assets")), "filename", "dem_latest.tif"),
    (value) => setField(first(arrayField(value, "assets")), "filename", "CON.tif"),
    (value) => setField(first(arrayField(value, "assets")), "filename", "dem.tif."),
    (value) => setField(first(arrayField(value, "assets")), "filename", "payload.exe"),
    (value) => setField(first(arrayField(value, "assets")), "filename", "dem.jpg"),
    (value) => setField(first(arrayField(value, "assets")), "immutableObjectKey", "surface/mars/../dem.tif"),
    (value) => setField(first(arrayField(value, "assets")), "immutableObjectKey", "surface/mars/jezero/other.tif"),
  ];
  for (const mutate of mutations) {
    const invalid: unknown = structuredClone(manifest);
    mutate(invalid);
    assert.throws(() => FrozenSurfaceProductManifestSchema.parse(invalid));
  }
});

test("primary data, exact source label, and validation input digests stay bound", async () => {
  const manifest = await buildFrozenElevationManifest();

  const noPrimary: unknown = structuredClone(manifest);
  setField(first(arrayField(noPrimary, "assets")), "role", "metadata");
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(noPrimary), /primary data asset/);

  const noLabel: unknown = structuredClone(manifest);
  setField(second(arrayField(noLabel, "assets")), "role", "metadata");
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(noLabel), /source-label asset/);

  const synthesizedLabel: unknown = structuredClone(manifest);
  setField(second(arrayField(synthesizedLabel, "assets")), "lineage", {
    kind: "derived",
    parentAssetIds: [
      field(first(arrayField(synthesizedLabel, "assets")), "assetId"),
    ],
    transformation: "Synthetic label generation",
    software: "fixture 1.0",
    createdAt: "2026-07-19T17:05:30Z",
  });
  assert.throws(
    () => FrozenSurfaceProductManifestSchema.parse(synthesizedLabel),
    /exact source label must include source-original assets/,
  );

  const missingInput: unknown = structuredClone(manifest);
  setField(recordField(missingInput, "validationReport"), "inputAssetSha256s", [sha("1")]);
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(missingInput), /every retained surface asset digest/);

  const driftedSourceIdentity: unknown = structuredClone(manifest);
  setField(recordField(first(arrayField(driftedSourceIdentity, "assets")), "lineage"), "sourceProductIdentifier", "unrelated-product");
  assert.throws(
    () => FrozenSurfaceProductManifestSchema.parse(driftedSourceIdentity),
    /source product identity|source-label|exact product/i,
  );

  const driftedProcessingIdentity: unknown = structuredClone(manifest);
  setField(
    recordField(driftedProcessingIdentity, "processing"),
    "sourceProductIdentifiers",
    ["unrelated-product"],
  );
  assert.throws(
    () => FrozenSurfaceProductManifestSchema.parse(driftedProcessingIdentity),
    /exact source product identity/i,
  );
});

test("frozen asset IDs, filenames, object keys, rights IDs, and source references are unique", async () => {
  const manifest = await buildFrozenElevationManifest();
  const cases: Array<(value: unknown) => void> = [
    (value) => setField(second(arrayField(value, "assets")), "assetId", field(first(arrayField(value, "assets")), "assetId")),
    (value) => setField(second(arrayField(value, "assets")), "filename", field(first(arrayField(value, "assets")), "filename")),
    (value) => setField(second(arrayField(value, "assets")), "immutableObjectKey", field(first(arrayField(value, "assets")), "immutableObjectKey")),
    (value) => setField(recordField(second(arrayField(value, "assets")), "rights"), "rightsId", field(recordField(first(arrayField(value, "assets")), "rights"), "rightsId")),
    (value) => setField(second(arrayField(value, "assets")), "sha256", field(first(arrayField(value, "assets")), "sha256")),
    (value) => setField(value, "sourceReferenceIds", ["usgs-jezero-ctx", "usgs-jezero-ctx"]),
    (value) => setField(recordField(value, "validationReport"), "immutableObjectKey", field(first(arrayField(value, "assets")), "immutableObjectKey")),
  ];
  for (const mutate of cases) {
    const invalid: unknown = structuredClone(manifest);
    mutate(invalid);
    assert.throws(() => FrozenSurfaceProductManifestSchema.parse(invalid));
  }
});

test("validation reports bind all inputs, required checks, unique checks, and causal time", async () => {
  const manifest = await buildFrozenElevationManifest();
  const cases: Array<{ mutate: (value: unknown) => void; pattern: RegExp }> = [
    {
      mutate: (value) =>
        setField(recordField(value, "validationReport"), "status", "failed"),
      pattern: /Invalid input/,
    },
    {
      mutate: (value) => setField(recordField(value, "validationReport"), "checks", [
        "asset-bytes",
        "source-label-binding",
        "rights",
        "processing-lineage",
        "spatial-reference",
        "coverage",
        "nodata-and-gaps",
      ]),
      pattern: /resolution-vs-accuracy/,
    },
    {
      mutate: (value) => {
        const checks = arrayField(recordField(value, "validationReport"), "checks");
        checks.push(checks[0]);
      },
      pattern: /must be unique/,
    },
    {
      mutate: (value) => setField(recordField(value, "validationReport"), "inputAssetSha256s", [sha("1"), sha("1")]),
      pattern: /input digests must be unique|every retained surface asset digest/,
    },
    {
      mutate: (value) => setField(recordField(value, "validationReport"), "generatedAt", "2026-07-19T17:04:00Z"),
      pattern: /cannot predate retained asset inputs/,
    },
    {
      mutate: (value) => {
        setField(recordField(value, "validationReport"), "generatedAt", "2026-07-19T17:22:00Z");
        setField(recordField(value, "validationReport"), "capturedAt", "2026-07-19T17:21:00Z");
      },
      pattern: /cannot be retained before it is generated/,
    },
    {
      mutate: (value) => setField(value, "admittedAt", "2026-07-19T17:20:30Z"),
      pattern: /cannot predate its validation report/,
    },
  ];
  for (const { mutate, pattern } of cases) {
    const invalid: unknown = structuredClone(manifest);
    mutate(invalid);
    assert.throws(() => FrozenSurfaceProductManifestSchema.parse(invalid), pattern);
  }
});

test("planetary cartography rejects Earth CRS leakage, invalid longitude/extents, and hidden elevation transforms", async () => {
  const manifest = await buildFrozenElevationManifest();
  const cases: Array<(metadata: Record<string, unknown>) => void> = [
    (metadata) => setField(metadata, "horizontalDatum", "WGS84 / EPSG:4326"),
    (metadata) => setField(metadata, "projectionName", "Web Mercator EPSG:3857"),
    (metadata) => {
      setField(metadata, "bodyFixedFrame", "IAU_MOON");
      setField(metadata, "horizontalDatum", "Moon 2000 sphere");
      setField(metadata, "projectionName", "Moon equirectangular");
    },
    (metadata) => setField(recordField(metadata, "extent"), "eastLongitudeDegrees", 361),
    (metadata) => setField(recordField(metadata, "extent"), "southLatitudeDegrees", 20),
    (metadata) => setField(recordField(metadata, "extent"), "crossesAntimeridian", true),
    (metadata) => setField(recordField(metadata, "resolution"), "unit", "metres-per-pixel"),
    (metadata) => setField(recordField(metadata, "noData"), "values", []),
    (metadata) => setField(metadata, "verticalDatum", { kind: "not-applicable", reason: "Unknown" }),
    (metadata) => setField(metadata, "defaultElevationExaggeration", 2),
  ];
  for (const mutateMetadata of cases) {
    const invalid: unknown = structuredClone(manifest);
    mutateMetadata(recordField(invalid, "metadata"));
    assert.throws(() => FrozenSurfaceProductManifestSchema.parse(invalid));
  }

  const missingProjectionDefinition: unknown = structuredClone(manifest);
  const projectionAsset = arrayField(missingProjectionDefinition, "assets").find(
    (asset) => field(asset, "role") === "projection-definition",
  );
  assert.ok(projectionAsset);
  setField(projectionAsset, "role", "metadata");
  assert.throws(
    () => FrozenSurfaceProductManifestSchema.parse(missingProjectionDefinition),
    /projection-definition asset/,
  );
});

test("generative surface output cannot masquerade as scientific reconstruction", async () => {
  const manifest = await buildFrozenElevationManifest();
  const generative: unknown = structuredClone(manifest);
  setField(recordField(generative, "representation"), "aiInvolvement", {
    kind: "generative-output",
    tool: "fixture-generator",
    modelVersion: "1.0",
    processDisclosure: "Synthetic terrain generation fixture.",
    promptDisclosure: "Generate a plausible terrain.",
    humanReview: "Fixture review only.",
  });
  assert.throws(
    () => FrozenSurfaceProductManifestSchema.parse(generative),
    /must be labeled artist interpretation/,
  );
});

test("derivative lineage rejects missing/self parents, cycles, and impossible chronology", async () => {
  const manifest = await buildFrozenElevationManifest();

  const missingParent: unknown = structuredClone(manifest);
  setField(first(arrayField(missingParent, "assets")), "lineage", {
    kind: "derived",
    parentAssetIds: ["asset_missing_parent"],
    transformation: "Synthetic transform",
    software: "fixture 1.0",
    createdAt: "2026-07-19T17:05:00Z",
  });
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(missingParent), /distinct retained parent/);

  const selfParent: unknown = structuredClone(manifest);
  const firstId = field(first(arrayField(selfParent, "assets")), "assetId");
  setField(first(arrayField(selfParent, "assets")), "lineage", {
    kind: "derived",
    parentAssetIds: [firstId],
    transformation: "Self transform",
    software: "fixture 1.0",
    createdAt: "2026-07-19T17:05:00Z",
  });
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(selfParent), /distinct retained parent/);

  const cycle: unknown = structuredClone(manifest);
  const cycleAssets = arrayField(cycle, "assets");
  setField(first(cycleAssets), "capturedAt", "2026-07-19T17:07:00Z");
  setField(second(cycleAssets), "capturedAt", "2026-07-19T17:07:00Z");
  setField(first(cycleAssets), "lineage", {
    kind: "derived",
    parentAssetIds: [field(second(cycleAssets), "assetId")],
    transformation: "Cycle A",
    software: "fixture 1.0",
    createdAt: "2026-07-19T17:07:00Z",
  });
  setField(second(cycleAssets), "lineage", {
    kind: "derived",
    parentAssetIds: [field(first(cycleAssets), "assetId")],
    transformation: "Cycle B",
    software: "fixture 1.0",
    createdAt: "2026-07-19T17:07:00Z",
  });
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(cycle), /cannot contain a cycle/);

  const prematureCreation: unknown = structuredClone(manifest);
  setField(first(arrayField(prematureCreation, "assets")), "lineage", {
    kind: "derived",
    parentAssetIds: [field(second(arrayField(prematureCreation, "assets")), "assetId")],
    transformation: "Derived before parent retention",
    software: "fixture 1.0",
    createdAt: "2026-07-19T17:05:30Z",
  });
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(prematureCreation), /cannot predate a retained parent/);

  const retainedBeforeCreation: unknown = structuredClone(manifest);
  setField(first(arrayField(retainedBeforeCreation, "assets")), "lineage", {
    kind: "derived",
    parentAssetIds: [field(second(arrayField(retainedBeforeCreation, "assets")), "assetId")],
    transformation: "Late transform",
    software: "fixture 1.0",
    createdAt: "2026-07-19T17:06:30Z",
  });
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(retainedBeforeCreation), /cannot be retained before it is created/);

  const processingAfterRetrieval: unknown = structuredClone(manifest);
  setField(
    recordField(processingAfterRetrieval, "processing"),
    "processedAt",
    "2026-07-19T17:00:01Z",
  );
  assert.throws(
    () => FrozenSurfaceProductManifestSchema.parse(processingAfterRetrieval),
    /cannot postdate product retrieval/,
  );
});

test("recorded media preserves the frame inventory and cannot masquerade as continuous footage", () => {
  const panorama = frozenPanoramaTemplate();
  assert.doesNotThrow(() => FrozenSurfaceProductManifestSchema.parse(panorama));

  const noStitch: unknown = structuredClone(panorama);
  deleteField(recordField(noStitch, "metadata"), "stitchDisclosure");
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(noStitch), /stitch disclosure/);

  const duplicateFrames: unknown = structuredClone(panorama);
  setField(recordField(duplicateFrames, "metadata"), "sourceFrameIds", ["FRAME_A", "FRAME_A"]);
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(duplicateFrames), /must be unique/);

  const observedLaundering: unknown = structuredClone(panorama);
  setField(recordField(observedLaundering, "representation"), "evidenceClass", "direct-observation");
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(observedLaundering), /cannot masquerade as observed pixels/);

  const inventedVideo: unknown = structuredClone(panorama);
  setField(inventedVideo, "productKind", "video");
  setField(recordField(inventedVideo, "metadata"), "continuousFootageAvailable", true);
  assert.throws(() => FrozenSurfaceProductManifestSchema.parse(inventedVideo));
});

test("withheld capture contexts keep time and coordinates approximate and every authority flag false", () => {
  const capture = WithheldSurfaceCaptureContextSchema.parse(withheldCapture);
  assert.equal(capture.continuousFootageAvailable, false);
  assert.equal(capture.renderableCameraPose, false);
  assert.equal(capture.renderAllowed, false);

  for (const flag of [
    "continuousFootageAvailable",
    "mediaRuntimeTokenAvailable",
    "localizationRuntimeTokenAvailable",
    "cameraCalibrationRuntimeTokenAvailable",
    "opticalCenterAvailable",
    "orientationAvailable",
    "terrainFrameBindingAvailable",
    "uncertaintyAvailable",
    "renderableCameraPose",
    "renderAllowed",
    "releaseEligible",
  ]) {
    const invalid: unknown = structuredClone(withheldCapture);
    setField(invalid, flag, true);
    assert.throws(() => WithheldSurfaceCaptureContextSchema.parse(invalid));
  }

  const invalidDate: unknown = structuredClone(withheldCapture);
  setField(invalidDate, "reportedTime", { precision: "date", value: "2021-02-31" });
  assert.throws(() => WithheldSurfaceCaptureContextSchema.parse(invalidDate));

  const invalidCoordinate: unknown = structuredClone(withheldCapture);
  setField(recordField(invalidCoordinate, "coordinate"), "latitudeDegrees", 91);
  assert.throws(() => WithheldSurfaceCaptureContextSchema.parse(invalidCoordinate));

  const duplicateRequirements: unknown = structuredClone(withheldCapture);
  setField(duplicateRequirements, "requiredProductRequirementIds", [
    "sreq_jezero_elevation",
    "sreq_jezero_elevation",
  ]);
  assert.throws(() => WithheldSurfaceCaptureContextSchema.parse(duplicateRequirements), /must be unique/);
});

test("pre-ingest ledger rejects duplicate, dangling, cross-body, cross-experience, and stale records", () => {
  assert.doesNotThrow(() => SurfacePreIngestLedgerSchema.parse(preIngestLedger));

  const duplicateRequirement: unknown = structuredClone(preIngestLedger);
  setField(second(arrayField(duplicateRequirement, "productRequirements")), "requirementId", referenceOnlyProduct.requirementId);
  assert.throws(() => SurfacePreIngestLedgerSchema.parse(duplicateRequirement), /identities must be unique/);

  const duplicateCapture: unknown = structuredClone(preIngestLedger);
  arrayField(duplicateCapture, "captureContexts").push(structuredClone(withheldCapture));
  assert.throws(() => SurfacePreIngestLedgerSchema.parse(duplicateCapture), /identities must be unique/);

  const dangling: unknown = structuredClone(preIngestLedger);
  setField(first(arrayField(dangling, "captureContexts")), "requiredProductRequirementIds", ["sreq_unknown_surface_product"]);
  assert.throws(() => SurfacePreIngestLedgerSchema.parse(dangling), /unknown product requirement/);

  const oneWayDependency: unknown = structuredClone(preIngestLedger);
  setField(
    first(arrayField(oneWayDependency, "captureContexts")),
    "requiredProductRequirementIds",
    ["sreq_jezero_elevation"],
  );
  assert.throws(
    () => SurfacePreIngestLedgerSchema.parse(oneWayDependency),
    /dependencies must be reciprocal/,
  );

  const crossBodyRequirement: unknown = structuredClone(preIngestLedger);
  setField(first(arrayField(crossBodyRequirement, "productRequirements")), "body", "Moon");
  assert.throws(() => SurfacePreIngestLedgerSchema.parse(crossBodyRequirement), /does not belong to its ledger/);

  const crossBodyCapture: unknown = structuredClone(preIngestLedger);
  setField(first(arrayField(crossBodyCapture, "captureContexts")), "body", "Moon");
  assert.throws(() => SurfacePreIngestLedgerSchema.parse(crossBodyCapture), /does not belong to its ledger/);

  const crossExperience: unknown = structuredClone(preIngestLedger);
  setField(first(arrayField(crossExperience, "captureContexts")), "experienceId", "moon-apollo17");
  assert.throws(() => SurfacePreIngestLedgerSchema.parse(crossExperience), /does not belong to its ledger/);

  const stale: unknown = structuredClone(preIngestLedger);
  setField(stale, "verifiedAt", "2026-07-19T15:59:59Z");
  assert.throws(() => SurfacePreIngestLedgerSchema.parse(stale), /cannot predate source checks/);
});
