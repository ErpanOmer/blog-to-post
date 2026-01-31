-- Add user info columns to platform_accounts
ALTER TABLE platform_accounts ADD COLUMN userId TEXT;
ALTER TABLE platform_accounts ADD COLUMN userName TEXT;
ALTER TABLE platform_accounts ADD COLUMN avatar TEXT;
