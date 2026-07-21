import { BlackHoleObjectSchema } from "./models.js";

const checkedAt = "2026-07-19";

export const sagittariusAReference = BlackHoleObjectSchema.parse({
  id: "bh_sagittarius_a_star",
  name: "Sagittarius A*",
  massSolar: 4_000_000,
  distanceParsecs: 8_000,
  dimensionlessSpin: null,
  inclinationDegrees: null,
  parameterEvidence: "derived-result",
  sources: [
    {
      id: "eht-sgra-paper-i",
      title: "First Sagittarius A* Event Horizon Telescope Results I: The Shadow",
      url: "https://eventhorizontelescope.org/publications/first-sagittarius-event-horizon-telescope-results-i-shadow-supermassive-black-hole",
      doi: "10.3847/2041-8213/ac6674",
      release: "EHT 2022 Sgr A* Paper I and data release",
      retrievedAt: checkedAt,
    },
  ],
});

export const interstellarDngrReference = {
  id: "method_dngr_2015",
  title: "Gravitational Lensing by Spinning Black Holes in Astrophysics, and in the Movie Interstellar",
  url: "https://doi.org/10.1088/0264-9381/32/6/065001",
  doi: "10.1088/0264-9381/32/6/065001",
  release: "Classical and Quantum Gravity 32 065001 (2015)",
  retrievedAt: checkedAt,
} as const;

export const ehtDataProductsReference = {
  id: "eht-data-products",
  title: "Event Horizon Telescope Data Products",
  url: "https://eventhorizontelescope.org/for-astronomers/data",
  release: "Current public data-product index; use a pinned DOI per render",
  retrievedAt: checkedAt,
} as const;
