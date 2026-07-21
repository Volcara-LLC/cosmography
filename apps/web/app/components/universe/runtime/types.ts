import type * as THREE from "three";

import type { ScaleDomain } from "@/app/lib/science/scene";
import type { RenderProfile } from "@/app/components/universe/performance";

export type MotionUpdater = (
  elapsedSeconds: number,
  deltaSeconds: number,
) => void;

export interface Palette {
  primary: THREE.Color;
  secondary: THREE.Color;
  warm: THREE.Color;
  dim: THREE.Color;
  surface: THREE.Color;
}

export interface DomainBuildContext {
  root: THREE.Group;
  random: () => number;
  palette: Palette;
  updaters: MotionUpdater[];
  profile: RenderProfile;
}

export type DomainBuilder = (context: DomainBuildContext) => void;

export interface DomainModule {
  buildDomain: DomainBuilder;
}

export interface RendererController {
  setMotionPaused: (paused: boolean) => void;
  recenterSelection: (sequence: number) => void;
  orbitBy: (deltaTheta: number, deltaPhi: number) => void;
  zoomBy: (scaleFactor: number) => void;
  resetView: () => void;
  renderOnce: () => void;
}

export interface DomainConfig {
  radius: number;
  minRadius: number;
  maxRadius: number;
  fov: number;
  near: number;
  far: number;
  theta: number;
  phi: number;
  targetY: number;
  fogNear?: number;
  fogFar?: number;
}

export type DomainLoaderMap = Readonly<
  Record<ScaleDomain, () => Promise<DomainModule>>
>;
