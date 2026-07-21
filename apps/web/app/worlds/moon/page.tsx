import type { Metadata } from "next";
import { MoonSurfaceExperience } from "@/app/components/surface/MoonSurfaceExperience";
import {
  FOUNDATION_COVERAGE_PACK_IDS,
  FOUNDATION_RELEASE_ID,
  getReleaseCoveragePack,
  releaseCoveragePackApiPath,
} from "@/app/lib/releases/coverage";

export const metadata: Metadata = {
  title: "Moon — Apollo 17 Surface",
  description:
    "Inspect the pre-ingest evidence contract for Taurus–Littrow terrain and discrete Apollo 17 photography stations; the current viewport is explicitly procedural.",
};

export default function MoonSurfacePage() {
  const packId = FOUNDATION_COVERAGE_PACK_IDS["apollo-17"];
  const coveragePack = getReleaseCoveragePack(FOUNDATION_RELEASE_ID, packId);
  if (!coveragePack) {
    throw new Error("The exact-release Apollo 17 coverage pack is unavailable");
  }

  return (
    <MoonSurfaceExperience
      coverageApiHref={releaseCoveragePackApiPath(FOUNDATION_RELEASE_ID, packId)}
      coveragePack={coveragePack}
    />
  );
}
