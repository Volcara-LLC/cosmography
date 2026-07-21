import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Log, LogLevel, Miniflare } from "miniflare";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const releaseId = "rel_landing_atlas_v0_1_0";
const bookmarkId = `bmk_${"a".repeat(32)}`;
const identity = {
  email: "katherine-saved-places@example.test",
  fullName: "Katherine Johnson",
};

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

async function applyMigrationsThrough0003(database) {
  const migrationRoot = new URL("../dist/.openai/drizzle/", import.meta.url);
  const migrationFiles = (await readdir(migrationRoot))
    .filter((name) => /^000[0-3]_.+\.sql$/u.test(name))
    .sort();
  assert.equal(migrationFiles.length, 4);
  const statements = [];
  for (const migrationFile of migrationFiles) {
    const migration = await readFile(new URL(migrationFile, migrationRoot), "utf8");
    statements.push(
      ...migration
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean)
        .map((statement) => database.prepare(statement)),
    );
  }
  await database.batch(statements);
}

function identityHeaders() {
  return {
    accept: "application/json",
    "oai-authenticated-user-email": identity.email,
    "oai-authenticated-user-full-name": encodeURIComponent(identity.fullName),
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  };
}

async function requestJson(miniflare, method = "GET", body) {
  const headers = identityHeaders();
  if (body !== undefined) headers["content-type"] = "application/json";
  return miniflare.dispatchFetch(
    "https://cosmography.test/api/v1/me/bookmarks",
    {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
}

async function expectStorageUnavailable(response) {
  assert.equal(response.status, 503, await response.clone().text());
  assert.match(response.headers.get("cache-control") ?? "", /private/u);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
  const payload = await response.json();
  assert.equal(payload.error, "storage_unavailable");
  assert.equal("records" in payload, false);
}

test("saved-place API fails closed before migration 0004 and never heals loose rows", async (t) => {
  const databaseId = `cosmography-saved-places-partial-${randomUUID()}`;
  const miniflare = new Miniflare({
    rootPath: appRoot,
    modules: await builtServerModules(),
    modulesRoot: appRoot,
    compatibilityDate: "2026-07-20",
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
      JUDGE_ACCESS_MODE: "disabled",
      IDENTITY_HMAC_SECRET: randomBytes(48).toString("base64url"),
      IDENTITY_HMAC_KEY_VERSION: "saved-places-test-v1",
    },
    d1Databases: { DB: databaseId },
    d1Persist: false,
    r2Buckets: { COSMOGRAPHY_MEDIA: `${databaseId}-media` },
    r2Persist: false,
    serviceBindings: {
      ASSETS: async () => new Response("Not found", { status: 404 }),
    },
    log: new Log(LogLevel.ERROR),
  });
  t.after(() => miniflare.dispose());
  const database = await miniflare.getD1Database("DB");
  await applyMigrationsThrough0003(database);

  await expectStorageUnavailable(await requestJson(miniflare));
  const account = await database
    .prepare("select id from app_users where display_name = ?")
    .bind(identity.fullName)
    .first();
  assert.ok(account?.id);

  const looseSceneBytes = '{"appearance":"immersive","callerMetadata":true}';
  await database
    .prepare(
      `insert into bookmarks(
         id, user_id, entity_id, navigation_target_id, release_id,
         label, scene_json, scene_r2_key, created_at_ms
       ) values (?, ?, 'mars', null, ?, 'Caller Mars', ?, 'loose/r2-key', 1000)`,
    )
    .bind(bookmarkId, account.id, releaseId, looseSceneBytes)
    .run();
  const before = await database
    .prepare("select * from bookmarks where id = ?")
    .bind(bookmarkId)
    .first();

  await expectStorageUnavailable(await requestJson(miniflare));
  await expectStorageUnavailable(
    await requestJson(miniflare, "POST", {
      entityId: "mars",
      appearance: "scientific",
      releaseId,
    }),
  );
  await expectStorageUnavailable(
    await requestJson(miniflare, "DELETE", {
      id: bookmarkId,
      expectedSavedAtMs: 1000,
    }),
  );

  const after = await database
    .prepare("select * from bookmarks where id = ?")
    .bind(bookmarkId)
    .first();
  assert.deepEqual(after, before);
  assert.equal(after.scene_json, looseSceneBytes);
});
