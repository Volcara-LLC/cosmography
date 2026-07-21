import type { Metadata } from "next";

import { MarsSurfaceExperience } from "@/app/components/surface/MarsSurfaceExperience";
import {
  FOUNDATION_COVERAGE_PACK_IDS,
  FOUNDATION_RELEASE_ID,
  getReleaseCoveragePack,
  releaseCoveragePackApiPath,
} from "@/app/lib/releases/coverage";

export const metadata: Metadata = {
  title: "Mars — Jezero Surface",
  description:
    "Descend through the evidence-bounded Jezero surface explorer into retained JPL-published Perseverance 360-degree and detail views.",
};

type MarsSurfacePageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MarsSurfacePage({ searchParams }: MarsSurfacePageProps) {
  const parameters = await searchParams;
  const initialRecordedView =
    parameters.view === "recorded" &&
    parameters.node === "perseverance-landing-sol-4" &&
    parameters.release === FOUNDATION_RELEASE_ID &&
    Object.keys(parameters).every(
      (key) => key === "view" || key === "node" || key === "release",
    );
  const packId = FOUNDATION_COVERAGE_PACK_IDS["mars-jezero"];
  const coveragePack = getReleaseCoveragePack(FOUNDATION_RELEASE_ID, packId);
  if (!coveragePack) {
    throw new Error("The exact-release Mars/Jezero coverage pack is unavailable");
  }

  return (
    <MarsSurfaceExperience
      coverageApiHref={releaseCoveragePackApiPath(FOUNDATION_RELEASE_ID, packId)}
      coveragePack={coveragePack}
      initialRecordedView={initialRecordedView}
    />
  );
}
