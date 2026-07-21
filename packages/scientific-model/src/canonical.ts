import { createHash } from "node:crypto";

function normalizeStableJson(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Stable JSON does not permit non-finite numbers");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeStableJson);
  }
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      const child = input[key];
      if (child !== undefined) {
        output[key] = normalizeStableJson(child);
      }
    }
    return output;
  }
  throw new TypeError(`Unsupported stable JSON value: ${typeof value}`);
}

/** Deterministic JSON with lexicographically sorted object keys. */
export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(normalizeStableJson(value));
}

export function stableJsonSha256(value: unknown): string {
  return createHash("sha256").update(stableJsonStringify(value)).digest("hex");
}

export function deepFreezeGovernanceRecord<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreezeGovernanceRecord(child);
  }
  return Object.freeze(value);
}
