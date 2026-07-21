import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../", import.meta.url);
const foundationReleaseId = "rel_landing_atlas_v0_1_0";
const coverageDimensionIds = [
  "geometry",
  "terrain",
  "observations",
  "media",
  "timeline-completeness",
  "update-cadence",
  "rights",
  "validation-tier",
];
const coverageAuthorityAttributes = [
  "source-authenticity-established",
  "scientific-validation-established",
  "independent-validation-established",
  "completeness-established",
  "rights-clearance-established",
  "runtime-use-allowed",
  "render-allowed",
  "publication-allowed",
  "release-eligible",
  "activation-allowed",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertCoverageCount(html, label, value, unit, total) {
  const displayedValue = total === undefined ? `${value}` : `${value} / ${total}`;
  assert.match(
    html,
    new RegExp(
      `<dt>${escapeRegExp(label)}</dt>\\s*<dd>\\s*<strong>${escapeRegExp(displayedValue)}</strong>\\s*<span>${escapeRegExp(unit)}</span>`,
    ),
    `missing canonical ${label} count`,
  );
}

function assertEvidenceCoverageCard(html, coverageKey) {
  const cardIdentity = html.match(
    new RegExp(
      `data-coverage-pack="(covp_[a-z0-9_-]+)"[^>]*data-coverage-key="${escapeRegExp(coverageKey)}"[^>]*data-coverage-release-id="${foundationReleaseId}"`,
    ),
  );
  assert.ok(cardIdentity, `missing exact-release ${coverageKey} coverage card`);
  const packId = cardIdentity[1];

  assert.match(
    html,
    /data-coverage-state="release-scoped-coverage-summary-non-authoritative"/,
  );
  for (const authorityAttribute of coverageAuthorityAttributes) {
    assert.match(
      html,
      new RegExp(`data-${authorityAttribute}="false"`),
      `${coverageKey} must not upgrade ${authorityAttribute}`,
    );
  }
  assert.match(html, /Non-authoritative · release ineligible/);
  assert.match(html, /Coverage boundary/);
  assert.match(html, /does not establish completeness/);
  let previousDimensionIndex = -1;
  for (const dimensionId of coverageDimensionIds) {
    const dimensionIndex = html.indexOf(
      `data-coverage-dimension="${dimensionId}"`,
    );
    assert.ok(
      dimensionIndex > previousDimensionIndex,
      `${coverageKey} must render ${dimensionId} in canonical dimension order`,
    );
    previousDimensionIndex = dimensionIndex;
  }
  assert.match(
    html,
    /<details[^>]*>\s*<summary>Inspect bindings, gaps, next evidence, and correction lineage<\/summary>/,
  );
  assert.match(html, /Repository location/);
  assert.match(html, /Immutable version/);
  assert.match(html, /Canonicalization/);
  assert.match(html, /Bound references/);
  assert.match(html, /Canonical digest/);
  assert.match(html, />ETag</);
  assert.match(
    html,
    new RegExp(
      `href="/api/v1/releases/${foundationReleaseId}/coverage/${escapeRegExp(packId)}"`,
    ),
  );
  assert.doesNotMatch(
    html,
    /\/api\/v1\/releases\/(?:latest|current)\/coverage|\/coverage\/(?:latest|current)(?:["/?])/i,
  );
  assert.doesNotMatch(html, /role="progressbar"|percent complete|% complete/i);
  assert.doesNotMatch(
    html,
    /data-coverage-status="validated-artifact-evidence"/,
    `${coverageKey} initial pack must not claim validated artifact evidence`,
  );
}

async function request(pathname = "/", accept = "text/html") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept } }),
    {
      JUDGE_ACCESS_MODE: "disabled",
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the interactive observable-universe atlas", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Explore the Observable Universe · Cosmography<\/title>/i);
  assert.match(html, />COSMOGRAPHY</);
  assert.match(
    html,
    /class="destination-kicker"><span>Cosmology<\/span><span>•<\/span><span>Observer-centered observable region<\/span><\/div><h1 id="destination-name">Observable Universe<\/h1>/,
  );
  assert.match(html, /Constructed scientific view/);
  assert.match(html, /data-domain="lightcone"/);
  assert.match(html, /<canvas\b[^>]*\baria-hidden="true"/);
  assert.match(html, /Skip the 3D visualization/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-controls="atlas-search-results"/);
  assert.match(html, /data-atlas-theme="cosmos"/);
  assert.match(html, /aria-label="Enter full cosmos view"/);
  assert.match(html, /aria-label="Exit full cosmos view"/);
  assert.match(html, /aria-keyshortcuts="Escape"/);
  assert.doesNotMatch(html, /aria-keyshortcuts="[^"]*\bF\b[^"]*"/);
  assert.match(html, /Scientifically reviewed names and designations/);
  assert.match(html, /15 exact-release identities at semantic display anchors/i);
  assert.match(html, /not astrometry, a physical pose, catalog streaming, or complete coverage/i);
  assert.doesNotMatch(html, /Future catalog tiles will stream by\s+scale/i);
  assert.match(html, /id="structured-atlas"[^>]*tabindex="-1"/i);
  assert.match(html, /scientific reconstruction/i);
  assert.match(html, /<button[^>]*id="start-seven-scales-tour"/i);
  assert.match(html, />Seven Scales tour</i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps full cosmos view viewport-locked, focus-safe, and object-selectable", async () => {
  const [component, styles, labelLayer, labelStyles] = await Promise.all([
    readFile(new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/universe/ProjectedLabelLayer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/universe/ProjectedLabelLayer.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /requestedTarget\?\.isConnected/);
  assert.match(component, /inert=\{fullView\}/);
  assert.match(component, /if \(!fullView\) return;/);
  assert.doesNotMatch(component, /toLocaleLowerCase\(\) === ["']f["']/);
  assert.match(styles, /\.cosmography-shell\.is-full-view\s*\{[^}]*position:\s*fixed;[^}]*height:\s*100svh;[^}]*overflow:\s*hidden;/s);
  assert.match(component, /labelCandidates=\{projectedLabelCandidates\}/);
  assert.match(component, /fullView=\{fullView\}/);
  assert.match(component, /params\.set\("release", atlasRelease\.id\)/);
  assert.match(component, /layers\.catalogs[\s\S]*Names and designations are off/);
  assert.match(labelLayer, /fullView \? styles\.fullView/);
  assert.match(labelLayer, /data-projected-label-id=/);
  assert.match(labelStyles, /\.layer\s*\{[^}]*pointer-events:\s*none;/s);
  assert.match(labelStyles, /\.label\s*\{[^}]*min-height:\s*44px;[^}]*pointer-events:\s*auto;/s);
  assert.doesNotMatch(styles, /\.is-full-view \.object-markers/);
});

test("keeps the shared coverage card static and server-fed", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../app/components/evidence/EvidenceCoverageCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/evidence/EvidenceCoverageCard.module.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(component, /["']use client["']|\bfetch\s*\(|\buseEffect\b|\buseState\b/);
  assert.doesNotMatch(component, /role=["']progressbar["']|%\s*complete|percent\s+complete/i);
  assert.match(component, /declares it supersedes/);
  assert.match(component, /does not itself verify the predecessor pair/);
  assert.doesNotMatch(styles, /(?:^|[;{])\s*(?:animation|transition)(?:-[a-z-]+)?\s*:/im);
});

test("honors a release-shareable destination deep link", async () => {
  const response = await request(
    "/?focus=mars&appearance=immersive&release=rel_landing_atlas_v0_1_0",
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /data-domain="globe"/);
  assert.match(html, /data-appearance="immersive"/);
  assert.match(html, /data-atlas-theme="mars"/);
  assert.match(html, /<h1 id="destination-name">Mars<\/h1>/);
  assert.match(html, /Explore Mars/);
});

test("server-renders exact-release manual Seven Scales tour deep links", async () => {
  const stepFour = await request(
    "/?tour=seven-scales-to-jezero&step=4&focus=milky-way&appearance=scientific&release=rel_landing_atlas_v0_1_0",
  );
  const stepFourHtml = await stepFour.text();
  const stepFourVisibleHtml = stepFourHtml.replaceAll("<!-- -->", "");
  assert.equal(stepFour.status, 200);
  assert.match(stepFourHtml, /data-domain="galactic"/);
  assert.match(stepFourHtml, /data-atlas-theme="galaxies"/);
  assert.match(stepFourHtml, /data-tour-id="tour_seven_scales_to_jezero_v1"/);
  assert.match(stepFourHtml, /data-tour-stop="4"/);
  assert.match(stepFourHtml, /data-navigation-mode="semantic-navigation"/);
  assert.match(stepFourHtml, /data-advance-mode="manual"/);
  assert.match(stepFourHtml, /data-physical-journey-claim="false"/);
  assert.match(stepFourHtml, /data-auto-advance="false"/);
  assert.match(stepFourVisibleHtml, /Scale 4 of 7/);
  assert.match(stepFourHtml, /<h1 id="guided-tour-heading"[^>]*>Milky Way Galaxy<\/h1>/);
  assert.match(stepFourHtml, new RegExp(foundationReleaseId));

  const finalStep = await request(
    "/?tour=seven-scales-to-jezero&step=7&focus=jezero&release=rel_landing_atlas_v0_1_0",
  );
  const finalStepHtml = await finalStep.text();
  const finalStepVisibleHtml = finalStepHtml.replaceAll("<!-- -->", "");
  assert.equal(finalStep.status, 200);
  assert.match(finalStepHtml, /data-domain="globe"/);
  assert.match(finalStepHtml, /data-atlas-theme="jezero"/);
  assert.match(finalStepHtml, /data-tour-stop="7"/);
  assert.match(finalStepVisibleHtml, /Scale 7 of 7/);
  assert.match(finalStepHtml, /<h1 id="guided-tour-heading"[^>]*>Jezero Crater<\/h1>/);
  assert.match(
    finalStepHtml,
    /href="\/worlds\/mars\?view=recorded&amp;node=perseverance-landing-sol-4&amp;release=rel_landing_atlas_v0_1_0"/,
  );
  assert.match(finalStepHtml, /Enter the recorded Jezero view/);
  assert.match(finalStepHtml, new RegExp(foundationReleaseId));
});

test("guided-tour deep links fail closed on noncanonical or mismatched state", async () => {
  const validFields =
    "tour=seven-scales-to-jezero&step=1&focus=observable-universe&release=rel_landing_atlas_v0_1_0";
  const rejectedPaths = [
    "/?step=1",
    "/?tour=unknown-tour&step=1&focus=observable-universe&release=rel_landing_atlas_v0_1_0",
    "/?tour=seven-scales-to-jezero&focus=observable-universe&release=rel_landing_atlas_v0_1_0",
    "/?tour=seven-scales-to-jezero&step=1&focus=observable-universe",
    "/?tour=seven-scales-to-jezero&step=1&release=rel_landing_atlas_v0_1_0",
    "/?tour=seven-scales-to-jezero&step=1&focus=observable-universe&release=rel_wrong_release",
    "/?tour=seven-scales-to-jezero&step=1&focus=observable-universe&appearance=unknown&release=rel_landing_atlas_v0_1_0",
    "/?tour=seven-scales-to-jezero&step=1&focus=laniakea&release=rel_landing_atlas_v0_1_0",
    "/?tour=seven-scales-to-jezero&step=2&focus=laniakea-supercluster&release=rel_landing_atlas_v0_1_0",
    "/?tour=seven-scales-to-jezero&step=0&focus=observable-universe&release=rel_landing_atlas_v0_1_0",
    "/?tour=seven-scales-to-jezero&step=01&focus=observable-universe&release=rel_landing_atlas_v0_1_0",
    "/?tour=seven-scales-to-jezero&step=8&focus=jezero&release=rel_landing_atlas_v0_1_0",
    `/?${validFields}&extra=1`,
    `/?${validFields}&tour=seven-scales-to-jezero`,
    `/?${validFields}&step=1`,
    `/?${validFields}&focus=observable-universe`,
    `/?${validFields}&release=rel_landing_atlas_v0_1_0`,
    "/?focus=mars&focus=jezero",
  ];

  for (const pathname of rejectedPaths) {
    const response = await request(pathname);
    assert.equal(response.status, 404, pathname);
  }
});

test("server-renders exact-release Flight Deck deep links", async () => {
  const response = await request(
    "/?appearance=scientific&focus=proxima-centauri&travel=voyager&release=rel_landing_atlas_v0_1_0",
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /data-domain="galactic"/);
  assert.match(html, /data-atlas-theme="stars"/);
  assert.match(html, /Flight Deck/);
  assert.match(html, /Voyager 1 · historical speed/);
  assert.match(html, /data-truth-class="historical-comparison"/);
  assert.match(html, /data-result-kind="constant-speed-counterfactual"/);
  assert.match(html, /data-actual-journey-claim="false"/);
  assert.match(html, /data-trajectory-claim="false"/);
  assert.match(html, /data-telemetry-claim="false"/);
  assert.match(html, /not an available transport/i);
  assert.doesNotMatch(html, /Estimated journey|Preview journey|Voyager-class cruise/i);
});

test("Flight Deck canonicalizes known IDs and fails closed on ambiguous state", async () => {
  const redirectResponse = await request(
    "/?appearance=immersive&focus=andromeda&travel=light&release=rel_landing_atlas_v0_1_0",
  );
  assert.equal(redirectResponse.status, 307);
  assert.equal(
    redirectResponse.headers.get("location"),
    "http://localhost/?appearance=immersive&focus=andromeda-galaxy&travel=light&release=rel_landing_atlas_v0_1_0",
  );

  const base =
    "appearance=scientific&focus=proxima-centauri&travel=voyager&release=rel_landing_atlas_v0_1_0";
  const rejectedPaths = [
    "/?focus=proxima-centauri&travel=voyager&release=rel_landing_atlas_v0_1_0",
    "/?appearance=scientific&travel=voyager&release=rel_landing_atlas_v0_1_0",
    "/?appearance=scientific&focus=proxima-centauri&travel=voyager",
    "/?appearance=unknown&focus=proxima-centauri&travel=voyager&release=rel_landing_atlas_v0_1_0",
    "/?appearance=scientific&focus=unknown-object&travel=voyager&release=rel_landing_atlas_v0_1_0",
    "/?appearance=scientific&focus=proxima-centauri&travel=unknown&release=rel_landing_atlas_v0_1_0",
    "/?appearance=scientific&focus=proxima-centauri&travel=voyager&release=rel_stale_release",
    `/?${base}&extra=1`,
    `/?${base}&travel=voyager`,
    `/?${base}&focus=proxima-centauri`,
    `/?${base}&tour=seven-scales-to-jezero&step=1`,
  ];

  for (const pathname of rejectedPaths) {
    const response = await request(pathname);
    assert.equal(response.status, 404, pathname);
  }
});

test("release-shareable links never fall forward to unavailable content", async () => {
  const response = await request(
    "/?focus=mars&release=rel_unavailable-release",
  );
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.doesNotMatch(html, /<h1 id="destination-name">Mars<\/h1>/);
});

test("renders the evidence-bounded Mars surface explorer", async () => {
  const response = await request("/worlds/mars");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Mars — Jezero Crater/);
  assert.match(html, /Interactive imagery-backed globe of Mars/);
  assert.match(html, /Viking MDIM 2.1 global mosaic/);
  assert.match(html, /Enter recorded surface view/);
  assert.match(html, />Observed<\/button>/);
  assert.match(html, />Reconstruction<\/button>/);
  assert.match(html, />Immersive<\/button>/);
  assert.match(html, /Scientific reconstruction/);
  assert.match(html, /Discrete evidence—not continuous footage/);
  assert.match(html, /contains no admitted source-product bytes/i);
  assert.match(html, /capture contexts remain withheld without renderable poses/i);
  assert.match(html, /Placement remains withheld/);
  assert.match(html, /Inspect capture contract/);
  assert.match(html, /aria-controls="mars-capture-contract-detail"/);
  assert.match(html, /id="mars-capture-contract-detail"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(html, /NASA Mars Trek/i);
  assert.doesNotMatch(html, /Enter recorded view/);
  assert.doesNotMatch(html, /surface-viewport__capture-frustum/);
  assertEvidenceCoverageCard(html, "mars-jezero");
  assertCoverageCount(html, "Admitted artifacts", 0, "artifacts", 12);
  assertCoverageCount(html, "Renderable poses", 0, "poses", 3);
});

test("opens the exact recorded node into the bounded rover-view presentation", async () => {
  const response = await request(
    "/worlds/mars?view=recorded&node=perseverance-landing-sol-4&release=rel_landing_atlas_v0_1_0",
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Look around the recorded Perseverance Sol 3 horizontal panorama/);
  assert.match(html, /Three recorded 360° horizontal mosaics and one landing-site detail derivative/i);
  assert.match(html, /Drag in any direction across this recorded rover panorama/);
  assert.match(html, /3 separate viewpoints · not a continuous drive/);
  assert.match(html, /aria-label="Look left"/);
  assert.match(html, /aria-label="Look right"/);
  assert.match(html, /aria-label="Look up"/);
  assert.match(html, /aria-label="Look down"/);
  assert.match(html, />Reset</);
  assert.match(html, /Look around · 360°/);
  assert.match(html, /High-resolution detail/);
  assert.doesNotMatch(html, /_vinext\/image\?url=%2Fassets%2Fmars%2Fpia24/i);
  assert.match(html, /Reference station · pose withheld/);
  assert.match(html, /Pixels admitted · placement remains withheld/);
  assert.match(html, /Discrete evidence—not continuous footage/);
});

test("fails closed to the ordinary Mars entry for a noncanonical recorded node", async () => {
  const rejectedPaths = [
    "/worlds/mars?view=recorded&node=unknown&release=rel_landing_atlas_v0_1_0",
    "/worlds/mars?view=recorded&node=perseverance-landing-sol-4",
    "/worlds/mars?view=recorded&node=perseverance-landing-sol-4&release=rel_wrong_release",
    "/worlds/mars?view=recorded&node=perseverance-landing-sol-4&release=rel_landing_atlas_v0_1_0&extra=1",
  ];

  for (const pathname of rejectedPaths) {
    const response = await request(pathname);
    const html = await response.text();
    assert.equal(response.status, 200, pathname);
    assert.match(html, /Scientific reconstruction contract/, pathname);
    assert.doesNotMatch(html, /Recorded Mars panorama presentation view/, pathname);
    assert.doesNotMatch(html, /one exact JPL presentation derivative loaded/i, pathname);
  }
});

test("renders the controlled Apollo 17 lunar surface explorer", async () => {
  const response = await request("/worlds/moon");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Moon — Taurus–Littrow/);
  assert.match(html, /Apollo 17/);
  assert.match(html, /20\.16°N/);
  assert.match(html, /none loaded/i);
  assert.match(html, /Photography stations—not a seamless video walk/);
  assert.match(html, /Vacuum remains vacuum/);
  assert.match(html, /contains no admitted source-product bytes/i);
  assert.match(html, /capture contexts remain withheld without renderable poses/i);
  assert.match(html, /Placement remains withheld/);
  assert.match(html, /Inspect station record/);
  assert.match(html, /aria-controls="moon-capture-contract-detail"/);
  assert.match(html, /id="moon-capture-contract-detail"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.doesNotMatch(html, /Enter recorded view/);
  assert.doesNotMatch(html, /surface-viewport__capture-frustum/);
  assertEvidenceCoverageCard(html, "apollo-17");
  assertCoverageCount(html, "Admitted artifacts", 0, "artifacts", 9);
  assertCoverageCount(html, "Renderable poses", 0, "poses", 3);
});

test("routes the Apollo 17 atlas record into the lunar surface experience", async () => {
  const response = await request("/?focus=apollo-17-taurus-littrow");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<h1 id="destination-name">Apollo 17 · Taurus–Littrow<\/h1>/);
  assert.match(html, /href="\/worlds\/moon"/);
  assert.match(html, /Enter Apollo 17 surface/);
});

test("renders the official-source Voyager 1 journey", async () => {
  const response = await request("/missions/voyager-1");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Voyager/);
  assert.match(html, /No invented live feed/);
  assert.match(html, /Ephemeris/);
  assert.match(html, /Not spacecraft telemetry/);
  assert.match(html, /Pale Blue Dot/);
  assert.match(html, /Exact file selection, unverified bytes/);
  assert.match(html, /7 Horizons golden epochs/);
  assert.match(html, /Frustum withheld/);
  assert.match(html, /Reference only · media bytes not admitted/);
  assertEvidenceCoverageCard(html, "voyager-1");
  assertCoverageCount(html, "Reference-only media", 5, "records");
  assertCoverageCount(html, "Frozen trajectory epochs", 7, "epochs");
});

test("renders the fail-closed black-hole relativity benchmark", async () => {
  const response = await request("/lab/black-holes");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Build the lensing first/);
  assert.match(html, /not a validated ray trace/i);
  assert.match(html, /Kerr reference geometry/);
  assert.match(html, /critical-curve diameter, not an image measurement/i);
  assert.match(html, /DNGR \/ Interstellar method paper/);
});

test("renders the international Earth exploration network", async () => {
  const response = await request("/earth");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /The universe begins with a network on Earth/);
  assert.match(html, /35<\/strong><span>representative sites/);
  assert.match(html, /What the map does not know yet/);
  assert.match(html, /Official facts are not a blanket media licence/);
  assert.match(html, /28\.57° N · 80\.65° W · WGS84/);
  assertEvidenceCoverageCard(html, "earth-network");
  assertCoverageCount(html, "Indexed sites", 35, "sites");
  assertCoverageCount(html, "Known coverage gaps", 8, "gaps");
});

test("renders the welcoming truth-labeled My Atlas workspace", async () => {
  const [response, hangarClient, encounterHistoryClient, savedPlacesClient] = await Promise.all([
    request("/me"),
    readFile(
      new URL("../app/components/account/SpacecraftHangar.tsx", import.meta.url),
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
      new URL("../app/components/account/SavedPlaces.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<title>My Atlas · Private Exploration · Cosmography<\/title>/i);
  assert.match(html, /Imagine boldly\. Label honestly\./);
  assert.match(html, /Save exact-release atlas places you want to reopen/i);
  assert.match(html, /User-confirmed navigation, history, and return point/);
  assert.match(html, /Saved places/);
  assert.match(html, /Private navigation/);
  assert.match(html, /Navigation aids only/);
  assert.match(html, /not a camera pose/);
  assert.match(html, /Opening your private saved places/);
  assert.match(html, /never infers what you learned/);
  assert.match(html, /Hypothetical fusion study/);
  assert.match(html, /Fictional warp story craft/);
  assert.match(html, /Personal concept · not a mission record/);
  assert.match(html, /Recorded encounters/);
  assert.match(html, /User-confirmed records only/);
  assert.match(html, /Saved tour resume point/);
  assert.match(html, /Seven Scales · private navigation aid/);
  assert.match(html, /one literal place to reopen/);
  assert.match(
    html,
    /<a class="skip-link" href="#main-content">\s*Skip to My Atlas workspace\s*<\/a>/,
  );
  assert.match(html, /No available vehicle/);
  assert.match(html, /href="\/missions\/voyager-1"/);
  assert.match(html, /href="\/me">My Atlas<\/a>/);
  assert.doesNotMatch(html, /available personal transport|validated spacecraft|mission-ready/i);
  assert.doesNotMatch(hangarClient, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(
    encounterHistoryClient,
    /localStorage|sessionStorage|indexedDB/i,
  );
  assert.doesNotMatch(
    savedPlacesClient,
    /localStorage|sessionStorage|indexedDB/i,
  );
  assert.match(hangarClient, /<SavedPlaces \/>/);
  assert.match(hangarClient, /Nothing was saved on this device/);
  assert.match(
    hangarClient,
    /if \(action === "write"\) \{\s*window\.requestAnimationFrame\(\(\) => signInRef\.current\?\.focus\(\)\);\s*\}/s,
  );
  assert.match(hangarClient, /expectedUpdatedAtMs/);
});

test("returns release context from public APIs", async () => {
  const response = await request("/api/health", "application/json");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("etag") ?? "", /rel_landing_atlas_v0_1_0/);
  const payload = await response.json();
  assert.equal(payload.status, "ok");
  assert.equal(payload.releaseId, "rel_landing_atlas_v0_1_0");
  assert.equal(payload.schemaVersion, "0.1.0");
});

test("personal exploration APIs fail closed without identity", async () => {
  for (const pathname of [
    "/api/v1/me/bookmarks",
    "/api/v1/me/routes",
    "/api/v1/me/spacecraft",
  ]) {
    const response = await request(pathname, "application/json");
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.error, "sign_in_required");
    assert.match(payload.signInPath, /^\/signin-with-chatgpt/);
    assert.match(response.headers.get("cache-control") ?? "", /private/);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
});

test("starter preview is fully removed", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /AtlasShell/);
  assert.match(layout, /Cosmography/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview|Your site is taking shape/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  for (const asset of ["favicon.svg", "file.svg", "globe.svg", "window.svg"]) {
    await assert.rejects(access(new URL(`../public/${asset}`, import.meta.url)));
  }

  await access(new URL("../app/components/universe/UniverseViewport.tsx", import.meta.url));
  await access(new URL("../app/data/surface/surface-fixtures.ts", import.meta.url));
  await access(appRoot);
});
