-- Cosmography scientific control-plane schema for Cloudflare D1 (SQLite).
-- Bulk catalogs, tiles, kernels, media, and derived scientific products do not
-- belong in these tables; they are immutable R2 objects or authority URLs.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE releases (
  release_id TEXT PRIMARY KEY CHECK (release_id GLOB 'rel_*'),
  schema_version TEXT NOT NULL,
  content_version TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (
    stage IN ('draft', 'validating', 'ready', 'published', 'superseded', 'withdrawn')
  ),
  created_at TEXT NOT NULL,
  published_at TEXT,
  producer TEXT NOT NULL,
  code_commit TEXT NOT NULL,
  rollback_target_id TEXT REFERENCES releases(release_id) ON DELETE RESTRICT,
  minimum_client_version TEXT NOT NULL,
  api_version TEXT NOT NULL,
  signature_algorithm TEXT,
  signature_key_id TEXT,
  signature_canonicalization TEXT,
  signature_base64 TEXT,
  UNIQUE (content_version)
);

CREATE TABLE release_parents (
  release_id TEXT NOT NULL REFERENCES releases(release_id) ON DELETE CASCADE,
  parent_release_id TEXT NOT NULL REFERENCES releases(release_id) ON DELETE RESTRICT,
  PRIMARY KEY (release_id, parent_release_id),
  CHECK (release_id <> parent_release_id)
);

CREATE TABLE active_releases (
  channel TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES releases(release_id) ON DELETE RESTRICT,
  activated_at TEXT NOT NULL,
  activated_by TEXT NOT NULL
);

CREATE TABLE sources (
  source_id TEXT PRIMARY KEY CHECK (source_id GLOB 'src_*'),
  authority_name TEXT NOT NULL,
  title TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (
    source_kind IN ('api', 'bulk-release', 'event-stream', 'archive', 'publication', 'curated')
  ),
  cadence TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE source_snapshots (
  release_id TEXT NOT NULL REFERENCES releases(release_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE RESTRICT,
  authority_version TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  upstream_published_at TEXT,
  request_or_manifest_sha256 TEXT NOT NULL CHECK (
    length(request_or_manifest_sha256) = 64
  ),
  PRIMARY KEY (release_id, source_id, authority_version, retrieved_at)
);

CREATE TABLE release_objects (
  release_id TEXT NOT NULL REFERENCES releases(release_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  storage_kind TEXT NOT NULL CHECK (storage_kind IN ('r2', 'external-authority')),
  locator TEXT NOT NULL,
  authority_version TEXT,
  sha256 TEXT CHECK (sha256 IS NULL OR length(sha256) = 64),
  byte_length INTEGER CHECK (byte_length IS NULL OR byte_length >= 0),
  media_type TEXT,
  record_count INTEGER CHECK (record_count IS NULL OR record_count >= 0),
  PRIMARY KEY (release_id, ordinal),
  CHECK (
    (storage_kind = 'r2' AND sha256 IS NOT NULL AND byte_length IS NOT NULL AND media_type IS NOT NULL)
    OR storage_kind = 'external-authority'
  )
);

CREATE TABLE release_validations (
  release_id TEXT NOT NULL REFERENCES releases(release_id) ON DELETE CASCADE,
  validator TEXT NOT NULL,
  validator_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'waived')),
  report_object_ordinal INTEGER,
  reviewed_by TEXT,
  waiver_reason TEXT,
  PRIMARY KEY (release_id, validator, validator_version),
  FOREIGN KEY (release_id, report_object_ordinal)
    REFERENCES release_objects(release_id, ordinal) ON DELETE RESTRICT,
  CHECK (status <> 'waived' OR waiver_reason IS NOT NULL)
);

CREATE TABLE entities (
  entity_id TEXT PRIMARY KEY CHECK (entity_id GLOB 'ent_*'),
  entity_type TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  names_json TEXT NOT NULL CHECK (json_valid(names_json)),
  authority_ids_json TEXT NOT NULL CHECK (json_valid(authority_ids_json)),
  resolution_evidence_json TEXT NOT NULL CHECK (json_valid(resolution_evidence_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE assertions (
  assertion_id TEXT PRIMARY KEY CHECK (assertion_id GLOB 'asr_*'),
  subject_id TEXT NOT NULL REFERENCES entities(entity_id) ON DELETE RESTRICT,
  predicate TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  evidence_class TEXT NOT NULL CHECK (
    evidence_class IN (
      'direct-observation',
      'calibrated-observation',
      'catalog-measurement',
      'derived-result',
      'scientific-reconstruction',
      'physics-simulation',
      'artist-interpretation'
    )
  ),
  method TEXT NOT NULL,
  source_field TEXT,
  observed_time_json TEXT CHECK (
    observed_time_json IS NULL OR json_valid(observed_time_json)
  ),
  valid_time_json TEXT CHECK (valid_time_json IS NULL OR json_valid(valid_time_json)),
  quality_flags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(quality_flags_json)),
  state TEXT NOT NULL CHECK (
    state IN ('proposed', 'reviewed', 'published', 'superseded', 'withdrawn')
  ),
  preferred_by_rule TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX assertions_subject_predicate
  ON assertions(subject_id, predicate, state);

CREATE TABLE assertion_sources (
  assertion_id TEXT NOT NULL REFERENCES assertions(assertion_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE RESTRICT,
  PRIMARY KEY (assertion_id, source_id)
);

CREATE TABLE assertion_supersessions (
  assertion_id TEXT NOT NULL REFERENCES assertions(assertion_id) ON DELETE CASCADE,
  superseded_assertion_id TEXT NOT NULL REFERENCES assertions(assertion_id) ON DELETE RESTRICT,
  PRIMARY KEY (assertion_id, superseded_assertion_id),
  CHECK (assertion_id <> superseded_assertion_id)
);

CREATE TABLE representations (
  representation_id TEXT PRIMARY KEY CHECK (representation_id GLOB 'rep_*'),
  entity_id TEXT NOT NULL REFERENCES entities(entity_id) ON DELETE RESTRICT,
  component_path TEXT NOT NULL,
  representation_kind TEXT NOT NULL,
  label_json TEXT NOT NULL CHECK (json_valid(label_json)),
  valid_time_json TEXT CHECK (valid_time_json IS NULL OR json_valid(valid_time_json)),
  review_state TEXT NOT NULL CHECK (
    review_state IN ('draft', 'science-reviewed', 'rights-reviewed', 'publishable', 'withdrawn')
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX representations_entity
  ON representations(entity_id, component_path, review_state);

CREATE TABLE representation_sources (
  representation_id TEXT NOT NULL REFERENCES representations(representation_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE RESTRICT,
  PRIMARY KEY (representation_id, source_id)
);

CREATE TABLE rights_statements (
  rights_id TEXT PRIMARY KEY CHECK (rights_id GLOB 'rgt_*'),
  target_kind TEXT NOT NULL CHECK (
    target_kind IN ('asset', 'representation', 'source')
  ),
  target_id TEXT NOT NULL,
  basis_json TEXT NOT NULL CHECK (json_valid(basis_json)),
  use_profile_json TEXT NOT NULL CHECK (json_valid(use_profile_json)),
  credit_line TEXT NOT NULL,
  required_notices_json TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(required_notices_json)
  ),
  source_terms_url TEXT,
  terms_captured_at TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (
    review_status IN ('unreviewed', 'reviewed', 'expired', 'disputed')
  ),
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_expires_at TEXT,
  UNIQUE (target_kind, target_id, rights_id)
);

CREATE INDEX rights_target ON rights_statements(target_kind, target_id);

CREATE TABLE assets (
  asset_id TEXT PRIMARY KEY CHECK (asset_id GLOB 'asset_*'),
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE RESTRICT,
  storage_kind TEXT NOT NULL CHECK (storage_kind IN ('r2', 'external-authority')),
  locator TEXT NOT NULL,
  original_url TEXT,
  media_type TEXT NOT NULL,
  byte_length INTEGER CHECK (byte_length IS NULL OR byte_length >= 0),
  sha256 TEXT CHECK (sha256 IS NULL OR length(sha256) = 64),
  source_product_id TEXT,
  created_at TEXT NOT NULL,
  CHECK (storage_kind <> 'r2' OR (sha256 IS NOT NULL AND byte_length IS NOT NULL))
);

CREATE TABLE representation_assets (
  representation_id TEXT NOT NULL REFERENCES representations(representation_id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  PRIMARY KEY (representation_id, asset_id)
);

-- Polymorphic membership is validated by the application before a release is
-- marked ready. It lets one immutable release pin metadata of several kinds.
CREATE TABLE release_members (
  release_id TEXT NOT NULL REFERENCES releases(release_id) ON DELETE CASCADE,
  member_kind TEXT NOT NULL CHECK (
    member_kind IN ('entity', 'assertion', 'representation', 'rights', 'asset')
  ),
  member_id TEXT NOT NULL,
  member_sha256 TEXT NOT NULL CHECK (length(member_sha256) = 64),
  PRIMARY KEY (release_id, member_kind, member_id)
);

CREATE INDEX release_members_lookup ON release_members(member_kind, member_id);

INSERT INTO schema_migrations (migration_id, applied_at)
VALUES ('0001_core_control_plane', CURRENT_TIMESTAMP);
