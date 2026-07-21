import assert from "node:assert/strict";
import test from "node:test";

import {
  ADAPTER_VERSION,
  assertManifestRequestAllowed,
  assertPublicDnsAttestation,
  assertTransportMetadata,
  exampleHorizonsManifest,
  freezeRequestManifest,
  getSourcePassport,
  isPublicNetworkAddress,
  sha256Hex,
  stableStringify,
} from "../src/index";

const receivedAt = "2026-07-19T13:40:30Z";
const publicDns = {
  hostname: "ssd.jpl.nasa.gov",
  resolvedAddresses: ["137.78.251.144", "2600:1406:bc00:53::b81e:94c8"],
  connectedAddress: "137.78.251.144",
  resolvedAt: "2026-07-19T13:40:00Z",
  ttlSeconds: 60,
  tlsServerName: "ssd.jpl.nasa.gov",
};

test("network policy accepts only conservative global-unicast addresses", () => {
  for (const address of [
    "8.8.8.8",
    "137.78.251.144",
    "2606:4700:4700::1111",
  ]) {
    assert.equal(isPublicNetworkAddress(address), true, address);
  }
  for (const address of [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "3fff::1",
    "::ffff:10.0.0.1",
    "not-an-address",
  ]) {
    assert.equal(isPublicNetworkAddress(address), false, address);
  }
});

test("runner binds a frozen URL to its passport and attested socket", () => {
  const manifest = assertManifestRequestAllowed(exampleHorizonsManifest);
  assert.equal(manifest.sourceId, "jpl-horizons");
  const requestUrl = manifest.request.kind === "http" ? manifest.request.url : "";
  const metadata = {
    requestedUrl: requestUrl,
    finalUrl: requestUrl,
    status: 200,
    headers: { "content-type": "application/json" },
    redirectChain: [],
    dns: publicDns,
    receivedAt,
  };
  assert.deepEqual(assertTransportMetadata(manifest, metadata), metadata);
});

test("mixed, stale, redirected, and off-passport requests fail closed", () => {
  assert.throws(
    () =>
      assertPublicDnsAttestation(
        {
          ...publicDns,
          resolvedAddresses: ["137.78.251.144", "127.0.0.1"],
        },
        publicDns.hostname,
        receivedAt,
      ),
    /dns-address-non-public/,
  );
  assert.throws(
    () =>
      assertPublicDnsAttestation(
        publicDns,
        publicDns.hostname,
        "2026-07-19T13:42:00Z",
      ),
    /dns-attestation-expired/,
  );

  const requestUrl =
    exampleHorizonsManifest.request.kind === "http"
      ? exampleHorizonsManifest.request.url
      : "";
  assert.throws(
    () =>
      assertTransportMetadata(exampleHorizonsManifest, {
        requestedUrl: requestUrl,
        finalUrl: requestUrl,
        status: 302,
        headers: { location: "https://attacker.example/payload" },
        redirectChain: [],
        dns: publicDns,
        receivedAt,
      }),
    /transport-redirect-forbidden/,
  );

  const passport = getSourcePassport("jpl-horizons");
  const offPassportManifest = freezeRequestManifest({
    passport,
    adapterVersion: ADAPTER_VERSION,
    intent: { kind: "horizons", sourceId: "jpl-horizons" },
    context: {
      frozenAt: "2026-07-19T13:40:00Z",
      releaseLabel: "off-passport-test",
      cursorIn: { kind: "none" },
      destination: {
        payloadClass: "normalized-small-metadata",
        payloadStore: "r2",
        controlPointerStore: "d1",
        objectKey: "tests/off-passport.json",
      },
    },
    request: {
      kind: "http",
      method: "GET",
      url: "https://attacker.example/horizons.api",
      headers: { accept: "application/json" },
      auth: { mode: "none" },
      expectedMediaTypes: ["application/json"],
    },
  });
  assert.throws(
    () => assertManifestRequestAllowed(offPassportManifest),
    /manifest-adapter-policy/,
  );
});

test("a self-consistent manifest cannot launder a source through a weaker intent", () => {
  const tampered = structuredClone(exampleHorizonsManifest);
  tampered.intent = {
    kind: "http-artifact",
    sourceId: "jaxa-darts",
    url: tampered.request.kind === "http" ? tampered.request.url : "",
    expectedMediaTypes: ["application/json"],
  };
  const { manifestChecksum: _manifestChecksum, ...unsigned } = tampered;
  tampered.manifestChecksum.value = sha256Hex(stableStringify(unsigned));
  assert.throws(
    () => assertManifestRequestAllowed(tampered),
    /manifest-adapter-policy/,
  );
});
