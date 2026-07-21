import {
  assertManifestIntegrity,
  deepFreeze,
  sha256Hex,
  stableStringify,
} from "./canonical";
import {
  FrozenRequestManifestSchema,
  type FrozenRequestManifest,
} from "./contracts";
import { assertTransportMetadata } from "./network-policy";
import {
  QuarantineCaptureSchema,
  QuarantineValidationReportSchema,
  PersistedResponseHeadersSchema,
  RUNNER_POLICY_VERSION,
  RunnerAdmissionSchema,
  type ImmutableQuarantineObject,
  type QuarantineCapture,
  type QuarantineValidationReport,
  type TransportResponseMetadata,
  type ValidationFinding,
} from "./runner-contracts";

export interface CreateQuarantineCaptureInput {
  readonly manifest: unknown;
  readonly admission: unknown;
  readonly attempt: number;
  readonly capturedAt: string;
  readonly transport: TransportResponseMetadata;
  readonly responseSha256: string;
  readonly wireByteLength: number;
  readonly decodedByteLength: number;
  readonly rawObject: ImmutableQuarantineObject;
}

function captureIdentity(identityFields: unknown) {
  return `qcap_${sha256Hex(stableStringify(identityFields)).slice(0, 24)}`;
}

function optionalHeader(
  headers: Readonly<Record<string, string>>,
  name: string,
): string | undefined {
  const value = headers[name]?.trim();
  return value ? value : undefined;
}

/** Persist only validation-relevant response headers; credential/cookie headers stay out. */
export function selectPersistedResponseHeaders(
  headers: Readonly<Record<string, string>>,
): QuarantineCapture["responseHeaders"] {
  const contentType = optionalHeader(headers, "content-type");
  const contentLengthRaw = optionalHeader(headers, "content-length");
  const parsedContentLength =
    contentLengthRaw !== undefined && /^(?:0|[1-9]\d*)$/.test(contentLengthRaw)
      ? Number(contentLengthRaw)
      : undefined;
  const contentLength =
    parsedContentLength !== undefined && Number.isSafeInteger(parsedContentLength)
      ? parsedContentLength
      : undefined;
  const contentEncoding = optionalHeader(headers, "content-encoding");
  const contentRange = optionalHeader(headers, "content-range");
  const etag = optionalHeader(headers, "etag");
  const lastModified = optionalHeader(headers, "last-modified");
  const upstreamDate = optionalHeader(headers, "date");
  const retryAfter = optionalHeader(headers, "retry-after");
  return PersistedResponseHeadersSchema.parse({
    ...(contentType === undefined ? {} : { contentType }),
    ...(contentLengthRaw === undefined ? {} : { contentLengthRaw }),
    ...(contentLength === undefined ? {} : { contentLength }),
    ...(contentEncoding === undefined ? {} : { contentEncoding }),
    ...(contentRange === undefined ? {} : { contentRange }),
    ...(etag === undefined ? {} : { etag }),
    ...(lastModified === undefined ? {} : { lastModified }),
    ...(upstreamDate === undefined ? {} : { upstreamDate }),
    ...(retryAfter === undefined ? {} : { retryAfter }),
  });
}

export function createQuarantineCapture(
  input: CreateQuarantineCaptureInput,
): QuarantineCapture {
  const manifest = FrozenRequestManifestSchema.parse(input.manifest);
  assertManifestIntegrity(manifest);
  const admission = RunnerAdmissionSchema.parse(input.admission);
  if (
    admission.quotaLease.sourceId !== manifest.sourceId ||
    Date.parse(admission.admittedAt) < Date.parse(manifest.frozenAt)
  ) {
    throw new Error("Quarantine admission is not bound to the frozen manifest");
  }
  const transport = assertTransportMetadata(manifest, input.transport);
  const responseHeaders = selectPersistedResponseHeaders(transport.headers);
  const identity = {
    releaseId: admission.releaseId,
    admittedAt: admission.admittedAt,
    quotaLeaseId: admission.quotaLease.leaseId,
    manifestId: manifest.manifestId,
    sourceId: manifest.sourceId,
    releaseLabel: manifest.releaseLabel,
    policyVersion: RUNNER_POLICY_VERSION,
    attempt: input.attempt,
    transportReceivedAt: transport.receivedAt,
    capturedAt: input.capturedAt,
    requestChecksum: manifest.requestChecksum,
    manifestChecksum: manifest.manifestChecksum,
    httpStatus: transport.status,
    requestedUrl: transport.requestedUrl,
    finalUrl: transport.finalUrl,
    dns: transport.dns,
    redirectChain: transport.redirectChain,
    responseHeaders,
    responseChecksum: {
      algorithm: "sha256" as const,
      value: input.responseSha256,
      scope: "response-bytes" as const,
    },
    wireByteLength: input.wireByteLength,
    decodedByteLength: input.decodedByteLength,
    rawObject: input.rawObject,
  };
  const captureId = captureIdentity(identity);
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    captureId,
    ...identity,
  };
  const capture = QuarantineCaptureSchema.parse({
    ...unsigned,
    captureChecksum: {
      algorithm: "sha256",
      value: sha256Hex(stableStringify(unsigned)),
      scope: "quarantine-capture",
    },
  });
  assertQuarantineCaptureIntegrity(manifest, capture);
  return deepFreeze(capture);
}

export function assertQuarantineCaptureIntegrity(
  manifestValue: unknown,
  captureValue: unknown,
): asserts captureValue is QuarantineCapture {
  const manifest = FrozenRequestManifestSchema.parse(manifestValue);
  assertManifestIntegrity(manifest);
  const capture = QuarantineCaptureSchema.parse(captureValue);
  assertTransportMetadata(manifest, {
    requestedUrl: capture.requestedUrl,
    finalUrl: capture.finalUrl,
    status: capture.httpStatus,
    headers: {},
    redirectChain: capture.redirectChain,
    dns: capture.dns,
    receivedAt: capture.transportReceivedAt,
  });
  if (
    capture.manifestId !== manifest.manifestId ||
    capture.sourceId !== manifest.sourceId ||
    capture.releaseLabel !== manifest.releaseLabel ||
    capture.requestChecksum.value !== manifest.requestChecksum.value ||
    capture.manifestChecksum.value !== manifest.manifestChecksum.value
  ) {
    throw new Error("Quarantine capture is not bound to the frozen manifest");
  }
  if (Date.parse(capture.admittedAt) < Date.parse(manifest.frozenAt)) {
    throw new Error("Quarantine admission predates the frozen manifest");
  }
  if (Date.parse(capture.transportReceivedAt) < Date.parse(manifest.frozenAt)) {
    throw new Error("Quarantine response predates the frozen manifest");
  }
  if (
    capture.rawObject.checksum.value !== capture.responseChecksum.value ||
    capture.rawObject.byteLength !== capture.wireByteLength
  ) {
    throw new Error("Quarantine raw object does not match captured response bytes");
  }
  const expectedRawPrefix = `quarantine/raw/${capture.sourceId}/${capture.manifestId}/attempt-${capture.attempt}/`;
  if (!capture.rawObject.key.startsWith(expectedRawPrefix)) {
    throw new Error("Quarantine raw object key is outside its manifest attempt path");
  }
  const expectedContentType =
    capture.responseHeaders.contentType ?? "application/octet-stream";
  if (capture.rawObject.contentType !== expectedContentType) {
    throw new Error("Quarantine raw object content type does not match capture headers");
  }
  const {
    schemaVersion: _schemaVersion,
    captureId: _captureId,
    captureChecksum: _captureChecksum,
    ...identity
  } = capture;
  const expectedId = captureIdentity(identity);
  if (capture.captureId !== expectedId) {
    throw new Error("Quarantine capture id does not match its identity fields");
  }
  const { captureChecksum, ...unsigned } = capture;
  if (sha256Hex(stableStringify(unsigned)) !== captureChecksum.value) {
    throw new Error("Quarantine capture checksum does not match its content");
  }
}

export function assertQuarantineValidationReportIntegrity(
  manifestValue: unknown,
  captureValue: unknown,
  reportValue: unknown,
): asserts reportValue is QuarantineValidationReport {
  const manifest = FrozenRequestManifestSchema.parse(manifestValue);
  const capture = QuarantineCaptureSchema.parse(captureValue);
  assertQuarantineCaptureIntegrity(manifest, capture);
  const report = QuarantineValidationReportSchema.parse(reportValue);
  if (Date.parse(report.validatedAt) < Date.parse(capture.capturedAt)) {
    throw new Error("Validation report predates its quarantine capture");
  }
  if (
    report.releaseId !== capture.releaseId ||
    report.manifestId !== manifest.manifestId ||
    report.captureId !== capture.captureId ||
    report.sourceId !== manifest.sourceId ||
    report.policyVersion !== capture.policyVersion ||
    report.captureChecksum.value !== capture.captureChecksum.value ||
    report.responseChecksum.value !== capture.responseChecksum.value
  ) {
    throw new Error("Validation report is not bound to its quarantine capture");
  }
  const expectedId = `qval_${sha256Hex(
    stableStringify({
      captureId: capture.captureId,
      captureChecksum: capture.captureChecksum,
      responseChecksum: capture.responseChecksum,
      validatedAt: report.validatedAt,
      findings: report.findings,
    }),
  ).slice(0, 24)}`;
  if (report.reportId !== expectedId) {
    throw new Error("Validation report id does not match its identity fields");
  }
  const { reportChecksum, ...unsigned } = report;
  if (sha256Hex(stableStringify(unsigned)) !== reportChecksum.value) {
    throw new Error("Validation report checksum does not match its content");
  }
}

export function manifestForCapture(
  manifestValue: unknown,
  captureValue: unknown,
): FrozenRequestManifest {
  const manifest = FrozenRequestManifestSchema.parse(manifestValue);
  assertQuarantineCaptureIntegrity(manifest, captureValue);
  return manifest;
}
