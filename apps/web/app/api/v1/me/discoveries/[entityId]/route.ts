import { and, eq } from "drizzle-orm";

import {
  RecordedEncounterEntityIdSchema,
  recordedEncounterEnvelope,
} from "@/app/lib/personal/discoveries";
import {
  currentAppUser,
  privateJsonResponse,
  storageErrorResponse,
  unauthenticatedResponse,
} from "@/app/lib/server/identity";
import { userDiscoveries } from "@/db/schema";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ entityId: string }>;
};

function notFoundResponse() {
  return privateJsonResponse({ error: "not_found" }, { status: 404 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const { entityId } = await context.params;
    const idResult = RecordedEncounterEntityIdSchema.safeParse(entityId);
    if (!idResult.success) return notFoundResponse();

    const { getDb } = await import("@/db");
    const [deleted] = await getDb()
      .delete(userDiscoveries)
      .where(
        and(
          eq(userDiscoveries.userId, user.id),
          eq(userDiscoveries.entityId, idResult.data),
        ),
      )
      .returning({ entityId: userDiscoveries.entityId });
    if (!deleted) return notFoundResponse();
    return privateJsonResponse(recordedEncounterEnvelope(deleted));
  } catch (error) {
    return storageErrorResponse(error);
  }
}
