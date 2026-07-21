"use client";

import type { CoveragePack } from "@cosmography/scientific-model/coverage-pack";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  ExternalLink,
  Gauge,
  Info,
  Orbit,
  Power,
  PowerOff,
  Radio,
  Satellite,
  ShieldCheck,
  Sparkles,
  Telescope,
  Waypoints,
} from "lucide-react";
import type {
  MissionEvidenceClass,
  MissionFixture,
  MissionSource,
} from "@/app/data/missions/mission-schema";
import { EvidenceCoverageCard } from "@/app/components/evidence/EvidenceCoverageCard";
import themeStyles from "@/app/components/missions/VoyagerTheme.module.css";

const evidenceLabels: Record<MissionEvidenceClass, string> = {
  "direct-observation": "Direct observation",
  "institutional-record": "Mission record",
  "scientific-inference": "Scientific inference",
  "ephemeris-reconstruction": "Ephemeris reconstruction",
  "ephemeris-prediction": "Ephemeris prediction",
  "processed-observation": "Processed observation",
  "artist-interpretation": "Artist interpretation",
};

const sourceKindLabels: Record<MissionSource["sourceKind"], string> = {
  "mission-page": "Mission record",
  "status-page": "Status record",
  "mission-update": "Mission update",
  "ephemeris-api": "Ephemeris query",
  "ephemeris-documentation": "Technical documentation",
  "kernel-archive": "Navigation archive",
  "kernel-documentation": "Kernel documentation",
  "science-archive": "Science archive",
  "media-record": "Media record",
  "media-product-record": "Media product record",
  "rights-policy": "Rights policy",
  "citation-guidance": "Citation guidance",
  "organization-page": "Organization record",
};

function formatEventEpoch(epoch: string, precision: string) {
  const date = new Date(epoch);
  if (precision === "second") {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeStyle: "medium",
      timeZone: "UTC",
    }).format(date) + " UTC";
  }
  if (precision === "minute") {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date) + " UTC";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

function formatVerifiedAt(epoch: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Pacific/Honolulu",
  }).format(new Date(epoch));
}

function EvidenceBadge({ evidenceClass }: { evidenceClass: MissionEvidenceClass }) {
  return (
    <span className={"mission-evidence mission-evidence--" + evidenceClass}>
      <ShieldCheck size={13} aria-hidden="true" />
      {evidenceLabels[evidenceClass]}
    </span>
  );
}

type VoyagerJourneyProps = {
  readonly coverageApiHref: string;
  readonly coveragePack: CoveragePack;
  readonly mission: MissionFixture;
};

export function VoyagerJourney({
  coverageApiHref,
  coveragePack,
  mission,
}: VoyagerJourneyProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedEvent = mission.events[selectedIndex];
  const selectedSources = useMemo(() => {
    const ids = new Set(selectedEvent.sourceIds);
    return mission.sources.filter((source) => ids.has(source.id));
  }, [mission.sources, selectedEvent.sourceIds]);
  const progress = selectedIndex / (mission.events.length - 1);
  const markerX = 9 + progress * 82;
  const markerY = 68 - Math.sin(progress * Math.PI) * 38;
  const currentVector = mission.trajectory.points.find(
    (point) => point.id === "horizons-2026-07-19",
  );
  const futureVector = mission.trajectory.points.at(-1);
  const kernelSet = mission.provenance.kernelSet;
  const validationPlan = mission.provenance.horizonsValidation;
  const parityEpochCount = validationPlan.goldenEpochs.filter(
    (epoch) => epoch.comparisonMode === "same-solution-parity",
  ).length;
  const diagnosticEpochCount =
    validationPlan.goldenEpochs.length - parityEpochCount;
  const primaryCapture = mission.provenance.captureContexts.find(
    (capture) => capture.mediaId === "pale-blue-dot-original",
  );

  return (
    <div className={`${themeStyles.shell} mission-page mission-voyager-page`}>
      <a className="mission-skip-link" href="#mission-journey">
        Skip to Voyager 1 journey
      </a>

      <header className="mission-header">
        <Link className="mission-brand" href="/" aria-label="Return to Cosmography universe map">
          <span className="mission-brand-mark" aria-hidden="true">
            <Orbit size={20} strokeWidth={1.4} />
          </span>
          <span>
            <strong>COSMOGRAPHY</strong>
            <small>Observable universe atlas</small>
          </span>
        </Link>
        <nav className="mission-nav" aria-label="Mission navigation">
          <Link href="/missions">
            <ArrowLeft size={15} aria-hidden="true" />
            All missions
          </Link>
          <Link href="/sources">Source registry</Link>
          <Link href="/">Universe map</Link>
        </nav>
      </header>

      <main id="mission-journey" className="mission-main">
        <section className="mission-hero" aria-labelledby="voyager-title">
          <div className="mission-hero-copy">
            <div className="mission-kicker-row">
              <span className="mission-kicker">Reference journey 001</span>
              <span className="mission-status-chip">
                <span aria-hidden="true" /> Active extended mission
              </span>
            </div>
            <p className="mission-super-title">NASA · JPL · 1977–present</p>
            <h1 id="voyager-title">Voyager <em>1</em></h1>
            <p className="mission-dek">
              The farthest human-made object, mapped as a chain of evidence—not a single glowing
              dot pretending to be live.
            </p>
            <div className="mission-hero-facts" aria-label="Voyager 1 reference facts">
              <div>
                <small>Public state</small>
                <strong>MAG + PWS on</strong>
                <span>Status table updated Apr 17, 2026</span>
              </div>
              <div>
                <small>Frozen atlas vector</small>
                <strong>{currentVector?.derivedHeliocentricDistanceAu.toFixed(3)} AU</strong>
                <span>from Sun · Horizons · Jul 19 TDB</span>
              </div>
              <div>
                <small>Position product</small>
                <strong>Ephemeris</strong>
                <span>Not spacecraft telemetry</span>
              </div>
            </div>
          </div>

          <aside className="mission-truth-card" aria-label="Data truth notice">
            <div className="mission-truth-icon" aria-hidden="true">
              <Radio size={24} />
            </div>
            <span className="mission-kicker">Signal discipline</span>
            <h2>No invented live feed.</h2>
            <p>{mission.publicDataCaveat}</p>
            <div className="mission-verified">
              <ShieldCheck size={15} aria-hidden="true" />
              Official sources checked {formatVerifiedAt(mission.verifiedAt)}
            </div>
          </aside>
        </section>

        <div className="mission-coverage-slot">
          <EvidenceCoverageCard pack={coveragePack} apiHref={coverageApiHref} />
        </div>

        <section className="mission-explorer" aria-labelledby="journey-heading">
          <div className="mission-explorer-heading">
            <div>
              <span className="mission-kicker">Scrub the mission record</span>
              <h2 id="journey-heading">One journey. Different kinds of truth.</h2>
            </div>
            <div className="mission-legend" aria-label="Scene legend">
              <span><i className="mission-legend-dot mission-legend-dot--record" /> recorded event</span>
              <span><i className="mission-legend-dot mission-legend-dot--prediction" /> future prediction</span>
            </div>
          </div>

          <div className="mission-flight-deck">
            <div className="mission-space-stage">
              <div className="mission-space-glow" aria-hidden="true" />
              <div className="mission-orbit mission-orbit--earth" aria-hidden="true" />
              <div className="mission-orbit mission-orbit--jupiter" aria-hidden="true" />
              <div className="mission-orbit mission-orbit--saturn" aria-hidden="true" />
              <div className="mission-sun" aria-hidden="true"><span /></div>
              <div className="mission-planet mission-planet--earth" aria-hidden="true"><span>Earth</span></div>
              <div className="mission-planet mission-planet--jupiter" aria-hidden="true"><span>Jupiter</span></div>
              <div className="mission-planet mission-planet--saturn" aria-hidden="true"><span>Saturn</span></div>
              <div className="mission-heliopause" aria-hidden="true"><span>Heliopause · dynamic boundary</span></div>
              <div className="mission-route" aria-hidden="true">
                <span className="mission-route-base" />
                <span
                  className="mission-route-progress"
                  style={{ "--mission-progress": progress } as CSSProperties}
                />
              </div>
              <div
                className="mission-spacecraft-marker"
                style={
                  {
                    "--mission-marker-x": markerX + "%",
                    "--mission-marker-y": markerY + "%",
                  } as CSSProperties
                }
                aria-hidden="true"
              >
                <span className="mission-signal-ring" />
                <Satellite size={24} strokeWidth={1.3} />
              </div>
              <div className="mission-stage-readout" aria-hidden="true">
                <span>EVENT {String(selectedIndex + 1).padStart(2, "0")}</span>
                <strong>{selectedEvent.shortTitle}</strong>
              </div>
              <p className="mission-stage-note">Journey diagram · chapter positions are schematic and not to scale</p>
            </div>

            <article className="mission-event-panel">
              <div className="mission-event-index">
                <span>{String(selectedIndex + 1).padStart(2, "0")}</span>
                <small>of {String(mission.events.length).padStart(2, "0")}</small>
              </div>
              <EvidenceBadge evidenceClass={selectedEvent.evidenceClass} />
              <time dateTime={selectedEvent.epoch}>
                <Clock3 size={14} aria-hidden="true" />
                {formatEventEpoch(selectedEvent.epoch, selectedEvent.timePrecision)}
              </time>
              <h3>{selectedEvent.title}</h3>
              <p className="mission-event-summary">{selectedEvent.summary}</p>
              <p>{selectedEvent.detail}</p>
              <div className="mission-accuracy-note">
                <Info size={16} aria-hidden="true" />
                <span><strong>Accuracy note</strong>{selectedEvent.accuracyNote}</span>
              </div>
              <div className="mission-event-sources">
                <small>Evidence for this chapter</small>
                {selectedSources.map((source) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                    {source.publisher}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </article>
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              Chapter {selectedIndex + 1} of {mission.events.length}: {selectedEvent.shortTitle}. {evidenceLabels[selectedEvent.evidenceClass]}.
            </p>
          </div>

          <div className="mission-time-console">
            <div className="mission-time-controls">
              <button
                type="button"
                onClick={() => setSelectedIndex((index) => Math.max(0, index - 1))}
                disabled={selectedIndex === 0}
                aria-label="Previous mission event"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <label htmlFor="voyager-time-scrub">
                <span>Mission time</span>
                <input
                  id="voyager-time-scrub"
                  type="range"
                  min={0}
                  max={mission.events.length - 1}
                  step={1}
                  value={selectedIndex}
                  onChange={(event) => setSelectedIndex(Number(event.target.value))}
                  aria-valuetext={selectedEvent.shortTitle + ", " + formatEventEpoch(selectedEvent.epoch, selectedEvent.timePrecision)}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setSelectedIndex((index) => Math.min(mission.events.length - 1, index + 1))
                }
                disabled={selectedIndex === mission.events.length - 1}
                aria-label="Next mission event"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
            <ol className="mission-chapter-list" aria-label="Voyager 1 mission chapters">
              {mission.events.map((event, index) => (
                <li key={event.id}>
                  <button
                    type="button"
                    className={index === selectedIndex ? "mission-chapter is-active" : "mission-chapter"}
                    onClick={() => setSelectedIndex(index)}
                    aria-current={index === selectedIndex ? "step" : undefined}
                  >
                    <span className={event.isFuture ? "is-future" : undefined} aria-hidden="true" />
                    <small>{new Date(event.epoch).getUTCFullYear()}</small>
                    <strong>{event.shortTitle}</strong>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mission-data-section" aria-labelledby="trajectory-heading">
          <div className="mission-section-heading">
            <span className="mission-section-icon" aria-hidden="true"><Waypoints size={20} /></span>
            <div>
              <span className="mission-kicker">Trajectory provenance</span>
              <h2 id="trajectory-heading">Coordinates with a frame, epoch, and limit.</h2>
            </div>
          </div>

          <div className="mission-trajectory-grid">
            <article className="mission-vector-card mission-vector-card--current">
              <div className="mission-card-topline">
                <span>Frozen atlas state</span>
                <EvidenceBadge evidenceClass="ephemeris-prediction" />
              </div>
              <h3>2026.547 · Voyager 1</h3>
              <p className="mission-vector-distance">
                <strong>{currentVector?.derivedHeliocentricDistanceAu.toFixed(6)}</strong>
                <span>AU from the Sun · derived norm of XYZ</span>
              </p>
              <dl className="mission-vector-list">
                <div><dt>Epoch</dt><dd>{currentVector?.epochTdb}</dd></div>
                <div><dt>Position AU</dt><dd>{currentVector?.positionAu.map((value) => value.toFixed(6)).join(" · ")}</dd></div>
                <div><dt>Velocity AU/day</dt><dd>{currentVector?.velocityAuPerDay.map((value) => value.toExponential(5)).join(" · ")}</dd></div>
                <div><dt>Telemetry?</dt><dd>No · JPL Horizons ephemeris</dd></div>
              </dl>
            </article>

            <article className="mission-vector-card">
              <div className="mission-card-topline">
                <span>Reference frame</span>
                <Gauge size={16} aria-hidden="true" />
              </div>
              <h3>{mission.trajectory.frame}</h3>
              <dl className="mission-vector-list">
                <div><dt>Center</dt><dd>{mission.trajectory.centerName} · NAIF {mission.trajectory.centerNaifId}</dd></div>
                <div><dt>Target</dt><dd>NAIF {mission.trajectory.targetNaifId}</dd></div>
                <div><dt>Time scale</dt><dd>{mission.trajectory.timeScale}</dd></div>
                <div><dt>Corrections</dt><dd>{mission.trajectory.vectorCorrection}</dd></div>
                <div><dt>Solution</dt><dd>{mission.trajectory.solutionName}</dd></div>
                <div><dt>Captured API signature</dt><dd>{mission.trajectory.responseArtifact.apiVersion}</dd></div>
                <div><dt>Raw response bytes</dt><dd>{mission.trajectory.responseArtifact.byteLength.toLocaleString()}</dd></div>
                <div><dt>Response SHA-256</dt><dd className="mission-hash">{mission.trajectory.responseArtifact.sha256}</dd></div>
              </dl>
            </article>

            <article className="mission-vector-card mission-vector-card--future">
              <div className="mission-card-topline">
                <span>Prediction, not promise</span>
                <Sparkles size={16} aria-hidden="true" />
              </div>
              <h3>2030 trajectory sample</h3>
              <p className="mission-vector-distance">
                <strong>{futureVector?.derivedHeliocentricDistanceAu.toFixed(6)}</strong>
                <span>AU from the Sun · predicted ephemeris</span>
              </p>
              <p>{mission.trajectory.uncertaintyNote}</p>
              <a
                href={mission.sources.find((source) => source.id === "jpl-horizons-vectors-2026-07-19")?.url}
                target="_blank"
                rel="noreferrer"
              >
                Open the captured Horizons request
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </article>
          </div>

          <div className="mission-telemetry-distinction">
            <Radio size={20} aria-hidden="true" />
            <div>
              <strong>Tracking, ephemeris, and telemetry are not synonyms.</strong>
              <p>{mission.trajectory.telemetryDistinction}</p>
            </div>
          </div>

          <div className="mission-provenance-grid" aria-label="Voyager geometry readiness">
            <article>
              <div className="mission-card-topline">
                <span>SPICE artifact gate</span>
                <span className="mission-contract-state mission-contract-state--blocked">
                  {kernelSet.state === "blocked-missing-artifacts"
                    ? "Execution blocked"
                    : "Integrity verification required"}
                </span>
              </div>
              <h3>
                {kernelSet.state === "blocked-missing-artifacts"
                  ? "Exact file selection, unverified bytes"
                  : "Artifact evidence declared, execution unissued"}
              </h3>
              <p>
                {kernelSet.state === "blocked-missing-artifacts"
                  ? "Official filenames and Cosmography's proposed load order are frozen, but this is not yet an executable kernel manifest. No kernel byte has been bundled or trusted by the page."
                  : "The manifest declares retained artifacts, but raw metadata cannot authorize execution. A reviewed-selection token, canonical digest, and exact-object verifier must still issue an in-process execution token."}
              </p>
              <ol className="mission-kernel-list">
                {kernelSet.artifacts.map((artifact) => (
                  <li key={artifact.artifactId}>
                    <span>{String(artifact.loadOrder).padStart(2, "0")}</span>
                    <code>{artifact.filename}</code>
                    <small>{artifact.kernelType} · {artifact.quality.replaceAll("-", " ")}</small>
                  </li>
                ))}
              </ol>
              <p className="mission-contract-note">
                {kernelSet.state === "blocked-missing-artifacts"
                  ? kernelSet.missingEvidence[0]
                  : "Artifact evidence is declared; in-process selection authorization and integrity verification are still required."}
              </p>
            </article>

            <article>
              <div className="mission-card-topline">
                <span>Cross-implementation parity gate</span>
                <span className="mission-contract-state mission-contract-state--pending">
                  {validationPlan.state === "awaiting-independent-spice-run"
                    ? "Awaiting CSPICE artifact"
                    : "Review required"}
                </span>
              </div>
              <h3>{`${validationPlan.goldenEpochs.length} Horizons golden epochs`}</h3>
              <p>
                The retained Horizons context, ordered vector columns, calendar/JDTDB pairs, and
                decimal states are parsed and cross-bound. A separately generated and hashed
                CSPICE artifact must match an issued verified-manifest token and the exact scientific context.
              </p>
              <dl className="mission-vector-list">
                <div><dt>Strict parity</dt><dd>{parityEpochCount} post-1981 shared-lineage epochs</dd></div>
                <div><dt>Diagnostic</dt><dd>{diagnosticEpochCount} pre-1981 cross-solution epochs · review required</dd></div>
                <div><dt>Position gate</dt><dd>≤ {validationPlan.tolerances.positionVectorAu.toExponential()} AU</dd></div>
                <div><dt>Velocity gate</dt><dd>≤ {validationPlan.tolerances.velocityVectorAuPerDay.toExponential()} AU/day</dd></div>
                <div><dt>Reference hash</dt><dd className="mission-hash">{validationPlan.referenceArtifactSha256}</dd></div>
                <div><dt>Claim</dt><dd>Cross-implementation parity · not independent orbit determination</dd></div>
              </dl>
            </article>

            <article>
              <div className="mission-card-topline">
                <span>Capture-context gate</span>
                <span className="mission-contract-state mission-contract-state--blocked">
                  {primaryCapture?.state === "withheld-incomplete-geometry"
                    ? "Frustum withheld"
                    : "Geometry unavailable"}
                </span>
              </div>
              <h3>Pale Blue Dot stays timeline-only</h3>
              <p>
                The reported 04:48 UTC capture time has minute precision and remains attached to
                its media record, but the atlas will not invent a physical camera pose from a
                midnight TDB vector.
              </p>
              {primaryCapture?.state === "withheld-incomplete-geometry" ? (
                <dl className="mission-vector-list">
                  <div><dt>Observer</dt><dd>Voyager 1 · NAIF {primaryCapture.observerNaifId}</dd></div>
                  <div><dt>Target</dt><dd>Earth · NAIF {primaryCapture.targetNaifId}</dd></div>
                  <div><dt>Required</dt><dd>{primaryCapture.requiredKernelTypes.join(" · ")}</dd></div>
                  <div><dt>Placement</dt><dd>Timeline only · no renderable camera pose</dd></div>
                </dl>
              ) : null}
            </article>
          </div>
        </section>

        <section className="mission-data-section" aria-labelledby="instruments-heading">
          <div className="mission-section-heading">
            <span className="mission-section-icon" aria-hidden="true"><Activity size={20} /></span>
            <div>
              <span className="mission-kicker">Public operations state</span>
              <h2 id="instruments-heading">A spacecraft slowly trading breadth for time.</h2>
            </div>
          </div>
          <p className="mission-section-intro">
            These are dated public status records. An “on” badge means NASA publicly listed the
            instrument on as of the source epoch; it is not a real-time electrical measurement.
          </p>
          <div className="mission-instrument-grid">
            {mission.instruments.map((instrument) => (
              <article className="mission-instrument-card" key={instrument.id}>
                <div className={instrument.state === "on" ? "mission-power is-on" : "mission-power is-off"}>
                  {instrument.state === "on" ? <Power size={17} aria-hidden="true" /> : <PowerOff size={17} aria-hidden="true" />}
                  {instrument.state === "on" ? "Publicly listed on" : "Publicly listed off"}
                </div>
                <span className="mission-instrument-acronym">{instrument.acronym}</span>
                <h3>{instrument.name}</h3>
                <p>{instrument.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mission-data-section" aria-labelledby="media-heading">
          <div className="mission-section-heading">
            <span className="mission-section-icon" aria-hidden="true"><Telescope size={20} /></span>
            <div>
              <span className="mission-kicker">Media evidence ledger</span>
              <h2 id="media-heading">Observation, processing, and interpretation stay separate.</h2>
            </div>
          </div>
          <div className="mission-media-grid">
            {mission.media.map((media) => {
              const admission = mission.provenance.mediaAdmissions.find(
                (candidate) => candidate.mediaId === media.id,
              );
              if (!admission) {
                return null;
              }
              const mediaEvidence = media.representation === "raw-science-data"
                ? "direct-observation"
                : media.representation;
              const structuredCredit = admission.state === "reference-only-pending-asset-review"
                ? admission.requiredCreditLine
                : admission.rights.creditLine;
              const rightsDisclosure = admission.state === "reference-only-pending-asset-review"
                ? admission.blockedReason
                : admission.rights.requiredNotices.join(" · ") || "Rights evidence recorded for the declared use.";
              const officialRecordUrl = admission.state === "reference-only-pending-asset-review"
                ? admission.officialRecordUrl
                : admission.asset.sourceUrl;
              return (
                <article className={"mission-media-card mission-media-card--" + media.representation} key={media.id}>
                  <div className="mission-media-orbit" aria-hidden="true"><CircleDot size={28} /></div>
                  <EvidenceBadge evidenceClass={mediaEvidence} />
                  <h3>{media.title}</h3>
                  <p>{media.description}</p>
                  <small>{structuredCredit}</small>
                  <span className="mission-rights-note">{rightsDisclosure}</span>
                  {admission.state === "reference-only-pending-asset-review" ? (
                    <span className="mission-media-admission">
                      Reference only · media bytes not admitted
                    </span>
                  ) : (
                    <span className="mission-media-admission">
                      Reviewed asset record · render verification still required
                    </span>
                  )}
                  <a href={officialRecordUrl} target="_blank" rel="noreferrer">
                    Open official record <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mission-data-section" aria-labelledby="roles-heading">
          <div className="mission-section-heading">
            <span className="mission-section-icon" aria-hidden="true"><BookOpen size={20} /></span>
            <div>
              <span className="mission-kicker">Organization roles</span>
              <h2 id="roles-heading">The mission is a network, not a logo.</h2>
            </div>
          </div>
          <div className="mission-role-grid">
            {mission.organizations.map((organization) => (
              <article key={organization.id}>
                <small>{organization.roleType.replaceAll("-", " ")}</small>
                <h3>{organization.name}</h3>
                <p>{organization.role}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mission-source-ledger" aria-labelledby="sources-heading">
          <div className="mission-ledger-heading">
            <div>
              <span className="mission-kicker">Evidence-led foundation reference</span>
              <h2 id="sources-heading">{mission.sources.length} official primary sources</h2>
            </div>
            <Database size={26} aria-hidden="true" />
          </div>
          <div className="mission-source-list">
            {mission.sources.map((source, index) => (
              <article key={source.id}>
                <span className="mission-source-number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{sourceKindLabels[source.sourceKind]} · {source.publisher}</small>
                  <h3>{source.title}</h3>
                  <p>{source.coverage}</p>
                  {source.caveat ? <p className="mission-source-caveat"><Info size={13} aria-hidden="true" />{source.caveat}</p> : null}
                </div>
                <a href={source.url} target="_blank" rel="noreferrer" aria-label={"Open official source: " + source.title}>
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </section>

        <footer className="mission-footer">
          <div>
            <span className="mission-kicker">Reference module v0.2</span>
            <p>Every claim can be traced. Every prediction admits what it is.</p>
          </div>
          <Link href="/missions">
            Explore the international mission atlas
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </footer>
      </main>
    </div>
  );
}
