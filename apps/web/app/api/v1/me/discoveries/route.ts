import { and, desc, eq, sql } from "drizzle-orm";

import {
  isRecordedEncounterExistingError,
  isRecordedEncounterQuotaError,
  parseStoredRecordedEncounterRow,
  readRecordedEncounterJson,
  RECORDED_ENCOUNTER_METHOD,
  RECORDED_ENCOUNTER_OWNER_LIMIT,
  RecordedEncounterContractError,
  recordedEncounterEnvelope,
  RecordedEncounterInputSchema,
  RECORDED_ENCOUNTER_RELEASE_ID,
  RecordedEncounterRequestError,
} from "@/app/lib/personal/discoveries";
import {
  currentAppUser,
  privateJsonResponse,
  storageErrorResponse,
  unauthenticatedResponse,
} from "@/app/lib/server/identity";
import { userDiscoveries } from "@/db/schema";

export const dynamic = "force-dynamic";

const recordedEncounterSelection = {
  entityId: userDiscoveries.entityId,
  firstSeenAtMs: userDiscoveries.firstSeenAtMs,
  lastSeenAtMs: userDiscoveries.lastSeenAtMs,
  visitCount: userDiscoveries.visitCount,
  discoveryMethod: userDiscoveries.discoveryMethod,
  releaseId: userDiscoveries.releaseId,
};

function requestErrorResponse(error: RecordedEncounterRequestError) {
  return privateJsonResponse(
    { error: error.code, message: error.message },
    { status: error.status },
  );
}

function quotaResponse() {
  return privateJsonResponse(
    {
      error: "recorded_encounter_quota_reached",
      message: `Each explorer can keep up to ${RECORDED_ENCOUNTER_OWNER_LIMIT} private recorded encounters.`,
      limit: RECORDED_ENCOUNTER_OWNER_LIMIT,
    },
    { status: 409 },
  );
}

export async function GET() {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const { getDb } = await import("@/db");
    const rows = await getDb()
      .select(recordedEncounterSelection)
      .from(userDiscoveries)
      .where(eq(userDiscoveries.userId, user.id))
      .orderBy(desc(userDiscoveries.lastSeenAtMs), desc(userDiscoveries.entityId))
      .limit(RECORDED_ENCOUNTER_OWNER_LIMIT + 1);
    if (rows.length > RECORDED_ENCOUNTER_OWNER_LIMIT) {
      throw new RecordedEncounterContractError(
        "Stored recorded encounter owner quota has drifted",
      );
    }
    return privateJsonResponse(
      recordedEncounterEnvelope(rows.map(parseStoredRecordedEncounterRow)),
    );
  } catch (error) {
    return storageErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const input = await readRecordedEncounterJson(request);
    const parsed = RecordedEncounterInputSchema.safeParse(input);
    if (!parsed.success) {
      return privateJsonResponse(
        { error: "invalid_recorded_encounter", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { getDb } = await import("@/db");
    const db = getDb();
    const now = Date.now();
    const incrementExisting = () =>
      db
        .update(userDiscoveries)
        .set({
          lastSeenAtMs: sql<number>`case when ${userDiscoveries.lastSeenAtMs} >= ${now} then ${userDiscoveries.lastSeenAtMs} + 1 else ${now} end`,
          visitCount: sql<number>`${userDiscoveries.visitCount} + 1`,
        })
        .where(
          and(
            eq(userDiscoveries.userId, user.id),
            eq(userDiscoveries.entityId, parsed.data.entityId),
          ),
        )
        .returning(recordedEncounterSelection);

    const [incremented] = await incrementExisting();
    if (incremented) {
      return privateJsonResponse(
        recordedEncounterEnvelope(parseStoredRecordedEncounterRow(incremented)),
      );
    }

    try {
      const [inserted] = await db
        .insert(userDiscoveries)
        .values({
          userId: user.id,
          entityId: parsed.data.entityId,
          firstSeenAtMs: now,
          lastSeenAtMs: now,
          visitCount: 1,
          discoveryMethod: RECORDED_ENCOUNTER_METHOD,
          releaseId: RECORDED_ENCOUNTER_RELEASE_ID,
        })
        .returning(recordedEncounterSelection);
      if (!inserted) {
        throw new RecordedEncounterContractError(
          "Recorded encounter insert returned no row",
        );
      }
      return privateJsonResponse(
        recordedEncounterEnvelope(parseStoredRecordedEncounterRow(inserted)),
        { status: 201 },
      );
    } catch (error) {
      if (isRecordedEncounterQuotaError(error)) return quotaResponse();
      if (!isRecordedEncounterExistingError(error)) throw error;
    }

    const [retried] = await incrementExisting();
    if (!retried) {
      throw new RecordedEncounterContractError(
        "Concurrent recorded encounter write could not be resolved",
      );
    }
    return privateJsonResponse(
      recordedEncounterEnvelope(parseStoredRecordedEncounterRow(retried)),
    );
  } catch (error) {
    if (error instanceof RecordedEncounterRequestError) {
      return requestErrorResponse(error);
    }
    if (isRecordedEncounterQuotaError(error)) return quotaResponse();
    return storageErrorResponse(error);
  }
}

export async function DELETE() {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const { getDb } = await import("@/db");
    const deleted = await getDb()
      .delete(userDiscoveries)
      .where(eq(userDiscoveries.userId, user.id))
      .returning({ entityId: userDiscoveries.entityId });
    return privateJsonResponse(
      recordedEncounterEnvelope({ deletedCount: deleted.length }),
    );
  } catch (error) {
    return storageErrorResponse(error);
  }
}
