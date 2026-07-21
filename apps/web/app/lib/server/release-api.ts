import {
  RegistryFilterSchema,
  RELEASE_API_VERSION,
  RELEASE_REGISTRY_PROJECTION_VERSION,
  RELEASE_SEARCH_RANKER_VERSION,
  ReleaseIdSchema,
  ReleaseRegistryQueryError,
  assertReleaseBundleIntegrity,
  getReleaseSnapshot,
  type RegistryFilters,
} from "@/app/lib/releases/catalog";

export class ReleaseApiRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ReleaseApiRequestError";
    this.code = code;
  }
}

export type ReleasePageRequest = Readonly<{
  filters: RegistryFilters;
  limit: number;
  cursor?: string;
}>;

export type ReleaseSearchRequest = ReleasePageRequest &
  Readonly<{ query: string }>;

const filterNames = ["section", "domain", "kind", "evidence"] as const;

function onlyParameter(
  parameters: URLSearchParams,
  name: string,
): string | undefined {
  const values = parameters.getAll(name);
  if (values.length > 1) {
    throw new ReleaseApiRequestError(
      "duplicate_parameter",
      `Query parameter \`${name}\` may appear only once.`,
    );
  }
  return values[0];
}

function assertAllowedParameters(
  parameters: URLSearchParams,
  allowed: ReadonlySet<string>,
): void {
  for (const name of new Set(parameters.keys())) {
    if (!allowed.has(name)) {
      throw new ReleaseApiRequestError(
        "unknown_parameter",
        "The request contains an unsupported query parameter.",
      );
    }
  }
}

function parseFilters(parameters: URLSearchParams): RegistryFilters {
  const values = Object.fromEntries(
    filterNames.flatMap((name) => {
      const value = onlyParameter(parameters, name);
      return value === undefined ? [] : [[name, value]];
    }),
  );
  const parsed = RegistryFilterSchema.safeParse(values);
  if (!parsed.success) {
    throw new ReleaseApiRequestError(
      "invalid_filter",
      "One or more registry filters are not recognized.",
    );
  }
  return parsed.data;
}

function parseLimit(parameters: URLSearchParams): number {
  const value = onlyParameter(parameters, "limit");
  if (value === undefined) return 20;
  if (!/^(?:[1-9]|[1-4][0-9]|50)$/u.test(value)) {
    throw new ReleaseApiRequestError(
      "invalid_limit",
      "The page limit must be an integer from 1 through 50.",
    );
  }
  return Number(value);
}

function parseCursor(parameters: URLSearchParams): string | undefined {
  const cursor = onlyParameter(parameters, "cursor");
  if (cursor === undefined) return undefined;
  if (!cursor || cursor.length > 2048) {
    throw new ReleaseApiRequestError(
      "invalid_cursor",
      "The pagination cursor is malformed.",
    );
  }
  return cursor;
}

export function parseReleasePageRequest(request: Request): ReleasePageRequest {
  const parameters = new URL(request.url).searchParams;
  assertAllowedParameters(
    parameters,
    new Set([...filterNames, "limit", "cursor"]),
  );
  const cursor = parseCursor(parameters);
  return {
    filters: parseFilters(parameters),
    limit: parseLimit(parameters),
    ...(cursor ? { cursor } : {}),
  };
}

export function parseReleaseSearchRequest(
  request: Request,
): ReleaseSearchRequest {
  const parameters = new URL(request.url).searchParams;
  assertAllowedParameters(
    parameters,
    new Set(["q", ...filterNames, "limit", "cursor"]),
  );
  const query = onlyParameter(parameters, "q");
  if (query === undefined) {
    throw new ReleaseApiRequestError(
      "query_required",
      "Query parameter `q` is required.",
    );
  }
  const cursor = parseCursor(parameters);
  return {
    query,
    filters: parseFilters(parameters),
    limit: parseLimit(parameters),
    ...(cursor ? { cursor } : {}),
  };
}

export function assertNoQueryParameters(request: Request): void {
  const parameters = new URL(request.url).searchParams;
  assertAllowedParameters(parameters, new Set());
}

export async function resolveReleaseRequest(releaseId: string) {
  if (!ReleaseIdSchema.safeParse(releaseId).success) {
    return {
      response: releaseApiError(
        400,
        "invalid_release_id",
        "The release identifier is malformed.",
      ),
    } as const;
  }
  const snapshot = getReleaseSnapshot(releaseId);
  if (!snapshot) {
    return {
      response: releaseApiError(
        404,
        "release_not_found",
        "The requested immutable release is not available.",
        releaseId,
      ),
    } as const;
  }
  try {
    await assertReleaseBundleIntegrity(releaseId);
  } catch {
    return {
      response: releaseApiError(
        503,
        "release_integrity_failed",
        "The requested release failed its embedded content-integrity check.",
        releaseId,
      ),
    } as const;
  }
  return { snapshot } as const;
}

export function releaseApiError(
  status: number,
  code: string,
  message: string,
  releaseId?: string,
): Response {
  return Response.json(
    {
      apiVersion: RELEASE_API_VERSION,
      ...(releaseId ? { releaseId } : {}),
      error: { code, message },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export function releaseApiExceptionResponse(
  error: unknown,
  releaseId?: string,
): Response {
  if (
    error instanceof ReleaseApiRequestError ||
    error instanceof ReleaseRegistryQueryError
  ) {
    const status = error.code === "release_not_found" ? 404 : 400;
    return releaseApiError(status, error.code, error.message, releaseId);
  }
  return releaseApiError(
    500,
    "registry_unavailable",
    "The immutable release registry is temporarily unavailable.",
    releaseId,
  );
}

function hex(bytes: Uint8Array): string {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function matchesIfNoneMatch(value: string | null, etag: string): boolean {
  if (!value) return false;
  return value.split(",").some((candidate) => {
    const tag = candidate.trim();
    return tag === "*" || tag === etag || tag === `W/${etag}`;
  });
}

export async function releaseScopedJson(
  request: Request,
  payload: unknown,
  releaseId: string,
  extraHeaders: HeadersInit = {},
): Promise<Response> {
  const body = JSON.stringify(payload);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)),
  );
  const etag = `"${releaseId}:${hex(digest)}"`;
  const requestUrl = new URL(request.url);
  const headers = new Headers(extraHeaders);
  headers.set(
    "Cache-Control",
    "public, max-age=60, s-maxage=300, stale-while-revalidate=60",
  );
  headers.set("Content-Digest", `sha-256=:${base64(digest)}:`);
  headers.set("Content-Location", `${requestUrl.pathname}${requestUrl.search}`);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("ETag", etag);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Cosmography-Release-Id", releaseId);
  headers.set(
    "X-Cosmography-Registry-Version",
    RELEASE_REGISTRY_PROJECTION_VERSION,
  );
  headers.set(
    "X-Cosmography-Search-Version",
    RELEASE_SEARCH_RANKER_VERSION,
  );
  if (matchesIfNoneMatch(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { status: 200, headers });
}

export function nextPageLink(
  request: Request,
  cursor: string | null,
): string | null {
  if (!cursor) return null;
  const url = new URL(request.url);
  url.searchParams.set("cursor", cursor);
  return `${url.pathname}${url.search}`;
}
