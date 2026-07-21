import { z } from "zod";

import {
  assertAllowedUrl,
  buildSortedForm,
  buildSortedUrl,
  freezeRequestManifest,
  stableStringify,
} from "./canonical";
import {
  FreezeContextSchema,
  Sha256Schema,
  type FreezeContext,
  type FrozenRequestManifest,
  type SourcePassport,
} from "./contracts";
import {
  HORIZONS_OBSERVED_SIGNATURE_VERSION,
  getSourcePassport,
  sourcePassports,
} from "./registry";

export const ADAPTER_VERSION = "0.1.0";

const BoundedAdqlSchema = z
  .string()
  .trim()
  .min(8)
  .max(100_000)
  .refine((value) => /^(SELECT|WITH)\b/i.test(value), {
    message: "TAP intent must be a read-only SELECT or WITH query",
  })
  .refine((value) => !/;\s*\S/.test(value), {
    message: "Multiple ADQL statements are not allowed",
  });

export const TapIntentSchema = z
  .object({
    kind: z.literal("tap"),
    sourceId: z.enum([
      "esa-psa",
      "esa-gaia-tap",
      "cds-simbad-tap",
      "cds-vizier-tap",
      "stsci-mast",
      "nasa-exoplanet-archive",
      "rubin-dp1",
    ]),
    adql: BoundedAdqlSchema,
    execution: z.enum(["sync", "async"]),
    format: z.enum(["votable", "csv", "tsv", "json", "fits"]),
    maxRecords: z.number().int().min(1).max(1_000_000),
  })
  .strict();

const horizonsVectorChoices = {
  REF_PLANE: new Set(["ECLIPTIC", "FRAME", "BODY EQUATOR", "E", "F", "B"]),
  REF_SYSTEM: new Set(["ICRF", "B1950"]),
  TIME_TYPE: new Set(["TDB", "UT"]),
  OUT_UNITS: new Set(["KM-S", "AU-D", "KM-D"]),
  VEC_CORR: new Set(["NONE", "LT", "LT+S"]),
} as const;

function normalizedHorizonsValue(value: string): string {
  const trimmed = value.trim();
  const unquoted =
    trimmed.length >= 2 &&
    ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"')))
      ? trimmed.slice(1, -1)
      : trimmed;
  return unquoted.trim().toUpperCase();
}

export const HorizonsIntentSchema = z
  .object({
    kind: z.literal("horizons"),
    sourceId: z.literal("jpl-horizons"),
    expectedSignatureVersion: z.literal(HORIZONS_OBSERVED_SIGNATURE_VERSION),
    parameters: z.record(z.string().trim().min(1), z.string().trim().min(1)).superRefine(
      (parameters, context) => {
        if (!("COMMAND" in parameters)) {
          context.addIssue({
            code: "custom",
            path: ["COMMAND"],
            message: "Horizons requests require COMMAND",
          });
        }
        const callerFormatKey = Object.keys(parameters).find(
          (key) => key.toLowerCase() === "format",
        );
        if (callerFormatKey) {
          context.addIssue({
            code: "custom",
            path: [callerFormatKey],
            message: "The adapter freezes Horizons output as JSON",
          });
        }

        const ephemerisType = normalizedHorizonsValue(
          parameters.EPHEM_TYPE ?? "OBSERVER",
        );
        if (
          !new Set(["OBSERVER", "VECTORS", "ELEMENTS", "SPK", "APPROACH"]).has(
            ephemerisType,
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["EPHEM_TYPE"],
            message: "EPHEM_TYPE must use a documented Horizons API value",
          });
          return;
        }
        if (ephemerisType !== "VECTORS") {
          return;
        }

        for (const [key, allowed] of Object.entries(horizonsVectorChoices)) {
          const value = parameters[key];
          if (value === undefined) {
            context.addIssue({
              code: "custom",
              path: [key],
              message: `Horizons vector requests require explicit ${key}`,
            });
            continue;
          }
          if (!allowed.has(normalizedHorizonsValue(value))) {
            context.addIssue({
              code: "custom",
              path: [key],
              message: `${key} is not a documented Horizons vector value`,
            });
          }
        }

        const vectorTable = parameters.VEC_TABLE;
        if (vectorTable === undefined) {
          context.addIssue({
            code: "custom",
            path: ["VEC_TABLE"],
            message: "Horizons vector requests require explicit VEC_TABLE",
          });
        } else if (
          !/^(?:[1-6]|[12][XARP]+)$/i.test(normalizedHorizonsValue(vectorTable))
        ) {
          context.addIssue({
            code: "custom",
            path: ["VEC_TABLE"],
            message: "VEC_TABLE must select a documented vector table from 1 through 6",
          });
        }
      },
    ),
  })
  .strict();

export const PdsSearchIntentSchema = z
  .object({
    kind: z.literal("pds-search"),
    sourceId: z.literal("nasa-pds4"),
    query: z.string().trim().min(1).max(20_000).optional(),
    keywords: z.string().trim().min(1).max(1_000).optional(),
    fields: z.array(z.string().trim().min(1)).max(200).default([]),
    sort: z.array(z.string().trim().min(1)).min(1).max(8),
    limit: z.number().int().min(1).max(1_000),
  })
  .strict()
  .refine((intent) => intent.query !== undefined || intent.keywords !== undefined, {
    message: "PDS search requires a structured query or keywords",
  });

export const ArtifactIntentSchema = z
  .object({
    kind: z.literal("http-artifact"),
    sourceId: z.enum(["naif-spice", "jaxa-darts"]),
    url: z.url(),
    expectedMediaTypes: z.array(z.string().trim().min(1)).min(1).max(10),
    expectedSha256: Sha256Schema.optional(),
  })
  .strict();

export const MastIntentSchema = z
  .object({
    kind: z.literal("mast-invoke"),
    sourceId: z.literal("stsci-mast"),
    service: z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{2,127}$/),
    params: z.record(z.string().trim().min(1), z.unknown()),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(50_000),
  })
  .strict();

export const NedIntentSchema = z
  .object({
    kind: z.literal("ned-rest"),
    sourceId: z.literal("nasa-ned"),
    operation: z.enum([
      "OverviewOfObject",
      "ConeSearchByTarget",
      "ConeSearchByPosition",
      "CrossidsOfObject",
      "PositionsOfObject",
      "RedshiftsOfObject",
      "DistancesOfObject",
      "ClassificationsOfObject",
      "DiametersOfObject",
      "PhotometryOfObject",
      "ReferencesOfObject",
      "ExternalLinksOfObject",
    ]),
    parameters: z.record(
      z.string().trim().min(1),
      z.union([z.string().max(2_000), z.number().finite()]),
    ),
    maxRecords: z.number().int().min(1).max(1_000),
  })
  .strict()
  .superRefine((intent, context) => {
    const targetOperations = new Set([
      "OverviewOfObject",
      "ConeSearchByTarget",
      "CrossidsOfObject",
      "PositionsOfObject",
      "RedshiftsOfObject",
      "DistancesOfObject",
      "ClassificationsOfObject",
      "DiametersOfObject",
      "PhotometryOfObject",
      "ReferencesOfObject",
      "ExternalLinksOfObject",
    ]);
    if (targetOperations.has(intent.operation) && !("TARGET" in intent.parameters)) {
      context.addIssue({
        code: "custom",
        path: ["parameters", "TARGET"],
        message: `${intent.operation} requires TARGET`,
      });
    }
    if (
      intent.operation === "ConeSearchByPosition" &&
      !("RA" in intent.parameters || "LON" in intent.parameters)
    ) {
      context.addIssue({
        code: "custom",
        path: ["parameters"],
        message: "ConeSearchByPosition requires RA/DEC or LON/LAT",
      });
    }
  });

export const ManualIntentSchema = z
  .object({
    kind: z.literal("manual-review"),
    sourceId: z.enum(["isro-issdc", "unoosa-space-object-register"]),
    snapshotLabel: z.string().trim().min(1).max(256),
    instructions: z.string().trim().min(1).max(4_000),
    expectedCapture: z.enum([
      "document-index",
      "release-metadata",
      "account-export",
    ]),
  })
  .strict();

export const ConnectorIntentSchema = z.discriminatedUnion("kind", [
  TapIntentSchema,
  HorizonsIntentSchema,
  PdsSearchIntentSchema,
  ArtifactIntentSchema,
  MastIntentSchema,
  NedIntentSchema,
  ManualIntentSchema,
]);
export type ConnectorIntent = z.infer<typeof ConnectorIntentSchema>;

export interface ConnectorAdapter {
  readonly sourceId: string;
  readonly adapterVersion: string;
  readonly passport: SourcePassport;
  compile(intent: unknown, context: FreezeContext): FrozenRequestManifest;
}

function endpoint(passport: SourcePassport, protocol: string) {
  const found = passport.endpoints.find((candidate) => candidate.protocol === protocol);
  if (!found) {
    throw new Error(`${passport.sourceId} has no ${protocol} endpoint`);
  }
  return found;
}

function authReference(passport: SourcePassport) {
  if (passport.auth.mode === "bearer-token") {
    return {
      mode: "bearer-env" as const,
      envKey: passport.auth.secretEnv,
    };
  }
  if (passport.auth.mode === "interactive-account") {
    return { mode: "interactive-account" as const };
  }
  return { mode: "none" as const };
}

function tapAdapter(sourceId: z.infer<typeof TapIntentSchema>["sourceId"]): ConnectorAdapter {
  const passport = getSourcePassport(sourceId);
  return {
    sourceId,
    adapterVersion: ADAPTER_VERSION,
    passport,
    compile(value, contextInput) {
      const intent = TapIntentSchema.parse(value);
      if (intent.sourceId !== sourceId) {
        throw new Error(`Intent ${intent.sourceId} cannot use adapter ${sourceId}`);
      }
      const context = FreezeContextSchema.parse(contextInput);
      const base = endpoint(passport, "tap").baseUrl.replace(/\/$/, "");
      const url = `${base}/${intent.execution}`;
      const body = buildSortedForm({
        FORMAT: intent.format,
        LANG: "ADQL",
        MAXREC: intent.maxRecords,
        PHASE: intent.execution === "async" ? "RUN" : undefined,
        QUERY: intent.adql,
        REQUEST: "doQuery",
      });
      return freezeRequestManifest({
        passport,
        adapterVersion: ADAPTER_VERSION,
        intent,
        context,
        request: {
          kind: "http",
          method: "POST",
          url,
          headers: {
            accept: intent.format === "json" ? "application/json" : "application/x-votable+xml, text/csv;q=0.9, */*;q=0.1",
            "content-type": "application/x-www-form-urlencoded",
          },
          body,
          auth: authReference(passport),
          expectedMediaTypes: [
            "application/x-votable+xml",
            "application/json",
            "text/csv",
            "text/tab-separated-values",
            "application/fits",
          ],
        },
      });
    },
  };
}

function horizonsAdapter(): ConnectorAdapter {
  const passport = getSourcePassport("jpl-horizons");
  return {
    sourceId: passport.sourceId,
    adapterVersion: ADAPTER_VERSION,
    passport,
    compile(value, context) {
      const intent = HorizonsIntentSchema.parse(value);
      const url = buildSortedUrl(endpoint(passport, "horizons").baseUrl, {
        ...intent.parameters,
        format: "json",
      });
      return freezeRequestManifest({
        passport,
        adapterVersion: ADAPTER_VERSION,
        intent,
        context,
        request: {
          kind: "http",
          method: "GET",
          url,
          headers: { accept: "application/json" },
          auth: { mode: "none" },
          expectedMediaTypes: ["application/json"],
        },
      });
    },
  };
}

function pdsAdapter(): ConnectorAdapter {
  const passport = getSourcePassport("nasa-pds4");
  return {
    sourceId: passport.sourceId,
    adapterVersion: ADAPTER_VERSION,
    passport,
    compile(value, contextInput) {
      const intent = PdsSearchIntentSchema.parse(value);
      const context = FreezeContextSchema.parse(contextInput);
      let searchAfter: string | number | undefined;
      if (context.cursorIn.kind === "search-after") {
        if (context.cursorIn.value.length !== 1) {
          throw new Error("PDS Search API adapter requires one search-after value");
        }
        searchAfter = context.cursorIn.value[0];
      }
      const url = buildSortedUrl(endpoint(passport, "pds-search").baseUrl, {
        fields: intent.fields,
        keywords: intent.keywords,
        limit: intent.limit,
        q: intent.query,
        "search-after": searchAfter,
        sort: intent.sort,
      });
      return freezeRequestManifest({
        passport,
        adapterVersion: ADAPTER_VERSION,
        intent,
        context,
        request: {
          kind: "http",
          method: "GET",
          url,
          headers: { accept: "application/json" },
          auth: { mode: "none" },
          expectedMediaTypes: ["application/json"],
        },
      });
    },
  };
}

function artifactAdapter(sourceId: "naif-spice" | "jaxa-darts"): ConnectorAdapter {
  const passport = getSourcePassport(sourceId);
  const rules =
    sourceId === "naif-spice"
      ? [{ host: "naif.jpl.nasa.gov", pathPrefix: "/pub/naif/" }]
      : [{ host: "data.darts.isas.jaxa.jp", pathPrefix: "/pub/" }];
  return {
    sourceId,
    adapterVersion: ADAPTER_VERSION,
    passport,
    compile(value, context) {
      const intent = ArtifactIntentSchema.parse(value);
      if (intent.sourceId !== sourceId) {
        throw new Error(`Intent ${intent.sourceId} cannot use adapter ${sourceId}`);
      }
      const url = assertAllowedUrl(intent.url, rules).toString();
      return freezeRequestManifest({
        passport,
        adapterVersion: ADAPTER_VERSION,
        intent,
        context,
        request: {
          kind: "http",
          method: "GET",
          url,
          headers: { accept: intent.expectedMediaTypes.join(", ") },
          auth: { mode: "none" },
          expectedMediaTypes: intent.expectedMediaTypes,
        },
        ...(intent.expectedSha256
          ? { expectedResponseSha256: intent.expectedSha256 }
          : {}),
      });
    },
  };
}

function mastAdapter(): ConnectorAdapter {
  const passport = getSourcePassport("stsci-mast");
  const tap = tapAdapter("stsci-mast");
  return {
    sourceId: passport.sourceId,
    adapterVersion: ADAPTER_VERSION,
    passport,
    compile(value, context) {
      if (
        typeof value === "object" &&
        value !== null &&
        "kind" in value &&
        value.kind === "tap"
      ) {
        return tap.compile(value, context);
      }
      const intent = MastIntentSchema.parse(value);
      const body = buildSortedForm({
        format: "json",
        request: stableStringify({
          service: intent.service,
          params: intent.params,
          format: "json",
          pagesize: intent.pageSize,
          page: intent.page,
        }),
      });
      return freezeRequestManifest({
        passport,
        adapterVersion: ADAPTER_VERSION,
        intent,
        context,
        request: {
          kind: "http",
          method: "POST",
          url: endpoint(passport, "mast-invoke").baseUrl,
          headers: {
            accept: "application/json",
            "content-type": "application/x-www-form-urlencoded",
          },
          body,
          auth: { mode: "none" },
          expectedMediaTypes: ["application/json"],
        },
      });
    },
  };
}

function nedAdapter(): ConnectorAdapter {
  const passport = getSourcePassport("nasa-ned");
  return {
    sourceId: passport.sourceId,
    adapterVersion: ADAPTER_VERSION,
    passport,
    compile(value, context) {
      const intent = NedIntentSchema.parse(value);
      const base = endpoint(passport, "ned-rest").baseUrl;
      const url = buildSortedUrl(`${base}${intent.operation}`, {
        ...intent.parameters,
        // The 2026 OverviewOfObject operation documents TARGET and optional
        // cosmology inputs, but not MAXREC. Other list-producing operations
        // remain explicitly bounded by the caller's requested maximum.
        MAXREC:
          intent.operation === "OverviewOfObject"
            ? undefined
            : intent.maxRecords,
      });
      return freezeRequestManifest({
        passport,
        adapterVersion: ADAPTER_VERSION,
        intent,
        context,
        request: {
          kind: "http",
          method: "GET",
          url,
          headers: { accept: "application/xml, text/xml" },
          auth: { mode: "none" },
          expectedMediaTypes: ["application/xml", "text/xml"],
        },
      });
    },
  };
}

function manualAdapter(
  sourceId: "isro-issdc" | "unoosa-space-object-register",
): ConnectorAdapter {
  const passport = getSourcePassport(sourceId);
  return {
    sourceId,
    adapterVersion: ADAPTER_VERSION,
    passport,
    compile(value, context) {
      const intent = ManualIntentSchema.parse(value);
      if (intent.sourceId !== sourceId) {
        throw new Error(`Intent ${intent.sourceId} cannot use adapter ${sourceId}`);
      }
      const reviewUrl = endpoint(passport, "manual-review").baseUrl;
      return freezeRequestManifest({
        passport,
        adapterVersion: ADAPTER_VERSION,
        intent,
        context,
        request: {
          kind: "manual",
          reviewUrl,
          instructions: intent.instructions,
          auth: authReference(passport),
          expectedCapture: intent.expectedCapture,
        },
      });
    },
  };
}

export const connectorAdapters: ReadonlyMap<string, ConnectorAdapter> = new Map([
  ["naif-spice", artifactAdapter("naif-spice")],
  ["jpl-horizons", horizonsAdapter()],
  ["nasa-pds4", pdsAdapter()],
  ["esa-psa", tapAdapter("esa-psa")],
  ["jaxa-darts", artifactAdapter("jaxa-darts")],
  ["isro-issdc", manualAdapter("isro-issdc")],
  ["esa-gaia-tap", tapAdapter("esa-gaia-tap")],
  ["cds-simbad-tap", tapAdapter("cds-simbad-tap")],
  ["cds-vizier-tap", tapAdapter("cds-vizier-tap")],
  ["stsci-mast", mastAdapter()],
  ["nasa-exoplanet-archive", tapAdapter("nasa-exoplanet-archive")],
  ["nasa-ned", nedAdapter()],
  [
    "unoosa-space-object-register",
    manualAdapter("unoosa-space-object-register"),
  ],
  ["rubin-dp1", tapAdapter("rubin-dp1")],
]);

if (connectorAdapters.size !== sourcePassports.length) {
  throw new Error("Every source passport must have exactly one connector adapter");
}

export function getConnectorAdapter(sourceId: string): ConnectorAdapter {
  const adapter = connectorAdapters.get(sourceId);
  if (!adapter) {
    throw new Error(`No adapter registered for ${sourceId}`);
  }
  return adapter;
}

export function compileConnectorIntent(
  value: unknown,
  context: FreezeContext,
): FrozenRequestManifest {
  const intent = ConnectorIntentSchema.parse(value);
  return getConnectorAdapter(intent.sourceId).compile(intent, context);
}
