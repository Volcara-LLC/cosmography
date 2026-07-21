export type MarsGlobePlace = {
  readonly id: "jezero" | "gale" | "olympus-mons" | "valles-marineris";
  readonly name: string;
  readonly kind: string;
  readonly latitude: number;
  readonly longitudeEast: number;
  readonly diameterKm: number;
  readonly labelTier: "overview" | "regional";
  readonly sourceUrl: string;
  readonly sourceAuthority: "USGS Gazetteer of Planetary Nomenclature / IAU";
  readonly surfaceView:
    | {
        readonly state: "recorded-presentation-available";
        readonly label: string;
        readonly nodeId: "perseverance-landing-sol-4";
      }
    | {
        readonly state: "not-retained";
        readonly label: string;
      };
};

export const marsGlobePresentation = {
  id: "mars-viking-mdim21-global-presentation-v1",
  target: "Mars",
  representationClass: "derived-observation",
  title: "Mars Viking Colorized Global Mosaic",
  sourceAuthority: "USGS Astrogeology Science Center / NASA Ames",
  sourceProductUrl:
    "https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m",
  sourceAssetUrl:
    "https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg",
  sourceAsset: {
    width: 21_339,
    height: 10_670,
    bytes: 36_708_552,
    sha256: "fdfcd335559c3dc67052b7e8a9565d850e336ac0d1f3ea7f5eb7826ffb44ecb2",
  },
  localAssetUrl: "/assets/mars/mars-viking-mdim21-global-4096.jpg",
  derivative: {
    width: 4_096,
    height: 2_048,
    bytes: 2_587_531,
    sha256: "37a15270f71874e6671c670c5f295c9568bb8d7a68ffc25ebdbd0d91c46164a6",
    processing:
      "High-quality bicubic downsample to a 2:1 JPEG presentation texture; no feature geometry, color interpretation, or scientific coordinate values were added.",
  },
  coordinateSystem:
    "Planetocentric latitude; positive-east longitude; 0–360° marker values projected onto the simple-cylindrical presentation texture.",
  appearanceDisclosure:
    "A colorized Viking observation mosaic blended over MDIM 2.1. It is a processed global basemap, not a current natural-color photograph or rover-scale surface record.",
  spatialDisclosure:
    "The texture supports global orientation. Named marker centers come from the USGS/IAU Gazetteer; this presentation does not establish local terrain or camera-pose accuracy.",
  rights: {
    access: "Public domain",
    useConstraints: "None stated in the source product record",
    credit: "USGS Astrogeology Science Center / NASA Ames",
  },
} as const;

export const marsMappedRegions = [
  {
    id: "valles-marineris-floor-units",
    label: "Valles Marineris mapped canyon-floor units",
    localAssetUrl: "/assets/mars/valles-i2010-floor-units.geojson",
    color: 0x9ee8ff,
    sourceAuthority: "USGS Astrogeology Science Center",
    sourceProductUrl:
      "https://astrogeology.usgs.gov/search/map/mars_geologic_map_of_the_valles_marineris_region",
    sourceMap: "USGS I-2010 (Witbeck, Tanaka, and Scott, 1991)",
    selectedUnits: "Avfg, Avfr, Avfs, and Hvf",
    meaning:
      "Mapped canyon-floor deposit units that follow part of the canyon system; not a complete Valles Marineris boundary.",
    derivative: {
      bytes: 34_732,
      sha256: "dfccf79f4c99f5327501a158865a637b3c383dbbfaaa6362e3264b4488ac9dfa",
      processing:
        "Selected map polygons were unioned, simplified by 9 km in the source projected coordinate system, converted to planetocentric positive-east longitude/latitude, and rounded to four decimals.",
    },
  },
  {
    id: "olympus-mons-shield-units",
    label: "Olympus Mons mapped shield",
    localAssetUrl: "/assets/mars/olympus-i2327-shield-units.geojson",
    color: 0xffd58c,
    sourceAuthority: "USGS Astrogeology Science Center",
    sourceProductUrl:
      "https://astrogeology.usgs.gov/search/map/mars_geologic_maps_of_the_olympus_mons_region",
    sourceMap: "USGS I-2327 (Morris and Tanaka, 1994)",
    selectedUnits: "Aos1, Aos2, Aos3, and Aos4",
    meaning:
      "Mapped shield members 1–4 of the Olympus Mons Formation; surrounding aureole deposits are excluded.",
    derivative: {
      bytes: 11_974,
      sha256: "270432142ef9eba6cb2da73b87a02527afe3a7b7c80e332234e781b0741e6198",
      processing:
        "Selected map polygons were unioned, simplified by 9 km in the source projected coordinate system, converted to planetocentric positive-east longitude/latitude, and rounded to four decimals.",
    },
  },
] as const;

export const marsGlobePlaces = [
  {
    id: "jezero",
    name: "Jezero Crater",
    kind: "Crater · Perseverance landing region",
    latitude: 18.21,
    longitudeEast: 77.62,
    diameterKm: 49,
    labelTier: "overview",
    sourceUrl: "https://planetarynames.wr.usgs.gov/Feature/14300",
    sourceAuthority: "USGS Gazetteer of Planetary Nomenclature / IAU",
    surfaceView: {
      state: "recorded-presentation-available",
      label: "Recorded Perseverance view available",
      nodeId: "perseverance-landing-sol-4",
    },
  },
  {
    id: "gale",
    name: "Gale Crater",
    kind: "Crater · Curiosity exploration region",
    latitude: -5.44,
    longitudeEast: 137.7,
    diameterKm: 155.3,
    labelTier: "regional",
    sourceUrl: "https://planetarynames.wr.usgs.gov/Feature/2071",
    sourceAuthority: "USGS Gazetteer of Planetary Nomenclature / IAU",
    surfaceView: {
      state: "not-retained",
      label: "No recorded view retained in this release",
    },
  },
  {
    id: "olympus-mons",
    name: "Olympus Mons",
    kind: "Mons · volcanic edifice",
    latitude: 18.65,
    longitudeEast: 226.2,
    diameterKm: 610.13,
    labelTier: "overview",
    sourceUrl: "https://planetarynames.wr.usgs.gov/Feature/4453",
    sourceAuthority: "USGS Gazetteer of Planetary Nomenclature / IAU",
    surfaceView: {
      state: "not-retained",
      label: "No recorded view retained in this release",
    },
  },
  {
    id: "valles-marineris",
    name: "Valles Marineris",
    kind: "Valles · canyon system",
    latitude: -13.74,
    longitudeEast: 300.8,
    diameterKm: 3_769,
    labelTier: "overview",
    sourceUrl: "https://planetarynames.wr.usgs.gov/Feature/6288",
    sourceAuthority: "USGS Gazetteer of Planetary Nomenclature / IAU",
    surfaceView: {
      state: "not-retained",
      label: "No recorded view retained in this release",
    },
  },
] as const satisfies readonly MarsGlobePlace[];
