import {
  ConnectorSourceMappingSchema,
  deepFreezeGovernanceRecord,
  type ConnectorSourceMapping,
} from "@cosmography/scientific-model";

import { getSourcePassport, sourcePassports } from "./registry";

export const SCIENTIFIC_SOURCE_MAPPING_VERSION = "1.0.0";

/**
 * Reviewed crosswalk, never a slug-to-ID coercion. Opaque scientific IDs may
 * change only through a versioned mapping update and evidence-policy review.
 */
const scientificSourceIdByConnector = deepFreezeGovernanceRecord({
  "naif-spice": "src_naif_spice",
  "jpl-horizons": "src_jpl_horizons",
  "nasa-pds4": "src_nasa_pds4",
  "esa-psa": "src_esa_psa",
  "jaxa-darts": "src_jaxa_darts",
  "isro-issdc": "src_isro_issdc",
  "esa-gaia-tap": "src_esa_gaia_tap",
  "cds-simbad-tap": "src_cds_simbad_tap",
  "cds-vizier-tap": "src_cds_vizier_tap",
  "stsci-mast": "src_stsci_mast",
  "nasa-exoplanet-archive": "src_nasa_exoplanet_archive",
  "nasa-ned": "src_nasa_ned",
  "unoosa-space-object-register": "src_unoosa_space_object_register",
  "rubin-dp1": "src_rubin_dp1",
} as const);

if (
  Object.keys(scientificSourceIdByConnector).length !== sourcePassports.length ||
  sourcePassports.some(
    ({ sourceId }) => !(sourceId in scientificSourceIdByConnector),
  )
) {
  throw new Error("Scientific source crosswalk must cover the connector registry");
}

export function scientificSourceMappingFor(
  connectorSourceId: string,
): ConnectorSourceMapping {
  getSourcePassport(connectorSourceId);
  const scientificSourceId =
    scientificSourceIdByConnector[
      connectorSourceId as keyof typeof scientificSourceIdByConnector
    ];
  if (scientificSourceId === undefined) {
    throw new Error("No reviewed scientific source mapping exists");
  }
  return deepFreezeGovernanceRecord(
    ConnectorSourceMappingSchema.parse({
      mappingVersion: SCIENTIFIC_SOURCE_MAPPING_VERSION,
      connectorSourceId,
      scientificSourceId,
    }),
  );
}
