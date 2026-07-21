import * as THREE from "three";

import type { ScaleDomain } from "@/app/lib/science/scene";

export type ProjectionZoomTier = "overview" | "context" | "detail";

export interface ProjectionAnchor {
  id: string;
  position: readonly [number, number, number];
}

export interface ProjectedAnchor {
  id: string;
  x: number;
  y: number;
  clipDepth: number;
  inFront: boolean;
  inFrustum: boolean;
}

export interface LabelProjectionSnapshot {
  anchors: readonly ProjectedAnchor[];
  width: number;
  height: number;
  normalizedZoom: number;
  zoomTier: ProjectionZoomTier;
  domain: ScaleDomain;
  focusId: string;
  sequence: number;
}

function clampZoom(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function resolveProjectionZoomTier(
  normalizedZoom: number,
  previousTier: ProjectionZoomTier = "overview",
): ProjectionZoomTier {
  const zoom = clampZoom(normalizedZoom);
  if (previousTier === "overview") return zoom >= 0.36 ? "context" : "overview";
  if (previousTier === "detail") return zoom < 0.64 ? "context" : "detail";
  if (zoom >= 0.72) return "detail";
  if (zoom < 0.28) return "overview";
  return "context";
}

interface ProjectLabelAnchorsOptions {
  anchors: readonly ProjectionAnchor[];
  root: THREE.Object3D;
  camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
}

export function normalizedProjectionZoom(
  radius: number,
  minRadius: number,
  maxRadius: number,
): number {
  if (
    !Number.isFinite(radius) ||
    !Number.isFinite(minRadius) ||
    !Number.isFinite(maxRadius) ||
    minRadius >= maxRadius
  ) {
    return 0;
  }

  return THREE.MathUtils.clamp(
    (maxRadius - radius) / (maxRadius - minRadius),
    0,
    1,
  );
}

export function projectLabelAnchors({
  anchors,
  root,
  camera,
  width,
  height,
}: ProjectLabelAnchorsOptions): ProjectedAnchor[] {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return [];
  }

  root.updateWorldMatrix(true, false);
  camera.updateWorldMatrix(true, false);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

  const worldPoint = new THREE.Vector3();
  const cameraPoint = new THREE.Vector3();
  const clipPoint = new THREE.Vector3();
  const projected: ProjectedAnchor[] = [];

  for (const anchor of anchors) {
    const [localX, localY, localZ] = anchor.position;
    if (
      !Number.isFinite(localX) ||
      !Number.isFinite(localY) ||
      !Number.isFinite(localZ)
    ) {
      continue;
    }

    worldPoint
      .set(localX, localY, localZ)
      .applyMatrix4(root.matrixWorld);
    cameraPoint.copy(worldPoint).applyMatrix4(camera.matrixWorldInverse);
    clipPoint.copy(worldPoint).project(camera);

    if (
      !Number.isFinite(cameraPoint.x) ||
      !Number.isFinite(cameraPoint.y) ||
      !Number.isFinite(cameraPoint.z) ||
      !Number.isFinite(clipPoint.x) ||
      !Number.isFinite(clipPoint.y) ||
      !Number.isFinite(clipPoint.z)
    ) {
      continue;
    }

    const distanceAlongView = -cameraPoint.z;
    const inFront = distanceAlongView > 0;
    const insideDepth =
      distanceAlongView >= camera.near && distanceAlongView <= camera.far;
    const inFrustum =
      inFront &&
      insideDepth &&
      clipPoint.x >= -1 &&
      clipPoint.x <= 1 &&
      clipPoint.y >= -1 &&
      clipPoint.y <= 1 &&
      clipPoint.z >= -1 &&
      clipPoint.z <= 1;

    projected.push({
      id: anchor.id,
      x: (clipPoint.x * 0.5 + 0.5) * width,
      y: (-clipPoint.y * 0.5 + 0.5) * height,
      clipDepth: clipPoint.z,
      inFront,
      inFrustum,
    });
  }

  return projected;
}
