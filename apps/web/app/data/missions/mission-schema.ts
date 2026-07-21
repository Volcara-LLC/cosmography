import { z } from "zod";
import { MissionProvenanceSchema } from "@cosmography/scientific-model/mission-provenance";

export const MissionEvidenceClassSchema = z.enum([
  "direct-observation",
  "institutional-record",
  "scientific-inference",
  "ephemeris-reconstruction",
  "ephemeris-prediction",
  "processed-observation",
  "artist-interpretation",
]);

export const MissionDataStateSchema = z.enum([
  "archive-product",
  "reference-document",
  "published-status",
  "ephemeris",
  "telemetry",
  "prediction",
]);

export const MissionSourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  sourceKind: z.enum([
    "mission-page",
    "status-page",
    "mission-update",
    "ephemeris-api",
    "ephemeris-documentation",
    "kernel-archive",
    "kernel-documentation",
    "science-archive",
    "media-record",
    "media-product-record",
    "rights-policy",
    "citation-guidance",
    "organization-page",
  ]),
  dataState: MissionDataStateSchema,
  updatedAt: z.string().datetime({ offset: true }).optional(),
  accessedAt: z.string().datetime({ offset: true }),
  coverage: z.string().min(1),
  caveat: z.string().min(1).optional(),
}).strict();

export const MissionEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  shortTitle: z.string().min(1),
  epoch: z.string().datetime({ offset: true }),
  timePrecision: z.enum(["second", "minute", "day", "month", "page-update"]),
  phase: z.enum([
    "launch",
    "planetary-encounter",
    "observation",
    "interstellar-mission",
    "boundary-crossing",
    "operations",
    "current-public-state",
    "future-trajectory",
  ]),
  summary: z.string().min(1),
  detail: z.string().min(1),
  evidenceClass: MissionEvidenceClassSchema,
  dataState: MissionDataStateSchema,
  sourceIds: z.array(z.string().min(1)).min(1),
  accuracyNote: z.string().min(1),
  isFuture: z.boolean().default(false),
}).strict();

export const TrajectoryPointSchema = z.object({
  id: z.string().min(1),
  epochTdb: z.string().min(1),
  julianDateTdb: z.number(),
  positionAu: z.tuple([z.number(), z.number(), z.number()]),
  velocityAuPerDay: z.tuple([z.number(), z.number(), z.number()]),
  derivedHeliocentricDistanceAu: z.number().positive(),
  solutionClass: z.enum([
    "patched-conic-reconstruction",
    "tracking-refit-reconstruction",
    "tracking-refit-prediction",
  ]),
  evidenceClass: z.enum(["ephemeris-reconstruction", "ephemeris-prediction"]),
  isTelemetry: z.literal(false),
  sourceIds: z.array(z.string().min(1)).min(1),
}).strict();

export const MissionTrajectorySchema = z.object({
  id: z.string().min(1),
  targetName: z.string().min(1),
  targetNaifId: z.number().int(),
  centerName: z.string().min(1),
  centerNaifId: z.number().int(),
  frame: z.literal("Ecliptic of J2000.0"),
  referenceSystem: z.literal("ICRF"),
  timeScale: z.literal("TDB"),
  units: z.literal("AU and AU/day"),
  vectorCorrection: z.literal("NONE (geometric)"),
  solutionName: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
  trackingDataSpan: z.object({
    start: z.string().min(1),
    end: z.string().min(1),
    timeBasis: z.string().min(1),
    scope: z.string().min(1),
  }).strict(),
  coverageEnd: z.object({
    label: z.string().trim().min(1),
    timeScale: z.literal("TDB"),
    precision: z.enum(["day", "second", "millisecond"]),
  }).strict(),
  responseArtifact: z.object({
    repositoryPath: z.string().min(1),
    mediaType: z.literal("text/plain"),
    apiVersion: z.string().regex(/^\d+\.\d+$/),
    retrievedAt: z.string().datetime({ offset: true }),
    byteLength: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  telemetryDistinction: z.string().min(1),
  uncertaintyNote: z.string().min(1),
  points: z.array(TrajectoryPointSchema).min(2),
}).strict();

export const MissionMediaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  mediaKind: z.enum(["image", "image-sequence", "illustration", "dataset"]),
  representation: z.enum([
    "direct-observation",
    "processed-observation",
    "artist-interpretation",
    "raw-science-data",
  ]),
  capturedAt: z.string().datetime({ offset: true }).optional(),
  description: z.string().min(1),
  creditLine: z.string().min(1),
  rightsNote: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
}).strict();

export const MissionOrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  roleType: z.enum([
    "agency-owner",
    "design-and-operations",
    "communications",
    "navigation-archive",
    "science-archive",
    "ephemeris-service",
  ]),
  sourceIds: z.array(z.string().min(1)).min(1),
}).strict();

export const MissionInstrumentStateSchema = z.object({
  id: z.string().min(1),
  acronym: z.string().min(1),
  name: z.string().min(1),
  state: z.enum(["on", "off-save-power", "off-degraded-performance"]),
  effectiveAt: z.string().datetime({ offset: true }).optional(),
  note: z.string().min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
}).strict();

export const MissionFixtureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  internationalDesignator: z.string().min(1),
  status: z.literal("active-extended-mission"),
  verifiedAt: z.string().datetime({ offset: true }),
  publicStateEpoch: z.string().datetime({ offset: true }),
  publicStateLabel: z.string().min(1),
  publicDataCaveat: z.string().min(1),
  provenance: MissionProvenanceSchema,
  sources: z.array(MissionSourceSchema).min(1),
  events: z.array(MissionEventSchema).min(1),
  trajectory: MissionTrajectorySchema,
  media: z.array(MissionMediaSchema).min(1),
  organizations: z.array(MissionOrganizationSchema).min(1),
  instruments: z.array(MissionInstrumentStateSchema).min(1),
}).strict();

export type MissionEvidenceClass = z.infer<typeof MissionEvidenceClassSchema>;
export type MissionSource = z.infer<typeof MissionSourceSchema>;
export type MissionEvent = z.infer<typeof MissionEventSchema>;
export type MissionTrajectory = z.infer<typeof MissionTrajectorySchema>;
export type MissionMedia = z.infer<typeof MissionMediaSchema>;
export type MissionOrganization = z.infer<typeof MissionOrganizationSchema>;
export type MissionInstrumentState = z.infer<typeof MissionInstrumentStateSchema>;
export type MissionFixture = z.infer<typeof MissionFixtureSchema>;

function assertUniqueIds(label: string, ids: string[]) {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(label + " has duplicate IDs: " + [...new Set(duplicates)].join(", "));
  }
}

export function validateMissionFixture(input: unknown): MissionFixture {
  const mission = MissionFixtureSchema.parse(input);
  const sourceIds = new Set(mission.sources.map((source) => source.id));

  const verifiedAt = Date.parse(mission.verifiedAt);
  const evidenceReviewTimes = [
    ...mission.sources.map((source) => source.accessedAt),
    mission.trajectory.responseArtifact.retrievedAt,
    mission.provenance.kernelSet.selectedAt,
    ...mission.provenance.mediaAdmissions.map((admission) =>
      admission.state === "reference-only-pending-asset-review"
        ? admission.policyCheckedAt
        : admission.admittedAt,
    ),
  ];
  if (
    evidenceReviewTimes.some(
      (evidenceTime) => Date.parse(evidenceTime) > verifiedAt,
    )
  ) {
    throw new Error(
      "Mission verification time cannot predate source access, artifact retrieval, kernel selection, policy review, or media admission.",
    );
  }

  assertUniqueIds("Mission sources", mission.sources.map((source) => source.id));
  assertUniqueIds("Mission events", mission.events.map((event) => event.id));
  assertUniqueIds("Trajectory points", mission.trajectory.points.map((point) => point.id));
  assertUniqueIds("Mission media", mission.media.map((item) => item.id));
  assertUniqueIds("Mission organizations", mission.organizations.map((item) => item.id));
  assertUniqueIds("Mission instruments", mission.instruments.map((item) => item.id));

  const allReferences = [
    ...mission.events.flatMap((event) => event.sourceIds),
    ...mission.trajectory.sourceIds,
    ...mission.trajectory.points.flatMap((point) => point.sourceIds),
    ...mission.media.flatMap((item) => item.sourceIds),
    ...mission.organizations.flatMap((organization) => organization.sourceIds),
    ...mission.instruments.flatMap((instrument) => instrument.sourceIds),
  ];

  const missingSources = [...new Set(allReferences.filter((id) => !sourceIds.has(id)))];
  if (missingSources.length > 0) {
    throw new Error("Mission fixture references unknown sources: " + missingSources.join(", "));
  }

  const eventEpochs = mission.events.map((event) => Date.parse(event.epoch));
  if (eventEpochs.some((epoch, index) => index > 0 && epoch < eventEpochs[index - 1])) {
    throw new Error("Mission events must be chronological.");
  }

  const pointEpochs = mission.trajectory.points.map((point) => point.julianDateTdb);
  if (pointEpochs.some((epoch, index) => index > 0 && epoch <= pointEpochs[index - 1])) {
    throw new Error("Trajectory points must be strictly chronological.");
  }

  if (mission.trajectory.points.some((point) => point.isTelemetry)) {
    throw new Error("This frozen Horizons trajectory may not be represented as telemetry.");
  }

  const mediaIds = mission.media.map((item) => item.id).sort();
  const admissionMediaIds = mission.provenance.mediaAdmissions
    .map((item) => item.mediaId)
    .sort();
  if (JSON.stringify(mediaIds) !== JSON.stringify(admissionMediaIds)) {
    throw new Error(
      "Every mission media record needs exactly one structured admission decision.",
    );
  }
  for (const media of mission.media) {
    const admission = mission.provenance.mediaAdmissions.find(
      (record) => record.mediaId === media.id,
    );
    if (!admission) {
      throw new Error(`Mission media ${media.id} is missing its admission record.`);
    }
    if (
      admission.sourceReferenceIds.some(
        (sourceId) => !media.sourceIds.includes(sourceId),
      )
    ) {
      throw new Error(
        `Mission media ${media.id} must expose every source used by its admission decision.`,
      );
    }
    if (admission.state === "reference-only-pending-asset-review") {
      const officialSource = mission.sources.find(
        (source) =>
          admission.sourceReferenceIds.includes(source.id) &&
          source.url === admission.officialRecordUrl,
      );
      if (!officialSource || !admission.requiredCreditLine.startsWith(media.creditLine)) {
        throw new Error(
          `Reference-only media ${media.id} must bind its official record and displayed credit to the structured admission.`,
        );
      }
    } else if (media.creditLine !== admission.rights.creditLine) {
      throw new Error(
        `Admitted media ${media.id} must display the reviewed structured credit line.`,
      );
    }
  }

  const provenanceSourceReferences = [
    ...mission.provenance.kernelSet.sourceReferenceIds,
    ...mission.provenance.kernelSet.artifacts.flatMap(
      (artifact) => artifact.sourceReferenceIds,
    ),
    ...mission.provenance.mediaAdmissions.flatMap(
      (admission) => admission.sourceReferenceIds,
    ),
    ...mission.provenance.captureContexts.flatMap(
      (capture) => capture.sourceReferenceIds,
    ),
  ];
  const missingProvenanceSources = [
    ...new Set(
      provenanceSourceReferences.filter((sourceId) => !sourceIds.has(sourceId)),
    ),
  ];
  if (missingProvenanceSources.length > 0) {
    throw new Error(
      "Mission provenance references unknown sources: " +
        missingProvenanceSources.join(", "),
    );
  }

  const goldenById = new Map(
    mission.provenance.horizonsValidation.goldenEpochs.map((epoch) => [
      epoch.epochId,
      epoch,
    ]),
  );
  assertUniqueIds(
    "Horizons golden epochs",
    mission.provenance.horizonsValidation.goldenEpochs.map((epoch) => epoch.epochId),
  );
  if (
    goldenById.size !== mission.trajectory.points.length ||
    mission.provenance.horizonsValidation.goldenEpochs.length !==
      mission.trajectory.points.length
  ) {
    throw new Error(
      "The frozen Horizons validation plan must cover every trajectory point exactly once.",
    );
  }
  for (const point of mission.trajectory.points) {
    const golden = goldenById.get(point.id);
    if (
      !golden ||
      golden.epochTdb !== point.epochTdb ||
      golden.julianDateTdb !== point.julianDateTdb ||
      JSON.stringify(golden.positionAu) !== JSON.stringify(point.positionAu) ||
      JSON.stringify(golden.velocityAuPerDay) !==
        JSON.stringify(point.velocityAuPerDay)
    ) {
      throw new Error(
        "Trajectory values must exactly match the separately frozen Horizons golden plan.",
      );
    }
  }

  const validation = mission.provenance.horizonsValidation;
  const kernelContext = mission.provenance.kernelSet.queryContext;
  if (
    mission.provenance.kernelSet.missionId !== mission.id ||
    validation.referenceArtifactSha256 !==
      mission.trajectory.responseArtifact.sha256 ||
    validation.referenceArtifactPath !==
      mission.trajectory.responseArtifact.repositoryPath ||
    validation.queryContext.targetNaifId !== mission.trajectory.targetNaifId ||
    validation.queryContext.centerNaifId !== mission.trajectory.centerNaifId ||
    validation.queryContext.referenceSystem !== mission.trajectory.referenceSystem ||
    validation.queryContext.timeScale !== mission.trajectory.timeScale ||
    validation.queryContext.units !== mission.trajectory.units ||
    validation.queryContext.aberrationCorrection !==
      mission.trajectory.vectorCorrection ||
    validation.queryContext.frame !== "ECLIPJ2000" ||
    mission.trajectory.frame !== "Ecliptic of J2000.0" ||
    JSON.stringify(kernelContext) !== JSON.stringify(validation.queryContext)
  ) {
    throw new Error(
      "Horizons validation context must bind the exact trajectory artifact, target, center, frame, time, units, and correction.",
    );
  }

  for (const capture of mission.provenance.captureContexts) {
    const media = mission.media.find((item) => item.id === capture.mediaId);
    if (!media || media.capturedAt !== capture.capturedAtUtc) {
      throw new Error(
        `Capture context ${capture.captureContextId} must bind the normalized capture time of its media record.`,
      );
    }
  }

  return mission;
}
