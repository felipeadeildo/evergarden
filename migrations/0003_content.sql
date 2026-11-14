CREATE TABLE `content` (
	`sha256` text PRIMARY KEY NOT NULL,
	`markdown` text NOT NULL,
	`rendered` blob,
	`renderer_version` integer
);
