import assert from "node:assert/strict";
import test from "node:test";

import {
  assertQuarantineCaptureIntegrity,
  assertQuarantineValidationReportIntegrity,
  createQuarantineCapture,
  exampleHorizonsManifest,
  sha256Hex,
  stableStringify,
  validateQuarantinedResponse,
} from "../src/index";

const encoder = new TextEncoder();
const receivedAt = "2026-07-19T13:40:30Z";
const capturedAt = "2026-07-19T13:40:31Z";
const validatedAt = "2026-07-19T13:40:32Z";
const requestUrl =
  exampleHorizonsManifest.request.kind === "http"
    ? exampleHorizonsManifest.request.url
    : "";
const dns = {
  hostname: "ssd.jpl.nasa.gov",
  resolvedAddresses: ["137.78.251.144"],
  connectedAddress: "137.78.251.144",
  resolvedAt: "2026-07-19T13:40:00Z",
  ttlSeconds: 60,
  tlsServerName: "ssd.jpl.nasa.gov",
};
const admission = {
  releaseId: "rel_foundation",
  admittedAt: "2026-07-19T13:40:00Z",
  sourceEnabled: true,
  dataRightsApproved: true,
  quotaLease: {
    leaseId: "lease_aaaaaaaaaaaaaaaaaaaaaaaa",
    sourceId: "jpl-horizons",
    issuedAt: "2026-07-19T13:39:00Z",
    notBefore: "2026-07-19T13:39:00Z",
    expiresAt: "2026-07-19T14:00:00Z",
    maxConcurrency: 2,
  },
  activeSourceConcurrency: 0,
};

function fixture(
  text: string,
  options: {
    contentType?: string;
    contentEncoding?: string;
    contentRange?: string;
    contentLength?: string;
    status?: number;
  } = {},
) {
  const bytes = encoder.encode(text);
  const checksum = sha256Hex(bytes);
  const headers = {
    "content-type": options.contentType ?? "application/json; charset=utf-8",
    "content-length": options.contentLength ?? String(bytes.byteLength),
    ...(options.contentEncoding === undefined
      ? {}
      : { "content-encoding": options.contentEncoding }),
    ...(options.contentRange === undefined
      ? {}
      : { "content-range": options.contentRange }),
    "set-cookie": "must-not-persist=secret",
  };
  const capture = createQuarantineCapture({
    manifest: exampleHorizonsManifest,
    admission,
    attempt: 1,
    capturedAt,
    transport: {
      requestedUrl: requestUrl,
      finalUrl: requestUrl,
      status: options.status ?? 200,
      headers,
      redirectChain: [],
      dns,
      receivedAt,
    },
    responseSha256: checksum,
    wireByteLength: bytes.byteLength,
    decodedByteLength: bytes.byteLength,
    rawObject: {
      store: "r2",
      namespace: "quarantine",
      key: `quarantine/raw/jpl-horizons/${exampleHorizonsManifest.manifestId}/attempt-1/payload.bin`,
      contentType: headers["content-type"],
      byteLength: bytes.byteLength,
      checksum: {
        algorithm: "sha256",
        value: checksum,
        scope: "response-bytes",
      },
      immutable: true,
    },
  });
  return { bytes, capture };
}

test("capture and validation records bind exact immutable response bytes", () => {
  const { bytes, capture } = fixture(
    JSON.stringify({ signature: { version: "1.2" }, result: "fixture" }),
  );
  assert.doesNotThrow(() =>
    assertQuarantineCaptureIntegrity(exampleHorizonsManifest, capture),
  );
  assert.equal("setCookie" in capture.responseHeaders, false);
  assert.equal(capture.responseHeaders.contentLength, bytes.byteLength);

  const report = validateQuarantinedResponse({
    manifest: exampleHorizonsManifest,
    capture,
    bytes,
    validatedAt,
  });
  assert.equal(report.state, "needs-review");
  assert.equal(report.captureChecksum.value, capture.captureChecksum.value);
  assert.equal(report.responseChecksum.value, capture.responseChecksum.value);
  assert.equal(
    report.findings.find(({ code }) => code === "horizons-signature")?.outcome,
    "pass",
  );
  assert.doesNotThrow(() =>
    assertQuarantineValidationReportIntegrity(
      exampleHorizonsManifest,
      capture,
      report,
    ),
  );
});

test("capture and report tampering fail even when the outer checksum is recomputed", () => {
  const { bytes, capture } = fixture(
    JSON.stringify({ signature: { version: "1.2" }, result: "fixture" }),
  );
  const tamperedCapture = structuredClone(capture);
  tamperedCapture.httpStatus = 201;
  const { captureChecksum: _captureChecksum, ...unsignedCapture } = tamperedCapture;
  tamperedCapture.captureChecksum.value = sha256Hex(stableStringify(unsignedCapture));
  assert.throws(
    () => assertQuarantineCaptureIntegrity(exampleHorizonsManifest, tamperedCapture),
    /capture id/,
  );

  const report = validateQuarantinedResponse({
    manifest: exampleHorizonsManifest,
    capture,
    bytes,
    validatedAt,
  });
  const tamperedReport = structuredClone(report);
  tamperedReport.findings[0]!.message = "tampered";
  const { reportChecksum: _reportChecksum, ...unsignedReport } = tamperedReport;
  tamperedReport.reportChecksum.value = sha256Hex(stableStringify(unsignedReport));
  assert.throws(
    () =>
      assertQuarantineValidationReportIntegrity(
        exampleHorizonsManifest,
        capture,
        tamperedReport,
      ),
    /report id/,
  );
});

test("self-consistent capture admission cannot predate its frozen manifest", () => {
  const { capture } = fixture(
    JSON.stringify({ signature: { version: "1.2" }, result: "fixture" }),
  );
  const tampered = structuredClone(capture);
  tampered.admittedAt = "2000-01-01T00:00:00Z";
  const {
    schemaVersion: _schemaVersion,
    captureId: _oldCaptureId,
    captureChecksum: _oldCaptureChecksum,
    ...identity
  } = tampered;
  tampered.captureId = `qcap_${sha256Hex(stableStringify(identity)).slice(0, 24)}`;
  const { captureChecksum: _checksum, ...unsigned } = tampered;
  tampered.captureChecksum.value = sha256Hex(stableStringify(unsigned));
  assert.throws(
    () => assertQuarantineCaptureIntegrity(exampleHorizonsManifest, tampered),
    /admission predates/i,
  );
});

test("source envelopes, domain errors, compression, and headers fail closed", () => {
  const cases = [
    fixture(JSON.stringify({ signature: { version: "1.3" }, result: "wrong" })),
    fixture(JSON.stringify("primitive-json")),
    fixture(JSON.stringify({ signature: { version: "1.2" }, error: "bad target" })),
    fixture(JSON.stringify({ signature: { version: "1.2" }, error: {} })),
    fixture("<html>upstream error</html>"),
    fixture(JSON.stringify({ signature: { version: "1.2" } }), {
      contentEncoding: "gzip",
    }),
    fixture(JSON.stringify({ signature: { version: "1.2" } }), {
      contentLength: "not-a-number",
    }),
    fixture(JSON.stringify({ signature: { version: "1.2" } }), {
      status: 503,
    }),
    fixture(JSON.stringify({ signature: { version: "1.2" } }), {
      contentRange: "bytes 0-9/100",
    }),
  ];

  for (const { bytes, capture } of cases) {
    const report = validateQuarantinedResponse({
      manifest: exampleHorizonsManifest,
      capture,
      bytes,
      validatedAt,
    });
    assert.equal(report.state, "rejected");
  }
});

test("validation cannot predate its immutable capture", () => {
  const { bytes, capture } = fixture(
    JSON.stringify({ signature: { version: "1.2" }, result: "fixture" }),
  );
  assert.throws(
    () =>
      validateQuarantinedResponse({
        manifest: exampleHorizonsManifest,
        capture,
        bytes,
        validatedAt: "2026-07-19T13:40:30Z",
      }),
    /predates/,
  );
});

test("validator input must be the exact captured byte sequence", () => {
  const { capture } = fixture(
    JSON.stringify({ signature: { version: "1.2" }, result: "fixture" }),
  );
  const report = validateQuarantinedResponse({
    manifest: exampleHorizonsManifest,
    capture,
    bytes: encoder.encode("different"),
    validatedAt,
  });
  assert.equal(report.state, "rejected");
  assert.equal(
    report.findings.find(({ code }) => code === "validator-input-checksum")
      ?.outcome,
    "fail",
  );
});
