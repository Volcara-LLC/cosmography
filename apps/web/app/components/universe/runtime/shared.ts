import * as THREE from "three";

import { densityCount } from "@/app/components/universe/performance";
import type {
  MotionUpdater,
  Palette,
} from "@/app/components/universe/runtime/types";
import type { RenderProfile } from "@/app/components/universe/performance";

export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(random: () => number): number {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

export function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function paletteFor(
  appearance: "scientific" | "immersive",
  focusColor?: string,
): Palette {
  const safeFocusColor =
    focusColor && /^#[0-9a-fA-F]{6}$/.test(focusColor)
      ? focusColor
      : appearance === "immersive"
        ? "#75d7ff"
        : "#8edff0";

  return {
    primary: new THREE.Color(safeFocusColor),
    secondary: new THREE.Color(
      appearance === "immersive" ? "#9e8cff" : "#7ca7c5",
    ),
    warm: new THREE.Color(
      appearance === "immersive" ? "#ffb45c" : "#d6b77c",
    ),
    dim: new THREE.Color(appearance === "immersive" ? "#20345d" : "#263b4a"),
    surface: new THREE.Color(
      appearance === "immersive" ? "#8a5b46" : "#68727a",
    ),
  };
}

export function createPoints(
  positions: Float32Array,
  colors: Float32Array,
  size: number,
  opacity = 1,
): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geometry, material);
}

export function writeColor(
  colors: Float32Array,
  index: number,
  color: THREE.Color,
  brightness = 1,
): void {
  colors[index * 3] = color.r * brightness;
  colors[index * 3 + 1] = color.g * brightness;
  colors[index * 3 + 2] = color.b * brightness;
}

export function createBackgroundStars(
  random: () => number,
  palette: Palette,
  baseCount: number,
  radius: number,
  profile: RenderProfile,
): THREE.Points {
  const count = densityCount(baseCount, profile);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const direction = new THREE.Vector3(
      gaussian(random),
      gaussian(random),
      gaussian(random),
    ).normalize();
    const distance = radius * (0.74 + random() * 0.26);
    direction.multiplyScalar(distance);
    positions.set([direction.x, direction.y, direction.z], index * 3);
    const color = random() > 0.92 ? palette.warm : palette.secondary;
    writeColor(colors, index, color, 0.38 + random() * 0.65);
  }

  return createPoints(positions, colors, 0.16, 0.72);
}

export function createOrbitLine(
  radius: number,
  inclination: number,
  color: THREE.Color,
  opacity: number,
): THREE.LineLoop {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < 160; index += 1) {
    const angle = (index / 160) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * Math.sin(inclination) * radius,
        Math.sin(angle) * Math.cos(inclination) * radius,
      ),
    );
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.LineLoop(geometry, material);
}

export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((object) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    renderable.geometry?.dispose();
    const materials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [];
    materials.forEach((material) => {
      const record = material as unknown as Record<string, unknown>;
      Object.values(record).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
  scene.clear();
}

export type { MotionUpdater, Palette };
