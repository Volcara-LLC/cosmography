"use client";

import type { CoveragePack } from "@cosmography/scientific-model/coverage-pack";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SurfaceProvenanceReadiness } from "@/app/components/surface/SurfaceProvenanceReadiness";
import shellStyles from "@/app/components/surface/SurfaceShell.module.css";
import { moonApollo17SurfacePreIngestLedger } from "@/app/data/surface/moon-apollo17-provenance";
import {
  evidenceIsVisible,
  moonApollo17Surface,
  type SurfaceStageId,
  type SurfaceViewMode,
} from "@/app/data/surface/surface-fixtures";

const modeLabels: Record<SurfaceViewMode, string> = {
  original: "Observation products",
  reconstruction: "Reconstruction contract",
  immersive: "Immersive display plan",
};

type MoonSurfaceExperienceProps = {
  readonly coverageApiHref: string;
  readonly coveragePack: CoveragePack;
};

export function MoonSurfaceExperience({
  coverageApiHref,
  coveragePack,
}: MoonSurfaceExperienceProps) {
  const [stageId, setStageId] = useState<SurfaceStageId>("orbit");
  const [mode, setMode] = useState<SurfaceViewMode>("reconstruction");
  const [captureNodeId, setCaptureNodeId] = useState<string>(
    moonApollo17Surface.captureNodes[0].id,
  );
  const stageIndex = moonApollo17Surface.stages.findIndex((stage) => stage.id === stageId);
  const stage = moonApollo17Surface.stages[stageIndex];
  const captureNode =
    moonApollo17Surface.captureNodes.find((node) => node.id === captureNodeId) ??
    moonApollo17Surface.captureNodes[0];
  const captureContext =
    moonApollo17SurfacePreIngestLedger.captureContexts.find(
      (context) => context.captureNodeId === captureNode.id,
    );
  const visibleEvidence = useMemo(() => {
    const ids = new Set(stage.evidenceIds);
    return moonApollo17Surface.evidence.filter(
      (item) => ids.has(item.id) && evidenceIsVisible(item, mode),
    );
  }, [mode, stage]);
  const sources = useMemo(() => {
    const ids = new Set(visibleEvidence.flatMap((item) => item.sourceIds));
    if (stageId === "recorded-view") {
      captureNode.sourceIds.forEach((id) => ids.add(id));
    }
    return moonApollo17Surface.sources.filter((source) => ids.has(source.id));
  }, [captureNode, stageId, visibleEvidence]);

  function moveStage(direction: -1 | 1) {
    const next = Math.max(0, Math.min(moonApollo17Surface.stages.length - 1, stageIndex + direction));
    setStageId(moonApollo17Surface.stages[next].id);
  }

  return (
    <main
      className={`${shellStyles.shell} ${shellStyles.moon} surface-experience surface-experience--moon surface-experience--${mode}`}
    >
      <a className="surface-skip-link" href="#lunar-evidence">
        Skip to lunar evidence
      </a>
      <header className="surface-header">
        <div className="surface-header__identity">
          <Link className="surface-back-link" href="/">
            <span aria-hidden="true">←</span> Observable Universe
          </Link>
          <p className="surface-eyebrow">Controlled lunar surface reference · 0.1</p>
          <h1>Moon — Taurus–Littrow</h1>
          <p>
            Follow Apollo 17 from orbital cartography to astronaut photography stations. The
            measured terrain, reconstructed traverse, and discrete panoramas keep separate evidence
            identities.
          </p>
        </div>
        <div className="surface-header__readout" aria-label="Current lunar view">
          <span>Landing-region anchor · 20.16°N · 30.77°E</span>
          <strong>{stage.shortLabel}</strong>
          <span>{modeLabels[mode]}</span>
        </div>
      </header>

      <aside className="surface-render-boundary" role="note">
        <strong>Current render boundary</strong>
        <span>
          The scene is a procedural interface preview. No Apollo scan, controlled mosaic, DEM tile,
          or solved camera pose is rendered yet; observation-mode labels describe the evidence contract,
          not pixels already loaded into this build.
        </span>
      </aside>

      <SurfaceProvenanceReadiness
        coverageApiHref={coverageApiHref}
        coveragePack={coveragePack}
        ledger={moonApollo17SurfacePreIngestLedger}
        title="Apollo 17 products are declared, not admitted"
      />

      <section className="surface-mode-bar" aria-labelledby="moon-mode-label">
        <div>
          <p className="surface-control-label" id="moon-mode-label">Representation</p>
          <p className="surface-mode-bar__description">
            Captured lighting will be preserved when observation products are loaded. Physical
            relighting never adds an atmosphere to the Moon.
          </p>
        </div>
        <div className="surface-segmented-control" role="group" aria-label="Lunar representation">
          {(Object.keys(modeLabels) as SurfaceViewMode[]).map((candidate) => (
            <button
              className="surface-segmented-control__button"
              data-active={candidate === mode}
              type="button"
              key={candidate}
              aria-pressed={candidate === mode}
              onClick={() => setMode(candidate)}
            >
              {candidate === "original" ? "Observed" : candidate === "reconstruction" ? "Reconstruction" : "Immersive"}
            </button>
          ))}
        </div>
      </section>

      <nav className="surface-stage-nav" aria-label="Lunar descent stages">
        <ol>
          {moonApollo17Surface.stages.map((candidate, index) => (
            <li key={candidate.id}>
              <button
                className="surface-stage-nav__button"
                data-active={candidate.id === stageId}
                type="button"
                aria-current={candidate.id === stageId ? "step" : undefined}
                onClick={() => setStageId(candidate.id)}
              >
                <span className="surface-stage-nav__number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span><strong>{candidate.shortLabel}</strong><small>{candidate.scale}</small></span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="surface-workspace" aria-label="Apollo 17 surface explorer">
        <figure
          className={`surface-viewport surface-viewport--${stage.id} surface-viewport--${mode}`}
          aria-labelledby="lunar-viewport-title"
        >
          <div className="surface-viewport__scene" aria-hidden="true">
            <div className="surface-viewport__space-field" />
            <div className="surface-viewport__planet" />
            <div className="surface-viewport__target-ring" />
            <div className="surface-viewport__terrain surface-viewport__terrain--far" />
            <div className="surface-viewport__terrain surface-viewport__terrain--near" />
            <div className="surface-viewport__coverage-mask" />
            <div className="surface-viewport__grid" />
          </div>
          <div className="surface-viewport__topline">
            <span className="surface-status-pill" data-mode={mode}>{modeLabels[mode]}</span>
            <span>{visibleEvidence.length} declared records · none loaded · no atmosphere</span>
          </div>
          <figcaption className="surface-viewport__caption">
            <p className="surface-control-label">{stage.scale}</p>
            <h2 id="lunar-viewport-title">{stage.title}</h2>
            <p>{stage.summary}</p>
          </figcaption>
          {stageId === "recorded-view" ? (
            <div className="surface-capture-overlay">
              <p className="surface-control-label">Reference station · pose withheld</p>
              <strong>{captureNode.label}</strong>
              <span>{captureNode.missionClock}</span>
              <span>
                {!captureContext
                  ? "Capture context missing · placement withheld"
                  : captureContext.coordinate.state === "unresolved"
                    ? "Station position unresolved"
                    : "Approximate region anchor only"}
              </span>
            </div>
          ) : (
            <div className="surface-scale-overlay">
              <span>Target · Taurus–Littrow</span>
              <span>Controlled product resolution shown in evidence</span>
            </div>
          )}
          <div className="surface-stage-controls">
            <button type="button" disabled={stageIndex === 0} onClick={() => moveStage(-1)}>
              Previous scale
            </button>
            <button
              type="button"
              disabled={stageIndex === moonApollo17Surface.stages.length - 1}
              onClick={() => moveStage(1)}
            >
              Descend closer <span aria-hidden="true">→</span>
            </button>
          </div>
        </figure>

        <aside className="surface-sidecar" aria-label="Lunar evidence context">
          <section className="surface-boundary-card">
            <p className="surface-control-label">Scientific boundary</p>
            <p>{stage.boundary}</p>
          </section>
          <section className="surface-resolution-card">
            <div className="surface-section-heading">
              <div><p className="surface-control-label">Declared for this view</p><h2>Evidence contract &amp; resolution</h2></div>
            </div>
            <ul className="surface-evidence-list">
              {visibleEvidence.map((item) => (
                <li key={item.id} data-evidence-kind={item.kind}>
                  <span className="surface-evidence-swatch" data-coverage={item.coverage} aria-hidden="true" />
                  <div><strong>{item.label}</strong><span>{item.kind.replaceAll("-", " ")}</span><small>{item.resolution}</small></div>
                </li>
              ))}
            </ul>
          </section>
          <section className="surface-coverage-card">
            <p className="surface-control-label">Lighting rule</p>
            <h2>Vacuum remains vacuum</h2>
            <p className="lunar-rule-copy">
              No blue sky, wind, or atmospheric haze is added. Optional sound is cinematic or
              sonified data and must remain labeled and off by default.
            </p>
          </section>
        </aside>
      </section>

      <section className="surface-continuity-notice" role="note">
        <p className="surface-control-label">Recorded-view rule</p>
        <h2>Photography stations—not a seamless video walk</h2>
        <p>{moonApollo17Surface.continuityStatement}</p>
      </section>

      <section className="surface-capture-section" aria-labelledby="apollo-stations-title">
        <div className="surface-section-heading surface-section-heading--wide">
          <div><p className="surface-control-label">Apollo 17 capture network</p><h2 id="apollo-stations-title">Inspect a photography-station contract</h2></div>
          <p>Transitions are node hops unless the controlled terrain and traverse geometry support local movement.</p>
        </div>
        <div className="surface-capture-grid">
          {moonApollo17Surface.captureNodes.map((node, index) => (
            <button
              type="button"
              className="surface-capture-card"
              data-active={node.id === captureNode.id}
              aria-pressed={node.id === captureNode.id}
              aria-controls="moon-capture-contract-detail"
              key={node.id}
              onClick={() => { setCaptureNodeId(node.id); setStageId("recorded-view"); }}
            >
              <span className="surface-capture-card__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="surface-capture-card__content"><strong>{node.label}</strong><span>{node.place}</span><small>{node.missionClock}</small><small>{node.fieldOfView}</small></span>
              <span className="surface-capture-card__action">Inspect station record <span aria-hidden="true">→</span></span>
            </button>
          ))}
        </div>
        <article
          className="surface-capture-detail"
          id="moon-capture-contract-detail"
          aria-live="polite"
          aria-atomic="true"
        >
          <div>
            <p className="surface-control-label">Selected station contract</p>
            <h3>{captureNode.label}</h3>
            <p>{captureNode.limitation}</p>
          </div>
          <dl>
            <div>
              <dt>Medium</dt>
              <dd>{captureNode.media.replaceAll("-", " ")}</dd>
            </div>
            <div>
              <dt>Resolution</dt>
              <dd>{captureNode.resolution}</dd>
            </div>
            <div>
              <dt>Color</dt>
              <dd>{captureNode.colorTreatment}</dd>
            </div>
            <div>
              <dt>Placement</dt>
              <dd>
                {!captureContext
                  ? "Capture context missing; placement remains withheld."
                  : captureContext.coordinate.state === "unresolved"
                    ? captureContext.coordinate.reason
                    : captureContext.coordinate.precisionDisclosure}
              </dd>
            </div>
          </dl>
          <div className="surface-capture-detail__blockers">
            <p className="surface-control-label">Placement remains withheld</p>
            <ul>
              {(captureContext?.blockedReasons ?? [
                "No matching strict capture context is available for this station.",
              ]).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section className="surface-evidence-section" id="lunar-evidence" aria-labelledby="lunar-evidence-title">
        <div className="surface-section-heading surface-section-heading--wide">
          <div><p className="surface-control-label">Pre-ingest provenance</p><h2 id="lunar-evidence-title">Current official source register</h2></div>
          <p>These are declared references, not rights-cleared assets loaded into the viewport. Exact frame and product identifiers must be frozen in an ingest manifest before any public media release.</p>
        </div>
        <div className="source-grid lunar-source-grid">
          {sources.map((source) => (
            <article className="source-card" key={source.id}>
              <small>{source.authority} · {source.rightsStatus.replaceAll("-", " ")}</small>
              <h2>{source.title}</h2>
              <p>{source.release}. {source.integrationPolicy}</p>
              <p>{source.credit}</p>
              <a href={source.url} target="_blank" rel="noreferrer">Official source</a>
            </article>
          ))}
        </div>
      </section>

      <aside className="surface-next-world">
        <div><p className="surface-control-label">Continue exploration</p><h2>Return to Mars — Jezero Crater</h2><p>Compare human photography stations with Perseverance&apos;s discrete rover-camera network and reconstructed local geometry.</p></div>
        <Link className="primary-action" href="/worlds/mars">Open Mars surface <span aria-hidden="true">→</span></Link>
      </aside>
      <p className="sr-only" aria-live="polite">{stage.title}. {modeLabels[mode]}. {visibleEvidence.length} evidence records selected; no archive products loaded.</p>
    </main>
  );
}
