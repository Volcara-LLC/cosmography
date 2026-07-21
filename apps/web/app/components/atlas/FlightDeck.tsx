"use client";

import { ArrowRight, Bookmark, ExternalLink, LocateFixed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { atlasRelease } from "@/app/data/atlas";
import { notifyCosmographyLocationChange } from "@/app/lib/client/location";
import { getFlightDeckDistanceBinding } from "@/app/lib/navigation/flight-deck-distance";
import { createFlightDeckLocationSearch } from "@/app/lib/navigation/flight-deck-location";
import { atlasScientificNameFor } from "@/app/lib/presentation/atlas-scientific-labels";
import type { AtlasEntity } from "@/app/lib/science/scene";
import {
  estimateTravel,
  getTravelMode,
  travelModes,
  type TravelModeId,
  type TravelTruthClass,
} from "@/app/lib/navigation/travel";

import styles from "./FlightDeck.module.css";

const HORIZONS_VOYAGER1_FROZEN_QUERY =
  "https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27-31%27&EPHEM_TYPE=VECTORS&CENTER=%27500@10%27&TLIST=%272443392.5%2C2443937.5%2C2444555.5%2C2447936.5%2C2456164.5%2C2461240.5%2C2462502.5%27&TLIST_TYPE=JD&OUT_UNITS=AU-D&REF_PLANE=ECLIPTIC&REF_SYSTEM=ICRF&VEC_TABLE=2&VEC_CORR=NONE&CSV_FORMAT=YES";

const truthClassLabels: Record<TravelTruthClass, string> = {
  navigation: "Navigation",
  "physical-limit": "Physical limit",
  "historical-comparison": "Historical comparison",
  "hypothetical-physical": "Hypothetical physical",
  "fictional-only": "Fictional only",
};

const transportStatusLabels = {
  "not-a-journey": "Not a physical journey",
  "not-a-ship": "Signal only — not a ship",
  "historical-spacecraft-not-transport":
    "Historical spacecraft — not an available transport",
  "no-available-spacecraft": "No available spacecraft",
  fictional: "Fictional presentation only",
} as const;

type FlightDeckSaveStatus = "idle" | "saving" | "saved" | "error";

interface FlightDeckProps {
  selected: AtlasEntity;
  appearance: "scientific" | "immersive";
  travelMode: TravelModeId;
  onTravelModeChange: (mode: TravelModeId) => void;
  onRecenterMap: () => void;
}

function resultLabel(
  resultKind: ReturnType<typeof estimateTravel>["resultKind"],
  durationLabel: string | null,
) {
  if (durationLabel) return durationLabel;
  if (resultKind === "semantic-navigation") return "No journey duration";
  if (resultKind === "fictional-only") return "No scientific duration";
  return "Distance required";
}

function resultHeading(
  modeId: TravelModeId,
  resultKind: ReturnType<typeof estimateTravel>["resultKind"],
) {
  if (resultKind === "awaiting-source-distance") return "Distance unavailable";
  if (modeId === "instant") return "No physical duration";
  if (modeId === "light") return "Vacuum light-time";
  if (modeId === "voyager") return "At the frozen Voyager 1 speed";
  if (modeId === "fusion") return "At the assumed 0.1c";
  return "No scientific duration";
}

export function FlightDeck({
  selected,
  appearance,
  travelMode,
  onTravelModeChange,
  onRecenterMap,
}: FlightDeckProps) {
  const presentationName = atlasScientificNameFor(selected.id, selected.name);
  const distanceBinding = getFlightDeckDistanceBinding(selected.id);
  const estimate = useMemo(
    () => estimateTravel(distanceBinding?.distanceLightYears, travelMode),
    [distanceBinding?.distanceLightYears, travelMode],
  );
  const mode = getTravelMode(travelMode);
  const voyagerReference = mode.id === "voyager" ? mode.reference : null;
  const displayResult = resultLabel(estimate.resultKind, estimate.durationLabel);
  const displayHeading = resultHeading(mode.id, estimate.resultKind);
  const destinationRecordSourceIds =
    distanceBinding?.recordSourceIds ?? selected.sources.map((source) => source.id);
  const destinationRecordSources = destinationRecordSourceIds.map((sourceId) => ({
    sourceId,
    source: selected.sources.find((candidate) => candidate.id === sourceId),
  }));
  const comparisonKey = `${selected.id}|${travelMode}`;
  const [save, setSave] = useState<{ key: string; status: FlightDeckSaveStatus }>({
    key: "",
    status: "idle",
  });
  const routeSaveState = save.key === comparisonKey ? save.status : "idle";

  useEffect(() => {
    const search = createFlightDeckLocationSearch({
      appearance,
      focusSlug: selected.slug,
      travelMode,
      releaseId: atlasRelease.id,
    });
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}?${search}`,
    );
    notifyCosmographyLocationChange();
  }, [appearance, selected.slug, travelMode]);

  useEffect(
    () => () => {
      const params = new URLSearchParams(window.location.search);
      params.delete("travel");
      const search = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${search ? `?${search}` : ""}`,
      );
      notifyCosmographyLocationChange();
    },
    [],
  );

  async function saveComparison() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setSave({ key: comparisonKey, status: "saving" });
    try {
      const response = await fetch("/api/v1/me/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          title: `Solar System → ${selected.name}`,
          releaseId: atlasRelease.id,
          originEntityId: "solar-system",
          destinationEntityId: selected.id,
          travelMode,
          visibility: "private",
        }),
      });
      const payload = (await response.json()) as { signInPath?: string };
      if (response.status === 401 && payload.signInPath) {
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.assign(
          `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`,
        );
        return;
      }
      setSave({ key: comparisonKey, status: response.ok ? "saved" : "error" });
    } catch {
      setSave({ key: comparisonKey, status: "error" });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return (
    <div
      className={styles.deck}
      data-mode-id={mode.id}
      data-truth-class={estimate.truthClass}
      data-result-kind={estimate.resultKind}
      data-fictional={estimate.fictional}
      data-counterfactual={estimate.counterfactual}
      data-actual-journey-claim={estimate.actualJourneyClaim}
      data-trajectory-claim={estimate.trajectoryClaim}
      data-telemetry-claim={estimate.telemetryClaim}
      data-available-vehicle={estimate.availableVehicle}
    >
      <div className={styles.endpoints} aria-label="Comparison endpoints">
        <div>
          <span className={styles.microLabel}>Origin</span>
          <strong>Solar System</strong>
          <span>Observer reference</span>
        </div>
        <span className={styles.routeLine} aria-hidden="true" />
        <div>
          <span className={styles.microLabel}>Destination</span>
          <strong>{presentationName}</strong>
          <span>{distanceBinding?.distanceLabel ?? selected.distanceLabel}</span>
        </div>
      </div>

      <fieldset className={styles.modeFieldset}>
        <legend>Comparison mode</legend>
        <div className={styles.modeList}>
          {travelModes.map((candidate) => {
            const disclosureId = `flight-mode-${candidate.id}-disclosure`;
            const checked = candidate.id === travelMode;

            return (
              <label
                className={`${styles.modeCard} ${checked ? styles.modeCardActive : ""}`}
                data-truth-class={candidate.truthClass}
                key={candidate.id}
              >
                <input
                  type="radio"
                  name="flight-deck-mode"
                  value={candidate.id}
                  checked={checked}
                  aria-describedby={disclosureId}
                  onChange={() => onTravelModeChange(candidate.id)}
                />
                <span className={styles.modeCopy}>
                  <span className={styles.modeHeading}>
                    <strong>{candidate.label}</strong>
                    <span className={styles.truthBadge}>
                      {truthClassLabels[candidate.truthClass]}
                    </span>
                  </span>
                  <span className={styles.disclosure} id={disclosureId}>
                    {candidate.disclosure}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <section
        className={styles.result}
        data-result-kind={estimate.resultKind}
      >
        <span className={styles.microLabel}>Comparison result</span>
        <h3>{displayHeading}</h3>
        <strong>{displayResult}</strong>
        <span className={styles.resultClass}>
          Truth class: {truthClassLabels[estimate.truthClass]}
        </span>
        <p>{estimate.scientificMeaning}</p>
        <div className={styles.resultFlags}>
          {estimate.counterfactual ? <span>Counterfactual</span> : null}
          {estimate.fictional ? <span>Fictional only</span> : null}
          <span>No available vehicle claimed</span>
        </div>
      </section>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {displayHeading}: {displayResult}. Truth class: {truthClassLabels[estimate.truthClass]}.
      </span>

      <details className={styles.details}>
        <summary>Assumptions &amp; sources</summary>
        <div className={styles.detailsBody}>
          <dl className={styles.assumptions}>
            <div>
              <dt>Release binding</dt>
              <dd>{distanceBinding?.releaseId ?? atlasRelease.id}</dd>
            </div>
            {distanceBinding ? (
              <>
                <div>
                  <dt>Release manifest SHA-256</dt>
                  <dd className={styles.codeValue}>
                    {distanceBinding.releaseManifestSha256}
                  </dd>
                </div>
                <div>
                  <dt>Release content SHA-256</dt>
                  <dd className={styles.codeValue}>
                    {distanceBinding.releaseContentSha256}
                  </dd>
                </div>
              </>
            ) : null}
            <div>
              <dt>Truth class</dt>
              <dd>{mode.truthClass}</dd>
            </div>
            <div>
              <dt>Model policy</dt>
              <dd>{mode.estimatePolicy}</dd>
            </div>
            <div>
              <dt>Transport status</dt>
              <dd>{transportStatusLabels[mode.transportStatus]}</dd>
            </div>
            <div>
              <dt>Source-distance input</dt>
              <dd>
                {distanceBinding === undefined
                  ? "No release-backed source distance is available"
                  : `${distanceBinding.distanceLightYears.toLocaleString("en-US")} light-years`}
              </dd>
            </div>
            <div>
              <dt>Distance basis</dt>
              <dd>{distanceBinding?.basis ?? "unavailable"}</dd>
            </div>
            <div>
              <dt>Field-level ingestion lineage</dt>
              <dd>{distanceBinding?.fieldLevelIngestionLineageAvailable ? "Available" : "Not available"}</dd>
            </div>
          </dl>

          {distanceBinding ? (
            <p className={styles.lineageNote}>{distanceBinding.scientificMeaning}</p>
          ) : null}

          {voyagerReference ? (
            <section className={styles.voyagerReference} aria-labelledby="voyager-speed-reference">
              <h3 id="voyager-speed-reference">Frozen Voyager 1 speed reference</h3>
              <dl className={styles.assumptions}>
                <div>
                  <dt>Epoch</dt>
                  <dd>
                    {voyagerReference.epochTdb} · JD {voyagerReference.julianDateTdb}
                  </dd>
                </div>
                <div>
                  <dt>Speed</dt>
                  <dd>{voyagerReference.speedKilometersPerSecond} km/s</dd>
                </div>
                <div>
                  <dt>Fraction of c</dt>
                  <dd>{voyagerReference.fractionOfLightSpeed}</dd>
                </div>
                <div>
                  <dt>Solution</dt>
                  <dd>{voyagerReference.solutionName}</dd>
                </div>
                <div>
                  <dt>Velocity vector</dt>
                  <dd>
                    [{voyagerReference.velocityAuPerDay.join(", ")}] {voyagerReference.outputUnits}
                  </dd>
                </div>
                <div>
                  <dt>Center / frame</dt>
                  <dd>
                    {voyagerReference.center} (NAIF {voyagerReference.centerNaifId}) ·{" "}
                    {voyagerReference.referenceFrame} / {voyagerReference.referenceSystem}
                  </dd>
                </div>
                <div>
                  <dt>Units / correction</dt>
                  <dd>
                    {voyagerReference.outputUnits} · {voyagerReference.aberrationCorrection}
                  </dd>
                </div>
                <div>
                  <dt>Frozen artifact</dt>
                  <dd>
                    <span className={styles.codeValue}>{voyagerReference.sourceId}</span>
                    <span className={styles.codeValue}>{voyagerReference.artifactPath}</span>
                    <span className={styles.codeValue}>SHA-256 {voyagerReference.artifactSha256}</span>
                  </dd>
                </div>
              </dl>
              <p>
                This freezes one heliocentric geometric ephemeris sample for a constant-speed
                comparison. It is not Voyager 1&apos;s flown trajectory, telemetry, or a transport
                proposal.
              </p>
              <a href={HORIZONS_VOYAGER1_FROZEN_QUERY} target="_blank" rel="noreferrer">
                Open the exact Horizons source query
                <ExternalLink size={15} aria-hidden="true" />
              </a>
              <a href="/missions/voyager-1#trajectory-heading">
                Open the Voyager 1 evidence-bound trajectory record
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            </section>
          ) : null}

          <section className={styles.destinationSources} aria-labelledby="destination-record-sources">
            <h3 id="destination-record-sources">Destination record sources</h3>
            <p>
              These identifiers are bound to the destination record. They are not field-level
              distance sources because that ingestion lineage is not yet available.
            </p>
            <ul>
              {destinationRecordSources.map(({ sourceId, source }) => (
                <li key={sourceId}>
                  {source ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      <span>
                        <strong>{source.title}</strong>
                        <span>{source.release} · {sourceId}</span>
                      </span>
                      <ExternalLink size={15} aria-hidden="true" />
                    </a>
                  ) : (
                    <span className={styles.missingSource}>{sourceId}</span>
                  )}
                </li>
              ))}
            </ul>
            {destinationRecordSources.length === 0 ? (
              <p>No destination-record source identifiers are bound for this origin or destination.</p>
            ) : null}
          </section>
        </div>
      </details>

      <div className={styles.actions}>
        <button className={styles.recenterButton} type="button" onClick={onRecenterMap}>
          <LocateFixed size={17} aria-hidden="true" />
          Recenter map
        </button>
        <p className={styles.transitionNote}>
          Interface transition only — camera movement is navigation feedback, not elapsed travel.
        </p>
        <button
          className={styles.saveButton}
          type="button"
          onClick={saveComparison}
          disabled={routeSaveState === "saving"}
          aria-busy={routeSaveState === "saving"}
        >
          <Bookmark size={17} aria-hidden="true" />
          {routeSaveState === "saving"
            ? "Saving private comparison…"
            : routeSaveState === "saved"
              ? "Private comparison saved"
              : routeSaveState === "error"
                ? "Save failed · try again"
                : "Save private comparison"}
        </button>
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {routeSaveState === "saving"
          ? `Saving private comparison for ${presentationName}`
          : routeSaveState === "saved"
            ? `Private comparison for ${presentationName} saved`
            : routeSaveState === "error"
              ? `Private comparison for ${presentationName} could not be saved`
              : ""}
      </span>
    </div>
  );
}
