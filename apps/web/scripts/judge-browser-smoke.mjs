import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare, Log, LogLevel } from "miniflare";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const clientRoot = join(appRoot, "dist", "client");
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

async function exists(target) {
  try {
    await readFile(target);
    return true;
  } catch {
    return false;
  }
}

async function builtServerModules() {
  const serverRoot = fileURLToPath(new URL("../dist/server/", import.meta.url));
  const entryPath = join(serverRoot, "index.js");
  const modulePaths = (await readdir(serverRoot, { recursive: true }))
    .filter((entry) => entry.endsWith(".js"))
    .map((entry) => join(serverRoot, entry))
    .filter((entry) => entry !== entryPath)
    .sort();
  return [entryPath, ...modulePaths].map((entry) => ({ type: "ESModule", path: entry }));
}

async function applyMigrations(database) {
  const migrationRoot = new URL("../drizzle/", import.meta.url);
  for (const migrationFile of (await readdir(migrationRoot)).filter((name) => name.endsWith(".sql")).sort()) {
    const migration = await readFile(new URL(migrationFile, migrationRoot), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await database.prepare(statement).run();
    }
  }
}

const mediaTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

async function loadBuiltAssets() {
  const assets = new Map();
  for (const relative of await readdir(clientRoot, { recursive: true })) {
    const target = join(clientRoot, relative);
    try {
      assets.set(
        `/${relative.replaceAll("\\", "/")}`,
        { bytes: await readFile(target), type: mediaTypes.get(path.extname(target).toLowerCase()) },
      );
    } catch {
      // Recursive directory entries are not files and are intentionally skipped.
    }
  }
  return assets;
}

async function waitFor(predicate, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Browser smoke condition timed out");
}

async function connectDevTools(debugPort, targetOrigin) {
  const page = await waitFor(async () => {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
      return targets.find(
        (target) =>
          target.type === "page" &&
          target.webSocketDebuggerUrl &&
          target.url.startsWith(targetOrigin),
      );
    } catch {
      return null;
    }
  });
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const exceptions = [];
  const accessPostHeaders = [];
  const assetResponses = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params);
    if (
      message.method === "Network.responseReceived" &&
      message.params.response.url.includes("/assets/")
    ) {
      assetResponses.push({
        url: message.params.response.url,
        status: message.params.response.status,
        mimeType: message.params.response.mimeType,
      });
    }
    if (
      message.method === "Network.requestWillBeSent" &&
      message.params.request.method === "POST" &&
      message.params.request.url.includes("/__judge/access")
    ) {
      accessPostHeaders.push({
        origin: message.params.request.headers.Origin ?? null,
        secFetchSite: message.params.request.headers["Sec-Fetch-Site"] ?? null,
      });
    }
    if (!message.id) return;
    const handlers = pending.get(message.id);
    if (!handlers) return;
    pending.delete(message.id);
    if (message.error) handlers.reject(new Error(message.error.message));
    else handlers.resolve(message.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error("Browser evaluation failed");
    return result.result.value;
  };
  return { socket, send, evaluate, exceptions, accessPostHeaders, assetResponses };
}

const chromePath = (await Promise.all(chromeCandidates.map(async (candidate) => [candidate, await exists(candidate)])))
  .find(([, present]) => present)?.[0];
if (!chromePath) throw new Error("Google Chrome is required for the judge access browser smoke test");

const accessCode = randomBytes(24).toString("base64url");
const databaseId = `judge-browser-${randomUUID()}`;
const builtAssets = await loadBuiltAssets();
const miniflare = new Miniflare({
  host: "127.0.0.1",
  port: 0,
  https: true,
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
    ASSETS: async (request) => {
      const asset = builtAssets.get(decodeURIComponent(new URL(request.url).pathname));
      return asset
        ? new Response(asset.bytes, { headers: { "Content-Type": asset.type ?? "application/octet-stream" } })
        : new Response("Not found", { status: 404 });
    },
  },
  log: new Log(LogLevel.ERROR),
});

const profile = await mkdtemp(join(tmpdir(), "cosmography-judge-browser-"));
let chrome;
let devtools;
try {
  await applyMigrations(await miniflare.getD1Database("DB"));
  const origin = (await miniflare.ready).origin;
  chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--ignore-certificate-errors",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--window-size=1440,900",
      `${origin}/`,
    ],
    { stdio: "ignore", windowsHide: true },
  );
  const debugPort = await waitFor(async () => {
    try {
      const value = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/u, 1)[0]);
      return Number.isInteger(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  });
  devtools = await connectDevTools(debugPort, origin);
  await devtools.send("Runtime.enable");
  await devtools.send("Network.enable");
  try {
    await waitFor(() =>
      devtools.evaluate(
        "document.readyState === 'complete' && document.title === 'Cosmography · Private judging access'",
      ),
    );
  } catch {
    const initialState = await devtools.evaluate(
      "({ href: location.href, title: document.title, text: document.body.innerText.slice(0, 180) })",
    );
    throw new Error(`Judge access page did not load: ${JSON.stringify(initialState)}`);
  }

  assert.equal(await devtools.evaluate("document.title"), "Cosmography · Private judging access");
  assert.equal(await devtools.evaluate("Boolean(document.querySelector('#judge-code'))"), true);

  await devtools.evaluate(`document.querySelector('#judge-code').value = 'wrong-browser-code'; document.querySelector('form').requestSubmit(); true`);
  await waitFor(() => devtools.evaluate("document.body.innerText.includes('Access could not be verified')"));
  assert.equal(await devtools.evaluate("document.body.innerText.includes('wrong-browser-code')"), false);

  await devtools.evaluate(`document.querySelector('#judge-code').value = ${JSON.stringify(accessCode)}; document.querySelector('form').requestSubmit(); true`);
  try {
    await waitFor(() => devtools.evaluate("location.pathname === '/' && document.title.includes('Observable Universe')"));
  } catch {
    const state = await devtools.evaluate("({ pathname: location.pathname, title: document.title, text: document.body.innerText.slice(0, 180) })");
    throw new Error(
      `Judge access browser redirect failed: ${JSON.stringify({ state, requestHeaders: devtools.accessPostHeaders })}`,
    );
  }
  await waitFor(() => devtools.evaluate("Boolean(document.querySelector('canvas'))"));
  assert.equal(
    await devtools.evaluate("performance.getEntriesByType('resource').some((entry) => /\\/assets\\/.*\\.js/.test(entry.name))"),
    true,
  );

  const cookies = await devtools.send("Network.getCookies", { urls: [`${origin}/`] });
  const judgeCookie = cookies.cookies.find((cookie) => cookie.name === "__Host-cosmography_judge");
  assert.ok(judgeCookie);
  assert.equal(judgeCookie.httpOnly, true);
  assert.equal(judgeCookie.secure, true);

  await devtools.send("Page.navigate", { url: `${origin}/missions/voyager-1` });
  await waitFor(() => devtools.evaluate("document.readyState === 'complete' && document.body.innerText.includes('No invented live feed')"));
  if (devtools.exceptions.length > 0) {
    const browserCookies = await devtools.send("Network.getCookies", { urls: [`${origin}/`] });
    throw new Error(
      `Browser runtime exceptions: ${JSON.stringify(
        devtools.exceptions.map(
          (entry) =>
            entry.exceptionDetails?.exception?.description ??
            entry.exceptionDetails?.text ??
            entry,
        ),
      )}; cookies=${JSON.stringify(browserCookies.cookies.map(({ name, secure, httpOnly }) => ({ name, secure, httpOnly })))}; assets=${JSON.stringify(devtools.assetResponses)}`,
    );
  }

  process.stdout.write("Chrome judge access smoke passed: access screen, neutral rejection, secure cookie, atlas, protected assets, and Voyager route.\n");
} finally {
  devtools?.socket.close();
  chrome?.kill();
  await miniflare.dispose();
  const resolvedProfile = path.resolve(profile);
  const resolvedTemp = path.resolve(tmpdir());
  if (resolvedProfile.startsWith(`${resolvedTemp}${path.sep}`)) {
    await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
}
