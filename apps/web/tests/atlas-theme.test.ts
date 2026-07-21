import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { atlasEntities } from "../app/data/atlas";
import {
  atlasVisualThemeFor,
  atlasVisualThemeIds,
} from "../app/components/atlas/theme";

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

const globalsCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function cssColorToken(name: string) {
  const match = globalsCss.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"));
  assert.ok(match, `Expected --${name} in globals.css`);
  return match[1];
}

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = globalsCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"));
  assert.ok(match, `Expected ${selector} in globals.css`);
  return match[1];
}

test("every seed destination resolves to a stable welcoming atlas theme", () => {
  assert.ok(atlasVisualThemeIds.length >= 7);
  for (const entity of atlasEntities) {
    const first = atlasVisualThemeFor(entity);
    const second = atlasVisualThemeFor(entity);
    assert.equal(first, second);
    assert.equal(Object.isFrozen(first), true);
    assert.match(first.accent, /^#[0-9a-f]{6}$/i);
    assert.match(first.accentStrong, /^#[0-9a-f]{6}$/i);
    assert.match(first.accentSoft, /^#[0-9a-f]{6}$/i);
    assert.ok(
      contrast(first.accentStrong, "#ffffff") >= 4.5,
      `${entity.id} action accent must retain WCAG AA contrast against white`,
    );
    assert.ok(
      contrast("#17313b", first.accentSoft) >= 7,
      `${entity.id} soft surface must remain comfortable for dark reading text`,
    );
  }
});

test("world and mission themes carry their own recognizable palettes", () => {
  const byId = new Map(atlasEntities.map((entity) => [entity.id, entity]));
  const mars = byId.get("mars");
  const moon = byId.get("apollo-17");
  const voyager = byId.get("voyager-1");
  const earth = byId.get("earth-exploration-network");
  assert.ok(mars && moon && voyager && earth);

  assert.equal(atlasVisualThemeFor(mars).id, "mars");
  assert.equal(atlasVisualThemeFor(moon).id, "moon");
  assert.equal(atlasVisualThemeFor(voyager).id, "voyager");
  assert.equal(atlasVisualThemeFor(earth).id, "earth");
  assert.equal(
    new Set([mars, moon, voyager, earth].map(atlasVisualThemeFor)).size,
    4,
  );
});

test("welcoming shell muted copy keeps AA contrast on every reading surface", () => {
  const surfaceGroups = [
    {
      foregrounds: [cssColorToken("ui-muted"), cssColorToken("ui-quiet")],
      surfaces: ["#f8fbf9", "#edf3f1", "#ffffff"],
    },
    {
      foregrounds: [
        cssColorToken("directory-muted"),
        cssColorToken("directory-quiet"),
      ],
      surfaces: ["#f5f8f5", "#eaf1ef", "#f7f8f3", "#ffffff"],
    },
  ];

  for (const group of surfaceGroups) {
    for (const foreground of group.foregrounds) {
      for (const surface of group.surfaces) {
        assert.ok(
          contrast(foreground, surface) >= 4.5,
          `${foreground} must keep WCAG AA contrast against ${surface}`,
        );
      }
    }
  }
});

test("directory focus indicator remains distinct on every daylight surface", () => {
  const focus = cssColorToken("directory-focus");
  for (const surface of ["#f5f8f5", "#eaf1ef", "#f7f8f3", "#ffffff"]) {
    assert.ok(
      contrast(focus, surface) >= 3,
      `${focus} focus indicator must keep 3:1 contrast against ${surface}`,
    );
  }
});

test("daylight panel controls keep a visible non-text boundary", () => {
  const controlLine = cssColorToken("ui-control-line");
  for (const surface of ["#f8fbf9", "#edf3f1", "#ffffff"]) {
    assert.ok(
      contrast(controlLine, surface) >= 3,
      `${controlLine} control boundary must keep 3:1 contrast against ${surface}`,
    );
  }
});

test("atlas instrument islands expose the sky without sacrificing readable targets", () => {
  assert.doesNotMatch(
    globalsCss,
    /\.cosmography-shell::(?:before|after)/,
    "atlas must not restore broad light edge washes",
  );

  const header = cssRule(".cosmography-shell .atlas-header");
  assert.match(header, /background:\s*transparent;/);
  assert.match(header, /pointer-events:\s*none;/);
  assert.match(
    cssRule(".cosmography-shell .atlas-header > *"),
    /pointer-events:\s*auto;/,
  );

  for (const selector of [
    ".cosmography-shell .scale-rail",
    ".cosmography-shell .scene-tools",
  ]) {
    const wrapper = cssRule(selector);
    assert.match(wrapper, /background:\s*transparent;/);
    assert.match(wrapper, /box-shadow:\s*none;/);
    assert.match(wrapper, /backdrop-filter:\s*none;/);
  }

  for (const selector of [
    ".cosmography-shell .scale-rail-title",
    ".cosmography-shell .scale-rail button",
    ".cosmography-shell .scene-tools button",
  ]) {
    const plate = cssRule(selector);
    assert.match(plate, /min-height:\s*(?:44|5[0-9])px;/);
    assert.match(plate, /background:\s*var\(--ui-surface-strong\);/);
  }
});

test("destination copy and scene time stay on compact opaque plates", () => {
  const destination = cssRule(".cosmography-shell .destination-card");
  assert.match(
    destination,
    /background:\s*linear-gradient\([^;]*#[0-9a-f]{6}[^;]*#[0-9a-f]{6}\);/i,
  );
  assert.doesNotMatch(destination, /background:[^;]*rgba\(/);
  assert.match(destination, /backdrop-filter:\s*none;/);

  const timeline = cssRule(".timeline-dock");
  assert.match(timeline, /left:\s*auto;/);
  assert.match(timeline, /width:\s*auto;/);
  assert.match(timeline, /max-width:\s*min\(380px,\s*calc\(100vw - 2rem\)\);/);
  assert.match(globalsCss, /\.timeline-dock\[open\]\s*\{[^}]*width:\s*min\(380px,/);
  assert.match(globalsCss, /\.timeline-dock summary\s*\{[^}]*min-height:\s*42px;/);
  assert.match(
    globalsCss,
    /@media \(max-width:\s*760px\)[\s\S]*?\.cosmography-shell \.timeline-dock\s*\{[^}]*left:\s*auto;[^}]*width:\s*min\(21rem,\s*calc\(100vw - 1\.5rem\)\);/,
  );
  assert.match(
    globalsCss,
    /@media \(max-width:\s*760px\)[\s\S]*?\.cosmography-shell \.header-actions a,[\s\S]*?\.cosmography-shell \.header-actions button\s*\{[^}]*width:\s*44px;[^}]*min-width:\s*44px;[^}]*font-size:\s*0;/,
  );
  assert.match(
    globalsCss,
    /@media \(max-width:\s*760px\)[\s\S]*?\.cosmography-shell \.destination-card\s*\{[^}]*max-height:\s*calc\(100% - var\(--header-height\) - 10\.75rem - 6\.85rem\);[^}]*overflow-y:\s*auto;/,
  );
});

test("the standard destination card collapses safely without changing tour geometry", () => {
  const collapsed = cssRule(
    '.cosmography-shell .destination-card--standard[data-collapsed="true"]',
  );
  assert.match(collapsed, /top:\s*auto;/);
  assert.match(collapsed, /max-height:\s*none;/);
  assert.match(collapsed, /overflow:\s*visible;/);

  const toggle = cssRule(".destination-card__toggle");
  assert.match(toggle, /min-width:\s*44px;/);
  assert.match(toggle, /min-height:\s*44px;/);
  assert.match(
    globalsCss,
    /\.cosmography-shell \.destination-card__toggle:hover,[\s\S]*?\.cosmography-shell \.destination-card__toggle:focus-visible\s*\{[^}]*border-color:\s*var\(--focus-accent\);[^}]*background:\s*var\(--focus-accent-soft\);[^}]*color:\s*var\(--focus-accent-strong\);/,
  );

  const highDesktop = globalsCss.match(
    /@media \(min-width:\s*1025px\) and \(min-height:\s*820px\)\s*\{([\s\S]*?)\n\}/,
  );
  assert.ok(highDesktop, "Expected a high-desktop standard-card layout");
  assert.match(
    highDesktop[1],
    /\.cosmography-shell \.destination-card--standard\[data-collapsed="false"\]\s*\{[^}]*top:\s*calc\(var\(--header-height\) \+ 30rem\);[^}]*bottom:\s*7\.4rem;[^}]*left:\s*clamp\(0\.9rem,\s*2\.4vw,\s*2\.5rem\);[^}]*overflow-y:\s*auto;/,
  );
  assert.doesNotMatch(highDesktop[1], /\.tour-card/);

  assert.match(
    globalsCss,
    /@media \(forced-colors:\s*active\)[\s\S]*?\.destination-card__toggle\s*\{[^}]*border-color:\s*ButtonText;[^}]*background:\s*Canvas;[^}]*color:\s*ButtonText;/,
  );
  assert.match(
    globalsCss,
    /@media \(forced-colors:\s*active\)[\s\S]*?\.destination-card__toggle:hover,[\s\S]*?\.destination-card__toggle:focus-visible\s*\{[^}]*outline:\s*3px solid Highlight;[^}]*outline-offset:\s*2px;/,
  );
  assert.match(
    globalsCss,
    /\.cosmography-shell \.destination-card\s*\{[^}]*top:\s*8rem;[^}]*bottom:\s*0\.75rem;[^}]*max-height:\s*calc\(100svh - 8\.75rem\);/,
  );
});

test("atlas and directory actions keep a forty-four-pixel target floor", () => {
  for (const selector of [
    ".atlas-search input",
    ".scale-rail button",
    ".scene-context button",
    ".primary-action",
    ".release-status a",
    ".next-destinations button",
    ".directory-header nav a",
    ".directory-card-footer a",
    ".agency-card a",
  ]) {
    assert.match(cssRule(selector), /min-height:\s*44px;/, selector);
  }
  assert.match(cssRule(".directory-header nav a"), /min-width:\s*44px;/);
});

test("desktop scene time and release status occupy separate vertical lanes", () => {
  assert.match(cssRule(".timeline-dock"), /bottom:\s*3\.35rem;/);
  assert.match(cssRule(".release-status"), /bottom:\s*0\.38rem;/);
  assert.match(cssRule(".release-status a"), /min-height:\s*44px;/);
  assert.match(
    globalsCss,
    /@media \(max-height:\s*760px\) and \(min-width:\s*761px\)[\s\S]*?\.timeline-dock\s*\{[^}]*bottom:\s*4rem;/,
  );
  assert.match(
    globalsCss,
    /@media \(max-height:\s*760px\) and \(min-width:\s*761px\)[\s\S]*?\.compass-control\s*\{[^}]*display:\s*none;/,
  );
});

test("constrained landscape uses self-contained non-overlapping atlas lanes", () => {
  const constrained = globalsCss.match(
    /@media \(min-width:\s*560px\) and \(max-width:\s*760px\) and \(max-height:\s*760px\),\s*\n\s*\(min-width:\s*761px\) and \(max-width:\s*1180px\),\s*\n\s*\(min-width:\s*1181px\) and \(max-height:\s*819px\)\s*\{([\s\S]*?)\n\}\n\n@media \(max-height:\s*760px\) and \(min-width:\s*761px\)/,
  );
  assert.ok(constrained, "Expected a bounded landscape atlas layout");
  const rules = constrained[1];
  assert.doesNotMatch(rules, /\.atlas-search\s*\{[^}]*display:\s*none;/);
  assert.match(rules, /\.cosmography-shell \.scale-rail\s*\{[^}]*right:\s*6\.25rem;[^}]*flex-direction:\s*row;/s);
  assert.match(rules, /\.scene-context,[\s\S]*?\.timeline-dock,[\s\S]*?\.compass-control\s*\{[^}]*display:\s*none;/);
  assert.match(rules, /\.cosmography-shell \.release-status\s*\{[^}]*bottom:\s*0\.25rem;[^}]*display:\s*flex;/);
  assert.match(rules, /\.cosmography-shell \.destination-card\s*\{[^}]*top:\s*8rem;[^}]*overflow-y:\s*auto;/);
  assert.match(rules, /\.cosmography-shell \.scene-tools\s*\{[^}]*grid-template-columns:\s*repeat\(2, 44px\);[^}]*transform:\s*none;/);
  assert.match(rules, /\.cosmography-shell \.scene-tools button\s*\{[^}]*width:\s*44px;[^}]*min-height:\s*44px;/);
  assert.match(
    globalsCss,
    /@media \(min-width:\s*761px\) and \(max-width:\s*1024px\)\s*\{[^}]*\.timeline-dock,[\s\S]*?\.release-status\s*\{[^}]*display:\s*none;/,
  );
});

test("compact workstation viewports collapse copy and reserve non-overlapping lanes", () => {
  const compactWorkstation = globalsCss.match(
    /@media \(min-width:\s*560px\) and \(max-width:\s*760px\) and \(max-height:\s*760px\),\s*\n\s*\(min-width:\s*761px\) and \(max-width:\s*1180px\),\s*\n\s*\(min-width:\s*1181px\) and \(max-height:\s*819px\)\s*\{([\s\S]*?)\n\}\n\n@media \(max-height:\s*760px\) and \(min-width:\s*761px\)/,
  );
  assert.ok(compactWorkstation, "Expected a compact workstation atlas layout");
  const rules = compactWorkstation[1];
  assert.match(rules, /\.cosmography-shell \.scale-rail\s*\{[^}]*right:\s*6\.25rem;[^}]*overflow-x:\s*auto;[^}]*flex-direction:\s*row;/s);
  assert.match(rules, /\.scene-context,[\s\S]*?\.timeline-dock,[\s\S]*?\.compass-control\s*\{[^}]*display:\s*none;/);
  assert.match(rules, /\.release-status > span,[\s\S]*?\.release-status > a\s*\{[^}]*display:\s*none;/);
  assert.match(rules, /\.cosmography-shell \.destination-card\s*\{[^}]*top:\s*8rem;[^}]*bottom:\s*0\.75rem;[^}]*max-height:\s*calc\(100svh - 8\.75rem\);/s);
  assert.match(rules, /\.cosmography-shell \.scene-tools\s*\{[^}]*grid-template-columns:\s*repeat\(2, 44px\);[^}]*transform:\s*none;/s);

  const atlasShell = readFileSync(
    new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(atlasShell, /COMPACT_ATLAS_QUERY = "\(max-width: 1180px\), \(max-height: 819px\)"/);
  assert.match(atlasShell, /requestAnimationFrame\(collapseForCompactAtlas\)/);
  assert.match(atlasShell, /const compactAtlas = window\.matchMedia\(COMPACT_ATLAS_QUERY\)\.matches;/);
  assert.match(atlasShell, /if \(compactAtlas\) \{\s*setDestinationExpanded\(false\);/);
  assert.match(atlasShell, /Details collapsed to keep the compact atlas clear\./);
});

test("forced colors retain search focus and selected atlas states", () => {
  assert.match(
    globalsCss,
    /@media \(forced-colors:\s*active\)[\s\S]*?\.atlas-search:focus-within\s*\{[^}]*outline:\s*3px solid Highlight;[^}]*outline-offset:\s*2px;/,
  );
  assert.match(
    globalsCss,
    /@media \(forced-colors:\s*active\)[\s\S]*?\.scale-rail button\[aria-current="location"\],[\s\S]*?\.scene-tools button\[aria-pressed="true"\]\s*\{[^}]*border:\s*3px solid Highlight;/,
  );
});

test("full cosmos exit remains discoverable on the darkest renderer", () => {
  const exit = cssRule(".full-view-exit");
  assert.match(exit, /min-height:\s*44px;/);
  assert.match(exit, /border:\s*1px solid #9fc7d7;/i);
  assert.match(exit, /background:\s*rgba\(7,\s*22,\s*31,\s*0\.9\);/);
  assert.ok(contrast("#9fc7d7", "#020407") >= 3);
  assert.ok(contrast("#f4fbfd", "#0a202a") >= 4.5);

  assert.match(
    globalsCss,
    /\.is-full-view \.full-view-exit:focus-visible\s*\{[^}]*outline:\s*3px solid #effbff;[^}]*outline-offset:\s*3px;/is,
  );
});
