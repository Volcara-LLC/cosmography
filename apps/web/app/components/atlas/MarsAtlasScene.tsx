"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import {
  MarsGlobeExplorer,
  type MarsGlobeExplorerHandle,
} from "@/app/components/surface/MarsGlobeExplorer";
import { RecordedPanoramaViewer } from "@/app/components/surface/RecordedPanoramaViewer";
import shellStyles from "@/app/components/surface/SurfaceShell.module.css";

type MarsAtlasSceneProps = {
  readonly onDetailTierChange: (tier: "overview" | "regional") => void;
};

export type MarsAtlasSceneHandle = {
  readonly exploreJezero: () => void;
  readonly showOverview: () => void;
  readonly openSurface: () => void;
};

export const MarsAtlasScene = forwardRef<MarsAtlasSceneHandle, MarsAtlasSceneProps>(
  function MarsAtlasScene({ onDetailTierChange }, ref) {
  const [surfaceOpen, setSurfaceOpen] = useState(false);
  const globeRef = useRef<MarsGlobeExplorerHandle>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);

  useImperativeHandle(ref, () => ({
    exploreJezero: () => globeRef.current?.exploreJezero(),
    showOverview: () => globeRef.current?.showOverview(),
    openSurface: () => setSurfaceOpen(true),
  }), []);

  useEffect(() => {
    if (!surfaceOpen) return;
    priorFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setSurfaceOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      priorFocusRef.current?.focus();
    };
  }, [surfaceOpen]);

  return (
    <>
      <MarsGlobeExplorer
        ref={globeRef}
        embedded
        onDetailTierChange={onDetailTierChange}
        onEnterSurface={() => setSurfaceOpen(true)}
      />

      {surfaceOpen ? (
        <div
          className={shellStyles.immersivePanoramaDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="atlas-mars-panorama-title"
        >
          <div className={shellStyles.immersivePanoramaHeader}>
            <div>
              <p>Observed · recorded presentation derivative</p>
              <h2 id="atlas-mars-panorama-title">Perseverance rover views · Sols 3–474</h2>
              <span>Jezero Crater · three discrete recorded panoramas plus landing detail · physical poses withheld</span>
            </div>
            <button ref={closeRef} type="button" onClick={() => setSurfaceOpen(false)}>
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
    </>
  );
  },
);
