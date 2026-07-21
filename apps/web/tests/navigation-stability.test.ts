import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getPendingRecenterSequence } from "../app/components/universe/UniverseViewport";

const atlasShell = readFileSync(
  new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url),
  "utf8",
);
const universeViewport = readFileSync(
  new URL("../app/components/universe/UniverseViewport.tsx", import.meta.url),
  "utf8",
);
const universeRenderer = readFileSync(
  new URL(
    "../app/components/universe/runtime/createUniverseRenderer.ts",
    import.meta.url,
  ),
  "utf8",
);

test("atlas selections update the destination and request a stable recenter", () => {
  assert.match(atlasShell, /setSelected\(entity\);/);
  assert.match(atlasShell, /focusId=\{selected\.id\}/);
  assert.match(atlasShell, /recenterSequence=\{recenterSequence\}/);
  assert.doesNotMatch(atlasShell, /travelSequence|setTravelSequence/);
});

test("a consumed recenter request is not replayed by a recreated renderer", () => {
  assert.equal(getPendingRecenterSequence(4, 4), null);
  assert.equal(getPendingRecenterSequence(5, 4), 5);
  assert.match(
    universeViewport,
    /controllerRef\.current\.recenterSelection\(pendingSequence\);/,
  );
  assert.doesNotMatch(
    universeViewport,
    /travelSequence|playTravel|getPendingTravelSequence/,
  );
});

test("renderer navigation cannot distort field of view or root geometry", () => {
  assert.doesNotMatch(
    universeRenderer,
    /travelElapsed|travelFinished|applyTravelPulseRequest/,
  );
  assert.doesNotMatch(universeRenderer, /camera\.fov\s*=/);
  assert.doesNotMatch(universeRenderer, /root\.scale\.(?:set|setScalar)\(/);
  assert.match(
    universeRenderer,
    /recenterSelection\(sequence\)\s*\{[\s\S]*?resetView\(\);[\s\S]*?\},/,
  );
});
