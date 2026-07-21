import * as THREE from "three";

import {
  calculateEffectivePixelRatio,
  evaluatePerformanceWindow,
  type CalibrationSample,
  type RenderProfile,
} from "@/app/components/universe/performance";
import { loadDomainBuilder } from "@/app/components/universe/runtime/domains";
import {
  normalizedProjectionZoom,
  projectLabelAnchors,
  resolveProjectionZoomTier,
  type LabelProjectionSnapshot,
  type ProjectionAnchor,
  type ProjectionZoomTier,
} from "@/app/components/universe/runtime/labelProjection";
import {
  clamp,
  createBackgroundStars,
  disposeScene,
  hashSeed,
  mulberry32,
  paletteFor,
} from "@/app/components/universe/runtime/shared";
import type {
  DomainConfig,
  MotionUpdater,
  RendererController,
} from "@/app/components/universe/runtime/types";
import type { ScaleDomain } from "@/app/lib/science/scene";

export type RuntimeRenderState = "ready" | "context-lost";

export interface RendererDiagnostics {
  domain: ScaleDomain;
  profile: RenderProfile["name"];
  profileReason: "user" | "auto-baseline" | "auto-runtime-downgrade";
  webglVersion: 2;
  cssWidth: number;
  cssHeight: number;
  framebufferWidth: number;
  framebufferHeight: number;
  effectivePixelRatio: number;
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
  contextLosses: number;
  p50FrameIntervalMs: number | null;
  p95FrameIntervalMs: number | null;
  droppedFrameRatio: number | null;
  frameSampleCount: number;
  domainBuildMs: number;
}

export interface UniverseRendererOptions {
  canvas: HTMLCanvasElement;
  container: HTMLDivElement;
  domain: ScaleDomain;
  appearance: "scientific" | "immersive";
  focusId: string;
  focusColor?: string;
  profile: RenderProfile;
  profileReason: RendererDiagnostics["profileReason"];
  componentMaximumPixelRatio: number;
  motionPaused: boolean;
  recenterSequenceBaseline: number;
  signal: AbortSignal;
  onStateChange: (state: RuntimeRenderState, message?: string) => void;
  onDiagnostics?: (diagnostics: RendererDiagnostics) => void;
  onPerformancePressure?: (sample: CalibrationSample) => void;
  projectionAnchors?: readonly ProjectionAnchor[];
  onLabelProjection?: (snapshot: LabelProjectionSnapshot) => void;
}

export interface UniverseRendererSession {
  controller: RendererController;
  dispose: () => void;
}

const domainConfigs: Record<ScaleDomain, DomainConfig> = {
  lightcone: {
    radius: 52,
    minRadius: 18,
    maxRadius: 105,
    fov: 49,
    near: 0.1,
    far: 260,
    theta: 0.72,
    phi: 1.2,
    targetY: 0,
    fogNear: 82,
    fogFar: 180,
  },
  extragalactic: {
    radius: 45,
    minRadius: 14,
    maxRadius: 92,
    fov: 46,
    near: 0.08,
    far: 220,
    theta: 0.78,
    phi: 1.16,
    targetY: 0,
    fogNear: 75,
    fogFar: 160,
  },
  galactic: {
    radius: 43,
    minRadius: 13,
    maxRadius: 86,
    fov: 45,
    near: 0.06,
    far: 190,
    theta: 0.7,
    phi: 1.05,
    targetY: 0,
    fogNear: 65,
    fogFar: 150,
  },
  system: {
    radius: 34,
    minRadius: 9,
    maxRadius: 70,
    fov: 43,
    near: 0.03,
    far: 150,
    theta: 0.82,
    phi: 1.05,
    targetY: 0,
    fogNear: 80,
    fogFar: 140,
  },
  globe: {
    radius: 14,
    minRadius: 7.8,
    maxRadius: 36,
    fov: 42,
    near: 0.02,
    far: 100,
    theta: 0.72,
    phi: 1.22,
    targetY: 0,
    fogNear: 48,
    fogFar: 88,
  },
  surface: {
    radius: 30,
    minRadius: 7,
    maxRadius: 62,
    fov: 48,
    near: 0.025,
    far: 145,
    theta: 0.65,
    phi: 1.08,
    targetY: -1.5,
    fogNear: 36,
    fogFar: 94,
  },
  panorama: {
    radius: 19,
    minRadius: 7,
    maxRadius: 42,
    fov: 58,
    near: 0.02,
    far: 110,
    theta: 0.35,
    phi: 1.38,
    targetY: -0.5,
    fogNear: 42,
    fogFar: 90,
  },
  simulation: {
    radius: 31,
    minRadius: 11,
    maxRadius: 68,
    fov: 42,
    near: 0.02,
    far: 150,
    theta: 0.62,
    phi: 1.2,
    targetY: 0,
    fogNear: 65,
    fogFar: 130,
  },
};

export async function createUniverseRenderer(
  options: UniverseRendererOptions,
): Promise<UniverseRendererSession | null> {
  const {
    canvas,
    container,
    domain,
    appearance,
    focusId,
    focusColor,
    profile,
    profileReason,
    componentMaximumPixelRatio,
    signal,
    onStateChange,
    onDiagnostics,
    onPerformancePressure,
    projectionAnchors = [],
    onLabelProjection,
  } = options;

  const buildDomain = await loadDomainBuilder(domain);
  if (signal.aborted) return null;

  const context = canvas.getContext("webgl2", {
    alpha: false,
    antialias: true,
    powerPreference: "high-performance",
  });
  if (!context) {
    throw new Error("WebGL2 is unavailable on this device.");
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  let disposed = false;
  let contextAvailable = true;
  let contextLosses = 0;
  let frameRequest = 0;
  let requestedMotionPaused = options.motionPaused;
  let pageHidden = document.hidden;
  let simulationElapsed = 0;
  let lastFrameTime = performance.now();
  let lastRenderedTime = lastFrameTime;
  let currentRecenterSequence = options.recenterSequenceBaseline;
  let projectionSequence = 0;
  let projectionDirty = true;
  let lastProjectionPublishedAt = Number.NEGATIVE_INFINITY;
  let projectionFinalizer = 0;
  let projectionZoomTier: ProjectionZoomTier = "overview";

  renderer.setClearColor(0x02050b, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = appearance === "immersive" ? 1.14 : 0.92;

  const scene = new THREE.Scene();
  const config = domainConfigs[domain];
  if (config.fogNear !== undefined && config.fogFar !== undefined) {
    scene.fog = new THREE.Fog(0x02050b, config.fogNear, config.fogFar);
  }

  const camera = new THREE.PerspectiveCamera(
    config.fov,
    1,
    config.near,
    config.far,
  );
  const target = new THREE.Vector3(0, config.targetY, 0);
  const orbit = {
    theta: config.theta,
    phi: config.phi,
    radius: config.radius,
  };

  const palette = paletteFor(appearance, focusColor);
  const random = mulberry32(hashSeed(`${domain}:${focusId}:cosmography-v1`));
  const root = new THREE.Group();
  root.userData.representation = "procedural-scientific-display-context";
  root.userData.focusId = focusId;
  root.userData.renderProfile = profile.name;
  scene.add(root);

  const updaters: MotionUpdater[] = [];
  const domainBuildStarted = performance.now();
  buildDomain({ root, random, palette, updaters, profile });
  if (domain !== "lightcone" && domain !== "extragalactic") {
    scene.add(createBackgroundStars(random, palette, 1200, 62, profile));
  }
  const domainBuildMs = performance.now() - domainBuildStarted;

  scene.add(new THREE.HemisphereLight(0xa9d8ff, 0x24160f, 1.15));
  const keyLight = new THREE.DirectionalLight(0xffe2bd, 2.5);
  keyLight.position.set(12, 18, 16);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x7ec8ff, 1.3);
  rimLight.position.set(-18, 7, -13);
  scene.add(rimLight);

  const updateCamera = () => {
    const sinPhiRadius = Math.sin(orbit.phi) * orbit.radius;
    camera.position.set(
      target.x + sinPhiRadius * Math.sin(orbit.theta),
      target.y + Math.cos(orbit.phi) * orbit.radius,
      target.z + sinPhiRadius * Math.cos(orbit.theta),
    );
    camera.lookAt(target);
  };
  updateCamera();

  const reportDiagnostics = (
    cssWidth: number,
    cssHeight: number,
    effectivePixelRatio: number,
  ) => {
    if (!onDiagnostics) return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    onDiagnostics({
      domain,
      profile: profile.name,
      profileReason,
      webglVersion: 2,
      cssWidth,
      cssHeight,
      framebufferWidth: size.x,
      framebufferHeight: size.y,
      effectivePixelRatio,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      points: renderer.info.render.points,
      lines: renderer.info.render.lines,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      contextLosses,
      p50FrameIntervalMs: latestSample?.p50 ?? null,
      p95FrameIntervalMs: latestSample?.p95 ?? null,
      droppedFrameRatio: latestSample?.droppedFrameRatio ?? null,
      frameSampleCount: latestSample?.count ?? 0,
      domainBuildMs,
    });
  };

  let lastCssWidth = 1;
  let lastCssHeight = 1;
  let effectivePixelRatio = 1;
  let diagnosticsDirty = true;
  let sampleWindowStarted = performance.now();
  let frameIntervals: number[] = [];
  let consecutiveFailingWindows = 0;
  let pressureReported = false;
  let latestSample:
    | { p50: number; p95: number; droppedFrameRatio: number; count: number }
    | undefined;

  const publishLabelProjection = (now: number, force: boolean) => {
    if (
      !onLabelProjection ||
      !projectionDirty ||
      disposed ||
      signal.aborted ||
      !contextAvailable
    ) {
      return;
    }
    if (!force && now - lastProjectionPublishedAt < 1000 / 30) return;

    const normalizedZoom = normalizedProjectionZoom(
      orbit.radius,
      config.minRadius,
      config.maxRadius,
    );
    projectionZoomTier = resolveProjectionZoomTier(
      normalizedZoom,
      projectionZoomTier,
    );
    projectionSequence += 1;
    onLabelProjection({
      anchors: projectLabelAnchors({
        anchors: projectionAnchors,
        root,
        camera,
        width: lastCssWidth,
        height: lastCssHeight,
      }),
      width: lastCssWidth,
      height: lastCssHeight,
      normalizedZoom,
      zoomTier: projectionZoomTier,
      domain,
      focusId,
      sequence: projectionSequence,
    });
    projectionDirty = false;
    lastProjectionPublishedAt = now;
  };

  const renderFrame = (
    now: number,
    advanceMotion: boolean,
    forceProjection = false,
  ) => {
    if (disposed || !contextAvailable) return;
    const delta = advanceMotion
      ? Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000))
      : 0;
    lastFrameTime = now;
    if (advanceMotion) simulationElapsed += delta;
    updaters.forEach((update) => update(simulationElapsed, delta));

    renderer.render(scene, camera);
    publishLabelProjection(now, forceProjection);
    if (diagnosticsDirty) {
      reportDiagnostics(lastCssWidth, lastCssHeight, effectivePixelRatio);
      diagnosticsDirty = false;
    }
  };

  const shouldPauseMotion = () => requestedMotionPaused || pageHidden;
  const minimumFrameInterval = 1000 / profile.targetFramesPerSecond;

  const finishSampleWindow = (now: number) => {
    if (now - sampleWindowStarted < 2_000 || frameIntervals.length === 0) return;
    const sorted = [...frameIntervals].sort((left, right) => left - right);
    const percentile = (fraction: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
    const droppedFrameRatio =
      frameIntervals.filter((interval) => interval > minimumFrameInterval * 1.5)
        .length / frameIntervals.length;
    latestSample = {
      p50: percentile(0.5),
      p95: percentile(0.95),
      droppedFrameRatio,
      count: frameIntervals.length,
    };
    const pressure = evaluatePerformanceWindow({
      profile: profile.name,
      sample: {
        p95FrameIntervalMs: latestSample.p95,
        droppedFrameRatio,
      },
      previousFailures: consecutiveFailingWindows,
    });
    consecutiveFailingWindows = pressure.consecutiveFailingWindows;
    diagnosticsDirty = true;
    if (pressure.downgradeRecommended && !pressureReported) {
      pressureReported = true;
      onPerformancePressure?.({
        p95FrameIntervalMs: latestSample.p95,
        droppedFrameRatio,
      });
    }
    frameIntervals = [];
    sampleWindowStarted = now;
  };

  const animate = (now: number) => {
    frameRequest = 0;
    if (disposed || shouldPauseMotion() || !contextAvailable) return;
    if (now - lastRenderedTime >= minimumFrameInterval - 1) {
      frameIntervals.push(now - lastRenderedTime);
      finishSampleWindow(now);
      renderFrame(now, true);
      lastRenderedTime = now;
    }
    frameRequest = window.requestAnimationFrame(animate);
  };

  const startAnimation = () => {
    if (
      !disposed &&
      !shouldPauseMotion() &&
      contextAvailable &&
      frameRequest === 0
    ) {
      lastFrameTime = performance.now();
      lastRenderedTime = lastFrameTime;
      frameRequest = window.requestAnimationFrame(animate);
    }
  };

  const renderOnce = (forceProjection = false) =>
    renderFrame(performance.now(), false, forceProjection);

  const scheduleFinalProjection = () => {
    if (!onLabelProjection) return;
    if (projectionFinalizer) window.clearTimeout(projectionFinalizer);
    projectionFinalizer = window.setTimeout(() => {
      projectionFinalizer = 0;
      if (!disposed && !pageHidden && projectionDirty) renderOnce(true);
    }, Math.ceil(1000 / 30));
  };

  const orbitBy = (deltaTheta: number, deltaPhi: number) => {
    orbit.theta += deltaTheta;
    orbit.phi = clamp(orbit.phi + deltaPhi, 0.12, Math.PI - 0.12);
    updateCamera();
    projectionDirty = true;
    renderOnce();
    scheduleFinalProjection();
  };

  const zoomBy = (scaleFactor: number) => {
    orbit.radius = clamp(
      orbit.radius * scaleFactor,
      config.minRadius,
      config.maxRadius,
    );
    updateCamera();
    projectionDirty = true;
    renderOnce();
    scheduleFinalProjection();
  };

  const resetView = () => {
    orbit.theta = config.theta;
    orbit.phi = config.phi;
    orbit.radius = config.radius;
    updateCamera();
    projectionDirty = true;
    renderOnce(true);
  };

  const controller: RendererController = {
    setMotionPaused(nextPaused) {
      requestedMotionPaused = nextPaused;
      if (shouldPauseMotion()) {
        if (frameRequest !== 0) window.cancelAnimationFrame(frameRequest);
        frameRequest = 0;
        if (!pageHidden) renderOnce(true);
      } else {
        startAnimation();
      }
    },
    recenterSelection(sequence) {
      if (sequence === currentRecenterSequence) return;
      currentRecenterSequence = sequence;
      resetView();
    },
    orbitBy,
    zoomBy,
    resetView,
    renderOnce: () => renderOnce(true),
  };

  const resize = () => {
    if (disposed || signal.aborted || !contextAvailable) return;
    const bounds = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    effectivePixelRatio = calculateEffectivePixelRatio({
      cssWidth: width,
      cssHeight: height,
      devicePixelRatio: window.devicePixelRatio || 1,
      profile,
      componentMaximum: componentMaximumPixelRatio,
    });
    lastCssWidth = width;
    lastCssHeight = height;
    diagnosticsDirty = true;
    renderer.setPixelRatio(effectivePixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    projectionDirty = true;
    renderOnce(true);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  let activePointer: number | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || activePointer !== null) return;
    activePointer = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    if (event.pointerType !== "touch") {
      canvas.setPointerCapture(event.pointerId);
      canvas.focus({ preventScroll: true });
    }
    canvas.style.cursor = "grabbing";
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) return;
    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    if (event.pointerType === "touch" && Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }
    orbitBy(-deltaX * 0.0045, deltaY * 0.0045);
  };

  const releasePointer = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) return;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    activePointer = null;
    canvas.style.cursor = "grab";
  };

  const handleWheel = (event: WheelEvent) => {
    if (event.ctrlKey || window.matchMedia("(pointer: coarse)").matches) return;
    event.preventDefault();
    zoomBy(Math.exp(event.deltaY * 0.0012));
  };

  const handleVisibilityChange = () => {
    pageHidden = document.hidden;
    if (pageHidden) {
      if (frameRequest !== 0) window.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    } else if (requestedMotionPaused) {
      projectionDirty = true;
      renderOnce(true);
    } else {
      startAnimation();
    }
  };

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    contextAvailable = false;
    contextLosses += 1;
    if (frameRequest !== 0) window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    onStateChange(
      "context-lost",
      "The graphics context was interrupted. Cosmography will resume the view if the browser restores it.",
    );
  };

  const handleContextRestored = () => {
    if (disposed || signal.aborted) return;
    contextAvailable = true;
    onStateChange("ready");
    projectionDirty = true;
    resize();
    if (!shouldPauseMotion()) startAnimation();
  };

  canvas.style.touchAction = "pan-y pinch-zoom";
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("wheel", handleWheel, { passive: false });
  canvas.addEventListener("webglcontextlost", handleContextLost);
  canvas.addEventListener("webglcontextrestored", handleContextRestored);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  resize();
  renderOnce();
  startAnimation();
  onStateChange("ready");

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (frameRequest !== 0) window.cancelAnimationFrame(frameRequest);
    if (projectionFinalizer) window.clearTimeout(projectionFinalizer);
    resizeObserver.disconnect();
    canvas.removeEventListener("pointerdown", handlePointerDown);
    canvas.removeEventListener("pointermove", handlePointerMove);
    canvas.removeEventListener("pointerup", releasePointer);
    canvas.removeEventListener("pointercancel", releasePointer);
    canvas.removeEventListener("wheel", handleWheel);
    canvas.removeEventListener("webglcontextlost", handleContextLost);
    canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    disposeScene(scene);
    renderer.dispose();
  };

  if (signal.aborted) {
    dispose();
    return null;
  }

  return { controller, dispose };
}
