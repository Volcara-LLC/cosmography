import type { AtlasEntity, AtlasSection } from "@/app/lib/science/scene";

export type AtlasVisualTheme = Readonly<{
  id: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
}>;

function theme(value: AtlasVisualTheme): AtlasVisualTheme {
  return Object.freeze(value);
}

const sectionThemes: Record<AtlasSection, AtlasVisualTheme> = {
  cosmology: theme({
    id: "cosmos",
    accent: "#526fd3",
    accentStrong: "#2f4fae",
    accentSoft: "#e8edff",
  }),
  galaxies: theme({
    id: "galaxies",
    accent: "#7659bd",
    accentStrong: "#54399a",
    accentSoft: "#eee9fb",
  }),
  stars: theme({
    id: "stars",
    accent: "#b56f16",
    accentStrong: "#80500e",
    accentSoft: "#fff0d8",
  }),
  systems: theme({
    id: "systems",
    accent: "#237f78",
    accentStrong: "#145d58",
    accentSoft: "#def3ef",
  }),
  worlds: theme({
    id: "worlds",
    accent: "#397eae",
    accentStrong: "#245b83",
    accentSoft: "#e2f0f8",
  }),
  missions: theme({
    id: "missions",
    accent: "#9b6a20",
    accentStrong: "#704a10",
    accentSoft: "#f8edd7",
  }),
  earth: theme({
    id: "earth",
    accent: "#237c60",
    accentStrong: "#155b46",
    accentSoft: "#def1e9",
  }),
};

const entityThemes: Readonly<Record<string, AtlasVisualTheme>> = {
  mars: theme({
    id: "mars",
    accent: "#b75c35",
    accentStrong: "#843b21",
    accentSoft: "#f8e4d8",
  }),
  jezero: theme({
    id: "jezero",
    accent: "#b75c35",
    accentStrong: "#843b21",
    accentSoft: "#f8e4d8",
  }),
  "apollo-17": theme({
    id: "moon",
    accent: "#667887",
    accentStrong: "#425462",
    accentSoft: "#e9eef1",
  }),
  "voyager-1": theme({
    id: "voyager",
    accent: "#a87221",
    accentStrong: "#745016",
    accentSoft: "#f8edd7",
  }),
  "earth-exploration-network": theme({
    id: "earth",
    accent: "#237c60",
    accentStrong: "#155b46",
    accentSoft: "#def1e9",
  }),
};

export function atlasVisualThemeFor(entity: AtlasEntity): AtlasVisualTheme {
  return entityThemes[entity.id] ?? sectionThemes[entity.section];
}

export const atlasVisualThemeIds = Object.freeze([
  ...new Set([
    ...Object.values(sectionThemes).map((theme) => theme.id),
    ...Object.values(entityThemes).map((theme) => theme.id),
  ]),
]);
