import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseHorizonsVectorArtifact } from "../app/data/missions/horizons-vector-parser";
import { validateMissionFixture } from "../app/data/missions/mission-schema";
import { voyager1 } from "../app/data/missions/voyager-1";

const artifactUrl = new URL(
  "./fixtures/horizons/voyager-1-vectors-2026-07-19.txt",
  import.meta.url,
);
const artifactSha256 =
  "d5fb20227607ff652e109977a068f28aff0a13cf8bf1cbc55a8bf40cfdca1252";

test("parses the frozen Horizons artifact with its exact scientific context", async () => {
  const bytes = await readFile(artifactUrl);
  const parsed = parseHorizonsVectorArtifact(bytes.toString("utf8"));

  assert.equal(createHash("sha256").update(bytes).digest("hex"), artifactSha256);
  assert.equal(parsed.apiVersion, "1.2");
  assert.equal(parsed.targetName, "Voyager 1 (spacecraft)");
  assert.equal(parsed.targetNaifId, -31);
  assert.equal(parsed.centerName, "Sun");
  assert.equal(parsed.centerNaifId, 10);
  assert.equal(parsed.solutionName, "Voyager_1_ST+refit2022_m");
  assert.equal(parsed.referenceFrame, "Ecliptic of J2000.0");
  assert.equal(parsed.referenceSystem, "ICRF");
  assert.equal(parsed.timeScale, "TDB");
  assert.equal(parsed.outputUnits, "AU-D");
  assert.equal(parsed.correction, "NONE");
  assert.equal(parsed.rows.length, 7);
});

test("raw Horizons decimals exactly bind both the trajectory and golden plan", async () => {
  const raw = await readFile(artifactUrl, "utf8");
  const parsed = parseHorizonsVectorArtifact(raw);
  const golden = voyager1.provenance.horizonsValidation.goldenEpochs;

  assert.equal(parsed.rows.length, voyager1.trajectory.points.length);
  assert.equal(golden.length, voyager1.trajectory.points.length);

  parsed.rows.forEach((row, index) => {
    const point = voyager1.trajectory.points[index]!;
    const goldenPoint = golden[index]!;
    assert.equal(row.julianDateTdb, point.julianDateTdb);
    assert.equal(row.julianDateTdb, goldenPoint.julianDateTdb);
    assert.deepEqual(row.positionAu, point.positionAu);
    assert.deepEqual(row.positionAu, goldenPoint.positionAu);
    assert.deepEqual(row.velocityAuPerDay, point.velocityAuPerDay);
    assert.deepEqual(row.velocityAuPerDay, goldenPoint.velocityAuPerDay);

    const norm = Math.hypot(...row.positionAu);
    assert.ok(
      Math.abs(norm - point.derivedHeliocentricDistanceAu) <= 5.00001e-7,
      `${point.id} stored six-decimal distance must round the raw vector norm`,
    );
  });
});

test("Horizons parser rejects metadata drift, truncation, duplicate epochs, and table laundering", async () => {
  const raw = await readFile(artifactUrl, "utf8");
  const mutations = [
    raw.replace("Output units    : AU-D", "Output units    : KM-S"),
    raw.replace("Reference frame : Ecliptic of J2000.0", "Reference frame : J2000"),
    raw.replace(
      "JDTDB,            Calendar Date (TDB),                      X,                      Y,                      Z,                     VX,                     VY,                     VZ,",
      "JDTDB,            Calendar Date (TDB),                      Y,                      X,                      Z,                     VX,                     VY,                     VZ,",
    ),
    raw.replace("X-axis   : ICRF", "X-axis   : unspecified"),
    raw.replace("Voyager 1 (spacecraft) (-31)", "Voyager 1 (spacecraft) (--31)"),
    raw.replace(
      "2443392.500000000, A.D. 1977-Sep-06 00:00:00.0000",
      "2443392.500000000, A.D. 1977-Sep-07 00:00:00.0000",
    ),
    raw.replace(
      "2443392.500000000, A.D. 1977-Sep-06 00:00:00.0000",
      "2443392.500000000, A.D. 1977-Feb-31 00:00:00.0000",
    ),
    raw.replace(
      "Geometric state vectors have NO corrections or aberrations applied.",
      "Light-time correction applied.",
    ),
    raw.replace("$$EOE", "$$SOE\n$$EOE"),
    raw.replace(
      "2443392.500000000, A.D. 1977-Sep-06 00:00:00.0000,  9.679318511236246E-01, -2.820995554599118E-01,  1.711150759918104E-04,  6.683337106329786E-03,  2.202624005714421E-02,  4.219086960345452E-04,",
      "2443392.500000000, A.D. 1977-Sep-06 00:00:00.0000,  9.679318511236246E-01,",
    ),
  ];
  for (const mutation of mutations) {
    assert.throws(() => parseHorizonsVectorArtifact(mutation));
  }

  const firstRow = raw.match(/^2443392\.500000000,[^\r\n]+$/m)?.[0];
  assert.ok(firstRow);
  const duplicateEpoch = raw.replace(firstRow, `${firstRow}\n${firstRow}`);
  assert.throws(() => parseHorizonsVectorArtifact(duplicateEpoch), /unique/);
});

test("Voyager kernel selection freezes exact files and proposed load order while execution remains blocked", () => {
  const selection = voyager1.provenance.kernelSet;
  assert.equal(selection.state, "blocked-missing-artifacts");
  assert.equal(selection.executionAllowed, false);
  assert.equal(selection.releaseEligible, false);
  assert.deepEqual(
    selection.artifacts.map((artifact) => artifact.filename),
    [
      "naif0012.tls",
      "voyager_1.ST+1991_a54418u.merged.bsp",
      "vgr1_jup230.bsp",
      "vgr1_sat337.bsp",
      "vgr1.x2100.bsp",
    ],
  );
  assert.deepEqual(
    selection.artifacts.map((artifact) => artifact.loadOrder),
    [1, 2, 3, 4, 5],
  );
  const merged = selection.artifacts.find(
    (artifact) => artifact.filename === "voyager_1.ST+1991_a54418u.merged.bsp",
  );
  assert.ok(merged);
  const declaredCenterEdges = new Set(
    merged.coverage
      .filter((coverage) => coverage.centerNaifId !== undefined)
      .map((coverage) => `${coverage.targetNaifId}->${coverage.centerNaifId}`),
  );
  for (const edge of ["3->0", "5->0", "6->0", "10->0", "399->3"]) {
    assert.equal(declaredCenterEdges.has(edge), true);
  }
  assert.equal(
    selection.artifacts.every(
      (artifact) => artifact.officialUrl.startsWith("https://naif.jpl.nasa.gov/pub/naif/") &&
        !("sha256" in artifact) &&
        !("byteLength" in artifact),
    ),
    true,
  );
  assert.match(selection.missingEvidence.join(" "), /SHA-256/);
  assert.equal(
    voyager1.provenance.horizonsValidation.goldenEpochs.filter(
      (epoch) => epoch.comparisonMode === "same-solution-parity",
    ).length,
    4,
  );
  assert.equal(
    voyager1.provenance.horizonsValidation.goldenEpochs.filter(
      (epoch) => epoch.comparisonMode === "cross-solution-diagnostic",
    ).length,
    3,
  );
});

test("all Voyager media remain reference-only and capture frusta stay withheld", () => {
  assert.equal(voyager1.provenance.mediaAdmissions.length, voyager1.media.length);
  for (const admission of voyager1.provenance.mediaAdmissions) {
    assert.equal(admission.state, "reference-only-pending-asset-review");
    assert.equal(admission.assetBytesPresent, false);
    assert.equal(admission.renderAllowed, false);
    assert.equal(admission.intendedUse.embedBytes, false);
    assert.equal(admission.intendedUse.redistribute, false);
  }
  assert.deepEqual(
    voyager1.provenance.mediaAdmissions
      .map((admission) => admission.mediaId)
      .sort(),
    voyager1.media.map((media) => media.id).sort(),
  );
  assert.equal(voyager1.provenance.captureContexts.length, 2);
  assert.equal(
    voyager1.provenance.captureContexts.every(
      (capture) =>
        capture.state === "withheld-incomplete-geometry" &&
        capture.timePrecision === "minute" &&
        capture.renderableCameraPose === false,
    ),
    true,
  );
});

test("mission fixture rejects unknown fields, missing rights records, and golden drift", () => {
  const unknownField = structuredClone(voyager1);
  Reflect.set(unknownField.media[0]!, "publicationAuthority", true);
  assert.throws(() => validateMissionFixture(unknownField), /Unrecognized key/);

  const missingAdmission = structuredClone(voyager1);
  missingAdmission.provenance.mediaAdmissions.pop();
  assert.throws(
    () => validateMissionFixture(missingAdmission),
    /exactly one structured admission/,
  );

  const goldenDrift = structuredClone(voyager1);
  goldenDrift.provenance.horizonsValidation.goldenEpochs[0].positionAu[0] += 1e-5;
  assert.throws(
    () => validateMissionFixture(goldenDrift),
    /exactly match the separately frozen Horizons golden plan/,
  );

  const contextDrift = structuredClone(voyager1);
  contextDrift.provenance.horizonsValidation.queryContext.centerNaifId = 0;
  assert.throws(
    () => validateMissionFixture(contextDrift),
    /query contexts must match exactly|bind the exact trajectory artifact/,
  );

  const missionDrift = structuredClone(voyager1);
  Reflect.set(missionDrift.provenance.kernelSet, "missionId", "voyager-2");
  assert.throws(() => validateMissionFixture(missionDrift), /mission ID/i);

  const missingCenterBridge = structuredClone(voyager1);
  for (const artifact of missingCenterBridge.provenance.kernelSet.artifacts) {
    artifact.coverage = artifact.coverage.filter(
      (coverage) =>
        !(coverage.targetNaifId === 5 && coverage.centerNaifId === 0),
    );
  }
  assert.throws(
    () => validateMissionFixture(missingCenterBridge),
    /declared center chain/,
  );

  const staleVerification = structuredClone(voyager1);
  staleVerification.verifiedAt = "2026-07-19T00:00:00-10:00";
  assert.throws(
    () => validateMissionFixture(staleVerification),
    /verification time cannot predate/i,
  );

  const creditDrift = structuredClone(voyager1);
  creditDrift.media[0]!.creditLine = "No credit required";
  assert.throws(() => validateMissionFixture(creditDrift), /displayed credit/);

  const captureTimeDrift = structuredClone(voyager1);
  captureTimeDrift.provenance.captureContexts[0]!.capturedAtUtc =
    "1990-02-14T04:49:00Z";
  assert.throws(() => validateMissionFixture(captureTimeDrift), /capture time/);

  const duplicateGoldenId = structuredClone(voyager1);
  duplicateGoldenId.provenance.horizonsValidation.goldenEpochs[1]!.epochId =
    duplicateGoldenId.provenance.horizonsValidation.goldenEpochs[0]!.epochId;
  assert.throws(() => validateMissionFixture(duplicateGoldenId), /unique/i);
});
