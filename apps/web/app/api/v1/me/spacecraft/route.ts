import { desc, eq } from "drizzle-orm";
import {
  isSpacecraftQuotaError,
  parseStoredSpacecraftRow,
  readSpacecraftJson,
  SPACECRAFT_OWNER_LIMIT,
  SPACECRAFT_PROPULSION_MODELS,
  spacecraftEnvelope,
  SpacecraftContractError,
  SpacecraftCreateInputSchema,
  SpacecraftRequestError,
  verifyPropulsionModelRow,
} from "@/app/lib/personal/spacecraft";
import {
  currentAppUser,
  privateJsonResponse,
  storageErrorResponse,
  unauthenticatedResponse,
} from "@/app/lib/server/identity";
import { propulsionModels, userSpacecraft } from "@/db/schema";

export const dynamic = "force-dynamic";

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

const modelSelection = {
  id: propulsionModels.id,
  code: propulsionModels.code,
  version: propulsionModels.version,
  modelClass: propulsionModels.modelClass,
  title: propulsionModels.title,
  distanceDefinition: propulsionModels.distanceDefinition,
  definitionJson: propulsionModels.definitionJson,
  evidenceClass: propulsionModels.evidenceClass,
  citationAssertionId: propulsionModels.citationAssertionId,
};

function requestErrorResponse(error: SpacecraftRequestError) {
  return privateJsonResponse(
    { error: error.code, message: error.message },
    { status: error.status },
  );
}

function quotaResponse() {
  return privateJsonResponse(
    {
      error: "spacecraft_quota_reached",
      message: `Each explorer can save up to ${SPACECRAFT_OWNER_LIMIT} private spacecraft concepts.`,
      limit: SPACECRAFT_OWNER_LIMIT,
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
      .select(spacecraftSelection)
      .from(userSpacecraft)
      .leftJoin(
        propulsionModels,
        eq(propulsionModels.id, userSpacecraft.propulsionModelId),
      )
      .where(eq(userSpacecraft.userId, user.id))
      .orderBy(desc(userSpacecraft.updatedAtMs), desc(userSpacecraft.id))
      .limit(SPACECRAFT_OWNER_LIMIT + 1);
    if (rows.length > SPACECRAFT_OWNER_LIMIT) {
      throw new SpacecraftContractError("Stored spacecraft owner quota has drifted");
    }
    return privateJsonResponse(
      spacecraftEnvelope(rows.map(parseStoredSpacecraftRow)),
    );
  } catch (error) {
    return storageErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentAppUser();
    if (!user) return unauthenticatedResponse();
    const input = await readSpacecraftJson(request);
    const parsed = SpacecraftCreateInputSchema.safeParse(input);
    if (!parsed.success) {
      return privateJsonResponse(
        { error: "invalid_spacecraft", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { getDb } = await import("@/db");
    const db = getDb();
    const existing = await db
      .select({ id: userSpacecraft.id })
      .from(userSpacecraft)
      .where(eq(userSpacecraft.userId, user.id))
      .limit(SPACECRAFT_OWNER_LIMIT);
    if (existing.length >= SPACECRAFT_OWNER_LIMIT) return quotaResponse();

    const expectedModel = SPACECRAFT_PROPULSION_MODELS[parsed.data.profile];
    const [modelRow] = await db
      .select(modelSelection)
      .from(propulsionModels)
      .where(eq(propulsionModels.id, expectedModel.id))
      .limit(1);
    if (!modelRow) {
      throw new SpacecraftContractError("Required propulsion model is unavailable");
    }
    const model = verifyPropulsionModelRow(modelRow);
    if (model.profile !== parsed.data.profile) {
      throw new SpacecraftContractError("Requested propulsion profile has drifted");
    }

    const now = Date.now();
    let inserted: {
      id: string;
      displayName: string;
      propulsionModelId: string;
      cosmeticsJson: string;
      createdAtMs: number;
      updatedAtMs: number;
    };
    try {
      const [row] = await db
        .insert(userSpacecraft)
        .values({
          id: `ship_${crypto.randomUUID().replaceAll("-", "")}`,
          userId: user.id,
          displayName: parsed.data.displayName,
          propulsionModelId: model.id,
          cosmeticsJson: JSON.stringify(parsed.data.appearance),
          createdAtMs: now,
          updatedAtMs: now,
        })
        .returning({
          id: userSpacecraft.id,
          displayName: userSpacecraft.displayName,
          propulsionModelId: userSpacecraft.propulsionModelId,
          cosmeticsJson: userSpacecraft.cosmeticsJson,
          createdAtMs: userSpacecraft.createdAtMs,
          updatedAtMs: userSpacecraft.updatedAtMs,
        });
      if (!row) throw new SpacecraftContractError("Spacecraft insert returned no row");
      inserted = row;
    } catch (error) {
      if (isSpacecraftQuotaError(error)) return quotaResponse();
      throw error;
    }

    const record = parseStoredSpacecraftRow({
      ...inserted,
      modelId: modelRow.id,
      modelCode: modelRow.code,
      modelVersion: modelRow.version,
      modelClass: modelRow.modelClass,
      modelTitle: modelRow.title,
      modelDistanceDefinition: modelRow.distanceDefinition,
      modelDefinitionJson: modelRow.definitionJson,
      modelEvidenceClass: modelRow.evidenceClass,
      modelCitationAssertionId: modelRow.citationAssertionId,
    });
    return privateJsonResponse(spacecraftEnvelope(record), { status: 201 });
  } catch (error) {
    if (error instanceof SpacecraftRequestError) {
      return requestErrorResponse(error);
    }
    if (isSpacecraftQuotaError(error)) return quotaResponse();
    return storageErrorResponse(error);
  }
}
