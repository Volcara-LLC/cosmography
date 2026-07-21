import assert from "node:assert/strict";
import test from "node:test";

import { foundationProjectedLabelsForSelection } from "../app/data/labels/foundation-projected-labels";
import {
  defaultLabelReservedRects,
  layoutProjectedLabels,
  resolveLabelZoomTier,
  selectVisibleLabelCandidates,
} from "../app/components/universe/label-layout";

test("uses overlapping zoom thresholds to avoid tier flicker", () => {
  assert.equal(resolveLabelZoomTier(0.35, "overview"), "overview");
  assert.equal(resolveLabelZoomTier(0.36, "overview"), "context");
  assert.equal(resolveLabelZoomTier(0.3, "context"), "context");
  assert.equal(resolveLabelZoomTier(0.27, "context"), "overview");
  assert.equal(resolveLabelZoomTier(0.72, "context"), "detail");
  assert.equal(resolveLabelZoomTier(0.65, "detail"), "detail");
  assert.equal(resolveLabelZoomTier(0.63, "detail"), "context");
});

test("orders selected and semantic peers independently of input order", () => {
  const candidates = foundationProjectedLabelsForSelection("local-group");
  const forward = selectVisibleLabelCandidates({
    candidates,
    selectedId: "local-group",
    normalizedZoom: 0.8,
    previousTier: "context",
  });
  const reverse = selectVisibleLabelCandidates({
    candidates: [...candidates].reverse(),
    selectedId: "local-group",
    normalizedZoom: 0.8,
    previousTier: "context",
  });
  assert.equal(forward.tier, "detail");
  assert.deepEqual(
    forward.candidates.map((candidate) => candidate.id),
    reverse.candidates.map((candidate) => candidate.id),
  );
  assert.equal(forward.candidates[0].id, "local-group");
});

test("resolves collisions deterministically and retains the selected winner", () => {
  const candidates = foundationProjectedLabelsForSelection("local-group");
  const anchors = candidates.map((candidate) => ({
    id: candidate.id,
    x: 480,
    y: 320,
    inFront: true,
    inFrustum: true,
  }));
  const result = layoutProjectedLabels({
    candidates: [...candidates].reverse(),
    anchors,
    selectedId: "local-group",
    normalizedZoom: 0.9,
    previousTier: "detail",
    viewportWidth: 960,
    viewportHeight: 640,
  });
  assert.equal(result.labels[0]?.candidate.id, "local-group");
  assert.equal(
    new Set(result.labels.map((label) => `${label.left}:${label.top}`)).size,
    result.labels.length,
  );
  for (let leftIndex = 0; leftIndex < result.labels.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < result.labels.length; rightIndex += 1) {
      const left = result.labels[leftIndex];
      const right = result.labels[rightIndex];
      const separated =
        left.left + left.width + 8 <= right.left ||
        right.left + right.width + 8 <= left.left ||
        left.top + left.height + 8 <= right.top ||
        right.top + right.height + 8 <= left.top;
      assert.equal(separated, true);
    }
  }
});

test("rejects hidden anchors and respects reserved interface regions", () => {
  const candidates = foundationProjectedLabelsForSelection("observable-universe");
  const result = layoutProjectedLabels({
    candidates,
    anchors: [
      { id: "observable-universe", x: 420, y: 300, inFront: true, inFrustum: true },
      { id: "jwst-deep-fields", x: 760, y: 300, inFront: false, inFrustum: false },
    ],
    selectedId: "observable-universe",
    normalizedZoom: 0.8,
    previousTier: "detail",
    viewportWidth: 900,
    viewportHeight: 600,
    reservedRects: [{ left: 430, top: 250, width: 230, height: 120 }],
  });
  assert.deepEqual(result.labels.map((label) => label.candidate.id), [
    "observable-universe",
  ]);
  const label = result.labels[0];
  assert.ok(label.left + label.width <= 430 || label.top + label.height <= 250 || label.top >= 370);
});

test("reserves only the exit affordance when full cosmos is active", () => {
  assert.deepEqual(defaultLabelReservedRects({
    width: 1000,
    height: 700,
    fullView: true,
    compact: false,
    shortLandscape: false,
  }), [{ left: 888, top: 0, width: 112, height: 112 }]);
  assert.equal(defaultLabelReservedRects({
    width: 360,
    height: 740,
    fullView: false,
    compact: true,
    shortLandscape: false,
  }).length, 3);
});

test("protects compact portrait controls and the destination reading plate", () => {
  const reserved = defaultLabelReservedRects({
    width: 390,
    height: 844,
    fullView: false,
    compact: true,
    shortLandscape: false,
  });
  assert.deepEqual(reserved, [
    { left: 0, top: 0, width: 390, height: 190 },
    { left: 90, top: 190, width: 300, height: 70 },
    { left: 0, top: 270, width: 390, height: 574 },
  ]);
  assert.ok(reserved[1].width >= 6 * 44 + 5 * 4);
  assert.ok(reserved[2].top > reserved[1].top + reserved[1].height);
});

test("desktop reservations follow compact edge chrome and separately protect reading surfaces", () => {
  const reserved = defaultLabelReservedRects({
    width: 1440,
    height: 900,
    fullView: false,
    compact: false,
    shortLandscape: false,
  });
  assert.deepEqual(reserved, [
    { left: 0, top: 0, width: 1440, height: 160 },
    { left: 27, top: 160, width: 136, height: 352 },
    { left: 1338, top: 260, width: 84, height: 380 },
    { left: 27, top: 160, width: 530.6, height: 644 },
    { left: 840, top: 732, width: 600, height: 168 },
  ]);
  assert.ok(reserved[1].width < 9 * 16);
  assert.equal(reserved[2].width, 84);
  assert.equal(reserved[3].left, reserved[1].left);

  const [header, rail, tools, destination, lowerRight] = reserved;
  assert.ok(header.height >= 154.7);
  assert.ok(rail.top <= header.height);
  assert.ok(rail.top + rail.height >= 504.46);
  assert.ok(tools.top <= 272.81);
  assert.ok(tools.top + tools.height >= 627.19);
  assert.ok(destination.left <= 34.56);
  assert.ok(destination.left + destination.width >= 545.6);
  assert.ok(destination.top <= 508);
  assert.ok(destination.top + destination.height >= 781.6);
  assert.ok(lowerRight.left <= 850.7);
  assert.ok(lowerRight.top <= 743.2);
  assert.ok(lowerRight.top + lowerRight.height >= 893.93);
});

test("short desktop reservations cover accessibility-expanded chrome at 1280 by 720", () => {
  const reserved = defaultLabelReservedRects({
    width: 1280,
    height: 720,
    fullView: false,
    compact: false,
    shortLandscape: false,
  });
  assert.deepEqual(reserved, [
    { left: 0, top: 0, width: 1280, height: 160 },
    { left: 23, top: 160, width: 136, height: 352 },
    { left: 1181, top: 170, width: 84, height: 380 },
    { left: 23, top: 160, width: 525, height: 464 },
    { left: 680, top: 552, width: 600, height: 168 },
  ]);

  const [, rail, tools, destination, lowerRight] = reserved;
  assert.ok(rail.top + rail.height >= 504.46);
  assert.ok(tools.top <= 182.81);
  assert.ok(tools.top + tools.height >= 537.19);
  assert.ok(destination.left <= 30.72);
  assert.ok(destination.left + destination.width >= 536.8);
  assert.ok(destination.top <= 205.63);
  assert.ok(destination.top + destination.height >= 614.4);
  assert.ok(lowerRight.left <= 687.61);
  assert.ok(lowerRight.top <= 563.2);
  assert.ok(lowerRight.top + lowerRight.height >= 713.93);
});

test("desktop tour cards cannot hide a focusable projected label", () => {
  const candidates = foundationProjectedLabelsForSelection("local-group");
  const reservedRects = defaultLabelReservedRects({
    width: 1440,
    height: 900,
    fullView: false,
    compact: false,
    shortLandscape: false,
  });
  const result = layoutProjectedLabels({
    candidates,
    anchors: candidates.map((candidate) => ({
      id: candidate.id,
      x: 250,
      y: 200,
      inFront: true,
      inFrustum: true,
    })),
    selectedId: "local-group",
    normalizedZoom: 0,
    viewportWidth: 1440,
    viewportHeight: 900,
    reservedRects,
  });
  assert.deepEqual(result.labels, []);
});

test("backfills the tier cap after a higher-priority anchor is rejected", () => {
  const candidates = foundationProjectedLabelsForSelection("local-group");
  const result = layoutProjectedLabels({
    candidates,
    anchors: candidates.map((candidate) => ({
      id: candidate.id,
      x: candidate.id === "local-group" ? -100 : 500,
      y: 300,
      inFront: true,
      inFrustum: candidate.id !== "local-group",
    })),
    selectedId: "local-group",
    normalizedZoom: 0,
    viewportWidth: 1000,
    viewportHeight: 700,
  });
  assert.equal(result.labels.length, 1);
  assert.equal(result.labels[0].candidate.id, "andromeda");
});

test("compact landscape uses real 780px renderer geometry without suppressing the safe center", () => {
  const candidates = foundationProjectedLabelsForSelection("local-group");
  const reservedRects = defaultLabelReservedRects({
    width: 744.8,
    height: 780,
    fullView: false,
    compact: true,
    shortLandscape: true,
  });
  const result = layoutProjectedLabels({
    candidates,
    anchors: candidates.map((candidate) => ({
      id: candidate.id,
      x: 500,
      y: 350,
      inFront: true,
      inFrustum: true,
    })),
    selectedId: "local-group",
    normalizedZoom: 0,
    viewportWidth: 744.8,
    viewportHeight: 780,
    reservedRects,
    compact: true,
  });
  assert.deepEqual(reservedRects, [
    { left: 0, top: 0, width: 744.8, height: 128 },
    { left: 0, top: 128, width: 372, height: 652 },
    { left: 624.8, top: 128, width: 120, height: 152 },
  ]);
  assert.equal(result.labels.length, 1);
  assert.equal(result.labels[0].candidate.id, "local-group");
});

test("compact landscape rejects a label beneath the real destination card", () => {
  const candidates = foundationProjectedLabelsForSelection("local-group");
  const reservedRects = defaultLabelReservedRects({
    width: 744.8,
    height: 780,
    fullView: false,
    compact: true,
    shortLandscape: true,
  });
  const result = layoutProjectedLabels({
    candidates,
    anchors: candidates.map((candidate) => ({
      id: candidate.id,
      x: 160,
      y: 303,
      inFront: true,
      inFrustum: true,
    })),
    selectedId: "local-group",
    normalizedZoom: 0,
    viewportWidth: 744.8,
    viewportHeight: 780,
    reservedRects,
    compact: true,
  });
  assert.deepEqual(result.labels, []);
});

test("wide short viewports reserve their horizontal rail, card, and tool lanes", () => {
  const candidates = foundationProjectedLabelsForSelection("local-group");
  for (const width of [761, 1024]) {
    const reservedRects = defaultLabelReservedRects({
      width,
      height: 480,
      fullView: false,
      compact: true,
      shortLandscape: true,
    });
    assert.deepEqual(reservedRects, [
      { left: 0, top: 0, width, height: 128 },
      { left: 0, top: 128, width: 372, height: 352 },
      { left: width - 120, top: 128, width: 120, height: 152 },
    ]);
    const blocked = layoutProjectedLabels({
      candidates,
      anchors: candidates.map((candidate) => ({
        id: candidate.id,
        x: 200,
        y: 300,
        inFront: true,
        inFrustum: true,
      })),
      selectedId: "local-group",
      normalizedZoom: 0,
      viewportWidth: width,
      viewportHeight: 480,
      reservedRects,
      compact: true,
    });
    assert.deepEqual(blocked.labels, []);
  }
});

test("compact portrait rejects a selected label beneath the measured destination card", () => {
  const candidates = foundationProjectedLabelsForSelection("local-group");
  const reservedRects = defaultLabelReservedRects({
    width: 390,
    height: 780,
    fullView: false,
    compact: true,
    shortLandscape: false,
  });
  const result = layoutProjectedLabels({
    candidates,
    anchors: candidates.map((candidate) => ({
      id: candidate.id,
      x: 156,
      y: 330,
      inFront: true,
      inFrustum: true,
    })),
    selectedId: "local-group",
    normalizedZoom: 0,
    viewportWidth: 390,
    viewportHeight: 780,
    reservedRects,
    compact: true,
  });
  assert.equal(reservedRects[2].top, 270);
  assert.deepEqual(result.labels, []);
});
