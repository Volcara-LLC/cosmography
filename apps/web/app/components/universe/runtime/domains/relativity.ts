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
  const blackHole = new THREE.Mesh(
    new THREE.SphereGeometry(3.35, 64, 36),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  root.add(blackHole);

  const rings = new THREE.Group();
  const ringColors = [palette.warm, palette.primary, palette.warm];
  [5.2, 6.4, 8].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.2 + index * 0.1, 18, 180),
      new THREE.MeshBasicMaterial({
        color: ringColors[index],
        transparent: true,
        opacity: 0.52 - index * 0.11,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    rings.add(ring);
  });
  root.add(rings);

  const count = densityCount(4800, profile);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = 4.3 + Math.pow(random(), 1.8) * 10.5;
    const angle = random() * Math.PI * 2;
    const thickness = gaussian(random) * (0.08 + (radius - 4.3) * 0.018);
    positions.set(
      [
        Math.cos(angle) * radius,
        thickness,
        Math.sin(angle) * radius * 0.94,
      ],
      index * 3,
    );
    const color = random() > 0.55 ? palette.warm : palette.primary;
    writeColor(colors, index, color, 0.36 + random() * 1.1);
  }
  const disk = createPoints(positions, colors, 0.2, 0.92);
  root.add(disk);

  const lens = new THREE.Mesh(
    new THREE.TorusGeometry(3.7, 0.065, 12, 180),
    new THREE.MeshBasicMaterial({
      color: palette.primary,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  root.add(lens);
  updaters.push((elapsed) => {
    disk.rotation.y = elapsed * 0.11;
    rings.rotation.y = elapsed * 0.028;
    lens.scale.setScalar(1 + Math.sin(elapsed * 0.8) * 0.025);
  });
};
