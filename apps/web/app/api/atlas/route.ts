import { atlasEntities, atlasRelease } from "@/app/data/atlas";
import { normalizeSearchQuery } from "@/app/lib/releases/catalog";
import { AtlasSectionSchema } from "@/app/lib/science/scene";
import {
  ReleaseApiRequestError,
  releaseScopedJson,
  releaseApiExceptionResponse,
  resolveReleaseRequest,
} from "@/app/lib/server/release-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const allowedParameters = new Set(["release", "q", "section"]);
  try {
    for (const name of new Set(parameters.keys())) {
      if (!allowedParameters.has(name)) {
        throw new ReleaseApiRequestError(
          "unknown_parameter",
          "The request contains an unsupported query parameter.",
        );
      }
      if (parameters.getAll(name).length > 1) {
        throw new ReleaseApiRequestError(
          "duplicate_parameter",
          `Query parameter \`${name}\` may appear only once.`,
        );
      }
    }
    const releaseId = parameters.get("release");
    if (!releaseId) {
      throw new ReleaseApiRequestError(
        "release_required",
        "The compatibility endpoint requires an explicit `release` parameter.",
      );
    }
    const resolved = await resolveReleaseRequest(releaseId);
    if ("response" in resolved) return resolved.response;

    const rawQuery = parameters.get("q")?.trim() ?? "";
    const query = rawQuery ? normalizeSearchQuery(rawQuery) : "";
    const rawSection = parameters.get("section");
    const parsedSection = rawSection
      ? AtlasSectionSchema.safeParse(rawSection)
      : undefined;
    if (parsedSection && !parsedSection.success) {
      throw new ReleaseApiRequestError(
        "invalid_filter",
        "The requested atlas section is not recognized.",
      );
    }
    const section = parsedSection?.data;
    const records = atlasEntities.filter((entity) => {
      const matchesSection = !section || entity.section === section;
      const searchable = [entity.name, entity.subtitle, entity.kind, ...entity.tags]
        .join(" ")
        .normalize("NFKC")
        .toLowerCase();
      return matchesSection && (!query || searchable.includes(query));
    });

    return releaseScopedJson(
      request,
      {
        apiVersion: "v1",
        releaseId,
        schemaVersion: resolved.snapshot.descriptor.schemaVersion,
        derivatives: resolved.snapshot.descriptor.derivatives,
        count: records.length,
        records,
        warning: atlasRelease.warning,
      },
      releaseId,
      {
        Deprecation: "true",
        Link: `</api/v1/releases/${releaseId}/registry>; rel="successor-version"`,
      },
    );
  } catch (error) {
    return releaseApiExceptionResponse(error);
  }
}
