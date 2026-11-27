CREATE TABLE `public_challenge_hides` (
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`challenge_id`, `user_id`),
	FOREIGN KEY (`challenge_id`) REFERENCES `public_challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `public_challenge_hides_user_idx` ON `public_challenge_hides` (`user_id`);--> statement-breakpoint
CREATE TABLE `public_challenge_participants` (
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`challenge_id`, `user_id`),
	FOREIGN KEY (`challenge_id`) REFERENCES `public_challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `public_challenge_participants_user_idx` ON `public_challenge_participants` (`user_id`);--> statement-breakpoint
CREATE TABLE `public_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`proposer_user_id` text,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`category` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`policy_version` text NOT NULL,
	`review_note` text,
	`reviewed_by_user_id` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`proposer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "public_challenges_title_check" CHECK(length("public_challenges"."title") between 1 and 80),
	CONSTRAINT "public_challenges_summary_check" CHECK(length("public_challenges"."summary") between 1 and 500),
	CONSTRAINT "public_challenges_window_check" CHECK("public_challenges"."ends_at" > "public_challenges"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `public_challenges_status_idx` ON `public_challenges` (`status`);--> statement-breakpoint
CREATE INDEX `public_challenges_proposer_idx` ON `public_challenges` (`proposer_user_id`);--> statement-breakpoint
ALTER TABLE `safety_reports` ADD `reviewed_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `safety_reports` ADD `review_note` text;--> statement-breakpoint
ALTER TABLE `safety_reports` ADD `reviewed_at` integer;