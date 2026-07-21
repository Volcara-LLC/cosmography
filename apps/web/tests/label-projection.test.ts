import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";

import {
  normalizedProjectionZoom,
  projectLabelAnchors,
  resolveProjectionZoomTier,
} from "../app/components/universe/runtime/labelProjection";

test("projection zoom tiers retain hysteresis across published snapshots", () => {
  let tier = resolveProjectionZoomTier(0.72, "context");
  assert.equal(tier, "detail");
  tier = resolveProjectionZoomTier(0.65, tier);
  assert.equal(tier, "detail");
  tier = resolveProjectionZoomTier(0.63, tier);
  assert.equal(tier, "context");
  tier = resolveProjectionZoomTier(0.29, tier);
  assert.equal(tier, "context");
  tier = resolveProjectionZoomTier(0.27, tier);
  assert.equal(tier, "overview");
});

test("normalized projection zoom runs from widest zero to closest one", () => {
  assert.equal(normalizedProjectionZoom(100, 10, 100), 0);
  assert.equal(normalizedProjectionZoom(55, 10, 100), 0.5);
  assert.equal(normalizedProjectionZoom(10, 10, 100), 1);
  assert.equal(normalizedProjectionZoom(200, 10, 100), 0);
  assert.equal(normalizedProjectionZoom(1, 10, 100), 1);
});

test("invalid zoom ranges fail closed at the widest tier", () => {
  assert.equal(normalizedProjectionZoom(Number.NaN, 10, 100), 0);
  assert.equal(normalizedProjectionZoom(20, 10, 10), 0);
  assert.equal(normalizedProjectionZoom(20, 20, 10), 0);
});

test("projects root-local anchors through the root world matrix", () => {
  const root = new THREE.Group();
  root.position.set(2, 0, 0);
  const camera = new THREE.PerspectiveCamera(60, 4 / 3, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  const [projected] = projectLabelAnchors({
    anchors: [{ id: "center", position: [-2, 0, 0] }],
    root,
    camera,
    width: 800,
    height: 600,
  });

  assert.equal(projected.id, "center");
  assert.ok(Math.abs(projected.x - 400) < 1e-9);
  assert.ok(Math.abs(projected.y - 300) < 1e-9);
  assert.equal(projected.inFront, true);
  assert.equal(projected.inFrustum, true);
});

test("flags behind, clipped, and offscreen anchors without clamping", () => {
  const root = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(90, 1, 1, 10);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  camera.updateProjectionMatrix();

  const projected = projectLabelAnchors({
    anchors: [
      { id: "visible", position: [0, 0, -5] },
      { id: "offscreen", position: [10, 0, -5] },
      { id: "behind", position: [0, 0, 5] },
      { id: "near-clipped", position: [0, 0, -0.5] },
      { id: "far-clipped", position: [0, 0, -20] },
      { id: "nonfinite", position: [Number.NaN, 0, -5] },
    ],
    root,
    camera,
    width: 600,
    height: 600,
  });

  assert.deepEqual(
    projected.map((anchor) => anchor.id),
    ["visible", "offscreen", "behind", "near-clipped", "far-clipped"],
  );
  assert.equal(projected[0].inFrustum, true);
  assert.equal(projected[1].inFront, true);
  assert.equal(projected[1].inFrustum, false);
  assert.ok(projected[1].x > 600, "offscreen x must not be edge-clamped");
  assert.equal(projected[2].inFront, false);
  assert.equal(projected[2].inFrustum, false);
  assert.equal(projected[3].inFront, true);
  assert.equal(projected[3].inFrustum, false);
  assert.equal(projected[4].inFront, true);
  assert.equal(projected[4].inFrustum, false);
});

test("invalid projection dimensions reject the snapshot inputs", () => {
  const root = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  assert.deepEqual(
    projectLabelAnchors({
      anchors: [{ id: "unused", position: [0, 0, -5] }],
      root,
      camera,
      width: 0,
      height: 600,
    }),
    [],
  );
});
