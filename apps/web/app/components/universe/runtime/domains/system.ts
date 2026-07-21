import * as THREE from "three";

import { createOrbitLine } from "@/app/components/universe/runtime/shared";
import type { DomainBuilder } from "@/app/components/universe/runtime/types";

export const buildDomain: DomainBuilder = ({
  root,
  random,
  palette,
  updaters,
}) => {
  const star = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 40, 24),
    new THREE.MeshBasicMaterial({ color: palette.warm }),
  );
  root.add(star);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.85, 32, 18),
    new THREE.MeshBasicMaterial({
      color: palette.warm,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  root.add(halo);

  const radii = [3.1, 4.6, 6.4, 8.7, 12.2, 16.4, 20.5];
  const planets: Array<{
    mesh: THREE.Mesh;
    radius: number;
    inclination: number;
    phase: number;
    speed: number;
  }> = [];

  radii.forEach((radius, index) => {
    const inclination = (random() - 0.5) * 0.18;
    root.add(createOrbitLine(radius, inclination, palette.dim, 0.3));
    const size = 0.16 + Math.pow(index + 1, 0.34) * 0.075;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 18, 12),
      new THREE.MeshStandardMaterial({
        color:
          index === 2
            ? palette.primary
            : index > 3
              ? palette.warm
              : palette.secondary,
        roughness: 0.82,
        metalness: 0.02,
      }),
    );
    root.add(mesh);
    planets.push({
      mesh,
      radius,
      inclination,
      phase: random() * Math.PI * 2,
      speed: 0.025 / Math.pow(radius, 0.7),
    });
  });

  updaters.push((elapsed) => {
    star.rotation.y = elapsed * 0.08;
    halo.scale.setScalar(1 + Math.sin(elapsed * 0.8) * 0.025);
    planets.forEach(({ mesh, radius, inclination, phase, speed }) => {
      const angle = phase + elapsed * speed;
      mesh.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * Math.sin(inclination) * radius,
        Math.sin(angle) * Math.cos(inclination) * radius,
      );
    });
  });
};
