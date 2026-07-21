import * as THREE from "three";

import { densityCount } from "@/app/components/universe/performance";
import {
  createPoints,
  gaussian,
  writeColor,
} from "@/app/components/universe/runtime/shared";
import type { DomainBuilder } from "@/app/components/universe/runtime/types";

export const buildDomain: DomainBuilder = ({
  root,
  random,
  palette,
  updaters,
  profile,
}) => {
  const diskCount = densityCount(7000, profile);
  const positions = new Float32Array(diskCount * 3);
  const colors = new Float32Array(diskCount * 3);
  const arms = 4;

  for (let index = 0; index < diskCount; index += 1) {
    const isBulge = random() < 0.19;
    let x: number;
    let y: number;
    let z: number;

    if (isBulge) {
      const radius = Math.pow(random(), 2.1) * 7.5;
      const direction = new THREE.Vector3(
        gaussian(random),
        gaussian(random) * 0.62,
        gaussian(random),
      ).normalize();
      x = direction.x * radius;
      y = direction.y * radius;
      z = direction.z * radius;
    } else {
      const radius = 2.2 + Math.pow(random(), 0.78) * 26;
      const arm = Math.floor(random() * arms);
      const baseAngle =
        (arm / arms) * Math.PI * 2 +
        radius * 0.29 +
        gaussian(random) * 0.17;
      x = Math.cos(baseAngle) * radius + gaussian(random) * 0.46;
      z = Math.sin(baseAngle) * radius + gaussian(random) * 0.46;
      y = gaussian(random) * (0.18 + radius * 0.014);
    }

    positions.set([x, y, z], index * 3);
    const color =
      isBulge || random() > 0.9
        ? palette.warm
        : random() > 0.58
          ? palette.primary
          : palette.secondary;
    writeColor(colors, index, color, 0.35 + random() * 0.9);
  }

  const disk = createPoints(positions, colors, 0.18, 0.95);
  root.add(disk);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 24, 16),
    new THREE.MeshBasicMaterial({ color: palette.warm }),
  );
  root.add(core);
  updaters.push((elapsed) => {
    disk.rotation.y = elapsed * 0.008;
    core.scale.setScalar(0.96 + Math.sin(elapsed * 0.9) * 0.035);
  });
};
