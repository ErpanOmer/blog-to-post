CREATE TABLE IF NOT EXISTS ai_provider_profiles (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	protocol TEXT NOT NULL CHECK (protocol IN ('openai-compatible', 'anthropic')),
	baseUrl TEXT NOT NULL,
	apiKeyCiphertext TEXT,
	defaultModel TEXT NOT NULL,
	enabled INTEGER NOT NULL DEFAULT 1,
	lastVerifiedAt INTEGER,
	lastVerificationStatus TEXT CHECK (lastVerificationStatus IS NULL OR lastVerificationStatus IN ('success', 'failed')),
	lastVerificationMessage TEXT,
	createdAt INTEGER NOT NULL,
	updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_profiles_name ON ai_provider_profiles(name);
CREATE INDEX IF NOT EXISTS idx_ai_provider_profiles_enabled ON ai_provider_profiles(enabled);

CREATE TABLE IF NOT EXISTS ai_model_routes (
	feature TEXT PRIMARY KEY CHECK (feature IN ('default', 'title', 'content', 'summary', 'tags', 'cover', 'website_slug')),
	providerId TEXT NOT NULL,
	model TEXT NOT NULL,
	temperature REAL,
	topP REAL,
	maxTokens INTEGER,
	requestTimeoutSec INTEGER,
	updatedAt INTEGER NOT NULL,
	FOREIGN KEY (providerId) REFERENCES ai_provider_profiles(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ai_model_routes_providerId ON ai_model_routes(providerId);
