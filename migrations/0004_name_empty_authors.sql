-- Accounts created by a sign-in code before names had a default, and what they signed.
UPDATE `user` SET `name` = substr(`email`, 1, instr(`email`, '@') - 1) WHERE `name` = '';
--> statement-breakpoint
UPDATE `comment` SET `author_name` = (SELECT `name` FROM `user` WHERE `user`.`id` = `comment`.`author_id`)
WHERE `author_kind` = 'user' AND `author_name` = '';
--> statement-breakpoint
UPDATE `reply` SET `author_name` = (SELECT `name` FROM `user` WHERE `user`.`id` = `reply`.`author_id`)
WHERE `author_kind` = 'user' AND `author_name` = '';
--> statement-breakpoint
UPDATE `version` SET `author_name` = (SELECT `name` FROM `user` WHERE `user`.`id` = `version`.`author_id`)
WHERE `author_kind` = 'user' AND `author_name` = '';
