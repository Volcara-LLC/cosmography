import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { missionBoardEntries } from "../app/data/missions/mission-board";

test("Star Systems opens a category overview before either admitted system", async () => {
  const [shell, overview] = await Promise.all([
    readFile(new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/atlas/AtlasDomainOverview.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(shell, /setDomainOverview\(section\)/);
  assert.match(shell, /section === "systems" \|\| section === "missions"/);
  assert.match(shell, /domainOverview \? \(/);
  assert.doesNotMatch(shell, /systems: "solar-system"/);
  assert.match(overview, /Two systems are indexed in this release/);
  assert.match(overview, /onSelectEntity\("solar-system"\)/);
  assert.match(overview, /onSelectEntity\("trappist-1"\)/);
  assert.match(overview, /not astrometry or catalog completeness/);
});

test("Missions opens a multi-scale board with working paths and explicit planned gaps", async () => {
  const overview = await readFile(
    new URL("../app/components/atlas/AtlasDomainOverview.tsx", import.meta.url),
    "utf8",
  );

  assert.deepEqual(
    missionBoardEntries.filter((mission) => mission.state === "available").map((mission) => mission.id),
    ["voyager-1", "perseverance", "apollo-17"],
  );
  assert.match(overview, /entityId: "mars"/);
  assert.match(overview, /entityId: "apollo-17"/);
  assert.match(overview, /entityId: "voyager-1"/);
  assert.match(overview, /entityId: "jwst-deep-fields"/);
  assert.match(overview, /Calibrated pixels; mission overview planned/);
  assert.match(overview, /mission overviews planned/);
  assert.match(overview, /<details className=\{styles\.planned\}>/);
  assert.doesNotMatch(overview, /<details className=\{styles\.planned\} open>/);
  assert.match(overview, /Visible roadmap gaps/);
});

test("the planned-missions disclosure starts collapsed in a reserved center lane", async () => {
  const css = await readFile(
    new URL("../app/components/atlas/AtlasDomainOverview.module.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.planned\s*\{[\s\S]*?left: 50%;[\s\S]*?transform: translateX\(-50%\)/);
  assert.match(css, /\.planned summary\s*\{[\s\S]*?min-height: 44px/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.planned\s*\{[\s\S]*?bottom: 3\.65rem/);
});
