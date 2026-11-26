CREATE TABLE `safety_controls` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`target_user_id` text,
	`circle_id` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "safety_controls_target_check" CHECK((("safety_controls"."kind" = 'leave' AND "safety_controls"."circle_id" IS NOT NULL AND "safety_controls"."target_user_id" IS NULL) OR ("safety_controls"."kind" <> 'leave' AND "safety_controls"."target_user_id" IS NOT NULL AND "safety_controls"."circle_id" IS NULL)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `safety_controls_user_target_uidx` ON `safety_controls` (`user_id`,`kind`,`target_user_id`,`circle_id`);--> statement-breakpoint
CREATE TABLE `safety_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`target_user_id` text,
	`category` text NOT NULL,
	`detail` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`reporter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `safety_reports_reporter_idx` ON `safety_reports` (`reporter_user_id`);--> statement-breakpoint
CREATE INDEX `safety_reports_target_user_idx` ON `safety_reports` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `safety_reports_status_idx` ON `safety_reports` (`status`);--> statement-breakpoint
CREATE TABLE `share_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`audience` text NOT NULL,
	`habit_id` text NOT NULL,
	`recipient_user_id` text,
	`circle_id` text,
	`alias` text,
	`fields` text NOT NULL,
	`frequency` text NOT NULL,
	`consent_version` integer DEFAULT 1 NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "share_grants_audience_target_check" CHECK((("share_grants"."audience" = 'partner' AND "share_grants"."recipient_user_id" IS NOT NULL AND "share_grants"."circle_id" IS NULL) OR ("share_grants"."audience" = 'circle' AND "share_grants"."circle_id" IS NOT NULL AND "share_grants"."recipient_user_id" IS NULL)))
);
--> statement-breakpoint
CREATE INDEX `share_grants_user_habit_idx` ON `share_grants` (`user_id`,`habit_id`);--> statement-breakpoint
CREATE INDEX `share_grants_recipient_idx` ON `share_grants` (`recipient_user_id`);