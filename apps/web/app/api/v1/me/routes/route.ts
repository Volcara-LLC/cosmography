import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { atlasEntityById, atlasRelease } from "@/app/data/atlas";
import { getFlightDeckDistanceBinding } from "@/app/lib/navigation/flight-deck-distance";
import {
  estimateTravel,
  getTravelMode,
  TravelModeIdSchema,
} from "@/app/lib/navigation/travel";
import {
  currentAppUser,
  privateJsonResponse,
  storageErrorResponse,
  unauthenticatedResponse,
} from "@/app/lib/server/identity";
import { routeLegs, routeWaypoints, savedRoutes } from "@/db/schema";

export const dynamic = "force-dynamic";

const RouteInputSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    releaseId: z.literal(atlasRelease.id),
    originEntityId: z.literal("solar-system"),
    destinationEntityId: z.string().min(1).max(120),
    travelMode: TravelModeIdSchema,
    visibility: z.literal("private"),
  })
  .strict();

function envelope(records: unknown) {
  return {
    releaseId: atlasRelease.id,
    schemaVersion: "0.1.0",
    records,
  };
}

export async function GET() {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const { getDb } = await import("@/db");
    const records = await getDb()
      .select()
      .from(savedRoutes)
      .where(eq(savedRoutes.userId, user.id))
      .orderBy(desc(savedRoutes.updatedAtMs))
      .limit(200);
    return privateJsonResponse(envelope(records));
  } catch (error) {
    return storageErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return privateJsonResponse({ error: "invalid_json" }, { status: 400 });
    }
    const parsed = RouteInputSchema.safeParse(input);
    if (!parsed.success) {
      return privateJsonResponse(
        { error: "invalid_route", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const origin = atlasEntityById.get(parsed.data.originEntityId);
    const destination = atlasEntityById.get(parsed.data.destinationEntityId);
    if (!origin || !destination) {
      return privateJsonResponse({ error: "unknown_route_endpoint" }, { status: 400 });
    }
    const routeId = `route_${crypto.randomUUID().replaceAll("-", "")}`;
    const originWaypointId = `way_${crypto.randomUUID().replaceAll("-", "")}`;
    const destinationWaypointId = `way_${crypto.randomUUID().replaceAll("-", "")}`;
    const legId = `leg_${crypto.randomUUID().replaceAll("-", "")}`;
    const mode = getTravelMode(parsed.data.travelMode);
    const distanceBinding = getFlightDeckDistanceBinding(destination.id);
    const estimate = estimateTravel(
      distanceBinding?.distanceLightYears,
      parsed.data.travelMode,
    );
    const assumptions = {
      schemaId: "cosmography.flight-deck.saved-route-assumptions",
      schemaVersion: "1.0.0",
      releaseId: parsed.data.releaseId,
      truthClass: estimate.truthClass,
      resultKind: estimate.resultKind,
      estimatePolicy: mode.estimatePolicy,
      disclosure: estimate.scientificMeaning,
      fictional: estimate.fictional,
      counterfactual: estimate.counterfactual,
      transportStatus: mode.transportStatus,
      actualJourneyClaim: estimate.actualJourneyClaim,
      trajectoryClaim: estimate.trajectoryClaim,
      telemetryClaim: estimate.telemetryClaim,
      availableVehicle: estimate.availableVehicle,
      input: {
        originEntityId: origin.id,
        destinationEntityId: destination.id,
        sourceDistanceLightYears: estimate.distanceLightYears,
        speedFractionOfC: estimate.speedFractionOfC,
      },
      sources: {
        comparisonModelSourceIds: [...estimate.sourceIds],
        destinationRecordSourceIds:
          distanceBinding
            ? [...distanceBinding.recordSourceIds]
            : destination.sources.map((source) => source.id),
      },
      distanceProjection:
        distanceBinding === undefined
          ? null
          : {
              projectionVersion: distanceBinding.projectionVersion,
              releaseId: distanceBinding.releaseId,
              releaseManifestSha256: distanceBinding.releaseManifestSha256,
              releaseContentSha256: distanceBinding.releaseContentSha256,
              basis: distanceBinding.basis,
              recordSourceIds: [...distanceBinding.recordSourceIds],
              fieldLevelIngestionLineageAvailable:
                distanceBinding.fieldLevelIngestionLineageAvailable,
              straightLineRouteClaim: distanceBinding.straightLineRouteClaim,
              scientificMeaning: distanceBinding.scientificMeaning,
            },
      omittedPhysics: [
        "acceleration",
        "deceleration",
        "energy",
        "route-geometry",
        "mission-constraints",
        "traveler-frame-time",
        "relativistic-observer-effects",
      ],
      comparisonReference: mode.reference,
    };
    const distanceDefinition =
      mode.id === "instant"
        ? "semantic-navigation"
        : mode.id === "warp"
          ? "fictional-only"
          : estimate.distanceLightYears === null
            ? "awaiting-source-distance"
            : "source-distance-light-years";
    const now = Date.now();
    const { getDb } = await import("@/db");
    const db = getDb();

    await db.batch([
      db.insert(savedRoutes).values({
        id: routeId,
        userId: user.id,
        title: parsed.data.title,
        visibility: parsed.data.visibility,
        travelMode: mode.id,
        releaseId: parsed.data.releaseId,
        originTargetId: origin.id,
        destinationTargetId: destination.id,
        assumptionsJson: JSON.stringify(assumptions),
        status: "saved",
        createdAtMs: now,
        updatedAtMs: now,
      }),
      db.insert(routeWaypoints).values([
        {
          id: originWaypointId,
          routeId,
          ordinal: 0,
          navigationTargetId: origin.id,
        },
        {
          id: destinationWaypointId,
          routeId,
          ordinal: 1,
          navigationTargetId: destination.id,
        },
      ]),
      db.insert(routeLegs).values({
        id: legId,
        routeId,
        ordinal: 0,
        fromWaypointId: originWaypointId,
        toWaypointId: destinationWaypointId,
        distanceDefinition,
        distanceLexical:
          estimate.distanceLightYears === null
            ? null
            : String(estimate.distanceLightYears),
        distanceUnit: estimate.distanceLightYears === null ? null : "ly",
        durationLexical: estimate.durationLabel,
        durationUnit: estimate.durationLabel === null ? null : "display-label",
        assumptionsJson: JSON.stringify(assumptions),
        resultState: estimate.resultKind,
      }),
    ]);

    return privateJsonResponse(
      envelope({
        id: routeId,
        title: parsed.data.title,
        origin: origin.name,
        destination: destination.name,
        travelMode: mode.id,
        durationLabel: estimate.durationLabel,
        resultKind: estimate.resultKind,
        assumptions,
      }),
      { status: 201 },
    );
  } catch (error) {
    return storageErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const id = new URL(request.url).searchParams.get("id");
    if (!id?.startsWith("route_")) {
      return privateJsonResponse({ error: "valid_route_id_required" }, { status: 400 });
    }
    const { getDb } = await import("@/db");
    const [deleted] = await getDb()
      .delete(savedRoutes)
      .where(and(eq(savedRoutes.id, id), eq(savedRoutes.userId, user.id)))
      .returning({ id: savedRoutes.id });
    if (!deleted) return privateJsonResponse({ error: "not_found" }, { status: 404 });
    return privateJsonResponse(envelope(deleted));
  } catch (error) {
    return storageErrorResponse(error);
  }
}
