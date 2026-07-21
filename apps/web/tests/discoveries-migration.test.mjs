import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationRoot = new URL("../drizzle/", import.meta.url);
const releaseId = "rel_landing_atlas_v0_1_0";
const maximumDateTimestampMs = 8_640_000_000_000_000;
const entityIds = [
  "observable-universe",
  "laniakea",
  "local-group",
  "andromeda",
  "milky-way",
  "sagittarius-a-star",
  "proxima-centauri",
  "trappist-1",
  "solar-system",
  "mars",
  "jezero",
  "apollo-17",
  "voyager-1",
  "jwst-deep-fields",
  "earth-exploration-network",
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

async function migratedDatabase({ through } = {}) {
  const database = new DatabaseSync(":memory:");
  for (const name of await migrationFiles()) {
    await applyMigrationFile(database, name);
    if (name === through) break;
  }
  return database;
}

function seedOwners(database) {
  database.exec(`
    insert into app_users(id, display_name) values ('usr_owner', 'Owner');
    insert into app_users(id, display_name) values ('usr_other', 'Other');
    insert into app_users(id, display_name) values ('usr_boundary', 'Boundary');
  `);
}

test("recorded encounter migration admits only exact manual foundation records", async () => {
  const database = await migratedDatabase();
  seedOwners(database);
  const insert = database.prepare(
    `insert into user_discoveries(
       user_id, entity_id, first_seen_at_ms, last_seen_at_ms, visit_count,
       discovery_method, release_id
     ) values (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const [index, entityId] of entityIds.entries()) {
    assert.doesNotThrow(() =>
      insert.run(
        "usr_owner",
        entityId,
        1_000 + index,
        1_000 + index,
        1,
        "manual-atlas-record",
        releaseId,
      ),
    );
  }
  assert.doesNotThrow(() =>
    insert.run(
      "usr_boundary",
      "mars",
      maximumDateTimestampMs,
      maximumDateTimestampMs,
      1,
      "manual-atlas-record",
      releaseId,
    ),
  );
  for (const invalid of [
    ["usr_other", "earth", 1_000, 1_000, 1, "manual-atlas-record", releaseId],
    ["usr_other", "mars", 1_000, 1_000, 1, "passive-navigation", releaseId],
    ["usr_other", "mars", 1_000, 1_000, 1, "manual-atlas-record", "rel_future"],
    ["usr_other", "mars", 0, 1_000, 1, "manual-atlas-record", releaseId],
    ["usr_other", "mars", 1_001, 1_000, 1, "manual-atlas-record", releaseId],
    [
      "usr_other",
      "mars",
      maximumDateTimestampMs + 1,
      maximumDateTimestampMs + 1,
      1,
      "manual-atlas-record",
      releaseId,
    ],
    ["usr_other", "mars", 1_000, 1_000, 2, "manual-atlas-record", releaseId],
  ]) {
    assert.throws(() => insert.run(...invalid), /recorded encounter/);
  }
});

test("recorded encounter update increments exactly once and keeps identity immutable", async () => {
  const database = await migratedDatabase();
  seedOwners(database);
  database.exec(`
    insert into user_discoveries(
      user_id, entity_id, first_seen_at_ms, last_seen_at_ms, visit_count,
      discovery_method, release_id
    ) values (
      'usr_owner', 'mars', 1000, 1000, 1,
      'manual-atlas-record', '${releaseId}'
    );
  `);
  assert.doesNotThrow(() =>
    database.exec(
      "update user_discoveries set last_seen_at_ms = 1001, visit_count = 2 where user_id = 'usr_owner' and entity_id = 'mars'",
    ),
  );
  for (const statement of [
    "update user_discoveries set last_seen_at_ms = 1002, visit_count = 4 where user_id = 'usr_owner' and entity_id = 'mars'",
    "update user_discoveries set last_seen_at_ms = 1001, visit_count = 3 where user_id = 'usr_owner' and entity_id = 'mars'",
    `update user_discoveries set last_seen_at_ms = ${maximumDateTimestampMs + 1}, visit_count = 3 where user_id = 'usr_owner' and entity_id = 'mars'`,
    "update user_discoveries set first_seen_at_ms = 999, last_seen_at_ms = 1002, visit_count = 3 where user_id = 'usr_owner' and entity_id = 'mars'",
    "update user_discoveries set discovery_method = 'passive-navigation', last_seen_at_ms = 1002, visit_count = 3 where user_id = 'usr_owner' and entity_id = 'mars'",
    "update user_discoveries set release_id = 'rel_future', last_seen_at_ms = 1002, visit_count = 3 where user_id = 'usr_owner' and entity_id = 'mars'",
    "update user_discoveries set user_id = 'usr_other', last_seen_at_ms = 1002, visit_count = 3 where user_id = 'usr_owner' and entity_id = 'mars'",
  ]) {
    assert.throws(() => database.exec(statement), /recorded encounter/);
  }
});

test("recorded encounter insert guard blocks OR REPLACE resets", async () => {
  const database = await migratedDatabase();
  seedOwners(database);
  database.exec(`
    insert into user_discoveries(
      user_id, entity_id, first_seen_at_ms, last_seen_at_ms, visit_count,
      discovery_method, release_id
    ) values (
      'usr_owner', 'mars', 1000, 1000, 1,
      'manual-atlas-record', '${releaseId}'
    );
    update user_discoveries
      set last_seen_at_ms = 1001, visit_count = 2
      where user_id = 'usr_owner' and entity_id = 'mars';
  `);
  assert.throws(
    () =>
      database.exec(`
        insert or replace into user_discoveries(
          user_id, entity_id, first_seen_at_ms, last_seen_at_ms, visit_count,
          discovery_method, release_id
        ) values (
          'usr_owner', 'mars', 2000, 2000, 1,
          'manual-atlas-record', '${releaseId}'
        )
      `),
    /recorded encounter already exists/,
  );
  assert.deepEqual(
    {
      ...database
        .prepare(
          "select first_seen_at_ms, last_seen_at_ms, visit_count from user_discoveries where user_id = 'usr_owner' and entity_id = 'mars'",
        )
        .get(),
    },
    { first_seen_at_ms: 1000, last_seen_at_ms: 1001, visit_count: 2 },
  );
});

test("recorded encounter migration caps an owner at 200 legacy rows", async () => {
  const database = await migratedDatabase({ through: "0001_durable_spacecraft_v1.sql" });
  database.exec("insert into app_users(id, display_name) values ('usr_quota', 'Quota')");
  const insertLegacy = database.prepare(
    `insert into user_discoveries(
       user_id, entity_id, first_seen_at_ms, last_seen_at_ms, visit_count,
       discovery_method, release_id
     ) values ('usr_quota', ?, 1, 1, 1, 'legacy', ?)`,
  );
  for (let index = 0; index < 200; index += 1) {
    insertLegacy.run(`legacy-${index}`, releaseId);
  }
  await applyMigrationFile(database, "0002_private_recorded_encounters_v1.sql");
  assert.throws(
    () =>
      database
        .prepare(
          `insert into user_discoveries(
             user_id, entity_id, first_seen_at_ms, last_seen_at_ms, visit_count,
             discovery_method, release_id
           ) values ('usr_quota', 'mars', 2, 2, 1, 'manual-atlas-record', ?)`,
        )
        .run(releaseId),
    /owner quota exceeded/,
  );
});
