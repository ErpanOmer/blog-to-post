-- Add authToken column and verification status columns to platform_accounts
ALTER TABLE platform_accounts ADD COLUMN authToken TEXT;
ALTER TABLE platform_accounts ADD COLUMN isVerified INTEGER DEFAULT 0;
ALTER TABLE platform_accounts ADD COLUMN lastVerifiedAt INTEGER;
