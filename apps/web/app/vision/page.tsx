"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Database,
  Flag,
  Map,
  Route,
  Sparkles,
} from "lucide-react";

import { DirectoryHeader } from "@/app/components/navigation/DirectoryHeader";
import styles from "./Vision.module.css";

const productLayers = [
  {
    name: "Experience and visual shell",
    progress: 68,
    boundary: "The cross-scale atlas, responsive controls, evidence views, and first world scenes work. Richer transitions and device qualification remain.",
  },
  {
    name: "Atlas navigation and search",
    progress: 62,
    boundary: "Semantic domains, search, deep links, tours, and the first zoom-sensitive planetary navigation work across a bounded seed atlas.",
  },
  {
    name: "Scientific data and catalog depth",
    progress: 14,
    boundary: "Strong provenance rules exist, but the catalog, terrain, observation, media, and mission archives are still sparse.",
  },
  {
    name: "Flagship experiences",
    progress: 40,
    boundary: "Mars, Moon, Voyager, Earth, Seven Scales, Flight Deck, and Black Hole Lab are real reference slices—not finished destinations.",
  },
  {
    name: "Personal and account features",
    progress: 50,
    boundary: "Saved places, encounters, spacecraft concepts, comparisons, and a tour return point exist; production identity and synchronization remain.",
  },
  {
    name: "AI and conversational layer",
    progress: 2,
    boundary: "Groundable APIs exist, but no public COSMO conversation or agent experience has been admitted yet.",
  },
  {
    name: "Publication and operations",
    progress: 12,
    boundary: "CI and rollback contracts exist; hosted staging, production controls, monitoring, backups, and launch operations do not.",
  },
] as const;

const constructed = [
  "A manipulable atlas spanning the observable universe, galaxies, stars, systems, worlds, missions, and Earth’s exploration network.",
  "A release-pinned evidence system that distinguishes observation, processing, reconstruction, simulation, and fictional travel.",
  "A first complete interaction path from the observable universe through the Solar System to Mars and discrete recorded Jezero rover views.",
  "Detailed reference pages for Mars, Apollo 17, Voyager 1, Earth facilities, source records, and evidence coverage.",
  "Private saved places, recorded encounters, tour return state, comparisons, and clearly fictional spacecraft concepts.",
] as const;

const stillNeeded = [
  "Much deeper mission, catalog, imagery, terrain, panorama, sample, instrument, and historical data ingestion.",
  "Reusable world and mission adapters so Mars is the first pattern—not a one-off experience.",
  "Source-backed local terrain, coordinate transforms, camera poses, time-aware layers, and scalable catalog streaming.",
  "Independent scientific, rights, accessibility, performance, security, privacy, cost, backup, and rollback qualification.",
  "Hosted staging and production systems; the present build is still a private draft and local owner-test environment.",
] as const;

const missionStreetView = [
  {
    step: "01",
    title: "Compile the mission record",
    copy: "Acquire and verify official routes, stops, observations, images, panoramas, video, audio, samples, events, geometry, rights, and provenance before expanding immersion.",
  },
  {
    step: "02",
    title: "Place the documented path",
    copy: "Show the spacecraft, rover, astronaut, aircraft, or telescope journey at the correct scale with dated, clickable mission locations.",
  },
  {
    step: "03",
    title: "Enter recorded viewpoints",
    copy: "At each stop, reveal what the mission actually captured. Connect discrete panoramas and images without pretending the gaps were filmed.",
  },
  {
    step: "04",
    title: "Add truthful reconstruction",
    copy: "Only after the evidence graph is strong, add optional smooth travel or game-like terrain labeled wherever motion, geometry, or scenery is reconstructed.",
  },
] as const;

export default function ProjectVisionPage() {
  const directionalMean = Math.round(
    productLayers.reduce((total, layer) => total + layer.progress, 0) / productLayers.length,
  );

  return (
    <div className={`directory-page ${styles.page}`}>
      <DirectoryHeader />
      <main className={styles.main}>
        <section className={styles.hero}>
          <span className="eyebrow">Project vision · active private build</span>
          <h1>One living map of humanity&apos;s knowledge of the universe.</h1>
          <p>
            Cosmography is being built so a person can begin at the observable universe,
            move naturally through each scientific scale, reach a real mission or place,
            and inspect what humanity actually measured, photographed, reconstructed, or imagined.
          </p>
          <div className={styles.heroActions}>
            <Link className="primary-action" href="/">
              Open the atlas <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/sources">
              Inspect current sources <Database size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className={styles.status} aria-labelledby="vision-status-heading">
          <div className={styles.statusLead}>
            <span className="eyebrow">Directional build status · July 2026</span>
            <h2 id="vision-status-heading">A strong framework with most of the universe still to compile.</h2>
            <p>
              The simple cross-layer mean is approximately <strong>{directionalMean}%</strong>.
              These percentages describe implementation direction, not scientific completeness,
              public-release readiness, or the amount of the universe that is known.
            </p>
          </div>
          <div className={styles.progressGrid}>
            {productLayers.map((layer) => (
              <article className={styles.progressCard} key={layer.name}>
                <div>
                  <h3>{layer.name}</h3>
                  <strong>{layer.progress}%</strong>
                </div>
                <div className={styles.progressTrack} aria-hidden="true">
                  <span style={{ width: `${layer.progress}%` }} />
                </div>
                <p>{layer.boundary}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.buildColumns} aria-label="Constructed and remaining work">
          <article>
            <CheckCircle2 size={22} aria-hidden="true" />
            <span className="eyebrow">Constructed now</span>
            <h2>The foundation is real.</h2>
            <ul>{constructed.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <article>
            <CircleDashed size={22} aria-hidden="true" />
            <span className="eyebrow">Still under construction</span>
            <h2>The content universe is not.</h2>
            <ul>{stillNeeded.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </section>

        <section className={styles.missionSection} aria-labelledby="mission-path-heading">
          <div className={styles.sectionHeading}>
            <Route size={25} aria-hidden="true" />
            <div>
              <span className="eyebrow">All-missions interaction architecture</span>
              <h2 id="mission-path-heading">Data first. Then movement.</h2>
            </div>
          </div>
          <p className={styles.sectionIntro}>
            Mars is the first example, but this approach belongs to every mission. A rover
            traverse, astronaut path, spacecraft trajectory, helicopter flight, telescope campaign,
            or sample history becomes a navigable evidence graph before it becomes an immersive reconstruction.
          </p>
          <ol className={styles.pathGrid}>
            {missionStreetView.map((item) => (
              <li key={item.step}>
                <span>{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </li>
            ))}
          </ol>
          <aside className={styles.truthNote}>
            <Map size={20} aria-hidden="true" />
            <p>
              “Street View” means connected, source-backed viewpoints along a documented path.
              Recorded pixels remain distinct from interpolated movement, reconstructed terrain,
              simulations, and artistic experiences.
            </p>
          </aside>
        </section>

        <section className={styles.finalGoal}>
          <Flag size={25} aria-hidden="true" />
          <span className="eyebrow">Final goal</span>
          <h2>Explore outward to inward—and understand the evidence at every stop.</h2>
          <p>
            The completed vision is a continually updated, internationally representative atlas
            where people can move from cosmic structure to galaxies, star systems, worlds,
            landscapes, missions, and recorded human or robotic viewpoints without losing the
            science, uncertainty, history, or source behind what they see.
          </p>
          <div><Sparkles size={17} aria-hidden="true" /> This page reports direction, not a claim that the product is finished.</div>
        </section>
      </main>
    </div>
  );
}
