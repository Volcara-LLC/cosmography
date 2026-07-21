import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { appUsers, authIdentities } from "@/db/schema";

const PROVIDER = "chatgpt-si-wc";

type RuntimeEnv = {
  IDENTITY_HMAC_SECRET?: string;
  IDENTITY_HMAC_KEY_VERSION?: string;
  IDENTITY_HMAC_PREVIOUS_SECRET?: string;
  IDENTITY_HMAC_PREVIOUS_KEY_VERSION?: string;
};

type IdentityKey = {
  version: string;
  secret: string;
};

const DEFAULT_KEY_VERSION = "v1";
const KEY_VERSION_PATTERN = /^[A-Za-z0-9._-]{1,32}$/;
const EXAMPLE_SECRET = "replace-with-a-random-secret-of-at-least-32-characters";

class IdentityConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityConfigurationError";
  }
}

class IdentityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityConflictError";
  }
}

function userId() {
  return `usr_${crypto.randomUUID().replaceAll("-", "")}`;
}

function normalizeSubject(subject: string): string {
  const normalizedSubject = subject.trim().toLowerCase();
  if (!normalizedSubject || normalizedSubject.length > 320) {
    throw new Error("identity_subject_invalid");
  }
  return normalizedSubject;
}

function validateIdentityKey(key: IdentityKey, label: string): IdentityKey {
  if (key.secret === EXAMPLE_SECRET) {
    throw new IdentityConfigurationError(
      `${label}_SECRET must not use the documented example placeholder.`,
    );
  }
  if (key.secret.length < 32) {
    throw new IdentityConfigurationError(
      `${label}_SECRET must contain at least 32 characters.`,
    );
  }
  if (!KEY_VERSION_PATTERN.test(key.version)) {
    throw new IdentityConfigurationError(`${label}_KEY_VERSION is invalid.`);
  }
  return key;
}

async function identityKeyring(): Promise<readonly [IdentityKey, IdentityKey?]> {
  const { env } = await import("cloudflare:workers");
  const runtime = env as RuntimeEnv;
  if (!runtime.IDENTITY_HMAC_SECRET) {
    throw new IdentityConfigurationError(
      "IDENTITY_HMAC_SECRET must be configured with at least 32 characters before authenticated user data can be stored.",
    );
  }

  const current = validateIdentityKey(
    {
      version: runtime.IDENTITY_HMAC_KEY_VERSION || DEFAULT_KEY_VERSION,
      secret: runtime.IDENTITY_HMAC_SECRET,
    },
    "IDENTITY_HMAC",
  );
  const hasPreviousSecret = Boolean(runtime.IDENTITY_HMAC_PREVIOUS_SECRET);
  const hasPreviousVersion = Boolean(runtime.IDENTITY_HMAC_PREVIOUS_KEY_VERSION);
  if (hasPreviousSecret !== hasPreviousVersion) {
    throw new IdentityConfigurationError(
      "IDENTITY_HMAC_PREVIOUS_SECRET and IDENTITY_HMAC_PREVIOUS_KEY_VERSION must be configured together.",
    );
  }
  if (!runtime.IDENTITY_HMAC_PREVIOUS_SECRET || !runtime.IDENTITY_HMAC_PREVIOUS_KEY_VERSION) {
    return [current];
  }

  const previous = validateIdentityKey(
    {
      version: runtime.IDENTITY_HMAC_PREVIOUS_KEY_VERSION,
      secret: runtime.IDENTITY_HMAC_PREVIOUS_SECRET,
    },
    "IDENTITY_HMAC_PREVIOUS",
  );
  if (previous.version === current.version) {
    throw new IdentityConfigurationError(
      "Current and previous identity HMAC key versions must differ.",
    );
  }
  return [current, previous];
}

async function hmacSubject(normalizedSubject: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(normalizedSubject),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function currentAppUser() {
  const identity = await getChatGPTUser();
  if (!identity) return null;

  const normalizedSubject = normalizeSubject(identity.email);
  const keyring = await identityKeyring();
  const candidates = await Promise.all(
    keyring.map(async (key) => ({
      ...key,
      subjectHmac: await hmacSubject(normalizedSubject, key.secret),
    })),
  );
  const currentIdentity = candidates[0];
  if (!currentIdentity) {
    throw new IdentityConfigurationError("The current identity key is unavailable.");
  }
  const displayName =
    identity.fullName?.trim().slice(0, 120) || "Cosmography explorer";
  const { getDb } = await import("@/db");
  const db = getDb();
  const lookupIdentity = async (candidate: (typeof candidates)[number]) => {
    const [match] = await db
      .select({ id: appUsers.id, status: appUsers.status })
      .from(authIdentities)
      .innerJoin(appUsers, eq(appUsers.id, authIdentities.userId))
      .where(
        and(
          eq(authIdentities.provider, PROVIDER),
          eq(authIdentities.keyVersion, candidate.version),
          eq(authIdentities.subjectHmac, candidate.subjectHmac),
        ),
      )
      .limit(1);
    return match;
  };
  const matches: Array<{
    id: string;
    status: string;
    keyVersion: string;
  }> = [];
  for (const candidate of candidates) {
    const match = await lookupIdentity(candidate);
    if (match) matches.push({ ...match, keyVersion: candidate.version });
  }
  if (new Set(matches.map(({ id }) => id)).size > 1) {
    throw new IdentityConflictError(
      "Identity key versions resolve to different application users.",
    );
  }
  const existing = matches[0];

  if (existing) {
    if (existing.status !== "active") {
      throw new Error("account_not_active");
    }
    const updateExistingUser = () =>
      db
        .update(appUsers)
        .set({ displayName, lastSeenAtMs: Date.now() })
        .where(and(eq(appUsers.id, existing.id), eq(appUsers.status, "active")));
    if (existing.keyVersion !== currentIdentity.version) {
      try {
        await db.batch([
          db.insert(authIdentities).values({
            userId: existing.id,
            provider: PROVIDER,
            keyVersion: currentIdentity.version,
            subjectHmac: currentIdentity.subjectHmac,
            createdAtMs: Date.now(),
          }),
          updateExistingUser(),
        ]);
      } catch (error) {
        const winner = await lookupIdentity(currentIdentity);
        if (!winner) throw error;
        if (winner.id !== existing.id) {
          throw new IdentityConflictError(
            "The rotated identity is already linked to a different application user.",
          );
        }
        if (winner.status !== "active") throw new Error("account_not_active");
        await updateExistingUser();
      }
    } else {
      await updateExistingUser();
    }
    return { id: existing.id, displayName };
  }

  const id = userId();
  try {
    await db.batch([
      db.insert(appUsers).values({
        id,
        displayName,
        createdAtMs: Date.now(),
        lastSeenAtMs: Date.now(),
      }),
      db.insert(authIdentities).values({
        userId: id,
        provider: PROVIDER,
        keyVersion: currentIdentity.version,
        subjectHmac: currentIdentity.subjectHmac,
        createdAtMs: Date.now(),
      }),
    ]);
  } catch (error) {
    const winner = await lookupIdentity(currentIdentity);
    if (!winner) throw error;
    if (winner.status !== "active") throw new Error("account_not_active");
    await db
      .update(appUsers)
      .set({ displayName, lastSeenAtMs: Date.now() })
      .where(and(eq(appUsers.id, winner.id), eq(appUsers.status, "active")));
    return { id: winner.id, displayName };
  }

  return { id, displayName };
}

export function privateJsonResponse(body: unknown, init: ResponseInit = {}) {
  const responseHeaders = new Headers(init.headers);
  responseHeaders.set("Cache-Control", "private, no-store, max-age=0");
  responseHeaders.set("Pragma", "no-cache");
  return Response.json(body, { ...init, headers: responseHeaders });
}

export function unauthenticatedResponse() {
  return privateJsonResponse(
    {
      error: "sign_in_required",
      message: "Sign in before saving personal exploration data.",
      signInPath: "/signin-with-chatgpt?return_to=%2F",
    },
    { status: 401 },
  );
}

export function storageErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected storage error";
  const migrationMissing = message.includes("no such table");
  const identityNotConfigured =
    error instanceof IdentityConfigurationError || message.includes("IDENTITY_HMAC_");
  const identityConflict = error instanceof IdentityConflictError;
  const databaseBindingMissing = message.includes("D1 binding");
  const accountNotActive = message === "account_not_active";
  const invalidIdentity = message === "identity_subject_invalid";
  if (accountNotActive) {
    return privateJsonResponse(
      { error: "account_not_active", message: "This account cannot save personal data." },
      { status: 403 },
    );
  }
  return privateJsonResponse(
    {
      error: migrationMissing
        ? "database_not_migrated"
        : identityNotConfigured
          ? "identity_not_configured"
          : identityConflict
            ? "identity_conflict"
            : databaseBindingMissing
              ? "database_binding_unavailable"
              : invalidIdentity
                ? "identity_invalid"
                : "storage_unavailable",
      message: migrationMissing
        ? "Cosmography's D1 schema has not been applied to this environment."
        : identityNotConfigured
          ? "Authenticated storage is not configured in this environment."
          : identityConflict
            ? "This identity could not be linked safely. No personal data was changed."
            : databaseBindingMissing
              ? "Cosmography's database binding is unavailable in this environment."
              : invalidIdentity
                ? "The authenticated identity could not be accepted."
                : "Personal storage is temporarily unavailable.",
    },
    { status: 503 },
  );
}
