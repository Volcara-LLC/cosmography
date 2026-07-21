import { createHash } from "node:crypto";

import {
  FreezeContextSchema,
  FrozenRequestManifestSchema,
  FrozenRequestSchema,
  IngestionReceiptSchema,
  RequestChecksumSchema,
  type IngestionReceipt,
  type FrozenRequestManifest,
  type SourcePassport,
} from "./contracts";

type QueryValue = string | number | boolean | readonly string[] | undefined;

function normalizeForJson(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not permit non-finite numbers");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeForJson);
  }
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      const child = input[key];
      if (child !== undefined) {
        output[key] = normalizeForJson(child);
      }
    }
    return output;
  }
  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`);
}

/** Deterministic JSON with lexicographically sorted object keys. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForJson(value));
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function appendQueryValue(
  parameters: URLSearchParams,
  key: string,
  value: Exclude<QueryValue, undefined>,
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      parameters.append(key, item);
    }
    return;
  }
  parameters.append(key, String(value));
}

/** Build a URL without relying on caller object insertion order. */
export function buildSortedUrl(
  baseUrl: string,
  query: Readonly<Record<string, QueryValue>>,
): string {
  const url = new URL(baseUrl);
  const parameters = new URLSearchParams(url.search);
  for (const key of Object.keys(query).sort()) {
    const value = query[key];
    if (value !== undefined) {
      appendQueryValue(parameters, key, value);
    }
  }
  parameters.sort();
  url.search = parameters.toString();
  return url.toString();
}

export function buildSortedForm(
  values: Readonly<Record<string, QueryValue>>,
): string {
  const parameters = new URLSearchParams();
  for (const key of Object.keys(values).sort()) {
    const value = values[key];
    if (value !== undefined) {
      appendQueryValue(parameters, key, value);
    }
  }
  parameters.sort();
  return parameters.toString();
}

interface FreezeManifestInput {
  passport: SourcePassport;
  adapterVersion: string;
  intent: Readonly<Record<string, unknown>>;
  request: unknown;
  context: unknown;
  expectedResponseSha256?: string;
}

export function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

export function freezeRequestManifest(
  input: FreezeManifestInput,
): FrozenRequestManifest {
  const context = FreezeContextSchema.parse(input.context);
  const request = FrozenRequestSchema.parse(input.request);
  const requestHash = sha256Hex(stableStringify(request));
  const requestChecksum = RequestChecksumSchema.parse({
    algorithm: "sha256",
    value: requestHash,
    scope: "request",
  });
  const idSeed = stableStringify({
    sourceId: input.passport.sourceId,
    releaseLabel: context.releaseLabel,
    frozenAt: context.frozenAt,
    requestHash,
  });
  const manifestId = `frm_${sha256Hex(idSeed).slice(0, 24)}`;

  const unsigned = {
    schemaVersion: "1.0.0" as const,
    manifestId,
    sourceId: input.passport.sourceId,
    adapterVersion: input.adapterVersion,
    releaseLabel: context.releaseLabel,
    frozenAt: context.frozenAt,
    intent: input.intent,
    request,
    cursorIn: context.cursorIn,
    destination: context.destination,
    retry: input.passport.retry,
    freshness: input.passport.freshness,
    requestChecksum,
    ...(input.expectedResponseSha256
      ? {
          expectedResponseChecksum: {
            algorithm: "sha256" as const,
            value: input.expectedResponseSha256,
            scope: "response-bytes" as const,
          },
        }
      : {}),
  };
  const manifestChecksum = {
    algorithm: "sha256" as const,
    value: sha256Hex(stableStringify(unsigned)),
    scope: "manifest" as const,
  };

  return deepFreeze(
    FrozenRequestManifestSchema.parse({
      ...unsigned,
      manifestChecksum,
    }),
  );
}

/**
 * Verify internal content consistency against the checksums recorded in a
 * manifest. This does not establish authorship or authenticity: without an
 * external signed/append-only anchor, a party can replace content and hashes.
 */
export function assertManifestIntegrity(
  value: unknown,
): asserts value is FrozenRequestManifest {
  const manifest = FrozenRequestManifestSchema.parse(value);
  const actualRequest = sha256Hex(stableStringify(manifest.request));
  if (actualRequest !== manifest.requestChecksum.value) {
    throw new Error("Frozen request checksum does not match request content");
  }

  const { manifestChecksum: _checksum, ...unsigned } = manifest;
  const actualManifest = sha256Hex(stableStringify(unsigned));
  if (actualManifest !== manifest.manifestChecksum.value) {
    throw new Error("Frozen manifest checksum does not match manifest content");
  }

  const idSeed = stableStringify({
    sourceId: manifest.sourceId,
    releaseLabel: manifest.releaseLabel,
    frozenAt: manifest.frozenAt,
    requestHash: manifest.requestChecksum.value,
  });
  const actualId = `frm_${sha256Hex(idSeed).slice(0, 24)}`;
  if (actualId !== manifest.manifestId) {
    throw new Error("Frozen manifest id does not match its identity fields");
  }
}

/**
 * Parse a receipt and bind it to the exact, internally consistent manifest that
 * authorized the run. A standalone IngestionReceiptSchema parse is structural
 * only; runners must use this function before accepting a receipt.
 */
export function parseIngestionReceiptForManifest(
  manifestValue: unknown,
  receiptValue: unknown,
): IngestionReceipt {
  const manifest = FrozenRequestManifestSchema.parse(manifestValue);
  assertManifestIntegrity(manifest);
  const receipt = IngestionReceiptSchema.parse(receiptValue);

  if (receipt.manifestId !== manifest.manifestId) {
    throw new Error("Ingestion receipt manifestId does not match the manifest");
  }
  if (receipt.sourceId !== manifest.sourceId) {
    throw new Error("Ingestion receipt sourceId does not match the manifest");
  }
  if (Date.parse(receipt.startedAt) < Date.parse(manifest.frozenAt)) {
    throw new Error("Ingestion receipt cannot start before the manifest was frozen");
  }

  const completedWithResponse =
    receipt.status === "succeeded" || receipt.status === "empty";
  if (
    completedWithResponse &&
    manifest.expectedResponseChecksum &&
    receipt.responseChecksum?.value !== manifest.expectedResponseChecksum.value
  ) {
    throw new Error(
      "Ingestion receipt response checksum does not match the manifest expectation",
    );
  }

  if (receipt.payloadPointer) {
    if (receipt.payloadPointer.store !== manifest.destination.payloadStore) {
      throw new Error(
        "Ingestion receipt payload store does not match the manifest destination",
      );
    }
    if (
      manifest.destination.objectKey !== undefined &&
      receipt.payloadPointer.keyOrUrl !== manifest.destination.objectKey
    ) {
      throw new Error(
        "Ingestion receipt payload pointer does not match the manifest destination",
      );
    }
  }

  if (
    completedWithResponse &&
    manifest.destination.payloadStore !== "d1" &&
    !receipt.payloadPointer
  ) {
    throw new Error(
      "Completed ingestion receipts require a pointer to the manifest destination",
    );
  }
  if (
    completedWithResponse &&
    manifest.destination.payloadStore === "d1" &&
    receipt.payloadPointer
  ) {
    throw new Error(
      "D1 control-plane destinations cannot use an external payload pointer",
    );
  }

  return deepFreeze(receipt);
}

export function assertAllowedUrl(
  rawUrl: string,
  rules: ReadonlyArray<{ host: string; pathPrefix?: string }>,
): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("Connector requests must use HTTPS");
  }
  const allowed = rules.some(
    (rule) =>
      url.hostname === rule.host &&
      (rule.pathPrefix === undefined ||
        url.pathname.startsWith(rule.pathPrefix)),
  );
  if (!allowed) {
    throw new Error(`URL is outside the connector allowlist: ${url.toString()}`);
  }
  return url;
}
