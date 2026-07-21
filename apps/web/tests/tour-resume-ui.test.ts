import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FOUNDATION_TOUR_RESUME_RELEASE_ID,
  MANUAL_TOUR_RESUME_METHOD,
  SEVEN_SCALES_TOUR_ID,
  TOUR_RESUME_API_PATH,
  canonicalTourResumeHref,
  isTourResumeRecord,
  parseTourResumeEnvelope,
} from "../app/lib/client/tour-resume";

const maximumDateTimestampMs = 8_640_000_000_000_000;

const marsResume = {
  tour: {
    id: SEVEN_SCALES_TOUR_ID,
    slug: "seven-scales-to-jezero",
    title: "Seven Scales to Jezero",
    releaseId: FOUNDATION_TOUR_RESUME_RELEASE_ID,
  },
  resume: {
    ordinal: 6,
    stopId: "scale-mars",
    stopTitle: "Mars",
    targetEntityId: "mars",
    href: canonicalTourResumeHref(6),
  },
  savedAtMs: 1_000,
  method: MANUAL_TOUR_RESUME_METHOD,
  truth: {
    userConfirmed: true,
    passiveNavigation: false,
    resumeStateOnly: true,
    storedStateDefinesTour: false,
    completionClaim: false,
    achievementClaim: false,
    scientificDiscoveryClaim: false,
  },
} as const;

function envelope(record: unknown) {
  return {
    schemaId: "cosmography.user-tour-resume",
    schemaVersion: "1.0.0",
    record,
  };
}

test("client accepts only the exact private Seven Scales resume contract", () => {
  assert.equal(TOUR_RESUME_API_PATH, "/api/v1/me/tours/seven-scales-to-jezero/resume");
  assert.equal(isTourResumeRecord(marsResume), true);
  assert.deepEqual(parseTourResumeEnvelope(envelope(marsResume)), {
    valid: true,
    record: marsResume,
  });
  assert.deepEqual(parseTourResumeEnvelope(envelope(null)), {
    valid: true,
    record: null,
  });
  assert.equal(
    isTourResumeRecord({
      ...marsResume,
      savedAtMs: maximumDateTimestampMs,
    }),
    true,
  );

  for (const invalid of [
    { ...marsResume, method: "passive-tour-view" },
    { ...marsResume, savedAtMs: 0 },
    { ...marsResume, savedAtMs: maximumDateTimestampMs + 1 },
    { ...marsResume, extra: true },
    {
      ...marsResume,
      tour: { ...marsResume.tour, title: "Seven Scales" },
    },
    {
      ...marsResume,
      tour: { ...marsResume.tour, releaseId: "rel_future" },
    },
    {
      ...marsResume,
      resume: { ...marsResume.resume, ordinal: 7 },
    },
    {
      ...marsResume,
      resume: { ...marsResume.resume, stopId: "scale-jezero" },
    },
    {
      ...marsResume,
      resume: { ...marsResume.resume, stopTitle: "Jezero Crater" },
    },
    {
      ...marsResume,
      resume: { ...marsResume.resume, targetEntityId: "jezero" },
    },
    {
      ...marsResume,
      resume: { ...marsResume.resume, href: "//outside.example/tour" },
    },
    {
      ...marsResume,
      resume: {
        ...marsResume.resume,
        href: "/?focus=mars&tour=seven-scales-to-jezero&step=6&release=rel_landing_atlas_v0_1_0",
      },
    },
    {
      ...marsResume,
      truth: { ...marsResume.truth, passiveNavigation: true },
    },
    {
      ...marsResume,
      truth: { ...marsResume.truth, completionClaim: true },
    },
    {
      ...marsResume,
      truth: { ...marsResume.truth, extra: false },
    },
  ]) {
    assert.equal(isTourResumeRecord(invalid), false);
    assert.equal(parseTourResumeEnvelope(envelope(invalid)).valid, false);
  }
});

test("canonical resume links bind every exact stop and reject invalid ordinals", () => {
  const targets = [
    "observable-universe",
    "laniakea",
    "local-group",
    "milky-way",
    "solar-system",
    "mars",
    "jezero",
  ];
  assert.deepEqual(
    targets.map((_, index) => canonicalTourResumeHref(index + 1)),
    targets.map(
      (target, index) =>
        `/?tour=seven-scales-to-jezero&step=${index + 1}&focus=${target}&release=rel_landing_atlas_v0_1_0`,
    ),
  );
  for (const ordinal of [0, 8, 1.5, Number.NaN]) {
    assert.throws(() => canonicalTourResumeHref(ordinal), RangeError);
  }
});

test("client UI writes only from explicit save and clear actions", async () => {
  const [controls, experience, card, summary, hangar, clientContract] =
    await Promise.all([
      readFile(
        new URL(
          "../app/components/tours/GuidedTourResumeControls.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/components/tours/GuidedTourExperience.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../app/components/tours/GuidedTourCard.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/components/account/TourResumeSummary.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../app/components/account/SpacecraftHangar.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../app/lib/client/tour-resume.ts", import.meta.url),
        "utf8",
      ),
    ]);

  assert.equal((controls.match(/method:\s*"PUT"/g) ?? []).length, 1);
  assert.equal((controls.match(/method:\s*"DELETE"/g) ?? []).length, 1);
  assert.equal((controls.match(/method:\s*"GET"/g) ?? []).length, 1);
  assert.doesNotMatch(experience, /fetch\(|method:\s*"(?:PUT|DELETE)"/);
  assert.doesNotMatch(card, /fetch\(|method:\s*"(?:PUT|DELETE)"/);
  assert.equal((summary.match(/method:\s*"GET"/g) ?? []).length, 1);
  assert.doesNotMatch(summary, /method:\s*"(?:PUT|POST|DELETE)"/);
  assert.match(
    controls,
    /body:\s*JSON\.stringify\(\{\s*tourId:\s*SEVEN_SCALES_TOUR_ID,\s*releaseId:\s*FOUNDATION_TOUR_RESUME_RELEASE_ID,\s*resumeOrdinal:\s*currentOrdinal,\s*expectedSavedAtMs:\s*record\?\.savedAtMs\s*\?\?\s*null,/s,
  );
  assert.match(
    controls,
    /body:\s*JSON\.stringify\(\{ expectedSavedAtMs: record\.savedAtMs \}\)/,
  );
  assert.match(controls, /Save this scale for later/);
  assert.match(controls, /Resume saved scale/);
  assert.match(controls, /onClick=\{\(\) => onResume\(record\.resume\.ordinal\)\}/);
  assert.match(controls, /role="group"/);
  assert.match(controls, /data-confirmation-mode="inline-nonmodal"/);
  assert.doesNotMatch(controls, /role="alertdialog"|aria-modal/);
  assert.match(controls, /event\.key !== "Escape"/);
  assert.match(controls, /Next, Back, Evidence, and the transcript\s*never save anything/s);
  assert.match(summary, /one literal place to reopen/);
  assert.match(hangar, /<TourResumeSummary \/>/);
  assert.doesNotMatch(
    `${controls}\n${card}\n${summary}`,
    /<progress|aria-valuenow|percentage|\bscore\b|\bcompleted\b|\bachievement\b|\bdiscovered\b|CheckCircle|<Check\b/i,
  );
  for (const signedOutSurface of [controls, summary]) {
    assert.match(signedOutSurface, /subscribeToCosmographyLocation/);
    assert.match(signedOutSurface, /currentReturnTo/);
    assert.match(signedOutSurface, /tourResumeSignInHref\(returnTo\)/);
  }
  assert.doesNotMatch(
    `${controls}\n${summary}\n${clientContract}`,
    /localStorage|sessionStorage|indexedDB/i,
  );
});

test("conflicts and ambiguous mutations hide stale controls until an explicit reload", async () => {
  const controls = await readFile(
    new URL(
      "../app/components/tours/GuidedTourResumeControls.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    controls,
    /function requireReconciliation\(message: string\) \{\s*setConfirmClear\(false\);\s*setRecord\(null\);\s*setLoadState\("reconcile"\);\s*setAnnouncement\(message\);/s,
  );
  assert.equal((controls.match(/requireReconciliation\(/g) ?? []).length, 7);
  assert.match(
    controls,
    /if \(response\.status === 409\) \{\s*requireReconciliation\(/s,
  );
  assert.match(
    controls,
    /!\[200, 201\]\.includes\(response\.status\)[\s\S]*?requireReconciliation\(/,
  );
  assert.match(
    controls,
    /response\.status !== 200 \|\| !parsed\.valid \|\| parsed\.record !== null\)[\s\S]*?requireReconciliation\(/,
  );
  assert.match(controls, /loadState === "reconcile"/);
  assert.match(controls, /Reload private saved point/);
  assert.match(controls, /void loadResumePoint\(undefined, true\)/);
  assert.match(
    controls,
    /Your sign-in ended\. Sign in to verify your private saved point\./,
  );
  assert.doesNotMatch(controls, /saved resume point was not changed/i);
  assert.match(
    controls,
    /setConfirmClear\(false\);\s*setAnnouncement\(""\);\s*setRecord\(parsed\.record\);\s*setUnavailableAfterAction\(false\);\s*setLoadState\("ready"\);/s,
  );
});

test("tour navigation restores heading focus only after explicit controls", async () => {
  const [controls, experience, card, summary] = await Promise.all([
    readFile(
      new URL(
        "../app/components/tours/GuidedTourResumeControls.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/components/tours/GuidedTourExperience.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../app/components/tours/GuidedTourCard.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/components/account/TourResumeSummary.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(experience, /useState\(focusOnMount \? 1 : 0\)/);
  assert.match(
    experience,
    /function selectOrdinal[\s\S]*setFocusSequence\(\(current\) => current \+ 1\)/,
  );
  assert.match(experience, /onResume=\{selectOrdinal\}/);
  assert.match(card, /if \(focusSequence === 0\) return;/);
  assert.match(card, /headingRef\.current\?\.focus\(\)/);
  assert.match(card, /Final scale in this sequence/);
  assert.match(
    controls,
    /if \(userTriggered\) \{\s*window\.requestAnimationFrame/s,
  );
  assert.match(
    controls,
    /setLoadState\("ready"\);\s*if \(userTriggered\) \{\s*window\.requestAnimationFrame\(\(\) => headingRef\.current\?\.focus\(\)\);/s,
  );
  assert.match(
    controls,
    /transitionForStatus\(response\.status, userTriggered\)/,
  );
  assert.match(
    summary,
    /response\.status === 401[\s\S]*?if \(userTriggered\)[\s\S]*?signInRef\.current\?\.focus\(\)/,
  );
  assert.match(
    summary,
    /response\.status === 503[\s\S]*?if \(userTriggered\)[\s\S]*?unavailableRef\.current\?\.focus\(\)/,
  );
  assert.match(
    summary,
    /setLoadState\("ready"\);\s*if \(userTriggered\)[\s\S]*?headingRef\.current\?\.focus\(\)/,
  );
  assert.match(summary, /void loadResumePoint\(undefined, true\)/);
  assert.match(summary, /retryRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(
    controls.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[loadResumePoint\]\);/)?.[0] ?? "",
    /\.focus\(/,
  );
  assert.doesNotMatch(
    summary.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[loadResumePoint\]\);/)?.[0] ?? "",
    /\.focus\(/,
  );
});
