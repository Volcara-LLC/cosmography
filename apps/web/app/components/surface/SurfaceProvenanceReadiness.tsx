import type { CoveragePack } from "@cosmography/scientific-model/coverage-pack";
import type { SurfacePreIngestLedger } from "@cosmography/scientific-model/surface-provenance";

import { EvidenceCoverageCard } from "@/app/components/evidence/EvidenceCoverageCard";

type SurfaceProvenanceReadinessProps = {
  readonly coveragePack: CoveragePack;
  readonly coverageApiHref: string;
  readonly ledger: SurfacePreIngestLedger;
  readonly title: string;
};

export function SurfaceProvenanceReadiness({
  coveragePack,
  coverageApiHref,
  ledger,
  title,
}: SurfaceProvenanceReadinessProps) {
  const productCount = ledger.productRequirements.length;

  return (
    <div className="surface-readiness">
      <EvidenceCoverageCard pack={coveragePack} apiHref={coverageApiHref} />

      <section
        className="surface-readiness__products"
        aria-labelledby={`${ledger.experienceId}-readiness-title`}
      >
        <div className="surface-section-heading surface-section-heading--wide">
          <div>
            <p className="surface-control-label">Pre-ingest product detail</p>
            <h2 id={`${ledger.experienceId}-readiness-title`}>{title}</h2>
          </div>
          <p>
            These records describe what must be acquired and verified. They are not
            artifact manifests, runtime tokens, or scene-placement authority.
          </p>
        </div>

        <aside className="surface-readiness__boundary" role="note">
          <strong>Fail-closed runtime boundary</strong>
          <span>
            A serialized reference or reviewed manifest cannot authorize rendering.
            An in-process reviewed-selection capability must first bind the exact
            product and use; retained bytes and the passed validation report then
            require exact parsed receipts. Recorded-view placement remains a
            separate camera-context gate.
          </span>
        </aside>

        <details className="surface-readiness__requirements">
          <summary>Inspect {productCount} blocked product requirements</summary>
          <ul>
            {ledger.productRequirements.map((requirement) => (
              <li key={requirement.requirementId}>
                <div>
                  <strong>{requirement.title}</strong>
                  <span>{requirement.productKind.replaceAll("-", " ")}</span>
                </div>
                <small>
                  Reference only · {requirement.productIdentity.state === "selection-pending"
                    ? "exact product selection pending"
                    : "record identified; artifacts unreviewed"}
                </small>
                <p>{requirement.blockedReasons[0]}</p>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
