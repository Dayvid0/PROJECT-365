CREATE TABLE `habit_schedule_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`habit_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`kind` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `habit_schedule_exceptions_user_habit_dates_idx` ON `habit_schedule_exceptions` (`user_id`,`habit_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `habit_schedule_exceptions_user_dates_idx` ON `habit_schedule_exceptions` (`user_id`,`start_date`);--> statement-breakpoint
CREATE TABLE `habit_schedule_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`habit_id` text NOT NULL,
	`version` integer NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`cadence` text NOT NULL,
	`weekdays` text DEFAULT '[]' NOT NULL,
	`times_per_week` integer,
	`interval_days` integer,
	`month_day` integer,
	`times_per_day` integer DEFAULT 1 NOT NULL,
	`target_value` real,
	`unit` text,
	`target_duration_seconds` integer,
	`day_start_minute` integer DEFAULT 0 NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`anchor_date` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_schedule_versions_user_habit_version_uidx` ON `habit_schedule_versions` (`user_id`,`habit_id`,`version`);--> statement-breakpoint
CREATE INDEX `habit_schedule_versions_user_habit_effective_idx` ON `habit_schedule_versions` (`user_id`,`habit_id`,`effective_from`);--> statement-breakpoint
CREATE INDEX `habit_schedule_versions_user_effective_idx` ON `habit_schedule_versions` (`user_id`,`effective_from`);--> statement-breakpoint
DROP INDEX `habit_logs_user_habit_date_uidx`;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `occurrence` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `value` real;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `unit` text;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `note` text;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `started_at` integer;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `ended_at` integer;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `created_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `habit_logs` SET `created_at` = `updated_at`;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `edited_at` integer;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `is_skip` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `habit_logs` ADD `planned_break` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `habit_logs_user_habit_date_occurrence_uidx` ON `habit_logs` (`user_id`,`habit_id`,`date`,`occurrence`);--> statement-breakpoint
ALTER TABLE `habits` ADD `description` text;--> statement-breakpoint
ALTER TABLE `habits` ADD `kind` text DEFAULT 'check_in' NOT NULL;--> statement-breakpoint
ALTER TABLE `habits` ADD `target_value` real;--> statement-breakpoint
ALTER TABLE `habits` ADD `unit` text;--> statement-breakpoint
ALTER TABLE `habits` ADD `target_duration_seconds` integer;--> statement-breakpoint
INSERT INTO `habit_schedule_versions` (
	`id`, `user_id`, `habit_id`, `version`, `effective_from`, `effective_to`,
	`cadence`, `weekdays`, `times_per_week`, `interval_days`, `month_day`,
	`times_per_day`, `target_value`, `unit`, `target_duration_seconds`,
	`day_start_minute`, `timezone`, `anchor_date`, `created_at`
)
SELECT
	lower(hex(randomblob(16))),
	h.`user_id`,
	h.`id`,
	1,
	date(h.`created_at` / 1000, 'unixepoch'),
	NULL,
	'daily',
	'[]',
	NULL,
	NULL,
	NULL,
	1,
	h.`target_value`,
	h.`unit`,
	h.`target_duration_seconds`,
	0,
	COALESCE(u.`timezone`, 'UTC'),
	date(h.`created_at` / 1000, 'unixepoch'),
	h.`created_at`
FROM `habits` h
LEFT JOIN `users` u ON u.`id` = h.`user_id`;