"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

import styles from "@/app/components/surface/SurfaceShell.module.css";
import type { JezeroRoverStation } from "@/app/data/surface/jezero-recorded-panorama";

const MIN_FOV = 34;
const MAX_FOV = 86;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function wrapHeading(value: number) {
  return ((value % 360) + 360) % 360;
}

type View = { heading: number; fov: number; verticalPosition: number };

export function RoverPanorama360Viewer({ panorama }: { panorama: JezeroRoverStation }) {
  const initialView = panorama.initialView;
  const verticalBounds = panorama.verticalPositionBounds;
  const frameRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>({ ...initialView });
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    heading: number;
    verticalPosition: number;
    frameWidth: number;
    frameHeight: number;
  } | null>(null);
  const [view, setView] = useState<View>({ ...initialView });
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const recordedLocationLabel =
    panorama.productIdentifier === "PIA24264" ? "Perseverance Sol 3" : panorama.shortLabel;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const bounds = frame.getBoundingClientRect();
      setFrameSize({ width: bounds.width, height: bounds.height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    measure();
    return () => observer.disconnect();
  }, []);

  const updateView = (next: View) => {
    const normalized = {
      heading: wrapHeading(next.heading),
      fov: clamp(next.fov, MIN_FOV, MAX_FOV),
      verticalPosition: clamp(
        next.verticalPosition,
        verticalBounds.minimum,
        verticalBounds.maximum,
      ),
    };
    viewRef.current = normalized;
    setView(normalized);
  };

  const nudge = (headingDelta: number, verticalDelta = 0) => {
    updateView({
      ...viewRef.current,
      heading: viewRef.current.heading + headingDelta,
      verticalPosition: viewRef.current.verticalPosition + verticalDelta,
    });
  };

  const zoom = (delta: number) => {
    updateView({ ...viewRef.current, fov: viewRef.current.fov + delta });
  };

  const reset = () => updateView({ ...initialView });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      nudge(-10);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      nudge(10);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      nudge(0, -6);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nudge(0, 6);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoom(-5);
    } else if (event.key === "-") {
      event.preventDefault();
      zoom(5);
    } else if (event.key === "Home" || event.key === "0") {
      event.preventDefault();
      reset();
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      heading: viewRef.current.heading,
      verticalPosition: viewRef.current.verticalPosition,
      frameWidth: Math.max(event.currentTarget.clientWidth, 1),
      frameHeight: Math.max(event.currentTarget.clientHeight, 1),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const degreesPerPixel = viewRef.current.fov / drag.frameWidth;
    updateView({
      ...viewRef.current,
      heading: drag.heading - (event.clientX - drag.x) * degreesPerPixel,
      verticalPosition:
        drag.verticalPosition - ((event.clientY - drag.y) / drag.frameHeight) * 100,
    });
  };

  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoom(event.deltaY > 0 ? 4 : -4);
  };

  const sourceAspect = panorama.dimensions.width / panorama.dimensions.height;
  const stripWidth = frameSize.width > 0 ? (frameSize.width * 360) / view.fov : 0;
  const stripHeight = stripWidth / sourceAspect;
  const stripLeft = frameSize.width / 2 - (view.heading / 360) * stripWidth;
  const overflow = Math.max(stripHeight - frameSize.height, 0);
  const stripTop = overflow > 0
    ? -overflow * (view.verticalPosition / 100)
    : (frameSize.height - stripHeight) / 2;

  return (
    <div className={styles.roverPanoramaFrame} ref={frameRef}>
      <div
        className={styles.roverPanoramaViewport}
        tabIndex={0}
        role="img"
        aria-label={`Look around the recorded ${recordedLocationLabel} horizontal panorama`}
        aria-describedby="rover-panorama-instructions"
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - Home 0"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      >
        {[-1, 0, 1].map((copy) => (
          // Repeating the real cylindrical mosaic makes its recorded 0/360° seam navigable.
          // This intentionally remains a bounded panorama, not a fabricated full sphere.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            aria-hidden="true"
            className={styles.roverPanoramaStrip}
            key={copy}
            src={panorama.localAssetUrl}
            alt=""
            draggable={false}
            style={{
              width: stripWidth,
              height: stripHeight,
              left: stripLeft + copy * stripWidth,
              top: stripTop,
            }}
            onLoad={copy === 0 ? () => setReady(true) : undefined}
            onError={copy === 0 ? () => setFailed(true) : undefined}
          />
        ))}
      </div>

      <div className={styles.roverPanoramaControls}>
        <strong>{panorama.shortLabel}</strong>
        <p id="rover-panorama-instructions">
          Drag in any direction across this recorded rover panorama. Scroll or use plus and
          minus to change the horizontal field of view.
        </p>
        <div role="group" aria-label="Recorded panorama direction and field of view">
          <button type="button" onClick={() => nudge(-15)} aria-label="Look left">←</button>
          <button type="button" onClick={() => nudge(15)} aria-label="Look right">→</button>
          <button type="button" onClick={() => nudge(0, -6)} aria-label="Look up">↑</button>
          <button type="button" onClick={() => nudge(0, 6)} aria-label="Look down">↓</button>
          <button type="button" onClick={() => zoom(-5)} disabled={view.fov <= MIN_FOV} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoom(5)} disabled={view.fov >= MAX_FOV} aria-label="Zoom out">−</button>
          <button type="button" onClick={reset}>Reset</button>
        </div>
        <span aria-live="polite">
          Heading {Math.round(view.heading)}° · field of view {Math.round(view.fov)}°
        </span>
        <small>{panorama.coverage}</small>
        <a href={panorama.officialRecordUrl} target="_blank" rel="noreferrer">Official JPL image record ↗</a>
      </div>

      {!ready && !failed ? <p className={styles.roverPanoramaLoading}>Loading the recorded 360° mosaic…</p> : null}
      {failed ? <p className={styles.roverPanoramaLoading} role="alert">This retained rover mosaic could not be loaded.</p> : null}
    </div>
  );
}
