import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CircleDot, Database } from "lucide-react";
import { DirectoryHeader } from "@/app/components/navigation/DirectoryHeader";
import { atlasEntities, atlasRelease } from "@/app/data/atlas";
import { atlasScientificPresentationFor } from "@/app/lib/presentation/atlas-scientific-labels";

export const metadata: Metadata = {
  title: "Structured Universe Atlas",
  description:
    "A keyboard- and screen-reader-friendly directory of the current Cosmography universe atlas.",
};

export default function AtlasDirectoryPage() {
  return (
    <div className="directory-page">
      <DirectoryHeader />
      <main className="directory-main">
        <section className="directory-hero">
          <span className="eyebrow">Structured atlas · {atlasRelease.id}</span>
          <h1>The universe, readable at every scale.</h1>
          <p>
            This text-first view mirrors the interactive map. Every named destination in the
            foundation atlas has an evidence class, coordinate context, display treatment, and
            release-pinned source record.
          </p>
          <div className="directory-notice">
            <CircleDot size={18} aria-hidden="true" />
            <span>
              Cosmography does not treat a simulated particle as a discovered object, a telescope
              image as literal three-dimensional terrain, or fictional warp travel as physics.
            </span>
          </div>
        </section>

        <section className="atlas-directory-grid" aria-label="Atlas destinations">
          {atlasEntities.map((entity) => {
            const presentation = atlasScientificPresentationFor(entity);

            return (
              <article
                className="directory-card"
                key={entity.id}
                style={{ "--entity-color": entity.color } as CSSProperties}
              >
                <small>{entity.section} · {presentation.classification}</small>
                <h2>{presentation.name}</h2>
                <p>{entity.summary}</p>
                <div className="directory-card-footer">
                  <span>{entity.representation.evidence.replaceAll("-", " ")}</span>
                  <Link href={`/?focus=${entity.slug}`}>
                    Open map <ArrowUpRight size={13} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        <section className="directory-section">
          <span className="eyebrow">Publication contract</span>
          <h2>Nothing appears without a label.</h2>
          <p>
            Public visual layers must declare evidence, time state, appearance, geometry, AI
            involvement, processing lineage, uncertainty, rights, and credit. Release manifests are
            immutable; activating or rolling back an atlas changes one release pointer rather than
            silently mutating history.
          </p>
          <Link className="primary-action" href="/sources">
            <Database size={16} aria-hidden="true" />
            Inspect the source registry
          </Link>
        </section>
      </main>
    </div>
  );
}
