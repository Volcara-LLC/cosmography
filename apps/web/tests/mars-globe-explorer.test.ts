import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  marsMappedRegions,
  marsGlobePlaces,
  marsGlobePresentation,
} from "../app/data/surface/mars-globe-explorer";

test("the Mars globe presentation texture is exact-byte bound to its derivative manifest", async () => {
  const bytes = await readFile(
    new URL(
      `../public${marsGlobePresentation.localAssetUrl}`,
      import.meta.url,
    ),
  );

  assert.equal(bytes.byteLength, marsGlobePresentation.derivative.bytes);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    marsGlobePresentation.derivative.sha256,
  );
  assert.equal(marsGlobePresentation.representationClass, "derived-observation");
  assert.equal(marsGlobePresentation.rights.access, "Public domain");
  assert.match(marsGlobePresentation.sourceProductUrl, /^https:\/\/astrogeology\.usgs\.gov\//);
});

test("named Mars markers use positive-east Gazetteer centers and only Jezero opens a retained view", () => {
  assert.deepEqual(
    marsGlobePlaces.map((place) => place.id),
    ["jezero", "gale", "olympus-mons", "valles-marineris"],
  );
  assert.ok(
    marsGlobePlaces.every(
      (place) =>
        place.latitude >= -90 &&
        place.latitude <= 90 &&
        place.longitudeEast >= 0 &&
        place.longitudeEast < 360 &&
        place.sourceUrl.startsWith("https://planetarynames.wr.usgs.gov/Feature/"),
    ),
  );

  const surfacePlaces = marsGlobePlaces.filter(
    (place) => place.surfaceView.state === "recorded-presentation-available",
  );
  assert.equal(surfacePlaces.length, 1);
  assert.equal(surfacePlaces[0]?.id, "jezero");
  assert.equal(surfacePlaces[0]?.surfaceView.state, "recorded-presentation-available");
  assert.ok(marsGlobePlaces.every((place) => !("presentationExtent" in place)));
});

test("the Mars explorer retains the truth boundary around the Google-Earth-like interaction", async () => {
  const source = await readFile(
    new URL("../app/components/surface/MarsGlobeExplorer.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Derived observation/);
  assert.match(source, /not rover-scale detail/);
  assert.match(source, /Recorded surface views appear only where this release retains one/);
  assert.match(source, /Enter recorded surface view/);
  assert.match(source, /data-label-side/);
  assert.match(source, /Center marker only · no geological boundary asserted/);
  assert.match(source, /selected USGS canyon-floor deposits/);
  assert.match(source, /USGS mapped shield members/);
  assert.match(source, /THREE\.LineLoop/);
  assert.doesNotMatch(source, /extentPoints|presentationExtent/);
});

test("Mars mapped regions are exact-byte USGS derivatives with bounded meanings", async () => {
  assert.deepEqual(marsMappedRegions.map((region) => region.id), [
    "valles-marineris-floor-units",
    "olympus-mons-shield-units",
  ]);
  for (const region of marsMappedRegions) {
    const bytes = await readFile(new URL(`../public${region.localAssetUrl}`, import.meta.url));
    assert.equal(bytes.byteLength, region.derivative.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), region.derivative.sha256);
    assert.match(region.sourceProductUrl, /^https:\/\/astrogeology\.usgs\.gov\//);
  }
  assert.match(marsMappedRegions[0].meaning, /not a complete Valles Marineris boundary/);
  assert.match(marsMappedRegions[1].meaning, /aureole deposits are excluded/);
});

test("the main atlas owns the Mars globe, zoom-context controls, and retained detail route", async () => {
  const [atlasShell, atlasScene] = await Promise.all([
    readFile(
      new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/atlas/MarsAtlasScene.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(atlasShell, /marsAtlasActive \? \(/);
  assert.match(atlasShell, /marsAtlasActive\s*\n\s*\? "Derived orbital mosaic"/);
  assert.match(atlasShell, /className="scene-disclosure"/);
  assert.match(atlasShell, /marsDetailTier === "regional"/);
  assert.match(atlasShell, /aria-label="Mars exploration"/);
  assert.match(atlasShell, />\s*Surface view\s*</);
  assert.match(atlasShell, /Full Mars record/);
  assert.match(atlasShell, /marsSceneRef\.current\?\.exploreJezero\(\)/);
  assert.match(atlasScene, /RecordedPanoramaViewer/);
  assert.match(atlasScene, /recorded 360° horizontal mosaic/);
  assert.match(atlasScene, /not a continuous rover route/);
});

test("the universe domain tab leads with the public name and retains cosmology as its descriptor", async () => {
  const atlasShell = await readFile(
    new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    atlasShell,
    /cosmology:\s*\{\s*label: "Observable Universe",\s*descriptor: "Cosmology"/,
  );
});
