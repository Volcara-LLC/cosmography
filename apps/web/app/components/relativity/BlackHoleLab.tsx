"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  equatorialIscoRadiusRg,
  equatorialPhotonOrbitRadiusRg,
  gravitationalRadiusMeters,
  gravitationalTimeSeconds,
  outerHorizonRadiusRg,
  schwarzschildCriticalCurveDiameterMicroarcseconds,
} from "@cosmography/relativity/kerr";
import { AlertTriangle, CheckCircle2, ExternalLink, Pause, Play } from "lucide-react";
import { UniverseViewport } from "@/app/components/universe/UniverseViewport";
import styles from "@/app/components/relativity/RelativityLab.module.css";

const validators = [
  "Schwarzschild deflection limit",
  "Critical-curve angular scale",
  "Geodesic constants of motion",
  "Step-size convergence",
  "Independent renderer comparison",
] as const;

export function BlackHoleLab() {
  const [spin, setSpin] = useState(0.5);
  const [inclination, setInclination] = useState(60);
  const [paused, setPaused] = useState(false);
  const [appearance, setAppearance] = useState<"scientific" | "immersive">("scientific");

  const metrics = useMemo(() => {
    const massSolar = 4_000_000;
    const distanceParsecs = 8_000;
    return {
      horizon: outerHorizonRadiusRg(spin),
      progradePhoton: equatorialPhotonOrbitRadiusRg(spin, "prograde"),
      retrogradePhoton: equatorialPhotonOrbitRadiusRg(spin, "retrograde"),
      progradeIsco: equatorialIscoRadiusRg(spin, "prograde"),
      retrogradeIsco: equatorialIscoRadiusRg(spin, "retrograde"),
      gravitationalRadiusKm: gravitationalRadiusMeters(massSolar) / 1_000,
      gravitationalTimeSeconds: gravitationalTimeSeconds(massSolar),
      referenceCriticalCurveMicroarcseconds: schwarzschildCriticalCurveDiameterMicroarcseconds(
        massSolar,
        distanceParsecs,
      ),
    };
  }, [spin]);

  return (
    <main className={`${styles.shell} relativity-lab`}>
      <UniverseViewport
        domain="simulation"
        appearance={appearance}
        paused={paused}
        focusId="sagittarius-a-relativity-benchmark"
        focusColor="#ffb45c"
        className="relativity-viewport"
        accessibleLabel="A labeled procedural black-hole placeholder used behind Cosmography's relativity benchmark interface. It is not yet the validated Kerr ray-traced output."
      />
      <div className="relativity-lab__shade" aria-hidden="true" />

      <header className="relativity-header">
        <Link href="/?focus=sagittarius-a-star">← Sagittarius A* atlas</Link>
        <span>RELATIVITY LAB · FOUNDATION BENCHMARK</span>
        <button type="button" onClick={() => setPaused((value) => !value)}>
          {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
          {paused ? "Resume" : "Pause"}
        </button>
      </header>

      <section className="relativity-title">
        <span>Black-hole renderer · truth before spectacle</span>
        <h1>Build the lensing first. Grade the cinema second.</h1>
        <p>
          The scene behind this interface is deliberately labeled as a procedural placeholder. It
          cannot become Cosmography&apos;s “accurate” black hole until every pixel is produced by a
          validated Kerr null-geodesic and emission pipeline.
        </p>
        <div className="relativity-warning">
          <AlertTriangle size={17} aria-hidden="true" />
          Current visual: physics-inspired display context · not a validated ray trace
        </div>
      </section>

      <aside className="relativity-controls" aria-labelledby="scenario-title">
        <div className="relativity-panel-heading">
          <span>Scenario assumptions</span>
          <h2 id="scenario-title">Kerr reference geometry</h2>
        </div>
        <label>
          <span><strong>Dimensionless spin</strong><output>{spin.toFixed(2)}</output></span>
          <input
            type="range"
            min="0"
            max="0.998"
            step="0.001"
            value={spin}
            onChange={(event) => setSpin(Number(event.target.value))}
          />
          <small>Scenario parameter—not an EHT measurement of Sgr A* spin.</small>
        </label>
        <label>
          <span><strong>Camera inclination</strong><output>{inclination}°</output></span>
          <input
            type="range"
            min="0"
            max="90"
            step="1"
            value={inclination}
            onChange={(event) => setInclination(Number(event.target.value))}
          />
          <small>Used by the future camera tetrad and radiative-transfer manifest.</small>
        </label>
        <div className="relativity-appearance" role="group" aria-label="Display treatment">
          <button
            type="button"
            aria-pressed={appearance === "scientific"}
            onClick={() => setAppearance("scientific")}
          >
            Scientific display
          </button>
          <button
            type="button"
            aria-pressed={appearance === "immersive"}
            onClick={() => setAppearance("immersive")}
          >
            Cinematic derivative
          </button>
        </div>
      </aside>

      <section className="relativity-readout" aria-labelledby="geometry-readout-title">
        <div className="relativity-panel-heading">
          <span>Analytic cross-checks · GM/c² units</span>
          <h2 id="geometry-readout-title">Reference radii</h2>
        </div>
        <dl>
          <div><dt>Outer horizon r₊</dt><dd>{metrics.horizon.toFixed(4)} r<sub>g</sub></dd></div>
          <div><dt>Photon orbit · prograde</dt><dd>{metrics.progradePhoton.toFixed(4)} r<sub>g</sub></dd></div>
          <div><dt>Photon orbit · retrograde</dt><dd>{metrics.retrogradePhoton.toFixed(4)} r<sub>g</sub></dd></div>
          <div><dt>ISCO · prograde</dt><dd>{metrics.progradeIsco.toFixed(4)} r<sub>g</sub></dd></div>
          <div><dt>ISCO · retrograde</dt><dd>{metrics.retrogradeIsco.toFixed(4)} r<sub>g</sub></dd></div>
        </dl>
        <div className="relativity-scale-note">
          <span>Nominal Sgr A* scenario · rounded 4 million M☉ at 8 kpc</span>
          <strong>≈ {(metrics.gravitationalRadiusKm / 1_000_000).toFixed(1)} million km / r<sub>g</sub></strong>
          <small>≈ {Math.round(metrics.gravitationalTimeSeconds)} seconds / r<sub>g</sub> · ≈ {Math.round(metrics.referenceCriticalCurveMicroarcseconds / 10) * 10} μas Schwarzschild critical-curve diameter, not an image measurement</small>
        </div>
      </section>

      <section className="relativity-validation" aria-labelledby="validation-title">
        <div className="relativity-panel-heading">
          <span>Publication gate</span>
          <h2 id="validation-title">What “accurate” must prove</h2>
        </div>
        <ul>
          {validators.map((validator) => (
            <li key={validator}>
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>{validator}</span>
              <strong>Required</strong>
            </li>
          ))}
        </ul>
        <p>
          A GRMHD plasma snapshot, radiative-transfer result, EHT observation, and cinematic grade
          are different products. Cosmography stores and labels each separately.
        </p>
      </section>

      <footer className="relativity-sources">
        <span>Primary method and observation references</span>
        <a href="https://doi.org/10.1088/0264-9381/32/6/065001" target="_blank" rel="noreferrer">
          DNGR / Interstellar method paper <ExternalLink size={12} aria-hidden="true" />
        </a>
        <a href="https://eventhorizontelescope.org/for-astronomers/data" target="_blank" rel="noreferrer">
          Event Horizon Telescope data <ExternalLink size={12} aria-hidden="true" />
        </a>
        <a href="https://doi.org/10.21105/joss.07273" target="_blank" rel="noreferrer">
          Krang independent reference <ExternalLink size={12} aria-hidden="true" />
        </a>
      </footer>
    </main>
  );
}
