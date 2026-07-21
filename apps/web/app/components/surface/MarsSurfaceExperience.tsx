"use client";

import type { CoveragePack } from "@cosmography/scientific-model/coverage-pack";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { MarsGlobeExplorer } from "@/app/components/surface/MarsGlobeExplorer";
import { RecordedPanoramaViewer } from "@/app/components/surface/RecordedPanoramaViewer";
import { SurfaceProvenanceReadiness } from "@/app/components/surface/SurfaceProvenanceReadiness";
import shellStyles from "@/app/components/surface/SurfaceShell.module.css";
import { marsJezeroPreIngestLedger } from "@/app/data/surface/mars-jezero-provenance";
import { jezeroRecordedPanorama } from "@/app/data/surface/jezero-recorded-panorama";
import {
  evidenceIsVisible,
  marsJezeroSurface,
  moonApollo17Surface,
  type SurfaceCoverageClass,
  type SurfaceEvidenceKind,
  type SurfaceStageId,
  type SurfaceViewMode,
} from "@/app/data/surface/surface-fixtures";

const modeCopy: Record<
  SurfaceViewMode,
  { label: string; shortLabel: string; description: string }
> = {
  original: {
    label: "Observation products",
    shortLabel: "Observed",
    description:
      "Shows only observed imagery and recorded camera products. One exact Sol 4 JPL presentation derivative renders at its matching node; other declared products remain unloaded.",
  },
  reconstruction: {
    label: "Scientific reconstruction contract",
    shortLabel: "Reconstruction",
    description:
      "Selects documented stereo terrain, rover meshes, and release-pinned localization for future validated ingest; none is loaded yet.",
  },
  immersive: {
    label: "Immersive display plan",
    shortLabel: "Immersive",
    description:
      "Declares visibly labeled gap interpolation, atmosphere, lighting, and comfortable transitions for a future derivative render.",
  },
};

const evidenceKindLabels: Record<SurfaceEvidenceKind, string> = {
  "observed-terrain": "Observed terrain",
  "captured-panorama": "Captured panorama",
  "scientific-reconstruction": "Scientific reconstruction",
  interpolation: "Interpolation",
  "immersive-display": "Immersive display",
};

const coverageLegend: readonly {
  id: SurfaceCoverageClass;
  label: string;
  meaning: string;
}[] = [
  {
    id: "measured-orbital",
    label: "Measured orbital",
    meaning: "Observed pixels or measurements from orbit",
  },
  {
    id: "reconstructed-local",
    label: "Reconstructed geometry",
    meaning: "Stereo, localization, or registered mission products",
  },
  {
    id: "recorded-view",
    label: "Recorded view",
    meaning: "A camera captured pixels from this station",
  },
  {
    id: "interpolated-gap",
    label: "Interpolated gap",
    meaning: "Display continuity without a direct camera record",
  },
  {
    id: "unmapped",
    label: "Unmapped / unresolved",
    meaning: "No detail is invented to conceal missing evidence",
  },
];

type MarsCaptureNode = (typeof marsJezeroSurface.captureNodes)[number];

function sourceFor(id: string) {
  return marsJezeroSurface.sources.find((source) => source.id === id);
}

type MarsSurfaceExperienceProps = {
  readonly coverageApiHref: string;
  readonly coveragePack: CoveragePack;
  readonly initialRecordedView?: boolean;
};

export function MarsSurfaceExperience({
  coverageApiHref,
  coveragePack,
  initialRecordedView = false,
}: MarsSurfaceExperienceProps) {
  const [stageId, setStageId] = useState<SurfaceStageId>(
    initialRecordedView ? "recorded-view" : "orbit",
  );
  const [mode, setMode] = useState<SurfaceViewMode>(
    initialRecordedView ? "original" : "reconstruction",
  );
  const [captureNodeId, setCaptureNodeId] = useState<string>(
    initialRecordedView
      ? jezeroRecordedPanorama.captureNodeId
      : marsJezeroSurface.captureNodes[0].id,
  );
  const [evidenceExpanded, setEvidenceExpanded] = useState(true);
  const [immersivePanoramaOpen, setImmersivePanoramaOpen] = useState(initialRecordedView);
  const immersiveCloseRef = useRef<HTMLButtonElement>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!immersivePanoramaOpen) return;
    priorFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => immersiveCloseRef.current?.focus());
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setImmersivePanoramaOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      priorFocusRef.current?.focus();
    };
  }, [immersivePanoramaOpen]);

  const stageIndex = marsJezeroSurface.stages.findIndex(
    (candidate) => candidate.id === stageId,
  );
  const stage = marsJezeroSurface.stages[stageIndex];

  const visibleEvidence = useMemo(() => {
    const stageEvidenceIds = new Set<string>(stage.evidenceIds);
    return marsJezeroSurface.evidence.filter(
      (item) => stageEvidenceIds.has(item.id) && evidenceIsVisible(item, mode),
    );
  }, [mode, stage]);

  const activeCaptureNode =
    marsJezeroSurface.captureNodes.find(
      (node) => node.id === captureNodeId,
    ) ?? marsJezeroSurface.captureNodes[0];
  const activeCaptureContext = marsJezeroPreIngestLedger.captureContexts.find(
    (context) => context.captureNodeId === activeCaptureNode.id,
  );
  const activeRecordedPanorama =
    activeCaptureNode.id === jezeroRecordedPanorama.captureNodeId
      ? jezeroRecordedPanorama
      : null;
  const renderedPanorama =
    stageId === "recorded-view" && !immersivePanoramaOpen ? activeRecordedPanorama : null;

  const activeSourceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of visibleEvidence) {
      for (const sourceId of item.sourceIds) ids.add(sourceId);
    }
    if (stageId === "recorded-view") {
      for (const sourceId of activeCaptureNode.sourceIds) ids.add(sourceId);
    }
    return [...ids];
  }, [activeCaptureNode, stageId, visibleEvidence]);

  const setStage = (nextStage: SurfaceStageId) => {
    setStageId(nextStage);
  };

  const moveStage = (direction: -1 | 1) => {
    const nextIndex = Math.min(
      marsJezeroSurface.stages.length - 1,
      Math.max(0, stageIndex + direction),
    );
    setStageId(marsJezeroSurface.stages[nextIndex].id);
  };

  const selectCaptureNode = (node: MarsCaptureNode) => {
    setCaptureNodeId(node.id);
    setStageId("recorded-view");
  };

  const enterRecordedSurfaceView = () => {
    setCaptureNodeId(jezeroRecordedPanorama.captureNodeId);
    setStageId("recorded-view");
    setMode("original");
    setImmersivePanoramaOpen(true);
  };

  return (
    <main className={`${shellStyles.shell} surface-experience surface-experience--${mode}`}>
      <a className="surface-skip-link" href="#surface-evidence">
        Skip to evidence details
      </a>

      <header className="surface-header">
        <div className="surface-header__identity">
          <Link className="surface-back-link" href="/">
            <span aria-hidden="true">←</span> Observable Universe
          </Link>
          <p className="surface-eyebrow">Scientific surface reference · 0.1</p>
          <h1>Mars — Jezero Crater</h1>
          <p>
            Descend from orbit to places Perseverance actually recorded. Every
            transition says what is observed, reconstructed, interpolated, or
            presented for immersion.
          </p>
        </div>

        <div className="surface-header__readout" aria-label="Current view">
          <span>Region anchor · 18.4°N · 77.5°E</span>
          <strong>{stage.shortLabel}</strong>
          <span>{modeCopy[mode].shortLabel} mode</span>
        </div>
      </header>

      <MarsGlobeExplorer onEnterSurface={enterRecordedSurfaceView} />

      {immersivePanoramaOpen ? (
        <div
          className={shellStyles.immersivePanoramaDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="immersive-panorama-title"
        >
          <div className={shellStyles.immersivePanoramaHeader}>
            <div>
              <p>Observed · recorded presentation derivative</p>
              <h2 id="immersive-panorama-title">Perseverance rover views · Sols 3–474</h2>
              <span>Jezero Crater · three discrete recorded panoramas plus landing detail · physical poses withheld</span>
            </div>
            <button
              ref={immersiveCloseRef}
              type="button"
              onClick={() => setImmersivePanoramaOpen(false)}
            >
              Back to Mars <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className={shellStyles.immersivePanoramaStage}>
            <RecordedPanoramaViewer />
          </div>
          <footer className={shellStyles.immersivePanoramaFooter}>
            <span>NASA/JPL-Caltech/MSSS/ASU</span>
            <span>
              Three recorded 360° horizontal mosaics and one landing-site detail derivative
              retained · discrete stations with bounded vertical coverage · not a continuous rover route
            </span>
          </footer>
        </div>
      ) : null}

      <aside className="surface-render-boundary" role="note">
        <strong>Current render boundary</strong>
        <span>
          Terrain remains a procedural interface preview. Exact JPL-published Sol 3 and Sol 4
          presentation derivatives provide one 360° horizontal look-around and one detail view;
          no PDS terrain, source-frame set, solved camera pose, or continuous route is implied.
        </span>
      </aside>

      <SurfaceProvenanceReadiness
        coverageApiHref={coverageApiHref}
        coveragePack={coveragePack}
        ledger={marsJezeroPreIngestLedger}
        title="Jezero products are declared, not admitted"
      />

      <section className="surface-mode-bar" aria-labelledby="surface-mode-title">
        <div>
          <p className="surface-control-label" id="surface-mode-title">
            Representation
          </p>
          <p className="surface-mode-bar__description">
            {modeCopy[mode].description}
          </p>
        </div>
        <div className="surface-segmented-control" role="group" aria-label="Representation mode">
          {(Object.keys(modeCopy) as SurfaceViewMode[]).map((modeId) => (
            <button
              className="surface-segmented-control__button"
              data-active={mode === modeId}
              key={modeId}
              type="button"
              aria-pressed={mode === modeId}
              onClick={() => setMode(modeId)}
            >
              {modeCopy[modeId].shortLabel}
            </button>
          ))}
        </div>
      </section>

      <nav className="surface-stage-nav" aria-label="Surface descent stages">
        <ol>
          {marsJezeroSurface.stages.map((candidate, index) => (
            <li key={candidate.id}>
              <button
                className="surface-stage-nav__button"
                data-active={candidate.id === stageId}
                type="button"
                aria-current={candidate.id === stageId ? "step" : undefined}
                onClick={() => setStage(candidate.id)}
              >
                <span className="surface-stage-nav__number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{candidate.shortLabel}</strong>
                  <small>{candidate.scale}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="surface-workspace" aria-label="Jezero surface explorer">
        <figure
          className={`surface-viewport surface-viewport--${stage.id} surface-viewport--${mode}`}
          aria-labelledby="surface-viewport-title"
          aria-describedby="surface-viewport-description"
        >
          {renderedPanorama ? (
            <RecordedPanoramaViewer />
          ) : (
            <div className="surface-viewport__scene" aria-hidden="true">
              <>
                <div className="surface-viewport__space-field" />
                <div className="surface-viewport__planet" />
                <div className="surface-viewport__target-ring" />
                <div className="surface-viewport__terrain surface-viewport__terrain--far" />
                <div className="surface-viewport__terrain surface-viewport__terrain--near" />
                <div className="surface-viewport__coverage-mask" />
                <div className="surface-viewport__grid" />
              </>
            </div>
          )}

          <div className="surface-viewport__topline">
            <span className="surface-status-pill" data-mode={mode}>
              {modeCopy[mode].label}
            </span>
            <span>
              {visibleEvidence.length} declared evidence records · {renderedPanorama ? "2 retained presentation derivatives" : "none loaded"}
            </span>
          </div>

          <figcaption className="surface-viewport__caption">
            <p className="surface-control-label">{stage.scale}</p>
            <h2 id="surface-viewport-title">{stage.title}</h2>
            <p id="surface-viewport-description">{stage.summary}</p>
          </figcaption>

          {stageId === "recorded-view" ? (
            <div className="surface-capture-overlay">
              <p className="surface-control-label">Reference station · pose withheld</p>
              <strong>{activeCaptureNode.label}</strong>
              <span>{activeCaptureNode.instrument}</span>
              <span>{activeCaptureNode.missionClock}</span>
              <span>
                {!activeCaptureContext
                  ? "Capture context missing · placement withheld"
                  : activeCaptureContext.coordinate.state === "unresolved"
                    ? "Station position unresolved"
                    : "Approximate region anchor only"}
              </span>
            </div>
          ) : (
            <div className="surface-scale-overlay">
              <span>Target · Jezero</span>
              <span>Resolution changes by layer</span>
            </div>
          )}

          <div className="surface-stage-controls">
            <button
              type="button"
              onClick={() => moveStage(-1)}
              disabled={stageIndex === 0}
            >
              Previous scale
            </button>
            <button
              type="button"
              onClick={() => moveStage(1)}
              disabled={stageIndex === marsJezeroSurface.stages.length - 1}
            >
              Descend closer <span aria-hidden="true">→</span>
            </button>
          </div>
        </figure>

        <aside className="surface-sidecar" aria-label="Surface context">
          <section className="surface-boundary-card">
            <p className="surface-control-label">Scientific boundary</p>
            <p>{stage.boundary}</p>
          </section>

          <section className="surface-resolution-card" aria-labelledby="resolution-title">
            <div className="surface-section-heading">
              <div>
                <p className="surface-control-label">Declared for this view</p>
                <h2 id="resolution-title">Evidence contract &amp; resolution</h2>
              </div>
              <button
                className="surface-text-button"
                type="button"
                aria-expanded={evidenceExpanded}
                aria-controls="surface-evidence-list"
                onClick={() => setEvidenceExpanded((current) => !current)}
              >
                {evidenceExpanded ? "Collapse" : "Inspect"}
              </button>
            </div>

            {evidenceExpanded ? (
              <ul className="surface-evidence-list" id="surface-evidence-list">
                {visibleEvidence.map((item) => (
                  <li key={item.id} data-evidence-kind={item.kind}>
                    <span
                      className="surface-evidence-swatch"
                      data-coverage={item.coverage}
                      aria-hidden="true"
                    />
                    <div>
                      <strong>{item.label}</strong>
                      <span>{evidenceKindLabels[item.kind]}</span>
                      <small>{item.resolution}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="surface-coverage-card" aria-labelledby="coverage-title">
            <p className="surface-control-label">Never silently filled</p>
            <h2 id="coverage-title">Coverage legend</h2>
            <ul>
              {coverageLegend.map((item) => (
                <li key={item.id}>
                  <span
                    className="surface-coverage-swatch"
                    data-coverage={item.id}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.meaning}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </section>

      <section className="surface-continuity-notice" role="note" aria-labelledby="continuity-title">
        <p className="surface-control-label">Recorded-view rule</p>
        <h2 id="continuity-title">Discrete evidence—not continuous footage</h2>
        <p>{marsJezeroSurface.continuityStatement}</p>
      </section>

      <section className="surface-capture-section" aria-labelledby="capture-nodes-title">
        <div className="surface-section-heading surface-section-heading--wide">
          <div>
            <p className="surface-control-label">Perseverance recorded-view network</p>
            <h2 id="capture-nodes-title">Inspect a capture station contract</h2>
          </div>
          <p>
            A station becomes a world only inside the camera’s recorded field.
            Beyond it, the evidence class changes.
          </p>
        </div>

        <div className="surface-capture-grid">
          {marsJezeroSurface.captureNodes.map((node, index) => (
            <button
              className="surface-capture-card"
              data-active={node.id === activeCaptureNode.id}
              key={node.id}
              type="button"
              aria-pressed={node.id === activeCaptureNode.id}
              aria-controls="mars-capture-contract-detail"
              onClick={() => selectCaptureNode(node)}
            >
              <span className="surface-capture-card__index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="surface-capture-card__content">
                <strong>{node.label}</strong>
                <span>{node.place}</span>
                <small>{node.missionClock}</small>
                <small>{node.fieldOfView}</small>
              </span>
              <span className="surface-capture-card__action">
                Inspect capture contract <span aria-hidden="true">→</span>
              </span>
            </button>
          ))}
        </div>

        <article
          className="surface-capture-detail"
          id="mars-capture-contract-detail"
          aria-live="polite"
          aria-atomic="true"
        >
          <div>
            <p className="surface-control-label">Selected station</p>
            <h3>{activeCaptureNode.label}</h3>
            <p>{activeCaptureNode.limitation}</p>
            {activeRecordedPanorama ? (
              <p className={shellStyles.recordedPanoramaDisclosure}>
                Recorded pixels · published presentation derivative · {activeRecordedPanorama.coverage}
              </p>
            ) : null}
          </div>
          <dl>
            <div>
              <dt>Medium</dt>
              <dd>{activeCaptureNode.media.replaceAll("-", " ")}</dd>
            </div>
            <div>
              <dt>Resolution</dt>
              <dd>{activeCaptureNode.resolution}</dd>
            </div>
            <div>
              <dt>Color</dt>
              <dd>{activeCaptureNode.colorTreatment}</dd>
            </div>
            <div>
              <dt>Placement</dt>
              <dd>
                {!activeCaptureContext
                  ? "Capture context missing; placement remains withheld."
                  : activeCaptureContext.coordinate.state === "unresolved"
                    ? activeCaptureContext.coordinate.reason
                    : activeCaptureContext.coordinate.precisionDisclosure}
              </dd>
            </div>
          </dl>
          {activeRecordedPanorama ? (
            <dl className={shellStyles.recordedPanoramaEvidence}>
              <div><dt>Product</dt><dd>{activeRecordedPanorama.productIdentifier}</dd></div>
              <div><dt>Exact retained bytes</dt><dd>{activeRecordedPanorama.byteLength.toLocaleString()} · SHA-256 {activeRecordedPanorama.sha256}</dd></div>
              <div><dt>Processing</dt><dd>{activeRecordedPanorama.processing}</dd></div>
              <div><dt>Credit</dt><dd>{activeRecordedPanorama.rights.credit}</dd></div>
            </dl>
          ) : null}
          <div className="surface-capture-detail__blockers">
            <p className="surface-control-label">{activeRecordedPanorama ? "Pixels admitted · placement remains withheld" : "Placement remains withheld"}</p>
            <ul>
              {(activeCaptureContext?.blockedReasons ?? [
                "No matching strict capture context is available for this station.",
              ]).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section className="surface-evidence-section" id="surface-evidence" aria-labelledby="surface-evidence-title">
        <div className="surface-section-heading surface-section-heading--wide">
          <div>
            <p className="surface-control-label">Provenance follows the camera</p>
            <h2 id="surface-evidence-title">Evidence ledger</h2>
          </div>
          <p>
            These are the declared source layers for the current scale and representation.
            {renderedPanorama
              ? " The exact JPL presentation derivative is rendered above; its full-width source product, frame inventory, and physical placement remain outside the admitted scientific-product boundary."
              : " No archive product is rendered in this procedural preview; exact product identifiers and immutable manifests remain the next ingestion step."}
          </p>
        </div>

        <div className="surface-evidence-ledger">
          {visibleEvidence.map((item) => (
            <article className="surface-evidence-card" key={item.id}>
              <div className="surface-evidence-card__heading">
                <span data-evidence-kind={item.kind}>
                  {evidenceKindLabels[item.kind]}
                </span>
                <span>{item.coverage.replaceAll("-", " ")}</span>
              </div>
              <h3>{item.label}</h3>
              <dl>
                <div>
                  <dt>Supports</dt>
                  <dd>{item.supports}</dd>
                </div>
                <div>
                  <dt>Does not support</dt>
                  <dd>{item.doesNotSupport}</dd>
                </div>
                <div>
                  <dt>Resolution</dt>
                  <dd>{item.resolution}</dd>
                </div>
                <div>
                  <dt>Processing</dt>
                  <dd>{item.processing}</dd>
                </div>
              </dl>
              <div className="surface-evidence-card__sources">
                {item.sourceIds.map((sourceId) => {
                  const source = sourceFor(sourceId);
                  return source ? (
                    <a
                      key={source.id}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.authority} <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : null;
                })}
              </div>
            </article>
          ))}
        </div>

        <details className="surface-source-register">
          <summary>Current source register · {activeSourceIds.length} declared sources</summary>
          <ul>
            {activeSourceIds.map((sourceId) => {
              const source = sourceFor(sourceId);
              return source ? (
                <li key={source.id}>
                  <div>
                    <strong>{source.title}</strong>
                    <span>{source.release}</span>
                    <small>{source.credit} · {source.rightsStatus.replaceAll("-", " ")}</small>
                    <small>{source.integrationPolicy}</small>
                  </div>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    Official source <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ) : null;
            })}
          </ul>
        </details>
      </section>

      <aside className="surface-next-world" aria-labelledby="next-world-title">
        <div>
          <p className="surface-control-label">Second reference fixture ready</p>
          <h2 id="next-world-title">
            {moonApollo17Surface.body} — {moonApollo17Surface.region}
          </h2>
          <p>{moonApollo17Surface.summary}</p>
          <Link className="surface-world-link" href="/worlds/moon">
            Open Apollo 17 surface <span aria-hidden="true">→</span>
          </Link>
        </div>
        <dl>
          <div>
            <dt>Mission</dt>
            <dd>{moonApollo17Surface.mission}</dd>
          </div>
          <div>
            <dt>Recorded nodes</dt>
            <dd>{moonApollo17Surface.captureNodes.length}</dd>
          </div>
          <div>
            <dt>Evidence layers</dt>
            <dd>{moonApollo17Surface.evidence.length}</dd>
          </div>
          <div>
            <dt>Continuity</dt>
            <dd>Discrete photography stations</dd>
          </div>
        </dl>
      </aside>

      <p className="sr-only" aria-live="polite">
        {stage.title}. {modeCopy[mode].label}. {visibleEvidence.length} evidence
        records selected; {renderedPanorama ? "one exact JPL presentation derivative loaded" : "no archive products loaded"}.
      </p>
    </main>
  );
}
