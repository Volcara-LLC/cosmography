import assert from "node:assert/strict";
import test from "node:test";

import {
  ArtifactIntentSchema,
  HORIZONS_DOCUMENTATION_VERSION,
  HORIZONS_OBSERVED_SIGNATURE_VERSION,
  HorizonsIntentSchema,
  IngestionReceiptSchema,
  PayloadDestinationSchema,
  SafeHeadersSchema,
  TapIntentSchema,
  assertManifestIntegrity,
  buildSortedForm,
  buildSortedUrl,
  compileConnectorIntent,
  connectorAdapters,
  deterministicExampleManifests,
  getConnectorAdapter,
  parseIngestionReceiptForManifest,
  sourcePassports,
  stableStringify,
} from "../src/index";

const requiredSourceIds = new Set([
  "naif-spice",
  "jpl-horizons",
  "nasa-pds4",
  "esa-psa",
  "jaxa-darts",
  "isro-issdc",
  "esa-gaia-tap",
  "cds-simbad-tap",
  "cds-vizier-tap",
  "stsci-mast",
  "nasa-exoplanet-archive",
  "nasa-ned",
  "unoosa-space-object-register",
  "rubin-dp1",
]);

const r2Context = {
  frozenAt: "2026-07-19T10:00:00Z",
  releaseLabel: "unit-test-release",
  cursorIn: { kind: "none" as const },
  destination: {
    payloadClass: "bulk-science" as const,
    payloadStore: "r2" as const,
    controlPointerStore: "d1" as const,
    objectKey: "tests/source/payload.bin",
  },
};

test("registry covers every requested source with one adapter", () => {
  assert.deepEqual(
    new Set(sourcePassports.map((passport) => passport.sourceId)),
    requiredSourceIds,
  );
  assert.equal(connectorAdapters.size, requiredSourceIds.size);
  for (const sourceId of requiredSourceIds) {
    assert.equal(getConnectorAdapter(sourceId).sourceId, sourceId);
  }
});

test("every passport freezes the checked date, rights, quota, retry, kill switch, and no-bulk-D1 rule", () => {
  for (const passport of sourcePassports) {
    assert.equal(passport.checkedOn, "2026-07-19");
    assert.equal(passport.storage.controlPlaneStore, "d1");
    assert.equal(passport.storage.bulkScienceDataInD1, false);
    assert.equal(passport.quota.prohibitUnboundedQueries, true);
    assert.ok(passport.retry.maxAttempts >= 1);
    assert.match(passport.killSwitch.envKey, /^COSMOGRAPHY_SOURCE_/);
    assert.ok(passport.rights.termsUrl.startsWith("https://"));
    assert.ok(passport.documentation.length > 0);
    for (const document of passport.documentation) {
      assert.ok(document.url.startsWith("https://"));
    }
  }
});

test("restricted, manual, and scheduled connectors cannot default on", () => {
  for (const passport of sourcePassports) {
    if (
      ["access-restricted", "manual-only", "scheduled"].includes(
        passport.lifecycle,
      )
    ) {
      assert.equal(passport.killSwitch.defaultEnabled, false);
    }
  }
});

test("Rubin is optional, DP1-only, rights-gated, and disabled pending explicit authorization", () => {
  const rubin = getConnectorAdapter("rubin-dp1").passport;
  assert.equal(rubin.registryTier, "optional");
  assert.equal(rubin.auth.dataRightsRequired, true);
  assert.equal(rubin.killSwitch.defaultEnabled, false);
  assert.equal(rubin.releaseState[0]?.label, "DP1");
  assert.equal(rubin.releaseState[0]?.state, "preview");
  assert.equal(rubin.releaseState[1]?.label, "Early Data Preview 2");
  assert.equal(rubin.releaseState[1]?.state, "scheduled");
});

test("bulk payload destinations reject D1 while small control metadata may use it", () => {
  assert.equal(
    PayloadDestinationSchema.safeParse({
      payloadClass: "bulk-science",
      payloadStore: "d1",
      controlPointerStore: "d1",
    }).success,
    false,
  );
  assert.equal(
    PayloadDestinationSchema.safeParse({
      payloadClass: "control-metadata",
      payloadStore: "d1",
      controlPointerStore: "d1",
    }).success,
    true,
  );
});

test("frozen manifests cannot contain secrets", () => {
  assert.equal(
    SafeHeadersSchema.safeParse({ Authorization: "Bearer secret" }).success,
    false,
  );
  assert.equal(
    SafeHeadersSchema.safeParse({ cookie: "session=secret" }).success,
    false,
  );
  assert.equal(SafeHeadersSchema.safeParse({ accept: "application/json" }).success, true);
});

test("example manifests are deterministic and pass both checksums", () => {
  for (const manifest of deterministicExampleManifests) {
    assertManifestIntegrity(manifest);
    assert.equal(Object.isFrozen(manifest), true);
    assert.equal(Object.isFrozen(manifest.request), true);
    assert.equal(
      stableStringify(manifest),
      stableStringify(JSON.parse(stableStringify(manifest))),
    );
  }
});

test("a request change is detected while its recorded checksum is retained", () => {
  const tampered = structuredClone(deterministicExampleManifests[0]);
  if (tampered.request.kind !== "http") {
    throw new Error("Expected the Horizons example to be HTTP");
  }
  tampered.request.url = tampered.request.url.replace("499", "599");
  assert.throws(
    () => assertManifestIntegrity(tampered),
    /request checksum does not match/,
  );
});

test("canonical query builders sort keys but preserve ordered array values", () => {
  const expectedOrder = ["priority:desc", "timestamp:asc"];
  const url = new URL(
    buildSortedUrl("https://example.test/search?z=last", {
      sort: expectedOrder,
      alpha: "first",
    }),
  );
  assert.deepEqual(url.searchParams.getAll("sort"), expectedOrder);
  assert.deepEqual([...url.searchParams.keys()], ["alpha", "sort", "sort", "z"]);

  const form = new URLSearchParams(
    buildSortedForm({ sort: expectedOrder, alpha: "first" }),
  );
  assert.deepEqual(form.getAll("sort"), expectedOrder);
  assert.deepEqual([...form.keys()], ["alpha", "sort", "sort"]);
});

test("Horizons freezes the observed signature separately from documentation version", () => {
  assert.equal(HORIZONS_DOCUMENTATION_VERSION, "1.3");
  assert.equal(HORIZONS_OBSERVED_SIGNATURE_VERSION, "1.2");
  assert.notEqual(
    HORIZONS_DOCUMENTATION_VERSION,
    HORIZONS_OBSERVED_SIGNATURE_VERSION,
  );

  const horizons = getConnectorAdapter("jpl-horizons").passport;
  assert.equal(horizons.releaseState[0]?.label, "documentation-api-1.3");
  assert.equal(
    horizons.releaseState[1]?.label,
    "observed-response-signature-1.2",
  );

  const manifest = deterministicExampleManifests[0];
  assert.equal(manifest.intent.expectedSignatureVersion, "1.2");
});

test("Horizons vector intents require explicit frame, time, units, corrections, and table", () => {
  const incomplete = {
    kind: "horizons",
    sourceId: "jpl-horizons",
    expectedSignatureVersion: "1.2",
    parameters: {
      COMMAND: "'499'",
      EPHEM_TYPE: "'VECTORS'",
    },
  };
  const result = HorizonsIntentSchema.safeParse(incomplete);
  assert.equal(result.success, false);
  if (!result.success) {
    const missing = new Set(
      result.error.issues.map((issue) => String(issue.path.at(-1))),
    );
    for (const field of [
      "REF_PLANE",
      "REF_SYSTEM",
      "TIME_TYPE",
      "OUT_UNITS",
      "VEC_CORR",
      "VEC_TABLE",
    ]) {
      assert.equal(missing.has(field), true);
    }
  }

  assert.equal(
    HorizonsIntentSchema.safeParse({
      ...incomplete,
      expectedSignatureVersion: "1.3",
      parameters: {
        ...incomplete.parameters,
        REF_PLANE: "'ECLIPTIC'",
        REF_SYSTEM: "'ICRF'",
        TIME_TYPE: "'TDB'",
        OUT_UNITS: "'AU-D'",
        VEC_CORR: "'NONE'",
        VEC_TABLE: "'2'",
      },
    }).success,
    false,
  );

  const manifest = deterministicExampleManifests[0];
  assert.equal(manifest.request.kind, "http");
  if (manifest.request.kind === "http") {
    const parameters = new URL(manifest.request.url).searchParams;
    assert.equal(parameters.get("REF_PLANE"), "'ECLIPTIC'");
    assert.equal(parameters.get("REF_SYSTEM"), "'ICRF'");
    assert.equal(parameters.get("TIME_TYPE"), "'TDB'");
    assert.equal(parameters.get("OUT_UNITS"), "'AU-D'");
    assert.equal(parameters.get("VEC_CORR"), "'NONE'");
    assert.equal(parameters.get("VEC_TABLE"), "'2'");
  }
});

test("ingestion receipts are accepted only when bound to their manifest", () => {
  const expectedResponseSha256 = "a".repeat(64);
  const manifest = compileConnectorIntent(
    {
      kind: "http-artifact",
      sourceId: "naif-spice",
      url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/test.bsp",
      expectedMediaTypes: ["application/octet-stream"],
      expectedSha256: expectedResponseSha256,
    },
    r2Context,
  );
  const receipt = {
    manifestId: manifest.manifestId,
    sourceId: manifest.sourceId,
    startedAt: "2026-07-19T10:00:01Z",
    completedAt: "2026-07-19T10:00:02Z",
    status: "succeeded",
    responseChecksum: {
      algorithm: "sha256",
      value: expectedResponseSha256,
      scope: "response-bytes",
    },
    byteLength: 1024,
    payloadPointer: {
      store: "r2",
      keyOrUrl: r2Context.destination.objectKey,
    },
  };

  const parsed = parseIngestionReceiptForManifest(manifest, receipt);
  assert.equal(parsed.manifestId, manifest.manifestId);
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.payloadPointer), true);

  assert.equal(
    IngestionReceiptSchema.safeParse({
      ...receipt,
      responseChecksum: { ...receipt.responseChecksum, scope: "request" },
    }).success,
    false,
  );
  assert.equal(
    IngestionReceiptSchema.safeParse({
      ...receipt,
      completedAt: "2026-07-19T10:00:00Z",
    }).success,
    false,
  );
  assert.equal(
    IngestionReceiptSchema.safeParse({
      manifestId: receipt.manifestId,
      sourceId: receipt.sourceId,
      startedAt: receipt.startedAt,
      completedAt: receipt.completedAt,
      status: "empty",
    }).success,
    false,
  );

  assert.throws(
    () =>
      parseIngestionReceiptForManifest(manifest, {
        ...receipt,
        manifestId: `frm_${"b".repeat(24)}`,
      }),
    /manifestId does not match/,
  );
  assert.throws(
    () =>
      parseIngestionReceiptForManifest(manifest, {
        ...receipt,
        sourceId: "jpl-horizons",
      }),
    /sourceId does not match/,
  );
  assert.throws(
    () =>
      parseIngestionReceiptForManifest(manifest, {
        ...receipt,
        startedAt: "2026-07-19T09:59:59Z",
      }),
    /cannot start before/,
  );
  assert.throws(
    () =>
      parseIngestionReceiptForManifest(manifest, {
        ...receipt,
        responseChecksum: {
          ...receipt.responseChecksum,
          value: "c".repeat(64),
        },
      }),
    /checksum does not match/,
  );
  assert.throws(
    () =>
      parseIngestionReceiptForManifest(manifest, {
        ...receipt,
        payloadPointer: {
          store: "external-authority",
          keyOrUrl: r2Context.destination.objectKey,
        },
      }),
    /payload store does not match/,
  );
  assert.throws(
    () =>
      parseIngestionReceiptForManifest(manifest, {
        ...receipt,
        payloadPointer: {
          store: "r2",
          keyOrUrl: "tests/source/a-different-payload.bin",
        },
      }),
    /payload pointer does not match/,
  );
  const { payloadPointer: _pointer, ...withoutPointer } = receipt;
  assert.throws(
    () => parseIngestionReceiptForManifest(manifest, withoutPointer),
    /require a pointer/,
  );
});

test("TAP intents are read-only and explicitly bounded", () => {
  assert.equal(
    TapIntentSchema.safeParse({
      kind: "tap",
      sourceId: "esa-gaia-tap",
      adql: "DELETE FROM gaiadr3.gaia_source",
      execution: "sync",
      format: "csv",
      maxRecords: 10,
    }).success,
    false,
  );
  assert.equal(
    TapIntentSchema.safeParse({
      kind: "tap",
      sourceId: "esa-gaia-tap",
      adql: "SELECT TOP 10 source_id FROM gaiadr3.gaia_source",
      execution: "sync",
      format: "csv",
    }).success,
    false,
  );
});

test("ESA PSA compiles through its current TAP+ endpoint, not retired PDAP", () => {
  const manifest = compileConnectorIntent(
    {
      kind: "tap",
      sourceId: "esa-psa",
      adql: "SELECT TOP 5 * FROM tap_schema.tables",
      execution: "sync",
      format: "votable",
      maxRecords: 5,
    },
    r2Context,
  );
  assert.equal(manifest.request.kind, "http");
  if (manifest.request.kind === "http") {
    assert.equal(manifest.request.method, "POST");
    assert.match(manifest.request.url, /^https:\/\/psa\.esa\.int\/psa-tap\/tap\/sync$/);
    assert.doesNotMatch(manifest.request.url, /pdap/i);
  }
});

test("artifact adapters enforce source host and path allowlists", () => {
  assert.equal(
    ArtifactIntentSchema.safeParse({
      kind: "http-artifact",
      sourceId: "naif-spice",
      url: "https://example.com/pub/naif/generic_kernels/test.bsp",
      expectedMediaTypes: ["application/octet-stream"],
    }).success,
    true,
  );
  assert.throws(
    () =>
      compileConnectorIntent(
        {
          kind: "http-artifact",
          sourceId: "naif-spice",
          url: "https://example.com/pub/naif/generic_kernels/test.bsp",
          expectedMediaTypes: ["application/octet-stream"],
        },
        r2Context,
      ),
    /outside the connector allowlist/,
  );
  assert.throws(
    () =>
      compileConnectorIntent(
        {
          kind: "http-artifact",
          sourceId: "naif-spice",
          url: "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/test.bsp",
          expectedMediaTypes: ["*/*"],
        },
        r2Context,
      ),
    /unconstrained wildcard/,
  );
});

test("PDS search freezes cursor pagination into a sorted read-only URL", () => {
  const manifest = deterministicExampleManifests[1];
  assert.equal(manifest.sourceId, "nasa-pds4");
  assert.equal(manifest.request.kind, "http");
  if (manifest.request.kind === "http") {
    assert.equal(manifest.request.method, "GET");
    const url = new URL(manifest.request.url);
    assert.equal(url.searchParams.get("limit"), "500");
    assert.equal(
      url.searchParams.get("search-after"),
      "2026-07-18T00:00:00Z",
    );
  }
});

test("NED connector targets the current 2026 NED::API instead of a legacy endpoint", () => {
  const manifest = compileConnectorIntent(
    {
      kind: "ned-rest",
      sourceId: "nasa-ned",
      operation: "OverviewOfObject",
      parameters: { TARGET: "M31" },
      maxRecords: 10,
    },
    r2Context,
  );
  assert.equal(manifest.request.kind, "http");
  if (manifest.request.kind === "http") {
    assert.match(manifest.request.url, /\/NED::API\/OverviewOfObject/);
    assert.doesNotMatch(manifest.request.url, /\/tap\//);
    assert.equal(new URL(manifest.request.url).searchParams.has("MAXREC"), false);
  }
});

test("ISSDC and UNOOSA compile auditable manual reviews instead of undocumented scrapers", () => {
  for (const sourceId of [
    "isro-issdc",
    "unoosa-space-object-register",
  ] as const) {
    const manifest = compileConnectorIntent(
      {
        kind: "manual-review",
        sourceId,
        snapshotLabel: "reviewed-test-snapshot",
        instructions: "Human verifies the official release index and records exact document links.",
        expectedCapture:
          sourceId === "isro-issdc" ? "account-export" : "document-index",
      },
      {
        frozenAt: "2026-07-19T10:00:00Z",
        releaseLabel: "reviewed-test-snapshot",
        cursorIn: { kind: "release", label: "prior-review" },
        destination: {
          payloadClass: "control-metadata",
          payloadStore: "d1",
          controlPointerStore: "d1",
        },
      },
    );
    assert.equal(manifest.request.kind, "manual");
  }
});

test("MAST invoke requests freeze service pagination without credentials", () => {
  const manifest = compileConnectorIntent(
    {
      kind: "mast-invoke",
      sourceId: "stsci-mast",
      service: "Mast.Caom.Filtered",
      params: {
        columns: "obsid,obs_collection,dataproduct_type",
        filters: [{ paramName: "obs_collection", values: ["JWST"] }],
      },
      page: 1,
      pageSize: 100,
    },
    r2Context,
  );
  assertManifestIntegrity(manifest);
  assert.equal(manifest.request.kind, "http");
  if (manifest.request.kind === "http") {
    assert.equal(manifest.request.method, "POST");
    assert.equal(manifest.request.auth.mode, "none");
    assert.ok(!Object.keys(manifest.request.headers).includes("Authorization"));
  }
});

test("MAST connector also compiles bounded CAOM TAP requests", () => {
  const manifest = compileConnectorIntent(
    {
      kind: "tap",
      sourceId: "stsci-mast",
      adql: "SELECT TOP 25 obsid, obs_collection FROM ivoa.obscore",
      execution: "sync",
      format: "csv",
      maxRecords: 25,
    },
    r2Context,
  );
  assertManifestIntegrity(manifest);
  assert.equal(manifest.request.kind, "http");
  if (manifest.request.kind === "http") {
    assert.match(
      manifest.request.url,
      /^https:\/\/mast\.stsci\.edu\/vo-tap\/api\/v0\.1\/caom\/sync$/,
    );
    assert.match(manifest.request.body ?? "", /MAXREC=25/);
  }
});
