CREATE TABLE `habit_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`habit_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`time` text DEFAULT '08:00' NOT NULL,
	`weekdays` text DEFAULT '[]' NOT NULL,
	`snooze_minutes` integer DEFAULT 10 NOT NULL,
	`stop_after_completion` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_reminders_user_habit_uidx` ON `habit_reminders` (`user_id`,`habit_id`);--> statement-breakpoint
CREATE INDEX `habit_reminders_user_enabled_idx` ON `habit_reminders` (`user_id`,`enabled`);--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `streak_policy` text DEFAULT 'strict' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `reminders_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `quiet_hours_start` text DEFAULT '22:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `quiet_hours_end` text DEFAULT '07:00' NOT NULL;