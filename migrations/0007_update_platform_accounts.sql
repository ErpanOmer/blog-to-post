-- Update platform_accounts table to match new schema
-- Add missing columns
ALTER TABLE platform_accounts ADD COLUMN userId TEXT;
ALTER TABLE platform_accounts ADD COLUMN userName TEXT;
ALTER TABLE platform_accounts ADD COLUMN avatar TEXT;
ALTER TABLE platform_accounts ADD COLUMN authToken TEXT;
ALTER TABLE platform_accounts ADD COLUMN isVerified INTEGER DEFAULT 0;
ALTER TABLE platform_accounts ADD COLUMN lastVerifiedAt INTEGER;

-- Migrate existing data if any
UPDATE platform_accounts SET userName = name WHERE userName IS NULL;
UPDATE platform_accounts SET authToken = token WHERE authToken IS NULL;

-- Note: We keep old columns (name, token, cookie) for now to avoid data loss during migration
