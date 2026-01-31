-- Add platform accounts table
CREATE TABLE IF NOT EXISTS platform_accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  token TEXT,
  cookie TEXT,
  description TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

-- Create index for platform filtering
CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts(platform);
