-- 文章发布记录表 - 记录每篇文章在各个平台的发布情况
CREATE TABLE IF NOT EXISTS article_publications (
    id TEXT PRIMARY KEY,
    articleId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT NOT NULL, -- pending, draft_created, publishing, published, failed, cancelled
    publishType TEXT NOT NULL, -- draft_only, full_publish
    draftId TEXT, -- 平台返回的草稿ID
    publishedUrl TEXT, -- 发布后的文章URL
    errorMessage TEXT, -- 错误信息
    startedAt INTEGER NOT NULL,
    completedAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (articleId) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (accountId) REFERENCES platform_accounts(id) ON DELETE CASCADE
);

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_article_publications_articleId ON article_publications(articleId);
CREATE INDEX IF NOT EXISTS idx_article_publications_accountId ON article_publications(accountId);
CREATE INDEX IF NOT EXISTS idx_article_publications_platform ON article_publications(platform);
CREATE INDEX IF NOT EXISTS idx_article_publications_status ON article_publications(status);

-- 发布任务表 - 用于批量发布和定时发布的任务队列
CREATE TABLE IF NOT EXISTS publish_tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- single, batch, scheduled
    status TEXT NOT NULL, -- pending, processing, completed, failed, cancelled
    articleIds TEXT NOT NULL, -- JSON数组，存储文章ID列表
    accountConfigs TEXT NOT NULL, -- JSON对象，存储账号配置 {accountId: {platform, draftOnly}}
    scheduleTime INTEGER, -- 定时发布时间戳
    currentStep INTEGER DEFAULT 0,
    totalSteps INTEGER NOT NULL,
    progressData TEXT, -- JSON对象，存储每个步骤的详细进度
    resultData TEXT, -- JSON对象，存储执行结果
    errorData TEXT, -- JSON对象，存储错误信息
    createdAt INTEGER NOT NULL,
    startedAt INTEGER,
    completedAt INTEGER,
    updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_publish_tasks_status ON publish_tasks(status);
CREATE INDEX IF NOT EXISTS idx_publish_tasks_scheduleTime ON publish_tasks(scheduleTime);

-- 发布步骤详情表 - 记录每个发布任务的详细步骤
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
    duration INTEGER, -- 执行时长(毫秒)
    inputData TEXT, -- JSON，输入数据
    outputData TEXT, -- JSON，输出数据
    errorMessage TEXT,
    retryCount INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (taskId) REFERENCES publish_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_publish_task_steps_taskId ON publish_task_steps(taskId);
CREATE INDEX IF NOT EXISTS idx_publish_task_steps_status ON publish_task_steps(status);

-- 平台账号统计表 - 记录每个账号的发布统计
CREATE TABLE IF NOT EXISTS account_statistics (
    accountId TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    totalPublished INTEGER DEFAULT 0,
    totalDrafts INTEGER DEFAULT 0,
    totalFailed INTEGER DEFAULT 0,
    lastPublishedAt INTEGER,
    lastPublishedArticleId TEXT,
    publishHistory TEXT, -- JSON数组，最近发布记录
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (accountId) REFERENCES platform_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_statistics_platform ON account_statistics(platform);
