CREATE TABLE `circle_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`inviter_user_id` text NOT NULL,
	`invitee_email` text NOT NULL,
	`invitee_user_id` text,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "circle_invites_status_target_check" CHECK(("circle_invites"."status" <> 'accepted' OR "circle_invites"."invitee_user_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `circle_invites_token_uidx` ON `circle_invites` (`token`);--> statement-breakpoint
CREATE INDEX `circle_invites_circle_idx` ON `circle_invites` (`circle_id`);--> statement-breakpoint
CREATE INDEX `circle_invites_invitee_email_idx` ON `circle_invites` (`invitee_email`);--> statement-breakpoint
CREATE TABLE `circle_memberships` (
	`circle_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`circle_id`, `user_id`),
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `circle_memberships_user_idx` ON `circle_memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `circles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `circles_owner_idx` ON `circles` (`owner_user_id`);--> statement-breakpoint
ALTER TABLE `safety_controls` ALTER COLUMN "circle_id" TO "circle_id" text REFERENCES circles(id) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `share_grants` ALTER COLUMN "circle_id" TO "circle_id" text REFERENCES circles(id) ON DELETE cascade ON UPDATE no action;