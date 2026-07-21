import { and, eq } from "drizzle-orm";
import {
  parseStoredSpacecraftRow,
  readSpacecraftJson,
  spacecraftEnvelope,
  SpacecraftIdSchema,
  spacecraftPatchChangesRecord,
  SpacecraftPatchInputSchema,
  SpacecraftRequestError,
} from "@/app/lib/personal/spacecraft";
import {
  currentAppUser,
  privateJsonResponse,
  storageErrorResponse,
  unauthenticatedResponse,
} from "@/app/lib/server/identity";
import { propulsionModels, userSpacecraft } from "@/db/schema";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ spacecraftId: string }>;
};

const spacecraftSelection = {
  id: userSpacecraft.id,
  displayName: userSpacecraft.displayName,
  propulsionModelId: userSpacecraft.propulsionModelId,
  cosmeticsJson: userSpacecraft.cosmeticsJson,
  createdAtMs: userSpacecraft.createdAtMs,
  updatedAtMs: userSpacecraft.updatedAtMs,
  modelId: propulsionModels.id,
  modelCode: propulsionModels.code,
  modelVersion: propulsionModels.version,
  modelClass: propulsionModels.modelClass,
  modelTitle: propulsionModels.title,
  modelDistanceDefinition: propulsionModels.distanceDefinition,
  modelDefinitionJson: propulsionModels.definitionJson,
  modelEvidenceClass: propulsionModels.evidenceClass,
  modelCitationAssertionId: propulsionModels.citationAssertionId,
};

function requestErrorResponse(error: SpacecraftRequestError) {
  return privateJsonResponse(
    { error: error.code, message: error.message },
    { status: error.status },
  );
}

function notFoundResponse() {
  return privateJsonResponse({ error: "not_found" }, { status: 404 });
}

function conflictResponse() {
  return privateJsonResponse(
    {
      error: "spacecraft_conflict",
      message: "This spacecraft concept changed after it was opened. Refresh and try again.",
    },
    { status: 409 },
  );
}

async function pathSpacecraftId(context: RouteContext) {
  const { spacecraftId } = await context.params;
  return SpacecraftIdSchema.safeParse(spacecraftId);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const idResult = await pathSpacecraftId(context);
    if (!idResult.success) {
      return privateJsonResponse(
        { error: "valid_spacecraft_id_required" },
        { status: 400 },
      );
    }
    const input = await readSpacecraftJson(request);
    const parsed = SpacecraftPatchInputSchema.safeParse(input);
    if (!parsed.success) {
      return privateJsonResponse(
        { error: "invalid_spacecraft_patch", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { getDb } = await import("@/db");
    const db = getDb();
    const [storedRow] = await db
      .select(spacecraftSelection)
      .from(userSpacecraft)
      .leftJoin(
        propulsionModels,
        eq(propulsionModels.id, userSpacecraft.propulsionModelId),
      )
      .where(
        and(
          eq(userSpacecraft.id, idResult.data),
          eq(userSpacecraft.userId, user.id),
        ),
      )
      .limit(1);
    if (!storedRow) return notFoundResponse();
    const current = parseStoredSpacecraftRow(storedRow);
    if (current.updatedAtMs !== parsed.data.expectedUpdatedAtMs) {
      return conflictResponse();
    }
    const nextDisplayName = parsed.data.displayName ?? current.displayName;
    const nextAppearance = parsed.data.appearance ?? current.appearance;
    if (!spacecraftPatchChangesRecord(current, parsed.data)) {
      return privateJsonResponse(
        {
          error: "spacecraft_no_change",
          message: "Change the name or appearance before saving.",
        },
        { status: 400 },
      );
    }
    if (current.updatedAtMs >= Number.MAX_SAFE_INTEGER) {
      throw new Error("spacecraft_timestamp_exhausted");
    }

    const nextUpdatedAtMs = Math.max(Date.now(), current.updatedAtMs + 1);
    const [updated] = await db
      .update(userSpacecraft)
      .set({
        displayName: nextDisplayName,
        cosmeticsJson: JSON.stringify(nextAppearance),
        updatedAtMs: nextUpdatedAtMs,
      })
      .where(
        and(
          eq(userSpacecraft.id, idResult.data),
          eq(userSpacecraft.userId, user.id),
          eq(userSpacecraft.updatedAtMs, parsed.data.expectedUpdatedAtMs),
        ),
      )
      .returning({
        id: userSpacecraft.id,
        displayName: userSpacecraft.displayName,
        propulsionModelId: userSpacecraft.propulsionModelId,
        cosmeticsJson: userSpacecraft.cosmeticsJson,
        createdAtMs: userSpacecraft.createdAtMs,
        updatedAtMs: userSpacecraft.updatedAtMs,
      });

    if (!updated) {
      const [stillOwned] = await db
        .select({ id: userSpacecraft.id })
        .from(userSpacecraft)
        .where(
          and(
            eq(userSpacecraft.id, idResult.data),
            eq(userSpacecraft.userId, user.id),
          ),
        )
        .limit(1);
      return stillOwned ? conflictResponse() : notFoundResponse();
    }

    const record = parseStoredSpacecraftRow({
      ...updated,
      modelId: storedRow.modelId,
      modelCode: storedRow.modelCode,
      modelVersion: storedRow.modelVersion,
      modelClass: storedRow.modelClass,
      modelTitle: storedRow.modelTitle,
      modelDistanceDefinition: storedRow.modelDistanceDefinition,
      modelDefinitionJson: storedRow.modelDefinitionJson,
      modelEvidenceClass: storedRow.modelEvidenceClass,
      modelCitationAssertionId: storedRow.modelCitationAssertionId,
    });
    return privateJsonResponse(spacecraftEnvelope(record));
  } catch (error) {
    if (error instanceof SpacecraftRequestError) {
      return requestErrorResponse(error);
    }
    return storageErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const idResult = await pathSpacecraftId(context);
    if (!idResult.success) {
      return privateJsonResponse(
        { error: "valid_spacecraft_id_required" },
        { status: 400 },
      );
    }

    const { getDb } = await import("@/db");
    const [deleted] = await getDb()
      .delete(userSpacecraft)
      .where(
        and(
          eq(userSpacecraft.id, idResult.data),
          eq(userSpacecraft.userId, user.id),
        ),
      )
      .returning({ id: userSpacecraft.id });
    if (!deleted) return notFoundResponse();
    return privateJsonResponse(spacecraftEnvelope(deleted));
  } catch (error) {
    return storageErrorResponse(error);
  }
}
