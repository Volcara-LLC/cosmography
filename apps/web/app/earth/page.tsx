import type { Metadata } from "next";
import { AlertTriangle, Database, Globe2, ShieldCheck } from "lucide-react";
import { DirectoryHeader } from "@/app/components/navigation/DirectoryHeader";
import { EarthNetworkExplorer } from "@/app/components/earth/EarthNetworkExplorer";
import { EvidenceCoverageCard } from "@/app/components/evidence/EvidenceCoverageCard";
import styles from "@/app/components/earth/EarthNetwork.module.css";
import { earthNetwork } from "@/app/data/earth";
import {
  FOUNDATION_COVERAGE_PACK_IDS,
  FOUNDATION_RELEASE_ID,
  getReleaseCoveragePack,
  releaseCoveragePackApiPath,
} from "@/app/lib/releases/coverage";

export const metadata: Metadata = {
  title: "Earth Exploration Network",
  description:
    "An evidence-aware international map of launch sites, mission control, tracking networks, observatories, agency centers, and public space-history locations.",
};

const regionCount = new Set(earthNetwork.sites.map((site) => site.region)).size;
const countryCount = new Set(earthNetwork.sites.map((site) => site.country)).size;
const organizationCount = new Set(
  earthNetwork.sites.flatMap((site) => site.organizations.map((item) => item.organizationId)),
).size;

export default function EarthNetworkPage() {
  const packId = FOUNDATION_COVERAGE_PACK_IDS["earth-network"];
  const coveragePack = getReleaseCoveragePack(FOUNDATION_RELEASE_ID, packId);
  if (!coveragePack) {
    throw new Error("The exact-release Earth network coverage pack is unavailable");
  }

  return (
    <div className={`${styles.page} earth-network-page`}>
      <DirectoryHeader />
      <main className={`${styles.main} earth-network-main`}>
        <section className={`${styles.hero} earth-network-hero`}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Earth layer · {earthNetwork.releaseId}</span>
            <h1>The universe begins with a network on Earth.</h1>
            <p>
              Launch ranges, control rooms, tracking dishes, observatories, engineering centers,
              archives, and museums form one planetary instrument. This first international seed
              makes that instrument explorable without pretending the inventory is complete.
            </p>
            <div className={styles.heroNotice}>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                Every marker states whether it is an official coordinate, an address centroid, or a
                deliberately coarse regional point. Operational and restricted sites are not
                navigation targets.
              </span>
            </div>
          </div>

          <div className={styles.heroGlobe} aria-hidden="true">
            <div className={styles.globeOrb}>
              <i /><i /><i /><i /><i /><i />
            </div>
            <span>Earth / source-datum context</span>
          </div>
        </section>

        <section className={`${styles.statRail} earth-network-stats`} aria-label="Seed coverage summary">
          <div><strong>{earthNetwork.sites.length}</strong><span>representative sites</span></div>
          <div><strong>{countryCount}</strong><span>countries / territories</span></div>
          <div><strong>{regionCount}</strong><span>inhabited regions</span></div>
          <div><strong>{organizationCount}</strong><span>participating organizations</span></div>
          <div><strong>{earthNetwork.sources.length}</strong><span>official source records</span></div>
        </section>

        <div className={styles.explorer}>
          <EvidenceCoverageCard
            apiHref={releaseCoveragePackApiPath(FOUNDATION_RELEASE_ID, packId)}
            pack={coveragePack}
          />
        </div>

        <EarthNetworkExplorer
          sites={earthNetwork.sites}
          organizations={earthNetwork.organizations}
          sources={earthNetwork.sources}
        />

        <section className={`${styles.gapsSection} earth-network-coverage-gaps`} aria-labelledby="earth-gaps-title">
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>Coverage-gaps ledger</span>
              <h2 id="earth-gaps-title">What the map does not know yet.</h2>
            </div>
            <p>
              Missing evidence is product data. These gaps travel with the release so a sparse
              region, a coarse point, or a missing institution cannot quietly become false certainty.
            </p>
          </div>

          <div className={styles.gapGrid}>
            {earthNetwork.gaps.map((gap, index) => (
              <article key={gap.id} className={styles.gapCard} data-severity={gap.severity}>
                <div className={styles.gapHeading}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{gap.severity}</span>
                </div>
                <h3>{gap.scope}</h3>
                <p>{gap.gap}</p>
                <dl>
                  <div><dt>Guardrail now</dt><dd>{gap.safeguard}</dd></div>
                  <div><dt>Evidence needed</dt><dd>{gap.nextEvidence}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.sourceSection} earth-network-source-register`} aria-labelledby="earth-sources-title">
          <div className={styles.sourceIntro}>
            <span className={styles.eyebrow}>Rights-separated source register</span>
            <h2 id="earth-sources-title">Official facts are not a blanket media licence.</h2>
            <p>
              Cosmography cites facility identity and public factual metadata. Images, video, logos,
              map tiles, live feeds, and downloadable science data remain outside this seed until
              their own licence, credit, derivative-use, redistribution, and offline terms are stored.
            </p>
            <div className={styles.sourcePrinciples}>
              <span><Database size={15} aria-hidden="true" /> Release-pinned facts</span>
              <span><Globe2 size={15} aria-hidden="true" /> Datum + uncertainty</span>
              <span><AlertTriangle size={15} aria-hidden="true" /> Asset-level rights</span>
            </div>
          </div>

          <details className={styles.sourceRegister}>
            <summary>Inspect {earthNetwork.sources.length} official source records</summary>
            <div>
              {earthNetwork.sources.map((source) => (
                <article key={source.id}>
                  <small>{source.publisher} · {source.authority.replaceAll("-", " ")} · {source.language}</small>
                  <h3>{source.title}</h3>
                  <p>{source.scope}</p>
                  <span>{source.rightsStatus.replaceAll("-", " ")} · retrieved {source.retrievedAt}</span>
                  <a href={source.url} target="_blank" rel="noreferrer">Open official source</a>
                </article>
              ))}
            </div>
          </details>
        </section>
      </main>
    </div>
  );
}
