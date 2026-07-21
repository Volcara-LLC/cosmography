import {
  assertNoQueryParameters,
  releaseScopedJson,
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
    assertNoQueryParameters(request);
    return releaseScopedJson(
      request,
      resolved.snapshot.descriptor,
      releaseId,
    );
  } catch (error) {
    return releaseApiExceptionResponse(error, releaseId);
  }
}
