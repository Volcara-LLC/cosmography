import {
  foundationLabelDisplayPeers,
  type FoundationProjectedLabel,
} from "@/app/data/labels/foundation-projected-labels";
import {
  resolveProjectionZoomTier,
  type ProjectionZoomTier,
} from "@/app/components/universe/runtime/labelProjection";

export type LabelZoomTier = ProjectionZoomTier;

export interface LabelLayoutAnchor {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly inFront: boolean;
  readonly inFrustum: boolean;
}

export interface LabelLayoutRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface LaidOutProjectedLabel {
  readonly candidate: FoundationProjectedLabel;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly placement: "right" | "left" | "above" | "below";
}

export interface ProjectedLabelLayoutResult {
  readonly tier: LabelZoomTier;
  readonly labels: readonly LaidOutProjectedLabel[];
}

const zoomCaps: Readonly<Record<LabelZoomTier, number>> = Object.freeze({
  overview: 1,
  context: 2,
  detail: 6,
});

export function resolveLabelZoomTier(
  normalizedZoom: number,
  previousTier: LabelZoomTier = "overview",
): LabelZoomTier {
  return resolveProjectionZoomTier(normalizedZoom, previousTier);
}

function codePointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function selectVisibleLabelCandidates({
  candidates,
  selectedId,
  normalizedZoom,
  previousTier = "overview",
  resolvedTier,
  compact = false,
}: {
  candidates: readonly FoundationProjectedLabel[];
  selectedId: string;
  normalizedZoom: number;
  previousTier?: LabelZoomTier;
  resolvedTier?: LabelZoomTier;
  compact?: boolean;
}): { tier: LabelZoomTier; candidates: readonly FoundationProjectedLabel[] } {
  const ranked = rankLabelCandidates({
    candidates,
    selectedId,
    normalizedZoom,
    previousTier,
    resolvedTier,
    compact,
  });
  return {
    tier: ranked.tier,
    candidates: Object.freeze(ranked.candidates.slice(0, ranked.cap)),
  };
}

function rankLabelCandidates({
  candidates,
  selectedId,
  normalizedZoom,
  previousTier = "overview",
  resolvedTier,
  compact = false,
}: {
  candidates: readonly FoundationProjectedLabel[];
  selectedId: string;
  normalizedZoom: number;
  previousTier?: LabelZoomTier;
  resolvedTier?: LabelZoomTier;
  compact?: boolean;
}): {
  tier: LabelZoomTier;
  candidates: readonly FoundationProjectedLabel[];
  cap: number;
} {
  const tier = resolvedTier ?? resolveLabelZoomTier(normalizedZoom, previousTier);
  const selected = candidates.find((candidate) => candidate.id === selectedId);
  const selectedSection = selected?.section;
  const related = new Set(foundationLabelDisplayPeers[selectedId] ?? []);
  const ordered = [...candidates].sort((left, right) => {
    if (left.id === selectedId) return right.id === selectedId ? 0 : -1;
    if (right.id === selectedId) return 1;
    const relationshipDifference = Number(related.has(right.id)) - Number(related.has(left.id));
    if (relationshipDifference) return relationshipDifference;
    const sectionDifference =
      Number(right.section === selectedSection) - Number(left.section === selectedSection);
    if (sectionDifference) return sectionDifference;
    const priorityDifference = right.priority - left.priority;
    return priorityDifference || codePointCompare(left.id, right.id);
  });
  const cap = Math.min(zoomCaps[tier], compact ? 5 : 8);
  return { tier, candidates: Object.freeze(ordered), cap };
}

function overlaps(left: LabelLayoutRect, right: LabelLayoutRect, gap = 8): boolean {
  return !(
    left.left + left.width + gap <= right.left ||
    right.left + right.width + gap <= left.left ||
    left.top + left.height + gap <= right.top ||
    right.top + right.height + gap <= left.top
  );
}

function labelSize(candidate: FoundationProjectedLabel): { width: number; height: number } {
  const longestLine = Math.max(
    candidate.name.length,
    candidate.designation?.length ?? 0,
    candidate.kindLabel.length,
  );
  return {
    width: Math.min(228, Math.max(132, 54 + longestLine * 7.2)),
    height: candidate.designation ? 70 : 54,
  };
}

function placementRects(
  anchor: LabelLayoutAnchor,
  size: { width: number; height: number },
): readonly (LabelLayoutRect & { placement: LaidOutProjectedLabel["placement"] })[] {
  const offset = 12;
  return [
    { left: anchor.x + offset, top: anchor.y - size.height / 2, ...size, placement: "right" },
    { left: anchor.x - size.width - offset, top: anchor.y - size.height / 2, ...size, placement: "left" },
    { left: anchor.x - size.width / 2, top: anchor.y - size.height - offset, ...size, placement: "above" },
    { left: anchor.x - size.width / 2, top: anchor.y + offset, ...size, placement: "below" },
  ];
}

export function layoutProjectedLabels({
  candidates,
  anchors,
  selectedId,
  normalizedZoom,
  previousTier = "overview",
  resolvedTier,
  viewportWidth,
  viewportHeight,
  reservedRects = [],
  compact = false,
  padding = 12,
}: {
  candidates: readonly FoundationProjectedLabel[];
  anchors: readonly LabelLayoutAnchor[];
  selectedId: string;
  normalizedZoom: number;
  previousTier?: LabelZoomTier;
  resolvedTier?: LabelZoomTier;
  viewportWidth: number;
  viewportHeight: number;
  reservedRects?: readonly LabelLayoutRect[];
  compact?: boolean;
  padding?: number;
}): ProjectedLabelLayoutResult {
  const ranked = rankLabelCandidates({
    candidates,
    selectedId,
    normalizedZoom,
    previousTier,
    resolvedTier,
    compact,
  });
  const anchorById = new Map(anchors.map((anchor) => [anchor.id, anchor] as const));
  const occupied: LabelLayoutRect[] = [];
  const labels: LaidOutProjectedLabel[] = [];

  if (!(viewportWidth > 0) || !(viewportHeight > 0)) {
    return Object.freeze({ tier: ranked.tier, labels: Object.freeze(labels) });
  }

  for (const candidate of ranked.candidates) {
    if (labels.length >= ranked.cap) break;
    const anchor = anchorById.get(candidate.id);
    if (
      !anchor ||
      !anchor.inFront ||
      !anchor.inFrustum ||
      !Number.isFinite(anchor.x) ||
      !Number.isFinite(anchor.y)
    ) {
      continue;
    }
    const size = labelSize(candidate);
    const placement = placementRects(anchor, size).find((rect) => {
      const insideViewport =
        rect.left >= padding &&
        rect.top >= padding &&
        rect.left + rect.width <= viewportWidth - padding &&
        rect.top + rect.height <= viewportHeight - padding;
      return (
        insideViewport &&
        reservedRects.every((reserved) => !overlaps(rect, reserved, 0)) &&
        occupied.every((accepted) => !overlaps(rect, accepted))
      );
    });
    if (!placement) continue;
    occupied.push(placement);
    labels.push(
      Object.freeze({
        candidate,
        left: placement.left,
        top: placement.top,
        width: placement.width,
        height: placement.height,
        anchorX: anchor.x,
        anchorY: anchor.y,
        placement: placement.placement,
      }),
    );
  }

  return Object.freeze({ tier: ranked.tier, labels: Object.freeze(labels) });
}

export function defaultLabelReservedRects({
  width,
  height,
  fullView,
  compact,
  shortLandscape,
}: {
  width: number;
  height: number;
  fullView: boolean;
  compact: boolean;
  shortLandscape: boolean;
}): readonly LabelLayoutRect[] {
  if (fullView) {
    return Object.freeze([
      {
        left: Math.max(0, width - 112),
        top: 0,
        width: Math.min(112, width),
        height: Math.min(112, height),
      },
    ]);
  }
  if (compact) {
    if (shortLandscape) {
      const compactTop = Math.min(height, 128);
      return Object.freeze([
        { left: 0, top: 0, width, height: compactTop },
        {
          left: 0,
          top: compactTop,
          width: Math.min(372, width),
          height: Math.max(0, height - compactTop),
        },
        {
          left: Math.max(0, width - 120),
          top: compactTop,
          width: Math.min(120, width),
          height: Math.min(152, Math.max(0, height - compactTop)),
        },
      ]);
    }
    const compactTop = Math.min(height, 190);
    const toolWidth = Math.min(300, width);
    const destinationTop = Math.min(height, 270);
    return Object.freeze([
      { left: 0, top: 0, width, height: compactTop },
      {
        left: Math.max(0, width - toolWidth),
        top: compactTop,
        width: toolWidth,
        height: Math.min(70, Math.max(0, height - compactTop)),
      },
      {
        left: 0,
        top: destinationTop,
        width,
        height: Math.max(0, height - destinationTop),
      },
    ]);
  }

  const headerHeight = Math.min(height, 160);
  const lowerChromeTop = Math.max(headerHeight, height - 168);
  const railInset = Math.round(Math.min(40, Math.max(14.4, width * 0.024)));
  const railLeft = Math.max(0, railInset - 8);
  const tourDestinationLeft = Math.min(164, Math.max(144, width * 0.115 - 12));
  const destinationLeft = railLeft;
  const destinationTop = headerHeight;
  const destinationBottom = Math.max(destinationTop, height - 96);
  const destinationRight = Math.min(width, tourDestinationLeft + 404);
  const toolsInset = Math.round(Math.min(29, Math.max(13, width * 0.018)));
  const toolsLeft = Math.max(0, width - toolsInset - 76);
  const toolsHeight = Math.min(380, Math.max(0, height - headerHeight));
  const toolsTop = Math.max(headerHeight, (height - toolsHeight) / 2);
  return Object.freeze([
    { left: 0, top: 0, width, height: headerHeight },
    {
      left: railLeft,
      top: headerHeight,
      width: Math.min(136, Math.max(0, width - railLeft)),
      height: Math.max(0, Math.min(height, 512) - headerHeight),
    },
    {
      left: toolsLeft,
      top: toolsTop,
      width: Math.min(84, Math.max(0, width - toolsLeft)),
      height: toolsHeight,
    },
    {
      left: Math.min(destinationLeft, width),
      top: destinationTop,
      width: Math.max(0, destinationRight - Math.min(destinationLeft, width)),
      height: Math.max(0, destinationBottom - destinationTop),
    },
    {
      left: Math.max(0, width - 600),
      top: lowerChromeTop,
      width: Math.min(600, width),
      height: Math.max(0, height - lowerChromeTop),
    },
  ]);
}
