import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  jezeroDeltaRoverPanorama360,
  jezeroRecordedPanorama,
  jezeroRoverPanorama360,
  jezeroRoverStations,
  vanZylRoverPanorama360,
} from "../app/data/surface/jezero-recorded-panorama";
import { marsJezeroPreIngestLedger } from "../app/data/surface/mars-jezero-provenance";

test("the retained Sol 4 Jezero detail derivative is exact-byte bound", async () => {
  const bytes = await readFile(
    new URL("../public/assets/mars/pia23727-sol4-mastcam-z-panorama.jpg", import.meta.url),
  );

  assert.equal(bytes.byteLength, jezeroRecordedPanorama.byteLength);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), jezeroRecordedPanorama.sha256);
  assert.equal(jezeroRecordedPanorama.productIdentifier, "PIA23727");
  assert.equal(jezeroRecordedPanorama.rights.displayAllowed, true);
  assert.equal(jezeroRecordedPanorama.rights.endorsementAllowed, false);
});

test("the retained Sol 3 rover panorama is exact-byte bound and truthfully limited", async () => {
  const [sourceBytes, browserBytes] = await Promise.all([
    new URL("../public/assets/mars/pia24264-sol3-mastcam-z-360.jpg", import.meta.url),
    new URL("../public/assets/mars/pia24264-sol3-mastcam-z-360-8192-q82.jpg", import.meta.url),
  ].map((url) => readFile(url)));

  assert.equal(sourceBytes.byteLength, jezeroRoverPanorama360.sourceAsset.byteLength);
  assert.equal(
    createHash("sha256").update(sourceBytes).digest("hex"),
    jezeroRoverPanorama360.sourceAsset.sha256,
  );
  assert.equal(browserBytes.byteLength, jezeroRoverPanorama360.byteLength);
  assert.equal(
    createHash("sha256").update(browserBytes).digest("hex"),
    jezeroRoverPanorama360.sha256,
  );
  assert.equal(jezeroRoverPanorama360.productIdentifier, "PIA24264");
  assert.equal(jezeroRoverPanorama360.sourceAsset.dimensions.width, 9_238);
  assert.equal(jezeroRoverPanorama360.dimensions.width, 8_192);
  assert.equal(jezeroRoverPanorama360.capture.sourceFrames, 142);
  assert.equal(jezeroRoverPanorama360.capture.horizontalCoverageDegrees, 360);
  assert.equal(jezeroRoverPanorama360.authority.horizontalPanoramaCoverage, true);
  assert.equal(jezeroRoverPanorama360.authority.completeSphericalCoverage, false);
  assert.equal(jezeroRoverPanorama360.authority.continuousFootage, false);
});

test("the later Jezero rover stations are exact-byte bound and remain discrete views", async () => {
  await Promise.all(
    [vanZylRoverPanorama360, jezeroDeltaRoverPanorama360].map(async (station) => {
      const bytes = await readFile(new URL(`../public${station.localAssetUrl}`, import.meta.url));
      assert.equal(bytes.byteLength, station.byteLength);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), station.sha256);
      assert.equal(station.capture.horizontalCoverageDegrees, 360);
      assert.equal(station.authority.completeSphericalCoverage, false);
      assert.equal(station.authority.continuousFootage, false);
    }),
  );

  assert.equal(jezeroRoverStations.length, 3);
  assert.equal(new Set(jezeroRoverStations.map((station) => station.captureNodeId)).size, 3);
  assert.deepEqual(
    jezeroRoverStations.map((station) => station.productIdentifier),
    ["PIA24264", "PIA24663", "PIA24921"],
  );
});

test("recorded pixels do not promote the withheld physical capture context", () => {
  const context = marsJezeroPreIngestLedger.captureContexts.find(
    (candidate) => candidate.captureNodeId === jezeroRecordedPanorama.captureNodeId,
  );

  assert.ok(context);
  assert.equal(jezeroRecordedPanorama.authority.recordedPixels, true);
  assert.equal(jezeroRecordedPanorama.authority.sourceFramesRetained, false);
  assert.equal(jezeroRecordedPanorama.authority.physicalCameraPose, false);
  assert.equal(jezeroRecordedPanorama.authority.continuousFootage, false);
  assert.equal(jezeroRoverPanorama360.authority.physicalCameraPose, false);
  assert.equal(jezeroRoverPanorama360.authority.terrainBinding, false);
  assert.equal(context.renderableCameraPose, false);
  assert.equal(context.renderAllowed, false);
  assert.equal(context.releaseEligible, false);
});

test("the final Seven Scales control targets only the exact recorded node", async () => {
  const source = await readFile(
    new URL("../app/components/tours/GuidedTourCard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /href="\/worlds\/mars\?view=recorded&node=perseverance-landing-sol-4&release=rel_landing_atlas_v0_1_0"/,
  );
  assert.match(source, /Enter the recorded Jezero view/);
});
