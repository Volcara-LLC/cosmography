"use client";
/* eslint-disable @next/next/no-img-element -- lazy client scene uses exact local evidence assets without the image proxy */

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Building2, Landmark, Radio, Rocket, Telescope } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import styles from "./EarthNetworkAtlasScene.module.css";
import { earthNetwork } from "@/app/data/earth";
import { earthDashboardPresentation, earthDashboardSiteMedia } from "@/app/data/earth/dashboard";

const RADIUS = 2.25;
const sites = earthNetwork.sites;

function roleIcon(role: (typeof sites)[number]["roles"][number]) {
  if (role === "launch-site") return Rocket;
  if (role === "tracking-station" || role === "mission-control") return Radio;
  if (role === "observatory") return Telescope;
  if (role === "museum-public" || role === "historical-site") return Landmark;
  return Building2;
}

function siteVector(latitude: number, longitude: number) {
  const lat = THREE.MathUtils.degToRad(latitude);
  const phi = THREE.MathUtils.degToRad(longitude + 180);
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat));
}

export function EarthNetworkAtlasScene() {
  const frameRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<{ camera: THREE.Camera; controls: OrbitControls } | null>(null);
  const [selectedId, setSelectedId] = useState(sites[0].id);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number; visible: boolean }>>({});
  const selected = sites.find((site) => site.id === selectedId) ?? sites[0];
  const selectedMedia = earthDashboardSiteMedia[selected.id as keyof typeof earthDashboardSiteMedia];

  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    let mounted = true;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 50);
    camera.position.set(0, .2, 6.2);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const material = new THREE.MeshStandardMaterial({ color: 0x6f94a2, roughness: .95 });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 112, 72), material);
    scene.add(globe);
    scene.add(new THREE.HemisphereLight(0xd9f4ff, 0x07111b, 2.3));
    const sun = new THREE.DirectionalLight(0xffffff, 2.8); sun.position.set(-4, 4, 7); scene.add(sun);
    new THREE.TextureLoader().load(earthDashboardPresentation.localAssetUrl, (texture) => {
      if (!mounted) return texture.dispose();
      texture.colorSpace = THREE.SRGBColorSpace; material.map = texture; material.color.set(0xffffff); material.needsUpdate = true;
    });
    const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 3.3; controls.maxDistance = 8;
    const project = () => {
      if (!mounted) return;
      const bounds = frame.getBoundingClientRect();
      const next: Record<string, { x: number; y: number; visible: boolean }> = {};
      for (const site of sites) {
        const point = siteVector(site.coordinates.latitude, site.coordinates.longitude).multiplyScalar(RADIUS * 1.025);
        const p = point.clone().project(camera);
        next[site.id] = { x: (p.x * .5 + .5) * bounds.width, y: (-p.y * .5 + .5) * bounds.height, visible: point.clone().normalize().dot(camera.position.clone().sub(point).normalize()) > .03 && Math.abs(p.x) < 1.03 && Math.abs(p.y) < 1.03 };
      }
      setPositions(next);
    };
    const resize = () => { const b = frame.getBoundingClientRect(); renderer.setSize(b.width, b.height, false); camera.aspect = b.width / b.height; camera.updateProjectionMatrix(); project(); };
    const observer = new ResizeObserver(resize); observer.observe(frame); controls.addEventListener("change", project); resize();
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    runtimeRef.current = { camera, controls };
    return () => { mounted = false; runtimeRef.current = null; renderer.setAnimationLoop(null); observer.disconnect(); controls.dispose(); material.map?.dispose(); material.dispose(); globe.geometry.dispose(); renderer.dispose(); };
  }, []);

  const focus = (id: string) => {
    const site = sites.find((candidate) => candidate.id === id); if (!site) return;
    setSelectedId(id); const runtime = runtimeRef.current; if (!runtime) return;
    runtime.camera.position.copy(siteVector(site.coordinates.latitude, site.coordinates.longitude).multiplyScalar(5.2)); runtime.controls.update();
  };
  const keyDown = (event: KeyboardEvent<HTMLCanvasElement>) => { if (event.key === "Home" || event.key === "0") { event.preventDefault(); focus(sites[0].id); } };

  return <section className={styles.scene} ref={frameRef} aria-labelledby="earth-network-scene-title">
    <canvas className={styles.canvas} ref={canvasRef} tabIndex={0} onKeyDown={keyDown} aria-label="Interactive NASA imagery-backed Earth globe with representative exploration-network sites" />
    <header className={styles.identity}><small>Earth network · representative release</small><h2 id="earth-network-scene-title">Exploration happens here, too.</h2><p>Drag the NASA mosaic globe and select a site marker. Locations are a reviewed but incomplete institutional sample—not live operational telemetry.</p></header>
    <div className={styles.markers} aria-label="Representative Earth exploration sites">{sites.map((site) => {
      if (!positions[site.id]?.visible) return null;
      const Icon = roleIcon(site.roles[0]);
      return <button className={styles.marker} data-selected={selected.id === site.id} key={site.id} type="button" style={{ left: positions[site.id].x, top: positions[site.id].y }} onClick={() => focus(site.id)} aria-label={`Select ${site.name}, ${site.country}`} title={`${site.shortName} · ${site.roles[0].replaceAll("-", " ")}`}><Icon aria-hidden="true" size={15} strokeWidth={2.2} /></button>;
    })}</div>
    <article className={styles.card} aria-live="polite"><small>{siteStatus(selected.status)} · reviewed site record</small><h3>{selected.name}</h3><p>{selected.locality}, {selected.country}</p>{selectedMedia ? <figure className={styles.siteMedia}><img src={selectedMedia.localAssetUrl} width={1041} height={1041} alt="Historic orbital view of Kennedy Space Center from Skylab 4" /><figcaption>{selectedMedia.caption} Credit: {selectedMedia.credit}.</figcaption></figure> : null}<p>{selected.summary}</p><div className={styles.facts}><span>Roles<br />{selected.roles.slice(0, 3).map((role) => role.replaceAll("-", " ")).join(" · ")}</span><span>Coordinate<br />{selected.coordinates.precision.replaceAll("-", " ")}</span><span>Verified<br />{selected.verifiedAt}</span><span>Review by<br />{selected.reviewBy}</span></div><p className={styles.disclosure}>{selected.dataCaveat}</p><a href={selected.officialUrl} target="_blank" rel="noreferrer">Official site record ↗</a>{selectedMedia ? <a href={selectedMedia.sourceUrl} target="_blank" rel="noreferrer">Official image record ↗</a> : null}<Link href="/earth">Open the full Earth network record →</Link><p className={styles.disclosure}>{earthDashboardPresentation.temporalDisclosure}</p></article>
  </section>;
}

function siteStatus(status: string) { return status.replaceAll("-", " "); }
