import assert from "node:assert/strict";
import test from "node:test";

import {
  ReferenceOnlySurfaceProductSchema,
  canUseSurfaceProductAtRuntime,
  type ReferenceOnlySurfaceProduct,
} from "@cosmography/scientific-model/surface-provenance";

import {
  SURFACE_QUARANTINE_MAX_ARTIFACT_BYTES,
  SURFACE_QUARANTINE_MAX_LABEL_BYTES,
  SURFACE_QUARANTINE_MAX_TOTAL_BYTES,
  SurfaceCandidateInspectionReportSchema,
  SurfaceLabelInspectionBindingSchema,
  SurfaceQuarantineExactUrlSchema,
  SurfaceQuarantineObjectSchema,
  SurfaceQuarantineProposalSchema,
  assertSurfaceCandidateInspectionReportIntegrity,
  assertSurfaceLabelParserPayloadIntegrity,
  assertSurfaceQuarantineCaptureReceiptIntegrity,
  assertSurfaceQuarantineProposalIntegrity,
  createSurfaceLabelParserPayload,
  createSurfaceQuarantineProposal,
  quarantineAndInspectSurfaceCandidate,
  sha256Hex,
  stableStringify,
  type SurfaceCandidateInspectionReport,
  type SurfaceFixtureByteSource,
  type SurfaceImmutableQuarantineReader,
  type SurfaceImmutableQuarantineStore,
  type SurfaceLabelParser,
  type SurfaceQuarantineArtifact,
  type SurfaceQuarantineClock,
  type SurfaceQuarantineDependencies,
  type SurfaceQuarantineObject,
  type SurfaceQuarantineProposal,
} from "../src/index";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const frozenAt = "2026-07-19T18:00:00Z";
const exactIdentity = {
  state: "exact-record-identified" as const,
  namespace: "PDS4-LIDVID",
  identifier: "urn:nasa:pds:cosmography_test:mars_ortho",
  version: "1.0",
};

const reference = ReferenceOnlySurfaceProductSchema.parse({
  schemaVersion: "1.0.0",
  requirementId: "sreq_mars_ortho_fixture",
  experienceId: "mars-jezero",
  body: "Mars",
  state: "reference-only-pending-artifact-review",
  title: "Synthetic Mars orthomosaic contract fixture",
  productKind: "orthomosaic",
  intendedEvidenceClass: "scientific-reconstruction",
  authority: "Synthetic contract fixture only",
  sourceRelease: "synthetic-fixture-1.0",
  officialRecordUrl: "https://example.test/records/mars-ortho-1.0",
  productIdentity: exactIdentity,
  sourceReferenceIds: ["synthetic-mars-source"],
  requiredForEvidenceIds: ["synthetic-mars-ortho-evidence"],
  requiredForCaptureNodeIds: [],
  checkedAt: "2026-07-19T17:00:00Z",
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
  blockedReasons: ["Synthetic candidate has not passed any review gate."],
});

const fixtureBytes = {
  sart_label_mars: encoder.encode(
    "<?xml version=\"1.0\"?><Product_Observational><logical_identifier>urn:nasa:pds:cosmography_test:mars_ortho</logical_identifier></Product_Observational>",
  ),
  sart_primary_mars: Uint8Array.from([
    0x49,
    0x49,
    0x2a,
    0x00,
    ...encoder.encode("synthetic-mars-orthomosaic-fixture"),
  ]),
  sart_projection_mars: encoder.encode(
    "BODY=MARS;FRAME=IAU_MARS;PROJECTION=EQUIRECTANGULAR",
  ),
} as const;

type FixtureArtifactId = keyof typeof fixtureBytes;

function artifact(
  artifactId: FixtureArtifactId,
  role: SurfaceQuarantineArtifact["role"],
  filename: string,
  mediaType: SurfaceQuarantineArtifact["mediaType"],
  pairedArtifactIds: readonly string[],
  bytes: Uint8Array = fixtureBytes[artifactId],
): SurfaceQuarantineArtifact {
  return {
    artifactId,
    role,
    filename,
    sourceUrl: `https://example.test/products/${filename}`,
    mediaType,
    byteLength: bytes.byteLength,
    sha256: sha256Hex(bytes),
    pairedArtifactIds: [...pairedArtifactIds],
  };
}

function baseArtifacts(): SurfaceQuarantineArtifact[] {
  return [
    artifact(
      "sart_label_mars",
      "source-label",
      "mars+ortho.xml",
      "application/xml",
      ["sart_primary_mars"],
    ),
    artifact(
      "sart_primary_mars",
      "primary-data",
      "mars+ortho.tif",
      "image/tiff",
      ["sart_label_mars"],
    ),
    artifact(
      "sart_projection_mars",
      "projection-definition",
      "mars+ortho-projection.txt",
      "text/plain",
      [],
    ),
  ];
}

function proposalFor(
  artifacts: readonly unknown[] = baseArtifacts(),
  referenceValue: unknown = reference,
  candidateProductIdentity: unknown = exactIdentity,
): SurfaceQuarantineProposal {
  return createSurfaceQuarantineProposal({
    reference: referenceValue,
    candidateProductIdentity,
    frozenAt,
    artifacts,
  });
}

interface HarnessOptions {
  readonly bytes?: ReadonlyMap<string, Uint8Array>;
  readonly sourceTransform?: (
    artifact: Readonly<SurfaceQuarantineArtifact>,
    bytes: Uint8Array,
  ) => Uint8Array;
  readonly storeMode?: "normal" | "drift-key" | "unsafe-key" | "collision";
  readonly replayTransform?: (
    object: Readonly<SurfaceQuarantineObject>,
    bytes: Uint8Array,
  ) => Uint8Array;
  readonly parserTransform?: (
    input: Parameters<SurfaceLabelParser["inspect"]>[0],
    payload: ReturnType<typeof createSurfaceLabelParserPayload>,
  ) => unknown;
  readonly rejectDtd?: boolean;
  readonly times?: readonly string[];
}

function createHarness(
  bytes: ReadonlyMap<string, Uint8Array>,
  options: HarnessOptions = {},
): {
  readonly dependencies: SurfaceQuarantineDependencies;
  readonly puts: Array<{
    key: string;
    bytes: Uint8Array;
    contentType: string;
    sha256: string;
    ifAbsent: true;
  }>;
  readonly reads: string[];
  readonly stored: Map<string, Uint8Array>;
} {
  const selectedBytes = options.bytes ?? bytes;
  const puts: Array<{
    key: string;
    bytes: Uint8Array;
    contentType: string;
    sha256: string;
    ifAbsent: true;
  }> = [];
  const reads: string[] = [];
  const stored = new Map<string, Uint8Array>();

  const source: SurfaceFixtureByteSource = {
    async read(_proposal, candidateArtifact) {
      const value = selectedBytes.get(candidateArtifact.artifactId);
      if (!value) throw new Error("Synthetic source fixture is missing bytes");
      const clone = value.slice();
      return options.sourceTransform?.(candidateArtifact, clone) ?? clone;
    },
  };
  const store: SurfaceImmutableQuarantineStore = {
    async put(input) {
      puts.push({ ...input, bytes: input.bytes.slice() });
      if (options.storeMode === "collision") {
        throw new Error("immutable key collision");
      }
      stored.set(input.key, input.bytes.slice());
      return {
        store: "r2",
        namespace: "quarantine/surface",
        key:
          options.storeMode === "drift-key"
            ? `${input.key}-drift`
            : options.storeMode === "unsafe-key"
              ? "quarantine/surface/mars/../escaped-object"
              : input.key,
        contentType: input.contentType,
        byteLength: input.bytes.byteLength,
        checksum: {
          algorithm: "sha256",
          value: input.sha256,
          scope: "surface-artifact-bytes",
        },
        immutable: true,
      };
    },
  };
  const reader: SurfaceImmutableQuarantineReader = {
    async read(object) {
      reads.push(object.key);
      const value = stored.get(object.key);
      if (!value) throw new Error("Synthetic quarantine object is missing");
      const clone = value.slice();
      return options.replayTransform?.(object, clone) ?? clone;
    },
  };
  const parser: SurfaceLabelParser = {
    parserId: "synthetic-pds4-label-parser",
    parserVersion: "1.0.0",
    parserCodeCommit: "abcdef1",
    async inspect(input) {
      if (options.rejectDtd && /<!DOCTYPE/i.test(decoder.decode(input.labelBytes))) {
        throw new Error("DTD declarations are disabled");
      }
      const payload = createSurfaceLabelParserPayload({
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        parserCodeCommit: this.parserCodeCommit,
        binding: input.expectedBinding,
      });
      return options.parserTransform?.(input, payload) ?? payload;
    },
  };
  const times = options.times ?? [
    "2026-07-19T18:01:00Z",
    "2026-07-19T18:02:00Z",
    "2026-07-19T18:03:00Z",
    "2026-07-19T18:04:00Z",
  ];
  let timeIndex = 0;
  const clock: SurfaceQuarantineClock = {
    now() {
      const value = times[Math.min(timeIndex, times.length - 1)];
      timeIndex += 1;
      if (!value) throw new Error("Synthetic clock has no values");
      return value;
    },
  };
  return {
    dependencies: { source, store, reader, parser, clock },
    puts,
    reads,
    stored,
  };
}

function byteMap(
  entries: Readonly<Record<string, Uint8Array>> = fixtureBytes,
): Map<string, Uint8Array> {
  return new Map(Object.entries(entries).map(([id, bytes]) => [id, bytes.slice()]));
}

function recomputeParserPayload(payload: Record<string, unknown>): void {
  const { payloadChecksum: _checksum, ...unsigned } = payload;
  const checksum = payload.payloadChecksum as Record<string, unknown>;
  checksum.value = sha256Hex(stableStringify(unsigned));
}

function recomputeReport(report: Record<string, unknown>): void {
  const proposalChecksum = report.proposalChecksum;
  const captures = report.captures as Array<Record<string, unknown>>;
  const inspections = report.labelInspections as Array<Record<string, unknown>>;
  const identity = {
    proposalId: report.proposalId,
    proposalChecksum,
    inspectedAt: report.inspectedAt,
    captureChecksums: captures.map(({ captureChecksum }) => captureChecksum),
    parserPayloadChecksums: inspections.map(
      ({ payloadChecksum }) => payloadChecksum,
    ),
  };
  report.reportId = `sqins_${sha256Hex(stableStringify(identity)).slice(0, 24)}`;
  const { reportChecksum: _checksum, ...unsigned } = report;
  const checksum = report.reportChecksum as Record<string, unknown>;
  checksum.value = sha256Hex(stableStringify(unsigned));
}

const authorityFlags = [
  "selectionReviewed",
  "selectionAuthorized",
  "artifactVerificationAllowed",
  "rightsReviewed",
  "scientificValidationPassed",
  "scienceValidated",
  "runtimeUseAllowed",
  "renderAllowed",
  "capturePlacementAllowed",
  "releaseEligible",
  "publicationAllowed",
  "activationAllowed",
  "sourceAuthenticityVerified",
  "dependencyProvenanceAttested",
  "ambientNetworkFetchPerformedByModule",
] as const;

test("surface proposals are deterministic, deeply frozen, and use code-unit ordering", () => {
  const weirdBytes = {
    "sart_a-aaaaaa": fixtureBytes.sart_label_mars,
    sart_a0aaaaaa: fixtureBytes.sart_primary_mars,
    sart_a_aaaaaa: fixtureBytes.sart_projection_mars,
  };
  const artifacts = [
    artifact(
      "sart_projection_mars",
      "projection-definition",
      "projection.txt",
      "text/plain",
      [],
      weirdBytes.sart_a_aaaaaa,
    ),
    artifact(
      "sart_primary_mars",
      "primary-data",
      "data+v1.tif",
      "image/tiff",
      ["sart_label_mars"],
      weirdBytes.sart_a0aaaaaa,
    ),
    artifact(
      "sart_label_mars",
      "source-label",
      "data+v1.xml",
      "application/xml",
      ["sart_primary_mars"],
      weirdBytes["sart_a-aaaaaa"],
    ),
  ].map((value, index) => ({
    ...value,
    artifactId: ["sart_a_aaaaaa", "sart_a0aaaaaa", "sart_a-aaaaaa"][index],
    pairedArtifactIds:
      index === 0
        ? []
        : index === 1
          ? ["sart_a-aaaaaa"]
          : ["sart_a0aaaaaa"],
  }));
  const first = proposalFor(artifacts);
  const second = proposalFor([...artifacts].reverse());
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.artifacts.map(({ artifactId }) => artifactId),
    ["sart_a-aaaaaa", "sart_a0aaaaaa", "sart_a_aaaaaa"],
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.reference), true);
  assert.equal(Object.isFrozen(first.artifacts), true);
  assert.equal(Object.isFrozen(first.artifacts[0]), true);
  assert.doesNotThrow(() => assertSurfaceQuarantineProposalIntegrity(first));
});

test("exact references reject identity substitution and pending references remain non-authoritative", () => {
  assert.throws(
    () => proposalFor(baseArtifacts(), reference, { ...exactIdentity, version: "2.0" }),
    /candidate identity differs/i,
  );
  const pendingReference: ReferenceOnlySurfaceProduct = {
    ...reference,
    productIdentity: {
      state: "selection-pending",
      reason: "Exact product selection has not been reviewed.",
    },
  };
  assert.throws(
    () =>
      proposalFor(baseArtifacts(), pendingReference, {
        ...exactIdentity,
        identifier: ` ${exactIdentity.identifier}`,
      }),
    /invalid input/i,
  );
  assert.throws(
    () =>
      proposalFor(baseArtifacts(), pendingReference, {
        ...exactIdentity,
        version: `${exactIdentity.version} `,
      }),
    /invalid input/i,
  );
  const pending = proposalFor(baseArtifacts(), pendingReference, exactIdentity);
  for (const flag of authorityFlags) assert.equal(pending[flag], false);
  assert.equal(pending.fixtureContractOnly, true);
});

test("unsafe candidate descriptors and incomplete cartographic relationships fail closed", () => {
  const mutate = (
    index: number,
    change: Partial<SurfaceQuarantineArtifact>,
  ): SurfaceQuarantineArtifact[] => {
    const artifacts = baseArtifacts();
    artifacts[index] = { ...artifacts[index]!, ...change };
    return artifacts;
  };
  const cases: readonly unknown[][] = [
    mutate(0, {
      sourceUrl: "https://example.test/products/mars+ortho.xml?mutable=1",
    }),
    mutate(0, {
      filename: "unsafe..xml",
      sourceUrl: "https://example.test/products/unsafe..xml",
    }),
    mutate(1, {
      filename: "mars+ortho.png",
      sourceUrl: "https://example.test/products/mars+ortho.png",
    }),
    mutate(0, {
      filename: "mars+ortho.png",
      sourceUrl: "https://example.test/products/mars+ortho.png",
      mediaType: "image/png",
    }),
    mutate(1, { pairedArtifactIds: [] }),
    baseArtifacts().slice(0, 2),
  ];
  for (const artifacts of cases) {
    assert.throws(() => proposalFor(artifacts));
  }
});

test("descriptor byte ceilings reject oversized fixtures without allocating their bytes", () => {
  const oversizedGeneral = baseArtifacts();
  oversizedGeneral[1] = {
    ...oversizedGeneral[1]!,
    byteLength: SURFACE_QUARANTINE_MAX_ARTIFACT_BYTES + 1,
  };
  assert.throws(() => proposalFor(oversizedGeneral), /byte limit/i);

  const oversizedLabel = baseArtifacts();
  oversizedLabel[0] = {
    ...oversizedLabel[0]!,
    byteLength: SURFACE_QUARANTINE_MAX_LABEL_BYTES + 1,
  };
  assert.throws(() => proposalFor(oversizedLabel), /byte limit/i);

  const aggregate = baseArtifacts().map((value) => ({ ...value }));
  aggregate[0]!.byteLength = SURFACE_QUARANTINE_MAX_LABEL_BYTES;
  aggregate[1]!.byteLength = SURFACE_QUARANTINE_MAX_ARTIFACT_BYTES;
  aggregate[2]!.byteLength = SURFACE_QUARANTINE_MAX_ARTIFACT_BYTES;
  assert.ok(
    aggregate.reduce((total, value) => total + value.byteLength, 0) >
      SURFACE_QUARANTINE_MAX_TOTAL_BYTES,
  );
  assert.throws(() => proposalFor(aggregate), /aggregate byte limit/i);
});

test("synthetic exact bytes quarantine, replay, and bind a non-authoritative label report", async () => {
  const proposal = proposalFor();
  const bytes = byteMap();
  const harness = createHarness(bytes);
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  let fetchCalls = 0;
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: (async () => {
      fetchCalls += 1;
      throw new Error("ambient fetch is unavailable in surface tests");
    }) as typeof fetch,
  });
  let report: SurfaceCandidateInspectionReport;
  try {
    report = await quarantineAndInspectSurfaceCandidate(
      proposal,
      harness.dependencies,
    );
  } finally {
    if (originalFetch) {
      Object.defineProperty(globalThis, "fetch", originalFetch);
    } else {
      Reflect.deleteProperty(globalThis, "fetch");
    }
  }

  assert.equal(fetchCalls, 0);
  assert.equal(report.state, "machine-inspected-needs-selection-and-rights-review");
  assert.equal(report.fixtureContractOnly, true);
  assert.equal(report.captures.length, 3);
  assert.equal(report.labelInspections.length, 1);
  assert.equal(harness.puts.length, 3);
  assert.equal(harness.reads.length, 3);
  assert.equal(harness.puts.every(({ ifAbsent }) => ifAbsent), true);
  assert.equal(
    harness.puts.every(({ key }) => key.startsWith("quarantine/surface/")),
    true,
  );
  assert.equal(harness.puts.some(({ key }) => key.includes("mars+ortho")), true);
  for (const capture of report.captures) {
    const expected = bytes.get(capture.artifactId);
    assert.ok(expected);
    assert.equal(capture.byteLength, expected.byteLength);
    assert.equal(capture.sha256, sha256Hex(expected));
    assert.deepEqual(harness.stored.get(capture.object.key), expected);
    assert.doesNotThrow(() =>
      assertSurfaceQuarantineCaptureReceiptIntegrity(proposal, capture),
    );
  }
  for (const payload of report.labelInspections) {
    assert.doesNotThrow(() => assertSurfaceLabelParserPayloadIntegrity(payload));
  }
  for (const flag of authorityFlags) assert.equal(report[flag], false);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.captures), true);
  assert.equal(Object.isFrozen(report.captures[0]), true);
  assert.doesNotThrow(() =>
    assertSurfaceCandidateInspectionReportIntegrity(proposal, report),
  );
  assert.deepEqual(
    SurfaceCandidateInspectionReportSchema.parse(structuredClone(report)),
    report,
  );
  assert.equal(canUseSurfaceProductAtRuntime(report, report.inspectedAt), false);
  assert.equal(
    canUseSurfaceProductAtRuntime(structuredClone(report), report.inspectedAt),
    false,
  );
  assert.equal(canUseSurfaceProductAtRuntime(reference, report.inspectedAt), false);
  assert.equal(
    canUseSurfaceProductAtRuntime(structuredClone(reference), report.inspectedAt),
    false,
  );
});

test("enumerated archive signatures are rejected before quarantine persistence", async () => {
  const tar = new Uint8Array(262);
  tar.set(encoder.encode("ustar"), 257);
  const iso = new Uint8Array(32_774);
  iso.set(encoder.encode("CD001"), 32_769);
  const signatures = new Map<string, Uint8Array>([
    ["zip-local", Uint8Array.from([0x50, 0x4b, 0x03, 0x04])],
    ["zip-central", Uint8Array.from([0x50, 0x4b, 0x01, 0x02])],
    ["zip-end", Uint8Array.from([0x50, 0x4b, 0x05, 0x06])],
    ["zip-spanned", Uint8Array.from([0x50, 0x4b, 0x07, 0x08])],
    ["gzip", Uint8Array.from([0x1f, 0x8b, 0x08, 0x00])],
    ["bzip2", Uint8Array.from([0x42, 0x5a, 0x68])],
    ["xz", Uint8Array.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])],
    ["7z", Uint8Array.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])],
    ["rar", Uint8Array.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])],
    ["zstd", Uint8Array.from([0x28, 0xb5, 0x2f, 0xfd])],
    ["zstd-skippable", Uint8Array.from([0x50, 0x2a, 0x4d, 0x18])],
    ["cab", Uint8Array.from([0x4d, 0x53, 0x43, 0x46])],
    ["ar", Uint8Array.from([0x21, 0x3c, 0x61, 0x72, 0x63, 0x68, 0x3e, 0x0a])],
    ["cpio-new", Uint8Array.from([0x30, 0x37, 0x30, 0x37, 0x30, 0x31])],
    ["cpio-crc", Uint8Array.from([0x30, 0x37, 0x30, 0x37, 0x30, 0x32])],
    ["cpio-old", Uint8Array.from([0x30, 0x37, 0x30, 0x37, 0x30, 0x37])],
    ["tar", tar],
    ["iso", iso],
  ]);
  for (const [name, archiveBytes] of signatures) {
    const artifacts = baseArtifacts();
    artifacts[0] = {
      ...artifacts[0]!,
      byteLength: archiveBytes.byteLength,
      sha256: sha256Hex(archiveBytes),
    };
    const bytes = byteMap({ ...fixtureBytes, sart_label_mars: archiveBytes });
    const harness = createHarness(bytes);
    await assert.rejects(
      quarantineAndInspectSurfaceCandidate(
        proposalFor(artifacts),
        harness.dependencies,
      ),
      /archives and compressed containers/i,
      name,
    );
    assert.equal(harness.puts.length, 0, name);
  }
});

test("canonical URL and quarantine-object paths reject traversal and controls", async () => {
  for (const unsafeUrl of [
    "https://example.test/products/%2e%2e/mars.xml",
    "https://example.test/products/%00mars.xml",
    "https://example.test/products/path%2Fmars.xml",
    "https://example.test/products/",
  ]) {
    assert.throws(() => SurfaceQuarantineExactUrlSchema.parse(unsafeUrl));
  }
  for (const unsafeKey of [
    "quarantine/surface/mars/../escaped",
    "quarantine/surface/mars//empty",
    "quarantine\\surface\\mars\\object",
    "quarantine/surface/Mars/object",
  ]) {
    assert.throws(() =>
      SurfaceQuarantineObjectSchema.parse({
        store: "r2",
        namespace: "quarantine/surface",
        key: unsafeKey,
        contentType: "application/xml",
        byteLength: 1,
        checksum: {
          algorithm: "sha256",
          value: "a".repeat(64),
          scope: "surface-artifact-bytes",
        },
        immutable: true,
      }),
    );
  }
  const unsafeStore = createHarness(byteMap(), { storeMode: "unsafe-key" });
  await assert.rejects(
    quarantineAndInspectSurfaceCandidate(proposalFor(), unsafeStore.dependencies),
  );
});

test("source length and hash drift are rejected before persistence", async () => {
  for (const sourceTransform of [
    (_artifact: Readonly<SurfaceQuarantineArtifact>, bytes: Uint8Array) =>
      Uint8Array.from([...bytes, 0]),
    (_artifact: Readonly<SurfaceQuarantineArtifact>, bytes: Uint8Array) => {
      bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
      return bytes;
    },
  ]) {
    const harness = createHarness(byteMap(), { sourceTransform });
    await assert.rejects(
      quarantineAndInspectSurfaceCandidate(proposalFor(), harness.dependencies),
      /length violates|SHA-256/i,
    );
    assert.equal(harness.puts.length, 0);
  }
});

test("drifted store claims and immutable key collisions fail closed", async () => {
  const drift = createHarness(byteMap(), { storeMode: "drift-key" });
  await assert.rejects(
    quarantineAndInspectSurfaceCandidate(proposalFor(), drift.dependencies),
    /drifted immutable object/i,
  );
  const collision = createHarness(byteMap(), { storeMode: "collision" });
  await assert.rejects(
    quarantineAndInspectSurfaceCandidate(proposalFor(), collision.dependencies),
    /immutable key collision/i,
  );
});

test("same-length quarantine replay drift is rejected before parsing", async () => {
  const harness = createHarness(byteMap(), {
    replayTransform(_object, bytes) {
      bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
      return bytes;
    },
  });
  await assert.rejects(
    quarantineAndInspectSurfaceCandidate(proposalFor(), harness.dependencies),
    /replay differs/i,
  );

  class TamperingSliceBytes extends Uint8Array {
    override slice(start?: number, end?: number): Uint8Array<ArrayBuffer> {
      const clone = super.slice(start, end);
      clone[clone.length - 1] = (clone[clone.length - 1] ?? 0) ^ 1;
      return clone;
    }
  }
  const copyRace = createHarness(byteMap(), {
    replayTransform(_object, bytes) {
      return new TamperingSliceBytes(bytes);
    },
  });
  await assert.rejects(
    quarantineAndInspectSurfaceCandidate(proposalFor(), copyRace.dependencies),
    /replay differs/i,
  );
});

test("parser context drift fails closed and injected parser rejection propagates", async () => {
  const drift = createHarness(byteMap(), {
    parserTransform(_input, payload) {
      const changed = structuredClone(payload) as unknown as Record<string, unknown>;
      const binding = changed.binding as Record<string, unknown>;
      binding.body = "Moon";
      recomputeParserPayload(changed);
      return changed;
    },
  });
  await assert.rejects(
    quarantineAndInspectSurfaceCandidate(proposalFor(), drift.dependencies),
    /drifted from exact context/i,
  );

  const dtdBytes = encoder.encode(
    "<?xml version=\"1.0\"?><!DOCTYPE Product [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]><Product>&xxe;</Product>",
  );
  const artifacts = baseArtifacts();
  artifacts[0] = {
    ...artifacts[0]!,
    byteLength: dtdBytes.byteLength,
    sha256: sha256Hex(dtdBytes),
  };
  const dtd = createHarness(
    byteMap({ ...fixtureBytes, sart_label_mars: dtdBytes }),
    { rejectDtd: true },
  );
  await assert.rejects(
    quarantineAndInspectSurfaceCandidate(proposalFor(artifacts), dtd.dependencies),
    /DTD declarations are disabled/i,
  );
});

test("capture and inspection clocks must remain causal", async () => {
  const harness = createHarness(byteMap(), {
    times: [
      "2026-07-19T18:02:00Z",
      "2026-07-19T18:01:00Z",
      "2026-07-19T18:03:00Z",
      "2026-07-19T18:04:00Z",
    ],
  });
  await assert.rejects(
    quarantineAndInspectSurfaceCandidate(proposalFor(), harness.dependencies),
    /causal and nondecreasing/i,
  );

  const inspectionPredatesCapture = createHarness(byteMap(), {
    times: [
      "2026-07-19T18:01:00Z",
      "2026-07-19T18:02:00Z",
      "2026-07-19T18:03:00Z",
      "2026-07-19T18:02:30Z",
    ],
  });
  await assert.rejects(
    quarantineAndInspectSurfaceCandidate(
      proposalFor(),
      inspectionPredatesCapture.dependencies,
    ),
    /inspection cannot predate/i,
  );
});

test("label bindings require unique canonical files and their exact source label", async () => {
  const report = await quarantineAndInspectSurfaceCandidate(
    proposalFor(),
    createHarness(byteMap()).dependencies,
  );
  const binding = report.labelInspections[0]!.binding;
  const duplicate = structuredClone(binding);
  duplicate.files.push(structuredClone(duplicate.files[0]!));
  assert.throws(() => SurfaceLabelInspectionBindingSchema.parse(duplicate), /unique/i);

  const reordered = structuredClone(binding);
  reordered.files.reverse();
  assert.throws(
    () => SurfaceLabelInspectionBindingSchema.parse(reordered),
    /canonical artifact-id order/i,
  );

  const wrongSelf = structuredClone(binding) as unknown as Record<string, unknown>;
  wrongSelf.labelArtifactId = "sart_primary_mars";
  assert.throws(
    () => SurfaceLabelInspectionBindingSchema.parse(wrongSelf),
    /exact source-label file/i,
  );
});

test("report integrity rejects authority laundering and self-consistent reordering", async () => {
  const proposal = proposalFor();
  const report = await quarantineAndInspectSurfaceCandidate(
    proposal,
    createHarness(byteMap()).dependencies,
  );
  const laundered = structuredClone(report) as unknown as Record<string, unknown>;
  laundered.runtimeUseAllowed = true;
  assert.throws(
    () => assertSurfaceCandidateInspectionReportIntegrity(proposal, laundered),
    /invalid input/i,
  );

  const reordered = structuredClone(report) as unknown as Record<string, unknown>;
  (reordered.captures as unknown[]).reverse();
  recomputeReport(reordered);
  assert.throws(
    () => assertSurfaceCandidateInspectionReportIntegrity(proposal, reordered),
    /canonical artifact order/i,
  );

  const missing = structuredClone(report) as unknown as Record<string, unknown>;
  (missing.captures as unknown[]).pop();
  assert.throws(
    () => assertSurfaceCandidateInspectionReportIntegrity(proposal, missing),
    /every artifact capture/i,
  );

  const duplicateCapture = structuredClone(report) as unknown as Record<
    string,
    unknown
  >;
  const duplicateCaptures = duplicateCapture.captures as unknown[];
  duplicateCaptures[1] = structuredClone(duplicateCaptures[0]);
  recomputeReport(duplicateCapture);
  assert.throws(
    () =>
      assertSurfaceCandidateInspectionReportIntegrity(proposal, duplicateCapture),
    /canonical artifact order|repeats an artifact capture/i,
  );

  const duplicateLabel = structuredClone(report) as unknown as Record<
    string,
    unknown
  >;
  const duplicateInspections = duplicateLabel.labelInspections as unknown[];
  duplicateInspections.push(structuredClone(duplicateInspections[0]));
  recomputeReport(duplicateLabel);
  assert.throws(
    () =>
      assertSurfaceCandidateInspectionReportIntegrity(proposal, duplicateLabel),
    /does not inspect every source label/i,
  );
});

test("self-consistent reports cannot mix label parser implementations", async () => {
  const secondLabelBytes = encoder.encode(
    "<?xml version=\"1.0\"?><Product_Observational><logical_identifier>urn:nasa:pds:cosmography_test:mars_ortho</logical_identifier><part>2</part></Product_Observational>",
  );
  const artifacts = baseArtifacts();
  artifacts[0] = {
    ...artifacts[0]!,
    pairedArtifactIds: ["sart_primary_mars"],
  };
  artifacts[1] = {
    ...artifacts[1]!,
    pairedArtifactIds: ["sart_label_mars", "sart_second_label_mars"],
  };
  artifacts.push({
    artifactId: "sart_second_label_mars",
    role: "source-label",
    filename: "mars+ortho-part2.xml",
    sourceUrl: "https://example.test/products/mars+ortho-part2.xml",
    mediaType: "application/xml",
    byteLength: secondLabelBytes.byteLength,
    sha256: sha256Hex(secondLabelBytes),
    pairedArtifactIds: ["sart_primary_mars"],
  });
  const proposal = proposalFor(artifacts);
  const bytes = byteMap({
    ...fixtureBytes,
    sart_second_label_mars: secondLabelBytes,
  });
  const report = await quarantineAndInspectSurfaceCandidate(
    proposal,
    createHarness(bytes, {
      times: [
        "2026-07-19T18:01:00Z",
        "2026-07-19T18:02:00Z",
        "2026-07-19T18:03:00Z",
        "2026-07-19T18:04:00Z",
        "2026-07-19T18:05:00Z",
      ],
    }).dependencies,
  );
  assert.equal(report.labelInspections.length, 2);
  const mixed = structuredClone(report) as unknown as Record<string, unknown>;
  const inspections = mixed.labelInspections as Array<Record<string, unknown>>;
  const second = inspections[1]!;
  (second.parser as Record<string, unknown>).parserVersion = "2.0.0";
  recomputeParserPayload(second);
  recomputeReport(mixed);
  assert.throws(
    () => assertSurfaceCandidateInspectionReportIntegrity(proposal, mixed),
    /mixes parser implementations/i,
  );
});

test("proposal schema refuses a self-consistent authority-field rewrite", () => {
  const proposal = structuredClone(proposalFor()) as unknown as Record<string, unknown>;
  proposal.selectionAuthorized = true;
  const { proposalChecksum: _checksum, ...unsigned } = proposal;
  (proposal.proposalChecksum as Record<string, unknown>).value = sha256Hex(
    stableStringify(unsigned),
  );
  assert.throws(() => SurfaceQuarantineProposalSchema.parse(proposal), /invalid input/i);
});
