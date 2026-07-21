import * as THREE from "three";

import type {
  DomainBuildContext,
  DomainBuilder,
  Palette,
} from "@/app/components/universe/runtime/types";

function terrainHeight(x: number, z: number, seedOffset: number): number {
  return (
    Math.sin(x * 0.19 + seedOffset) * 0.85 +
    Math.cos(z * 0.16 - seedOffset * 0.7) * 0.72 +
    Math.sin((x + z) * 0.085 + seedOffset * 1.4) * 1.1 +
    Math.cos(Math.hypot(x + 8, z - 6) * 0.28) * 0.42
  );
}

function createTerrain(
  random: () => number,
  palette: Palette,
): { group: THREE.Group; heightAt: (x: number, z: number) => number } {
  const terrain = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(72, 72, 96, 96);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const offset = random() * Math.PI * 2;
  const heightAt = (x: number, z: number) => {
    const falloff = 0.35 + Math.min(1, Math.hypot(x, z) / 28);
    return terrainHeight(x, z, offset) * falloff - 2.3;
  };
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    positions.setY(index, heightAt(x, z));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  terrain.add(
    new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: palette.surface,
        roughness: 0.98,
        metalness: 0,
        flatShading: false,
      }),
    ),
  );
  terrain.add(
    new THREE.Mesh(
      geometry.clone(),
      new THREE.MeshBasicMaterial({
        color: palette.primary,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      }),
    ),
  );
  return { group: terrain, heightAt };
}

function buildSurface({
  root,
  random,
  palette,
  updaters,
}: DomainBuildContext): void {
  const terrain = createTerrain(random, palette);
  root.add(terrain.group);

  const route: THREE.Vector3[] = [];
  for (let step = 0; step < 42; step += 1) {
    const x = -16 + step * 0.78;
    const z = Math.sin(step * 0.27) * 5.2 - 1;
    route.push(new THREE.Vector3(x, terrain.heightAt(x, z) + 0.35, z));
  }
  const path = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(route),
    new THREE.LineBasicMaterial({
      color: palette.warm,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    }),
  );
  root.add(path);
  updaters.push((elapsed) => {
    (path.material as THREE.LineBasicMaterial).opacity =
      0.66 + Math.sin(elapsed * 1.1) * 0.13;
  });
}

function buildPanorama({
  root,
  random,
  palette,
  updaters,
}: DomainBuildContext): void {
  const terrain = createTerrain(random, palette);
  terrain.group.scale.setScalar(0.82);
  root.add(terrain.group);

  const horizon = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 16, 4.2, 96, 1, true),
    new THREE.MeshBasicMaterial({
      color: palette.primary,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  horizon.position.y = 0.2;
  root.add(horizon);

  const capture = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.43, 32),
    new THREE.MeshBasicMaterial({
      color: palette.warm,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    }),
  );
  capture.rotation.x = -Math.PI / 2;
  capture.position.y = 0.18;
  root.add(capture);
  updaters.push((elapsed) => {
    capture.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.12);
  });
}

export function createSurfaceBuilder(
  domain: "surface" | "panorama",
): DomainBuilder {
  return domain === "surface" ? buildSurface : buildPanorama;
}

export const buildDomain: DomainBuilder = buildSurface;
