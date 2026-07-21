CREATE TRIGGER `trg_user_discoveries_recorded_encounter_insert`
BEFORE INSERT ON `user_discoveries`
BEGIN
	SELECT RAISE(ABORT, 'recorded encounter already exists')
	WHERE EXISTS (
		SELECT 1
		FROM `user_discoveries`
		WHERE `user_id` = NEW.`user_id`
			AND `entity_id` = NEW.`entity_id`
	);

	SELECT RAISE(ABORT, 'invalid recorded encounter entity')
	WHERE NEW.`entity_id` NOT IN (
		'observable-universe',
		'laniakea',
		'local-group',
		'andromeda',
		'milky-way',
		'sagittarius-a-star',
		'proxima-centauri',
		'trappist-1',
		'solar-system',
		'mars',
		'jezero',
		'apollo-17',
		'voyager-1',
		'jwst-deep-fields',
		'earth-exploration-network'
	);

	SELECT RAISE(ABORT, 'invalid recorded encounter method')
	WHERE NEW.`discovery_method` IS NOT 'manual-atlas-record';

	SELECT RAISE(ABORT, 'invalid recorded encounter first release')
	WHERE NEW.`release_id` IS NOT 'rel_landing_atlas_v0_1_0';

	SELECT RAISE(ABORT, 'invalid recorded encounter chronology')
	WHERE COALESCE(
		typeof(NEW.`first_seen_at_ms`) = 'integer'
		AND typeof(NEW.`last_seen_at_ms`) = 'integer'
		AND NEW.`first_seen_at_ms` BETWEEN 1 AND 8640000000000000
		AND NEW.`last_seen_at_ms` BETWEEN NEW.`first_seen_at_ms` AND 8640000000000000,
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid recorded encounter count')
	WHERE COALESCE(
		typeof(NEW.`visit_count`) = 'integer'
		AND NEW.`visit_count` = 1,
		0
	) = 0;

	SELECT RAISE(ABORT, 'recorded encounter owner quota exceeded')
	WHERE (
		SELECT count(*)
		FROM `user_discoveries`
		WHERE `user_id` = NEW.`user_id`
	) >= 200;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_user_discoveries_recorded_encounter_update`
BEFORE UPDATE ON `user_discoveries`
BEGIN
	SELECT RAISE(ABORT, 'recorded encounter identity is immutable')
	WHERE NEW.`user_id` IS NOT OLD.`user_id`
		OR NEW.`entity_id` IS NOT OLD.`entity_id`
		OR NEW.`first_seen_at_ms` IS NOT OLD.`first_seen_at_ms`
		OR NEW.`discovery_method` IS NOT OLD.`discovery_method`
		OR NEW.`release_id` IS NOT OLD.`release_id`;

	SELECT RAISE(ABORT, 'invalid recorded encounter entity')
	WHERE NEW.`entity_id` NOT IN (
		'observable-universe',
		'laniakea',
		'local-group',
		'andromeda',
		'milky-way',
		'sagittarius-a-star',
		'proxima-centauri',
		'trappist-1',
		'solar-system',
		'mars',
		'jezero',
		'apollo-17',
		'voyager-1',
		'jwst-deep-fields',
		'earth-exploration-network'
	);

	SELECT RAISE(ABORT, 'invalid recorded encounter method')
	WHERE NEW.`discovery_method` IS NOT 'manual-atlas-record';

	SELECT RAISE(ABORT, 'invalid recorded encounter first release')
	WHERE NEW.`release_id` IS NOT 'rel_landing_atlas_v0_1_0';

	SELECT RAISE(ABORT, 'invalid recorded encounter chronology')
	WHERE COALESCE(
		typeof(NEW.`first_seen_at_ms`) = 'integer'
		AND typeof(NEW.`last_seen_at_ms`) = 'integer'
		AND NEW.`first_seen_at_ms` BETWEEN 1 AND 8640000000000000
		AND NEW.`last_seen_at_ms` BETWEEN NEW.`first_seen_at_ms` AND 8640000000000000
		AND NEW.`last_seen_at_ms` > OLD.`last_seen_at_ms`,
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid recorded encounter count')
	WHERE COALESCE(
		typeof(NEW.`visit_count`) = 'integer'
		AND NEW.`visit_count` BETWEEN 2 AND 9007199254740991
		AND OLD.`visit_count` < 9007199254740991
		AND NEW.`visit_count` = OLD.`visit_count` + 1,
		0
	) = 0;
END;
