import assert from "node:assert/strict";
import test from "node:test";

import {
  GOVERNANCE_CANONICALIZATION,
  RightsStatementSchema,
  approvalRecordSigningPayload,
  createApprovalRecord,
  type ApprovalRecord,
  type ApprovalRole,
} from "@cosmography/scientific-model";

import {
  QuarantineValidationReportSchema,
  ReleasePromotionCandidateSchema,
  assertConnectorRunRecordIntegrity,
  assertReleasePromotionCandidateApprovals,
  assertReleasePromotionCandidateAuthorizations,
  assertReleasePromotionCandidateIntegrity,
  createPromotionEvidenceSubject,
  createQuarantineCapture,
  createReleasePromotionCandidate,
  exampleHorizonsManifest,
  promotionSubjectDigest,
  requiredPromotionApprovalRoles,
  scientificSourceMappingFor,
  sha256Hex,
  sourcePassports,
  stableStringify,
  validateQuarantinedResponse,
  type ApprovalSignatureVerifier,
  type ConnectorRunRecord,
  type QuarantineValidationReport,
  type ReleaseSignatureRequestAuthorizer,
} from "../src/index";

const encoder = new TextEncoder();
const requestUrl =
  exampleHorizonsManifest.request.kind === "http"
    ? exampleHorizonsManifest.request.url
    : "";
const rawBytes = encoder.encode(
  JSON.stringify({ signature: { version: "1.2" }, result: "fixture" }),
);
const rawSha256 = sha256Hex(rawBytes);
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
const dns = {
  hostname: "ssd.jpl.nasa.gov",
  resolvedAddresses: ["137.78.251.144"],
  connectedAddress: "137.78.251.144",
  resolvedAt: "2026-07-19T13:40:00Z",
  ttlSeconds: 60,
  tlsServerName: "ssd.jpl.nasa.gov",
};

function manifestObject(key: string, value: unknown) {
  const canonicalJson = stableStringify(value);
  return {
    store: "r2" as const,
    namespace: "quarantine" as const,
    key,
    contentType: "application/json" as const,
    byteLength: encoder.encode(canonicalJson).byteLength,
    checksum: {
      algorithm: "sha256" as const,
      value: sha256Hex(canonicalJson),
      scope: "record-bytes" as const,
    },
    immutable: true as const,
  };
}

function createRun(
  capture: ReturnType<typeof createQuarantineCapture>,
  report: QuarantineValidationReport,
): ConnectorRunRecord {
  const captureObject = manifestObject(
    `quarantine/manifests/jpl-horizons/${exampleHorizonsManifest.manifestId}/attempt-1/capture.json`,
    capture,
  );
  const validationObject = manifestObject(
    `quarantine/manifests/jpl-horizons/${exampleHorizonsManifest.manifestId}/attempt-1/validation.json`,
    report,
  );
  const evidence = {
    admittedAt: admission.admittedAt,
    quotaLeaseId: admission.quotaLease.leaseId,
    sourceEnabled: true,
    dataRightsApproved: true,
  };
  const identity = {
    releaseId: admission.releaseId,
    manifestId: exampleHorizonsManifest.manifestId,
    sourceId: exampleHorizonsManifest.sourceId,
    policyVersion: "1.0.0",
    admission: evidence,
    startedAt: "2026-07-19T13:40:10Z",
  };
  const runId = `run_${sha256Hex(stableStringify(identity)).slice(0, 24)}`;
  const artifactAttempt = {
    attempt: 1,
    state: "captured" as const,
    startedAt: "2026-07-19T13:40:10Z",
    completedAt: "2026-07-19T13:40:32Z",
    httpStatus: 200,
    capture: { id: capture.captureId, object: captureObject },
    validation: { id: report.reportId, object: validationObject },
    validationState: report.state,
  };
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    runId,
    ...identity,
    completedAt: "2026-07-19T13:40:33Z",
    attemptCount: 1,
    attempts: [artifactAttempt],
    state: "quarantined" as const,
    capture: artifactAttempt.capture,
    validation: artifactAttempt.validation,
    validationState: report.state,
  };
  const run = {
    ...unsigned,
    runChecksum: {
      algorithm: "sha256" as const,
      value: sha256Hex(stableStringify(unsigned)),
      scope: "connector-run" as const,
    },
  };
  assertConnectorRunRecordIntegrity(run);
  return run;
}

function rehashRun(run: ConnectorRunRecord): ConnectorRunRecord {
  const updated = structuredClone(run);
  const identity = {
    releaseId: updated.releaseId,
    manifestId: updated.manifestId,
    sourceId: updated.sourceId,
    policyVersion: updated.policyVersion,
    admission: updated.admission,
    startedAt: updated.startedAt,
  };
  updated.runId = `run_${sha256Hex(stableStringify(identity)).slice(0, 24)}`;
  const { runChecksum: _oldChecksum, ...unsigned } = updated;
  updated.runChecksum.value = sha256Hex(stableStringify(unsigned));
  assertConnectorRunRecordIntegrity(updated);
  return updated;
}

function quarantineFixture() {
  const capture = createQuarantineCapture({
    manifest: exampleHorizonsManifest,
    admission,
    attempt: 1,
    capturedAt: "2026-07-19T13:40:31Z",
    transport: {
      requestedUrl: requestUrl,
      finalUrl: requestUrl,
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-length": String(rawBytes.byteLength),
      },
      redirectChain: [],
      dns,
      receivedAt: "2026-07-19T13:40:30Z",
    },
    responseSha256: rawSha256,
    wireByteLength: rawBytes.byteLength,
    decodedByteLength: rawBytes.byteLength,
    rawObject: {
      store: "r2",
      namespace: "quarantine",
      key: `quarantine/raw/jpl-horizons/${exampleHorizonsManifest.manifestId}/attempt-1/payload.bin`,
      contentType: "application/json; charset=utf-8",
      byteLength: rawBytes.byteLength,
      checksum: {
        algorithm: "sha256",
        value: rawSha256,
        scope: "response-bytes",
      },
      immutable: true,
    },
  });
  const report = validateQuarantinedResponse({
    manifest: exampleHorizonsManifest,
    capture,
    bytes: rawBytes,
    validatedAt: "2026-07-19T13:40:32Z",
  });
  return { capture, report, run: createRun(capture, report) };
}

function rightsStatement(overrides: Record<string, unknown> = {}) {
  return RightsStatementSchema.parse({
    rightsId: "rgt_jpl_horizons",
    target: { kind: "source", sourceId: "src_jpl_horizons" },
    basis: {
      kind: "public-domain",
      jurisdiction: "United States",
      rationale: "Reviewed public-domain government data determination.",
    },
    useProfile: {
      display: "allowed",
      redistribute: "allowed",
      modify: "unknown",
      commercialUse: "unknown",
    },
    creditLine: "NASA/JPL Horizons",
    requiredNotices: ["Preserve the source release label and retrieval lineage."],
    capturedAt: "2026-07-19T13:40:32Z",
    reviewStatus: "reviewed",
    reviewedBy: "rights-reviewer",
    reviewedAt: "2026-07-19T13:40:34Z",
    reviewExpiresAt: "2027-07-19T13:40:34Z",
    ...overrides,
  });
}

function subjectFixture(options: {
  bytes?: Uint8Array;
  report?: QuarantineValidationReport;
  run?: ConnectorRunRecord;
  rights?: unknown;
  intendedUse?: unknown;
} = {}) {
  const fixture = quarantineFixture();
  const report = options.report ?? fixture.report;
  const run = options.run ??
    (options.report === undefined ? fixture.run : createRun(fixture.capture, report));
  const rights = options.rights ?? rightsStatement();
  const evidenceInput = {
    manifest: exampleHorizonsManifest,
    run,
    capture: fixture.capture,
    validationReport: report,
    rawBytes: options.bytes ?? rawBytes,
    rightsStatement: rights,
    intendedUse: options.intendedUse ?? {
      display: true,
      redistribute: true,
      modify: false,
      commercial: false,
    },
    evaluatedAt: "2026-07-19T13:40:35Z",
  };
  const subject = createPromotionEvidenceSubject(evidenceInput);
  return { ...fixture, report, run, rights, evidenceInput, subject };
}

const actorByRole: Readonly<Record<ApprovalRole, string>> = {
  scientific: "science-reviewer",
  rights: "rights-reviewer",
  security: "security-reviewer",
};
const keyByRole: Readonly<Record<ApprovalRole, string>> = {
  scientific: "science-review-key-1",
  rights: "rights-review-key-1",
  security: "security-review-key-1",
};

function expectedSignature(keyId: string, payloadSha256: string): string {
  return Buffer.from(`trusted:${keyId}:${payloadSha256}`).toString("base64");
}

function approvalFor(
  role: ApprovalRole,
  subjectSha256: string,
  overrides: {
    actorId?: string;
    keyId?: string;
    decidedAt?: string;
    expiresAt?: string;
  } = {},
): ApprovalRecord {
  const keyId = overrides.keyId ?? keyByRole[role];
  const decidedAt =
    overrides.decidedAt ??
    (role === "scientific"
      ? "2026-07-19T13:40:36Z"
      : role === "rights"
        ? "2026-07-19T13:40:37Z"
        : "2026-07-19T13:40:38Z");
  const draft = {
    role,
    actorId: overrides.actorId ?? actorByRole[role],
    roleGrantId: `grant_${role}_review_1`,
    decision: "approved" as const,
    subjectSha256,
    decidedAt,
    expiresAt: overrides.expiresAt ?? "2027-07-19T13:40:40Z",
    signature: {
      algorithm: "Ed25519" as const,
      keyId,
      canonicalization: GOVERNANCE_CANONICALIZATION as typeof GOVERNANCE_CANONICALIZATION,
      signatureBase64: "AA==",
    },
  };
  const payloadSha256 = sha256Hex(approvalRecordSigningPayload(draft));
  return createApprovalRecord({
    ...draft,
    signature: {
      ...draft.signature,
      signatureBase64: expectedSignature(keyId, payloadSha256),
    },
  });
}

const trustedVerifier: ApprovalSignatureVerifier = {
  verify({
    role,
    actorId,
    roleGrantId,
    expiresAt,
    checkedAt,
    payload,
    payloadSha256,
    signature,
  }) {
    return (
      actorByRole[role] === actorId &&
      roleGrantId === `grant_${role}_review_1` &&
      expiresAt === "2027-07-19T13:40:40Z" &&
      Date.parse(checkedAt) >= Date.parse("2026-07-19T13:40:36Z") &&
      keyByRole[role] === signature.keyId &&
      sha256Hex(payload) === payloadSha256 &&
      signature.signatureBase64 ===
        expectedSignature(signature.keyId, payloadSha256)
    );
  },
};

const trustedReleaseSigner: ReleaseSignatureRequestAuthorizer = {
  authorize({
    algorithm,
    keyId,
    canonicalization,
    payloadSha256,
    requestedAt,
    checkedAt,
    reviewerKeyIds,
  }) {
    return (
      algorithm === "Ed25519" &&
      keyId === "release-signing-key-1" &&
      canonicalization === GOVERNANCE_CANONICALIZATION &&
      /^[a-f0-9]{64}$/.test(payloadSha256) &&
      requestedAt === "2026-07-19T13:40:40Z" &&
      Date.parse(checkedAt) >= Date.parse(requestedAt) &&
      !reviewerKeyIds.includes(keyId)
    );
  },
};

function candidateFixture() {
  const fixture = subjectFixture();
  const digest = promotionSubjectDigest(fixture.subject);
  const approvals = fixture.subject.requiredApprovalRoles.map((role) =>
    approvalFor(role, digest),
  );
  const candidate = createReleasePromotionCandidate({
    evidenceInput: fixture.evidenceInput,
    approvals,
    assembledAt: "2026-07-19T13:40:39Z",
    signatureRequest: {
      algorithm: "Ed25519",
      keyId: "release-signing-key-1",
      requestedAt: "2026-07-19T13:40:40Z",
    },
    approvalVerifier: trustedVerifier,
    releaseSignatureAuthorizer: trustedReleaseSigner,
  });
  return { ...fixture, approvals, candidate };
}

function rehashReport(
  reportValue: QuarantineValidationReport,
  findings: QuarantineValidationReport["findings"],
  state: QuarantineValidationReport["state"],
): QuarantineValidationReport {
  const report = structuredClone(reportValue);
  report.findings = findings;
  report.state = state;
  report.reportId = `qval_${sha256Hex(
    stableStringify({
      captureId: report.captureId,
      captureChecksum: report.captureChecksum,
      responseChecksum: report.responseChecksum,
      validatedAt: report.validatedAt,
      findings: report.findings,
    }),
  ).slice(0, 24)}`;
  const { reportChecksum: _oldChecksum, ...unsigned } = report;
  report.reportChecksum.value = sha256Hex(stableStringify(unsigned));
  return QuarantineValidationReportSchema.parse(report);
}

test("current quarantine evidence becomes only an unsigned pending candidate", () => {
  const { candidate, report, evidenceInput } = candidateFixture();
  assert.equal(report.state, "needs-review");
  assert.deepEqual(candidate.evidence.requiredApprovalRoles, [
    "scientific",
    "rights",
  ]);
  assert.equal(candidate.state, "awaiting-signature-and-activation");
  assert.equal(candidate.signatureRequest.state, "pending");
  assert.equal(
    candidate.signatureRequest.payloadSha256,
    candidate.evidence.evidenceChecksum.value,
  );
  assert.match(candidate.destinationKey, /^release-candidates\//);
  assert.equal("signature" in candidate.signatureRequest, false);
  assert.equal("publishedAt" in candidate, false);
  assert.equal(Object.isFrozen(candidate), true);
  assert.doesNotThrow(() => assertReleasePromotionCandidateIntegrity(candidate));
  assert.doesNotThrow(() =>
    assertReleasePromotionCandidateApprovals(
      candidate,
      trustedVerifier,
      candidate.createdAt,
    ),
  );
  assert.doesNotThrow(() =>
    assertReleasePromotionCandidateAuthorizations(
      candidate,
      evidenceInput,
      trustedVerifier,
      trustedReleaseSigner,
      candidate.createdAt,
    ),
  );
  assert.equal(
    ReleasePromotionCandidateSchema.safeParse({ ...candidate, state: "active" })
      .success,
    false,
  );
  assert.equal(
    ReleasePromotionCandidateSchema.safeParse({
      ...candidate,
      destinationKey: "public/releases/foundation.json",
    }).success,
    false,
  );
});

test("candidate output is deterministic under approval order", () => {
  const fixture = subjectFixture();
  const digest = promotionSubjectDigest(fixture.subject);
  const approvals = fixture.subject.requiredApprovalRoles.map((role) =>
    approvalFor(role, digest),
  );
  const input = {
    evidenceInput: fixture.evidenceInput,
    assembledAt: "2026-07-19T13:40:39Z",
    signatureRequest: {
      algorithm: "Ed25519" as const,
      keyId: "release-signing-key-1",
      requestedAt: "2026-07-19T13:40:40Z",
    },
    approvalVerifier: trustedVerifier,
    releaseSignatureAuthorizer: trustedReleaseSigner,
  };
  assert.deepEqual(
    createReleasePromotionCandidate({ ...input, approvals }),
    createReleasePromotionCandidate({ ...input, approvals: [...approvals].reverse() }),
  );
});

test("candidate assembly cannot bypass exact artifact replay", () => {
  const fixture = subjectFixture();
  const digest = promotionSubjectDigest(fixture.subject);
  const approvals = fixture.subject.requiredApprovalRoles.map((role) =>
    approvalFor(role, digest),
  );
  assert.throws(
    () =>
      createReleasePromotionCandidate({
        evidenceInput: {
          ...fixture.evidenceInput,
          rawBytes: encoder.encode("forged-candidate-bytes"),
        },
        approvals,
        assembledAt: "2026-07-19T13:40:39Z",
        signatureRequest: {
          algorithm: "Ed25519",
          keyId: "release-signing-key-1",
          requestedAt: "2026-07-19T13:40:40Z",
        },
        approvalVerifier: trustedVerifier,
        releaseSignatureAuthorizer: trustedReleaseSigner,
      }),
    /raw-response-mismatch/,
  );
});

test("gate rehashes exact bytes and reruns the canonical validation policy", () => {
  assert.throws(
    () => subjectFixture({ bytes: encoder.encode("different") }),
    /raw-response-mismatch/,
  );

  const fixture = quarantineFixture();
  const withoutRights = fixture.report.findings.filter(
    ({ code }) => code !== "publication-rights-review",
  );
  const tamperedReport = rehashReport(
    fixture.report,
    withoutRights,
    "accepted-basic",
  );
  assert.throws(
    () => subjectFixture({ report: tamperedReport }),
    /validation-policy-mismatch/,
  );
});

test("self-consistent run records cannot relocate quarantine artifacts", () => {
  const fixture = quarantineFixture();
  const relocated = structuredClone(fixture.run);
  assert.equal(relocated.state, "quarantined");
  const firstAttempt = relocated.attempts[0];
  assert.ok(firstAttempt && firstAttempt.state === "captured");
  if (relocated.state !== "quarantined" || firstAttempt.state !== "captured") {
    throw new Error("Expected captured fixture");
  }
  const relocatedKey = `quarantine/manifests/jpl-horizons/${exampleHorizonsManifest.manifestId}/relocated-capture.json`;
  relocated.capture.object.key = relocatedKey;
  firstAttempt.capture.object.key = relocatedKey;
  const { runChecksum: _oldChecksum, ...unsigned } = relocated;
  relocated.runChecksum.value = sha256Hex(stableStringify(unsigned));
  assert.doesNotThrow(() => assertConnectorRunRecordIntegrity(relocated));
  assert.throws(
    () => subjectFixture({ run: relocated }),
    /capture-object-mismatch/,
  );
});

test("promotion binds capture evidence to an admitted run and quota lease", () => {
  const fixture = quarantineFixture();
  const foreignLease = structuredClone(fixture.run);
  foreignLease.admission.quotaLeaseId = "lease_bbbbbbbbbbbbbbbbbbbbbbbb";
  assert.throws(
    () => subjectFixture({ run: rehashRun(foreignLease) }),
    /run-artifact-binding-mismatch/,
  );

  const disabledAdmission = structuredClone(fixture.run);
  disabledAdmission.admission.sourceEnabled = false;
  assert.throws(
    () => subjectFixture({ run: rehashRun(disabledAdmission) }),
    /run-artifact-binding-mismatch/,
  );

  const earlyRun = structuredClone(fixture.run);
  earlyRun.startedAt = "2026-07-19T13:39:59Z";
  assert.throws(
    () => subjectFixture({ run: rehashRun(earlyRun) }),
    /run-artifact-binding-mismatch/,
  );
});

test("known review findings map to exact roles and unknown findings fail closed", () => {
  const fixture = quarantineFixture();
  const sandboxReport = rehashReport(
    fixture.report,
    fixture.report.findings.concat({
      code: "artifact-sandbox-scan",
      outcome: "review-required",
      severity: "review",
      validator: "binary-artifact",
      validatorVersion: "1.0.0",
      message: "Sandbox review required.",
    }),
    "needs-review",
  );
  assert.deepEqual(requiredPromotionApprovalRoles(sandboxReport), [
    "scientific",
    "rights",
    "security",
  ]);

  const unknownReport = rehashReport(
    fixture.report,
    fixture.report.findings.concat({
      code: "new-review-gate",
      outcome: "review-required",
      severity: "review",
      validator: "future-validator",
      validatorVersion: "1.0.0",
      message: "Unknown review required.",
    }),
    "needs-review",
  );
  assert.throws(
    () => requiredPromotionApprovalRoles(unknownReport),
    /unknown-review-requirement/,
  );
});

test("rights target, expiry, redistribution, modification, and basis fail closed", () => {
  assert.throws(
    () =>
      subjectFixture({
        rights: rightsStatement({
          target: { kind: "source", sourceId: "src_other_source" },
        }),
      }),
    /rights-target-mismatch/,
  );
  assert.throws(
    () =>
      subjectFixture({
        rights: rightsStatement({
          reviewExpiresAt: "2026-07-19T13:40:35Z",
        }),
      }),
    /Rights review|rights/i,
  );
  assert.throws(
    () =>
      subjectFixture({
        intendedUse: {
          display: true,
          redistribute: false,
          modify: false,
          commercial: false,
        },
      }),
    /redistribution-scope-required/,
  );
  assert.throws(
    () =>
      subjectFixture({
        intendedUse: {
          display: true,
          redistribute: true,
          modify: true,
          commercial: false,
        },
      }),
    /modification-use-not-allowed/,
  );
  assert.throws(
    () =>
      subjectFixture({
        rights: rightsStatement({
          basis: { kind: "restricted", reason: "Permission required." },
        }),
      }),
    /rights-basis-not-publishable/,
  );
});

test("signatures, roles, actors, and release signer remain separated", () => {
  const fixture = subjectFixture();
  const digest = promotionSubjectDigest(fixture.subject);
  const approvals = fixture.subject.requiredApprovalRoles.map((role) =>
    approvalFor(role, digest),
  );
  const base = {
    evidenceInput: fixture.evidenceInput,
    approvals,
    assembledAt: "2026-07-19T13:40:39Z",
    signatureRequest: {
      algorithm: "Ed25519" as const,
      keyId: "release-signing-key-1",
      requestedAt: "2026-07-19T13:40:40Z",
    },
  };
  assert.throws(
    () =>
      createReleasePromotionCandidate({
        ...base,
        approvalVerifier: { verify: () => false },
        releaseSignatureAuthorizer: trustedReleaseSigner,
      }),
    /approval-signature-invalid/,
  );
  assert.throws(
    () =>
      createReleasePromotionCandidate({
        ...base,
        signatureRequest: {
          ...base.signatureRequest,
          keyId: keyByRole.scientific,
        },
        approvalVerifier: trustedVerifier,
        releaseSignatureAuthorizer: trustedReleaseSigner,
      }),
    /release-signer-not-separated/,
  );
  assert.throws(
    () =>
      createReleasePromotionCandidate({
        ...base,
        approvals: [
          approvalFor("scientific", digest, {
            actorId: "rights-reviewer",
          }),
          approvalFor("rights", digest),
        ],
        approvalVerifier: trustedVerifier,
        releaseSignatureAuthorizer: trustedReleaseSigner,
      }),
    /distinct actors/i,
  );
  assert.throws(
    () =>
      createReleasePromotionCandidate({
        ...base,
        approvalVerifier: trustedVerifier,
        releaseSignatureAuthorizer: { authorize: () => false },
      }),
    /release-signing-key-not-authorized/,
  );
  assert.throws(
    () =>
      createReleasePromotionCandidate({
        ...base,
        approvals: [
          approvalFor("scientific", digest, {
            expiresAt: "2026-07-19T13:40:39.500Z",
          }),
          approvalFor("rights", digest),
        ],
        approvalVerifier: trustedVerifier,
        releaseSignatureAuthorizer: trustedReleaseSigner,
      }),
    /approval-separation-failed/,
  );
});

test("outer candidate checksum cannot launder rights-statement tampering", () => {
  const { candidate } = candidateFixture();
  const tampered = structuredClone(candidate);
  tampered.rightsStatement.creditLine = "Replacement credit";
  const { candidateChecksum: _oldChecksum, ...unsigned } = tampered;
  tampered.candidateChecksum.value = sha256Hex(stableStringify(unsigned));
  assert.throws(
    () => assertReleasePromotionCandidateIntegrity(tampered),
    /rights-statement-mismatch/,
  );
});

test("all current source passports retain mandatory publication-rights review", () => {
  assert.equal(sourcePassports.length, 14);
  assert.equal(
    sourcePassports.every(({ rights }) => rights.reviewBeforePublication),
    true,
  );
  const mappings = sourcePassports.map(({ sourceId }) =>
    scientificSourceMappingFor(sourceId),
  );
  assert.equal(
    new Set(mappings.map(({ scientificSourceId }) => scientificSourceId)).size,
    sourcePassports.length,
  );
  assert.equal(
    mappings.every(({ mappingVersion }) => mappingVersion === "1.0.0"),
    true,
  );
});

test("authorization rechecks artifacts, rights, approvals, and keys at an explicit time", () => {
  const { candidate, evidenceInput } = candidateFixture();
  assert.throws(
    () =>
      assertReleasePromotionCandidateAuthorizations(
        candidate,
        evidenceInput,
        trustedVerifier,
        trustedReleaseSigner,
        "2026-07-19T13:40:39Z",
      ),
    /authorization-check-predates-candidate/,
  );
  assert.throws(() =>
    assertReleasePromotionCandidateAuthorizations(
      candidate,
      evidenceInput,
      trustedVerifier,
      trustedReleaseSigner,
      "not-a-date",
    ),
  );
  assert.throws(
    () =>
      assertReleasePromotionCandidateAuthorizations(
        candidate,
        evidenceInput,
        trustedVerifier,
        trustedReleaseSigner,
        "2027-07-19T13:40:35Z",
      ),
    /rights-review-invalid/,
  );
  assert.throws(
    () =>
      assertReleasePromotionCandidateAuthorizations(
        candidate,
        { ...evidenceInput, rawBytes: encoder.encode("changed-later") },
        trustedVerifier,
        trustedReleaseSigner,
        candidate.createdAt,
      ),
    /raw-response-mismatch/,
  );
});
