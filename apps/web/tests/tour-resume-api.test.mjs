import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Log, LogLevel, Miniflare } from "miniflare";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const endpoint = "/api/v1/me/tours/seven-scales-to-jezero/resume";
const databaseId = `cosmography-tour-resume-api-${randomUUID()}`;
const tourId = "tour_seven_scales_to_jezero_v1";
const releaseId = "rel_landing_atlas_v0_1_0";
const identity = {
  email: "mae-tour-resume@example.test",
  fullName: "Mae Jemison",
};
const otherIdentity = {
  email: "sally-tour-resume@example.test",
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
  {
    account = identity,
    authenticated = true,
    method = "GET",
    body,
    contentType = "application/json",
  } = {},
) {
  const headers = authenticated
    ? identityHeaders(account)
    : { accept: "application/json" };
  if (body !== undefined && contentType !== null) {
    headers["content-type"] = contentType;
  }
  return miniflare.dispatchFetch(`https://cosmography.test${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : body,
  });
}

function requestJson(miniflare, options = {}) {
  return requestApi(miniflare, {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function putResume(miniflare, resumeOrdinal, expectedSavedAtMs, options = {}) {
  return requestJson(miniflare, {
    method: "PUT",
    body: { tourId, releaseId, resumeOrdinal, expectedSavedAtMs },
    ...options,
  });
}

function deleteResume(miniflare, expectedSavedAtMs, options = {}) {
  return requestJson(miniflare, {
    method: "DELETE",
    body: { expectedSavedAtMs },
    ...options,
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

function assertExactRecord(record, ordinal) {
  const stop = [
    ["scale-observable-universe", "Known Universe", "observable-universe"],
    ["scale-laniakea", "Laniakea", "laniakea"],
    ["scale-local-group", "Local Group", "local-group"],
    ["scale-milky-way", "Milky Way", "milky-way"],
    ["scale-solar-system", "Solar System", "solar-system"],
    ["scale-mars", "Mars", "mars"],
    ["scale-jezero", "Jezero Crater", "jezero"],
  ][ordinal - 1];
  assert.ok(stop);
  const [stopId, stopTitle, targetEntityId] = stop;
  assert.deepEqual(Object.keys(record), [
    "tour",
    "resume",
    "savedAtMs",
    "method",
    "truth",
  ]);
  assert.deepEqual(record.tour, {
    id: tourId,
    slug: "seven-scales-to-jezero",
    title: "Seven Scales to Jezero",
    releaseId,
  });
  assert.deepEqual(record.resume, {
    ordinal,
    stopId,
    stopTitle,
    targetEntityId,
    href: `/?tour=seven-scales-to-jezero&step=${ordinal}&focus=${targetEntityId}&release=${releaseId}`,
  });
  assert.ok(Number.isSafeInteger(record.savedAtMs));
  assert.ok(record.savedAtMs > 0);
  assert.equal(record.method, "manual-save-resume-point");
  assert.deepEqual(record.truth, {
    userConfirmed: true,
    passiveNavigation: false,
    resumeStateOnly: true,
    storedStateDefinesTour: false,
    completionClaim: false,
    achievementClaim: false,
    scientificDiscoveryClaim: false,
  });
  assert.equal("userId" in record, false);
  assert.equal("valueJson" in record, false);
}

test("private Seven Scales resume API is explicit, owner-scoped, CAS-safe, and fail-closed", async (t) => {
  const miniflare = new Miniflare({
    rootPath: appRoot,
    modules: await builtServerModules(),
    modulesRoot: appRoot,
    compatibilityDate: "2026-07-20",
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
      JUDGE_ACCESS_MODE: "disabled",
      IDENTITY_HMAC_SECRET: randomBytes(48).toString("base64url"),
      IDENTITY_HMAC_KEY_VERSION: "tour-resume-test-v1",
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

  for (const method of ["GET", "PUT", "DELETE"]) {
    const anonymous = await expectPrivateJson(
      await requestJson(miniflare, {
        authenticated: false,
        method,
        body:
          method === "GET"
            ? undefined
            : method === "PUT"
              ? { tourId, releaseId, resumeOrdinal: 1, expectedSavedAtMs: null }
              : { expectedSavedAtMs: 1 },
      }),
      401,
    );
    assert.equal(anonymous.error, "sign_in_required");
  }

  const empty = await expectPrivateJson(await requestJson(miniflare), 200);
  assert.deepEqual(empty, {
    schemaId: "cosmography.user-tour-resume",
    schemaVersion: "1.0.0",
    record: null,
  });

  const wrongContentType = await expectPrivateJson(
    await requestApi(miniflare, {
      method: "PUT",
      body: "{}",
      contentType: "text/plain",
    }),
    415,
  );
  assert.equal(wrongContentType.error, "json_content_type_required");
  const oversized = await expectPrivateJson(
    await requestApi(miniflare, {
      method: "PUT",
      body: `{"padding":"${"x".repeat(4_096)}"}`,
    }),
    413,
  );
  assert.equal(oversized.error, "request_too_large");
  const malformed = await expectPrivateJson(
    await requestApi(miniflare, { method: "PUT", body: "{" }),
    400,
  );
  assert.equal(malformed.error, "invalid_json");
  const invalidUtf8 = await expectPrivateJson(
    await requestApi(miniflare, {
      method: "PUT",
      body: new Uint8Array([0xff]),
    }),
    400,
  );
  assert.equal(invalidUtf8.error, "invalid_json");

  for (const invalidBody of [
    { tourId: "tour_other", releaseId, resumeOrdinal: 1, expectedSavedAtMs: null },
    { tourId, releaseId: "rel_future", resumeOrdinal: 1, expectedSavedAtMs: null },
    { tourId, releaseId, resumeOrdinal: 0, expectedSavedAtMs: null },
    { tourId, releaseId, resumeOrdinal: 8, expectedSavedAtMs: null },
    { tourId, releaseId, resumeOrdinal: 1.5, expectedSavedAtMs: null },
    { tourId, releaseId, resumeOrdinal: 1, expectedSavedAtMs: 0 },
    { tourId, releaseId, resumeOrdinal: 1, expectedSavedAtMs: null, passive: true },
  ]) {
    const invalid = await expectPrivateJson(
      await requestJson(miniflare, { method: "PUT", body: invalidBody }),
      400,
    );
    assert.equal(invalid.error, "invalid_tour_resume");
  }

  const insertRace = await Promise.all(
    Array.from({ length: 4 }, () => putResume(miniflare, 6, null)),
  );
  assert.equal(insertRace.filter(({ status }) => status === 201).length, 1);
  assert.equal(insertRace.filter(({ status }) => status === 409).length, 3);
  for (const response of insertRace) {
    const payload = await expectPrivateJson(response, response.status);
    if (response.status === 201) {
      assert.deepEqual(Object.keys(payload), ["schemaId", "schemaVersion", "record"]);
      assertExactRecord(payload.record, 6);
    } else {
      assert.equal(payload.error, "tour_resume_conflict");
    }
  }

  const storedOwner = await database
    .prepare(
      "select user_id, value_numeric, value_json, updated_at_ms from user_progress where scope_entity_id = ? and metric_code = ?",
    )
    .bind(tourId, "manual-resume-point-v1")
    .first();
  assert.ok(storedOwner);
  assert.equal(storedOwner.value_numeric, 6);
  const storedJson = JSON.parse(storedOwner.value_json);
  assert.deepEqual(Object.keys(storedJson), [
    "schemaId",
    "schemaVersion",
    "tourId",
    "tourSlug",
    "releaseId",
    "resumeOrdinal",
    "stopId",
    "targetEntityId",
    "savedAtMs",
    "method",
    "truth",
  ]);
  assert.equal(storedJson.savedAtMs, storedOwner.updated_at_ms);
  assert.equal("userId" in storedJson, false);

  const otherEmpty = await expectPrivateJson(
    await requestJson(miniflare, { account: otherIdentity }),
    200,
  );
  assert.equal(otherEmpty.record, null);
  const foreignUpdate = await expectPrivateJson(
    await putResume(miniflare, 2, storedOwner.updated_at_ms, {
      account: otherIdentity,
    }),
    409,
  );
  assert.equal(foreignUpdate.error, "tour_resume_conflict");

  const staleUpdate = await expectPrivateJson(
    await putResume(miniflare, 2, storedOwner.updated_at_ms - 1),
    409,
  );
  assert.equal(staleUpdate.error, "tour_resume_conflict");
  const movedBackward = await expectPrivateJson(
    await putResume(miniflare, 2, storedOwner.updated_at_ms),
    200,
  );
  assertExactRecord(movedBackward.record, 2);
  assert.ok(movedBackward.record.savedAtMs > storedOwner.updated_at_ms);

  const duplicateInsert = await expectPrivateJson(
    await putResume(miniflare, 7, null),
    409,
  );
  assert.equal(duplicateInsert.error, "tour_resume_conflict");

  const updateRace = await Promise.all([
    putResume(miniflare, 3, movedBackward.record.savedAtMs),
    putResume(miniflare, 4, movedBackward.record.savedAtMs),
  ]);
  assert.equal(updateRace.filter(({ status }) => status === 200).length, 1);
  assert.equal(updateRace.filter(({ status }) => status === 409).length, 1);
  for (const response of updateRace) {
    await expectPrivateJson(response, response.status);
  }
  const winner = await expectPrivateJson(await requestJson(miniflare), 200);
  assert.ok([3, 4].includes(winner.record.resume.ordinal));
  assertExactRecord(winner.record, winner.record.resume.ordinal);

  for (const invalidDelete of [
    {},
    { expectedSavedAtMs: null },
    { expectedSavedAtMs: 0 },
    { expectedSavedAtMs: winner.record.savedAtMs, extra: true },
  ]) {
    const invalid = await expectPrivateJson(
      await requestJson(miniflare, {
        method: "DELETE",
        body: invalidDelete,
      }),
      400,
    );
    assert.equal(invalid.error, "invalid_tour_resume");
  }
  const foreignDelete = await expectPrivateJson(
    await deleteResume(miniflare, winner.record.savedAtMs, {
      account: otherIdentity,
    }),
    409,
  );
  assert.equal(foreignDelete.error, "tour_resume_conflict");
  const staleDelete = await expectPrivateJson(
    await deleteResume(miniflare, winner.record.savedAtMs - 1),
    409,
  );
  assert.equal(staleDelete.error, "tour_resume_conflict");
  const deleted = await expectPrivateJson(
    await deleteResume(miniflare, winner.record.savedAtMs),
    200,
  );
  assert.deepEqual(deleted, {
    schemaId: "cosmography.user-tour-resume",
    schemaVersion: "1.0.0",
    record: null,
  });
  const missingDelete = await expectPrivateJson(
    await deleteResume(miniflare, winner.record.savedAtMs),
    409,
  );
  assert.equal(missingDelete.error, "tour_resume_conflict");

  const fresh = await expectPrivateJson(await putResume(miniflare, 7, null), 201);
  await database
    .prepare("drop trigger trg_user_progress_tour_resume_update")
    .run();
  await database
    .prepare(
      "update user_progress set value_json = json_set(value_json, '$.truth.completionClaim', json('true')) where user_id = ? and scope_entity_id = ? and metric_code = ?",
    )
    .bind(storedOwner.user_id, tourId, "manual-resume-point-v1")
    .run();
  const tamperedBeforePut = await database
    .prepare(
      "select value_numeric, value_json, updated_at_ms from user_progress where user_id = ? and scope_entity_id = ? and metric_code = ?",
    )
    .bind(storedOwner.user_id, tourId, "manual-resume-point-v1")
    .first();
  assert.equal(tamperedBeforePut.updated_at_ms, fresh.record.savedAtMs);
  assert.equal(JSON.parse(tamperedBeforePut.value_json).truth.completionClaim, true);
  const refusedHealingPut = await expectPrivateJson(
    await putResume(miniflare, 1, fresh.record.savedAtMs),
    503,
  );
  assert.equal(refusedHealingPut.error, "storage_unavailable");
  assert.equal("record" in refusedHealingPut, false);
  assert.deepEqual(
    await database
      .prepare(
        "select value_numeric, value_json, updated_at_ms from user_progress where user_id = ? and scope_entity_id = ? and metric_code = ?",
      )
      .bind(storedOwner.user_id, tourId, "manual-resume-point-v1")
      .first(),
    tamperedBeforePut,
  );
  const drifted = await expectPrivateJson(await requestJson(miniflare), 503);
  assert.equal(drifted.error, "storage_unavailable");
  assert.equal("record" in drifted, false);
  assert.equal(fresh.record.resume.ordinal, 7);
});

test("resume endpoint fails closed when durable storage has not been migrated", async (t) => {
  const unmigratedId = `cosmography-tour-resume-unmigrated-${randomUUID()}`;
  const miniflare = new Miniflare({
    rootPath: appRoot,
    modules: await builtServerModules(),
    modulesRoot: appRoot,
    compatibilityDate: "2026-07-20",
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
      JUDGE_ACCESS_MODE: "disabled",
      IDENTITY_HMAC_SECRET: randomBytes(48).toString("base64url"),
      IDENTITY_HMAC_KEY_VERSION: "tour-resume-test-v1",
    },
    d1Databases: { DB: unmigratedId },
    d1Persist: false,
    r2Buckets: { COSMOGRAPHY_MEDIA: `${unmigratedId}-media` },
    r2Persist: false,
    serviceBindings: {
      ASSETS: async () => new Response("Not found", { status: 404 }),
    },
    log: new Log(LogLevel.ERROR),
  });
  t.after(() => miniflare.dispose());
  const response = await expectPrivateJson(await requestJson(miniflare), 503);
  assert.ok(
    ["database_not_migrated", "storage_unavailable"].includes(response.error),
  );
  assert.equal("record" in response, false);
});
