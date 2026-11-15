CREATE TABLE `draft` (
	`document_id` text PRIMARY KEY NOT NULL,
	`base_version` integer NOT NULL,
	`markdown` text NOT NULL,
	`edits` integer NOT NULL,
	`author_kind` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document`(`id`) ON UPDATE no action ON DELETE cascade
);
