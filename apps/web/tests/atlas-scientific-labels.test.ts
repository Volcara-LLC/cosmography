import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { atlasEntities, atlasEntityById } from "../app/data/atlas";
import { sevenScalesToJezeroTour } from "../app/data/tours/seven-scales-to-jezero";
import {
  atlasScientificBreadcrumbLabel,
  atlasScientificNameFor,
  atlasScientificPresentationFor,
  atlasScientificPresentationIds,
  type AtlasNamingBasis,
} from "../app/lib/presentation/atlas-scientific-labels";

const expectedPresentations: readonly {
  readonly id: string;
  readonly name: string;
  readonly classification: string;
  readonly namingBasis: AtlasNamingBasis;
}[] = [
  {
    id: "observable-universe",
    name: "Observable Universe",
    classification: "Observer-centered observable region",
    namingBasis: "accepted-astronomical-term",
  },
  {
    id: "laniakea",
    name: "Laniakea Supercluster",
    classification: "Flow-defined supercluster · reconstructed boundary",
    namingBasis: "published-structure-name",
  },
  {
    id: "local-group",
    name: "Local Group",
    classification: "Galaxy group",
    namingBasis: "accepted-astronomical-term",
  },
  {
    id: "andromeda",
    name: "Andromeda Galaxy",
    classification: "Spiral galaxy",
    namingBasis: "accepted-astronomical-term",
  },
  {
    id: "milky-way",
    name: "Milky Way Galaxy",
    classification: "Our home galaxy",
    namingBasis: "accepted-astronomical-term",
  },
  {
    id: "sagittarius-a-star",
    name: "Sagittarius A*",
    classification: "Milky Way central black hole",
    namingBasis: "catalog-designation",
  },
  {
    id: "proxima-centauri",
    name: "Proxima Centauri",
    classification: "Red dwarf star",
    namingBasis: "accepted-astronomical-term",
  },
  {
    id: "trappist-1",
    name: "TRAPPIST-1",
    classification: "Seven-planet system",
    namingBasis: "catalog-designation",
  },
  {
    id: "solar-system",
    name: "Solar System",
    classification: "The Sun and its planetary system",
    namingBasis: "accepted-astronomical-term",
  },
  {
    id: "mars",
    name: "Mars",
    classification: "Terrestrial planet",
    namingBasis: "accepted-astronomical-term",
  },
  {
    id: "jezero",
    name: "Jezero Crater",
    classification: "Martian impact crater · Perseverance landing region",
    namingBasis: "official-feature-name",
  },
  {
    id: "apollo-17",
    name: "Apollo 17 · Taurus–Littrow",
    classification: "Lunar valley and mission site",
    namingBasis: "mission-name",
  },
  {
    id: "voyager-1",
    name: "Voyager 1",
    classification: "Interstellar spacecraft",
    namingBasis: "mission-name",
  },
  {
    id: "jwst-deep-fields",
    name: "Webb Deep Fields",
    classification: "Deep-field observations",
    namingBasis: "descriptive-release-label",
  },
  {
    id: "earth-exploration-network",
    name: "Earth Exploration Network",
    classification: "Space-exploration sites and institutions",
    namingBasis: "descriptive-release-label",
  },
];

test("defines exactly one reviewed scientific presentation for every foundation identity", () => {
  assert.deepEqual(
    atlasScientificPresentationIds,
    expectedPresentations.map(({ id }) => id),
  );
  assert.deepEqual(
    atlasEntities.map(({ id }) => id),
    expectedPresentations.map(({ id }) => id),
  );
  assert.equal(Object.isFrozen(atlasScientificPresentationIds), true);

  for (const expected of expectedPresentations) {
    const entity = atlasEntityById.get(expected.id);
    assert.ok(entity);
    const presentation = atlasScientificPresentationFor(entity);
    assert.deepEqual(
      {
        id: expected.id,
        name: presentation.name,
        classification: presentation.classification,
        namingBasis: presentation.namingBasis,
      },
      expected,
    );
    assert.equal(Object.isFrozen(presentation), true);
    assert.strictEqual(atlasScientificPresentationFor(entity), presentation);
    assert.equal(atlasScientificNameFor(entity.id, entity.name), expected.name);
  }
});

test("keeps the frozen Known Universe release identity separate from public presentation copy", () => {
  const source = atlasEntityById.get("observable-universe");
  assert.ok(source);
  const sourceIdentity = {
    id: source.id,
    slug: source.slug,
    name: source.name,
    breadcrumb: [...source.breadcrumb],
    representationId: source.representation.id,
  };

  const presentation = atlasScientificPresentationFor(source);
  assert.equal(source.name, "Known Universe");
  assert.equal(presentation.name, "Observable Universe");
  assert.notEqual(presentation.name, source.name);
  assert.deepEqual(sourceIdentity, {
    id: "observable-universe",
    slug: "observable-universe",
    name: "Known Universe",
    breadcrumb: ["Known Universe"],
    representationId: "rep-observable-universe-v0",
  });
  assert.deepEqual(
    {
      id: source.id,
      slug: source.slug,
      name: source.name,
      breadcrumb: source.breadcrumb,
      representationId: source.representation.id,
    },
    sourceIdentity,
  );
  assert.equal(sevenScalesToJezeroTour.stops[0]?.title, "Known Universe");
});

test("maps all seven public journey names without rewriting the frozen tour stops", () => {
  assert.deepEqual(
    sevenScalesToJezeroTour.stops.map((stop) => {
      const entity = atlasEntityById.get(stop.targetEntityId);
      assert.ok(entity);
      return atlasScientificNameFor(entity.id, entity.name);
    }),
    [
      "Observable Universe",
      "Laniakea Supercluster",
      "Local Group",
      "Milky Way Galaxy",
      "Solar System",
      "Mars",
      "Jezero Crater",
    ],
  );
  assert.deepEqual(
    sevenScalesToJezeroTour.stops.map((stop) => stop.title),
    [
      "Known Universe",
      "Laniakea",
      "Local Group",
      "Milky Way",
      "Solar System",
      "Mars",
      "Jezero Crater",
    ],
  );
});

test("retains the two reviewed scientific scope notes and no invented extras", () => {
  const notes = atlasEntities.flatMap((entity) => {
    const scopeNote = atlasScientificPresentationFor(entity).scopeNote;
    return scopeNote ? [{ id: entity.id, scopeNote }] : [];
  });
  assert.deepEqual(notes, [
    {
      id: "observable-universe",
      scopeNote:
        "Observable from our present location—not a physical center or a claim about everything that may exist beyond the cosmic horizon.",
    },
    {
      id: "laniakea",
      scopeNote:
        "Its boundary is inferred from galaxy motions and a reconstruction model, not observed as a bright physical edge.",
    },
  ]);
});

test("maps reviewed breadcrumb labels without mutating release breadcrumbs", () => {
  assert.deepEqual(
    ["Known Universe", "Laniakea", "Milky Way", "Local Group"].map(
      atlasScientificBreadcrumbLabel,
    ),
    [
      "Observable Universe",
      "Laniakea Supercluster",
      "Milky Way Galaxy",
      "Local Group",
    ],
  );
  assert.deepEqual(
    atlasEntityById.get("milky-way")?.breadcrumb,
    ["Known Universe", "Local Group", "Milky Way"],
  );
  assert.equal(atlasScientificBreadcrumbLabel("Unreviewed release breadcrumb"), "Unreviewed release breadcrumb");
});

test("fails softly to frozen, explicitly unreviewed release-label presentation", () => {
  const fallbackEntity = {
    id: "future-release-object",
    name: "Future Release Object",
    kind: "observation" as const,
  };
  const fallback = atlasScientificPresentationFor(fallbackEntity);
  assert.deepEqual(fallback, {
    name: "Future Release Object",
    classification: "observation",
    namingBasis: "release-label",
    scopeNote:
      "No separately reviewed public astronomical name is registered for this release identity.",
  });
  assert.equal(Object.isFrozen(fallback), true);
  assert.equal(
    atlasScientificNameFor(fallbackEntity.id, fallbackEntity.name),
    "Future Release Object",
  );
});

test("the destination disclosure remains a named native control over hidden details", () => {
  const atlasShell = readFileSync(
    new URL("../app/components/atlas/AtlasShell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(atlasShell, /const \[destinationExpanded, setDestinationExpanded\] = useState\(true\);/);
  assert.match(atlasShell, /data-collapsed=\{String\(!destinationExpanded\)\}/);
  assert.match(atlasShell, /aria-expanded=\{destinationExpanded\}/);
  assert.match(atlasShell, /aria-controls="destination-card-details"/);
  assert.match(
    atlasShell,
    /aria-label=\{`\$\{destinationExpanded \? "Hide" : "Show"\} details for \$\{selectedPresentation\.name\}`\}/,
  );
  assert.match(
    atlasShell,
    /<div id="destination-card-details" hidden=\{!destinationExpanded\}>/,
  );
  assert.match(atlasShell, /inert=\{fullView\}/);
  assert.match(atlasShell, /aria-hidden=\{fullView \|\| undefined\}/);
  assert.match(atlasShell, /Details remain collapsed\./);
  assert.match(
    atlasShell,
    /<div className="destination-kicker">[\s\S]*?sectionNavigation\[selected\.section\]\.label[\s\S]*?selectedPresentation\.classification[\s\S]*?<h1 id="destination-name">\{selectedPresentation\.name\}<\/h1>/,
  );
  assert.doesNotMatch(
    atlasShell,
    /<div className="destination-kicker">[\s\S]{0,300}?selected\.scaleLabel/,
  );
  assert.doesNotMatch(atlasShell, /destination-card__toggle[\s\S]{0,500}aria-pressed=/);
});

test("panels use reviewed public names without rewriting the saved-route payload", () => {
  const detailPanel = readFileSync(
    new URL("../app/components/atlas/AtlasDetailPanel.tsx", import.meta.url),
    "utf8",
  );
  const flightDeck = readFileSync(
    new URL("../app/components/atlas/FlightDeck.tsx", import.meta.url),
    "utf8",
  );

  assert.match(detailPanel, /<span className="eyebrow">\{presentationName\}<\/span>/);
  assert.match(detailPanel, /entityName=\{presentationName\}/);
  assert.match(flightDeck, /<strong>\{presentationName\}<\/strong>/);
  assert.match(flightDeck, /Saving private comparison for \$\{presentationName\}/);
  assert.match(flightDeck, /Private comparison for \$\{presentationName\} saved/);
  assert.match(
    flightDeck,
    /title: `Solar System → \$\{selected\.name\}`/,
    "The frozen private-route payload remains unchanged",
  );
});
