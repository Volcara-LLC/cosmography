"use client";

import { Footprints, Orbit, Rocket, Telescope } from "lucide-react";

import { missionBoardEntries } from "@/app/data/missions/mission-board";

import styles from "@/app/components/atlas/AtlasDomainOverview.module.css";

export type AtlasOverviewSection = "systems" | "missions";

type AtlasDomainOverviewProps = {
  section: AtlasOverviewSection;
  onSelectEntity: (entityId: string) => void;
};

const missionDestinations = [
  {
    id: "perseverance",
    entityId: "mars",
    scale: "Mars surface",
    truth: "Recorded imagery + bounded reconstruction",
    icon: Footprints,
  },
  {
    id: "apollo-17",
    entityId: "apollo-17",
    scale: "Moon surface",
    truth: "Historical photography + traverse records",
    icon: Footprints,
  },
  {
    id: "voyager-1",
    entityId: "voyager-1",
    scale: "Solar → interstellar",
    truth: "Observed encounters + derived trajectory",
    icon: Rocket,
  },
  {
    id: "jwst",
    entityId: "jwst-deep-fields",
    scale: "Deep observation",
    truth: "Calibrated pixels; mission overview planned",
    icon: Telescope,
  },
] as const;

export function AtlasDomainOverview({
  section,
  onSelectEntity,
}: AtlasDomainOverviewProps) {
  if (section === "systems") {
    return (
      <section className={`${styles.overview} ${styles.systems}`} aria-labelledby="systems-overview-title">
        <div className={styles.heading}>
          <span>Star Systems · foundation index</span>
          <h1 id="systems-overview-title">Choose a planetary system</h1>
          <p>Two systems are indexed in this release. Their display spacing is schematic—not astrometry or catalog completeness.</p>
        </div>
        <div className={styles.systemMap} aria-label="Indexed star systems">
          <span className={styles.systemGuide} aria-hidden="true" />
          <button
            type="button"
            className={`${styles.systemNode} ${styles.solNode}`}
            onClick={() => onSelectEntity("solar-system")}
          >
            <span className={styles.star} aria-hidden="true" />
            <strong>Solar System</strong>
            <small>Sun · 8 planets · home system</small>
            <em>Open system →</em>
          </button>
          <button
            type="button"
            className={`${styles.systemNode} ${styles.trappistNode}`}
            onClick={() => onSelectEntity("trappist-1")}
          >
            <span className={styles.star} aria-hidden="true" />
            <strong>TRAPPIST-1</strong>
            <small>Ultracool dwarf · 7 known planets</small>
            <em>Open system record →</em>
          </button>
        </div>
        <p className={styles.releaseNote}>More systems require reviewed catalog identities, coordinates, source releases, and representation rules before they appear here.</p>
      </section>
    );
  }

  const planned = missionBoardEntries.filter(
    (mission) =>
      mission.state === "overview-planned" &&
      !missionDestinations.some((destination) => destination.id === mission.id),
  );

  return (
    <section className={`${styles.overview} ${styles.missions}`} aria-labelledby="missions-overview-title">
      <div className={styles.heading}>
        <span>Missions · multi-scale journey board</span>
        <h1 id="missions-overview-title">Follow evidence across different scales</h1>
        <p>Each path opens at the scale where its evidence is meaningful. Truth types remain visible instead of being flattened into one kind of map.</p>
      </div>
      <div className={styles.missionMap} aria-label="Available mission and observation paths">
        <span className={styles.missionGuide} aria-hidden="true" />
        {missionDestinations.map((destination) => {
          const mission = missionBoardEntries.find((entry) => entry.id === destination.id);
          if (!mission) return null;
          const Icon = destination.icon;
          const observationOnly = destination.id === "jwst";
          return (
            <button
              type="button"
              className={styles.missionNode}
              data-observation={observationOnly || undefined}
              key={destination.id}
              onClick={() => onSelectEntity(destination.entityId)}
            >
              <span className={styles.missionIcon} aria-hidden="true"><Icon size={20} /></span>
              <small>{destination.scale}</small>
              <strong>{mission.name}</strong>
              <span>{destination.truth}</span>
              <em>{observationOnly ? "Open observation record →" : "Open reviewed route →"}</em>
            </button>
          );
        })}
      </div>
      <details className={styles.planned}>
        <summary>
          <Orbit size={15} aria-hidden="true" />
          <span>{planned.length} mission overviews planned</span>
        </summary>
        <div>
          <p>{planned.map((mission) => mission.name).join(" · ")}</p>
          <small>Visible roadmap gaps · dedicated atlas routes are not available yet</small>
        </div>
      </details>
    </section>
  );
}
