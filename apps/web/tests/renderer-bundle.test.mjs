import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gzipSync } from "node:zlib";

const appRoot = new URL("../", import.meta.url);

async function requestHome() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("bundle-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/"),
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

async function readClientAsset(pathname) {
  return readFile(new URL(`../dist/client${pathname}`, import.meta.url));
}

test("home keeps Three.js and semantic renderer domains out of eager preloads", async () => {
  const response = await requestHome();
  assert.equal(response.status, 200);
  const html = await response.text();
  const preloadPaths = [
    ...new Set(
      [...html.matchAll(/<link rel="modulepreload" href="([^"]+)/g)].map(
        (match) => match[1],
      ),
    ),
  ];

  assert.ok(preloadPaths.length > 0);
  assert.equal(
    preloadPaths.some((path) =>
      /three|createUniverseRenderer|cosmic|galactic|system|globe|surface|relativity/i.test(
        path,
      ),
    ),
    false,
  );

  const buffers = await Promise.all(preloadPaths.map(readClientAsset));
  const rawBytes = buffers.reduce((total, buffer) => total + buffer.length, 0);
  const gzipBytes = buffers.reduce(
    (total, buffer) => total + gzipSync(buffer, { level: 9 }).length,
    0,
  );
  assert.ok(rawBytes <= 360_000, `eager JS is ${rawBytes} bytes`);
  assert.ok(gzipBytes <= 115_000, `eager JS gzip is ${gzipBytes} bytes`);

  const eagerJavaScript = Buffer.concat(buffers).toString("utf8");
  for (const marker of ["__zod_globalConfig", "_zod", "$ZodError"]) {
    assert.equal(
      eagerJavaScript.includes(marker),
      false,
      `eager atlas client graph includes Zod runtime marker ${marker}`,
    );
  }
  for (const marker of [
    "cosmography.user-recorded-encounters",
    "Record this encounter",
    "Recorded encounters",
    "Saved resume point",
    "manual-save-resume-point",
    "cosmography.user-saved-places",
    "Saved places",
    "manual-save-place",
  ]) {
    assert.equal(
      eagerJavaScript.includes(marker),
      false,
      `eager home client graph includes private encounter marker ${marker}`,
    );
  }

  const atlasFixtureSource = await readFile(
    new URL("../app/data/atlas.ts", import.meta.url),
    "utf8",
  );
  assert.match(atlasFixtureSource, /^import type \{/);
  assert.doesNotMatch(atlasFixtureSource, /\b\w+Schema\b|\.parse\s*\(/);

  const stylesheetPaths = [
    ...new Set(
      [...html.matchAll(/<link rel="stylesheet" href="([^"]+)/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  const stylesheets = await Promise.all(stylesheetPaths.map(readClientAsset));
  const stylesheetGzipBytes = stylesheets.reduce(
    (total, buffer) => total + gzipSync(buffer, { level: 9 }).length,
    0,
  );
  assert.ok(
    stylesheetGzipBytes <= 30_000,
    `global CSS gzip is ${stylesheetGzipBytes} bytes`,
  );

  const manifest = JSON.parse(
    await readFile(
      new URL("../dist/client/.vite/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const atlasShell = manifest["app/components/atlas/AtlasShell.tsx"];
  const detailPanel = manifest["app/components/atlas/AtlasDetailPanel.tsx"];
  const spacecraftHangar =
    manifest["app/components/account/SpacecraftHangar.tsx"];
  const personalStorageKey = Object.keys(manifest).find(
    (key) => manifest[key].name === "personal-storage",
  );
  const personalStorage = personalStorageKey
    ? manifest[personalStorageKey]
    : undefined;
  const guidedTour = manifest["app/components/tours/GuidedTourExperience.tsx"];
  assert.ok(atlasShell);
  assert.ok(detailPanel);
  assert.ok(spacecraftHangar);
  assert.ok(personalStorage);
  assert.ok(guidedTour);
  assert.ok(
    atlasShell.dynamicImports?.includes(personalStorageKey),
    "AtlasShell must keep personal storage behind a dynamic import",
  );
  for (const privateSurface of [
    detailPanel,
    spacecraftHangar,
    personalStorage,
    guidedTour,
  ]) {
    assert.equal(
      preloadPaths.some((path) => path.endsWith(`/${privateSurface.file}`)),
      false,
    );
    for (const stylesheet of privateSurface.css ?? []) {
      assert.equal(
        stylesheetPaths.some((path) => path.endsWith(`/${stylesheet}`)),
        false,
      );
    }
  }

  const personalStorageBuffer = await readClientAsset(
    `/${personalStorage.file}`,
  );
  assert.ok(
    personalStorageBuffer.length <= 16 * 1024,
    `lazy saved-place client is ${personalStorageBuffer.length} raw bytes`,
  );
  assert.ok(
    gzipSync(personalStorageBuffer, { level: 9 }).length <= 5 * 1024,
    "lazy saved-place client exceeds its gzip budget",
  );
});

test("manifest exposes lazy labels, one lazy engine, and literal semantic-domain chunks", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../dist/client/.vite/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const viewportEntry = Object.values(manifest).find(
    (entry) => entry.name === "UniverseViewport",
  );
  assert.ok(viewportEntry);
  assert.deepEqual(
    new Set(viewportEntry.dynamicImports),
    new Set([
      "app/components/universe/ProjectedLabelLayer.tsx",
      "app/components/universe/runtime/createUniverseRenderer.ts",
    ]),
  );

  const projectedLabels =
    manifest["app/components/universe/ProjectedLabelLayer.tsx"];
  assert.ok(projectedLabels);
  const projectedLabelBuffer = await readFile(
    new URL(`../dist/client/${projectedLabels.file}`, import.meta.url),
  );
  assert.ok(
    projectedLabelBuffer.length <= 12 * 1024,
    `lazy projected-label UI is ${projectedLabelBuffer.length} raw bytes`,
  );
  assert.ok(
    gzipSync(projectedLabelBuffer, { level: 9 }).length <= 4 * 1024,
    "lazy projected-label UI exceeds its gzip budget",
  );
  for (const stylesheet of projectedLabels.css ?? []) {
    const stylesheetBuffer = await readFile(
      new URL(`../dist/client/${stylesheet}`, import.meta.url),
    );
    assert.ok(
      gzipSync(stylesheetBuffer, { level: 9 }).length <= 3 * 1024,
      "lazy projected-label CSS exceeds its gzip budget",
    );
  }

  const engine = manifest[
    "app/components/universe/runtime/createUniverseRenderer.ts"
  ];
  assert.ok(engine);
  assert.deepEqual(new Set(engine.dynamicImports), new Set([
    "app/components/universe/runtime/domains/cosmic.ts",
    "app/components/universe/runtime/domains/galactic.ts",
    "app/components/universe/runtime/domains/system.ts",
    "app/components/universe/runtime/domains/globe.ts",
    "app/components/universe/runtime/domains/surface.ts",
    "app/components/universe/runtime/domains/relativity.ts",
  ]));

  const threeImportKey = engine.imports.find((key) => {
    const entry = manifest[key];
    return /(?:^|[/_.-])three(?:\.module)?(?:[/_.-]|$)/i.test(
      entry?.file ?? key,
    );
  });
  const threeEntry = manifest[threeImportKey];
  assert.ok(threeEntry);
  const threeBuffer = await readFile(
    new URL(`../dist/client/${threeEntry.file}`, import.meta.url),
  );
  assert.ok(
    threeBuffer.length <= 540_000,
    `lazy Three.js module is ${threeBuffer.length} raw bytes`,
  );
  const engineFiles = [engine.file, threeEntry.file]
    .concat(
      engine.imports
        .map((key) => manifest[key])
        .filter((entry) => entry?.name === "shared")
        .map((entry) => entry.file),
    );
  const engineBuffers = await Promise.all(
    engineFiles.map((file) => readFile(new URL(`../dist/client/${file}`, import.meta.url))),
  );
  const engineGzipBytes = engineBuffers.reduce(
    (total, buffer) => total + gzipSync(buffer, { level: 9 }).length,
    0,
  );
  assert.ok(
    engineGzipBytes <= 145 * 1024,
    `shared renderer gzip is ${engineGzipBytes} bytes`,
  );

  for (const domainKey of engine.dynamicImports) {
    const domainEntry = manifest[domainKey];
    assert.ok(domainEntry);
    const buffer = await readFile(
      new URL(`../dist/client/${domainEntry.file}`, import.meta.url),
    );
    assert.ok(
      gzipSync(buffer, { level: 9 }).length <= 15 * 1024,
      `${domainEntry.name} domain exceeds its gzip budget`,
    );
  }
});

test("renderer source files remain present for recovery and review", async () => {
  await Promise.all([
    readFile(new URL("../app/components/universe/UniverseViewport.tsx", import.meta.url)),
    readFile(
      new URL(
        "../app/components/universe/runtime/createUniverseRenderer.ts",
        import.meta.url,
      ),
    ),
  ]);
  assert.ok(appRoot);
});

test("destination changes never distort camera field of view or scene scale", async () => {
  const source = await readFile(
    new URL(
      "../app/components/universe/runtime/createUniverseRenderer.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(source, /travelElapsed|travelFinished|applyTravelPulseRequest/);
  assert.doesNotMatch(source, /camera\.fov\s*=/);
  assert.doesNotMatch(source, /root\.scale\.(?:set|setScalar)\(/);
});

test("atlas selection changes use a stable, non-animated recenter request", async () => {
  const [shell, viewport, renderer] = await Promise.all([
    readFile(new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/universe/UniverseViewport.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../app/components/universe/runtime/createUniverseRenderer.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(shell, /setSelected\(entity\);/);
  assert.match(shell, /setRecenterSequence\(\(value\) => value \+ 1\);/);
  assert.match(
    shell,
    /<UniverseViewport[\s\S]*?focusId=\{selected\.id\}[\s\S]*?recenterSequence=\{recenterSequence\}/,
  );
  assert.doesNotMatch(shell, /travelSequence|setTravelSequence/);
  assert.match(viewport, /controllerRef\.current\.recenterSelection\(pendingSequence\);/);
  assert.doesNotMatch(viewport, /travelSequence|playTravel|camera-pulse/);
  assert.match(
    renderer,
    /recenterSelection\(sequence\)\s*\{[\s\S]*?currentRecenterSequence = sequence;[\s\S]*?resetView\(\);[\s\S]*?\},/,
  );
});

test("label projection throttles continuous input and forces one final delivery", async () => {
  const source = await readFile(
    new URL("../app/components/universe/runtime/createUniverseRenderer.ts", import.meta.url),
    "utf8",
  );
  const orbitBlock = source.match(/const orbitBy = [\s\S]*?\n  };/)?.[0] ?? "";
  const zoomBlock = source.match(/const zoomBy = [\s\S]*?\n  };/)?.[0] ?? "";
  assert.match(source, /if \(!force && now - lastProjectionPublishedAt < 1000 \/ 30\) return;/);
  assert.match(source, /scheduleFinalProjection[\s\S]*?Math\.ceil\(1000 \/ 30\)/);
  assert.match(orbitBlock, /renderOnce\(\);[\s\S]*?scheduleFinalProjection\(\);/);
  assert.match(zoomBlock, /renderOnce\(\);[\s\S]*?scheduleFinalProjection\(\);/);
  assert.doesNotMatch(orbitBlock, /renderOnce\(true\)/);
  assert.doesNotMatch(zoomBlock, /renderOnce\(true\)/);
  assert.match(source, /publishLabelProjection\(now, forceProjection\);/);
});

test("labels do not recreate unlabeled renderers and selection reacquires focus", async () => {
  const source = await readFile(
    new URL("../app/components/universe/UniverseViewport.tsx", import.meta.url),
    "utf8",
  );
  const rendererEffect =
    source.match(/useEffect\(\(\) => \{\n    const canvas[\s\S]*?\n  \]\);/)?.[0] ?? "";
  assert.ok(rendererEffect);
  assert.match(source, /projectionAnchors\.length === 0\s*\? undefined/);
  assert.doesNotMatch(rendererEffect, /labelsVisible|fullView/);
  assert.match(source, /rendererGenerationRef\.current !== rendererGeneration/);
  assert.match(source, /querySelector<HTMLButtonElement>[\s\S]*?data-projected-label-id/);
  assert.match(source, /target && !target\.disabled\) target\.focus\(\);[\s\S]*?canvasRef\.current\?\.focus\(\)/);
});
