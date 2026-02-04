-- Add publishId column to article_publications table
-- This stores the unique ID of the article on the target platform after publication
ALTER TABLE article_publications ADD COLUMN publishId TEXT;
