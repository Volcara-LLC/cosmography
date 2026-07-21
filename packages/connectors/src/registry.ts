import {
  SourcePassportSchema,
  type SourcePassport,
} from "./contracts";

export const REGISTRY_CHECKED_ON = "2026-07-19";
export const HORIZONS_DOCUMENTATION_VERSION = "1.3";
export const HORIZONS_OBSERVED_SIGNATURE_VERSION = "1.2";

const storage = {
  controlPlaneStore: "d1",
  controlPlaneMayContain: [
    "source-passport",
    "cursor",
    "run-status",
    "checksum",
    "object-pointer",
    "normalized-small-metadata",
  ],
  bulkScienceDataInD1: false,
  bulkPayloadStores: [
    "r2",
    "external-authority",
    "specialized-service",
  ],
} as const;

const retry = {
  maxAttempts: 5,
  strategy: "exponential",
  initialDelayMs: 1_000,
  maxDelayMs: 60_000,
  jitter: "full",
  retryHttpStatuses: [408, 425, 429, 500, 502, 503, 504],
  retryNetworkErrors: true,
  honorRetryAfter: true,
} as const;

function killSwitch(sourceId: string, defaultEnabled = true) {
  return {
    envKey: `COSMOGRAPHY_SOURCE_${sourceId
      .replaceAll("-", "_")
      .toUpperCase()}_ENABLED`,
    defaultEnabled,
    circuitBreakerFailures: 5,
    cooldown: "PT15M",
    manualOverrideAudited: true,
  } as const;
}

function quota(
  notes: string,
  overrides: Partial<{
    publicationStatus:
      | "published"
      | "partially-published"
      | "not-published";
    localMaxConcurrency: number;
    localMinDelayMs: number;
    localMaxRowsPerRequest: number;
  }> = {},
) {
  return {
    publicationStatus: overrides.publicationStatus ?? "not-published",
    sourceLimitNotes: notes,
    localMaxConcurrency: overrides.localMaxConcurrency ?? 2,
    localMinDelayMs: overrides.localMinDelayMs ?? 1_000,
    ...(overrides.localMaxRowsPerRequest === undefined
      ? {}
      : { localMaxRowsPerRequest: overrides.localMaxRowsPerRequest }),
    prohibitUnboundedQueries: true,
  } as const;
}

function passport(value: unknown): SourcePassport {
  return SourcePassportSchema.parse(value);
}

const naifSpice = passport({
  sourceId: "naif-spice",
  displayName: "NAIF SPICE",
  authority: "NASA/JPL Navigation and Ancillary Information Facility",
  agencyNeutralGroup: "planetary-geometry",
  registryTier: "core",
  lifecycle: "active",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "kernel-archive",
      protocol: "http-artifact",
      baseUrl: "https://naif.jpl.nasa.gov/pub/naif/",
      readOnly: true,
      browserSafe: false,
      notes: "Fetch only explicitly selected kernels or small index files; never mirror the archive implicitly.",
    },
    {
      id: "webgeocalc",
      protocol: "http-artifact",
      baseUrl: "https://wgc2.jpl.nasa.gov:8443/webgeocalc/",
      readOnly: true,
      browserSafe: false,
      notes: "Geometry verification service, not the canonical bulk-kernel store.",
    },
  ],
  documentation: [
    {
      title: "SPICE data",
      url: "https://naif.jpl.nasa.gov/naif/data.html",
      role: "service-docs",
    },
    {
      title: "WebGeocalc and REST API",
      url: "https://naif.jpl.nasa.gov/naif/webgeocalc.html",
      role: "service-docs",
    },
    {
      title: "WebGeocalc usage rules",
      url: "https://naif.jpl.nasa.gov/naif/WGC_rules_of_use.html",
      role: "rights",
    },
  ],
  sync: {
    mode: "release-snapshot",
    cadence: {
      kind: "release-driven",
      pollEvery: "P1D",
      basis: "cosmography-policy",
    },
    cursorKinds: ["release"],
    immutableReleaseSnapshots: true,
  },
  auth: { mode: "none", dataRightsRequired: false },
  quota: quota(
    "No general request quota is published. Use explicit artifacts, conditional requests, and conservative concurrency.",
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "public-with-attribution",
    redistribution: "source-specific-review",
    termsUrl: "https://naif.jpl.nasa.gov/naif/WGC_rules_of_use.html",
    acknowledgement:
      "Credit SPICE, NAIF/PDS, and the mission teams that supplied each kernel.",
    reviewBeforePublication: true,
  },
  freshness: {
    targetLag: "P1D",
    staleAfter: "P7D",
    clock: "UTC",
  },
  retry,
  killSwitch: killSwitch("naif-spice"),
  storage,
  releaseState: [
    {
      label: "mission-kernel-sets",
      state: "current",
      notes: "Kernel identity and coverage are mission-specific; freeze exact filenames and checksums.",
    },
  ],
  operationalNotes: [
    "SPICE results are only reproducible when kernel set, load order, frame, time system, and aberration correction are frozen.",
  ],
});

const jplHorizons = passport({
  sourceId: "jpl-horizons",
  displayName: "JPL Horizons",
  authority: "NASA Jet Propulsion Laboratory Solar System Dynamics",
  agencyNeutralGroup: "planetary-geometry",
  registryTier: "core",
  lifecycle: "active",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "query-api",
      protocol: "horizons",
      baseUrl: "https://ssd.jpl.nasa.gov/api/horizons.api",
      readOnly: true,
      browserSafe: false,
      notes: "Use from the ingestion backend; official API documentation warns against browser embedding under NASA CORS policy.",
    },
  ],
  documentation: [
    {
      title: `Horizons API documentation version ${HORIZONS_DOCUMENTATION_VERSION}`,
      url: "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
      role: "service-docs",
    },
    {
      title: "Horizons system manual",
      url: "https://ssd.jpl.nasa.gov/horizons/manual.html",
      role: "data-model",
    },
    {
      title: "JPL Solar System Dynamics API policy",
      url: "https://ssd-api.jpl.nasa.gov/doc/index.php",
      role: "rights",
    },
  ],
  sync: {
    mode: "on-demand",
    cadence: { kind: "on-demand", basis: "cosmography-policy" },
    cursorKinds: ["none"],
    immutableReleaseSnapshots: true,
  },
  auth: { mode: "none", dataRightsRequired: false },
  quota: quota(
    "The API documents response codes but no numeric quota. Cache frozen ephemeris requests and avoid repeated interactive polling.",
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "public-with-attribution",
    redistribution: "source-specific-review",
    termsUrl: "https://ssd-api.jpl.nasa.gov/doc/index.php",
    acknowledgement: "Credit NASA/JPL Horizons and preserve the returned API signature and solution metadata.",
    reviewBeforePublication: true,
  },
  freshness: {
    targetLag: "PT1H",
    staleAfter: "P1D",
    clock: "UTC",
  },
  retry,
  killSwitch: killSwitch("jpl-horizons"),
  storage,
  releaseState: [
    {
      label: `documentation-api-${HORIZONS_DOCUMENTATION_VERSION}`,
      state: "current",
      effectiveAt: "2025-06-01T00:00:00Z",
      notes: "Version stated by the official API documentation; this is not assumed to equal the live payload signature.",
    },
    {
      label: `observed-response-signature-${HORIZONS_OBSERVED_SIGNATURE_VERSION}`,
      state: "current",
      effectiveAt: "2026-07-19T00:00:00Z",
      notes: "A small official-endpoint probe returned signature.version 1.2 on the registry check date. Freeze this expectation per request and stop parsing if the live value differs.",
    },
  ],
  operationalNotes: [
    "A successful HTTP 200 can still contain a Horizons domain error; validate the payload, not only the status code.",
    "The documentation reported API 1.3 while the checked live JSON payload reported signature.version 1.2; preserve both observations rather than collapsing them into one version claim.",
  ],
});

const nasaPds4 = passport({
  sourceId: "nasa-pds4",
  displayName: "NASA Planetary Data System (PDS4)",
  authority: "NASA Planetary Data System",
  agencyNeutralGroup: "planetary-archive",
  registryTier: "core",
  lifecycle: "active",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "search-api",
      protocol: "pds-search",
      baseUrl: "https://pds.nasa.gov/api/search/1/products",
      readOnly: true,
      browserSafe: false,
      notes: "Registry search returns metadata and product pointers; payload files remain in node archives or object storage.",
    },
  ],
  documentation: [
    {
      title: "PDS Search API query syntax",
      url: "https://nasa-pds.github.io/pds-api/guides/search/endpoints.html",
      role: "service-docs",
    },
    {
      title: "PDS4 standards reference, Build 17",
      url: "https://pds.nasa.gov/datastandards/documents/sr/",
      role: "data-model",
    },
    {
      title: "PDS policies and guidelines",
      url: "https://pds.nasa.gov/datastandards/about/",
      role: "rights",
    },
  ],
  sync: {
    mode: "incremental",
    cadence: {
      kind: "interval",
      every: "P1D",
      basis: "cosmography-policy",
    },
    cursorKinds: ["search-after", "release"],
    immutableReleaseSnapshots: true,
  },
  auth: { mode: "none", dataRightsRequired: false },
  quota: quota(
    "The Search API defaults to 100 records. Its guide advises page limits below a few thousand and warns demanding requests can produce 504 responses.",
    {
      publicationStatus: "partially-published",
      localMaxRowsPerRequest: 1_000,
    },
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "source-specific",
    redistribution: "source-specific-review",
    termsUrl: "https://pds.nasa.gov/datastandards/about/",
    acknowledgement: "Credit NASA PDS, the responsible PDS node, mission, instrument team, and product citation/DOI.",
    reviewBeforePublication: true,
  },
  freshness: {
    targetLag: "P1D",
    staleAfter: "P7D",
    upstreamTimestampField: "ops:Harvest_Info.ops:harvest_date_time",
    clock: "UTC",
  },
  retry,
  killSwitch: killSwitch("nasa-pds4"),
  storage,
  releaseState: [
    {
      label: "pds4-build-17",
      state: "current",
      effectiveAt: "2026-06-01T00:00:00Z",
      notes: "The standards reference lists PDS4 Information Model 1.26.0.0 / Build 17 as released June 2026.",
    },
  ],
  operationalNotes: [
    "The PDS Search API documentation warns that not every PDS data set is populated in the service; preserve node-level fallback links.",
  ],
});

const esaPsa = passport({
  sourceId: "esa-psa",
  displayName: "ESA Planetary Science Archive",
  authority: "European Space Agency",
  agencyNeutralGroup: "planetary-archive",
  registryTier: "core",
  lifecycle: "active",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "tap",
      protocol: "tap",
      baseUrl: "https://psa.esa.int/psa-tap/tap",
      readOnly: true,
      browserSafe: false,
      notes: "The current PSA user interface is backed by this TAP+ service. Resolve product access URLs without recursive archive scraping.",
    },
  ],
  documentation: [
    {
      title: "Planetary Science Archive introduction",
      url: "https://www.cosmos.esa.int/web/psa/psa-introduction",
      role: "landing-page",
    },
    {
      title: "PSA TAP+ service",
      url: "https://psa.esa.int/psa-tap/tap/",
      role: "service-docs",
    },
    {
      title: "PSA PDS4 standards",
      url: "https://www.cosmos.esa.int/web/psa/pds4-standards",
      role: "data-model",
    },
  ],
  sync: {
    mode: "incremental",
    cadence: {
      kind: "interval",
      every: "P7D",
      basis: "cosmography-policy",
    },
    cursorKinds: ["time-watermark", "tap-uws", "release"],
    immutableReleaseSnapshots: true,
  },
  auth: { mode: "none", dataRightsRequired: false },
  quota: quota(
    "No stable numeric TAP quota was found in official PSA documentation. Use bounded product queries, async jobs where appropriate, and one request at a time.",
    { localMaxConcurrency: 1, localMinDelayMs: 1_500 },
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "source-specific",
    redistribution: "source-specific-review",
    termsUrl: "https://www.cosmos.esa.int/web/psa/psa-introduction",
    acknowledgement: "Credit ESA PSA plus each mission, instrument, and data-product provider as specified by the archive documentation.",
    reviewBeforePublication: true,
  },
  freshness: { targetLag: "P7D", staleAfter: "P30D", clock: "UTC" },
  retry,
  killSwitch: killSwitch("esa-psa"),
  storage,
  releaseState: [
    {
      label: "pds3-and-pds4-holdings",
      state: "current",
      notes: "The PSA contains both PDS3 and PDS4 holdings; format must be recorded per product.",
    },
  ],
  operationalNotes: [
    "ESA describes typical mission deliveries every three to six months, but availability varies by mission and proprietary period.",
  ],
});

const jaxaDarts = passport({
  sourceId: "jaxa-darts",
  displayName: "JAXA DARTS",
  authority: "ISAS/JAXA Center for Science-satellite Operation and Data Archive",
  agencyNeutralGroup: "planetary-archive",
  registryTier: "core",
  lifecycle: "active",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "public-data",
      protocol: "http-artifact",
      baseUrl: "https://data.darts.isas.jaxa.jp/pub/",
      readOnly: true,
      browserSafe: true,
      notes: "Compile explicit file or small directory-index requests only; respect per-project readme files and restrictions.",
    },
  ],
  documentation: [
    {
      title: "About DARTS",
      url: "https://darts.isas.jaxa.jp/en/about",
      role: "landing-page",
    },
    {
      title: "DARTS FAQ and HTTP access guidance",
      url: "https://darts.isas.jaxa.jp/en/faq",
      role: "service-docs",
    },
    {
      title: "ISAS data policy",
      url: "https://www.isas.jaxa.jp/en/researchers/data-policy/",
      role: "rights",
    },
  ],
  sync: {
    mode: "release-snapshot",
    cadence: {
      kind: "release-driven",
      pollEvery: "P7D",
      basis: "cosmography-policy",
    },
    cursorKinds: ["release"],
    immutableReleaseSnapshots: true,
  },
  auth: { mode: "none", dataRightsRequired: false },
  quota: quota(
    "DARTS documents wget access with a one-second delay. Cosmography adopts that delay and low concurrency.",
    {
      publicationStatus: "partially-published",
      localMaxConcurrency: 1,
      localMinDelayMs: 1_000,
    },
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "public-with-attribution",
    redistribution: "source-specific-review",
    termsUrl: "https://www.isas.jaxa.jp/en/researchers/data-policy/",
    acknowledgement: "Identify the origin as ISAS/JAXA, acknowledge DARTS, and retain any project-specific third-party notices.",
    reviewBeforePublication: true,
  },
  freshness: { targetLag: "P7D", staleAfter: "P30D", clock: "UTC" },
  retry,
  killSwitch: killSwitch("jaxa-darts"),
  storage,
  releaseState: [
    {
      label: "mission-specific-public-releases",
      state: "current",
      notes: "Formats, proprietary periods, and rights vary by mission and product.",
    },
  ],
  operationalNotes: [
    "DARTS says released data are generally free for commercial and non-commercial use, but some products have third-party copyright restrictions.",
  ],
});

const isroIssdc = passport({
  sourceId: "isro-issdc",
  displayName: "ISRO Science Data Archive at ISSDC",
  authority: "Indian Space Research Organisation / Indian Space Science Data Centre",
  agencyNeutralGroup: "planetary-archive",
  registryTier: "core",
  lifecycle: "manual-only",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "pradan",
      protocol: "manual-review",
      baseUrl: "https://pradan1.issdc.gov.in/",
      readOnly: true,
      browserSafe: true,
      notes: "No supported public machine API was documented; use a reviewed account export or release manifest, never credential automation or scraping.",
    },
  ],
  documentation: [
    {
      title: "ISRO science data and ISSDC",
      url: "https://www.isro.gov.in/Sciencedata.html",
      role: "landing-page",
    },
    {
      title: "ISRO Science Data Archive (PRADAN)",
      url: "https://pradan1.issdc.gov.in/",
      role: "service-docs",
    },
  ],
  sync: {
    mode: "manual-snapshot",
    cadence: {
      kind: "manual",
      reviewEvery: "P30D",
      basis: "cosmography-policy",
    },
    cursorKinds: ["release"],
    immutableReleaseSnapshots: true,
  },
  auth: {
    mode: "interactive-account",
    dataRightsRequired: false,
    notes: "Some public releases still require an interactive archive account and acceptance of mission terms.",
  },
  quota: quota(
    "No public API quota applies because automated ingestion is disabled until ISSDC documents a supported interface.",
    { localMaxConcurrency: 1 },
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "account-gated",
    redistribution: "source-specific-review",
    termsUrl: "https://www.isro.gov.in/Sciencedata.html",
    acknowledgement: "Credit ISRO, ISSDC/ISDA, the mission, payload team, and the exact release documentation.",
    reviewBeforePublication: true,
  },
  freshness: { targetLag: "P30D", staleAfter: "P90D", clock: "UTC" },
  retry: { ...retry, maxAttempts: 1, strategy: "none", jitter: "none" },
  killSwitch: killSwitch("isro-issdc", false),
  storage,
  releaseState: [
    {
      label: "pradan-public-mission-releases",
      state: "current",
      notes: "ISDA holds mission-by-mission raw, reduced, calibration, auxiliary, derived, documentation, and software products after applicable lock-in periods.",
    },
  ],
  operationalNotes: [
    "Enable only after a human confirms the release, rights, file list, and access method for the specific mission.",
  ],
});

const esaGaiaTap = passport({
  sourceId: "esa-gaia-tap",
  displayName: "ESA Gaia Archive TAP",
  authority: "European Space Agency Gaia Archive",
  agencyNeutralGroup: "astronomy-catalog",
  registryTier: "core",
  lifecycle: "active",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "tap",
      protocol: "tap",
      baseUrl: "https://gea.esac.esa.int/tap-server/tap",
      readOnly: true,
      browserSafe: false,
      notes: "Use anonymous TAP for public tables and async jobs for bounded large results; authenticated user-space features are out of ingestion scope.",
    },
  ],
  documentation: [
    {
      title: "Gaia programmatic archive access",
      url: "https://www.cosmos.esa.int/web/gaia-users/archive/programmatic-access",
      role: "service-docs",
    },
    {
      title: "Gaia release scenario",
      url: "https://www.cosmos.esa.int/web/gaia/release",
      role: "status",
    },
    {
      title: "Gaia archive data credits and license",
      url: "https://www.cosmos.esa.int/web/gaia-users/archive",
      role: "rights",
    },
  ],
  sync: {
    mode: "release-snapshot",
    cadence: {
      kind: "release-driven",
      pollEvery: "P1D",
      basis: "cosmography-policy",
    },
    cursorKinds: ["tap-uws", "release"],
    immutableReleaseSnapshots: true,
  },
  auth: {
    mode: "optional-account",
    dataRightsRequired: false,
    notes: "Public tables support anonymous TAP. Cosmography must not rely on a personal Gaia user workspace.",
  },
  quota: quota(
    "ESA documents query duration and result-size limits but they can change; use async TAP, bounded spatial partitions, and release-specific schemas.",
    { publicationStatus: "partially-published", localMaxRowsPerRequest: 100_000 },
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "public-with-attribution",
    redistribution: "source-specific-review",
    termsUrl: "https://www.cosmos.esa.int/web/gaia-users/archive",
    acknowledgement: "Use the Gaia data-release credit line and DOI, and cite relevant Gaia Collaboration processing papers.",
    reviewBeforePublication: true,
  },
  freshness: { targetLag: "P1D", staleAfter: "P7D", clock: "UTC" },
  retry,
  killSwitch: killSwitch("esa-gaia-tap"),
  storage,
  releaseState: [
    {
      label: "Gaia DR3 plus Focused Product Release",
      state: "current",
      effectiveAt: "2023-10-10T00:00:00Z",
      notes: "DR3 remains the current full public release; the Focused Product Release is also available.",
    },
    {
      label: "Gaia DR4",
      state: "scheduled",
      notes: "ESA lists DR4 as upcoming/not before mid-2026; do not label it released until the archive publishes it.",
    },
  ],
  operationalNotes: [
    "Gaia source identifiers and reference epochs change across releases; never merge rows across releases solely by source_id.",
  ],
});

const cdsSimbadTap = passport({
  sourceId: "cds-simbad-tap",
  displayName: "CDS SIMBAD TAP",
  authority: "Centre de Données astronomiques de Strasbourg",
  agencyNeutralGroup: "astronomy-catalog",
  registryTier: "core",
  lifecycle: "active",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "tap",
      protocol: "tap",
      baseUrl: "https://simbad.cds.unistra.fr/simbad/sim-tap",
      readOnly: true,
      browserSafe: false,
      notes: "SIMBAD is an object database, not a survey catalogue; do not treat it as a complete census.",
    },
  ],
  documentation: [
    {
      title: "SIMBAD service, release, license, and acknowledgement",
      url: "https://simbad.cds.unistra.fr/simbad/",
      role: "service-docs",
    },
    {
      title: "SIMBAD TAP capabilities",
      url: "https://simbad.cds.unistra.fr/simbad/sim-tap/capabilities",
      role: "data-model",
    },
  ],
  sync: {
    mode: "incremental",
    cadence: { kind: "interval", every: "P1D", basis: "cosmography-policy" },
    cursorKinds: ["time-watermark", "tap-uws", "release"],
    immutableReleaseSnapshots: true,
  },
  auth: { mode: "none", dataRightsRequired: false },
  quota: quota(
    "No stable numeric quota was found on the official service page. Keep queries bounded and cache name resolution results.",
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "public-with-attribution",
    redistribution: "permitted-with-attribution",
    termsUrl: "https://simbad.cds.unistra.fr/simbad/",
    acknowledgement: "Acknowledge SIMBAD at CDS and cite the original paper references for data used.",
    reviewBeforePublication: true,
  },
  freshness: { targetLag: "P1D", staleAfter: "P7D", clock: "UTC" },
  retry,
  killSwitch: killSwitch("cds-simbad-tap"),
  storage,
  releaseState: [
    {
      label: "SIMBAD4 1.8 (2026-06)",
      state: "current",
      notes: "The official service page reported SIMBAD4 1.8 and ODbL access when checked.",
    },
  ],
  operationalNotes: [
    "Use SIMBAD for identifiers, classifications, bibliography, and measurements; use VizieR for published catalogues.",
  ],
});

const cdsVizierTap = passport({
  sourceId: "cds-vizier-tap",
  displayName: "CDS VizieR TAP",
  authority: "Centre de Données astronomiques de Strasbourg",
  agencyNeutralGroup: "astronomy-catalog",
  registryTier: "core",
  lifecycle: "active",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "tap",
      protocol: "tap",
      baseUrl: "https://tapvizier.cds.unistra.fr/TAPVizieR/tap",
      readOnly: true,
      browserSafe: false,
      notes: "Freeze the exact catalogue/table identifier and its ReadMe/citation; rights can vary by contributed catalogue.",
    },
  ],
  documentation: [
    {
      title: "VizieR TAP capabilities",
      url: "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/capabilities",
      role: "service-docs",
    },
    {
      title: "VizieR catalogue access and acknowledgement",
      url: "https://vizier.cds.unistra.fr/viz-bin/VizieR",
      role: "citation",
    },
  ],
  sync: {
    mode: "release-snapshot",
    cadence: {
      kind: "release-driven",
      pollEvery: "P7D",
      basis: "cosmography-policy",
    },
    cursorKinds: ["tap-uws", "release"],
    immutableReleaseSnapshots: true,
  },
  auth: { mode: "none", dataRightsRequired: false },
  quota: quota(
    "No single quota covers all VizieR catalogues. Partition large queries and preserve the original catalogue release rather than repeatedly exporting all rows.",
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "source-specific",
    redistribution: "source-specific-review",
    termsUrl: "https://vizier.cds.unistra.fr/viz-bin/VizieR",
    acknowledgement: "Acknowledge the VizieR catalogue access tool and cite each original catalogue, DOI, and catalogue-specific notice.",
    reviewBeforePublication: true,
  },
  freshness: { targetLag: "P7D", staleAfter: "P30D", clock: "UTC" },
  retry,
  killSwitch: killSwitch("cds-vizier-tap"),
  storage,
  releaseState: [
    {
      label: "catalogue-specific",
      state: "current",
      notes: "There is no single VizieR data release; release and rights are attached to each catalogue.",
    },
  ],
  operationalNotes: [
    "VizieR table names commonly require ADQL quoted identifiers; never strip their catalogue namespace.",
  ],
});

const stsciMast = passport({
  sourceId: "stsci-mast",
  displayName: "MAST",
  authority: "Space Telescope Science Institute",
  agencyNeutralGroup: "astronomy-catalog",
  registryTier: "core",
  lifecycle: "active",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "invoke",
      protocol: "mast-invoke",
      baseUrl: "https://mast.stsci.edu/api/v0/invoke",
      readOnly: true,
      browserSafe: false,
      notes: "Use the MAST service API for bounded observation and product discovery; do not place proprietary tokens in manifests.",
    },
    {
      id: "caom-tap",
      protocol: "tap",
      baseUrl: "https://mast.stsci.edu/vo-tap/api/v0.1/caom",
      readOnly: true,
      browserSafe: false,
      notes: "Preferred VO path for bounded CAOM catalogue queries.",
    },
  ],
  documentation: [
    {
      title: "Using MAST APIs",
      url: "https://outerspace.stsci.edu/spaces/MASTDOCS/pages/113771434/Using+MAST+APIs",
      role: "service-docs",
    },
    {
      title: "MAST API tutorial",
      url: "https://mast.stsci.edu/api/v0/MastApiTutorial.html",
      role: "service-docs",
    },
    {
      title: "MAST Virtual Observatory services",
      url: "https://archive.stsci.edu/virtual-observatory",
      role: "data-model",
    },
  ],
  sync: {
    mode: "incremental",
    cadence: { kind: "interval", every: "P1D", basis: "cosmography-policy" },
    cursorKinds: ["offset", "time-watermark", "tap-uws", "release"],
    immutableReleaseSnapshots: true,
  },
  auth: {
    mode: "optional-account",
    dataRightsRequired: false,
    notes: "Most public holdings are anonymous. Protected holdings require a MAST token and are excluded unless explicitly authorized.",
  },
  quota: quota(
    "MAST exposes multiple services with service-specific limits. Use API pagination and query metadata before requesting products.",
    { localMaxRowsPerRequest: 50_000 },
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "source-specific",
    redistribution: "source-specific-review",
    termsUrl: "https://outerspace.stsci.edu/spaces/MASTDOCS/pages/113771434/Using+MAST+APIs",
    acknowledgement: "Credit MAST/STScI and apply the mission, program, instrument, and high-level product citations returned with each collection.",
    reviewBeforePublication: true,
  },
  freshness: { targetLag: "P1D", staleAfter: "P7D", clock: "UTC" },
  retry,
  killSwitch: killSwitch("stsci-mast"),
  storage,
  releaseState: [
    {
      label: "multi-mission-live-archive",
      state: "current",
      notes: "MAST is a live multi-mission archive; release and proprietary state are product-level fields.",
    },
  ],
  operationalNotes: [
    "Never assume an observation is public solely because metadata is visible; check data rights and release date before retrieval or display.",
  ],
});

const nasaExoplanetArchive = passport({
  sourceId: "nasa-exoplanet-archive",
  displayName: "NASA Exoplanet Archive",
  authority: "NASA Exoplanet Science Institute at Caltech/IPAC",
  agencyNeutralGroup: "astronomy-catalog",
  registryTier: "core",
  lifecycle: "active",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "tap",
      protocol: "tap",
      baseUrl: "https://exoplanetarchive.ipac.caltech.edu/TAP",
      readOnly: true,
      browserSafe: false,
      notes: "Use TAP for migrated and new tables; the legacy nsted API is not the default adapter.",
    },
  ],
  documentation: [
    {
      title: "Exoplanet Archive TAP user guide",
      url: "https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html",
      role: "service-docs",
    },
    {
      title: "Exoplanet Archive API transition guidance",
      url: "https://exoplanetarchive.ipac.caltech.edu/docs/program_interfaces.html",
      role: "status",
    },
  ],
  sync: {
    mode: "incremental",
    cadence: { kind: "interval", every: "P1D", basis: "cosmography-policy" },
    cursorKinds: ["time-watermark", "tap-uws", "release"],
    immutableReleaseSnapshots: true,
  },
  auth: { mode: "none", dataRightsRequired: false },
  quota: quota(
    "The official guide recommends TAP clients for large tables but does not publish a stable numeric quota. Prefer selected columns and bounded queries.",
    { localMaxRowsPerRequest: 100_000 },
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "public-with-attribution",
    redistribution: "source-specific-review",
    termsUrl: "https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html",
    acknowledgement: "Credit the NASA Exoplanet Archive and cite the archive DOI plus the literature reference behind each planetary solution.",
    reviewBeforePublication: true,
  },
  freshness: { targetLag: "P1D", staleAfter: "P7D", clock: "UTC" },
  retry,
  killSwitch: killSwitch("nasa-exoplanet-archive"),
  storage,
  releaseState: [
    {
      label: "TAP-first archive",
      state: "current",
      notes: "All new tables and nearly all legacy API tables are served through TAP; two mission-star tables remain legacy exceptions per official guidance.",
    },
  ],
  operationalNotes: [
    "Retain default_flag/solution provenance: one planet can have multiple published solutions and the archive's preferred row can change.",
  ],
});

const nasaNed = passport({
  sourceId: "nasa-ned",
  displayName: "NASA/IPAC Extragalactic Database",
  authority: "NASA/IPAC at Caltech",
  agencyNeutralGroup: "astronomy-catalog",
  registryTier: "core",
  lifecycle: "active",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "new-rest-api",
      protocol: "ned-rest",
      baseUrl: "https://ned.ipac.caltech.edu/NED::API/",
      readOnly: true,
      browserSafe: false,
      notes: "Use the 2026 NED::API services. Legacy APIs cannot access data ingested after January 2026.",
    },
  ],
  documentation: [
    {
      title: "NED API specification",
      url: "https://ned.ipac.caltech.edu/Docs%3A%3AAPI/",
      role: "service-docs",
    },
    {
      title: "NED TAP transition notice",
      url: "https://ned.ipac.caltech.edu/Documents/Guides/Interface/TAP",
      role: "status",
    },
    {
      title: "Acknowledging NED",
      url: "https://ned.ipac.caltech.edu/help/intro.html",
      role: "citation",
    },
  ],
  sync: {
    mode: "on-demand",
    cadence: { kind: "on-demand", basis: "cosmography-policy" },
    cursorKinds: ["none", "offset"],
    immutableReleaseSnapshots: true,
  },
  auth: { mode: "none", dataRightsRequired: false },
  quota: quota(
    "NED asks automated clients to avoid high-volume/high-rate access. Use bounded MAXREC values, cache results, and do not crawl all objects.",
    { publicationStatus: "partially-published", localMaxConcurrency: 1, localMaxRowsPerRequest: 1_000 },
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "source-specific",
    redistribution: "source-specific-review",
    termsUrl: "https://ned.ipac.caltech.edu/help/intro.html",
    acknowledgement: "Use NED's requested acknowledgement and preserve the original catalogue or literature references for measurements.",
    reviewBeforePublication: true,
  },
  freshness: { targetLag: "P7D", staleAfter: "P30D", clock: "UTC" },
  retry,
  killSwitch: killSwitch("nasa-ned"),
  storage,
  releaseState: [
    {
      label: "NED::API 2026",
      state: "current",
      notes: "The official service warns that legacy APIs omit data ingested after January 2026; Cosmography targets the new NED::API surface.",
    },
  ],
  operationalNotes: [
    "NED is for extragalactic objects. Use SIMBAD for Galactic objects and PDS for Solar System objects.",
  ],
});

const unoosaRegister = passport({
  sourceId: "unoosa-space-object-register",
  displayName: "UNOOSA Register of Objects Launched into Outer Space",
  authority: "United Nations Office for Outer Space Affairs",
  agencyNeutralGroup: "mission-registry",
  registryTier: "core",
  lifecycle: "manual-only",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "register-submissions",
      protocol: "manual-review",
      baseUrl: "https://www.unoosa.org/oosa/en/spaceobjectregister/resources/index.html",
      readOnly: true,
      browserSafe: true,
      notes: "No supported public bulk API was documented; ingest reviewed registration documents and their metadata, not scraped search pages.",
    },
  ],
  documentation: [
    {
      title: "Space Treaty implementation and central register",
      url: "https://www.unoosa.org/oosa/en/treatyimplementation/",
      role: "landing-page",
    },
    {
      title: "Registration submissions by states and organizations",
      url: "https://www.unoosa.org/oosa/en/spaceobjectregister/resources/index.html",
      role: "service-docs",
    },
  ],
  sync: {
    mode: "manual-snapshot",
    cadence: {
      kind: "manual",
      reviewEvery: "P30D",
      basis: "cosmography-policy",
    },
    cursorKinds: ["release"],
    immutableReleaseSnapshots: true,
  },
  auth: { mode: "none", dataRightsRequired: false },
  quota: quota(
    "No public API quota applies because automated scraping is disabled. Review newly issued registration documents on a monthly schedule.",
    { localMaxConcurrency: 1 },
  ),
  rights: {
    publicMetadataAccess: true,
    dataUse: "unknown-review-required",
    redistribution: "source-specific-review",
    termsUrl: "https://www.un.org/en/about-us/terms-of-use",
    acknowledgement: "Credit the United Nations/UNOOSA and link the exact registration document submitted by the registering state or organization.",
    reviewBeforePublication: true,
  },
  freshness: { targetLag: "P30D", staleAfter: "P90D", clock: "UTC" },
  retry: { ...retry, maxAttempts: 1, strategy: "none", jitter: "none" },
  killSwitch: killSwitch("unoosa-space-object-register", false),
  storage,
  releaseState: [
    {
      label: "living-document-register",
      state: "current",
      notes: "Registration data arrive as official documents and may include amendments; retain document lineage rather than overwriting facts.",
    },
  ],
  operationalNotes: [
    "UNOOSA registration is a legal/administrative record, not a real-time orbital catalogue or complete telemetry source.",
  ],
});

const rubinDp1 = passport({
  sourceId: "rubin-dp1",
  displayName: "Vera C. Rubin Observatory Data Preview 1",
  authority: "NSF–DOE Vera C. Rubin Observatory",
  agencyNeutralGroup: "astronomy-catalog",
  registryTier: "optional",
  lifecycle: "access-restricted",
  checkedOn: REGISTRY_CHECKED_ON,
  endpoints: [
    {
      id: "rsp-tap",
      protocol: "tap",
      baseUrl: "https://data.lsst.cloud/api/tap",
      readOnly: true,
      browserSafe: false,
      notes: "Requires a Rubin Science Platform token with read:tap and current Rubin data rights.",
    },
  ],
  documentation: [
    {
      title: "DP1 data access and data-rights policy",
      url: "https://dp1.lsst.io/access/index.html",
      role: "rights",
    },
    {
      title: "DP1 API tutorial",
      url: "https://dp1.lsst.io/tutorials/api/api-101-1.html",
      role: "service-docs",
    },
    {
      title: "DP1 citation guidance",
      url: "https://dp1.lsst.io/citedp1.html",
      role: "citation",
    },
    {
      title: "Early Data Preview 2 scheduled event",
      url: "https://rubinobservatory.org/events/edp2-release",
      role: "status",
    },
  ],
  sync: {
    mode: "release-snapshot",
    cadence: {
      kind: "release-driven",
      pollEvery: "P1D",
      basis: "cosmography-policy",
    },
    cursorKinds: ["tap-uws", "release"],
    immutableReleaseSnapshots: true,
  },
  auth: {
    mode: "bearer-token",
    secretEnv: "RUBIN_RSP_TOKEN",
    dataRightsRequired: true,
    notes: "Tokens are runtime secrets and must never be frozen into request headers or manifests.",
  },
  quota: quota(
    "Rubin RSP service limits are operational and account-scoped. Use async TAP and data-rights-compliant bounded queries.",
    { localMaxConcurrency: 1, localMaxRowsPerRequest: 50_000 },
  ),
  rights: {
    publicMetadataAccess: false,
    dataUse: "data-rights-gated",
    redistribution: "permission-required",
    termsUrl: "https://dp1.lsst.io/access/index.html",
    acknowledgement: "Follow DP1 DOI, facility, instrument, object-designation, and data-rights guidance exactly.",
    reviewBeforePublication: true,
  },
  freshness: { targetLag: "P1D", staleAfter: "P7D", clock: "UTC" },
  retry,
  killSwitch: killSwitch("rubin-dp1", false),
  storage,
  releaseState: [
    {
      label: "DP1",
      state: "preview",
      effectiveAt: "2025-06-30T00:00:00Z",
      notes: "DP1 is available only to Rubin data-rights holders through the Rubin Science Platform; it is not LSST annual Data Release 1.",
    },
    {
      label: "Early Data Preview 2",
      state: "scheduled",
      effectiveAt: "2026-07-27T00:00:00Z",
      notes: "Rubin officially schedules EDP2 for 2026-07-27, eight days after this registry check; keep it disabled until release verification.",
    },
  ],
  operationalNotes: [
    "This optional connector is intentionally disabled by default and must not be used to bypass territorial, institutional, or collaboration data rights.",
  ],
});

export const sourcePassports = [
  naifSpice,
  jplHorizons,
  nasaPds4,
  esaPsa,
  jaxaDarts,
  isroIssdc,
  esaGaiaTap,
  cdsSimbadTap,
  cdsVizierTap,
  stsciMast,
  nasaExoplanetArchive,
  nasaNed,
  unoosaRegister,
  rubinDp1,
] as const satisfies readonly SourcePassport[];

export const sourcePassportById = new Map(
  sourcePassports.map((item) => [item.sourceId, item] as const),
);

export function getSourcePassport(sourceId: string): SourcePassport {
  const item = sourcePassportById.get(sourceId);
  if (!item) {
    throw new Error(`Unknown source connector: ${sourceId}`);
  }
  return item;
}
