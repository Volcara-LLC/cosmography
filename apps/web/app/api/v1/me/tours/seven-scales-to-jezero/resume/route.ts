import { and, eq } from "drizzle-orm";

import {
  createStoredTourResumeJson,
  isTourResumeExistingError,
  parseStoredTourResumeRow,
  readTourResumeJson,
  TOUR_RESUME_METRIC_CODE,
  TOUR_RESUME_SCOPE_ENTITY_ID,
  TOUR_RESUME_TIMESTAMP_MAX_MS,
  TourResumeContractError,
  TourResumeDeleteInputSchema,
  tourResumeEnvelope,
  TourResumePutInputSchema,
  TourResumeRequestError,
} from "@/app/lib/personal/tour-resume";
import {
  currentAppUser,
  privateJsonResponse,
  storageErrorResponse,
  unauthenticatedResponse,
} from "@/app/lib/server/identity";
import { userProgress } from "@/db/schema";

export const dynamic = "force-dynamic";

const tourResumeSelection = {
  valueNumeric: userProgress.valueNumeric,
  valueJson: userProgress.valueJson,
  updatedAtMs: userProgress.updatedAtMs,
};

function targetTuple(userId: string) {
  return and(
    eq(userProgress.userId, userId),
    eq(userProgress.scopeEntityId, TOUR_RESUME_SCOPE_ENTITY_ID),
    eq(userProgress.metricCode, TOUR_RESUME_METRIC_CODE),
  );
}

function requestErrorResponse(error: TourResumeRequestError) {
  return privateJsonResponse(
    { error: error.code, message: error.message },
    { status: error.status },
  );
}

function conflictResponse() {
  return privateJsonResponse(
    {
      error: "tour_resume_conflict",
      message:
        "The saved resume point changed in another session. Refresh it before trying again.",
    },
    { status: 409 },
  );
}

function nextSavedAtMs(expectedSavedAtMs: number | null): number | null {
  if (expectedSavedAtMs === null) return Date.now();
  if (expectedSavedAtMs >= TOUR_RESUME_TIMESTAMP_MAX_MS) return null;
  return Math.max(Date.now(), expectedSavedAtMs + 1);
}

export async function GET() {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const { getDb } = await import("@/db");
    const rows = await getDb()
      .select(tourResumeSelection)
      .from(userProgress)
      .where(targetTuple(user.id))
      .limit(2);
    if (rows.length > 1) {
      throw new TourResumeContractError(
        "More than one Seven Scales resume point exists for an owner",
      );
    }
    return privateJsonResponse(
      tourResumeEnvelope(
        rows[0] ? parseStoredTourResumeRow(rows[0]) : null,
      ),
    );
  } catch (error) {
    return storageErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const input = await readTourResumeJson(request);
    const parsed = TourResumePutInputSchema.safeParse(input);
    if (!parsed.success) {
      return privateJsonResponse(
        { error: "invalid_tour_resume", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { getDb } = await import("@/db");
    const db = getDb();
    const { expectedSavedAtMs, resumeOrdinal } = parsed.data;

    if (expectedSavedAtMs === null) {
      const savedAtMs = nextSavedAtMs(null);
      if (savedAtMs === null) return conflictResponse();
      const valueJson = createStoredTourResumeJson(resumeOrdinal, savedAtMs);
      try {
        const [inserted] = await db
          .insert(userProgress)
          .values({
            userId: user.id,
            scopeEntityId: TOUR_RESUME_SCOPE_ENTITY_ID,
            metricCode: TOUR_RESUME_METRIC_CODE,
            valueNumeric: resumeOrdinal,
            valueJson,
            updatedAtMs: savedAtMs,
          })
          .returning(tourResumeSelection);
        if (!inserted) {
          throw new TourResumeContractError(
            "Seven Scales resume insert returned no row",
          );
        }
        return privateJsonResponse(
          tourResumeEnvelope(parseStoredTourResumeRow(inserted)),
          { status: 201 },
        );
      } catch (error) {
        if (isTourResumeExistingError(error)) return conflictResponse();
        throw error;
      }
    }

    const currentRows = await db
      .select(tourResumeSelection)
      .from(userProgress)
      .where(targetTuple(user.id))
      .limit(2);
    if (currentRows.length > 1) {
      throw new TourResumeContractError(
        "More than one Seven Scales resume point exists for an owner",
      );
    }
    const currentRow = currentRows[0];
    if (!currentRow) return conflictResponse();
    const currentRecord = parseStoredTourResumeRow(currentRow);
    if (currentRecord.savedAtMs !== expectedSavedAtMs) {
      return conflictResponse();
    }
    if (currentRow.valueNumeric === null || currentRow.valueJson === null) {
      throw new TourResumeContractError(
        "Stored Seven Scales resume fields are missing",
      );
    }

    const savedAtMs = nextSavedAtMs(expectedSavedAtMs);
    if (savedAtMs === null) return conflictResponse();
    const valueJson = createStoredTourResumeJson(resumeOrdinal, savedAtMs);
    const [updated] = await db
      .update(userProgress)
      .set({
        valueNumeric: resumeOrdinal,
        valueJson,
        updatedAtMs: savedAtMs,
      })
      .where(
        and(
          targetTuple(user.id),
          eq(userProgress.updatedAtMs, currentRow.updatedAtMs),
          eq(userProgress.valueNumeric, currentRow.valueNumeric),
          eq(userProgress.valueJson, currentRow.valueJson),
        ),
      )
      .returning(tourResumeSelection);
    if (!updated) {
      const racedRows = await db
        .select(tourResumeSelection)
        .from(userProgress)
        .where(targetTuple(user.id))
        .limit(2);
      if (racedRows.length > 1) {
        throw new TourResumeContractError(
          "More than one Seven Scales resume point exists for an owner",
        );
      }
      if (racedRows[0]) parseStoredTourResumeRow(racedRows[0]);
      return conflictResponse();
    }
    return privateJsonResponse(
      tourResumeEnvelope(parseStoredTourResumeRow(updated)),
    );
  } catch (error) {
    if (error instanceof TourResumeRequestError) {
      return requestErrorResponse(error);
    }
    return storageErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const input = await readTourResumeJson(request);
    const parsed = TourResumeDeleteInputSchema.safeParse(input);
    if (!parsed.success) {
      return privateJsonResponse(
        { error: "invalid_tour_resume", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { getDb } = await import("@/db");
    const [deleted] = await getDb()
      .delete(userProgress)
      .where(
        and(
          targetTuple(user.id),
          eq(userProgress.updatedAtMs, parsed.data.expectedSavedAtMs),
        ),
      )
      .returning({ updatedAtMs: userProgress.updatedAtMs });
    if (!deleted) return conflictResponse();
    return privateJsonResponse(tourResumeEnvelope(null));
  } catch (error) {
    if (error instanceof TourResumeRequestError) {
      return requestErrorResponse(error);
    }
    return storageErrorResponse(error);
  }
}
