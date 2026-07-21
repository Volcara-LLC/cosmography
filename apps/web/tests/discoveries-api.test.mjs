import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Log, LogLevel, Miniflare } from "miniflare";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const databaseId = `cosmography-discoveries-api-${randomUUID()}`;
const releaseId = "rel_landing_atlas_v0_1_0";
const identity = {
  email: "mae-discoveries@example.test",
  fullName: "Mae Jemison",
};
const otherIdentity = {
  email: "sally-discoveries@example.test",
  fullName: "Sally Ride",
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

async function applyMigrations(database) {
  const migrationRoot = new URL("../dist/.openai/drizzle/", import.meta.url);
  const migrationFiles = (await readdir(migrationRoot))
    .filter((name) => name.endsWith(".sql"))
    .sort();
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

function identityHeaders(account) {
  return {
    accept: "application/json",
    "oai-authenticated-user-email": account.email,
    "oai-authenticated-user-full-name": encodeURIComponent(account.fullName),
    "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
  };
}

async function requestApi(
  miniflare,
  pathname,
  {
    account = identity,
    authenticated = true,
    method = "GET",
    body,
    contentType = "application/json",
  } = {},
) {
  const headers = authenticated ? identityHeaders(account) : { accept: "application/json" };
  if (body !== undefined && contentType !== null) headers["content-type"] = contentType;
  return miniflare.dispatchFetch(`https://cosmography.test${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : body,
  });
}

async function requestJson(miniflare, pathname, options = {}) {
  return requestApi(miniflare, pathname, {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
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
  assert.equal(response.headers.get("pragma"), "no-cache");
  return response.json();
}

function postEncounter(miniflare, entityId, options = {}) {
  return requestJson(miniflare, "/api/v1/me/discoveries", {
    method: "POST",
    body: { entityId, releaseId },
    ...options,
  });
}

test("private recorded encounters are manual, owner-scoped, race-safe, and fail closed", async (t) => {
  const miniflare = new Miniflare({
    rootPath: appRoot,
    modules: await builtServerModules(),
    modulesRoot: appRoot,
    compatibilityDate: "2026-07-20",
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
      JUDGE_ACCESS_MODE: "disabled",
      IDENTITY_HMAC_SECRET: randomBytes(48).toString("base64url"),
      IDENTITY_HMAC_KEY_VERSION: "discoveries-test-v1",
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
  await applyMigrations(database);

  const anonymous = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/discoveries", {
      authenticated: false,
    }),
    401,
  );
  assert.equal(anonymous.error, "sign_in_required");

  const empty = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/discoveries"),
    200,
  );
  assert.deepEqual(empty, {
    schemaId: "cosmography.user-recorded-encounters",
    schemaVersion: "1.0.0",
    records: [],
  });

  const wrongContentType = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/discoveries", {
      method: "POST",
      body: "{}",
      contentType: "text/plain",
    }),
    415,
  );
  assert.equal(wrongContentType.error, "json_content_type_required");
  const oversized = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/discoveries", {
      method: "POST",
      body: `{"padding":"${"x".repeat(4_096)}"}`,
    }),
    413,
  );
  assert.equal(oversized.error, "request_too_large");
  const malformed = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/discoveries", {
      method: "POST",
      body: "{",
    }),
    400,
  );
  assert.equal(malformed.error, "invalid_json");

  for (const invalidBody of [
    { entityId: "earth", releaseId },
    { entityId: "mars", releaseId: "rel_future" },
    { entityId: "mars", releaseId, passiveNavigation: true },
  ]) {
    const invalid = await expectPrivateJson(
      await requestJson(miniflare, "/api/v1/me/discoveries", {
        method: "POST",
        body: invalidBody,
      }),
      400,
    );
    assert.equal(invalid.error, "invalid_recorded_encounter");
  }

  const raceResponses = await Promise.all(
    Array.from({ length: 5 }, () => postEncounter(miniflare, "mars")),
  );
  const raceRecords = [];
  for (const response of raceResponses) {
    assert.ok([200, 201].includes(response.status), await response.clone().text());
    raceRecords.push((await expectPrivateJson(response, response.status)).records);
  }
  assert.equal(raceRecords.filter((record) => record.recordCount === 1).length, 1);
  assert.deepEqual(
    raceRecords.map((record) => record.recordCount).sort((left, right) => left - right),
    [1, 2, 3, 4, 5],
  );

  const ownerList = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/discoveries"),
    200,
  );
  assert.equal(ownerList.records.length, 1);
  const mars = ownerList.records[0];
  assert.deepEqual(Object.keys(mars), [
    "entity",
    "firstRecordedAtMs",
    "lastRecordedAtMs",
    "recordCount",
    "method",
    "firstReleaseId",
    "truth",
  ]);
  assert.deepEqual(Object.keys(mars.entity), [
    "id",
    "name",
    "slug",
    "kind",
    "domain",
    "href",
  ]);
  assert.equal(mars.entity.id, "mars");
  assert.equal(mars.recordCount, 5);
  assert.ok(mars.lastRecordedAtMs > mars.firstRecordedAtMs);
  assert.deepEqual(mars.truth, {
    userConfirmed: true,
    passiveNavigation: false,
    completionClaim: false,
    achievementClaim: false,
    scientificDiscoveryClaim: false,
  });
  assert.equal("userId" in mars, false);
  assert.equal("entityId" in mars, false);

  const otherEmpty = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/discoveries", {
      account: otherIdentity,
    }),
    200,
  );
  assert.deepEqual(otherEmpty.records, []);
  const foreignDelete = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/discoveries/mars", {
      account: otherIdentity,
      method: "DELETE",
    }),
    404,
  );
  assert.equal(foreignDelete.error, "not_found");
  const unknownDelete = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/discoveries/unknown", {
      method: "DELETE",
    }),
    404,
  );
  assert.equal(unknownDelete.error, "not_found");

  await expectPrivateJson(
    await postEncounter(miniflare, "voyager-1", { account: otherIdentity }),
    201,
  );
  await expectPrivateJson(await postEncounter(miniflare, "jezero"), 201);
  const itemDeleted = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/discoveries/mars", {
      method: "DELETE",
    }),
    200,
  );
  assert.deepEqual(itemDeleted.records, { entityId: "mars" });
  const itemMissing = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/discoveries/mars", {
      method: "DELETE",
    }),
    404,
  );
  assert.equal(itemMissing.error, "not_found");

  const cleared = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/discoveries", {
      method: "DELETE",
    }),
    200,
  );
  assert.deepEqual(cleared.records, { deletedCount: 1 });
  const otherRetained = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/discoveries", {
      account: otherIdentity,
    }),
    200,
  );
  assert.equal(otherRetained.records.length, 1);
  assert.equal(otherRetained.records[0].entity.id, "voyager-1");

  const otherUser = await database
    .prepare(
      "select user_id from user_discoveries where entity_id = 'voyager-1'",
    )
    .first("user_id");
  await database
    .prepare("drop trigger trg_user_discoveries_recorded_encounter_update")
    .run();
  await database
    .prepare(
      "update user_discoveries set discovery_method = 'passive-navigation' where user_id = ? and entity_id = 'voyager-1'",
    )
    .bind(otherUser)
    .run();
  const drifted = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/discoveries", {
      account: otherIdentity,
    }),
    503,
  );
  assert.equal(drifted.error, "storage_unavailable");
  assert.equal("records" in drifted, false);
});
