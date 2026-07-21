import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, Satellite } from "lucide-react";
import { DirectoryHeader } from "@/app/components/navigation/DirectoryHeader";
import { missionAgencies } from "@/app/data/atlas";
import { missionBoardEntries } from "@/app/data/missions/mission-board";

export const metadata: Metadata = {
  title: "International Mission Atlas",
  description:
    "The international agencies and organizations represented in Cosmography's mission model.",
};

export default function MissionsPage() {
  return (
    <div className="directory-page">
      <DirectoryHeader />
      <main className="directory-main">
        <section className="directory-hero">
          <span className="eyebrow">International exploration registry</span>
          <h1>Every mission belongs to its whole story.</h1>
          <p>
            Missions are many-to-many histories: agencies, predecessor programs, universities,
            instruments, launch providers, tracking networks, international partners, and archives
            can all have distinct roles. The model has no default country and no NASA-only ownership
            field.
          </p>
          <div className="directory-notice">
            <Satellite size={18} aria-hidden="true" />
            <span>
              “Indexed” means a foundation connector is present. “Connector planned” and “rights
              review” are visible gaps—not claims that coverage is already complete.
            </span>
          </div>
        </section>

        <section className="directory-section" aria-labelledby="reference-journey-title">
          <span className="eyebrow">Reference journey · available now</span>
          <h2 id="reference-journey-title">Follow Voyager 1 from Earth to interstellar space.</h2>
          <p>
            Replay ten source-anchored chapters with dated instrument states, image-capture
            context, and a frozen JPL Horizons trajectory solution. Every position states its
            reference frame, epoch, and whether it is an observation, reconstruction, or
            prediction.
          </p>
          <Link className="primary-action" href="/missions/voyager-1">
            Open Voyager 1 journey
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>

        <section className="directory-section" aria-labelledby="mission-board-title">
          <span className="eyebrow">Mission board · truthful route state</span>
          <h2 id="mission-board-title">Available journeys and the next evidence-backed records.</h2>
          <p>
            An available route opens a reviewed experience in this release. Planned overview
            cards are intentionally non-clickable until their dedicated records and evidence
            manifests are admitted.
          </p>
          <div className="agency-grid" aria-label="Mission route board">
            {missionBoardEntries.map((mission) => (
              <article className="agency-card" key={mission.id}>
                <small>{mission.state === "available" ? "Route available" : "Overview planned · no route yet"}</small>
                <h2>{mission.name}</h2>
                <p>{mission.scope}</p>
                {mission.route ? (
                  <Link href={mission.route}>Open reviewed route <ArrowRight size={13} aria-hidden="true" /></Link>
                ) : (
                  <span aria-disabled="true">Dedicated experience not admitted in this release</span>
                )}
                <a href={mission.sourceUrl} target="_blank" rel="noreferrer">
                  Official mission source <ExternalLink size={13} aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="agency-grid" aria-label="Mission organizations">
          {missionAgencies.map((agency) => (
            <article className="agency-card" key={agency.id}>
              <small>{agency.countryOrRegion} · {agency.status.replaceAll("-", " ")}</small>
              <h2>{agency.name}</h2>
              <p>{agency.scope}</p>
              <a href={agency.sourceUrl} target="_blank" rel="noreferrer">
                Official organization <ExternalLink size={13} aria-hidden="true" />
              </a>
            </article>
          ))}
        </section>

        <section className="directory-section">
          <span className="eyebrow">Next registry expansion</span>
          <h2>From launches to living trajectories.</h2>
          <p>
            The production registry will connect UNOOSA object registrations, agency catalogs,
            archives, mission event timelines, versioned SPICE kernels, tracking products, imagery,
            instruments, facilities, and publications. “Current position” will always identify the
            epoch, frame, source, and whether it is telemetry, an ephemeris, interpolation, or a
            published prediction.
          </p>
        </section>
      </main>
    </div>
  );
}
