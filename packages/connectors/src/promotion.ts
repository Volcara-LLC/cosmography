import {
  GOVERNANCE_CANONICALIZATION,
  IntendedReleaseUseSchema,
  ReleaseCandidateEvidenceSchema,
  ReleaseCandidateEvidenceSubjectSchema,
  RightsStatementSchema,
  SignatureRequestSchema,
  approvalRecordSigningPayload,
  assertReleaseCandidateEvidenceIntegrity,
  assertSignatureRequestIntegrity,
  canPublishAsset,
  createReleaseCandidateEvidence,
  createSignatureRequest,
  deepFreezeGovernanceRecord,
  releaseCandidateEvidenceSubjectSha256,
  stableJsonSha256,
  stableJsonStringify,
  type ApprovalRecord,
  type ApprovalRole,
  type ReleaseCandidateEvidence,
  type ReleaseCandidateEvidenceSubject,
  type RightsStatement,
} from "@cosmography/scientific-model";
import { z } from "zod";

import {
  assertManifestIntegrity,
  sha256Hex,
  stableStringify,
} from "./canonical";
import { FrozenRequestManifestSchema } from "./contracts";
import {
  assertQuarantineCaptureIntegrity,
  assertQuarantineValidationReportIntegrity,
} from "./quarantine";
import { validateQuarantinedResponse } from "./response-validation";
import { assertConnectorRunRecordIntegrity } from "./runner";
import { scientificSourceMappingFor } from "./scientific-source-map";
import {
  ConnectorRunRecordSchema,
  QuarantineCaptureSchema,
  QuarantineValidationReportSchema,
  type ImmutableQuarantineManifestObject,
  type ValidationFinding,
} from "./runner-contracts";

export const PROMOTION_POLICY_VERSION = "1.0.0";

export class PromotionGateError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PromotionGateError";
  }
}

export const ReleaseCandidateObjectKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(1_024)
  .refine((value) => value.startsWith("release-candidates/"), {
    message: "Unsigned promotion objects must remain in release-candidates",
  })
  .refine(
    (value) =>
      !value.includes("\\") &&
      !value.split("/").some((segment) => segment === ".." || segment === ""),
    { message: "Release-candidate object keys must be canonical relative paths" },
  );

const CandidateChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: z.string().regex(/^[a-f0-9]{64}$/),
    scope: z.literal("promotion-candidate"),
  })
  .strict();

/**
 * An unsigned review object only. It contains neither a release signature nor
 * a publication/activation capability.
 */
export const ReleasePromotionCandidateSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    policyVersion: z.literal(PROMOTION_POLICY_VERSION),
    candidateId: z.string().regex(/^pcand_[a-f0-9]{24}$/),
    state: z.literal("awaiting-signature-and-activation"),
    destinationKey: ReleaseCandidateObjectKeySchema,
    evidence: ReleaseCandidateEvidenceSchema,
    rightsStatement: RightsStatementSchema,
    signatureRequest: SignatureRequestSchema,
    createdAt: z.iso.datetime({ offset: true }),
    candidateChecksum: CandidateChecksumSchema,
  })
  .strict();
export type ReleasePromotionCandidate = z.infer<
  typeof ReleasePromotionCandidateSchema
>;

export interface ApprovalSignatureVerifier {
  /**
   * Verify signature bytes plus current key purpose, role grant, validity, and
   * revocation state. Returning true is an authorization decision, not merely
   * a mathematical signature check.
   */
  verify(input: {
    readonly role: ApprovalRole;
    readonly actorId: string;
    readonly roleGrantId: string;
    readonly decidedAt: string;
    readonly expiresAt?: string;
    readonly checkedAt: string;
    readonly payload: string;
    readonly payloadSha256: string;
    readonly signature: ApprovalRecord["signature"];
  }): boolean;
}

export interface ReleaseSignatureRequestAuthorizer {
  /** Resolve release-key purpose, principal, validity, and revocation state. */
  authorize(input: {
    readonly algorithm: "Ed25519" | "ECDSA-P256-SHA256";
    readonly keyId: string;
    readonly canonicalization: typeof GOVERNANCE_CANONICALIZATION;
    readonly payloadSha256: string;
    readonly requestedAt: string;
    readonly checkedAt: string;
    readonly reviewerKeyIds: readonly string[];
  }): boolean;
}

const reviewRoleByFinding = new Map<string, readonly ApprovalRole[]>([
  ["rights-policy:1.0.0:publication-rights-review", ["rights"]],
  ["nasa-pds4:1.0.0:pds-search-schema-review", ["scientific"]],
  ["stsci-mast:1.0.0:mast-invoke-schema-review", ["scientific"]],
  ["ivoa-tap:1.0.0:tap-schema-review", ["scientific"]],
  ["nasa-ned:1.0.0:ned-schema-review", ["scientific"]],
  ["ivoa-tap:1.0.0:fits-sandbox-scan", ["scientific", "security"]],
  [
    "binary-artifact:1.0.0:artifact-sandbox-scan",
    ["scientific", "security"],
  ],
]);

function reviewFindingKey(finding: ValidationFinding): string {
  return `${finding.validator}:${finding.validatorVersion}:${finding.code}`;
}

/** Exact policy mapping; an unrecognized human-review requirement cannot pass. */
export function requiredPromotionApprovalRoles(
  reportValue: unknown,
): readonly ApprovalRole[] {
  const report = QuarantineValidationReportSchema.parse(reportValue);
  if (
    report.state === "rejected" ||
    report.findings.some(({ outcome }) => outcome === "fail")
  ) {
    throw new PromotionGateError("validation-rejected");
  }
  const roles = new Set<ApprovalRole>(["scientific", "rights"]);
  for (const finding of report.findings) {
    if (finding.outcome !== "review-required") continue;
    const mapped = reviewRoleByFinding.get(reviewFindingKey(finding));
    if (mapped === undefined) {
      throw new PromotionGateError("unknown-review-requirement");
    }
    for (const role of mapped) roles.add(role);
  }
  return roles.has("security")
    ? (["scientific", "rights", "security"] as const)
    : (["scientific", "rights"] as const);
}

function assertManifestRecordObject(
  value: unknown,
  object: ImmutableQuarantineManifestObject,
  expectedKey: string,
  code: string,
): void {
  const canonicalJson = stableStringify(value);
  const byteLength = new TextEncoder().encode(canonicalJson).byteLength;
  if (
    object.key !== expectedKey ||
    object.checksum.value !== sha256Hex(canonicalJson) ||
    object.byteLength !== byteLength ||
    object.contentType !== "application/json"
  ) {
    throw new PromotionGateError(code);
  }
}

function assertRightsForSubject(
  statement: RightsStatement,
  subject: ReleaseCandidateEvidenceSubject,
  at: string,
): void {
  const checkedAt = z.iso.datetime({ offset: true }).parse(at);
  if (
    stableJsonSha256(statement) !== subject.rights.statementSha256 ||
    statement.rightsId !== subject.rights.rightsId ||
    statement.reviewStatus !== "reviewed" ||
    statement.reviewedBy !== subject.rights.reviewedBy ||
    statement.reviewedAt !== subject.rights.reviewedAt ||
    statement.reviewExpiresAt !== subject.rights.reviewExpiresAt
  ) {
    throw new PromotionGateError("rights-statement-mismatch");
  }
  if (
    statement.target.kind !== "source" ||
    statement.target.sourceId !== subject.sourceMapping.scientificSourceId
  ) {
    throw new PromotionGateError("rights-target-mismatch");
  }
  if (
    statement.reviewedAt === undefined ||
    statement.reviewedBy === undefined ||
    Date.parse(statement.reviewedAt) < Date.parse(statement.capturedAt) ||
    Date.parse(statement.reviewedAt) > Date.parse(checkedAt) ||
    (statement.reviewExpiresAt !== undefined &&
      Date.parse(statement.reviewExpiresAt) <= Date.parse(checkedAt))
  ) {
    throw new PromotionGateError("rights-review-invalid");
  }
  if (statement.basis.kind === "restricted" || statement.basis.kind === "unknown") {
    throw new PromotionGateError("rights-basis-not-publishable");
  }
  if (!subject.intendedUse.redistribute) {
    throw new PromotionGateError("redistribution-scope-required");
  }
  const permission = canPublishAsset(statement, {
    commercial: subject.intendedUse.commercial,
    redistribute: subject.intendedUse.redistribute,
  });
  if (!permission.allowed) {
    throw new PromotionGateError("rights-use-not-allowed");
  }
  if (
    subject.intendedUse.modify &&
    statement.useProfile.modify !== "allowed"
  ) {
    throw new PromotionGateError("modification-use-not-allowed");
  }
}

export interface CreatePromotionEvidenceSubjectInput {
  readonly manifest: unknown;
  readonly run: unknown;
  readonly capture: unknown;
  readonly validationReport: unknown;
  readonly rawBytes: Uint8Array;
  readonly rightsStatement: unknown;
  readonly intendedUse: unknown;
  readonly evaluatedAt: string;
}

/**
 * Revalidates every supplied artifact and the exact raw bytes before producing
 * the digest that reviewers sign. No approval can waive a failed machine gate.
 */
export function createPromotionEvidenceSubject(
  input: CreatePromotionEvidenceSubjectInput,
): ReleaseCandidateEvidenceSubject {
  const manifest = FrozenRequestManifestSchema.parse(input.manifest);
  assertManifestIntegrity(manifest);
  const run = ConnectorRunRecordSchema.parse(input.run);
  assertConnectorRunRecordIntegrity(run);
  const capture = QuarantineCaptureSchema.parse(input.capture);
  assertQuarantineCaptureIntegrity(manifest, capture);
  const report = QuarantineValidationReportSchema.parse(input.validationReport);
  assertQuarantineValidationReportIntegrity(manifest, capture, report);
  const finalAttempt = run.attempts.at(-1);

  if (
    run.state !== "quarantined" ||
    finalAttempt?.state !== "captured" ||
    run.releaseId !== capture.releaseId ||
    run.manifestId !== manifest.manifestId ||
    run.sourceId !== manifest.sourceId ||
    run.policyVersion !== capture.policyVersion ||
    !run.admission.sourceEnabled ||
    !run.admission.dataRightsApproved ||
    run.admission.admittedAt !== capture.admittedAt ||
    run.admission.quotaLeaseId !== capture.quotaLeaseId ||
    Date.parse(capture.admittedAt) < Date.parse(manifest.frozenAt) ||
    Date.parse(run.startedAt) < Date.parse(capture.admittedAt) ||
    finalAttempt.attempt !== capture.attempt ||
    finalAttempt.httpStatus !== capture.httpStatus ||
    Date.parse(capture.transportReceivedAt) < Date.parse(finalAttempt.startedAt) ||
    Date.parse(capture.capturedAt) < Date.parse(capture.transportReceivedAt) ||
    Date.parse(capture.capturedAt) > Date.parse(finalAttempt.completedAt) ||
    Date.parse(report.validatedAt) < Date.parse(capture.capturedAt) ||
    Date.parse(report.validatedAt) > Date.parse(finalAttempt.completedAt) ||
    run.capture.id !== capture.captureId ||
    run.validation.id !== report.reportId ||
    run.validationState !== report.state ||
    Date.parse(run.completedAt) < Date.parse(report.validatedAt) ||
    Date.parse(run.completedAt) > Date.parse(input.evaluatedAt)
  ) {
    throw new PromotionGateError("run-artifact-binding-mismatch");
  }
  assertManifestRecordObject(
    capture,
    run.capture.object,
    `quarantine/manifests/${manifest.sourceId}/${manifest.manifestId}/attempt-${capture.attempt}/capture.json`,
    "capture-object-mismatch",
  );
  assertManifestRecordObject(
    report,
    run.validation.object,
    `quarantine/manifests/${manifest.sourceId}/${manifest.manifestId}/attempt-${capture.attempt}/validation.json`,
    "validation-object-mismatch",
  );

  const responseSha256 = sha256Hex(input.rawBytes);
  if (
    responseSha256 !== capture.responseChecksum.value ||
    responseSha256 !== capture.rawObject.checksum.value ||
    input.rawBytes.byteLength !== capture.wireByteLength ||
    input.rawBytes.byteLength !== capture.rawObject.byteLength
  ) {
    throw new PromotionGateError("raw-response-mismatch");
  }

  const expectedReport = validateQuarantinedResponse({
    manifest,
    capture,
    bytes: input.rawBytes,
    validatedAt: report.validatedAt,
  });
  if (stableStringify(expectedReport) !== stableStringify(report)) {
    throw new PromotionGateError("validation-policy-mismatch");
  }
  const requiredApprovalRoles = requiredPromotionApprovalRoles(report);

  const sourceMapping = scientificSourceMappingFor(manifest.sourceId);
  const rightsStatement = RightsStatementSchema.parse(input.rightsStatement);
  const intendedUse = IntendedReleaseUseSchema.parse(input.intendedUse);
  const subject = ReleaseCandidateEvidenceSubjectSchema.parse({
    releaseId: run.releaseId,
    sourceMapping,
    manifest: {
      manifestId: manifest.manifestId,
      manifestSha256: manifest.manifestChecksum.value,
    },
    run: { runId: run.runId, runSha256: run.runChecksum.value },
    capture: {
      captureId: capture.captureId,
      captureSha256: capture.captureChecksum.value,
      responseSha256,
      rawObject: {
        storage: "r2",
        objectKey: capture.rawObject.key,
        sha256: responseSha256,
        byteLength: capture.rawObject.byteLength,
        contentType: capture.rawObject.contentType,
      },
    },
    validation: {
      reportId: report.reportId,
      reportSha256: report.reportChecksum.value,
      state: report.state,
      validatedAt: report.validatedAt,
    },
    rights: {
      rightsId: rightsStatement.rightsId,
      statementSha256: stableJsonSha256(rightsStatement),
      reviewStatus: "reviewed",
      reviewedBy: rightsStatement.reviewedBy,
      reviewedAt: rightsStatement.reviewedAt,
      reviewExpiresAt: rightsStatement.reviewExpiresAt,
    },
    intendedUse,
    requiredApprovalRoles,
    evaluatedAt: input.evaluatedAt,
  });
  assertRightsForSubject(rightsStatement, subject, input.evaluatedAt);
  return deepFreezeGovernanceRecord(subject);
}

function assertVerifiedApprovals(
  evidence: ReleaseCandidateEvidence,
  verifier: ApprovalSignatureVerifier,
  at: string,
): void {
  const checkedAt = z.iso.datetime({ offset: true }).parse(at);
  const keyIds = new Set<string>();
  for (const approval of evidence.approvals) {
    const payload = approvalRecordSigningPayload(approval);
    if (
      sha256Hex(payload) !== approval.payloadSha256 ||
      (approval.expiresAt !== undefined &&
        Date.parse(approval.expiresAt) <= Date.parse(checkedAt)) ||
      keyIds.has(approval.signature.keyId)
    ) {
      throw new PromotionGateError("approval-separation-failed");
    }
    keyIds.add(approval.signature.keyId);
    let verified = false;
    try {
      verified = verifier.verify({
        role: approval.role,
        actorId: approval.actorId,
        roleGrantId: approval.roleGrantId,
        decidedAt: approval.decidedAt,
        ...(approval.expiresAt === undefined
          ? {}
          : { expiresAt: approval.expiresAt }),
        checkedAt,
        payload,
        payloadSha256: approval.payloadSha256,
        signature: approval.signature,
      });
    } catch {
      verified = false;
    }
    if (!verified) {
      throw new PromotionGateError("approval-signature-invalid");
    }
  }
}

function candidateIdentityFields(candidate: {
  policyVersion: string;
  evidence: ReleaseCandidateEvidence;
  signatureRequest: z.infer<typeof SignatureRequestSchema>;
  createdAt: string;
}) {
  return {
    policyVersion: candidate.policyVersion,
    evidenceId: candidate.evidence.evidenceId,
    evidenceSha256: candidate.evidence.evidenceChecksum.value,
    signatureRequestId: candidate.signatureRequest.signatureRequestId,
    signatureRequestSha256: candidate.signatureRequest.requestChecksum.value,
    createdAt: candidate.createdAt,
  };
}

export interface CreateReleasePromotionCandidateInput {
  readonly evidenceInput: CreatePromotionEvidenceSubjectInput;
  readonly approvals: readonly ApprovalRecord[];
  readonly assembledAt: string;
  readonly signatureRequest: {
    readonly algorithm: "Ed25519" | "ECDSA-P256-SHA256";
    readonly keyId: string;
    readonly requestedAt: string;
  };
  readonly approvalVerifier: ApprovalSignatureVerifier;
  readonly releaseSignatureAuthorizer: ReleaseSignatureRequestAuthorizer;
}

export function createReleasePromotionCandidate(
  input: CreateReleasePromotionCandidateInput,
): ReleasePromotionCandidate {
  const requestedAt = z
    .iso
    .datetime({ offset: true })
    .parse(input.signatureRequest.requestedAt);
  const subject = createPromotionEvidenceSubject(input.evidenceInput);
  const rightsStatement = RightsStatementSchema.parse(
    input.evidenceInput.rightsStatement,
  );
  assertRightsForSubject(rightsStatement, subject, requestedAt);
  const evidence = createReleaseCandidateEvidence({
    ...subject,
    approvals: input.approvals,
    assembledAt: input.assembledAt,
  });
  assertVerifiedApprovals(
    evidence,
    input.approvalVerifier,
    requestedAt,
  );
  if (
    evidence.approvals.some(
      ({ signature }) => signature.keyId === input.signatureRequest.keyId,
    )
  ) {
    throw new PromotionGateError("release-signer-not-separated");
  }
  let signerAuthorized = false;
  try {
    signerAuthorized = input.releaseSignatureAuthorizer.authorize({
      algorithm: input.signatureRequest.algorithm,
      keyId: input.signatureRequest.keyId,
      canonicalization: GOVERNANCE_CANONICALIZATION,
      payloadSha256: evidence.evidenceChecksum.value,
      requestedAt,
      checkedAt: requestedAt,
      reviewerKeyIds: evidence.approvals.map(({ signature }) => signature.keyId),
    });
  } catch {
    signerAuthorized = false;
  }
  if (!signerAuthorized) {
    throw new PromotionGateError("release-signing-key-not-authorized");
  }
  const signatureRequest = createSignatureRequest({
    evidence,
    algorithm: input.signatureRequest.algorithm,
    keyId: input.signatureRequest.keyId,
    canonicalization: GOVERNANCE_CANONICALIZATION,
    requestedAt,
  });
  const identity = candidateIdentityFields({
    policyVersion: PROMOTION_POLICY_VERSION,
    evidence,
    signatureRequest,
    createdAt: requestedAt,
  });
  const candidateId = `pcand_${stableJsonSha256(identity).slice(0, 24)}`;
  const destinationKey = `release-candidates/${evidence.releaseId}/${candidateId}.json`;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    policyVersion: PROMOTION_POLICY_VERSION,
    candidateId,
    state: "awaiting-signature-and-activation" as const,
    destinationKey,
    evidence,
    rightsStatement,
    signatureRequest,
    createdAt: requestedAt,
  };
  const candidate = ReleasePromotionCandidateSchema.parse({
    ...unsigned,
    candidateChecksum: {
      algorithm: "sha256",
      value: stableJsonSha256(unsigned),
      scope: "promotion-candidate",
    },
  });
  assertReleasePromotionCandidateIntegrity(candidate);
  return deepFreezeGovernanceRecord(candidate);
}

export function assertReleasePromotionCandidateIntegrity(
  value: unknown,
): asserts value is ReleasePromotionCandidate {
  const candidate = ReleasePromotionCandidateSchema.parse(value);
  assertReleaseCandidateEvidenceIntegrity(candidate.evidence);
  assertSignatureRequestIntegrity(candidate.signatureRequest, candidate.evidence);
  assertRightsForSubject(
    candidate.rightsStatement,
    candidate.evidence,
    candidate.createdAt,
  );
  if (
    candidate.createdAt !== candidate.signatureRequest.requestedAt ||
    candidate.evidence.approvals.some(
      ({ signature }) => signature.keyId === candidate.signatureRequest.keyId,
    )
  ) {
    throw new PromotionGateError("candidate-signature-policy-mismatch");
  }
  const expectedId = `pcand_${stableJsonSha256(
    candidateIdentityFields(candidate),
  ).slice(0, 24)}`;
  const expectedKey = `release-candidates/${candidate.evidence.releaseId}/${expectedId}.json`;
  if (
    candidate.candidateId !== expectedId ||
    candidate.destinationKey !== expectedKey
  ) {
    throw new PromotionGateError("candidate-identity-mismatch");
  }
  const { candidateChecksum, ...unsigned } = candidate;
  if (candidateChecksum.value !== stableJsonSha256(unsigned)) {
    throw new PromotionGateError("candidate-checksum-mismatch");
  }
}

export function assertReleasePromotionCandidateApprovals(
  value: unknown,
  verifier: ApprovalSignatureVerifier,
  checkedAt: string,
): asserts value is ReleasePromotionCandidate {
  assertReleasePromotionCandidateIntegrity(value);
  const verifiedAt = z.iso.datetime({ offset: true }).parse(checkedAt);
  if (Date.parse(verifiedAt) < Date.parse(value.createdAt)) {
    throw new PromotionGateError("authorization-check-predates-candidate");
  }
  assertVerifiedApprovals(value.evidence, verifier, verifiedAt);
}

function evidenceSubjectFields(
  evidence: ReleaseCandidateEvidence,
): ReleaseCandidateEvidenceSubject {
  return ReleaseCandidateEvidenceSubjectSchema.parse({
    releaseId: evidence.releaseId,
    sourceMapping: evidence.sourceMapping,
    manifest: evidence.manifest,
    run: evidence.run,
    capture: evidence.capture,
    validation: evidence.validation,
    rights: evidence.rights,
    intendedUse: evidence.intendedUse,
    requiredApprovalRoles: evidence.requiredApprovalRoles,
    evaluatedAt: evidence.evaluatedAt,
  });
}

export function assertReleasePromotionCandidateAuthorizations(
  value: unknown,
  evidenceInput: CreatePromotionEvidenceSubjectInput,
  approvalVerifier: ApprovalSignatureVerifier,
  releaseSignatureAuthorizer: ReleaseSignatureRequestAuthorizer,
  checkedAt: string,
): asserts value is ReleasePromotionCandidate {
  const verifiedAt = z.iso.datetime({ offset: true }).parse(checkedAt);
  assertReleasePromotionCandidateApprovals(
    value,
    approvalVerifier,
    verifiedAt,
  );
  const expectedSubject = createPromotionEvidenceSubject(evidenceInput);
  if (
    stableJsonStringify(expectedSubject) !==
    stableJsonStringify(evidenceSubjectFields(value.evidence))
  ) {
    throw new PromotionGateError("candidate-artifact-evidence-mismatch");
  }
  assertRightsForSubject(value.rightsStatement, value.evidence, verifiedAt);
  let authorized = false;
  try {
    authorized = releaseSignatureAuthorizer.authorize({
      algorithm: value.signatureRequest.algorithm,
      keyId: value.signatureRequest.keyId,
      canonicalization: value.signatureRequest.canonicalization,
      payloadSha256: value.signatureRequest.payloadSha256,
      requestedAt: value.signatureRequest.requestedAt,
      checkedAt: verifiedAt,
      reviewerKeyIds: value.evidence.approvals.map(
        ({ signature }) => signature.keyId,
      ),
    });
  } catch {
    authorized = false;
  }
  if (!authorized) {
    throw new PromotionGateError("release-signing-key-not-authorized");
  }
}

export function promotionSubjectDigest(
  subject: ReleaseCandidateEvidenceSubject,
): string {
  return releaseCandidateEvidenceSubjectSha256(subject);
}
