import type {
  CoverageDimensionState,
  CoveragePack,
} from "@cosmography/scientific-model/coverage-pack";

import styles from "./EvidenceCoverageCard.module.css";

type EvidenceCoverageCardProps = {
  readonly pack: CoveragePack;
  readonly apiHref: string;
};

const dimensionStateLabels: Readonly<Record<CoverageDimensionState, string>> = {
  "out-of-scope": "Out of scope",
  absent: "Absent",
  "reference-records-only": "Reference records only",
  "frozen-records-only": "Frozen records only",
  "validated-artifact-evidence": "Validated artifact evidence",
};

function metricValue(value: number, total?: number) {
  return total === undefined ? value.toLocaleString("en-US") : `${value.toLocaleString("en-US")} / ${total.toLocaleString("en-US")}`;
}

export function EvidenceCoverageCard({
  pack,
  apiHref,
}: EvidenceCoverageCardProps) {
  const titleId = `coverage-${pack.coverageKey}-title`;
  const detailId = `coverage-${pack.coverageKey}-detail`;

  return (
    <section
      className={styles.card}
      aria-labelledby={titleId}
      data-coverage-pack={pack.packId}
      data-coverage-key={pack.coverageKey}
      data-coverage-release-id={pack.releaseBinding.releaseId}
      data-coverage-state={pack.state}
      data-source-authenticity-established={String(pack.sourceAuthenticityEstablished)}
      data-scientific-validation-established={String(pack.scientificValidationEstablished)}
      data-independent-validation-established={String(pack.independentValidationEstablished)}
      data-completeness-established={String(pack.completenessEstablished)}
      data-rights-clearance-established={String(pack.rightsClearanceEstablished)}
      data-runtime-use-allowed={String(pack.runtimeUseAllowed)}
      data-render-allowed={String(pack.renderAllowed)}
      data-publication-allowed={String(pack.publicationAllowed)}
      data-release-eligible={String(pack.releaseEligible)}
      data-activation-allowed={String(pack.activationAllowed)}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>
            Coverage Pack v{pack.schemaVersion} · exact release {pack.releaseBinding.releaseId} · snapshot{" "}
            <time dateTime={pack.generatedAt}>{pack.generatedAt}</time>
          </p>
          <h2 id={titleId}>{pack.title}</h2>
        </div>
        <span className={styles.state}>Non-authoritative · release ineligible</span>
      </header>

      <p className={styles.summary}>{pack.summary}</p>

      <aside className={styles.boundary} role="note">
        <strong>Coverage boundary</strong>
        <span>
          This release-scoped summary does not establish completeness, rights clearance,
          scientific or independent validation, render authority, publication authority, or
          release eligibility.
        </span>
      </aside>

      <dl className={styles.metrics} aria-label={`${pack.title} record counts`}>
        {pack.counts.map((count) => (
          <div key={count.countId} data-coverage-count={count.countId}>
            <dt>{count.label}</dt>
            <dd>
              <strong>{metricValue(count.value, count.total)}</strong>
              <span>{count.unit}</span>
              <small>{count.basis}</small>
            </dd>
          </div>
        ))}
      </dl>

      <div className={styles.dimensionSection}>
        <h3>Evidence dimensions</h3>
        <dl className={styles.dimensions} aria-label={`${pack.title} evidence dimensions`}>
          {pack.dimensions.map((dimension) => (
            <div
              key={dimension.dimensionId}
              data-coverage-dimension={dimension.dimensionId}
              data-coverage-status={dimension.status}
            >
              <dt>
                <span aria-hidden="true">{String(dimension.ordinal).padStart(2, "0")}</span>
                {dimension.label}
              </dt>
              <dd>
                <strong>{dimensionStateLabels[dimension.status]}</strong>
                <p>{dimension.summary}</p>
                <small>{dimension.scopeBoundary}</small>
                <span className={styles.bindingCount}>
                  {dimension.sourceBindingIds.length} source bindings · {dimension.sourceReferenceIds.length} source references · {dimension.knownGapIds.length} known gaps
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <details className={styles.details} id={detailId}>
        <summary>Inspect bindings, gaps, next evidence, and correction lineage</summary>
        <div className={styles.detailGrid}>
          <section aria-labelledby={`${detailId}-references`}>
            <h3 id={`${detailId}-references`}>Source bindings</h3>
            <p>
              {pack.sourceBindings.length} exact frozen source bindings retain {pack.sourceReferenceIds.length} referenced record identifiers.
            </p>
            <ul className={styles.bindingList}>
              {pack.sourceBindings.map((binding) => (
                <li key={binding.bindingId}>
                  <div className={styles.bindingHeading}>
                    <strong>{binding.recordId}</strong>
                    <code>{binding.bindingId}</code>
                  </div>
                  <dl>
                    <div>
                      <dt>Kind</dt>
                      <dd>{binding.kind.replaceAll("-", " ")}</dd>
                    </div>
                    <div>
                      <dt>Repository location</dt>
                      <dd>
                        <code>
                          {binding.repositoryPath}
                          {binding.kind === "repository-record" ? `#${binding.exportName}` : ""}
                        </code>
                      </dd>
                    </div>
                    {binding.kind === "retained-artifact" ? (
                      <div>
                        <dt>Retained bytes</dt>
                        <dd>{binding.byteLength.toLocaleString("en-US")}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Immutable version</dt>
                      <dd><code>{binding.version}</code></dd>
                    </div>
                    <div>
                      <dt>Canonicalization</dt>
                      <dd><code>{binding.canonicalization}</code></dd>
                    </div>
                    <div>
                      <dt>Bound references</dt>
                      <dd>{binding.referenceRecordIds.length.toLocaleString("en-US")}</dd>
                    </div>
                    <div>
                      <dt>Frozen at</dt>
                      <dd><time dateTime={binding.frozenAt}>{binding.frozenAt}</time></dd>
                    </div>
                    <div>
                      <dt>SHA-256</dt>
                      <dd><code>{binding.sha256}</code></dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <h4 className={styles.subheading}>Bound source-reference IDs</h4>
            <ul className={styles.identifierList}>
              {pack.sourceReferenceIds.map((referenceId) => (
                <li key={referenceId}><code>{referenceId}</code></li>
              ))}
            </ul>
          </section>

          <section aria-labelledby={`${detailId}-gaps`}>
            <h3 id={`${detailId}-gaps`}>Known gaps</h3>
            <ol className={styles.gapList}>
              {pack.knownGaps.map((gap) => (
                <li key={gap.gapId} data-gap-severity={gap.severity}>
                  <div>
                    <span>{gap.dimensionIds.map((dimensionId) => dimensionId.replaceAll("-", " ")).join(" · ")}</span>
                    <strong>{gap.severity}</strong>
                  </div>
                  <p>{gap.summary}</p>
                  <small><b>Current safeguard:</b> {gap.safeguard}</small>
                  <small><b>Pending evidence links:</b> {gap.nextEvidenceRequirementIds.length}</small>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby={`${detailId}-next`}>
            <h3 id={`${detailId}-next`}>Next evidence requirements</h3>
            <ul className={styles.requirementList}>
              {pack.nextEvidenceRequirements.map((requirement) => (
                <li key={requirement.requirementId}>
                  <strong>{requirement.title}</strong>
                  <span>{requirement.detail}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby={`${detailId}-corrections`}>
            <h3 id={`${detailId}-corrections`}>Correction lineage</h3>
            {pack.correctionLineage.kind === "initial-release-snapshot" ? (
              <p>
                Revision {pack.correctionLineage.revision}. This exact-release snapshot does not supersede an earlier coverage pack.
              </p>
            ) : (
              <div className={styles.correctionRecord}>
                <p>
                  Revision {pack.correctionLineage.revision} declares it supersedes <code>{pack.correctionLineage.previous.packId}</code> from exact release {pack.correctionLineage.previous.releaseId}. This card does not itself verify the predecessor pair.
                </p>
                <time dateTime={pack.correctionLineage.issuedAt}>{pack.correctionLineage.issuedAt}</time>
                <span>{pack.correctionLineage.reason}</span>
              </div>
            )}
          </section>
        </div>
      </details>

      <footer className={styles.footer}>
        <a href={apiHref}>Open exact-release coverage record</a>
        <span>
          Canonical digest
          <code>{pack.packSha256}</code>
        </span>
        <span>
          ETag
          <code>{pack.etag}</code>
        </span>
      </footer>
    </section>
  );
}
