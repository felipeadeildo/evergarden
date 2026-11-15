DROP TABLE `share`;--> statement-breakpoint
DROP TABLE `share_member`;--> statement-breakpoint
CREATE TABLE `sharing` (
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`permission` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer,
	PRIMARY KEY(`target_kind`, `target_id`)
);
