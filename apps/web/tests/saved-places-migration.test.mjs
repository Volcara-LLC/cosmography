import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationRoot = new URL("../drizzle/", import.meta.url);
const releaseId = "rel_landing_atlas_v0_1_0";
const identities = [
  ["observable-universe", "Known Universe", "lightcone"],
  ["laniakea", "Laniakea", "extragalactic"],
  ["local-group", "Local Group", "extragalactic"],
  ["andromeda", "Andromeda Galaxy", "extragalactic"],
  ["milky-way", "Milky Way", "galactic"],
  ["sagittarius-a-star", "Sagittarius A*", "simulation"],
  ["proxima-centauri", "Proxima Centauri", "galactic"],
  ["trappist-1", "TRAPPIST-1", "system"],
  ["solar-system", "Solar System", "system"],
  ["mars", "Mars", "globe"],
  ["jezero", "Jezero Crater", "surface"],
  ["apollo-17", "Apollo 17 · Taurus–Littrow", "surface"],
  ["voyager-1", "Voyager 1", "system"],
  ["jwst-deep-fields", "Webb Deep Fields", "lightcone"],
  ["earth-exploration-network", "Earth Exploration Network", "globe"],
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

function seedOwners(database, count = 18) {
  const insert = database.prepare(
    "insert into app_users(id, display_name) values (?, ?)",
  );
  for (let index = 1; index <= count; index += 1) {
    insert.run(`usr_saved_${index}`, `Saved owner ${index}`);
  }
}

function bookmarkId(index) {
  return `bmk_${index.toString(16).padStart(32, "0")}`;
}

function storedJson(entityId, domain, appearance, savedAtMs) {
  return JSON.stringify({
    schemaId: "cosmography.user-saved-places",
    schemaVersion: "1.0.0",
    entityId,
    domain,
    focusId: entityId,
    appearance,
    timelineYear: 2026,
    releaseId,
    savedAtMs,
    method: "manual-save-place",
    truth: {
      userConfirmed: true,
      passiveNavigation: false,
      navigationAidOnly: true,
      physicalCameraPose: false,
      observationClaim: false,
      encounterClaim: false,
      routeClaim: false,
      progressClaim: false,
      completionClaim: false,
      masteryClaim: false,
      achievementClaim: false,
      scientificDiscoveryClaim: false,
      shared: false,
    },
  });
}

function insertSavedPlace(database) {
  return database.prepare(
    `insert into bookmarks(
       id, user_id, entity_id, navigation_target_id, release_id, label,
       scene_json, scene_r2_key, created_at_ms
     ) values (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  );
}

test("saved-place migration preserves the exact bytes of migrations 0000 through 0003", async () => {
  const expected = new Map([
    ["0000_lame_spot.sql", "ddf63b1f67766cda24ae6faac6c60ecd3f408f5ab76744d4d2e13cf2193ef442"],
    ["0001_durable_spacecraft_v1.sql", "4da865c631f9d75661f0a124a4a3124dbea95dabf1c516c28cdd721f3c500027"],
    ["0002_private_recorded_encounters_v1.sql", "5b45866a3a5bda52065872ad13d46bf5eeb7468a53da9aeb591c624cd6269d40"],
    ["0003_private_tour_resume_v1.sql", "05d105b783166d606128a50f18ce6fe9e7c7504f5202b899676d0ac9bf66cc73"],
  ]);
  for (const [name, digest] of expected) {
    const bytes = await readFile(new URL(name, migrationRoot));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), digest);
  }
});

test("saved-place migration adopts a pre-existing exact canonical row without changing it", async () => {
  const database = await migratedDatabase({
    through: "0003_private_tour_resume_v1.sql",
  });
  seedOwners(database, 1);
  const sceneJson = storedJson("mars", "globe", "scientific", 1_000);
  insertSavedPlace(database).run(
    bookmarkId(1),
    "usr_saved_1",
    "mars",
    "mars",
    releaseId,
    "Mars",
    sceneJson,
    1_000,
  );
  await assert.doesNotReject(() =>
    applyMigrationFile(database, "0004_private_saved_places_v1.sql"),
  );
  assert.deepEqual(
    {
      ...database
        .prepare(
          "select id, contract_version, navigation_target_id, label, scene_json, created_at_ms from bookmarks",
        )
        .get(),
    },
    {
      id: bookmarkId(1),
      contract_version: "1.0.0",
      navigation_target_id: "mars",
      label: "Mars",
      scene_json: sceneJson,
      created_at_ms: 1_000,
    },
  );
});

test("saved-place migration preflight refuses to adopt a loose legacy bookmark", async () => {
  const database = await migratedDatabase({
    through: "0003_private_tour_resume_v1.sql",
  });
  seedOwners(database, 1);
  database
    .prepare(
      `insert into bookmarks(
         id, user_id, entity_id, release_id, label, scene_json, created_at_ms
       ) values (?, 'usr_saved_1', 'mars', ?, 'Return to Mars', '{"appearance":"immersive"}', 1000)`,
    )
    .run(bookmarkId(1), releaseId);
  await assert.rejects(
    () => applyMigrationFile(database, "0004_private_saved_places_v1.sql"),
    /existing saved place requires review/,
  );
  assert.deepEqual(
    {
      ...database
        .prepare(
          "select label, navigation_target_id, scene_json from bookmarks",
        )
        .get(),
    },
    {
      label: "Return to Mars",
      navigation_target_id: null,
      scene_json: '{"appearance":"immersive"}',
    },
  );
});

test("saved-place triggers admit exactly all 15 frozen identities and canonical JSON", async () => {
  const database = await migratedDatabase();
  seedOwners(database);
  const insert = insertSavedPlace(database);
  for (const [index, [entityId, label, domain]] of identities.entries()) {
    const savedAtMs = 1_000 + index;
    assert.doesNotThrow(() =>
      insert.run(
        bookmarkId(index + 1),
        `usr_saved_${index + 1}`,
        entityId,
        entityId,
        releaseId,
        label,
        storedJson(
          entityId,
          domain,
          index % 2 === 0 ? "scientific" : "immersive",
          savedAtMs,
        ),
        savedAtMs,
      ),
    );
  }
  assert.equal(
    database.prepare("select count(*) as count from bookmarks").get().count,
    15,
  );
  assert.equal(
    database
      .prepare(
        "select count(*) as count from bookmarks where contract_version = '1.0.0'",
      )
      .get().count,
    15,
  );
});

test("saved-place insert trigger rejects identity, time, scene, and truth drift", async () => {
  const database = await migratedDatabase();
  seedOwners(database);
  const canonical = JSON.parse(storedJson("mars", "globe", "scientific", 1_000));
  const invalid = [
    ["bmk_short", "mars", "mars", "Mars", storedJson("mars", "globe", "scientific", 1_000), null, 1_000],
    [bookmarkId(2), "earth", "earth", "Earth", storedJson("mars", "globe", "scientific", 1_000), null, 1_000],
    [bookmarkId(3), "mars", "jezero", "Mars", storedJson("mars", "globe", "scientific", 1_000), null, 1_000],
    [bookmarkId(4), "mars", "mars", "Red planet", storedJson("mars", "globe", "scientific", 1_000), null, 1_000],
    [bookmarkId(5), "mars", "mars", "Mars", storedJson("mars", "globe", "scientific", 1_000), "private/scene.json", 1_000],
    [bookmarkId(6), "mars", "mars", "Mars", "{", null, 1_000],
    [bookmarkId(7), "mars", "mars", "Mars", ` ${JSON.stringify(canonical)}`, null, 1_000],
    [bookmarkId(8), "mars", "mars", "Mars", JSON.stringify({ ...canonical, domain: "surface" }), null, 1_000],
    [bookmarkId(9), "mars", "mars", "Mars", JSON.stringify({ ...canonical, savedAtMs: 1_001 }), null, 1_000],
    [bookmarkId(10), "mars", "mars", "Mars", JSON.stringify({ ...canonical, method: "passive-navigation" }), null, 1_000],
    [bookmarkId(11), "mars", "mars", "Mars", JSON.stringify({ ...canonical, truth: { ...canonical.truth, userConfirmed: false } }), null, 1_000],
    [bookmarkId(12), "mars", "mars", "Mars", JSON.stringify({ ...canonical, truth: { ...canonical.truth, physicalCameraPose: true } }), null, 1_000],
    [bookmarkId(13), "mars", "mars", "Mars", storedJson("mars", "globe", "scientific", 0), null, 0],
  ];
  for (const [index, [id, entityId, targetId, label, sceneJson, sceneR2Key, savedAtMs]] of invalid.entries()) {
    assert.throws(
      () =>
        database
          .prepare(
            `insert into bookmarks(
               id, user_id, entity_id, navigation_target_id, release_id, label,
               scene_json, scene_r2_key, created_at_ms
             ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            `usr_saved_${index + 1}`,
            entityId,
            targetId,
            releaseId,
            label,
            sceneJson,
            sceneR2Key,
            savedAtMs,
          ),
      /saved place|NOT NULL/,
    );
  }
  assert.equal(
    database.prepare("select count(*) as count from bookmarks").get().count,
    0,
  );
  assert.throws(
    () =>
      database
        .prepare(
          `insert into bookmarks(
             id, user_id, entity_id, navigation_target_id, release_id, label,
             scene_json, scene_r2_key, created_at_ms
           ) values (?, 'usr_saved_1', 'mars', 'mars', 'rel_future', 'Mars', ?, NULL, 1000)`,
        )
        .run(
          bookmarkId(14),
          storedJson("mars", "globe", "scientific", 1_000),
        ),
    /invalid saved place identity/,
  );
  assert.throws(
    () =>
      database
        .prepare(
          `insert into bookmarks(
             id, contract_version, user_id, entity_id, navigation_target_id,
             release_id, label, scene_json, scene_r2_key, created_at_ms
           ) values (?, '0.9.0', 'usr_saved_1', 'mars', 'mars', ?, 'Mars', ?, NULL, 1000)`,
        )
        .run(
          bookmarkId(15),
          releaseId,
          storedJson("mars", "globe", "scientific", 1_000),
        ),
    /contract_version|saved place/,
  );
});

test("saved-place updates are monotonic, identity-safe, and cannot heal drift", async () => {
  const database = await migratedDatabase();
  seedOwners(database, 2);
  insertSavedPlace(database).run(
    bookmarkId(1),
    "usr_saved_1",
    "mars",
    "mars",
    releaseId,
    "Mars",
    storedJson("mars", "globe", "scientific", 1_000),
    1_000,
  );
  assert.doesNotThrow(() =>
    database
      .prepare(
        "update bookmarks set scene_json = ?, created_at_ms = 1001 where id = ?",
      )
      .run(storedJson("mars", "globe", "immersive", 1_001), bookmarkId(1)),
  );
  for (const statement of [
    `update bookmarks set created_at_ms = 1001 where id = '${bookmarkId(1)}'`,
    `update bookmarks set user_id = 'usr_saved_2', scene_json = '${storedJson("mars", "globe", "immersive", 1_002)}', created_at_ms = 1002 where id = '${bookmarkId(1)}'`,
    `update bookmarks set entity_id = 'jezero', navigation_target_id = 'jezero', label = 'Jezero Crater', scene_json = '${storedJson("jezero", "surface", "immersive", 1_002)}', created_at_ms = 1002 where id = '${bookmarkId(1)}'`,
  ]) {
    assert.throws(() => database.exec(statement), /saved place/);
  }

  database.exec("drop trigger trg_bookmarks_saved_place_update");
  database
    .prepare("update bookmarks set scene_json = ? where id = ?")
    .run(storedJson("mars", "surface", "immersive", 1_001), bookmarkId(1));
  const updateTrigger = (await readFile(
    new URL("0004_private_saved_places_v1.sql", migrationRoot),
    "utf8",
  ))
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .find((statement) =>
      statement.includes("CREATE TRIGGER `trg_bookmarks_saved_place_update`"),
    );
  assert.ok(updateTrigger);
  database.exec(updateTrigger);
  assert.throws(
    () =>
      database
        .prepare(
          "update bookmarks set scene_json = ?, created_at_ms = 1002 where id = ?",
        )
        .run(storedJson("mars", "globe", "scientific", 1_002), bookmarkId(1)),
    /stored saved place contract has drifted/,
  );
});

test("insert guard blocks same-tuple and cross-owner ID replacement while delete remains explicit", async () => {
  const database = await migratedDatabase();
  seedOwners(database, 2);
  const victimId = bookmarkId(1);
  insertSavedPlace(database).run(
    victimId,
    "usr_saved_1",
    "mars",
    "mars",
    releaseId,
    "Mars",
    storedJson("mars", "globe", "scientific", 1_000),
    1_000,
  );
  for (const replacement of [
    [victimId, "usr_saved_1", "mars", "mars", "Mars", storedJson("mars", "globe", "immersive", 2_000)],
    [victimId, "usr_saved_2", "jezero", "jezero", "Jezero Crater", storedJson("jezero", "surface", "scientific", 2_000)],
  ]) {
    assert.throws(
      () =>
        database
          .prepare(
            `insert or replace into bookmarks(
               id, user_id, entity_id, navigation_target_id, release_id, label,
               scene_json, scene_r2_key, created_at_ms
             ) values (?, ?, ?, ?, ?, ?, ?, NULL, 2000)`,
          )
          .run(...replacement.slice(0, 4), releaseId, ...replacement.slice(4)),
      /saved place already exists/,
    );
  }
  assert.throws(
    () =>
      database
        .prepare(
          `insert into bookmarks(
             id, user_id, entity_id, navigation_target_id, release_id, label,
             scene_json, scene_r2_key, created_at_ms
           ) values (?, 'usr_saved_2', 'jezero', 'jezero', ?, 'Jezero Crater', ?, NULL, 2000)
           on conflict(id) do update set
             user_id = excluded.user_id,
             entity_id = excluded.entity_id,
             navigation_target_id = excluded.navigation_target_id,
             label = excluded.label,
             scene_json = excluded.scene_json,
             created_at_ms = excluded.created_at_ms`,
        )
        .run(
          victimId,
          releaseId,
          storedJson("jezero", "surface", "scientific", 2_000),
        ),
    /saved place already exists/,
  );
  assert.deepEqual(
    {
      ...database
        .prepare("select id, user_id, entity_id, created_at_ms from bookmarks")
        .get(),
    },
    {
      id: victimId,
      user_id: "usr_saved_1",
      entity_id: "mars",
      created_at_ms: 1_000,
    },
  );
  assert.doesNotThrow(() =>
    database.prepare("delete from bookmarks where id = ?").run(victimId),
  );
});
