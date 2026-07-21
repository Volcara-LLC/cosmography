import * as THREE from "three";

import type { DomainBuilder } from "@/app/components/universe/runtime/types";

function createGraticule(
  radius: number,
  color: THREE.Color,
): THREE.LineSegments {
  const points: THREE.Vector3[] = [];
  const steps = 96;

  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const phi = THREE.MathUtils.degToRad(90 - latitude);
    for (let step = 0; step < steps; step += 1) {
      const thetaA = (step / steps) * Math.PI * 2;
      const thetaB = ((step + 1) / steps) * Math.PI * 2;
      points.push(
        new THREE.Vector3().setFromSphericalCoords(radius, phi, thetaA),
        new THREE.Vector3().setFromSphericalCoords(radius, phi, thetaB),
      );
    }
  }

  for (let longitude = 0; longitude < 360; longitude += 30) {
    const theta = THREE.MathUtils.degToRad(longitude);
    for (let step = 0; step < steps / 2; step += 1) {
      const phiA = (step / (steps / 2)) * Math.PI;
      const phiB = ((step + 1) / (steps / 2)) * Math.PI;
      points.push(
        new THREE.Vector3().setFromSphericalCoords(radius, phiA, theta),
        new THREE.Vector3().setFromSphericalCoords(radius, phiB, theta),
      );
    }
  }

  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
  );
}

export const buildDomain: DomainBuilder = ({
  root,
  random,
  palette,
  updaters,
}) => {
  const globe = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(4.8, 72, 42),
    new THREE.MeshStandardMaterial({
      color: palette.surface,
      roughness: 0.86,
      metalness: 0.01,
    }),
  );
  globe.add(body);
  globe.add(createGraticule(4.84, palette.primary));
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(5.08, 56, 30),
      new THREE.MeshBasicMaterial({
        color: palette.primary,
        transparent: true,
        opacity: 0.07,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 10),
    new THREE.MeshBasicMaterial({ color: palette.warm }),
  );
  const markerDirection = new THREE.Vector3(
    random() - 0.5,
    random() - 0.5,
    random() - 0.5,
  ).normalize();
  marker.position.copy(markerDirection.multiplyScalar(4.94));
  globe.add(marker);
  root.add(globe);

  updaters.push((elapsed) => {
    globe.rotation.y = elapsed * 0.018;
    marker.scale.setScalar(1 + Math.sin(elapsed * 1.7) * 0.16);
  });
};
