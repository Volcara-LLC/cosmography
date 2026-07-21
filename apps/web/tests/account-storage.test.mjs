import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Log, LogLevel, Miniflare } from "miniflare";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const databaseId = `cosmography-account-e2e-${randomUUID()}`;
const atlasReleaseId = "rel_landing_atlas_v0_1_0";

function validSavedPlaceInput(overrides = {}) {
  return {
    entityId: "mars",
    appearance: "immersive",
    releaseId: atlasReleaseId,
    ...overrides,
  };
}

function validRouteInput(overrides = {}) {
  return {
    title: "Solar System comparison",
    releaseId: atlasReleaseId,
    originEntityId: "solar-system",
    destinationEntityId: "proxima-centauri",
    travelMode: "light",
    visibility: "private",
    ...overrides,
  };
}

function validSpacecraftInput(overrides = {}) {
  return {
    displayName: "Far Horizon",
    profile: "fusion-0.1c",
    appearance: {
      schemaId: "cosmography.user-spacecraft.appearance",
      schemaVersion: "1.0.0",
      hullPreset: "pearl",
      accentPreset: "cyan",
      insignia: "orbit",
    },
    ...overrides,
  };
}

function runtimeOptions({
  modules,
  currentSecret,
  currentVersion,
  previousSecret,
  previousVersion,
}) {
  return {
    rootPath: appRoot,
    modules,
    modulesRoot: appRoot,
    compatibilityDate: "2026-07-19",
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
      JUDGE_ACCESS_MODE: "disabled",
      IDENTITY_HMAC_SECRET: currentSecret,
      IDENTITY_HMAC_KEY_VERSION: currentVersion,
      ...(previousSecret
        ? {
            IDENTITY_HMAC_PREVIOUS_SECRET: previousSecret,
            IDENTITY_HMAC_PREVIOUS_KEY_VERSION: previousVersion,
          }
        : {}),
    },
    d1Databases: { DB: databaseId },
    d1Persist: false,
    r2Buckets: { COSMOGRAPHY_MEDIA: `${databaseId}-media` },
    r2Persist: false,
    serviceBindings: {
      ASSETS: async () => new Response("Not found", { status: 404 }),
    },
    log: new Log(LogLevel.ERROR),
  };
}

async function builtServerModules() {
  const serverRoot = fileURLToPath(new URL("../dist/server/", import.meta.url));
  const entryPath = join(serverRoot, "index.js");
  const modulePaths = (await readdir(serverRoot, { recursive: true }))
    .filter((path) => path.endsWith(".js"))
    .map((path) => join(serverRoot, path))
    .filter((path) => path !== entryPath)
    .sort();
  return [entryPath, ...modulePaths].map((path) => ({
    type: "ESModule",
    path,
  }));
}

async function applyMigration(database) {
  const workerConfig = JSON.parse(
    await readFile(
      new URL("../dist/server/wrangler.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    workerConfig.d1_databases.map(({ migrations_dir }) => migrations_dir),
    ["../.openai/drizzle"],
  );
  const sourceMigrationRoot = new URL("../drizzle/", import.meta.url);
  const builtMigrationRoot = new URL(
    "../dist/.openai/drizzle/",
    import.meta.url,
  );
  const sourceMigrationFiles = (await readdir(sourceMigrationRoot))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const builtMigrationFiles = (await readdir(builtMigrationRoot))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.ok(sourceMigrationFiles.length > 0);
  assert.deepEqual(builtMigrationFiles, sourceMigrationFiles);

  const statements = [];
  for (const migrationFile of sourceMigrationFiles) {
    const sourceMigration = await readFile(
      new URL(migrationFile, sourceMigrationRoot),
      "utf8",
    );
    const builtMigration = await readFile(
      new URL(migrationFile, builtMigrationRoot),
      "utf8",
    );
    assert.equal(builtMigration, sourceMigration);
    statements.push(
      ...builtMigration
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean)
        .map((statement) => database.prepare(statement)),
    );
  }
  await database.batch(statements);
}

function identityHeaders(email, fullName) {
  return {
    accept: "application/json",
    "oai-authenticated-user-email": email,
    "oai-authenticated-user-full-name": encodeURIComponent(fullName),
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  };
}

async function requestApi(
  miniflare,
  pathname,
  { email, fullName, method = "GET", body } = {},
) {
  const headers = identityHeaders(email, fullName);
  if (body !== undefined) headers["content-type"] = "application/json";
  return miniflare.dispatchFetch(`https://cosmography.test${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function expectPrivateJson(response, status) {
  assert.equal(
    response.status,
    status,
    response.status === status ? undefined : await response.clone().text(),
  );
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
  assert.match(response.headers.get("cache-control") ?? "", /private/);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.match(response.headers.get("cache-control") ?? "", /max-age=0/);
  assert.equal(response.headers.get("pragma"), "no-cache");
  return response.json();
}

test("ephemeral D1 persists isolated accounts and survives HMAC key rotation", async (t) => {
  const v1Secret = randomBytes(48).toString("base64url");
  const v2Secret = randomBytes(48).toString("base64url");
  const modules = await builtServerModules();
  const options = runtimeOptions({
    modules,
    currentSecret: v1Secret,
    currentVersion: "test-v1",
  });
  const miniflare = new Miniflare(options);
  t.after(() => miniflare.dispose());

  let database = await miniflare.getD1Database("DB");
  await applyMigration(database);

  const ada = { email: "ada@example.test", fullName: "Ada Lovelace" };
  const grace = { email: "grace@example.test", fullName: "Grace Hopper" };

  const firstUseResponses = await Promise.all(
    Array.from({ length: 4 }, () =>
      requestApi(miniflare, "/api/v1/me/bookmarks", ada),
    ),
  );
  const initialBookmarks = await Promise.all(
    firstUseResponses.map((response) => expectPrivateJson(response, 200)),
  );
  assert.ok(initialBookmarks.every(({ records }) => records.length === 0));
  const adaAccounts = await database
    .prepare("select count(*) as count from app_users where display_name = ?")
    .bind(ada.fullName)
    .first();
  assert.equal(adaAccounts.count, 1);

  const createdBookmark = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/bookmarks", {
      ...ada,
      method: "POST",
      body: validSavedPlaceInput(),
    }),
    201,
  );
  assert.match(createdBookmark.records.id, /^bmk_/);
  assert.equal(createdBookmark.records.entity.id, "mars");
  assert.equal(createdBookmark.schemaId, "cosmography.user-saved-places");
  assert.equal(createdBookmark.schemaVersion, "1.0.0");
  assert.equal(createdBookmark.releaseId, atlasReleaseId);
  assert.deepEqual(createdBookmark.records.entity, {
    id: "mars",
    name: "Mars",
    slug: "mars",
    kind: "world",
    domain: "globe",
  });
  assert.deepEqual(createdBookmark.records.scene, {
    focusId: "mars",
    appearance: "immersive",
    timelineYear: 2026,
    releaseId: atlasReleaseId,
  });
  assert.equal("userId" in createdBookmark.records, false);
  assert.equal("sceneJson" in createdBookmark.records, false);

  const updatedBookmark = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/bookmarks", {
      ...ada,
      method: "POST",
      body: validSavedPlaceInput({ appearance: "scientific" }),
    }),
    200,
  );
  assert.equal(updatedBookmark.records.id, createdBookmark.records.id);
  assert.equal(updatedBookmark.records.scene.appearance, "scientific");
  assert.ok(updatedBookmark.records.savedAtMs > createdBookmark.records.savedAtMs);

  const missingReleaseInput = validRouteInput();
  delete missingReleaseInput.releaseId;
  const missingOriginInput = validRouteInput();
  delete missingOriginInput.originEntityId;
  const missingVisibilityInput = validRouteInput();
  delete missingVisibilityInput.visibility;
  const invalidRouteInputs = [
    missingReleaseInput,
    missingOriginInput,
    missingVisibilityInput,
    validRouteInput({ releaseId: "rel_not_the_active_release" }),
    validRouteInput({ originEntityId: "proxima-centauri" }),
    validRouteInput({ visibility: "public" }),
    validRouteInput({ travelMode: "teleport" }),
    validRouteInput({ unrecognizedField: true }),
  ];
  for (const body of invalidRouteInputs) {
    const invalidRoute = await expectPrivateJson(
      await requestApi(miniflare, "/api/v1/me/routes", {
        ...ada,
        method: "POST",
        body,
      }),
      400,
    );
    assert.equal(invalidRoute.error, "invalid_route");
  }
  const unknownDestination = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/routes", {
      ...ada,
      method: "POST",
      body: validRouteInput({ destinationEntityId: "not-in-this-release" }),
    }),
    400,
  );
  assert.equal(unknownDestination.error, "unknown_route_endpoint");
  const malformedJson = await expectPrivateJson(
    await miniflare.dispatchFetch("https://cosmography.test/api/v1/me/routes", {
      method: "POST",
      headers: {
        ...identityHeaders(ada.email, ada.fullName),
        "content-type": "application/json",
      },
      body: "{",
    }),
    400,
  );
  assert.equal(malformedJson.error, "invalid_json");

  const routeCases = [
    {
      mode: "instant",
      destinationEntityId: "andromeda",
      destination: "Andromeda Galaxy",
      truthClass: "navigation",
      resultKind: "semantic-navigation",
      distanceDefinition: "semantic-navigation",
      distanceLightYears: 2537000,
      speedFractionOfC: null,
      duration: false,
      hasDistanceProjection: true,
    },
    {
      mode: "light",
      destinationEntityId: "mars",
      destination: "Mars",
      truthClass: "physical-limit",
      resultKind: "awaiting-source-distance",
      distanceDefinition: "awaiting-source-distance",
      distanceLightYears: null,
      speedFractionOfC: 1,
      duration: false,
      hasDistanceProjection: false,
    },
    {
      mode: "voyager",
      destinationEntityId: "proxima-centauri",
      destination: "Proxima Centauri",
      truthClass: "historical-comparison",
      resultKind: "constant-speed-counterfactual",
      distanceDefinition: "source-distance-light-years",
      distanceLightYears: 4.2465,
      speedFractionOfC: 0.000059650745157108265,
      duration: true,
      hasDistanceProjection: true,
    },
    {
      mode: "fusion",
      destinationEntityId: "proxima-centauri",
      destination: "Proxima Centauri",
      truthClass: "hypothetical-physical",
      resultKind: "constant-speed-counterfactual",
      distanceDefinition: "source-distance-light-years",
      distanceLightYears: 4.2465,
      speedFractionOfC: 0.1,
      duration: true,
      hasDistanceProjection: true,
    },
    {
      mode: "warp",
      destinationEntityId: "andromeda",
      destination: "Andromeda Galaxy",
      truthClass: "fictional-only",
      resultKind: "fictional-only",
      distanceDefinition: "fictional-only",
      distanceLightYears: 2537000,
      speedFractionOfC: null,
      duration: false,
      hasDistanceProjection: true,
    },
  ];
  const createdRoutes = [];
  for (const routeCase of routeCases) {
    const createdRoute = await expectPrivateJson(
      await requestApi(miniflare, "/api/v1/me/routes", {
        ...ada,
        method: "POST",
        body: validRouteInput({
          title: `Solar System · ${routeCase.mode}`,
          destinationEntityId: routeCase.destinationEntityId,
          travelMode: routeCase.mode,
        }),
      }),
      201,
    );
    createdRoutes.push(createdRoute);
    assert.match(createdRoute.records.id, /^route_/);
    assert.equal(createdRoute.releaseId, atlasReleaseId);
    assert.equal(createdRoute.records.destination, routeCase.destination);
    assert.equal(createdRoute.records.travelMode, routeCase.mode);
    assert.equal(createdRoute.records.resultKind, routeCase.resultKind);
    assert.equal(
      createdRoute.records.durationLabel === null,
      !routeCase.duration,
    );

    const assumptions = createdRoute.records.assumptions;
    assert.equal(
      assumptions.schemaId,
      "cosmography.flight-deck.saved-route-assumptions",
    );
    assert.equal(assumptions.schemaVersion, "1.0.0");
    assert.equal(assumptions.releaseId, atlasReleaseId);
    assert.equal(assumptions.truthClass, routeCase.truthClass);
    assert.equal(assumptions.resultKind, routeCase.resultKind);
    assert.ok(assumptions.disclosure.length > 20);
    assert.equal(assumptions.actualJourneyClaim, false);
    assert.equal(assumptions.trajectoryClaim, false);
    assert.equal(assumptions.telemetryClaim, false);
    assert.equal(assumptions.availableVehicle, false);
    assert.equal(assumptions.fictional, routeCase.mode === "warp");
    assert.equal(
      assumptions.counterfactual,
      routeCase.mode === "voyager" || routeCase.mode === "fusion",
    );
    assert.equal(
      assumptions.input.destinationEntityId,
      routeCase.destinationEntityId,
    );
    assert.equal(
      assumptions.input.sourceDistanceLightYears,
      routeCase.distanceLightYears,
    );
    assert.equal(
      assumptions.input.speedFractionOfC,
      routeCase.speedFractionOfC,
    );
    assert.ok(
      assumptions.sources.destinationRecordSourceIds.length > 0,
      "destination record provenance must remain attached without being called a distance source",
    );
    assert.equal("distanceSourceIds" in assumptions.sources, false);
    if (routeCase.hasDistanceProjection) {
      assert.equal(
        assumptions.distanceProjection.projectionVersion,
        "foundation-flight-deck-distance-v1",
      );
      assert.equal(assumptions.distanceProjection.releaseId, atlasReleaseId);
      assert.equal(
        assumptions.distanceProjection.releaseManifestSha256,
        "e1dc9decfb38fa4996a4fe163dd5eba2b8fc448bea7a9d717a1a4febb3cf5b0e",
      );
      assert.equal(
        assumptions.distanceProjection.releaseContentSha256,
        "beeac15802d8ee504bef88607dcf06dcc052c72e9653ba3213eb0fc966d8ced3",
      );
      assert.equal(
        assumptions.distanceProjection.basis,
        "foundation-destination-record",
      );
      assert.deepEqual(
        assumptions.distanceProjection.recordSourceIds,
        assumptions.sources.destinationRecordSourceIds,
      );
      assert.equal(
        assumptions.distanceProjection.fieldLevelIngestionLineageAvailable,
        false,
      );
      assert.equal(
        assumptions.distanceProjection.straightLineRouteClaim,
        false,
      );
      assert.match(
        assumptions.distanceProjection.scientificMeaning,
        /destination record/i,
      );
    } else {
      assert.equal(assumptions.distanceProjection, null);
      assert.deepEqual(assumptions.sources.destinationRecordSourceIds, [
        "nasa-pds",
        "usgs-astrogeology",
        "naif-spice",
      ]);
    }
    assert.deepEqual(assumptions.omittedPhysics, [
      "acceleration",
      "deceleration",
      "energy",
      "route-geometry",
      "mission-constraints",
      "traveler-frame-time",
      "relativistic-observer-effects",
    ]);

    if (routeCase.mode === "voyager") {
      assert.deepEqual(assumptions.sources.comparisonModelSourceIds, [
        "jpl-horizons-vectors-2026-07-19",
      ]);
      assert.deepEqual(assumptions.comparisonReference, {
        sourceId: "jpl-horizons-vectors-2026-07-19",
        artifactPath:
          "apps/web/tests/fixtures/horizons/voyager-1-vectors-2026-07-19.txt",
        artifactSha256:
          "d5fb20227607ff652e109977a068f28aff0a13cf8bf1cbc55a8bf40cfdca1252",
        solutionName: "Voyager_1_ST+refit2022_m",
        epochTdb: "1990-02-14 00:00:00.0000 TDB",
        julianDateTdb: 2447936.5,
        center: "Sun",
        centerNaifId: 10,
        referenceFrame: "Ecliptic of J2000.0",
        referenceSystem: "ICRF",
        outputUnits: "AU-D",
        aberrationCorrection: "NONE",
        velocityAuPerDay: [
          -0.001361256050772332,
          -0.008299037657264556,
          0.005995398445562643,
        ],
        speedKilometersPerSecond: 17.882843512181083,
        fractionOfLightSpeed: 0.000059650745157108265,
        dataProduct: "frozen-geometric-ephemeris",
        comparisonUse: "counterfactual-constant-speed-only",
        telemetryClaim: false,
        trajectoryClaim: false,
      });
    } else {
      assert.deepEqual(assumptions.sources.comparisonModelSourceIds, []);
      assert.equal(assumptions.comparisonReference, null);
    }
  }

  const storedRouteTruth = await database
    .prepare(
      `select sr.travel_mode, sr.assumptions_json as route_assumptions_json,
              rl.assumptions_json as leg_assumptions_json,
              rl.distance_definition, rl.duration_lexical, rl.duration_unit,
              rl.result_state
       from saved_routes sr
       inner join route_legs rl on rl.route_id = sr.id
       order by sr.travel_mode`,
    )
    .all();
  assert.equal(storedRouteTruth.results.length, routeCases.length);
  for (const row of storedRouteTruth.results) {
    const routeCase = routeCases.find(({ mode }) => mode === row.travel_mode);
    assert.ok(routeCase);
    assert.equal(row.result_state, routeCase.resultKind);
    assert.equal(row.distance_definition, routeCase.distanceDefinition);
    assert.equal(row.duration_lexical === null, !routeCase.duration);
    assert.equal(row.duration_unit, routeCase.duration ? "display-label" : null);
    assert.deepEqual(
      JSON.parse(row.route_assumptions_json),
      JSON.parse(row.leg_assumptions_json),
    );
  }

  const createdRoute = createdRoutes.find(
    ({ records }) => records.travelMode === "light",
  );
  assert.ok(createdRoute);

  await database
    .prepare(
      `create trigger fail_rollback_fixture_leg
       before insert on route_legs
       when exists (
         select 1 from saved_routes
         where id = new.route_id and title = 'Rollback fixture'
       )
       begin
         select raise(abort, 'forced route-leg failure');
       end`,
    )
    .run();
  const rolledBackRoute = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/routes", {
      ...ada,
      method: "POST",
      body: validRouteInput({
        title: "Rollback fixture",
        destinationEntityId: "mars",
      }),
    }),
    503,
  );
  assert.equal(rolledBackRoute.error, "storage_unavailable");
  const routeRowsAfterFailure = await database
    .prepare(
      `select
        (select count(*) from saved_routes) as routes,
        (select count(*) from route_waypoints) as waypoints,
        (select count(*) from route_legs) as legs,
        (select count(*) from saved_routes where title = 'Rollback fixture') as failed_routes`,
    )
    .first();
  assert.deepEqual(routeRowsAfterFailure, {
    routes: 5,
    waypoints: 10,
    legs: 5,
    failed_routes: 0,
  });
  await database.prepare("drop trigger fail_rollback_fixture_leg").run();

  const adaBookmarks = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/bookmarks", ada),
    200,
  );
  const adaRoutes = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/routes", ada),
    200,
  );
  assert.deepEqual(
    adaBookmarks.records.map(({ id }) => id),
    [createdBookmark.records.id],
  );
  assert.deepEqual(
    adaRoutes.records.map(({ id }) => id).sort(),
    createdRoutes.map(({ records }) => records.id).sort(),
  );

  const graceBookmarks = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/bookmarks", grace),
    200,
  );
  assert.deepEqual(graceBookmarks.records, []);
  const graceRoutes = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/routes", grace),
    200,
  );
  assert.deepEqual(graceRoutes.records, []);
  const deniedBookmarkDelete = await expectPrivateJson(
    await requestApi(
      miniflare,
      "/api/v1/me/bookmarks",
      {
        ...grace,
        method: "DELETE",
        body: {
          id: createdBookmark.records.id,
          expectedSavedAtMs: updatedBookmark.records.savedAtMs,
        },
      },
    ),
    404,
  );
  const deniedRouteDelete = await expectPrivateJson(
    await requestApi(
      miniflare,
      `/api/v1/me/routes?id=${createdRoute.records.id}`,
      { ...grace, method: "DELETE" },
    ),
    404,
  );
  assert.equal(deniedBookmarkDelete.error, "not_found");
  assert.equal(deniedRouteDelete.error, "not_found");

  const createdFusionCraft = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/spacecraft", {
      ...ada,
      method: "POST",
      body: validSpacecraftInput(),
    }),
    201,
  );
  const fusionCraft = createdFusionCraft.records;
  assert.equal(createdFusionCraft.schemaId, "cosmography.user-spacecraft");
  assert.equal(createdFusionCraft.schemaVersion, "1.0.0");
  assert.match(fusionCraft.id, /^ship_[0-9a-f]{32}$/);
  assert.equal(fusionCraft.profile, "fusion-0.1c");
  assert.equal(fusionCraft.propulsion.truthClass, "hypothetical-physical");
  assert.equal(fusionCraft.propulsion.speedFractionOfC, 0.1);
  assert.equal(fusionCraft.propulsion.fictional, false);
  assert.equal(fusionCraft.propulsion.counterfactual, true);
  for (const authorityField of [
    "availableVehicle",
    "actualJourneyClaim",
    "missionPlan",
    "trajectoryClaim",
    "telemetryClaim",
    "scientificValidation",
  ]) {
    assert.equal(fusionCraft.propulsion[authorityField], false, authorityField);
  }
  assert.equal("userId" in fusionCraft, false);
  assert.equal("cosmeticsJson" in fusionCraft, false);
  assert.equal("definitionJson" in fusionCraft.propulsion, false);

  const spacecraftTaggedRoute = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/routes", {
      ...ada,
      method: "POST",
      body: validRouteInput({ spacecraftId: fusionCraft.id }),
    }),
    400,
  );
  assert.equal(spacecraftTaggedRoute.error, "invalid_route");
  const routeAssociationCounts = await database
    .prepare(
      `select
        (select count(*) from saved_routes where spacecraft_id is not null) as spacecraft_links,
        (select count(*) from route_legs where propulsion_model_id is not null) as propulsion_links`,
    )
    .first();
  assert.deepEqual(routeAssociationCounts, {
    spacecraft_links: 0,
    propulsion_links: 0,
  });

  const createdWarpCraft = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/spacecraft", {
      ...ada,
      method: "POST",
      body: validSpacecraftInput({
        displayName: "Story Arc",
        profile: "fictional-warp",
        appearance: {
          ...validSpacecraftInput().appearance,
          hullPreset: "mars-copper",
          accentPreset: "ember",
          insignia: "horizon",
        },
      }),
    }),
    201,
  );
  assert.equal(createdWarpCraft.records.profile, "fictional-warp");
  assert.equal(createdWarpCraft.records.propulsion.truthClass, "fictional-only");
  assert.equal(createdWarpCraft.records.propulsion.speedFractionOfC, null);
  assert.equal(createdWarpCraft.records.propulsion.fictional, true);
  assert.equal(createdWarpCraft.records.propulsion.counterfactual, false);

  const adaCraft = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/spacecraft", ada),
    200,
  );
  assert.deepEqual(
    new Set(adaCraft.records.map(({ id }) => id)),
    new Set([fusionCraft.id, createdWarpCraft.records.id]),
  );
  const graceCraft = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/spacecraft", grace),
    200,
  );
  assert.deepEqual(graceCraft.records, []);

  const foreignCraftPatch = await expectPrivateJson(
    await requestApi(miniflare, `/api/v1/me/spacecraft/${fusionCraft.id}`, {
      ...grace,
      method: "PATCH",
      body: {
        expectedUpdatedAtMs: fusionCraft.updatedAtMs,
        displayName: "Taken",
      },
    }),
    404,
  );
  const foreignCraftDelete = await expectPrivateJson(
    await requestApi(miniflare, `/api/v1/me/spacecraft/${fusionCraft.id}`, {
      ...grace,
      method: "DELETE",
    }),
    404,
  );
  assert.equal(foreignCraftPatch.error, "not_found");
  assert.equal(foreignCraftDelete.error, "not_found");

  const staleCraftPatch = await expectPrivateJson(
    await requestApi(miniflare, `/api/v1/me/spacecraft/${fusionCraft.id}`, {
      ...ada,
      method: "PATCH",
      body: {
        expectedUpdatedAtMs: fusionCraft.updatedAtMs - 1,
        displayName: "Stale Horizon",
      },
    }),
    409,
  );
  assert.equal(staleCraftPatch.error, "spacecraft_conflict");
  const noOpCraftPatch = await expectPrivateJson(
    await requestApi(miniflare, `/api/v1/me/spacecraft/${fusionCraft.id}`, {
      ...ada,
      method: "PATCH",
      body: {
        expectedUpdatedAtMs: fusionCraft.updatedAtMs,
        displayName: fusionCraft.displayName,
        appearance: fusionCraft.appearance,
      },
    }),
    400,
  );
  assert.equal(noOpCraftPatch.error, "spacecraft_no_change");
  const updatedFusionCraft = await expectPrivateJson(
    await requestApi(miniflare, `/api/v1/me/spacecraft/${fusionCraft.id}`, {
      ...ada,
      method: "PATCH",
      body: {
        expectedUpdatedAtMs: fusionCraft.updatedAtMs,
        displayName: "Far Horizon II",
        appearance: {
          ...fusionCraft.appearance,
          hullPreset: "lunar-silver",
          accentPreset: "gold",
          insignia: "star",
        },
      },
    }),
    200,
  );
  assert.equal(updatedFusionCraft.records.displayName, "Far Horizon II");
  assert.ok(updatedFusionCraft.records.updatedAtMs > fusionCraft.updatedAtMs);
  assert.equal(updatedFusionCraft.records.profile, fusionCraft.profile);
  assert.deepEqual(
    updatedFusionCraft.records.propulsion,
    fusionCraft.propulsion,
    "appearance edits must not rewrite propulsion truth",
  );

  const spoofedCraft = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/spacecraft", {
      ...ada,
      method: "POST",
      body: {
        ...validSpacecraftInput(),
        availableVehicle: true,
      },
    }),
    400,
  );
  assert.equal(spoofedCraft.error, "invalid_spacecraft");
  const invalidCraftName = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/spacecraft", {
      ...ada,
      method: "POST",
      body: validSpacecraftInput({ displayName: "hidden\u202edirection" }),
    }),
    400,
  );
  assert.equal(invalidCraftName.error, "invalid_spacecraft");
  const missingJsonContentType = await expectPrivateJson(
    await miniflare.dispatchFetch(
      "https://cosmography.test/api/v1/me/spacecraft",
      {
        method: "POST",
        headers: identityHeaders(ada.email, ada.fullName),
        body: "{}",
      },
    ),
    415,
  );
  assert.equal(missingJsonContentType.error, "json_content_type_required");
  const oversizedCraftBody = await expectPrivateJson(
    await miniflare.dispatchFetch(
      "https://cosmography.test/api/v1/me/spacecraft",
      {
        method: "POST",
        headers: {
          ...identityHeaders(ada.email, ada.fullName),
          "content-type": "application/json",
        },
        body: JSON.stringify({ value: "x".repeat(8_192) }),
      },
    ),
    413,
  );
  assert.equal(oversizedCraftBody.error, "request_too_large");

  const storedCraft = await database
    .prepare(
      `select display_name, propulsion_model_id, cosmetics_json
       from user_spacecraft where id = ?`,
    )
    .bind(fusionCraft.id)
    .first();
  assert.equal(storedCraft.display_name, "Far Horizon II");
  assert.equal(
    storedCraft.propulsion_model_id,
    "prop_concept_fusion_0_1c_v1",
  );
  assert.deepEqual(JSON.parse(storedCraft.cosmetics_json), updatedFusionCraft.records.appearance);

  const identityRowsV1 = await database
    .prepare(
      "select user_id, key_version, subject_hmac from auth_identities order by user_id, key_version",
    )
    .all();
  assert.equal(identityRowsV1.results.length, 2);
  assert.ok(
    identityRowsV1.results.every(({ subject_hmac }) =>
      /^[0-9a-f]{64}$/.test(subject_hmac),
    ),
  );
  assert.equal(
    JSON.stringify(identityRowsV1.results).includes(ada.email),
    false,
  );

  await miniflare.setOptions(
    runtimeOptions({
      modules,
      currentSecret: v2Secret,
      currentVersion: "test-v2",
      previousSecret: v1Secret,
      previousVersion: "test-v1",
    }),
  );
  const afterRotation = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/bookmarks", {
      email: "ADA@EXAMPLE.TEST",
      fullName: "Ada Lovelace",
    }),
    200,
  );
  assert.deepEqual(
    afterRotation.records.map(({ id }) => id),
    [createdBookmark.records.id],
  );
  const craftAfterRotation = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/spacecraft", {
      email: "ADA@EXAMPLE.TEST",
      fullName: "Ada Lovelace",
    }),
    200,
  );
  assert.deepEqual(
    new Set(craftAfterRotation.records.map(({ id }) => id)),
    new Set([fusionCraft.id, createdWarpCraft.records.id]),
  );
  const graceAfterRotation = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/bookmarks", grace),
    200,
  );
  assert.deepEqual(graceAfterRotation.records, []);

  database = await miniflare.getD1Database("DB");
  const rotatedIdentityRows = await database
    .prepare(
      `select u.display_name, ai.user_id, ai.key_version
       from auth_identities ai
       inner join app_users u on u.id = ai.user_id
       order by u.display_name, ai.key_version`,
    )
    .all();
  assert.deepEqual(
    rotatedIdentityRows.results.map(({ display_name, key_version }) => [
      display_name,
      key_version,
    ]),
    [
      ["Ada Lovelace", "test-v1"],
      ["Ada Lovelace", "test-v2"],
      ["Grace Hopper", "test-v1"],
      ["Grace Hopper", "test-v2"],
    ],
  );
  assert.equal(
    new Set(
      rotatedIdentityRows.results
        .filter(({ display_name }) => display_name === ada.fullName)
        .map(({ user_id }) => user_id),
    ).size,
    1,
  );
  assert.equal(
    new Set(
      rotatedIdentityRows.results
        .filter(({ display_name }) => display_name === grace.fullName)
        .map(({ user_id }) => user_id),
    ).size,
    1,
  );
  const retirementGate = await database
    .prepare(
      `select count(*) as missing_current_identity
       from app_users u
       where u.status = 'active'
         and not exists (
           select 1 from auth_identities ai
           where ai.user_id = u.id
             and ai.provider = 'chatgpt-si-wc'
             and ai.key_version = ?
         )`,
    )
    .bind("test-v2")
    .first();
  assert.equal(retirementGate.missing_current_identity, 0);

  const splitSubject = "split@example.test";
  const splitV1Hmac = createHmac("sha256", v1Secret)
    .update(splitSubject)
    .digest("hex");
  const splitV2Hmac = createHmac("sha256", v2Secret)
    .update(splitSubject)
    .digest("hex");
  await database.batch([
    database.prepare(
      "insert into app_users(id, display_name) values ('usr_split_old', 'Split old')",
    ),
    database.prepare(
      "insert into app_users(id, display_name) values ('usr_split_new', 'Split new')",
    ),
    database
      .prepare(
        `insert into auth_identities(user_id, provider, key_version, subject_hmac)
         values ('usr_split_old', 'chatgpt-si-wc', 'test-v1', ?)`,
      )
      .bind(splitV1Hmac),
    database
      .prepare(
        `insert into auth_identities(user_id, provider, key_version, subject_hmac)
         values ('usr_split_new', 'chatgpt-si-wc', 'test-v2', ?)`,
      )
      .bind(splitV2Hmac),
  ]);
  const splitIdentity = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/bookmarks", {
      email: splitSubject,
      fullName: "Split identity",
    }),
    503,
  );
  assert.equal(splitIdentity.error, "identity_conflict");
  await database
    .prepare("delete from app_users where id in ('usr_split_old', 'usr_split_new')")
    .run();

  await miniflare.setOptions(
    runtimeOptions({
      modules,
      currentSecret: v2Secret,
      currentVersion: "test-v2",
    }),
  );
  const afterPreviousKeyRemoval = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/bookmarks", ada),
    200,
  );
  assert.deepEqual(
    afterPreviousKeyRemoval.records.map(({ id }) => id),
    [createdBookmark.records.id],
  );
  const graceAfterPreviousKeyRemoval = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/bookmarks", grace),
    200,
  );
  assert.deepEqual(graceAfterPreviousKeyRemoval.records, []);
  database = await miniflare.getD1Database("DB");
  const retainedAccountCount = await database
    .prepare("select count(*) as count from app_users")
    .first();
  assert.equal(retainedAccountCount.count, 2);

  await expectPrivateJson(
    await requestApi(
      miniflare,
      "/api/v1/me/bookmarks",
      {
        ...ada,
        method: "DELETE",
        body: {
          id: createdBookmark.records.id,
          expectedSavedAtMs: updatedBookmark.records.savedAtMs,
        },
      },
    ),
    200,
  );
  for (const { records } of createdRoutes) {
    await expectPrivateJson(
      await requestApi(miniflare, `/api/v1/me/routes?id=${records.id}`, {
        ...ada,
        method: "DELETE",
      }),
      200,
    );
  }
  for (const spacecraftId of [fusionCraft.id, createdWarpCraft.records.id]) {
    await expectPrivateJson(
      await requestApi(
        miniflare,
        `/api/v1/me/spacecraft/${spacecraftId}`,
        { ...ada, method: "DELETE" },
      ),
      200,
    );
  }

  database = await miniflare.getD1Database("DB");
  const remainingPrivateRows = await database
    .prepare(
      `select
        (select count(*) from bookmarks) as bookmarks,
        (select count(*) from user_spacecraft) as spacecraft,
        (select count(*) from saved_routes) as routes,
        (select count(*) from route_waypoints) as waypoints,
        (select count(*) from route_legs) as legs`,
    )
    .first();
  assert.deepEqual(remainingPrivateRows, {
    bookmarks: 0,
    spacecraft: 0,
    routes: 0,
    waypoints: 0,
    legs: 0,
  });

  const incompleteRotationOptions = runtimeOptions({
    modules,
    currentSecret: v2Secret,
    currentVersion: "test-v2",
  });
  incompleteRotationOptions.bindings.IDENTITY_HMAC_PREVIOUS_SECRET = v1Secret;
  await miniflare.setOptions(incompleteRotationOptions);
  const incompleteRotation = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/bookmarks", ada),
    503,
  );
  assert.equal(incompleteRotation.error, "identity_not_configured");

  await miniflare.setOptions(
    runtimeOptions({
      modules,
      currentSecret:
        "replace-with-a-random-secret-of-at-least-32-characters",
      currentVersion: "test-v3",
    }),
  );
  const placeholderSecret = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/bookmarks", ada),
    503,
  );
  assert.equal(placeholderSecret.error, "identity_not_configured");
});
