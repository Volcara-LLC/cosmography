import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isSavedPlaceDeleteAcknowledgement,
  isSavedPlaceRecord,
  savedPlaceFromEnvelope,
  savedPlacesFromEnvelope,
} from "../app/lib/client/personal-storage";
import {
  SAVED_PLACES_SCHEMA_ID,
  SAVED_PLACES_SCHEMA_VERSION,
  SAVED_PLACE_METHOD,
  SAVED_PLACE_RELEASE_ID,
  SAVED_PLACE_TRUTH,
  createSavedPlaceHref,
  savedPlaceIdentityFor,
} from "../app/lib/personal/saved-place-foundation";

const marsIdentity = savedPlaceIdentityFor("mars")!;
const jezeroIdentity = savedPlaceIdentityFor("jezero")!;

function savedPlace(
  id: string,
  identity = marsIdentity,
  savedAtMs = 2_000,
  appearance: "scientific" | "immersive" = "immersive",
) {
  return {
    id,
    entity: { ...identity },
    scene: {
      focusId: identity.id,
      appearance,
      timelineYear: 2026,
      releaseId: SAVED_PLACE_RELEASE_ID,
    },
    href: createSavedPlaceHref(identity.slug, appearance),
    savedAtMs,
    method: SAVED_PLACE_METHOD,
    truth: { ...SAVED_PLACE_TRUTH },
  };
}

function envelope(records: unknown) {
  return {
    schemaId: SAVED_PLACES_SCHEMA_ID,
    schemaVersion: SAVED_PLACES_SCHEMA_VERSION,
    releaseId: SAVED_PLACE_RELEASE_ID,
    records,
  };
}

const marsPlace = savedPlace(`bmk_${"b".repeat(32)}`);

test("saved-place client accepts only exact server-derived records and acknowledgements", () => {
  assert.equal(isSavedPlaceRecord(marsPlace), true);
  assert.deepEqual(savedPlaceFromEnvelope(envelope(marsPlace)), marsPlace);
  assert.deepEqual(savedPlacesFromEnvelope(envelope([marsPlace])), [marsPlace]);
  assert.equal(
    isSavedPlaceDeleteAcknowledgement(
      envelope({ deletedId: marsPlace.id }),
      marsPlace.id,
    ),
    true,
  );
  assert.equal(
    isSavedPlaceDeleteAcknowledgement(
      envelope({ deletedId: `bmk_${"c".repeat(32)}` }),
      marsPlace.id,
    ),
    false,
  );
  assert.equal(
    isSavedPlaceDeleteAcknowledgement(
      envelope({ deletedId: marsPlace.id, userId: "leak" }),
      marsPlace.id,
    ),
    false,
  );
});

test("saved-place client rejects identity, scene, release, href, truth, and envelope drift", () => {
  for (const invalid of [
    { ...marsPlace, id: "bmk_short" },
    { ...marsPlace, entity: { ...marsPlace.entity, name: "Red planet" } },
    { ...marsPlace, entity: { ...marsPlace.entity, slug: "red-planet" } },
    { ...marsPlace, entity: { ...marsPlace.entity, domain: "surface" } },
    { ...marsPlace, scene: { ...marsPlace.scene, focusId: "jezero" } },
    { ...marsPlace, scene: { ...marsPlace.scene, appearance: "observed" } },
    { ...marsPlace, scene: { ...marsPlace.scene, timelineYear: 2027 } },
    { ...marsPlace, scene: { ...marsPlace.scene, releaseId: "rel_future" } },
    { ...marsPlace, href: "/?focus=mars" },
    { ...marsPlace, href: "//outside.example/mars" },
    { ...marsPlace, savedAtMs: 0 },
    { ...marsPlace, method: "passive-navigation" },
    { ...marsPlace, truth: { ...marsPlace.truth, physicalCameraPose: true } },
    { ...marsPlace, truth: { ...marsPlace.truth, extra: false } },
    { ...marsPlace, extra: true },
  ]) {
    assert.equal(isSavedPlaceRecord(invalid), false);
    assert.equal(savedPlaceFromEnvelope(envelope(invalid)), null);
  }

  assert.equal(
    savedPlaceFromEnvelope({ ...envelope(marsPlace), schemaVersion: "2.0.0" }),
    null,
  );
  assert.equal(
    savedPlaceFromEnvelope({ ...envelope(marsPlace), releaseId: "rel_future" }),
    null,
  );
  assert.equal(
    savedPlaceFromEnvelope({ ...envelope(marsPlace), userId: "leak" }),
    null,
  );
  assert.equal(savedPlacesFromEnvelope(envelope(marsPlace)), null);
});

test("saved-place lists enforce quota, uniqueness, and newest-first deterministic order", () => {
  const newerMars = savedPlace(`bmk_${"f".repeat(32)}`, marsIdentity, 2_001);
  const olderJezero = savedPlace(`bmk_${"e".repeat(32)}`, jezeroIdentity, 2_000);
  assert.deepEqual(
    savedPlacesFromEnvelope(envelope([newerMars, olderJezero])),
    [newerMars, olderJezero],
  );
  assert.equal(
    savedPlacesFromEnvelope(envelope([olderJezero, newerMars])),
    null,
  );
  assert.equal(
    savedPlacesFromEnvelope(
      envelope([
        newerMars,
        { ...olderJezero, id: newerMars.id },
      ]),
    ),
    null,
  );
  assert.equal(
    savedPlacesFromEnvelope(
      envelope([
        newerMars,
        savedPlace(`bmk_${"d".repeat(32)}`, marsIdentity, 2_000),
      ]),
    ),
    null,
  );
  assert.equal(
    savedPlacesFromEnvelope(
      envelope(
        Array.from({ length: 16 }, (_, index) =>
          savedPlace(
            `bmk_${index.toString(16).padStart(32, "0")}`,
            marsIdentity,
            3_000 - index,
          ),
        ),
      ),
    ),
    null,
  );
});

test("saving is one explicit exact-release action with no browser persistence fallback", async () => {
  const [atlasShell, client, savedPlaces, hangar, page] = await Promise.all([
    readFile(
      new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/lib/client/personal-storage.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/account/SavedPlaces.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/account/SpacecraftHangar.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/me/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal((client.match(/method:\s*"POST"/g) ?? []).length, 1);
  assert.equal((savedPlaces.match(/method:\s*"DELETE"/g) ?? []).length, 1);
  assert.match(
    atlasShell,
    /const \{ savePrivatePlace \} = await import\([\s\S]*?personal-storage[\s\S]*?savePrivatePlace\(\{\s*entityId:\s*selected\.id,\s*appearance,\s*releaseId:\s*atlasRelease\.id,\s*\}\)/,
  );
  const saveFunction = atlasShell.slice(
    atlasShell.indexOf("async function savePlace"),
    atlasShell.indexOf("const enterSurface"),
  );
  assert.doesNotMatch(
    saveFunction,
    /label:|domain:|focusId:|timelineYear:|scene:/,
  );
  assert.match(
    savedPlaces,
    /body:\s*JSON\.stringify\(\{\s*id:\s*record\.id,\s*expectedSavedAtMs:\s*record\.savedAtMs,\s*\}\)/,
  );
  assert.match(atlasShell, /"Save place"/);
  assert.match(atlasShell, /href="\/me#saved-places"/);
  assert.match(savedPlaces, /Passive viewing never creates one/);
  assert.doesNotMatch(
    `${atlasShell}\n${client}\n${savedPlaces}\n${hangar}\n${page}`,
    /localStorage|sessionStorage|indexedDB/i,
  );
  assert.match(hangar, /import \{ SavedPlaces \} from "\.\/SavedPlaces"/);
  assert.ok(hangar.indexOf("<SavedPlaces />") < hangar.indexOf("styles.modelSection"));
});

test("Saved Places exposes focus-safe load, retry, reopen, and confirmed deletion states", async () => {
  const savedPlaces = await readFile(
    new URL("../app/components/account/SavedPlaces.tsx", import.meta.url),
    "utf8",
  );

  for (const state of [
    '"loading"',
    '"ready"',
    '"signed-out"',
    '"unavailable"',
    '"error"',
  ]) {
    assert.match(savedPlaces, new RegExp(state));
  }
  assert.match(savedPlaces, /id="saved-places"/);
  assert.match(savedPlaces, /href=\{record\.href\}/);
  assert.match(savedPlaces, /role="alertdialog"/);
  assert.match(savedPlaces, /data-confirmation-mode="inline-nonmodal"/);
  assert.match(savedPlaces, /event\.key !== "Escape"/);
  assert.match(savedPlaces, /removeConfirmRefs\.current\.get\(record\.id\)\?\.focus\(\)/);
  assert.match(savedPlaces, /removeTriggerRefs\.current\.get\(record\.id\)\?\.focus\(\)/);
  assert.match(savedPlaces, /cardRefs\.current\.get\(nextRecord\.id\)\?\.focus\(\)/);
  assert.match(savedPlaces, /else headingRef\.current\?\.focus\(\)/);
  assert.match(savedPlaces, /signInRef\.current\?\.focus\(\)/);
  assert.match(savedPlaces, /unavailableRef\.current\?\.focus\(\)/);
  assert.match(savedPlaces, /retryRef\.current\?\.focus\(\)/);
  assert.match(savedPlaces, /reloadRef\.current\?\.focus\(\)/);
  assert.match(savedPlaces, /setRequiresReload\(true\)/);
  assert.match(savedPlaces, /existing list remains\s*visible without claiming that it changed/s);
  assert.match(savedPlaces, /No browser copy was created/);
  assert.match(savedPlaces, /subscribeToCosmographyLocation/);
  assert.match(savedPlaces, /personalStorageSignInHref\(returnTo\)/);
  const initialEffect =
    savedPlaces.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[loadPlaces\]\);/)?.[0] ?? "";
  assert.doesNotMatch(initialEffect, /\.focus\(/);
});
