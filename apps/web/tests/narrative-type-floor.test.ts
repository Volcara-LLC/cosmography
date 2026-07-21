import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function css(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const earthCss = css("../app/components/earth/EarthNetwork.module.css");
const surfaceCss = css("../app/components/surface/SurfaceShell.module.css");
const voyagerCss = css("../app/components/missions/VoyagerTheme.module.css");
const globalsCss = css("../app/globals.css");

const narrativeFloor = String.raw`font-size:\s*max\(0\.875rem,\s*14px\);`;
const metadataFloor = String.raw`font-size:\s*max\(0\.75rem,\s*12px\);`;
const directoryNarrativeFloor = String.raw`font-size:\s*0\.875rem;`;

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requireFloor(
  source: string,
  selectors: readonly string[],
  floor: string,
) {
  for (const selector of selectors) {
    assert.match(
      source,
      new RegExp(`${escapePattern(selector)}[^{}]*\\{[^}]*${floor}`, "s"),
      `${selector} must retain its intended type floor`,
    );
  }
}

test("daylight directory explanations retain a fourteen-pixel floor", () => {
  requireFloor(
    globalsCss,
    [
      ".directory-section > p",
      ".directory-page .directory-notice",
      ".directory-page .directory-card p",
      ".directory-page .source-card p",
      ".directory-page .agency-card p",
    ],
    directoryNarrativeFloor,
  );
});

test("Earth explanations use a fourteen-pixel floor while compact records stay smaller", () => {
  requireFloor(
    earthCss,
    [
      ".heroNotice",
      ".sectionHeading > p",
      ".sourceIntro > p",
      ".mapDetail > p",
      ".emptyMap span",
      ".siteCard > p",
      ".cardDetails p",
      ".gapCard > p",
      ".gapCard dd",
      ".sourceRegister p",
    ],
    narrativeFloor,
  );
  requireFloor(
    earthCss,
    [
      ".coordinateReadout",
      ".cardDetails li",
      ".sourcePrinciples span",
    ],
    metadataFloor,
  );
});

test("planetary field-guide prose is larger than operational metadata", () => {
  requireFloor(
    surfaceCss,
    [
      ".shell :global(.surface-render-boundary)",
      ".shell :global(.surface-mode-bar__description)",
      ".shell :global(.surface-boundary-card > p:last-child)",
      ".shell :global(.surface-capture-detail__blockers ul)",
      ".shell :global(.surface-capture-detail dl > div:last-child dd)",
      ".shell :global(.surface-evidence-card dd)",
      ".shell :global(.surface-readiness__boundary span)",
      ".shell :global(.surface-readiness__requirements p)",
      ".shell :global(.surface-section-heading--wide > p)",
      ".shell :global(.surface-continuity-notice > p:last-child)",
      ".shell :global(.surface-next-world > div > p:not(.surface-control-label))",
      ".shell :global(.surface-capture-detail > div > p:last-child)",
      ".shell :global(.lunar-rule-copy)",
      ".shell :global(.source-card p)",
    ],
    narrativeFloor,
  );
  requireFloor(
    surfaceCss,
    [
      ".shell :global(.surface-back-link)",
      ".shell :global(.surface-stage-nav__button small)",
      ".shell :global(.surface-capture-card__content > span)",
      ".shell :global(.surface-capture-card__content small)",
      ".shell :global(.surface-capture-detail dd)",
    ],
    metadataFloor,
  );
});

test("Voyager narrative cards use fourteen pixels without enlarging vector metadata", () => {
  requireFloor(
    voyagerCss,
    [
      ".shell :global(.mission-vector-card > p)",
      ".shell :global(.mission-telemetry-distinction p)",
      ".shell :global(.mission-provenance-grid > article > p)",
      ".shell :global(.mission-instrument-card p)",
      ".shell :global(.mission-media-card p)",
      ".shell :global(.mission-role-grid p)",
      ".shell :global(.mission-source-list p)",
    ],
    narrativeFloor,
  );
  requireFloor(
    voyagerCss,
    [".shell :global(.mission-vector-distance span)"],
    metadataFloor,
  );
});
