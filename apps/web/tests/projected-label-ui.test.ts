import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  new URL("../app/components/universe/ProjectedLabelLayer.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/components/universe/ProjectedLabelLayer.module.css", import.meta.url),
  "utf8",
);
const atlasShell = readFileSync(
  new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url),
  "utf8",
);
const detailPanel = readFileSync(
  new URL("../app/components/atlas/AtlasDetailPanel.tsx", import.meta.url),
  "utf8",
);

test("projected labels use the frozen data, layout, and runtime snapshot contracts", () => {
  assert.match(
    component,
    /import type \{ FoundationProjectedLabel \} from "@\/app\/data\/labels\/foundation-projected-labels";/,
  );
  assert.match(
    component,
    /import type \{ LabelProjectionSnapshot \} from "@\/app\/components\/universe\/runtime\/labelProjection";/,
  );
  assert.match(component, /defaultLabelReservedRects\(\{/);
  assert.match(component, /layoutProjectedLabels\(\{/);
  assert.match(component, /anchors: snapshot\.anchors\.map/);
  assert.match(component, /inFront: anchor\.inFront/);
  assert.match(component, /inFrustum: anchor\.inFrustum/);
  assert.match(component, /resolvedTier: snapshot\.zoomTier/);
});

test("ready projected labels remain named native controls in every view", () => {
  assert.match(component, /data-projected-label-id=\{label\.candidate\.id\}/);
  assert.match(
    component,
    /aria-current=\{label\.candidate\.id === selectedId \? "location" : undefined\}/,
  );
  assert.match(component, /<strong className=\{styles\.primary\}>\{label\.candidate\.name\}<\/strong>/);
  assert.match(component, /label\.candidate\.designation/);
  assert.match(component, /label\.candidate\.kindLabel/);
  assert.match(component, /aria-describedby=\{projectionDescriptionId\}/);
  assert.match(component, /semantic display anchors/);
  assert.match(component, /onSelect\?\.\(labelId, event\.currentTarget\)/);
  assert.doesNotMatch(component, /aria-live/);
});

test("structured failure states expose a bounded truthful interface list", () => {
  assert.match(component, /const FALLBACK_LIMIT = 8;/);
  assert.match(component, /Foundation destinations/);
  assert.match(component, /Interface list—not sky positions\./);
  assert.match(component, /renderState === "fallback"/);
  assert.match(component, /renderState === "error"/);
  assert.match(component, /renderState === "context-lost"/);
  assert.match(component, /fullView \? styles\.fallbackFullView/);
  assert.match(component, /styles\.fallbackLayer/);
  assert.match(component, /aria-describedby=\{descriptionId\}/);
  assert.match(component, /No release-backed anchor has a clear in-frame placement\./);
  assert.match(component, /emptyProjection/);
  assert.doesNotMatch(component, /localeCompare/);
  assert.doesNotMatch(
    component.match(/<header className=\{styles\.fallbackHeader\}>[\s\S]*?<\/header>/)?.[0] ?? "",
    /camera projection|projected sky/i,
  );
  assert.match(component, /if \(left\.id === selectedId\) return -1;/);
  assert.match(component, /\.slice\(0, FALLBACK_LIMIT\)/);
  assert.match(component, /<details className=\{`\$\{styles\.fallback\} \$\{styles\.compactFallback\}`\}>/);
  assert.match(component, /<summary[\s\S]*?aria-current="location"/);
  assert.doesNotMatch(component, /<details key=\{selectedId\}/);
  assert.match(component, /Foundation destinations<\/strong>/);
  assert.match(component, /Current: \{selected\.name\} · interface list, not sky positions/);
  assert.match(component, /compactDisclosure && !fullView/);
  assert.match(component, /const \[compact, setCompact\] = useState\(false\);/);
  assert.match(component, /window\.requestAnimationFrame\(\(\) => setCompact\(query\.matches\)\)/);
  assert.match(component, /window\.matchMedia\("\(max-width: 1024px\)"\)/);
  assert.match(
    component,
    /useState<boolean \| null>\(null\)/,
  );
  assert.match(
    component,
    /window\.matchMedia\([\s\S]*?"\(min-width: 560px\) and \(max-width: 760px\) and \(max-height: 760px\), "[\s\S]*?"\(min-width: 761px\) and \(max-width: 1180px\), "[\s\S]*?"\(min-width: 1181px\) and \(max-height: 819px\)"/,
  );
  assert.match(
    component,
    /shortLandscapeMode === null &&[\s\S]*?snapshot\.height <= 819[\s\S]*?snapshot\.width >= 560 && snapshot\.width <= 1180/,
  );
  assert.match(component, /shortLandscape: shortLandscapeMode === true/);
  assert.match(component, /const compact = snapshot\.width <= 760 \|\| shortLandscapeMode === true;/);
  assert.match(component, /compactFallback \|\| shortLandscapeMode === true/);
});

test("label plates are touch-safe, legible, opaque, and accessibility-adaptive", () => {
  assert.match(
    styles,
    /\.label\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/,
  );
  assert.match(
    styles,
    /\.fallbackList button\s*\{[^}]*min-height:\s*44px;/,
  );
  assert.match(styles, /\.primary\s*\{[^}]*font-size:\s*0\.8125rem;/);
  assert.match(
    styles,
    /\.designation,\s*\n\.detail\s*\{[^}]*font-size:\s*0\.75rem;/,
  );
  assert.match(styles, /\.label\s*\{[^}]*background:\s*#071117;/);
  assert.match(styles, /\.fallback\s*\{[^}]*background:\s*#071117;/);
  assert.match(styles, /\.fallback\s*\{[^}]*top:\s*clamp\(10rem,\s*19vh,\s*12rem\);/);
  assert.match(styles, /\.fallbackHeader p\s*\{[^}]*font-size:\s*0\.75rem;/);
  assert.match(styles, /\.compactSummary\s*\{[^}]*min-height:\s*44px;/);
  assert.match(styles, /\.fallback\.compactFallback\s*\{[^}]*max-height:\s*44px;/);
  assert.match(styles, /\.fallback\.compactFallback\[open\]\s*\{[^}]*max-height:\s*min\(18rem,/);
  assert.match(
    styles,
    /\.fallback:not\(\.fallbackFullView\):not\(\.compactFallback\)\s*\{[^}]*visibility:\s*hidden;/,
  );
  assert.match(styles, /@media \(max-width:\s*1024px\)/);
  assert.match(styles, /\.fallbackLayer\s*\{[^}]*z-index:\s*19;/);
  assert.match(
    styles,
    /\.fallbackList\s*\{[^}]*display:\s*flex;[^}]*overflow-x:\s*auto;[^}]*scroll-snap-type:\s*x proximity;/,
  );
  assert.match(
    styles,
    /\.fallbackList li\s*\{[^}]*flex:\s*0 0 min\(10\.25rem, calc\(50vw - 1\.5rem\)\);[^}]*scroll-snap-align:\s*start;/,
  );
  assert.match(
    styles,
    /\.fallback:not\(\.fallbackFullView\)\s*\{[^}]*max-height:\s*clamp\([\s\S]*?7\.5rem,[\s\S]*?clamp\(23\.75rem, 51vh, 26\.875rem\)[\s\S]*?10rem/,
  );
  assert.match(
    styles,
    /@media \(min-width:\s*560px\) and \(max-width:\s*1024px\) and \(max-height:\s*760px\),\s*\n\s*\(min-width:\s*1025px\) and \(max-height:\s*700px\)/,
  );
  assert.match(
    styles,
    /@media \(min-width:\s*761px\) and \(max-width:\s*1024px\) and \(min-height:\s*761px\)/,
  );
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /@media \(prefers-contrast:\s*more\)/);
  assert.match(styles, /@media \(forced-colors:\s*active\)/);
});

test("the shell does not present planned data layers as working controls", () => {
  assert.match(atlasShell, /catalogs:\s*true/);
  assert.match(atlasShell, /observations:\s*false/);
  assert.match(atlasShell, /missions:\s*false/);
  assert.match(atlasShell, /coverage:\s*false/);
  assert.match(detailPanel, /disabled=\{!layerLabels\[key\]\.available\}/);
  assert.match(detailPanel, /Observed light · planned/);
  assert.match(detailPanel, /Exploration · planned/);
  assert.match(detailPanel, /Coverage & unknowns · planned/);
});

test("the release year is honest scene context rather than a disconnected slider", () => {
  assert.match(atlasShell, /const timelineYear = 2026;/);
  assert.match(atlasShell, /Temporal layers planned/);
  assert.match(atlasShell, /No time-varying scientific layer is active in this release\./);
  assert.doesNotMatch(atlasShell, /type="range"/);
  assert.doesNotMatch(atlasShell, /setTimelineYear/);
});
