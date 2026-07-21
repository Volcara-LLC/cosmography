"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import styles from "@/app/components/atlas/SolarSystemAtlasScene.module.css";
import {
  solarSystemBodies,
  solarSystemPresentation,
  type SolarSystemBody,
} from "@/app/data/solar-system-explorer";

type BodyPosition = {
  id: SolarSystemBody["id"];
  visible: boolean;
  x: number;
  y: number;
  side: "left" | "right";
};

type SolarSystemAtlasSceneProps = {
  onSelectMars: () => void;
  onSelectTrappist: () => void;
};

export function SolarSystemAtlasScene({
  onSelectMars,
  onSelectTrappist,
}: SolarSystemAtlasSceneProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const projectRef = useRef<(() => void) | null>(null);
  const [selected, setSelected] = useState<SolarSystemBody>(solarSystemBodies[3]);
  const [ready, setReady] = useState(false);
  const [positions, setPositions] = useState<readonly BodyPosition[]>(
    solarSystemBodies.map((body) => ({ id: body.id, visible: false, x: 0, y: 0, side: "right" })),
  );

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x010204);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
    camera.position.set(9.5, 10.5, 15.5);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const root = new THREE.Group();
    root.rotation.x = -0.08;
    scene.add(root);
    scene.add(new THREE.AmbientLight(0x8192aa, 0.55));
    const sunLight = new THREE.PointLight(0xffe3a1, 140, 48, 1.5);
    root.add(sunLight);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, 48, 30),
      new THREE.MeshBasicMaterial({ color: 0xffcc54 }),
    );
    root.add(sun);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 32, 20),
      new THREE.MeshBasicMaterial({ color: 0xffc34a, transparent: true, opacity: 0.14, side: THREE.BackSide }),
    );
    root.add(halo);

    const bodyMeshes = new Map<SolarSystemBody["id"], THREE.Mesh>();
    for (const body of solarSystemBodies) {
      const orbitPoints = Array.from({ length: 128 }, (_, index) => {
        const angle = (index / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * body.orbitRadius, 0, Math.sin(angle) * body.orbitRadius);
      });
      const orbit = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(orbitPoints),
        new THREE.LineBasicMaterial({ color: 0x5d6a73, transparent: true, opacity: 0.32 }),
      );
      root.add(orbit);

      const material = new THREE.MeshStandardMaterial({ color: body.color, roughness: 0.86, metalness: 0.01 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(body.visualRadius, 28, 18), material);
      const phase = THREE.MathUtils.degToRad(body.phaseDegrees);
      mesh.position.set(Math.cos(phase) * body.orbitRadius, 0, Math.sin(phase) * body.orbitRadius);
      root.add(mesh);
      bodyMeshes.set(body.id, mesh);

      if (body.id === "saturn") {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(body.visualRadius * 1.35, body.visualRadius * 2.05, 48),
          new THREE.MeshBasicMaterial({ color: 0xb9a77a, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
        );
        ring.rotation.x = Math.PI / 2;
        mesh.add(ring);
      }
    }

    const stars: number[] = [];
    for (let index = 0; index < 420; index += 1) {
      const angle = (index * 2.399963) % (Math.PI * 2);
      const z = 1 - (2 * index) / 419;
      const radius = Math.sqrt(1 - z * z);
      stars.push(Math.cos(angle) * radius * 38, z * 38, Math.sin(angle) * radius * 38);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xdce8ee, size: 0.055 })));

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 10;
    controls.maxDistance = 36;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    const resize = () => {
      const bounds = frame.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
    };

    const project = () => {
      const bounds = frame.getBoundingClientRect();
      setPositions(
        solarSystemBodies.map((body) => {
          const mesh = bodyMeshes.get(body.id);
          const point = mesh?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
          const projected = point.project(camera);
          return {
            id: body.id,
            visible: projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.04 && Math.abs(projected.y) < 1.04,
            x: (projected.x * 0.5 + 0.5) * bounds.width,
            y: (-projected.y * 0.5 + 0.5) * bounds.height,
            side: projected.x > 0.35 ? "left" : "right",
          };
        }),
      );
    };
    projectRef.current = project;

    const observer = new ResizeObserver(() => {
      resize();
      project();
    });
    observer.observe(frame);
    controls.addEventListener("change", project);
    resize();
    project();
    setReady(true);
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      projectRef.current = null;
      controlsRef.current = null;
      renderer.setAnimationLoop(null);
      controls.removeEventListener("change", project);
      controls.dispose();
      observer.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, []);

  const selectBody = (body: SolarSystemBody) => {
    setSelected(body);
    if (body.atlasDestination === "mars") onSelectMars();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (event.key === "Home" || event.key === "0") {
      event.preventDefault();
      controls.reset();
      projectRef.current?.();
    }
  };

  return (
    <section className={styles.scene} ref={frameRef} aria-label="Interactive Solar System overview">
      <nav className={styles.systemPicker} aria-label="Star systems in this foundation release">
        <span>Star Systems · 2 indexed</span>
        <button type="button" aria-current="location">
          Solar System
        </button>
        <button type="button" onClick={onSelectTrappist}>
          TRAPPIST-1
        </button>
      </nav>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        tabIndex={0}
        aria-label="Illustrative three-dimensional Solar System with selectable planets"
        aria-describedby="solar-system-disclosure"
        aria-keyshortcuts="Home 0"
        onKeyDown={onKeyDown}
      />
      <div className={styles.labels} aria-label="Solar System planets">
        {solarSystemBodies.map((body) => {
          const position = positions.find((candidate) => candidate.id === body.id);
          if (!position?.visible) return null;
          return (
            <button
              type="button"
              className={styles.label}
              data-side={position.side}
              data-selected={selected.id === body.id}
              data-atlas={body.atlasDestination ?? undefined}
              key={body.id}
              style={{ left: position.x, top: position.y, color: `#${body.color.toString(16).padStart(6, "0")}` }}
              aria-label={`${body.name}, ${body.kind}${body.atlasDestination ? ". Open world" : ". No deep world record in this release"}`}
              onClick={() => selectBody(body)}
            >
              <span className={styles.labelDot} aria-hidden="true" />
              <span className={styles.labelText}>{body.name}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.status} id="solar-system-disclosure" aria-live="polite">
        <strong>{selected.name} · {selected.kind}</strong>
        {solarSystemPresentation.disclosure}
      </p>
      {!ready ? <p className={styles.loading}>Preparing the Solar System overview…</p> : null}
    </section>
  );
}
