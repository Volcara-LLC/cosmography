import { getReleaseRegistryRecord } from "@/app/lib/releases/catalog";
import { AtlasNavigationIdSchema } from "@/app/lib/science/scene";
import {
  assertNoQueryParameters,
  releaseScopedJson,
  releaseApiError,
  releaseApiExceptionResponse,
  resolveReleaseRequest,
} from "@/app/lib/server/release-api";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ releaseId: string; entityId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { releaseId, entityId } = await context.params;
  const resolved = await resolveReleaseRequest(releaseId);
  if ("response" in resolved) return resolved.response;
  try {
    assertNoQueryParameters(request);
    if (!AtlasNavigationIdSchema.safeParse(entityId).success) {
      return releaseApiError(
        400,
        "invalid_entity_id",
        "The registry entity identifier is malformed.",
        releaseId,
      );
    }
    const record = getReleaseRegistryRecord(releaseId, entityId);
    if (!record) {
      return releaseApiError(
        404,
        "entity_not_found",
        "The entity is not a member of the requested immutable release.",
        releaseId,
      );
    }
    const sourceIds = new Set(record.sourceIds);
    return releaseScopedJson(
      request,
      {
        apiVersion: resolved.snapshot.descriptor.apiVersion,
        releaseId,
        schemaVersion: resolved.snapshot.descriptor.schemaVersion,
        derivatives: resolved.snapshot.descriptor.derivatives,
        record,
        sources: resolved.snapshot.descriptor.sources.filter((source) =>
          sourceIds.has(source.id),
        ),
      },
      releaseId,
    );
  } catch (error) {
    return releaseApiExceptionResponse(error, releaseId);
  }
}
