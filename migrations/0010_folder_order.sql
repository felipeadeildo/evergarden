ALTER TABLE `folder` ADD `sort` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `folder` ADD `entry_id` text REFERENCES document(id) ON DELETE set null;--> statement-breakpoint
-- Folders made before this kept their newest documents first; they keep that order.
UPDATE `folder` SET `sort` = 'newest';
