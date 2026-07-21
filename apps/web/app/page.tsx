import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AtlasShell } from "@/app/components/atlas/AtlasShell";
import { atlasEntities, atlasRelease } from "@/app/data/atlas";
import { sevenScalesToJezeroTour } from "@/app/data/tours/seven-scales-to-jezero";
import {
  GuidedTourOrdinalError,
  parseGuidedTourOrdinal,
} from "@/app/lib/education/guided-tour";
import { createFlightDeckLocationSearch } from "@/app/lib/navigation/flight-deck-location";
import { TravelModeIdSchema } from "@/app/lib/navigation/travel";

export const metadata: Metadata = {
  title: "Explore the Observable Universe",
  description:
    "Navigate a source-labeled, living atlas of cosmic structure, galaxies, stars, worlds, missions, and humanity's exploration history.",
};

type SearchParamValue = string | string[] | undefined;

interface HomeProps {
  searchParams: Promise<
    Record<string, SearchParamValue> & {
      focus?: SearchParamValue;
      appearance?: SearchParamValue;
      release?: SearchParamValue;
      tour?: SearchParamValue;
      step?: SearchParamValue;
      travel?: SearchParamValue;
    }
  >;
}

const tourQueryFields = new Set([
  "tour",
  "step",
  "focus",
  "appearance",
  "release",
]);
const flightDeckQueryFields = new Set([
  "appearance",
  "focus",
  "travel",
  "release",
]);

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  if (Object.values(params).some(Array.isArray)) {
    notFound();
  }

  const focus = params.focus as string | undefined;
  const appearanceValue = params.appearance as string | undefined;
  const release = params.release as string | undefined;
  const tourSlug = params.tour as string | undefined;
  const step = params.step as string | undefined;
  const travel = params.travel as string | undefined;
  const appearance =
    appearanceValue === "immersive" || appearanceValue === "scientific"
      ? appearanceValue
      : undefined;

  if (tourSlug !== undefined) {
    if (
      Object.keys(params).some((field) => !tourQueryFields.has(field)) ||
      tourSlug !== sevenScalesToJezeroTour.slug ||
      release !== sevenScalesToJezeroTour.releaseId ||
      (appearanceValue !== undefined && appearance === undefined) ||
      focus === undefined ||
      step === undefined
    ) {
      notFound();
    }

    let ordinal: number;
    try {
      ordinal = parseGuidedTourOrdinal(
        step,
        sevenScalesToJezeroTour.stops.length,
      );
    } catch (error) {
      if (error instanceof GuidedTourOrdinalError) notFound();
      throw error;
    }

    const stop = sevenScalesToJezeroTour.stops[ordinal - 1];
    if (!stop || focus !== stop.targetEntityId) {
      notFound();
    }

    return (
      <AtlasShell
        initialFocus={focus}
        initialAppearance={appearance}
        initialTour={sevenScalesToJezeroTour}
        initialTourOrdinal={ordinal}
      />
    );
  }

  if (step !== undefined) {
    notFound();
  }

  if (travel !== undefined) {
    const parsedMode = TravelModeIdSchema.safeParse(travel);
    const entity = atlasEntities.find(
      (candidate) => candidate.slug === focus || candidate.id === focus,
    );
    if (
      Object.keys(params).some((field) => !flightDeckQueryFields.has(field)) ||
      Object.keys(params).length !== flightDeckQueryFields.size ||
      !parsedMode.success ||
      !entity ||
      release !== atlasRelease.id ||
      appearance === undefined
    ) {
      notFound();
    }

    if (focus !== entity.slug) {
      redirect(
        `/?${createFlightDeckLocationSearch({
          appearance,
          focusSlug: entity.slug,
          travelMode: parsedMode.data,
          releaseId: atlasRelease.id,
        })}`,
      );
    }

    return (
      <AtlasShell
        initialFocus={entity.slug}
        initialAppearance={appearance}
        initialTravelMode={parsedMode.data}
      />
    );
  }

  if (release !== undefined && release !== atlasRelease.id) {
    notFound();
  }

  return <AtlasShell initialFocus={focus} initialAppearance={appearance} />;
}
