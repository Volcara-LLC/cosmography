import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationRoot = new URL("../drizzle/", import.meta.url);
const scopeEntityId = "tour_seven_scales_to_jezero_v1";
const metricCode = "manual-resume-point-v1";
const releaseId = "rel_landing_atlas_v0_1_0";
const timestampMax = 8_640_000_000_000_000;
const mappings = [
  [1, "scale-observable-universe", "observable-universe"],
  [2, "scale-laniakea", "laniakea"],
  [3, "scale-local-group", "local-group"],
  [4, "scale-milky-way", "milky-way"],
  [5, "scale-solar-system", "solar-system"],
  [6, "scale-mars", "mars"],
  [7, "scale-jezero", "jezero"],
];

async function migrationFiles() {
  return (await readdir(migrationRoot))
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

async function applyMigrationFile(database, name) {
  const migration = await readFile(new URL(name, migrationRoot), "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) database.exec(statement);
  }
}

async function migrationStatementContaining(name, fragment) {
  const migration = await readFile(new URL(name, migrationRoot), "utf8");
  const statement = migration
    .split("--> statement-breakpoint")
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.includes(fragment));
  assert.ok(statement, `Expected ${name} to contain ${fragment}`);
  return statement;
}

async function migratedDatabase({ through } = {}) {
  const database = new DatabaseSync(":memory:");
  for (const name of await migrationFiles()) {
    await applyMigrationFile(database, name);
    if (name === through) break;
  }
  return database;
}

function seedOwners(database, count = 9) {
  const insert = database.prepare(
    "insert into app_users(id, display_name) values (?, ?)",
  );
  for (let index = 1; index <= count; index += 1) {
    insert.run(`usr_owner_${index}`, `Owner ${index}`);
  }
}

function storedResume(ordinal, savedAtMs) {
  const mapping = mappings[ordinal - 1];
  if (!mapping) throw new Error("unknown test ordinal");
  const [, stopId, targetEntityId] = mapping;
  return JSON.stringify({
    schemaId: "cosmography.user-tour-resume",
    schemaVersion: "1.0.0",
    tourId: scopeEntityId,
    tourSlug: "seven-scales-to-jezero",
    releaseId,
    resumeOrdinal: ordinal,
    stopId,
    targetEntityId,
    savedAtMs,
    method: "manual-save-resume-point",
    truth: {
      userConfirmed: true,
      passiveNavigation: false,
      resumeStateOnly: true,
      storedStateDefinesTour: false,
      completionClaim: false,
      achievementClaim: false,
      scientificDiscoveryClaim: false,
    },
  });
}

function targetInsert(database) {
  return database.prepare(
    `insert into user_progress(
       user_id, scope_entity_id, metric_code, value_numeric, value_json, updated_at_ms
     ) values (?, ?, ?, ?, ?, ?)`,
  );
}

test("migration preserves the exact bytes of migrations 0000 through 0002", async () => {
  const expected = new Map([
    ["0000_lame_spot.sql", "ddf63b1f67766cda24ae6faac6c60ecd3f408f5ab76744d4d2e13cf2193ef442"],
    ["0001_durable_spacecraft_v1.sql", "4da865c631f9d75661f0a124a4a3124dbea95dabf1c516c28cdd721f3c500027"],
    ["0002_private_recorded_encounters_v1.sql", "5b45866a3a5bda52065872ad13d46bf5eeb7468a53da9aeb591c624cd6269d40"],
  ]);
  for (const [name, digest] of expected) {
    const bytes = await readFile(new URL(name, migrationRoot));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), digest);
  }
});

test("migration preflight aborts rather than silently adopting an existing target tuple", async () => {
  const database = await migratedDatabase({
    through: "0002_private_recorded_encounters_v1.sql",
  });
  seedOwners(database, 1);
  database
    .prepare(
      `insert into user_progress(
         user_id, scope_entity_id, metric_code, value_numeric, value_json, updated_at_ms
       ) values ('usr_owner_1', ?, ?, 99, '{"legacy":true}', 1000)`,
    )
    .run(scopeEntityId, metricCode);
  await assert.rejects(
    () => applyMigrationFile(database, "0003_private_tour_resume_v1.sql"),
    /existing Seven Scales resume point requires review/,
  );
  assert.deepEqual(
    {
      ...database
        .prepare(
          "select value_numeric, value_json, updated_at_ms from user_progress where user_id = 'usr_owner_1'",
        )
        .get(),
    },
    { value_numeric: 99, value_json: '{"legacy":true}', updated_at_ms: 1000 },
  );
});

test("migration admits exactly the seven canonical resume mappings", async () => {
  const database = await migratedDatabase();
  seedOwners(database);
  const insert = targetInsert(database);
  for (const [index, [ordinal]] of mappings.entries()) {
    const savedAtMs = 1_000 + ordinal;
    assert.doesNotThrow(() =>
      insert.run(
        `usr_owner_${index + 1}`,
        scopeEntityId,
        metricCode,
        ordinal,
        storedResume(ordinal, savedAtMs),
        savedAtMs,
      ),
    );
  }
  assert.doesNotThrow(() =>
    insert.run(
      "usr_owner_8",
      scopeEntityId,
      metricCode,
      7,
      storedResume(7, timestampMax),
      timestampMax,
    ),
  );
});

test("insert trigger rejects noncanonical JSON, type drift, false claims, and bad bounds", async () => {
  const database = await migratedDatabase();
  seedOwners(database);
  const insert = targetInsert(database);
  const canonical = JSON.parse(storedResume(6, 1_000));
  const truth = canonical.truth;
  const invalid = [
    [null, storedResume(6, 1_000), 1_000],
    [0, storedResume(6, 1_000), 1_000],
    [8, storedResume(6, 1_000), 1_000],
    [1.5, storedResume(6, 1_000), 1_000],
    [6, null, 1_000],
    [6, "{", 1_000],
    [6, ` ${storedResume(6, 1_000)}`, 1_000],
    [6, JSON.stringify({ ...canonical, extra: true }), 1_000],
    [6, JSON.stringify({ ...canonical, schemaVersion: "2.0.0" }), 1_000],
    [6, JSON.stringify({ ...canonical, releaseId: "rel_future" }), 1_000],
    [6, JSON.stringify({ ...canonical, resumeOrdinal: 5 }), 1_000],
    [6, JSON.stringify({ ...canonical, stopId: "scale-jezero" }), 1_000],
    [6, JSON.stringify({ ...canonical, targetEntityId: "jezero" }), 1_000],
    [6, JSON.stringify({ ...canonical, savedAtMs: 1_001 }), 1_000],
    [6, JSON.stringify({ ...canonical, method: "passive-navigation" }), 1_000],
    [6, JSON.stringify({ ...canonical, truth: { ...truth, userConfirmed: false } }), 1_000],
    [6, JSON.stringify({ ...canonical, truth: { ...truth, passiveNavigation: true } }), 1_000],
    [6, JSON.stringify({ ...canonical, truth: { ...truth, resumeStateOnly: false } }), 1_000],
    [6, JSON.stringify({ ...canonical, truth: { ...truth, storedStateDefinesTour: true } }), 1_000],
    [6, JSON.stringify({ ...canonical, truth: { ...truth, completionClaim: true } }), 1_000],
    [6, JSON.stringify({ ...canonical, truth: { ...truth, achievementClaim: true } }), 1_000],
    [6, JSON.stringify({ ...canonical, truth: { ...truth, scientificDiscoveryClaim: true } }), 1_000],
    [6, storedResume(6, 1_000), 0],
    [6, storedResume(6, timestampMax + 1), timestampMax + 1],
  ];
  for (const [index, [ordinal, valueJson, updatedAtMs]] of invalid.entries()) {
    assert.throws(
      () =>
        insert.run(
          `usr_owner_${(index % 9) + 1}`,
          scopeEntityId,
          metricCode,
          ordinal,
          valueJson,
          updatedAtMs,
        ),
      /Seven Scales resume|NOT NULL/,
    );
  }
  assert.equal(
    database
      .prepare(
        "select count(*) as count from user_progress where scope_entity_id = ? and metric_code = ?",
      )
      .get(scopeEntityId, metricCode).count,
    0,
  );
});

test("update is CAS-compatible, monotonic, identity-safe, and permits moving backward", async () => {
  const database = await migratedDatabase();
  seedOwners(database, 2);
  targetInsert(database).run(
    "usr_owner_1",
    scopeEntityId,
    metricCode,
    6,
    storedResume(6, 1_000),
    1_000,
  );
  assert.doesNotThrow(() =>
    database
      .prepare(
        `update user_progress
         set value_numeric = 2, value_json = ?, updated_at_ms = 1001
         where user_id = 'usr_owner_1' and scope_entity_id = ? and metric_code = ?`,
      )
      .run(storedResume(2, 1_001), scopeEntityId, metricCode),
  );
  for (const statement of [
    `update user_progress set updated_at_ms = 1001 where user_id = 'usr_owner_1' and scope_entity_id = '${scopeEntityId}' and metric_code = '${metricCode}'`,
    `update user_progress set updated_at_ms = 1000 where user_id = 'usr_owner_1' and scope_entity_id = '${scopeEntityId}' and metric_code = '${metricCode}'`,
    `update user_progress set value_json = '${storedResume(2, timestampMax + 1).replaceAll("'", "''")}', updated_at_ms = ${timestampMax + 1} where user_id = 'usr_owner_1' and scope_entity_id = '${scopeEntityId}' and metric_code = '${metricCode}'`,
    `update user_progress set value_numeric = 7, value_json = '${storedResume(7, 1_003).replaceAll("'", "''")}', updated_at_ms = 1002 where user_id = 'usr_owner_1' and scope_entity_id = '${scopeEntityId}' and metric_code = '${metricCode}'`,
    `update user_progress set user_id = 'usr_owner_2', value_json = '${storedResume(2, 1_002).replaceAll("'", "''")}', updated_at_ms = 1002 where user_id = 'usr_owner_1' and scope_entity_id = '${scopeEntityId}' and metric_code = '${metricCode}'`,
    `update user_progress set scope_entity_id = 'tour_other', value_json = '${storedResume(2, 1_002).replaceAll("'", "''")}', updated_at_ms = 1002 where user_id = 'usr_owner_1' and scope_entity_id = '${scopeEntityId}' and metric_code = '${metricCode}'`,
    `update user_progress set metric_code = 'other', value_json = '${storedResume(2, 1_002).replaceAll("'", "''")}', updated_at_ms = 1002 where user_id = 'usr_owner_1' and scope_entity_id = '${scopeEntityId}' and metric_code = '${metricCode}'`,
  ]) {
    assert.throws(() => database.exec(statement), /Seven Scales resume/);
  }
  assert.deepEqual(
    {
      ...database
        .prepare(
          "select value_numeric, value_json, updated_at_ms from user_progress where user_id = 'usr_owner_1' and scope_entity_id = ? and metric_code = ?",
        )
        .get(scopeEntityId, metricCode),
    },
    {
      value_numeric: 2,
      value_json: storedResume(2, 1_001),
      updated_at_ms: 1_001,
    },
  );
  assert.doesNotThrow(() =>
    database
      .prepare(
        `update user_progress
         set value_json = ?, updated_at_ms = ?
         where user_id = 'usr_owner_1' and scope_entity_id = ? and metric_code = ?`,
      )
      .run(
        storedResume(2, timestampMax),
        timestampMax,
        scopeEntityId,
        metricCode,
      ),
  );
});

test("OR REPLACE and upsert cannot reset a saved resume point", async () => {
  const database = await migratedDatabase();
  seedOwners(database, 1);
  targetInsert(database).run(
    "usr_owner_1",
    scopeEntityId,
    metricCode,
    6,
    storedResume(6, 1_000),
    1_000,
  );
  for (const statement of [
    `insert or replace into user_progress(user_id, scope_entity_id, metric_code, value_numeric, value_json, updated_at_ms)
     values ('usr_owner_1', '${scopeEntityId}', '${metricCode}', 1, '${storedResume(1, 2_000).replaceAll("'", "''")}', 2000)`,
    `insert into user_progress(user_id, scope_entity_id, metric_code, value_numeric, value_json, updated_at_ms)
     values ('usr_owner_1', '${scopeEntityId}', '${metricCode}', 1, '${storedResume(1, 2_000).replaceAll("'", "''")}', 2000)
     on conflict(user_id, scope_entity_id, metric_code) do update set
       value_numeric = excluded.value_numeric,
       value_json = excluded.value_json,
       updated_at_ms = excluded.updated_at_ms`,
  ]) {
    assert.throws(() => database.exec(statement), /already exists/);
  }
  assert.equal(
    database
      .prepare(
        "select value_numeric from user_progress where user_id = 'usr_owner_1' and scope_entity_id = ? and metric_code = ?",
      )
      .get(scopeEntityId, metricCode).value_numeric,
    6,
  );
});

test("update trigger refuses to heal a drifted retained-timestamp row", async () => {
  const database = await migratedDatabase();
  seedOwners(database, 1);
  targetInsert(database).run(
    "usr_owner_1",
    scopeEntityId,
    metricCode,
    6,
    storedResume(6, 1_000),
    1_000,
  );
  database.exec("drop trigger trg_user_progress_tour_resume_update");
  database.exec(`
    update user_progress
    set value_json = json_set(
      value_json,
      '$.truth.completionClaim',
      json('true')
    )
    where user_id = 'usr_owner_1'
      and scope_entity_id = '${scopeEntityId}'
      and metric_code = '${metricCode}';
  `);
  const tampered = {
    ...database
      .prepare(
        "select value_numeric, value_json, updated_at_ms from user_progress where user_id = 'usr_owner_1' and scope_entity_id = ? and metric_code = ?",
      )
      .get(scopeEntityId, metricCode),
  };
  assert.equal(tampered.updated_at_ms, 1_000);
  assert.equal(JSON.parse(tampered.value_json).truth.completionClaim, true);

  database.exec(
    await migrationStatementContaining(
      "0003_private_tour_resume_v1.sql",
      "CREATE TRIGGER `trg_user_progress_tour_resume_update`",
    ),
  );
  assert.throws(
    () =>
      database
        .prepare(
          `update user_progress
           set value_numeric = 7, value_json = ?, updated_at_ms = 1001
           where user_id = 'usr_owner_1' and scope_entity_id = ? and metric_code = ?`,
        )
        .run(storedResume(7, 1_001), scopeEntityId, metricCode),
    /stored Seven Scales resume contract has drifted/,
  );
  assert.deepEqual(
    {
      ...database
        .prepare(
          "select value_numeric, value_json, updated_at_ms from user_progress where user_id = 'usr_owner_1' and scope_entity_id = ? and metric_code = ?",
        )
        .get(scopeEntityId, metricCode),
    },
    tampered,
  );
  assert.doesNotThrow(() =>
    database
      .prepare(
        "delete from user_progress where user_id = 'usr_owner_1' and scope_entity_id = ? and metric_code = ?",
      )
      .run(scopeEntityId, metricCode),
  );
});

test("unrelated progress remains unconstrained and exact resume deletion is allowed", async () => {
  const database = await migratedDatabase();
  seedOwners(database, 1);
  assert.doesNotThrow(() =>
    database.exec(`
      insert into user_progress(
        user_id, scope_entity_id, metric_code, value_numeric, value_json, updated_at_ms
      ) values ('usr_owner_1', 'other-scope', 'legacy-progress', 99, '{"legacy":true}', 0);
      update user_progress
        set value_numeric = -4, value_json = '{"changed":true}', updated_at_ms = -1
        where user_id = 'usr_owner_1' and scope_entity_id = 'other-scope';
    `),
  );
  targetInsert(database).run(
    "usr_owner_1",
    scopeEntityId,
    metricCode,
    7,
    storedResume(7, 1_000),
    1_000,
  );
  assert.doesNotThrow(() =>
    database
      .prepare(
        "delete from user_progress where user_id = 'usr_owner_1' and scope_entity_id = ? and metric_code = ?",
      )
      .run(scopeEntityId, metricCode),
  );
  assert.equal(
    database.prepare("select count(*) as count from user_progress").get().count,
    1,
  );
});
