import type { Metadata } from "next";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { DirectoryHeader } from "@/app/components/navigation/DirectoryHeader";
import { atlasRelease, sources } from "@/app/data/atlas";

export const metadata: Metadata = {
  title: "Scientific Sources & Provenance",
  description: "The official archives and publication rules behind Cosmography.",
};

export default function SourcesPage() {
  return (
    <div className="directory-page">
      <DirectoryHeader />
      <main className="directory-main">
        <section className="directory-hero">
          <span className="eyebrow">Evidence ledger · {atlasRelease.id}</span>
          <h1>See where every world comes from.</h1>
          <p>
            Cosmography preserves source identity, release, retrieval date, processing lineage,
            rights, coordinate frame, epoch, and uncertainty. These official services seed the
            broad atlas; detailed connectors are frozen into reproducible releases before display.
          </p>
          <div className="directory-notice">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              “Publicly visible” does not automatically mean reusable. Assets remain link-only until
              their licensing, attribution, derivatives, redistribution, and offline rights pass a
              source-specific review.
            </span>
          </div>
        </section>

        <section className="source-grid" aria-label="Official data sources">
          {Object.values(sources).map((source) => (
            <article className="source-card" key={source.id}>
              <small>{source.publisher} · {source.licenseStatus.replaceAll("-", " ")}</small>
              <h2>{source.title}</h2>
              <p>
                Release context: {source.release}. Retrieved {source.retrievedAt}. Required credit:
                {" "}{source.credit}.
              </p>
              <a href={source.url} target="_blank" rel="noreferrer">
                Open official service <ExternalLink size={13} aria-hidden="true" />
              </a>
            </article>
          ))}
        </section>

        <section className="directory-section">
          <span className="eyebrow">Storage boundary</span>
          <h2>An atlas index—not a lossy science warehouse.</h2>
          <p>
            Curated metadata, navigation, rights decisions, releases, and user state belong in the
            transactional control plane. Large catalogs, kernels, imagery, terrain, panoramas,
            video, meshes, and validation reports remain immutable objects or live behind
            specialized geometry and columnar services. Exact scientific values retain their source
            text and time scale instead of being reduced to browser numbers and dates.
          </p>
        </section>
      </main>
    </div>
  );
}
