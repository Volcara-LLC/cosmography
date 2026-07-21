"use client";

import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

import type { FoundationProjectedLabel } from "@/app/data/labels/foundation-projected-labels";
import type { LabelProjectionSnapshot } from "@/app/components/universe/runtime/labelProjection";

import {
  defaultLabelReservedRects,
  layoutProjectedLabels,
  type LaidOutProjectedLabel,
} from "./label-layout";
import styles from "./ProjectedLabelLayer.module.css";

export interface ProjectedLabelLayerProps {
  candidates: readonly FoundationProjectedLabel[];
  snapshot: LabelProjectionSnapshot | null;
  selectedId: string;
  fullView: boolean;
  enabled: boolean;
  renderState: "initializing" | "ready" | "fallback" | "error" | "context-lost";
  onSelect?: (id: string, trigger: HTMLButtonElement) => void;
}

const FALLBACK_LIMIT = 8;

function labelAccessibleName(label: FoundationProjectedLabel): string {
  return [label.name, label.designation, label.kindLabel]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function labelStyle(label: LaidOutProjectedLabel): CSSProperties {
  return {
    left: `${label.left}px`,
    top: `${label.top}px`,
    width: `${label.width}px`,
    minHeight: `${Math.max(44, label.height)}px`,
    "--label-accent": label.candidate.color,
  } as CSSProperties;
}

function anchorStyle(label: LaidOutProjectedLabel): CSSProperties {
  return {
    left: `${label.anchorX}px`,
    top: `${label.anchorY}px`,
    "--label-accent": label.candidate.color,
  } as CSSProperties;
}

function fallbackCandidates(
  candidates: readonly FoundationProjectedLabel[],
  selectedId: string,
): readonly FoundationProjectedLabel[] {
  return [...candidates]
    .sort((left, right) => {
      if (left.id === selectedId) return -1;
      if (right.id === selectedId) return 1;
      if (right.priority !== left.priority) return right.priority - left.priority;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    })
    .slice(0, FALLBACK_LIMIT);
}

function selectLabel(
  event: MouseEvent<HTMLButtonElement>,
  labelId: string,
  onSelect: ProjectedLabelLayerProps["onSelect"],
) {
  onSelect?.(labelId, event.currentTarget);
}

function useCompactFallback(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1024px)");
    const frame = window.requestAnimationFrame(() => setCompact(query.matches));
    const update = (event: MediaQueryListEvent) => setCompact(event.matches);
    query.addEventListener("change", update);
    return () => {
      window.cancelAnimationFrame(frame);
      query.removeEventListener("change", update);
    };
  }, []);

  return compact;
}

function useShortLandscapeMode(): boolean | null {
  const [shortLandscape, setShortLandscape] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia(
      "(min-width: 560px) and (max-width: 760px) and (max-height: 760px), " +
        "(min-width: 761px) and (max-width: 1180px), " +
        "(min-width: 1181px) and (max-height: 819px)",
    );
    const frame = window.requestAnimationFrame(() => setShortLandscape(query.matches));
    const update = (event: MediaQueryListEvent) => setShortLandscape(event.matches);
    query.addEventListener("change", update);
    return () => {
      window.cancelAnimationFrame(frame);
      query.removeEventListener("change", update);
    };
  }, []);

  return shortLandscape;
}

function FoundationDestinationList({
  candidates,
  selectedId,
  descriptionId,
  onSelect,
}: {
  candidates: readonly FoundationProjectedLabel[];
  selectedId: string;
  descriptionId: string;
  onSelect: ProjectedLabelLayerProps["onSelect"];
}) {
  return (
    <ul className={styles.fallbackList}>
      {candidates.map((label) => (
        <li key={label.id}>
          <button
            type="button"
            data-projected-label-id={label.id}
            aria-current={label.id === selectedId ? "location" : undefined}
            aria-label={labelAccessibleName(label)}
            aria-describedby={descriptionId}
            disabled={!onSelect}
            onClick={(event) => selectLabel(event, label.id, onSelect)}
          >
            <span
              className={styles.fallbackSwatch}
              style={{ "--label-accent": label.color } as CSSProperties}
              aria-hidden="true"
            />
            <span className={styles.fallbackCopy}>
              <strong className={styles.primary}>{label.name}</strong>
              {label.designation ? (
                <span className={styles.designation}>{label.designation}</span>
              ) : null}
              <span className={styles.detail}>{label.kindLabel}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function FoundationInterfaceList({
  candidates,
  selectedId,
  headingId,
  descriptionId,
  description,
  fullView,
  compactDisclosure,
  emptyProjection,
  onSelect,
}: {
  candidates: readonly FoundationProjectedLabel[];
  selectedId: string;
  headingId: string;
  descriptionId: string;
  description: string;
  fullView: boolean;
  compactDisclosure: boolean;
  emptyProjection: boolean;
  onSelect: ProjectedLabelLayerProps["onSelect"];
}) {
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0];

  if (compactDisclosure && !fullView && selected) {
    return (
      <section
        className={`${styles.layer} ${styles.fallbackLayer}`}
        aria-label="Foundation destinations"
      >
        <details className={`${styles.fallback} ${styles.compactFallback}`}>
          <summary
            className={styles.compactSummary}
            aria-current="location"
          >
            <span
              className={styles.fallbackSwatch}
              style={{ "--label-accent": selected.color } as CSSProperties}
              aria-hidden="true"
            />
            <span className={styles.compactSummaryCopy}>
              <strong>Foundation destinations</strong>
              <span>Current: {selected.name} · interface list, not sky positions</span>
            </span>
            <span className={styles.compactDisclosureIcon} aria-hidden="true">+</span>
          </summary>
          <div className={styles.compactDisclosureBody}>
            <header className={styles.fallbackHeader}>
              <h2 id={headingId}>Foundation destinations</h2>
              <p id={descriptionId}>{description}</p>
            </header>
            <FoundationDestinationList
              candidates={candidates}
              selectedId={selectedId}
              descriptionId={descriptionId}
              onSelect={onSelect}
            />
          </div>
        </details>
      </section>
    );
  }

  return (
    <section
      className={`${styles.layer} ${styles.fallbackLayer} ${fullView ? styles.fullView : ""}`}
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
    >
      <div
        className={`${styles.fallback} ${emptyProjection ? styles.emptyFallback : ""} ${fullView ? styles.fallbackFullView : ""}`}
      >
        <header className={styles.fallbackHeader}>
          <h2 id={headingId}>Foundation destinations</h2>
          <p id={descriptionId}>{description}</p>
        </header>
        <FoundationDestinationList
          candidates={candidates}
          selectedId={selectedId}
          descriptionId={descriptionId}
          onSelect={onSelect}
        />
      </div>
    </section>
  );
}

export function ProjectedLabelLayer({
  candidates,
  snapshot,
  selectedId,
  fullView,
  enabled,
  renderState,
  onSelect,
}: ProjectedLabelLayerProps) {
  const compactFallback = useCompactFallback();
  const shortLandscapeMode = useShortLandscapeMode();
  const fallbackHeadingId = useId();
  const fallbackDescriptionId = useId();
  const projectionDescriptionId = useId();
  const layoutResult = useMemo(() => {
    if (!enabled || renderState !== "ready" || !snapshot) {
      return { tier: "overview" as const, labels: [] as readonly LaidOutProjectedLabel[] };
    }

    const compact = snapshot.width <= 760 || shortLandscapeMode === true;
    const unresolvedConstrainedViewport =
      shortLandscapeMode === null &&
      (snapshot.height <= 819 || (snapshot.width >= 560 && snapshot.width <= 1180));
    if (!fullView && unresolvedConstrainedViewport) {
      return { tier: snapshot.zoomTier, labels: [] as readonly LaidOutProjectedLabel[] };
    }
    const defaultReserved = defaultLabelReservedRects({
      width: snapshot.width,
      height: snapshot.height,
      fullView,
      compact,
      shortLandscape: shortLandscapeMode === true,
    });
    return layoutProjectedLabels({
      candidates,
      anchors: snapshot.anchors.map((anchor) => ({
        id: anchor.id,
        x: anchor.x,
        y: anchor.y,
        inFront: anchor.inFront,
        inFrustum: anchor.inFrustum,
      })),
      selectedId,
      normalizedZoom: snapshot.normalizedZoom,
      resolvedTier: snapshot.zoomTier,
      viewportWidth: snapshot.width,
      viewportHeight: snapshot.height,
      reservedRects: defaultReserved,
      compact,
    });
  }, [
    candidates,
    enabled,
    fullView,
    renderState,
    selectedId,
    shortLandscapeMode,
    snapshot,
  ]);

  const layout = layoutResult.labels;

  const boundedFallbackCandidates = useMemo(
    () => fallbackCandidates(candidates, selectedId),
    [candidates, selectedId],
  );

  if (!enabled || candidates.length === 0) return null;

  if (
    renderState === "fallback" ||
    renderState === "error" ||
    renderState === "context-lost"
  ) {
    return (
      <FoundationInterfaceList
        candidates={boundedFallbackCandidates}
        selectedId={selectedId}
        headingId={fallbackHeadingId}
        descriptionId={fallbackDescriptionId}
        description="Interface list—not sky positions. These bounded foundation destinations remain selectable while the real-time view is unavailable."
        fullView={fullView}
        compactDisclosure={compactFallback || shortLandscapeMode === true}
        emptyProjection={false}
        onSelect={onSelect}
      />
    );
  }

  if (renderState !== "ready" || !snapshot) return null;

  if (layout.length === 0) {
    return (
      <FoundationInterfaceList
        candidates={boundedFallbackCandidates}
        selectedId={selectedId}
        headingId={fallbackHeadingId}
        descriptionId={fallbackDescriptionId}
        description="No release-backed anchor has a clear in-frame placement. Interface list—not sky positions."
        fullView={fullView}
        compactDisclosure={compactFallback || shortLandscapeMode === true}
        emptyProjection
        onSelect={onSelect}
      />
    );
  }

  return (
    <div
      className={`${styles.layer} ${fullView ? styles.fullView : ""}`}
      role="group"
      aria-label="Foundation names and designations"
      aria-describedby={projectionDescriptionId}
      data-label-projection-sequence={snapshot.sequence}
    >
      <span id={projectionDescriptionId} className="sr-only">
        Scientifically reviewed public labels remain bound to exact-release identities at
        semantic display anchors. Their screen placement is not astrometry, a physical pose,
        physical proximity, catalog streaming, or complete coverage.
      </span>
      {layout.map((label) => (
        <div key={label.candidate.id}>
          <span
            className={styles.anchor}
            style={anchorStyle(label)}
            aria-hidden="true"
          />
          <button
            type="button"
            className={styles.label}
            style={labelStyle(label)}
            data-projected-label-id={label.candidate.id}
            data-label-placement={label.placement}
            aria-current={label.candidate.id === selectedId ? "location" : undefined}
            aria-label={labelAccessibleName(label.candidate)}
            aria-describedby={projectionDescriptionId}
            disabled={!onSelect}
            onClick={(event) => selectLabel(event, label.candidate.id, onSelect)}
          >
            <span className={styles.marker} aria-hidden="true" />
            <span className={styles.copy}>
              <strong className={styles.primary}>{label.candidate.name}</strong>
              {label.candidate.designation ? (
                <span className={styles.designation}>{label.candidate.designation}</span>
              ) : null}
              <span className={styles.detail}>{label.candidate.kindLabel}</span>
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
