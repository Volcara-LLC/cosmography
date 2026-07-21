CREATE TABLE `judge_access_attempts` (
	`attempt_key` text PRIMARY KEY NOT NULL,
	`window_started_at_ms` integer NOT NULL,
	`failure_count` integer NOT NULL,
	`blocked_until_ms` integer DEFAULT 0 NOT NULL,
	`updated_at_ms` integer NOT NULL,
	CONSTRAINT "ck_judge_access_attempt_key" CHECK(length("judge_access_attempts"."attempt_key") = 43 AND "judge_access_attempts"."attempt_key" NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT "ck_judge_access_failure_count" CHECK("judge_access_attempts"."failure_count" BETWEEN 1 AND 8),
	CONSTRAINT "ck_judge_access_timestamps" CHECK("judge_access_attempts"."window_started_at_ms" >= 0 AND "judge_access_attempts"."blocked_until_ms" >= 0 AND "judge_access_attempts"."updated_at_ms" >= "judge_access_attempts"."window_started_at_ms")
);
