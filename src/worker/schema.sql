-- D1 schema for blog-to-post

CREATE TABLE IF NOT EXISTS articles (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	content TEXT NOT NULL,
	htmlContent TEXT,
	summary TEXT,
	tags TEXT,
	coverImage TEXT,
	platform TEXT NOT NULL,
	status TEXT NOT NULL, -- draft, reviewed, scheduled, published, failed
	publishedAt INTEGER,
	draftId TEXT,
	createdAt INTEGER NOT NULL,
	updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
	id TEXT PRIMARY KEY,
	type TEXT NOT NULL, -- generate, publish
	status TEXT NOT NULL, -- pending, success, failed
	payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_accounts (
	id TEXT PRIMARY KEY,
	platform TEXT NOT NULL, -- juejin, zhihu, xiaohongshu, wechat, csdn
	userId TEXT,
	userName TEXT,
	avatar TEXT,
	authToken TEXT, -- encrypted credential token
	description TEXT,
	isActive INTEGER DEFAULT 1,
	isVerified INTEGER DEFAULT 0,
	lastVerifiedAt INTEGER,
	createdAt INTEGER NOT NULL,
	updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts(platform);

CREATE TABLE IF NOT EXISTS article_publications (
	id TEXT PRIMARY KEY,
	articleId TEXT NOT NULL,
	accountId TEXT NOT NULL,
	platform TEXT NOT NULL,
	status TEXT NOT NULL, -- pending, draft_created, publishing, published, failed, cancelled
	publishType TEXT NOT NULL, -- draft_only, full_publish
	draftId TEXT,
	publishId TEXT,
	publishedUrl TEXT,
	errorMessage TEXT,
	startedAt INTEGER NOT NULL,
	completedAt INTEGER,
	createdAt INTEGER NOT NULL,
	updatedAt INTEGER NOT NULL,
	FOREIGN KEY (articleId) REFERENCES articles(id) ON DELETE CASCADE,
	FOREIGN KEY (accountId) REFERENCES platform_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_article_publications_articleId ON article_publications(articleId);
CREATE INDEX IF NOT EXISTS idx_article_publications_accountId ON article_publications(accountId);
CREATE INDEX IF NOT EXISTS idx_article_publications_platform ON article_publications(platform);
CREATE INDEX IF NOT EXISTS idx_article_publications_status ON article_publications(status);

CREATE TABLE IF NOT EXISTS publish_tasks (
	id TEXT PRIMARY KEY,
	type TEXT NOT NULL, -- single, batch, scheduled
	status TEXT NOT NULL, -- pending, processing, completed, failed, cancelled
	articleIds TEXT NOT NULL, -- JSON array
	accountConfigs TEXT NOT NULL, -- JSON object array
	scheduleTime INTEGER,
	currentStep INTEGER DEFAULT 0,
	idempotencyKey TEXT,
	totalSteps INTEGER NOT NULL,
	progressData TEXT,
	resultData TEXT,
	errorData TEXT,
	createdAt INTEGER NOT NULL,
	startedAt INTEGER,
	completedAt INTEGER,
	updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_publish_tasks_status ON publish_tasks(status);
CREATE INDEX IF NOT EXISTS idx_publish_tasks_scheduleTime ON publish_tasks(scheduleTime);
CREATE UNIQUE INDEX IF NOT EXISTS idx_publish_tasks_idempotencyKey ON publish_tasks(idempotencyKey);

CREATE TABLE IF NOT EXISTS publish_task_steps (
	id TEXT PRIMARY KEY,
	taskId TEXT NOT NULL,
	stepNumber INTEGER NOT NULL,
	articleId TEXT,
	accountId TEXT,
	platform TEXT NOT NULL,
	stepType TEXT NOT NULL, -- validate_account, create_draft, publish_article, verify_result
	status TEXT NOT NULL, -- pending, running, completed, failed, skipped
	startTime INTEGER,
	endTime INTEGER,
	duration INTEGER,
	inputData TEXT,
	outputData TEXT,
	errorMessage TEXT,
	retryCount INTEGER DEFAULT 0,
	createdAt INTEGER NOT NULL,
	FOREIGN KEY (taskId) REFERENCES publish_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_publish_task_steps_taskId ON publish_task_steps(taskId);
CREATE INDEX IF NOT EXISTS idx_publish_task_steps_status ON publish_task_steps(status);

CREATE TABLE IF NOT EXISTS account_statistics (
	accountId TEXT PRIMARY KEY,
	platform TEXT NOT NULL,
	totalPublished INTEGER DEFAULT 0,
	totalDrafts INTEGER DEFAULT 0,
	totalFailed INTEGER DEFAULT 0,
	lastPublishedAt INTEGER,
	lastPublishedArticleId TEXT,
	publishHistory TEXT,
	updatedAt INTEGER NOT NULL,
	FOREIGN KEY (accountId) REFERENCES platform_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_statistics_platform ON account_statistics(platform);

