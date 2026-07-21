CREATE TRIGGER `trg_user_progress_tour_resume_preflight`
BEFORE UPDATE OF `updated_at_ms` ON `user_progress`
WHEN OLD.`scope_entity_id` = 'tour_seven_scales_to_jezero_v1'
	AND OLD.`metric_code` = 'manual-resume-point-v1'
BEGIN
	SELECT RAISE(ABORT, 'existing Seven Scales resume point requires review');
END;
--> statement-breakpoint
UPDATE `user_progress`
SET `updated_at_ms` = `updated_at_ms`
WHERE `scope_entity_id` = 'tour_seven_scales_to_jezero_v1'
	AND `metric_code` = 'manual-resume-point-v1';
--> statement-breakpoint
DROP TRIGGER `trg_user_progress_tour_resume_preflight`;
--> statement-breakpoint
CREATE TRIGGER `trg_user_progress_tour_resume_insert`
BEFORE INSERT ON `user_progress`
WHEN NEW.`scope_entity_id` = 'tour_seven_scales_to_jezero_v1'
	AND NEW.`metric_code` = 'manual-resume-point-v1'
BEGIN
	SELECT RAISE(ABORT, 'Seven Scales resume point already exists')
	WHERE EXISTS (
		SELECT 1
		FROM `user_progress`
		WHERE `user_id` = NEW.`user_id`
			AND `scope_entity_id` = 'tour_seven_scales_to_jezero_v1'
			AND `metric_code` = 'manual-resume-point-v1'
	);

	SELECT RAISE(ABORT, 'invalid Seven Scales resume timestamp')
	WHERE COALESCE(
		typeof(NEW.`updated_at_ms`) = 'integer'
		AND NEW.`updated_at_ms` BETWEEN 1 AND 8640000000000000,
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid Seven Scales resume ordinal')
	WHERE COALESCE(
		typeof(NEW.`value_numeric`) = 'integer'
		AND NEW.`value_numeric` BETWEEN 1 AND 7,
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid Seven Scales resume JSON')
	WHERE COALESCE(
		typeof(NEW.`value_json`) = 'text'
		AND json_valid(NEW.`value_json`) = 1
		AND NEW.`value_json` = json_object(
			'schemaId', 'cosmography.user-tour-resume',
			'schemaVersion', '1.0.0',
			'tourId', 'tour_seven_scales_to_jezero_v1',
			'tourSlug', 'seven-scales-to-jezero',
			'releaseId', 'rel_landing_atlas_v0_1_0',
			'resumeOrdinal', NEW.`value_numeric`,
			'stopId', CASE NEW.`value_numeric`
				WHEN 1 THEN 'scale-observable-universe'
				WHEN 2 THEN 'scale-laniakea'
				WHEN 3 THEN 'scale-local-group'
				WHEN 4 THEN 'scale-milky-way'
				WHEN 5 THEN 'scale-solar-system'
				WHEN 6 THEN 'scale-mars'
				WHEN 7 THEN 'scale-jezero'
			END,
			'targetEntityId', CASE NEW.`value_numeric`
				WHEN 1 THEN 'observable-universe'
				WHEN 2 THEN 'laniakea'
				WHEN 3 THEN 'local-group'
				WHEN 4 THEN 'milky-way'
				WHEN 5 THEN 'solar-system'
				WHEN 6 THEN 'mars'
				WHEN 7 THEN 'jezero'
			END,
			'savedAtMs', NEW.`updated_at_ms`,
			'method', 'manual-save-resume-point',
			'truth', json_object(
				'userConfirmed', json('true'),
				'passiveNavigation', json('false'),
				'resumeStateOnly', json('true'),
				'storedStateDefinesTour', json('false'),
				'completionClaim', json('false'),
				'achievementClaim', json('false'),
				'scientificDiscoveryClaim', json('false')
			)
		),
		0
	) = 0;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_user_progress_tour_resume_update`
BEFORE UPDATE ON `user_progress`
WHEN (
	OLD.`scope_entity_id` = 'tour_seven_scales_to_jezero_v1'
	AND OLD.`metric_code` = 'manual-resume-point-v1'
) OR (
	NEW.`scope_entity_id` = 'tour_seven_scales_to_jezero_v1'
	AND NEW.`metric_code` = 'manual-resume-point-v1'
)
BEGIN
	SELECT RAISE(ABORT, 'Seven Scales resume identity is immutable')
	WHERE NEW.`user_id` IS NOT OLD.`user_id`
		OR NEW.`scope_entity_id` IS NOT OLD.`scope_entity_id`
		OR NEW.`metric_code` IS NOT OLD.`metric_code`;

	SELECT RAISE(ABORT, 'stored Seven Scales resume contract has drifted')
	WHERE COALESCE(
		typeof(OLD.`updated_at_ms`) = 'integer'
		AND OLD.`updated_at_ms` BETWEEN 1 AND 8640000000000000
		AND typeof(OLD.`value_numeric`) = 'integer'
		AND OLD.`value_numeric` BETWEEN 1 AND 7
		AND typeof(OLD.`value_json`) = 'text'
		AND json_valid(OLD.`value_json`) = 1
		AND OLD.`value_json` = json_object(
			'schemaId', 'cosmography.user-tour-resume',
			'schemaVersion', '1.0.0',
			'tourId', 'tour_seven_scales_to_jezero_v1',
			'tourSlug', 'seven-scales-to-jezero',
			'releaseId', 'rel_landing_atlas_v0_1_0',
			'resumeOrdinal', OLD.`value_numeric`,
			'stopId', CASE OLD.`value_numeric`
				WHEN 1 THEN 'scale-observable-universe'
				WHEN 2 THEN 'scale-laniakea'
				WHEN 3 THEN 'scale-local-group'
				WHEN 4 THEN 'scale-milky-way'
				WHEN 5 THEN 'scale-solar-system'
				WHEN 6 THEN 'scale-mars'
				WHEN 7 THEN 'scale-jezero'
			END,
			'targetEntityId', CASE OLD.`value_numeric`
				WHEN 1 THEN 'observable-universe'
				WHEN 2 THEN 'laniakea'
				WHEN 3 THEN 'local-group'
				WHEN 4 THEN 'milky-way'
				WHEN 5 THEN 'solar-system'
				WHEN 6 THEN 'mars'
				WHEN 7 THEN 'jezero'
			END,
			'savedAtMs', OLD.`updated_at_ms`,
			'method', 'manual-save-resume-point',
			'truth', json_object(
				'userConfirmed', json('true'),
				'passiveNavigation', json('false'),
				'resumeStateOnly', json('true'),
				'storedStateDefinesTour', json('false'),
				'completionClaim', json('false'),
				'achievementClaim', json('false'),
				'scientificDiscoveryClaim', json('false')
			)
		),
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid Seven Scales resume timestamp')
	WHERE COALESCE(
		typeof(NEW.`updated_at_ms`) = 'integer'
		AND NEW.`updated_at_ms` BETWEEN 1 AND 8640000000000000
		AND NEW.`updated_at_ms` > OLD.`updated_at_ms`,
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid Seven Scales resume ordinal')
	WHERE COALESCE(
		typeof(NEW.`value_numeric`) = 'integer'
		AND NEW.`value_numeric` BETWEEN 1 AND 7,
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid Seven Scales resume JSON')
	WHERE COALESCE(
		typeof(NEW.`value_json`) = 'text'
		AND json_valid(NEW.`value_json`) = 1
		AND NEW.`value_json` = json_object(
			'schemaId', 'cosmography.user-tour-resume',
			'schemaVersion', '1.0.0',
			'tourId', 'tour_seven_scales_to_jezero_v1',
			'tourSlug', 'seven-scales-to-jezero',
			'releaseId', 'rel_landing_atlas_v0_1_0',
			'resumeOrdinal', NEW.`value_numeric`,
			'stopId', CASE NEW.`value_numeric`
				WHEN 1 THEN 'scale-observable-universe'
				WHEN 2 THEN 'scale-laniakea'
				WHEN 3 THEN 'scale-local-group'
				WHEN 4 THEN 'scale-milky-way'
				WHEN 5 THEN 'scale-solar-system'
				WHEN 6 THEN 'scale-mars'
				WHEN 7 THEN 'scale-jezero'
			END,
			'targetEntityId', CASE NEW.`value_numeric`
				WHEN 1 THEN 'observable-universe'
				WHEN 2 THEN 'laniakea'
				WHEN 3 THEN 'local-group'
				WHEN 4 THEN 'milky-way'
				WHEN 5 THEN 'solar-system'
				WHEN 6 THEN 'mars'
				WHEN 7 THEN 'jezero'
			END,
			'savedAtMs', NEW.`updated_at_ms`,
			'method', 'manual-save-resume-point',
			'truth', json_object(
				'userConfirmed', json('true'),
				'passiveNavigation', json('false'),
				'resumeStateOnly', json('true'),
				'storedStateDefinesTour', json('false'),
				'completionClaim', json('false'),
				'achievementClaim', json('false'),
				'scientificDiscoveryClaim', json('false')
			)
		),
		0
	) = 0;
END;
