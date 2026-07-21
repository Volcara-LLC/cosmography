import assert from "node:assert/strict";
import test from "node:test";

import {
  enforceJudgeAccess,
  judgeAccessContract,
  type JudgeAccessEnv,
  type JudgeRateLimiter,
} from "../worker/judge-access";

const NOW_MS = Date.UTC(2026, 6, 21, 12, 0, 0);
const ACCESS_CODE = "judge-preview-code-2026";
const COOKIE_SECRET = "cookie-signing-secret-with-more-than-32-characters";

class MemoryRateLimiter implements JudgeRateLimiter {
  private readonly failures = new Map<string, number>();
  private readonly blocked = new Set<string>();

  async isBlocked(key: string) {
    return this.blocked.has(key);
  }

  async recordFailure(key: string) {
    const next = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, next);
    if (next >= judgeAccessContract.maxFailuresPerWindow) this.blocked.add(key);
  }

  async clear(key: string) {
    this.failures.delete(key);
    this.blocked.delete(key);
  }
}

const env = (): JudgeAccessEnv => ({
  JUDGE_ACCESS_MODE: "shared-code",
  JUDGE_ACCESS_CODE: ACCESS_CODE,
  JUDGE_COOKIE_SECRET: COOKIE_SECRET,
  JUDGE_COOKIE_TTL_SECONDS: "3600",
});

function request(pathname: string, init: RequestInit = {}) {
  return new Request(`https://judge.cosmography.example${pathname}`, init);
}

function codeSubmission(code: string) {
  return request(judgeAccessContract.accessPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "CF-Connecting-IP": "203.0.113.7",
      Origin: "https://judge.cosmography.example",
      "Sec-Fetch-Site": "same-origin",
    },
    body: new URLSearchParams({ code }),
  });
}

function cookieHeader(setCookie: string) {
  return setCookie.split(";", 1)[0];
}

test("correct shared code grants a signed secure HttpOnly cookie", async () => {
  const limiter = new MemoryRateLimiter();
  const response = await enforceJudgeAccess(codeSubmission(ACCESS_CODE), env(), {
    now: () => NOW_MS,
    rateLimiter: limiter,
  });

  assert.equal(response?.status, 303);
  assert.equal(response?.headers.get("location"), "/");
  const setCookie = response?.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /^__Host-cosmography_judge=/);
  assert.match(setCookie, /; Path=\//);
  assert.match(setCookie, /; Secure/);
  assert.match(setCookie, /; HttpOnly/);
  assert.match(setCookie, /; SameSite=Lax/);
  assert.match(setCookie, /; Max-Age=3600/);
  assert.doesNotMatch(setCookie, new RegExp(ACCESS_CODE));
  assert.doesNotMatch(setCookie, new RegExp(COOKIE_SECRET));

  const protectedResponse = await enforceJudgeAccess(
    request("/worlds/mars", { headers: { Cookie: cookieHeader(setCookie) } }),
    env(),
    { now: () => NOW_MS + 1000, rateLimiter: limiter },
  );
  assert.equal(protectedResponse, null);
});

test("incorrect code receives one neutral rejection without a cookie", async () => {
  const response = await enforceJudgeAccess(codeSubmission("incorrect-code-value"), env(), {
    now: () => NOW_MS,
    rateLimiter: new MemoryRateLimiter(),
  });
  const html = await response?.text();

  assert.equal(response?.status, 200);
  assert.equal(response?.headers.get("set-cookie"), null);
  assert.match(html ?? "", /Access could not be verified/);
  assert.doesNotMatch(html ?? "", /incorrect-code-value/);
  assert.doesNotMatch(html ?? "", new RegExp(ACCESS_CODE));
});

test("cross-site submissions are rejected while opaque Worker-browser origins can retry", async () => {
  const limiter = new MemoryRateLimiter();
  const crossSite = await enforceJudgeAccess(
    request(judgeAccessContract.accessPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://example.invalid",
        "Sec-Fetch-Site": "cross-site",
      },
      body: new URLSearchParams({ code: ACCESS_CODE }),
    }),
    env(),
    { now: () => NOW_MS, rateLimiter: limiter },
  );
  assert.equal(crossSite?.status, 200);
  assert.equal(crossSite?.headers.get("set-cookie"), null);

  const opaqueWorkerOrigin = await enforceJudgeAccess(
    request(judgeAccessContract.accessPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "null",
      },
      body: new URLSearchParams({ code: ACCESS_CODE }),
    }),
    env(),
    { now: () => NOW_MS, rateLimiter: limiter },
  );
  assert.equal(opaqueWorkerOrigin?.status, 303);
  assert.match(opaqueWorkerOrigin?.headers.get("set-cookie") ?? "", /^__Host-cosmography_judge=/);
});

test("expired and tampered cookies cannot open a protected route", async () => {
  const limiter = new MemoryRateLimiter();
  const login = await enforceJudgeAccess(codeSubmission(ACCESS_CODE), env(), {
    now: () => NOW_MS,
    rateLimiter: limiter,
  });
  const cookie = cookieHeader(login?.headers.get("set-cookie") ?? "");

  const expired = await enforceJudgeAccess(
    request("/missions/voyager-1", { headers: { Cookie: cookie } }),
    env(),
    { now: () => NOW_MS + 3_601_000, rateLimiter: limiter },
  );
  assert.equal(expired?.status, 401);

  const tampered = await enforceJudgeAccess(
    request("/", { headers: { Cookie: `${cookie}x` } }),
    env(),
    { now: () => NOW_MS + 1000, rateLimiter: limiter },
  );
  assert.equal(tampered?.status, 401);
});

test("pages, APIs, and static assets are protected before authentication", async () => {
  const navigation = await enforceJudgeAccess(
    request("/", { headers: { Accept: "text/html", "Sec-Fetch-Mode": "navigate" } }),
    env(),
    { now: () => NOW_MS, rateLimiter: new MemoryRateLimiter() },
  );
  assert.equal(navigation?.status, 200);
  assert.match(await navigation!.text(), /Judging access code/);

  for (const pathname of ["/api/health", "/assets/mars/mars-viking-mdim21-global-4096.jpg", "/_next/static/example.js"]) {
    const response = await enforceJudgeAccess(request(pathname), env(), {
      now: () => NOW_MS,
      rateLimiter: new MemoryRateLimiter(),
    });
    assert.equal(response?.status, 401, pathname);
    assert.match(response?.headers.get("cache-control") ?? "", /no-store/);
    assert.match(await response!.text(), /Judging access code/);
  }
});

test("repeated incorrect attempts are limited without changing the error", async () => {
  const limiter = new MemoryRateLimiter();
  for (let ordinal = 0; ordinal < judgeAccessContract.maxFailuresPerWindow + 2; ordinal += 1) {
    const response = await enforceJudgeAccess(codeSubmission(`incorrect-code-${ordinal}`), env(), {
      now: () => NOW_MS + ordinal,
      rateLimiter: limiter,
    });
    assert.equal(response?.status, 200);
    assert.match(await response!.text(), /Access could not be verified/);
  }

  const blockedCorrectCode = await enforceJudgeAccess(codeSubmission(ACCESS_CODE), env(), {
    now: () => NOW_MS + 100,
    rateLimiter: limiter,
  });
  assert.equal(blockedCorrectCode?.status, 200);
  assert.equal(blockedCorrectCode?.headers.get("set-cookie"), null);
});

test("required secret misconfiguration fails closed without exposing details", async () => {
  for (const missing of [
    { JUDGE_ACCESS_MODE: "shared-code" },
    { JUDGE_ACCESS_MODE: "shared-code", JUDGE_ACCESS_CODE: ACCESS_CODE },
    { JUDGE_ACCESS_MODE: "shared-code", JUDGE_COOKIE_SECRET: COOKIE_SECRET },
    { ...env(), JUDGE_COOKIE_TTL_SECONDS: "invalid" },
  ]) {
    const response = await enforceJudgeAccess(request("/"), missing, { now: () => NOW_MS });
    const html = await response?.text();
    assert.equal(response?.status, 503);
    assert.match(html ?? "", /not available right now/);
    assert.doesNotMatch(html ?? "", /JUDGE_|secret|missing/i);
  }
});

test("secret values never appear in browser responses", async () => {
  const loginPage = await enforceJudgeAccess(request(judgeAccessContract.accessPath), env(), {
    now: () => NOW_MS,
  });
  const rejection = await enforceJudgeAccess(codeSubmission("wrong-value-12345"), env(), {
    now: () => NOW_MS,
    rateLimiter: new MemoryRateLimiter(),
  });
  const combined = `${await loginPage!.text()}\n${await rejection!.text()}\n${JSON.stringify([...rejection!.headers])}`;
  assert.doesNotMatch(combined, new RegExp(ACCESS_CODE));
  assert.doesNotMatch(combined, new RegExp(COOKIE_SECRET));
});

test("the contest gate can be disabled through configuration only", async () => {
  const response = await enforceJudgeAccess(request("/assets/example.css"), {
    JUDGE_ACCESS_MODE: "disabled",
  });
  assert.equal(response, null);
});
