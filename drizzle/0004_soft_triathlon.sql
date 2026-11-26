CREATE TABLE `partner_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`inviter_user_id` text NOT NULL,
	`invitee_email` text NOT NULL,
	`invitee_user_id` text,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`inviter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "partner_invites_status_target_check" CHECK(("partner_invites"."status" <> 'accepted' OR "partner_invites"."invitee_user_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_invites_token_uidx` ON `partner_invites` (`token`);--> statement-breakpoint
CREATE INDEX `partner_invites_inviter_idx` ON `partner_invites` (`inviter_user_id`);--> statement-breakpoint
CREATE INDEX `partner_invites_invitee_email_idx` ON `partner_invites` (`invitee_email`);