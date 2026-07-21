export type SolarSystemBody = {
  readonly id: "mercury" | "venus" | "earth" | "mars" | "jupiter" | "saturn" | "uranus" | "neptune";
  readonly name: string;
  readonly kind: "terrestrial planet" | "giant planet" | "ice giant";
  readonly orbitRadius: number;
  readonly visualRadius: number;
  readonly phaseDegrees: number;
  readonly color: number;
  readonly atlasDestination: "mars" | null;
};

export const solarSystemPresentation = {
  representationClass: "procedural-scientific",
  title: "Solar System overview",
  disclosure:
    "Illustrative heliocentric overview. Orbital spacing is compressed, planet sizes are exaggerated, phases are fixed for legibility, and no current ephemeris or apparent sky position is claimed.",
  sourceContext:
    "Planet order and broad classifications follow the frozen Solar System atlas record; future physical positions remain gated on pinned SPICE products.",
} as const;

export const solarSystemBodies = [
  { id: "mercury", name: "Mercury", kind: "terrestrial planet", orbitRadius: 2.4, visualRadius: 0.11, phaseDegrees: 18, color: 0xaaa49b, atlasDestination: null },
  { id: "venus", name: "Venus", kind: "terrestrial planet", orbitRadius: 3.2, visualRadius: 0.17, phaseDegrees: 78, color: 0xd7b46e, atlasDestination: null },
  { id: "earth", name: "Earth", kind: "terrestrial planet", orbitRadius: 4.1, visualRadius: 0.18, phaseDegrees: 142, color: 0x3d84c6, atlasDestination: null },
  { id: "mars", name: "Mars", kind: "terrestrial planet", orbitRadius: 5.1, visualRadius: 0.15, phaseDegrees: 205, color: 0xc75f3e, atlasDestination: "mars" },
  { id: "jupiter", name: "Jupiter", kind: "giant planet", orbitRadius: 6.8, visualRadius: 0.42, phaseDegrees: 254, color: 0xc79c72, atlasDestination: null },
  { id: "saturn", name: "Saturn", kind: "giant planet", orbitRadius: 8.5, visualRadius: 0.36, phaseDegrees: 318, color: 0xd9c388, atlasDestination: null },
  { id: "uranus", name: "Uranus", kind: "ice giant", orbitRadius: 10.2, visualRadius: 0.28, phaseDegrees: 35, color: 0x86d5dd, atlasDestination: null },
  { id: "neptune", name: "Neptune", kind: "ice giant", orbitRadius: 12, visualRadius: 0.27, phaseDegrees: 112, color: 0x4266cf, atlasDestination: null },
] as const satisfies readonly SolarSystemBody[];
