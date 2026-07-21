"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  downgradeProfile,
  renderProfiles,
  resolveInitialProfile,
  type RenderProfileName,
  type RenderProfileRequest,
} from "@/app/components/universe/performance";
import type {
  RendererDiagnostics,
  UniverseRendererSession,
} from "@/app/components/universe/runtime/createUniverseRenderer";
import type {
  LabelProjectionSnapshot,
  ProjectionAnchor,
} from "@/app/components/universe/runtime/labelProjection";
import type { RendererController } from "@/app/components/universe/runtime/types";
import type { FoundationProjectedLabel } from "@/app/data/labels/foundation-projected-labels";
import type { ScaleDomain } from "@/app/lib/science/scene";

const ProjectedLabelLayer = lazy(() =>
  import("./ProjectedLabelLayer").then((module) => ({
    default: module.ProjectedLabelLayer,
  })),
);

export type UniverseRendererStatus = "ready" | "fallback" | "error";

export interface UniverseViewportProps {
  domain: ScaleDomain;
  appearance: "scientific" | "immersive";
  paused: boolean;
  focusId: string;
  focusColor?: string;
  recenterSequence?: number;
  className?: string;
  accessibleLabel?: string;
  statusText?: string;
  maxDevicePixelRatio?: number;
  renderProfile?: RenderProfileRequest;
  labelCandidates?: readonly FoundationProjectedLabel[];
  labelsVisible?: boolean;
  fullView?: boolean;
  onSelectLabel?: (id: string, trigger: HTMLButtonElement) => void;
  onRendererStatus?: (status: UniverseRendererStatus) => void;
  onRendererDiagnostics?: (diagnostics: RendererDiagnostics) => void;
}

const visuallyHiddenStyle = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

const viewportKeyboardInstructions =
  "Keyboard controls: use the Arrow keys to orbit, Plus or Page Up to zoom in, Minus or Page Down to zoom out, and Home to reset the view. Press Escape to leave the viewport. On touch screens, horizontal swipes orbit; vertical swipes scroll the page and pinch gestures remain available for browser zoom.";

export function getPendingRecenterSequence(
  currentSequence: number,
  consumedSequence: number,
): number | null {
  return currentSequence === consumedSequence ? null : currentSequence;
}

const domainDescriptions: Record<ScaleDomain, string> = {
  lightcone:
    "an observer-centered, logarithmic overview of the observable universe",
  extragalactic:
    "a contextual field of galaxy groups, clusters, and large-scale structure",
  galactic: "a contextual stellar disk with a central bulge and spiral structure",
  system: "a schematic orbital neighborhood centered on the selected system",
  globe: "a rotatable planetary globe with a coordinate reference grid",
  surface: "a terrain-scale planetary surface context",
  panorama: "an observation-site panorama and local horizon context",
  simulation: "a physics-inspired compact-object visualization",
};

function useReducedMotionPreference(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

export function UniverseViewport({
  domain,
  appearance,
  paused,
  focusId,
  focusColor,
  recenterSequence = 0,
  className,
  accessibleLabel,
  statusText,
  maxDevicePixelRatio = 2,
  renderProfile = "auto",
  labelCandidates,
  labelsVisible = true,
  fullView = false,
  onSelectLabel,
  onRendererStatus,
  onRendererDiagnostics,
}: UniverseViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<RendererController | null>(null);
  const rendererStatusCallbackRef = useRef(onRendererStatus);
  const diagnosticsCallbackRef = useRef(onRendererDiagnostics);
  const prefersReducedMotion = useReducedMotionPreference();
  const motionPausedRef = useRef(paused || prefersReducedMotion);
  const recenterSequenceRef = useRef(recenterSequence);
  const consumedRecenterSequenceRef = useRef(recenterSequence);
  const rendererGenerationRef = useRef(0);
  const [renderState, setRenderState] = useState<
    "initializing" | "ready" | "fallback" | "error" | "context-lost"
  >("initializing");
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [labelProjection, setLabelProjection] =
    useState<LabelProjectionSnapshot | null>(null);
  const [labelFocusRequest, setLabelFocusRequest] = useState<{
    id: string;
    sequence: number;
  } | null>(null);
  const [interactionStatus, setInteractionStatus] = useState("");
  const [automaticProfile, setAutomaticProfile] =
    useState<RenderProfileName>("balanced");
  const interactionSequenceRef = useRef(0);
  const descriptionId = useId();
  const instructionsId = useId();
  const resolvedProfileName =
    renderProfile === "auto"
      ? automaticProfile
      : resolveInitialProfile(renderProfile);
  const resolvedProfile = renderProfiles[resolvedProfileName];
  const profileReason =
    renderProfile !== "auto"
      ? ("user" as const)
      : automaticProfile === "balanced"
        ? ("auto-baseline" as const)
        : ("auto-runtime-downgrade" as const);
  const projectionAnchors = useMemo<readonly ProjectionAnchor[]>(
    () =>
      labelCandidates?.map((candidate) => ({
        id: candidate.id,
        position: candidate.visualAnchor,
      })) ?? [],
    [labelCandidates],
  );

  const proceduralDescription = useMemo(
    () =>
      accessibleLabel ??
      `Cosmography is showing ${domainDescriptions[domain]}. The particles, terrain, and guide geometry are deterministic procedural display context, not a claim of direct observation or object ephemerides.`,
    [accessibleLabel, domain],
  );

  useEffect(() => {
    rendererStatusCallbackRef.current = onRendererStatus;
  }, [onRendererStatus]);

  useEffect(() => {
    diagnosticsCallbackRef.current = onRendererDiagnostics;
  }, [onRendererDiagnostics]);

  const selectProjectedLabel = useCallback(
    (id: string, trigger: HTMLButtonElement) => {
      setLabelFocusRequest((current) => ({
        id,
        sequence: (current?.sequence ?? 0) + 1,
      }));
      onSelectLabel?.(id, trigger);
    },
    [onSelectLabel],
  );

  useEffect(() => {
    if (
      !labelFocusRequest ||
      labelFocusRequest.id !== focusId ||
      renderState === "initializing"
    ) {
      return;
    }

    const request = labelFocusRequest;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const target = containerRef.current?.querySelector<HTMLButtonElement>(
          `[data-projected-label-id="${request.id}"]`,
        );
        if (target && !target.disabled) target.focus();
        else canvasRef.current?.focus();
        setLabelFocusRequest((current) =>
          current?.sequence === request.sequence ? null : current,
        );
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [focusId, labelFocusRequest, labelProjection, renderState]);

  useEffect(() => {
    motionPausedRef.current = paused || prefersReducedMotion;
    controllerRef.current?.setMotionPaused(paused || prefersReducedMotion);
  }, [paused, prefersReducedMotion]);

  useEffect(() => {
    recenterSequenceRef.current = recenterSequence;
    const pendingSequence = getPendingRecenterSequence(
      recenterSequence,
      consumedRecenterSequenceRef.current,
    );
    if (pendingSequence === null || !controllerRef.current) return;
    controllerRef.current.recenterSelection(pendingSequence);
    consumedRecenterSequenceRef.current = pendingSequence;
  }, [recenterSequence]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let session: UniverseRendererSession | null = null;
    const abortController = new AbortController();
    const rendererGeneration = rendererGenerationRef.current + 1;
    rendererGenerationRef.current = rendererGeneration;
    controllerRef.current = null;
    setLabelProjection(null);

    if (resolvedProfile.name === "structured") {
      const message =
        "The structured display profile is active. The searchable scientific atlas remains fully available without a real-time graphics view.";
      queueMicrotask(() => {
        if (abortController.signal.aborted) return;
        setFallbackMessage(message);
        setRenderState("fallback");
        rendererStatusCallbackRef.current?.("fallback");
      });
      return () => abortController.abort();
    }

    queueMicrotask(() => {
      if (abortController.signal.aborted) return;
      setRenderState("initializing");
      setFallbackMessage(null);
    });

    void import(
      "@/app/components/universe/runtime/createUniverseRenderer"
    )
      .then(({ createUniverseRenderer }) =>
        createUniverseRenderer({
          canvas,
          container,
          domain,
          appearance,
          focusId,
          focusColor,
          profile: resolvedProfile,
          profileReason,
          componentMaximumPixelRatio: maxDevicePixelRatio,
          motionPaused: motionPausedRef.current,
          recenterSequenceBaseline: consumedRecenterSequenceRef.current,
          signal: abortController.signal,
          projectionAnchors,
          onLabelProjection:
            projectionAnchors.length === 0
              ? undefined
              : (snapshot) => {
                  if (
                    abortController.signal.aborted ||
                    rendererGenerationRef.current !== rendererGeneration
                  ) {
                    return;
                  }
                  setLabelProjection(snapshot);
                },
          onStateChange(state, message) {
            if (abortController.signal.aborted) return;
            if (state === "context-lost") {
              setRenderState("context-lost");
              setFallbackMessage(message ?? "The graphics context was interrupted.");
              rendererStatusCallbackRef.current?.("fallback");
            } else {
              setRenderState("ready");
              setFallbackMessage(null);
              rendererStatusCallbackRef.current?.("ready");
            }
          },
          onDiagnostics(diagnostics) {
            diagnosticsCallbackRef.current?.(diagnostics);
          },
          onPerformancePressure() {
            if (renderProfile !== "auto" || abortController.signal.aborted) return;
            setAutomaticProfile((current) => downgradeProfile(current));
          },
        }),
      )
      .then((nextSession) => {
        if (!nextSession) return;
        if (abortController.signal.aborted) {
          nextSession.dispose();
          return;
        }
        session = nextSession;
        controllerRef.current = nextSession.controller;
        nextSession.controller.setMotionPaused(motionPausedRef.current);
        const pendingSequence = getPendingRecenterSequence(
          recenterSequenceRef.current,
          consumedRecenterSequenceRef.current,
        );
        if (pendingSequence !== null) {
          nextSession.controller.recenterSelection(pendingSequence);
          consumedRecenterSequenceRef.current = pendingSequence;
        }
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return;
        const message =
          error instanceof Error
            ? `The real-time universe view could not start: ${error.message}`
            : "The real-time universe view could not start on this device.";
        setFallbackMessage(message);
        setRenderState("error");
        rendererStatusCallbackRef.current?.("error");
      });

    return () => {
      abortController.abort();
      if (rendererGenerationRef.current === rendererGeneration) {
        rendererGenerationRef.current += 1;
      }
      controllerRef.current = null;
      session?.dispose();
    };
  }, [
    appearance,
    domain,
    focusColor,
    focusId,
    maxDevicePixelRatio,
    profileReason,
    projectionAnchors,
    renderProfile,
    resolvedProfile,
  ]);

  function handleViewportKeyDown(event: ReactKeyboardEvent<HTMLCanvasElement>) {
    const controller = controllerRef.current;
    if (!controller || renderState !== "ready") return;

    const orbitStep = event.shiftKey ? 0.24 : 0.1;
    const zoomInFactor = event.shiftKey ? 0.72 : 0.86;
    const zoomOutFactor = event.shiftKey ? 1.38 : 1.16;
    let nextStatus = "";

    switch (event.key) {
      case "ArrowLeft":
        controller.orbitBy(orbitStep, 0);
        nextStatus = "View orbited left.";
        break;
      case "ArrowRight":
        controller.orbitBy(-orbitStep, 0);
        nextStatus = "View orbited right.";
        break;
      case "ArrowUp":
        controller.orbitBy(0, -orbitStep);
        nextStatus = "View orbited upward.";
        break;
      case "ArrowDown":
        controller.orbitBy(0, orbitStep);
        nextStatus = "View orbited downward.";
        break;
      case "+":
      case "=":
      case "PageUp":
        controller.zoomBy(zoomInFactor);
        nextStatus = "View zoomed in.";
        break;
      case "-":
      case "_":
      case "PageDown":
        controller.zoomBy(zoomOutFactor);
        nextStatus = "View zoomed out.";
        break;
      case "Home":
        controller.resetView();
        nextStatus = "View reset to its starting orientation and scale.";
        break;
      case "Escape":
        event.currentTarget.blur();
        setInteractionStatus("Exited the interactive universe viewport.");
        return;
      default:
        return;
    }

    event.preventDefault();
    interactionSequenceRef.current += 1;
    setInteractionStatus(
      `${nextStatus} Keyboard adjustment ${interactionSequenceRef.current}.`,
    );
  }

  const liveStatus =
    statusText ??
    (renderState === "ready"
      ? `${domainDescriptions[domain]} ready in the ${resolvedProfile.name} display profile. Focus the interactive viewport for keyboard orbit and zoom controls.${prefersReducedMotion ? " Automatic animation is paused by your reduced-motion preference." : ""}`
      : renderState === "initializing"
        ? `Preparing the ${resolvedProfile.name} real-time universe view.`
        : fallbackMessage ?? "The real-time universe view is unavailable.");

  return (
    <div
      ref={containerRef}
      className={className}
      data-domain={domain}
      data-appearance={appearance}
      data-render-profile={resolvedProfile.name}
      data-render-state={renderState}
      data-representation="procedural-scientific-display-context"
      aria-describedby={descriptionId}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#02050b",
      }}
    >
      <span id={descriptionId} style={visuallyHiddenStyle}>
        {proceduralDescription}
      </span>
      <span id={instructionsId} style={visuallyHiddenStyle}>
        {viewportKeyboardInstructions}
      </span>
      <span role="status" aria-live="polite" style={visuallyHiddenStyle}>
        {liveStatus}
      </span>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={visuallyHiddenStyle}
      >
        {interactionStatus}
      </span>
      <canvas
        ref={canvasRef}
        role="application"
        aria-label="Interactive 3D universe viewport"
        aria-roledescription="interactive 3D viewport"
        aria-describedby={`${descriptionId} ${instructionsId}`}
        aria-hidden={renderState === "ready" ? undefined : true}
        tabIndex={renderState === "ready" ? 0 : -1}
        onKeyDown={handleViewportKeyDown}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          outlineOffset: "-3px",
          touchAction: "pan-y pinch-zoom",
        }}
      />
      {fallbackMessage ? (
        <div
          role="img"
          aria-label={fallbackMessage}
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: "2rem",
            paddingTop:
              fullView && labelsVisible && labelCandidates?.length
                ? "18svh"
                : "2rem",
            alignItems:
              fullView && labelsVisible && labelCandidates?.length
                ? "start"
                : "center",
            color: "#dceaf2",
            background:
              "radial-gradient(circle at center, #15243b 0%, #02050b 70%)",
            textAlign: "center",
          }}
        >
          {fallbackMessage}
        </div>
      ) : null}
      {labelCandidates?.length ? (
        <Suspense fallback={null}>
          <ProjectedLabelLayer
            candidates={labelCandidates}
            snapshot={labelProjection}
            selectedId={focusId}
            fullView={fullView}
            enabled={labelsVisible}
            renderState={renderState}
            onSelect={selectProjectedLabel}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default UniverseViewport;
