import { CoverageGapSchema, type CoverageGap } from "./schema";

const gapInput = [
  {
    id: "representative-not-exhaustive",
    scope: "Global facility inventory",
    severity: "critical",
    gap: "This is a representative seed, not a complete register of launch sites, control rooms, tracking stations, observatories, universities, commercial operators, or museums.",
    safeguard: "The interface labels the release incomplete and never turns record count into a claim of global completeness.",
    nextEvidence: "Reconcile agency facility directories, UNOOSA registries, observatory operators, and national research-infrastructure registers into release-scoped manifests.",
  },
  {
    id: "regional-equity",
    scope: "Africa, Latin America, the Middle East, Southeast Asia, Central Asia, and the Pacific",
    severity: "critical",
    gap: "Regional institutions and national programs outside the largest agencies are materially underrepresented.",
    safeguard: "Region filters expose the imbalance; missing regions are not procedurally filled with invented sites.",
    nextEvidence: "Add official national-agency and observatory records with local-language review and in-region institutional consultation.",
  },
  {
    id: "china-russia-metadata",
    scope: "CNSA, Roscosmos, and historical Soviet infrastructure",
    severity: "material",
    gap: "Authoritative English metadata, public-access details, organizational boundaries, and exact facility histories are uneven or limited.",
    safeguard: "Coordinates are deliberately coarse, imagery stays link-only, and uncertain organization relationships are described rather than asserted as ownership.",
    nextEvidence: "Capture Chinese- and Russian-language primary sources, official archival catalogs, and bilateral host-government records with expert translation review.",
  },
  {
    id: "coordinate-authority",
    scope: "Geospatial precision",
    severity: "critical",
    gap: "Many official facility pages publish only an address, town, map, or broad complex; a visual centroid is not a surveyed operational coordinate.",
    safeguard: "Every point carries datum, method, uncertainty, source, and a human-readable note; restricted ranges use regional centroids.",
    nextEvidence: "Ingest official geospatial registries, station logs, ITRF/ILRS/IVS records, or operator-published coordinates without overwriting source precision.",
  },
  {
    id: "public-access-freshness",
    scope: "Tours, museums, launch viewing, accessibility, and safety",
    severity: "material",
    gap: "Opening times, reservation systems, nationality restrictions, health rules, and launch-day closures change faster than scientific facility identity.",
    safeguard: "Access is a typed, dated field with a review deadline and an official-link handoff, never a promise that a visitor can enter today.",
    nextEvidence: "Add a short-TTL visitor connector and preserve accessibility, cost, language, age, transport, and identity requirements separately.",
  },
  {
    id: "indigenous-cultural-context",
    scope: "Indigenous, local-community, sovereignty, and heritage context",
    severity: "critical",
    gap: "Land relationships and community perspectives are not yet complete for many observatories and ranges.",
    safeguard: "Known official acknowledgements, including Wajarri Yamaji Country and Maunakea's cultural significance, travel with the site instead of being hidden in a footnote.",
    nextEvidence: "Add community-authored and host-government sources, language reviewed by relevant communities, and explicit consent and attribution fields.",
  },
  {
    id: "rights-assets",
    scope: "Photos, video, maps, live feeds, logos, and downloadable data",
    severity: "critical",
    gap: "An official web page does not grant blanket rights to redistribute every asset it displays.",
    safeguard: "The seed stores links and factual metadata only; asset ingestion is blocked until licence, credit, derivatives, and offline-use terms are recorded.",
    nextEvidence: "Build an asset-level rights ledger and source-specific ingestion policies before mirroring media or tiles.",
  },
  {
    id: "commercial-university-network",
    scope: "Commercial, university, amateur, and citizen-science infrastructure",
    severity: "material",
    gap: "The current set favors national agencies and major intergovernmental observatories over private launch sites, university control rooms, and community observatories.",
    safeguard: "The page says which institution types are missing and does not use agency coverage as a proxy for all human space activity.",
    nextEvidence: "Add verified operator records, university archive partners, national licensing registers, and moderated community proposals.",
  },
] as const;

export const earthCoverageGaps: CoverageGap[] = CoverageGapSchema.array().parse(gapInput);

