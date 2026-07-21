"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { RoverPanorama360Viewer } from "@/app/components/surface/RoverPanorama360Viewer";
import {
  jezeroRecordedPanorama,
  jezeroRoverStations,
} from "@/app/data/surface/jezero-recorded-panorama";
import styles from "@/app/components/surface/SurfaceShell.module.css";

const MIN_ZOOM = 1.15;
const MAX_ZOOM = 1.65;
const PAN_STEP = 8;
const ZOOM_STEP = 0.1;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function RecordedPanoramaViewer() {
  const [mode, setMode] = useState<"look-around" | "detail" | "landing-footage">("look-around");
  const [stationId, setStationId] = useState(jezeroRoverStations[0].captureNodeId);
  const [pan, setPan] = useState(50);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const dragState = useRef<{ pointerId: number; x: number; pan: number } | null>(null);
  const offsetPercent = ((50 - pan) / 50) * ((zoom - 1) * 50);
  const station =
    jezeroRoverStations.find((candidate) => candidate.captureNodeId === stationId) ??
    jezeroRoverStations[0];

  const reset = () => {
    setPan(50);
    setZoom(MIN_ZOOM);
  };

  const movePan = (delta: number) => {
    setPan((current) => clamp(current + delta, 0, 100));
  };

  const moveZoom = (delta: number) => {
    setZoom((current) => clamp(Number((current + delta).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      movePan(-PAN_STEP);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      movePan(PAN_STEP);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      moveZoom(ZOOM_STEP);
    } else if (event.key === "-") {
      event.preventDefault();
      moveZoom(-ZOOM_STEP);
    } else if (event.key === "Home" || event.key === "0") {
      event.preventDefault();
      reset();
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragState.current = { pointerId: event.pointerId, x: event.clientX, pan };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const width = event.currentTarget.getBoundingClientRect().width;
    if (width <= 0) return;
    setPan(clamp(drag.pan - ((event.clientX - drag.x) / width) * 100, 0, 100));
  };

  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId !== event.pointerId) return;
    dragState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <>
      <div className={styles.recordedViewModes} role="group" aria-label="Recorded rover views">
        <button
          type="button"
          aria-pressed={mode === "look-around"}
          onClick={() => setMode("look-around")}
        >
          Look around · 360°
        </button>
        <button
          type="button"
          aria-pressed={mode === "detail"}
          onClick={() => setMode("detail")}
        >
          High-resolution detail
        </button>
        <button
          type="button"
          aria-pressed={mode === "landing-footage"}
          onClick={() => setMode("landing-footage")}
        >
          Actual landing footage
        </button>
      </div>

      {mode === "look-around" ? (
        <>
          <label className={styles.recordedStationPicker}>
            <span>Recorded rover station</span>
            <select value={station.captureNodeId} onChange={(event) => setStationId(event.target.value)}>
              {jezeroRoverStations.map((candidate) => (
                <option key={candidate.captureNodeId} value={candidate.captureNodeId}>
                  {candidate.shortLabel}
                </option>
              ))}
            </select>
            <small>3 separate viewpoints · not a continuous drive</small>
          </label>
          <RoverPanorama360Viewer key={station.captureNodeId} panorama={station} />
        </>
      ) : mode === "detail" ? (
        <>
          <div
            className={`surface-viewport__scene ${styles.recordedPanoramaScene}`}
            role="group"
            aria-label="Recorded Mars high-resolution presentation view"
            aria-describedby="recorded-panorama-instructions"
            aria-keyshortcuts="ArrowLeft ArrowRight + - Home 0"
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
          >
            <Image
              className={styles.recordedPanorama}
              src={jezeroRecordedPanorama.localAssetUrl}
              alt="Mastcam-Z recorded view across Perseverance's Sol 4 landing site in Jezero Crater"
              width={jezeroRecordedPanorama.dimensions.width}
              height={jezeroRecordedPanorama.dimensions.height}
              sizes="(max-width: 900px) 100vw, 70vw"
              priority
              unoptimized
              draggable={false}
              style={{ transform: `translateX(${offsetPercent}%) scale(${zoom})` }}
            />
          </div>

          <div className={styles.recordedPanoramaControls} aria-label="Recorded detail controls">
            <p id="recorded-panorama-instructions">
              Drag or use arrow keys to inspect the published detail view. Use plus and minus to change magnification.
            </p>
            <div role="group" aria-label="Pan and magnification">
              <button type="button" onClick={() => movePan(-PAN_STEP)} aria-label="Look left">←</button>
              <button type="button" onClick={() => movePan(PAN_STEP)} aria-label="Look right">→</button>
              <button type="button" onClick={() => moveZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Increase magnification">+</button>
              <button type="button" onClick={() => moveZoom(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Decrease magnification">−</button>
              <button type="button" onClick={reset}>Reset view</button>
            </div>
            <span aria-live="polite">View position {Math.round(pan)} of 100 · {Math.round(zoom * 100)}% magnification</span>
          </div>
        </>
      ) : (
        <div className={styles.landingFootage}>
          <iframe
            src="https://www.youtube-nocookie.com/embed/GUqsH5y1j1M?rel=0"
            title="NASA Perseverance rover landing footage"
            loading="lazy"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          <div>
            <strong>Actual onboard-camera footage · February 18, 2021</strong>
            <span>
              NASA/JPL-Caltech descent and landing video—not a continuous rover drive or a
              simulated Street View. Playback streams from YouTube only after you select this tab.
            </span>
            <a
              href="https://science.nasa.gov/resource/watch-nasas-perseverance-rover-land/"
              target="_blank"
              rel="noreferrer"
            >
              Open the official NASA record
            </a>
          </div>
        </div>
      )}
    </>
  );
}
