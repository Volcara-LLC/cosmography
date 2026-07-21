export const earthDashboardPresentation = {
  id: "nasa-blue-marble-dashboard-v1",
  title: "Blue Marble land-surface, ocean, sea-ice, and cloud mosaic",
  representationClass: "derived-observation",
  localAssetUrl: "/assets/earth/nasa-blue-marble-2048.png",
  sourceAuthority: "NASA Goddard Space Flight Center Scientific Visualization Studio",
  sourceProductUrl: "https://svs.gsfc.nasa.gov/2915",
  sourceAssetUrl:
    "https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-2048.png",
  derivative: {
    bytes: 1_511_379,
    sha256: "ae6214b078ed0864c96f74bcb10ae3021f6eb116f8059797efe0fa9ea8b89d35",
    processing: "Retained 2048-pixel NASA SVS presentation image without local color alteration.",
  },
  temporalDisclosure:
    "A seamless, processed global mosaic assembled chiefly from MODIS observations; land and coastal components use June–September 2001 data. It is not a live Earth view.",
  credit: "NASA/GSFC Scientific Visualization Studio; Reto Stöckli, NASA/GSFC; NASA Earth Observatory",
} as const;

export const earthDashboardSiteMedia = {
  "nasa-kennedy": {
    title: "Kennedy Space Center from Skylab 4",
    localAssetUrl: "/assets/earth/kennedy-skylab4.jpg",
    sourceUrl: "https://www.nasa.gov/image-article/view-of-kennedy-space-center-from-skylab-4/",
    sourceAuthority: "NASA",
    representationClass: "recorded-observation",
    caption:
      "Historic color-infrared orbital photograph recorded by Skylab 4 on February 1, 1974; not a current operational or natural-color view.",
    bytes: 187_274,
    sha256: "c854e5972146a7e8998f03be5cfc57fa97fda9c5c874a1e3f80f7400d699bdd2",
    credit: "NASA",
  },
} as const;
