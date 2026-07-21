import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateEffectivePixelRatio,
  classifyCalibration,
  densityCount,
  downgradeProfile,
  evaluatePerformanceWindow,
  renderProfiles,
  resolveInitialProfile,
} from "../app/components/universe/performance";

test("auto starts at the balanced portable baseline", () => {
  assert.equal(resolveInitialProfile("auto"), "balanced");
  assert.equal(resolveInitialProfile("structured"), "structured");
  assert.equal(resolveInitialProfile("fidelity"), "fidelity");
});

test("calibration thresholds classify deterministic display profiles", () => {
  assert.equal(
    classifyCalibration({ p95FrameIntervalMs: 17.9, droppedFrameRatio: 0.04 }),
    "fidelity",
  );
  assert.equal(
    classifyCalibration({ p95FrameIntervalMs: 22, droppedFrameRatio: 0.08 }),
    "balanced",
  );
  assert.equal(
    classifyCalibration({ p95FrameIntervalMs: 40.1, droppedFrameRatio: 0.01 }),
    "efficient",
  );
  assert.equal(
    classifyCalibration({ p95FrameIntervalMs: Number.NaN, droppedFrameRatio: 0 }),
    "efficient",
  );
});

test("automatic degradation is monotonic and fail-closed", () => {
  assert.equal(downgradeProfile("fidelity"), "balanced");
  assert.equal(downgradeProfile("balanced"), "efficient");
  assert.equal(downgradeProfile("efficient"), "structured");
  assert.equal(downgradeProfile("structured"), "structured");
});

test("runtime pressure requires three consecutive failing windows", () => {
  const failingSample = {
    p95FrameIntervalMs: 24,
    droppedFrameRatio: 0.22,
  };
  const first = evaluatePerformanceWindow({
    profile: "balanced",
    sample: failingSample,
    previousFailures: 0,
  });
  const second = evaluatePerformanceWindow({
    profile: "balanced",
    sample: failingSample,
    previousFailures: first.consecutiveFailingWindows,
  });
  const third = evaluatePerformanceWindow({
    profile: "balanced",
    sample: failingSample,
    previousFailures: second.consecutiveFailingWindows,
  });

  assert.equal(first.downgradeRecommended, false);
  assert.equal(second.downgradeRecommended, false);
  assert.equal(third.downgradeRecommended, true);
  assert.equal(
    evaluatePerformanceWindow({
      profile: "balanced",
      sample: { p95FrameIntervalMs: 18, droppedFrameRatio: 0.01 },
      previousFailures: 2,
    }).consecutiveFailingWindows,
    0,
  );
});

test("framebuffer budgets cap effective DPR even on a 4K high-DPR display", () => {
  const ratio = calculateEffectivePixelRatio({
    cssWidth: 3840,
    cssHeight: 2160,
    devicePixelRatio: 2,
    profile: renderProfiles.fidelity,
    componentMaximum: 2,
  });
  assert.ok(ratio < 1);
  assert.ok(3840 * 2160 * ratio * ratio <= 4_100_001);

  assert.equal(
    calculateEffectivePixelRatio({
      cssWidth: 1920,
      cssHeight: 1080,
      devicePixelRatio: 2,
      profile: renderProfiles.structured,
      componentMaximum: 2,
    }),
    0,
  );
});

test("lower display profiles retain deterministic prefix-sized densities", () => {
  assert.equal(densityCount(7600, renderProfiles.efficient), 3800);
  assert.equal(densityCount(7600, renderProfiles.balanced), 5700);
  assert.equal(densityCount(7600, renderProfiles.fidelity), 7600);
  assert.equal(densityCount(7600, renderProfiles.structured), 0);
});
