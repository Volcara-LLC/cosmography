import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Log, LogLevel, Miniflare } from "miniflare";

const appRoot = fileURLToPath(new URL("../", import.meta.url));

async function builtServerModules() {
  const serverRoot = fileURLToPath(new URL("../dist/server/", import.meta.url));
  const entryPath = join(serverRoot, "index.js");
  const modulePaths = (await readdir(serverRoot, { recursive: true }))
    .filter((path) => path.endsWith(".js"))
    .map((path) => join(serverRoot, path))
    .filter((path) => path !== entryPath)
    .sort();
  return [entryPath, ...modulePaths].map((path) => ({ type: "ESModule", path }));
}

async function applyMigrations(database) {
  const migrationRoot = new URL("../drizzle/", import.meta.url);
  const migrationFiles = (await readdir(migrationRoot))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const migrationFile of migrationFiles) {
    const migration = await readFile(new URL(migrationFile, migrationRoot), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await database.prepare(statement).run();
    }
  }
}

function formRequest(code) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "CF-Connecting-IP": "203.0.113.27",
      Origin: "http://localhost",
      "Sec-Fetch-Site": "same-origin",
    },
    body: new URLSearchParams({ code }),
    redirect: "manual",
  };
}

test("built Worker enforces shared-code access with durable D1 limiting", async (t) => {
  const databaseId = `judge-access-${randomUUID()}`;
  const accessCode = randomBytes(24).toString("base64url");
  const miniflare = new Miniflare({
    rootPath: appRoot,
    modules: await builtServerModules(),
    modulesRoot: appRoot,
    compatibilityDate: "2026-07-21",
    compatibilityFlags: ["nodejs_compat"],
    bindings: {
      JUDGE_ACCESS_MODE: "shared-code",
      JUDGE_ACCESS_CODE: accessCode,
      JUDGE_COOKIE_SECRET: randomBytes(48).toString("base64url"),
      JUDGE_COOKIE_TTL_SECONDS: "3600",
    },
    d1Databases: { DB: databaseId },
    d1Persist: false,
    r2Buckets: { COSMOGRAPHY_MEDIA: `${databaseId}-media` },
    r2Persist: false,
    serviceBindings: {
      ASSETS: async (request) =>
        new URL(request.url).pathname.startsWith("/assets/")
          ? new Response("asset", { status: 200 })
          : new Response("Not found", { status: 404 }),
    },
    log: new Log(LogLevel.ERROR),
  });
  t.after(() => miniflare.dispose());
  await applyMigrations(await miniflare.getD1Database("DB"));

  const protectedPage = await miniflare.dispatchFetch("http://localhost/", {
    headers: { Accept: "text/html", "Sec-Fetch-Mode": "navigate" },
  });
  assert.equal(protectedPage.status, 200);
  assert.match(await protectedPage.text(), /Judging access code/);

  const protectedAsset = await miniflare.dispatchFetch(
    "http://localhost/assets/mars/mars-viking-mdim21-global-4096.jpg",
  );
  assert.equal(protectedAsset.status, 401);

  const rejected = await miniflare.dispatchFetch(
    "http://localhost/__judge/access",
    formRequest("not-the-shared-code"),
  );
  assert.equal(rejected.status, 200);
  assert.equal(rejected.headers.get("set-cookie"), null);
  assert.match(await rejected.text(), /Access could not be verified/);

  const accepted = await miniflare.dispatchFetch(
    "http://localhost/__judge/access",
    formRequest(accessCode),
  );
  assert.equal(accepted.status, 303);
  const setCookie = accepted.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /HttpOnly/);
  const cookie = setCookie.split(";", 1)[0];

  const health = await miniflare.dispatchFetch("http://localhost/api/health", {
    headers: { Cookie: cookie, Accept: "application/json" },
  });
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");

  for (let ordinal = 0; ordinal < 8; ordinal += 1) {
    const attempt = await miniflare.dispatchFetch(
      "http://localhost/__judge/access",
      formRequest(`wrong-code-attempt-${ordinal}`),
    );
    assert.equal(attempt.status, 200);
  }
  const limited = await miniflare.dispatchFetch(
    "http://localhost/__judge/access",
    formRequest(accessCode),
  );
  assert.equal(limited.status, 200);
  assert.equal(limited.headers.get("set-cookie"), null);
});
