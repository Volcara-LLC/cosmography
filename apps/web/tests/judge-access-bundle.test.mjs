import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(target));
    else files.push(target);
  }
  return files;
}

test("judge gate secrets and server implementation are absent from browser output", async () => {
  const clientRoot = path.join(appRoot, "dist", "client");
  const clientFiles = await listFiles(clientRoot);
  const browserText = (
    await Promise.all(
      clientFiles
        .filter((file) => /\.(?:js|css|html|json|txt|map)$/u.test(file))
        .map((file) => readFile(file, "utf8")),
    )
  ).join("\n");

  assert.doesNotMatch(browserText, /JUDGE_ACCESS_CODE/);
  assert.doesNotMatch(browserText, /JUDGE_COOKIE_SECRET/);
  assert.doesNotMatch(browserText, /__Host-cosmography_judge/);
  assert.doesNotMatch(browserText, /judge_access_attempts/);
  assert.doesNotMatch(browserText, /Enter the atlas\./);
});

test("built Cloudflare assets always enter the Worker before serving", async () => {
  const workerConfig = JSON.parse(
    await readFile(path.join(appRoot, "dist", "server", "wrangler.json"), "utf8"),
  );
  assert.equal(workerConfig.assets.binding, "ASSETS");
  assert.equal(workerConfig.assets.run_worker_first, true);
  assert.equal(workerConfig.d1_databases[0].binding, "DB");
  assert.equal(workerConfig.r2_buckets[0].binding, "COSMOGRAPHY_MEDIA");
});

