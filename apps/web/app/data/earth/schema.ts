import { z } from "zod";

export const earthRegions = [
  "Africa",
  "Asia",
  "Europe",
  "Middle East",
  "North America",
  "Oceania",
  "South America",
] as const;

export const earthSiteRoles = [
  "agency-center",
  "launch-site",
  "mission-control",
  "tracking-station",
  "observatory",
  "research-center",
  "museum-public",
  "historical-site",
] as const;

export const earthOperationalStatuses = [
  "operational",
  "mixed-operational-historical",
  "construction-commissioning",
  "historical",
  "status-review-needed",
] as const;

export const publicAccessLevels = [
  "regular-public-access",
  "advance-reservation",
  "occasional-events",
  "virtual-only",
  "restricted",
  "access-review-needed",
] as const;

export const coordinatePrecisionLevels = [
  "official-survey-coordinate",
  "official-published-coordinate",
  "rounded-facility-centroid",
  "official-address-centroid",
  "regional-centroid-only",
] as const;

export const EarthSourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  authority: z.enum([
    "facility-operator",
    "government",
    "intergovernmental",
    "research-institution",
    "museum",
  ]),
  retrievedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scope: z.string().min(1),
  rightsStatus: z.enum([
    "public-domain-with-guidelines",
    "open-with-attribution",
    "collection-specific",
    "link-only-pending-review",
  ]),
  rightsNote: z.string().min(1),
  language: z.string().min(2),
});

export type EarthSource = z.infer<typeof EarthSourceSchema>;

export const EarthOrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  countryOrRegion: z.string().min(1),
  officialUrl: z.string().url(),
});

export type EarthOrganization = z.infer<typeof EarthOrganizationSchema>;

export const EarthSiteSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  country: z.string().min(1),
  locality: z.string().min(1),
  region: z.enum(earthRegions),
  summary: z.string().min(20),
  roles: z.array(z.enum(earthSiteRoles)).min(1),
  status: z.enum(earthOperationalStatuses),
  publicAccess: z.enum(publicAccessLevels),
  accessNote: z.string().min(1),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    altitudeMeters: z.number().optional(),
    datum: z.enum(["WGS84", "NAD83", "source-unspecified"]),
    precision: z.enum(coordinatePrecisionLevels),
    uncertaintyMeters: z.number().nonnegative(),
    sourceId: z.string().min(1),
    note: z.string().min(1),
  }),
  organizations: z.array(
    z.object({
      organizationId: z.string().min(1),
      relation: z.enum([
        "owner",
        "operator",
        "host",
        "partner",
        "funder",
        "historical-operator",
      ]),
    }),
  ).min(1),
  officialUrl: z.string().url(),
  sourceIds: z.array(z.string().min(1)).min(1),
  dataCaveat: z.string().min(1),
  mediaRightsCaveat: z.string().min(1),
  verifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reviewBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tags: z.array(z.string().min(1)),
});

export type EarthSite = z.infer<typeof EarthSiteSchema>;

export const CoverageGapSchema = z.object({
  id: z.string().min(1),
  scope: z.string().min(1),
  severity: z.enum(["critical", "material", "known"]),
  gap: z.string().min(1),
  safeguard: z.string().min(1),
  nextEvidence: z.string().min(1),
});

export type CoverageGap = z.infer<typeof CoverageGapSchema>;

export function assertEarthNetworkFixture(input: {
  sites: unknown;
  sources: unknown;
  organizations: unknown;
  gaps: unknown;
}) {
  const sources = EarthSourceSchema.array().parse(input.sources);
  const organizations = EarthOrganizationSchema.array().parse(input.organizations);
  const sites = EarthSiteSchema.array().parse(input.sites);
  const gaps = CoverageGapSchema.array().parse(input.gaps);

  const sourceIds = new Set(sources.map((source) => source.id));
  const organizationIds = new Set(organizations.map((organization) => organization.id));

  for (const site of sites) {
    for (const sourceId of [site.coordinates.sourceId, ...site.sourceIds]) {
      if (!sourceIds.has(sourceId)) {
        throw new Error(`Earth site ${site.id} references unknown source ${sourceId}`);
      }
    }

    for (const participation of site.organizations) {
      if (!organizationIds.has(participation.organizationId)) {
        throw new Error(
          `Earth site ${site.id} references unknown organization ${participation.organizationId}`,
        );
      }
    }
  }

  return { sites, sources, organizations, gaps };
}

