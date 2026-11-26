CREATE TABLE `circle_challenge_participants` (
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`challenge_id`, `user_id`),
	FOREIGN KEY (`challenge_id`) REFERENCES `circle_challenges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `circle_challenge_participants_user_idx` ON `circle_challenge_participants` (`user_id`);--> statement-breakpoint
CREATE TABLE `circle_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`creator_user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "circle_challenges_title_check" CHECK(length("circle_challenges"."title") between 1 and 80),
	CONSTRAINT "circle_challenges_window_check" CHECK("circle_challenges"."ends_at" > "circle_challenges"."starts_at")
);
--> statement-breakpoint
CREATE INDEX `circle_challenges_circle_idx` ON `circle_challenges` (`circle_id`);--> statement-breakpoint
CREATE TABLE `circle_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`grant_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grant_id`) REFERENCES `share_grants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "circle_comments_body_check" CHECK(length("circle_comments"."body") between 1 and 1000)
);
--> statement-breakpoint
CREATE INDEX `circle_comments_circle_grant_idx` ON `circle_comments` (`circle_id`,`grant_id`);--> statement-breakpoint
CREATE INDEX `circle_comments_author_idx` ON `circle_comments` (`author_user_id`);--> statement-breakpoint
CREATE TABLE `circle_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`grant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grant_id`) REFERENCES `share_grants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `circle_reactions_circle_grant_user_uidx` ON `circle_reactions` (`circle_id`,`grant_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `circle_reactions_grant_idx` ON `circle_reactions` (`grant_id`);