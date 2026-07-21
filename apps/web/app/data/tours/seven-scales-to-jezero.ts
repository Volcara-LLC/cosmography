import { atlasEntities, atlasRelease } from "@/app/data/atlas";
import {
  GUIDED_TOUR_NO_AUTHORITY,
  createGuidedTour,
} from "@/app/lib/education/guided-tour";

export const SEVEN_SCALES_TO_JEZERO_TARGETS = Object.freeze([
  "observable-universe",
  "laniakea",
  "local-group",
  "milky-way",
  "solar-system",
  "mars",
  "jezero",
] as const);

export const sevenScalesToJezeroTour = createGuidedTour(
  {
    schemaVersion: "1.0.0",
    id: "tour_seven_scales_to_jezero_v1",
    slug: "seven-scales-to-jezero",
    title: "Seven Scales to Jezero",
    subtitle: "From the observable light cone to a rover-scale place on Mars",
    summary:
      "A seven-stop, manually advanced path through the atlas scale hierarchy. Each stop changes semantic context; none of the transitions represents a physical journey or elapsed travel time.",
    releaseId: "rel_landing_atlas_v0_1_0",
    navigationMode: "semantic-navigation",
    advanceMode: "manual",
    physicalJourneyClaim: false,
    autoAdvance: false,
    viewportRepresentation: "procedural-scientific-display-context",
    authority: GUIDED_TOUR_NO_AUTHORITY,
    stops: [
      {
        ordinal: 1,
        id: "scale-observable-universe",
        title: "Known Universe",
        scaleLabel: "Observable-universe scale",
        targetEntityId: "observable-universe",
        domain: "lightcone",
        representationId: "rep-observable-universe-v0",
        sourceIds: ["nasa-lambda", "ned-tap"],
        evidenceClass: "scientific-reconstruction",
        narrative:
          "Begin with humanity's observer-centered construction of the observable universe: measured backgrounds and surveys organized inside a cosmological light cone, not a photograph taken from outside it.",
        learningPrompt:
          "Look for the difference between observed coverage, derived structure, and regions the release does not fill in.",
        boundaryStatement:
          "Distance is displayed logarithmically and depends on the declared cosmological context; the procedural overview is a scientific reconstruction, not literal exterior imagery.",
      },
      {
        ordinal: 2,
        id: "scale-laniakea",
        title: "Laniakea",
        scaleLabel: "Supercluster scale",
        targetEntityId: "laniakea",
        domain: "extragalactic",
        representationId: "rep-laniakea-v0",
        sourceIds: ["ned-tap"],
        evidenceClass: "scientific-reconstruction",
        narrative:
          "Narrow the atlas to Laniakea, the reconstructed large-scale flow basin that contains our galactic neighborhood.",
        learningPrompt:
          "Notice that a supercluster boundary can be a conclusion drawn from galaxy motions rather than a bright edge in space.",
        boundaryStatement:
          "The boundary is model-dependent and the representative-color, logarithmic view does not claim a uniquely observed physical shell.",
      },
      {
        ordinal: 3,
        id: "scale-local-group",
        title: "Local Group",
        scaleLabel: "Galaxy-group scale",
        targetEntityId: "local-group",
        domain: "extragalactic",
        representationId: "rep-local-group-v0",
        sourceIds: ["ned-tap"],
        evidenceClass: "catalog-measurement",
        narrative:
          "Continue to the Local Group, the gravitationally associated neighborhood containing the Milky Way, Andromeda, Triangulum, and many smaller galaxies.",
        learningPrompt:
          "Use the member relationships to orient yourself before moving inside the Milky Way.",
        boundaryStatement:
          "Catalog anchors support the group context, while member sizes are exaggerated so they remain legible at overview scale.",
      },
      {
        ordinal: 4,
        id: "scale-milky-way",
        title: "Milky Way",
        scaleLabel: "Galactic scale",
        targetEntityId: "milky-way",
        domain: "galactic",
        representationId: "rep-milky-way-v0",
        sourceIds: ["gaia-dr3"],
        evidenceClass: "scientific-reconstruction",
        narrative:
          "Enter our home galaxy through a Gaia-anchored map that separates measured stars from reconstructed dust and spiral structure.",
        learningPrompt:
          "Remember that the observer is inside the disk; ask which parts of the galactic portrait are measurements and which are reconstruction.",
        boundaryStatement:
          "The representative-color, logarithmic display is not an outside photograph of the Milky Way, and its large-scale form remains a scientific reconstruction.",
      },
      {
        ordinal: 5,
        id: "scale-solar-system",
        title: "Solar System",
        scaleLabel: "Astronomical-unit scale",
        targetEntityId: "solar-system",
        domain: "system",
        representationId: "rep-solar-system-v0",
        sourceIds: ["naif-spice", "jpl-horizons"],
        evidenceClass: "derived-result",
        narrative:
          "Shift from galactic context to the Solar System, where positions belong to declared frames, epochs, and observer-view choices.",
        learningPrompt:
          "Watch the scale vocabulary change from light-years to a system whose geometry varies with time.",
        boundaryStatement:
          "The foundation atlas uses an exaggerated-size procedural display; exact, versioned kernel execution remains a separately gated capability.",
      },
      {
        ordinal: 6,
        id: "scale-mars",
        title: "Mars",
        scaleLabel: "Planetary-globe scale",
        targetEntityId: "mars",
        domain: "globe",
        representationId: "rep-mars-v0",
        sourceIds: ["nasa-pds", "usgs-astrogeology", "naif-spice"],
        evidenceClass: "derived-result",
        narrative:
          "Approach Mars as a procedural globe that connects planetary context to a controlled surface-product index.",
        learningPrompt:
          "Separate the useful navigation preview from the terrain and imagery products that still require controlled ingest.",
        boundaryStatement:
          "No Mars terrain or image bytes are loaded here, orbital distance varies, and body-fixed scientific product placement is withheld.",
      },
      {
        ordinal: 7,
        id: "scale-jezero",
        title: "Jezero Crater",
        scaleLabel: "Regional and rover scale",
        targetEntityId: "jezero",
        domain: "surface",
        representationId: "rep-jezero-v0",
        sourceIds: ["nasa-pds", "usgs-astrogeology", "naif-spice"],
        evidenceClass: "derived-result",
        narrative:
          "Arrive semantically at Jezero Crater, where the atlas links regional terrain requirements, Perseverance localization, recorded views, and evidence masks.",
        learningPrompt:
          "Inspect what is declared, what remains withheld, and what evidence would be needed before a capture could be placed as a scientific view.",
        boundaryStatement:
          "This is a procedural interface preview: no terrain, panorama, mesh, camera pose, render, publication, or release authority is granted.",
      },
    ],
  },
  {
    releaseId: atlasRelease.id,
    entities: atlasEntities,
  },
);
