PRAGMA foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE `active_release_channels` (
	`channel` text PRIMARY KEY NOT NULL,
	`release_id` text NOT NULL,
	`activated_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`activated_by_user_id` text,
	FOREIGN KEY (`release_id`) REFERENCES `content_releases`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`activated_by_user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`consent_version` text DEFAULT 'foundation-0' NOT NULL,
	`created_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at_ms` integer,
	CONSTRAINT "ck_app_users_id" CHECK("app_users"."id" GLOB 'usr_*'),
	CONSTRAINT "ck_app_users_status" CHECK("app_users"."status" IN ('active', 'suspended', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE `auth_identities` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`key_version` text DEFAULT 'v1' NOT NULL,
	`subject_hmac` text NOT NULL,
	`created_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`provider`, `key_version`, `subject_hmac`),
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_auth_identity_key_version" CHECK(length("auth_identities"."key_version") BETWEEN 1 AND 32 AND "auth_identities"."key_version" NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT "ck_auth_identity_hmac" CHECK(length("auth_identities"."subject_hmac") = 64 AND "auth_identities"."subject_hmac" NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE INDEX `ix_auth_identities_user` ON `auth_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`navigation_target_id` text,
	`release_id` text NOT NULL,
	`label` text NOT NULL,
	`scene_json` text NOT NULL,
	`scene_r2_key` text,
	`created_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`release_id`) REFERENCES `content_releases`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_bookmark_id" CHECK("bookmarks"."id" GLOB 'bmk_*'),
	CONSTRAINT "ck_bookmark_scene_json" CHECK(json_valid("bookmarks"."scene_json"))
);
--> statement-breakpoint
CREATE INDEX `ix_bookmarks_user_created` ON `bookmarks` (`user_id`,`created_at_ms`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_bookmarks_user_entity_release` ON `bookmarks` (`user_id`,`entity_id`,`release_id`);--> statement-breakpoint
CREATE TABLE `content_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`schema_version` text NOT NULL,
	`parent_release_id` text,
	`rollback_release_id` text,
	`state` text NOT NULL,
	`manifest_r2_key` text NOT NULL,
	`manifest_sha256` text NOT NULL,
	`signature` text,
	`signing_key_id` text,
	`created_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`published_at_ms` integer,
	FOREIGN KEY (`parent_release_id`) REFERENCES `content_releases`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`rollback_release_id`) REFERENCES `content_releases`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_content_release_id" CHECK(length("content_releases"."id") BETWEEN 10 AND 131 AND "content_releases"."id" GLOB 'rel_[a-z0-9]*' AND "content_releases"."id" NOT GLOB '*[^a-z0-9_-]*'),
	CONSTRAINT "ck_content_release_hash" CHECK(length("content_releases"."manifest_sha256") = 64 AND "content_releases"."manifest_sha256" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "ck_content_release_state" CHECK("content_releases"."state" IN ('draft', 'validating', 'ready', 'published', 'superseded', 'withdrawn')),
	CONSTRAINT "ck_content_release_published_at" CHECK(("content_releases"."state" IN ('published', 'superseded', 'withdrawn') AND "content_releases"."published_at_ms" IS NOT NULL) OR ("content_releases"."state" NOT IN ('published', 'superseded', 'withdrawn') AND "content_releases"."published_at_ms" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_content_releases_version` ON `content_releases` (`version`);--> statement-breakpoint
CREATE INDEX `ix_content_releases_state` ON `content_releases` (`state`,`published_at_ms`);--> statement-breakpoint
CREATE TABLE `propulsion_models` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`version` text NOT NULL,
	`model_class` text NOT NULL,
	`title` text NOT NULL,
	`distance_definition` text NOT NULL,
	`definition_json` text NOT NULL,
	`evidence_class` text NOT NULL,
	`citation_assertion_id` text,
	CONSTRAINT "ck_propulsion_definition_json" CHECK(json_valid("propulsion_models"."definition_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_propulsion_code_version` ON `propulsion_models` (`code`,`version`);--> statement-breakpoint
CREATE TABLE `route_legs` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`from_waypoint_id` text NOT NULL,
	`to_waypoint_id` text NOT NULL,
	`propulsion_model_id` text,
	`distance_definition` text NOT NULL,
	`distance_lexical` text,
	`distance_unit` text,
	`duration_lexical` text,
	`duration_unit` text,
	`assumptions_json` text NOT NULL,
	`result_state` text NOT NULL,
	FOREIGN KEY (`route_id`) REFERENCES `saved_routes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`propulsion_model_id`) REFERENCES `propulsion_models`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`from_waypoint_id`,`route_id`) REFERENCES `route_waypoints`(`id`,`route_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_waypoint_id`,`route_id`) REFERENCES `route_waypoints`(`id`,`route_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_route_leg_ordinal" CHECK("route_legs"."ordinal" >= 0),
	CONSTRAINT "ck_route_leg_assumptions_json" CHECK(json_valid("route_legs"."assumptions_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_route_leg_ordinal` ON `route_legs` (`route_id`,`ordinal`);--> statement-breakpoint
CREATE TABLE `route_waypoints` (
	`id` text PRIMARY KEY NOT NULL,
	`route_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`navigation_target_id` text NOT NULL,
	`arrival_scientific_time_json` text,
	`departure_scientific_time_json` text,
	`note` text,
	FOREIGN KEY (`route_id`) REFERENCES `saved_routes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_route_waypoint_ordinal" CHECK("route_waypoints"."ordinal" >= 0),
	CONSTRAINT "ck_route_waypoint_arrival_json" CHECK("route_waypoints"."arrival_scientific_time_json" IS NULL OR json_valid("route_waypoints"."arrival_scientific_time_json")),
	CONSTRAINT "ck_route_waypoint_departure_json" CHECK("route_waypoints"."departure_scientific_time_json" IS NULL OR json_valid("route_waypoints"."departure_scientific_time_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_route_waypoint_ordinal` ON `route_waypoints` (`route_id`,`ordinal`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_route_waypoint_id_route` ON `route_waypoints` (`id`,`route_id`);--> statement-breakpoint
CREATE TABLE `saved_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`travel_mode` text NOT NULL,
	`spacecraft_id` text,
	`release_id` text NOT NULL,
	`origin_target_id` text NOT NULL,
	`destination_target_id` text NOT NULL,
	`assumptions_json` text NOT NULL,
	`status` text DEFAULT 'saved' NOT NULL,
	`created_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spacecraft_id`) REFERENCES `user_spacecraft`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`release_id`) REFERENCES `content_releases`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_saved_route_id" CHECK("saved_routes"."id" GLOB 'route_*'),
	CONSTRAINT "ck_saved_route_assumptions_json" CHECK(json_valid("saved_routes"."assumptions_json")),
	CONSTRAINT "ck_saved_route_visibility" CHECK("saved_routes"."visibility" IN ('private', 'unlisted', 'public'))
);
--> statement-breakpoint
CREATE INDEX `ix_saved_routes_user_updated` ON `saved_routes` (`user_id`,`updated_at_ms`);--> statement-breakpoint
CREATE TABLE `user_discoveries` (
	`user_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`first_seen_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`visit_count` integer DEFAULT 1 NOT NULL,
	`discovery_method` text NOT NULL,
	`release_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `entity_id`),
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`release_id`) REFERENCES `content_releases`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_user_discoveries_visit_count" CHECK("user_discoveries"."visit_count" > 0)
);
--> statement-breakpoint
CREATE INDEX `ix_user_discoveries_recent` ON `user_discoveries` (`user_id`,`last_seen_at_ms`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`units_system` text DEFAULT 'scientific' NOT NULL,
	`accessibility_json` text DEFAULT '{}' NOT NULL,
	`privacy_json` text DEFAULT '{}' NOT NULL,
	`updated_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_user_preferences_accessibility_json" CHECK(json_valid("user_preferences"."accessibility_json")),
	CONSTRAINT "ck_user_preferences_privacy_json" CHECK(json_valid("user_preferences"."privacy_json"))
);
--> statement-breakpoint
CREATE TABLE `user_progress` (
	`user_id` text NOT NULL,
	`scope_entity_id` text NOT NULL,
	`metric_code` text NOT NULL,
	`value_numeric` integer,
	`value_json` text,
	`updated_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `scope_entity_id`, `metric_code`),
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ck_user_progress_value_json" CHECK("user_progress"."value_json" IS NULL OR json_valid("user_progress"."value_json"))
);
--> statement-breakpoint
CREATE TABLE `user_spacecraft` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`propulsion_model_id` text NOT NULL,
	`cosmetics_json` text DEFAULT '{}' NOT NULL,
	`created_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at_ms` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`propulsion_model_id`) REFERENCES `propulsion_models`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "ck_user_spacecraft_id" CHECK("user_spacecraft"."id" GLOB 'ship_*'),
	CONSTRAINT "ck_user_spacecraft_cosmetics_json" CHECK(json_valid("user_spacecraft"."cosmetics_json"))
);
--> statement-breakpoint
CREATE INDEX `ix_user_spacecraft_owner` ON `user_spacecraft` (`user_id`,`updated_at_ms`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_spacecraft_id_owner` ON `user_spacecraft` (`id`,`user_id`);--> statement-breakpoint
CREATE TRIGGER `trg_content_releases_immutable_payload`
BEFORE UPDATE OF `id`, `version`, `schema_version`, `parent_release_id`, `rollback_release_id`, `manifest_r2_key`, `manifest_sha256`, `signature`, `signing_key_id`, `created_at_ms`, `published_at_ms`
ON `content_releases`
WHEN OLD.`state` IN ('published', 'superseded', 'withdrawn')
BEGIN
	SELECT RAISE(ABORT, 'published release payload is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `trg_content_releases_state_transition`
BEFORE UPDATE OF `state`
ON `content_releases`
WHEN NOT (
	NEW.`state` = OLD.`state`
	OR (OLD.`state` = 'draft' AND NEW.`state` = 'validating')
	OR (OLD.`state` = 'validating' AND NEW.`state` IN ('draft', 'ready'))
	OR (OLD.`state` = 'ready' AND NEW.`state` IN ('validating', 'published'))
	OR (OLD.`state` = 'published' AND NEW.`state` IN ('superseded', 'withdrawn'))
	OR (OLD.`state` = 'superseded' AND NEW.`state` = 'withdrawn')
)
BEGIN
	SELECT RAISE(ABORT, 'invalid content release state transition');
END;--> statement-breakpoint
CREATE TRIGGER `trg_content_releases_active_state_guard`
BEFORE UPDATE OF `state`
ON `content_releases`
WHEN NEW.`state` <> 'published'
	AND EXISTS (
		SELECT 1 FROM `active_release_channels` WHERE `release_id` = OLD.`id`
	)
BEGIN
	SELECT RAISE(ABORT, 'active release must be replaced before its state changes');
END;--> statement-breakpoint
CREATE TRIGGER `trg_content_releases_no_delete_after_publication`
BEFORE DELETE ON `content_releases`
WHEN OLD.`state` IN ('published', 'superseded', 'withdrawn')
BEGIN
	SELECT RAISE(ABORT, 'published release records cannot be deleted');
END;--> statement-breakpoint
CREATE TRIGGER `trg_active_release_channels_insert_published`
BEFORE INSERT ON `active_release_channels`
WHEN NOT EXISTS (
	SELECT 1 FROM `content_releases`
	WHERE `id` = NEW.`release_id` AND `state` = 'published'
)
BEGIN
	SELECT RAISE(ABORT, 'active release channel requires a published release');
END;--> statement-breakpoint
CREATE TRIGGER `trg_active_release_channels_update_published`
BEFORE UPDATE OF `release_id` ON `active_release_channels`
WHEN NOT EXISTS (
	SELECT 1 FROM `content_releases`
	WHERE `id` = NEW.`release_id` AND `state` = 'published'
)
BEGIN
	SELECT RAISE(ABORT, 'active release channel requires a published release');
END;--> statement-breakpoint
CREATE TRIGGER `trg_saved_routes_spacecraft_owner_insert`
BEFORE INSERT ON `saved_routes`
WHEN NEW.`spacecraft_id` IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM `user_spacecraft`
		WHERE `id` = NEW.`spacecraft_id` AND `user_id` = NEW.`user_id`
	)
BEGIN
	SELECT RAISE(ABORT, 'saved route spacecraft must belong to the route owner');
END;--> statement-breakpoint
CREATE TRIGGER `trg_saved_routes_spacecraft_owner_update`
BEFORE UPDATE OF `spacecraft_id`, `user_id` ON `saved_routes`
WHEN NEW.`spacecraft_id` IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM `user_spacecraft`
		WHERE `id` = NEW.`spacecraft_id` AND `user_id` = NEW.`user_id`
	)
BEGIN
	SELECT RAISE(ABORT, 'saved route spacecraft must belong to the route owner');
END;--> statement-breakpoint
INSERT INTO `content_releases` (
	`id`, `version`, `schema_version`, `state`, `manifest_r2_key`,
	`manifest_sha256`, `created_at_ms`, `published_at_ms`
) VALUES (
	'rel_landing_atlas_v0_1_0',
	'landing-atlas-v0.1.0',
	'0.1.0',
	'published',
	'release-manifests/rel_landing_atlas_v0_1_0.json',
	'e1dc9decfb38fa4996a4fe163dd5eba2b8fc448bea7a9d717a1a4febb3cf5b0e',
	1784419200000,
	1784419200000
);--> statement-breakpoint
INSERT INTO `active_release_channels` (
	`channel`, `release_id`, `activated_at_ms`
) VALUES (
	'foundation',
	'rel_landing_atlas_v0_1_0',
	1784419200000
);
