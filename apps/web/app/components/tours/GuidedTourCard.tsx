"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Telescope, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { GuidedTourResumeControls } from "@/app/components/tours/GuidedTourResumeControls";
import type { AtlasEntity } from "@/app/lib/science/scene";
import type {
  GuidedTour,
  GuidedTourStop,
} from "@/app/lib/education/guided-tour";
import {
  atlasScientificNameFor,
  atlasScientificPresentationFor,
} from "@/app/lib/presentation/atlas-scientific-labels";
import styles from "@/app/components/tours/GuidedTourCard.module.css";

interface GuidedTourCardProps {
  tour: GuidedTour;
  stop: GuidedTourStop;
  entity: AtlasEntity;
  focusSequence: number;
  inert: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onResume: (ordinal: number) => void;
  onOpenEvidence: (trigger: HTMLButtonElement) => void;
  onExit: () => void;
}

export function GuidedTourCard({
  tour,
  stop,
  entity,
  focusSequence,
  inert,
  onPrevious,
  onNext,
  onResume,
  onOpenEvidence,
  onExit,
}: GuidedTourCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirst = stop.ordinal === 1;
  const isLast = stop.ordinal === tour.stops.length;
  const presentation = atlasScientificPresentationFor(entity);

  useEffect(() => {
    if (focusSequence === 0) return;
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }, [focusSequence]);

  return (
    <section
      className={`${styles.card} destination-card tour-card`}
      aria-labelledby="guided-tour-heading"
      data-tour-id={tour.id}
      data-tour-stop={stop.ordinal}
      data-navigation-mode={tour.navigationMode}
      data-advance-mode={tour.advanceMode}
      data-physical-journey-claim={String(tour.physicalJourneyClaim)}
      data-auto-advance={String(tour.autoAdvance)}
      inert={inert}
      aria-hidden={inert || undefined}
    >
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Guided tour · semantic navigation</span>
          <p className={styles.ordinal}>Scale {stop.ordinal} of {tour.stops.length}</p>
          {isLast ? (
            <p className={styles.finalScale}>Final scale in this sequence</p>
          ) : null}
        </div>
        <button type="button" onClick={onExit} aria-label="Exit Seven Scales tour">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.truthRow} aria-label="Scientific context">
        <span>{entity.representation.evidence.replaceAll("-", " ")}</span>
        <span>{stop.sourceIds.length} release-pinned {stop.sourceIds.length === 1 ? "source" : "sources"}</span>
      </div>

      <h1 id="guided-tour-heading" ref={headingRef} tabIndex={-1}>
        {presentation.name}
      </h1>
      <p className={styles.subtitle}>{entity.subtitle}</p>
      <p className={styles.narrative}>{stop.narrative}</p>

      <div className={styles.boundary}>
        <strong>What this view can claim</strong>
        <p>{stop.boundaryStatement}</p>
      </div>

      <div className={styles.prompt}>
        <BookOpen size={17} aria-hidden="true" />
        <p><strong>Look for</strong>{stop.learningPrompt}</p>
      </div>

      <GuidedTourResumeControls
        currentOrdinal={stop.ordinal}
        onResume={onResume}
      />

      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => {
            if (!isFirst) onPrevious();
          }}
          aria-disabled={isFirst}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </button>
        {isLast ? (
          <Link
            className={styles.primary}
            href="/worlds/mars?view=recorded&node=perseverance-landing-sol-4&release=rel_landing_atlas_v0_1_0"
          >
            Enter the recorded Jezero view
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : (
          <button className={styles.primary} type="button" onClick={onNext}>
            Next scale
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={(event) => onOpenEvidence(event.currentTarget)}>
          <Telescope size={16} aria-hidden="true" />
          Evidence
        </button>
      </div>

      <details className={styles.transcript}>
        <summary>Seven-scale transcript</summary>
        <ol>
          {tour.stops.map((tourStop) => (
            <li
              key={tourStop.id}
              aria-current={tourStop.ordinal === stop.ordinal ? "step" : undefined}
            >
              <span>{tourStop.ordinal}</span>
              <span>
                <strong>
                  {atlasScientificNameFor(
                    tourStop.targetEntityId,
                    tourStop.title,
                  )}
                </strong>
                <small>{tourStop.domain.replaceAll("-", " ")}</small>
              </span>
            </li>
          ))}
        </ol>
      </details>

    </section>
  );
}
