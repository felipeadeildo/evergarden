-- Full-text index over each document's title and the plain text of its current version.
-- Written by the library on publish and update; not modelled in Drizzle.
CREATE VIRTUAL TABLE `search` USING fts5(
  `document_id` UNINDEXED,
  `title`,
  `body`,
  tokenize = 'unicode61 remove_diacritics 2'
);
