import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the primary atlas and directory navigation expose the project vision", async () => {
  const [atlas, header] = await Promise.all([
    readFile(new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/navigation/DirectoryHeader.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(atlas, /href="\/vision"/);
  assert.match(atlas, />\s*Vision\s*<\/Link>/);
  assert.match(header, /href="\/vision">Vision<\/Link>/);
});

test("the vision page reports direction, construction boundaries, and the all-missions data-first path", async () => {
  const source = await readFile(new URL("../app/vision/page.tsx", import.meta.url), "utf8");

  assert.match(source, /Project vision · active private build/);
  assert.match(source, /Directional build status · July 2026/);
  assert.match(source, /Constructed now/);
  assert.match(source, /Still under construction/);
  assert.match(source, /All-missions interaction architecture/);
  assert.match(source, /Data first\. Then movement\./);
  assert.match(source, /Compile the mission record/);
  assert.match(source, /Enter recorded viewpoints/);
  assert.match(source, /Add truthful reconstruction/);
  assert.match(source, /This page reports direction, not a claim that the product is finished/);
});
