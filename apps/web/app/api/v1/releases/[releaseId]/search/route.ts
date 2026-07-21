import { searchReleaseRegistry } from "@/app/lib/releases/catalog";
import {
  releaseScopedJson,
  nextPageLink,
  parseReleaseSearchRequest,
  releaseApiExceptionResponse,
  resolveReleaseRequest,
} from "@/app/lib/server/release-api";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ releaseId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { releaseId } = await context.params;
  const resolved = await resolveReleaseRequest(releaseId);
  if ("response" in resolved) return resolved.response;
  try {
    const input = parseReleaseSearchRequest(request);
    const page = searchReleaseRegistry({ releaseId, ...input });
    return releaseScopedJson(
      request,
      {
        apiVersion: resolved.snapshot.descriptor.apiVersion,
        releaseId,
        schemaVersion: resolved.snapshot.descriptor.schemaVersion,
        derivatives: resolved.snapshot.descriptor.derivatives,
        query: page.query,
        filters: input.filters,
        page: {
          limit: input.limit,
          count: page.count,
          total: page.total,
          nextCursor: page.nextCursor,
        },
        records: page.records,
        links: {
          self: `${new URL(request.url).pathname}${new URL(request.url).search}`,
          next: nextPageLink(request, page.nextCursor),
        },
      },
      releaseId,
    );
  } catch (error) {
    return releaseApiExceptionResponse(error, releaseId);
  }
}
