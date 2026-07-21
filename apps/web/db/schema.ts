import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const operationalTimestamp = (name: string) =>
  integer(name, { mode: "number" }).notNull().default(sql`(unixepoch() * 1000)`);

export const appUsers = sqliteTable(
  "app_users",
  {
    id: text().primaryKey(),
    displayName: text("display_name").notNull(),
    status: text().notNull().default("active"),
    consentVersion: text("consent_version").notNull().default("foundation-0"),
    createdAtMs: operationalTimestamp("created_at_ms").$type<number>(),
    lastSeenAtMs: operationalTimestamp("last_seen_at_ms").$type<number>(),
    deletedAtMs: integer("deleted_at_ms", { mode: "number" }),
  },
  (table) => [
    check("ck_app_users_id", sql`${table.id} GLOB 'usr_*'`),
    check("ck_app_users_status", sql`${table.status} IN ('active', 'suspended', 'deleted')`),
  ],
);

export const authIdentities = sqliteTable(
  "auth_identities",
  {
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    keyVersion: text("key_version").notNull().default("v1"),
    subjectHmac: text("subject_hmac").notNull(),
    createdAtMs: operationalTimestamp("created_at_ms").$type<number>(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.keyVersion, table.subjectHmac] }),
    index("ix_auth_identities_user").on(table.userId),
    check(
      "ck_auth_identity_key_version",
      sql`length(${table.keyVersion}) BETWEEN 1 AND 32 AND ${table.keyVersion} NOT GLOB '*[^A-Za-z0-9._-]*'`,
    ),
    check(
      "ck_auth_identity_hmac",
      sql`length(${table.subjectHmac}) = 64 AND ${table.subjectHmac} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
);

export const judgeAccessAttempts = sqliteTable(
  "judge_access_attempts",
  {
    attemptKey: text("attempt_key").primaryKey(),
    windowStartedAtMs: integer("window_started_at_ms", { mode: "number" }).notNull(),
    failureCount: integer("failure_count").notNull(),
    blockedUntilMs: integer("blocked_until_ms", { mode: "number" }).notNull().default(0),
    updatedAtMs: integer("updated_at_ms", { mode: "number" }).notNull(),
  },
  (table) => [
    check(
      "ck_judge_access_attempt_key",
      sql`length(${table.attemptKey}) = 43 AND ${table.attemptKey} NOT GLOB '*[^A-Za-z0-9_-]*'`,
    ),
    check("ck_judge_access_failure_count", sql`${table.failureCount} BETWEEN 1 AND 8`),
    check(
      "ck_judge_access_timestamps",
      sql`${table.windowStartedAtMs} >= 0 AND ${table.blockedUntilMs} >= 0 AND ${table.updatedAtMs} >= ${table.windowStartedAtMs}`,
    ),
  ],
);

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  locale: text().notNull().default("en"),
  unitsSystem: text("units_system").notNull().default("scientific"),
  accessibilityJson: text("accessibility_json").notNull().default("{}"),
  privacyJson: text("privacy_json").notNull().default("{}"),
  updatedAtMs: operationalTimestamp("updated_at_ms").$type<number>(),
}, (table) => [
  check("ck_user_preferences_accessibility_json", sql`json_valid(${table.accessibilityJson})`),
  check("ck_user_preferences_privacy_json", sql`json_valid(${table.privacyJson})`),
]);

export const contentReleases = sqliteTable(
  "content_releases",
  {
    id: text().primaryKey(),
    version: text().notNull(),
    schemaVersion: text("schema_version").notNull(),
    parentReleaseId: text("parent_release_id"),
    rollbackReleaseId: text("rollback_release_id"),
    state: text().notNull(),
    manifestR2Key: text("manifest_r2_key").notNull(),
    manifestSha256: text("manifest_sha256").notNull(),
    signature: text(),
    signingKeyId: text("signing_key_id"),
    createdAtMs: operationalTimestamp("created_at_ms").$type<number>(),
    publishedAtMs: integer("published_at_ms", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("uq_content_releases_version").on(table.version),
    index("ix_content_releases_state").on(table.state, table.publishedAtMs),
    check(
      "ck_content_release_id",
      sql`length(${table.id}) BETWEEN 10 AND 131 AND ${table.id} GLOB 'rel_[a-z0-9]*' AND ${table.id} NOT GLOB '*[^a-z0-9_-]*'`,
    ),
    check(
      "ck_content_release_hash",
      sql`length(${table.manifestSha256}) = 64 AND ${table.manifestSha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "ck_content_release_state",
      sql`${table.state} IN ('draft', 'validating', 'ready', 'published', 'superseded', 'withdrawn')`,
    ),
    check(
      "ck_content_release_published_at",
      sql`(${table.state} IN ('published', 'superseded', 'withdrawn') AND ${table.publishedAtMs} IS NOT NULL) OR (${table.state} NOT IN ('published', 'superseded', 'withdrawn') AND ${table.publishedAtMs} IS NULL)`,
    ),
    foreignKey({
      columns: [table.parentReleaseId],
      foreignColumns: [table.id],
      name: "fk_content_release_parent",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.rollbackReleaseId],
      foreignColumns: [table.id],
      name: "fk_content_release_rollback",
    }).onDelete("restrict"),
  ],
);

export const activeReleaseChannels = sqliteTable("active_release_channels", {
  channel: text().primaryKey(),
  releaseId: text("release_id")
    .notNull()
    .references(() => contentReleases.id, { onDelete: "restrict" }),
  activatedAtMs: operationalTimestamp("activated_at_ms").$type<number>(),
  activatedByUserId: text("activated_by_user_id").references(() => appUsers.id, {
    onDelete: "set null",
  }),
});

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    id: text().primaryKey(),
    contractVersion: text("contract_version").notNull().default("1.0.0"),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    entityId: text("entity_id").notNull(),
    navigationTargetId: text("navigation_target_id"),
    releaseId: text("release_id")
      .notNull()
      .references(() => contentReleases.id, { onDelete: "restrict" }),
    label: text().notNull(),
    sceneJson: text("scene_json").notNull(),
    sceneR2Key: text("scene_r2_key"),
    createdAtMs: operationalTimestamp("created_at_ms").$type<number>(),
  },
  (table) => [
    index("ix_bookmarks_user_created").on(table.userId, table.createdAtMs),
    uniqueIndex("uq_bookmarks_user_entity_release").on(
      table.userId,
      table.entityId,
      table.releaseId,
    ),
    check("ck_bookmark_id", sql`${table.id} GLOB 'bmk_*'`),
    check(
      "ck_bookmark_contract_version",
      sql`${table.contractVersion} = '1.0.0'`,
    ),
    check("ck_bookmark_scene_json", sql`json_valid(${table.sceneJson})`),
  ],
);

export const propulsionModels = sqliteTable(
  "propulsion_models",
  {
    id: text().primaryKey(),
    code: text().notNull(),
    version: text().notNull(),
    modelClass: text("model_class").notNull(),
    title: text().notNull(),
    distanceDefinition: text("distance_definition").notNull(),
    definitionJson: text("definition_json").notNull(),
    evidenceClass: text("evidence_class").notNull(),
    citationAssertionId: text("citation_assertion_id"),
  },
  (table) => [
    uniqueIndex("uq_propulsion_code_version").on(table.code, table.version),
    check("ck_propulsion_definition_json", sql`json_valid(${table.definitionJson})`),
  ],
);

export const userSpacecraft = sqliteTable(
  "user_spacecraft",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    propulsionModelId: text("propulsion_model_id")
      .notNull()
      .references(() => propulsionModels.id, { onDelete: "restrict" }),
    cosmeticsJson: text("cosmetics_json").notNull().default("{}"),
    createdAtMs: operationalTimestamp("created_at_ms").$type<number>(),
    updatedAtMs: operationalTimestamp("updated_at_ms").$type<number>(),
  },
  (table) => [
    index("ix_user_spacecraft_owner").on(table.userId, table.updatedAtMs),
    uniqueIndex("uq_user_spacecraft_id_owner").on(table.id, table.userId),
    check("ck_user_spacecraft_id", sql`${table.id} GLOB 'ship_*'`),
    check("ck_user_spacecraft_cosmetics_json", sql`json_valid(${table.cosmeticsJson})`),
  ],
);

export const savedRoutes = sqliteTable(
  "saved_routes",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    title: text().notNull(),
    visibility: text().notNull().default("private"),
    travelMode: text("travel_mode").notNull(),
    spacecraftId: text("spacecraft_id").references(() => userSpacecraft.id, {
      onDelete: "set null",
    }),
    releaseId: text("release_id")
      .notNull()
      .references(() => contentReleases.id, { onDelete: "restrict" }),
    originTargetId: text("origin_target_id").notNull(),
    destinationTargetId: text("destination_target_id").notNull(),
    assumptionsJson: text("assumptions_json").notNull(),
    status: text().notNull().default("saved"),
    createdAtMs: operationalTimestamp("created_at_ms").$type<number>(),
    updatedAtMs: operationalTimestamp("updated_at_ms").$type<number>(),
  },
  (table) => [
    index("ix_saved_routes_user_updated").on(table.userId, table.updatedAtMs),
    check("ck_saved_route_id", sql`${table.id} GLOB 'route_*'`),
    check("ck_saved_route_assumptions_json", sql`json_valid(${table.assumptionsJson})`),
    check("ck_saved_route_visibility", sql`${table.visibility} IN ('private', 'unlisted', 'public')`),
  ],
);

export const routeWaypoints = sqliteTable(
  "route_waypoints",
  {
    id: text().primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => savedRoutes.id, { onDelete: "cascade" }),
    ordinal: integer().notNull(),
    navigationTargetId: text("navigation_target_id").notNull(),
    arrivalScientificTimeJson: text("arrival_scientific_time_json"),
    departureScientificTimeJson: text("departure_scientific_time_json"),
    note: text(),
  },
  (table) => [
    uniqueIndex("uq_route_waypoint_ordinal").on(table.routeId, table.ordinal),
    uniqueIndex("uq_route_waypoint_id_route").on(table.id, table.routeId),
    check("ck_route_waypoint_ordinal", sql`${table.ordinal} >= 0`),
    check(
      "ck_route_waypoint_arrival_json",
      sql`${table.arrivalScientificTimeJson} IS NULL OR json_valid(${table.arrivalScientificTimeJson})`,
    ),
    check(
      "ck_route_waypoint_departure_json",
      sql`${table.departureScientificTimeJson} IS NULL OR json_valid(${table.departureScientificTimeJson})`,
    ),
  ],
);

export const routeLegs = sqliteTable(
  "route_legs",
  {
    id: text().primaryKey(),
    routeId: text("route_id")
      .notNull()
      .references(() => savedRoutes.id, { onDelete: "cascade" }),
    ordinal: integer().notNull(),
    fromWaypointId: text("from_waypoint_id").notNull(),
    toWaypointId: text("to_waypoint_id").notNull(),
    propulsionModelId: text("propulsion_model_id").references(() => propulsionModels.id, {
      onDelete: "restrict",
    }),
    distanceDefinition: text("distance_definition").notNull(),
    distanceLexical: text("distance_lexical"),
    distanceUnit: text("distance_unit"),
    durationLexical: text("duration_lexical"),
    durationUnit: text("duration_unit"),
    assumptionsJson: text("assumptions_json").notNull(),
    resultState: text("result_state").notNull(),
  },
  (table) => [
    uniqueIndex("uq_route_leg_ordinal").on(table.routeId, table.ordinal),
    check("ck_route_leg_ordinal", sql`${table.ordinal} >= 0`),
    check("ck_route_leg_assumptions_json", sql`json_valid(${table.assumptionsJson})`),
    foreignKey({
      columns: [table.fromWaypointId, table.routeId],
      foreignColumns: [routeWaypoints.id, routeWaypoints.routeId],
      name: "fk_route_leg_from_waypoint_route",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.toWaypointId, table.routeId],
      foreignColumns: [routeWaypoints.id, routeWaypoints.routeId],
      name: "fk_route_leg_to_waypoint_route",
    }).onDelete("cascade"),
  ],
);

export const userDiscoveries = sqliteTable(
  "user_discoveries",
  {
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    entityId: text("entity_id").notNull(),
    firstSeenAtMs: operationalTimestamp("first_seen_at_ms").$type<number>(),
    lastSeenAtMs: operationalTimestamp("last_seen_at_ms").$type<number>(),
    visitCount: integer("visit_count").notNull().default(1),
    discoveryMethod: text("discovery_method").notNull(),
    releaseId: text("release_id")
      .notNull()
      .references(() => contentReleases.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.entityId] }),
    index("ix_user_discoveries_recent").on(table.userId, table.lastSeenAtMs),
    check("ck_user_discoveries_visit_count", sql`${table.visitCount} > 0`),
  ],
);

export const userProgress = sqliteTable(
  "user_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    scopeEntityId: text("scope_entity_id").notNull(),
    metricCode: text("metric_code").notNull(),
    valueNumeric: integer("value_numeric"),
    valueJson: text("value_json"),
    updatedAtMs: operationalTimestamp("updated_at_ms").$type<number>(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.scopeEntityId, table.metricCode] }),
    check(
      "ck_user_progress_value_json",
      sql`${table.valueJson} IS NULL OR json_valid(${table.valueJson})`,
    ),
  ],
);
