const GRAVITATIONAL_CONSTANT = 6.67430e-11;
const SPEED_OF_LIGHT = 299_792_458;
const SOLAR_MASS_KG = 1.98847e30;
const PARSEC_METERS = 3.085677581491367e16;
const RADIANS_TO_MICROARCSECONDS = 206_264_806_247.09636;

function assertPositiveFinite(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`);
  }
}

export function assertDimensionlessSpin(spin: number) {
  if (!Number.isFinite(spin) || Math.abs(spin) > 1) {
    throw new RangeError("Dimensionless Kerr spin must be finite and between -1 and 1.");
  }
}

/** GM/c² in metres. All coordinate radii in this package use this r_g unit. */
export function gravitationalRadiusMeters(massSolar: number) {
  assertPositiveFinite(massSolar, "Black-hole mass");
  return (GRAVITATIONAL_CONSTANT * massSolar * SOLAR_MASS_KG) / SPEED_OF_LIGHT ** 2;
}

/** GM/c³ in seconds: the natural light-crossing time for one r_g. */
export function gravitationalTimeSeconds(massSolar: number) {
  return gravitationalRadiusMeters(massSolar) / SPEED_OF_LIGHT;
}

/** Outer Kerr event-horizon radius r₊ / r_g in Boyer-Lindquist coordinates. */
export function outerHorizonRadiusRg(spin: number) {
  assertDimensionlessSpin(spin);
  return 1 + Math.sqrt(Math.max(0, 1 - spin ** 2));
}

/** Equatorial circular photon-orbit radius in r_g, relative to the spin direction. */
export function equatorialPhotonOrbitRadiusRg(
  spin: number,
  orbit: "prograde" | "retrograde",
) {
  assertDimensionlessSpin(spin);
  const magnitude = Math.abs(spin);
  const cosineArgument = orbit === "prograde" ? -magnitude : magnitude;
  return 2 * (1 + Math.cos((2 / 3) * Math.acos(cosineArgument)));
}

/** Equatorial ISCO radius in r_g for a test particle. */
export function equatorialIscoRadiusRg(
  spin: number,
  orbit: "prograde" | "retrograde",
) {
  assertDimensionlessSpin(spin);
  const magnitude = Math.abs(spin);
  const z1 =
    1 +
    Math.cbrt(1 - magnitude ** 2) *
      (Math.cbrt(1 + magnitude) + Math.cbrt(1 - magnitude));
  const z2 = Math.sqrt(3 * magnitude ** 2 + z1 ** 2);
  const radical = Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
  return 3 + z2 + (orbit === "prograde" ? -radical : radical);
}

/**
 * Schwarzschild critical-curve diameter, useful only as a reference check.
 * Kerr inclination and emission physics require ray tracing and radiative transfer.
 */
export function schwarzschildCriticalCurveDiameterMicroarcseconds(
  massSolar: number,
  distanceParsecs: number,
) {
  assertPositiveFinite(distanceParsecs, "Distance");
  const diameterMeters = 2 * Math.sqrt(27) * gravitationalRadiusMeters(massSolar);
  const angularRadians = diameterMeters / (distanceParsecs * PARSEC_METERS);
  return angularRadians * RADIANS_TO_MICROARCSECONDS;
}

/** @deprecated Use schwarzschildCriticalCurveDiameterMicroarcseconds. */
export const schwarzschildShadowDiameterMicroarcseconds =
  schwarzschildCriticalCurveDiameterMicroarcseconds;
