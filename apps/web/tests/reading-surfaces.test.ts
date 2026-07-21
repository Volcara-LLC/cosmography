import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function channel(hex: string, offset: number) {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  return (
    0.2126 * channel(hex, 1) +
    0.7152 * channel(hex, 3) +
    0.0722 * channel(hex, 5)
  );
}

function contrast(left: string, right: string) {
  const lighter = Math.max(luminance(left), luminance(right));
  const darker = Math.min(luminance(left), luminance(right));
  return (lighter + 0.05) / (darker + 0.05);
}

function css(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function colorTokens(source: string, name: string) {
  return [
    ...source.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "gi")),
  ].map((match) => match[1]);
}

function requireAa(
  label: string,
  foregrounds: readonly string[],
  surfaces: readonly string[],
) {
  for (const foreground of foregrounds) {
    for (const surface of surfaces) {
      assert.ok(
        contrast(foreground, surface) >= 4.5,
        `${label}: ${foreground} must keep WCAG AA contrast against ${surface}`,
      );
    }
  }
}

function requireFocusContrast(
  label: string,
  indicator: string,
  surfaces: readonly string[],
) {
  for (const surface of surfaces) {
    assert.ok(
      contrast(indicator, surface) >= 3,
      `${label}: ${indicator} focus indicator must keep 3:1 contrast against ${surface}`,
    );
  }
}

const surfaceCss = css("../app/components/surface/SurfaceShell.module.css");
const earthCss = css("../app/components/earth/EarthNetwork.module.css");
const coverageCss = css("../app/components/evidence/EvidenceCoverageCard.module.css");
const voyagerCss = css("../app/components/missions/VoyagerTheme.module.css");
const relativityCss = css("../app/components/relativity/RelativityLab.module.css");
const guidedTourCss = css("../app/components/tours/GuidedTourCard.module.css");
const flightDeckCss = css("../app/components/atlas/FlightDeck.module.css");
const spacecraftHangarCss = css(
  "../app/components/account/SpacecraftHangar.module.css",
);
const recordedEncountersCss = css(
  "../app/components/account/RecordedEncountersHistory.module.css",
);
const recordEncounterActionCss = css(
  "../app/components/atlas/RecordedEncounterAction.module.css",
);
const guidedTourResumeCss = css(
  "../app/components/tours/GuidedTourResumeControls.module.css",
);
const tourResumeSummaryCss = css(
  "../app/components/account/TourResumeSummary.module.css",
);
const savedPlacesCss = css(
  "../app/components/account/SavedPlaces.module.css",
);
const globalCss = css("../app/globals.css");

test("light reading surfaces retain AA contrast for muted operational copy", () => {
  const surfaceInk = colorTokens(surfaceCss, "surface-ink");
  const surfaceMuted = colorTokens(surfaceCss, "surface-muted");
  const surfaceQuiet = colorTokens(surfaceCss, "surface-quiet");
  assert.equal(surfaceInk.length, 2);
  assert.equal(surfaceMuted.length, 2);
  assert.equal(surfaceQuiet.length, 2);

  requireAa(
    "Mars field guide",
    [surfaceInk[0], surfaceMuted[0], surfaceQuiet[0]],
    ["#f6f0e9", "#fffdf9", "#f2e5dc", "#fbf7f1"],
  );
  requireAa(
    "Moon field guide",
    [surfaceInk[1], surfaceMuted[1], surfaceQuiet[1]],
    ["#eef2f1", "#fbfcfb", "#e4ecec", "#f8faf9"],
  );
  requireAa(
    "Earth network",
    [colorTokens(earthCss, "earth-text")[0], colorTokens(earthCss, "earth-muted")[0]],
    ["#ffffff", "#f3f7f4", "#eaf2ef", "#f9fbf8"],
  );
  requireAa(
    "Coverage record",
    [
      colorTokens(coverageCss, "coverage-ink")[0],
      colorTokens(coverageCss, "coverage-muted")[0],
      colorTokens(coverageCss, "coverage-subtle")[0],
    ],
    ["#f5f8f6", "#ffffff", "#eaf2f0", "#fbfdfc"],
  );
  requireAa(
    "Voyager record",
    [colorTokens(voyagerCss, "text")[0], colorTokens(voyagerCss, "muted")[0]],
    ["#ffffff", "#eaf1ef", "#f8faf6", "#e9f0ed"],
  );
  requireAa(
    "Relativity instruments",
    [
      colorTokens(relativityCss, "relativity-ink")[0],
      colorTokens(relativityCss, "relativity-muted")[0],
      colorTokens(relativityCss, "relativity-ui-accent")[0],
    ],
    ["#faf9f5", "#ffffff", "#f7f0df"],
  );
  requireAa(
    "My Atlas spacecraft hangar",
    [
      colorTokens(spacecraftHangarCss, "hangar-ink")[0],
      colorTokens(spacecraftHangarCss, "hangar-muted")[0],
      colorTokens(spacecraftHangarCss, "hangar-quiet")[0],
    ],
    ["#ffffff", "#f7faf6", "#edf4f2", "#f8f7f1", "#edf2ef", "#fff0eb"],
  );
  requireAa(
    "My Atlas recorded encounters",
    [
      colorTokens(recordedEncountersCss, "encounter-ink")[0],
      colorTokens(recordedEncountersCss, "encounter-muted")[0],
      colorTokens(recordedEncountersCss, "encounter-quiet")[0],
    ],
    ["#ffffff", "#fbfcf8", "#edf6f5", "#e8f2f0", "#fff0eb"],
  );
  requireAa(
    "Seven Scales resume controls",
    [
      colorTokens(guidedTourResumeCss, "resume-ink")[0],
      colorTokens(guidedTourResumeCss, "resume-muted")[0],
      colorTokens(guidedTourResumeCss, "resume-accent")[0],
    ],
    ["#ffffff"],
  );
  requireAa(
    "My Atlas tour resume summary",
    [
      colorTokens(tourResumeSummaryCss, "tour-summary-ink")[0],
      colorTokens(tourResumeSummaryCss, "tour-summary-muted")[0],
      colorTokens(tourResumeSummaryCss, "tour-summary-quiet")[0],
      colorTokens(tourResumeSummaryCss, "tour-summary-accent")[0],
    ],
    ["#ffffff", "#fbfcf8", "#edf6f3"],
  );
  requireAa(
    "My Atlas saved places",
    [
      colorTokens(savedPlacesCss, "saved-place-ink")[0],
      colorTokens(savedPlacesCss, "saved-place-muted")[0],
      colorTokens(savedPlacesCss, "saved-place-quiet")[0],
    ],
    ["#ffffff", "#fbfcf8", "#edf6f5", "#e8f2f0", "#fff0eb"],
  );
});

test("operational labels on refreshed routes have a twelve-pixel floor", () => {
  const refreshedStyles = [
    surfaceCss,
    earthCss,
    coverageCss,
    voyagerCss,
    relativityCss,
    guidedTourCss,
    flightDeckCss,
    spacecraftHangarCss,
    recordedEncountersCss,
    recordEncounterActionCss,
    guidedTourResumeCss,
    tourResumeSummaryCss,
    savedPlacesCss,
  ];
  const undersizedPattern =
    /(?:font-size|font):\s*(?:max\()?0\.(?:5\d|6\d|7[0-4])rem|(?:font-size|font):\s*(?:max\()?1[01]px/gi;

  for (const source of refreshedStyles) {
    assert.doesNotMatch(source, undersizedPattern);
  }
});

test("My Atlas spacecraft controls stay readable and touch-safe", () => {
  assert.match(globalCss, /\.brand\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(globalCss, /\.brand small\s*\{[^}]*font-size:\s*0\.75rem;/s);
  assert.match(
    globalCss,
    /\.directory-page \.eyebrow\s*\{[^}]*font-size:\s*0\.75rem;/s,
  );
  assert.match(
    spacecraftHangarCss,
    /\.modelCard\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
  );
  assert.match(
    spacecraftHangarCss,
    /\.truthRow\s*\{[^}]*position:\s*relative;[^}]*margin-top:\s*auto;[^}]*padding-top:\s*1\.5rem;/s,
  );
  assert.doesNotMatch(
    spacecraftHangarCss,
    /\.truthRow\s*\{[^}]*position:\s*absolute;/s,
  );
  assert.match(
    spacecraftHangarCss,
    /\.primaryButton,\s*\n\.secondaryButton,\s*\n\.dangerButton\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.match(
    spacecraftHangarCss,
    /\.textButton\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.match(
    spacecraftHangarCss,
    /\.nameField input,\s*\n\.appearanceGrid select\s*\{[^}]*min-height:\s*46px;/s,
  );
  assert.match(
    spacecraftHangarCss,
    /@media \(max-width:\s*720px\)\s*\{[\s\S]*?\.modelGrid,\s*\n\s*\.appearanceGrid\s*\{[^}]*grid-template-columns:\s*1fr;/s,
  );
});

test("recorded encounter controls stay readable and touch-safe", () => {
  assert.match(
    recordedEncountersCss,
    /\.primaryButton,\s*\n\.secondaryButton,\s*\n\.textButton,\s*\n\.dangerButton,\s*\n\.cardActions a,\s*\n\.emptyState a\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.match(
    recordEncounterActionCss,
    /\.actionRow button,\s*\n\.inlineState button,\s*\n\.inlineState a\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.match(
    recordEncounterActionCss,
    /\.historyLink\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.match(recordedEncountersCss, /@media \(forced-colors: active\)/);
  assert.match(recordEncounterActionCss, /@media \(forced-colors: active\)/);
  assert.match(recordedEncountersCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(recordEncounterActionCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(
    `${recordedEncountersCss}\n${recordEncounterActionCss}`,
    /(?:font-size|font):\s*(?:max\()?0\.(?:5\d|6\d|7[0-4])rem|(?:font-size|font):\s*(?:max\()?1[01]px/gi,
  );
});

test("saved-place controls stay daylight-clear, touch-safe, and responsive", () => {
  assert.match(
    savedPlacesCss,
    /\.primaryButton,\s*\n\.secondaryButton,\s*\n\.textButton,\s*\n\.dangerButton,\s*\n\.cardActions a,\s*\n\.emptyState a,\s*\n\.reconcilePanel button\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.match(savedPlacesCss, /@media \(forced-colors: active\)/);
  assert.match(savedPlacesCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    savedPlacesCss,
    /@media \(max-width:\s*620px\)[\s\S]*?\.cardActions > a,[\s\S]*?\.confirmPanel > div:last-child > button\s*\{[^}]*width:\s*100%;/s,
  );
  assert.doesNotMatch(
    savedPlacesCss,
    /(?:font-size|font):\s*(?:max\()?0\.(?:5\d|6\d|7[0-4])rem|(?:font-size|font):\s*(?:max\()?1[01]px/gi,
  );
});

test("Flight Deck controls stay readable, touch-safe, and motion-free", () => {
  assert.match(
    flightDeckCss,
    /\.modeCard\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.match(
    flightDeckCss,
    /\.recenterButton,\s*\n\.saveButton\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.match(
    flightDeckCss,
    /\.details summary\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.doesNotMatch(
    flightDeckCss,
    /(?:^|[;{])\s*(?:animation|transition)(?:-[a-z-]+)?\s*:/im,
  );
});

test("guided-tour controls keep a touch-safe floor without timed motion", () => {
  assert.match(
    guidedTourCss,
    /\.actions (?:button|a),\s*\n\.actions (?:button|a)\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.doesNotMatch(
    `${guidedTourCss}\n${guidedTourResumeCss}`,
    /(?:^|[;{])\s*(?:animation|transition)(?:-[a-z-]+)?\s*:/im,
  );
  assert.match(
    guidedTourResumeCss,
    /\.panel button,\s*\n\.panel a\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.match(guidedTourResumeCss, /@media \(forced-colors: active\)/);
  assert.match(guidedTourResumeCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    guidedTourResumeCss,
    /@media \(max-width:\s*560px\)[\s\S]*?\.panel button,\s*\n\s*\.panel a\s*\{[^}]*width:\s*100%;/s,
  );
});

test("My Atlas tour resume summary stays daylight-clear and touch-safe", () => {
  assert.match(
    tourResumeSummaryCss,
    /\.section a,\s*\n\.section button\s*\{[^}]*min-height:\s*44px;/s,
  );
  assert.match(tourResumeSummaryCss, /@media \(forced-colors: active\)/);
  assert.match(tourResumeSummaryCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    tourResumeSummaryCss,
    /@media \(max-width:\s*640px\)[\s\S]*?\.section a,\s*\n\s*\.section button\s*\{[^}]*width:\s*100%;/s,
  );
});

test("recorded Mars view controls stay keyboard-visible and touch-safe", () => {
  assert.match(
    surfaceCss,
    /\.recordedPanoramaControls button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s,
  );
  assert.match(
    surfaceCss,
    /\.recordedPanoramaScene\s*\{[^}]*touch-action:\s*none;/s,
  );
  assert.match(
    surfaceCss,
    /\.recordedPanoramaScene:focus-visible\s*\{[^}]*outline:\s*3px solid #86ddff;/s,
  );
  assert.match(
    surfaceCss.match(/\.recordedPanorama\s*\{[^}]*\}/s)?.[0] ?? "",
    /transition:\s*none;/,
  );
});

test("route-scoped focus indicators contrast with light and dark interaction surfaces", () => {
  const surfaceAccents = colorTokens(surfaceCss, "surface-ui-accent");
  const missionAccents = colorTokens(voyagerCss, "mission-cyan");
  assert.equal(surfaceAccents.length, 2);
  assert.equal(missionAccents.length, 2);

  requireFocusContrast("Mars field guide", surfaceAccents[0], ["#f6f0e9", "#fffdf9"]);
  requireFocusContrast("Moon field guide", surfaceAccents[1], ["#eef2f1", "#fbfcfb"]);
  requireFocusContrast("Earth network", colorTokens(earthCss, "earth-cyan")[0], [
    "#ffffff",
    "#f3f7f4",
  ]);
  requireFocusContrast("Voyager record", missionAccents[0], ["#ffffff", "#eaf1ef"]);
  requireFocusContrast("Voyager space stage", missionAccents[1], ["#020507"]);
  requireFocusContrast(
    "Relativity instruments",
    colorTokens(relativityCss, "relativity-ui-accent")[0],
    ["#faf9f5", "#ffffff"],
  );
  requireFocusContrast("Dark renderer", "#86ddff", ["#02050b", "#080606"]);
});
