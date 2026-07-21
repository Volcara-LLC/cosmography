export const surfaceStages = [
  "orbit",
  "region",
  "terrain",
  "recorded-view",
] as const;

export type SurfaceStageId = (typeof surfaceStages)[number];

export const surfaceViewModes = [
  "original",
  "reconstruction",
  "immersive",
] as const;

export type SurfaceViewMode = (typeof surfaceViewModes)[number];

export const surfaceEvidenceKinds = [
  "observed-terrain",
  "captured-panorama",
  "scientific-reconstruction",
  "interpolation",
  "immersive-display",
] as const;

export type SurfaceEvidenceKind = (typeof surfaceEvidenceKinds)[number];

export type SurfaceCoverageClass =
  | "measured-orbital"
  | "reconstructed-local"
  | "recorded-view"
  | "interpolated-gap"
  | "unmapped";

export type SurfaceSourceRole =
  | "authoritative-archive"
  | "cartographic-product"
  | "localization"
  | "mission-media"
  | "geometry"
  | "interactive-service"
  | "historical-record";

export type SurfaceRightsStatus =
  | "public-domain-review-required"
  | "credit-required"
  | "collection-specific"
  | "link-first-rights-review";

export interface SurfaceSource<TSourceId extends string = string> {
  readonly id: TSourceId;
  readonly title: string;
  readonly publisher: string;
  readonly authority: string;
  readonly url: string;
  readonly sourceRole: SurfaceSourceRole;
  readonly release: string;
  readonly retrievedAt: string;
  readonly credit: string;
  readonly rightsStatus: SurfaceRightsStatus;
  readonly integrationPolicy: string;
}

export interface SurfaceEvidence<
  TSourceId extends string = string,
  TEvidenceId extends string = string,
> {
  readonly id: TEvidenceId;
  readonly label: string;
  readonly kind: SurfaceEvidenceKind;
  readonly stages: readonly SurfaceStageId[];
  readonly availableIn: readonly SurfaceViewMode[];
  readonly coverage: SurfaceCoverageClass;
  readonly resolution: string;
  readonly spatialFrame: string;
  readonly supports: string;
  readonly doesNotSupport: string;
  readonly processing: string;
  readonly sourceIds: readonly TSourceId[];
}

export interface SurfaceStage<
  TEvidenceId extends string = string,
  TCaptureId extends string = string,
> {
  readonly id: SurfaceStageId;
  readonly shortLabel: string;
  readonly title: string;
  readonly scale: string;
  readonly summary: string;
  readonly evidenceIds: readonly TEvidenceId[];
  readonly captureNodeIds: readonly TCaptureId[];
  readonly boundary: string;
}

export interface SurfaceCaptureNode<
  TSourceId extends string = string,
  TEvidenceId extends string = string,
  TCaptureId extends string = string,
> {
  readonly id: TCaptureId;
  readonly label: string;
  readonly mission: string;
  readonly instrument: string;
  readonly recordedAt: string;
  readonly missionClock: string;
  readonly place: string;
  readonly coordinate: {
    readonly latitudeDegrees: number;
    readonly longitudeDegreesEast: number;
    readonly frame: string;
    readonly precision: string;
  } | null;
  readonly media: "stitched-still-panorama" | "still-frame-set";
  readonly continuity: "discrete-stills-not-continuous-footage";
  readonly fieldOfView: string;
  readonly resolution: string;
  readonly colorTreatment: string;
  readonly evidenceIds: readonly TEvidenceId[];
  readonly sourceIds: readonly TSourceId[];
  readonly limitation: string;
}

export interface SurfaceExperience<
  TSourceId extends string = string,
  TEvidenceId extends string = string,
  TCaptureId extends string = string,
> {
  readonly id: string;
  readonly body: "Mars" | "Moon";
  readonly region: string;
  readonly mission: string;
  readonly release: string;
  readonly summary: string;
  readonly coordinateConvention: string;
  readonly continuousFootageAvailable: false;
  readonly continuityStatement: string;
  readonly sources: readonly SurfaceSource<TSourceId>[];
  readonly evidence: readonly SurfaceEvidence<TSourceId, TEvidenceId>[];
  readonly stages: readonly SurfaceStage<TEvidenceId, TCaptureId>[];
  readonly captureNodes: readonly SurfaceCaptureNode<
    TSourceId,
    TEvidenceId,
    TCaptureId
  >[];
}

type MarsSourceId =
  | "mars-pds-release-15"
  | "mars-places-release-15"
  | "mars-camera-archive-sis"
  | "usgs-jezero-landing-products"
  | "usgs-jezero-ctx"
  | "usgs-jezero-hirise-2025"
  | "nasa-perseverance-raw-images"
  | "jpl-sol-3-panorama"
  | "jpl-sol-4-panorama"
  | "jpl-sol-1349-panorama"
  | "mars-trek"
  | "naif-mars-2020";

type MarsEvidenceId =
  | "mars-orbital-context"
  | "jezero-ctx-observation"
  | "jezero-ctx-elevation"
  | "jezero-hirise-observation"
  | "jezero-hirise-elevation"
  | "perseverance-recorded-panoramas"
  | "perseverance-local-mesh"
  | "perseverance-places-pose"
  | "jezero-between-node-interpolation"
  | "mars-immersive-atmosphere";

type MarsCaptureId =
  | "perseverance-landing-sol-3"
  | "perseverance-landing-sol-4"
  | "perseverance-rim-sol-1349";

export const marsJezeroSurface = {
  id: "mars-jezero-perseverance",
  body: "Mars",
  region: "Jezero Crater and western rim",
  mission: "Mars 2020 · Perseverance",
  release: "surface-reference-0.1.0",
  summary:
    "A source-bounded descent from Mars orbit to discrete Perseverance camera stations. Recorded pixels, derived terrain, interpolated gaps, and immersive rendering remain separate layers.",
  coordinateConvention:
    "Planetocentric latitude, positive-east longitude; product-specific Mars CRS and rover-local frames must be preserved during future ingest.",
  continuousFootageAvailable: false,
  continuityStatement:
    "Perseverance returned individual frames, mosaics, some video sequences, telemetry, and derived meshes—not a continuously recorded street-level traverse. Cosmography moves between discrete capture nodes and marks every reconstructed gap.",
  sources: [
    {
      id: "mars-pds-release-15",
      title: "Mars 2020 Perseverance Rover Mission Archive",
      publisher: "NASA Planetary Data System Geosciences Node",
      authority: "NASA PDS",
      url: "https://pds-geosciences.wustl.edu/missions/mars2020/",
      sourceRole: "authoritative-archive",
      release: "Release 15 · 2026-04-07",
      retrievedAt: "2026-07-19",
      credit: "NASA Planetary Data System",
      rightsStatus: "public-domain-review-required",
      integrationPolicy:
        "Pin bundle LIDVIDs, checksums, release notes, and PDS4 labels before publication.",
    },
    {
      id: "mars-places-release-15",
      title: "Mars 2020 Rover PLACES Bundle",
      publisher: "NASA Planetary Data System Geosciences Node",
      authority: "NASA PDS / Mars 2020 Project",
      url: "https://pds-geosciences.wustl.edu/missions/mars2020/places.htm",
      sourceRole: "localization",
      release: "Release 15 · sols 0–1762",
      retrievedAt: "2026-07-19",
      credit: "NASA/JPL-Caltech and NASA PDS",
      rightsStatus: "public-domain-review-required",
      integrationPolicy:
        "Use release-pinned rover localizations and mechanism positions; never infer an exact pose from a press-image caption.",
    },
    {
      id: "mars-camera-archive-sis",
      title: "Mars 2020 Camera Archive Bundle SIS",
      publisher: "NASA Planetary Data System Imaging Node",
      authority: "NASA PDS / Mars 2020 Project",
      url: "https://pds-imaging.jpl.nasa.gov/documentation/Mars2020_Camera_Bundle_SIS.pdf",
      sourceRole: "authoritative-archive",
      release: "Current archive interface specification",
      retrievedAt: "2026-07-19",
      credit: "NASA/JPL-Caltech and instrument teams",
      rightsStatus: "public-domain-review-required",
      integrationPolicy:
        "Resolve raw, calibrated, stereo, mesh, and mosaic bundle classes separately; retain product identifiers and processing levels.",
    },
    {
      id: "usgs-jezero-landing-products",
      title: "Mars 2020 Jezero Crater Landing Site Products",
      publisher: "USGS Astrogeology Science Center",
      authority: "USGS",
      url: "https://astrogeology.usgs.gov/search/map/mars-2020-jezero-crater-landing-site-products",
      sourceRole: "cartographic-product",
      release: "Curated Jezero cartographic product collection",
      retrievedAt: "2026-07-19",
      credit: "USGS Astrogeology Science Center and named product authors",
      rightsStatus: "credit-required",
      integrationPolicy:
        "Publish each raster with its native projection, scale, lineage, citation, and confidence product where supplied.",
    },
    {
      id: "usgs-jezero-ctx",
      title: "Mars 2020 Science Investigation CTX DEM Mosaic",
      publisher: "USGS Astrogeology Science Center",
      authority: "USGS / NASA PDS",
      url: "https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic",
      sourceRole: "cartographic-product",
      release: "2021-10-14 product release",
      retrievedAt: "2026-07-19",
      credit: "Fred Calef; USGS Astrogeology Science Center; NASA PDS",
      rightsStatus: "credit-required",
      integrationPolicy:
        "Treat the 5 m orthomosaic as observed imagery and the 20 m stereo DEM as reconstructed elevation.",
    },
    {
      id: "usgs-jezero-hirise-2025",
      title:
        "Mars Sample Return Terrain Relative Navigation HiRISE DTM and Orthoimage Mosaics",
      publisher: "USGS Astrogeology Science Center",
      authority: "USGS / NASA/JPL-Caltech",
      url: "https://astrogeology.usgs.gov/search/map/mars-sample-return-terrain-relative-navigation-hirise-dtm-mosaic",
      sourceRole: "cartographic-product",
      release: "2025-02-28 · DOI 10.5066/P13CPYYU",
      retrievedAt: "2026-07-19",
      credit:
        "Bland et al.; USGS Astrogeology Science Center; NASA/JPL-Caltech/University of Arizona",
      rightsStatus: "credit-required",
      integrationPolicy:
        "Keep orthoimage pixels, stereo-derived DTM, and confidence mosaic as distinct assets.",
    },
    {
      id: "nasa-perseverance-raw-images",
      title: "Images from the Mars Perseverance Rover",
      publisher: "NASA Mars Exploration Program",
      authority: "NASA/JPL-Caltech and instrument teams",
      url: "https://mars.nasa.gov/mars2020/multimedia/raw-images/",
      sourceRole: "mission-media",
      release: "Continuously updated public gallery",
      retrievedAt: "2026-07-19",
      credit: "Credit is product-specific; preserve the displayed credit line",
      rightsStatus: "collection-specific",
      integrationPolicy:
        "Use as a public discovery view; scientific publication resolves the corresponding PDS product and label.",
    },
    {
      id: "jpl-sol-3-panorama",
      title: "Perseverance First 360-degree Mastcam-Z Panorama",
      publisher: "NASA Jet Propulsion Laboratory",
      authority: "NASA/JPL-Caltech/ASU/MSSS",
      url: "https://www.jpl.nasa.gov/news/nasas-perseverance-rover-gives-high-definition-panoramic-view-of-landing-site/",
      sourceRole: "mission-media",
      release: "Captured 2021-02-21 · Sol 3",
      retrievedAt: "2026-07-19",
      credit: "NASA/JPL-Caltech/MSSS/ASU",
      rightsStatus: "collection-specific",
      integrationPolicy:
        "Expose the 142-frame stitch as a panorama product; do not describe it as continuous footage.",
    },
    {
      id: "jpl-sol-4-panorama",
      title: "Perseverance Mastcam-Z First High-Resolution Panorama",
      publisher: "NASA Jet Propulsion Laboratory",
      authority: "NASA/JPL-Caltech/ASU/MSSS",
      url: "https://www.jpl.nasa.gov/images/pia23727-perseverances-mastcam-z-first-high-resolution-panorama/",
      sourceRole: "mission-media",
      release: "PIA23727 · captured 2021-02-22 · Sol 4",
      retrievedAt: "2026-07-19",
      credit: "NASA/JPL-Caltech/ASU/MSSS",
      rightsStatus: "collection-specific",
      integrationPolicy:
        "Keep the published preliminary natural-color treatment and frame-count description with the asset.",
    },
    {
      id: "jpl-sol-1349-panorama",
      title: "Perseverance Rover Panorama of Jezero Crater Rim",
      publisher: "NASA Jet Propulsion Laboratory",
      authority: "NASA/JPL-Caltech/ASU/MSSS",
      url: "https://www.jpl.nasa.gov/videos/perseverance-rover-panorama-of-mars-jezero-crater/",
      sourceRole: "mission-media",
      release: "Captured 2024-12-05 · Sol 1349",
      retrievedAt: "2026-07-19",
      credit: "NASA/JPL-Caltech/ASU/MSSS",
      rightsStatus: "collection-specific",
      integrationPolicy:
        "Link the panorama to its release-pinned PLACES pose before placing it in the scene.",
    },
    {
      id: "mars-trek",
      title: "NASA Mars Trek",
      publisher: "NASA Solar System Treks",
      authority: "NASA/JPL-Caltech",
      url: "https://trek.nasa.gov/mars/",
      sourceRole: "interactive-service",
      release: "Continuously maintained mapping portal",
      retrievedAt: "2026-07-19",
      credit: "NASA/JPL-Caltech; underlying product credits apply",
      rightsStatus: "collection-specific",
      integrationPolicy:
        "Use declared OGC services and layer metadata; never flatten source-specific rights or resolution.",
    },
    {
      id: "naif-mars-2020",
      title: "Mars 2020 SPICE Kernel Archive",
      publisher: "NASA Navigation and Ancillary Information Facility",
      authority: "NASA/JPL-Caltech",
      url: "https://naif.jpl.nasa.gov/pub/naif/MARS2020/",
      sourceRole: "geometry",
      release: "Versioned mission kernels",
      retrievedAt: "2026-07-19",
      credit: "NASA/JPL-Caltech NAIF",
      rightsStatus: "public-domain-review-required",
      integrationPolicy:
        "Pin kernel-set manifests and compute geometry with explicit frames, time scales, and aberration settings.",
    },
  ],
  evidence: [
    {
      id: "mars-orbital-context",
      label: "Mars orbital context",
      kind: "observed-terrain",
      stages: ["orbit"],
      availableIn: ["original", "reconstruction", "immersive"],
      coverage: "measured-orbital",
      resolution: "Layer-specific global and regional products",
      spatialFrame: "Required ingest frame: IAU Mars body-fixed with each native layer CRS preserved",
      supports: "Selected validated products would support planet-scale location and morphology",
      doesNotSupport: "Rover-scale rocks, colors under arbitrary lighting, or a live view",
      processing: "Planned ingest: select and tile release-pinned orbital products with per-layer metadata",
      sourceIds: ["mars-trek", "usgs-jezero-landing-products"],
    },
    {
      id: "jezero-ctx-observation",
      label: "Jezero CTX orthomosaic",
      kind: "observed-terrain",
      stages: ["region", "terrain"],
      availableIn: ["original", "reconstruction", "immersive"],
      coverage: "measured-orbital",
      resolution: "5 m/pixel orthomosaic",
      spatialFrame: "Mars equirectangular; planetocentric; positive-east",
      supports: "Crater-scale visible morphology and regional registration",
      doesNotSupport: "Surface-eye detail or unobserved material color",
      processing: "Required product class: controlled CTX orthomosaic kept distinct from elevation",
      sourceIds: ["usgs-jezero-ctx"],
    },
    {
      id: "jezero-ctx-elevation",
      label: "Jezero CTX stereo elevation",
      kind: "scientific-reconstruction",
      stages: ["region", "terrain"],
      availableIn: ["reconstruction", "immersive"],
      coverage: "reconstructed-local",
      resolution: "20 m DEM posts",
      spatialFrame: "Mars equirectangular, localized vertically to MOLA",
      supports: "Regional relief, slopes, and camera fly-down geometry",
      doesNotSupport: "Sub-pixel boulders or exact rover-wheel terrain",
      processing: "Required product class: photogrammetric stereo elevation, not a direct camera pixel",
      sourceIds: ["usgs-jezero-ctx"],
    },
    {
      id: "jezero-hirise-observation",
      label: "HiRISE controlled orthoimagery",
      kind: "observed-terrain",
      stages: ["terrain", "recorded-view"],
      availableIn: ["original", "reconstruction", "immersive"],
      coverage: "measured-orbital",
      resolution: "Product-specific sub-meter orthoimage mosaic",
      spatialFrame: "Required Mars local cartographic frame; source CRS must be preserved",
      supports: "Measured high-resolution surface texture within the published footprint",
      doesNotSupport: "Geometry hidden from orbit or true eye-level color everywhere",
      processing: "Required ingest: orthorectified orbital observations with inspectable seams and confidence",
      sourceIds: ["usgs-jezero-hirise-2025"],
    },
    {
      id: "jezero-hirise-elevation",
      label: "HiRISE stereo terrain",
      kind: "scientific-reconstruction",
      stages: ["terrain", "recorded-view"],
      availableIn: ["reconstruction", "immersive"],
      coverage: "reconstructed-local",
      resolution: "High-resolution DTM; inspect product manifest for post spacing",
      spatialFrame: "Mars local cartographic frame aligned to Jezero products",
      supports: "Evidence-bounded local relief and horizon geometry",
      doesNotSupport: "Unresolved rock faces, overhangs, or arbitrary surface detail",
      processing: "Required ingest: stereo-derived DTM with a separately verified confidence companion",
      sourceIds: ["usgs-jezero-hirise-2025"],
    },
    {
      id: "perseverance-recorded-panoramas",
      label: "Perseverance recorded panorama frames",
      kind: "captured-panorama",
      stages: ["recorded-view"],
      availableIn: ["original", "reconstruction", "immersive"],
      coverage: "recorded-view",
      resolution: "Frame- and stitch-specific; original products remain downloadable",
      spatialFrame: "Placement requires exact camera frames and a matching PLACES localization; unresolved",
      supports: "What the camera recorded at a declared station, time, and color treatment",
      doesNotSupport: "A continuous drive recording or pixels behind occlusions",
      processing: "Individual stills or explicitly documented stitches; no invented intermediate frames",
      sourceIds: [
        "mars-camera-archive-sis",
        "nasa-perseverance-raw-images",
        "jpl-sol-3-panorama",
        "jpl-sol-4-panorama",
        "jpl-sol-1349-panorama",
      ],
    },
    {
      id: "perseverance-local-mesh",
      label: "Rover stereo mesh",
      kind: "scientific-reconstruction",
      stages: ["terrain", "recorded-view"],
      availableIn: ["reconstruction", "immersive"],
      coverage: "reconstructed-local",
      resolution: "Product-specific stereo mesh; coverage limited to camera overlap",
      spatialFrame: "Required frame chain: rover site/drive through a verified archived localization",
      supports: "Parallax-bounded local geometry where paired camera observations overlap",
      doesNotSupport: "Geometry outside stereo coverage or beneath occlusions",
      processing: "PDS stereo/mesh products; holes remain visible in Reconstruction mode",
      sourceIds: ["mars-camera-archive-sis", "mars-pds-release-15"],
    },
    {
      id: "perseverance-places-pose",
      label: "Release-pinned rover-pose requirement",
      kind: "scientific-reconstruction",
      stages: ["terrain", "recorded-view"],
      availableIn: ["reconstruction", "immersive"],
      coverage: "reconstructed-local",
      resolution: "Per-drive localization; uncertainty is release and method specific",
      spatialFrame: "Mars body-fixed → rover site/drive → instrument frame",
      supports: "A verified product would place a recorded camera node within the traverse frame",
      doesNotSupport: "An exact hardcoded coordinate without the matching PLACES record",
      processing: "Pending: retain and validate matching localization and mechanism-angle records",
      sourceIds: ["mars-places-release-15", "naif-mars-2020"],
    },
    {
      id: "jezero-between-node-interpolation",
      label: "Between-node navigation surface",
      kind: "interpolation",
      stages: ["recorded-view"],
      availableIn: ["immersive"],
      coverage: "interpolated-gap",
      resolution: "Display mesh only; bounded by the nearest measured layers",
      spatialFrame: "Local tangent display frame",
      supports: "Comfortable movement between recorded stations with visible boundaries",
      doesNotSupport: "A claim that intermediate eye-level views were photographed",
      processing: "Gap fill from orbital/local geometry; hatch and status label always enabled",
      sourceIds: ["usgs-jezero-hirise-2025", "mars-places-release-15"],
    },
    {
      id: "mars-immersive-atmosphere",
      label: "Immersive Mars lighting and atmosphere",
      kind: "immersive-display",
      stages: ["orbit", "region", "terrain", "recorded-view"],
      availableIn: ["immersive"],
      coverage: "interpolated-gap",
      resolution: "Display transform—not a spatial measurement",
      spatialFrame: "Camera-relative rendering frame",
      supports: "Depth cues, transition continuity, and an emotionally legible scene",
      doesNotSupport: "Exact weather, dust opacity, sky color, or lighting at an unrecorded time",
      processing: "Parameterized atmosphere and lighting; values and source assumptions shown in Evidence mode",
      sourceIds: ["mars-pds-release-15"],
    },
  ],
  stages: [
    {
      id: "orbit",
      shortLabel: "Orbit",
      title: "Mars from orbit",
      scale: "Planet · thousands of kilometres",
      summary:
        "Declare the orbital image product needed to locate Jezero at planetary scale before any controlled ingest.",
      evidenceIds: ["mars-orbital-context", "mars-immersive-atmosphere"],
      captureNodeIds: [],
      boundary:
        "Global layers vary in resolution and lighting; no globe texture implies rover-scale detail.",
    },
    {
      id: "region",
      shortLabel: "Region",
      title: "Jezero regional control",
      scale: "Crater · tens of kilometres",
      summary:
        "Declare the controlled CTX image and stereo-elevation products required for crater, delta, and traverse context.",
      evidenceIds: [
        "jezero-ctx-observation",
        "jezero-ctx-elevation",
        "mars-immersive-atmosphere",
      ],
      captureNodeIds: [],
      boundary:
        "Five-metre image pixels and twenty-metre elevation posts cannot describe individual rocks.",
    },
    {
      id: "terrain",
      shortLabel: "Terrain",
      title: "Evidence-bounded local terrain",
      scale: "Corridor · metres to kilometres",
      summary:
        "Declare the HiRISE, stereo-terrain, rover-mesh, and pose products that must be validated without flattening their certainty classes.",
      evidenceIds: [
        "jezero-ctx-observation",
        "jezero-ctx-elevation",
        "jezero-hirise-observation",
        "jezero-hirise-elevation",
        "perseverance-local-mesh",
        "perseverance-places-pose",
        "mars-immersive-atmosphere",
      ],
      captureNodeIds: [],
      boundary:
        "Local geometry exists only where stereo coverage supports it; holes are data, not defects to hide.",
    },
    {
      id: "recorded-view",
      shortLabel: "Recorded view",
      title: "Perseverance capture stations",
      scale: "Camera node · centimetres to kilometres",
      summary:
        "Inspect contracts for discrete rover stations, exact source frames, documented stitches, and the geometry still required to place them.",
      evidenceIds: [
        "jezero-hirise-observation",
        "jezero-hirise-elevation",
        "perseverance-recorded-panoramas",
        "perseverance-local-mesh",
        "perseverance-places-pose",
        "jezero-between-node-interpolation",
        "mars-immersive-atmosphere",
      ],
      captureNodeIds: [
        "perseverance-landing-sol-3",
        "perseverance-landing-sol-4",
        "perseverance-rim-sol-1349",
      ],
      boundary:
        "Moving away from a capture origin leaves recorded pixels. Reconstruction and Immersive modes mark that transition.",
    },
  ],
  captureNodes: [
    {
      id: "perseverance-landing-sol-3",
      label: "Landing site · first Mastcam-Z 360",
      mission: "Mars 2020 · Perseverance",
      instrument: "Mastcam-Z",
      recordedAt: "2021-02-21",
      missionClock: "Sol 3 · exact acquisition times are frame-specific",
      place: "Octavia E. Butler Landing, Jezero Crater",
      coordinate: {
        latitudeDegrees: 18.4447,
        longitudeDegreesEast: 77.4508,
        frame: "Mars body-fixed, approximate landing-site display coordinate",
        precision:
          "Approximate UI anchor only; ingest the matching PLACES record for scientific placement",
      },
      media: "stitched-still-panorama",
      continuity: "discrete-stills-not-continuous-footage",
      fieldOfView: "360° documented panorama assembled from 142 still images",
      resolution: "Product-specific; original frames and PDS labels are authoritative",
      colorTreatment: "Published mission composite; product-specific calibration applies",
      evidenceIds: [
        "perseverance-recorded-panoramas",
        "perseverance-places-pose",
      ],
      sourceIds: [
        "jpl-sol-3-panorama",
        "mars-pds-release-15",
        "mars-places-release-15",
      ],
      limitation:
        "This is a panorama assembled on Earth from still frames. It is not video of a continuous drive.",
    },
    {
      id: "perseverance-landing-sol-4",
      label: "Landing site · high-resolution horizon",
      mission: "Mars 2020 · Perseverance",
      instrument: "Mastcam-Z right eye · 110 mm zoom",
      recordedAt: "2021-02-22",
      missionClock: "Sol 4 · afternoon sequence",
      place: "Octavia E. Butler Landing, facing the ancient delta",
      coordinate: {
        latitudeDegrees: 18.4447,
        longitudeDegreesEast: 77.4508,
        frame: "Mars body-fixed, approximate landing-site display coordinate",
        precision:
          "Approximate UI anchor only; exact camera pose must resolve from archived localization and mechanism angles",
      },
      media: "stitched-still-panorama",
      continuity: "discrete-stills-not-continuous-footage",
      fieldOfView: "Horizon scan from 79 still images; not full vertical coverage",
      resolution:
        "93,355 × 2,127 published full-width product; about 50 cm features resolvable on the delta front at ~2 km",
      colorTreatment:
        "Preliminary calibrated natural-color composite; not white balanced",
      evidenceIds: [
        "perseverance-recorded-panoramas",
        "perseverance-places-pose",
      ],
      sourceIds: [
        "jpl-sol-4-panorama",
        "mars-pds-release-15",
        "mars-places-release-15",
      ],
      limitation:
        "The published horizon panorama deliberately omits some upper crater rim; missing pixels remain missing.",
    },
    {
      id: "perseverance-rim-sol-1349",
      label: "Jezero rim ascent · Lookout Hill approach",
      mission: "Mars 2020 · Perseverance",
      instrument: "Mastcam-Z",
      recordedAt: "2024-12-05",
      missionClock: "Sol 1349 · exact frame times are product-specific",
      place: "Western Jezero rim, about 350 m from and 75 m below Lookout Hill",
      coordinate: null,
      media: "stitched-still-panorama",
      continuity: "discrete-stills-not-continuous-footage",
      fieldOfView: "Published panorama of the ascent slope",
      resolution: "Product-specific panorama; resolve original frames through the archive",
      colorTreatment: "Published mission composite; inspect asset caption and PDS products",
      evidenceIds: [
        "perseverance-recorded-panoramas",
        "perseverance-places-pose",
      ],
      sourceIds: [
        "jpl-sol-1349-panorama",
        "mars-pds-release-15",
        "mars-places-release-15",
      ],
      limitation:
        "No coordinate is hardcoded here: the exact scene anchor must be resolved from the matching PLACES release record.",
    },
  ],
} as const satisfies SurfaceExperience<
  MarsSourceId,
  MarsEvidenceId,
  MarsCaptureId
>;

type ApolloSourceId =
  | "nasa-apollo-17-mission"
  | "nasa-apollo-surface-journal"
  | "nasa-open-data-apollo-panoramas"
  | "lpi-apollo-panoramas"
  | "lpi-apollo-17-overview"
  | "usgs-apollo-17-orthomosaic"
  | "lunar-ode"
  | "moon-trek-api";

type ApolloEvidenceId =
  | "moon-orbital-context"
  | "apollo17-lroc-ortho"
  | "apollo17-lroc-dem"
  | "apollo17-traverse-record"
  | "apollo17-recorded-panoramas"
  | "apollo17-local-photogrammetry"
  | "apollo17-between-station-interpolation"
  | "moon-immersive-lighting";

type ApolloCaptureId =
  | "apollo17-landing-site-panorama"
  | "apollo17-station-5-record"
  | "apollo17-station-6-panorama";

export const moonApollo17Surface = {
  id: "moon-taurus-littrow-apollo-17",
  body: "Moon",
  region: "Taurus–Littrow Valley",
  mission: "Apollo 17",
  release: "surface-reference-0.1.0",
  summary:
    "A lunar surface reference connecting controlled LRO terrain, the documented rover traverse, astronaut photography, and stitched station panoramas.",
  coordinateConvention:
    "Planetocentric latitude and positive-east longitude; lunar product CRS and historical mission map frames remain explicit.",
  continuousFootageAvailable: false,
  continuityStatement:
    "Apollo 17 provides surface still photography, film segments, audio, transcripts, maps, and traverse records—not complete continuous street-level imagery. Station-to-station motion is a labeled reconstruction.",
  sources: [
    {
      id: "nasa-apollo-17-mission",
      title: "Apollo 17 Mission Details",
      publisher: "NASA",
      authority: "NASA",
      url: "https://www.nasa.gov/missions/apollo/apollo-17-mission-details/",
      sourceRole: "historical-record",
      release: "Historical mission record · page updated 2023-09-29",
      retrievedAt: "2026-07-19",
      credit: "NASA",
      rightsStatus: "public-domain-review-required",
      integrationPolicy:
        "Use for mission facts and broad landing coordinates; retain original mission reports for event-level claims.",
    },
    {
      id: "nasa-apollo-surface-journal",
      title: "Apollo Lunar Surface Journal and Apollo Flight Journal",
      publisher: "NASA History",
      authority: "NASA",
      url: "https://www.nasa.gov/history/alsj-and-afj/",
      sourceRole: "historical-record",
      release: "Living annotated historical archive",
      retrievedAt: "2026-07-19",
      credit: "NASA and named journal contributors; asset-specific credits apply",
      rightsStatus: "collection-specific",
      integrationPolicy:
        "Link transcript, time, station, frame, audio, and commentary without assuming every embedded asset has identical rights.",
    },
    {
      id: "nasa-open-data-apollo-panoramas",
      title: "Apollo Surface Panoramas Dataset",
      publisher: "NASA Open Data Portal",
      authority: "NASA",
      url: "https://data.nasa.gov/dataset/apollo-surface-panoramas",
      sourceRole: "mission-media",
      release: "Public dataset record · irregular updates",
      retrievedAt: "2026-07-19",
      credit: "NASA / Lunar and Planetary Institute; panorama-specific credits apply",
      rightsStatus: "link-first-rights-review",
      integrationPolicy:
        "The portal lists no explicit dataset license; link first and clear redistribution rights per asset.",
    },
    {
      id: "lpi-apollo-panoramas",
      title: "Apollo Surface Panoramas",
      publisher: "Lunar and Planetary Institute",
      authority: "LPI / NASA-contributed mission photography",
      url: "https://www.lpi.usra.edu/resources/apollopanoramas/",
      sourceRole: "mission-media",
      release: "Curated digital panorama library",
      retrievedAt: "2026-07-19",
      credit: "Lunar and Planetary Institute; NASA; original Apollo frame credits",
      rightsStatus: "link-first-rights-review",
      integrationPolicy:
        "Preserve the constituent Hasselblad frame identifiers and annotation status for every stitch.",
    },
    {
      id: "lpi-apollo-17-overview",
      title: "Apollo 17 Mission Overview",
      publisher: "Lunar and Planetary Institute",
      authority: "LPI / NASA mission record",
      url: "https://www.lpi.usra.edu/lunar/missions/apollo/apollo_17/",
      sourceRole: "historical-record",
      release: "Curated mission overview",
      retrievedAt: "2026-07-19",
      credit: "Lunar and Planetary Institute and NASA",
      rightsStatus: "collection-specific",
      integrationPolicy:
        "Use station and traverse context as a discovery index; trace measurements and photographs to primary records.",
    },
    {
      id: "usgs-apollo-17-orthomosaic",
      title: "Moon Apollo 17 LROC NAC Landing Site Orthomosaic 50 cm",
      publisher: "USGS Astrogeology Science Center",
      authority: "DLR / LROC Team / USGS",
      url: "https://astrogeology.usgs.gov/search/map/moon_apollo_17_lroc_nac_landing_site_orthomosaic_50cm",
      sourceRole: "cartographic-product",
      release: "2018-05-01 product release",
      retrievedAt: "2026-07-19",
      credit: "Technical University Berlin, DLR, LROC Team, USGS Astrogeology",
      rightsStatus: "credit-required",
      integrationPolicy:
        "Keep the 0.5 m orthomosaic, 1.5 m stereo DEM, traverse overlay, and map annotations as separable layers.",
    },
    {
      id: "lunar-ode",
      title: "Lunar Orbital Data Explorer",
      publisher: "NASA PDS Geosciences Node",
      authority: "NASA PDS",
      url: "https://ode.rsl.wustl.edu/moon/",
      sourceRole: "authoritative-archive",
      release: "Continuously indexed PDS holdings",
      retrievedAt: "2026-07-19",
      credit: "NASA PDS and product-specific mission teams",
      rightsStatus: "collection-specific",
      integrationPolicy:
        "Use ODE for product discovery and footprints; retain the original PDS labels and archives as authority.",
    },
    {
      id: "moon-trek-api",
      title: "Moon Trek API and Layer Registry",
      publisher: "NASA Solar System Treks",
      authority: "NASA/JPL-Caltech",
      url: "https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon",
      sourceRole: "interactive-service",
      release: "Continuously maintained WMTS/WMS layer registry",
      retrievedAt: "2026-07-19",
      credit: "NASA/JPL-Caltech and underlying layer producers",
      rightsStatus: "collection-specific",
      integrationPolicy:
        "Use service metadata for Apollo 17 metric-camera layers while preserving each underlying product citation.",
    },
  ],
  evidence: [
    {
      id: "moon-orbital-context",
      label: "Moon orbital context",
      kind: "observed-terrain",
      stages: ["orbit"],
      availableIn: ["original", "reconstruction", "immersive"],
      coverage: "measured-orbital",
      resolution: "Layer-specific global products",
      spatialFrame: "Required ingest frame: Moon body-fixed with each native layer CRS preserved",
      supports: "Selected validated products would support planetary location and orbital morphology",
      doesNotSupport: "Astronaut-eye surface detail everywhere",
      processing: "Planned ingest: resolve a Trek/ODE discovery layer to exact original product metadata",
      sourceIds: ["lunar-ode", "moon-trek-api"],
    },
    {
      id: "apollo17-lroc-ortho",
      label: "Taurus–Littrow LROC NAC orthomosaic",
      kind: "observed-terrain",
      stages: ["region", "terrain", "recorded-view"],
      availableIn: ["original", "reconstruction", "immersive"],
      coverage: "measured-orbital",
      resolution: "0.5 m/pixel orthomosaic",
      spatialFrame: "Moon local cartographic frame; 30.4294°E–30.9162°E, 19.9771°N–20.3639°N",
      supports: "Measured modern orbital texture across the Apollo 17 traverse region",
      doesNotSupport: "The exact 1972 surface appearance or occluded rock geometry",
      processing: "Required product class: orthorectified LROC NAC observations",
      sourceIds: ["usgs-apollo-17-orthomosaic"],
    },
    {
      id: "apollo17-lroc-dem",
      label: "Taurus–Littrow LROC NAC stereo DEM",
      kind: "scientific-reconstruction",
      stages: ["region", "terrain", "recorded-view"],
      availableIn: ["reconstruction", "immersive"],
      coverage: "reconstructed-local",
      resolution: "1.5 m DEM posts",
      spatialFrame: "Moon local cartographic frame",
      supports: "Valley relief, slopes, and evidence-bounded camera geometry",
      doesNotSupport: "Sub-metre rocks, overhangs, or 1972 footprints",
      processing: "Required product class: photogrammetric reconstruction from LROC NAC stereo pairs",
      sourceIds: ["usgs-apollo-17-orthomosaic"],
    },
    {
      id: "apollo17-traverse-record",
      label: "Apollo 17 traverse and geology stations",
      kind: "scientific-reconstruction",
      stages: ["terrain", "recorded-view"],
      availableIn: ["reconstruction", "immersive"],
      coverage: "reconstructed-local",
      resolution: "Station- and map-specific; not a continuous tracking stream",
      spatialFrame: "Registration target: historical traverse maps to modern lunar control; unverified",
      supports: "Documented EVA sequence and approximate station relationships",
      doesNotSupport: "Centimetre-accurate continuous astronaut or rover motion",
      processing: "Planned validation: reconcile historical records with the controlled USGS site map",
      sourceIds: [
        "nasa-apollo-17-mission",
        "nasa-apollo-surface-journal",
        "lpi-apollo-17-overview",
        "usgs-apollo-17-orthomosaic",
      ],
    },
    {
      id: "apollo17-recorded-panoramas",
      label: "Apollo 17 recorded panorama frames",
      kind: "captured-panorama",
      stages: ["recorded-view"],
      availableIn: ["original", "reconstruction", "immersive"],
      coverage: "recorded-view",
      resolution: "Scan- and stitch-specific; exact constituent Hasselblad frame bytes are not retained",
      spatialFrame: "Station position and camera orientation remain unresolved pending verified mission records",
      supports: "Recorded lines of sight from documented astronaut stations",
      doesNotSupport: "Continuous coverage between stations or pixels behind the camera/occlusions",
      processing: "Candidate documented stitches; retain and validate exact frames, annotations, and lineage before use",
      sourceIds: [
        "nasa-open-data-apollo-panoramas",
        "lpi-apollo-panoramas",
        "nasa-apollo-surface-journal",
      ],
    },
    {
      id: "apollo17-local-photogrammetry",
      label: "Station-local photogrammetry",
      kind: "scientific-reconstruction",
      stages: ["recorded-view"],
      availableIn: ["reconstruction", "immersive"],
      coverage: "reconstructed-local",
      resolution: "Depends on frame overlap and scan quality",
      spatialFrame: "Future station-local reconstruction requiring a validated traverse-frame alignment",
      supports: "Geometry where overlapping mission photographs constrain parallax",
      doesNotSupport: "Unphotographed surfaces or a globally uniform mesh",
      processing: "Photogrammetry only where frame overlap and camera metadata meet validation thresholds",
      sourceIds: ["lpi-apollo-panoramas", "nasa-apollo-surface-journal"],
    },
    {
      id: "apollo17-between-station-interpolation",
      label: "Between-station navigation surface",
      kind: "interpolation",
      stages: ["recorded-view"],
      availableIn: ["immersive"],
      coverage: "interpolated-gap",
      resolution: "Display-only between evidence islands",
      spatialFrame: "Local tangent display frame",
      supports: "Comfortable route-following across the documented traverse",
      doesNotSupport: "A claim that the rendered eye-level path was filmed in full",
      processing: "Orbital terrain plus visibly hatched interpolation between capture stations",
      sourceIds: ["usgs-apollo-17-orthomosaic"],
    },
    {
      id: "moon-immersive-lighting",
      label: "Immersive lunar lighting",
      kind: "immersive-display",
      stages: ["orbit", "region", "terrain", "recorded-view"],
      availableIn: ["immersive"],
      coverage: "interpolated-gap",
      resolution: "Display transform—not a spatial observation",
      spatialFrame: "Camera-relative rendering frame",
      supports: "Depth perception and reconstructed transitions",
      doesNotSupport: "A source-faithful shadow state unless Sun geometry and terrain are solved for the event time",
      processing: "No atmospheric scattering; parameterized illumination is labeled until historically reconstructed",
      sourceIds: ["nasa-apollo-17-mission", "usgs-apollo-17-orthomosaic"],
    },
  ],
  stages: [
    {
      id: "orbit",
      shortLabel: "Orbit",
      title: "Moon from orbit",
      scale: "Planet · thousands of kilometres",
      summary: "Declare the orbital image product needed to locate Taurus–Littrow at planetary scale.",
      evidenceIds: ["moon-orbital-context", "moon-immersive-lighting"],
      captureNodeIds: [],
      boundary: "Global products do not provide uniform astronaut-eye resolution.",
    },
    {
      id: "region",
      shortLabel: "Region",
      title: "Taurus–Littrow controlled map",
      scale: "Valley · kilometres",
      summary:
        "Declare the 0.5 m orthomosaic and 1.5 m stereo DEM required to frame the landing site, massifs, and traverse.",
      evidenceIds: [
        "apollo17-lroc-ortho",
        "apollo17-lroc-dem",
        "moon-immersive-lighting",
      ],
      captureNodeIds: [],
      boundary:
        "The orbital image was acquired decades after Apollo 17 and is not a literal 1972 surface photograph.",
    },
    {
      id: "terrain",
      shortLabel: "Terrain",
      title: "Apollo 17 traverse terrain",
      scale: "Traverse · metres to kilometres",
      summary:
        "Declare the station, traverse, and controlled-terrain products needed for a future registration while historical uncertainty remains visible.",
      evidenceIds: [
        "apollo17-lroc-ortho",
        "apollo17-lroc-dem",
        "apollo17-traverse-record",
        "moon-immersive-lighting",
      ],
      captureNodeIds: [],
      boundary:
        "The historical traverse is reconstructed from mission records, not recovered from continuous positioning telemetry.",
    },
    {
      id: "recorded-view",
      shortLabel: "Recorded view",
      title: "Apollo 17 photography stations",
      scale: "Camera station · centimetres to kilometres",
      summary:
        "Inspect contracts for discrete astronaut photography stations, exact frame records, and bounded local reconstruction.",
      evidenceIds: [
        "apollo17-lroc-ortho",
        "apollo17-lroc-dem",
        "apollo17-traverse-record",
        "apollo17-recorded-panoramas",
        "apollo17-local-photogrammetry",
        "apollo17-between-station-interpolation",
        "moon-immersive-lighting",
      ],
      captureNodeIds: [
        "apollo17-landing-site-panorama",
        "apollo17-station-5-record",
        "apollo17-station-6-panorama",
      ],
      boundary:
        "Leaving a documented camera origin enters reconstruction; station-to-station motion is never labeled as footage.",
    },
  ],
  captureNodes: [
    {
      id: "apollo17-landing-site-panorama",
      label: "Landing site panorama",
      mission: "Apollo 17",
      instrument: "70 mm Hasselblad surface photography",
      recordedAt: "1972-12-11",
      missionClock: "Landing-day surface record; individual frame times vary",
      place: "Taurus–Littrow landing site",
      coordinate: {
        latitudeDegrees: 20.16,
        longitudeDegreesEast: 30.77,
        frame: "Moon body-fixed, NASA published landing coordinate",
        precision:
          "Broad mission coordinate; station pose must be refined from surface-journal and controlled-map records",
      },
      media: "stitched-still-panorama",
      continuity: "discrete-stills-not-continuous-footage",
      fieldOfView: "Documented surface panorama assembled from individual mission frames",
      resolution: "Scan and stitch specific",
      colorTreatment: "Film scan; color and exposure are frame- and processing-specific",
      evidenceIds: [
        "apollo17-recorded-panoramas",
        "apollo17-traverse-record",
      ],
      sourceIds: [
        "lpi-apollo-panoramas",
        "nasa-apollo-surface-journal",
        "nasa-apollo-17-mission",
      ],
      limitation:
        "The panorama is a still-frame stitch. Camera origin and orientation require station-level historical reconciliation.",
    },
    {
      id: "apollo17-station-5-record",
      label: "Station 5 · Camelot crater",
      mission: "Apollo 17 · EVA 2",
      instrument: "70 mm Hasselblad surface photography",
      recordedAt: "1972-12-12",
      missionClock: "EVA 2 · source-journal sequence anchor; exact frame times pending",
      place: "Camelot crater ejecta, Station 5",
      coordinate: null,
      media: "still-frame-set",
      continuity: "discrete-stills-not-continuous-footage",
      fieldOfView: "Documented station photography, including frame AS17-145-22160",
      resolution: "Source-record scan-specific; bytes not admitted",
      colorTreatment: "Film scan; no invented color outside recorded frames",
      evidenceIds: [
        "apollo17-recorded-panoramas",
        "apollo17-traverse-record",
      ],
      sourceIds: [
        "nasa-apollo-surface-journal",
        "lpi-apollo-panoramas",
        "lpi-apollo-17-overview",
      ],
      limitation:
        "This node represents a bounded set of station photographs, not a 360° recording or continuous rover video.",
    },
    {
      id: "apollo17-station-6-panorama",
      label: "Station 6 panorama network",
      mission: "Apollo 17 · EVA 3",
      instrument: "70 mm Hasselblad surface photography",
      recordedAt: "1972-12-13",
      missionClock: "EVA 3 · source-journal sequence anchor; exact frame times pending",
      place: "North Massif traverse, Station 6",
      coordinate: null,
      media: "stitched-still-panorama",
      continuity: "discrete-stills-not-continuous-footage",
      fieldOfView: "Published LPI panorama assembled from mission photographs",
      resolution: "Panorama and constituent scan specific",
      colorTreatment: "Film scan and stitch; annotated and unannotated products are distinct",
      evidenceIds: [
        "apollo17-recorded-panoramas",
        "apollo17-traverse-record",
      ],
      sourceIds: [
        "lpi-apollo-panoramas",
        "nasa-apollo-surface-journal",
      ],
      limitation:
        "Local geometry may only be reconstructed where multiple photographs provide validated overlap.",
    },
  ],
} as const satisfies SurfaceExperience<
  ApolloSourceId,
  ApolloEvidenceId,
  ApolloCaptureId
>;

export const surfaceExperiences = [
  marsJezeroSurface,
  moonApollo17Surface,
] as const;

const permittedModesByKind: Record<
  SurfaceEvidenceKind,
  readonly SurfaceViewMode[]
> = {
  "observed-terrain": ["original", "reconstruction", "immersive"],
  "captured-panorama": ["original", "reconstruction", "immersive"],
  "scientific-reconstruction": ["reconstruction", "immersive"],
  interpolation: ["immersive"],
  "immersive-display": ["immersive"],
};

export function evidenceIsVisible(
  evidence: SurfaceEvidence,
  mode: SurfaceViewMode,
): boolean {
  return evidence.availableIn.includes(mode);
}

export function validateSurfaceExperience(
  experience: SurfaceExperience,
): readonly string[] {
  const errors: string[] = [];
  const sourceIds = new Set(experience.sources.map((source) => source.id));
  const evidenceIds = new Set(experience.evidence.map((item) => item.id));
  const captureIds = new Set(experience.captureNodes.map((node) => node.id));

  for (const item of experience.evidence) {
    for (const sourceId of item.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        errors.push(`${item.id}: unknown source ${sourceId}`);
      }
    }

    const permitted = permittedModesByKind[item.kind];
    for (const mode of item.availableIn) {
      if (!permitted.includes(mode)) {
        errors.push(`${item.id}: ${item.kind} cannot appear in ${mode} mode`);
      }
    }
  }

  for (const stage of experience.stages) {
    for (const evidenceId of stage.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`${stage.id}: unknown evidence ${evidenceId}`);
      }
    }
    for (const captureId of stage.captureNodeIds) {
      if (!captureIds.has(captureId)) {
        errors.push(`${stage.id}: unknown capture node ${captureId}`);
      }
    }
  }

  for (const node of experience.captureNodes) {
    for (const evidenceId of node.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`${node.id}: unknown evidence ${evidenceId}`);
      }
    }
    for (const sourceId of node.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        errors.push(`${node.id}: unknown source ${sourceId}`);
      }
    }
    if (node.continuity !== "discrete-stills-not-continuous-footage") {
      errors.push(`${node.id}: continuity claim must remain discrete`);
    }
  }

  return errors;
}

export const surfaceFixtureValidation = surfaceExperiences.map(
  (experience) => ({
    id: experience.id,
    errors: validateSurfaceExperience(experience),
  }),
);
