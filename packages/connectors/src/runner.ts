import { createHash } from "node:crypto";

import { z } from "zod";

import {
  assertManifestIntegrity,
  deepFreeze,
  sha256Hex,
  stableStringify,
} from "./canonical";
import {
  FrozenRequestManifestSchema,
  type FrozenRequestManifest,
  type SourcePassport,
} from "./contracts";
import {
  assertManifestRequestAllowed,
  assertTransportMetadata,
  RunnerPolicyError,
} from "./network-policy";
import {
  createQuarantineCapture,
  selectPersistedResponseHeaders,
} from "./quarantine";
import { getSourcePassport } from "./registry";
import { validateQuarantinedResponse } from "./response-validation";
import {
  ConnectorRunRecordSchema,
  ConnectorTransportError,
  DEFAULT_RUNNER_POLICY,
  ImmutableQuarantineManifestObjectSchema,
  ImmutableQuarantineObjectSchema,
  RUNNER_POLICY_VERSION,
  RunnerAdmissionSchema,
  RunnerPolicySchema,
  type ConnectorRunRecord,
  type ConnectorSecretResolver,
  type ConnectorTransport,
  type ImmutableQuarantineManifestObject,
  type ImmutableQuarantineObject,
  type ImmutableQuarantineStore,
  type QuarantineCapture,
  type QuarantineValidationReport,
  type RunnerAdmission,
  type RunnerAttempt,
  type RunnerPolicy,
  type SandboxedTransportRequest,
  type SandboxedTransportResponse,
} from "./runner-contracts";

const ClockInstantSchema = z.iso.datetime({ offset: true });
const encoder = new TextEncoder();

export interface RunnerClock {
  now(): string;
  sleep(delayMs: number): Promise<void>;
  withDeadline<T>(
    operation: Promise<T>,
    timeoutMs: number,
    timeoutError: Error,
    onTimeout: () => void,
  ): Promise<T>;
}

export const SYSTEM_RUNNER_CLOCK: RunnerClock = {
  now: () => new Date().toISOString(),
  sleep: (delayMs) =>
    new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    }),
  withDeadline: (operation, timeoutMs, timeoutError, onTimeout) =>
    new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          onTimeout();
        } catch {
          // Timeout rejection remains authoritative if cancellation itself fails.
        }
        reject(timeoutError);
      }, timeoutMs);
      operation.then(
        (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        },
      );
    }),
};

export interface ConnectorRunnerDependencies {
  readonly transport: ConnectorTransport;
  readonly secretResolver: ConnectorSecretResolver;
  readonly store: ImmutableQuarantineStore;
  readonly clock: RunnerClock;
  readonly policy?: RunnerPolicy;
}

export interface RunConnectorManifestInput {
  readonly manifest: unknown;
  readonly admission: unknown;
}

interface ManifestArtifactReference {
  readonly id: string;
  readonly object: ImmutableQuarantineManifestObject;
}

type PreparedTransportRequest = Omit<SandboxedTransportRequest, "signal">;

export class RunnerExecutionError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "RunnerExecutionError";
    this.code = code;
  }
}

function clockInstant(clock: RunnerClock): string {
  return ClockInstantSchema.parse(clock.now());
}

function byteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

function headerByteLength(headers: Readonly<Record<string, string>>): number {
  return Object.entries(headers).reduce(
    (total, [name, value]) =>
      total + byteLength(name) + 2 + byteLength(value) + 2,
    0,
  );
}

function errorCode(error: unknown): string {
  if (
    error instanceof ConnectorTransportError ||
    error instanceof RunnerPolicyError ||
    error instanceof RunnerExecutionError
  ) {
    return error.code;
  }
  return "runner-internal";
}

async function bestEffortAbort(
  response: SandboxedTransportResponse | undefined,
  reasonCode: string,
  clock: RunnerClock,
  timeoutMs: number,
): Promise<void> {
  try {
    if (response) {
      await clock.withDeadline(
        response.abort(reasonCode),
        Math.max(100, Math.min(1_000, timeoutMs)),
        new RunnerExecutionError("transport-abort-timeout"),
        () => {},
      );
    }
  } catch {
    // The original failure remains authoritative; abort errors are not persisted.
  }
}

interface RunAdmissionEvidenceInput {
  readonly admittedAt: string;
  readonly quotaLeaseId: string;
  readonly sourceEnabled: boolean;
  readonly dataRightsApproved: boolean;
  readonly auditedOverrideId?: string | undefined;
}

function canonicalAdmissionEvidence(admission: RunAdmissionEvidenceInput) {
  return {
    admittedAt: admission.admittedAt,
    quotaLeaseId: admission.quotaLeaseId,
    sourceEnabled: admission.sourceEnabled,
    dataRightsApproved: admission.dataRightsApproved,
    ...(admission.auditedOverrideId === undefined
      ? {}
      : { auditedOverrideId: admission.auditedOverrideId }),
  };
}

function admissionEvidence(admission: RunnerAdmission) {
  return canonicalAdmissionEvidence({
    admittedAt: admission.admittedAt,
    quotaLeaseId: admission.quotaLease.leaseId,
    sourceEnabled: admission.sourceEnabled,
    dataRightsApproved: admission.dataRightsApproved,
    ...(admission.auditedOverrideId === undefined
      ? {}
      : { auditedOverrideId: admission.auditedOverrideId }),
  });
}

function runIdentityFields(run: {
  releaseId: string;
  manifestId: string;
  sourceId: string;
  policyVersion: string;
  admission: RunAdmissionEvidenceInput;
  startedAt: string;
}) {
  return {
    releaseId: run.releaseId,
    manifestId: run.manifestId,
    sourceId: run.sourceId,
    policyVersion: run.policyVersion,
    admission: canonicalAdmissionEvidence(run.admission),
    startedAt: run.startedAt,
  };
}

export function assertConnectorRunRecordIntegrity(
  value: unknown,
): asserts value is ConnectorRunRecord {
  const run = ConnectorRunRecordSchema.parse(value);
  const expectedRunId = `run_${sha256Hex(
    stableStringify(runIdentityFields(run)),
  ).slice(0, 24)}`;
  if (run.runId !== expectedRunId) {
    throw new RunnerExecutionError("run-id-mismatch");
  }
  const { runChecksum, ...unsigned } = run;
  if (sha256Hex(stableStringify(unsigned)) !== runChecksum.value) {
    throw new RunnerExecutionError("run-checksum-mismatch");
  }
  if (Date.parse(run.completedAt) < Date.parse(run.startedAt)) {
    throw new RunnerExecutionError("run-time-order");
  }
  for (const attempt of run.attempts) {
    if (
      Date.parse(attempt.completedAt) < Date.parse(attempt.startedAt) ||
      Date.parse(attempt.startedAt) < Date.parse(run.startedAt) ||
      Date.parse(attempt.completedAt) > Date.parse(run.completedAt)
    ) {
      throw new RunnerExecutionError("attempt-time-order");
    }
  }
  if (run.state === "quarantined") {
    const lastAttempt = run.attempts.at(-1);
    if (
      lastAttempt?.state !== "captured" ||
      stableStringify(lastAttempt.capture) !== stableStringify(run.capture) ||
      stableStringify(lastAttempt.validation) !==
        stableStringify(run.validation) ||
      lastAttempt.validationState !== run.validationState
    ) {
      throw new RunnerExecutionError("run-final-artifact-mismatch");
    }
  }
}

function createRunRecord(input: {
  readonly manifest: FrozenRequestManifest;
  readonly admission: RunnerAdmission;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly attempts: readonly RunnerAttempt[];
  readonly outcome:
    | {
        readonly state: "quarantined";
        readonly capture: ManifestArtifactReference;
        readonly validation: ManifestArtifactReference;
        readonly validationState: QuarantineValidationReport["state"];
      }
    | {
        readonly state: "manual-required" | "killed" | "failed";
        readonly errorCode: string;
      };
}): ConnectorRunRecord {
  const evidence = admissionEvidence(input.admission);
  const identity = runIdentityFields({
    releaseId: input.admission.releaseId,
    manifestId: input.manifest.manifestId,
    sourceId: input.manifest.sourceId,
    policyVersion: RUNNER_POLICY_VERSION,
    admission: evidence,
    startedAt: input.startedAt,
  });
  const runId = `run_${sha256Hex(stableStringify(identity)).slice(0, 24)}`;
  const unsigned = {
    schemaVersion: "1.0.0" as const,
    runId,
    ...identity,
    completedAt: input.completedAt,
    attemptCount: input.attempts.length,
    attempts: input.attempts,
    ...input.outcome,
  };
  const run = ConnectorRunRecordSchema.parse({
    ...unsigned,
    runChecksum: {
      algorithm: "sha256",
      value: sha256Hex(stableStringify(unsigned)),
      scope: "connector-run",
    },
  });
  assertConnectorRunRecordIntegrity(run);
  return deepFreeze(run);
}

async function putCanonicalManifest(
  store: ImmutableQuarantineStore,
  key: string,
  value: unknown,
  clock: RunnerClock,
  timeoutMs: number,
): Promise<ImmutableQuarantineManifestObject> {
  const canonicalJson = stableStringify(value);
  const sha256 = sha256Hex(canonicalJson);
  const stored = ImmutableQuarantineManifestObjectSchema.parse(
    await clock.withDeadline(
      store.putManifest({ key, canonicalJson, sha256, ifAbsent: true }),
      timeoutMs,
      new RunnerExecutionError("immutable-store-timeout"),
      () => {},
    ),
  );
  if (
    stored.key !== key ||
    stored.contentType !== "application/json" ||
    stored.byteLength !== byteLength(canonicalJson) ||
    stored.checksum.value !== sha256
  ) {
    throw new RunnerExecutionError("immutable-manifest-mismatch");
  }
  return deepFreeze(stored);
}

type RunOutcome = Parameters<typeof createRunRecord>[0]["outcome"];

async function finishRun(input: {
  readonly dependencies: ConnectorRunnerDependencies;
  readonly manifest: FrozenRequestManifest;
  readonly admission: RunnerAdmission;
  readonly startedAt: string;
  readonly attempts: readonly RunnerAttempt[];
  readonly outcome: RunOutcome;
}): Promise<ConnectorRunRecord> {
  const completedAt = clockInstant(input.dependencies.clock);
  const run = createRunRecord({
    manifest: input.manifest,
    admission: input.admission,
    startedAt: input.startedAt,
    completedAt,
    attempts: input.attempts,
    outcome: input.outcome,
  });
  await putCanonicalManifest(
    input.dependencies.store,
    `quarantine/runs/${input.manifest.sourceId}/${input.manifest.manifestId}/${run.runId}.json`,
    run,
    input.dependencies.clock,
    input.dependencies.policy?.limits.totalTimeoutMs ??
      DEFAULT_RUNNER_POLICY.limits.totalTimeoutMs,
  );
  return run;
}

function declaredRecordLimit(manifest: FrozenRequestManifest): number | undefined {
  for (const key of ["maxRecords", "limit", "pageSize"] as const) {
    const value = manifest.intent[key];
    if (typeof value === "number" && Number.isInteger(value)) return value;
  }
  return undefined;
}

function admissionDecision(input: {
  manifest: FrozenRequestManifest;
  passport: SourcePassport;
  admission: RunnerAdmission;
  startedAt: string;
  policy: RunnerPolicy;
}): { state: "allowed" } | { state: "manual-required" | "killed"; code: string } {
  const { manifest, passport, admission, startedAt, policy } = input;
  if (
    manifest.request.kind === "manual" ||
    passport.auth.mode === "interactive-account" ||
    (manifest.request.kind === "http" &&
      manifest.request.auth.mode === "interactive-account")
  ) {
    return { state: "manual-required", code: "interactive-review-required" };
  }
  if (
    manifest.intent.kind === "tap" &&
    manifest.intent.execution === "async"
  ) {
    return { state: "manual-required", code: "async-tap-workflow-required" };
  }
  if (!admission.sourceEnabled) {
    return { state: "killed", code: "source-disabled" };
  }
  if (!passport.killSwitch.defaultEnabled && !admission.auditedOverrideId) {
    return { state: "killed", code: "audited-override-required" };
  }
  if (
    (passport.auth.dataRightsRequired || !passport.rights.publicMetadataAccess) &&
    !admission.dataRightsApproved
  ) {
    return { state: "killed", code: "data-rights-required" };
  }
  const admittedAtMs = Date.parse(admission.admittedAt);
  const startedAtMs = Date.parse(startedAt);
  const lease = admission.quotaLease;
  if (
    Date.parse(manifest.frozenAt) > admittedAtMs ||
    admittedAtMs > startedAtMs
  ) {
    return { state: "killed", code: "admission-time-policy" };
  }
  if (lease.sourceId !== manifest.sourceId) {
    return { state: "killed", code: "quota-source-mismatch" };
  }
  if (
    Date.parse(lease.notBefore) > admittedAtMs ||
    Date.parse(lease.notBefore) > startedAtMs
  ) {
    return { state: "killed", code: "quota-not-active" };
  }
  if (
    Date.parse(lease.expiresAt) <= admittedAtMs ||
    Date.parse(lease.expiresAt) <= startedAtMs
  ) {
    return { state: "killed", code: "quota-expired" };
  }
  if (lease.maxConcurrency > passport.quota.localMaxConcurrency) {
    return { state: "killed", code: "quota-concurrency-policy" };
  }
  const recordLimit = declaredRecordLimit(manifest);
  if (
    recordLimit !== undefined &&
    (recordLimit > policy.limits.maxRecords ||
      (passport.quota.localMaxRowsPerRequest !== undefined &&
        recordLimit > passport.quota.localMaxRowsPerRequest))
  ) {
    return { state: "killed", code: "record-limit-policy" };
  }
  return { state: "allowed" };
}

const forbiddenRequestHeaders = new Set([
  "accept-encoding",
  "authorization",
  "connection",
  "content-length",
  "cookie",
  "host",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const headerNamePattern = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

async function prepareTransportRequest(input: {
  manifest: FrozenRequestManifest;
  passport: SourcePassport;
  policy: RunnerPolicy;
  secretResolver: ConnectorSecretResolver;
  clock: RunnerClock;
}): Promise<PreparedTransportRequest> {
  const manifest = assertManifestRequestAllowed(input.manifest);
  if (manifest.request.kind !== "http") {
    throw new RunnerExecutionError("manual-request");
  }
  const { request } = manifest;
  if (byteLength(request.url) > input.policy.limits.maxUrlBytes) {
    throw new RunnerExecutionError("request-url-limit");
  }
  if (
    request.body !== undefined &&
    byteLength(request.body) > input.policy.limits.maxRequestBodyBytes
  ) {
    throw new RunnerExecutionError("request-body-limit");
  }

  const headers: Record<string, string> = {};
  for (const [rawName, value] of Object.entries(request.headers)) {
    const name = rawName.toLowerCase();
    if (
      !headerNamePattern.test(rawName) ||
      forbiddenRequestHeaders.has(name) ||
      name in headers ||
      /[\0\r\n]/.test(value)
    ) {
      throw new RunnerExecutionError("request-header-policy");
    }
    headers[name] = value;
  }
  headers["accept-encoding"] = "identity";

  if (request.auth.mode === "bearer-env") {
    const envKey = request.auth.envKey;
    if (
      envKey === undefined ||
      input.passport.auth.mode !== "bearer-token" ||
      envKey !== input.passport.auth.secretEnv
    ) {
      throw new RunnerExecutionError("secret-reference-policy");
    }
    let token: string | undefined;
    try {
      token = await input.clock.withDeadline(
        input.secretResolver.resolve(envKey),
        input.policy.limits.connectTimeoutMs,
        new RunnerExecutionError("secret-timeout"),
        () => {},
      );
    } catch (error) {
      if (error instanceof RunnerExecutionError) throw error;
      throw new RunnerExecutionError("secret-unavailable");
    }
    if (
      token === undefined ||
      token.length === 0 ||
      token !== token.trim() ||
      byteLength(token) > 8_192 ||
      /[\0\r\n]/.test(token)
    ) {
      throw new RunnerExecutionError("secret-unavailable");
    }
    headers.authorization = `Bearer ${token}`;
  } else if (request.auth.mode !== "none") {
    throw new RunnerExecutionError("interactive-review-required");
  }

  if (headerByteLength(headers) > input.policy.limits.maxRequestHeaderBytes) {
    throw new RunnerExecutionError("request-header-limit");
  }
  return deepFreeze({
    method: request.method,
    url: request.url,
    headers,
    ...(request.body === undefined ? {} : { body: request.body }),
    limits: input.policy.limits,
    redirectMode: "error",
    requirePublicAddresses: true,
  });
}

function deterministicRetryDelay(
  manifest: FrozenRequestManifest,
  attempt: number,
  retryAfter: string | undefined,
  receivedAt: string | undefined,
  minimumDelayMs: number,
): number {
  const retry = manifest.retry;
  if (retry.strategy === "none") return minimumDelayMs;
  const exponential = Math.min(
    retry.maxDelayMs,
    retry.initialDelayMs * 2 ** Math.max(0, attempt - 1),
  );
  let delay = exponential;
  if (retry.jitter === "full" && exponential > 0) {
    const seed = sha256Hex(`${manifest.manifestId}:${attempt}:retry`);
    delay = Number.parseInt(seed.slice(0, 8), 16) % (exponential + 1);
  }
  if (retry.honorRetryAfter && retryAfter !== undefined) {
    let retryAfterMs: number | undefined;
    if (/^(?:0|[1-9]\d*)$/.test(retryAfter)) {
      retryAfterMs = Number(retryAfter) * 1_000;
    } else if (receivedAt !== undefined) {
      const target = Date.parse(retryAfter);
      const received = Date.parse(receivedAt);
      if (Number.isFinite(target)) retryAfterMs = Math.max(0, target - received);
    }
    if (retryAfterMs !== undefined && Number.isSafeInteger(retryAfterMs)) {
      delay = Math.max(delay, Math.min(retry.maxDelayMs, retryAfterMs));
    }
  }
  return Math.max(
    minimumDelayMs,
    Math.min(retry.maxDelayMs, Math.max(0, Math.trunc(delay))),
  );
}

function copyBytes(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function captureAttempt(input: {
  dependencies: ConnectorRunnerDependencies;
  manifest: FrozenRequestManifest;
  admission: RunnerAdmission;
  policy: RunnerPolicy;
  attempt: number;
  startedAt: string;
  response: SandboxedTransportResponse;
  abortController: AbortController;
}): Promise<{
  attempt: Extract<RunnerAttempt, { state: "captured" }>;
  capture: QuarantineCapture;
  captureObject: ImmutableQuarantineManifestObject;
  validation: QuarantineValidationReport;
  validationObject: ImmutableQuarantineManifestObject;
}> {
  const metadata = assertTransportMetadata(input.manifest, input.response.metadata);
  const afterHeadersAt = clockInstant(input.dependencies.clock);
  if (
    Date.parse(metadata.receivedAt) < Date.parse(input.startedAt) ||
    Date.parse(metadata.receivedAt) > Date.parse(afterHeadersAt)
  ) {
    throw new RunnerExecutionError("transport-time-policy");
  }
  if (
    headerByteLength(metadata.headers) >
    input.policy.limits.maxResponseHeaderBytes
  ) {
    throw new RunnerExecutionError("response-header-limit");
  }

  const rawKey = `quarantine/raw/${input.manifest.sourceId}/${input.manifest.manifestId}/attempt-${input.attempt}/payload.bin`;
  const persistedHeaders = selectPersistedResponseHeaders(metadata.headers);
  const contentType = persistedHeaders.contentType ?? "application/octet-stream";
  const writer = await input.dependencies.clock.withDeadline(
    input.dependencies.store.begin({
      key: rawKey,
      expectedContentType: contentType,
      metadata: {
        release_id: input.admission.releaseId,
        manifest_id: input.manifest.manifestId,
        source_id: input.manifest.sourceId,
        attempt: String(input.attempt),
        policy_version: input.policy.version,
        request_checksum: input.manifest.requestChecksum.value,
      },
      ifAbsent: true,
    }),
    input.policy.limits.totalTimeoutMs,
    new RunnerExecutionError("immutable-store-timeout"),
    () => input.abortController.abort("immutable-store-timeout"),
  );
  const hash = createHash("sha256");
  const chunks: Uint8Array[] = [];
  let wireByteLength = 0;
  let committed = false;
  try {
    const iterator = input.response.body[Symbol.asyncIterator]();
    while (true) {
      const elapsedMs =
        Date.parse(clockInstant(input.dependencies.clock)) -
        Date.parse(input.startedAt);
      const remainingMs = input.policy.limits.totalTimeoutMs - elapsedMs;
      if (remainingMs <= 0) {
        throw new ConnectorTransportError("total-timeout", true);
      }
      const next = await input.dependencies.clock.withDeadline(
        iterator.next(),
        remainingMs,
        new ConnectorTransportError("total-timeout", true),
        () => input.abortController.abort("total-timeout"),
      );
      if (next.done) break;
      const candidate = next.value;
      if (!(candidate instanceof Uint8Array)) {
        throw new RunnerExecutionError("response-chunk-type");
      }
      const nextLength = wireByteLength + candidate.byteLength;
      if (
        nextLength > input.policy.limits.maxResponseWireBytes ||
        nextLength > input.policy.limits.maxDecodedBytes
      ) {
        throw new RunnerExecutionError("response-byte-limit");
      }
      const stableChunk = candidate.slice();
      hash.update(stableChunk);
      const writeElapsedMs =
        Date.parse(clockInstant(input.dependencies.clock)) -
        Date.parse(input.startedAt);
      const writeRemainingMs =
        input.policy.limits.totalTimeoutMs - writeElapsedMs;
      if (writeRemainingMs <= 0) {
        throw new ConnectorTransportError("total-timeout", true);
      }
      await input.dependencies.clock.withDeadline(
        writer.write(stableChunk),
        writeRemainingMs,
        new ConnectorTransportError("total-timeout", true),
        () => input.abortController.abort("total-timeout"),
      );
      chunks.push(stableChunk);
      wireByteLength = nextLength;
    }
    const capturedAt = clockInstant(input.dependencies.clock);
    if (
      Date.parse(capturedAt) - Date.parse(input.startedAt) >
      input.policy.limits.totalTimeoutMs
    ) {
      throw new ConnectorTransportError("total-timeout", true);
    }
    const responseSha256 = hash.digest("hex");
    const rawObject = ImmutableQuarantineObjectSchema.parse(
      await input.dependencies.clock.withDeadline(
        writer.commit({
          byteLength: wireByteLength,
          sha256: responseSha256,
          contentType,
          metadata: {
            manifest_id: input.manifest.manifestId,
            attempt: String(input.attempt),
          },
        }),
        input.policy.limits.totalTimeoutMs,
        new RunnerExecutionError("immutable-store-timeout"),
        () => input.abortController.abort("immutable-store-timeout"),
      ),
    );
    committed = true;
    if (
      rawObject.key !== rawKey ||
      rawObject.contentType !== contentType ||
      rawObject.byteLength !== wireByteLength ||
      rawObject.checksum.value !== responseSha256
    ) {
      throw new RunnerExecutionError("immutable-raw-mismatch");
    }

    const capture = createQuarantineCapture({
      manifest: input.manifest,
      admission: input.admission,
      attempt: input.attempt,
      capturedAt,
      transport: metadata,
      responseSha256,
      wireByteLength,
      decodedByteLength: wireByteLength,
      rawObject,
    });
    const bytes = copyBytes(chunks, wireByteLength);
    const validation = validateQuarantinedResponse({
      manifest: input.manifest,
      capture,
      bytes,
      validatedAt: clockInstant(input.dependencies.clock),
    });
    const manifestBase = `quarantine/manifests/${input.manifest.sourceId}/${input.manifest.manifestId}/attempt-${input.attempt}`;
    const captureObject = await putCanonicalManifest(
      input.dependencies.store,
      `${manifestBase}/capture.json`,
      capture,
      input.dependencies.clock,
      input.policy.limits.totalTimeoutMs,
    );
    const validationObject = await putCanonicalManifest(
      input.dependencies.store,
      `${manifestBase}/validation.json`,
      validation,
      input.dependencies.clock,
      input.policy.limits.totalTimeoutMs,
    );
    const completedAt = clockInstant(input.dependencies.clock);
    return {
      attempt: {
        attempt: input.attempt,
        state: "captured",
        startedAt: input.startedAt,
        completedAt,
        httpStatus: metadata.status,
        capture: { id: capture.captureId, object: captureObject },
        validation: { id: validation.reportId, object: validationObject },
        validationState: validation.state,
      },
      capture,
      captureObject,
      validation,
      validationObject,
    };
  } catch (error) {
    if (!committed) {
      try {
        await input.dependencies.clock.withDeadline(
          writer.abort(errorCode(error)),
          Math.max(100, Math.min(1_000, input.policy.limits.totalTimeoutMs)),
          new RunnerExecutionError("immutable-store-abort-timeout"),
          () => {},
        );
      } catch {
        // Preserve the initiating error.
      }
    }
    throw error;
  }
}

function retryableStatus(manifest: FrozenRequestManifest, status: number): boolean {
  return manifest.retry.retryHttpStatuses.includes(status);
}

function retryableTransportError(
  manifest: FrozenRequestManifest,
  error: unknown,
): boolean {
  return (
    error instanceof ConnectorTransportError &&
    error.retryable &&
    manifest.retry.retryNetworkErrors
  );
}

/**
 * Execute one frozen request through injected boundaries only. This foundation
 * runner can produce quarantine records, but it has no publication capability.
 */
export async function runConnectorManifest(
  dependencies: ConnectorRunnerDependencies,
  input: RunConnectorManifestInput,
): Promise<ConnectorRunRecord> {
  const policy = deepFreeze(
    RunnerPolicySchema.parse(dependencies.policy ?? DEFAULT_RUNNER_POLICY),
  );
  const manifest = FrozenRequestManifestSchema.parse(input.manifest);
  assertManifestIntegrity(manifest);
  const admission = RunnerAdmissionSchema.parse(input.admission);
  const passport = getSourcePassport(manifest.sourceId);
  const startedAt = clockInstant(dependencies.clock);
  const decision = admissionDecision({
    manifest,
    passport,
    admission,
    startedAt,
    policy,
  });
  if (decision.state !== "allowed") {
    return finishRun({
      dependencies,
      manifest,
      admission,
      startedAt,
      attempts: [],
      outcome: { state: decision.state, errorCode: decision.code },
    });
  }

  let transportRequest: PreparedTransportRequest;
  try {
    transportRequest = await prepareTransportRequest({
      manifest,
      passport,
      policy,
      secretResolver: dependencies.secretResolver,
      clock: dependencies.clock,
    });
  } catch (error) {
    return finishRun({
      dependencies,
      manifest,
      admission,
      startedAt,
      attempts: [],
      outcome: { state: "killed", errorCode: errorCode(error) },
    });
  }

  const attempts: RunnerAttempt[] = [];
  const maxAttempts = Math.min(
    manifest.retry.maxAttempts,
    policy.limits.maxAttempts,
  );
  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    const attemptStartedAt = clockInstant(dependencies.clock);
    if (
      Date.parse(admission.quotaLease.expiresAt) <= Date.parse(attemptStartedAt)
    ) {
      return finishRun({
        dependencies,
        manifest,
        admission,
        startedAt,
        attempts,
        outcome: {
          state: attempts.length === 0 ? "killed" : "failed",
          errorCode: "quota-expired",
        },
      });
    }
    let response: SandboxedTransportResponse | undefined;
    const abortController = new AbortController();
    try {
      const request = Object.freeze({
        ...transportRequest,
        signal: abortController.signal,
      });
      const openOperation = dependencies.transport.open(request);
      const openDeadlines = [
        {
          timeoutMs: policy.limits.connectTimeoutMs,
          code: "connect-timeout" as const,
        },
        {
          timeoutMs: policy.limits.headerTimeoutMs,
          code: "header-timeout" as const,
        },
        {
          timeoutMs: policy.limits.totalTimeoutMs,
          code: "total-timeout" as const,
        },
      ];
      const openDeadline = openDeadlines.reduce((earliest, candidate) =>
        candidate.timeoutMs < earliest.timeoutMs ? candidate : earliest,
      );
      response = await dependencies.clock.withDeadline(
        openOperation,
        openDeadline.timeoutMs,
        new ConnectorTransportError(openDeadline.code, true),
        () => abortController.abort(openDeadline.code),
      );
      const captured = await captureAttempt({
        dependencies,
        manifest,
        admission,
        policy,
        attempt: attemptNumber,
        startedAt: attemptStartedAt,
        response,
        abortController,
      });
      const shouldRetry = retryableStatus(
        manifest,
        captured.capture.httpStatus,
      );
      if (shouldRetry && attemptNumber < maxAttempts) {
        const retryDelayMs = deterministicRetryDelay(
          manifest,
          attemptNumber,
          captured.capture.responseHeaders.retryAfter,
          captured.capture.transportReceivedAt,
          passport.quota.localMinDelayMs,
        );
        attempts.push({ ...captured.attempt, retryDelayMs });
        await dependencies.clock.sleep(retryDelayMs);
        continue;
      }
      attempts.push(captured.attempt);
      if (shouldRetry) {
        return finishRun({
          dependencies,
          manifest,
          admission,
          startedAt,
          attempts,
          outcome: { state: "failed", errorCode: "retry-exhausted" },
        });
      }
      return finishRun({
        dependencies,
        manifest,
        admission,
        startedAt,
        attempts,
        outcome: {
          state: "quarantined",
          capture: {
            id: captured.capture.captureId,
            object: captured.captureObject,
          },
          validation: {
            id: captured.validation.reportId,
            object: captured.validationObject,
          },
          validationState: captured.validation.state,
        },
      });
    } catch (error) {
      const code = errorCode(error);
      abortController.abort(code);
      await bestEffortAbort(
        response,
        code,
        dependencies.clock,
        policy.limits.totalTimeoutMs,
      );
      const canRetry =
        retryableTransportError(manifest, error) &&
        attemptNumber < maxAttempts;
      const completedAt = clockInstant(dependencies.clock);
      const retryDelayMs = canRetry
        ? deterministicRetryDelay(
            manifest,
            attemptNumber,
            undefined,
            undefined,
            passport.quota.localMinDelayMs,
          )
        : undefined;
      attempts.push({
        attempt: attemptNumber,
        state:
          error instanceof ConnectorTransportError
            ? "transport-error"
            : "aborted",
        startedAt: attemptStartedAt,
        completedAt,
        errorCode: code,
        ...(retryDelayMs === undefined ? {} : { retryDelayMs }),
      });
      if (canRetry && retryDelayMs !== undefined) {
        await dependencies.clock.sleep(retryDelayMs);
        continue;
      }
      return finishRun({
        dependencies,
        manifest,
        admission,
        startedAt,
        attempts,
        outcome: {
          state: "failed",
          errorCode:
            error instanceof ConnectorTransportError
              ? "retry-exhausted"
              : code,
        },
      });
    }
  }
  throw new RunnerExecutionError("runner-attempt-invariant");
}
