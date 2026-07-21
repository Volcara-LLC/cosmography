import { earthCoverageGaps } from "./coverage-gaps";
import { earthOrganizations, earthSources } from "./registry";
import { assertEarthNetworkFixture } from "./schema";
import { earthSites } from "./sites";

const validated = assertEarthNetworkFixture({
  sites: earthSites,
  sources: earthSources,
  organizations: earthOrganizations,
  gaps: earthCoverageGaps,
});

export const earthNetwork = {
  releaseId: "earth-network-seed-0.1.0",
  generatedAt: "2026-07-19T00:00:00Z",
  status: "representative-incomplete",
  ...validated,
} as const;

export {
  earthCoverageGaps,
  earthOrganizations,
  earthSites,
  earthSources,
};

export * from "./schema";

