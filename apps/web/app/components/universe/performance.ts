export type RenderProfileName =
  | "structured"
  | "efficient"
  | "balanced"
  | "fidelity";

export type RenderProfileRequest = "auto" | RenderProfileName;

export interface RenderProfile {
  name: RenderProfileName;
  maxDevicePixelRatio: number;
  maxFramebufferPixels: number;
  pointDensity: number;
  targetFramesPerSecond: number;
}

export interface CalibrationSample {
  p95FrameIntervalMs: number;
  droppedFrameRatio: number;
}

export interface PerformancePressureState {
  consecutiveFailingWindows: number;
  downgradeRecommended: boolean;
}

export const renderProfiles: Readonly<Record<RenderProfileName, RenderProfile>> = {
  structured: {
    name: "structured",
    maxDevicePixelRatio: 0,
    maxFramebufferPixels: 0,
    pointDensity: 0,
    targetFramesPerSecond: 0,
  },
  efficient: {
    name: "efficient",
    maxDevicePixelRatio: 1,
    maxFramebufferPixels: 1_000_000,
    pointDensity: 0.5,
    targetFramesPerSecond: 30,
  },
  balanced: {
    name: "balanced",
    maxDevicePixelRatio: 1.5,
    maxFramebufferPixels: 2_100_000,
    pointDensity: 0.75,
    targetFramesPerSecond: 60,
  },
  fidelity: {
    name: "fidelity",
    maxDevicePixelRatio: 2,
    maxFramebufferPixels: 4_100_000,
    pointDensity: 1,
    targetFramesPerSecond: 60,
  },
};

export function resolveInitialProfile(
  request: RenderProfileRequest,
): RenderProfileName {
  return request === "auto" ? "balanced" : request;
}

export function classifyCalibration(
  sample: CalibrationSample,
): RenderProfileName {
  if (
    !Number.isFinite(sample.p95FrameIntervalMs) ||
    !Number.isFinite(sample.droppedFrameRatio) ||
    sample.p95FrameIntervalMs > 40 ||
    sample.droppedFrameRatio > 0.2
  ) {
    return "efficient";
  }

  if (
    sample.p95FrameIntervalMs <= 18 &&
    sample.droppedFrameRatio <= 0.04
  ) {
    return "fidelity";
  }

  return "balanced";
}

export function downgradeProfile(
  profile: RenderProfileName,
): RenderProfileName {
  if (profile === "fidelity") return "balanced";
  if (profile === "balanced") return "efficient";
  if (profile === "efficient") return "structured";
  return "structured";
}

export function evaluatePerformanceWindow({
  profile,
  sample,
  previousFailures,
}: {
  profile: RenderProfileName;
  sample: CalibrationSample;
  previousFailures: number;
}): PerformancePressureState {
  if (profile === "structured") {
    return { consecutiveFailingWindows: 0, downgradeRecommended: false };
  }

  const maximumP95 = profile === "efficient" ? 40 : 22;
  const failed =
    !Number.isFinite(sample.p95FrameIntervalMs) ||
    !Number.isFinite(sample.droppedFrameRatio) ||
    sample.p95FrameIntervalMs > maximumP95 ||
    sample.droppedFrameRatio > 0.2;
  const consecutiveFailingWindows = failed ? previousFailures + 1 : 0;

  return {
    consecutiveFailingWindows,
    downgradeRecommended: consecutiveFailingWindows >= 3,
  };
}

export function calculateEffectivePixelRatio({
  cssWidth,
  cssHeight,
  devicePixelRatio,
  profile,
  componentMaximum,
}: {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  profile: RenderProfile;
  componentMaximum: number;
}): number {
  if (profile.name === "structured") return 0;

  const cssPixels = Math.max(1, cssWidth) * Math.max(1, cssHeight);
  const pixelBudgetRatio = Math.sqrt(
    profile.maxFramebufferPixels / cssPixels,
  );

  return Math.max(
    0.5,
    Math.min(
      Math.max(0.5, devicePixelRatio || 1),
      profile.maxDevicePixelRatio,
      Math.max(0.5, componentMaximum),
      pixelBudgetRatio,
    ),
  );
}

export function densityCount(baseCount: number, profile: RenderProfile): number {
  if (profile.name === "structured") return 0;
  return Math.max(1, Math.round(baseCount * profile.pointDensity));
}
