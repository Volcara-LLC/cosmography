export type MissionBoardEntry = {
  readonly id: string;
  readonly name: string;
  readonly scope: string;
  readonly state: "available" | "overview-planned";
  readonly route?: string;
  readonly sourceUrl: string;
};

export const missionBoardEntries = [
  { id: "voyager-1", name: "Voyager 1", scope: "Source-anchored journey from launch through interstellar space", state: "available", route: "/missions/voyager-1", sourceUrl: "https://science.nasa.gov/mission/voyager/voyager-1/" },
  { id: "perseverance", name: "Mars 2020 Perseverance", scope: "Jezero world-to-recorded-surface path and actual landing footage", state: "available", route: "/worlds/mars", sourceUrl: "https://science.nasa.gov/mission/mars-2020-perseverance/" },
  { id: "apollo-17", name: "Apollo 17", scope: "Evidence-bounded Taurus–Littrow surface record", state: "available", route: "/worlds/moon", sourceUrl: "https://www.nasa.gov/mission/apollo-17/" },
  { id: "curiosity", name: "Mars Science Laboratory Curiosity", scope: "Gale Crater mission overview and recorded-view inventory", state: "overview-planned", sourceUrl: "https://science.nasa.gov/mission/msl-curiosity/" },
  { id: "jwst", name: "James Webb Space Telescope", scope: "Observatory, instruments, deep-field products, and mission timeline", state: "overview-planned", sourceUrl: "https://science.nasa.gov/mission/webb/" },
  { id: "hubble", name: "Hubble Space Telescope", scope: "Servicing history, instruments, archives, and observation products", state: "overview-planned", sourceUrl: "https://science.nasa.gov/mission/hubble/" },
  { id: "cassini", name: "Cassini–Huygens", scope: "Saturn system encounters, instruments, and Grand Finale", state: "overview-planned", sourceUrl: "https://science.nasa.gov/mission/cassini/" },
  { id: "new-horizons", name: "New Horizons", scope: "Pluto system flyby and Kuiper Belt extended mission", state: "overview-planned", sourceUrl: "https://science.nasa.gov/mission/new-horizons/" },
  { id: "parker", name: "Parker Solar Probe", scope: "Solar encounters, instruments, and time-varying trajectory products", state: "overview-planned", sourceUrl: "https://science.nasa.gov/mission/parker-solar-probe/" },
] as const satisfies readonly MissionBoardEntry[];
