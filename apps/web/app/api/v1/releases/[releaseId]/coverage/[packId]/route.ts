import { CoveragePackIdSchema } from "@cosmography/scientific-model/coverage-pack";

import {
  FOUNDATION_COVERAGE_MANIFEST_CANONICALIZATION,
  FOUNDATION_COVERAGE_MANIFEST_SHA256,
  getReleaseCoveragePack,
  releaseCoverageApiPath,
  releaseCoveragePackApiPath,
  releaseCoverageScenePath,
} from "@/app/lib/releases/coverage";
import {
  assertNoQueryParameters,
  releaseApiError,
  releaseApiExceptionResponse,
  releaseScopedJson,
  resolveReleaseRequest,
} from "@/app/lib/server/release-api";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ releaseId: string; packId: string }>;
};

const ALLOW_METHODS = "GET, HEAD, OPTIONS";

function methodNotAllowed(): Response {
  const response = releaseApiError(
    405,
    "method_not_allowed",
    "This Coverage Pack endpoint is read-only.",
  );
  response.headers.set("Allow", ALLOW_METHODS);
  return response;
}

function headResponse(response: Response): Response {
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export async function GET(request: Request, context: RouteContext) {
  const { releaseId, packId } = await context.params;
  const resolved = await resolveReleaseRequest(releaseId);
  if ("response" in resolved) return resolved.response;
  try {
    assertNoQueryParameters(request);
  } catch (error) {
    return releaseApiExceptionResponse(error, releaseId);
  }
  if (!CoveragePackIdSchema.safeParse(packId).success) {
    return releaseApiError(
      400,
      "invalid_coverage_pack_id",
      "The Coverage Pack identifier is malformed.",
      releaseId,
    );
  }

  let pack;
  try {
    pack = getReleaseCoveragePack(releaseId, packId);
  } catch {
    return releaseApiError(
      503,
      "coverage_integrity_failed",
      "The requested release failed its pinned Coverage Pack integrity check.",
      releaseId,
    );
  }
  if (!pack) {
    return releaseApiError(
      404,
      "coverage_pack_not_found",
      "The Coverage Pack is not a member of the requested immutable release.",
      releaseId,
    );
  }

  return releaseScopedJson(
    request,
    {
      apiVersion: resolved.snapshot.descriptor.apiVersion,
      releaseId,
      schemaVersion: resolved.snapshot.descriptor.schemaVersion,
      coveragePackVersion: pack.schemaVersion,
      projectionVersion: "coverage-pack-v1",
      coverageManifest: {
        canonicalization: FOUNDATION_COVERAGE_MANIFEST_CANONICALIZATION,
        sha256: FOUNDATION_COVERAGE_MANIFEST_SHA256,
      },
      pack,
      links: {
        self: releaseCoveragePackApiPath(releaseId, pack.packId),
        collection: releaseCoverageApiPath(releaseId),
        scene: releaseCoverageScenePath(pack.coverageKey),
      },
    },
    releaseId,
    {
      "X-Cosmography-Coverage-Version": "coverage-pack-v1",
      "X-Cosmography-Coverage-Record-ETag": pack.etag,
      "X-Cosmography-Coverage-Sha256": pack.packSha256,
      "X-Cosmography-Coverage-Manifest-Sha256":
        FOUNDATION_COVERAGE_MANIFEST_SHA256,
      "X-Cosmography-Coverage-Manifest-Canonicalization":
        FOUNDATION_COVERAGE_MANIFEST_CANONICALIZATION,
    },
  );
}

export async function HEAD(request: Request, context: RouteContext) {
  return headResponse(await GET(request, context));
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: ALLOW_METHODS,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function POST() {
  return methodNotAllowed();
}

export function PUT() {
  return methodNotAllowed();
}

export function PATCH() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}
