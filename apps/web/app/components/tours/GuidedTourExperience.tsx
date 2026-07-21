"use client";

import { useEffect, useRef, useState } from "react";

import { GuidedTourCard } from "@/app/components/tours/GuidedTourCard";
import { notifyCosmographyLocationChange } from "@/app/lib/client/location";
import { atlasEntities, atlasRelease } from "@/app/data/atlas";
import { sevenScalesToJezeroTour } from "@/app/data/tours/seven-scales-to-jezero";
import {
  createGuidedTourLocationSearch,
  type GuidedTour,
} from "@/app/lib/education/guided-tour";
import { atlasScientificNameFor } from "@/app/lib/presentation/atlas-scientific-labels";

interface GuidedTourExperienceProps {
  initialTour?: GuidedTour;
  initialTourOrdinal?: number;
  focusOnMount: boolean;
  fullView: boolean;
  onSelectEntity: (entityId: string) => void;
  onOpenEvidence: (trigger: HTMLButtonElement) => void;
  onStatus: (message: string) => void;
  onExit: (selectedName: string) => void;
}

function replaceTourLocation(tour: GuidedTour, ordinal: number) {
  const query = createGuidedTourLocationSearch(
    tour,
    ordinal,
    window.location.search,
  );
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
  notifyCosmographyLocationChange();
}

function statusMessage(tour: GuidedTour, ordinal: number, name: string) {
  return `Scale ${ordinal} of ${tour.stops.length}: ${name}. Semantic navigation only; no physical journey or elapsed travel is being shown.`;
}

export function GuidedTourExperience({
  initialTour,
  initialTourOrdinal,
  focusOnMount,
  fullView,
  onSelectEntity,
  onOpenEvidence,
  onStatus,
  onExit,
}: GuidedTourExperienceProps) {
  const tour = initialTour ?? sevenScalesToJezeroTour;
  const [ordinal, setOrdinal] = useState(initialTourOrdinal ?? 1);
  const [focusSequence, setFocusSequence] = useState(focusOnMount ? 1 : 0);
  const stop = tour.stops[ordinal - 1];
  const entity = atlasEntities.find((candidate) => candidate.id === stop?.targetEntityId);
  const presentationName = entity
    ? atlasScientificNameFor(entity.id, entity.name)
    : "";
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!stop || !entity) return;
    const isInitialRender = !mountedRef.current;
    mountedRef.current = true;
    onStatus(statusMessage(tour, ordinal, presentationName));
    if (isInitialRender && !focusOnMount) return;
    onSelectEntity(stop.targetEntityId);
    replaceTourLocation(tour, ordinal);
  }, [entity, focusOnMount, onSelectEntity, onStatus, ordinal, presentationName, stop, tour]);

  if (!stop || !entity) return null;
  const selectedEntity = entity;

  function selectOrdinal(nextOrdinal: number) {
    const nextStop = tour.stops[nextOrdinal - 1];
    if (!nextStop) return;
    setOrdinal(nextOrdinal);
    setFocusSequence((current) => current + 1);
  }

  function exitTour() {
    const params = new URLSearchParams(window.location.search);
    params.delete("tour");
    params.delete("step");
    params.delete("travel");
    params.set("focus", selectedEntity.id);
    params.set("release", atlasRelease.id);
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
    notifyCosmographyLocationChange();
    onExit(presentationName);
  }

  return (
    <GuidedTourCard
      tour={tour}
      stop={stop}
      entity={entity}
      focusSequence={focusSequence}
      inert={fullView}
      onPrevious={() => selectOrdinal(ordinal - 1)}
      onNext={() => selectOrdinal(ordinal + 1)}
      onResume={selectOrdinal}
      onOpenEvidence={onOpenEvidence}
      onExit={exitTour}
    />
  );
}
