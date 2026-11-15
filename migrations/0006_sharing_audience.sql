ALTER TABLE `sharing` ADD `audience` text DEFAULT 'link' NOT NULL;--> statement-breakpoint
ALTER TABLE `sharing` ADD `people` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `sharing` ADD `versions` text DEFAULT 'current' NOT NULL;