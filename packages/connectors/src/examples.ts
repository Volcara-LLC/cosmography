import { compileConnectorIntent } from "./adapters";
import type { FreezeContext } from "./contracts";

const frozenAt = "2026-07-19T10:00:00Z";

const bulkContext = (
  releaseLabel: string,
  objectKey: string,
  cursorIn: FreezeContext["cursorIn"] = { kind: "none" },
): FreezeContext => ({
  frozenAt,
  releaseLabel,
  cursorIn,
  destination: {
    payloadClass: "bulk-science",
    payloadStore: "r2",
    controlPointerStore: "d1",
    objectKey,
  },
});

export const exampleHorizonsManifest = compileConnectorIntent(
  {
    kind: "horizons",
    sourceId: "jpl-horizons",
    expectedSignatureVersion: "1.2",
    parameters: {
      COMMAND: "'499'",
      OBJ_DATA: "'YES'",
      MAKE_EPHEM: "'YES'",
      EPHEM_TYPE: "'VECTORS'",
      CENTER: "'500@10'",
      START_TIME: "'2026-07-19'",
      STOP_TIME: "'2026-07-20'",
      STEP_SIZE: "'1 h'",
      REF_PLANE: "'ECLIPTIC'",
      REF_SYSTEM: "'ICRF'",
      TIME_TYPE: "'TDB'",
      OUT_UNITS: "'AU-D'",
      VEC_CORR: "'NONE'",
      VEC_TABLE: "'2'",
    },
  },
  bulkContext(
    "horizons-mars-2026-07-19",
    "ingest/jpl-horizons/2026-07-19/mars-vectors.json",
  ),
);

export const examplePdsManifest = compileConnectorIntent(
  {
    kind: "pds-search",
    sourceId: "nasa-pds4",
    query:
      '(pds:Target_Identification.pds:name eq "Mars") and (product_class eq "Product_Observational")',
    fields: [
      "lidvid",
      "title",
      "ops:Harvest_Info.ops:harvest_date_time",
    ],
    sort: ["ops:Harvest_Info.ops:harvest_date_time"],
    limit: 500,
  },
  bulkContext(
    "pds4-mars-harvest-2026-07-19",
    "ingest/nasa-pds4/2026-07-19/mars-products.json",
    {
      kind: "search-after",
      sortFields: ["ops:Harvest_Info.ops:harvest_date_time"],
      value: ["2026-07-18T00:00:00Z"],
    },
  ),
);

export const exampleGaiaManifest = compileConnectorIntent(
  {
    kind: "tap",
    sourceId: "esa-gaia-tap",
    adql:
      "SELECT TOP 100 source_id, ra, dec, parallax FROM gaiadr3.gaia_source WHERE parallax > 100",
    execution: "sync",
    format: "votable",
    maxRecords: 100,
  },
  bulkContext(
    "gaia-dr3-nearby-sample",
    "ingest/esa-gaia-tap/dr3/nearby-sample.vot",
    { kind: "release", label: "Gaia DR3" },
  ),
);

export const exampleUnoosaManifest = compileConnectorIntent(
  {
    kind: "manual-review",
    sourceId: "unoosa-space-object-register",
    snapshotLabel: "unoosa-registration-documents-2026-07-19",
    instructions:
      "Review new official registration submissions since the prior snapshot, record document symbols and URLs, and preserve amendments as separate lineage events.",
    expectedCapture: "document-index",
  },
  {
    frozenAt,
    releaseLabel: "unoosa-reviewed-2026-07-19",
    cursorIn: { kind: "release", label: "unoosa-reviewed-2026-06-19" },
    destination: {
      payloadClass: "control-metadata",
      payloadStore: "d1",
      controlPointerStore: "d1",
    },
  },
);

export const deterministicExampleManifests = [
  exampleHorizonsManifest,
  examplePdsManifest,
  exampleGaiaManifest,
  exampleUnoosaManifest,
] as const;
