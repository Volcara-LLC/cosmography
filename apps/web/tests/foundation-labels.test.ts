import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { atlasEntities } from "../app/data/atlas";
import {
  canonicalFoundationProjectedLabelSet,
  FOUNDATION_LABEL_BUNDLE_SHA256,
  FOUNDATION_LABEL_MANIFEST_SHA256,
  FOUNDATION_LABEL_RELEASE_ID,
  FOUNDATION_PROJECTED_LABEL_SET_SHA256,
  foundationLabelDisplayPeers,
  foundationProjectedLabelFor,
  foundationProjectedLabels,
  foundationProjectedLabelsForSelection,
} from "../app/data/labels/foundation-projected-labels";
import {
  FOUNDATION_BUNDLE_SHA256,
  FOUNDATION_MANIFEST_SHA256,
  FOUNDATION_RELEASE_ID,
} from "../app/lib/releases/foundation-identity";
import { atlasScientificPresentationFor } from "../app/lib/presentation/atlas-scientific-labels";

test("pins exactly the 15 frozen foundation identities and display anchors", () => {
  assert.equal(FOUNDATION_LABEL_RELEASE_ID, FOUNDATION_RELEASE_ID);
  assert.equal(FOUNDATION_LABEL_MANIFEST_SHA256, FOUNDATION_MANIFEST_SHA256);
  assert.equal(FOUNDATION_LABEL_BUNDLE_SHA256, FOUNDATION_BUNDLE_SHA256);
  assert.equal(foundationProjectedLabels.length, 15);
  assert.deepEqual(
    foundationProjectedLabels.map(({ id, releaseName }) => ({ id, name: releaseName })),
    atlasEntities.map(({ id, name }) => ({ id, name })),
  );
  for (const [index, label] of foundationProjectedLabels.entries()) {
    const entity = atlasEntities[index];
    const presentation = atlasScientificPresentationFor(entity);
    assert.equal(label.releaseId, FOUNDATION_LABEL_RELEASE_ID);
    assert.equal(label.manifestSha256, FOUNDATION_LABEL_MANIFEST_SHA256);
    assert.equal(label.bundleSha256, FOUNDATION_LABEL_BUNDLE_SHA256);
    assert.equal(label.releaseName, entity.name);
    assert.equal(label.name, presentation.name);
    assert.equal(label.kindLabel, presentation.classification);
    assert.equal(label.namingBasis, presentation.namingBasis);
    assert.equal(label.scopeNote, presentation.scopeNote);
    assert.deepEqual(label.visualAnchor, entity.visualAnchor);
    assert.deepEqual(label.sourceIds, entity.sources.map((source) => source.id));
    assert.equal(label.domain, entity.domain);
    assert.equal(label.section, entity.section);
    assert.ok(label.visualAnchor.every(Number.isFinite));
    assert.equal(Object.isFrozen(label), true);
    assert.equal(Object.isFrozen(label.visualAnchor), true);
    assert.equal(Object.isFrozen(label.sourceIds), true);
    assert.equal(Object.isFrozen(label.truth), true);
  }
});

test("keeps alternate designation text inside existing release evidence", () => {
  const alternates = foundationProjectedLabels.filter(
    (label) => label.designation !== null,
  );
  assert.deepEqual(
    alternates.map(({ id, designation }) => ({ id, designation })),
    [{ id: "andromeda", designation: "M31" }],
  );
  assert.ok(alternates[0].sourceIds.includes("ned-tap"));
});

test("declares semantic display placement without scientific-position authority", () => {
  for (const label of foundationProjectedLabels) {
    assert.deepEqual(label.truth, {
      releaseEntityIdentityBound: true,
      releaseRecordMutated: false,
      scientificPresentationLabel: true,
      semanticDisplayPlacement: true,
      scientificPositionClaim: false,
      physicalProximityClaim: false,
      catalogCompletenessClaim: false,
      externalCatalogStreamingActive: false,
      proceduralParticleIdentityClaim: false,
    });
  }
});

test("keeps scene peers explicit, same-domain, and free of cross-world substitutions", () => {
  assert.deepEqual(Object.keys(foundationLabelDisplayPeers), atlasEntities.map(({ id }) => id));
  for (const [selectedId, peerIds] of Object.entries(foundationLabelDisplayPeers)) {
    const selected = foundationProjectedLabelFor(selectedId);
    assert.ok(selected);
    for (const peerId of peerIds) {
      const peer = foundationProjectedLabelFor(peerId);
      assert.ok(peer);
      assert.equal(peer.domain, selected.domain);
    }
  }
  assert.deepEqual(
    foundationProjectedLabelsForSelection("solar-system").map((label) => label.id),
    ["trappist-1", "solar-system"],
  );
  assert.deepEqual(
    foundationProjectedLabelsForSelection("voyager-1").map((label) => label.id),
    ["voyager-1"],
  );
  assert.deepEqual(
    foundationProjectedLabelsForSelection("mars").map((label) => label.id),
    ["mars"],
  );
  assert.deepEqual(
    foundationProjectedLabelsForSelection("jezero").map((label) => label.id),
    ["jezero"],
  );
  assert.deepEqual(
    foundationProjectedLabelsForSelection("trappist-1").map((label) => label.id),
    ["trappist-1", "solar-system"],
  );
  assert.equal(foundationProjectedLabelFor("mars")?.name, "Mars");
  assert.equal(foundationProjectedLabelFor("not-in-release"), undefined);
  assert.deepEqual(foundationProjectedLabelsForSelection("not-in-release"), []);
});

test("pins the canonical projected-label set digest", () => {
  assert.match(canonicalFoundationProjectedLabelSet(), /"displayPeers"/);
  assert.equal(
    createHash("sha256")
      .update(canonicalFoundationProjectedLabelSet())
      .digest("hex"),
    FOUNDATION_PROJECTED_LABEL_SET_SHA256,
  );
});
