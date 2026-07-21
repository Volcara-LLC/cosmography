const ACCESS_PATH = "/__judge/access";
const COOKIE_NAME = "__Host-cosmography_judge";
const COOKIE_VERSION = "v1";
const DEFAULT_COOKIE_TTL_SECONDS = 21 * 24 * 60 * 60;
const MIN_COOKIE_TTL_SECONDS = 60 * 60;
const MAX_COOKIE_TTL_SECONDS = 60 * 24 * 60 * 60;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const FAILURE_BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_WINDOW = 8;

interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

export interface JudgeAccessEnv {
  DB?: D1DatabaseLike;
  JUDGE_ACCESS_MODE?: string;
  JUDGE_ACCESS_CODE?: string;
  JUDGE_COOKIE_SECRET?: string;
  JUDGE_COOKIE_TTL_SECONDS?: string;
}

export interface JudgeRateLimiter {
  isBlocked(key: string, nowMs: number): Promise<boolean>;
  recordFailure(key: string, nowMs: number): Promise<void>;
  clear(key: string): Promise<void>;
}

interface JudgeAccessDependencies {
  now?: () => number;
  rateLimiter?: JudgeRateLimiter;
}

type SharedCodeConfig = {
  accessCode: string;
  cookieSecret: string;
  cookieTtlSeconds: number;
};

class D1JudgeRateLimiter implements JudgeRateLimiter {
  constructor(private readonly database: D1DatabaseLike) {}

  async isBlocked(key: string, nowMs: number): Promise<boolean> {
    const row = await this.database
      .prepare(
        `SELECT blocked_until_ms
         FROM judge_access_attempts
         WHERE attempt_key = ?`,
      )
      .bind(key)
      .first<{ blocked_until_ms: number }>();
    return Boolean(row && row.blocked_until_ms > nowMs);
  }

  async recordFailure(key: string, nowMs: number): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO judge_access_attempts (
           attempt_key, window_started_at_ms, failure_count,
           blocked_until_ms, updated_at_ms
         ) VALUES (?, ?, 1, 0, ?)
         ON CONFLICT(attempt_key) DO UPDATE SET
           window_started_at_ms = CASE
             WHEN ? - window_started_at_ms >= ? THEN ?
             ELSE window_started_at_ms
           END,
           failure_count = CASE
             WHEN ? - window_started_at_ms >= ? THEN 1
             ELSE MIN(failure_count + 1, ?)
           END,
           blocked_until_ms = CASE
             WHEN ? - window_started_at_ms >= ? THEN 0
             WHEN failure_count + 1 >= ? THEN ? + ?
             ELSE blocked_until_ms
           END,
           updated_at_ms = ?`,
      )
      .bind(
        key,
        nowMs,
        nowMs,
        nowMs,
        FAILURE_WINDOW_MS,
        nowMs,
        nowMs,
        FAILURE_WINDOW_MS,
        MAX_FAILURES_PER_WINDOW,
        nowMs,
        FAILURE_WINDOW_MS,
        MAX_FAILURES_PER_WINDOW,
        nowMs,
        FAILURE_BLOCK_MS,
        nowMs,
      )
      .run();
  }

  async clear(key: string): Promise<void> {
    await this.database
      .prepare("DELETE FROM judge_access_attempts WHERE attempt_key = ?")
      .bind(key)
      .run();
  }
}

function htmlResponse(html: string, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  responseHeaders.set("Cache-Control", "private, no-store, max-age=0");
  responseHeaders.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  responseHeaders.set("Referrer-Policy", "no-referrer");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("X-Frame-Options", "DENY");
  return new Response(html, { status, headers: responseHeaders });
}

function accessPage(message?: string, status = 200) {
  const feedback = message
    ? `<p class="feedback" role="alert">${message}</p>`
    : `<p class="context">Private Build Week judging preview</p>`;
  return htmlResponse(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cosmography · Private judging access</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; color: #f4f7ff; background: radial-gradient(circle at 50% 20%, #172846 0, #08111f 44%, #03060b 100%); }
    main { width: min(92vw, 31rem); padding: 2.25rem; border: 1px solid rgba(169, 203, 255, .28); border-radius: 1.25rem; background: rgba(7, 16, 29, .94); box-shadow: 0 1.5rem 5rem rgba(0, 0, 0, .42); }
    .eyebrow { margin: 0 0 .75rem; color: #8fd9ff; font-size: .75rem; font-weight: 750; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(2rem, 8vw, 3.4rem); line-height: .94; letter-spacing: -.045em; }
    .lede { margin: 1rem 0 1.5rem; color: #c8d5e8; line-height: 1.6; }
    label { display: block; margin-bottom: .55rem; font-size: .9rem; font-weight: 700; }
    input, button { width: 100%; min-height: 3rem; border-radius: .7rem; font: inherit; }
    input { border: 1px solid #58708f; padding: .7rem .85rem; color: #fff; background: #0d1a2d; }
    input:focus { outline: 3px solid #73cfff; outline-offset: 2px; }
    button { margin-top: .85rem; border: 0; color: #07111f; background: #8fd9ff; font-weight: 800; cursor: pointer; }
    button:hover { background: #b7e8ff; }
    .context, .feedback { min-height: 1.5rem; margin: 1rem 0 0; color: #aabbd2; font-size: .86rem; }
    .feedback { color: #ffd2bf; }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Cosmography</p>
    <h1>Enter the atlas.</h1>
    <p class="lede">Use the shared judging code supplied privately with the Devpost submission.</p>
    <form method="post" action="${ACCESS_PATH}">
      <label for="judge-code">Judging access code</label>
      <input id="judge-code" name="code" type="password" required maxlength="256" autocomplete="off" autofocus>
      <button type="submit">Open Cosmography</button>
    </form>
    ${feedback}
  </main>
</body>
</html>`,
    status,
  );
}

function unavailablePage() {
  return htmlResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cosmography · Preview unavailable</title></head><body><main><h1>Cosmography</h1><p>This private preview is not available right now.</p></main></body></html>`,
    503,
  );
}

function parseCookieTtl(value: string | undefined): number | null {
  if (value === undefined || value === "") return DEFAULT_COOKIE_TTL_SECONDS;
  if (!/^[0-9]+$/.test(value)) return null;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds)) return null;
  if (seconds < MIN_COOKIE_TTL_SECONDS || seconds > MAX_COOKIE_TTL_SECONDS) return null;
  return seconds;
}

function readConfig(env: JudgeAccessEnv): SharedCodeConfig | "disabled" | null {
  const mode = env.JUDGE_ACCESS_MODE?.trim() || "shared-code";
  if (mode === "disabled") return "disabled";
  if (mode !== "shared-code") return null;

  const accessCode = env.JUDGE_ACCESS_CODE;
  const cookieSecret = env.JUDGE_COOKIE_SECRET;
  const cookieTtlSeconds = parseCookieTtl(env.JUDGE_COOKIE_TTL_SECONDS);
  if (
    !accessCode ||
    accessCode.length < 12 ||
    accessCode.length > 256 ||
    !cookieSecret ||
    cookieSecret.length < 32 ||
    cookieSecret.length > 512 ||
    cookieTtlSeconds === null
  ) {
    return null;
  }
  return { accessCode, cookieSecret, cookieTtlSeconds };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmac(key: CryptoKey, value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function constantTimeCodeMatch(configuredCode: string, suppliedCode: string, key: CryptoKey) {
  const configuredSignature = await hmac(key, configuredCode);
  return crypto.subtle.verify("HMAC", key, configuredSignature, new TextEncoder().encode(suppliedCode));
}

function getCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === COOKIE_NAME) {
      return item.slice(separator + 1).trim();
    }
  }
  return null;
}

async function issueCookie(config: SharedCodeConfig, nowMs: number): Promise<string> {
  const issuedAtSeconds = Math.floor(nowMs / 1000);
  const expiresAtSeconds = issuedAtSeconds + config.cookieTtlSeconds;
  const nonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `${COOKIE_VERSION}.${issuedAtSeconds}.${expiresAtSeconds}.${nonce}`;
  const key = await importHmacKey(config.cookieSecret);
  const signature = bytesToBase64Url(await hmac(key, payload));
  const expires = new Date(expiresAtSeconds * 1000).toUTCString();
  return `${COOKIE_NAME}=${payload}.${signature}; Path=/; Max-Age=${config.cookieTtlSeconds}; Expires=${expires}; Secure; HttpOnly; SameSite=Lax`;
}

async function hasValidCookie(request: Request, config: SharedCodeConfig, nowMs: number) {
  const cookie = getCookie(request);
  if (!cookie) return false;
  const parts = cookie.split(".");
  if (parts.length !== 5 || parts[0] !== COOKIE_VERSION) return false;
  const issuedAtSeconds = Number(parts[1]);
  const expiresAtSeconds = Number(parts[2]);
  if (!Number.isSafeInteger(issuedAtSeconds) || !Number.isSafeInteger(expiresAtSeconds)) return false;
  const nowSeconds = Math.floor(nowMs / 1000);
  if (issuedAtSeconds > nowSeconds + 300 || expiresAtSeconds <= nowSeconds) return false;
  if (expiresAtSeconds - issuedAtSeconds !== config.cookieTtlSeconds) return false;
  const signature = base64UrlToBytes(parts[4]);
  if (!signature) return false;
  const payload = parts.slice(0, 4).join(".");
  const key = await importHmacKey(config.cookieSecret);
  return crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(payload));
}

async function rateLimitKey(request: Request, cookieSecret: string) {
  const address = request.headers.get("CF-Connecting-IP")?.trim() || "unavailable";
  const key = await importHmacKey(cookieSecret);
  return bytesToBase64Url(await hmac(key, `judge-access-rate:${address}`));
}

function isSameOriginSubmission(request: Request) {
  const origin = request.headers.get("Origin");
  // Some browser/Worker test paths serialize an opaque origin as the literal
  // value "null". Treat it like a missing Origin header, but still reject any
  // explicit foreign origin and every request marked cross-site by Fetch Metadata.
  if (origin && origin !== "null" && origin !== new URL(request.url).origin) return false;
  return request.headers.get("Sec-Fetch-Site") !== "cross-site";
}

function neutralFailure() {
  // Keep the rendered form on a normal document origin so a judge can retry.
  // Chromium assigns an opaque origin to some rendered authentication-error
  // responses, which would make the next same-origin submission look cross-site.
  return accessPage("Access could not be verified. Please check the code and try again.");
}

function isBrowserNavigation(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return (
    request.headers.get("Sec-Fetch-Mode") === "navigate" ||
    request.headers.get("Accept")?.toLowerCase().includes("text/html") === true
  );
}

export async function enforceJudgeAccess(
  request: Request,
  env: JudgeAccessEnv,
  dependencies: JudgeAccessDependencies = {},
): Promise<Response | null> {
  const config = readConfig(env);
  if (config === "disabled") return null;
  if (!config) return unavailablePage();

  const nowMs = dependencies.now?.() ?? Date.now();
  const url = new URL(request.url);
  if (await hasValidCookie(request, config, nowMs)) {
    if (url.pathname === ACCESS_PATH) {
      return new Response(null, { status: 303, headers: { Location: "/", "Cache-Control": "private, no-store" } });
    }
    return null;
  }

  if (url.pathname !== ACCESS_PATH) {
    return accessPage(undefined, isBrowserNavigation(request) ? 200 : 401);
  }
  if (request.method === "GET" || request.method === "HEAD") return accessPage();
  if (request.method !== "POST" || !isSameOriginSubmission(request)) return neutralFailure();

  const rateLimiter = dependencies.rateLimiter ?? (env.DB ? new D1JudgeRateLimiter(env.DB) : null);
  if (!rateLimiter) return unavailablePage();

  let suppliedCode = "";
  try {
    const form = await request.formData();
    const value = form.get("code");
    if (typeof value === "string" && value.length <= 256) suppliedCode = value;
  } catch {
    return neutralFailure();
  }

  try {
    const key = await rateLimitKey(request, config.cookieSecret);
    if (await rateLimiter.isBlocked(key, nowMs)) return neutralFailure();
    const hmacKey = await importHmacKey(config.cookieSecret);
    if (!(await constantTimeCodeMatch(config.accessCode, suppliedCode, hmacKey))) {
      await rateLimiter.recordFailure(key, nowMs);
      return neutralFailure();
    }
    await rateLimiter.clear(key);
    const cookie = await issueCookie(config, nowMs);
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/",
        "Set-Cookie": cookie,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return unavailablePage();
  }
}

export const judgeAccessContract = Object.freeze({
  accessPath: ACCESS_PATH,
  cookieName: COOKIE_NAME,
  defaultCookieTtlSeconds: DEFAULT_COOKIE_TTL_SECONDS,
  failureWindowMs: FAILURE_WINDOW_MS,
  failureBlockMs: FAILURE_BLOCK_MS,
  maxFailuresPerWindow: MAX_FAILURES_PER_WINDOW,
});
