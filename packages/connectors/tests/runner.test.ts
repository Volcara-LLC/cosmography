import assert from "node:assert/strict";
import test from "node:test";

import {
  ConnectorTransportError,
  DEFAULT_RUNNER_POLICY,
  ImmutableObjectCollisionError,
  SYSTEM_RUNNER_CLOCK,
  assertConnectorRunRecordIntegrity,
  compileConnectorIntent,
  exampleGaiaManifest,
  exampleHorizonsManifest,
  exampleUnoosaManifest,
  getSourcePassport,
  runConnectorManifest,
  sha256Hex,
  type ConnectorSecretResolver,
  type ConnectorTransport,
  type ImmutableQuarantineManifestObject,
  type ImmutableQuarantineObject,
  type ImmutableQuarantineStore,
  type ImmutableQuarantineWriter,
  type RunnerClock,
  type RunnerPolicy,
  type SandboxedTransportRequest,
  type SandboxedTransportResponse,
} from "../src/index";

const encoder = new TextEncoder();
const runnerNow = "2026-07-19T13:40:00Z";

function joinChunks(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

class FakeClock implements RunnerClock {
  readonly delays: number[] = [];

  now(): string {
    return runnerNow;
  }

  async sleep(delayMs: number): Promise<void> {
    this.delays.push(delayMs);
  }

  async withDeadline<T>(
    operation: Promise<T>,
    _timeoutMs: number,
    _timeoutError: Error,
    _onTimeout: () => void,
  ): Promise<T> {
    return operation;
  }
}

class ScriptedClock implements RunnerClock {
  readonly delays: number[] = [];
  private readonly instants: string[];
  private last: string;

  constructor(instants: readonly string[]) {
    this.instants = [...instants];
    this.last = instants.at(-1) ?? runnerNow;
  }

  now(): string {
    const next = this.instants.shift();
    if (next !== undefined) this.last = next;
    return this.last;
  }

  async sleep(delayMs: number): Promise<void> {
    this.delays.push(delayMs);
  }

  async withDeadline<T>(
    operation: Promise<T>,
    _timeoutMs: number,
    _timeoutError: Error,
    _onTimeout: () => void,
  ): Promise<T> {
    return operation;
  }
}

class FixedDeadlineClock extends FakeClock {
  override withDeadline<T>(
    operation: Promise<T>,
    timeoutMs: number,
    timeoutError: Error,
    onTimeout: () => void,
  ): Promise<T> {
    return SYSTEM_RUNNER_CLOCK.withDeadline(
      operation,
      timeoutMs,
      timeoutError,
      onTimeout,
    );
  }
}

interface StoredValue {
  bytes: Uint8Array;
  contentType: string;
  kind: "raw" | "manifest";
}

class FakeQuarantineStore implements ImmutableQuarantineStore {
  readonly values = new Map<string, StoredValue>();
  readonly events: unknown[] = [];
  readonly abortedKeys: string[] = [];

  private put(
    key: string,
    bytes: Uint8Array,
    contentType: string,
    kind: StoredValue["kind"],
  ): StoredValue {
    const existing = this.values.get(key);
    if (existing) {
      if (
        existing.contentType !== contentType ||
        existing.kind !== kind ||
        sha256Hex(existing.bytes) !== sha256Hex(bytes)
      ) {
        throw new ImmutableObjectCollisionError();
      }
      return existing;
    }
    const value = { bytes: bytes.slice(), contentType, kind };
    this.values.set(key, value);
    return value;
  }

  async begin(input: {
    readonly key: string;
    readonly expectedContentType: string;
    readonly metadata: Readonly<Record<string, string>>;
    readonly ifAbsent: true;
  }): Promise<ImmutableQuarantineWriter> {
    assert.equal(input.ifAbsent, true);
    this.events.push({ operation: "begin", ...input });
    const chunks: Uint8Array[] = [];
    let finished = false;
    return {
      write: async (chunk) => {
        assert.equal(finished, false);
        chunks.push(chunk.slice());
      },
      commit: async (commitInput) => {
        assert.equal(finished, false);
        finished = true;
        const bytes = joinChunks(chunks);
        assert.equal(bytes.byteLength, commitInput.byteLength);
        assert.equal(sha256Hex(bytes), commitInput.sha256);
        assert.equal(commitInput.contentType, input.expectedContentType);
        this.events.push({ operation: "commit", key: input.key, ...commitInput });
        this.put(input.key, bytes, commitInput.contentType, "raw");
        return {
          store: "r2",
          namespace: "quarantine",
          key: input.key,
          contentType: commitInput.contentType,
          byteLength: bytes.byteLength,
          checksum: {
            algorithm: "sha256",
            value: commitInput.sha256,
            scope: "response-bytes",
          },
          immutable: true,
        } satisfies ImmutableQuarantineObject;
      },
      abort: async (reasonCode) => {
        if (!finished) {
          finished = true;
          this.abortedKeys.push(input.key);
          this.events.push({ operation: "abort", key: input.key, reasonCode });
        }
      },
    };
  }

  async putManifest(input: {
    readonly key: string;
    readonly canonicalJson: string;
    readonly sha256: string;
    readonly ifAbsent: true;
  }): Promise<ImmutableQuarantineManifestObject> {
    assert.equal(input.ifAbsent, true);
    const bytes = encoder.encode(input.canonicalJson);
    assert.equal(sha256Hex(bytes), input.sha256);
    this.events.push({ operation: "manifest", ...input });
    this.put(input.key, bytes, "application/json", "manifest");
    return {
      store: "r2",
      namespace: "quarantine",
      key: input.key,
      contentType: "application/json",
      byteLength: bytes.byteLength,
      checksum: {
        algorithm: "sha256",
        value: input.sha256,
        scope: "record-bytes",
      },
      immutable: true,
    };
  }
}

interface ResponsePlan {
  readonly status?: number;
  readonly body: string | Uint8Array | readonly Uint8Array[];
  readonly headers?: Readonly<Record<string, string>>;
  readonly resolvedAddresses?: readonly string[];
  readonly finalUrl?: string;
}

class FakeTransport implements ConnectorTransport {
  readonly requests: SandboxedTransportRequest[] = [];
  readonly aborts: string[] = [];
  private readonly plans: Array<ResponsePlan | Error>;

  constructor(plans: readonly (ResponsePlan | Error)[]) {
    this.plans = [...plans];
  }

  async open(
    request: SandboxedTransportRequest,
  ): Promise<SandboxedTransportResponse> {
    this.requests.push(request);
    const plan = this.plans.shift();
    if (!plan) throw new Error("missing-test-plan");
    if (plan instanceof Error) throw plan;
    const chunks =
      typeof plan.body === "string"
        ? [encoder.encode(plan.body)]
        : plan.body instanceof Uint8Array
          ? [plan.body]
          : [...plan.body];
    const length = chunks.reduce(
      (total, chunk) => total + chunk.byteLength,
      0,
    );
    const url = new URL(request.url);
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "content-length": String(length),
      ...(plan.headers ?? {}),
    };
    return {
      metadata: {
        requestedUrl: request.url,
        finalUrl: plan.finalUrl ?? request.url,
        status: plan.status ?? 200,
        headers,
        redirectChain: [],
        dns: {
          hostname: url.hostname,
          resolvedAddresses: [...(plan.resolvedAddresses ?? ["8.8.8.8"])],
          connectedAddress: plan.resolvedAddresses?.[0] ?? "8.8.8.8",
          resolvedAt: "2026-07-19T13:39:30Z",
          ttlSeconds: 120,
          tlsServerName: url.hostname,
        },
        receivedAt: runnerNow,
      },
      body: (async function* () {
        for (const chunk of chunks) yield chunk;
      })(),
      abort: async (reasonCode) => {
        this.aborts.push(reasonCode);
      },
    };
  }
}

class HangingTransport implements ConnectorTransport {
  request: SandboxedTransportRequest | undefined;

  async open(
    request: SandboxedTransportRequest,
  ): Promise<SandboxedTransportResponse> {
    this.request = request;
    return new Promise<SandboxedTransportResponse>(() => {
      // The hard-deadline test intentionally never settles this promise.
    });
  }
}

class FakeSecretResolver implements ConnectorSecretResolver {
  readonly calls: string[] = [];

  constructor(private readonly value?: string) {}

  async resolve(envKey: string): Promise<string | undefined> {
    this.calls.push(envKey);
    return this.value;
  }
}

function admissionFor(
  sourceId: string,
  overrides: Partial<{
    sourceEnabled: boolean;
    dataRightsApproved: boolean;
    auditedOverrideId: string;
    leaseSourceId: string;
    expiresAt: string;
  }> = {},
) {
  const maxConcurrency = getSourcePassport(sourceId).quota.localMaxConcurrency;
  return {
    releaseId: "rel_foundation",
    admittedAt: "2026-07-19T13:39:59Z",
    sourceEnabled: overrides.sourceEnabled ?? true,
    dataRightsApproved: overrides.dataRightsApproved ?? true,
    ...(overrides.auditedOverrideId === undefined
      ? {}
      : { auditedOverrideId: overrides.auditedOverrideId }),
    quotaLease: {
      leaseId: "lease_aaaaaaaaaaaaaaaaaaaaaaaa",
      sourceId: overrides.leaseSourceId ?? sourceId,
      issuedAt: "2026-07-19T13:39:00Z",
      notBefore: "2026-07-19T13:39:00Z",
      expiresAt: overrides.expiresAt ?? "2026-07-19T14:00:00Z",
      maxConcurrency,
    },
    activeSourceConcurrency: 0,
  };
}

function validHorizonsBody(result = "fixture"): string {
  return JSON.stringify({ signature: { version: "1.2" }, result });
}

function dependencies(
  transport: ConnectorTransport,
  store = new FakeQuarantineStore(),
  secretResolver = new FakeSecretResolver(),
  clock = new FakeClock(),
  policy?: RunnerPolicy,
) {
  return {
    dependencies: {
      transport,
      store,
      secretResolver,
      clock,
      ...(policy === undefined ? {} : { policy }),
    },
    store,
    secretResolver,
    clock,
  };
}

test("runner uses only injected transport and produces immutable quarantine receipts", async () => {
  const transport = new FakeTransport([
    {
      body: validHorizonsBody(),
      headers: { "set-cookie": "must-not-persist=secret" },
    },
  ]);
  const fixture = dependencies(transport);
  const globals = globalThis as unknown as { fetch?: unknown };
  const originalFetch = globals.fetch;
  let ambientFetchCalls = 0;
  globals.fetch = async () => {
    ambientFetchCalls += 1;
    throw new Error("ambient-fetch-forbidden");
  };
  try {
    const run = await runConnectorManifest(fixture.dependencies, {
      manifest: exampleHorizonsManifest,
      admission: admissionFor("jpl-horizons"),
    });
    assert.equal(run.state, "quarantined");
    if (run.state !== "quarantined") return;
    assert.equal(run.validationState, "needs-review");
    assert.equal(run.attemptCount, 1);
    assert.equal(run.attempts[0]?.state, "captured");
    assert.doesNotThrow(() => assertConnectorRunRecordIntegrity(run));
    assert.equal(ambientFetchCalls, 0);
    assert.equal(fixture.secretResolver.calls.length, 0);
    assert.equal(transport.requests[0]?.headers["accept-encoding"], "identity");
    assert.equal(transport.requests[0]?.redirectMode, "error");
    assert.equal(fixture.store.values.size, 4);
    for (const key of fixture.store.values.keys()) {
      assert.match(key, /^quarantine\//);
    }
    const persisted = JSON.stringify([...fixture.store.events, run]);
    assert.equal(persisted.includes("must-not-persist"), false);
  } finally {
    globals.fetch = originalFetch;
  }
});

test("manual, disabled-by-default, and expired admissions never reach transport", async () => {
  const manualTransport = new FakeTransport([]);
  const manualFixture = dependencies(manualTransport);
  const manualRun = await runConnectorManifest(manualFixture.dependencies, {
    manifest: exampleUnoosaManifest,
    admission: admissionFor("unoosa-space-object-register"),
  });
  assert.equal(manualRun.state, "manual-required");
  assert.equal(manualTransport.requests.length, 0);

  const rubinManifest = compileConnectorIntent(
    {
      kind: "tap",
      sourceId: "rubin-dp1",
      adql: "SELECT TOP 10 objectId, coord_ra, coord_dec FROM dp1.Object",
      execution: "sync",
      format: "votable",
      maxRecords: 10,
    },
    {
      frozenAt: "2026-07-19T10:00:00Z",
      releaseLabel: "rubin-disabled-test",
      cursorIn: { kind: "release", label: "DP1" },
      destination: {
        payloadClass: "bulk-science",
        payloadStore: "r2",
        controlPointerStore: "d1",
        objectKey: "tests/rubin.vot",
      },
    },
  );
  const defaultOffTransport = new FakeTransport([]);
  const defaultOffFixture = dependencies(defaultOffTransport);
  const defaultOffRun = await runConnectorManifest(defaultOffFixture.dependencies, {
    manifest: rubinManifest,
    admission: admissionFor("rubin-dp1"),
  });
  assert.equal(defaultOffRun.state, "killed");
  assert.equal(
    defaultOffRun.state === "killed" ? defaultOffRun.errorCode : "",
    "audited-override-required",
  );
  assert.equal(defaultOffTransport.requests.length, 0);
  assert.equal(defaultOffFixture.secretResolver.calls.length, 0);

  const expiredTransport = new FakeTransport([]);
  const expiredFixture = dependencies(expiredTransport);
  const expiredRun = await runConnectorManifest(expiredFixture.dependencies, {
    manifest: exampleHorizonsManifest,
    admission: admissionFor("jpl-horizons", {
      expiresAt: "2026-07-19T13:39:59Z",
    }),
  });
  assert.equal(expiredRun.state, "killed");
  assert.equal(
    expiredRun.state === "killed" ? expiredRun.errorCode : "",
    "quota-expired",
  );
  assert.equal(expiredTransport.requests.length, 0);

  const asyncManifest = compileConnectorIntent(
    {
      kind: "tap",
      sourceId: "esa-gaia-tap",
      adql: "SELECT TOP 10 source_id, ra, dec FROM gaiadr3.gaia_source",
      execution: "async",
      format: "votable",
      maxRecords: 10,
    },
    {
      frozenAt: "2026-07-19T10:00:00Z",
      releaseLabel: "async-tap-held-test",
      cursorIn: { kind: "release", label: "Gaia DR3" },
      destination: {
        payloadClass: "bulk-science",
        payloadStore: "r2",
        controlPointerStore: "d1",
        objectKey: "tests/async-gaia.vot",
      },
    },
  );
  const asyncTransport = new FakeTransport([]);
  const asyncFixture = dependencies(asyncTransport);
  const asyncRun = await runConnectorManifest(asyncFixture.dependencies, {
    manifest: asyncManifest,
    admission: admissionFor("esa-gaia-tap"),
  });
  assert.equal(asyncRun.state, "manual-required");
  assert.equal(
    asyncRun.state === "manual-required" ? asyncRun.errorCode : "",
    "async-tap-workflow-required",
  );
  assert.equal(asyncTransport.requests.length, 0);
});

test("resolved bearer secrets reach only the injected transport boundary", async () => {
  const token = "rubin-test-token-never-persist";
  const manifest = compileConnectorIntent(
    {
      kind: "tap",
      sourceId: "rubin-dp1",
      adql: "SELECT TOP 10 objectId, coord_ra, coord_dec FROM dp1.Object",
      execution: "sync",
      format: "votable",
      maxRecords: 10,
    },
    {
      frozenAt: "2026-07-19T10:00:00Z",
      releaseLabel: "rubin-secret-boundary-test",
      cursorIn: { kind: "release", label: "DP1" },
      destination: {
        payloadClass: "bulk-science",
        payloadStore: "r2",
        controlPointerStore: "d1",
        objectKey: "tests/rubin-secret.vot",
      },
    },
  );
  const body =
    '<?xml version="1.0"?><VOTABLE><RESOURCE><INFO value="OK" name="QUERY_STATUS"/></RESOURCE></VOTABLE>';
  const transport = new FakeTransport([
    {
      body,
      headers: { "content-type": "application/x-votable+xml" },
    },
  ]);
  const fixture = dependencies(
    transport,
    new FakeQuarantineStore(),
    new FakeSecretResolver(token),
  );
  const run = await runConnectorManifest(fixture.dependencies, {
    manifest,
    admission: admissionFor("rubin-dp1", {
      auditedOverrideId: "audit_aaaaaaaaaaaaaaaaaaaaaaaa",
      dataRightsApproved: true,
    }),
  });
  assert.equal(run.state, "quarantined");
  assert.deepEqual(fixture.secretResolver.calls, ["RUBIN_RSP_TOKEN"]);
  assert.equal(transport.requests[0]?.headers.authorization, `Bearer ${token}`);
  assert.equal(JSON.stringify([run, ...fixture.store.events]).includes(token), false);
  assert.equal(JSON.stringify(manifest).includes(token), false);
});

test("retry ledger preserves every capture and uses deterministic bounded delays", async () => {
  async function executeRetryFixture() {
    const transport = new FakeTransport([
      {
        status: 503,
        body: validHorizonsBody("retryable"),
        headers: { "retry-after": "2" },
      },
      new ConnectorTransportError("network-error", true),
      { body: validHorizonsBody("success") },
    ]);
    const fixture = dependencies(transport);
    const run = await runConnectorManifest(fixture.dependencies, {
      manifest: exampleHorizonsManifest,
      admission: admissionFor("jpl-horizons"),
    });
    return { run, fixture, transport };
  }

  const first = await executeRetryFixture();
  const second = await executeRetryFixture();
  assert.equal(first.run.state, "quarantined");
  assert.deepEqual(first.fixture.clock.delays, second.fixture.clock.delays);
  assert.equal(first.fixture.clock.delays[0], 2_000);
  assert.equal(first.run.attemptCount, 3);
  assert.deepEqual(
    first.run.attempts.map(({ state }) => state),
    ["captured", "transport-error", "captured"],
  );
  assert.equal(
    [...first.fixture.store.values.keys()].some((key) =>
      key.includes("attempt-1/capture.json"),
    ),
    true,
  );
  assert.equal(
    [...first.fixture.store.values.keys()].some((key) =>
      key.includes("attempt-3/capture.json"),
    ),
    true,
  );
});

test("an expired quota lease blocks the next retry after preserving prior evidence", async () => {
  const clock = new ScriptedClock([
    runnerNow,
    runnerNow,
    runnerNow,
    runnerNow,
    runnerNow,
    runnerNow,
    runnerNow,
    "2026-07-19T14:00:01Z",
    "2026-07-19T14:00:01Z",
  ]);
  const transport = new FakeTransport([
    { status: 503, body: validHorizonsBody("captured-before-expiry") },
  ]);
  const fixture = dependencies(
    transport,
    new FakeQuarantineStore(),
    new FakeSecretResolver(),
    clock,
  );
  const run = await runConnectorManifest(fixture.dependencies, {
    manifest: exampleHorizonsManifest,
    admission: admissionFor("jpl-horizons"),
  });
  assert.equal(run.state, "failed");
  assert.equal(run.state === "failed" ? run.errorCode : "", "quota-expired");
  assert.equal(run.attemptCount, 1);
  assert.equal(run.attempts[0]?.state, "captured");
  assert.equal(transport.requests.length, 1);
});

test("TAP XML errors, overflow, and entity declarations are order-independent blockers", async () => {
  const bodies = [
    '<VOTABLE><RESOURCE><INFO value="ERROR" name="QUERY_STATUS"/></RESOURCE></VOTABLE>',
    '<VOTABLE><RESOURCE><INFO value="OVERFLOW" name="QUERY_STATUS"/></RESOURCE></VOTABLE>',
    '<?xml version="1.0"?><!DOCTYPE VOTABLE [<!ENTITY unsafe "value">]><VOTABLE><RESOURCE/></VOTABLE>',
  ];
  for (const body of bodies) {
    const transport = new FakeTransport([
      {
        body,
        headers: { "content-type": "application/x-votable+xml" },
      },
    ]);
    const fixture = dependencies(transport);
    const run = await runConnectorManifest(fixture.dependencies, {
      manifest: exampleGaiaManifest,
      admission: admissionFor("esa-gaia-tap"),
    });
    assert.equal(run.state, "quarantined");
    assert.equal(
      run.state === "quarantined" ? run.validationState : "",
      "rejected",
    );
  }
});

test("DNS, redirects, and response byte ceilings abort without raw commits", async () => {
  for (const response of [
    {
      body: validHorizonsBody(),
      resolvedAddresses: ["8.8.8.8", "127.0.0.1"],
    },
    { status: 302, body: "redirect" },
  ] satisfies ResponsePlan[]) {
    const transport = new FakeTransport([response]);
    const fixture = dependencies(transport);
    const run = await runConnectorManifest(fixture.dependencies, {
      manifest: exampleHorizonsManifest,
      admission: admissionFor("jpl-horizons"),
    });
    assert.equal(run.state, "failed");
    assert.equal(transport.aborts.length, 1);
    assert.equal(
      [...fixture.store.values.values()].some(({ kind }) => kind === "raw"),
      false,
    );
  }

  const smallPolicy: RunnerPolicy = {
    ...DEFAULT_RUNNER_POLICY,
    limits: {
      ...DEFAULT_RUNNER_POLICY.limits,
      maxResponseWireBytes: 8,
      maxDecodedBytes: 8,
    },
  };
  const transport = new FakeTransport([{ body: validHorizonsBody() }]);
  const fixture = dependencies(
    transport,
    new FakeQuarantineStore(),
    new FakeSecretResolver(),
    new FakeClock(),
    smallPolicy,
  );
  const run = await runConnectorManifest(fixture.dependencies, {
    manifest: exampleHorizonsManifest,
    admission: admissionFor("jpl-horizons"),
  });
  assert.equal(run.state, "failed");
  assert.equal(
    run.state === "failed" ? run.errorCode : "",
    "response-byte-limit",
  );
  assert.equal(fixture.store.abortedKeys.length, 1);
  assert.equal(
    [...fixture.store.values.values()].some(({ kind }) => kind === "raw"),
    false,
  );

  const timeoutPolicy: RunnerPolicy = {
    ...DEFAULT_RUNNER_POLICY,
    limits: {
      ...DEFAULT_RUNNER_POLICY.limits,
      connectTimeoutMs: 100,
      headerTimeoutMs: 100,
      totalTimeoutMs: 100,
      maxAttempts: 1,
    },
  };
  const timeoutClock = new ScriptedClock([
    runnerNow,
    runnerNow,
    runnerNow,
    "2026-07-19T13:40:01Z",
    "2026-07-19T13:40:01Z",
    "2026-07-19T13:40:01Z",
  ]);
  const timeoutTransport = new FakeTransport([{ body: validHorizonsBody() }]);
  const timeoutFixture = dependencies(
    timeoutTransport,
    new FakeQuarantineStore(),
    new FakeSecretResolver(),
    timeoutClock,
    timeoutPolicy,
  );
  const timeoutRun = await runConnectorManifest(timeoutFixture.dependencies, {
    manifest: exampleHorizonsManifest,
    admission: admissionFor("jpl-horizons"),
  });
  assert.equal(timeoutRun.state, "failed");
  assert.equal(timeoutRun.attempts[0]?.state, "transport-error");
  assert.equal(
    timeoutRun.attempts[0]?.state === "transport-error"
      ? timeoutRun.attempts[0].errorCode
      : "",
    "total-timeout",
  );
  assert.equal(timeoutFixture.store.abortedKeys.length, 1);

  const hardDeadlinePolicy: RunnerPolicy = {
    ...DEFAULT_RUNNER_POLICY,
    limits: {
      ...DEFAULT_RUNNER_POLICY.limits,
      connectTimeoutMs: 500,
      headerTimeoutMs: 100,
      totalTimeoutMs: 500,
      maxAttempts: 1,
    },
  };
  const hangingTransport = new HangingTransport();
  const deadlineFixture = dependencies(
    hangingTransport,
    new FakeQuarantineStore(),
    new FakeSecretResolver(),
    new FixedDeadlineClock(),
    hardDeadlinePolicy,
  );
  const wallStartedAt = Date.now();
  const deadlineRun = await runConnectorManifest(deadlineFixture.dependencies, {
    manifest: exampleHorizonsManifest,
    admission: admissionFor("jpl-horizons"),
  });
  assert.equal(deadlineRun.state, "failed");
  assert.equal(deadlineRun.attempts[0]?.state, "transport-error");
  assert.equal(
    deadlineRun.attempts[0]?.state === "transport-error"
      ? deadlineRun.attempts[0].errorCode
      : "",
    "header-timeout",
  );
  assert.equal(hangingTransport.request?.signal.aborted, true);
  assert.ok(Date.now() - wallStartedAt < 1_000);
});

test("immutable key collisions fail closed instead of overwriting evidence", async () => {
  const store = new FakeQuarantineStore();
  const first = dependencies(
    new FakeTransport([{ body: validHorizonsBody("first") }]),
    store,
  );
  const firstRun = await runConnectorManifest(first.dependencies, {
    manifest: exampleHorizonsManifest,
    admission: admissionFor("jpl-horizons"),
  });
  assert.equal(firstRun.state, "quarantined");
  const rawKey = [...store.values.keys()].find((key) => key.includes("/raw/"));
  assert.ok(rawKey);
  const originalChecksum = sha256Hex(store.values.get(rawKey)!.bytes);

  const conflicting = dependencies(
    new FakeTransport([{ body: validHorizonsBody("different") }]),
    store,
  );
  await assert.rejects(
    () =>
      runConnectorManifest(conflicting.dependencies, {
        manifest: exampleHorizonsManifest,
        admission: admissionFor("jpl-horizons"),
      }),
    /immutable-object-collision/,
  );
  assert.equal(sha256Hex(store.values.get(rawKey)!.bytes), originalChecksum);
});
