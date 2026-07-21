import assert from "node:assert/strict";
import test from "node:test";

import {
  SurfacePreIngestLedgerSchema,
  type SurfacePreIngestLedger,
} from "@cosmography/scientific-model/surface-provenance";

import { marsJezeroPreIngestLedger } from "../app/data/surface/mars-jezero-provenance";
import { moonApollo17SurfacePreIngestLedger } from "../app/data/surface/moon-apollo17-provenance";
import {
  marsJezeroSurface,
  moonApollo17Surface,
} from "../app/data/surface/surface-fixtures";

type SurfaceFixtureShape = {
  readonly id: string;
  readonly body: "Mars" | "Moon";
  readonly sources: readonly { readonly id: string }[];
  readonly evidence: readonly {
    readonly id: string;
    readonly kind:
      | "observed-terrain"
      | "captured-panorama"
      | "scientific-reconstruction"
      | "interpolation"
      | "immersive-display";
  }[];
  readonly captureNodes: readonly { readonly id: string }[];
};

const ledgerCases: readonly {
  readonly label: string;
  readonly ledger: SurfacePreIngestLedger;
  readonly fixture: SurfaceFixtureShape;
}[] = [
  {
    label: "Mars Jezero / Perseverance",
    ledger: marsJezeroPreIngestLedger,
    fixture: marsJezeroSurface,
  },
  {
    label: "Moon Taurus–Littrow / Apollo 17",
    ledger: moonApollo17SurfacePreIngestLedger,
    fixture: moonApollo17Surface,
  },
];

const referenceOnlyFalseUseFlags = [
  "embedBytes",
  "redistribute",
  "modify",
  "commercialUse",
  "offlinePackaging",
  "derivativeGeneration",
] as const;

const captureFalseFlags = [
  "continuousFootageAvailable",
  "mediaRuntimeTokenAvailable",
  "localizationRuntimeTokenAvailable",
  "cameraCalibrationRuntimeTokenAvailable",
  "opticalCenterAvailable",
  "orientationAvailable",
  "terrainFrameBindingAvailable",
  "uncertaintyAvailable",
  "renderableCameraPose",
  "renderAllowed",
  "releaseEligible",
] as const;

function cloneLedger(ledger: SurfacePreIngestLedger): SurfacePreIngestLedger {
  return structuredClone(ledger);
}

function setField(target: object, key: string, value: unknown): void {
  (target as Record<string, unknown>)[key] = value;
}

function overwriteFirst<T>(values: T[], value: unknown): void {
  (values as unknown[])[0] = value;
}

function surfaceBindingErrors(
  ledger: SurfacePreIngestLedger,
  fixture: SurfaceFixtureShape,
): string[] {
  const errors: string[] = [];
  const sourceIds = new Set(fixture.sources.map(({ id }) => id));
  const evidenceIds = new Set(fixture.evidence.map(({ id }) => id));
  const captureNodeIds = new Set(fixture.captureNodes.map(({ id }) => id));
  const productBackedEvidenceKinds = new Set([
    "observed-terrain",
    "captured-panorama",
    "scientific-reconstruction",
  ]);
  const boundEvidenceIds = new Set(
    ledger.productRequirements.flatMap(
      (requirement) => requirement.requiredForEvidenceIds,
    ),
  );
  const requirementsById = new Map(
    ledger.productRequirements.map((requirement) => [
      requirement.requirementId,
      requirement,
    ]),
  );

  if (ledger.experienceId !== fixture.id) {
    errors.push(`ledger experience ${ledger.experienceId} does not match ${fixture.id}`);
  }
  if (ledger.body !== fixture.body) {
    errors.push(`ledger body ${ledger.body} does not match ${fixture.body}`);
  }

  for (const requirement of ledger.productRequirements) {
    if (requirement.experienceId !== fixture.id) {
      errors.push(`${requirement.requirementId}: cross-experience requirement`);
    }
    if (requirement.body !== fixture.body) {
      errors.push(`${requirement.requirementId}: cross-body requirement`);
    }
    for (const sourceId of requirement.sourceReferenceIds) {
      if (!sourceIds.has(sourceId)) {
        errors.push(`${requirement.requirementId}: unknown fixture source ${sourceId}`);
      }
    }
    for (const evidenceId of requirement.requiredForEvidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(
          `${requirement.requirementId}: unknown fixture evidence ${evidenceId}`,
        );
      }
    }
    for (const captureNodeId of requirement.requiredForCaptureNodeIds) {
      if (!captureNodeIds.has(captureNodeId)) {
        errors.push(
          `${requirement.requirementId}: unknown fixture capture ${captureNodeId}`,
        );
      } else {
        const capture = ledger.captureContexts.find(
          (candidate) => candidate.captureNodeId === captureNodeId,
        );
        if (
          !capture ||
          !capture.requiredProductRequirementIds.includes(
            requirement.requirementId,
          )
        ) {
          errors.push(
            `${requirement.requirementId}: capture ${captureNodeId} does not reciprocate the requirement`,
          );
        }
      }
    }
  }

  for (const evidence of fixture.evidence) {
    if (
      productBackedEvidenceKinds.has(evidence.kind) &&
      !boundEvidenceIds.has(evidence.id)
    ) {
      errors.push(`${evidence.id}: no product requirement declares this evidence`);
    }
  }

  for (const capture of ledger.captureContexts) {
    if (capture.experienceId !== fixture.id) {
      errors.push(`${capture.captureContextId}: cross-experience capture`);
    }
    if (capture.body !== fixture.body) {
      errors.push(`${capture.captureContextId}: cross-body capture`);
    }
    if (!captureNodeIds.has(capture.captureNodeId)) {
      errors.push(
        `${capture.captureContextId}: unknown fixture capture ${capture.captureNodeId}`,
      );
    }
    for (const sourceId of capture.sourceReferenceIds) {
      if (!sourceIds.has(sourceId)) {
        errors.push(`${capture.captureContextId}: unknown fixture source ${sourceId}`);
      }
    }
    for (const requirementId of capture.requiredProductRequirementIds) {
      const requirement = requirementsById.get(requirementId);
      if (!requirement) {
        errors.push(
          `${capture.captureContextId}: unknown product requirement ${requirementId}`,
        );
      } else if (
        !requirement.requiredForCaptureNodeIds.includes(capture.captureNodeId)
      ) {
        errors.push(
          `${capture.captureContextId}: ${requirementId} is not bound to ${capture.captureNodeId}`,
        );
      }
    }
  }

  return errors;
}

function assertSurfaceBindings(
  ledger: SurfacePreIngestLedger,
  fixture: SurfaceFixtureShape,
): void {
  const errors = surfaceBindingErrors(ledger, fixture);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}

test("both surface pre-ingest ledgers pass the strict shared schema", () => {
  for (const { label, ledger } of ledgerCases) {
    assert.doesNotThrow(
      () => SurfacePreIngestLedgerSchema.parse(ledger),
      `${label} ledger should parse`,
    );
  }

  const unknownField = cloneLedger(marsJezeroPreIngestLedger);
  setField(unknownField, "unreviewedAuthority", true);
  assert.throws(
    () => SurfacePreIngestLedgerSchema.parse(unknownField),
    /Unrecognized key/,
  );
});

test("every surface requirement and capture remains non-authoritative", () => {
  for (const { label, ledger } of ledgerCases) {
    for (const requirement of ledger.productRequirements) {
      assert.equal(
        requirement.state,
        "reference-only-pending-artifact-review",
        `${label} ${requirement.requirementId} state`,
      );
      assert.equal(requirement.intendedUse.metadataDisplay, true);
      assert.equal(requirement.intendedUse.externalLink, true);
      for (const flag of referenceOnlyFalseUseFlags) {
        assert.equal(
          requirement.intendedUse[flag],
          false,
          `${label} ${requirement.requirementId} intendedUse.${flag}`,
        );
      }
      assert.equal(requirement.assetBytesPresent, false);
      assert.equal(requirement.renderAllowed, false);
      assert.equal(requirement.releaseEligible, false);
    }

    for (const capture of ledger.captureContexts) {
      assert.equal(capture.state, "withheld-incomplete-surface-capture");
      for (const flag of captureFalseFlags) {
        assert.equal(
          capture[flag],
          false,
          `${label} ${capture.captureContextId} ${flag}`,
        );
      }
    }
  }

  const selfAuthorized = cloneLedger(marsJezeroPreIngestLedger);
  setField(selfAuthorized.productRequirements[0], "renderAllowed", true);
  assert.throws(
    () => SurfacePreIngestLedgerSchema.parse(selfAuthorized),
    /Invalid input/,
  );
});

test("surface ledgers cross-bind every source, evidence, capture, and product requirement", () => {
  for (const { label, ledger, fixture } of ledgerCases) {
    assert.doesNotThrow(
      () => assertSurfaceBindings(ledger, fixture),
      `${label} bindings should resolve`,
    );
    assert.deepEqual(
      new Set(ledger.captureContexts.map(({ captureNodeId }) => captureNodeId)),
      new Set(fixture.captureNodes.map(({ id }) => id)),
      `${label} should withhold every declared fixture capture node`,
    );
  }
});

test("surface ledger rejects duplicate and dangling identities", () => {
  const duplicate = cloneLedger(marsJezeroPreIngestLedger);
  setField(
    duplicate.productRequirements[1],
    "requirementId",
    duplicate.productRequirements[0].requirementId,
  );
  assert.throws(
    () => SurfacePreIngestLedgerSchema.parse(duplicate),
    /identities must be unique/,
  );

  const danglingRequirement = cloneLedger(marsJezeroPreIngestLedger);
  (danglingRequirement.captureContexts[0]
    .requiredProductRequirementIds as unknown as string[]).push(
    "sreq_missing_surface_product",
  );
  assert.throws(
    () => SurfacePreIngestLedgerSchema.parse(danglingRequirement),
    /unknown product requirement/,
  );

  const danglingSource = cloneLedger(moonApollo17SurfacePreIngestLedger);
  overwriteFirst(
    danglingSource.productRequirements[0].sourceReferenceIds,
    "missing-source-record",
  );
  assert.doesNotThrow(() => SurfacePreIngestLedgerSchema.parse(danglingSource));
  assert.throws(
    () => assertSurfaceBindings(danglingSource, moonApollo17Surface),
    /unknown fixture source missing-source-record/,
  );

  const danglingEvidence = cloneLedger(marsJezeroPreIngestLedger);
  overwriteFirst(
    danglingEvidence.productRequirements[0].requiredForEvidenceIds,
    "missing-evidence-record",
  );
  assert.doesNotThrow(() => SurfacePreIngestLedgerSchema.parse(danglingEvidence));
  assert.throws(
    () => assertSurfaceBindings(danglingEvidence, marsJezeroSurface),
    /unknown fixture evidence missing-evidence-record/,
  );

  const danglingCapture = cloneLedger(marsJezeroPreIngestLedger);
  const originalCaptureNodeId = danglingCapture.captureContexts[0].captureNodeId;
  setField(
    danglingCapture.captureContexts[0],
    "captureNodeId",
    "missing-capture-node",
  );
  for (const requirement of danglingCapture.productRequirements) {
    const captureIndex = requirement.requiredForCaptureNodeIds.indexOf(
      originalCaptureNodeId,
    );
    if (captureIndex >= 0) {
      (requirement.requiredForCaptureNodeIds as unknown as string[])[
        captureIndex
      ] = "missing-capture-node";
    }
  }
  assert.doesNotThrow(() => SurfacePreIngestLedgerSchema.parse(danglingCapture));
  assert.throws(
    () => assertSurfaceBindings(danglingCapture, marsJezeroSurface),
    /unknown fixture capture missing-capture-node/,
  );
});

test("surface ledger rejects cross-body, cross-experience, and stale mutations", () => {
  const crossBody = cloneLedger(marsJezeroPreIngestLedger);
  setField(crossBody.productRequirements[0], "body", "Moon");
  assert.throws(
    () => SurfacePreIngestLedgerSchema.parse(crossBody),
    /does not belong to its ledger/,
  );

  const crossExperience = cloneLedger(moonApollo17SurfacePreIngestLedger);
  setField(
    crossExperience.captureContexts[0],
    "experienceId",
    "mars-jezero-perseverance",
  );
  assert.throws(
    () => SurfacePreIngestLedgerSchema.parse(crossExperience),
    /does not belong to its ledger/,
  );

  const stale = cloneLedger(marsJezeroPreIngestLedger);
  setField(stale, "verifiedAt", "2026-07-18T00:00:00Z");
  assert.throws(
    () => SurfacePreIngestLedgerSchema.parse(stale),
    /verification cannot predate source checks/,
  );
});
