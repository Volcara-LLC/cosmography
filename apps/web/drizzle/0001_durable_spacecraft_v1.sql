INSERT INTO `propulsion_models` (
	`id`,
	`code`,
	`version`,
	`model_class`,
	`title`,
	`distance_definition`,
	`definition_json`,
	`evidence_class`,
	`citation_assertion_id`
) VALUES
(
	'prop_concept_fusion_0_1c_v1',
	'fusion-0.1c',
	'1.0.0',
	'hypothetical-physical',
	'Fusion 0.1c concept',
	'source-distance-light-years',
	'{"schemaId":"cosmography.propulsion-model","schemaVersion":"1.0.0","profile":"fusion-0.1c","compatibleTravelMode":"fusion","truthClass":"hypothetical-physical","speedFractionOfC":0.1,"fictional":false,"counterfactual":true,"personalConcept":true,"comparisonOnly":true,"availableVehicle":false,"actualJourneyClaim":false,"missionPlan":false,"trajectoryClaim":false,"telemetryClaim":false,"scientificValidation":false,"disclosure":"Hypothetical constant 0.1c comparison only; no available spacecraft or mission is claimed.","omittedPhysics":["acceleration","deceleration","energy","route-geometry","mission-constraints","traveler-frame-time","relativistic-observer-effects"]}',
	'physics-simulation',
	NULL
),
(
	'prop_concept_warp_fiction_v1',
	'fictional-warp',
	'1.0.0',
	'fictional-only',
	'Fictional warp concept',
	'fictional-only',
	'{"schemaId":"cosmography.propulsion-model","schemaVersion":"1.0.0","profile":"fictional-warp","compatibleTravelMode":"warp","truthClass":"fictional-only","speedFractionOfC":null,"fictional":true,"counterfactual":false,"personalConcept":true,"comparisonOnly":true,"availableVehicle":false,"actualJourneyClaim":false,"missionPlan":false,"trajectoryClaim":false,"telemetryClaim":false,"scientificValidation":false,"disclosure":"Fictional story concept only; no scientific duration, available spacecraft, or mission is claimed.","omittedPhysics":["acceleration","deceleration","energy","route-geometry","mission-constraints","traveler-frame-time","relativistic-observer-effects"]}',
	'artist-interpretation',
	NULL
);
--> statement-breakpoint
CREATE TRIGGER `trg_durable_propulsion_models_immutable_insert`
BEFORE INSERT ON `propulsion_models`
WHEN NEW.`id` IN (
	'prop_concept_fusion_0_1c_v1',
	'prop_concept_warp_fiction_v1'
)
	OR (NEW.`code` = 'fusion-0.1c' AND NEW.`version` = '1.0.0')
	OR (NEW.`code` = 'fictional-warp' AND NEW.`version` = '1.0.0')
BEGIN
	SELECT RAISE(ABORT, 'durable propulsion model is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_durable_propulsion_models_immutable_update`
BEFORE UPDATE ON `propulsion_models`
WHEN OLD.`id` IN (
	'prop_concept_fusion_0_1c_v1',
	'prop_concept_warp_fiction_v1'
)
	OR NEW.`id` IN (
		'prop_concept_fusion_0_1c_v1',
		'prop_concept_warp_fiction_v1'
	)
	OR (NEW.`code` = 'fusion-0.1c' AND NEW.`version` = '1.0.0')
	OR (NEW.`code` = 'fictional-warp' AND NEW.`version` = '1.0.0')
BEGIN
	SELECT RAISE(ABORT, 'durable propulsion model is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_durable_propulsion_models_immutable_delete`
BEFORE DELETE ON `propulsion_models`
WHEN OLD.`id` IN (
	'prop_concept_fusion_0_1c_v1',
	'prop_concept_warp_fiction_v1'
)
BEGIN
	SELECT RAISE(ABORT, 'durable propulsion model is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `trg_user_spacecraft_durable_insert`
BEFORE INSERT ON `user_spacecraft`
BEGIN
	SELECT RAISE(ABORT, 'durable spacecraft identity already exists')
	WHERE EXISTS (
		SELECT 1 FROM `user_spacecraft` WHERE `id` = NEW.`id`
	);

	SELECT RAISE(ABORT, 'invalid durable spacecraft identity')
	WHERE COALESCE(
		length(NEW.`id`) = 37
		AND substr(NEW.`id`, 1, 5) = 'ship_'
		AND substr(NEW.`id`, 6, 32) NOT GLOB '*[^0-9a-f]*',
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid durable spacecraft display name')
	WHERE COALESCE(
		typeof(NEW.`display_name`) = 'text'
		AND length(NEW.`display_name`) BETWEEN 1 AND 80
		AND NEW.`display_name` = trim(NEW.`display_name`)
		AND instr(NEW.`display_name`, char(0)) = 0
		AND NOT EXISTS (
			SELECT 1
			FROM json_each(
				'[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,1564,8206,8207,8234,8235,8236,8237,8238,8294,8295,8296,8297]'
			) AS forbidden_code_point
			WHERE instr(
				NEW.`display_name`,
				char(CAST(forbidden_code_point.`value` AS integer))
			) > 0
		),
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid durable spacecraft propulsion model')
	WHERE NEW.`propulsion_model_id` NOT IN (
		'prop_concept_fusion_0_1c_v1',
		'prop_concept_warp_fiction_v1'
	);

	SELECT RAISE(ABORT, 'invalid durable spacecraft timestamps')
	WHERE COALESCE(
		typeof(NEW.`created_at_ms`) = 'integer'
		AND typeof(NEW.`updated_at_ms`) = 'integer'
		AND NEW.`created_at_ms` > 0
		AND NEW.`updated_at_ms` >= NEW.`created_at_ms`,
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid durable spacecraft appearance JSON')
	WHERE COALESCE(json_valid(NEW.`cosmetics_json`), 0) = 0;

	SELECT RAISE(ABORT, 'invalid durable spacecraft appearance')
	WHERE COALESCE(
		typeof(NEW.`cosmetics_json`) = 'text'
		AND length(NEW.`cosmetics_json`) BETWEEN 2 AND 2048
		AND json_type(NEW.`cosmetics_json`) = 'object'
		AND json(NEW.`cosmetics_json`) = NEW.`cosmetics_json`
		AND (SELECT count(*) FROM json_each(NEW.`cosmetics_json`)) = 5
		AND NOT EXISTS (
			SELECT 1
			FROM json_each(NEW.`cosmetics_json`)
			WHERE `key` NOT IN (
				'schemaId',
				'schemaVersion',
				'hullPreset',
				'accentPreset',
				'insignia'
			)
		)
		AND json_type(NEW.`cosmetics_json`, '$.schemaId') = 'text'
		AND json_extract(NEW.`cosmetics_json`, '$.schemaId') = 'cosmography.user-spacecraft.appearance'
		AND json_type(NEW.`cosmetics_json`, '$.schemaVersion') = 'text'
		AND json_extract(NEW.`cosmetics_json`, '$.schemaVersion') = '1.0.0'
		AND json_type(NEW.`cosmetics_json`, '$.hullPreset') = 'text'
		AND json_extract(NEW.`cosmetics_json`, '$.hullPreset') IN (
			'pearl',
			'graphite',
			'mars-copper',
			'lunar-silver'
		)
		AND json_type(NEW.`cosmetics_json`, '$.accentPreset') = 'text'
		AND json_extract(NEW.`cosmetics_json`, '$.accentPreset') IN (
			'cyan',
			'gold',
			'verdant',
			'ember'
		)
		AND json_type(NEW.`cosmetics_json`, '$.insignia') = 'text'
		AND json_extract(NEW.`cosmetics_json`, '$.insignia') IN (
			'none',
			'orbit',
			'star',
			'horizon'
		),
		0
	) = 0;

	SELECT RAISE(ABORT, 'durable spacecraft owner quota exceeded')
	WHERE (
		SELECT count(*)
		FROM `user_spacecraft`
		WHERE `user_id` = NEW.`user_id`
	) >= 24;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_user_spacecraft_durable_update`
BEFORE UPDATE ON `user_spacecraft`
BEGIN
	SELECT RAISE(ABORT, 'durable spacecraft identity and model are immutable')
	WHERE NEW.`id` IS NOT OLD.`id`
		OR NEW.`user_id` IS NOT OLD.`user_id`
		OR NEW.`propulsion_model_id` IS NOT OLD.`propulsion_model_id`
		OR NEW.`created_at_ms` IS NOT OLD.`created_at_ms`;

	SELECT RAISE(ABORT, 'invalid durable spacecraft identity')
	WHERE COALESCE(
		length(NEW.`id`) = 37
		AND substr(NEW.`id`, 1, 5) = 'ship_'
		AND substr(NEW.`id`, 6, 32) NOT GLOB '*[^0-9a-f]*',
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid durable spacecraft display name')
	WHERE COALESCE(
		typeof(NEW.`display_name`) = 'text'
		AND length(NEW.`display_name`) BETWEEN 1 AND 80
		AND NEW.`display_name` = trim(NEW.`display_name`)
		AND instr(NEW.`display_name`, char(0)) = 0
		AND NOT EXISTS (
			SELECT 1
			FROM json_each(
				'[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,1564,8206,8207,8234,8235,8236,8237,8238,8294,8295,8296,8297]'
			) AS forbidden_code_point
			WHERE instr(
				NEW.`display_name`,
				char(CAST(forbidden_code_point.`value` AS integer))
			) > 0
		),
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid durable spacecraft propulsion model')
	WHERE NEW.`propulsion_model_id` NOT IN (
		'prop_concept_fusion_0_1c_v1',
		'prop_concept_warp_fiction_v1'
	);

	SELECT RAISE(ABORT, 'invalid durable spacecraft timestamps')
	WHERE COALESCE(
		typeof(NEW.`created_at_ms`) = 'integer'
		AND typeof(NEW.`updated_at_ms`) = 'integer'
		AND NEW.`created_at_ms` > 0
		AND NEW.`updated_at_ms` > OLD.`updated_at_ms`
		AND NEW.`updated_at_ms` >= NEW.`created_at_ms`,
		0
	) = 0;

	SELECT RAISE(ABORT, 'invalid durable spacecraft appearance JSON')
	WHERE COALESCE(json_valid(NEW.`cosmetics_json`), 0) = 0;

	SELECT RAISE(ABORT, 'invalid durable spacecraft appearance')
	WHERE COALESCE(
		typeof(NEW.`cosmetics_json`) = 'text'
		AND length(NEW.`cosmetics_json`) BETWEEN 2 AND 2048
		AND json_type(NEW.`cosmetics_json`) = 'object'
		AND json(NEW.`cosmetics_json`) = NEW.`cosmetics_json`
		AND (SELECT count(*) FROM json_each(NEW.`cosmetics_json`)) = 5
		AND NOT EXISTS (
			SELECT 1
			FROM json_each(NEW.`cosmetics_json`)
			WHERE `key` NOT IN (
				'schemaId',
				'schemaVersion',
				'hullPreset',
				'accentPreset',
				'insignia'
			)
		)
		AND json_type(NEW.`cosmetics_json`, '$.schemaId') = 'text'
		AND json_extract(NEW.`cosmetics_json`, '$.schemaId') = 'cosmography.user-spacecraft.appearance'
		AND json_type(NEW.`cosmetics_json`, '$.schemaVersion') = 'text'
		AND json_extract(NEW.`cosmetics_json`, '$.schemaVersion') = '1.0.0'
		AND json_type(NEW.`cosmetics_json`, '$.hullPreset') = 'text'
		AND json_extract(NEW.`cosmetics_json`, '$.hullPreset') IN (
			'pearl',
			'graphite',
			'mars-copper',
			'lunar-silver'
		)
		AND json_type(NEW.`cosmetics_json`, '$.accentPreset') = 'text'
		AND json_extract(NEW.`cosmetics_json`, '$.accentPreset') IN (
			'cyan',
			'gold',
			'verdant',
			'ember'
		)
		AND json_type(NEW.`cosmetics_json`, '$.insignia') = 'text'
		AND json_extract(NEW.`cosmetics_json`, '$.insignia') IN (
			'none',
			'orbit',
			'star',
			'horizon'
		),
		0
	) = 0;
END;
