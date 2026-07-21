import {
  KERR_COMPARISON_PROVISIONAL_TOLERANCES,
  type KerrComparisonPlan,
  type KerrComparisonReferenceRayBinding,
} from "./kerr-comparison-plan.js";

export type KerrNumericComparisonDisposition =
  | "within-tolerance"
  | "disagreed"
  | "inconclusive"
  | "incompatible-conventions";

export type KerrNumericComparisonReason =
  | "camera-screen-coordinate-delta-not-adjudicated"
  | "seed-normalized-momentum-mismatch"
  | "seed-xi-mismatch"
  | "seed-eta-mismatch"
  | "reference-unresolved"
  | "candidate-unresolved"
  | "resolved-termination-mismatch"
  | "phi-winding-mismatch"
  | "event-surface-mismatch"
  | "event-radius-mismatch"
  | "endpoint-direction-mismatch"
  | "endpoint-normalized-momentum-mismatch";

export const KERR_NUMERIC_COMPARISON_REASON_ORDER = Object.freeze([
  "camera-screen-coordinate-delta-not-adjudicated",
  "seed-normalized-momentum-mismatch",
  "seed-xi-mismatch",
  "seed-eta-mismatch",
  "reference-unresolved",
  "candidate-unresolved",
  "resolved-termination-mismatch",
  "phi-winding-mismatch",
  "event-surface-mismatch",
  "event-radius-mismatch",
  "endpoint-direction-mismatch",
  "endpoint-normalized-momentum-mismatch",
] as const satisfies readonly KerrNumericComparisonReason[]);

export interface KerrNumericMomentumLike {
  readonly pTOverEnergy: number;
  readonly pROverEnergy: number;
  readonly pThetaOverEnergy: number;
  readonly pPhiOverEnergy: number;
}

export interface KerrNumericResolvedEndpointLike {
  readonly eventSurface: "horizon-guard" | "finite-escape-domain";
  readonly radiusRg: number;
  readonly thetaRadians: number;
  readonly phiWrappedRadians: number;
  readonly phiWinding: number;
  readonly momentum: KerrNumericMomentumLike;
  readonly coordinateTime: number;
  readonly energyTimesAffineParameter: number;
}

export interface KerrNumericCandidateRowLike {
  readonly screenX: number;
  readonly screenY: number;
  readonly termination:
    | "captured-horizon-guard"
    | "escaped-domain"
    | "coordinate-domain-exit"
    | "indeterminate-limit"
    | "numerical-failure";
  readonly initialMomentum: KerrNumericMomentumLike;
  readonly constants: {
    readonly xiAngularMomentumOverEnergy: number;
    readonly etaCarterQOverEnergySquared: number;
  };
  readonly endpoint: KerrNumericResolvedEndpointLike | null;
}

export interface KerrNumericScreenComparison {
  readonly referenceScreenX: number;
  readonly referenceScreenY: number;
  readonly candidateScreenX: number;
  readonly candidateScreenY: number;
  readonly screenXAbsoluteDelta: number;
  readonly screenYAbsoluteDelta: number;
  readonly matchesExactly: boolean;
  readonly tolerancePolicy:
    | "exact-integrator-input"
    | "no-pre-registered-camera-screen-tolerance";
}

export interface KerrNumericSeedComparison {
  readonly maxMomentumOverEnergyAbsoluteDelta: number;
  readonly xiAbsoluteDelta: number;
  readonly etaAbsoluteDelta: number;
  readonly etaAllowedDelta: number;
  readonly momentumWithinTolerance: boolean;
  readonly xiWithinTolerance: boolean;
  readonly etaWithinTolerance: boolean;
}

export interface KerrNumericEndpointComparison {
  readonly referenceEventSurface: "horizon-guard" | "finite-escape-domain";
  readonly candidateEventSurface: "horizon-guard" | "finite-escape-domain";
  readonly eventSurfaceMatches: boolean;
  readonly sphereChord: number;
  readonly eventRadiusAbsoluteDeltaRg: number;
  readonly phiWindingDelta: number;
  readonly maxMomentumOverEnergyAbsoluteDelta: number;
  readonly maxMomentumOverEnergyAllowedDelta: number;
  readonly directionWithinTolerance: boolean;
  readonly eventRadiusWithinTolerance: boolean;
  readonly phiWindingMatches: boolean;
  readonly momentumWithinTolerance: boolean;
  readonly coordinateTimeAbsoluteDelta: number;
  readonly energyTimesAffineParameterAbsoluteDelta: number;
}

export interface KerrNumericComparisonCoreRow {
  readonly screenComparison: KerrNumericScreenComparison;
  readonly referenceTermination: "captured-horizon-guard" | "escaped-domain";
  readonly candidateTermination: KerrNumericCandidateRowLike["termination"];
  readonly seedComparison: KerrNumericSeedComparison;
  readonly endpointComparison: KerrNumericEndpointComparison | null;
  readonly disposition: KerrNumericComparisonDisposition;
  readonly reasons: readonly KerrNumericComparisonReason[];
}

export type KerrNumericAgreement =
  | "within-pre-registered-tolerance"
  | "disagreed"
  | "inconclusive";

export interface KerrNumericComparisonSummary {
  readonly rowCount: number;
  readonly dispositionCounts: {
    readonly withinTolerance: number;
    readonly disagreed: number;
    readonly inconclusive: number;
    readonly incompatibleConventions: number;
  };
  readonly comparableEndpointCount: number;
  readonly maxScreenXAbsoluteDelta: number;
  readonly maxScreenYAbsoluteDelta: number;
  readonly screenCoordinateMismatchCount: number;
  readonly maxSeedMomentumOverEnergyAbsoluteDelta: number;
  readonly maxXiAbsoluteDelta: number;
  readonly maxEtaAbsoluteDelta: number;
  readonly maxEndpointSphereChord: number | null;
  readonly rmsEndpointSphereChord: number | null;
  readonly maxEventRadiusAbsoluteDeltaRg: number | null;
  readonly maxEndpointMomentumOverEnergyAbsoluteDelta: number | null;
  readonly numericAgreement: KerrNumericAgreement;
}

export function orderedKerrNumericReasons(
  reasons: ReadonlySet<KerrNumericComparisonReason>,
): KerrNumericComparisonReason[] {
  return KERR_NUMERIC_COMPARISON_REASON_ORDER.filter((reason) =>
    reasons.has(reason),
  );
}

export function kerrWithinInclusiveBoundary(
  value: number,
  limit: number,
): boolean {
  return value <= limit;
}

function absoluteDelta(left: number, right: number): number {
  const delta = Math.abs(left - right);
  if (!Number.isFinite(delta)) {
    throw new RangeError("Kerr comparison delta is non-finite");
  }
  return delta;
}

function mixedTolerance(
  reference: number,
  candidate: number,
  absoluteTolerance: number,
  relativeTolerance: number,
): { readonly delta: number; readonly allowed: number; readonly within: boolean } {
  const delta = absoluteDelta(reference, candidate);
  const allowed =
    absoluteTolerance +
    relativeTolerance * Math.max(Math.abs(reference), Math.abs(candidate));
  if (!Number.isFinite(allowed)) {
    throw new RangeError("Kerr comparison tolerance is non-finite");
  }
  return {
    delta,
    allowed,
    within: kerrWithinInclusiveBoundary(delta, allowed),
  };
}

function stableSphereChord(
  referenceTheta: number,
  referencePhi: number,
  candidateTheta: number,
  candidatePhi: number,
): number {
  const referenceSinTheta = Math.sin(referenceTheta);
  const candidateSinTheta = Math.sin(candidateTheta);
  const chord = Math.hypot(
    referenceSinTheta * Math.cos(referencePhi) -
      candidateSinTheta * Math.cos(candidatePhi),
    referenceSinTheta * Math.sin(referencePhi) -
      candidateSinTheta * Math.sin(candidatePhi),
    Math.cos(referenceTheta) - Math.cos(candidateTheta),
  );
  if (!Number.isFinite(chord)) {
    throw new RangeError("Kerr comparison sphere chord is non-finite");
  }
  // The exact chord between two unit vectors is in [0, 2]. Independent
  // trigonometric rounding can overshoot that closed interval by a few ulps
  // for antipodal directions, which must not turn valid disagreement into a
  // post-consumption schema failure.
  return Math.min(2, chord);
}

function maximum(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const result = Math.max(...values);
  if (!Number.isFinite(result)) {
    throw new RangeError("Kerr comparison maximum is non-finite");
  }
  return result;
}

function rootMeanSquare(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const scale = maximum(values.map(Math.abs));
  if (scale === 0) return 0;
  const normalizedSquares = values.reduce(
    (sum, value) => sum + (value / scale) ** 2,
    0,
  );
  const result = scale * Math.sqrt(normalizedSquares / values.length);
  if (!Number.isFinite(result)) {
    throw new RangeError("Kerr comparison RMS is non-finite");
  }
  return result;
}

function compareScreen(
  plan: KerrComparisonPlan,
  reference: KerrComparisonReferenceRayBinding,
  candidate: KerrNumericCandidateRowLike,
): KerrNumericScreenComparison {
  const screenXAbsoluteDelta = absoluteDelta(
    reference.screenX,
    candidate.screenX,
  );
  const screenYAbsoluteDelta = absoluteDelta(
    reference.screenY,
    candidate.screenY,
  );
  const matchesExactly =
    screenXAbsoluteDelta === 0 && screenYAbsoluteDelta === 0;
  if (plan.comparisonScope === "integrator-only" && !matchesExactly) {
    throw new Error(
      "Integrator-only Kerr comparison changed an exact supplied screen coordinate",
    );
  }
  return {
    referenceScreenX: reference.screenX,
    referenceScreenY: reference.screenY,
    candidateScreenX: candidate.screenX,
    candidateScreenY: candidate.screenY,
    screenXAbsoluteDelta,
    screenYAbsoluteDelta,
    matchesExactly,
    tolerancePolicy:
      plan.comparisonScope === "integrator-only"
        ? "exact-integrator-input"
        : "no-pre-registered-camera-screen-tolerance",
  };
}

function compareSeed(
  reference: KerrComparisonReferenceRayBinding,
  candidate: KerrNumericCandidateRowLike,
): KerrNumericSeedComparison {
  const referenceMomentum = reference.initialMomentum;
  const candidateMomentum = candidate.initialMomentum;
  const momentumDeltas = [
    absoluteDelta(
      referenceMomentum.pTOverEnergy,
      candidateMomentum.pTOverEnergy,
    ),
    absoluteDelta(
      referenceMomentum.pROverEnergy,
      candidateMomentum.pROverEnergy,
    ),
    absoluteDelta(
      referenceMomentum.pThetaOverEnergy,
      candidateMomentum.pThetaOverEnergy,
    ),
    absoluteDelta(
      referenceMomentum.pPhiOverEnergy,
      candidateMomentum.pPhiOverEnergy,
    ),
  ];
  const maxMomentumOverEnergyAbsoluteDelta = maximum(momentumDeltas);
  const xiAbsoluteDelta = absoluteDelta(
    reference.constants.xiAngularMomentumOverEnergy,
    candidate.constants.xiAngularMomentumOverEnergy,
  );
  const eta = mixedTolerance(
    reference.constants.etaCarterQOverEnergySquared,
    candidate.constants.etaCarterQOverEnergySquared,
    KERR_COMPARISON_PROVISIONAL_TOLERANCES.etaMaxAbsolute,
    KERR_COMPARISON_PROVISIONAL_TOLERANCES.etaMaxRelative,
  );
  return {
    maxMomentumOverEnergyAbsoluteDelta,
    xiAbsoluteDelta,
    etaAbsoluteDelta: eta.delta,
    etaAllowedDelta: eta.allowed,
    momentumWithinTolerance: kerrWithinInclusiveBoundary(
      maxMomentumOverEnergyAbsoluteDelta,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES
        .initialMomentumOverEnergyMaxAbsolute,
    ),
    xiWithinTolerance: kerrWithinInclusiveBoundary(
      xiAbsoluteDelta,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES.xiMaxAbsolute,
    ),
    etaWithinTolerance: eta.within,
  };
}

function compareEndpoint(
  reference: KerrComparisonReferenceRayBinding,
  candidate: KerrNumericResolvedEndpointLike,
): KerrNumericEndpointComparison {
  const referenceEndpoint = reference.referenceOutcome.endpoint;
  const sphereChord = stableSphereChord(
    referenceEndpoint.thetaRadians,
    referenceEndpoint.phiWrappedRadians,
    candidate.thetaRadians,
    candidate.phiWrappedRadians,
  );
  const eventRadiusAbsoluteDeltaRg = absoluteDelta(
    referenceEndpoint.radiusRg,
    candidate.radiusRg,
  );
  const phiWindingDelta = candidate.phiWinding - referenceEndpoint.phiWinding;
  if (!Number.isSafeInteger(phiWindingDelta)) {
    throw new RangeError("Kerr comparison azimuth winding delta is unsafe");
  }
  const referenceMomentum = referenceEndpoint.momentum;
  const candidateMomentum = candidate.momentum;
  const momentumComparisons = [
    mixedTolerance(
      referenceMomentum.pTOverEnergy,
      candidateMomentum.pTOverEnergy,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES
        .endpointMomentumOverEnergyMaxAbsolute,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES
        .endpointMomentumOverEnergyMaxRelative,
    ),
    mixedTolerance(
      referenceMomentum.pROverEnergy,
      candidateMomentum.pROverEnergy,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES
        .endpointMomentumOverEnergyMaxAbsolute,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES
        .endpointMomentumOverEnergyMaxRelative,
    ),
    mixedTolerance(
      referenceMomentum.pThetaOverEnergy,
      candidateMomentum.pThetaOverEnergy,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES
        .endpointMomentumOverEnergyMaxAbsolute,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES
        .endpointMomentumOverEnergyMaxRelative,
    ),
    mixedTolerance(
      referenceMomentum.pPhiOverEnergy,
      candidateMomentum.pPhiOverEnergy,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES
        .endpointMomentumOverEnergyMaxAbsolute,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES
        .endpointMomentumOverEnergyMaxRelative,
    ),
  ];
  return {
    referenceEventSurface: reference.referenceOutcome.eventSurface,
    candidateEventSurface: candidate.eventSurface,
    eventSurfaceMatches:
      candidate.eventSurface === reference.referenceOutcome.eventSurface,
    sphereChord,
    eventRadiusAbsoluteDeltaRg,
    phiWindingDelta,
    maxMomentumOverEnergyAbsoluteDelta: maximum(
      momentumComparisons.map(({ delta }) => delta),
    ),
    maxMomentumOverEnergyAllowedDelta: maximum(
      momentumComparisons.map(({ allowed }) => allowed),
    ),
    directionWithinTolerance: kerrWithinInclusiveBoundary(
      sphereChord,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES
        .endpointSphereChordMaxAbsolute,
    ),
    eventRadiusWithinTolerance: kerrWithinInclusiveBoundary(
      eventRadiusAbsoluteDeltaRg,
      KERR_COMPARISON_PROVISIONAL_TOLERANCES.eventRadiusMaxAbsoluteRg,
    ),
    phiWindingMatches: phiWindingDelta === 0,
    momentumWithinTolerance: momentumComparisons.every(({ within }) => within),
    coordinateTimeAbsoluteDelta: absoluteDelta(
      referenceEndpoint.coordinateTime,
      candidate.coordinateTime,
    ),
    energyTimesAffineParameterAbsoluteDelta: absoluteDelta(
      referenceEndpoint.energyTimesAffineParameter,
      candidate.energyTimesAffineParameter,
    ),
  };
}

export function compareKerrNumericRow(
  plan: KerrComparisonPlan,
  reference: KerrComparisonReferenceRayBinding,
  candidate: KerrNumericCandidateRowLike,
): KerrNumericComparisonCoreRow {
  const screenComparison = compareScreen(plan, reference, candidate);
  const seedComparison = compareSeed(reference, candidate);
  const reasons = new Set<KerrNumericComparisonReason>();
  if (!screenComparison.matchesExactly) {
    reasons.add("camera-screen-coordinate-delta-not-adjudicated");
  }
  if (!seedComparison.momentumWithinTolerance) {
    reasons.add("seed-normalized-momentum-mismatch");
  }
  if (!seedComparison.xiWithinTolerance) reasons.add("seed-xi-mismatch");
  if (!seedComparison.etaWithinTolerance) reasons.add("seed-eta-mismatch");
  const seedCompatible =
    seedComparison.momentumWithinTolerance &&
    seedComparison.xiWithinTolerance &&
    seedComparison.etaWithinTolerance;

  let disposition: KerrNumericComparisonDisposition;
  let endpointComparison: KerrNumericEndpointComparison | null = null;
  const candidateResolved =
    candidate.termination === "captured-horizon-guard" ||
    candidate.termination === "escaped-domain";
  if (!seedCompatible) {
    disposition = "incompatible-conventions";
  } else if (!candidateResolved || candidate.endpoint === null) {
    reasons.add("candidate-unresolved");
    disposition = "inconclusive";
  } else if (candidate.termination !== reference.referenceOutcome.termination) {
    reasons.add("resolved-termination-mismatch");
    disposition = "disagreed";
  } else {
    endpointComparison = compareEndpoint(reference, candidate.endpoint);
    if (!endpointComparison.phiWindingMatches) {
      reasons.add("phi-winding-mismatch");
    }
    if (!endpointComparison.eventSurfaceMatches) {
      reasons.add("event-surface-mismatch");
    }
    if (!endpointComparison.eventRadiusWithinTolerance) {
      reasons.add("event-radius-mismatch");
    }
    if (!endpointComparison.directionWithinTolerance) {
      reasons.add("endpoint-direction-mismatch");
    }
    if (!endpointComparison.momentumWithinTolerance) {
      reasons.add("endpoint-normalized-momentum-mismatch");
    }
    const endpointWithinTolerance =
      endpointComparison.phiWindingMatches &&
      endpointComparison.eventSurfaceMatches &&
      endpointComparison.eventRadiusWithinTolerance &&
      endpointComparison.directionWithinTolerance &&
      endpointComparison.momentumWithinTolerance;
    disposition = endpointWithinTolerance ? "within-tolerance" : "disagreed";
  }
  if (
    !screenComparison.matchesExactly &&
    disposition === "within-tolerance"
  ) {
    disposition = "inconclusive";
  }
  return {
    screenComparison,
    referenceTermination: reference.referenceOutcome.termination,
    candidateTermination: candidate.termination,
    seedComparison,
    endpointComparison,
    disposition,
    reasons: orderedKerrNumericReasons(reasons),
  };
}

function aggregateNumericAgreement(
  dispositions: readonly KerrNumericComparisonDisposition[],
): KerrNumericAgreement {
  if (dispositions.includes("disagreed")) return "disagreed";
  if (
    dispositions.includes("inconclusive") ||
    dispositions.includes("incompatible-conventions")
  ) {
    return "inconclusive";
  }
  return "within-pre-registered-tolerance";
}

export function summarizeKerrNumericRows(
  rows: readonly KerrNumericComparisonCoreRow[],
): KerrNumericComparisonSummary {
  if (rows.length === 0) {
    throw new RangeError("Kerr numeric comparison requires at least one row");
  }
  const dispositionCounts = {
    withinTolerance: 0,
    disagreed: 0,
    inconclusive: 0,
    incompatibleConventions: 0,
  };
  for (const row of rows) {
    if (row.disposition === "within-tolerance") {
      dispositionCounts.withinTolerance += 1;
    } else if (row.disposition === "disagreed") {
      dispositionCounts.disagreed += 1;
    } else if (row.disposition === "inconclusive") {
      dispositionCounts.inconclusive += 1;
    } else {
      dispositionCounts.incompatibleConventions += 1;
    }
  }
  const endpoints = rows.flatMap(({ endpointComparison }) =>
    endpointComparison === null ? [] : [endpointComparison],
  );
  const sphereChords = endpoints.map(({ sphereChord }) => sphereChord);
  return {
    rowCount: rows.length,
    dispositionCounts,
    comparableEndpointCount: endpoints.length,
    maxScreenXAbsoluteDelta: maximum(
      rows.map(({ screenComparison }) =>
        screenComparison.screenXAbsoluteDelta,
      ),
    ),
    maxScreenYAbsoluteDelta: maximum(
      rows.map(({ screenComparison }) =>
        screenComparison.screenYAbsoluteDelta,
      ),
    ),
    screenCoordinateMismatchCount: rows.filter(
      ({ screenComparison }) => !screenComparison.matchesExactly,
    ).length,
    maxSeedMomentumOverEnergyAbsoluteDelta: maximum(
      rows.map(
        ({ seedComparison }) =>
          seedComparison.maxMomentumOverEnergyAbsoluteDelta,
      ),
    ),
    maxXiAbsoluteDelta: maximum(
      rows.map(({ seedComparison }) => seedComparison.xiAbsoluteDelta),
    ),
    maxEtaAbsoluteDelta: maximum(
      rows.map(({ seedComparison }) => seedComparison.etaAbsoluteDelta),
    ),
    maxEndpointSphereChord:
      endpoints.length === 0 ? null : maximum(sphereChords),
    rmsEndpointSphereChord: rootMeanSquare(sphereChords),
    maxEventRadiusAbsoluteDeltaRg:
      endpoints.length === 0
        ? null
        : maximum(
            endpoints.map(
              ({ eventRadiusAbsoluteDeltaRg }) =>
                eventRadiusAbsoluteDeltaRg,
            ),
          ),
    maxEndpointMomentumOverEnergyAbsoluteDelta:
      endpoints.length === 0
        ? null
        : maximum(
            endpoints.map(
              ({ maxMomentumOverEnergyAbsoluteDelta }) =>
                maxMomentumOverEnergyAbsoluteDelta,
            ),
          ),
    numericAgreement: aggregateNumericAgreement(
      rows.map(({ disposition }) => disposition),
    ),
  };
}
