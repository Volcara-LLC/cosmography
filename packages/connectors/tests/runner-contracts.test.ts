import assert from "node:assert/strict";
import test from "node:test";

import {
  ConnectorRunRecordSchema,
  DEFAULT_RUNNER_POLICY,
  DnsConnectionAttestationSchema,
  QuarantineObjectKeySchema,
  QuarantineValidationReportSchema,
  RunnerLimitsSchema,
  RunnerPolicySchema,
  TransportResponseMetadataSchema,
} from "../src/index";

const sha = (character: string) => character.repeat(64);
const objectReference = (key: string) => ({
  store: "r2" as const,
  namespace: "quarantine" as const,
  key,
  contentType: "application/json",
  byteLength: 128,
    checksum: {
      algorithm: "sha256" as const,
      value: sha("a"),
      scope: "record-bytes" as const,
  },
  immutable: true as const,
});

test("runner policy is bounded, injected, uncompressed, and redirect-free", () => {
  assert.deepEqual(RunnerPolicySchema.parse(DEFAULT_RUNNER_POLICY), DEFAULT_RUNNER_POLICY);
  assert.throws(
    () =>
      RunnerPolicySchema.parse({
        ...DEFAULT_RUNNER_POLICY,
        transportMode: "global-fetch",
      }),
    /transportMode/,
  );
  assert.throws(
    () =>
      RunnerPolicySchema.parse({
        ...DEFAULT_RUNNER_POLICY,
        allowCompressedResponses: true,
      }),
    /allowCompressedResponses/,
  );
  assert.throws(
    () =>
      RunnerLimitsSchema.parse({
        ...DEFAULT_RUNNER_POLICY.limits,
        maxRedirects: 1,
      }),
    /maxRedirects/,
  );
  assert.throws(
    () =>
      RunnerLimitsSchema.parse({
        ...DEFAULT_RUNNER_POLICY.limits,
        maxDecodedBytes: DEFAULT_RUNNER_POLICY.limits.maxResponseWireBytes - 1,
      }),
    /Decoded-byte limit/,
  );
});

test("transport metadata binds DNS results, socket address, TLS name, and no redirects", () => {
  const dns = {
    hostname: "ssd-api.jpl.nasa.gov",
    resolvedAddresses: ["137.78.251.144"],
    connectedAddress: "137.78.251.144",
    resolvedAt: "2026-07-19T13:30:00Z",
    ttlSeconds: 60,
    tlsServerName: "ssd-api.jpl.nasa.gov",
  };
  assert.deepEqual(DnsConnectionAttestationSchema.parse(dns), dns);
  assert.throws(
    () =>
      DnsConnectionAttestationSchema.parse({
        ...dns,
        connectedAddress: "127.0.0.1",
      }),
    /Connected address/,
  );
  assert.throws(
    () =>
      DnsConnectionAttestationSchema.parse({
        ...dns,
        tlsServerName: "attacker.example",
      }),
    /TLS server name/,
  );
  assert.throws(
    () =>
      TransportResponseMetadataSchema.parse({
        requestedUrl: "https://ssd-api.jpl.nasa.gov/horizons.api",
        finalUrl: "https://redirect.example/payload",
        status: 302,
        headers: { location: "https://redirect.example/payload" },
        redirectChain: ["https://redirect.example/payload"],
        dns,
        receivedAt: "2026-07-19T13:30:01Z",
      }),
    /redirectChain/,
  );
  assert.throws(() =>
    TransportResponseMetadataSchema.parse({
      requestedUrl: "https://ssd-api.jpl.nasa.gov/horizons.api",
      finalUrl: "https://ssd-api.jpl.nasa.gov/horizons.api",
      status: 200,
      headers: { "content-type": "application/json\r\nx-injected: true" },
      redirectChain: [],
      dns,
      receivedAt: "2026-07-19T13:30:01Z",
    }),
  );
});

test("all runner object keys remain canonical and quarantined", () => {
  assert.equal(
    QuarantineObjectKeySchema.parse(
      "quarantine/raw/jpl-horizons/frm_aaaaaaaaaaaaaaaaaaaaaaaa/payload.bin",
    ),
    "quarantine/raw/jpl-horizons/frm_aaaaaaaaaaaaaaaaaaaaaaaa/payload.bin",
  );
  for (const key of [
    "public/releases/payload.bin",
    "quarantine/../public/payload.bin",
    "quarantine\\raw\\payload.bin",
    "quarantine//payload.bin",
  ]) {
    assert.throws(() => QuarantineObjectKeySchema.parse(key));
  }
});

test("validation state is derived from blocking failures and review findings", () => {
  const base = {
    schemaVersion: "1.0.0",
    reportId: "qval_aaaaaaaaaaaaaaaaaaaaaaaa",
    releaseId: "rel_foundation",
    manifestId: "frm_aaaaaaaaaaaaaaaaaaaaaaaa",
    captureId: "qcap_aaaaaaaaaaaaaaaaaaaaaaaa",
    sourceId: "jpl-horizons",
    policyVersion: "1.0.0",
    validatedAt: "2026-07-19T13:30:02Z",
    captureChecksum: {
      algorithm: "sha256",
      value: sha("f"),
      scope: "quarantine-capture",
    },
    responseChecksum: {
      algorithm: "sha256",
      value: sha("a"),
      scope: "response-bytes",
    },
    reportChecksum: {
      algorithm: "sha256",
      value: sha("b"),
      scope: "validation-report",
    },
  };
  const passingFinding = {
    code: "media-type",
    outcome: "pass",
    severity: "blocking",
    validator: "generic-http",
    validatorVersion: "1.0.0",
    message: "Response media type matches the frozen manifest.",
  };
  assert.doesNotThrow(() =>
    QuarantineValidationReportSchema.parse({
      ...base,
      state: "accepted-basic",
      findings: [passingFinding],
    }),
  );
  assert.throws(() =>
    QuarantineValidationReportSchema.parse({
      ...base,
      state: "accepted-basic",
      findings: [
        {
          ...passingFinding,
          outcome: "fail",
          message: "Response media type is invalid.",
        },
      ],
    }),
  );
  assert.throws(() =>
    QuarantineValidationReportSchema.parse({
      ...base,
      state: "accepted-basic",
      findings: [
        {
          ...passingFinding,
          code: "rights-review",
          outcome: "review-required",
          severity: "review",
          message: "Asset-level rights review is still required.",
        },
      ],
    }),
  );
});

test("runner records cannot claim publication", () => {
  const runBase = {
    schemaVersion: "1.0.0",
    runId: "run_aaaaaaaaaaaaaaaaaaaaaaaa",
    releaseId: "rel_foundation",
    manifestId: "frm_aaaaaaaaaaaaaaaaaaaaaaaa",
    sourceId: "jpl-horizons",
    policyVersion: "1.0.0",
    admission: {
      admittedAt: "2026-07-19T13:29:59Z",
      quotaLeaseId: "lease_aaaaaaaaaaaaaaaaaaaaaaaa",
      sourceEnabled: true,
      dataRightsApproved: true,
    },
    startedAt: "2026-07-19T13:30:00Z",
    completedAt: "2026-07-19T13:30:02Z",
    attemptCount: 1,
    attempts: [
      {
        attempt: 1,
        state: "captured",
        startedAt: "2026-07-19T13:30:00Z",
        completedAt: "2026-07-19T13:30:02Z",
        httpStatus: 200,
        validationState: "accepted-basic",
        capture: {
          id: "qcap_aaaaaaaaaaaaaaaaaaaaaaaa",
          object: objectReference(
            "quarantine/manifests/jpl-horizons/attempt-1-capture.json",
          ),
        },
        validation: {
          id: "qval_aaaaaaaaaaaaaaaaaaaaaaaa",
          object: objectReference(
            "quarantine/manifests/jpl-horizons/attempt-1-validation.json",
          ),
        },
      },
    ],
    runChecksum: {
      algorithm: "sha256",
      value: sha("c"),
      scope: "connector-run",
    },
  };
  assert.doesNotThrow(() =>
    ConnectorRunRecordSchema.parse({
      ...runBase,
      state: "quarantined",
      validationState: "accepted-basic",
      capture: {
        id: "qcap_aaaaaaaaaaaaaaaaaaaaaaaa",
        object: objectReference(
          "quarantine/manifests/jpl-horizons/attempt-1-capture.json",
        ),
      },
      validation: {
        id: "qval_aaaaaaaaaaaaaaaaaaaaaaaa",
        object: objectReference(
          "quarantine/manifests/jpl-horizons/attempt-1-validation.json",
        ),
      },
    }),
  );
  assert.throws(() =>
    ConnectorRunRecordSchema.parse({
      ...runBase,
      state: "published",
    }),
  );

});
