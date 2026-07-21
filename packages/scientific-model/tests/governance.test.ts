import assert from "node:assert/strict";
import test from "node:test";

import {
  GOVERNANCE_CANONICALIZATION,
  ReleaseCandidateEvidenceSubjectSchema,
  SignatureRequestSchema,
  SourceIdSchema,
  assertApprovalRecordIntegrity,
  assertReleaseCandidateEvidenceIntegrity,
  assertSignatureRequestIntegrity,
  createApprovalRecord,
  createReleaseCandidateEvidence,
  createSignatureRequest,
  releaseCandidateEvidenceSubjectSha256,
  stableJsonSha256,
  stableJsonStringify,
  type ApprovalRecord,
  type ApprovalRole,
  type ReleaseCandidateEvidenceSubject,
} from "../src/index";

const sha = {
  manifest: "1".repeat(64),
  run: "2".repeat(64),
  capture: "3".repeat(64),
  response: "4".repeat(64),
  report: "5".repeat(64),
  rights: "6".repeat(64),
} as const;

const subject = ReleaseCandidateEvidenceSubjectSchema.parse({
  releaseId: "rel_foundation",
  sourceMapping: {
    mappingVersion: "1.0.0",
    connectorSourceId: "jpl-horizons",
    scientificSourceId: "src_jpl_horizons",
  },
  manifest: {
    manifestId: `frm_${"a".repeat(24)}`,
    manifestSha256: sha.manifest,
  },
  run: {
    runId: `run_${"b".repeat(24)}`,
    runSha256: sha.run,
  },
  capture: {
    captureId: `qcap_${"c".repeat(24)}`,
    captureSha256: sha.capture,
    responseSha256: sha.response,
    rawObject: {
      storage: "r2",
      objectKey: "quarantine/rel_foundation/jpl-horizons/raw.json",
      sha256: sha.response,
      byteLength: 128,
      contentType: "application/json",
    },
  },
  validation: {
    reportId: `qval_${"d".repeat(24)}`,
    reportSha256: sha.report,
    state: "needs-review",
    validatedAt: "2026-07-19T10:10:00Z",
  },
  rights: {
    rightsId: "rgt_jpl_horizons",
    statementSha256: sha.rights,
    reviewStatus: "reviewed",
    reviewedBy: "rights-reviewer",
    reviewedAt: "2026-07-19T10:15:00Z",
    reviewExpiresAt: "2027-07-19T10:15:00Z",
  },
  intendedUse: {
    display: true,
    redistribute: true,
    modify: false,
    commercial: false,
  },
  requiredApprovalRoles: ["scientific", "rights"],
  evaluatedAt: "2026-07-19T10:20:00Z",
});

function actorFor(role: ApprovalRole): string {
  if (role === "scientific") return "science-reviewer";
  if (role === "rights") return "rights-reviewer";
  return "security-reviewer";
}

function approvalFor(
  role: ApprovalRole,
  subjectSha256: string,
  options: {
    actorId?: string;
    decision?: "approved" | "rejected";
    decidedAt?: string;
    expiresAt?: string;
  } = {},
): ApprovalRecord {
  const minute = role === "scientific" ? "30" : role === "rights" ? "31" : "32";
  return createApprovalRecord({
    role,
    actorId: options.actorId ?? actorFor(role),
    roleGrantId: `grant_${role}_review_1`,
    decision: options.decision ?? "approved",
    subjectSha256,
    decidedAt: options.decidedAt ?? `2026-07-19T10:${minute}:00Z`,
    expiresAt: options.expiresAt ?? "2027-07-19T10:40:00Z",
    signature: {
      algorithm: "Ed25519",
      keyId: `${role}-review-key-1`,
      canonicalization: GOVERNANCE_CANONICALIZATION,
      signatureBase64: Buffer.from(`${role}-approval`).toString("base64"),
    },
  });
}

function approvalsFor(
  evidenceSubject: ReleaseCandidateEvidenceSubject,
): ApprovalRecord[] {
  const subjectSha256 = releaseCandidateEvidenceSubjectSha256(evidenceSubject);
  return evidenceSubject.requiredApprovalRoles.map((role) =>
    approvalFor(role, subjectSha256),
  );
}

function evidenceFor(
  evidenceSubject: ReleaseCandidateEvidenceSubject = subject,
  approvals: readonly ApprovalRecord[] = approvalsFor(evidenceSubject),
) {
  return createReleaseCandidateEvidence({
    ...evidenceSubject,
    approvals,
    assembledAt: "2026-07-19T10:40:00Z",
  });
}

test("stable governance JSON and evidence creation are deterministic", () => {
  assert.equal(
    stableJsonStringify({ z: 1, nested: { y: 2, x: 3 }, a: 4 }),
    stableJsonStringify({ a: 4, nested: { x: 3, y: 2 }, z: 1 }),
  );

  const approvals = approvalsFor(subject);
  const forward = evidenceFor(subject, approvals);
  const reversed = evidenceFor(subject, [...approvals].reverse());

  assert.deepEqual(forward, reversed);
  assert.deepEqual(
    forward.approvals.map(({ role }) => role),
    ["scientific", "rights"],
  );
  assert.equal(Object.isFrozen(forward), true);
  assert.equal(Object.isFrozen(forward.capture.rawObject), true);
  assert.doesNotThrow(() => assertReleaseCandidateEvidenceIntegrity(forward));
  assert.equal(
    forward.evidenceChecksum.value,
    stableJsonSha256(
      Object.fromEntries(
        Object.entries(forward).filter(([key]) => key !== "evidenceChecksum"),
      ),
    ),
  );
});

test("evidence binds source mapping, exact use, rights reviewer, and raw bytes", () => {
  const evidence = evidenceFor();
  const useTamper = structuredClone(evidence);
  useTamper.intendedUse.modify = true;
  const { evidenceChecksum: _oldUseChecksum, ...useUnsigned } = useTamper;
  useTamper.evidenceChecksum.value = stableJsonSha256(useUnsigned);
  assert.throws(
    () => assertReleaseCandidateEvidenceIntegrity(useTamper),
    /subject checksum/i,
  );

  const mappingTamper = structuredClone(evidence);
  mappingTamper.sourceMapping.scientificSourceId =
    SourceIdSchema.parse("src_other_source");
  const { evidenceChecksum: _oldMappingChecksum, ...mappingUnsigned } =
    mappingTamper;
  mappingTamper.evidenceChecksum.value = stableJsonSha256(mappingUnsigned);
  assert.throws(
    () => assertReleaseCandidateEvidenceIntegrity(mappingTamper),
    /subject checksum/i,
  );

  const rawTamper = structuredClone(evidence);
  rawTamper.capture.rawObject.sha256 = "9".repeat(64);
  assert.throws(
    () => assertReleaseCandidateEvidenceIntegrity(rawTamper),
    /raw object checksum/i,
  );

  const reviewerMismatchSubject = {
    ...subject,
    rights: { ...subject.rights, reviewedBy: "different-rights-reviewer" },
  } satisfies ReleaseCandidateEvidenceSubject;
  assert.throws(
    () =>
      evidenceFor(
        reviewerMismatchSubject,
        approvalsFor(reviewerMismatchSubject).map((approval) =>
          approval.role === "rights"
            ? approvalFor("rights", approval.subjectSha256, {
                actorId: "rights-reviewer",
              })
            : approval,
        ),
      ),
    /rights approval actor/i,
  );
});

test("signed approval integrity binds role, actor, subject, key, and envelope", () => {
  const approval = approvalsFor(subject)[0];
  assert.ok(approval);
  assert.doesNotThrow(() => assertApprovalRecordIntegrity(approval));

  const tampered = structuredClone(approval);
  tampered.signature.keyId = "replacement-key";
  const { recordChecksum: _oldChecksum, ...unsigned } = tampered;
  tampered.recordChecksum.value = stableJsonSha256(unsigned);
  assert.throws(
    () => assertApprovalRecordIntegrity(tampered),
    /payload checksum/i,
  );
});

test("required approval roles are exact, canonical, and independently acted", () => {
  const securitySubject = {
    ...subject,
    requiredApprovalRoles: ["scientific", "rights", "security"],
  } satisfies ReleaseCandidateEvidenceSubject;
  const approvals = approvalsFor(securitySubject);
  const evidence = evidenceFor(securitySubject, [
    approvals[2]!,
    approvals[0]!,
    approvals[1]!,
  ]);
  assert.deepEqual(
    evidence.approvals.map(({ role }) => role),
    ["scientific", "rights", "security"],
  );

  assert.throws(
    () => evidenceFor(securitySubject, approvals.slice(0, 2)),
    /canonical required role order/i,
  );

  const digest = releaseCandidateEvidenceSubjectSha256(subject);
  assert.throws(
    () =>
      evidenceFor(subject, [
        approvalFor("scientific", digest, { actorId: "rights-reviewer" }),
        approvalFor("rights", digest),
      ]),
    /distinct actors/i,
  );

  assert.throws(
    () =>
      evidenceFor(subject, [
        approvalFor("scientific", digest, { decision: "rejected" }),
        approvalFor("rights", digest),
      ]),
    /only approved/i,
  );

  assert.throws(
    () =>
      evidenceFor(subject, [
        approvalFor("scientific", digest, {
          expiresAt: "2026-07-19T10:35:00Z",
        }),
        approvalFor("rights", digest),
      ]),
    /valid at evidence assembly/i,
  );

  assert.throws(
    () =>
      evidenceFor(subject, [
        approvalFor("scientific", digest, {
          decidedAt: "2026-07-19T10:19:59Z",
        }),
        approvalFor("rights", digest),
      ]),
    /cannot occur after assembly|follow their bound review/i,
  );
});

test("evidence permits accepted or reviewable validation, never rejected or expired rights", () => {
  assert.doesNotThrow(() => evidenceFor(subject));
  assert.doesNotThrow(() =>
    evidenceFor({
      ...subject,
      validation: { ...subject.validation, state: "accepted-basic" },
    }),
  );

  assert.throws(() =>
    evidenceFor({
      ...subject,
      validation: {
        ...subject.validation,
        state: "rejected" as "needs-review",
      },
    }),
  );
  assert.throws(
    () =>
      evidenceFor({
        ...subject,
        rights: {
          ...subject.rights,
          reviewExpiresAt: subject.evaluatedAt,
        },
      }),
    /remain valid/i,
  );
});

test("signature requests are deterministic, pending-only, and bind exact evidence", () => {
  const evidence = evidenceFor();
  const request = createSignatureRequest({
    evidence,
    algorithm: "Ed25519",
    keyId: "release-key-2026-01",
    canonicalization: GOVERNANCE_CANONICALIZATION,
    requestedAt: "2026-07-19T10:45:00Z",
  });
  const duplicate = createSignatureRequest({
    evidence,
    algorithm: "Ed25519",
    keyId: "release-key-2026-01",
    canonicalization: GOVERNANCE_CANONICALIZATION,
    requestedAt: "2026-07-19T10:45:00Z",
  });

  assert.deepEqual(request, duplicate);
  assert.equal(request.state, "pending");
  assert.equal(request.payloadSha256, evidence.evidenceChecksum.value);
  assert.doesNotThrow(() =>
    assertSignatureRequestIntegrity(request, evidence),
  );
  assert.equal(
    SignatureRequestSchema.safeParse({
      ...request,
      signatureBase64: "not-allowed",
    }).success,
    false,
  );
  assert.equal(
    SignatureRequestSchema.safeParse({ ...request, state: "fulfilled" }).success,
    false,
  );
  assert.throws(
    () =>
      createSignatureRequest({
        evidence,
        algorithm: "Ed25519",
        keyId: "release-key-2026-01",
        canonicalization: GOVERNANCE_CANONICALIZATION,
        requestedAt: "2026-07-19T10:39:59Z",
      }),
    /predate evidence assembly/i,
  );

  const selfConsistentWrongPayload = structuredClone(request);
  selfConsistentWrongPayload.payloadSha256 = "f".repeat(64);
  const identity = {
    payloadKind: selfConsistentWrongPayload.payloadKind,
    evidenceId: selfConsistentWrongPayload.evidenceId,
    payloadSha256: selfConsistentWrongPayload.payloadSha256,
    algorithm: selfConsistentWrongPayload.algorithm,
    keyId: selfConsistentWrongPayload.keyId,
    canonicalization: selfConsistentWrongPayload.canonicalization,
    requestedAt: selfConsistentWrongPayload.requestedAt,
  };
  selfConsistentWrongPayload.signatureRequestId = `sigreq_${stableJsonSha256(
    identity,
  ).slice(0, 24)}`;
  const { requestChecksum: _oldChecksum, ...unsigned } =
    selfConsistentWrongPayload;
  selfConsistentWrongPayload.requestChecksum.value = stableJsonSha256(unsigned);
  assert.throws(
    () =>
      assertSignatureRequestIntegrity(selfConsistentWrongPayload, evidence),
    /does not bind/i,
  );
});
