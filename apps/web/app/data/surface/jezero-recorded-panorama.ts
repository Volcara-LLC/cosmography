export const jezeroRecordedPanorama = {
  schemaVersion: "0.1.0",
  captureNodeId: "perseverance-landing-sol-4",
  productIdentifier: "PIA23727",
  title: "Perseverance's Mastcam-Z First High-Resolution Panorama",
  publishingAuthority: "NASA/JPL-Caltech/ASU/MSSS",
  officialRecordUrl:
    "https://www.jpl.nasa.gov/images/pia23727-perseverances-mastcam-z-first-high-resolution-panorama/",
  sourceAssetUrl:
    "https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA23727.jpg",
  localAssetUrl: "/assets/mars/pia23727-sol4-mastcam-z-panorama.jpg",
  retrievedAt: "2026-07-20T11:00:00-10:00",
  byteLength: 367_133,
  sha256: "ff925561d5b583d6e2c10a80bcd9f6a7458cc9c6fa0955b2d7d789cdfab80b9b",
  dimensions: { width: 2500, height: 1500 },
  capture: {
    date: "2021-02-22",
    missionClock: "Sol 4 · afternoon sequence",
    instrument: "Mastcam-Z right eye · 110 mm zoom",
    sourceFrames: 79,
  },
  processing:
    "JPL-published JPEG presentation derivative of a 79-frame stitched mosaic; preliminary calibrated natural-color composite, not white balanced.",
  coverage:
    "This retained JPEG is a published presentation view, not the 93,355 × 2,127 full-width archive derivative or its 79 source frames. It must not be used for photogrammetry or full-panorama completeness claims.",
  rights: {
    policyUrl: "https://www.jpl.nasa.gov/jpl-image-use-policy/",
    reviewedAt: "2026-07-20T11:00:00-10:00",
    credit: "NASA/JPL-Caltech/ASU/MSSS",
    displayAllowed: true,
    redistributionAllowedUnderPolicy: true,
    endorsementAllowed: false,
    disclosure:
      "JPL public-site image policy reviewed for this exact JPL-hosted derivative; credit is retained and no NASA, JPL, Caltech, ASU, or MSSS endorsement is implied.",
  },
  authority: {
    recordedPixels: true,
    publishedDerivative: true,
    sourceFramesRetained: false,
    physicalCameraPose: false,
    terrainBinding: false,
    continuousFootage: false,
  },
} as const;

export const jezeroRoverPanorama360 = {
  schemaVersion: "0.1.0",
  captureNodeId: "perseverance-landing-sol-3-360",
  productIdentifier: "PIA24264",
  title: "Mastcam-Z's First 360-Degree Panorama",
  publishingAuthority: "NASA/JPL-Caltech/MSSS/ASU",
  officialRecordUrl:
    "https://www.jpl.nasa.gov/images/pia24264-mastcam-zs-first-360-degree-panorama/",
  sourceAssetUrl:
    "https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA24264.jpg",
  sourceAsset: {
    localAssetUrl: "/assets/mars/pia24264-sol3-mastcam-z-360.jpg",
    byteLength: 2_729_297,
    sha256: "2b9e68c713700bc713dea9ce532e10bb0889061b7374575bee8a1d95791f48a2",
    dimensions: { width: 9_238, height: 2_451 },
  },
  localAssetUrl: "/assets/mars/pia24264-sol3-mastcam-z-360-8192-q82.jpg",
  retrievedAt: "2026-07-20T15:55:00-10:00",
  byteLength: 2_178_451,
  sha256: "517c42c7ca1af02d8a6df66735885c2d6cac8bf9a7378796365455bae367bbd7",
  dimensions: { width: 8_192, height: 2_173 },
  capture: {
    date: "2021-02-21",
    missionClock: "Sol 3",
    instrument: "Mastcam-Z",
    sourceFrames: 142,
    horizontalCoverageDegrees: 360,
  },
  processing:
    "JPL-published JPEG panorama stitched on Earth from 142 individual Mastcam-Z images; the retained browser derivative is a Lanczos3 resize to 8,192 pixels wide and quality-82 mozjpeg encoding, with no content added or removed.",
  coverage:
    "The mast scanned a full 360 degrees around the rover. The published mosaic has bounded vertical coverage and is not a complete spherical environment, terrain mesh, video, or continuous rover route.",
  rights: {
    policyUrl: "https://www.jpl.nasa.gov/jpl-image-use-policy/",
    reviewedAt: "2026-07-20T15:55:00-10:00",
    credit: "NASA/JPL-Caltech/MSSS/ASU",
    displayAllowed: true,
    redistributionAllowedUnderPolicy: true,
    endorsementAllowed: false,
    disclosure:
      "JPL public-site image policy reviewed for this exact JPL-hosted derivative; credit is retained and no NASA, JPL, Caltech, MSSS, or ASU endorsement is implied.",
  },
  authority: {
    recordedPixels: true,
    publishedDerivative: true,
    sourceFramesRetained: false,
    horizontalPanoramaCoverage: true,
    completeSphericalCoverage: false,
    physicalCameraPose: false,
    terrainBinding: false,
    continuousFootage: false,
  },
} as const;

export const vanZylRoverPanorama360 = {
  schemaVersion: "0.1.0",
  captureNodeId: "perseverance-van-zyl-sols-53-64-360",
  productIdentifier: "PIA24663",
  title: "Mastcam-Z's 360-degree View of Van Zyl Overlook",
  shortLabel: "Van Zyl Overlook",
  publishingAuthority: "NASA/JPL-Caltech/ASU/MSSS",
  officialRecordUrl:
    "https://www.jpl.nasa.gov/images/pia24663-mastcam-zs-360-degree-view-of-van-zyl-overlook/",
  sourceAssetUrl:
    "https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA24663.jpg",
  sourceAsset: {
    retainedLocally: false,
    width: 23_265,
    height: 5_165,
    byteLength: 15_369_037,
    sha256: "5df955f61cd471377ade2370d568eb6cf306e25948f24d19b5e980d9efc8e798",
  },
  masterMosaicDimensions: { width: 93_060, height: 20_652 },
  localAssetUrl: "/assets/mars/pia24663-van-zyl-12288-q84.jpg",
  retrievedAt: "2026-07-20T18:15:00-10:00",
  byteLength: 5_072_169,
  sha256: "5d6358002c93ec9c1f881a2176317f0350511fd070d609c50dd9e94e5d7fd233",
  dimensions: { width: 12_288, height: 2_728 },
  capture: {
    dateLabel: "Sols 53–64 · April 15–26, 2021",
    instrument: "Mastcam-Z right eye",
    sourceFrames: 992,
    horizontalCoverageDegrees: 360,
  },
  processing:
    "JPL-published JPEG presentation source downsampled with Lanczos3 to 12,288 pixels wide and encoded as progressive quality-84 JPEG; no scene content or color interpretation was added.",
  coverage:
    "A separate rover station within Jezero Crater, not the landing position. JPL states that a few obscured near-field sand patches were filled from left-eye or earlier Navcam observations and that sky coverage was digitally smoothed and expanded from observed sky color.",
  initialView: { heading: 176, fov: 58, verticalPosition: 18 },
  verticalPositionBounds: { minimum: 0, maximum: 40 },
  rights: {
    policyUrl: "https://www.jpl.nasa.gov/jpl-image-use-policy/",
    reviewedAt: "2026-07-20T18:15:00-10:00",
    credit: "NASA/JPL-Caltech/ASU/MSSS",
    displayAllowed: true,
    redistributionAllowedUnderPolicy: true,
    endorsementAllowed: false,
  },
  authority: {
    recordedPixels: true,
    publishedDerivative: true,
    sourceFramesRetained: false,
    horizontalPanoramaCoverage: true,
    completeSphericalCoverage: false,
    physicalCameraPose: false,
    terrainBinding: false,
    continuousFootage: false,
  },
} as const;

export const jezeroDeltaRoverPanorama360 = {
  schemaVersion: "0.1.0",
  captureNodeId: "perseverance-delta-sols-466-474-360",
  productIdentifier: "PIA24921",
  title: "Detailed Panorama of Mars' Jezero Crater Delta",
  shortLabel: "Jezero delta front",
  publishingAuthority: "NASA/JPL-Caltech/ASU/MSSS",
  officialRecordUrl:
    "https://www.jpl.nasa.gov/images/pia24921-detailed-panorama-of-mars-jezero-crater-delta/",
  sourceAssetUrl:
    "https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA24921.jpg",
  sourceAsset: {
    retainedLocally: false,
    width: 29_163,
    height: 8_182,
    byteLength: 26_184_264,
    sha256: "8efa813209bbb94a282f665179430a11c8be6d6c07fea7dfea0b2355f2620eb6",
  },
  masterMosaicDimensions: { width: 93_761, height: 26_305 },
  localAssetUrl: "/assets/mars/pia24921-jezero-delta-12288-q84.jpg",
  retrievedAt: "2026-07-20T18:16:00-10:00",
  byteLength: 6_171_797,
  sha256: "3f26067e283f0431d93eba3758587edebd2db8669f9a56ae60e767d18db2a32d",
  dimensions: { width: 12_288, height: 3_448 },
  capture: {
    dateLabel: "Sols 466, 467, 470, 471, and 474 · June 2022",
    instrument: "Mastcam-Z",
    sourceFrames: 1_118,
    horizontalCoverageDegrees: 360,
  },
  processing:
    "JPL-published enhanced-color JPEG presentation source downsampled with Lanczos3 to 12,288 pixels wide and encoded as progressive quality-84 JPEG; no scene content was added.",
  coverage:
    "A separate rover station at the ancient Jezero delta, not the landing position. The displayed source is the JPL enhanced-color version; black lower areas mark camera coverage gaps and are kept outside the normal look range.",
  initialView: { heading: 180, fov: 54, verticalPosition: 12 },
  verticalPositionBounds: { minimum: 0, maximum: 32 },
  rights: {
    policyUrl: "https://www.jpl.nasa.gov/jpl-image-use-policy/",
    reviewedAt: "2026-07-20T18:16:00-10:00",
    credit: "NASA/JPL-Caltech/ASU/MSSS",
    displayAllowed: true,
    redistributionAllowedUnderPolicy: true,
    endorsementAllowed: false,
  },
  authority: {
    recordedPixels: true,
    publishedDerivative: true,
    sourceFramesRetained: false,
    horizontalPanoramaCoverage: true,
    completeSphericalCoverage: false,
    physicalCameraPose: false,
    terrainBinding: false,
    continuousFootage: false,
  },
} as const;

export const jezeroRoverStations = [
  {
    ...jezeroRoverPanorama360,
    shortLabel: "Landing site · Sol 3",
    capture: {
      ...jezeroRoverPanorama360.capture,
      dateLabel: "Sol 3 · February 21, 2021",
    },
    initialView: { heading: 20, fov: 72, verticalPosition: 10 },
    verticalPositionBounds: { minimum: 0, maximum: 72 },
  },
  vanZylRoverPanorama360,
  jezeroDeltaRoverPanorama360,
] as const;

export type JezeroRoverStation = (typeof jezeroRoverStations)[number];
