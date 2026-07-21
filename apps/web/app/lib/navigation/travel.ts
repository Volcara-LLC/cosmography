import { z } from "zod";

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

const ASTRONOMICAL_UNIT_KILOMETERS = 149_597_870.7;
const SECONDS_PER_DAY = 86_400;
const SPEED_OF_LIGHT_KILOMETERS_PER_SECOND = 299_792.458;
const DAYS_PER_JULIAN_YEAR = 365.25;
const AWAITING_SOURCE_DISTANCE_MESSAGE =
  "A release-backed source distance is required before this comparison can be calculated.";

const voyager1VelocityAuPerDay = [
  -0.001361256050772332,
  -0.008299037657264556,
  0.005995398445562643,
] as const;

const voyager1SpeedKilometersPerSecond =
  Math.hypot(...voyager1VelocityAuPerDay) *
  (ASTRONOMICAL_UNIT_KILOMETERS / SECONDS_PER_DAY);
const voyager1FractionOfLightSpeed =
  voyager1SpeedKilometersPerSecond /
  SPEED_OF_LIGHT_KILOMETERS_PER_SECOND;

export const Voyager1SpeedReferenceSchema = z
  .object({
    sourceId: z.literal("jpl-horizons-vectors-2026-07-19"),
    artifactPath: z.literal(
      "apps/web/tests/fixtures/horizons/voyager-1-vectors-2026-07-19.txt",
    ),
    artifactSha256: z.literal(
      "d5fb20227607ff652e109977a068f28aff0a13cf8bf1cbc55a8bf40cfdca1252",
    ),
    solutionName: z.literal("Voyager_1_ST+refit2022_m"),
    epochTdb: z.literal("1990-02-14 00:00:00.0000 TDB"),
    julianDateTdb: z.literal(2447936.5),
    center: z.literal("Sun"),
    centerNaifId: z.literal(10),
    referenceFrame: z.literal("Ecliptic of J2000.0"),
    referenceSystem: z.literal("ICRF"),
    outputUnits: z.literal("AU-D"),
    aberrationCorrection: z.literal("NONE"),
    velocityAuPerDay: z.tuple([
      z.literal(voyager1VelocityAuPerDay[0]),
      z.literal(voyager1VelocityAuPerDay[1]),
      z.literal(voyager1VelocityAuPerDay[2]),
    ]),
    speedKilometersPerSecond: z.literal(voyager1SpeedKilometersPerSecond),
    fractionOfLightSpeed: z.literal(voyager1FractionOfLightSpeed),
    dataProduct: z.literal("frozen-geometric-ephemeris"),
    comparisonUse: z.literal("counterfactual-constant-speed-only"),
    telemetryClaim: z.literal(false),
    trajectoryClaim: z.literal(false),
  })
  .strict();

export type Voyager1SpeedReference = DeepReadonly<
  z.infer<typeof Voyager1SpeedReferenceSchema>
>;

export const VOYAGER1_SPEED_REFERENCE: Voyager1SpeedReference = deepFreeze(
  Voyager1SpeedReferenceSchema.parse({
    sourceId: "jpl-horizons-vectors-2026-07-19",
    artifactPath:
      "apps/web/tests/fixtures/horizons/voyager-1-vectors-2026-07-19.txt",
    artifactSha256:
      "d5fb20227607ff652e109977a068f28aff0a13cf8bf1cbc55a8bf40cfdca1252",
    solutionName: "Voyager_1_ST+refit2022_m",
    epochTdb: "1990-02-14 00:00:00.0000 TDB",
    julianDateTdb: 2447936.5,
    center: "Sun",
    centerNaifId: 10,
    referenceFrame: "Ecliptic of J2000.0",
    referenceSystem: "ICRF",
    outputUnits: "AU-D",
    aberrationCorrection: "NONE",
    velocityAuPerDay: voyager1VelocityAuPerDay,
    speedKilometersPerSecond: voyager1SpeedKilometersPerSecond,
    fractionOfLightSpeed: voyager1FractionOfLightSpeed,
    dataProduct: "frozen-geometric-ephemeris",
    comparisonUse: "counterfactual-constant-speed-only",
    telemetryClaim: false,
    trajectoryClaim: false,
  }),
);

export const TravelModeIdSchema = z.enum([
  "instant",
  "light",
  "voyager",
  "fusion",
  "warp",
]);

export const TravelTruthClassSchema = z.enum([
  "navigation",
  "physical-limit",
  "historical-comparison",
  "hypothetical-physical",
  "fictional-only",
]);

const MapJumpModeSchema = z
  .object({
    id: z.literal("instant"),
    label: z.literal("Map jump"),
    truthClass: z.literal("navigation"),
    estimatePolicy: z.literal("semantic-navigation"),
    fractionOfLightSpeed: z.null(),
    fictional: z.literal(false),
    actualJourneyClaim: z.literal(false),
    availableVehicle: z.literal(false),
    transportStatus: z.literal("not-a-journey"),
    sourceIds: z.array(z.never()).length(0),
    reference: z.null(),
    disclosure: z.literal(
      "Semantic map navigation only; no physical journey or duration is claimed.",
    ),
  })
  .strict();

const LightSignalModeSchema = z
  .object({
    id: z.literal("light"),
    label: z.literal("Light signal · physical limit"),
    truthClass: z.literal("physical-limit"),
    estimatePolicy: z.literal("source-distance-light-time"),
    fractionOfLightSpeed: z.literal(1),
    fictional: z.literal(false),
    actualJourneyClaim: z.literal(false),
    availableVehicle: z.literal(false),
    transportStatus: z.literal("not-a-ship"),
    sourceIds: z.array(z.never()).length(0),
    reference: z.null(),
    disclosure: z.literal(
      "Vacuum light-time from the supplied source distance; this is a signal, not a spacecraft or trip plan.",
    ),
  })
  .strict();

const VoyagerComparisonModeSchema = z
  .object({
    id: z.literal("voyager"),
    label: z.literal("Voyager 1 · historical speed"),
    truthClass: z.literal("historical-comparison"),
    estimatePolicy: z.literal("constant-speed-counterfactual"),
    fractionOfLightSpeed: z.literal(voyager1FractionOfLightSpeed),
    fictional: z.literal(false),
    actualJourneyClaim: z.literal(false),
    availableVehicle: z.literal(false),
    transportStatus: z.literal("historical-spacecraft-not-transport"),
    sourceIds: z.tuple([z.literal("jpl-horizons-vectors-2026-07-19")]),
    reference: Voyager1SpeedReferenceSchema,
    disclosure: z.literal(
      "Counterfactual constant-speed comparison using Voyager 1's frozen 1990-02-14 heliocentric Horizons speed; not its trajectory, not telemetry, and not an available transport.",
    ),
  })
  .strict();

const FusionScenarioModeSchema = z
  .object({
    id: z.literal("fusion"),
    label: z.literal("Fusion spacecraft · assumed 0.1c"),
    truthClass: z.literal("hypothetical-physical"),
    estimatePolicy: z.literal("constant-speed-counterfactual"),
    fractionOfLightSpeed: z.literal(0.1),
    fictional: z.literal(false),
    actualJourneyClaim: z.literal(false),
    availableVehicle: z.literal(false),
    transportStatus: z.literal("no-available-spacecraft"),
    sourceIds: z.array(z.never()).length(0),
    reference: z.null(),
    disclosure: z.literal(
      "Hypothetical physical scenario assuming a constant 0.1c cruise speed; no available spacecraft or mission plan is claimed.",
    ),
  })
  .strict();

const FictionalWarpModeSchema = z
  .object({
    id: z.literal("warp"),
    label: z.literal("Warp · fictional only"),
    truthClass: z.literal("fictional-only"),
    estimatePolicy: z.literal("no-scientific-duration"),
    fractionOfLightSpeed: z.null(),
    fictional: z.literal(true),
    actualJourneyClaim: z.literal(false),
    availableVehicle: z.literal(false),
    transportStatus: z.literal("fictional"),
    sourceIds: z.array(z.never()).length(0),
    reference: z.null(),
    disclosure: z.literal(
      "Fictional presentation only; no scientific duration or physical transport claim is provided.",
    ),
  })
  .strict();

export const TravelModeSchema = z.discriminatedUnion("id", [
  MapJumpModeSchema,
  LightSignalModeSchema,
  VoyagerComparisonModeSchema,
  FusionScenarioModeSchema,
  FictionalWarpModeSchema,
]);

export const TravelModeCatalogSchema = z.tuple([
  MapJumpModeSchema,
  LightSignalModeSchema,
  VoyagerComparisonModeSchema,
  FusionScenarioModeSchema,
  FictionalWarpModeSchema,
]);

export type TravelModeId = z.infer<typeof TravelModeIdSchema>;
export type TravelTruthClass = z.infer<typeof TravelTruthClassSchema>;
export type TravelMode = DeepReadonly<z.infer<typeof TravelModeSchema>>;

export const travelModes: readonly TravelMode[] = deepFreeze(
  TravelModeCatalogSchema.parse([
    {
      id: "instant",
      label: "Map jump",
      truthClass: "navigation",
      estimatePolicy: "semantic-navigation",
      fractionOfLightSpeed: null,
      fictional: false,
      actualJourneyClaim: false,
      availableVehicle: false,
      transportStatus: "not-a-journey",
      sourceIds: [],
      reference: null,
      disclosure:
        "Semantic map navigation only; no physical journey or duration is claimed.",
    },
    {
      id: "light",
      label: "Light signal · physical limit",
      truthClass: "physical-limit",
      estimatePolicy: "source-distance-light-time",
      fractionOfLightSpeed: 1,
      fictional: false,
      actualJourneyClaim: false,
      availableVehicle: false,
      transportStatus: "not-a-ship",
      sourceIds: [],
      reference: null,
      disclosure:
        "Vacuum light-time from the supplied source distance; this is a signal, not a spacecraft or trip plan.",
    },
    {
      id: "voyager",
      label: "Voyager 1 · historical speed",
      truthClass: "historical-comparison",
      estimatePolicy: "constant-speed-counterfactual",
      fractionOfLightSpeed: voyager1FractionOfLightSpeed,
      fictional: false,
      actualJourneyClaim: false,
      availableVehicle: false,
      transportStatus: "historical-spacecraft-not-transport",
      sourceIds: ["jpl-horizons-vectors-2026-07-19"],
      reference: VOYAGER1_SPEED_REFERENCE,
      disclosure:
        "Counterfactual constant-speed comparison using Voyager 1's frozen 1990-02-14 heliocentric Horizons speed; not its trajectory, not telemetry, and not an available transport.",
    },
    {
      id: "fusion",
      label: "Fusion spacecraft · assumed 0.1c",
      truthClass: "hypothetical-physical",
      estimatePolicy: "constant-speed-counterfactual",
      fractionOfLightSpeed: 0.1,
      fictional: false,
      actualJourneyClaim: false,
      availableVehicle: false,
      transportStatus: "no-available-spacecraft",
      sourceIds: [],
      reference: null,
      disclosure:
        "Hypothetical physical scenario assuming a constant 0.1c cruise speed; no available spacecraft or mission plan is claimed.",
    },
    {
      id: "warp",
      label: "Warp · fictional only",
      truthClass: "fictional-only",
      estimatePolicy: "no-scientific-duration",
      fractionOfLightSpeed: null,
      fictional: true,
      actualJourneyClaim: false,
      availableVehicle: false,
      transportStatus: "fictional",
      sourceIds: [],
      reference: null,
      disclosure:
        "Fictional presentation only; no scientific duration or physical transport claim is provided.",
    },
  ]),
);

export function parseTravelModeCatalog(value: unknown): readonly TravelMode[] {
  return deepFreeze(TravelModeCatalogSchema.parse(value));
}

export function getTravelMode(value: unknown): TravelMode {
  const id = TravelModeIdSchema.parse(value);
  const mode = travelModes.find((candidate) => candidate.id === id);
  if (!mode) {
    throw new Error(`Travel mode ${id} is absent from the canonical catalog`);
  }
  return mode;
}

export const TravelEstimateResultKindSchema = z.enum([
  "semantic-navigation",
  "fictional-only",
  "awaiting-source-distance",
  "source-distance-light-time",
  "constant-speed-counterfactual",
]);

const DistanceLightYearsSchema = z.number().finite().nonnegative();

export const TravelEstimateSchema = z
  .object({
    modeId: TravelModeIdSchema,
    truthClass: TravelTruthClassSchema,
    resultKind: TravelEstimateResultKindSchema,
    distanceLightYears: DistanceLightYearsSchema.nullable(),
    speedFractionOfC: z.number().finite().positive().max(1).nullable(),
    durationYears: z.number().finite().nonnegative().nullable(),
    durationLabel: z.string().trim().min(1).nullable(),
    scientificMeaning: z.string().trim().min(20),
    fictional: z.boolean(),
    counterfactual: z.boolean(),
    actualJourneyClaim: z.literal(false),
    trajectoryClaim: z.literal(false),
    telemetryClaim: z.literal(false),
    availableVehicle: z.literal(false),
    sourceIds: z.array(z.string().trim().min(1)),
  })
  .strict()
  .superRefine((estimate, context) => {
    const mode = travelModes.find((candidate) => candidate.id === estimate.modeId);
    if (!mode) {
      context.addIssue({ code: "custom", path: ["modeId"], message: "Unknown mode" });
      return;
    }

    const expectedSourceIds = [...mode.sourceIds];
    if (
      estimate.truthClass !== mode.truthClass ||
      estimate.fictional !== mode.fictional ||
      estimate.speedFractionOfC !== mode.fractionOfLightSpeed ||
      JSON.stringify(estimate.sourceIds) !== JSON.stringify(expectedSourceIds)
    ) {
      context.addIssue({
        code: "custom",
        message: "Estimate truth, speed, and source fields must match the canonical mode",
      });
    }

    const noDuration =
      estimate.modeId === "instant" ||
      estimate.modeId === "warp" ||
      estimate.distanceLightYears === null;
    if (
      noDuration !==
      (estimate.durationYears === null && estimate.durationLabel === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["durationYears"],
        message: "A duration must exist exactly when the selected scientific comparison has a distance",
      });
    }

    const expectedResultKind =
      estimate.modeId === "instant"
        ? "semantic-navigation"
        : estimate.modeId === "warp"
          ? "fictional-only"
          : estimate.distanceLightYears === null
            ? "awaiting-source-distance"
            : estimate.modeId === "light"
              ? "source-distance-light-time"
              : "constant-speed-counterfactual";
    if (estimate.resultKind !== expectedResultKind) {
      context.addIssue({
        code: "custom",
        path: ["resultKind"],
        message: "Estimate result kind does not match the mode and distance",
      });
    }

    const expectedCounterfactual =
      estimate.modeId === "voyager" || estimate.modeId === "fusion";
    if (estimate.counterfactual !== expectedCounterfactual) {
      context.addIssue({
        code: "custom",
        path: ["counterfactual"],
        message: "Only constant-speed Voyager and fusion comparisons are counterfactual",
      });
    }

    const expectedScientificMeaning =
      estimate.resultKind === "awaiting-source-distance"
        ? AWAITING_SOURCE_DISTANCE_MESSAGE
        : mode.disclosure;
    if (estimate.scientificMeaning !== expectedScientificMeaning) {
      context.addIssue({
        code: "custom",
        path: ["scientificMeaning"],
        message: "Estimate disclosure must match the canonical truth-class wording",
      });
    }

    if (!noDuration) {
      const distance = estimate.distanceLightYears!;
      const expectedYears =
        estimate.modeId === "light"
          ? distance
          : distance / mode.fractionOfLightSpeed!;
      if (
        estimate.durationYears !== expectedYears ||
        estimate.durationLabel !== formatDurationYears(expectedYears)
      ) {
        context.addIssue({
          code: "custom",
          path: ["durationYears"],
          message: "Duration must be derived exactly from the supplied source distance and mode speed",
        });
      }
    }
  });

export type TravelEstimate = DeepReadonly<z.infer<typeof TravelEstimateSchema>>;

function createEstimate(
  estimate: z.input<typeof TravelEstimateSchema>,
): TravelEstimate {
  return deepFreeze(TravelEstimateSchema.parse(estimate));
}

export function estimateTravel(
  distanceLightYears: number | undefined,
  modeId: TravelModeId,
): TravelEstimate {
  const distance = z
    .union([DistanceLightYearsSchema, z.undefined()])
    .parse(distanceLightYears);
  const mode = getTravelMode(modeId);
  const distanceOrNull = distance ?? null;
  const common = {
    modeId: mode.id,
    truthClass: mode.truthClass,
    distanceLightYears: distanceOrNull,
    speedFractionOfC: mode.fractionOfLightSpeed,
    fictional: mode.fictional,
    actualJourneyClaim: false as const,
    trajectoryClaim: false as const,
    telemetryClaim: false as const,
    availableVehicle: false as const,
    sourceIds: [...mode.sourceIds],
  };

  if (mode.id === "instant") {
    return createEstimate({
      ...common,
      resultKind: "semantic-navigation",
      durationYears: null,
      durationLabel: null,
      counterfactual: false,
      scientificMeaning: mode.disclosure,
    });
  }

  if (mode.id === "warp") {
    return createEstimate({
      ...common,
      resultKind: "fictional-only",
      durationYears: null,
      durationLabel: null,
      counterfactual: false,
      scientificMeaning: mode.disclosure,
    });
  }

  if (distance === undefined) {
    return createEstimate({
      ...common,
      resultKind: "awaiting-source-distance",
      durationYears: null,
      durationLabel: null,
      counterfactual: mode.id === "voyager" || mode.id === "fusion",
      scientificMeaning: AWAITING_SOURCE_DISTANCE_MESSAGE,
    });
  }

  const durationYears = distance / mode.fractionOfLightSpeed;

  if (mode.id === "light") {
    return createEstimate({
      ...common,
      resultKind: "source-distance-light-time",
      durationYears,
      durationLabel: formatDurationYears(durationYears),
      counterfactual: false,
      scientificMeaning: mode.disclosure,
    });
  }

  return createEstimate({
    ...common,
    resultKind: "constant-speed-counterfactual",
    durationYears,
    durationLabel: formatDurationYears(durationYears),
    counterfactual: true,
    scientificMeaning: mode.disclosure,
  });
}

export function formatDurationYears(years: number): string {
  const validatedYears = z.number().finite().nonnegative().parse(years);
  const seconds = validatedYears * DAYS_PER_JULIAN_YEAR * SECONDS_PER_DAY;
  const boundaryToleranceSeconds = 1e-9;

  function unit(value: number, singular: string, maximumFractionDigits: number) {
    if (value > 0 && value < 0.1) return `<0.1 ${singular}s`;
    const rounded = Number(value.toFixed(maximumFractionDigits));
    const formatted = value.toLocaleString("en-US", { maximumFractionDigits });
    return `${formatted} ${singular}${rounded === 1 ? "" : "s"}`;
  }

  if (seconds < 60 - boundaryToleranceSeconds) {
    return unit(seconds, "second", 1);
  }

  if (seconds < 3_600 - boundaryToleranceSeconds) {
    return unit(seconds / 60, "minute", 1);
  }

  if (seconds < SECONDS_PER_DAY - boundaryToleranceSeconds) {
    return unit(seconds / 3_600, "hour", 1);
  }

  if (validatedYears < 1) {
    return unit(validatedYears * DAYS_PER_JULIAN_YEAR, "day", 1);
  }

  if (validatedYears < 1000) {
    return unit(validatedYears, "year", 2);
  }

  return `${validatedYears.toExponential(2)} years`;
}
