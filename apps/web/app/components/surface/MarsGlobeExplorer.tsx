"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import styles from "@/app/components/surface/MarsGlobeExplorer.module.css";
import {
  marsGlobePlaces,
  marsGlobePresentation,
  marsMappedRegions,
  type MarsGlobePlace,
} from "@/app/data/surface/mars-globe-explorer";

const GLOBE_RADIUS = 2.35;
const MIN_DISTANCE = 3.35;
const MAX_DISTANCE = 8.2;
const INITIAL_DISTANCE = 6.8;
const REGIONAL_DISTANCE = 5.35;

type MarkerPosition = {
  readonly id: MarsGlobePlace["id"];
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly labelSide: "left" | "right";
};

type ExplorerRuntime = {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  focus: (place: MarsGlobePlace, distance?: number) => void;
  zoom: (delta: number) => void;
  nudge: (horizontal: number, vertical: number) => void;
};

type MarsGlobeExplorerProps = {
  readonly onEnterSurface: () => void;
  readonly embedded?: boolean;
  readonly onDetailTierChange?: (tier: "overview" | "regional") => void;
};

export type MarsGlobeExplorerHandle = {
  readonly exploreJezero: () => void;
  readonly showOverview: () => void;
};

function placeVector(place: Pick<MarsGlobePlace, "latitude" | "longitudeEast">) {
  const latitude = THREE.MathUtils.degToRad(place.latitude);
  const textureU = ((place.longitudeEast + 180) % 360) / 360;
  const phi = textureU * Math.PI * 2;
  const cosLatitude = Math.cos(latitude);
  return new THREE.Vector3(
    -Math.cos(phi) * cosLatitude,
    Math.sin(latitude),
    Math.sin(phi) * cosLatitude,
  );
}

function mappedPoint(longitudeEast: number, latitude: number) {
  return placeVector({ longitudeEast, latitude }).multiplyScalar(GLOBE_RADIUS * 1.012);
}

function addMappedGeometry(
  globe: THREE.Group,
  geometry: { type: string; coordinates: unknown },
  color: number,
) {
  const polygons = geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.type === "MultiPolygon"
      ? geometry.coordinates
      : [];
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  for (const polygon of polygons as number[][][][]) {
    for (const ring of polygon) {
      const points = ring.map(([longitude, latitude]) => mappedPoint(longitude, latitude));
      if (points.length < 3) continue;
      globe.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material));
    }
  }
}

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

function createStars() {
  const points: number[] = [];
  for (let index = 0; index < 520; index += 1) {
    const u = ((index * 73) % 521) / 521;
    const v = ((index * 193) % 523) / 523;
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const radius = 18 + ((index * 17) % 11);
    points.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xdceaf2,
      size: 0.045,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
}

export const MarsGlobeExplorer = forwardRef<
  MarsGlobeExplorerHandle,
  MarsGlobeExplorerProps
>(function MarsGlobeExplorer(
  { onEnterSurface, embedded = false, onDetailTierChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ExplorerRuntime | null>(null);
  const detailTierRef = useRef<"overview" | "regional">("overview");
  const onDetailTierChangeRef = useRef(onDetailTierChange);
  const [selectedId, setSelectedId] = useState<MarsGlobePlace["id"]>("jezero");
  const [detailTier, setDetailTier] = useState<"overview" | "regional">("overview");
  const [distance, setDistance] = useState(INITIAL_DISTANCE);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [markerPositions, setMarkerPositions] = useState<readonly MarkerPosition[]>(
    marsGlobePlaces.map((place) => ({
      id: place.id,
      visible: false,
      x: 0,
      y: 0,
      labelSide: "right",
    })),
  );

  const selectedPlace =
    marsGlobePlaces.find((place) => place.id === selectedId) ?? marsGlobePlaces[0];

  useEffect(() => {
    onDetailTierChangeRef.current = onDetailTierChange;
  }, [onDetailTierChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    let mounted = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020407);
    scene.fog = new THREE.FogExp2(0x020407, 0.014);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.copy(placeVector(marsGlobePlaces[0]).multiplyScalar(INITIAL_DISTANCE));

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const globe = new THREE.Group();
    scene.add(globe);
    const globeGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 112, 72);
    const globeMaterial = new THREE.MeshStandardMaterial({
      color: 0x9b4c33,
      roughness: 0.94,
      metalness: 0,
    });
    const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
    globe.add(globeMesh);

    const atmosphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.035, 80, 52);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xc6643f,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    globe.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

    scene.add(new THREE.HemisphereLight(0xf1d6c6, 0x120907, 1.55));
    const sun = new THREE.DirectionalLight(0xffe2cf, 3.4);
    sun.position.copy(camera.position).normalize().multiplyScalar(8);
    sun.position.x -= 2;
    sun.position.y += 2;
    scene.add(sun);
    scene.add(createStars());

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      marsGlobePresentation.localAssetUrl,
      (texture) => {
        if (!mounted) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        globeMaterial.map = texture;
        globeMaterial.color.set(0xffffff);
        globeMaterial.needsUpdate = true;
        setReady(true);
      },
      undefined,
      () => {
        if (mounted) setError(true);
      },
    );

    for (const region of marsMappedRegions) {
      void fetch(region.localAssetUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`Mapped region ${region.id} unavailable`);
          return response.json() as Promise<{
            features?: Array<{ geometry?: { type: string; coordinates: unknown } }>;
          }>;
        })
        .then((collection) => {
          if (!mounted) return;
          for (const feature of collection.features ?? []) {
            if (feature.geometry) addMappedGeometry(globe, feature.geometry, region.color);
          }
        })
        .catch(() => {
          // Center markers and source links remain usable if a derived outline fails.
        });
    }

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.8;
    controls.target.set(0, 0, 0);
    controls.update();

    const resize = () => {
      const bounds = frame.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
    };

    const projectMarkers = () => {
      if (!mounted) return;
      const bounds = frame.getBoundingClientRect();
      const nextDistance = camera.position.length();
      setDistance(nextDistance);
      const nextTier = nextDistance <= REGIONAL_DISTANCE ? "regional" : "overview";
      setDetailTier(nextTier);
      if (detailTierRef.current !== nextTier) {
        detailTierRef.current = nextTier;
        onDetailTierChangeRef.current?.(nextTier);
      }
      setMarkerPositions(
        marsGlobePlaces.map((place) => {
          const point = placeVector(place).multiplyScalar(GLOBE_RADIUS * 1.025);
          const surfaceNormal = point.clone().normalize();
          const towardCamera = camera.position.clone().sub(point).normalize();
          const projected = point.clone().project(camera);
          const visible =
            surfaceNormal.dot(towardCamera) > 0.04 &&
            projected.z > -1 &&
            projected.z < 1 &&
            projected.x > -1.08 &&
            projected.x < 1.08 &&
            projected.y > -1.08 &&
            projected.y < 1.08;
          return {
            id: place.id,
            visible,
            x: (projected.x * 0.5 + 0.5) * bounds.width,
            y: (-projected.y * 0.5 + 0.5) * bounds.height,
            labelSide: projected.x > 0.28 ? "left" : "right",
          };
        }),
      );
    };

    const focus = (place: MarsGlobePlace, requestedDistance = Math.min(camera.position.length(), 5.1)) => {
      camera.position.copy(
        placeVector(place).multiplyScalar(
          THREE.MathUtils.clamp(requestedDistance, MIN_DISTANCE, MAX_DISTANCE),
        ),
      );
      controls.target.set(0, 0, 0);
      controls.update();
      projectMarkers();
    };

    const zoom = (delta: number) => {
      camera.position.setLength(
        THREE.MathUtils.clamp(camera.position.length() + delta, MIN_DISTANCE, MAX_DISTANCE),
      );
      controls.update();
      projectMarkers();
    };

    const nudge = (horizontal: number, vertical: number) => {
      const spherical = new THREE.Spherical().setFromVector3(camera.position);
      spherical.theta += horizontal;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + vertical, 0.22, Math.PI - 0.22);
      camera.position.setFromSpherical(spherical);
      controls.update();
      projectMarkers();
    };

    runtimeRef.current = { camera, controls, focus, zoom, nudge };
    const resizeObserver = new ResizeObserver(() => {
      resize();
      projectMarkers();
    });
    resizeObserver.observe(frame);
    controls.addEventListener("change", projectMarkers);
    resize();
    projectMarkers();

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      mounted = false;
      runtimeRef.current = null;
      renderer.setAnimationLoop(null);
      controls.removeEventListener("change", projectMarkers);
      controls.dispose();
      resizeObserver.disconnect();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.Line
        ) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (material instanceof THREE.MeshStandardMaterial && material.map) {
              material.map.dispose();
            }
            material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, []);

  const focusPlace = (place: MarsGlobePlace) => {
    setSelectedId(place.id);
    runtimeRef.current?.focus(place);
  };

  const reset = () => {
    setSelectedId("jezero");
    runtimeRef.current?.focus(marsGlobePlaces[0], INITIAL_DISTANCE);
  };

  useImperativeHandle(
    ref,
    () => ({
      exploreJezero() {
        setSelectedId("jezero");
        runtimeRef.current?.focus(marsGlobePlaces[0], 5.1);
      },
      showOverview: reset,
    }),
    [],
  );

  const onCanvasKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      runtimeRef.current?.nudge(-0.1, 0);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      runtimeRef.current?.nudge(0.1, 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      runtimeRef.current?.nudge(0, -0.08);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      runtimeRef.current?.nudge(0, 0.08);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      runtimeRef.current?.zoom(-0.55);
    } else if (event.key === "-") {
      event.preventDefault();
      runtimeRef.current?.zoom(0.55);
    } else if (event.key === "Home" || event.key === "0") {
      event.preventDefault();
      reset();
    }
  };

  return (
    <section
      className={`${styles.explorer}${embedded ? ` ${styles.embedded}` : ""}`}
      ref={frameRef}
      aria-labelledby="mars-globe-title"
      aria-describedby="mars-globe-instructions"
    >
      <canvas
        className={styles.canvas}
        ref={canvasRef}
        tabIndex={0}
        aria-label="Interactive imagery-backed globe of Mars"
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - Home 0"
        onKeyDown={onCanvasKeyDown}
      />

      <div className={styles.identity}>
        <p className={styles.eyebrow}>Worlds · Explore</p>
        <h2 id="mars-globe-title">Mars</h2>
        <p>
          Drag to orbit, scroll or use the controls to move closer, and choose a named
          location. Recorded surface views appear only where this release retains one.
        </p>
      </div>

      <aside className={styles.truthCard} aria-label="Globe representation">
        <span className={styles.truthLabel}>Derived observation</span>
        <strong>Viking MDIM 2.1 global mosaic</strong>
        <span>Processed global basemap · not rover-scale detail</span>
        <span>USGS mapped-unit outlines: cyan canyon-floor deposits · amber Olympus shield</span>
      </aside>

      <div className={styles.markerLayer} aria-label="Named Mars locations">
        {marsGlobePlaces.map((place) => {
          const position = markerPositions.find((candidate) => candidate.id === place.id);
          const tierVisible = place.labelTier === "overview" || detailTier === "regional";
          if (!position?.visible || !tierVisible) return null;
          const hasSurface = place.surfaceView.state === "recorded-presentation-available";
          return (
            <button
              className={styles.marker}
              data-selected={selectedId === place.id}
              data-surface={hasSurface}
              data-label-side={position.labelSide}
              key={place.id}
              type="button"
              style={{ left: position.x, top: position.y }}
              aria-pressed={selectedId === place.id}
              aria-label={`${place.name}. ${place.surfaceView.label}`}
              onClick={() => focusPlace(place)}
            >
              <span className={styles.markerDot} aria-hidden="true">
                {hasSurface ? "⌖" : "•"}
              </span>
              <span className={styles.markerText}>
                <strong>{place.name}</strong>
                {hasSurface ? <small>Surface view</small> : null}
              </span>
            </button>
          );
        })}
      </div>

      <article className={styles.placeCard} aria-live="polite">
        <p className={styles.placeType}>{selectedPlace.kind}</p>
        <h3>{selectedPlace.name}</h3>
        <span className={styles.coordinates}>
          {formatCoordinate(selectedPlace.latitude, "N", "S")} ·{" "}
          {formatCoordinate(selectedPlace.longitudeEast, "E", "W")} · Gazetteer center
        </span>
        <span className={styles.placeKind}>
          Approximate diameter {selectedPlace.diameterKm.toLocaleString()} km
        </span>
        <span className={styles.extentDisclosure}>
          {selectedPlace.id === "valles-marineris"
            ? "Cyan outline: selected USGS canyon-floor deposits · not the complete canyon boundary"
            : selectedPlace.id === "olympus-mons"
              ? "Amber outline: USGS mapped shield members · aureole deposits excluded"
              : "Center marker only · no geological boundary asserted"}
        </span>
        <span className={styles.availability}>{selectedPlace.surfaceView.label}</span>
        {selectedPlace.surfaceView.state === "recorded-presentation-available" ? (
          <button className={styles.surfaceAction} type="button" onClick={onEnterSurface}>
            Enter recorded surface view <span aria-hidden="true">→</span>
          </button>
        ) : null}
        <a
          className={styles.sourceLink}
          href={selectedPlace.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open official USGS/IAU place record
        </a>
      </article>

      <p className={styles.instructions} id="mars-globe-instructions">
        Drag, pinch, or scroll. Keyboard: arrow keys orbit, plus/minus zoom, Home resets
        to Jezero. Labels increase as you move closer.
      </p>

      <div className={styles.controls} role="group" aria-label="Mars globe controls">
        <button
          type="button"
          aria-label="Zoom closer"
          title="Zoom closer"
          disabled={distance <= MIN_DISTANCE + 0.05}
          onClick={() => runtimeRef.current?.zoom(-0.55)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom farther"
          title="Zoom farther"
          disabled={distance >= MAX_DISTANCE - 0.05}
          onClick={() => runtimeRef.current?.zoom(0.55)}
        >
          −
        </button>
        <button type="button" aria-label="Reset globe to Jezero" title="Reset" onClick={reset}>
          ↺
        </button>
      </div>

      {!ready && !error ? <p className={styles.loading}>Loading the Mars mosaic…</p> : null}
      {error ? (
        <p className={styles.error} role="alert">
          The retained Mars texture could not be loaded. Location controls remain withheld.
        </p>
      ) : null}
    </section>
  );
});
