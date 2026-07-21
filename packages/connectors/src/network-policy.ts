import { isIP } from "node:net";

import {
  ADAPTER_VERSION,
  ConnectorIntentSchema,
  compileConnectorIntent,
} from "./adapters";
import {
  assertManifestIntegrity,
  stableStringify,
} from "./canonical";
import {
  FrozenRequestManifestSchema,
  type FrozenRequestManifest,
} from "./contracts";
import { getSourcePassport } from "./registry";
import {
  DnsConnectionAttestationSchema,
  TransportResponseMetadataSchema,
  type DnsConnectionAttestation,
  type TransportResponseMetadata,
} from "./runner-contracts";

export type RunnerPolicyErrorCode =
  | "manifest-request-manual"
  | "manifest-adapter-policy"
  | "request-url-policy"
  | "request-endpoint-policy"
  | "transport-request-mismatch"
  | "transport-redirect-forbidden"
  | "dns-host-mismatch"
  | "dns-attestation-expired"
  | "dns-address-duplicate"
  | "dns-address-non-public";

export class RunnerPolicyError extends Error {
  readonly code: RunnerPolicyErrorCode;

  constructor(code: RunnerPolicyErrorCode) {
    super(code);
    this.name = "RunnerPolicyError";
    this.code = code;
  }
}

function publicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }
  const [a = -1, b = -1, c = -1] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function publicIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.includes("%") || normalized.startsWith("::ffff:")) return false;
  const firstHextetText = normalized.split(":", 1)[0];
  if (!firstHextetText) return false;
  const firstHextet = Number.parseInt(firstHextetText, 16);
  if (firstHextet < 0x2000 || firstHextet > 0x3fff) return false;

  const hextets = normalized.split(":");
  const secondHextet = Number.parseInt(hextets[1] || "0", 16);
  if (firstHextet === 0x2001) {
    if (secondHextet === 0 || secondHextet === 2 || secondHextet === 0x0db8) {
      return false;
    }
    if (
      (secondHextet >= 0x10 && secondHextet <= 0x1f) ||
      (secondHextet >= 0x20 && secondHextet <= 0x2f)
    ) {
      return false;
    }
  }
  if (firstHextet === 0x2002 || firstHextet === 0x3fff) return false;
  return true;
}

/** Conservative global-unicast gate for transport DNS/socket attestations. */
export function isPublicNetworkAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return publicIpv4(address);
  if (version === 6) return publicIpv6(address);
  return false;
}

function assertSafeHttpsUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    (url.port !== "" && url.port !== "443") ||
    url.hash !== ""
  ) {
    throw new RunnerPolicyError("request-url-policy");
  }
  return url;
}

function pathMatchesBase(pathname: string, basePathname: string): boolean {
  const base = basePathname.endsWith("/")
    ? basePathname.slice(0, -1)
    : basePathname;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function assertManifestRequestAllowed(
  manifestValue: unknown,
): FrozenRequestManifest {
  const manifest = FrozenRequestManifestSchema.parse(manifestValue);
  assertManifestIntegrity(manifest);
  const parsedIntent = ConnectorIntentSchema.safeParse(manifest.intent);
  if (
    !parsedIntent.success ||
    parsedIntent.data.sourceId !== manifest.sourceId ||
    manifest.adapterVersion !== ADAPTER_VERSION
  ) {
    throw new RunnerPolicyError("manifest-adapter-policy");
  }
  const intent = parsedIntent.data;
  let expectedManifest: FrozenRequestManifest;
  try {
    expectedManifest = compileConnectorIntent(intent, {
      frozenAt: manifest.frozenAt,
      releaseLabel: manifest.releaseLabel,
      cursorIn: manifest.cursorIn,
      destination: manifest.destination,
    });
  } catch {
    throw new RunnerPolicyError("manifest-adapter-policy");
  }
  if (stableStringify(expectedManifest) !== stableStringify(manifest)) {
    throw new RunnerPolicyError("manifest-adapter-policy");
  }
  if (manifest.request.kind !== "http") {
    throw new RunnerPolicyError("manifest-request-manual");
  }
  const requestUrl = assertSafeHttpsUrl(manifest.request.url);
  const passport = getSourcePassport(manifest.sourceId);
  const allowed = passport.endpoints.some((endpoint) => {
    if (endpoint.protocol === "manual-review") return false;
    const base = assertSafeHttpsUrl(endpoint.baseUrl);
    return (
      requestUrl.hostname === base.hostname &&
      requestUrl.port === base.port &&
      pathMatchesBase(requestUrl.pathname, base.pathname)
    );
  });
  if (!allowed) {
    throw new RunnerPolicyError("request-endpoint-policy");
  }
  return manifest;
}

export function assertPublicDnsAttestation(
  value: unknown,
  expectedHostname: string,
  effectiveAt: string,
): DnsConnectionAttestation {
  const attestation = DnsConnectionAttestationSchema.parse(value);
  if (
    attestation.hostname !== expectedHostname ||
    attestation.tlsServerName !== expectedHostname
  ) {
    throw new RunnerPolicyError("dns-host-mismatch");
  }
  if (new Set(attestation.resolvedAddresses).size !== attestation.resolvedAddresses.length) {
    throw new RunnerPolicyError("dns-address-duplicate");
  }
  if (
    !attestation.resolvedAddresses.every(isPublicNetworkAddress) ||
    !isPublicNetworkAddress(attestation.connectedAddress)
  ) {
    throw new RunnerPolicyError("dns-address-non-public");
  }
  const resolvedAtMs = Date.parse(attestation.resolvedAt);
  const effectiveAtMs = Date.parse(effectiveAt);
  if (
    resolvedAtMs > effectiveAtMs ||
    effectiveAtMs - resolvedAtMs > attestation.ttlSeconds * 1_000
  ) {
    throw new RunnerPolicyError("dns-attestation-expired");
  }
  return attestation;
}

export function assertTransportMetadata(
  manifestValue: unknown,
  metadataValue: unknown,
): TransportResponseMetadata {
  const manifest = assertManifestRequestAllowed(manifestValue);
  if (manifest.request.kind !== "http") {
    throw new RunnerPolicyError("manifest-request-manual");
  }
  const metadata = TransportResponseMetadataSchema.parse(metadataValue);
  if (metadata.requestedUrl !== manifest.request.url) {
    throw new RunnerPolicyError("transport-request-mismatch");
  }
  if (
    metadata.finalUrl !== manifest.request.url ||
    metadata.redirectChain.length !== 0 ||
    (metadata.status >= 300 && metadata.status <= 399)
  ) {
    throw new RunnerPolicyError("transport-redirect-forbidden");
  }
  const requestUrl = assertSafeHttpsUrl(manifest.request.url);
  assertPublicDnsAttestation(
    metadata.dns,
    requestUrl.hostname,
    metadata.receivedAt,
  );
  return metadata;
}
