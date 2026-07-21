import { outerHorizonRadiusRg } from "./kerr.js";

/**
 * Vacuum Kerr reference mathematics in geometric units G = M = c = 1.
 * Coordinates are Boyer-Lindquist (t, r, theta, phi), theta is colatitude,
 * the metric signature is -+++, and `spin` is the signed dimensionless a/M.
 *
 * This module is a bounded numerical reference, not render authority. In
 * particular, stopping at a Boyer-Lindquist horizon guard is not a numerical
 * integration through the event horizon, and an outbound domain exit is not a
 * proof that the ray reached future null infinity.
 */

export type KerrVector4 = readonly [number, number, number, number];
export type KerrMatrix4 = readonly [
  KerrVector4,
  KerrVector4,
  KerrVector4,
  KerrVector4,
];

export interface KerrRayState {
  readonly t: number;
  readonly r: number;
  readonly theta: number;
  readonly phi: number;
  readonly pT: number;
  readonly pR: number;
  readonly pTheta: number;
  readonly pPhi: number;
}

export interface KerrConstantsOfMotion {
  readonly energy: number;
  readonly angularMomentumZ: number;
  readonly carterQ: number;
  readonly hamiltonian: number;
}

export interface KerrTraceDiagnostics {
  /** Coordinate/affine-scale-sensitive diagnostic; never an acceptance gate. */
  readonly maxAbsoluteHamiltonian: number;
  readonly maxNormalizedNullResidual: number;
  readonly maxRelativeEnergyDrift: number;
  readonly maxRelativeAngularMomentumDrift: number;
  readonly maxRelativeCarterDrift: number;
  readonly maxNormalizedRadialPotentialResidual: number;
  readonly maxNormalizedPolarPotentialResidual: number;
  readonly minRadiusRg: number;
  readonly maxRadiusRg: number;
  readonly minThetaRadians: number;
  readonly maxThetaRadians: number;
  readonly minStep: number;
  readonly maxStep: number;
}

export type KerrRayTermination =
  | "captured-horizon-guard"
  | "escaped-domain"
  | "coordinate-domain-exit"
  | "indeterminate-limit"
  | "numerical-failure";

export const KERR_TERMINATION_REASONS = Object.freeze({
  horizonGuardReached: "horizon-guard-reached",
  finiteEscapeDomainReached: "finite-escape-domain-reached",
  polarCoordinateGuardReached: "polar-coordinate-guard-reached",
  affineParameterLimitReached: "affine-parameter-limit-reached",
  stepLimitReached: "step-limit-reached",
  nonFiniteState: "non-finite-state",
  metricDomainExit: "metric-domain-exit",
  eventStepUnderflow: "event-step-underflow",
  rk4DomainExit: "rk4-domain-exit",
  timeOrientationViolation: "time-orientation-violation",
  invariantDiagnosticDomainExit: "invariant-diagnostic-domain-exit",
  invariantToleranceExceeded: "invariant-tolerance-exceeded",
} as const);

export type KerrTerminationReason =
  (typeof KERR_TERMINATION_REASONS)[keyof typeof KERR_TERMINATION_REASONS];

/**
 * Internal numerical-safety limits. Passing them is not scientific validation;
 * exceeding any one prevents the ray from yielding a classified coordinate.
 */
export const KERR_REFERENCE_INVARIANT_LIMITS = Object.freeze({
  maxNormalizedNullResidual: 1e-5,
  maxRelativeCarterDrift: 1e-5,
  maxNormalizedPotentialResidual: 1e-4,
} as const);

export interface KerrSingleRayTrace {
  readonly termination: KerrRayTermination;
  readonly terminationReason: KerrTerminationReason;
  readonly steps: number;
  readonly affineParameter: number;
  readonly initialState: KerrRayState;
  readonly finalState: KerrRayState;
  readonly constants: KerrConstantsOfMotion;
  readonly diagnostics: KerrTraceDiagnostics;
}

export interface KerrSingleRayTraceOptions {
  readonly spin: number;
  /** Nominal RK4 step; a terminal boundary step is deterministically shortened. */
  readonly stepSize: number;
  readonly maxSteps: number;
  readonly maxAffineParameter: number;
  readonly horizonGuardRg: number;
  readonly escapeRadiusRg: number;
  readonly thetaGuardRadians: number;
}

export interface KerrZamoScreenRayInput {
  readonly spin: number;
  readonly radiusRg: number;
  readonly thetaRadians: number;
  readonly phiRadians: number;
  /** Tangent-plane horizontal coordinate; positive points with increasing phi. */
  readonly screenX: number;
  /** Tangent-plane vertical coordinate; positive points toward decreasing theta. */
  readonly screenY: number;
}

interface KerrMetricScalars {
  readonly sigma: number;
  readonly delta: number;
  readonly aFunction: number;
  readonly sinTheta: number;
  readonly cosTheta: number;
}

type ReducedState = [number, number, number, number, number, number];

const MIN_DOMAIN_MARGIN = 1e-12;
const MIN_CANONICAL_MOMENTUM_NORM = 1e-6;
const MAX_CANONICAL_MOMENTUM_NORM = 1e6;
const MIN_ENERGY_AT_INFINITY = 1e-6;
const MAX_ENERGY_AT_INFINITY = 1e6;
const INITIAL_NORMALIZED_NULL_TOLERANCE = 1e-10;
export const KERR_REFERENCE_EVENT_LOCALIZATION_ITERATIONS = 52;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }
}

function assertFiniteValues(values: readonly number[], label: string): void {
  if (!values.every(Number.isFinite)) {
    throw new RangeError(`${label} produced a non-finite derived value.`);
  }
}

function assertFiniteMatrix(matrix: KerrMatrix4, label: string): KerrMatrix4 {
  for (const row of matrix) assertFiniteValues(row, label);
  return matrix;
}

function assertSpin(spin: number): void {
  assertFinite(spin, "Kerr spin");
  if (Math.abs(spin) > 0.999) {
    throw new RangeError(
      "The first reference tracer is bounded to a sub-extremal Kerr spin with |a| <= 0.999.",
    );
  }
}

function metricScalars(
  spin: number,
  radiusRg: number,
  thetaRadians: number,
): KerrMetricScalars {
  assertSpin(spin);
  assertFinite(radiusRg, "Boyer-Lindquist radius");
  assertFinite(thetaRadians, "Boyer-Lindquist colatitude");
  const sinTheta = Math.sin(thetaRadians);
  const cosTheta = Math.cos(thetaRadians);
  const sigma = radiusRg ** 2 + spin ** 2 * cosTheta ** 2;
  const delta = radiusRg ** 2 - 2 * radiusRg + spin ** 2;
  const aFunction =
    (radiusRg ** 2 + spin ** 2) ** 2 -
    spin ** 2 * delta * sinTheta ** 2;
  const outerHorizon = outerHorizonRadiusRg(spin);
  assertFiniteValues(
    [sinTheta, cosTheta, sigma, delta, aFunction, outerHorizon],
    "Kerr metric scalars",
  );
  if (
    radiusRg <= outerHorizon ||
    thetaRadians <= 0 ||
    thetaRadians >= Math.PI ||
    Math.abs(sinTheta) <= MIN_DOMAIN_MARGIN ||
    sigma <= 0 ||
    delta <= 0 ||
    aFunction <= 0
  ) {
    throw new RangeError(
      "Point is outside the supported exterior Boyer-Lindquist coordinate domain.",
    );
  }
  return { sigma, delta, aFunction, sinTheta, cosTheta };
}

/** Covariant Kerr metric g_(mu nu), ordered (t, r, theta, phi). */
export function kerrMetricCovariant(
  spin: number,
  radiusRg: number,
  thetaRadians: number,
): KerrMatrix4 {
  const { sigma, delta, aFunction, sinTheta } = metricScalars(
    spin,
    radiusRg,
    thetaRadians,
  );
  const sinSquared = sinTheta ** 2;
  const gTt = -(1 - (2 * radiusRg) / sigma);
  const gTPhi = (-2 * spin * radiusRg * sinSquared) / sigma;
  return assertFiniteMatrix(
    [
      [gTt, 0, 0, gTPhi],
      [0, sigma / delta, 0, 0],
      [0, 0, sigma, 0],
      [gTPhi, 0, 0, (aFunction * sinSquared) / sigma],
    ],
    "Covariant Kerr metric",
  );
}

/** Contravariant Kerr metric g^(mu nu), ordered (t, r, theta, phi). */
export function kerrMetricContravariant(
  spin: number,
  radiusRg: number,
  thetaRadians: number,
): KerrMatrix4 {
  const { sigma, delta, aFunction, sinTheta } = metricScalars(
    spin,
    radiusRg,
    thetaRadians,
  );
  const denominator = sigma * delta;
  const sinSquared = sinTheta ** 2;
  const gTt = -aFunction / denominator;
  const gTPhi = (-2 * spin * radiusRg) / denominator;
  const gPhiPhi =
    (delta - spin ** 2 * sinSquared) /
    (denominator * sinSquared);
  return assertFiniteMatrix(
    [
      [gTt, 0, 0, gTPhi],
      [0, delta / sigma, 0, 0],
      [0, 0, 1 / sigma, 0],
      [gTPhi, 0, 0, gPhiPhi],
    ],
    "Contravariant Kerr metric",
  );
}

export function multiplyKerrMatrices(
  left: KerrMatrix4,
  right: KerrMatrix4,
): KerrMatrix4 {
  const rows: number[][] = [];
  for (let row = 0; row < 4; row += 1) {
    const values: number[] = [];
    for (let column = 0; column < 4; column += 1) {
      let value = 0;
      for (let inner = 0; inner < 4; inner += 1) {
        value += left[row]![inner]! * right[inner]![column]!;
      }
      values.push(value);
    }
    rows.push(values);
  }
  return assertFiniteMatrix(
    rows as unknown as KerrMatrix4,
    "Kerr matrix product",
  );
}

export function kerrMetricInverseResidual(
  spin: number,
  radiusRg: number,
  thetaRadians: number,
): number {
  const product = multiplyKerrMatrices(
    kerrMetricCovariant(spin, radiusRg, thetaRadians),
    kerrMetricContravariant(spin, radiusRg, thetaRadians),
  );
  let maximum = 0;
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      maximum = Math.max(
        maximum,
        Math.abs(product[row]![column]! - (row === column ? 1 : 0)),
      );
    }
  }
  return maximum;
}

function lowerMomentum(metric: KerrMatrix4, vector: KerrVector4): KerrVector4 {
  const lowered = metric.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index]!, 0),
  ) as unknown as KerrVector4;
  assertFiniteValues(lowered, "Lowered Kerr momentum");
  return lowered;
}

/**
 * Builds one future-directed, locally unit-energy null ray in the orthonormal
 * ZAMO tetrad. The screen points inward (-e_r); +screenY points north
 * (-e_theta), because Boyer-Lindquist theta is colatitude.
 */
export function createKerrZamoScreenRay(
  input: KerrZamoScreenRayInput,
): KerrRayState {
  for (const [label, value] of [
    ["camera radius", input.radiusRg],
    ["camera theta", input.thetaRadians],
    ["camera phi", input.phiRadians],
    ["screen x", input.screenX],
    ["screen y", input.screenY],
  ] as const) {
    assertFinite(value, label);
  }
  const scalars = metricScalars(
    input.spin,
    input.radiusRg,
    input.thetaRadians,
  );
  const staticLimit =
    1 +
    Math.sqrt(
      Math.max(
        0,
        1 - input.spin ** 2 * scalars.cosTheta ** 2,
      ),
    );
  if (input.radiusRg <= staticLimit) {
    throw new RangeError(
      "The first reference camera must remain outside the Kerr static limit.",
    );
  }
  const directionNorm = Math.hypot(1, input.screenX, input.screenY);
  if (!Number.isFinite(directionNorm) || directionNorm <= 0) {
    throw new RangeError("ZAMO screen direction cannot be normalized safely.");
  }
  const nR = -1 / directionNorm;
  const nTheta = -input.screenY / directionNorm;
  const nPhi = input.screenX / directionNorm;
  const normalizedDirection = Math.hypot(nR, nTheta, nPhi);
  if (
    !Number.isFinite(normalizedDirection) ||
    Math.abs(normalizedDirection - 1) > 32 * Number.EPSILON
  ) {
    throw new RangeError("ZAMO screen direction is not a finite unit vector.");
  }
  const lapse = Math.sqrt(
    (scalars.sigma * scalars.delta) / scalars.aFunction,
  );
  const frameDragging =
    (2 * input.spin * input.radiusRg) / scalars.aFunction;
  const contravariantMomentum: KerrVector4 = [
    1 / lapse,
    nR * Math.sqrt(scalars.delta / scalars.sigma),
    nTheta / Math.sqrt(scalars.sigma),
    frameDragging / lapse +
      (nPhi * Math.sqrt(scalars.sigma / scalars.aFunction)) /
        scalars.sinTheta,
  ];
  assertFiniteValues(
    contravariantMomentum,
    "ZAMO contravariant momentum",
  );
  const covariant = lowerMomentum(
    kerrMetricCovariant(
      input.spin,
      input.radiusRg,
      input.thetaRadians,
    ),
    contravariantMomentum,
  );
  const state: KerrRayState = {
    t: 0,
    r: input.radiusRg,
    theta: input.thetaRadians,
    phi: input.phiRadians,
    pT: covariant[0],
    pR: covariant[1],
    pTheta: covariant[2],
    pPhi: covariant[3],
  };
  if (!finiteState(state)) {
    throw new RangeError("ZAMO camera ray produced a non-finite canonical state.");
  }
  const energy = -state.pT;
  if (!Number.isFinite(energy) || energy <= 0) {
    throw new RangeError("ZAMO camera ray must have positive energy at infinity.");
  }
  const normalizedNullResidual = kerrNormalizedNullResidual(input.spin, state);
  if (
    !Number.isFinite(normalizedNullResidual) ||
    normalizedNullResidual > INITIAL_NORMALIZED_NULL_TOLERANCE
  ) {
    throw new RangeError(
      "ZAMO camera ray failed normalized null verification.",
    );
  }
  return state;
}

/** Incoming equatorial null ray with E=1 and Lz=`impactParameter`. */
export function createSchwarzschildEquatorialImpactRay(
  radiusRg: number,
  impactParameter: number,
): KerrRayState {
  assertFinite(radiusRg, "initial radius");
  assertFinite(impactParameter, "impact parameter");
  const inverse = kerrMetricContravariant(0, radiusRg, Math.PI / 2);
  const pT = -1;
  const pPhi = impactParameter;
  const angular =
    inverse[0][0] * pT ** 2 + inverse[3][3] * pPhi ** 2;
  const radialSquared = -angular / inverse[1][1];
  if (!Number.isFinite(radialSquared) || radialSquared <= 0) {
    throw new RangeError("Impact ray has no inward real null momentum here.");
  }
  return {
    t: 0,
    r: radiusRg,
    theta: Math.PI / 2,
    phi: 0,
    pT,
    pR: -Math.sqrt(radialSquared),
    pTheta: 0,
    pPhi,
  };
}

export function kerrNullHamiltonian(
  spin: number,
  state: KerrRayState,
): number {
  const inverse = kerrMetricContravariant(spin, state.r, state.theta);
  const momentum: KerrVector4 = [
    state.pT,
    state.pR,
    state.pTheta,
    state.pPhi,
  ];
  let contraction = 0;
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      contraction +=
        inverse[row]![column]! * momentum[row]! * momentum[column]!;
    }
  }
  if (!Number.isFinite(contraction)) {
    throw new RangeError("Kerr Hamiltonian contraction is non-finite.");
  }
  return 0.5 * contraction;
}

/** Boyer-Lindquist dt/dlambda for the canonical ray momentum. */
export function kerrContravariantTimeDerivative(
  spin: number,
  state: KerrRayState,
): number {
  const inverse = kerrMetricContravariant(spin, state.r, state.theta);
  const derivative =
    inverse[0][0] * state.pT + inverse[0][3] * state.pPhi;
  if (!Number.isFinite(derivative)) {
    throw new RangeError("Kerr time-orientation derivative is non-finite.");
  }
  return derivative;
}

/** Scale-independent null-constraint residual for canonical momentum. */
export function kerrNormalizedNullResidual(
  spin: number,
  state: KerrRayState,
): number {
  const inverse = kerrMetricContravariant(spin, state.r, state.theta);
  const momentum: KerrVector4 = [
    state.pT,
    state.pR,
    state.pTheta,
    state.pPhi,
  ];
  let contraction = 0;
  let scale = 0;
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const term =
        inverse[row]![column]! * momentum[row]! * momentum[column]!;
      if (!Number.isFinite(term)) {
        throw new RangeError("Normalized null residual has a non-finite term.");
      }
      contraction += term;
      scale += Math.abs(term);
    }
  }
  if (!Number.isFinite(contraction) || !Number.isFinite(scale) || scale <= 0) {
    throw new RangeError("Normalized null residual has no finite momentum scale.");
  }
  const residual = Math.abs(contraction) / scale;
  if (!Number.isFinite(residual)) {
    throw new RangeError("Normalized null residual is non-finite.");
  }
  return residual;
}

export function kerrConstantsOfMotion(
  spin: number,
  state: KerrRayState,
): KerrConstantsOfMotion {
  const energy = -state.pT;
  const angularMomentumZ = state.pPhi;
  const sinTheta = Math.sin(state.theta);
  const cosTheta = Math.cos(state.theta);
  if (Math.abs(sinTheta) <= MIN_DOMAIN_MARGIN) {
    throw new RangeError("Carter constant is undefined on the coordinate pole.");
  }
  const carterQ =
    state.pTheta ** 2 +
    cosTheta ** 2 *
      (angularMomentumZ ** 2 / sinTheta ** 2 - spin ** 2 * energy ** 2);
  const hamiltonian = kerrNullHamiltonian(spin, state);
  assertFiniteValues(
    [energy, angularMomentumZ, carterQ, hamiltonian],
    "Kerr constants of motion",
  );
  return {
    energy,
    angularMomentumZ,
    carterQ,
    hamiltonian,
  };
}

function inverseMetricDerivatives(
  spin: number,
  radiusRg: number,
  thetaRadians: number,
): { readonly radial: KerrMatrix4; readonly polar: KerrMatrix4 } {
  const { sigma, delta, aFunction, sinTheta, cosTheta } = metricScalars(
    spin,
    radiusRg,
    thetaRadians,
  );
  const sinSquared = sinTheta ** 2;
  const sigmaR = 2 * radiusRg;
  const sigmaTheta = -2 * spin ** 2 * cosTheta * sinTheta;
  const deltaR = 2 * radiusRg - 2;
  const base = radiusRg ** 2 + spin ** 2;
  const aR = 4 * radiusRg * base - spin ** 2 * deltaR * sinSquared;
  const aTheta = -2 * spin ** 2 * delta * sinTheta * cosTheta;
  const denominator = sigma * delta;
  const denominatorR = sigmaR * delta + sigma * deltaR;
  const denominatorTheta = sigmaTheta * delta;

  const quotientDerivative = (
    numerator: number,
    numeratorDerivative: number,
    divisor: number,
    divisorDerivative: number,
  ) =>
    (numeratorDerivative * divisor - numerator * divisorDerivative) /
    divisor ** 2;

  const gTtR = quotientDerivative(
    -aFunction,
    -aR,
    denominator,
    denominatorR,
  );
  const gTtTheta = quotientDerivative(
    -aFunction,
    -aTheta,
    denominator,
    denominatorTheta,
  );
  const crossNumerator = -2 * spin * radiusRg;
  const gTPhiR = quotientDerivative(
    crossNumerator,
    -2 * spin,
    denominator,
    denominatorR,
  );
  const gTPhiTheta = quotientDerivative(
    crossNumerator,
    0,
    denominator,
    denominatorTheta,
  );
  const gRrR = quotientDerivative(delta, deltaR, sigma, sigmaR);
  const gRrTheta = quotientDerivative(delta, 0, sigma, sigmaTheta);
  const gThetaThetaR = -sigmaR / sigma ** 2;
  const gThetaThetaTheta = -sigmaTheta / sigma ** 2;

  const phiNumerator = delta - spin ** 2 * sinSquared;
  const phiNumeratorR = deltaR;
  const phiNumeratorTheta = -2 * spin ** 2 * sinTheta * cosTheta;
  const phiDenominator = denominator * sinSquared;
  const phiDenominatorR = denominatorR * sinSquared;
  const phiDenominatorTheta =
    denominatorTheta * sinSquared +
    denominator * 2 * sinTheta * cosTheta;
  const gPhiPhiR = quotientDerivative(
    phiNumerator,
    phiNumeratorR,
    phiDenominator,
    phiDenominatorR,
  );
  const gPhiPhiTheta = quotientDerivative(
    phiNumerator,
    phiNumeratorTheta,
    phiDenominator,
    phiDenominatorTheta,
  );
  const radial = assertFiniteMatrix(
    [
      [gTtR, 0, 0, gTPhiR],
      [0, gRrR, 0, 0],
      [0, 0, gThetaThetaR, 0],
      [gTPhiR, 0, 0, gPhiPhiR],
    ],
    "Radial inverse-metric derivative",
  );
  const polar = assertFiniteMatrix(
    [
      [gTtTheta, 0, 0, gTPhiTheta],
      [0, gRrTheta, 0, 0],
      [0, 0, gThetaThetaTheta, 0],
      [gTPhiTheta, 0, 0, gPhiPhiTheta],
    ],
    "Polar inverse-metric derivative",
  );
  return { radial, polar };
}

function metricContraction(
  derivative: KerrMatrix4,
  momentum: KerrVector4,
): number {
  let result = 0;
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      result +=
        derivative[row]![column]! * momentum[row]! * momentum[column]!;
    }
  }
  if (!Number.isFinite(result)) {
    throw new RangeError("Inverse-metric derivative contraction is non-finite.");
  }
  return result;
}

function derivative(
  spin: number,
  pT: number,
  pPhi: number,
  state: ReducedState,
): ReducedState {
  const [, radiusRg, thetaRadians, , pR, pTheta] = state;
  const inverse = kerrMetricContravariant(spin, radiusRg, thetaRadians);
  const derivatives = inverseMetricDerivatives(spin, radiusRg, thetaRadians);
  const momentum: KerrVector4 = [pT, pR, pTheta, pPhi];
  const result: ReducedState = [
    inverse[0][0] * pT + inverse[0][3] * pPhi,
    inverse[1][1] * pR,
    inverse[2][2] * pTheta,
    inverse[3][0] * pT + inverse[3][3] * pPhi,
    -0.5 * metricContraction(derivatives.radial, momentum),
    -0.5 * metricContraction(derivatives.polar, momentum),
  ];
  assertFiniteValues(result, "Kerr Hamiltonian derivative");
  return result;
}

function addScaled(
  state: ReducedState,
  slope: ReducedState,
  scale: number,
): ReducedState {
  return state.map((value, index) => value + slope[index]! * scale) as ReducedState;
}

function rk4Step(
  spin: number,
  pT: number,
  pPhi: number,
  state: ReducedState,
  step: number,
): ReducedState {
  const k1 = derivative(spin, pT, pPhi, state);
  const k2 = derivative(spin, pT, pPhi, addScaled(state, k1, step / 2));
  const k3 = derivative(spin, pT, pPhi, addScaled(state, k2, step / 2));
  const k4 = derivative(spin, pT, pPhi, addScaled(state, k3, step));
  const result = state.map(
    (value, index) =>
      value +
      (step / 6) *
        (k1[index]! + 2 * k2[index]! + 2 * k3[index]! + k4[index]!),
  ) as ReducedState;
  assertFiniteValues(result, "RK4 state");
  return result;
}

type RadialBoundaryDirection = "inward" | "outward";

function crossedRadialBoundary(
  radius: number,
  boundary: number,
  direction: RadialBoundaryDirection,
): boolean {
  return direction === "inward" ? radius <= boundary : radius >= boundary;
}

/**
 * Replays a bracketed RK4 step with a fixed-count bisection and snaps only the
 * radial coordinate to the declared boundary after the bracket reaches Float64
 * resolution. Other phase-space components remain those of the crossing-side
 * RK4 state.
 */
function localizeRadialBoundary(
  spin: number,
  pT: number,
  pPhi: number,
  state: ReducedState,
  fullStep: number,
  fullState: ReducedState,
  boundary: number,
  direction: RadialBoundaryDirection,
): { readonly state: ReducedState; readonly step: number } {
  if (
    crossedRadialBoundary(state[1], boundary, direction) ||
    !crossedRadialBoundary(fullState[1], boundary, direction)
  ) {
    throw new RangeError("Radial event is not bracketed by the RK4 step.");
  }
  let lowerStep = 0;
  let upperStep = fullStep;
  let upperState = fullState;
  for (
    let iteration = 0;
    iteration < KERR_REFERENCE_EVENT_LOCALIZATION_ITERATIONS;
    iteration += 1
  ) {
    const middleStep = lowerStep + (upperStep - lowerStep) / 2;
    if (middleStep === lowerStep || middleStep === upperStep) break;
    const middleState = rk4Step(spin, pT, pPhi, state, middleStep);
    if (crossedRadialBoundary(middleState[1], boundary, direction)) {
      upperStep = middleStep;
      upperState = middleState;
    } else {
      lowerStep = middleStep;
    }
  }
  const localized: ReducedState = [...upperState];
  localized[1] = boundary;
  assertFiniteValues(localized, "Localized radial event state");
  return { state: localized, step: upperStep };
}

function expandedState(
  state: ReducedState,
  pT: number,
  pPhi: number,
): KerrRayState {
  return {
    t: state[0],
    r: state[1],
    theta: state[2],
    phi: state[3],
    pT,
    pR: state[4],
    pTheta: state[5],
    pPhi,
  };
}

function finiteState(state: KerrRayState): boolean {
  return Object.values(state).every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
}

function relativeDrift(value: number, initial: number): number {
  const drift = Math.abs(value - initial) / Math.max(1, Math.abs(initial));
  if (!Number.isFinite(drift)) {
    throw new RangeError("Invariant drift is non-finite.");
  }
  return drift;
}

function potentialResiduals(
  spin: number,
  state: KerrRayState,
  constants: KerrConstantsOfMotion,
): { radial: number; polar: number } {
  const { sigma: _sigma, delta } = metricScalars(
    spin,
    state.r,
    state.theta,
  );
  const energy = constants.energy;
  const angularMomentum = constants.angularMomentumZ;
  const radialMomentumTerm =
    energy * (state.r ** 2 + spin ** 2) - spin * angularMomentum;
  const radialPotential =
    radialMomentumTerm ** 2 -
    delta *
      (constants.carterQ + (angularMomentum - spin * energy) ** 2);
  const radialLeft = delta ** 2 * state.pR ** 2;
  const sinTheta = Math.sin(state.theta);
  const cosTheta = Math.cos(state.theta);
  const polarPotential =
    constants.carterQ +
    spin ** 2 * energy ** 2 * cosTheta ** 2 -
    (angularMomentum ** 2 * cosTheta ** 2) / sinTheta ** 2;
  const polarLeft = state.pTheta ** 2;
  const radial =
    Math.abs(radialLeft - radialPotential) /
    Math.max(1, Math.abs(radialLeft), Math.abs(radialPotential));
  const polar =
    Math.abs(polarLeft - polarPotential) /
    Math.max(1, Math.abs(polarLeft), Math.abs(polarPotential));
  assertFiniteValues(
    [radialPotential, polarPotential, radialLeft, polarLeft, radial, polar],
    "Separated Kerr potential diagnostics",
  );
  return { radial, polar };
}

function exceedsInvariantLimits(
  normalizedNullResidual: number,
  relativeCarterDrift: number,
  radialPotentialResidual: number,
  polarPotentialResidual: number,
): boolean {
  return (
    normalizedNullResidual >
      KERR_REFERENCE_INVARIANT_LIMITS.maxNormalizedNullResidual ||
    relativeCarterDrift >
      KERR_REFERENCE_INVARIANT_LIMITS.maxRelativeCarterDrift ||
    radialPotentialResidual >
      KERR_REFERENCE_INVARIANT_LIMITS.maxNormalizedPotentialResidual ||
    polarPotentialResidual >
      KERR_REFERENCE_INVARIANT_LIMITS.maxNormalizedPotentialResidual
  );
}

function validateTraceInputs(
  state: KerrRayState,
  options: KerrSingleRayTraceOptions,
): void {
  assertSpin(options.spin);
  if (!finiteState(state)) {
    throw new RangeError("Initial Kerr ray state must contain only finite numbers.");
  }
  for (const [label, value] of [
    ["step size", options.stepSize],
    ["maximum affine parameter", options.maxAffineParameter],
    ["horizon guard", options.horizonGuardRg],
    ["escape radius", options.escapeRadiusRg],
    ["theta guard", options.thetaGuardRadians],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${label} must be a positive finite number.`);
    }
  }
  if (!Number.isInteger(options.maxSteps) || options.maxSteps <= 0) {
    throw new RangeError("Maximum steps must be a positive integer.");
  }
  if (
    options.stepSize < 1e-5 ||
    options.stepSize > 0.1 ||
    options.maxSteps > 50_000 ||
    options.maxAffineParameter > 10_000 ||
    options.horizonGuardRg < 0.1 ||
    options.horizonGuardRg > 10 ||
    options.escapeRadiusRg > 100_000 ||
    options.thetaGuardRadians < 1e-6
  ) {
    throw new RangeError("Kerr trace options exceed the code-owned safety bounds.");
  }
  const horizonStop =
    outerHorizonRadiusRg(options.spin) + options.horizonGuardRg;
  if (state.r <= horizonStop || options.escapeRadiusRg <= state.r) {
    throw new RangeError(
      "Initial radius must lie strictly between the horizon guard and escape domain.",
    );
  }
  if (
    options.thetaGuardRadians >= Math.PI / 4 ||
    state.theta <= options.thetaGuardRadians ||
    state.theta >= Math.PI - options.thetaGuardRadians
  ) {
    throw new RangeError("Initial ray is outside the guarded polar domain.");
  }
  const momentumNorm = Math.hypot(
    state.pT,
    state.pR,
    state.pTheta,
    state.pPhi,
  );
  if (
    !Number.isFinite(momentumNorm) ||
    momentumNorm < MIN_CANONICAL_MOMENTUM_NORM ||
    momentumNorm > MAX_CANONICAL_MOMENTUM_NORM
  ) {
    throw new RangeError(
      "Initial canonical momentum is outside the bounded normalization scale.",
    );
  }
  const constants = kerrConstantsOfMotion(options.spin, state);
  if (
    constants.energy < MIN_ENERGY_AT_INFINITY ||
    constants.energy > MAX_ENERGY_AT_INFINITY
  ) {
    throw new RangeError(
      "Initial energy at infinity is outside the bounded positive scale.",
    );
  }
  if (kerrContravariantTimeDerivative(options.spin, state) <= 0) {
    throw new RangeError("Initial Kerr ray must be future-directed in the exterior domain.");
  }
  const normalizedNullResidual = kerrNormalizedNullResidual(
    options.spin,
    state,
  );
  if (
    Math.abs(constants.hamiltonian) > 1e-8 ||
    normalizedNullResidual > INITIAL_NORMALIZED_NULL_TOLERANCE
  ) {
    throw new RangeError("Initial canonical momentum is not null within tolerance.");
  }
}

export function traceKerrNullGeodesic(
  initialState: KerrRayState,
  options: KerrSingleRayTraceOptions,
): KerrSingleRayTrace {
  validateTraceInputs(initialState, options);
  const initialConstants = kerrConstantsOfMotion(options.spin, initialState);
  const initialNormalizedNullResidual = kerrNormalizedNullResidual(
    options.spin,
    initialState,
  );
  const initialPotentialResiduals = potentialResiduals(
    options.spin,
    initialState,
    initialConstants,
  );
  const pT = initialState.pT;
  const pPhi = initialState.pPhi;
  const horizonStop =
    outerHorizonRadiusRg(options.spin) + options.horizonGuardRg;
  const polarTolerance = 1e-10;
  let reduced: ReducedState = [
    initialState.t,
    initialState.r,
    initialState.theta,
    initialState.phi,
    initialState.pR,
    initialState.pTheta,
  ];
  let steps = 0;
  let affineParameter = 0;
  let termination: KerrRayTermination = "indeterminate-limit";
  let terminationReason: KerrTerminationReason =
    KERR_TERMINATION_REASONS.stepLimitReached;
  let maxAbsoluteHamiltonian = Math.abs(initialConstants.hamiltonian);
  let maxNormalizedNullResidual = initialNormalizedNullResidual;
  let maxRelativeEnergyDrift = 0;
  let maxRelativeAngularMomentumDrift = 0;
  let maxRelativeCarterDrift = 0;
  let maxNormalizedRadialPotentialResidual = initialPotentialResiduals.radial;
  let maxNormalizedPolarPotentialResidual = initialPotentialResiduals.polar;
  let minRadiusRg = initialState.r;
  let maxRadiusRg = initialState.r;
  let minThetaRadians = initialState.theta;
  let maxThetaRadians = initialState.theta;
  let minStep = Number.POSITIVE_INFINITY;
  let maxStep = 0;

  while (steps < options.maxSteps) {
    const current = expandedState(reduced, pT, pPhi);
    if (!finiteState(current)) {
      termination = "numerical-failure";
      terminationReason = KERR_TERMINATION_REASONS.nonFiniteState;
      break;
    }
    if (
      current.theta - options.thetaGuardRadians <= polarTolerance ||
      Math.PI - options.thetaGuardRadians - current.theta <= polarTolerance
    ) {
      termination = "coordinate-domain-exit";
      terminationReason =
        KERR_TERMINATION_REASONS.polarCoordinateGuardReached;
      break;
    }
    if (current.r <= horizonStop) {
      termination = "numerical-failure";
      terminationReason = KERR_TERMINATION_REASONS.metricDomainExit;
      break;
    }
    let currentDerivative: ReducedState;
    try {
      currentDerivative = derivative(options.spin, pT, pPhi, reduced);
    } catch {
      termination = "numerical-failure";
      terminationReason = KERR_TERMINATION_REASONS.metricDomainExit;
      break;
    }
    if (currentDerivative[0] <= 0) {
      termination = "numerical-failure";
      terminationReason = KERR_TERMINATION_REASONS.timeOrientationViolation;
      break;
    }
    if (
      current.r >= options.escapeRadiusRg &&
      currentDerivative[1] > 0 &&
      steps > 0
    ) {
      termination = "numerical-failure";
      terminationReason = KERR_TERMINATION_REASONS.rk4DomainExit;
      break;
    }
    if (affineParameter >= options.maxAffineParameter) {
      termination = "indeterminate-limit";
      terminationReason =
        KERR_TERMINATION_REASONS.affineParameterLimitReached;
      break;
    }
    const remainingAffineParameter =
      options.maxAffineParameter - affineParameter;
    if (
      remainingAffineParameter <=
      Math.max(
        1e-14,
        Number.EPSILON * Math.max(1, options.maxAffineParameter),
      )
    ) {
      affineParameter = options.maxAffineParameter;
      termination = "indeterminate-limit";
      terminationReason =
        KERR_TERMINATION_REASONS.affineParameterLimitReached;
      break;
    }
    let step = Math.min(
      options.stepSize,
      remainingAffineParameter,
    );
    if (currentDerivative[1] < 0) {
      const radialGap = current.r - horizonStop;
      const estimatedBoundaryStep =
        radialGap / Math.max(Math.abs(currentDerivative[1]), 1e-15);
      if (estimatedBoundaryStep < step) {
        step = Math.min(
          step,
          estimatedBoundaryStep * 1.125 +
            Number.EPSILON * Math.max(1, estimatedBoundaryStep),
        );
      }
    }
    if (currentDerivative[2] < 0) {
      step = Math.min(
        step,
        (0.5 * (current.theta - options.thetaGuardRadians)) /
          Math.max(Math.abs(currentDerivative[2]), 1e-15),
      );
    } else if (currentDerivative[2] > 0) {
      step = Math.min(
        step,
        (0.5 * (Math.PI - options.thetaGuardRadians - current.theta)) /
          Math.max(Math.abs(currentDerivative[2]), 1e-15),
      );
    }
    if (!Number.isFinite(step) || step <= 1e-14) {
      const polarGap = Math.min(
        current.theta - options.thetaGuardRadians,
        Math.PI - options.thetaGuardRadians - current.theta,
      );
      if (polarGap <= polarTolerance) {
        termination = "coordinate-domain-exit";
        terminationReason =
          KERR_TERMINATION_REASONS.polarCoordinateGuardReached;
        break;
      }
      termination = "numerical-failure";
      terminationReason = KERR_TERMINATION_REASONS.eventStepUnderflow;
      break;
    }
    let acceptedReduced: ReducedState;
    let acceptedStep = step;
    let terminalAfterStep: KerrRayTermination | null = null;
    try {
      const proposed = rk4Step(options.spin, pT, pPhi, reduced, step);
      if (proposed[1] <= horizonStop) {
        const localized = localizeRadialBoundary(
          options.spin,
          pT,
          pPhi,
          reduced,
          step,
          proposed,
          horizonStop,
          "inward",
        );
        acceptedReduced = localized.state;
        acceptedStep = localized.step;
        terminalAfterStep = "captured-horizon-guard";
      } else if (proposed[1] >= options.escapeRadiusRg) {
        const localized = localizeRadialBoundary(
          options.spin,
          pT,
          pPhi,
          reduced,
          step,
          proposed,
          options.escapeRadiusRg,
          "outward",
        );
        const localizedDerivative = derivative(
          options.spin,
          pT,
          pPhi,
          localized.state,
        );
        if (localizedDerivative[1] <= 0) {
          throw new RangeError("Localized escape event is not outgoing.");
        }
        acceptedReduced = localized.state;
        acceptedStep = localized.step;
        terminalAfterStep = "escaped-domain";
      } else {
        acceptedReduced = proposed;
      }
    } catch {
      termination = "numerical-failure";
      terminationReason = KERR_TERMINATION_REASONS.rk4DomainExit;
      break;
    }
    reduced = acceptedReduced;
    affineParameter = Math.min(
      options.maxAffineParameter,
      affineParameter + acceptedStep,
    );
    steps += 1;
    minStep = Math.min(minStep, acceptedStep);
    maxStep = Math.max(maxStep, acceptedStep);

    const accepted = expandedState(reduced, pT, pPhi);
    if (!finiteState(accepted)) {
      termination = "numerical-failure";
      terminationReason = KERR_TERMINATION_REASONS.nonFiniteState;
      break;
    }
    try {
      if (kerrContravariantTimeDerivative(options.spin, accepted) <= 0) {
        termination = "numerical-failure";
        terminationReason =
          KERR_TERMINATION_REASONS.timeOrientationViolation;
        break;
      }
    } catch {
      termination = "numerical-failure";
      terminationReason = KERR_TERMINATION_REASONS.metricDomainExit;
      break;
    }
    try {
      const constants = kerrConstantsOfMotion(options.spin, accepted);
      const normalizedNullResidual = kerrNormalizedNullResidual(
        options.spin,
        accepted,
      );
      const residuals = potentialResiduals(
        options.spin,
        accepted,
        initialConstants,
      );
      const energyDrift = relativeDrift(
        constants.energy,
        initialConstants.energy,
      );
      const angularMomentumDrift = relativeDrift(
        constants.angularMomentumZ,
        initialConstants.angularMomentumZ,
      );
      const carterDrift = relativeDrift(
        constants.carterQ,
        initialConstants.carterQ,
      );
      maxAbsoluteHamiltonian = Math.max(
        maxAbsoluteHamiltonian,
        Math.abs(constants.hamiltonian),
      );
      maxNormalizedNullResidual = Math.max(
        maxNormalizedNullResidual,
        normalizedNullResidual,
      );
      maxRelativeEnergyDrift = Math.max(
        maxRelativeEnergyDrift,
        energyDrift,
      );
      maxRelativeAngularMomentumDrift = Math.max(
        maxRelativeAngularMomentumDrift,
        angularMomentumDrift,
      );
      maxRelativeCarterDrift = Math.max(
        maxRelativeCarterDrift,
        carterDrift,
      );
      maxNormalizedRadialPotentialResidual = Math.max(
        maxNormalizedRadialPotentialResidual,
        residuals.radial,
      );
      maxNormalizedPolarPotentialResidual = Math.max(
        maxNormalizedPolarPotentialResidual,
        residuals.polar,
      );
      minRadiusRg = Math.min(minRadiusRg, accepted.r);
      maxRadiusRg = Math.max(maxRadiusRg, accepted.r);
      minThetaRadians = Math.min(minThetaRadians, accepted.theta);
      maxThetaRadians = Math.max(maxThetaRadians, accepted.theta);
      if (
        exceedsInvariantLimits(
          normalizedNullResidual,
          carterDrift,
          residuals.radial,
          residuals.polar,
        )
      ) {
        termination = "numerical-failure";
        terminationReason =
          KERR_TERMINATION_REASONS.invariantToleranceExceeded;
        break;
      }
    } catch {
      termination = "numerical-failure";
      terminationReason =
        KERR_TERMINATION_REASONS.invariantDiagnosticDomainExit;
      break;
    }
    if (terminalAfterStep === "captured-horizon-guard") {
      termination = terminalAfterStep;
      terminationReason = KERR_TERMINATION_REASONS.horizonGuardReached;
      break;
    }
    if (terminalAfterStep === "escaped-domain") {
      termination = terminalAfterStep;
      terminationReason = KERR_TERMINATION_REASONS.finiteEscapeDomainReached;
      break;
    }
  }

  const finalState = expandedState(reduced, pT, pPhi);
  return {
    termination,
    terminationReason,
    steps,
    affineParameter,
    initialState: { ...initialState },
    finalState,
    constants: initialConstants,
    diagnostics: {
      maxAbsoluteHamiltonian,
      maxNormalizedNullResidual,
      maxRelativeEnergyDrift,
      maxRelativeAngularMomentumDrift,
      maxRelativeCarterDrift,
      maxNormalizedRadialPotentialResidual,
      maxNormalizedPolarPotentialResidual,
      minRadiusRg,
      maxRadiusRg,
      minThetaRadians,
      maxThetaRadians,
      minStep: Number.isFinite(minStep) ? minStep : 0,
      maxStep,
    },
  };
}
