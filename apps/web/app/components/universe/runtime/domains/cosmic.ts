import * as THREE from "three";

import { densityCount } from "@/app/components/universe/performance";
import {
  createPoints,
  gaussian,
  writeColor,
} from "@/app/components/universe/runtime/shared";
import type {
  DomainBuildContext,
  DomainBuilder,
} from "@/app/components/universe/runtime/types";

function buildLightcone({
  root,
  random,
  palette,
  updaters,
  profile,
}: DomainBuildContext): void {
  const filamentCount = 22;
  const controlsPerFilament = 7;
  const controls: THREE.Vector3[][] = [];

  for (let filament = 0; filament < filamentCount; filament += 1) {
    const origin = new THREE.Vector3(
      (random() - 0.5) * 12,
      (random() - 0.5) * 12,
      (random() - 0.5) * 12,
    );
    const direction = new THREE.Vector3(
      gaussian(random),
      gaussian(random) * 0.7,
      gaussian(random),
    ).normalize();
    const path: THREE.Vector3[] = [];
    for (let node = 0; node < controlsPerFilament; node += 1) {
      const progress = node / (controlsPerFilament - 1);
      const wander = new THREE.Vector3(
        gaussian(random) * 3.5,
        gaussian(random) * 3.5,
        gaussian(random) * 3.5,
      );
      path.push(
        origin
          .clone()
          .addScaledVector(direction, (progress - 0.5) * 70)
          .add(wander),
      );
    }
    controls.push(path);

    const curve = new THREE.CatmullRomCurve3(path);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(72));
    root.add(
      new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color: filament % 5 === 0 ? palette.primary : palette.dim,
          transparent: true,
          opacity: filament % 5 === 0 ? 0.22 : 0.1,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );
  }

  const count = densityCount(7600, profile);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const path = controls[Math.floor(random() * controls.length)];
    const scaled = random() * (path.length - 1);
    const segment = Math.min(path.length - 2, Math.floor(scaled));
    const point = path[segment]
      .clone()
      .lerp(path[segment + 1], scaled - segment);
    const scatter = Math.pow(random(), 2.5) * 3.8 + 0.08;
    point.add(
      new THREE.Vector3(
        gaussian(random) * scatter,
        gaussian(random) * scatter,
        gaussian(random) * scatter,
      ),
    );
    positions.set([point.x, point.y, point.z], index * 3);
    const color =
      random() > 0.965
        ? palette.warm
        : random() > 0.62
          ? palette.primary
          : palette.secondary;
    writeColor(colors, index, color, 0.28 + random() * 0.9);
  }
  const web = createPoints(positions, colors, 0.19, 0.88);
  root.add(web);

  for (const radius of [10, 20, 31, 42]) {
    root.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 16),
        new THREE.MeshBasicMaterial({
          color: palette.dim,
          wireframe: true,
          transparent: true,
          opacity: radius === 42 ? 0.035 : 0.025,
          depthWrite: false,
        }),
      ),
    );
  }

  const observer = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 20, 12),
    new THREE.MeshBasicMaterial({ color: palette.warm }),
  );
  root.add(observer);
  updaters.push((elapsed) => {
    web.rotation.y = elapsed * 0.006;
    observer.scale.setScalar(1 + Math.sin(elapsed * 1.4) * 0.08);
  });
}

function buildExtragalactic({
  root,
  random,
  palette,
  updaters,
  profile,
}: DomainBuildContext): void {
  const clusterCount = 34;
  const clusterCenters: THREE.Vector3[] = [];
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    clusterCenters.push(
      new THREE.Vector3(
        (random() - 0.5) * 58,
        (random() - 0.5) * 36,
        (random() - 0.5) * 58,
      ),
    );
  }

  const count = densityCount(5900, profile);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const center = clusterCenters[Math.floor(random() * clusterCenters.length)];
    const distance = Math.pow(random(), 3) * 5.8;
    const point = center.clone().add(
      new THREE.Vector3(
        gaussian(random) * distance,
        gaussian(random) * distance * 0.55,
        gaussian(random) * distance,
      ),
    );
    positions.set([point.x, point.y, point.z], index * 3);
    const color = random() > 0.88 ? palette.warm : palette.primary;
    writeColor(colors, index, color, 0.3 + random());
  }
  const galaxies = createPoints(positions, colors, 0.22, 0.9);
  root.add(galaxies);

  const networkPoints: THREE.Vector3[] = [];
  clusterCenters.forEach((center, index) => {
    let nearest: THREE.Vector3 | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    clusterCenters.forEach((candidate, candidateIndex) => {
      if (candidateIndex === index) return;
      const distance = center.distanceToSquared(candidate);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = candidate;
      }
    });
    if (nearest) networkPoints.push(center, nearest);
  });
  root.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(networkPoints),
      new THREE.LineBasicMaterial({
        color: palette.dim,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    ),
  );
  updaters.push((elapsed) => {
    galaxies.rotation.y = elapsed * 0.004;
  });
}

export function createCosmicBuilder(
  domain: "lightcone" | "extragalactic",
): DomainBuilder {
  return domain === "lightcone" ? buildLightcone : buildExtragalactic;
}

export const buildDomain: DomainBuilder = buildLightcone;
