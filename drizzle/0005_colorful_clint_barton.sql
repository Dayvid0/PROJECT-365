CREATE TABLE `weekly_reviews` (
	`user_id` text NOT NULL,
	`week_start` text NOT NULL,
	`note` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `week_start`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
