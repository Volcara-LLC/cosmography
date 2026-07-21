"use client";

import {
  CircleDot,
  ExternalLink,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";

import type { TravelModeId } from "@/app/lib/navigation/travel";
import { atlasScientificNameFor } from "@/app/lib/presentation/atlas-scientific-labels";
import type { AtlasEntity } from "@/app/lib/science/scene";
import type { RenderProfileRequest } from "@/app/components/universe/performance";
import type { RendererDiagnostics } from "@/app/components/universe/runtime/createUniverseRenderer";

import { FlightDeck } from "./FlightDeck";
import { RecordedEncounterAction } from "./RecordedEncounterAction";

export type AtlasPanel = "layers" | "evidence" | "route";
export type AtlasLayerKey = "catalogs" | "observations" | "missions" | "coverage";
const layerLabels: Record<
  AtlasLayerKey,
  { label: string; detail: string; available: boolean }
> = {
  catalogs: {
    label: "Names & designations",
    detail: "15 exact-release semantic anchors projected through this display camera",
    available: true,
  },
  observations: {
    label: "Observed light · planned",
    detail: "No calibrated image or survey-footprint layer is active in this checkpoint",
    available: false,
  },
  missions: {
    label: "Exploration · planned",
    detail: "No spacecraft, traverse, or mission-event overlay is active here yet",
    available: false,
  },
  coverage: {
    label: "Coverage & unknowns · planned",
    detail: "Coverage records exist on reference pages; no camera overlay is active yet",
    available: false,
  },
};

interface AtlasDetailPanelProps {
  panel: AtlasPanel;
  selected: AtlasEntity;
  releaseId: string;
  appearance: "scientific" | "immersive";
  layers: Record<AtlasLayerKey, boolean>;
  renderProfile: RenderProfileRequest;
  rendererDiagnostics: RendererDiagnostics | null;
  travelMode: TravelModeId;
  onClose: () => void;
  onToggleLayer: (key: AtlasLayerKey) => void;
  onRenderProfileChange: (profile: RenderProfileRequest) => void;
  onTravelModeChange: (mode: TravelModeId) => void;
  onPreviewJourney: () => void;
}

function evidenceName(value: string) {
  return value.replaceAll("-", " ");
}

export function AtlasDetailPanel({
  panel,
  selected,
  releaseId,
  appearance,
  layers,
  renderProfile,
  rendererDiagnostics,
  travelMode,
  onClose,
  onToggleLayer,
  onRenderProfileChange,
  onTravelModeChange,
  onPreviewJourney,
}: AtlasDetailPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const presentationName = atlasScientificNameFor(selected.id, selected.name);

  useEffect(() => {
    panelRef.current?.focus();
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, panel]);

  return (
    <aside
      className="detail-panel"
      aria-labelledby="detail-panel-title"
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="detail-panel-header">
        <div>
          <span className="eyebrow">{presentationName}</span>
          <h2 id="detail-panel-title">
            {panel === "layers"
              ? "Map layers"
              : panel === "evidence"
                ? "Evidence record"
                : "Flight Deck"}
          </h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close panel">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {panel === "layers" ? (
        <div className="layer-list">
          {(Object.keys(layerLabels) as AtlasLayerKey[]).map((key) => (
            <label key={key}>
              <span>
                <strong>{layerLabels[key].label}</strong>
                <small>{layerLabels[key].detail}</small>
              </span>
              <input
                type="checkbox"
                checked={layerLabels[key].available ? layers[key] : false}
                disabled={!layerLabels[key].available}
                onChange={() => layerLabels[key].available && onToggleLayer(key)}
              />
            </label>
          ))}
          <label className="render-profile-control">
            <span>
              <strong>Display performance</strong>
              <small>Changes procedural density and pixel load only—not scientific state.</small>
            </span>
            <select
              value={renderProfile}
              onChange={(event) =>
                onRenderProfileChange(event.target.value as RenderProfileRequest)
              }
            >
              <option value="auto">Auto · balanced start</option>
              <option value="efficient">Efficient · 30 fps / 1 MP</option>
              <option value="balanced">Balanced · 60 fps / 2.1 MP</option>
              <option value="fidelity">Fidelity · 60 fps / 4.1 MP</option>
              <option value="structured">Structured · no WebGL</option>
            </select>
          </label>
          {rendererDiagnostics ? (
            <div className="render-diagnostics">
              <strong>Renderer diagnostics</strong>
              <small>
                WebGL {rendererDiagnostics.webglVersion} · {rendererDiagnostics.profile}
                {" · "}
                {rendererDiagnostics.framebufferWidth} × {rendererDiagnostics.framebufferHeight}
                {" · "}
                {rendererDiagnostics.calls} draw calls · {rendererDiagnostics.triangles.toLocaleString()} triangles
                {rendererDiagnostics.p95FrameIntervalMs === null
                  ? ""
                  : ` · p95 ${rendererDiagnostics.p95FrameIntervalMs.toFixed(1)} ms`}
                {` · build ${rendererDiagnostics.domainBuildMs.toFixed(1)} ms`}
              </small>
            </div>
          ) : null}
          <div className="panel-note">
            <CircleDot size={16} aria-hidden="true" />
            Names are bound to the exact foundation release. Their anchors are semantic display
            positions—not astrometry, physical poses, catalog streaming, or complete coverage.
          </div>
        </div>
      ) : null}

      {panel === "evidence" ? (
        <div className="evidence-record">
          <div className="evidence-badge">
            <span style={{ backgroundColor: selected.color }} aria-hidden="true" />
            {evidenceName(selected.representation.evidence)}
          </div>
          <dl>
            <div><dt>Appearance</dt><dd>{evidenceName(selected.representation.appearance)}</dd></div>
            <div><dt>Geometry</dt><dd>{evidenceName(selected.representation.geometry)}</dd></div>
            <div><dt>Time state</dt><dd>{evidenceName(selected.representation.timeState)}</dd></div>
            <div><dt>Frame</dt><dd>{selected.representation.frame}</dd></div>
            <div><dt>Uncertainty</dt><dd>{selected.representation.uncertainty}</dd></div>
            <div><dt>Display transform</dt><dd>{selected.representation.displayTransform}</dd></div>
          </dl>
          <h3>Release-pinned sources</h3>
          <div className="source-links">
            {selected.sources.map((source) => (
              <a href={source.url} key={source.id} target="_blank" rel="noreferrer">
                <span>
                  <strong>{source.title}</strong>
                  <small>{source.release} · {source.credit}</small>
                </span>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
          <RecordedEncounterAction
            key={selected.id}
            entityId={selected.id}
            entityName={presentationName}
            releaseId={releaseId}
          />
        </div>
      ) : null}

      {panel === "route" ? (
        <FlightDeck
          selected={selected}
          appearance={appearance}
          travelMode={travelMode}
          onTravelModeChange={onTravelModeChange}
          onRecenterMap={onPreviewJourney}
        />
      ) : null}
    </aside>
  );
}
