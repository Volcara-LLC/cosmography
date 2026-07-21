import { and, desc, eq, sql } from "drizzle-orm";

import {
  createSavedPlaceSceneJson,
  isSavedPlaceExistingError,
  parseStoredSavedPlaceRow,
  readSavedPlaceJson,
  SAVED_PLACE_OWNER_LIMIT,
  SAVED_PLACE_RELEASE_ID,
  SAVED_PLACE_TIMESTAMP_MAX_MS,
  SavedPlaceContractError,
  SavedPlaceDeleteInputSchema,
  savedPlaceEnvelope,
  SavedPlaceInputSchema,
  SavedPlaceRequestError,
  savedPlaceStorageValues,
} from "@/app/lib/personal/saved-places";
import { assertReleaseBundleIntegrity } from "@/app/lib/releases/catalog";
import {
  currentAppUser,
  privateJsonResponse,
  storageErrorResponse,
  unauthenticatedResponse,
} from "@/app/lib/server/identity";
import { bookmarks } from "@/db/schema";

export const dynamic = "force-dynamic";

const savedPlaceSelection = {
  id: bookmarks.id,
  contractVersion: bookmarks.contractVersion,
  entityId: bookmarks.entityId,
  navigationTargetId: bookmarks.navigationTargetId,
  releaseId: bookmarks.releaseId,
  label: bookmarks.label,
  sceneJson: bookmarks.sceneJson,
  sceneR2Key: bookmarks.sceneR2Key,
  createdAtMs: bookmarks.createdAtMs,
};

const savedPlaceTriggerNames = [
  "trg_bookmarks_saved_place_insert",
  "trg_bookmarks_saved_place_update",
] as const;

type Database = ReturnType<(typeof import("@/db"))["getDb"]>;

async function assertSavedPlaceStorageMigration(db: Database): Promise<void> {
  const rows = await db.all<{ name: unknown }>(sql`
    select name
    from sqlite_master
    where type = 'trigger'
      and tbl_name = 'bookmarks'
      and name in (
        'trg_bookmarks_saved_place_insert',
        'trg_bookmarks_saved_place_update'
      )
    order by name
  `);
  if (
    rows.length !== savedPlaceTriggerNames.length ||
    rows.some((row, index) => row.name !== savedPlaceTriggerNames[index])
  ) {
    throw new SavedPlaceContractError(
      "Saved-place storage migration is unavailable",
    );
  }
}

function requestErrorResponse(error: SavedPlaceRequestError) {
  return privateJsonResponse(
    { error: error.code, message: error.message },
    { status: error.status },
  );
}

function queryParametersResponse(request: Request): Response | null {
  if ([...new URL(request.url).searchParams.keys()].length === 0) return null;
  return privateJsonResponse(
    {
      error: "query_parameters_not_allowed",
      message: "This saved-place endpoint does not accept query parameters.",
    },
    { status: 400 },
  );
}

function conflictResponse() {
  return privateJsonResponse(
    {
      error: "saved_place_conflict",
      message: "The saved place changed. Reload it before trying again.",
    },
    { status: 409 },
  );
}

function notFoundResponse() {
  return privateJsonResponse({ error: "not_found" }, { status: 404 });
}

export async function GET(request: Request) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const queryError = queryParametersResponse(request);
    if (queryError) return queryError;

    await assertReleaseBundleIntegrity(SAVED_PLACE_RELEASE_ID);
    const { getDb } = await import("@/db");
    const db = getDb();
    await assertSavedPlaceStorageMigration(db);
    const rows = await db
      .select(savedPlaceSelection)
      .from(bookmarks)
      .where(eq(bookmarks.userId, user.id))
      .orderBy(desc(bookmarks.createdAtMs), desc(bookmarks.id))
      .limit(SAVED_PLACE_OWNER_LIMIT + 1);
    if (rows.length > SAVED_PLACE_OWNER_LIMIT) {
      throw new SavedPlaceContractError(
        "Stored saved-place owner limit has drifted",
      );
    }
    return privateJsonResponse(
      savedPlaceEnvelope(rows.map(parseStoredSavedPlaceRow)),
    );
  } catch (error) {
    return storageErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const queryError = queryParametersResponse(request);
    if (queryError) return queryError;

    const input = await readSavedPlaceJson(request);
    const parsed = SavedPlaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return privateJsonResponse(
        { error: "invalid_saved_place", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    await assertReleaseBundleIntegrity(SAVED_PLACE_RELEASE_ID);
    const values = savedPlaceStorageValues(parsed.data);
    const { getDb } = await import("@/db");
    const db = getDb();
    await assertSavedPlaceStorageMigration(db);

    const updateExisting = async () => {
      const [existing] = await db
        .select(savedPlaceSelection)
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, user.id),
            eq(bookmarks.entityId, values.entityId),
            eq(bookmarks.releaseId, SAVED_PLACE_RELEASE_ID),
          ),
        )
        .limit(1);
      if (!existing) return { state: "missing" } as const;

      const current = parseStoredSavedPlaceRow(existing);
      const savedAtMs = Math.max(Date.now(), current.savedAtMs + 1);
      if (
        !Number.isSafeInteger(savedAtMs) ||
        savedAtMs > SAVED_PLACE_TIMESTAMP_MAX_MS
      ) {
        throw new SavedPlaceContractError(
          "Saved-place timestamp cannot advance safely",
        );
      }

      const [updated] = await db
        .update(bookmarks)
        .set({
          navigationTargetId: values.navigationTargetId,
          label: values.label,
          sceneJson: createSavedPlaceSceneJson(
            values.entityId,
            parsed.data.appearance,
            savedAtMs,
          ),
          sceneR2Key: null,
          createdAtMs: savedAtMs,
        })
        .where(
          and(
            eq(bookmarks.id, existing.id),
            eq(bookmarks.userId, user.id),
            eq(bookmarks.entityId, values.entityId),
            eq(bookmarks.releaseId, SAVED_PLACE_RELEASE_ID),
            eq(bookmarks.createdAtMs, current.savedAtMs),
          ),
        )
        .returning(savedPlaceSelection);
      if (!updated) return { state: "raced" } as const;
      return { state: "updated", row: updated } as const;
    };

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const updateResult = await updateExisting();
      if (updateResult.state === "updated") {
        return privateJsonResponse(
          savedPlaceEnvelope(parseStoredSavedPlaceRow(updateResult.row)),
        );
      }

      if (updateResult.state === "missing") {
        const savedAtMs = Date.now();
        try {
          const [inserted] = await db
            .insert(bookmarks)
            .values({
              id: `bmk_${crypto.randomUUID().replaceAll("-", "")}`,
              userId: user.id,
              contractVersion: values.contractVersion,
              entityId: values.entityId,
              navigationTargetId: values.navigationTargetId,
              releaseId: SAVED_PLACE_RELEASE_ID,
              label: values.label,
              sceneJson: createSavedPlaceSceneJson(
                values.entityId,
                parsed.data.appearance,
                savedAtMs,
              ),
              sceneR2Key: null,
              createdAtMs: savedAtMs,
            })
            .returning(savedPlaceSelection);
          if (!inserted) {
            throw new SavedPlaceContractError(
              "Saved-place insert returned no row",
            );
          }
          return privateJsonResponse(
            savedPlaceEnvelope(parseStoredSavedPlaceRow(inserted)),
            { status: 201 },
          );
        } catch (error) {
          if (!isSavedPlaceExistingError(error)) throw error;
        }
      }
    }

    throw new SavedPlaceContractError(
      "Concurrent saved-place write could not be resolved",
    );
  } catch (error) {
    if (error instanceof SavedPlaceRequestError) {
      return requestErrorResponse(error);
    }
    return storageErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const queryError = queryParametersResponse(request);
    if (queryError) return queryError;

    const input = await readSavedPlaceJson(request);
    const parsed = SavedPlaceDeleteInputSchema.safeParse(input);
    if (!parsed.success) {
      return privateJsonResponse(
        { error: "invalid_saved_place_delete", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    await assertReleaseBundleIntegrity(SAVED_PLACE_RELEASE_ID);
    const { getDb } = await import("@/db");
    const db = getDb();
    await assertSavedPlaceStorageMigration(db);
    const [row] = await db
      .select(savedPlaceSelection)
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.id, parsed.data.id),
          eq(bookmarks.userId, user.id),
        ),
      )
      .limit(1);
    if (!row) return notFoundResponse();
    const record = parseStoredSavedPlaceRow(row);
    if (record.savedAtMs !== parsed.data.expectedSavedAtMs) {
      return conflictResponse();
    }

    const [deleted] = await db
      .delete(bookmarks)
      .where(
        and(
          eq(bookmarks.id, parsed.data.id),
          eq(bookmarks.userId, user.id),
          eq(bookmarks.createdAtMs, parsed.data.expectedSavedAtMs),
        ),
      )
      .returning({ id: bookmarks.id });
    if (!deleted) return conflictResponse();
    return privateJsonResponse(
      savedPlaceEnvelope({ deletedId: deleted.id }),
    );
  } catch (error) {
    if (error instanceof SavedPlaceRequestError) {
      return requestErrorResponse(error);
    }
    return storageErrorResponse(error);
  }
}
