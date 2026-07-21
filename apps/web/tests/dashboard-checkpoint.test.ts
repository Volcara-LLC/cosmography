import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  earthDashboardPresentation,
  earthDashboardSiteMedia,
} from "../app/data/earth/dashboard";
import { missionBoardEntries } from "../app/data/missions/mission-board";

async function assertAsset(localAssetUrl: string, bytes: number, sha256: string) {
  const asset = await readFile(new URL(`../public${localAssetUrl}`, import.meta.url));
  assert.equal(asset.byteLength, bytes);
  assert.equal(createHash("sha256").update(asset).digest("hex"), sha256);
}

test("the dashboard Earth mosaic and admitted site image are exact-byte source records", async () => {
  await assertAsset(
    earthDashboardPresentation.localAssetUrl,
    earthDashboardPresentation.derivative.bytes,
    earthDashboardPresentation.derivative.sha256,
  );
  const kennedy = earthDashboardSiteMedia["nasa-kennedy"];
  await assertAsset(kennedy.localAssetUrl, kennedy.bytes, kennedy.sha256);
  assert.match(earthDashboardPresentation.temporalDisclosure, /not a live Earth view/);
  assert.match(kennedy.caption, /1974/);
  assert.match(kennedy.caption, /not a current operational or natural-color view/);
});

test("the main atlas owns the Earth globe, site markers, and reviewed fact card", async () => {
  const [atlas, scene] = await Promise.all([
    readFile(new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/atlas/EarthNetworkAtlasScene.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(atlas, /earthNetworkActive \? \(/);
  assert.match(atlas, /EarthNetworkAtlasScene/);
  assert.match(scene, /earthNetwork\.sites/);
  assert.match(scene, /Interactive NASA imagery-backed Earth globe/);
  assert.match(scene, /data-selected/);
  assert.match(scene, /roleIcon/);
  assert.match(scene, /Rocket/);
  assert.doesNotMatch(scene, /from "next\/image"/);
  assert.match(scene, /reviewed site record/);
  assert.match(scene, /Open the full Earth network record/);
});

test("the mission board exposes working routes without making planned cards clickable", async () => {
  assert.ok(missionBoardEntries.length >= 8);
  assert.deepEqual(
    missionBoardEntries.filter((mission) => mission.state === "available").map((mission) => mission.id),
    ["voyager-1", "perseverance", "apollo-17"],
  );
  assert.ok(
    missionBoardEntries
      .filter((mission) => mission.state === "overview-planned")
      .every((mission) => !("route" in mission)),
  );
  const page = await readFile(new URL("../app/missions/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Overview planned · no route yet/);
  assert.match(page, /Dedicated experience not admitted in this release/);
  assert.match(page, /mission\.route \? \(/);
});

test("recorded Mars views separate still panoramas from actual landing footage", async () => {
  const source = await readFile(
    new URL("../app/components/surface/RecordedPanoramaViewer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Actual landing footage/);
  assert.match(source, /youtube-nocookie\.com\/embed\/GUqsH5y1j1M/);
  assert.match(source, /Actual onboard-camera footage/);
  assert.match(source, /jezeroRoverStations/);
  assert.match(source, /3 separate viewpoints · not a continuous drive/);
  assert.match(source, /not a continuous rover drive or a\s+simulated Street View/);
  assert.match(source, /science\.nasa\.gov\/resource\/watch-nasas-perseverance-rover-land/);
});
