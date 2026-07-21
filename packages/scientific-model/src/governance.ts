import { z } from "zod";

import {
  ReleaseIdSchema,
  RightsIdSchema,
  Sha256Schema,
  SourceIdSchema,
} from "./ids";
import { ReleaseSignatureSchema } from "./releases";
import {
  deepFreezeGovernanceRecord,
  stableJsonSha256,
  stableJsonStringify,
} from "./canonical";

export const GOVERNANCE_CANONICALIZATION = "cosmography-stable-json-v1";

export const ApprovalRoleSchema = z.enum([
  "scientific",
  "rights",
  "security",
]);
export type ApprovalRole = z.infer<typeof ApprovalRoleSchema>;

export const RequiredApprovalRolesSchema = z.union([
  z.tuple([z.literal("scientific"), z.literal("rights")]),
  z.tuple([
    z.literal("scientific"),
    z.literal("rights"),
    z.literal("security"),
  ]),
]);
export type RequiredApprovalRoles = z.infer<
  typeof RequiredApprovalRolesSchema
>;

const ApprovalSignatureSchema = ReleaseSignatureSchema.extend({
  canonicalization: z.literal(GOVERNANCE_CANONICALIZATION),
  signatureBase64: z
    .string()
    .trim()
    .min(4)
    .regex(
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
      "Expected canonical base64 signature bytes",
    ),
}).strict();

const ApprovalSigningFieldsSchema = z
  .object({
    role: ApprovalRoleSchema,
    actorId: z.string().trim().min(1).max(256),
    roleGrantId: z
      .string()
      .trim()
      .regex(/^grant_[A-Za-z0-9][A-Za-z0-9._:-]{5,126}$/),
    decision: z.enum(["approved", "rejected"]),
    subjectSha256: Sha256Schema,
    decidedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
    signatureAlgorithm: ApprovalSignatureSchema.shape.algorithm,
    signatureKeyId: ApprovalSignatureSchema.shape.keyId,
    canonicalization: ApprovalSignatureSchema.shape.canonicalization,
  })
  .strict()
  .superRefine((approval, context) => {
    if (
      approval.expiresAt !== undefined &&
      Date.parse(approval.expiresAt) <= Date.parse(approval.decidedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Approval expiry must follow its decision",
      });
    }
  });
export type ApprovalSigningFields = z.infer<
  typeof ApprovalSigningFieldsSchema
>;

const ApprovalRecordChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("approval-record"),
  })
  .strict();

export const ApprovalRecordSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    approvalId: z.string().regex(/^apr_[a-f0-9]{24}$/),
    role: ApprovalRoleSchema,
    actorId: z.string().trim().min(1).max(256),
    roleGrantId: ApprovalSigningFieldsSchema.shape.roleGrantId,
    decision: z.enum(["approved", "rejected"]),
    subjectSha256: Sha256Schema,
    decidedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
    payloadSha256: Sha256Schema,
    signature: ApprovalSignatureSchema,
    recordChecksum: ApprovalRecordChecksumSchema,
  })
  .strict()
  .superRefine((approval, context) => {
    if (
      approval.expiresAt !== undefined &&
      Date.parse(approval.expiresAt) <= Date.parse(approval.decidedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Approval expiry must follow its decision",
      });
    }
  });
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

export interface CreateApprovalRecordInput {
  readonly role: ApprovalRole;
  readonly actorId: string;
  readonly roleGrantId: string;
  readonly decision: "approved" | "rejected";
  readonly subjectSha256: string;
  readonly decidedAt: string;
  readonly expiresAt?: string;
  readonly signature: z.input<typeof ApprovalSignatureSchema>;
}

function approvalSigningFields(
  value: CreateApprovalRecordInput | ApprovalRecord,
): ApprovalSigningFields {
  return ApprovalSigningFieldsSchema.parse({
    role: value.role,
    actorId: value.actorId,
    roleGrantId: value.roleGrantId,
    decision: value.decision,
    subjectSha256: value.subjectSha256,
    decidedAt: value.decidedAt,
    expiresAt: value.expiresAt,
    signatureAlgorithm: value.signature.algorithm,
    signatureKeyId: value.signature.keyId,
    canonicalization: value.signature.canonicalization,
  });
}

/** Exact bytes that an approval signer signs and an injected verifier checks. */
export function approvalRecordSigningPayload(
  value: CreateApprovalRecordInput | ApprovalRecord,
): string {
  return stableJsonStringify(approvalSigningFields(value));
}

function approvalRecordIdSeed(value: {
  payloadSha256: string;
  signature: z.infer<typeof ApprovalSignatureSchema>;
}): object {
  return {
    payloadSha256: value.payloadSha256,
    signature: value.signature,
  };
}

export function createApprovalRecord(
  inputValue: CreateApprovalRecordInput,
): ApprovalRecord {
  const signature = ApprovalSignatureSchema.parse(inputValue.signature);
  const input = {
    ...inputValue,
    signature,
  };
  const signingFields = approvalSigningFields(input);
  const payloadSha256 = stableJsonSha256(signingFields);
  const approvalId = `apr_${stableJsonSha256(
    approvalRecordIdSeed({ payloadSha256, signature }),
  ).slice(0, 24)}`;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    approvalId,
    role: signingFields.role,
    actorId: signingFields.actorId,
    roleGrantId: signingFields.roleGrantId,
    decision: signingFields.decision,
    subjectSha256: signingFields.subjectSha256,
    decidedAt: signingFields.decidedAt,
    ...(signingFields.expiresAt === undefined
      ? {}
      : { expiresAt: signingFields.expiresAt }),
    payloadSha256,
    signature,
  };
  const approval = ApprovalRecordSchema.parse({
    ...unsigned,
    recordChecksum: {
      algorithm: "sha256",
      value: stableJsonSha256(unsigned),
      scope: "approval-record",
    },
  });
  assertApprovalRecordIntegrity(approval);
  return deepFreezeGovernanceRecord(approval);
}

/**
 * Checks canonical payload, identity, and record checksum consistency. Public-key
 * authenticity is deliberately left to the caller's injected verifier.
 */
export function assertApprovalRecordIntegrity(
  value: unknown,
): asserts value is ApprovalRecord {
  const approval = ApprovalRecordSchema.parse(value);
  const payloadSha256 = stableJsonSha256(approvalSigningFields(approval));
  if (approval.payloadSha256 !== payloadSha256) {
    throw new Error("Approval payload checksum does not match its signing fields");
  }
  const expectedId = `apr_${stableJsonSha256(
    approvalRecordIdSeed({
      payloadSha256,
      signature: approval.signature,
    }),
  ).slice(0, 24)}`;
  if (approval.approvalId !== expectedId) {
    throw new Error("Approval id does not match its signed payload and envelope");
  }
  const { recordChecksum, ...unsigned } = approval;
  if (recordChecksum.value !== stableJsonSha256(unsigned)) {
    throw new Error("Approval record checksum does not match its content");
  }
}

export const ConnectorSourceMappingSchema = z
  .object({
    mappingVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    connectorSourceId: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    scientificSourceId: SourceIdSchema,
  })
  .strict();
export type ConnectorSourceMapping = z.infer<
  typeof ConnectorSourceMappingSchema
>;

export const IntendedReleaseUseSchema = z
  .object({
    display: z.literal(true),
    redistribute: z.boolean(),
    modify: z.boolean(),
    commercial: z.boolean(),
  })
  .strict();
export type IntendedReleaseUse = z.infer<typeof IntendedReleaseUseSchema>;

const QuarantineObjectKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(1_024)
  .refine((value) => value.startsWith("quarantine/"), {
    message: "Candidate evidence must reference the quarantine namespace",
  })
  .refine(
    (value) =>
      !value.includes("\\") &&
      !value.split("/").some((segment) => segment === "" || segment === ".."),
    { message: "Quarantine object keys must be canonical relative paths" },
  );

const ReleaseCandidateEvidenceSubjectShape = {
  releaseId: ReleaseIdSchema,
  sourceMapping: ConnectorSourceMappingSchema,
  manifest: z
    .object({
      manifestId: z.string().regex(/^frm_[a-f0-9]{24}$/),
      manifestSha256: Sha256Schema,
    })
    .strict(),
  run: z
    .object({
      runId: z.string().regex(/^run_[a-f0-9]{24}$/),
      runSha256: Sha256Schema,
    })
    .strict(),
  capture: z
    .object({
      captureId: z.string().regex(/^qcap_[a-f0-9]{24}$/),
      captureSha256: Sha256Schema,
      responseSha256: Sha256Schema,
      rawObject: z
        .object({
          storage: z.literal("r2"),
          objectKey: QuarantineObjectKeySchema,
          sha256: Sha256Schema,
          byteLength: z.number().int().nonnegative(),
          contentType: z.string().trim().min(1).max(255),
        })
        .strict(),
    })
    .strict(),
  validation: z
    .object({
      reportId: z.string().regex(/^qval_[a-f0-9]{24}$/),
      reportSha256: Sha256Schema,
      state: z.enum(["accepted-basic", "needs-review"]),
      validatedAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
  rights: z
    .object({
      rightsId: RightsIdSchema,
      statementSha256: Sha256Schema,
      reviewStatus: z.literal("reviewed"),
      reviewedBy: z.string().trim().min(1).max(256),
      reviewedAt: z.iso.datetime({ offset: true }),
      reviewExpiresAt: z.iso.datetime({ offset: true }).optional(),
    })
    .strict(),
  intendedUse: IntendedReleaseUseSchema,
  requiredApprovalRoles: RequiredApprovalRolesSchema,
  evaluatedAt: z.iso.datetime({ offset: true }),
} as const;

function addSubjectIssues(
  subject: z.infer<z.ZodObject<typeof ReleaseCandidateEvidenceSubjectShape>>,
  context: z.core.$RefinementCtx,
): void {
  if (subject.capture.rawObject.sha256 !== subject.capture.responseSha256) {
    context.addIssue({
      code: "custom",
      path: ["capture", "rawObject", "sha256"],
      message: "Raw object checksum must match the captured response checksum",
      input: subject.capture.rawObject.sha256,
    });
  }
  const evaluatedAt = Date.parse(subject.evaluatedAt);
  if (Date.parse(subject.validation.validatedAt) > evaluatedAt) {
    context.addIssue({
      code: "custom",
      path: ["validation", "validatedAt"],
      message: "Validation cannot occur after evidence evaluation",
      input: subject.validation.validatedAt,
    });
  }
  if (Date.parse(subject.rights.reviewedAt) > evaluatedAt) {
    context.addIssue({
      code: "custom",
      path: ["rights", "reviewedAt"],
      message: "Rights review cannot occur after evidence evaluation",
      input: subject.rights.reviewedAt,
    });
  }
  if (
    subject.rights.reviewExpiresAt !== undefined &&
    Date.parse(subject.rights.reviewExpiresAt) <= evaluatedAt
  ) {
    context.addIssue({
      code: "custom",
      path: ["rights", "reviewExpiresAt"],
      message: "Rights review must remain valid at evidence evaluation",
      input: subject.rights.reviewExpiresAt,
    });
  }
}

export const ReleaseCandidateEvidenceSubjectSchema = z
  .object(ReleaseCandidateEvidenceSubjectShape)
  .strict()
  .superRefine(addSubjectIssues);
export type ReleaseCandidateEvidenceSubject = z.infer<
  typeof ReleaseCandidateEvidenceSubjectSchema
>;

export function releaseCandidateEvidenceSubjectSha256(
  value: unknown,
): string {
  return stableJsonSha256(ReleaseCandidateEvidenceSubjectSchema.parse(value));
}

const ReleaseCandidateEvidenceChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("release-candidate-evidence"),
  })
  .strict();

const ReleaseCandidateEvidenceShape = {
  schemaVersion: z.literal("1.0.0"),
  evidenceId: z.string().regex(/^pce_[a-f0-9]{24}$/),
  ...ReleaseCandidateEvidenceSubjectShape,
  subjectSha256: Sha256Schema,
  approvals: z.array(ApprovalRecordSchema).min(2).max(3),
  assembledAt: z.iso.datetime({ offset: true }),
  evidenceChecksum: ReleaseCandidateEvidenceChecksumSchema,
} as const;

function expectedApprovalRoles(
  roles: RequiredApprovalRoles,
): readonly ApprovalRole[] {
  return roles;
}

function addEvidenceIssues(
  evidence: z.infer<z.ZodObject<typeof ReleaseCandidateEvidenceShape>>,
  context: z.core.$RefinementCtx,
): void {
  addSubjectIssues(evidence, context);
  const actualRoles = evidence.approvals.map(({ role }) => role);
  const requiredRoles = expectedApprovalRoles(evidence.requiredApprovalRoles);
  if (
    actualRoles.length !== requiredRoles.length ||
    actualRoles.some((role, index) => role !== requiredRoles[index])
  ) {
    context.addIssue({
      code: "custom",
      path: ["approvals"],
      message: "Approvals must exactly match the canonical required role order",
      input: actualRoles,
    });
  }
  if (evidence.approvals.some(({ decision }) => decision !== "approved")) {
    context.addIssue({
      code: "custom",
      path: ["approvals"],
      message: "Release-candidate evidence can contain only approved decisions",
      input: evidence.approvals,
    });
  }
  if (
    evidence.approvals.some(
      ({ subjectSha256 }) => subjectSha256 !== evidence.subjectSha256,
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["approvals"],
      message: "Every approval must bind the exact evidence subject checksum",
      input: evidence.approvals,
    });
  }
  const actors = evidence.approvals.map(({ actorId }) => actorId);
  if (new Set(actors).size !== actors.length) {
    context.addIssue({
      code: "custom",
      path: ["approvals"],
      message: "Required approvals must come from distinct actors",
      input: actors,
    });
  }
  const evaluatedAt = Date.parse(evidence.evaluatedAt);
  const assembledAt = Date.parse(evidence.assembledAt);
  if (assembledAt < evaluatedAt) {
    context.addIssue({
      code: "custom",
      path: ["assembledAt"],
      message: "Evidence assembly cannot precede evaluation",
      input: evidence.assembledAt,
    });
  }
  if (
    evidence.rights.reviewExpiresAt !== undefined &&
    Date.parse(evidence.rights.reviewExpiresAt) <= assembledAt
  ) {
    context.addIssue({
      code: "custom",
      path: ["rights", "reviewExpiresAt"],
      message: "Rights review must remain valid at evidence assembly",
      input: evidence.rights.reviewExpiresAt,
    });
  }
  for (const [index, approval] of evidence.approvals.entries()) {
    const decidedAt = Date.parse(approval.decidedAt);
    const earliestDecision = Date.parse(evidence.evaluatedAt);
    if (decidedAt < earliestDecision || decidedAt > assembledAt) {
      context.addIssue({
        code: "custom",
        path: ["approvals", index, "decidedAt"],
        message:
          "Approvals must follow their bound review and cannot occur after assembly",
        input: approval.decidedAt,
      });
    }
    if (
      approval.expiresAt !== undefined &&
      Date.parse(approval.expiresAt) <= assembledAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["approvals", index, "expiresAt"],
        message: "Approval must remain valid at evidence assembly",
        input: approval.expiresAt,
      });
    }
  }
  const rightsApproval = evidence.approvals.find(
    ({ role }) => role === "rights",
  );
  if (rightsApproval?.actorId !== evidence.rights.reviewedBy) {
    context.addIssue({
      code: "custom",
      path: ["approvals"],
      message: "Rights approval actor must match the recorded rights reviewer",
      input: rightsApproval?.actorId,
    });
  }
}

export const ReleaseCandidateEvidenceSchema = z
  .object(ReleaseCandidateEvidenceShape)
  .strict()
  .superRefine(addEvidenceIssues);
export type ReleaseCandidateEvidence = z.infer<
  typeof ReleaseCandidateEvidenceSchema
>;

export interface CreateReleaseCandidateEvidenceInput
  extends ReleaseCandidateEvidenceSubject {
  readonly approvals: readonly ApprovalRecord[];
  readonly assembledAt: string;
}

function subjectFields(
  value:
    | ReleaseCandidateEvidenceSubject
    | ReleaseCandidateEvidence
    | CreateReleaseCandidateEvidenceInput,
): ReleaseCandidateEvidenceSubject {
  return ReleaseCandidateEvidenceSubjectSchema.parse({
    releaseId: value.releaseId,
    sourceMapping: value.sourceMapping,
    manifest: value.manifest,
    run: value.run,
    capture: value.capture,
    validation: value.validation,
    rights: value.rights,
    intendedUse: value.intendedUse,
    requiredApprovalRoles: value.requiredApprovalRoles,
    evaluatedAt: value.evaluatedAt,
  });
}

function evidenceIdentityFields(value: {
  subjectSha256: string;
  approvals: readonly ApprovalRecord[];
  assembledAt: string;
}): object {
  return {
    subjectSha256: value.subjectSha256,
    approvalIds: value.approvals.map(({ approvalId }) => approvalId),
    assembledAt: value.assembledAt,
  };
}

function canonicalizeApprovals(
  approvals: readonly ApprovalRecord[],
): ApprovalRecord[] {
  const order = new Map<ApprovalRole, number>([
    ["scientific", 0],
    ["rights", 1],
    ["security", 2],
  ]);
  return [...approvals].sort(
    (left, right) =>
      (order.get(left.role) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.role) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function createReleaseCandidateEvidence(
  input: CreateReleaseCandidateEvidenceInput,
): ReleaseCandidateEvidence {
  const subject = subjectFields(input);
  const approvals = canonicalizeApprovals(
    input.approvals.map((approval) => ApprovalRecordSchema.parse(approval)),
  );
  for (const approval of approvals) {
    assertApprovalRecordIntegrity(approval);
  }
  const subjectSha256 = releaseCandidateEvidenceSubjectSha256(subject);
  const identity = evidenceIdentityFields({
    subjectSha256,
    approvals,
    assembledAt: input.assembledAt,
  });
  const evidenceId = `pce_${stableJsonSha256(identity).slice(0, 24)}`;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    evidenceId,
    ...subject,
    subjectSha256,
    approvals,
    assembledAt: input.assembledAt,
  };
  const evidence = ReleaseCandidateEvidenceSchema.parse({
    ...unsigned,
    evidenceChecksum: {
      algorithm: "sha256",
      value: stableJsonSha256(unsigned),
      scope: "release-candidate-evidence",
    },
  });
  assertReleaseCandidateEvidenceIntegrity(evidence);
  return deepFreezeGovernanceRecord(evidence);
}

/** Canonical evidence bytes whose digest is recorded and requested for signing. */
export function releaseCandidateEvidenceSigningPayload(
  value: ReleaseCandidateEvidence,
): string {
  const evidence = ReleaseCandidateEvidenceSchema.parse(value);
  const { evidenceChecksum: _checksum, ...unsigned } = evidence;
  return stableJsonStringify(unsigned);
}

export function assertReleaseCandidateEvidenceIntegrity(
  value: unknown,
): asserts value is ReleaseCandidateEvidence {
  const evidence = ReleaseCandidateEvidenceSchema.parse(value);
  for (const approval of evidence.approvals) {
    assertApprovalRecordIntegrity(approval);
  }
  const subjectSha256 = releaseCandidateEvidenceSubjectSha256(
    subjectFields(evidence),
  );
  if (evidence.subjectSha256 !== subjectSha256) {
    throw new Error("Evidence subject checksum does not match its content");
  }
  const expectedId = `pce_${stableJsonSha256(
    evidenceIdentityFields({
      subjectSha256,
      approvals: evidence.approvals,
      assembledAt: evidence.assembledAt,
    }),
  ).slice(0, 24)}`;
  if (evidence.evidenceId !== expectedId) {
    throw new Error("Evidence id does not match its subject and approvals");
  }
  const { evidenceChecksum, ...unsigned } = evidence;
  if (evidenceChecksum.value !== stableJsonSha256(unsigned)) {
    throw new Error("Evidence checksum does not match its content");
  }
}

const SignatureRequestChecksumSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: Sha256Schema,
    scope: z.literal("signature-request"),
  })
  .strict();

const SignatureRequestShape = {
  schemaVersion: z.literal("1.0.0"),
  signatureRequestId: z.string().regex(/^sigreq_[a-f0-9]{24}$/),
  state: z.literal("pending"),
  payloadKind: z.literal("release-candidate-evidence"),
  evidenceId: z.string().regex(/^pce_[a-f0-9]{24}$/),
  payloadSha256: Sha256Schema,
  algorithm: ReleaseSignatureSchema.shape.algorithm,
  keyId: ReleaseSignatureSchema.shape.keyId,
  canonicalization: z.literal(GOVERNANCE_CANONICALIZATION),
  requestedAt: z.iso.datetime({ offset: true }),
  requestChecksum: SignatureRequestChecksumSchema,
} as const;

/** Pending only: this contract deliberately has no signature or activation state. */
export const SignatureRequestSchema = z
  .object(SignatureRequestShape)
  .strict();
export type SignatureRequest = z.infer<typeof SignatureRequestSchema>;

export interface CreateSignatureRequestInput {
  readonly evidence: ReleaseCandidateEvidence;
  readonly algorithm: z.input<typeof ReleaseSignatureSchema.shape.algorithm>;
  readonly keyId: string;
  readonly canonicalization: typeof GOVERNANCE_CANONICALIZATION;
  readonly requestedAt: string;
}

function signatureRequestIdentityFields(value: {
  evidenceId: string;
  payloadSha256: string;
  algorithm: z.infer<typeof ReleaseSignatureSchema.shape.algorithm>;
  keyId: string;
  canonicalization: typeof GOVERNANCE_CANONICALIZATION;
  requestedAt: string;
}): object {
  return {
    payloadKind: "release-candidate-evidence",
    evidenceId: value.evidenceId,
    payloadSha256: value.payloadSha256,
    algorithm: value.algorithm,
    keyId: value.keyId,
    canonicalization: value.canonicalization,
    requestedAt: value.requestedAt,
  };
}

export function createSignatureRequest(
  input: CreateSignatureRequestInput,
): SignatureRequest {
  assertReleaseCandidateEvidenceIntegrity(input.evidence);
  if (Date.parse(input.requestedAt) < Date.parse(input.evidence.assembledAt)) {
    throw new Error("Signature request cannot predate evidence assembly");
  }
  const identity = signatureRequestIdentityFields({
    evidenceId: input.evidence.evidenceId,
    payloadSha256: input.evidence.evidenceChecksum.value,
    algorithm: input.algorithm,
    keyId: input.keyId,
    canonicalization: input.canonicalization,
    requestedAt: input.requestedAt,
  });
  const signatureRequestId = `sigreq_${stableJsonSha256(identity).slice(0, 24)}`;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    signatureRequestId,
    state: "pending" as const,
    ...identity,
  };
  const request = SignatureRequestSchema.parse({
    ...unsigned,
    requestChecksum: {
      algorithm: "sha256",
      value: stableJsonSha256(unsigned),
      scope: "signature-request",
    },
  });
  assertSignatureRequestIntegrity(request, input.evidence);
  return deepFreezeGovernanceRecord(request);
}

export function assertSignatureRequestIntegrity(
  value: unknown,
  evidenceValue?: unknown,
): asserts value is SignatureRequest {
  const request = SignatureRequestSchema.parse(value);
  const identity = signatureRequestIdentityFields(request);
  const expectedId = `sigreq_${stableJsonSha256(identity).slice(0, 24)}`;
  if (request.signatureRequestId !== expectedId) {
    throw new Error("Signature request id does not match its signing policy");
  }
  const { requestChecksum, ...unsigned } = request;
  if (requestChecksum.value !== stableJsonSha256(unsigned)) {
    throw new Error("Signature request checksum does not match its content");
  }
  if (evidenceValue !== undefined) {
    assertReleaseCandidateEvidenceIntegrity(evidenceValue);
    if (
      request.evidenceId !== evidenceValue.evidenceId ||
      request.payloadSha256 !== evidenceValue.evidenceChecksum.value ||
      Date.parse(request.requestedAt) < Date.parse(evidenceValue.assembledAt)
    ) {
      throw new Error("Signature request does not bind the supplied evidence");
    }
  }
}
