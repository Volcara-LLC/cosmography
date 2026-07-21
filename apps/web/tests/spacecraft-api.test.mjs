import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Log, LogLevel, Miniflare } from "miniflare";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const databaseId = `cosmography-spacecraft-api-${randomUUID()}`;
const identity = {
  email: "mae@example.test",
  fullName: "Mae Jemison",
};
const otherIdentity = {
  email: "sally@example.test",
  fullName: "Sally Ride",
};
const appearance = {
  schemaId: "cosmography.user-spacecraft.appearance",
  schemaVersion: "1.0.0",
  hullPreset: "pearl",
  accentPreset: "cyan",
  insignia: "orbit",
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
  { account = identity, method = "GET", body, contentType = "application/json" } = {},
) {
  const headers = identityHeaders(account);
  if (body !== undefined && contentType !== null) headers["content-type"] = contentType;
  return miniflare.dispatchFetch(`https://cosmography.test${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : body,
  });
}

async function requestJson(miniflare, pathname, options = {}) {
  const body = options.body;
  return requestApi(miniflare, pathname, {
    ...options,
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
  assert.equal(response.headers.get("pragma"), "no-cache");
  return response.json();
}

test("private spacecraft API is owner-scoped, strict, conflict-safe, and fail-closed", async (t) => {
  const modules = await builtServerModules();
  const miniflare = new Miniflare({
    rootPath: appRoot,
    modules,
    modulesRoot: appRoot,
    compatibilityDate: "2026-07-19",
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
      JUDGE_ACCESS_MODE: "disabled",
      IDENTITY_HMAC_SECRET: randomBytes(48).toString("base64url"),
      IDENTITY_HMAC_KEY_VERSION: "spacecraft-test-v1",
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

  const empty = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/spacecraft"),
    200,
  );
  assert.deepEqual(empty, {
    schemaId: "cosmography.user-spacecraft",
    schemaVersion: "1.0.0",
    records: [],
  });

  const wrongContentType = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/spacecraft", {
      method: "POST",
      body: "{}",
      contentType: "text/plain",
    }),
    415,
  );
  assert.equal(wrongContentType.error, "json_content_type_required");
  const oversized = await expectPrivateJson(
    await requestApi(miniflare, "/api/v1/me/spacecraft", {
      method: "POST",
      body: `{"padding":"${"x".repeat(8_192)}"}`,
    }),
    413,
  );
  assert.equal(oversized.error, "request_too_large");

  const invalid = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/spacecraft", {
      method: "POST",
      body: {
        displayName: "Unsafe",
        profile: "voyager",
        appearance,
      },
    }),
    400,
  );
  assert.equal(invalid.error, "invalid_spacecraft");

  const createdResponse = await requestJson(miniflare, "/api/v1/me/spacecraft", {
      method: "POST",
      body: {
        displayName: "  Cafe\u0301 Horizon  ",
        profile: "fusion-0.1c",
        appearance,
      },
    });
  if (createdResponse.status !== 201) {
    const debugRows = await database
      .prepare("select id, display_name from user_spacecraft")
      .all();
    assert.fail(
      `${await createdResponse.text()} stored rows: ${JSON.stringify(debugRows.results)}`,
    );
  }
  const created = await expectPrivateJson(createdResponse, 201);
  assert.equal(created.schemaId, "cosmography.user-spacecraft");
  assert.equal(created.schemaVersion, "1.0.0");
  assert.match(created.records.id, /^ship_[0-9a-f]{32}$/);
  assert.equal(created.records.displayName, "Café Horizon");
  assert.equal(created.records.profile, "fusion-0.1c");
  assert.deepEqual(created.records.appearance, appearance);
  assert.deepEqual(
    Object.keys(created.records).sort(),
    [
      "appearance",
      "createdAtMs",
      "displayName",
      "id",
      "profile",
      "propulsion",
      "updatedAtMs",
    ],
  );
  assert.deepEqual(
    {
      availableVehicle: created.records.propulsion.availableVehicle,
      actualJourneyClaim: created.records.propulsion.actualJourneyClaim,
      missionPlan: created.records.propulsion.missionPlan,
      trajectoryClaim: created.records.propulsion.trajectoryClaim,
      telemetryClaim: created.records.propulsion.telemetryClaim,
      scientificValidation: created.records.propulsion.scientificValidation,
    },
    {
      availableVehicle: false,
      actualJourneyClaim: false,
      missionPlan: false,
      trajectoryClaim: false,
      telemetryClaim: false,
      scientificValidation: false,
    },
  );
  assert.equal("definitionJson" in created.records.propulsion, false);
  assert.equal("userId" in created.records, false);
  assert.equal("cosmeticsJson" in created.records, false);

  const stored = await database
    .prepare(
      "select user_id, display_name, propulsion_model_id, cosmetics_json from user_spacecraft where id = ?",
    )
    .bind(created.records.id)
    .first();
  assert.match(stored.user_id, /^usr_[0-9a-f]{32}$/);
  assert.equal(stored.display_name, "Café Horizon");
  assert.equal(stored.propulsion_model_id, "prop_concept_fusion_0_1c_v1");
  assert.deepEqual(JSON.parse(stored.cosmetics_json), appearance);

  const hiddenFromOtherOwner = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/spacecraft", {
      account: otherIdentity,
    }),
    200,
  );
  assert.deepEqual(hiddenFromOtherOwner.records, []);
  const foreignPatch = await expectPrivateJson(
    await requestJson(
      miniflare,
      `/api/v1/me/spacecraft/${created.records.id}`,
      {
        account: otherIdentity,
        method: "PATCH",
        body: {
          expectedUpdatedAtMs: created.records.updatedAtMs,
          displayName: "Claimed",
        },
      },
    ),
    404,
  );
  assert.equal(foreignPatch.error, "not_found");

  const noChange = await expectPrivateJson(
    await requestJson(
      miniflare,
      `/api/v1/me/spacecraft/${created.records.id}`,
      {
        method: "PATCH",
        body: {
          expectedUpdatedAtMs: created.records.updatedAtMs,
          displayName: "  Café Horizon ",
        },
      },
    ),
    400,
  );
  assert.equal(noChange.error, "spacecraft_no_change");

  const stale = await expectPrivateJson(
    await requestJson(
      miniflare,
      `/api/v1/me/spacecraft/${created.records.id}`,
      {
        method: "PATCH",
        body: {
          expectedUpdatedAtMs: created.records.updatedAtMs - 1,
          displayName: "Far Horizon",
        },
      },
    ),
    409,
  );
  assert.equal(stale.error, "spacecraft_conflict");

  const changedAppearance = {
    ...appearance,
    hullPreset: "graphite",
    accentPreset: "gold",
    insignia: "star",
  };
  const updated = await expectPrivateJson(
    await requestJson(
      miniflare,
      `/api/v1/me/spacecraft/${created.records.id}`,
      {
        method: "PATCH",
        body: {
          expectedUpdatedAtMs: created.records.updatedAtMs,
          displayName: "Far Horizon",
          appearance: changedAppearance,
        },
      },
    ),
    200,
  );
  assert.equal(updated.records.displayName, "Far Horizon");
  assert.deepEqual(updated.records.appearance, changedAppearance);
  assert.ok(updated.records.updatedAtMs > created.records.updatedAtMs);
  assert.equal(updated.records.propulsion.id, created.records.propulsion.id);

  const foreignDelete = await expectPrivateJson(
    await requestJson(
      miniflare,
      `/api/v1/me/spacecraft/${created.records.id}`,
      { account: otherIdentity, method: "DELETE" },
    ),
    404,
  );
  assert.equal(foreignDelete.error, "not_found");
  const deleted = await expectPrivateJson(
    await requestJson(
      miniflare,
      `/api/v1/me/spacecraft/${created.records.id}`,
      { method: "DELETE" },
    ),
    200,
  );
  assert.deepEqual(deleted.records, { id: created.records.id });

  const warp = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/spacecraft", {
      method: "POST",
      body: {
        displayName: "Story vessel",
        profile: "fictional-warp",
        appearance,
      },
    }),
    201,
  );
  assert.equal(warp.records.propulsion.truthClass, "fictional-only");
  assert.equal(warp.records.propulsion.fictional, true);
  assert.equal(warp.records.propulsion.speedFractionOfC, null);

  const quotaRows = Array.from({ length: 23 }, (_, index) => {
    const id = `ship_${(index + 100).toString(16).padStart(32, "0")}`;
    return database
      .prepare(
        `insert into user_spacecraft
          (id, user_id, display_name, propulsion_model_id, cosmetics_json, created_at_ms, updated_at_ms)
         values (?, ?, ?, 'prop_concept_fusion_0_1c_v1', ?, ?, ?)`,
      )
      .bind(
        id,
        stored.user_id,
        `Concept ${index + 1}`,
        JSON.stringify(appearance),
        index + 10,
        index + 10,
      );
  });
  await database.batch(quotaRows);
  const quota = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/spacecraft", {
      method: "POST",
      body: {
        displayName: "One too many",
        profile: "fusion-0.1c",
        appearance,
      },
    }),
    409,
  );
  assert.equal(quota.error, "spacecraft_quota_reached");
  assert.equal(quota.limit, 24);

  await database
    .prepare("drop trigger trg_durable_propulsion_models_immutable_update")
    .run();
  await database
    .prepare(
      "update propulsion_models set definition_json = json_set(definition_json, '$.availableVehicle', json('true')) where id = 'prop_concept_warp_fiction_v1'",
    )
    .run();
  const drifted = await expectPrivateJson(
    await requestJson(miniflare, "/api/v1/me/spacecraft"),
    503,
  );
  assert.equal(drifted.error, "storage_unavailable");
  assert.equal("records" in drifted, false);
});
