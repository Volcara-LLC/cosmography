import type { Metadata } from "next";
import { VoyagerJourney } from "@/app/components/missions/VoyagerJourney";
import { voyager1 } from "@/app/data/missions/voyager-1";
import {
  FOUNDATION_COVERAGE_PACK_IDS,
  FOUNDATION_RELEASE_ID,
  getReleaseCoveragePack,
  releaseCoveragePackApiPath,
} from "@/app/lib/releases/coverage";
import "./voyager-journey.css";

export const metadata: Metadata = {
  title: "Voyager 1 · Evidence-led journey",
  description:
    "Travel Voyager 1's evidence-backed journey from launch through Jupiter, Saturn, the Pale Blue Dot, the heliopause, its dated public mission state, and its predicted trajectory.",
  alternates: {
    canonical: "/missions/voyager-1",
  },
  openGraph: {
    title: "Voyager 1 · Cosmography",
    description:
      "One journey, reconstructed from official NASA, JPL, NAIF, Horizons, PDS, and Deep Space Network records.",
  },
};

export default function Voyager1Page() {
  const packId = FOUNDATION_COVERAGE_PACK_IDS["voyager-1"];
  const coveragePack = getReleaseCoveragePack(FOUNDATION_RELEASE_ID, packId);
  if (!coveragePack) {
    throw new Error("The exact-release Voyager 1 coverage pack is unavailable");
  }

  return (
    <VoyagerJourney
      coverageApiHref={releaseCoveragePackApiPath(FOUNDATION_RELEASE_ID, packId)}
      coveragePack={coveragePack}
      mission={voyager1}
    />
  );
}
