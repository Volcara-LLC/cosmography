import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FOUNDATION_RECORDED_ENCOUNTER_RELEASE_ID,
  isRecordedEncounterClearAcknowledgement,
  isRecordedEncounterDeleteAcknowledgement,
  recordedEncountersFromEnvelope,
} from "../app/lib/client/recorded-encounters";

const marsRecord = {
  entity: {
    id: "mars",
    name: "Mars",
    slug: "mars",
    kind: "world",
    domain: "globe",
    href: "/?focus=mars&release=rel_landing_atlas_v0_1_0",
  },
  firstRecordedAtMs: 1_000,
  lastRecordedAtMs: 1_001,
  recordCount: 2,
  method: "manual-atlas-record",
  firstReleaseId: FOUNDATION_RECORDED_ENCOUNTER_RELEASE_ID,
  truth: {
    userConfirmed: true,
    passiveNavigation: false,
    completionClaim: false,
    achievementClaim: false,
    scientificDiscoveryClaim: false,
  },
} as const;

const maximumDateTimestampMs = 8_640_000_000_000_000;

function envelope(records: unknown) {
  return {
    schemaId: "cosmography.user-recorded-encounters",
    schemaVersion: "1.0.0",
    records,
  };
}

test("client accepts only exact manual encounter records", () => {
  assert.deepEqual(recordedEncountersFromEnvelope(envelope([marsRecord])), [
    marsRecord,
  ]);
  assert.deepEqual(recordedEncountersFromEnvelope(envelope(marsRecord)), [
    marsRecord,
  ]);

  for (const invalid of [
    { ...marsRecord, method: "passive-navigation" },
    { ...marsRecord, firstReleaseId: "rel_future" },
    { ...marsRecord, recordCount: 0 },
    { ...marsRecord, lastRecordedAtMs: 999 },
    { ...marsRecord, lastRecordedAtMs: maximumDateTimestampMs + 1 },
    {
      ...marsRecord,
      entity: { ...marsRecord.entity, id: "unknown" },
    },
    {
      ...marsRecord,
      entity: { ...marsRecord.entity, href: "//outside.example/mars" },
    },
    {
      ...marsRecord,
      truth: { ...marsRecord.truth, passiveNavigation: true },
    },
    { ...marsRecord, extra: true },
  ]) {
    assert.equal(recordedEncountersFromEnvelope(envelope(invalid)), null);
  }

  assert.notEqual(
    recordedEncountersFromEnvelope(
      envelope({
        ...marsRecord,
        firstRecordedAtMs: maximumDateTimestampMs,
        lastRecordedAtMs: maximumDateTimestampMs,
      }),
    ),
    null,
  );
});

test("client rejects drifted envelopes and accepts exact delete acknowledgements", () => {
  assert.equal(
    recordedEncountersFromEnvelope({
      ...envelope([marsRecord]),
      schemaVersion: "2.0.0",
    }),
    null,
  );
  assert.equal(
    isRecordedEncounterDeleteAcknowledgement(
      envelope({ entityId: "mars" }),
      "mars",
    ),
    true,
  );
  assert.equal(
    isRecordedEncounterDeleteAcknowledgement(
      envelope({ entityId: "voyager-1" }),
      "mars",
    ),
    false,
  );
  assert.equal(
    isRecordedEncounterClearAcknowledgement(envelope({ deletedCount: 2 })),
    true,
  );
  assert.equal(
    isRecordedEncounterClearAcknowledgement(
      envelope({ deletedCount: 2, userId: "leak" }),
    ),
    false,
  );
});

test("recording is a single explicit action with no browser persistence fallback", async () => {
  const [action, history, clientContract, hangar, detailPanel] = await Promise.all([
    readFile(
      new URL(
        "../app/components/atlas/RecordedEncounterAction.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/components/account/RecordedEncountersHistory.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../app/lib/client/recorded-encounters.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/account/SpacecraftHangar.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/atlas/AtlasDetailPanel.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.equal((action.match(/method:\s*"POST"/g) ?? []).length, 1);
  assert.doesNotMatch(action.slice(0, action.indexOf("async function recordEncounter")), /method:\s*"POST"/);
  assert.match(action, /body:\s*JSON\.stringify\(\{ entityId, releaseId \}\)/);
  assert.match(
    action,
    /Only pressing the button creates a record\. Viewing, selecting, or navigating to this\s*object never records anything/s,
  );
  assert.match(action, /!\[200, 201\]\.includes\(response\.status\)/);
  assert.doesNotMatch(action, /response\.status !== 201/);
  assert.doesNotMatch(
    `${action}\n${history}\n${clientContract}`,
    /localStorage|sessionStorage|indexedDB/i,
  );
  assert.doesNotMatch(action, /^\s*["']use client["'];/m);
  assert.doesNotMatch(history, /^\s*["']use client["'];/m);
  assert.match(hangar, /^"use client";/);
  assert.match(detailPanel, /^"use client";/);
  assert.match(history, /role="alertdialog"/);
  assert.match(history, /href=\{record\.entity\.href\}/);
  assert.match(action, /unavailableRef\.current\?\.focus\(\)/);
  assert.match(history, /unavailableRef\.current\?\.focus\(\)/);
  assert.match(action, /if \(userTriggered\) \{\s*window\.requestAnimationFrame/s);
  assert.match(history, /if \(userTriggered\) \{\s*window\.requestAnimationFrame/s);
});

test("sign-in return paths observe every programmatic atlas URL rewrite", async () => {
  const [locationClient, atlasShell, flightDeck, guidedTour] = await Promise.all([
    readFile(new URL("../app/lib/client/location.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/atlas/FlightDeck.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/components/tours/GuidedTourExperience.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(locationClient, /window\.location\.pathname/);
  assert.match(locationClient, /window\.location\.search/);
  assert.match(locationClient, /window\.location\.hash/);
  assert.match(
    locationClient,
    /addEventListener\(COSMOGRAPHY_LOCATION_CHANGE_EVENT, onChange\)/,
  );

  for (const source of [atlasShell, flightDeck, guidedTour]) {
    const replacements = source.match(/window\.history\.replaceState\(/g) ?? [];
    const notifications =
      source.match(/notifyCosmographyLocationChange\(\)/g) ?? [];
    assert.ok(replacements.length > 0);
    assert.equal(notifications.length, replacements.length);
  }
});
