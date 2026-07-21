CREATE TRIGGER `trg_bookmarks_saved_place_preflight`
BEFORE UPDATE OF `created_at_ms` ON `bookmarks`
BEGIN
	SELECT RAISE(ABORT, 'existing saved place requires review')
	WHERE length(OLD.`id`) <> 36
		OR substr(OLD.`id`, 1, 4) IS NOT 'bmk_'
		OR substr(OLD.`id`, 5) GLOB '*[^0-9a-f]*'
		OR OLD.`release_id` IS NOT 'rel_landing_atlas_v0_1_0'
		OR OLD.`entity_id` NOT IN (
			'observable-universe', 'laniakea', 'local-group', 'andromeda',
			'milky-way', 'sagittarius-a-star', 'proxima-centauri', 'trappist-1',
			'solar-system', 'mars', 'jezero', 'apollo-17', 'voyager-1',
			'jwst-deep-fields', 'earth-exploration-network'
		)
		OR OLD.`navigation_target_id` IS NOT OLD.`entity_id`
		OR OLD.`label` IS NOT CASE OLD.`entity_id`
			WHEN 'observable-universe' THEN 'Known Universe'
			WHEN 'laniakea' THEN 'Laniakea'
			WHEN 'local-group' THEN 'Local Group'
			WHEN 'andromeda' THEN 'Andromeda Galaxy'
			WHEN 'milky-way' THEN 'Milky Way'
			WHEN 'sagittarius-a-star' THEN 'Sagittarius A*'
			WHEN 'proxima-centauri' THEN 'Proxima Centauri'
			WHEN 'trappist-1' THEN 'TRAPPIST-1'
			WHEN 'solar-system' THEN 'Solar System'
			WHEN 'mars' THEN 'Mars'
			WHEN 'jezero' THEN 'Jezero Crater'
			WHEN 'apollo-17' THEN 'Apollo 17 · Taurus–Littrow'
			WHEN 'voyager-1' THEN 'Voyager 1'
			WHEN 'jwst-deep-fields' THEN 'Webb Deep Fields'
			WHEN 'earth-exploration-network' THEN 'Earth Exploration Network'
		END
		OR OLD.`scene_r2_key` IS NOT NULL
		OR COALESCE(
			typeof(OLD.`created_at_ms`) = 'integer'
			AND OLD.`created_at_ms` BETWEEN 1 AND 8640000000000000,
			0
		) = 0
		OR CASE WHEN json_valid(OLD.`scene_json`) = 1 THEN COALESCE(
			json_type(OLD.`scene_json`, '$') = 'object'
			AND json_type(OLD.`scene_json`, '$.appearance') = 'text'
			AND json_extract(OLD.`scene_json`, '$.appearance') IN ('scientific', 'immersive')
			AND json_type(OLD.`scene_json`, '$.savedAtMs') = 'integer'
			AND json_extract(OLD.`scene_json`, '$.savedAtMs') = OLD.`created_at_ms`
			AND OLD.`scene_json` = json_object(
				'schemaId', 'cosmography.user-saved-places',
				'schemaVersion', '1.0.0',
				'entityId', OLD.`entity_id`,
				'domain', CASE OLD.`entity_id`
					WHEN 'observable-universe' THEN 'lightcone'
					WHEN 'laniakea' THEN 'extragalactic'
					WHEN 'local-group' THEN 'extragalactic'
					WHEN 'andromeda' THEN 'extragalactic'
					WHEN 'milky-way' THEN 'galactic'
					WHEN 'sagittarius-a-star' THEN 'simulation'
					WHEN 'proxima-centauri' THEN 'galactic'
					WHEN 'trappist-1' THEN 'system'
					WHEN 'solar-system' THEN 'system'
					WHEN 'mars' THEN 'globe'
					WHEN 'jezero' THEN 'surface'
					WHEN 'apollo-17' THEN 'surface'
					WHEN 'voyager-1' THEN 'system'
					WHEN 'jwst-deep-fields' THEN 'lightcone'
					WHEN 'earth-exploration-network' THEN 'globe'
				END,
				'focusId', OLD.`entity_id`,
				'appearance', json_extract(OLD.`scene_json`, '$.appearance'),
				'timelineYear', 2026,
				'releaseId', 'rel_landing_atlas_v0_1_0',
				'savedAtMs', json_extract(OLD.`scene_json`, '$.savedAtMs'),
				'method', 'manual-save-place',
				'truth', json_object(
					'userConfirmed', json('true'),
					'passiveNavigation', json('false'),
					'navigationAidOnly', json('true'),
					'physicalCameraPose', json('false'),
					'observationClaim', json('false'),
					'encounterClaim', json('false'),
					'routeClaim', json('false'),
					'progressClaim', json('false'),
					'completionClaim', json('false'),
					'masteryClaim', json('false'),
					'achievementClaim', json('false'),
					'scientificDiscoveryClaim', json('false'),
					'shared', json('false')
				)
			),
			0
		) ELSE 0 END = 0;
END;
--> statement-breakpoint
UPDATE `bookmarks` SET `created_at_ms` = `created_at_ms`;
--> statement-breakpoint
DROP TRIGGER `trg_bookmarks_saved_place_preflight`;
--> statement-breakpoint
ALTER TABLE `bookmarks`
ADD COLUMN `contract_version` TEXT NOT NULL DEFAULT '1.0.0'
CONSTRAINT `ck_bookmark_contract_version` CHECK (`contract_version` = '1.0.0');
--> statement-breakpoint
CREATE TRIGGER `trg_bookmarks_saved_place_insert`
BEFORE INSERT ON `bookmarks`
BEGIN
	SELECT RAISE(ABORT, 'saved place already exists')
	WHERE EXISTS (
		SELECT 1 FROM `bookmarks` WHERE `id` = NEW.`id`
	) OR EXISTS (
		SELECT 1 FROM `bookmarks`
		WHERE `user_id` = NEW.`user_id`
			AND `entity_id` = NEW.`entity_id`
			AND `release_id` = NEW.`release_id`
	);

	SELECT RAISE(ABORT, 'invalid saved place identity')
	WHERE NEW.`contract_version` IS NOT '1.0.0'
		OR length(NEW.`id`) <> 36
		OR substr(NEW.`id`, 1, 4) IS NOT 'bmk_'
		OR substr(NEW.`id`, 5) GLOB '*[^0-9a-f]*'
		OR NEW.`release_id` IS NOT 'rel_landing_atlas_v0_1_0'
		OR NEW.`entity_id` NOT IN (
			'observable-universe', 'laniakea', 'local-group', 'andromeda',
			'milky-way', 'sagittarius-a-star', 'proxima-centauri', 'trappist-1',
			'solar-system', 'mars', 'jezero', 'apollo-17', 'voyager-1',
			'jwst-deep-fields', 'earth-exploration-network'
		)
		OR NEW.`navigation_target_id` IS NOT NEW.`entity_id`
		OR NEW.`label` IS NOT CASE NEW.`entity_id`
			WHEN 'observable-universe' THEN 'Known Universe'
			WHEN 'laniakea' THEN 'Laniakea'
			WHEN 'local-group' THEN 'Local Group'
			WHEN 'andromeda' THEN 'Andromeda Galaxy'
			WHEN 'milky-way' THEN 'Milky Way'
			WHEN 'sagittarius-a-star' THEN 'Sagittarius A*'
			WHEN 'proxima-centauri' THEN 'Proxima Centauri'
			WHEN 'trappist-1' THEN 'TRAPPIST-1'
			WHEN 'solar-system' THEN 'Solar System'
			WHEN 'mars' THEN 'Mars'
			WHEN 'jezero' THEN 'Jezero Crater'
			WHEN 'apollo-17' THEN 'Apollo 17 · Taurus–Littrow'
			WHEN 'voyager-1' THEN 'Voyager 1'
			WHEN 'jwst-deep-fields' THEN 'Webb Deep Fields'
			WHEN 'earth-exploration-network' THEN 'Earth Exploration Network'
		END
		OR NEW.`scene_r2_key` IS NOT NULL;

	SELECT RAISE(ABORT, 'invalid saved place timestamp')
	WHERE COALESCE(
		typeof(NEW.`created_at_ms`) = 'integer'
		AND NEW.`created_at_ms` BETWEEN 1 AND 8640000000000000,
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid saved place scene')
	WHERE CASE WHEN json_valid(NEW.`scene_json`) = 1 THEN COALESCE(
		json_type(NEW.`scene_json`, '$') = 'object'
		AND json_type(NEW.`scene_json`, '$.appearance') = 'text'
		AND json_extract(NEW.`scene_json`, '$.appearance') IN ('scientific', 'immersive')
		AND json_type(NEW.`scene_json`, '$.savedAtMs') = 'integer'
		AND json_extract(NEW.`scene_json`, '$.savedAtMs') = NEW.`created_at_ms`
		AND NEW.`scene_json` = json_object(
			'schemaId', 'cosmography.user-saved-places',
			'schemaVersion', '1.0.0',
			'entityId', NEW.`entity_id`,
			'domain', CASE NEW.`entity_id`
				WHEN 'observable-universe' THEN 'lightcone'
				WHEN 'laniakea' THEN 'extragalactic'
				WHEN 'local-group' THEN 'extragalactic'
				WHEN 'andromeda' THEN 'extragalactic'
				WHEN 'milky-way' THEN 'galactic'
				WHEN 'sagittarius-a-star' THEN 'simulation'
				WHEN 'proxima-centauri' THEN 'galactic'
				WHEN 'trappist-1' THEN 'system'
				WHEN 'solar-system' THEN 'system'
				WHEN 'mars' THEN 'globe'
				WHEN 'jezero' THEN 'surface'
				WHEN 'apollo-17' THEN 'surface'
				WHEN 'voyager-1' THEN 'system'
				WHEN 'jwst-deep-fields' THEN 'lightcone'
				WHEN 'earth-exploration-network' THEN 'globe'
			END,
			'focusId', NEW.`entity_id`,
			'appearance', json_extract(NEW.`scene_json`, '$.appearance'),
			'timelineYear', 2026,
			'releaseId', 'rel_landing_atlas_v0_1_0',
			'savedAtMs', json_extract(NEW.`scene_json`, '$.savedAtMs'),
			'method', 'manual-save-place',
			'truth', json_object(
				'userConfirmed', json('true'),
				'passiveNavigation', json('false'),
				'navigationAidOnly', json('true'),
				'physicalCameraPose', json('false'),
				'observationClaim', json('false'),
				'encounterClaim', json('false'),
				'routeClaim', json('false'),
				'progressClaim', json('false'),
				'completionClaim', json('false'),
				'masteryClaim', json('false'),
				'achievementClaim', json('false'),
				'scientificDiscoveryClaim', json('false'),
				'shared', json('false')
			)
		),
		0
	) ELSE 0 END = 0;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_bookmarks_saved_place_update`
BEFORE UPDATE ON `bookmarks`
BEGIN
	SELECT RAISE(ABORT, 'saved place identity is immutable')
	WHERE NEW.`id` IS NOT OLD.`id`
		OR NEW.`contract_version` IS NOT OLD.`contract_version`
		OR NEW.`user_id` IS NOT OLD.`user_id`
		OR NEW.`entity_id` IS NOT OLD.`entity_id`
		OR NEW.`release_id` IS NOT OLD.`release_id`;

	SELECT RAISE(ABORT, 'stored saved place contract has drifted')
	WHERE OLD.`contract_version` IS NOT '1.0.0'
		OR length(OLD.`id`) <> 36
		OR substr(OLD.`id`, 1, 4) IS NOT 'bmk_'
		OR substr(OLD.`id`, 5) GLOB '*[^0-9a-f]*'
		OR OLD.`release_id` IS NOT 'rel_landing_atlas_v0_1_0'
		OR OLD.`entity_id` NOT IN (
			'observable-universe', 'laniakea', 'local-group', 'andromeda',
			'milky-way', 'sagittarius-a-star', 'proxima-centauri', 'trappist-1',
			'solar-system', 'mars', 'jezero', 'apollo-17', 'voyager-1',
			'jwst-deep-fields', 'earth-exploration-network'
		)
		OR OLD.`navigation_target_id` IS NOT OLD.`entity_id`
		OR OLD.`label` IS NOT CASE OLD.`entity_id`
			WHEN 'observable-universe' THEN 'Known Universe'
			WHEN 'laniakea' THEN 'Laniakea'
			WHEN 'local-group' THEN 'Local Group'
			WHEN 'andromeda' THEN 'Andromeda Galaxy'
			WHEN 'milky-way' THEN 'Milky Way'
			WHEN 'sagittarius-a-star' THEN 'Sagittarius A*'
			WHEN 'proxima-centauri' THEN 'Proxima Centauri'
			WHEN 'trappist-1' THEN 'TRAPPIST-1'
			WHEN 'solar-system' THEN 'Solar System'
			WHEN 'mars' THEN 'Mars'
			WHEN 'jezero' THEN 'Jezero Crater'
			WHEN 'apollo-17' THEN 'Apollo 17 · Taurus–Littrow'
			WHEN 'voyager-1' THEN 'Voyager 1'
			WHEN 'jwst-deep-fields' THEN 'Webb Deep Fields'
			WHEN 'earth-exploration-network' THEN 'Earth Exploration Network'
		END
		OR OLD.`scene_r2_key` IS NOT NULL
		OR COALESCE(
			typeof(OLD.`created_at_ms`) = 'integer'
			AND OLD.`created_at_ms` BETWEEN 1 AND 8640000000000000,
			0
		) = 0
		OR CASE WHEN json_valid(OLD.`scene_json`) = 1 THEN COALESCE(
			json_type(OLD.`scene_json`, '$') = 'object'
			AND json_type(OLD.`scene_json`, '$.appearance') = 'text'
			AND json_extract(OLD.`scene_json`, '$.appearance') IN ('scientific', 'immersive')
			AND json_type(OLD.`scene_json`, '$.savedAtMs') = 'integer'
			AND json_extract(OLD.`scene_json`, '$.savedAtMs') = OLD.`created_at_ms`
			AND OLD.`scene_json` = json_object(
				'schemaId', 'cosmography.user-saved-places',
				'schemaVersion', '1.0.0',
				'entityId', OLD.`entity_id`,
				'domain', CASE OLD.`entity_id`
					WHEN 'observable-universe' THEN 'lightcone'
					WHEN 'laniakea' THEN 'extragalactic'
					WHEN 'local-group' THEN 'extragalactic'
					WHEN 'andromeda' THEN 'extragalactic'
					WHEN 'milky-way' THEN 'galactic'
					WHEN 'sagittarius-a-star' THEN 'simulation'
					WHEN 'proxima-centauri' THEN 'galactic'
					WHEN 'trappist-1' THEN 'system'
					WHEN 'solar-system' THEN 'system'
					WHEN 'mars' THEN 'globe'
					WHEN 'jezero' THEN 'surface'
					WHEN 'apollo-17' THEN 'surface'
					WHEN 'voyager-1' THEN 'system'
					WHEN 'jwst-deep-fields' THEN 'lightcone'
					WHEN 'earth-exploration-network' THEN 'globe'
				END,
				'focusId', OLD.`entity_id`,
				'appearance', json_extract(OLD.`scene_json`, '$.appearance'),
				'timelineYear', 2026,
				'releaseId', 'rel_landing_atlas_v0_1_0',
				'savedAtMs', json_extract(OLD.`scene_json`, '$.savedAtMs'),
				'method', 'manual-save-place',
				'truth', json_object(
					'userConfirmed', json('true'),
					'passiveNavigation', json('false'),
					'navigationAidOnly', json('true'),
					'physicalCameraPose', json('false'),
					'observationClaim', json('false'),
					'encounterClaim', json('false'),
					'routeClaim', json('false'),
					'progressClaim', json('false'),
					'completionClaim', json('false'),
					'masteryClaim', json('false'),
					'achievementClaim', json('false'),
					'scientificDiscoveryClaim', json('false'),
					'shared', json('false')
				)
			),
			0
		) ELSE 0 END = 0;

	SELECT RAISE(ABORT, 'invalid saved place identity')
	WHERE NEW.`contract_version` IS NOT '1.0.0'
		OR NEW.`navigation_target_id` IS NOT NEW.`entity_id`
		OR NEW.`label` IS NOT CASE NEW.`entity_id`
			WHEN 'observable-universe' THEN 'Known Universe'
			WHEN 'laniakea' THEN 'Laniakea'
			WHEN 'local-group' THEN 'Local Group'
			WHEN 'andromeda' THEN 'Andromeda Galaxy'
			WHEN 'milky-way' THEN 'Milky Way'
			WHEN 'sagittarius-a-star' THEN 'Sagittarius A*'
			WHEN 'proxima-centauri' THEN 'Proxima Centauri'
			WHEN 'trappist-1' THEN 'TRAPPIST-1'
			WHEN 'solar-system' THEN 'Solar System'
			WHEN 'mars' THEN 'Mars'
			WHEN 'jezero' THEN 'Jezero Crater'
			WHEN 'apollo-17' THEN 'Apollo 17 · Taurus–Littrow'
			WHEN 'voyager-1' THEN 'Voyager 1'
			WHEN 'jwst-deep-fields' THEN 'Webb Deep Fields'
			WHEN 'earth-exploration-network' THEN 'Earth Exploration Network'
		END
		OR NEW.`scene_r2_key` IS NOT NULL;

	SELECT RAISE(ABORT, 'invalid saved place timestamp')
	WHERE COALESCE(
		typeof(NEW.`created_at_ms`) = 'integer'
		AND NEW.`created_at_ms` BETWEEN 1 AND 8640000000000000
		AND NEW.`created_at_ms` > OLD.`created_at_ms`,
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid saved place scene')
	WHERE CASE WHEN json_valid(NEW.`scene_json`) = 1 THEN COALESCE(
		json_type(NEW.`scene_json`, '$') = 'object'
		AND json_type(NEW.`scene_json`, '$.appearance') = 'text'
		AND json_extract(NEW.`scene_json`, '$.appearance') IN ('scientific', 'immersive')
		AND json_type(NEW.`scene_json`, '$.savedAtMs') = 'integer'
		AND json_extract(NEW.`scene_json`, '$.savedAtMs') = NEW.`created_at_ms`
		AND NEW.`scene_json` = json_object(
			'schemaId', 'cosmography.user-saved-places',
			'schemaVersion', '1.0.0',
			'entityId', NEW.`entity_id`,
			'domain', CASE NEW.`entity_id`
				WHEN 'observable-universe' THEN 'lightcone'
				WHEN 'laniakea' THEN 'extragalactic'
				WHEN 'local-group' THEN 'extragalactic'
				WHEN 'andromeda' THEN 'extragalactic'
				WHEN 'milky-way' THEN 'galactic'
				WHEN 'sagittarius-a-star' THEN 'simulation'
				WHEN 'proxima-centauri' THEN 'galactic'
				WHEN 'trappist-1' THEN 'system'
				WHEN 'solar-system' THEN 'system'
				WHEN 'mars' THEN 'globe'
				WHEN 'jezero' THEN 'surface'
				WHEN 'apollo-17' THEN 'surface'
				WHEN 'voyager-1' THEN 'system'
				WHEN 'jwst-deep-fields' THEN 'lightcone'
				WHEN 'earth-exploration-network' THEN 'globe'
			END,
			'focusId', NEW.`entity_id`,
			'appearance', json_extract(NEW.`scene_json`, '$.appearance'),
			'timelineYear', 2026,
			'releaseId', 'rel_landing_atlas_v0_1_0',
			'savedAtMs', json_extract(NEW.`scene_json`, '$.savedAtMs'),
			'method', 'manual-save-place',
			'truth', json_object(
				'userConfirmed', json('true'),
				'passiveNavigation', json('false'),
				'navigationAidOnly', json('true'),
				'physicalCameraPose', json('false'),
				'observationClaim', json('false'),
				'encounterClaim', json('false'),
				'routeClaim', json('false'),
				'progressClaim', json('false'),
				'completionClaim', json('false'),
				'masteryClaim', json('false'),
				'achievementClaim', json('false'),
				'scientificDiscoveryClaim', json('false'),
				'shared', json('false')
			)
		),
		0
	) ELSE 0 END = 0;
END;
