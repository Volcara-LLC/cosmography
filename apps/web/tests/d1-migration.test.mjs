import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

async function applyFoundationMigration() {
  const migrationRoot = new URL("../drizzle/", import.meta.url);
  const migrationFiles = (await readdir(migrationRoot))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.ok(migrationFiles.length > 0, "D1 must have at least one migration");
  const database = new DatabaseSync(":memory:");
  for (const migrationFile of migrationFiles) {
    const migration = await readFile(
      new URL(migrationFile, migrationRoot),
      "utf8",
    );
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) database.exec(statement);
    }
  }
  return database;
}

const durableAppearance = JSON.stringify({
  schemaId: "cosmography.user-spacecraft.appearance",
  schemaVersion: "1.0.0",
  hullPreset: "pearl",
  accentPreset: "cyan",
  insignia: "orbit",
});

const durableModels = [
  {
    id: "prop_concept_fusion_0_1c_v1",
    code: "fusion-0.1c",
    version: "1.0.0",
    model_class: "hypothetical-physical",
    title: "Fusion 0.1c concept",
    distance_definition: "source-distance-light-years",
    evidence_class: "physics-simulation",
    definition: {
      schemaId: "cosmography.propulsion-model",
      schemaVersion: "1.0.0",
      profile: "fusion-0.1c",
      compatibleTravelMode: "fusion",
      truthClass: "hypothetical-physical",
      speedFractionOfC: 0.1,
      fictional: false,
      counterfactual: true,
      personalConcept: true,
      comparisonOnly: true,
      availableVehicle: false,
      actualJourneyClaim: false,
      missionPlan: false,
      trajectoryClaim: false,
      telemetryClaim: false,
      scientificValidation: false,
      disclosure:
        "Hypothetical constant 0.1c comparison only; no available spacecraft or mission is claimed.",
      omittedPhysics: [
        "acceleration",
        "deceleration",
        "energy",
        "route-geometry",
        "mission-constraints",
        "traveler-frame-time",
        "relativistic-observer-effects",
      ],
    },
  },
  {
    id: "prop_concept_warp_fiction_v1",
    code: "fictional-warp",
    version: "1.0.0",
    model_class: "fictional-only",
    title: "Fictional warp concept",
    distance_definition: "fictional-only",
    evidence_class: "artist-interpretation",
    definition: {
      schemaId: "cosmography.propulsion-model",
      schemaVersion: "1.0.0",
      profile: "fictional-warp",
      compatibleTravelMode: "warp",
      truthClass: "fictional-only",
      speedFractionOfC: null,
      fictional: true,
      counterfactual: false,
      personalConcept: true,
      comparisonOnly: true,
      availableVehicle: false,
      actualJourneyClaim: false,
      missionPlan: false,
      trajectoryClaim: false,
      telemetryClaim: false,
      scientificValidation: false,
      disclosure:
        "Fictional story concept only; no scientific duration, available spacecraft, or mission is claimed.",
      omittedPhysics: [
        "acceleration",
        "deceleration",
        "energy",
        "route-geometry",
        "mission-constraints",
        "traveler-frame-time",
        "relativistic-observer-effects",
      ],
    },
  },
];

test("D1 migration creates the release and private exploration control plane", async () => {
  const database = await applyFoundationMigration();
  const tables = database
    .prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name",
    )
    .all()
    .map((row) => row.name);
  assert.deepEqual(tables, [
    "active_release_channels",
    "app_users",
    "auth_identities",
    "bookmarks",
    "content_releases",
    "judge_access_attempts",
    "propulsion_models",
    "route_legs",
    "route_waypoints",
    "saved_routes",
    "user_discoveries",
    "user_preferences",
    "user_progress",
    "user_spacecraft",
  ]);

  const release = database
    .prepare(
      "select id, version, schema_version, state, manifest_sha256 from content_releases where id = ?",
    )
    .get("rel_landing_atlas_v0_1_0");
  const activeRelease = database
    .prepare(
      "select channel, release_id from active_release_channels where channel = 'foundation'",
    )
    .get();
  const manifest = await readFile(
    new URL("../db/foundation-release-manifest.json", import.meta.url),
  );
  assert.deepEqual({ ...release }, {
    id: "rel_landing_atlas_v0_1_0",
    version: "landing-atlas-v0.1.0",
    schema_version: "0.1.0",
    state: "published",
    manifest_sha256: createHash("sha256").update(manifest).digest("hex"),
  });
  assert.deepEqual({ ...activeRelease }, {
    channel: "foundation",
    release_id: release.id,
  });
});

test("D1 judge access limiter stores only bounded pseudonymous attempts", async () => {
  const database = await applyFoundationMigration();
  const validKey = "a".repeat(43);
  assert.doesNotThrow(() =>
    database
      .prepare(
        `insert into judge_access_attempts(
           attempt_key, window_started_at_ms, failure_count,
           blocked_until_ms, updated_at_ms
         ) values (?, 1000, 1, 0, 1000)`,
      )
      .run(validKey),
  );
  assert.throws(
    () =>
      database
        .prepare(
          `insert into judge_access_attempts(
             attempt_key, window_started_at_ms, failure_count,
             blocked_until_ms, updated_at_ms
           ) values (?, 1000, 1, 0, 1000)`,
        )
        .run("raw-client-address"),
    /ck_judge_access_attempt_key/,
  );
  assert.throws(
    () =>
      database
        .prepare(
          `update judge_access_attempts
           set failure_count = 9
           where attempt_key = ?`,
        )
        .run(validKey),
    /ck_judge_access_failure_count/,
  );
});

test("D1 durable spacecraft models are exact, truthful, and immutable", async () => {
  const database = await applyFoundationMigration();
  const storedModels = database
    .prepare(
      `select id, code, version, model_class, title, distance_definition,
              definition_json, evidence_class, citation_assertion_id
       from propulsion_models
       order by id`,
    )
    .all();

  assert.deepEqual(
    storedModels.map(({ definition_json, ...row }) => ({
      ...row,
      definition: JSON.parse(definition_json),
    })),
    durableModels.map((model) => ({
      ...model,
      citation_assertion_id: null,
    })),
  );
  for (const { id } of durableModels) {
    assert.throws(
      () =>
        database
          .prepare("update propulsion_models set title = title where id = ?")
          .run(id),
      /durable propulsion model is immutable/,
    );
    assert.throws(
      () => database.prepare("delete from propulsion_models where id = ?").run(id),
      /durable propulsion model is immutable/,
    );
  }
  const replacementModel = database.prepare(
    `insert or replace into propulsion_models(
       id, code, version, model_class, title, distance_definition,
       definition_json, evidence_class, citation_assertion_id
     ) values (?, ?, ?, ?, ?, ?, ?, ?, null)`,
  );
  const fusionModel = durableModels[0];
  assert.throws(
    () =>
      replacementModel.run(
        fusionModel.id,
        fusionModel.code,
        fusionModel.version,
        "fictional-only",
        "Replacement by protected id",
        fusionModel.distance_definition,
        JSON.stringify(fusionModel.definition),
        fusionModel.evidence_class,
      ),
    /durable propulsion model is immutable/,
  );
  assert.throws(
    () =>
      replacementModel.run(
        "prop_replacement_fixture",
        fusionModel.code,
        fusionModel.version,
        "fictional-only",
        "Replacement by protected code and version",
        fusionModel.distance_definition,
        JSON.stringify(fusionModel.definition),
        fusionModel.evidence_class,
      ),
    /durable propulsion model is immutable/,
  );
  replacementModel.run(
    "prop_other_fixture",
    "other-fixture",
    "1.0.0",
    "fixture-only",
    "Unprotected fixture",
    "fixture-only",
    "{}",
    "fixture",
  );
  assert.throws(
    () =>
      database
        .prepare(
          `update or replace propulsion_models
           set code = ?, version = ?, title = ?
           where id = 'prop_other_fixture'`,
        )
        .run(fusionModel.code, fusionModel.version, "Code collision"),
    /durable propulsion model is immutable/,
  );
  assert.throws(
    () =>
      database
        .prepare(
          `update or replace propulsion_models
           set id = ?, title = ?
           where id = 'prop_other_fixture'`,
        )
        .run(fusionModel.id, "Identity collision"),
    /durable propulsion model is immutable/,
  );
  assert.equal(
    database
      .prepare("select title from propulsion_models where id = ?")
      .get(fusionModel.id).title,
    fusionModel.title,
  );
});

test("D1 durable spacecraft guards reject drift and cap each private hangar", async () => {
  const database = await applyFoundationMigration();
  database.exec(`
    insert into app_users(id, display_name) values ('usr_owner', 'Owner');
    insert into app_users(id, display_name) values ('usr_other', 'Other');
    insert into app_users(id, display_name) values ('usr_quota', 'Quota');
  `);

  const insertSpacecraft = database.prepare(
    `insert into user_spacecraft(
       id, user_id, display_name, propulsion_model_id, cosmetics_json,
       created_at_ms, updated_at_ms
     ) values (?, ?, ?, ?, ?, ?, ?)`,
  );
  const validId = `ship_${"a".repeat(32)}`;
  assert.doesNotThrow(() =>
    insertSpacecraft.run(
      validId,
      "usr_owner",
      "Horizon",
      "prop_concept_fusion_0_1c_v1",
      durableAppearance,
      1000,
      1000,
    ),
  );
  assert.throws(
    () =>
      database
        .prepare(
          `insert or replace into user_spacecraft(
             id, user_id, display_name, propulsion_model_id, cosmetics_json,
             created_at_ms, updated_at_ms
           ) values (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          validId,
          "usr_other",
          "Replacement craft",
          "prop_concept_warp_fiction_v1",
          durableAppearance,
          2000,
          2000,
        ),
    /durable spacecraft identity already exists/,
  );
  assert.deepEqual(
    {
      ...database
        .prepare(
          `select user_id, display_name, propulsion_model_id, created_at_ms, updated_at_ms
           from user_spacecraft where id = ?`,
        )
        .get(validId),
    },
    {
      user_id: "usr_owner",
      display_name: "Horizon",
      propulsion_model_id: "prop_concept_fusion_0_1c_v1",
      created_at_ms: 1000,
      updated_at_ms: 1000,
    },
  );
  assert.doesNotThrow(() =>
    database
      .prepare(
        "update user_spacecraft set display_name = ?, updated_at_ms = ? where id = ?",
      )
      .run("Horizon II", 1001, validId),
  );

  assert.throws(
    () =>
      database
        .prepare("update user_spacecraft set updated_at_ms = ? where id = ?")
        .run(1001, validId),
    /invalid durable spacecraft timestamps/,
  );
  assert.throws(
    () =>
      database
        .prepare(
          "update user_spacecraft set propulsion_model_id = ?, updated_at_ms = ? where id = ?",
        )
        .run("prop_concept_warp_fiction_v1", 1002, validId),
    /identity and model are immutable/,
  );
  assert.throws(
    () =>
      database
        .prepare(
          "update user_spacecraft set user_id = ?, updated_at_ms = ? where id = ?",
        )
        .run("usr_other", 1002, validId),
    /identity and model are immutable/,
  );

  for (const invalidId of [
    "ship_short",
    `ship_${"A".repeat(32)}`,
    `ship_${"g".repeat(32)}`,
    `probe_${"b".repeat(31)}`,
  ]) {
    assert.throws(
      () =>
        insertSpacecraft.run(
          invalidId,
          "usr_other",
          "Invalid identifier",
          "prop_concept_fusion_0_1c_v1",
          durableAppearance,
          1000,
          1000,
        ),
      /spacecraft identity/,
    );
  }

  for (const invalidName of [
    "",
    " padded",
    "padded ",
    "line\nbreak",
    `hidden${String.fromCodePoint(0x061c)}mark`,
    `hidden${String.fromCodePoint(0x202e)}direction`,
    "x".repeat(81),
  ]) {
    assert.throws(
      () =>
        insertSpacecraft.run(
          `ship_${"b".repeat(32)}`,
          "usr_other",
          invalidName,
          "prop_concept_fusion_0_1c_v1",
          durableAppearance,
          1000,
          1000,
        ),
      /spacecraft display name/,
    );
  }

  const invalidAppearances = [
    "{}",
    JSON.stringify({ ...JSON.parse(durableAppearance), hullPreset: "unknown" }),
    JSON.stringify({ ...JSON.parse(durableAppearance), extra: true }),
    JSON.stringify(JSON.parse(durableAppearance), null, 2),
    `{${" ".repeat(2050)}}`,
  ];
  for (const invalidAppearance of invalidAppearances) {
    assert.throws(
      () =>
        insertSpacecraft.run(
          `ship_${"b".repeat(32)}`,
          "usr_other",
          "Invalid appearance",
          "prop_concept_fusion_0_1c_v1",
          invalidAppearance,
          1000,
          1000,
        ),
      /spacecraft appearance/,
    );
  }

  assert.throws(
    () =>
      insertSpacecraft.run(
        `ship_${"b".repeat(32)}`,
        "usr_other",
        "Unknown engine",
        "prop_fixture",
        durableAppearance,
        1000,
        1000,
      ),
    /spacecraft propulsion model/,
  );
  assert.throws(
    () =>
      insertSpacecraft.run(
        `ship_${"b".repeat(32)}`,
        "usr_other",
        "Bad chronology",
        "prop_concept_fusion_0_1c_v1",
        durableAppearance,
        1001,
        1000,
      ),
    /spacecraft timestamps/,
  );

  for (let ordinal = 0; ordinal < 24; ordinal += 1) {
    insertSpacecraft.run(
      `ship_${ordinal.toString(16).padStart(32, "0")}`,
      "usr_quota",
      `Concept ${ordinal + 1}`,
      ordinal % 2 === 0
        ? "prop_concept_fusion_0_1c_v1"
        : "prop_concept_warp_fiction_v1",
      durableAppearance,
      1000 + ordinal,
      1000 + ordinal,
    );
  }
  assert.throws(
    () =>
      insertSpacecraft.run(
        `ship_${"f".repeat(32)}`,
        "usr_quota",
        "Concept 25",
        "prop_concept_fusion_0_1c_v1",
        durableAppearance,
        2000,
        2000,
      ),
    /owner quota exceeded/,
  );
});

test("D1 identity, JSON, and release constraints fail closed", async () => {
  const database = await applyFoundationMigration();
  for (const [ordinal, invalidReleaseId] of [
    "rel_",
    "rel_x",
    "rel_BAD.UPPER",
    "rel_bad.dot",
    "rel_-abcde",
    `rel_a${"b".repeat(127)}`,
  ].entries()) {
    assert.throws(
      () =>
        database
          .prepare(
            `insert into content_releases(
              id, version, schema_version, state, manifest_r2_key, manifest_sha256
            ) values (?, ?, '0.1.0', 'draft', ?, ?)`,
          )
          .run(
            invalidReleaseId,
            `invalid-release-${ordinal}`,
            `release-manifests/invalid-${ordinal}.json`,
            "a".repeat(64),
          ),
      /ck_content_release_id/,
    );
  }
  assert.doesNotThrow(() =>
    database
      .prepare(
        `insert into content_releases(
          id, version, schema_version, state, manifest_r2_key, manifest_sha256
        ) values ('rel_valid-id', 'valid-release-id', '0.1.0', 'draft',
          'release-manifests/valid-id.json', ?)`,
      )
      .run("a".repeat(64)),
  );
  assert.throws(
    () => database.exec("insert into app_users(id, display_name) values ('raw-email@example.com', 'Bad')"),
    /ck_app_users_id/,
  );

  database.exec("insert into app_users(id, display_name) values ('usr_fixture', 'Fixture')");
  assert.throws(
    () =>
      database.exec(
        "insert into auth_identities(user_id, provider, subject_hmac) values ('usr_fixture', 'test', 'raw-subject')",
      ),
    /ck_auth_identity_hmac/,
  );
  assert.throws(
    () =>
      database
        .prepare(
          "insert into auth_identities(user_id, provider, key_version, subject_hmac) values (?, ?, ?, ?)",
        )
        .run("usr_fixture", "test", "bad version", "a".repeat(64)),
    /ck_auth_identity_key_version/,
  );
  assert.throws(
    () =>
      database
        .prepare(
          "insert into auth_identities(user_id, provider, key_version, subject_hmac) values (?, ?, ?, ?)",
        )
        .run("usr_fixture", "test", "v1", "A".repeat(64)),
    /ck_auth_identity_hmac/,
  );
  assert.throws(
    () =>
      database.exec(
        "insert into bookmarks(id, user_id, entity_id, navigation_target_id, release_id, label, scene_json) values ('bmk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'usr_fixture', 'mars', 'mars', 'rel_landing_atlas_v0_1_0', 'Mars', '{bad json}')",
      ),
    /invalid saved place scene|ck_bookmark_scene_json/,
  );
  assert.throws(
    () =>
      database.exec(
        "insert into content_releases(id, version, schema_version, state, manifest_r2_key, manifest_sha256) values ('rel_bad001', 'bad', '0.1.0', 'draft', 'manifests/bad.json', 'short')",
      ),
    /ck_content_release_hash/,
  );
  assert.throws(
    () =>
      database
        .prepare(
          "insert into content_releases(id, version, schema_version, state, manifest_r2_key, manifest_sha256) values (?, ?, '0.1.0', 'draft', ?, ?)",
        )
        .run("rel_nonhex", "nonhex", "manifests/nonhex.json", "x".repeat(64)),
    /ck_content_release_hash/,
  );
  assert.throws(
    () =>
      database.exec(
        "insert into saved_routes(id, user_id, title, travel_mode, release_id, origin_target_id, destination_target_id, assumptions_json) values ('route_orphan', 'usr_fixture', 'Orphan', 'instant', 'rel_missing', 'mars', 'jezero', '{}')",
      ),
    /FOREIGN KEY constraint failed/,
  );
});

test("D1 publication guards keep active and published releases immutable", async () => {
  const database = await applyFoundationMigration();
  const validHash = "a".repeat(64);
  database
    .prepare(
      "insert into content_releases(id, version, schema_version, state, manifest_r2_key, manifest_sha256) values (?, ?, '0.1.0', 'draft', ?, ?)",
    )
    .run("rel_draft01", "draft-v1", "manifests/draft.json", validHash);

  assert.throws(
    () =>
      database.exec(
        "insert into active_release_channels(channel, release_id) values ('invalid', 'rel_draft01')",
      ),
    /requires a published release/,
  );
  assert.throws(
    () =>
      database.exec(
        "update content_releases set manifest_sha256 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' where id = 'rel_landing_atlas_v0_1_0'",
      ),
    /published release payload is immutable/,
  );
  assert.throws(
    () =>
      database.exec(
        "update content_releases set state = 'withdrawn' where id = 'rel_landing_atlas_v0_1_0'",
      ),
    /active release must be replaced/,
  );
  assert.throws(
    () =>
      database.exec(
        "update content_releases set state = 'published', published_at_ms = 1 where id = 'rel_draft01'",
      ),
    /invalid content release state transition/,
  );
});

test("D1 route constraints reject cross-route waypoints and foreign spacecraft", async () => {
  const database = await applyFoundationMigration();
  const shipBId = `ship_${"b".repeat(32)}`;
  database.exec(`
    insert into app_users(id, display_name) values ('usr_a', 'A');
    insert into app_users(id, display_name) values ('usr_b', 'B');
    insert into user_spacecraft(
      id, user_id, display_name, propulsion_model_id, cosmetics_json,
      created_at_ms, updated_at_ms
    ) values (
      '${shipBId}', 'usr_b', 'B ship', 'prop_concept_fusion_0_1c_v1',
      '${durableAppearance}', 1000, 1000
    );
    insert into saved_routes(
      id, user_id, title, travel_mode, release_id, origin_target_id,
      destination_target_id, assumptions_json
    ) values (
      'route_a', 'usr_a', 'A route', 'light', 'rel_landing_atlas_v0_1_0',
      'solar-system', 'mars', '{}'
    );
    insert into saved_routes(
      id, user_id, title, travel_mode, release_id, origin_target_id,
      destination_target_id, assumptions_json
    ) values (
      'route_b', 'usr_b', 'B route', 'light', 'rel_landing_atlas_v0_1_0',
      'solar-system', 'mars', '{}'
    );
    insert into route_waypoints(id, route_id, ordinal, navigation_target_id)
      values ('way_a0', 'route_a', 0, 'solar-system');
    insert into route_waypoints(id, route_id, ordinal, navigation_target_id)
      values ('way_a1', 'route_a', 1, 'mars');
    insert into route_waypoints(id, route_id, ordinal, navigation_target_id)
      values ('way_b0', 'route_b', 0, 'solar-system');
    insert into route_waypoints(id, route_id, ordinal, navigation_target_id)
      values ('way_b1', 'route_b', 1, 'mars');
  `);

  assert.throws(
    () =>
      database.exec(`
        insert into route_legs(
          id, route_id, ordinal, from_waypoint_id, to_waypoint_id,
          distance_definition, assumptions_json, result_state
        ) values (
          'leg_cross', 'route_a', 0, 'way_b0', 'way_b1',
          'euclidean', '{}', 'comparison-estimate'
        )
      `),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () =>
      database
        .prepare("update saved_routes set spacecraft_id = ? where id = 'route_a'")
        .run(shipBId),
    /spacecraft must belong to the route owner/,
  );
  assert.doesNotThrow(() =>
    database
      .prepare("update saved_routes set spacecraft_id = ? where id = 'route_b'")
      .run(shipBId),
  );
  assert.doesNotThrow(() =>
    database.prepare("delete from user_spacecraft where id = ?").run(shipBId),
  );
  assert.deepEqual(
    {
      ...database
        .prepare("select id, spacecraft_id from saved_routes where id = 'route_b'")
        .get(),
    },
    { id: "route_b", spacecraft_id: null },
  );
});
