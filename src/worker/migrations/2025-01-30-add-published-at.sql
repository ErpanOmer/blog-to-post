-- Add publishedAt column if missing
ALTER TABLE articles ADD COLUMN publishedAt INTEGER;
