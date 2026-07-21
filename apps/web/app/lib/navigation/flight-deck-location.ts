import type { TravelModeId } from "@/app/lib/navigation/travel";

export type FlightDeckAppearance = "scientific" | "immersive";

export interface FlightDeckLocationInput {
  appearance: FlightDeckAppearance;
  focusSlug: string;
  travelMode: TravelModeId;
  releaseId: string;
}

export function createFlightDeckLocationSearch({
  appearance,
  focusSlug,
  travelMode,
  releaseId,
}: FlightDeckLocationInput): string {
  const params = new URLSearchParams();
  params.set("appearance", appearance);
  params.set("focus", focusSlug);
  params.set("travel", travelMode);
  params.set("release", releaseId);
  return params.toString();
}
