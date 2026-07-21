import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  solarSystemBodies,
  solarSystemPresentation,
} from "../app/data/solar-system-explorer";

test("the Solar System overview exposes the ordered eight planets and only Mars has a deep world handoff", () => {
  assert.deepEqual(
    solarSystemBodies.map((body) => body.name),
    ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
  );
  assert.equal(solarSystemBodies.filter((body) => body.atlasDestination).length, 1);
  assert.equal(solarSystemBodies.find((body) => body.id === "mars")?.atlasDestination, "mars");
  assert.ok(solarSystemBodies.every((body) => body.orbitRadius > 0 && body.visualRadius > 0));
});

test("the system scene discloses its compressed presentation instead of claiming ephemerides", () => {
  assert.equal(solarSystemPresentation.representationClass, "procedural-scientific");
  assert.match(solarSystemPresentation.disclosure, /Orbital spacing is compressed/);
  assert.match(solarSystemPresentation.disclosure, /no current ephemeris/);
});

test("the main atlas distinguishes Stars from Star Systems and connects Solar System to Mars", async () => {
  const source = await readFile(
    new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /stars:\s*\{\s*label: "Stars"/);
  assert.match(source, /systems:\s*\{\s*label: "Star Systems"/);
  assert.match(source, /sectionDestination/);
  assert.match(source, /section === "systems" \|\| section === "missions"/);
  assert.match(source, /setDomainOverview\(section\)/);
  assert.match(source, /solarSystemActive/);
  assert.match(source, /<SolarSystemAtlasScene/);
  assert.match(source, /onSelectTrappist/);
  assert.match(source, /selected\.id === "solar-system" \? "Enter Mars"/);
});

test("the Solar System scene exposes both indexed systems without requiring the side card", async () => {
  const source = await readFile(
    new URL("../app/components/atlas/SolarSystemAtlasScene.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Star systems in this foundation release/);
  assert.match(source, /Star Systems · 2 indexed/);
  assert.match(source, /Solar System/);
  assert.match(source, /TRAPPIST-1/);
  assert.match(source, /onClick=\{onSelectTrappist\}/);
});
